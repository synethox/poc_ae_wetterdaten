"""Station search – PostGIS spatial query."""

from __future__ import annotations

from datetime import date as dt_date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def search_stations_db(
    session: AsyncSession,
    lat: float,
    lon: float,
    radius_km: float,
    limit: int,
    from_date: str | None = None,
    to_date: str | None = None,
) -> list[dict]:
    """Return the closest stations within *radius_km* of (*lat*, *lon*)."""

    radius_m = radius_km * 1000

    # Build WHERE clauses dynamically to avoid asyncpg parameter-type ambiguity
    where_parts = [
        "ST_DWithin(geom, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography, :radius_m)"
    ]
    params: dict = {
        "lat": lat,
        "lon": lon,
        "radius_m": radius_m,
        "lim": limit,
    }

    if from_date is not None:
        where_parts.append("data_end >= :from_date")
        params["from_date"] = dt_date.fromisoformat(from_date)
    if to_date is not None:
        where_parts.append("data_start <= :to_date")
        params["to_date"] = dt_date.fromisoformat(to_date)

    where_sql = " AND ".join(where_parts)

    query = text(
        f"""
        SELECT
            id, name, lat, lon,
            ST_Distance(
                geom,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
            ) / 1000.0 AS distance_km
        FROM stations
        WHERE {where_sql}
        ORDER BY distance_km
        LIMIT :lim
        """
    )

    result = await session.execute(query, params)

    return [
        {
            "id": row.id,
            "name": row.name,
            "lat": row.lat,
            "lon": row.lon,
            "distanceKm": round(row.distance_km, 1),
        }
        for row in result
    ]
