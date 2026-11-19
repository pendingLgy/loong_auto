"""ToolExecutor 测试：准入、审批、路径边界与多会话运行时。

不启动服务、不调用模型；只验证统一执行入口在真实文件系统上的行为。
执行器是应用级单例：策略与工作目录在 inspect/execute 时按会话传入。
"""
import os
from dataclasses import dataclass
from pathlib import Path

import pytest
from pydantic import BaseModel

from loong_local.install_setting import init_tools
from loong_local.tools.base_tool import ToolSuspendedError, ToolUnauthorizedError
from loong_local.tools.registry import GLOBAL_TOOL_REGISTRY
from loong_local.tools.security import (PathGuard, SandboxConfig, ToolGuard,
                                        ToolPermissionError, ToolPermissionGuard,
                                        WorkspaceMode, WorkspacePolicy)
from loong_local.tools.tool_executor import ToolCallRequest, ToolExecutor

READ_ONLY_COMMAND = "Get-ChildItem" if os.name == "nt" else "ls"
OUTSIDE_COMMAND = "Get-ChildItem C:\\Windows" if os.name == "nt" else "ls /etc"

# 全部工具：工具名、参数、是否需要人工审批（workspace_write 模式）
ALL_TOOLS = [
    ("read_file", {"path": "src/a.py"}, False),
    ("list_directory", {"path": "src"}, False),
    ("search_files", {"pattern": "*.py"}, False),
    ("write_file", {"path": "dst/c.txt", "content": "x"}, True),
    ("delete_file", {"path": "src/b.txt"}, True),
    ("create_directory", {"path": "dst/new"}, True),
    ("move_file", {"source": "src/b.txt", "destination": "dst/b.txt"}, True),
    ("copy_file", {"source": "src/a.py", "destination": "dst/a.py"}, True),
    ("shell_command", {"command": READ_ONLY_COMMAND}, True),
]
MUTATIONS = [case for case in ALL_TOOLS if case[2]]


@dataclass(frozen=True)
class Session:
    """一次会话的执行环境：放行策略 + 工作目录。"""

    policy: WorkspacePolicy
    workspaces: tuple[Path, ...]


def make_session(*workspaces, mode=WorkspaceMode.FULL) -> Session:
    return Session(policy=WorkspacePolicy(mode=mode),
                   workspaces=tuple(Path(workspace) for workspace in workspaces))


def make_executor(*, tool_guard=None, allow_absolute_path=False) -> ToolExecutor:
    """构造执行器；白名单与 app 启动时一致（注册表里的全部工具）。"""
    return ToolExecutor(
        registry=GLOBAL_TOOL_REGISTRY,
        tool_guard=tool_guard or ToolGuard(allowed_tools=GLOBAL_TOOL_REGISTRY.list_tool_names()),
        permission_guard=ToolPermissionGuard(),
        path_guard=PathGuard(allow_absolute_path=allow_absolute_path),
        sandbox_config=SandboxConfig(),
    )


def inspect_tool(executor: ToolExecutor, session: Session, tool_name: str, arguments=None):
    return executor.inspect(tool_name, arguments,
                            policy=session.policy, workspaces=session.workspaces)


async def run_tool(executor: ToolExecutor, session: Session, call: ToolCallRequest, *,
                   approved: bool = False):
    return await executor.execute(call, approved=approved,
                                  policy=session.policy, workspaces=session.workspaces)


@pytest.fixture(autouse=True)
def register_tools():
    init_tools()


@pytest.fixture
def workspace(tmp_path):
    root = tmp_path / "ws"
    (root / "src").mkdir(parents=True)
    (root / "dst").mkdir()
    (root / "src" / "a.py").write_text("print(1)", encoding="utf-8")
    (root / "src" / "b.txt").write_text("hello", encoding="utf-8")
    return root


# --------------------------------------------------------------------- 准入
def test_whitelist_matches_registered_tools():
    executor = make_executor()

    assert executor.tool_guard.allowed_tools == frozenset(GLOBAL_TOOL_REGISTRY.list_tool_names())
    assert len(GLOBAL_TOOL_REGISTRY.list_tool_names()) == len(ALL_TOOLS)


@pytest.mark.parametrize("tool_name,arguments,needs_approval", ALL_TOOLS)
def test_inspect_all_tools(workspace, tool_name, arguments, needs_approval):
    # 审批判定只在 workspace_write 模式下生效；full 模式不再逐次确认。
    session = make_session(workspace, mode=WorkspaceMode.WORKSPACE_WRITE)
    inspection = inspect_tool(make_executor(), session, tool_name, arguments)

    assert inspection.tool.tool_name == tool_name
    assert isinstance(inspection.request, inspection.tool.request_model)
    assert inspection.needs_approval is needs_approval
    assert inspection.summary


def test_inspect_rejects_unknown_tool(workspace):
    with pytest.raises(ToolPermissionError):
        inspect_tool(make_executor(), make_session(workspace), "unknown_tool", {})


