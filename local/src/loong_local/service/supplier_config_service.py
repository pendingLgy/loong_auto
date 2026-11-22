"""供应商 API Key 与模型启用配置持久化。"""

from loong_contracts.utils.datetime_util import utcnow
from sqlalchemy import delete, insert, select, update

from loong_local import schema
from loong_local.db import AsyncSqliteDB
from loong_local.schema.model import SupplierConfigModel, SupplierModelOptionModel


class SupplierConfigService:
    """读写 supplier_config 与 supplier_model_option。"""

    def __init__(self, db: AsyncSqliteDB):
        self.db = db
        self.config_table = schema.GLOBAL_TABLES.supplier_config_table
        self.option_table = schema.GLOBAL_TABLES.supplier_model_option_table

    # ------------------------------------------------------------ 供应商配置
    async def get_config(self, provider: str) -> SupplierConfigModel | None:
        async with self.db.session() as session:
            row = (await session.execute(
                select(self.config_table).where(self.config_table.c.provider == provider)
            )).mappings().first()
        return self._to_config(row) if row else None

    async def get_api_key(self, provider: str) -> str | None:
        config = await self.get_config(provider)
        return config.api_key if config else None

    async def list_configs(self) -> list[SupplierConfigModel]:
        async with self.db.session() as session:
            rows = (await session.execute(
                select(self.config_table).order_by(self.config_table.c.updated_at.desc())
            )).mappings().all()
        return [self._to_config(row) for row in rows]

    async def save_config(self, provider: str, api_key: str,
                          base_url: str | None = None) -> SupplierConfigModel:
        if not provider or not api_key:
            raise ValueError("provider、api_key 均不能为空")

        now = utcnow()
        async with self.db.session(write=True) as session:
            existing = (await session.execute(
                select(self.config_table.c.id).where(self.config_table.c.provider == provider)
            )).mappings().first()

            if existing is None:
                await session.execute(
                    insert(self.config_table).values(
                        provider=provider,
                        alias=None,
                        base_url=base_url,
                        api_key=api_key,
                        created_at=now,
                        updated_at=now,
                    )
                )
            else:
                values = {"api_key": api_key, "updated_at": now}
                if base_url is not None:
                    values["base_url"] = base_url
                await session.execute(
                    update(self.config_table)
                    .where(self.config_table.c.id == existing["id"])
                    .values(**values)
                )

        saved = await self.get_config(provider)
        if saved is None:
            raise RuntimeError("供应商配置保存失败")
        return saved

    async def update_api_key(self, provider: str, api_key: str) -> SupplierConfigModel | None:
        async with self.db.session(write=True) as session:
            result = await session.execute(
                update(self.config_table)
                .where(self.config_table.c.provider == provider)
                .values(api_key=api_key, updated_at=utcnow())
            )
            if not result.rowcount:
                return None
        return await self.get_config(provider)

    async def rename_config(self, provider: str, alias: str) -> SupplierConfigModel | None:
        async with self.db.session(write=True) as session:
            result = await session.execute(
                update(self.config_table)
                .where(self.config_table.c.provider == provider)
                .values(alias=alias, updated_at=utcnow())
            )
            if not result.rowcount:
                return None
        return await self.get_config(provider)

    async def delete_config(self, provider: str) -> bool:
        async with self.db.session(write=True) as session:
            result = await session.execute(
                delete(self.config_table).where(self.config_table.c.provider == provider)
            )
        return bool(result.rowcount)

    # ---------------------------------------------------------- 模型启用配置
    async def get_option(self, provider: str, model: str) -> SupplierModelOptionModel | None:
        async with self.db.session() as session:
            row = (await session.execute(
                select(self.option_table).where(
                    self.option_table.c.provider == provider,
                    self.option_table.c.model == model,
                )
            )).mappings().first()
        return self._to_option(row) if row else None

    async def list_options(self, provider: str | None = None) -> list[SupplierModelOptionModel]:
        async with self.db.session() as session:
            statement = select(self.option_table).order_by(self.option_table.c.provider, self.option_table.c.model)
            if provider is not None:
                statement = statement.where(self.option_table.c.provider == provider)
            rows = (await session.execute(statement)).mappings().all()
        return [self._to_option(row) for row in rows]

    async def set_option(self, provider: str, model: str, enabled: bool) -> SupplierModelOptionModel:
        if not provider or not model:
            raise ValueError("provider、model 均不能为空")

        now = utcnow()
        async with self.db.session(write=True) as session:
            existing = (await session.execute(
                select(self.option_table.c.id).where(
                    self.option_table.c.provider == provider,
                    self.option_table.c.model == model,
                )
            )).mappings().first()

            if existing is None:
                await session.execute(
                    insert(self.option_table).values(
                        provider=provider,
                        model=model,
                        enabled=enabled,
                        created_at=now,
                        updated_at=now,
                    )
                )
            else:
                await session.execute(
                    update(self.option_table)
                    .where(self.option_table.c.id == existing["id"])
                    .values(enabled=enabled, updated_at=now)
                )

        saved = await self.get_option(provider, model)
        if saved is None:
            raise RuntimeError("模型启用配置保存失败")
        return saved

    async def delete_option(self, provider: str, model: str) -> bool:
        async with self.db.session(write=True) as session:
            result = await session.execute(
                delete(self.option_table).where(
                    self.option_table.c.provider == provider,
                    self.option_table.c.model == model,
                )
            )
        return bool(result.rowcount)

    # -------------------------------------------------------------- 领域转换
    @staticmethod
    def _to_config(row) -> SupplierConfigModel:
        return SupplierConfigModel.model_validate(dict(row))

    @staticmethod
    def _to_option(row) -> SupplierModelOptionModel:
        return SupplierModelOptionModel.model_validate(dict(row))
