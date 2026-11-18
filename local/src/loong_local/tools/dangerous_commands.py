"""保守读取命令识别，不作为 Shell 沙箱。"""
import re

READ_ONLY_COMMANDS = frozenset({"Get-Content", "Get-Item", "Get-ChildItem", "cat", "head", "tail", "ls", "pwd" ,"dir"})
READ_ONLY = re.compile(r"(?:" + "|".join(re.escape(name) for name in READ_ONLY_COMMANDS)
                       + r")(?:[ \t]+[^;|&><`$\r\n]+)?", re.IGNORECASE)

# 出现这些结构说明命令不是单条简单命令：无法可靠推断其读写范围，按危险处理。
UNSAFE_STRUCTURE = re.compile(
    r"[|<>`&;]|\$|%|\*|\?"
    r"|(?<![\w-])cd(?![\w-])|Set-Location|Push-Location|Pop-Location",
    re.IGNORECASE,
)


def has_unsafe_structure(command: str) -> bool:
    """命令是否包含无法静态分析的结构（管道、重定向、变量、通配符、多命令、切换目录）。"""
    return UNSAFE_STRUCTURE.search(command) is not None


def is_dangerous_command(command: str, *, declared_dangerous: bool = False) -> bool:
    if declared_dangerous or has_unsafe_structure(command):
        return True
    return READ_ONLY.fullmatch(command.strip()) is None
