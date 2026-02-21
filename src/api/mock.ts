import type { Station, StationSearchParams, TemperaturePoint, TemperatureQuery } from "./types";

function parseDate(s: string): number {
  
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return iso;

  
  const m = s.trim().match(/^(\d{1,2})\s*[\.\-\/]\s*(\d{1,2})\s*[\.\-\/]\s*(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    return new Date(yyyy, mm - 1, dd).getTime();
  }

  
  return NaN;
}

function overlap(aFrom: string, aTo: string, bFrom: string, bTo: string) {
  const af = parseDate(aFrom);
  const at = parseDate(aTo);
  const bf = parseDate(bFrom);
  const bt = parseDate(bTo);

  
  if ([af, at, bf, bt].some(Number.isNaN)) return false;

  return af <= bt && bf <= at;
}

function stationAvailability(stationId: string) {
 
  const n = Number(stationId.split("-")[1] ?? 1);
  const startYear = 1980 + (n % 5) * 5;       
  const endYear = 2035 + (n % 6) * 2;         
  return { from: `${startYear}-01-01`, to: `${endYear}-12-31` };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export async function searchStationsMock(params: StationSearchParams): Promise<Station[]> {
  await new Promise(r => setTimeout(r, 300));
    console.log("FROM/TO:", params.from, params.to);
    console.log("STA-1 avail", stationAvailability("STA-1"));
    console.log("overlap STA-1?", overlap(stationAvailability("STA-1").from, stationAvailability("STA-1").to, params.from!, params.to!));

  const limit = clamp(params.limit, 1, 50);

  
  const candidateCount = Math.max(limit * 3, 30);

  let stations: Station[] = Array.from({ length: candidateCount }).map((_, i) => {
    const distanceKm = Number(randomBetween(0.2, params.radiusKm).toFixed(1));
    return {
      id: `STA-${i + 1}`,
      name: `Station ${i + 1}`,
      lat: Number((params.lat + randomBetween(-0.2, 0.2)).toFixed(4)),
      lon: Number((params.lon + randomBetween(-0.2, 0.2)).toFixed(4)),
      distanceKm,
    };
  });

  
  stations.sort((a, b) => a.distanceKm - b.distanceKm);

  
  if (params.from && params.to) {
    stations = stations.filter((s) => {
      const avail = stationAvailability(s.id);
      return overlap(avail.from, avail.to, params.from!, params.to!);
    });
  }

  
  return stations.slice(0, limit);
}

function monthKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`; // YYYY-MM
}

function addMonths(d: Date, months: number) {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function monthsBetweenInclusive(from: string, to: string) {
  const a = new Date(from);
  const b = new Date(to);
  const start = new Date(a.getFullYear(), a.getMonth(), 1);
  const end = new Date(b.getFullYear(), b.getMonth(), 1);

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    count++;
    cur.setMonth(cur.getMonth() + 1);
    if (count > 2400) break; // safety
  }
  return count;
}
export async function fetchTemperaturesMock(q: TemperatureQuery): Promise<TemperaturePoint[]> {
  await new Promise(r => setTimeout(r, 300));

  const avail = stationAvailability(q.stationId);
    if (!overlap(avail.from, avail.to, q.from, q.to)) {
      return [];
  }
  const nMonths = clamp(monthsBetweenInclusive(q.from, q.to), 1, 2400);
const startMonth = new Date(new Date(q.from).getFullYear(), new Date(q.from).getMonth(), 1);

// simple seasonal-ish curve + noise
const base = randomBetween(5, 14);
const amp = randomBetween(6, 14);

const points: TemperaturePoint[] = [];
for (let i = 0; i < nMonths; i++) {
  const d = addMonths(startMonth, i);

  // "dayOfYear" grob über Monatsmitte
  const dayOfYear = Math.floor(
    (Date.UTC(d.getFullYear(), d.getMonth(), 15) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000
  );

  const seasonal = base + amp * Math.sin((2 * Math.PI * (dayOfYear - 30)) / 365);
  const tavg = seasonal + randomBetween(-1.0, 1.0);
  const tmin = tavg - randomBetween(2, 5);
  const tmax = tavg + randomBetween(2, 5);

  points.push({
    date: monthKey(d),     // ✅ YYYY-MM
    level: "month",        // ✅
    tmin: Number(tmin.toFixed(1)),
    tavg: Number(tavg.toFixed(1)),
    tmax: Number(tmax.toFixed(1)),
  });
}
return points;}
