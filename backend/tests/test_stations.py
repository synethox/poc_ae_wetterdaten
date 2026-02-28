"""Unit tests for station search logic.

The PostGIS spatial queries are tested with a mock ``AsyncSession``
that returns pre-built row objects, so no real database is needed.
"""

from __future__ import annotations

from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.stations import search_stations_db


# ── Helpers ───────────────────────────────────────────────────────────────

def _fake_result(*rows: dict):
    """Create a mock SQLAlchemy result with the given dicts as rows."""
    ns_rows = [SimpleNamespace(**r) for r in rows]
    mock_result = MagicMock()
    mock_result.__iter__ = lambda self: iter(ns_rows)
    return mock_result


def _session(result):
    """Create a mock AsyncSession that returns *result* from execute."""
    session = AsyncMock()
    session.execute = AsyncMock(return_value=result)
    return session


# ── Tests ─────────────────────────────────────────────────────────────────

class TestSearchStationsDB:
    """Tests for ``search_stations_db``."""

    @pytest.mark.asyncio
    async def test_returns_formatted_stations(self):
        result = _fake_result(
            {"id": "GM1", "name": "Munich", "lat": 48.14, "lon": 11.58, "distance_km": 1.234},
            {"id": "GM2", "name": "Augsburg", "lat": 48.37, "lon": 10.90, "distance_km": 55.678},
        )
        session = _session(result)

        stations = await search_stations_db(session, 48.14, 11.58, 50, 10)

        assert len(stations) == 2
        assert stations[0]["id"] == "GM1"
        assert stations[0]["distanceKm"] == 1.2  # rounded to 1 decimal
        assert stations[1]["distanceKm"] == 55.7

    @pytest.mark.asyncio
    async def test_passes_radius_in_metres(self):
        result = _fake_result()
        session = _session(result)

        await search_stations_db(session, 48.0, 11.0, 25, 5)

        # Check the params dict passed to execute
        call_args = session.execute.call_args
        params = call_args[0][1]  # second positional arg = params dict
        assert params["radius_m"] == 25000.0

    @pytest.mark.asyncio
    async def test_without_date_filters(self):
        result = _fake_result()
        session = _session(result)

        await search_stations_db(session, 48.0, 11.0, 50, 10)

        call_args = session.execute.call_args
        params = call_args[0][1]
        assert "from_date" not in params
        assert "to_date" not in params

    @pytest.mark.asyncio
    async def test_with_date_filters(self):
        result = _fake_result()
        session = _session(result)

        await search_stations_db(
            session, 48.0, 11.0, 50, 10,
            from_date="2020-01-01", to_date="2024-12-31",
        )

        call_args = session.execute.call_args
        params = call_args[0][1]
        assert params["from_date"] == date(2020, 1, 1)
        assert params["to_date"] == date(2024, 12, 31)

    @pytest.mark.asyncio
    async def test_with_only_from_date(self):
        result = _fake_result()
        session = _session(result)

        await search_stations_db(
            session, 48.0, 11.0, 50, 10,
            from_date="2020-01-01",
        )

        params = session.execute.call_args[0][1]
        assert params["from_date"] == date(2020, 1, 1)
        assert "to_date" not in params

    @pytest.mark.asyncio
    async def test_empty_result(self):
        result = _fake_result()
        session = _session(result)

        stations = await search_stations_db(session, 0.0, 0.0, 1, 10)
        assert stations == []

    @pytest.mark.asyncio
    async def test_limit_is_passed(self):
        result = _fake_result()
        session = _session(result)

        await search_stations_db(session, 48.0, 11.0, 50, 7)

        params = session.execute.call_args[0][1]
        assert params["lim"] == 7

    @pytest.mark.asyncio
    async def test_output_schema(self):
        """Verify each returned dict has the expected keys."""
        result = _fake_result(
            {"id": "X1", "name": "Test", "lat": 10.0, "lon": 20.0, "distance_km": 5.0},
        )
        session = _session(result)

        stations = await search_stations_db(session, 10.0, 20.0, 50, 1)
        expected_keys = {"id", "name", "lat", "lon", "distanceKm"}
        assert set(stations[0].keys()) == expected_keys
