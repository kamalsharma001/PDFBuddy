from datetime import datetime, timezone
from typing import Any
import re
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse

from ..config import get_settings
from ..db.repositories import (
    create_user_with_password,
    get_user_by_email,
    get_user_by_reset_token,
    set_password_reset_token,
    set_user_password,
    upsert_user_by_google,
)
from ..deps import get_current_user
from ..schemas import (
    AuthStatusResponse,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    User,
)
from ..services.auth_service import (
    TransactionalEmailService,
    create_oauth_state,
    create_password_reset_token,
    create_session_jwt,
    exchange_google_code,
    get_google_auth_url,
    hash_password,
    hash_token,
    verify_oauth_state,
    verify_password,
)

router = APIRouter()

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

TRUSTED_DEV_FRONTEND_ORIGIN = "http://localhost:5173"
TRUSTED_PROD_FRONTEND_ORIGIN = "https://pdfbuddy-platform.vercel.app"


def get_frontend_redirect_url(path: str = "/workspace") -> str:
    """
    Returns an environment-aware, trusted frontend redirect URL.
    Restricts redirect destinations strictly to configured trusted frontend origins
    to prevent open redirect vulnerabilities.
    """
    settings = get_settings()
    env = (settings.environment or "development").strip().lower()
    is_prod = (env == "production")

    default_origin = TRUSTED_PROD_FRONTEND_ORIGIN if is_prod else TRUSTED_DEV_FRONTEND_ORIGIN

    trusted_origins: set[str] = {
        TRUSTED_DEV_FRONTEND_ORIGIN,
        "http://127.0.0.1:5173",
        TRUSTED_PROD_FRONTEND_ORIGIN,
    }
    if settings.cors_origins:
        for origin in settings.cors_origins.split(","):
            cleaned = origin.strip().rstrip("/")
            if cleaned and not cleaned.startswith("*"):
                trusted_origins.add(cleaned)

    configured = (settings.frontend_url or "").strip().rstrip("/")
    chosen_origin = default_origin

    if configured and configured in trusted_origins:
        # In production mode, reject accidental localhost redirect
        if is_prod and ("localhost" in configured or "127.0.0.1" in configured):
            chosen_origin = default_origin
        # In development mode, prioritize local dev origin if configured points to vercel production
        elif not is_prod and ("vercel.app" in configured):
            chosen_origin = default_origin
        else:
            chosen_origin = configured

    clean_path = "/" + path.lstrip("/") if path else ""
    return f"{chosen_origin}{clean_path}"


def _get_redirect_uri(request: Request) -> str:
    settings = get_settings()
    if settings.google_redirect_uri:
        return settings.google_redirect_uri
    # Auto-derive from request URL (e.g. https://api.render.com/auth/google/callback)
    base_url = str(request.base_url).rstrip("/")
    return f"{base_url}/auth/google/callback"


def _set_session_cookie(response: Response, session_jwt: str, remember_me: bool = False) -> None:
    settings = get_settings()
    max_age = (30 * 24 * 3600) if remember_me else (settings.jwt_expiration_minutes * 60)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session_jwt,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        max_age=max_age,
        path="/",
    )


@router.get("/google/login")
async def google_login(request: Request) -> RedirectResponse:
    """Initiates Google OAuth 2.0 flow with cryptographic state validation."""
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GOOGLE_CLIENT_ID is not configured on the backend.",
        )

    redirect_uri = _get_redirect_uri(request)
    state = create_oauth_state()
    auth_url = get_google_auth_url(redirect_uri, state)

    response = RedirectResponse(url=auth_url, status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key="oauth_state",
        value=state,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        max_age=600,  # 10 minutes
        path="/",
    )
    return response


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    """Handles OAuth 2.0 redirect from Google, exchanges code for userinfo, and sets session cookie."""
    settings = get_settings()

    if error:
        # Redirect user back to login screen with human-readable error description
        login_url = get_frontend_redirect_url(f"/login?error={error}")
        return RedirectResponse(url=login_url, status_code=status.HTTP_302_FOUND)

    if not code or not state:
        login_url = get_frontend_redirect_url("/login?error=missing_oauth_parameters")
        return RedirectResponse(url=login_url, status_code=status.HTTP_302_FOUND)

    # Validate state against stored cookie and cryptographic signature
    stored_state = request.cookies.get("oauth_state")
    if not stored_state or stored_state != state or not verify_oauth_state(state):
        login_url = get_frontend_redirect_url("/login?error=invalid_or_expired_oauth_state")
        return RedirectResponse(url=login_url, status_code=status.HTTP_302_FOUND)

    redirect_uri = _get_redirect_uri(request)
    try:
        user_info = await exchange_google_code(code, redirect_uri)
    except Exception as exc:
        login_url = get_frontend_redirect_url("/login?error=google_exchange_failed")
        return RedirectResponse(url=login_url, status_code=status.HTTP_302_FOUND)

    email = user_info.get("email")
    if not email or not user_info.get("email_verified", False):
        login_url = get_frontend_redirect_url("/login?error=unverified_google_email")
        return RedirectResponse(url=login_url, status_code=status.HTTP_302_FOUND)

    name = user_info.get("name")
    avatar_url = user_info.get("picture")
    google_id = user_info.get("sub")

    # Persist or safely link user in Neon database
    try:
        user_row = await upsert_user_by_google(
            email=email,
            name=name,
            avatar_url=avatar_url,
            google_id=google_id,
        )
        user_id = user_row["id"]
    except Exception:
        # Fallback to deterministic UUID if database connection is resolving
        user_id = f"google-{google_id}"

    # Create signed session JWT
    session_jwt = create_session_jwt(
        user_id=user_id,
        email=email,
        name=name,
    )

    # Redirect to workspace
    frontend_destination = get_frontend_redirect_url("/workspace")
    response = RedirectResponse(url=frontend_destination, status_code=status.HTTP_302_FOUND)
    _set_session_cookie(response, session_jwt, remember_me=True)
    response.delete_cookie("oauth_state", path="/")
    return response


