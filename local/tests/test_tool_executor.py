"""ToolExecutor 测试：覆盖全部 9 个工具的准入、审批与真实执行。

不启动服务、不调用模型；只验证统一执行入口在真实文件系统上的行为。
"""
import os

import pytest
from pydantic import BaseModel

from loong_local.install_setting import init_tools
from loong_local.tools.security import (PathGuard, ToolGuard, ToolPermissionError,
                                        WorkspaceMode, WorkspacePolicy)
from loong_local.tools.base_tool import ToolSuspendedError, ToolUnauthorizedError
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


def make_executor(workspace, mode=WorkspaceMode.FULL, **kwargs) -> ToolExecutor:
    return ToolExecutor([workspace], policy=WorkspacePolicy(mode=mode), **kwargs)


# --------------------------------------------------------------------- 准入
@pytest.mark.parametrize("tool_name,arguments,needs_approval", ALL_TOOLS)
def test_inspect_all_tools(workspace, tool_name, arguments, needs_approval):
    # 审批判定只在 workspace_write 模式下生效；full 模式不再逐次确认。
    inspection = make_executor(workspace, WorkspaceMode.WORKSPACE_WRITE).inspect(tool_name, arguments)

    assert inspection.tool.tool_name == tool_name
    assert isinstance(inspection.request, inspection.tool.request_model)
    assert inspection.needs_approval is needs_approval
    assert inspection.summary


def test_inspect_rejects_unknown_tool(workspace):
    with pytest.raises(ToolPermissionError):
        make_executor(workspace).inspect("unknown_tool", {})


def test_tool_guard_whitelist(workspace):
    executor = make_executor(workspace, tool_guard=ToolGuard(allowed_tools={"read_file"}))
    executor.inspect("read_file", {"path": "src/a.py"})
    with pytest.raises(ToolPermissionError):
        executor.inspect("write_file", {"path": "dst/c.txt", "content": "x"})


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
    result = await make_executor(workspace).execute(
        ToolCallRequest(tool_id=f"call-{tool_name}", tool_name=tool_name, arguments=arguments))

    assert isinstance(result, BaseModel)
    if tool_name == "shell_command":
        assert result.exit_code == 0
        # 沙箱 cwd 固定为工作区根目录，列表里能看到 src 子目录。
        assert "src" in result.stdout


async def test_filesystem_side_effects(workspace):
    executor = make_executor(workspace)

    created = await executor.execute(
        ToolCallRequest("c-mkdir", "create_directory", {"path": "dst/sub", "parents": True}))
    assert created.path.replace("\\", "/") == "dst/sub"
    assert (workspace / "dst" / "sub").is_dir()

    copied = await executor.execute(
        ToolCallRequest("c-copy", "copy_file", {"source": "src/a.py", "destination": "dst/sub/a.py"}))
    assert copied.size == len("print(1)")
    assert (workspace / "dst" / "sub" / "a.py").read_text(encoding="utf-8") == "print(1)"

    moved = await executor.execute(
        ToolCallRequest("c-move", "move_file",
                        {"source": "dst/sub/a.py", "destination": "dst/sub/b.py"}))
    assert moved.destination.replace("\\", "/") == "dst/sub/b.py"
    assert not (workspace / "dst" / "sub" / "a.py").exists()

    await executor.execute(
        ToolCallRequest("c-delete", "delete_file", {"path": "dst/sub/b.py"}))
    assert not (workspace / "dst" / "sub" / "b.py").exists()


async def test_list_and_search_results(workspace):
    executor = make_executor(workspace)

    listing = await executor.execute(ToolCallRequest("c-list", "list_directory", {"path": "src"}))
    assert sorted(entry.name for entry in listing.entries) == ["a.py", "b.txt"]

    found = await executor.execute(ToolCallRequest("c-search", "search_files", {"pattern": "*.py"}))
    assert [match.path.replace("\\", "/") for match in found.matches] == ["src/a.py"]
    assert found.truncated is False


