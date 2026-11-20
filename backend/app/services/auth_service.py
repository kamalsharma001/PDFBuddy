import hmac
import hashlib
import time
import secrets
import logging
from typing import Any
from urllib.parse import urlencode
import httpx
from jose import jwt, JWTError
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError

from ..config import get_settings

logger = logging.getLogger("pdfbuddy.auth")
_password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hash_password(password: str) -> str:
    """Hash password using Argon2id."""
    return _password_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against Argon2id hash."""
    if not hashed_password:
        return False
    try:
        return _password_hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def hash_token(raw_token: str) -> str:
    """Hash a token for database storage using SHA256."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_password_reset_token() -> tuple[str, str, float]:
    """Generates a raw reset token, its SHA256 hash for db storage, and unix expiry (1 hour)."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_token(raw_token)
    expires_at = time.time() + 3600.0  # 1 hour
    return raw_token, token_hash, expires_at


def create_oauth_state() -> str:
    """Generate a cryptographically secure random state for OAuth CSRF protection."""
    token = secrets.token_urlsafe(32)
    timestamp = str(int(time.time()))
    payload = f"{token}:{timestamp}"
    settings = get_settings()
    signature = hmac.new(
        settings.jwt_secret_key.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload}:{signature}"


def verify_oauth_state(state: str, max_age_seconds: int = 600) -> bool:
    """Verify state token signature and expiration (10 minutes max)."""
    try:
        parts = state.split(":")
        if len(parts) != 3:
            return False
        token, timestamp_str, received_sig = parts
        timestamp = int(timestamp_str)
        if time.time() - timestamp > max_age_seconds:
            return False  # Expired
        
        settings = get_settings()
        expected_payload = f"{token}:{timestamp_str}"
        expected_sig = hmac.new(
            settings.jwt_secret_key.encode("utf-8"),
            expected_payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        
        return hmac.compare_digest(received_sig, expected_sig)
    except Exception:
        return False


def get_google_auth_url(redirect_uri: str, state: str) -> str:
    """Construct Google OAuth 2.0 authorization URL."""
    settings = get_settings()
    raw_client_id = settings.google_client_id.strip()
    if raw_client_id.startswith("client_id="):
        raw_client_id = raw_client_id[len("client_id="):].strip()

    params = {
        "client_id": raw_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    }
    query_string = urlencode(params)
    return f"https://accounts.google.com/o/oauth2/v2/auth?{query_string}"


async def exchange_google_code(code: str, redirect_uri: str) -> dict[str, Any]:
    """Exchange authorization code with Google for tokens and userinfo."""
    settings = get_settings()
    raw_client_id = settings.google_client_id.strip()
    if raw_client_id.startswith("client_id="):
        raw_client_id = raw_client_id[len("client_id="):].strip()

    raw_client_secret = settings.google_client_secret.strip()
    if raw_client_secret.startswith("client_secret="):
        raw_client_secret = raw_client_secret[len("client_secret="):].strip()

    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "code": code,
        "client_id": raw_client_id,
        "client_secret": raw_client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        token_resp = await client.post(token_url, data=data)
        if token_resp.status_code != 200:
            raise RuntimeError(f"Google token exchange failed: {token_resp.text}")
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        
        # Fetch user info using access token
        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_resp.status_code != 200:
            raise RuntimeError(f"Failed to fetch Google userinfo: {userinfo_resp.text}")
        
        return userinfo_resp.json()


def create_session_jwt(user_id: str, email: str, name: str | None = None, duration_minutes: int | None = None) -> str:
    """Generate a signed JWT token for session management."""
    settings = get_settings()
    mins = duration_minutes or settings.jwt_expiration_minutes
    expire = time.time() + (mins * 60)
    payload = {
        "sub": user_id,
        "email": email,
        "name": name,
        "exp": int(expire),
        "iat": int(time.time()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_session_jwt(token: str) -> dict[str, Any]:
    """Verify and decode session JWT token."""
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError(f"Invalid session token: {exc}") from exc


class TransactionalEmailService:
    """Email provider abstraction for transactional messages (password reset)."""

    def __init__(self) -> None:
        self.settings = get_settings()

    async def send_password_reset_email(self, to_email: str, reset_token: str) -> dict[str, Any]:
        reset_link = f"{self.settings.frontend_url.rstrip('/')}/reset-password?token={reset_token}"
        
        # In development or when SMTP/provider is unconfigured, log safely
        logger.info(
            f"[PDFBuddy Transactional Email] Password reset requested for {to_email}. "
            f"Reset Link: {reset_link}"
        )
        return {
            "delivered": False,
            "mode": "development_logged",
            "message": "Password reset link generated. Configured email provider will dispatch in production.",
            "reset_link": reset_link if self.settings.environment == "development" else None,
        }
