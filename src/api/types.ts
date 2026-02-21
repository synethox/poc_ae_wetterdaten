export type TempLevel = "day" | "month";

// Aggregationsniveau der Temperaturdaten.
// die dann im API-Client auf dieses Modell gemappt werden.
export type AggregationLevel = "day" | "year";

export interface TemperaturePoint {
  date: string; // day: YYYY-MM-DD | month: YYYY-MM
  level: TempLevel;
  tmin: number;
  tavg: number;
  tmax: number;
}
export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
}

export interface StationSearchParams {
  lat: number;
  lon: number;
  radiusKm: number;
  limit: number;
  from?: string;
  to?: string;
}

export interface TemperatureQuery {
  stationId: string;
  from: string;
  to: string;
}
