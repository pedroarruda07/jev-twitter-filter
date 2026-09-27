import re
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .categories import load_categories
from .config import Settings
from .jev import ClassificationError, JevClassifier
from .schemas import Category, Classification, PostRequest


def create_app(settings: Settings | None = None, transport=None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        config = settings or Settings()
        categories = load_categories()
        async with httpx.AsyncClient(
            timeout=config.timeout_seconds,
            transport=transport,
            limits=httpx.Limits(max_connections=config.max_concurrency),
        ) as client:
            app.state.classifier = JevClassifier(client, config, categories)
            yield

    app = FastAPI(title="Jev X Classifier", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver"]
    )

    @app.middleware("http")
    async def guard_origin(request: Request, call_next):
        origin = request.headers.get("origin")
        local_origins = {"http://127.0.0.1:8000", "http://localhost:8000"}
        if (
            origin
            and origin not in local_origins
            and not re.fullmatch(r"chrome-extension://[a-p]{32}", origin)
        ):
            return JSONResponse({"detail": "Only local extension requests are accepted."}, 403)
        return await call_next(request)

    @app.exception_handler(ClassificationError)
    async def classification_error(request: Request, error: ClassificationError):
        return JSONResponse({"detail": str(error)}, error.status_code)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.get("/api/categories", response_model=list[Category])
    async def categories(request: Request):
        return list(request.app.state.classifier.categories.values())

    @app.post("/api/classify", response_model=Classification)
    async def classify(post: PostRequest, request: Request):
        return await request.app.state.classifier.classify(post)

    return app


app = create_app()
