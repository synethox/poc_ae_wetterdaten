"""Optional Redis caching – degrades gracefully if Redis is unavailable."""

from __future__ import annotations

import json
import logging
from typing import Any

import redis.asyncio as aioredis

from app import config

logger = logging.getLogger(__name__)

_pool: aioredis.Redis | None = None


async def _get_redis() -> aioredis.Redis:
    global _pool
    if _pool is None:
        _pool = aioredis.from_url(config.REDIS_URL, decode_responses=True)
    return _pool


async def cache_get(key: str) -> Any | None:
    """Return cached JSON value or *None* (never raises)."""
    try:
        r = await _get_redis()
        raw = await r.get(key)
        return json.loads(raw) if raw else None
    except Exception:
        return None


async def cache_set(key: str, value: Any, ttl: int = 3600) -> None:
    """Store a JSON-serialisable value with a TTL (never raises)."""
    try:
        r = await _get_redis()
        await r.set(key, json.dumps(value, default=str), ex=ttl)
    except Exception:
        pass


async def close() -> None:
    """Shut down the Redis connection pool."""
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None
