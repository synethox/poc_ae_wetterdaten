"""Unit tests for application configuration."""

from __future__ import annotations

import os
from unittest.mock import patch


class TestConfig:
    """Tests for config.py environment variable handling."""

    def test_default_database_url(self):
        with patch.dict(os.environ, {}, clear=True):
            # Re-import to pick up env
            import importlib
            import app.config as cfg
            importlib.reload(cfg)
            assert "postgresql+asyncpg" in cfg.DATABASE_URL
            assert "wetter" in cfg.DATABASE_URL

    def test_custom_database_url(self):
        custom = "postgresql+asyncpg://user:pass@host:5432/mydb"
        with patch.dict(os.environ, {"DATABASE_URL": custom}):
            import importlib
            import app.config as cfg
            importlib.reload(cfg)
            assert cfg.DATABASE_URL == custom

    def test_default_redis_url(self):
        with patch.dict(os.environ, {}, clear=True):
            import importlib
            import app.config as cfg
            importlib.reload(cfg)
            assert "redis://" in cfg.REDIS_URL

    def test_ghcn_urls_are_set(self):
        from app import config
        assert config.GHCN_STATIONS_URL.startswith("https://")
        assert config.GHCN_INVENTORY_URL.startswith("https://")
        assert config.GHCN_DAILY_CSV_BASE.startswith("https://")
