from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import auth, documents, chat
from .config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="PDFBuddy Backend",
        version="1.0.0",
        description="PDFBuddy — AI-Powered PDF Chat & Document Intelligence Platform API",
    )

    # Clean and parse authorized CORS origins
    raw_origins = [
        settings.frontend_url,
        "https://pdfbuddy-platform.vercel.app",
    ]
    if settings.cors_origins:
        raw_origins.extend(settings.cors_origins.split(","))

    origins = []
    for origin in raw_origins:
        cleaned = origin.strip().rstrip("/")
        if cleaned and cleaned not in origins and cleaned != "*":
            origins.append(cleaned)

    # Always allow standard local development ports
    dev_origins = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]
    for dev_origin in dev_origins:
        if dev_origin not in origins:
            origins.append(dev_origin)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health() -> dict:
        return {
            "status": "ok",
            "app": "PDFBuddy",
            "version": "1.0.0",
            "environment": settings.environment,
            "storage_configured": bool(settings.r2_account_id and settings.r2_access_key_id),
            "database_configured": bool(settings.database_url),
        }

    app.include_router(auth.router, prefix="/auth", tags=["auth"])
    app.include_router(documents.router, prefix="/documents", tags=["documents"])
    app.include_router(chat.router, prefix="/chat", tags=["chat"])

    return app


app = create_app()
