"""模型执行器测试；真实 DeepSeek 调用需要显式启用。"""
import asyncio
import json
from pathlib import Path

import pytest
from dotenv import dotenv_values

from loong_cloud.agent import ModelExecutor
from loong_cloud.agent.models import Message, ModelRequest, ToolDefinition
from loong_cloud.config.config_model import ModelConfig


@pytest.fixture(scope='module')
def deepseek_api_key():
    """当前测试文件执行前读取一次配置，不修改进程环境。"""
    path = Path(__file__).resolve().parents[1] / '.env.api_key'
    values = dotenv_values(path, interpolate=False) if path.is_file() else {}
    return (values.get('DEEPSEEK_API_KEY') or '').strip()


class TestExecutor:

    async def test_deepseek_live_local_and_remote_tools(self, deepseek_api_key):
        """读取公共测试配置调用真实模型，工具执行结果使用模拟数据。"""
        if not deepseek_api_key:
            pytest.skip('请在 cloud/.env.api_key 中配置 DEEPSEEK_API_KEY')
        config = ModelConfig(provider='deepseek', model='deepseek-chat', temperature=0, api_key=deepseek_api_key)
        tools = [ToolDefinition(name='read_file', location='local', description='读取本地文件',
                                parameters={'type': 'object', 'properties': {'path': {'type': 'string'}},
                                            'required': ['path']}),
                 ToolDefinition(name='search_docs', location='remote', description='搜索远程文档',
                                parameters={'type': 'object', 'properties': {'query': {'type': 'string'}},
                                            'required': ['query']})]
        messages = [Message(role='user',
                            content='请必须分别调用 read_file 读取 main.py、search_docs 搜索 asyncio 文档。两项都必须调用，收到两项结果后简短总结，不要重复调用已完成的工具。')]
        seen = set()

        async with ModelExecutor() as executor:
            async with asyncio.timeout(180):
                for _ in range(4):
                    message = await executor.complete(
                        config, ModelRequest(messages=messages, tools=tools, max_tokens=512),
                    )
                    messages.append(message)

                    if not message.tool_calls:
                        break

                    for call in message.tool_calls:
                        if call.name == 'read_file':
                            result = '模拟本地文件内容：import asyncio'
                        else:
                            result = '模拟远程文档：asyncio 用于异步并发编程'
                        seen.add(call.name)
                        messages.append(Message(role='tool', tool_call_id=call.id, content=result))
                else:
                    pytest.fail('模型未在四轮调用内完成工具调用和总结')
        print("\n")
        print(json.dumps([msg.model_dump(mode='json') for msg in messages], indent=4, ensure_ascii=False))

    async def test_deepseek_live_call(self, deepseek_api_key):
        """读取 cloud/.env.api_key，将密钥通过 ModelConfig 传给 DeepSeek。"""
        if not deepseek_api_key:
            pytest.skip('请在 cloud/.env.api_key 中配置 DEEPSEEK_API_KEY')
        config = ModelConfig(provider='deepseek', model='deepseek-chat', temperature=0, api_key=deepseek_api_key)
        request = ModelRequest(messages=[Message(role='user', content='请只回复 OK')], max_tokens=16)
        async with ModelExecutor() as executor:
            response = await executor.complete(config, request)

        response_dict = response.model_dump(mode='json', exclude_none=True)

        print(f"response:\n{json.dumps(response_dict, indent=4, ensure_ascii=False)}")

        assert response.content.strip(), '模型返回的文本不能为空'
        assert response.role == 'assistant'


    async def test_deepseek_live_stream(self, deepseek_api_key):
        """验证流式调用返回增量 Message，并以最终 Message 收束。"""
        if not deepseek_api_key:
            pytest.skip('请在 cloud/.env.api_key 中配置 DEEPSEEK_API_KEY')
        config = ModelConfig(provider='deepseek', model='deepseek-chat', temperature=0, api_key=deepseek_api_key)
        request = ModelRequest(messages=[Message(role='user', content='请只回复 OK')], max_tokens=16)
        events = []
        async with ModelExecutor() as executor:
            async with asyncio.timeout(180):
                async for message in executor.stream(config, request):
                    print('\nevents:\n' + json.dumps(message.model_dump(mode='json'), indent=4,ensure_ascii=False))
                    events.append(message)

        print('stream events:\n' + json.dumps([event.model_dump(mode='json') for event in events], indent=4, ensure_ascii=False))



    async def test_deepseek_multipe_chunk_live_stream(self, deepseek_api_key):
        """验证流式调用返回增量 Message，并以最终 Message 收束。"""
        if not deepseek_api_key:
            pytest.skip('请在 cloud/.env.api_key 中配置 DEEPSEEK_API_KEY')
        config = ModelConfig(provider='deepseek', model='deepseek-chat', temperature=0, api_key=deepseek_api_key)
        request = ModelRequest(messages=[Message(role='user', content='给我一份markdown语法demo')], max_tokens=393216)
        events = []
        async with ModelExecutor() as executor:
            async with asyncio.timeout(180):
                async for message in executor.stream(config, request):
                    print('\nevents:\n' + json.dumps(message.model_dump(mode='json'), indent=4,ensure_ascii=False))
                    events.append(message)

        # print('stream events:\n' + json.dumps([event.model_dump(mode='json') for event in events], indent=4, ensure_ascii=False))

    async def test_deepseek_live_local_and_remote_tools_stream(self, deepseek_api_key):
        """验证流式工具调用返回增量 Message，并以最终 Message 收束。"""

        if not deepseek_api_key:
            pytest.skip('请在 cloud/.env.api_key 中配置 DEEPSEEK_API_KEY')

        config = ModelConfig(provider='deepseek', model='deepseek-chat', temperature=0, api_key=deepseek_api_key)
        tools = [ToolDefinition(name='read_file', location='local', description='读取本地文件',
                                parameters={'type': 'object', 'properties': {'path': {'type': 'string'}},
                                            'required': ['path']}),
                 ToolDefinition(name='search_docs', location='remote', description='搜索远程文档',
                                parameters={'type': 'object', 'properties': {'query': {'type': 'string'}},
                                            'required': ['query']})]
        messages = [Message(role='user',
                            content='请必须分别调用 read_file 读取 main.py、search_docs 搜索 asyncio 文档。两项都必须调用，收到两项结果后简短总结，不要重复调用已完成的工具。')]

        request = ModelRequest(messages=messages, tools=tools, max_tokens=512)
        events = []
        async with ModelExecutor() as executor:
            async with asyncio.timeout(180):
                async for message in executor.stream(config, request):
                    events.append(message)
                    print('\nevents:\n' + json.dumps(message.model_dump(mode='json'), indent=4, ensure_ascii=False))