@router.post("/register", response_model=AuthStatusResponse)
async def register(payload: RegisterRequest, response: Response) -> AuthStatusResponse:
    """Register a new user with full name, email, and password."""
    # 1. Input format validation
    name = payload.name.strip()
    email = payload.email.strip().lower()
    if len(name) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Name must be at least 2 characters long.",
        )
    if not EMAIL_REGEX.match(email):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please provide a valid email address.",
        )
    if len(payload.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters long.",
        )

    # 2. Check for duplicate account
    existing = await get_user_by_email(email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists. Please sign in instead.",
        )

    # 3. Hash password using Argon2id
    pwd_hash = hash_password(payload.password)
    user_row = await create_user_with_password(
        email=email,
        password_hash=pwd_hash,
        name=name,
    )

    user = User(
        id=user_row["id"],
        email=user_row["email"],
        name=user_row.get("name"),
        avatar_url=user_row.get("avatar_url"),
    )

    # 4. Create and set session JWT
    session_jwt = create_session_jwt(user.id, user.email, user.name)
    _set_session_cookie(response, session_jwt, remember_me=True)

    return AuthStatusResponse(
        status="registered",
        message="Account created successfully.",
        user=user,
    )


@router.post("/login", response_model=AuthStatusResponse)
async def login(payload: LoginRequest, response: Response) -> AuthStatusResponse:
    """Sign in an existing user with email and password."""
    email = payload.email.strip().lower()
    if not EMAIL_REGEX.match(email):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please provide a valid email address.",
        )

    user_row = await get_user_by_email(email)
    # Generic error without leaking whether the account exists
    invalid_creds_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password. Please verify your credentials and try again.",
    )

    if not user_row:
        raise invalid_creds_exc

    stored_hash = user_row.get("password_hash")
    if not stored_hash or not verify_password(payload.password, stored_hash):
        raise invalid_creds_exc

    user = User(
        id=user_row["id"],
        email=user_row["email"],
        name=user_row.get("name"),
        avatar_url=user_row.get("avatar_url"),
    )

    duration_mins = (30 * 24 * 60) if payload.remember_me else None
    session_jwt = create_session_jwt(user.id, user.email, user.name, duration_minutes=duration_mins)
    _set_session_cookie(response, session_jwt, remember_me=payload.remember_me)

    return AuthStatusResponse(
        status="authenticated",
        message="Login successful.",
        user=user,
    )


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest) -> dict[str, Any]:
    """Initiates secure password reset. Returns generic message to prevent account enumeration."""
    email = payload.email.strip().lower()
    if EMAIL_REGEX.match(email):
        user_row = await get_user_by_email(email)
        if user_row:
            raw_token, token_hash, expires_at = create_password_reset_token()
            expires_at_iso = datetime.fromtimestamp(expires_at, tz=timezone.utc).isoformat()
            await set_password_reset_token(email, token_hash, expires_at_iso)
            
            # Dispatch transactional email via provider abstraction
            email_service = TransactionalEmailService()
            dispatch_result = await email_service.send_password_reset_email(email, raw_token)
            
            # In development, return debug hint for easy testing
            settings = get_settings()
            if settings.environment == "development":
                return {
                    "status": "instructions_sent",
                    "message": "If this email is registered, password reset instructions have been sent.",
                    "dev_token": raw_token,
                    "dev_reset_url": dispatch_result.get("reset_link"),
                }

    return {
        "status": "instructions_sent",
        "message": "If this email is registered, password reset instructions have been sent.",
    }


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest) -> dict[str, str]:
    """Reset password using secure single-use token."""
    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters long.",
        )

    token_hash = hash_token(payload.token.strip())
    user_row = await get_user_by_reset_token(token_hash)
    if not user_row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset link. Please request a new one.",
        )

    # Hash new password with Argon2id and clear reset token
    new_hash = hash_password(payload.new_password)
    await set_user_password(user_row["id"], new_hash)

    return {
        "status": "password_updated",
        "message": "Your password has been successfully updated. You can now log in.",
    }


@router.get("/me", response_model=User)
async def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    """Returns the authenticated user identity."""
    return current_user


@router.post("/logout")
async def logout(response: Response) -> dict[str, str]:
    """Logs out user by clearing the session cookie."""
    settings = get_settings()
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
    )
    return {"status": "logged_out"}
