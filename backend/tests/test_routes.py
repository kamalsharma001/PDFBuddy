import pytest
from app.services.auth_service import (
    create_oauth_state,
    create_session_jwt,
    decode_session_jwt,
    get_google_auth_url,
    verify_oauth_state,
)
from app.services.storage import LocalStorageService
from app.api.documents import sanitize_filename, MAX_FILE_SIZE


def test_oauth_state_validity() -> None:
    state = create_oauth_state()
    assert isinstance(state, str)
    assert len(state) > 30
    assert verify_oauth_state(state) is True


def test_oauth_state_tampered_rejection() -> None:
    state = create_oauth_state()
    parts = state.split(":")
    tampered = f"{parts[0]}:{parts[1]}:fake_signature"
    assert verify_oauth_state(tampered) is False
    assert verify_oauth_state("invalid") is False


def test_google_auth_url_construction() -> None:
    from urllib.parse import parse_qs, urlparse
    from app.config import get_settings

    settings = get_settings()
    test_redirect_uri = "http://localhost:8000/auth/google/callback"
    state = create_oauth_state()
    url = get_google_auth_url(test_redirect_uri, state)

    parsed = urlparse(url)
    assert parsed.scheme == "https"
    assert parsed.netloc == "accounts.google.com"
    assert parsed.path == "/o/oauth2/v2/auth"

    qs = parse_qs(parsed.query, keep_blank_values=True)
    raw_expected_client_id = settings.google_client_id.strip()
    if raw_expected_client_id.startswith("client_id="):
        raw_expected_client_id = raw_expected_client_id[len("client_id="):].strip()

    assert qs["client_id"] == [raw_expected_client_id]
    assert not qs["client_id"][0].startswith("client_id=")
    assert qs["response_type"] == ["code"]
    assert qs["redirect_uri"] == ["http://localhost:8000/auth/google/callback"]
    assert qs["scope"] == ["openid email profile"]
    assert qs["access_type"] == ["offline"]
    assert qs["prompt"] == ["select_account"]
    assert "state" in qs
    assert verify_oauth_state(qs["state"][0]) is True


def test_jwt_session_encode_decode() -> None:
    user_id = "user-uuid-9999"
    email = "lead@pdfbuddy.com"
    name = "PDFBuddy Lead"
    token = create_session_jwt(user_id=user_id, email=email, name=name)
    assert isinstance(token, str)

    payload = decode_session_jwt(token)
    assert payload["sub"] == user_id
    assert payload["email"] == email
    assert payload["name"] == name
    assert "exp" in payload
    assert "iat" in payload


def test_jwt_invalid_token_rejected() -> None:
    with pytest.raises(ValueError):
        decode_session_jwt("fake.jwt.token")


def test_local_storage_service(tmp_path) -> None:
    storage = LocalStorageService(base_dir=str(tmp_path))
    content = b"%PDF-1.4 test binary data"
    key = "usr-1/document.pdf"
    
    saved_key = storage.upload_file(content, key)
    assert saved_key == key
    
    target_file = tmp_path / "usr-1" / "document.pdf"
    assert target_file.exists()
    assert target_file.read_bytes() == content
    
    url = storage.generate_presigned_url(key)
    assert "/documents/raw/usr-1/document.pdf" in url
    
    assert storage.delete_file(key) is True
    assert not target_file.exists()


def test_sanitize_filename() -> None:
    assert sanitize_filename("../../etc/passwd.pdf") == "passwd.pdf"
    assert sanitize_filename("my report (2026).pdf") == "my report 2026.pdf"
    assert sanitize_filename("safe_name.pdf") == "safe_name.pdf"
    assert sanitize_filename("   ") == "document.pdf"


def test_max_file_size_constant() -> None:
    assert MAX_FILE_SIZE == 50 * 1024 * 1024  # 50 MB


