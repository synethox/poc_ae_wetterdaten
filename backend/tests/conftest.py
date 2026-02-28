"""Shared pytest fixtures for the backend test suite."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient


# ── Event-loop scope ──────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop():
    """Create a single event loop for the whole test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ── FastAPI test client (no DB / Redis needed) ────────────────────────────

@pytest.fixture()
async def client():
    """Provide an ``httpx.AsyncClient`` wired to the FastAPI app.

    The lifespan (DB migrations, GHCN download) is **skipped** — individual
    tests mock what they need.
    """
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def _noop_lifespan(_app):
        yield

    # Force the module to be imported so patch() can resolve "app.main"
    import app.main  # noqa: F401

    with patch("app.main.lifespan", _noop_lifespan):
        from app.main import app

        app.router.lifespan_context = _noop_lifespan
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
