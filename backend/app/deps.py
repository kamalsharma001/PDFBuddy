from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from typing import Optional

from .config import get_settings
from .db.repositories import get_user_by_id
from .schemas import User
from .services.auth_service import decode_session_jwt

security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    bearer_creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> User:
    settings = get_settings()
    token: Optional[str] = None

    # 1. First check HttpOnly session cookie via cookie header
    cookie_header = request.headers.get("cookie", "")
    if cookie_header:
        for item in cookie_header.split(";"):
            parts = item.strip().split("=", 1)
            if len(parts) == 2 and parts[0] == settings.session_cookie_name:
                token = parts[1]
                break

    # 2. Check Authorization Bearer header
    if not token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header[7:].strip()
        elif bearer_creds and bearer_creds.credentials:
            token = bearer_creds.credentials

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing session cookie or bearer token.",
        )

    try:
        payload = decode_session_jwt(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired session: {exc}",
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session payload missing user identifier.",
        )

    # Fetch user from Neon database if configured
    if settings.database_url:
        try:
            user_row = await get_user_by_id(user_id)
            if user_row:
                return User(
                    id=user_row["id"],
                    email=user_row.get("email"),
                    name=user_row.get("name"),
                    avatar_url=user_row.get("avatar_url"),
                )
        except Exception:
            # Fall back to token claims if database connection is temporarily resolving
            pass

    return User(
        id=user_id,
        email=payload.get("email"),
        name=payload.get("name"),
        avatar_url=payload.get("avatar_url"),
    )