# --------------------------------------------------------------- 模式与审批
@pytest.mark.parametrize("tool_name,arguments,needs_approval", MUTATIONS)
async def test_read_only_denies_mutations(workspace, tool_name, arguments, needs_approval):
    executor = make_executor(workspace, WorkspaceMode.READ_ONLY)
    with pytest.raises(ToolUnauthorizedError):
        await executor.execute(
            ToolCallRequest(tool_id=f"call-{tool_name}", tool_name=tool_name, arguments=arguments))


@pytest.mark.parametrize("tool_name,arguments,needs_approval", MUTATIONS)
async def test_workspace_write_requires_approval(workspace, tool_name, arguments, needs_approval):
    executor = make_executor(workspace, WorkspaceMode.WORKSPACE_WRITE)
    call = ToolCallRequest(tool_id=f"call-{tool_name}", tool_name=tool_name, arguments=arguments)

    with pytest.raises(ToolSuspendedError) as error:
        await executor.execute(call)
    assert error.value.tool_id == f"call-{tool_name}"
    assert error.value.tool_name == tool_name

    result = await executor.execute(call, approved=True)
    assert isinstance(result, BaseModel)


# ------------------------------------------------------------------ 路径边界
async def test_executor_rejects_path_escape(workspace):
    with pytest.raises(ToolUnauthorizedError):
        await make_executor(workspace).execute(
            ToolCallRequest("c-escape", "read_file", {"path": "../escape.txt"}))


async def test_executor_rejects_outside_shell_path(workspace):
    with pytest.raises(ToolUnauthorizedError):
        await make_executor(workspace).execute(
            ToolCallRequest("c-shell", "shell_command", {"command": OUTSIDE_COMMAND}))


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


def make_multi_executor(first, second, mode=WorkspaceMode.FULL) -> ToolExecutor:
    """多工作区执行器：允许绝对路径，便于验证第二个工作区内的访问。"""
    policy = WorkspacePolicy(mode=mode)
    guard = PathGuard([first, second], policy=policy, allow_absolute_path=True)
    return ToolExecutor([first, second], policy=policy, path_guard=guard)


async def test_multi_workspace_relative_path_uses_first_root(multi_workspace):
    first, second = multi_workspace
    result = await make_multi_executor(first, second).execute(
        ToolCallRequest("c-rel", "read_file", {"path": "note.txt"}))

    assert result.content == "first"
    assert result.path == "note.txt"


async def test_multi_workspace_absolute_path_in_second_root(multi_workspace):
    first, second = multi_workspace
    result = await make_multi_executor(first, second).execute(
        ToolCallRequest("c-abs", "read_file", {"path": str(second / "note.txt")}))

    assert result.content == "second"
    # 展示路径相对于命中的工作区根目录，而不是第一个根目录。
    assert result.path == "note.txt"


async def test_multi_workspace_rejects_path_outside_all_roots(multi_workspace, tmp_path):
    first, second = multi_workspace
    outside = tmp_path / "outside.txt"
    outside.write_text("x", encoding="utf-8")

    with pytest.raises(ToolUnauthorizedError):
        await make_multi_executor(first, second).execute(
            ToolCallRequest("c-out", "read_file", {"path": str(outside)}))


async def test_multi_workspace_policy_applies_to_second_root(multi_workspace):
    first, second = multi_workspace
    executor = make_multi_executor(first, second, WorkspaceMode.READ_ONLY)

    with pytest.raises(ToolUnauthorizedError):
        await executor.execute(
            ToolCallRequest("c-ro", "write_file",
                            {"path": str(second / "new.txt"), "content": "x"}))


async def test_multi_workspace_shell_runs_in_first_root(multi_workspace):
    first, second = multi_workspace
    result = await make_multi_executor(first, second).execute(
        ToolCallRequest("c-shell-root", "shell_command", {"command": READ_ONLY_COMMAND}))

    assert result.exit_code == 0
    assert "first-marker.txt" in result.stdout
    assert "second-marker.txt" not in result.stdout
