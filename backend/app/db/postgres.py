import ssl
from typing import Any, Sequence
import asyncpg
from pydantic import BaseModel

from ..config import get_settings


class DatabaseSettings(BaseModel):
    url: str


def get_db_settings() -> DatabaseSettings:
    url = get_settings().database_url
    if not url:
        raise RuntimeError("DATABASE_URL / NEON_DATABASE_URL is not set")
    return DatabaseSettings(url=url)


_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is not None:
        return _pool

    settings = get_db_settings()
    
    # Configure SSL for Neon PostgreSQL if required
    # Neon serverless URLs typically require ssl=require
    ssl_context = None
    if "sslmode=require" in settings.url or "neon.tech" in settings.url:
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

    # Clean query parameters for asyncpg if present
    clean_url = settings.url.split("?")[0] if "?" in settings.url else settings.url

    _pool = await asyncpg.create_pool(
        dsn=clean_url,
        min_size=1,
        max_size=10,
        statement_cache_size=0,  # Required for Neon transaction/session poolers
        ssl=ssl_context if ssl_context else "prefer",
        timeout=30.0,
    )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def fetch_rows(query: str, *args: Any) -> Sequence[asyncpg.Record]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(query, *args)


async def execute(query: str, *args: Any) -> str:
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.execute(query, *args)
