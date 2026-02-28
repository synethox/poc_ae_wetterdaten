"""Tests for the FastAPI lifespan (startup / shutdown logic).

Database, GHCN download, and cache are fully mocked.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestLifespan:
    """Tests for the ``lifespan`` async context manager in main.py."""

    @pytest.mark.asyncio
    async def test_lifespan_creates_tables_and_seeds(self):
        """Verify lifespan creates PostGIS extension, tables, index, seeds stations."""
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock()
        mock_conn.run_sync = AsyncMock()

        # Simulate `async with engine.begin() as conn:`
        mock_engine = MagicMock()
        mock_begin_ctx = AsyncMock()
        mock_begin_ctx.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_begin_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_engine.begin.return_value = mock_begin_ctx
        mock_engine.dispose = AsyncMock()

        # Simulate `async with async_session() as session:`
        mock_session = AsyncMock()
        mock_session_ctx = AsyncMock()
        mock_session_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_session_factory = MagicMock(return_value=mock_session_ctx)

        with (
            patch("app.main.engine", mock_engine),
            patch("app.main.async_session", mock_session_factory),
            patch("app.main.load_stations_if_empty", new_callable=AsyncMock) as mock_seed,
            patch("app.main.cache") as mock_cache,
        ):
            mock_cache.close = AsyncMock()

            from app.main import lifespan

            async with lifespan(None):
                pass  # body of lifespan

        # Startup: Should have executed SQL statements (PostGIS, create_all, index)
        assert mock_conn.execute.await_count >= 2  # CREATE EXTENSION + CREATE INDEX
        mock_conn.run_sync.assert_awaited_once()  # Base.metadata.create_all

        # Startup: Should seed stations
        mock_seed.assert_awaited_once_with(mock_session)

        # Shutdown: Should close cache and dispose engine
        mock_cache.close.assert_awaited_once()
        mock_engine.dispose.assert_awaited_once()
