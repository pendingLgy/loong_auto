"""根据协议创建适配器；兼容供应商通过 base_url 切换。"""


from loong_cloud.agent.adapters.base import ModelAdapter, ModelError
from loong_cloud.agent.adapters.deepseek import DeepSeekAdapter
from loong_cloud.agent.adapters.openai import OpenAIAdapter

__all__ = [
 "ModelAdapter", "ModelError", "OpenAIAdapter", "DeepSeekAdapter",
]
