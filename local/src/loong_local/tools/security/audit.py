"""安全审计：记录路径校验与工具调用的安全结论。

只记录路径与结论，不记录文件内容、密码、密钥等敏感数据。
"""

from loguru import logger


class AuditLogger:
    """结构化安全审计日志入口；由 loguru 统一输出。"""

    @staticmethod
    def record(
            *,
            tool_name: str,
            operation: str,
            original_path: str,
            resolved_path: str | None,
            workspace: str,
            permission: str,
            result: str,
            security_action: str,
            request_id: str | None = None,
            agent_id: str | None = None,
    ) -> None:
        logger.bind(
            audit=True,
            request_id=request_id or "-",
            agent_id=agent_id or "-",
            tool_name=tool_name or "-",
            operation=operation,
            original_path=original_path,
            resolved_path=resolved_path or "-",
            workspace=workspace,
            permission=permission,
            result=result,
            security_action=security_action,
        ).info("security audit tool={} op={} original={} resolved={} result={} action={}",
               tool_name or "-", operation, original_path, resolved_path or "-", result, security_action)

    @staticmethod
    def tool_call(*, tool_name: str, tool_id: str, result: str, security_action: str,
                  request_id: str | None = None) -> None:
        logger.bind(audit=True, request_id=request_id or "-", tool_name=tool_name, tool_id=tool_id,
                    result=result, security_action=security_action, operation="tool_call").info(
            "security audit tool_call tool={} tool_id={} result={} action={}",
            tool_name, tool_id, result, security_action)
