"""python -m loong_contracts.export：导出接口 JSON Schema。"""


def export_schemas() -> dict:
    from loong_contracts.response import BaseResponse, HealthStatus, ServiceStatus
    models = (BaseResponse, ServiceStatus, HealthStatus)
    return {model.__name__: model.model_json_schema() for model in models}

if __name__ == "__main__":
    import json
    print(json.dumps(export_schemas(), ensure_ascii=False, indent=2))