def test_tool_guard_custom_whitelist(workspace):
    executor = make_executor(tool_guard=ToolGuard(allowed_tools={"read_file"}))
    session = make_session(workspace)

    inspect_tool(executor, session, "read_file", {"path": "src/a.py"})
    with pytest.raises(ToolPermissionError):
        inspect_tool(executor, session, "write_file", {"path": "dst/c.txt", "content": "x"})


def test_arguments_parsing():
    assert ToolExecutor._arguments(None) == {}
    assert ToolExecutor._arguments("") == {}
    assert ToolExecutor._arguments({"path": "a.txt"}) == {"path": "a.txt"}
    assert ToolExecutor._arguments('{"path": "a.txt"}') == {"path": "a.txt"}
    with pytest.raises(ValueError):
        ToolExecutor._arguments("not-json")
    with pytest.raises(ValueError):
        ToolExecutor._arguments("[1, 2]")


# --------------------------------------------------------------------- 执行
@pytest.mark.parametrize("tool_name,arguments,needs_approval", ALL_TOOLS)
async def test_execute_all_tools(workspace, tool_name, arguments, needs_approval):
    session = make_session(workspace)
    result = await run_tool(
        make_executor(), session,
        ToolCallRequest(tool_id=f"call-{tool_name}", tool_name=tool_name, arguments=arguments))

    assert isinstance(result, BaseModel)
    if tool_name == "shell_command":
        assert result.exit_code == 0
        # 沙箱 cwd 固定为工作区根目录，列表里能看到 src 子目录。
        assert "src" in result.stdout


async def test_filesystem_side_effects(workspace):
    executor, session = make_executor(), make_session(workspace)

    created = await run_tool(executor, session, ToolCallRequest(
        "c-mkdir", "create_directory", {"path": "dst/sub", "parents": True}))
    assert created.path.replace("\\", "/") == "dst/sub"
    assert (workspace / "dst" / "sub").is_dir()

    copied = await run_tool(executor, session, ToolCallRequest(
        "c-copy", "copy_file", {"source": "src/a.py", "destination": "dst/sub/a.py"}))
    assert copied.size == len("print(1)")
    assert (workspace / "dst" / "sub" / "a.py").read_text(encoding="utf-8") == "print(1)"

    moved = await run_tool(executor, session, ToolCallRequest(
        "c-move", "move_file", {"source": "dst/sub/a.py", "destination": "dst/sub/b.py"}))
    assert moved.destination.replace("\\", "/") == "dst/sub/b.py"
    assert not (workspace / "dst" / "sub" / "a.py").exists()

    await run_tool(executor, session, ToolCallRequest(
        "c-delete", "delete_file", {"path": "dst/sub/b.py"}))
    assert not (workspace / "dst" / "sub" / "b.py").exists()


async def test_list_and_search_results(workspace):
    executor, session = make_executor(), make_session(workspace)

    listing = await run_tool(executor, session,
                             ToolCallRequest("c-list", "list_directory", {"path": "src"}))
    assert sorted(entry.name for entry in listing.entries) == ["a.py", "b.txt"]

    found = await run_tool(executor, session,
                           ToolCallRequest("c-search", "search_files", {"pattern": "*.py"}))
    assert [match.path.replace("\\", "/") for match in found.matches] == ["src/a.py"]
    assert found.truncated is False


# --------------------------------------------------------------- 模式与审批
@pytest.mark.parametrize("tool_name,arguments,needs_approval", MUTATIONS)
async def test_read_only_denies_mutations(workspace, tool_name, arguments, needs_approval):
    session = make_session(workspace, mode=WorkspaceMode.READ_ONLY)
    with pytest.raises(ToolUnauthorizedError):
        await run_tool(make_executor(), session, ToolCallRequest(
            tool_id=f"call-{tool_name}", tool_name=tool_name, arguments=arguments))


@pytest.mark.parametrize("tool_name,arguments,needs_approval", MUTATIONS)
async def test_workspace_write_requires_approval(workspace, tool_name, arguments, needs_approval):
    executor = make_executor()
    session = make_session(workspace, mode=WorkspaceMode.WORKSPACE_WRITE)
    call = ToolCallRequest(tool_id=f"call-{tool_name}", tool_name=tool_name, arguments=arguments)

    with pytest.raises(ToolSuspendedError) as error:
        await run_tool(executor, session, call)
    assert error.value.tool_id == f"call-{tool_name}"
    assert error.value.tool_name == tool_name

    result = await run_tool(executor, session, call, approved=True)
    assert isinstance(result, BaseModel)


# ------------------------------------------------------------------ 路径边界
async def test_executor_rejects_path_escape(workspace):
    with pytest.raises(ToolUnauthorizedError):
        await run_tool(make_executor(), make_session(workspace), ToolCallRequest(
            "c-escape", "read_file", {"path": "../escape.txt"}))


async def test_executor_rejects_outside_shell_path(workspace):
    with pytest.raises(ToolUnauthorizedError):
        await run_tool(make_executor(), make_session(workspace), ToolCallRequest(
            "c-shell", "shell_command", {"command": OUTSIDE_COMMAND}))


