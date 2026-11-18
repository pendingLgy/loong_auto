"""路径安全与工具权限测试：对应 local/path_secutiry.md §11 的用例清单。

不启动服务、不调用模型；只验证 PathGuard、ToolPermissionGuard 与 SandboxExecutor
在真实文件系统上的行为。
"""
import os
import sys
from pathlib import Path

import pytest

from loong_local.tools.security import (PathGuard, PathPermission, PathSecurityAction,
                                        PathSecurityError, SandboxExecutor, ToolPermissionError,
                                        ToolPermissionGuard, WorkspaceMode, WorkspacePolicy)


@pytest.fixture
def workspace(tmp_path):
    root = tmp_path / "workspace"
    for name in ("project", "uploads", "output", "temp"):
        (root / name).mkdir(parents=True)
    (root / "project" / "a.py").write_text("print(1)", encoding="utf-8")
    (root / "uploads" / "a.txt").write_text("upload", encoding="utf-8")
    (root / "output" / "result.txt").write_text("result", encoding="utf-8")
    return root


def _action(guard: PathGuard, raw: str, **kwargs) -> PathSecurityAction:
    with pytest.raises(PathSecurityError) as error:
        guard.validate_reference(raw, **kwargs)
    return error.value.action


def test_allows_relative_path(workspace):
    guard = PathGuard([workspace])
    target = guard.validate_reference("project/a.py")
    assert target == (workspace / "project" / "a.py").resolve()


def test_allows_current_dir_prefix(workspace):
    guard = PathGuard([workspace])
    assert guard.validate_reference("./project/a.py").name == "a.py"


def test_rejects_internal_traversal_by_default(workspace):
    guard = PathGuard([workspace])
    assert _action(guard, "project/../uploads/a.txt") is PathSecurityAction.PATH_TRAVERSAL


def test_allows_internal_traversal_when_enabled(workspace):
    guard = PathGuard([workspace], allow_path_traversal=True)
    target = guard.validate_reference("project/../uploads/a.txt")
    assert target == (workspace / "uploads" / "a.txt").resolve()


def test_rejects_path_traversal(workspace):
    guard = PathGuard([workspace])
    assert _action(guard, "../../etc/passwd") is PathSecurityAction.PATH_TRAVERSAL


def test_rejects_absolute_paths(workspace):
    guard = PathGuard([workspace])
    assert _action(guard, "/etc/passwd") is PathSecurityAction.ABSOLUTE_PATH
    assert _action(guard, "C:\\Windows\\system.ini") is PathSecurityAction.ABSOLUTE_PATH


def test_allows_absolute_path_inside_workspace_when_enabled(workspace):
    guard = PathGuard([workspace], allow_absolute_path=True)
    target = guard.validate_reference(str(workspace / "project" / "a.py"))
    assert target == (workspace / "project" / "a.py").resolve()


def test_rejects_unc_path(workspace):
    guard = PathGuard([workspace])
    assert _action(guard, "\\\\server\\share\\a.txt") is PathSecurityAction.UNC_PATH


def test_rejects_empty_and_null_byte(workspace):
    guard = PathGuard([workspace])
    assert _action(guard, "") is PathSecurityAction.INVALID_PATH
    assert _action(guard, "a.py\x00.txt") is PathSecurityAction.INVALID_PATH


def test_rejects_symlink_escape(workspace, tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "passwd").write_text("secret", encoding="utf-8")
    link = workspace / "project" / "link"
    try:
        os.symlink(outside, link, target_is_directory=True)
    except OSError:
        pytest.skip("当前环境不允许创建符号链接")

    guard = PathGuard([workspace])
    action = _action(guard, "project/link/passwd")
    assert action in {PathSecurityAction.SYMLINK, PathSecurityAction.OUTSIDE_WORKSPACE}


def test_missing_file_depends_on_operation(workspace):
    guard = PathGuard([workspace])
    # 命令参数里的待创建文件可以只校验归属
    assert guard.validate_reference("project/notfound.py").name == "notfound.py"
    # 读操作要求文件存在
    with pytest.raises(PathSecurityError) as error:
        guard.resolve_path("project/notfound.py", permission=PathPermission.READ)
    assert error.value.action is PathSecurityAction.NOT_FOUND


