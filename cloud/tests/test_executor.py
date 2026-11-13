"""模型执行器测试；真实 DeepSeek 调用需要显式启用。"""
import asyncio
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import httpx
import pytest
from dotenv import dotenv_values
from loong_cloud.agent import ModelExecutor
from loong_cloud.agent.adapters import create_adapter
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
        tools = [ToolDefinition(name='read_file', location='local', description='读取本地文件', parameters={'type': 'object', 'properties': {'path': {'type': 'string'}}, 'required': ['path']}), ToolDefinition(name='search_docs', location='remote', description='搜索远程文档', parameters={'type': 'object', 'properties': {'query': {'type': 'string'}}, 'required': ['query']})]
        messages = [Message(role='user', content='请必须分别调用 read_file 读取 main.py、search_docs 搜索 asyncio 文档。两项都必须调用，收到两项结果后简短总结，不要重复调用已完成的工具。')]
        seen = set()

        async with ModelExecutor() as executor:
            async with asyncio.timeout(180):
                for _ in range(4):
                    response = await executor.complete(
                        config, ModelRequest(messages=messages, tools=tools, max_tokens=512),
                    )
                    message = response.message
                    messages.append(message)
                    usage = message.raw['usage']

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

        assert response.message.content.strip(), '模型返回的文本不能为空'
        assert response.message.role == 'assistant'

    async def test_yaml_routing_reuses_adapter_and_isolates_concurrent_calls(self):
        """供应商名称与 adapter 不同，仍按 YAML 路由；两模型共用实例。"""
        received = {}

        async def handler(request: httpx.Request) -> httpx.Response:
            body = json.loads(request.content)
            assert str(request.url) == 'https://models.example/v1/chat/completions'
            received[body['model']] = (request.headers['authorization'], body['temperature'])
            await asyncio.sleep(0)
            return httpx.Response(200, json={'model': body['model'], 'choices': [{'message': {'content': body['model']}, 'finish_reason': 'stop'}], 'usage': {'prompt_tokens': 3, 'completion_tokens': 2}})
        with TemporaryDirectory() as directory:
            catalog = Path(directory) / 'models.yaml'
            catalog.write_text('providers:\n  example_vendor:\n    adapter: openai\n    base_url: https://models.example/v1\n    models:\n      model-a: {}\n      model-b: {}\n', encoding='utf-8')
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                with patch('loong_cloud.agent.executor.create_adapter', wraps=create_adapter) as factory:
                    async with ModelExecutor(client=client, catalog_path=catalog) as executor:
                        configs = [ModelConfig(provider='example_vendor', model='model-a', temperature=0.2, api_key='key-a'), ModelConfig(provider='example_vendor', model='model-b', temperature=0.8, api_key='key-b')]
                        request = ModelRequest(messages=[Message(role='user', content='你好')])
                        results = await asyncio.gather(*(executor.complete(config, request) for config in configs))
                        assert [result.message.content for result in results] == ['model-a', 'model-b']
                        assert received == {'model-a': ('Bearer key-a', 0.2), 'model-b': ('Bearer key-b', 0.8)}
                        assert results[0].input_tokens == 3
                        assert results[0].output_tokens == 2
                        factory.assert_called_once()
                        assert factory.call_args.kwargs['adapter'] == 'openai'
                        assert factory.call_args.args[0].api_key is None
                    assert not client.is_closed
                    with pytest.raises(RuntimeError, match='已关闭'):
                        await executor.complete(configs[0], request)
        assert not catalog.exists()
        assert not Path(directory).exists()
