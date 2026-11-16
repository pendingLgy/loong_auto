"""消息历史组装辅助函数。"""

from loong_cloud.core.exceptions import DataError
from loong_contracts.agent.models import Message, ToolCall


def build_tool_call_message(
    origin_msgs: list[Message],
    tool_call_messages: list[Message] | None = None,
    tool_calls: list[ToolCall] | None = None,
) -> list[Message]:
    """按 LLM 返回的工具调用顺序追加工具结果消息。

    ``tool_call_messages`` 可能来自本地执行或客户端远程执行，
    因此不能直接按结果到达顺序拼接，必须使用 ``tool_call_id``
    与 ``tool_calls`` 建立对应关系。函数返回新的列表，不修改原始消息。
    """
    messages = list(origin_msgs)
    if not tool_calls or not tool_call_messages:
        return messages

    if len(tool_call_messages) != len(tool_calls):
        raise DataError("tool message not match")

    tool_message_dict =  {
        message.tool_call_id: message
        for message in tool_call_messages
        if message.tool_call_id
    }

    for call in tool_calls:
        tool_msg = tool_message_dict.get(call.id)
        if not tool_msg:
            raise DataError("tool message not find")

        messages.append(tool_msg)

    return messages
