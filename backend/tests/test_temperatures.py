"""Unit tests for temperature retrieval and aggregation.

Database and GHCN download interactions are fully mocked.
"""

from __future__ import annotations

from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pandas as pd
import pytest

from app.services.temperatures import get_temperatures, _ensure_daily_data


# ── Helpers ───────────────────────────────────────────────────────────────

def _fake_scalar(value):
    """Mock session.execute() returning a single row result."""
    row_mock = MagicMock()
    row_mock.first.return_value = value
    return row_mock


def _fake_month_rows(*rows):
    """Mock result for the monthly aggregation query."""
    ns_rows = [SimpleNamespace(**r) for r in rows]
    mock_result = MagicMock()
    mock_result.__iter__ = lambda self: iter(ns_rows)
    return mock_result


# ── _ensure_daily_data ────────────────────────────────────────────────────

class TestEnsureDailyData:
    """Tests for ``_ensure_daily_data``."""

    @pytest.mark.asyncio
    async def test_returns_true_if_data_already_cached(self):
        """If records exist in DB, skip download and return True."""
        session = AsyncMock()
        session.execute = AsyncMock(return_value=_fake_scalar(("exists",)))

        result = await _ensure_daily_data(session, "GM000004199")
        assert result is True
        # download_daily_csv should NOT be called
        session.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_downloads_and_stores_when_not_cached(self):
        """If no records, download CSV and insert into DB."""
        session = AsyncMock()
        # First call: check cache → empty; Subsequent calls: inserts
        session.execute = AsyncMock(side_effect=[
            _fake_scalar(None),  # no cached data
            MagicMock(),         # INSERT batches
        ])

        df = pd.DataFrame({
            "date": pd.to_datetime(["2023-01-01", "2023-01-02"]),
            "tmin": [1.0, 2.0],
            "tmax": [5.0, 6.0],
            "tavg": [3.0, 4.0],
        })

        with patch("app.services.temperatures.download_daily_csv", new_callable=AsyncMock) as mock_dl:
            mock_dl.return_value = df
            result = await _ensure_daily_data(session, "GM000004199")

        assert result is True
        session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_returns_false_when_csv_empty(self):
        session = AsyncMock()
        session.execute = AsyncMock(return_value=_fake_scalar(None))

        with patch("app.services.temperatures.download_daily_csv", new_callable=AsyncMock) as mock_dl:
            mock_dl.return_value = pd.DataFrame()
            result = await _ensure_daily_data(session, "EMPTY_STATION")

        assert result is False

    @pytest.mark.asyncio
    async def test_returns_false_when_csv_is_none(self):
        session = AsyncMock()
        session.execute = AsyncMock(return_value=_fake_scalar(None))

        with patch("app.services.temperatures.download_daily_csv", new_callable=AsyncMock) as mock_dl:
            mock_dl.return_value = None
            result = await _ensure_daily_data(session, "NO_CSV")

        assert result is False

    @pytest.mark.asyncio
    async def test_fills_missing_columns_with_nan(self):
        """When CSV has no tavg column, _ensure_daily_data should add it as NaN."""
        session = AsyncMock()
        session.execute = AsyncMock(side_effect=[
            _fake_scalar(None),  # no cached data
            MagicMock(),         # INSERT
        ])

        # DataFrame without 'tavg' column
        df = pd.DataFrame({
            "date": pd.to_datetime(["2023-01-01"]),
            "tmin": [1.0],
            "tmax": [5.0],
        })

        with patch("app.services.temperatures.download_daily_csv", new_callable=AsyncMock) as mock_dl:
            mock_dl.return_value = df
            result = await _ensure_daily_data(session, "NO_TAVG")

        assert result is True
        session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_returns_false_when_all_temps_null_after_dropna(self):
        """Rows where both tmin and tmax are NaN should be dropped; empty result → False."""
        session = AsyncMock()
        session.execute = AsyncMock(return_value=_fake_scalar(None))

        # Both tmin and tmax are NaN → all rows dropped
        df = pd.DataFrame({
            "date": pd.to_datetime(["2023-01-01", "2023-01-02"]),
            "tmin": [float("nan"), float("nan")],
            "tmax": [float("nan"), float("nan")],
            "tavg": [3.0, 4.0],
        })

        with patch("app.services.temperatures.download_daily_csv", new_callable=AsyncMock) as mock_dl:
            mock_dl.return_value = df
            result = await _ensure_daily_data(session, "ALL_NAN")

        assert result is False


# ── get_temperatures ──────────────────────────────────────────────────────

class TestGetTemperatures:
    """Tests for ``get_temperatures``."""

    @pytest.mark.asyncio
    async def test_returns_monthly_data(self):
        monthly_rows = _fake_month_rows(
            {"month": "2023-01", "tmin": 0.5, "tavg": 3.0, "tmax": 5.5},
            {"month": "2023-02", "tmin": 1.0, "tavg": 4.0, "tmax": 7.0},
        )

        session = AsyncMock()
        # _ensure_daily_data check → data exists; aggregation query → rows
        session.execute = AsyncMock(side_effect=[
            _fake_scalar(("exists",)),  # data cached
            monthly_rows,
        ])

        result = await get_temperatures(session, "GM1", "2023-01-01", "2023-12-31")

        assert len(result) == 2
        assert result[0]["date"] == "2023-01"
        assert result[0]["level"] == "month"
        assert result[0]["tmin"] == 0.5
        assert result[0]["tavg"] == 3.0
        assert result[0]["tmax"] == 5.5

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_data(self):
        session = AsyncMock()
        session.execute = AsyncMock(return_value=_fake_scalar(None))

        with patch("app.services.temperatures.download_daily_csv", new_callable=AsyncMock) as mock_dl:
            mock_dl.return_value = None
            result = await get_temperatures(session, "NO_DATA", "2023-01-01", "2023-12-31")

        assert result == []

    @pytest.mark.asyncio
    async def test_handles_none_values_in_results(self):
        """tmin/tavg/tmax can be None from the DB – should default to 0.0."""
        monthly_rows = _fake_month_rows(
            {"month": "2023-06", "tmin": None, "tavg": None, "tmax": None},
        )

        session = AsyncMock()
        session.execute = AsyncMock(side_effect=[
            _fake_scalar(("exists",)),
            monthly_rows,
        ])

        result = await get_temperatures(session, "GM1", "2023-01-01", "2023-12-31")

        assert result[0]["tmin"] == 0.0
        assert result[0]["tavg"] == 0.0
        assert result[0]["tmax"] == 0.0

    @pytest.mark.asyncio
    async def test_output_schema_keys(self):
        """Each result dict must have the keys the frontend expects."""
        monthly_rows = _fake_month_rows(
            {"month": "2023-03", "tmin": 2.0, "tavg": 5.0, "tmax": 8.0},
        )
        session = AsyncMock()
        session.execute = AsyncMock(side_effect=[
            _fake_scalar(("exists",)),
            monthly_rows,
        ])

        result = await get_temperatures(session, "GM1", "2023-01-01", "2023-12-31")
        expected_keys = {"date", "level", "tmin", "tavg", "tmax"}
        assert set(result[0].keys()) == expected_keys
