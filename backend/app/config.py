import os
from pathlib import Path
from functools import lru_cache
from dotenv import load_dotenv
from pydantic import BaseModel

# Load strictly from backend/.env if present
backend_env = Path(__file__).resolve().parent.parent / ".env"
if backend_env.exists():
    load_dotenv(backend_env)


class Settings(BaseModel):
    # Database (Neon Serverless PostgreSQL)
    database_url: str = ""

    # Google OAuth 2.0
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""

    # JWT Session Configuration
    jwt_secret_key: str = "pdfbuddy-default-dev-secret-key-min-32-chars-long"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 60 * 24 * 7  # 7 days
    session_cookie_name: str = "pdfbuddy_session"
    session_cookie_secure: bool = False
    session_cookie_samesite: str = "lax"

    # Frontend & CORS
    frontend_url: str = "http://localhost:5173"
    cors_origins: str = ""

    # AI Model (Google Gemini)
    gemini_api_key: str = ""
    gemini_chat_model: str = "gemini-3.8-flash"
    gemini_fallback_models: str = "gemini-3.5-flash-lite"
    gemini_embedding_model: str = "gemini-embedding-001"
    gemini_embedding_dim: int = 768

    # Cloudflare R2 Storage (S3-compatible)
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "pdfbuddy-documents"

    # Local storage fallback for local dev
    local_storage_dir: str = "./uploads"
    environment: str = "development"


@lru_cache
def get_settings() -> Settings:
    env_mode = os.getenv("ENVIRONMENT", "development").strip().lower()
    is_prod = (env_mode == "production")

    default_frontend = "https://pdfbuddy-platform.vercel.app" if is_prod else "http://localhost:5173"
    raw_frontend = os.getenv("FRONTEND_URL", "").strip()
    frontend = raw_frontend.rstrip("/") if raw_frontend else default_frontend

    cors_origins_env = os.getenv("CORS_ORIGINS", "")

    db_url = os.getenv("DATABASE_URL") or os.getenv("NEON_DATABASE_URL") or ""
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    default_samesite = "none" if is_prod else "lax"
    samesite = os.getenv("SESSION_COOKIE_SAMESITE", default_samesite).lower()

    raw_google_client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if raw_google_client_id.startswith("client_id="):
        raw_google_client_id = raw_google_client_id[len("client_id="):].strip()

    raw_google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
    if raw_google_client_secret.startswith("client_secret="):
        raw_google_client_secret = raw_google_client_secret[len("client_secret="):].strip()

    return Settings(
        database_url=db_url,
        google_client_id=raw_google_client_id,
        google_client_secret=raw_google_client_secret,
        google_redirect_uri=os.getenv("GOOGLE_REDIRECT_URI", "").strip(),
        jwt_secret_key=os.getenv("JWT_SECRET_KEY", "pdfbuddy-default-dev-secret-key-min-32-chars-long"),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        jwt_expiration_minutes=int(os.getenv("JWT_EXPIRATION_MINUTES", str(60 * 24 * 7))),
        session_cookie_name=os.getenv("SESSION_COOKIE_NAME", "pdfbuddy_session"),
        session_cookie_secure=is_prod,
        session_cookie_samesite=samesite,
        frontend_url=frontend,
        cors_origins=os.getenv("CORS_ORIGINS", ""),
        gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
        gemini_chat_model=os.getenv("GEMINI_CHAT_MODEL", "gemini-3.8-flash").strip(),
        gemini_fallback_models=os.getenv("GEMINI_FALLBACK_MODELS", "gemini-3.5-flash-lite").strip(),
        gemini_embedding_model=os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001").strip(),
        gemini_embedding_dim=int(os.getenv("GEMINI_EMBEDDING_DIM", "768")),
        r2_account_id=os.getenv("R2_ACCOUNT_ID", ""),
        r2_access_key_id=os.getenv("R2_ACCESS_KEY_ID", ""),
        r2_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY", ""),
        r2_bucket_name=os.getenv("R2_BUCKET_NAME", "pdfbuddy-documents"),
        local_storage_dir=os.getenv("LOCAL_STORAGE_DIR", "./uploads"),
        environment=env_mode,
    )
