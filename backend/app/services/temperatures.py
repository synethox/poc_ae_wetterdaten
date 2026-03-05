from __future__ import annotations

import asyncio
import logging
from datetime import date as dt_date

import pandas as pd
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.services.ghcn import download_daily_csv

logger = logging.getLogger(__name__)

_INSERT_BATCH = 5000


async def _ensure_daily_data(session: AsyncSession, station_id: str) -> bool:
    row = await session.execute(
        text("SELECT 1 FROM daily_temperatures WHERE station_id = :sid LIMIT 1"),
        {"sid": station_id},
    )
    if row.first() is not None:
        return True

    logger.info("Downloading GHCN daily data for %s …", station_id)
    df = await download_daily_csv(station_id)
    if df is None or df.empty:
        return False

    df = df.copy()

    for col in ("tmin", "tmax", "tavg"):
        if col not in df.columns:
            df[col] = float("nan")
        else:
            df[col] = df[col].round(1)

    df.dropna(subset=["tmin", "tmax"], how="all", inplace=True)
    if df.empty:
        return False

    records = [
        {
            "sid": station_id,
            "dt": row.date.date() if hasattr(row.date, "date") else row.date,
            "tmin": None if pd.isna(row.tmin) else float(row.tmin),
            "tmax": None if pd.isna(row.tmax) else float(row.tmax),
            "tavg": None if pd.isna(row.tavg) else float(row.tavg),
        }
        for row in df.itertuples(index=False)
    ]

    stmt = text(
        """
        INSERT INTO daily_temperatures (station_id, date, tmin, tavg, tmax)
        VALUES (:sid, :dt, :tmin, :tavg, :tmax)
        ON CONFLICT (station_id, date) DO NOTHING
        """
    )

    for i in range(0, len(records), _INSERT_BATCH):
        await session.execute(stmt, records[i : i + _INSERT_BATCH])

    await session.commit()
    logger.info("Stored %d daily records for %s.", len(records), station_id)
    return True


async def get_temperatures(
    session: AsyncSession,
    station_id: str,
    from_date: str,
    to_date: str,
) -> list[dict]:
    has_data = await _ensure_daily_data(session, station_id)
    if not has_data:
        return []

    result = await session.execute(
        text(
            """
            SELECT
                to_char(date_trunc('month', date), 'YYYY-MM') AS month,
                ROUND(AVG(tmin)::numeric, 1)                  AS tmin,
                ROUND(AVG(tmax)::numeric, 1)                  AS tmax,
                ROUND(AVG(
                    COALESCE(tavg, (tmin + tmax) / 2.0)
                )::numeric, 1)                                AS tavg
            FROM daily_temperatures
            WHERE station_id = :sid
              AND date >= :from_date
              AND date <= :to_date
            GROUP BY date_trunc('month', date)
            HAVING COUNT(tmin) > 0 OR COUNT(tmax) > 0 OR COUNT(tavg) > 0
            ORDER BY month
            """
        ),
        {
            "sid": station_id,
            "from_date": dt_date.fromisoformat(from_date),
            "to_date": dt_date.fromisoformat(to_date),
        },
    )

    return [
        {
            "date": row.month,
            "level": "month",
            "tmin": float(row.tmin) if row.tmin is not None else None,
            "tavg": float(row.tavg) if row.tavg is not None else None,
            "tmax": float(row.tmax) if row.tmax is not None else None,
        }
        for row in result
    ]


_inflight: set[str] = set()
_inflight_lock = asyncio.Lock()


async def ensure_station_cached(station_id: str) -> None:
    async with _inflight_lock:
        if station_id in _inflight:
            return
        _inflight.add(station_id)
    try:
        async with async_session() as session:
            await _ensure_daily_data(session, station_id)
    finally:
        async with _inflight_lock:
            _inflight.discard(station_id)
