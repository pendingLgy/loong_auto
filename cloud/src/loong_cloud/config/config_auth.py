"""认证路径配置。"""

import json

DEFAULT_PUBLIC_PATHS = [
    "/api/auth/login", "/api/auth/register",
    "/api/auth/refresh_token",
    "/api/status", "/api/status/health",
    # "/api/docs", "/api/redoc","/api/openapi.json", "/api/docs/oauth2-redirect",
]


def authentication_public_paths(raw: str | list[str] | None = None) -> list[str]:
    paths = json.loads(raw) if isinstance(raw, str) else raw
    paths = [] if paths is None else paths

    if not isinstance(paths, list) or any(
        not isinstance(path, str) or not path.startswith("/") or "?" in path or "#" in path
        for path in paths
    ):
        raise ValueError("White List Url 格式错误")
    return list(dict.fromkeys([*paths, *DEFAULT_PUBLIC_PATHS]))

