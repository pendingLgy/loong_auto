"""python -m loong_contracts.export：导出接口 JSON Schema。"""

import json

from . import Event, ServiceStatus, HealthStatus
from .response import BaseResponse


def export_schemas() -> dict:
    models = (BaseResponse, Event, ServiceStatus, HealthStatus)
    return {model.__name__: model.model_json_schema() for model in models}


if __name__ == "__main__":
    print(json.dumps(export_schemas(), ensure_ascii=False, indent=2))
