"""Integration tests for the FastAPI REST endpoints.

Uses ``httpx.AsyncClient`` with ASGI transport — no real server needed.
Database and cache calls are mocked.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


# ── /api/health ───────────────────────────────────────────────────────────

class TestHealthEndpoint:

    @pytest.mark.asyncio
    async def test_health_returns_ok(self, client):
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


# ── /api/stations ─────────────────────────────────────────────────────────

class TestStationsEndpoint:

    MOCK_STATIONS = [
        {"id": "GM1", "name": "Munich", "lat": 48.14, "lon": 11.58, "distanceKm": 2.3},
        {"id": "GM2", "name": "Augsburg", "lat": 48.37, "lon": 10.90, "distanceKm": 50.1},
    ]

    @pytest.mark.asyncio
    async def test_returns_stations(self, client):
        with (
            patch("app.main.cache.cache_get", new_callable=AsyncMock, return_value=None),
            patch("app.main.cache.cache_set", new_callable=AsyncMock),
            patch("app.main.search_stations_db", new_callable=AsyncMock, return_value=self.MOCK_STATIONS),
            patch("app.main.async_session") as mock_session_factory,
        ):
            mock_session = AsyncMock()
            mock_session_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session_factory.return_value.__aexit__ = AsyncMock(return_value=False)

            resp = await client.get("/api/stations", params={
                "lat": 48.14, "lon": 11.58, "radius_km": 50, "limit": 10,
                "from": "2020-01-01", "to": "2025-01-01",
            })

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["id"] == "GM1"

    @pytest.mark.asyncio
    async def test_returns_cached_result(self, client):
        with patch("app.main.cache.cache_get", new_callable=AsyncMock, return_value=self.MOCK_STATIONS):
            resp = await client.get("/api/stations", params={
                "lat": 48.14, "lon": 11.58,
            })

        assert resp.status_code == 200
        assert resp.json() == self.MOCK_STATIONS

    @pytest.mark.asyncio
    async def test_requires_lat_lon(self, client):
        with patch("app.main.cache.cache_get", new_callable=AsyncMock, return_value=None):
            resp = await client.get("/api/stations")
        assert resp.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_validates_radius_range(self, client):
        with patch("app.main.cache.cache_get", new_callable=AsyncMock, return_value=None):
            resp = await client.get("/api/stations", params={
                "lat": 48.0, "lon": 11.0, "radius_km": 200,  # max 100
            })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_validates_limit_range(self, client):
        with patch("app.main.cache.cache_get", new_callable=AsyncMock, return_value=None):
            resp = await client.get("/api/stations", params={
                "lat": 48.0, "lon": 11.0, "limit": 0,  # min 1
            })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_default_radius_and_limit(self, client):
        with (
            patch("app.main.cache.cache_get", new_callable=AsyncMock, return_value=None),
            patch("app.main.cache.cache_set", new_callable=AsyncMock),
            patch("app.main.search_stations_db", new_callable=AsyncMock, return_value=[]) as mock_search,
            patch("app.main.async_session") as mock_session_factory,
        ):
            mock_session = AsyncMock()
            mock_session_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_session_factory.return_value.__aexit__ = AsyncMock(return_value=False)

            resp = await client.get("/api/stations", params={"lat": 48.0, "lon": 11.0})

        assert resp.status_code == 200
        # Verify defaults: search_stations_db(session, lat, lon, radius_km, limit, ...)
        call_args = mock_search.call_args
        args = call_args[0]  # positional args
        # args[0]=session, args[1]=lat, args[2]=lon, args[3]=radius_km, args[4]=limit
        assert args[1] == 48.0   # lat
        assert args[2] == 11.0   # lon
        assert args[3] == 50     # default radius_km
        assert args[4] == 10     # default limit


# ── /api/temperatures ─────────────────────────────────────────────────────

class TestTemperaturesEndpoint:

    MOCK_TEMPS = [
        {"date": "2023-01", "level": "month", "tmin": 0.5, "tavg": 3.0, "tmax": 5.5},
        {"date": "2023-02", "level": "month", "tmin": 1.0, "tavg": 4.0, "tmax": 7.0},
    ]

    @pytest.mark.asyncio
    async def test_returns_temperatures(self, client):
        with (
            patch("app.main.cache.cache_get", new_callable=AsyncMock, return_value=None),
            patch("app.main.cache.cache_set", new_callable=AsyncMock),
            patch("app.main.get_temperatures", new_callable=AsyncMock, return_value=self.MOCK_TEMPS),
            patch("app.main.async_session") as mock_sf,
        ):
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=AsyncMock())
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)

            resp = await client.get("/api/temperatures", params={
                "station_id": "GM1", "from": "2023-01-01", "to": "2023-12-31",
            })

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["date"] == "2023-01"
        assert data[0]["tmin"] == 0.5

    @pytest.mark.asyncio
    async def test_returns_cached_temperatures(self, client):
        with patch("app.main.cache.cache_get", new_callable=AsyncMock, return_value=self.MOCK_TEMPS):
            resp = await client.get("/api/temperatures", params={
                "station_id": "GM1", "from": "2023-01-01", "to": "2023-12-31",
            })

        assert resp.status_code == 200
        assert resp.json() == self.MOCK_TEMPS

    @pytest.mark.asyncio
    async def test_requires_station_id(self, client):
        with patch("app.main.cache.cache_get", new_callable=AsyncMock, return_value=None):
            resp = await client.get("/api/temperatures", params={
                "from": "2023-01-01", "to": "2023-12-31",
            })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_requires_date_range(self, client):
        with patch("app.main.cache.cache_get", new_callable=AsyncMock, return_value=None):
            resp = await client.get("/api/temperatures", params={
                "station_id": "GM1",
            })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_empty_result(self, client):
        with (
            patch("app.main.cache.cache_get", new_callable=AsyncMock, return_value=None),
            patch("app.main.cache.cache_set", new_callable=AsyncMock),
            patch("app.main.get_temperatures", new_callable=AsyncMock, return_value=[]),
            patch("app.main.async_session") as mock_sf,
        ):
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=AsyncMock())
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)

            resp = await client.get("/api/temperatures", params={
                "station_id": "EMPTY", "from": "2023-01-01", "to": "2023-12-31",
            })

        assert resp.status_code == 200
        assert resp.json() == []
