"""GHCN data download, parsing, and ingestion into PostgreSQL."""

from __future__ import annotations

import asyncio
import logging
from datetime import date
from io import StringIO

import httpx
import pandas as pd
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app import config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

async def _download_text(url: str, timeout: float = 180) -> str:
    """Download a URL and return its text content."""
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.text


# ---------------------------------------------------------------------------
# Parsing GHCN fixed-width metadata files
# ---------------------------------------------------------------------------

def _parse_stations_file(raw: str) -> dict[str, dict]:
    """Parse ghcnd-stations.txt → {station_id: {name, lat, lon, elevation}}."""
    stations: dict[str, dict] = {}
    for line in raw.splitlines():
        if len(line) < 71:
            continue
        sid = line[0:11].strip()
        try:
            lat = float(line[12:20])
            lon = float(line[21:30])
        except ValueError:
            continue
        elev_s = line[31:37].strip()
        elev = float(elev_s) if elev_s and elev_s != "-999.9" else None
        name = line[41:71].strip() or sid
        stations[sid] = {
            "id": sid,
            "name": name,
            "lat": lat,
            "lon": lon,
            "elevation": elev,
        }
    return stations


def _parse_inventory_file(raw: str) -> dict[str, dict]:
    """Parse ghcnd-inventory.txt → {station_id: {start, end}} for TMIN/TMAX."""
    inventory: dict[str, dict] = {}
    for line in raw.splitlines():
        parts = line.split()
        if len(parts) < 6:
            continue
        sid, element = parts[0], parts[3]
        if element not in ("TMIN", "TMAX"):
            continue
        try:
            sy, ey = int(parts[4]), int(parts[5])
        except ValueError:
            continue
        if sid not in inventory:
            inventory[sid] = {"start": sy, "end": ey}
        else:
            inventory[sid]["start"] = min(inventory[sid]["start"], sy)
            inventory[sid]["end"] = max(inventory[sid]["end"], ey)
    return inventory


# ---------------------------------------------------------------------------
# Bulk-load stations into the database (runs once on first start)
# ---------------------------------------------------------------------------

_BATCH = 2000


async def load_stations_if_empty(session: AsyncSession) -> None:
    """Download GHCN metadata and populate the *stations* table if empty."""
    row = await session.execute(text("SELECT count(*) FROM stations"))
    if row.scalar():
        logger.info("Stations table already populated – skipping GHCN import.")
        return

    logger.info("Stations table empty – downloading GHCN metadata …")

    try:
        stations_raw, inventory_raw = await asyncio.gather(
            _download_text(config.GHCN_STATIONS_URL),
            _download_text(config.GHCN_INVENTORY_URL),
        )
    except Exception:
        logger.exception(
            "Failed to download GHCN metadata – starting with empty station list."
        )
        return

    stations = _parse_stations_file(stations_raw)
    inventory = _parse_inventory_file(inventory_raw)

    # Only keep stations that have temperature data in the inventory
    records: list[dict] = []
    for sid, inv in inventory.items():
        meta = stations.get(sid)
        if meta is None:
            continue
        records.append(
            {
                "id": sid,
                "name": meta["name"],
                "lat": meta["lat"],
                "lon": meta["lon"],
                "elev": meta["elevation"],
                "data_start": date(inv["start"], 1, 1),
                "data_end": date(inv["end"], 12, 31),
            }
        )

    logger.info("Inserting %d stations …", len(records))

    stmt = text(
        """
        INSERT INTO stations (id, name, lat, lon, elevation, geom, data_start, data_end)
        VALUES (
            :id, :name, :lat, :lon, :elev,
            ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
            :data_start, :data_end
        )
        ON CONFLICT (id) DO NOTHING
        """
    )

    for i in range(0, len(records), _BATCH):
        batch = records[i : i + _BATCH]
        await session.execute(stmt, batch)
        if (i // _BATCH) % 10 == 0:
            logger.info("  … %d / %d", min(i + _BATCH, len(records)), len(records))

    await session.commit()
    logger.info("Station import complete.")


# ---------------------------------------------------------------------------
# Download daily temperature CSV for a single station
# ---------------------------------------------------------------------------

async def download_daily_csv(station_id: str) -> pd.DataFrame | None:
    """Fetch the full GHCN daily CSV for *station_id*, return a tidy DataFrame."""
    url = f"{config.GHCN_DAILY_CSV_BASE}/{station_id}.csv"
    try:
        raw = await _download_text(url, timeout=120)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            logger.warning("No GHCN CSV for station %s (404).", station_id)
            return None
        raise

    df = pd.read_csv(StringIO(raw), low_memory=False)

    keep = ["DATE"]
    rename_map: dict[str, str] = {"DATE": "date"}
    for ghcn_col, our_col in [("TMIN", "tmin"), ("TMAX", "tmax"), ("TAVG", "tavg")]:
        if ghcn_col in df.columns:
            keep.append(ghcn_col)
            rename_map[ghcn_col] = our_col

    df = df[keep].rename(columns=rename_map)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df.dropna(subset=["date"], inplace=True)

    # GHCN daily values are stored in tenths of °C
    for col in ("tmin", "tmax", "tavg"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce") / 10.0

    return df
