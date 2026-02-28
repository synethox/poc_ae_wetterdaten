"""SQLAlchemy ORM models – PostGIS geography for spatial queries."""

from sqlalchemy import Column, String, Float, Date
from sqlalchemy.orm import DeclarativeBase
from geoalchemy2 import Geography


class Base(DeclarativeBase):
    pass


class Station(Base):
    """GHCN weather station with PostGIS geography point."""

    __tablename__ = "stations"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    elevation = Column(Float)
    geom = Column(
        Geography(geometry_type="POINT", srid=4326),
        nullable=False,
    )
    data_start = Column(Date)  # earliest temperature data available
    data_end = Column(Date)    # latest temperature data available


class DailyTemperature(Base):
    """Cached daily temperature record downloaded from GHCN."""

    __tablename__ = "daily_temperatures"

    station_id = Column(String, primary_key=True)
    date = Column(Date, primary_key=True)
    tmin = Column(Float)
    tavg = Column(Float)
    tmax = Column(Float)
