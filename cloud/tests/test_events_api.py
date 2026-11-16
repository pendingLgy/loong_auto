"""SSE 测试：HTTP 集成用例需要先启动单 worker cloud 服务。
异常断连用例使用真实 TCP 连接，退避及清理行为由人工查看服务端日志。

复用 test_message_api 的配置与登录 fixture，读取 cloud/.env.api_key。
对话测试使用真实 DeepSeek，产生模型费用并保留测试会话记录。
运行：python -m pytest cloud/tests/test_events_api.py -v -s
"""

import asyncio
import json
import time
from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

import pytest

from loong_contracts.agent.models import Message, ToolDefinition
from loong_contracts.request.message import AddMessageRequest, LLMParamRequest

async def read_event(lines):
    """消费一个完整 SSE 帧；复用同一个行迭代器，避免丢失缓冲数据。"""
    event = "message"
    data = []
    async for line in lines:
        if not line:
            if data:
                payload = json.loads("\n".join(data))
                print(f"SSE event={event} data={json.dumps(payload, ensure_ascii=False)}")
                return event, payload
            event = "message"
        elif line.startswith("event:"):
            event = line[6:].strip()
        elif line.startswith("data:"):
            data.append(line[5:].lstrip())
    pytest.fail("SSE 连接在完整事件到达前关闭")


async def test_sse_heartbeat_and_duplicate_connection(client):
    client_id = "events-heartbeat-" + uuid4().hex
    path = f"/api/events/chat/{client_id}/sse"
    async with asyncio.timeout(45):
        async with client.stream("GET", path) as response:
            assert response.status_code == 200
            assert response.headers["content-type"].startswith("text/event-stream")
            assert response.headers["cache-control"] == "no-cache"
            lines = response.aiter_lines()
            event, payload = await read_event(lines)
            assert event == "connected"
            assert payload["client_id"] == client_id
            datetime.fromisoformat(payload["time"])

            duplicate = await client.get(path)
            assert duplicate.status_code == 409

            event, payload = await read_event(lines)
            assert event == "heartbeat"
            assert payload["client_id"] == client_id
            datetime.fromisoformat(payload["time"])


