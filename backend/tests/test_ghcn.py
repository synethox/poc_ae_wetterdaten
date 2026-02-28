"""Unit tests for GHCN data parsing and helpers.

These tests run **without** a database or network – all external I/O is mocked.
"""

from __future__ import annotations

import textwrap
from datetime import date
from unittest.mock import AsyncMock, patch, MagicMock

import pandas as pd
import pytest

from app.services.ghcn import (
    _parse_stations_file,
    _parse_inventory_file,
    _download_text,
    download_daily_csv,
    load_stations_if_empty,
)


# ── Station metadata parsing ─────────────────────────────────────────────

class TestParseStationsFile:
    """Tests for ``_parse_stations_file``.

    Lines must be at least 71 characters wide to mimic the real GHCN
    fixed-width format (the parser skips shorter lines).
    """

    # Each line padded to ≥71 chars via trailing spaces
    SAMPLE = (
        "ACW00011604  17.1167  -61.7833   10.1    ST JOHNS COOLIDGE FLD         \n"
        "AE000041196  25.3330   55.5170   34.0    SHARJAH INTER. AIRP           \n"
        "AEM00041194  25.2550   55.3640   10.4    DUBAI INTL                    \n"
    )

    def test_parses_valid_lines(self):
        result = _parse_stations_file(self.SAMPLE)
        assert len(result) == 3
        assert "ACW00011604" in result
        assert "AEM00041194" in result

    def test_extracts_coordinates(self):
        result = _parse_stations_file(self.SAMPLE)
        station = result["ACW00011604"]
        assert station["lat"] == pytest.approx(17.1167, abs=0.001)
        assert station["lon"] == pytest.approx(-61.7833, abs=0.001)

    def test_extracts_name(self):
        result = _parse_stations_file(self.SAMPLE)
        assert result["AE000041196"]["name"] == "SHARJAH INTER. AIRP"

    def test_extracts_elevation(self):
        result = _parse_stations_file(self.SAMPLE)
        assert result["ACW00011604"]["elevation"] == pytest.approx(10.1)

    def test_skips_short_lines(self):
        result = _parse_stations_file("too short\n")
        assert result == {}

    def test_skips_lines_with_bad_coordinates(self):
        # Line must be ≥71 chars to pass the length check
        bad_line = "ACW00011604  BADCOORD  -61.7833   10.1    ST JOHNS COOLIDGE FLD         "
        result = _parse_stations_file(bad_line)
        assert result == {}

    def test_uses_station_id_when_name_blank(self):
        # Name field (cols 41-71) is blank → parser should fall back to station ID
        line = "ACW00011604  17.1167  -61.7833   10.1                                  "
        result = _parse_stations_file(line)
        assert result["ACW00011604"]["name"] == "ACW00011604"

    def test_handles_missing_elevation(self):
        line = "ACW00011604  17.1167  -61.7833 -999.9    ST JOHNS COOLIDGE FLD         "
        result = _parse_stations_file(line)
        assert result["ACW00011604"]["elevation"] is None

    def test_empty_input(self):
        assert _parse_stations_file("") == {}


# ── Inventory parsing ─────────────────────────────────────────────────────

class TestParseInventoryFile:
    """Tests for ``_parse_inventory_file``."""

    SAMPLE = textwrap.dedent("""\
        ACW00011604 17.1167 -61.7833 TMIN 1949 1949
        ACW00011604 17.1167 -61.7833 TMAX 1949 1949
        ACW00011604 17.1167 -61.7833 PRCP 1949 1949
        AE000041196 25.3330  55.5170 TMIN 1944 2024
        AE000041196 25.3330  55.5170 TMAX 1944 2024
    """)

    def test_parses_tmin_tmax_only(self):
        result = _parse_inventory_file(self.SAMPLE)
        # PRCP should be ignored
        assert len(result) == 2

    def test_merges_date_ranges(self):
        multi = textwrap.dedent("""\
            STA0001 10.0 20.0 TMIN 1980 2000
            STA0001 10.0 20.0 TMAX 1970 2020
        """)
        result = _parse_inventory_file(multi)
        assert result["STA0001"]["start"] == 1970
        assert result["STA0001"]["end"] == 2020

    def test_extracts_years(self):
        result = _parse_inventory_file(self.SAMPLE)
        assert result["AE000041196"]["start"] == 1944
        assert result["AE000041196"]["end"] == 2024

    def test_skips_short_lines(self):
        result = _parse_inventory_file("short\n")
        assert result == {}

    def test_empty_input(self):
        assert _parse_inventory_file("") == {}

    def test_skips_non_temperature_elements(self):
        line = "STA0001 10.0 20.0 PRCP 1980 2020\n"
        result = _parse_inventory_file(line)
        assert result == {}

    def test_skips_lines_with_bad_years(self):
        """Lines with non-integer years should be skipped (ValueError branch)."""
        line = "STA0001 10.0 20.0 TMIN XXXX 2020\n"
        result = _parse_inventory_file(line)
        assert result == {}


