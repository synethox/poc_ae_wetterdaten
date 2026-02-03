export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
}

// Aggregationsniveau der Temperaturdaten.
// die dann im API-Client auf dieses Modell gemappt werden.
export type AggregationLevel = "day" | "year";

export interface TemperaturePoint {
  /**
   * Beschriftung für die X-Achse.
   * Aktuell: ISO-Datum (YYYY-MM-DD) für Tageswerte.
   * Später: z.B. ein synthetisches Datum wie "1990-01-01" für Jahreswerte.
   */
  date: string;
  /**
   * Optionales Aggregationsniveau ("day", "year", ...).
   * Das Chart/Table kann dieses Feld ignorieren oder später
   * zur Darstellung verwenden.
   */
  level?: AggregationLevel;
  tmin?: number;
  tavg?: number;
  tmax?: number;
}

export interface StationSearchParams {
  lat: number;
  lon: number;
  radiusKm: number;
  limit: number;
}

export interface TemperatureQuery {
  stationId: string;
  from: string;
  to: string;
}
