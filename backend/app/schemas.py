"""Pydantic response schemas for the REST API."""

from pydantic import BaseModel


class StationOut(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    distanceKm: float


class TemperaturePointOut(BaseModel):
    date: str
    level: str
    tmin: float
    tavg: float
    tmax: float
