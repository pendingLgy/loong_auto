from httpx import Headers


def rebuild_cloud_request_header(headers: Headers, extend_headers:Headers | None = None ):
    """remove special local headers"""
    if headers is None:
        return

    for name in ("x-security-token","content-length","x-user-token"):
        headers.pop(name, None)

    if extend_headers:
        headers.update(extend_headers)


def rebuild_cloud_response_header(headers: Headers, extend_headers:Headers | None = None ):
    """remove special local headers"""
    if headers is None:
        return

    # 1. 标准逐跳头 + 网关重打包后失效的载荷头
    EXCLUDED_RESPONSE_HEADERS = frozenset({
        "connection",
        "keep-alive",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
        "content-length",
        "content-encoding",
    })

    for name in EXCLUDED_RESPONSE_HEADERS:
        if name in headers:
            headers.pop(name, None)

    if extend_headers:
        headers.update(extend_headers)
