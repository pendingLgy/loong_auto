"""统一日志配置及不输出异常内容和局部变量的堆栈记录。"""

import sys
import traceback

from loguru import logger


def configure_logging(level: str = "INFO") -> None:
    logger.configure(extra={"request_id": "-", "request_date": "-"})
    logger.remove()
    logger.add(sys.stderr, level=level,
               backtrace=False, diagnose=False,
               format="{time:YYYY-MM-DD HH:mm:ss.SSS Z} | {level} | request_id={extra[request_id]} | request_date={extra[request_date]} | {message} | {extra}")


def log_exception(exc: BaseException, message: str, **context) -> None:
    # 不打印异常原文、源代码行或局部变量：供应商错误和校验异常可能包含秘密。
    frames = traceback.extract_tb(exc.__traceback__)
    stack = "\n".join(
        f'  File "{frame.filename}", line {frame.lineno}, in {frame.name}' for frame in frames
    )
    level = "WARNING" if context.get("status_code", 500) < 500 else "ERROR"
    logger.bind(**context, exception_type=type(exc).__name__).log(
        level, "{}\nTraceback (most recent call last):\n{}\n{}", message, stack, type(exc).__name__)
