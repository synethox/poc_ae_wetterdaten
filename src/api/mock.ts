import type { Station, StationSearchParams, TemperaturePoint, TemperatureQuery } from "./types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  const a = new Date(from);
  const b = new Date(to);
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export async function searchStationsMock(params: StationSearchParams): Promise<Station[]> {
  // simulate latency
  await new Promise(r => setTimeout(r, 300));

  const limit = clamp(params.limit, 1, 50);
  const stations: Station[] = Array.from({ length: limit }).map((_, i) => {
    const distanceKm = Number(randomBetween(0.2, params.radiusKm).toFixed(1));
    return {
      id: `STA-${i + 1}`,
      name: `Station ${i + 1}`,
      lat: Number((params.lat + randomBetween(-0.2, 0.2)).toFixed(4)),
      lon: Number((params.lon + randomBetween(-0.2, 0.2)).toFixed(4)),
      distanceKm,
    };
  });

  // sort nearest first
  stations.sort((a, b) => a.distanceKm - b.distanceKm);
  return stations;
}

export async function fetchTemperaturesMock(q: TemperatureQuery): Promise<TemperaturePoint[]> {
  await new Promise(r => setTimeout(r, 300));

  const nDays = clamp(daysBetween(q.from, q.to) + 1, 1, 3650);
  const start = new Date(q.from);

  // simple seasonal-ish curve + noise
  const base = randomBetween(5, 14);
  const amp = randomBetween(6, 14);

  const points: TemperaturePoint[] = [];
  for (let i = 0; i < nDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    const dayOfYear = Math.floor(
      (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000
    );

    const seasonal = base + amp * Math.sin((2 * Math.PI * (dayOfYear - 30)) / 365);
    const tavg = seasonal + randomBetween(-2, 2);
    const tmin = tavg - randomBetween(2, 6);
    const tmax = tavg + randomBetween(2, 6);

    points.push({
      // Tageswerte: ISO-Datum
      date: toISO(d),
      // Kennzeichnung: Tagesaggregation
      level: "day",
      tmin: Number(tmin.toFixed(1)),
      tavg: Number(tavg.toFixed(1)),
      tmax: Number(tmax.toFixed(1)),
    });
  }
  return points;
}
