"""Unit tests for the Redis cache layer.

All Redis I/O is mocked – tests verify serialisation logic and graceful
degradation when Redis is unavailable.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from app import cache


# ── Helpers ───────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _reset_pool():
    """Ensure the global Redis pool is reset between tests."""
    cache._pool = None
    yield
    cache._pool = None


def _mock_redis(get_return=None):
    """Return a mock Redis client with optional GET return value."""
    r = AsyncMock()
    r.get = AsyncMock(return_value=get_return)
    r.set = AsyncMock()
    r.aclose = AsyncMock()
    return r


# ── cache_get ─────────────────────────────────────────────────────────────

class TestCacheGet:
    """Tests for ``cache.cache_get``."""

    @pytest.mark.asyncio
    async def test_returns_none_when_key_missing(self):
        mock_r = _mock_redis(get_return=None)
        with patch("app.cache._get_redis", return_value=mock_r):
            result = await cache.cache_get("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_deserialised_json(self):
        data = [{"id": "S1", "name": "Station 1"}]
        mock_r = _mock_redis(get_return=json.dumps(data))
        with patch("app.cache._get_redis", return_value=mock_r):
            result = await cache.cache_get("stations:key")
        assert result == data

    @pytest.mark.asyncio
    async def test_returns_none_on_redis_error(self):
        """Cache should degrade gracefully – never raise."""
        with patch("app.cache._get_redis", side_effect=ConnectionError("refused")):
            result = await cache.cache_get("any-key")
        assert result is None

    @pytest.mark.asyncio
    async def test_handles_nested_objects(self):
        data = {"nested": {"deep": [1, 2, 3]}}
        mock_r = _mock_redis(get_return=json.dumps(data))
        with patch("app.cache._get_redis", return_value=mock_r):
            result = await cache.cache_get("complex")
        assert result == data


# ── cache_set ─────────────────────────────────────────────────────────────

class TestCacheSet:
    """Tests for ``cache.cache_set``."""

    @pytest.mark.asyncio
    async def test_serialises_and_stores_with_ttl(self):
        mock_r = _mock_redis()
        with patch("app.cache._get_redis", return_value=mock_r):
            await cache.cache_set("key", {"a": 1}, ttl=300)

        mock_r.set.assert_awaited_once()
        call_args = mock_r.set.call_args
        assert call_args[0][0] == "key"
        assert json.loads(call_args[0][1]) == {"a": 1}
        assert call_args[1]["ex"] == 300

    @pytest.mark.asyncio
    async def test_does_not_raise_on_redis_error(self):
        """Writes that fail should be silently ignored."""
        with patch("app.cache._get_redis", side_effect=ConnectionError("refused")):
            # Should NOT raise
            await cache.cache_set("key", "value")

    @pytest.mark.asyncio
    async def test_default_ttl(self):
        mock_r = _mock_redis()
        with patch("app.cache._get_redis", return_value=mock_r):
            await cache.cache_set("k", "v")

        assert mock_r.set.call_args[1]["ex"] == 3600


# ── close ─────────────────────────────────────────────────────────────────

class TestCacheClose:
    """Tests for ``cache.close``."""

    @pytest.mark.asyncio
    async def test_close_when_pool_exists(self):
        mock_r = AsyncMock()
        mock_r.aclose = AsyncMock()
        cache._pool = mock_r

        await cache.close()

        mock_r.aclose.assert_awaited_once()
        assert cache._pool is None

    @pytest.mark.asyncio
    async def test_close_when_no_pool(self):
        cache._pool = None
        # Should not raise
        await cache.close()
        assert cache._pool is None


# ── _get_redis (pool creation) ────────────────────────────────────────────

class TestGetRedis:
    """Tests for the internal ``_get_redis`` pool factory."""

    @pytest.mark.asyncio
    async def test_creates_pool_on_first_call(self):
        """First call should create a Redis pool via from_url."""
        mock_pool = AsyncMock()
        with patch("app.cache.aioredis.from_url", return_value=mock_pool) as mock_from_url:
            result = await cache._get_redis()

        assert result is mock_pool
        assert cache._pool is mock_pool
        mock_from_url.assert_called_once()

    @pytest.mark.asyncio
    async def test_reuses_existing_pool(self):
        """Subsequent calls should return the same pool without creating a new one."""
        existing_pool = AsyncMock()
        cache._pool = existing_pool

        with patch("app.cache.aioredis.from_url") as mock_from_url:
            result = await cache._get_redis()

        assert result is existing_pool
        mock_from_url.assert_not_called()
