from httpx import AsyncClient


async def test_security_token(http_client: AsyncClient):

    http_client.headers["x-security-token"] = "feEVnpc9LrPfEWjswTzXz3FAaPKLWwZqrp08aLlvF10"
    response = await http_client.get("/api/health/security_token")

    response.raise_for_status()
    data = response.json()

    assert data.get("code") == 500

