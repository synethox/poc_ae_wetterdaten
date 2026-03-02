"""FastAPI application – serves the weather API and the SPA frontend."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI, Query
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app import cache
from app.database import async_session, engine
from app.models import Base
from app.services.ghcn import load_stations_if_empty
from app.services.stations import search_stations_db
from app.services.temperatures import ensure_station_cached, get_temperatures

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_stations_geom "
                "ON stations USING gist (geom)"
            )
        )
    logger.info("Database tables ready.")

    async with async_session() as session:
        await load_stations_if_empty(session)

    yield

    await cache.close()
    await engine.dispose()


app = FastAPI(title="Wetterdaten API", lifespan=lifespan)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/stations")
async def api_search_stations(
    background_tasks: BackgroundTasks,
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    radius_km: float = Query(50, ge=1, le=100),
    limit: int = Query(10, ge=1, le=50),
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
):
    cache_key = f"stations:{lat}:{lon}:{radius_km}:{limit}:{from_date}:{to_date}"
    cached = await cache.cache_get(cache_key)
    if cached is not None:
        for s in cached[: min(10, len(cached))]:
            station_id = s.get("id")
            if station_id:
                background_tasks.add_task(ensure_station_cached, station_id)
        return cached

    async with async_session() as session:
        result = await search_stations_db(
            session, lat, lon, radius_km, limit, from_date, to_date
        )

    for s in result[: min(10, len(result))]:
        station_id = s.get("id")
        if station_id:
            background_tasks.add_task(ensure_station_cached, station_id)

    await cache.cache_set(cache_key, result, ttl=600)
    return result


@app.get("/api/temperatures")
async def api_temperatures(
    station_id: str = Query(..., description="GHCN station ID"),
    from_date: str = Query(..., alias="from", description="Start date YYYY-MM-DD"),
    to_date: str = Query(..., alias="to", description="End date YYYY-MM-DD"),
):
    cache_key = f"temps:{station_id}:{from_date}:{to_date}"
    cached = await cache.cache_get(cache_key)
    if cached is not None:
        return cached

    async with async_session() as session:
        result = await get_temperatures(session, station_id, from_date, to_date)

    await cache.cache_set(cache_key, result, ttl=3600)
    return result


_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static_dir):
    app.mount("/", StaticFiles(directory=_static_dir, html=True), name="frontend")