"""统一日志配置及不输出异常内容和局部变量的堆栈记录。"""

import sys
import traceback

from loguru import logger


def custom_format(record):
    """动态生成日志格式字符串"""
    # 基础部分：时间、线程、日志级别及调用位置
    fmt = (
        "{time:YYYY-MM-DD HH:mm:ss.SSS Z} | thread={thread.id}:{thread.name} | {level}"
        " | {name} [{function}:{line}]"
    )

    # 检查并动态拼接 request_id
    request_id = record["extra"].get("request_id")
    if request_id and request_id != "-":
        fmt += " | request_id={extra[request_id]}"

    # 检查并动态拼接 request_date
    request_date = record["extra"].get("request_date")
    if request_date and request_date != "-":
        fmt += " | request_date={extra[request_date]}"

    # 结尾部分：消息与其余的 extra
    fmt += " | {message}\n"

    return fmt

def configure_logging(level: str = "INFO") -> None:

    logger.configure(extra={"request_id": "-", "request_date": "-"})
    logger.remove()
    logger.add(sys.stderr,
               level=level,
               backtrace=False,
               diagnose=False,
               format=custom_format)


def log_exception(exc: BaseException, message: str, **context) -> None:
    # 不打印异常原文、源代码行或局部变量：供应商错误和校验异常可能包含秘密。
    frames = traceback.extract_tb(exc.__traceback__)
    stack = "\n".join(
        f'  File "{frame.filename}", line {frame.lineno}, in {frame.name}' for frame in frames
    )
    level = "WARNING" if context.get("status_code", 500) < 500 else "ERROR"
    (
        logger.bind(**context, exception_type=type(exc).__name__).
        log(level, "{}\n{}\nTraceback (most recent call last):\n{}", message, str(exc), stack)
    )
