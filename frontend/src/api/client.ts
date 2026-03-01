import type {
  Station,
  StationSearchParams,
  TemperaturePoint,
  TemperatureQuery,
} from "./types";

function qs(params: Record<string, any>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  return sp.toString();
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} fehlgeschlagen: ${res.status}`);
  return res.json();
}


export function searchStations(p: StationSearchParams) {
  const query = qs({
    lat: p.lat,
    lon: p.lon,
    radius_km: p.radiusKm, 
    limit: p.limit,
    from: p.from,
    to: p.to,
  });

  return getJson<Station[]>(`/api/stations?${query}`);
}


export function fetchTemperatures(q: TemperatureQuery) {
  const query = qs({
    station_id: q.stationId, 
    from: q.from,
    to: q.to,
  });

  return getJson<TemperaturePoint[]>(`/api/temperatures?${query}`);
  async function getJson<T>(url: string): Promise<T> {
  const t0 = performance.now();
  const res = await fetch(url);
  const ms = Math.round(performance.now() - t0);

  console.log(`[API] ${res.status} ${url} (${ms} ms)`);

  if (!res.ok) throw new Error(`${url} fehlgeschlagen: ${res.status}`);
  return res.json();
}
}