async def test_submit_requires_sse_connection(client):
    session_id = "events-disconnected-" + uuid4().hex
    body = AddMessageRequest(
        tenant_id=0, user_id=0, session_id=session_id,
        session_title="events-api-disconnected-test",
        llm=LLMParamRequest(provider="deepseek", model="deepseek-chat", temperature=0,
                            api_key="not-used-without-connection"),
        tools=[],
        messages=[Message(id=str(time.time_ns() // 1000), role="user", content="请只回复 OK")],
    )
    payload = body.model_dump(mode="json")
    payload["llm"]["api_key"] = body.llm.api_key.get_secret_value()
    response = await client.post(f"/api/events/chat/{session_id}/messages", json=payload)
    assert response.status_code == 409
    assert response.json()["code"] == 409


async def test_submit_message_pushes_dialogue_to_sse(client, settings):
    key = settings("DEEPSEEK_API_KEY")
    if not key:
        pytest.skip("真实对话测试需要配置 DEEPSEEK_API_KEY")
    session_id = "events-dialogue-" + uuid4().hex
    body = AddMessageRequest(
        tenant_id=0, user_id=0, session_id=session_id,
        session_title="events-api-test-" + uuid4().hex,
        llm=LLMParamRequest(provider="deepseek", model="deepseek-chat", temperature=0, api_key=key),
        tools=[],
        messages=[Message(id=str(time.time_ns() // 1000), role="user", content="请只回复 OK")],
    )
    payload = body.model_dump(mode="json")
    payload["llm"]["api_key"] = body.llm.api_key.get_secret_value()

    client_id = "client-" + uuid4().hex
    async with asyncio.timeout(180):
        async with client.stream("GET", f"/api/events/chat/{client_id}/sse") as response:
            assert response.status_code == 200
            lines = response.aiter_lines()
            event, connected = await read_event(lines)
            assert event == "connected"
            assert connected["client_id"] == client_id

            submitted = await client.post(f"/api/events/chat/{client_id}/messages", json=payload)
            assert submitted.status_code == 200
            assert submitted.json()["code"] == 200

            while True:
                event, result = await read_event(lines)

                # print(f"event: {event} result: {result}")

                assert result["session_id"] == session_id
                if event == "heartbeat":
                    continue
                assert not result["error"], "对话执行失败，请检查服务端日志"
                if result["summary"]:
                    final_message = result["messages"][-1]
                    assert final_message["role"] == "assistant"
                    assert final_message["content"].strip()
                    break

            # 完整对话结束后，订阅仍保持连接并继续发送心跳。
            event, heartbeat = await read_event(lines)
            assert event == "heartbeat"
            assert heartbeat["client_id"] == client_id


async def test_multiple_remote_tools_across_dialogue_rounds(client, settings):
    """三个远程工具按结果依赖逐轮调用，通过同一 SSE 连接回传。"""
    key = settings("DEEPSEEK_API_KEY")
    if not key:
        pytest.skip("真实多轮工具测试需要配置 DEEPSEEK_API_KEY")
    session_id = "events-tools-" + uuid4().hex
    client_id = "client-tools-" + uuid4().hex
    body = AddMessageRequest(
        tenant_id=0, user_id=0, session_id=session_id,
        session_title="events-multiple-tools-test-" + uuid4().hex,
        llm=LLMParamRequest(provider="deepseek", model="deepseek-chat", temperature=0, api_key=key),
        tools=[
            ToolDefinition(
                name="get_project", location="remote", description="查询客户端项目，返回项目 ID。",
                parameters={"type": "object", "properties": {}},
            ),
            ToolDefinition(
                name="read_project_file", location="remote", description="根据项目 ID 读取文件。",
                parameters={"type": "object", "properties": {"project_id": {"type": "string"}},
                            "required": ["project_id"]},
            ),
            ToolDefinition(
                name="check_file_content", location="remote", description="检查上一步读取的文件内容。",
                parameters={"type": "object", "properties": {"content": {"type": "string"}},
                            "required": ["content"]},
            ),
        ],
        messages=[Message(
            id=str(time.time_ns() // 1000), role="user",
            content=("严格依次完成三个步骤，每次只调用一个工具，收到工具结果后再调用下一个："
                     "1. 调用 get_project；2. 使用返回的 project_id 调用 read_project_file；"
                     "3. 使用返回的 content 调用 check_file_content。"
                     "参数必须来自真实工具结果，不得猜测。每个工具只调用一次，最后总结检查结果。"),
        )],
    )
    expected = ["get_project", "read_project_file", "check_file_content"]
    executed = []
    project_id = "project-" + uuid4().hex
    file_content = "REMOTE_FILE_CONTENT_" + uuid4().hex

    async with asyncio.timeout(300):
        async with client.stream("GET", f"/api/events/chat/{client_id}/sse") as response:
            assert response.status_code == 200
            lines = response.aiter_lines()
            event, connected = await read_event(lines)
            assert event == "connected"
            assert connected["client_id"] == client_id

            # 初始提交 + 三轮远程工具结果提交；每次仅追加本轮产生的消息。
            for round_index in range(4):
                payload = body.model_dump(mode="json")
                payload["llm"]["api_key"] = body.llm.api_key.get_secret_value()
                submitted = await client.post(f"/api/events/chat/{client_id}/messages", json=payload)
                assert submitted.status_code == 200
                assert submitted.json()["code"] == 200, submitted.json()["msg"]

                while True:
                    event, result = await read_event(lines)
                    if event == "heartbeat":
                        continue
                    assert result["session_id"] == session_id
                    assert not result["error"], "多轮工具执行失败，请检查服务端日志"
                    if result["summary"] or result["remote_tool_calls"]:
                        break

                if round_index == 3:
                    assert result["summary"]
                    assert result.get("remote_tool_calls",None) is None
                    assert result["messages"][-1]["content"].strip()
                    break

                calls = result["remote_tool_calls"]
                assert len(calls) == 1, "依赖工具必须在不同轮次逐个执行"
                call = calls[0]
                assert call["name"] == expected[round_index]
                assert call["location"] == "remote"
                executed.append(call["name"])
                if call["name"] == "get_project":
                    tool_result = {"project_id": project_id}
                elif call["name"] == "read_project_file":
                    assert call["arguments"]["project_id"] == project_id
                    tool_result = {"content": file_content}
                else:
                    assert call["arguments"]["content"] == file_content
                    tool_result = {"passed": True, "summary": "REMOTE_CHECK_OK"}

                print(f"远程工具第 {round_index + 1} 轮：{call['name']} -> {tool_result}")
                # 服务端已持久化此前提交的上下文，此处追加本轮 assistant 和 tool 消息。
                assistant = dict(result["messages"][-1])
                assistant["id"] = str(time.time_ns() // 1000)
                body.messages = [
                    Message.model_validate(assistant),
                    Message(
                        id=str(time.time_ns() // 1000 + 1), role="tool", status="tool_called",
                        tool_call_id=call["id"], content=json.dumps(tool_result, ensure_ascii=False),
                    ),
                ]

    assert executed == expected


async def test_dialogue_parallel_and_sequential_remote_tools(client, settings):
    """同一会话交替完成普通对话、同批双工具和跨轮单工具调用。"""
    key = settings("DEEPSEEK_API_KEY")
    if not key:
        pytest.skip("真实多阶段对话测试需要配置 DEEPSEEK_API_KEY")
    session_id = "events-mixed-" + uuid4().hex
    client_id = "client-mixed-" + uuid4().hex
    body = AddMessageRequest(
        tenant_id=0, user_id=0, session_id=session_id,
        session_title="events-mixed-dialogue-test-" + uuid4().hex,
        llm=LLMParamRequest(provider="deepseek", model="deepseek-chat", temperature=0, api_key=key),
        tools=[
            ToolDefinition(name="get_project_info", location="remote",
                                  description="获取项目名称。"),
            ToolDefinition(name="get_runtime_info", location="remote",
                                  description="获取运行环境。"),
            ToolDefinition(name="get_file_path", location="remote",
                                  description="查询需要读取的文件路径。"),
            ToolDefinition(
                name="read_file", location="remote", description="读取指定路径的文件内容。",
                parameters={"type": "object", "properties": {"path": {"type": "string"}},
                            "required": ["path"]},
            ),
        ],
        messages=[],
    )
    file_path = "test/" + uuid4().hex + ".txt"
    tool_results = {
        "get_project_info": {"project": "loong-test"},
        "get_runtime_info": {"runtime": "Python"},
        "get_file_path": {"path": file_path},
        "read_file": {"content": "REMOTE_FILE_OK"},
    }
    # None 表示提交上轮工具结果；每个阶段明确要求本轮返回的工具集合。
    stages = [
        ("先进行普通对话，不调用任何工具，只回复：你好。", []),
        ("现在在同一个 assistant 消息的 tool_calls 数组中同时调用 get_project_info 和 "
         "get_runtime_info。两项互不依赖，不要分轮调用。收到两项结果后简短总结，不再调用工具。",
         ["get_project_info", "get_runtime_info"]),
        (None, []),
        ("现在进行普通对话，不调用工具：请用一句话说明刚才获取到了什么信息。", []),
        ("接下来分两轮调用工具：先只调用 get_file_path，收到结果后，"
         "再用返回的真实 path 调用 read_file。不能猜测路径，不能同时调用这两个工具。"
         "读取成功后总结，不要再次调用工具。", ["get_file_path"]),
        (None, ["read_file"]),
        (None, []),
        ("最后进行普通对话，不调用工具，请总结本次对话完成的所有工作。", []),
    ]
    pending_results = []
    batches = []

    async with asyncio.timeout(600):
        async with client.stream("GET", f"/api/events/chat/{client_id}/sse") as response:
            assert response.status_code == 200
            lines = response.aiter_lines()
            event, connected = await read_event(lines)
            assert event == "connected"
            assert connected["client_id"] == client_id

            for stage, (prompt, expected_tools) in enumerate(stages, start=1):
                if prompt is not None:
                    body.messages = [Message(
                        id=time.time_ns() // 1000, role="user", content=prompt,
                    )]
                else:
                    assert pending_results, "工具继续执行阶段必须提交上一轮工具结果"
                    body.messages = pending_results
                    pending_results = []

                payload = body.model_dump(mode="json")
                payload["llm"]["api_key"] = body.llm.api_key.get_secret_value()
                submitted = await client.post(f"/api/events/chat/{client_id}/messages", json=payload)
                assert submitted.status_code == 200
                assert submitted.json()["code"] == 200, submitted.json()["msg"]

                while True:
                    event, result = await read_event(lines)
                    if event == "heartbeat":
                        continue
                    assert result["session_id"] == session_id
                    assert not result["error"], f"阶段 {stage} 执行失败，请查看服务端日志"
                    if result["remote_tool_calls"] or result["summary"]:
                        break

                calls = result["remote_tool_calls"]
                names = [call["name"] for call in calls]
                print(f"阶段 {stage}：期望工具={expected_tools}，实际工具={names}")
                assert sorted(names) == sorted(expected_tools)
                if not expected_tools:
                    assert result["summary"]
                    assert result["messages"][-1]["role"] == "assistant"
                    assert result["messages"][-1]["content"].strip()
                    continue

                assert not result["summary"]
                batches.append(names)
                assistant = dict(result["messages"][-1])
                assistant["id"] = time.time_ns() // 1000
                assert {call["id"] for call in assistant["tool_calls"]} == {call["id"] for call in calls}
                pending_results = [Message.model_validate(assistant)]
                # 按模型 tool_calls 的原始顺序追加结果，双工具在同次请求中回传。
                for index, call in enumerate(result["tool_calls"], start=1):
                    assert call["location"] == "remote"
                    if call["name"] == "read_file":
                        assert call["arguments"]["path"] == file_path
                    pending_results.append(Message(
                        id=time.time_ns() // 1000 + index,
                        role="tool", status="tool_called", tool_call_id=call["id"],
                        content=json.dumps(tool_results[call["name"]], ensure_ascii=False),
                    ))

    assert len(batches) == 3
    assert set(batches[0]) == {"get_project_info", "get_runtime_info"}
    assert batches[1:] == [["get_file_path"], ["read_file"]]


async def test_remote_file_edit_failure_then_retry(client, settings):
    """真实文件编辑首次因父目录不存在失败，LLM 根据错误修正参数后重试。"""
    key = settings("DEEPSEEK_API_KEY")
    if not key:
        pytest.skip("真实文件编辑重试测试需要配置 DEEPSEEK_API_KEY")
    session_id = "events-edit-retry-" + uuid4().hex
    client_id = "client-edit-retry-" + uuid4().hex
    expected_content = "EDIT_RETRY_OK_" + uuid4().hex

    # 临时目录位于工作区，退出上下文时清理成功和失败路径产生的文件。
    with TemporaryDirectory(prefix="events-edit-", dir=Path(__file__).parent) as directory:
        root = Path(directory).resolve()
        target = root / "missing-parent" / "example.txt"
        body = AddMessageRequest(
            tenant_id=0, user_id=0, session_id=session_id,
            session_title="events-file-edit-retry-test-" + uuid4().hex,
            llm=LLMParamRequest(provider="deepseek", model="deepseek-chat", temperature=0, api_key=key),
            tools=[ToolDefinition(
                name="edit_file", location="remote",
                description="写入文件；create_parent=false 时父目录必须存在，true 时先创建父目录。",
                parameters={
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "content": {"type": "string"},
                        "create_parent": {"type": "boolean"},
                    },
                    "required": ["path", "content", "create_parent"],
                },
            )],
            messages=[Message(
                id=time.time_ns() // 1000, role="user",
                content=(f"请调用 edit_file 将文件 {target.as_posix()} 的内容写为 {expected_content}。"
                         "第一次必须设置 create_parent=false。若工具失败，请根据工具错误修改参数并再次"
                         "调用 edit_file，路径和内容保持不变。编辑成功后不要再调用工具，"
                         "最终回复必须包含工具返回的 marker 和写入内容，说明编辑结果。"),
            )],
        )
        results = []
        call_ids = []
        async with asyncio.timeout(300):
            async with client.stream("GET", f"/api/events/chat/{client_id}/sse") as response:
                assert response.status_code == 200
                lines = response.aiter_lines()
                event, connected = await read_event(lines)
                assert event == "connected"
                assert connected["client_id"] == client_id

                # 由 LLM 返回的最终汇总判断完成，不预设对话轮数。
                while True:
                    payload = body.model_dump(mode="json")
                    payload["llm"]["api_key"] = body.llm.api_key.get_secret_value()
                    submitted = await client.post(f"/api/events/chat/{client_id}/messages", json=payload)
                    assert submitted.status_code == 200
                    assert submitted.json()["code"] == 200, submitted.json()["msg"]

                    while True:
                        event, result = await read_event(lines)
                        if event == "heartbeat":
                            continue
                        assert result["session_id"] == session_id
                        assert not result["error"], "文件编辑对话失败，请检查服务端日志"
                        if result["remote_tool_calls"] or result["summary"]:
                            break

                    if result["summary"]:
                        assert not result["remote_tool_calls"]
                        final = result["messages"][-1]
                        assert final["role"] == "assistant"
                        assert "FILE_EDIT_SUCCESS" in final["content"]
                        assert expected_content in final["content"]
                        print("最终编辑结果：", final["content"])
                        break

                    calls = result["remote_tool_calls"]
                    assert len(calls) == 1
                    call = calls[0]
                    assert call["name"] == "edit_file"
                    assert call["location"] == "remote"
                    assert call["id"] not in call_ids
                    call_ids.append(call["id"])
                    args = call["arguments"]
                    # 只允许修改此测试的唯一文件，不执行模型返回的任意路径。
                    assert Path(args["path"]).resolve() == target
                    assert args["content"] == expected_content
                    if not results:
                        assert args["create_parent"] is False

                    try:
                        if args["create_parent"]:
                            target.parent.mkdir(parents=True, exist_ok=True)
                        written = target.write_text(args["content"], encoding="utf-8")
                        tool_result = {"success": True, "marker": "FILE_EDIT_SUCCESS",
                                       "path": target.as_posix(), "written_chars": written,
                                       "content": target.read_text(encoding="utf-8")}
                    except FileNotFoundError as exc:
                        tool_result = {"success": False, "error_type": type(exc).__name__,
                                       "error": str(exc),
                                       "hint": "父目录不存在，请保持路径和内容不变，设置 create_parent=true 后重试。"}
                    results.append(tool_result)
                    if len(results) == 1:
                        assert not tool_result["success"]
                        assert not target.exists()
                    print(f"编辑第 {len(results)} 次结果：{json.dumps(tool_result, ensure_ascii=False)}")

                    assistant = dict(result["messages"][-1])
                    assistant["id"] = time.time_ns() // 1000
                    body.messages = [
                        Message.model_validate(assistant),
                        Message(
                            id=time.time_ns() // 1000 + 1, role="tool", status="tool_called",
                            tool_call_id=call["id"], content=json.dumps(tool_result, ensure_ascii=False),
                        ),
                    ]

        assert len(results) >= 2, "应经历首次失败和后续重试"
        assert results[0]["success"] is False
        assert results[-1]["success"] is True
        assert target.read_text(encoding="utf-8") == expected_content
    assert not root.exists(), "临时文件应在用例完成后清理"