# ── CSV download / parsing ────────────────────────────────────────────────

class TestDownloadDailyCSV:
    """Tests for ``download_daily_csv`` with mocked HTTP."""

    CSV_CONTENT = textwrap.dedent("""\
        STATION,DATE,TMIN,TMAX,TAVG,PRCP
        GM000004199,2023-01-01,10,50,30,0
        GM000004199,2023-01-02,15,55,,5
        GM000004199,2023-01-03,,,25,10
    """)

    @pytest.mark.asyncio
    async def test_parses_csv_correctly(self):
        with patch("app.services.ghcn._download_text", new_callable=AsyncMock) as mock_dl:
            mock_dl.return_value = self.CSV_CONTENT
            df = await download_daily_csv("GM000004199")

        assert df is not None
        assert len(df) == 3
        # Values should be divided by 10 (tenths of °C)
        assert df.iloc[0]["tmin"] == pytest.approx(1.0)
        assert df.iloc[0]["tmax"] == pytest.approx(5.0)
        assert df.iloc[0]["tavg"] == pytest.approx(3.0)

    @pytest.mark.asyncio
    async def test_handles_missing_values(self):
        with patch("app.services.ghcn._download_text", new_callable=AsyncMock) as mock_dl:
            mock_dl.return_value = self.CSV_CONTENT
            df = await download_daily_csv("GM000004199")

        # Row 2 has no TAVG
        assert pd.isna(df.iloc[1]["tavg"])
        # Row 3 has no TMIN/TMAX
        assert pd.isna(df.iloc[2]["tmin"])
        assert pd.isna(df.iloc[2]["tmax"])

    @pytest.mark.asyncio
    async def test_returns_none_on_404(self):
        import httpx

        mock_response = MagicMock()
        mock_response.status_code = 404

        with patch(
            "app.services.ghcn._download_text",
            new_callable=AsyncMock,
            side_effect=httpx.HTTPStatusError(
                "Not Found", request=MagicMock(), response=mock_response
            ),
        ):
            result = await download_daily_csv("NONEXISTENT")

        assert result is None

    @pytest.mark.asyncio
    async def test_date_column_is_datetime(self):
        with patch("app.services.ghcn._download_text", new_callable=AsyncMock) as mock_dl:
            mock_dl.return_value = self.CSV_CONTENT
            df = await download_daily_csv("GM000004199")

        assert pd.api.types.is_datetime64_any_dtype(df["date"])

    @pytest.mark.asyncio
    async def test_reraises_non_404_errors(self):
        """Non-404 HTTP errors should propagate up."""
        import httpx

        mock_response = MagicMock()
        mock_response.status_code = 500

        with patch(
            "app.services.ghcn._download_text",
            new_callable=AsyncMock,
            side_effect=httpx.HTTPStatusError(
                "Server Error", request=MagicMock(), response=mock_response
            ),
        ):
            with pytest.raises(httpx.HTTPStatusError):
                await download_daily_csv("ERROR_STATION")

    @pytest.mark.asyncio
    async def test_csv_without_tavg_column(self):
        csv_no_tavg = textwrap.dedent("""\
            STATION,DATE,TMIN,TMAX,PRCP
            GM000004199,2023-01-01,10,50,0
        """)
        with patch("app.services.ghcn._download_text", new_callable=AsyncMock) as mock_dl:
            mock_dl.return_value = csv_no_tavg
            df = await download_daily_csv("GM000004199")

        assert df is not None
        assert "tmin" in df.columns
        assert "tmax" in df.columns
        # tavg should NOT be in columns since it wasn't in the CSV
        assert "tavg" not in df.columns


