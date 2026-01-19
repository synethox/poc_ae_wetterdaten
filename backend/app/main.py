######################################################################################
#
# This code should handle the management and core of our application This consists of:
# 1) Orchestrating Startup routine 
# 2) Controling and supervising sub-programms during runtime
#
######################################################################################

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import logging

from stations_loader import initialize_stations
from stations_queries import StationsQuery

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="GHCN Temperature Data API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Konfiguration
DATABASE_URL = "postgresql://ghcn_user:ghcn_pass@db:5432/ghcn_db"

# Query-Objekt initialisieren
stations_query = StationsQuery(DATABASE_URL)


# Pydantic Models
class StationSearchRequest(BaseModel):
    latitude: float
    longitude: float
    radius_km: float = 100
    max_results: int = 10
    start_year: int = 1950
    end_year: int = 2025


class StationResponse(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    distance_km: float


# Startup: Stationen laden
@app.on_event("startup")
async def startup_event():
    """Lädt Stationsdaten beim ersten Start"""
    try:
        logger.info("Initialisiere Stationsdaten...")
        initialize_stations(DATABASE_URL)
        logger.info("✓ Stationsdaten bereit")
    except Exception as e:
        logger.error(f"Fehler beim Laden der Stationen: {e}")
        # App startet trotzdem, falls Daten schon vorhanden


# API Endpoints
@app.post("/api/stations/search", response_model=List[StationResponse])
async def search_stations(search: StationSearchRequest):
    """Suche Stationen im Umkreis"""
    
    try:
        stations = stations_query.find_stations_in_radius(
            latitude=search.latitude,
            longitude=search.longitude,
            radius_km=search.radius_km,
            max_results=search.max_results
        )
        
        if not stations:
            raise HTTPException(
                status_code=404,
                detail="Keine Stationen im angegebenen Umkreis gefunden"
            )
        
        return stations
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fehler bei Stationssuche: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler")


@app.get("/api/stations/{station_id}")
async def get_station(station_id: str):
    """Hole Details zu einer Station"""
    
    station = stations_query.get_station_by_id(station_id)
    
    if not station:
        raise HTTPException(status_code=404, detail="Station nicht gefunden")
    
    return station