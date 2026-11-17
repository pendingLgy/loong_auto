"""保守读取命令识别，不作为 Shell 沙箱。"""
import re

READ_ONLY_COMMANDS = frozenset({"Get-Content", "Get-Item", "Get-ChildItem", "cat", "head", "tail", "ls", "pwd"})
READ_ONLY = re.compile(r"(?:" + "|".join(re.escape(name) for name in READ_ONLY_COMMANDS)
                       + r")(?:[ \t]+[^;|&><`$\r\n]+)?", re.IGNORECASE)


def is_dangerous_command(command: str, *, declared_dangerous: bool = False) -> bool:
    return declared_dangerous or READ_ONLY.fullmatch(command.strip()) is None
