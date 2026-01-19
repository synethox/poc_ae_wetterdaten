######################################################################################
#
# zis is a stations_queries, it queries stations
# provides both
#
######################################################################################

from sqlalchemy import create_engine, text
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class StationsQuery:
    """
    Klasse für effiziente Stationsabfragen
    """
    
    def __init__(self, database_url: str):
        self.engine = create_engine(database_url)
    
    def find_stations_in_radius(
        self,
        latitude: float,
        longitude: float,
        radius_km: float,
        max_results: int = 10,
        start_year: Optional[int] = None,
        end_year: Optional[int] = None
    ) -> List[Dict]:
        """
        Findet Stationen im Umkreis eines Punktes
        
        Args:
            latitude: Breitengrad (-90 bis 90)
            longitude: Längengrad (-180 bis 180)
            radius_km: Suchradius in Kilometern
            max_results: Maximale Anzahl Ergebnisse
            start_year: Frühestes Jahr (optional)
            end_year: Spätestes Jahr (optional)
        
        Returns:
            Liste von Stations-Dictionaries, sortiert nach Distanz
        """
        # PostGIS-Query für geografische Suche
        # ST_DWithin ist SEHR effizient dank GIST-Index
        query = text("""
            SELECT 
                station_id,
                name,
                latitude,
                longitude,
                ROUND(
                    ST_Distance(
                        location,
                        ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                    )::numeric / 1000,
                    2
                ) as distance_km
            FROM stations
            WHERE ST_DWithin(
                location,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                :radius_m
            )
            ORDER BY location <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
            LIMIT :max_results
        """)
        
        with self.engine.connect() as conn:
            result = conn.execute(query, {
                "lat": latitude,
                "lon": longitude,
                "radius_m": radius_km * 1000,  # km -> meter
                "max_results": max_results
            })
            
            stations = []
            for row in result:
                stations.append({
                    "id": row.station_id,
                    "name": row.name,
                    "latitude": float(row.latitude),
                    "longitude": float(row.longitude),
                    "distance_km": float(row.distance_km)
                })
        
        logger.info(f"Gefunden: {len(stations)} Stationen im {radius_km}km Radius")
        return stations
    
    def get_station_by_id(self, station_id: str) -> Optional[Dict]:
        """
        Holt Details zu einer bestimmten Station
        
        Args:
            station_id: Station-ID
        
        Returns:
            Station-Dictionary oder None
        """
        query = text("""
            SELECT station_id, name, latitude, longitude
            FROM stations
            WHERE station_id = :station_id
        """)
        
        with self.engine.connect() as conn:
            result = conn.execute(query, {"station_id": station_id}).fetchone()
            
            if result:
                return {
                    "id": result.station_id,
                    "name": result.name,
                    "latitude": float(result.latitude),
                    "longitude": float(result.longitude)
                }
        
        return None


# Convenience-Funktion
def search_stations(
    database_url: str,
    latitude: float,
    longitude: float,
    radius_km: float = 100,
    max_results: int = 10
) -> List[Dict]:
    """
    Schnellzugriff für Stationssuche
    
    Example:
        stations = search_stations(
            "postgresql://user:pass@localhost:5432/ghcn",
            latitude=48.0,
            longitude=8.5,
            radius_km=100
        )
    """
    query = StationsQuery(database_url)
    return query.find_stations_in_radius(latitude, longitude, radius_km, max_results)