# ── _download_text ────────────────────────────────────────────────────────

class TestDownloadText:
    """Tests for the HTTP helper ``_download_text``."""

    @pytest.mark.asyncio
    async def test_returns_text_from_url(self):
        """Verify _download_text performs an HTTP GET and returns text."""
        import httpx

        mock_response = MagicMock()
        mock_response.text = "hello world"
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.ghcn.httpx.AsyncClient", return_value=mock_client):
            result = await _download_text("https://example.com/test.txt")

        assert result == "hello world"
        mock_client.get.assert_awaited_once_with("https://example.com/test.txt")
        mock_response.raise_for_status.assert_called_once()

    @pytest.mark.asyncio
    async def test_raises_on_http_error(self):
        """Verify HTTP errors propagate up."""
        import httpx

        mock_response = MagicMock()
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "500", request=MagicMock(), response=mock_response
        )

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.ghcn.httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(httpx.HTTPStatusError):
                await _download_text("https://example.com/bad")


# ── load_stations_if_empty ────────────────────────────────────────────────

class TestLoadStationsIfEmpty:
    """Tests for ``load_stations_if_empty`` with mocked DB / HTTP."""

    STATIONS_RAW = (
        "ACW00011604  17.1167  -61.7833   10.1    ST JOHNS COOLIDGE FLD         \n"
    )
    INVENTORY_RAW = (
        "ACW00011604 17.1167 -61.7833 TMIN 1949 2020\n"
        "ACW00011604 17.1167 -61.7833 TMAX 1949 2020\n"
    )

    @pytest.mark.asyncio
    async def test_skips_import_when_table_populated(self):
        """When stations already exist, download should be skipped entirely."""
        session = AsyncMock()
        scalar_mock = MagicMock()
        scalar_mock.scalar.return_value = 42  # non-zero count
        session.execute = AsyncMock(return_value=scalar_mock)

        with patch("app.services.ghcn._download_text", new_callable=AsyncMock) as mock_dl:
            await load_stations_if_empty(session)
            mock_dl.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_downloads_and_inserts_stations(self):
        """When table is empty, stations are downloaded, parsed, and inserted."""
        session = AsyncMock()
        scalar_mock = MagicMock()
        scalar_mock.scalar.return_value = 0  # empty table
        session.execute = AsyncMock(return_value=scalar_mock)

        with patch("app.services.ghcn._download_text", new_callable=AsyncMock) as mock_dl:
            mock_dl.side_effect = [self.STATIONS_RAW, self.INVENTORY_RAW]
            await load_stations_if_empty(session)

        # Should have called execute multiple times: count check + INSERT batches
        assert session.execute.await_count >= 2
        session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_handles_download_failure_gracefully(self):
        """If GHCN download fails, the function should log and return without error."""
        session = AsyncMock()
        scalar_mock = MagicMock()
        scalar_mock.scalar.return_value = 0
        session.execute = AsyncMock(return_value=scalar_mock)

        with patch(
            "app.services.ghcn._download_text",
            new_callable=AsyncMock,
            side_effect=ConnectionError("Network unreachable"),
        ):
            # Should NOT raise – graceful degradation
            await load_stations_if_empty(session)

        # commit should NOT be called because import was aborted
        session.commit.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_skips_inventory_stations_without_metadata(self):
        """Stations in inventory but not in stations file should be skipped."""
        session = AsyncMock()
        scalar_mock = MagicMock()
        scalar_mock.scalar.return_value = 0
        session.execute = AsyncMock(return_value=scalar_mock)

        # Inventory has STA0001 but stations file has ACW00011604
        inventory_raw = "STA00000001 10.0 20.0 TMIN 1980 2020\n"

        with patch("app.services.ghcn._download_text", new_callable=AsyncMock) as mock_dl:
            mock_dl.side_effect = [self.STATIONS_RAW, inventory_raw]
            await load_stations_if_empty(session)

        # No matching records, but commit should still be called
        session.commit.assert_awaited_once()