# ------------------------------------------------------------- 多工作目录
@pytest.fixture
def multi_workspace(tmp_path):
    first = tmp_path / "ws1"
    second = tmp_path / "ws2"
    first.mkdir()
    second.mkdir()
    (first / "note.txt").write_text("first", encoding="utf-8")
    (second / "note.txt").write_text("second", encoding="utf-8")
    (first / "first-marker.txt").write_text("1", encoding="utf-8")
    (second / "second-marker.txt").write_text("2", encoding="utf-8")
    return first, second


def multi_session(first, second, mode=WorkspaceMode.FULL) -> Session:
    """多工作区会话：允许绝对路径，便于验证第二个工作区内的访问。"""
    return make_session(first, second, mode=mode)


def multi_executor() -> ToolExecutor:
    return make_executor(allow_absolute_path=True)


async def test_multi_workspace_relative_path_uses_first_root(multi_workspace):
    first, second = multi_workspace
    result = await run_tool(multi_executor(), multi_session(first, second),
                            ToolCallRequest("c-rel", "read_file", {"path": "note.txt"}))

    assert result.content == "first"
    assert result.path == "note.txt"


async def test_multi_workspace_absolute_path_in_second_root(multi_workspace):
    first, second = multi_workspace
    result = await run_tool(multi_executor(), multi_session(first, second),
                            ToolCallRequest("c-abs", "read_file",
                                            {"path": str(second / "note.txt")}))

    assert result.content == "second"
    # 展示路径相对于命中的工作区根目录，而不是第一个根目录。
    assert result.path == "note.txt"


async def test_multi_workspace_rejects_path_outside_all_roots(multi_workspace, tmp_path):
    first, second = multi_workspace
    outside = tmp_path / "outside.txt"
    outside.write_text("x", encoding="utf-8")

    with pytest.raises(ToolUnauthorizedError):
        await run_tool(multi_executor(), multi_session(first, second),
                       ToolCallRequest("c-out", "read_file", {"path": str(outside)}))


async def test_multi_workspace_policy_applies_to_second_root(multi_workspace):
    first, second = multi_workspace
    session = multi_session(first, second, mode=WorkspaceMode.READ_ONLY)

    with pytest.raises(ToolUnauthorizedError):
        await run_tool(multi_executor(), session, ToolCallRequest(
            "c-ro", "write_file", {"path": str(second / "new.txt"), "content": "x"}))


async def test_multi_workspace_shell_runs_in_first_root(multi_workspace):
    first, second = multi_workspace
    result = await run_tool(multi_executor(), multi_session(first, second),
                            ToolCallRequest("c-shell-root", "shell_command",
                                            {"command": READ_ONLY_COMMAND}))

    assert result.exit_code == 0
    assert "first-marker.txt" in result.stdout
    assert "second-marker.txt" not in result.stdout


# --------------------------------------------------- 执行时传入会话策略与目录
def test_inspect_applies_session_policy(workspace):
    executor = make_executor()
    read_only = make_session(workspace, mode=WorkspaceMode.READ_ONLY)
    workspace_write = make_session(workspace, mode=WorkspaceMode.WORKSPACE_WRITE)

    # read_only 在准入阶段就拒绝写操作，不会进入审批流程。
    with pytest.raises(ToolUnauthorizedError):
        inspect_tool(executor, read_only, "write_file",
                     {"path": "dst/a.txt", "content": "x"})

    inspection = inspect_tool(executor, workspace_write, "write_file",
                              {"path": "dst/a.txt", "content": "x"})
    assert inspection.needs_approval is True
    assert inspection.context.policy.mode is WorkspaceMode.WORKSPACE_WRITE


async def test_execute_applies_session_workspaces(workspace, tmp_path):
    other = tmp_path / "other"
    other.mkdir()
    (other / "note.txt").write_text("other", encoding="utf-8")

    result = await run_tool(make_executor(), make_session(other),
                            ToolCallRequest("c-session", "read_file", {"path": "note.txt"}))
    assert result.content == "other"


async def test_execute_rejects_missing_session_workspace(workspace, tmp_path):
    session = make_session(tmp_path / "missing")
    with pytest.raises(ToolUnauthorizedError):
        await run_tool(make_executor(), session,
                       ToolCallRequest("c-bad", "read_file", {"path": "a.txt"}))


async def test_execute_rejects_empty_session_workspaces(workspace):
    session = Session(policy=WorkspacePolicy(mode=WorkspaceMode.FULL), workspaces=())
    with pytest.raises(ToolUnauthorizedError):
        await run_tool(make_executor(), session,
                       ToolCallRequest("c-empty", "read_file", {"path": "src/a.py"}))


def test_runtime_cache_is_per_session(workspace, tmp_path):
    other = tmp_path / "other"
    other.mkdir()
    (other / "note.txt").write_text("other", encoding="utf-8")
    executor = make_executor()

    first = make_session(workspace)
    second = make_session(other)
    inspect_tool(executor, first, "read_file", {"path": "src/a.py"})
    inspect_tool(executor, first, "read_file", {"path": "src/b.txt"})
    assert len(executor._runtime_cache) == 1

    inspect_tool(executor, second, "read_file", {"path": "note.txt"})
    assert len(executor._runtime_cache) == 2
