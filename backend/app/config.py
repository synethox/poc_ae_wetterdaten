"""Application configuration via environment variables."""

import os

DATABASE_URL: str = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@db:5432/wetter",
)

REDIS_URL: str = os.environ.get("REDIS_URL", "redis://redis:6379/0")

# GHCN remote data sources
GHCN_STATIONS_URL = (
    "https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt"
)
GHCN_INVENTORY_URL = (
    "https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-inventory.txt"
)
GHCN_DAILY_CSV_BASE = (
    "https://www.ncei.noaa.gov/data/global-historical-climatology-network-daily/access"
)