def test_read_only_mode_denies_mutations(workspace):
    """默认 read_only：读放行，写/删/执行一律拒绝。"""
    guard = PathGuard([workspace])
    assert guard.policy.mode is WorkspaceMode.READ_ONLY
    assert guard.requires_approval is False
    assert guard.resolve_path("project/a.py", permission=PathPermission.READ).name == "a.py"
    for permission in (PathPermission.WRITE, PathPermission.DELETE, PathPermission.EXECUTE):
        with pytest.raises(PathSecurityError) as error:
            guard.resolve_path("project/a.py", permission=permission)
        assert error.value.action is PathSecurityAction.PERMISSION_DENIED


def test_workspace_write_mode_allows_mutations_with_approval(workspace):
    """workspace_write：工作区内允许写/删/执行，但高危操作需要人工确认。"""
    guard = PathGuard([workspace], policy=WorkspacePolicy(mode=WorkspaceMode.WORKSPACE_WRITE))
    assert guard.requires_approval is True
    assert guard.resolve_path("output/new.txt", permission=PathPermission.WRITE).name == "new.txt"
    assert guard.resolve_path("output/result.txt", permission=PathPermission.DELETE).name == "result.txt"
    assert guard.resolve_path("project", permission=PathPermission.EXECUTE).name == "project"


def test_full_mode_allows_mutations_without_approval(workspace):
    """full：工作区内完全权限，不再逐次人工确认；工作区边界仍然有效。"""
    guard = PathGuard([workspace], policy=WorkspacePolicy(mode=WorkspaceMode.FULL))
    assert guard.requires_approval is False
    assert guard.resolve_path("output/new.txt", permission=PathPermission.WRITE).name == "new.txt"
    with pytest.raises(PathSecurityError) as error:
        guard.resolve_path("../escape.txt", permission=PathPermission.WRITE)
    assert error.value.action is PathSecurityAction.PATH_TRAVERSAL


def test_client_policy_parsing():
    assert WorkspacePolicy.from_client("read_only").mode is WorkspaceMode.READ_ONLY
    assert WorkspacePolicy.from_client("workspace_write").mode is WorkspaceMode.WORKSPACE_WRITE
    assert WorkspacePolicy.from_client({"mode": "full"}).mode is WorkspaceMode.FULL
    assert WorkspacePolicy.from_client('{"mode": "workspace_write"}').mode is WorkspaceMode.WORKSPACE_WRITE
    assert WorkspacePolicy.from_client("").mode is WorkspaceMode.READ_ONLY


@pytest.mark.parametrize("raw", [
    "invalid_mode",
    '{"mode": "root"}',
    '{"unknown": 1}',
    '{"mode": "full", "write": []}',
    "not-json{",
])
def test_client_policy_rejects_invalid(raw):
    with pytest.raises(ValueError):
        WorkspacePolicy.from_client(raw)


def test_tool_permission_matrix():
    guard = ToolPermissionGuard()
    guard.check("read_file", PathPermission.READ)
    with pytest.raises(ToolPermissionError):
        guard.check("read_file", PathPermission.WRITE)
    with pytest.raises(ToolPermissionError):
        guard.check("delete_file", PathPermission.READ)
    guard.check("shell_command", PathPermission.EXECUTE)


async def test_sandbox_cleans_environment(workspace, monkeypatch):
    monkeypatch.setenv("LOONG_TEST_SECRET", "topsecret-123")
    executor = SandboxExecutor(workspace)
    result = await executor.run([
        sys.executable, "-c",
        "import os; print(os.environ.get('LOONG_TEST_SECRET', 'missing'))",
    ])
    assert result.exit_code == 0
    assert result.stdout.strip() == "missing"


async def test_sandbox_times_out(workspace):
    executor = SandboxExecutor(workspace)
    result = await executor.run([sys.executable, "-c", "import time; time.sleep(5)"], timeout=0.3)
    assert result.timed_out is True
