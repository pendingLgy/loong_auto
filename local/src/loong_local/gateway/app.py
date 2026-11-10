from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(title="Loong Local Gateway", version="0.1.0")

    @app.get("/local/v1/health")
    async def health():
        return {"status": "ok", "capabilities": [], "implementation": "skeleton"}

    return app
