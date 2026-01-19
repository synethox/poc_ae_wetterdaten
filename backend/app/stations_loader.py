######################################################################################
#
# zis is a stationsloader, it loads stations
#
######################################################################################

import requests
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
import logging
from typing import Optional

# Logging Setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class StationsLoader:
    """
    Lädt GHCN Stationsdaten speichert sie in PostgreSQL
    """
    
    # Datenquellen (primär und fallback)
    PRIMARY_URL = "https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.csv"
    FALLBACK_URL = "https://noaa-ghcn-pds.s3.amazonaws.com/ghcnd-stations.txt"
    
    # Spaltennamen im Zielformat
    COLUMN_NAMES = ['station_id', 'latitude', 'longitude', 'name']
    
    def __init__(self, database_url: str):
        """
        Args:
            database_url: PostgreSQL Connection String 
                         z.B. "postgresql://user:pass@localhost:5432/ghcn"
        """
        self.database_url = database_url
        self.engine = create_engine(database_url)
    
    def download_stations(self) -> pd.DataFrame:
        """
        Lädt Stationsdaten (primär oder fallback)
        
        Returns:
            DataFrame mit den Stationsdaten
        
        Raises:
            Exception: Wenn beide Downloads fehlschlagen
        """
        # Versuch 1: Primäre Quelle (NOAA CSV)
        try:
            logger.info(f"Versuche Download von {self.PRIMARY_URL}...")
            return self._download_from_url(self.PRIMARY_URL, is_csv=True)
        except Exception as e:
            logger.warning(f"Primärer Download fehlgeschlagen: {e}")
            # Versuch 2: Fallback Quelle (AWS TXT)
            try:
                logger.info(f"Versuche Fallback-Download von {self.FALLBACK_URL}...")
                return self._download_from_url(self.FALLBACK_URL, is_csv=False)
            except Exception as e:
                logger.error(f"Fallback-Download fehlgeschlagen: {e}")
                raise Exception("Beide Datenquellen nicht verfügbar")
    
    def _download_from_url(self, url: str, is_csv: bool) -> pd.DataFrame:
        """
        Lädt und parst Daten von einer URL
        
        Args:
            url: Download-URL
            is_csv: True für CSV-Format, False für TXT-Format
        
        Returns:
            Bereinigtes DataFrame
        """
        # Download mit Timeout
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        # Spalten die wir benötigen (0-basiert)
        # 0: Station ID, 1: Latitude, 2: Longitude, 5: Name
        usecols = [0, 1, 2, 5]
        
        if is_csv:
            # CSV-Format parsen
            df = pd.read_csv(
                url,
                usecols=usecols,
                names=['station_id', 'latitude', 'longitude', 'elevation', 
                       'state', 'name', 'gsn_flag', 'hcn_flag', 'wmo_id'],
                header=None,
                dtype={'station_id': str, 'name': str},
                low_memory=False
            )
        else:
            # TXT-Format (Fixed Width Format)
            # Spaltenbreiten laut GHCN Dokumentation:
            # ID: 0-11, LAT: 12-20, LON: 21-30, ELEV: 31-37, 
            # STATE: 38-40, NAME: 41-71
            df = pd.read_fwf(
                url,
                colspecs=[(0, 11), (12, 20), (21, 30), (41, 71)],
                names=['station_id', 'latitude', 'longitude', 'name'],
                dtype={'station_id': str, 'name': str}
            )
        
        # Nur die benötigten Spalten behalten
        df = df[self.COLUMN_NAMES]
        
        # Daten bereinigen
        df = self._clean_data(df)
        
        logger.info(f"{len(df)} Stationen heruntergeladen")
        return df
    
    def _clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Bereinigt die heruntergeladenen Daten
        
        Args:
            df: Rohes DataFrame
        
        Returns:
            Bereinigtes DataFrame
        """
        # Whitespace aus Stationsnamen entfernen
        df['name'] = df['name'].str.strip()
        
        # Duplikate entfernen (falls vorhanden)
        df = df.drop_duplicates(subset=['station_id'])
        
        # Ungültige Koordinaten entfernen
        df = df[
            (df['latitude'].between(-90, 90)) & 
            (df['longitude'].between(-180, 180))
        ]
        
        # Leere Namen entfernen
        df = df[df['name'].notna() & (df['name'] != '')]
        
        logger.info(f"Daten bereinigt: {len(df)} gültige Stationen")
        return df
    
    def save_to_database(self, df: pd.DataFrame) -> None:
        """
        Speichert Stationsdaten in PostgreSQL mit PostGIS-Unterstützung
        
        Args:
            df: DataFrame mit Stationsdaten
        """
        try:
            # Tabelle erstellen/ersetzen
            logger.info("Schreibe Daten in Datenbank...")
            df.to_sql(
                'stations',
                self.engine,
                if_exists='replace',  # Überschreibt alte Daten
                index=False,
                chunksize=5000 
            )
            
            # PostGIS Geography-Spalte hinzufügen
            self._setup_postgis()
            
            logger.info("Daten erfolgreich in Datenbank gespeichert")
            
        except SQLAlchemyError as e:
            logger.error(f"Datenbankfehler: {e}")
            raise
    
    def _setup_postgis(self) -> None:
        """
        Richtet PostGIS Geography-Spalte und Spatial Index ein
        für effiziente geografische Abfragen
        """
        with self.engine.connect() as conn:
            # Geography-Spalte hinzufügen
            conn.execute(text("""
                ALTER TABLE stations 
                ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);
            """))
            
            # Geography-Spalte mit Koordinaten füllen
            conn.execute(text("""
                UPDATE stations 
                SET location = ST_SetSRID(
                    ST_MakePoint(longitude, latitude), 
                    4326
                )::geography
                WHERE location IS NULL;
            """))
            
            # Spatial Index für schnelle geografische Suchen
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_stations_location 
                ON stations USING GIST(location);
            """))
            
            # Zusätzlicher Index für ID-Suchen
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_stations_id 
                ON stations(station_id);
            """))
            
            conn.commit()
            
        logger.info("PostGIS-Indizes erstellt")
    
    def load_all(self) -> None:
        """
        Führt den kompletten Ladeprozess aus:
        Download -> Bereinigung -> Datenbank-Import
        """
        logger.info("Starte Stationsdaten-Import...")
        
        # Download
        df = self.download_stations()
        
        # In Datenbank speichern
        self.save_to_database(df)
        
        logger.info("Import abgeschlossen!")


def initialize_stations(database_url: str) -> None:
    """
    Convenience-Funktion zum Initialisieren der Stationsdaten
    
    Args:
        database_url: PostgreSQL Connection String
    
    Example:
        initialize_stations("postgresql://user:pass@localhost:5432/ghcn")
    """
    loader = StationsLoader(database_url)
    loader.load_all()


# Für direktes Ausführen des Skripts
if __name__ == "__main__":
    # Beispiel-Aufruf
    DATABASE_URL = "postgresql://ghcn_user:ghcn_pass@localhost:5432/ghcn_db"
    initialize_stations(DATABASE_URL)