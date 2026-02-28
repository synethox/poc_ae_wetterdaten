"""Unit tests for Pydantic schemas."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas import StationOut, TemperaturePointOut


class TestStationOut:
    """Tests for ``StationOut`` response model."""

    def test_valid_station(self):
        s = StationOut(id="GM1", name="Munich", lat=48.14, lon=11.58, distanceKm=2.3)
        assert s.id == "GM1"
        assert s.distanceKm == 2.3

    def test_serialisation(self):
        s = StationOut(id="GM1", name="Munich", lat=48.14, lon=11.58, distanceKm=2.3)
        d = s.model_dump()
        assert set(d.keys()) == {"id", "name", "lat", "lon", "distanceKm"}

    def test_missing_required_field(self):
        with pytest.raises(ValidationError):
            StationOut(id="GM1", name="Munich", lat=48.14)  # missing lon, distanceKm


class TestTemperaturePointOut:
    """Tests for ``TemperaturePointOut`` response model."""

    def test_valid_temperature(self):
        t = TemperaturePointOut(date="2023-01", level="month", tmin=0.5, tavg=3.0, tmax=5.5)
        assert t.date == "2023-01"
        assert t.level == "month"

    def test_serialisation(self):
        t = TemperaturePointOut(date="2023-01", level="month", tmin=0.5, tavg=3.0, tmax=5.5)
        d = t.model_dump()
        assert set(d.keys()) == {"date", "level", "tmin", "tavg", "tmax"}

    def test_missing_required_field(self):
        with pytest.raises(ValidationError):
            TemperaturePointOut(date="2023-01", level="month")  # missing temps