def test_argon2_password_hashing() -> None:
    from app.services.auth_service import hash_password, verify_password
    pw = "SuperSecure#2026"
    hashed = hash_password(pw)
    assert hashed.startswith("$argon2id$")
    assert verify_password(pw, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_password_reset_token_generation_and_hash() -> None:
    from app.services.auth_service import create_password_reset_token, hash_token
    raw, hashed, expires = create_password_reset_token()
    assert len(raw) >= 32
    assert len(hashed) == 64  # SHA256 hex length
    assert hash_token(raw) == hashed
    assert expires > 0


def test_cors_production_vercel_origin_allowed() -> None:
    from app.main import create_app
    from starlette.middleware.cors import CORSMiddleware

    app = create_app()
    cors_mw = [m for m in app.user_middleware if m.cls == CORSMiddleware][0]
    cors = CORSMiddleware(app, **cors_mw.kwargs)
    vercel_origin = "https://pdfbuddy-platform.vercel.app"

    # Confirms Vercel origin is allowed and wildcard is not used
    assert cors.is_allowed_origin(vercel_origin) is True
    assert "*" not in cors_mw.kwargs["allow_origins"]
    assert cors_mw.kwargs["allow_credentials"] is True

    # Preflight response check
    preflight = cors.preflight_response({
        "origin": vercel_origin,
        "access-control-request-method": "GET",
    })
    assert preflight.status_code == 200
    assert preflight.headers.get("access-control-allow-origin") == vercel_origin
    assert preflight.headers.get("access-control-allow-credentials") == "true"


def test_cors_localhost_dev_origin_allowed() -> None:
    from app.main import create_app
    from starlette.middleware.cors import CORSMiddleware

    app = create_app()
    cors_mw = [m for m in app.user_middleware if m.cls == CORSMiddleware][0]
    cors = CORSMiddleware(app, **cors_mw.kwargs)
    dev_origin = "http://localhost:5173"

    assert cors.is_allowed_origin(dev_origin) is True
    preflight = cors.preflight_response({
        "origin": dev_origin,
        "access-control-request-method": "POST",
    })
    assert preflight.status_code == 200
    assert preflight.headers.get("access-control-allow-origin") == dev_origin
    assert preflight.headers.get("access-control-allow-credentials") == "true"


def test_cors_unrelated_origin_rejected() -> None:
    from app.main import create_app
    from starlette.middleware.cors import CORSMiddleware

    app = create_app()
    cors_mw = [m for m in app.user_middleware if m.cls == CORSMiddleware][0]
    cors = CORSMiddleware(app, **cors_mw.kwargs)
    unrelated_origin = "https://unauthorized-attacker.example.com"

    assert cors.is_allowed_origin(unrelated_origin) is False
    preflight = cors.preflight_response({
        "origin": unrelated_origin,
        "access-control-request-method": "GET",
    })
    assert preflight.status_code == 400
    assert "access-control-allow-origin" not in preflight.headers


def test_google_oauth_authorization_url_strips_prefixed_client_id(monkeypatch: pytest.MonkeyPatch) -> None:
    from urllib.parse import parse_qs, urlparse
    from app.config import get_settings
    from app.services.auth_service import create_oauth_state, get_google_auth_url

    settings = get_settings()
    monkeypatch.setattr(settings, "google_client_id", "client_id=sample-id.apps.googleusercontent.com")

    test_redirect_uri = "http://localhost:8000/auth/google/callback"
    state = create_oauth_state()
    auth_url = get_google_auth_url(test_redirect_uri, state)

    parsed = urlparse(auth_url)
    qs = parse_qs(parsed.query, keep_blank_values=True)
    assert qs["client_id"] == ["sample-id.apps.googleusercontent.com"]
    assert qs["response_type"] == ["code"]
    assert qs["redirect_uri"] == ["http://localhost:8000/auth/google/callback"]
    assert qs["scope"] == ["openid email profile"]


def test_post_login_redirect_local_development(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.api.auth import get_frontend_redirect_url
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "development")
    monkeypatch.setattr(settings, "frontend_url", "http://localhost:5173")

    redirect_url = get_frontend_redirect_url("/workspace")
    assert redirect_url == "http://localhost:5173/workspace"

    error_url = get_frontend_redirect_url("/login?error=test_error")
    assert error_url == "http://localhost:5173/login?error=test_error"


def test_post_login_redirect_production(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.api.auth import get_frontend_redirect_url
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "frontend_url", "https://pdfbuddy-platform.vercel.app")

    redirect_url = get_frontend_redirect_url("/workspace")
    assert redirect_url == "https://pdfbuddy-platform.vercel.app/workspace"

    error_url = get_frontend_redirect_url("/login?error=test_error")
    assert error_url == "https://pdfbuddy-platform.vercel.app/login?error=test_error"


def test_post_login_redirect_production_rejects_localhost(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.api.auth import get_frontend_redirect_url
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "frontend_url", "http://localhost:5173")

    # In production mode, an accidental localhost configuration is rejected in favor of trusted production origin
    redirect_url = get_frontend_redirect_url("/workspace")
    assert redirect_url == "https://pdfbuddy-platform.vercel.app/workspace"


def test_post_login_redirect_development_with_production_url(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.api.auth import get_frontend_redirect_url
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "development")
    monkeypatch.setattr(settings, "frontend_url", "https://pdfbuddy-platform.vercel.app")

    # In development mode, configuring production vercel URL falls back safely to local dev origin
    redirect_url = get_frontend_redirect_url("/workspace")
    assert redirect_url == "http://localhost:5173/workspace"


def test_post_login_redirect_open_redirect_protection(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.api.auth import get_frontend_redirect_url
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "development")
    monkeypatch.setattr(settings, "frontend_url", "https://untrusted-attacker.com")

    # Untrusted domain must never be accepted; falls back to trusted origin
    redirect_url = get_frontend_redirect_url("/workspace")
    assert redirect_url == "http://localhost:5173/workspace"


def test_gemini_client_model_configuration() -> None:
    from app.services.gemini_client import GeminiClient

    client = GeminiClient()
    models = client.get_chat_models()
    assert models[0] == "gemini-3.8-flash"
    assert "gemini-3.5-flash-lite" in models
    assert "gemini-2.5-flash" not in models  # Retired model excluded from default fallback chain


@pytest.mark.asyncio
async def test_gemini_client_fallback_chain_on_503(monkeypatch: pytest.MonkeyPatch) -> None:
    import httpx
    from app.services.gemini_client import GeminiClient

    client = GeminiClient()
    monkeypatch.setattr(client.settings, "gemini_api_key", "test-mock-api-key")

    async def noop_sleep(seconds: float) -> None:
        pass

    monkeypatch.setattr("app.services.gemini_client.asyncio.sleep", noop_sleep)

    call_models = []

    async def mock_post(self, url, **kwargs):
        model_name = str(url).split("models/")[1].split(":")[0]
        call_models.append(model_name)
        if "gemini-3.8-flash:" in str(url):
            # Primary model returns transient 503
            req = httpx.Request("POST", url)
            resp = httpx.Response(503, request=req, text='{"error": {"message": "High demand"}}')
            raise httpx.HTTPStatusError("503 Service Unavailable", request=req, response=resp)
        elif "gemini-3.5-flash-lite:" in str(url):
            # Fallback model succeeds
            req = httpx.Request("POST", url)
            return httpx.Response(
                200,
                request=req,
                json={"candidates": [{"content": {"parts": [{"text": "Answer from fallback [Page 2]"}]}}]},
            )
        req = httpx.Request("POST", url)
        return httpx.Response(200, request=req, json={"candidates": []})

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    answer = await client.answer_question(
        question="What is the revenue?",
        context_chunks=[{"page_number": 2, "chunk_text": "Revenue was $10M."}],
        previous_messages=[],
    )
    assert "Answer from fallback [Page 2]" in answer
    assert "gemini-3.8-flash" in call_models
    assert "gemini-3.5-flash-lite" in call_models


@pytest.mark.asyncio
async def test_gemini_client_permanent_error_aborts_immediately(monkeypatch: pytest.MonkeyPatch) -> None:
    import httpx
    from app.services.gemini_client import GeminiClient

    client = GeminiClient()
    monkeypatch.setattr(client.settings, "gemini_api_key", "test-mock-api-key")

    call_count = 0

    async def mock_post(self, url, **kwargs):
        nonlocal call_count
        call_count += 1
        req = httpx.Request("POST", url)
        resp = httpx.Response(401, request=req, text='{"error": {"message": "API key invalid"}}')
        raise httpx.HTTPStatusError("401 Unauthorized", request=req, response=resp)

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    answer = await client.answer_question(
        question="Hello",
        context_chunks=[],
        previous_messages=[],
    )
    assert "Authentication with the AI service failed" in answer
    assert call_count == 1  # Aborted immediately, did not retry other models


@pytest.mark.asyncio
async def test_gemini_client_all_models_unavailable_clean_message(monkeypatch: pytest.MonkeyPatch) -> None:
    import httpx
    from app.services.gemini_client import GeminiClient

    client = GeminiClient()
    monkeypatch.setattr(client.settings, "gemini_api_key", "test-mock-api-key")

    async def noop_sleep(seconds: float) -> None:
        pass

    monkeypatch.setattr("app.services.gemini_client.asyncio.sleep", noop_sleep)

    async def mock_post(self, url, **kwargs):
        req = httpx.Request("POST", url)
        resp = httpx.Response(503, request=req, text='{"error": {"message": "High demand across region"}}')
        raise httpx.HTTPStatusError("503 Service Unavailable", request=req, response=resp)

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    answer = await client.answer_question(
        question="Summarize",
        context_chunks=[],
        previous_messages=[],
    )
    assert "temporarily experiencing high demand" in answer
    assert "503" not in answer  # Clean user-friendly message, no raw status code


@pytest.mark.asyncio
async def test_gemini_client_429_quota_exhausted_fails_over_immediately(monkeypatch: pytest.MonkeyPatch) -> None:
    import httpx
    from app.services.gemini_client import GeminiClient

    client = GeminiClient()
    monkeypatch.setattr(client.settings, "gemini_api_key", "test-mock-api-key")

    call_counts = {}

    async def mock_post(self, url, **kwargs):
        model_name = str(url).split("models/")[1].split(":")[0]
        call_counts[model_name] = call_counts.get(model_name, 0) + 1

        if "gemini-3.8-flash:" in str(url):
            # Primary model returns quota exhaustion 429
            req = httpx.Request("POST", url)
            resp = httpx.Response(
                429,
                request=req,
                text='{"error": {"code": 429, "message": "Resource has been exhausted", "status": "RESOURCE_EXHAUSTED"}}',
            )
            raise httpx.HTTPStatusError("429 Too Many Requests", request=req, response=resp)
        elif "gemini-3.5-flash-lite:" in str(url):
            # Fallback model succeeds
            req = httpx.Request("POST", url)
            return httpx.Response(
                200,
                request=req,
                json={"candidates": [{"content": {"parts": [{"text": "Quota fallback answer"}]}}]},
            )
        req = httpx.Request("POST", url)
        return httpx.Response(200, request=req, json={"candidates": []})

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    answer = await client.answer_question(
        question="What is this?",
        context_chunks=[],
        previous_messages=[],
    )
    assert answer == "Quota fallback answer"
    # Quota exhaustion must not be retried on the same model (max 1 call to primary model)
    assert call_counts["gemini-3.8-flash"] == 1
    assert call_counts["gemini-3.5-flash-lite"] == 1


@pytest.mark.asyncio
async def test_gemini_client_filters_internal_thought_parts(monkeypatch: pytest.MonkeyPatch) -> None:
    import httpx
    from app.services.gemini_client import GeminiClient

    client = GeminiClient()
    monkeypatch.setattr(client.settings, "gemini_api_key", "test-mock-api-key")

    async def mock_post(self, url, **kwargs):
        req = httpx.Request("POST", url)
        return httpx.Response(
            200,
            request=req,
            json={
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {"text": "Thinking step by step...", "thought": True},
                                {"text": "The final document answer is 42 [Page 1]."},
                            ]
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    answer = await client.answer_question("Question", [], [])
    assert "Thinking step by step" not in answer  # Internal thought filtered out
    assert answer == "The final document answer is 42 [Page 1]."


@pytest.mark.asyncio
async def test_gemini_client_stream_answer_question(monkeypatch: pytest.MonkeyPatch) -> None:
    import httpx
    from app.services.gemini_client import GeminiClient

    client = GeminiClient()
    monkeypatch.setattr(client.settings, "gemini_api_key", "test-mock-api-key")

    async def mock_post(self, url, **kwargs):
        req = httpx.Request("POST", url)
        return httpx.Response(
            200,
            request=req,
            json={"candidates": [{"content": {"parts": [{"text": "Stream chunk response"}]}}]},
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    chunks = []
    async for chunk in client.stream_answer_question("Stream test", [], []):
        chunks.append(chunk)

    assert len(chunks) == 1
    assert chunks[0] == "Stream chunk response"





