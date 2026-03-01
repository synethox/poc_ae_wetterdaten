export type Station = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
};

export type TemperaturePoint = {
  date: string; 
  tmin?: number;
  tavg?: number;
  tmax?: number;
};


export type StationSearchParams = {
  lat: number;
  lon: number;
  radiusKm: number;
  limit: number;
  from?: string; 
  to?: string;   
};

export type TemperatureQuery = {
  stationId: string;
  from: string; 
  to: string;   
};