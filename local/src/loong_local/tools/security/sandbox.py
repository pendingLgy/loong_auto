"""进程沙箱执行器：固定工作目录、清理环境变量、限制执行时间与输出大小。

这里只是应用层的受限执行，不是真正的安全沙箱：
文件系统/网络/进程隔离需要容器、独立低权限用户、只读挂载等 OS 级手段。
"""
import asyncio
import os
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from loguru import logger

# 子进程只保留运行所需的环境变量，避免令牌、密钥透传给命令。
ENV_ALLOWLIST = frozenset({
    "PATH", "PATHEXT", "COMSPEC", "SYSTEMROOT", "SYSTEMDRIVE", "WINDIR",
    "TEMP", "TMP", "TMPDIR", "HOME", "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "USERNAME",
    "APPDATA", "LOCALAPPDATA", "PROGRAMDATA", "PROGRAMFILES", "PROGRAMFILES(X86)", "COMMONPROGRAMFILES",
    "LANG", "LC_ALL", "TERM", "PWSH", "PSMODULEPATH", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE",
})


@dataclass(frozen=True)
class SandboxConfig:
    timeout: float = 30.0
    max_output_bytes: int = 1_000_000
    cpu_seconds: int = 30
    max_open_files: int = 256
    env_allowlist: frozenset[str] = ENV_ALLOWLIST


@dataclass(frozen=True)
class SandboxResult:
    exit_code: int
    stdout: str
    stderr: str
    timed_out: bool = False
    truncated: bool = False


def _posix_limits(cpu_seconds: int, max_open_files: int):
    """返回 preexec_fn；Windows 不支持，返回 None。"""
    if os.name == "nt":
        return None

    def apply_limits() -> None:
        try:
            import resource
            resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds))
            resource.setrlimit(resource.RLIMIT_NOFILE, (max_open_files, max_open_files))
        except (ImportError, OSError, ValueError):
            pass

    return apply_limits


class SandboxExecutor:
    """在固定工作目录内执行外部进程。"""

    def __init__(self, workspace: Path, config: SandboxConfig | None = None) -> None:
        self.workspace = Path(workspace).resolve(strict=True)
        if not self.workspace.is_dir():
            raise ValueError("沙箱工作目录必须是目录")
        self.config = config or SandboxConfig()

    def sanitized_env(self) -> dict[str, str]:
        env = {name: value for name, value in os.environ.items()
               if name.upper() in self.config.env_allowlist}
        env.setdefault("PATH", os.environ.get("PATH", ""))
        return env

    async def run(self, argv: Sequence[str], *, timeout: float | None = None) -> SandboxResult:
        if not argv:
            raise ValueError("argv 不能为空")
        limit = self.config.timeout if timeout is None else timeout

        process = await asyncio.create_subprocess_exec(
            *argv,
            cwd=str(self.workspace),
            env=self.sanitized_env(),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            preexec_fn=_posix_limits(self.config.cpu_seconds, self.config.max_open_files),
            creationflags=0x08000000 if os.name == "nt" else 0,
        )

        task = asyncio.create_task(process.communicate())
        timed_out = False
        try:
            stdout, stderr = await asyncio.wait_for(asyncio.shield(task), limit)
        except TimeoutError:
            timed_out = True
            if process.returncode is None:
                process.kill()
            stdout, stderr = await task
        except asyncio.CancelledError:
            if process.returncode is None:
                process.kill()
            await task
            raise

        truncated = False
        if len(stdout) > self.config.max_output_bytes:
            stdout = stdout[:self.config.max_output_bytes]
            truncated = True
        if len(stderr) > self.config.max_output_bytes:
            stderr = stderr[:self.config.max_output_bytes]
            truncated = True

        if timed_out:
            logger.warning("沙箱进程超时被终止：argv={} timeout={}s", argv[:2], limit)

        return SandboxResult(
            exit_code=process.returncode if process.returncode is not None else -1,
            stdout=stdout.decode("utf-8", errors="replace"),
            stderr=stderr.decode("utf-8", errors="replace"),
            timed_out=timed_out,
            truncated=truncated,
        )
