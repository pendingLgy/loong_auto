"""参考 cloud 的输出格式，记录控制台和本地滚动文件日志。"""
import sys
from pathlib import Path

from loguru import logger


def custom_format(record):
    fmt = (
        "{time:YYYY-MM-DD HH:mm:ss.SSS Z} | thread={thread.id}:{thread.name} | {level}"
        " | {name} [{function}:{line}]"
    )
    for key in ("request_id", "request_date"):
        if record["extra"].get(key) not in (None, "", "-"):
            fmt += " | " + key + "={extra[" + key + "]}"
    return fmt + " | {message}\n{exception}"


def configure_logging(path: Path, level: str = "INFO") -> list[int]:
    path.parent.mkdir(parents=True, exist_ok=True)
    logger.configure(extra={"request_id": "-", "request_date": "-"})
    logger.remove()
    options = dict(level=level, backtrace=False, diagnose=False, format=custom_format)
    return [
        logger.add(sys.stderr, **options),
        logger.add(path, rotation="10 MB", retention=3, encoding="utf-8", **options),
    ]
