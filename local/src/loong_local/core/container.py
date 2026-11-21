import importlib
import importlib.util
import inspect
import pkgutil
from collections.abc import Sequence
from typing import Annotated, get_args, get_origin, get_type_hints

from dependency_injector import containers, providers

from loong_local.config.config_gateway import GatewayConfig
from loong_local.db.sqlite_db import AsyncSqliteDB


class ApplicationContainer(containers.DynamicContainer):
    """
    应用依赖容器：声明基础设施 Provider，并提供业务类扫描及 wiring 辅助逻辑。

    基础设施：
        global_config：由调用方提供 GlobalConfig 实例。
        db_proxy、cache_proxy：Singleton Provider，首次调用时创建代理实例。
        获取实例使用 container.db_proxy()，不会自动启动数据库或缓存；
        start_proxy、close 等异步生命周期操作仍由应用 lifespan 管理。

    service_targets 支持的形式：
        "loong_cloud.storage"：递归扫描包内的非包模块；不提取包 __init__.py
        中定义的类，也不提取嵌套包 __init__.py 中的类。
        "loong_cloud.storage.user_store"：扫描单个模块中定义的公开非抽象类。
        "loong_cloud.storage.user_store.UserStore"：指定具体类。
        ("user_store", "loong_cloud.storage.user_store.UserStore")：显式指定注册名。
        扫描会导入模块并执行其顶层代码；没有业务类基类或装饰器过滤条件。

    注册名称与构造函数注入：
        模块扫描默认使用模块属性名的小写，如 UserStore -> userstore；
        指定类路径时使用类名的小写，不使用文件名、蛇形命名或全路径作为 Key。
        同一 Key 对应同一个类时跳过重复项，对应不同类时抛出 RuntimeError；
        同名类需要通过不同别名区分。
        构造函数优先按类型注解精确匹配资源，其次按参数名匹配；
        支持字符串注解和 Annotated，同类型多个资源时报错。
        不会自动把已注册业务服务加入依赖资源池。
        未匹配的必填参数会报错；未匹配但有默认值的参数使用类自身默认值。
        动态 Provider 使用 Singleton 注册，调用 container.user_store() 获取实例。

    wire_targets：
        只接受模块或包路径；包会展开为包自身及递归找到的非包子模块，
        去重排序后调用 wire(modules=...)。服务注册目标与 wiring 目标独立配置。
        动态 Provider 使用字符串标识注入，避免引用类声明上不存在的动态属性：

    使用方法：

        初始化容器:
            >>> container = ApplicationContainer(
            ...     global_config=config_instance,
            ...     service_targets=[
            ...         "loong_cloud.modules.order",                     # 扫描整个 order 包下的所有类
            ...         "loong_cloud.modules.user.store",                # 扫描 store.py 中的所有业务类
            ...         ("custom_sms", "loong_cloud.ext.SmsClient"),     # 显式指定别名注册
            ...     ],
            ...     wire_targets=[
            ...         "loong_cloud.api.v1",                            # 递归织入 API 路由包
            ...         "loong_cloud.api.health_api",                    # 织入单个独立 API 文件
            ...     ]
            ... )

        在 FastAPI 路由中使用动态注册的 Service 时，需配合 `@inject` 装饰器、
        `Depends(Provide[...])` 以及 `Annotated` 类型别名：

            >>>    from dependency_injector.wiring import Provide, inject
            ...    from fastapi import Depends
            ...    from loong_cloud.storage.user_store import UserStore
            ...
            ...    @router.get("/example")
            ...    @inject
            ...    async def example(
            ...        user_store: UserStore = Depends(Provide["user_store"]),
            ... ):

        上例要求先以别名 user_store 注册服务，再对路由模块执行 wiring。
        @inject 放在路由装饰器内侧、紧贴函数定义；应用结束后可调用 unwire()。
        测试替换可用 container.user_store.override(providers.Object(fake_store))。

    初始化顺序：
        使用 DynamicContainer，实例化时执行普通 __init__。
        先注册各实例独立的基础设施 Provider，再注册业务服务，最后执行 wiring。
        动态服务使用 Provide["注册名"]；不通过 ApplicationContainer 类属性引用。
    """

    def __init__(
            self,
            db: AsyncSqliteDB,
            gateway_config: GatewayConfig,
            service_targets: Sequence[str | tuple[str, str]] | None = None,
            wire_targets: Sequence[str] | None = None,
    ):
        super().__init__()

        self.gateway_config = gateway_config
        self.db = db

        # self.set_provider("global_config", providers.Object(gateway_config))
        # self.set_provider("db_proxy", providers.Object(db_proxy))
        # self.set_provider("cache_proxy", providers.Object(cache_proxy))

        available_resources = {
            "db": self.db,
            "gateway_config": self.gateway_config,
        }

        if service_targets:
            self._register_services(service_targets, available_resources)

        if wire_targets:
            self._wire_targets(wire_targets)

    # =========================================================================
    # 两阶段服务注册：1. 收集解析 -> 2. 全局去重与冲突校验 -> 3. 统一绑定
    # =========================================================================
    def _register_services(
            self,
            targets: Sequence[str | tuple[str, str]],
            available_resources: dict,
    ) -> None:
        """
        两阶段服务注册：
        1. 收集解析：将 Package、Module、Class 展开，默认以模块属性名或类名小写作为注册 Key
        2. 去重校验：检测同名冲突，发现重复直接抛出异常
        3. 统一绑定：批量生成 Singleton Provider 并注入资源
        """
        # -------------------------------------------------------------
        # 阶段一：收集与解析
        # -------------------------------------------------------------
        raw_resolved_items: list[tuple[str, str, type]] = []

        for item in targets:
            # 1. 显式别名元组: ("alias", "a.b.MyService")
            if isinstance(item, tuple):
                alias, class_path = item
                cls = self._import_class(class_path)
                raw_resolved_items.append((alias, class_path, cls))
                continue

            # 2. 字符串路径解析
            spec = self._safe_find_spec(item)
            if spec is not None:
                if spec.submodule_search_locations is not None:
                    # 是 Package 包：递归遍历所有子模块并提取类
                    pkg = importlib.import_module(item)
                    for _, mod_name, is_pkg in pkgutil.walk_packages(pkg.__path__, prefix=f"{item}."):
                        if not is_pkg:
                            raw_resolved_items.extend(self._extract_classes_from_module(mod_name))
                else:
                    # 是单文件模块：提取该模块内的类
                    raw_resolved_items.extend(self._extract_classes_from_module(item))
            else:
                # 是精确类路径：默认使用类名小写作为 Key
                cls = self._import_class(item)
                service_name = cls.__name__
                raw_resolved_items.append((service_name, item, cls))

        # -------------------------------------------------------------
        # 阶段二：全局去重与冲突校验（De-duplication & Validation）
        # -------------------------------------------------------------
        unique_registry: dict[str, tuple[str, type]] = {}

        for service_name, class_path, cls in raw_resolved_items:
            if service_name in self.providers or hasattr(self, service_name):
                raise RuntimeError(f"注册键名 '{service_name}' 与容器现有成员冲突")
            if service_name in unique_registry:
                existing_class_path, existing_cls = unique_registry[service_name]

                # 如果是完全相同的类被重复引入（例如既在包里被扫到，又在 targets 里显式写了一遍），安全跳过
                if existing_cls is cls:
                    continue

                # 如果注册键名（类名）相同，但指向了不同的类，说明发生了命名冲突，直接抛出重复异常
                raise RuntimeError(
                    f"【DI 容器冲突错误】注册键名 '{service_name}' 发生重复冲突！\n"
                    f" - 来源 A: {existing_class_path}\n"
                    f" - 来源 B: {class_path}\n"
                    f"检测到存在同名类，请通过显式别名元组 ('custom_alias', 'class_path') 传入以隔离冲突。"
                )

            unique_registry[service_name] = (class_path, cls)

        # -------------------------------------------------------------
        # 阶段三：安全绑定（批量生成 Singleton Provider 并注入资源）
        # -------------------------------------------------------------
        for service_name, (class_path, cls) in unique_registry.items():
            self._bind_single_class(service_name, class_path, cls, available_resources)

    def _extract_classes_from_module(self, module_name: str) -> list[tuple[str, str, type]]:
        """提取本模块定义的公开非抽象类，以模块属性名小写作为 Key"""
        module = importlib.import_module(module_name)
        extracted = []
        for attr_name, cls in inspect.getmembers(module, inspect.isclass):
            if cls.__module__ != module_name:
                continue
            if inspect.isabstract(cls) or attr_name.startswith("_"):
                continue
            full_class_path = f"{module_name}.{attr_name}"
            service_name = attr_name
            extracted.append((service_name, full_class_path, cls))
        return extracted

    def _bind_single_class(
            self,
            service_name: str,
            class_path: str,
            cls: type,
            available_resources: dict,
    ) -> None:
        """精确类型匹配优先，其次参数名，最后保留默认值；不提前实例化 Provider。"""
        sig = inspect.signature(cls.__init__)
        try:
            type_hints = get_type_hints(cls.__init__, include_extras=True)
        except (NameError, TypeError) as exc:
            raise ValueError(f"组件 {class_path} 的构造函数类型注解无法解析") from exc

        resources_by_type = {}
        for name, resource in available_resources.items():
            if isinstance(resource, providers.Object):
                resource_type = type(resource.provides)
            elif isinstance(resource, (providers.Singleton, providers.Factory)):
                resource_type = resource.provides
            elif isinstance(resource, providers.Provider):
                # 无法静态确定输出类型的 Provider 仍可通过参数名匹配。
                continue
            else:
                resource_type = type(resource)
            resources_by_type.setdefault(resource_type, []).append((name, resource))

        inject_kwargs = {}
        for param_name, param in sig.parameters.items():
            if param_name == "self" or param.kind in (
                    inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD,
            ):
                continue
            annotation = type_hints.get(param_name)
            if get_origin(annotation) is Annotated:
                annotation = get_args(annotation)[0]
            matches = resources_by_type.get(annotation, [])
            if len(matches) > 1:
                raise ValueError(
                    f"组件 {class_path} 参数 '{param_name}' 的类型匹配多个资源："
                    f"{[name for name, _ in matches]}"
                )
            if matches:
                resource = matches[0][1]
            elif param_name in available_resources:
                resource = available_resources[param_name]
            elif param.default is not inspect.Parameter.empty:
                continue
            else:
                raise ValueError(
                    f"组件 {class_path} 缺少必填依赖参数 '{param_name}'，"
                    f"类型：{annotation}，当前可用资源: {list(available_resources.keys())}"
                )
            if param.kind is inspect.Parameter.POSITIONAL_ONLY:
                raise TypeError(f"组件 {class_path} 参数 '{param_name}' 不支持关键字注入")
            inject_kwargs[param_name] = resource

        self.set_provider(service_name, providers.Singleton(cls, **inject_kwargs))

    # =========================================================================
    # Wire 目标解析
    # =========================================================================
    def _wire_targets(self, targets: Sequence[str]) -> None:
        """
        解析并执行 Dependency-Injector 的 Wire 织入：
        1. 遍历所有目标路径，若是 Package 则递归展开其内部的所有子模块
        2. 将展开后的模块与显式传入的单文件模块合并
        3. 全局去重，最后统一以 modules 形式传入 self.wire()
        """
        unique_targets = list(dict.fromkeys(targets))
        resolved_modules: set[str] = set()

        for target in unique_targets:
            spec = self._safe_find_spec(target)
            if spec is None:
                raise ImportError(f"Wire 目标路径无效，找不到模块或包: '{target}'")

            # 判断是 Package 包还是单文件 Module
            if spec.submodule_search_locations is not None:
                # 1. 是 Package：加载包并通过 walk_packages 递归获取其下所有子模块
                pkg = importlib.import_module(target)

                # 把包根目录本身（__init__.py 对应的模块）也加入待织入范围
                resolved_modules.add(target)

                # 递归遍历包下所有的子模块
                for _, mod_name, is_pkg in pkgutil.walk_packages(pkg.__path__, prefix=f"{target}."):
                    if not is_pkg:
                        resolved_modules.add(mod_name)
            else:
                # 2. 是单文件 Module：直接加入集合
                resolved_modules.add(target)

        # 转换为排序后的列表，保证日志和加载顺序稳定
        final_modules = sorted(list(resolved_modules))

        # 统一交给 modules 进行织入（不再传 packages）
        self.wire(
            modules=final_modules or None,
            packages=None,
        )

    @staticmethod
    def _safe_find_spec(dotted_path: str):
        try:
            return importlib.util.find_spec(dotted_path)
        except (ModuleNotFoundError, ValueError):
            return None

    @staticmethod
    def _import_class(class_path: str) -> type:
        try:
            module_name, class_name = class_path.rsplit(".", 1)
            module = importlib.import_module(module_name)
            return getattr(module, class_name)
        except (ValueError, ImportError, AttributeError) as e:
            raise ImportError(f"无法加载类路径 [{class_path}]: {e}") from e
