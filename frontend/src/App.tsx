import { useMemo, useState, useEffect, useRef } from "react";
import { Toolbar } from "./components/Toolbar";
import { ChartsPanel } from "./components/ChartsPanel";
import { TemperatureTable } from "./components/TemperatureTable";
import { searchStations, fetchTemperatures } from "./api/client";
import type { Station, TemperaturePoint } from "./api/types";
import "./App.css";

import {
  pushConfigSnapshot,
  getPreviousConfigSnapshot,
  hasPreviousConfig as storageHasPreviousConfig,
} from "./lib/storage";
import type { ConfigSnapshotV1 } from "./lib/storage";

const MAX_DATE = "2025-12-31";
const MAX_YEAR = Number(MAX_DATE.slice(0, 4));
const MIN_YEAR = 1800;

const DEFAULT_FROM_YEAR = 2024;
const DEFAULT_TO_YEAR = 2025;

type SearchOverrides = Partial<{
  lat: number;
  lon: number;
  radiusKm: number;
  limit: number;
  fromYear: number;
  toYear: number;
}>;

type LoadOverrides = Partial<{
  stationId: string;
  fromYear: number;
  toYear: number;
}>;

function clampYear(y: number) {
  if (!Number.isFinite(y)) return MIN_YEAR;
  return Math.max(MIN_YEAR, Math.min(MAX_YEAR, Math.trunc(y)));
}

function yearRangeToDates(fromYear: number, toYear: number) {
  const fy = clampYear(fromYear);
  const ty = clampYear(toYear);
  const from = `${fy}-01-01`;
  const to = ty === MAX_YEAR ? MAX_DATE : `${ty}-12-31`;
  return { fy, ty, from, to };
}

function normalizeSearchParams(radiusKm: number, limit: number, fromYear: number, toYear: number) {
  const clampedRadiusKm = Math.max(1, Math.min(100, radiusKm));
  const clampedLimit = Math.max(1, Math.min(10, limit));
  if (fromYear > toYear) {
    throw new Error("Startjahr darf nicht nach Endjahr liegen.");
  }
  return { clampedRadiusKm, clampedLimit };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function daysInMonthUTC(year: number, month1to12: number) {
  const d = new Date(Date.UTC(year, month1to12, 0));
  return d.getUTCDate();
}

function extractYearAndWeight(dateStr: string) {
  const s = String(dateStr);
  const year = s.slice(0, 4);

  const monthPart = s.length >= 7 ? s.slice(5, 7) : "";
  const month = Number(monthPart);

  if (Number.isFinite(month) && month >= 1 && month <= 12) {
    const y = Number(year);
    if (Number.isFinite(y)) {
      return { year, weight: daysInMonthUTC(y, month) };
    }
  }

  return { year, weight: 1 };
}

function aggregateMonthlyToYear(points: TemperaturePoint[]): TemperaturePoint[] {
  type Acc = {
    sumTmin: number;
    wTmin: number;
    sumTavg: number;
    wTavg: number;
    sumTmax: number;
    wTmax: number;
  };

  const acc = new Map<string, Acc>();

  for (const p of points) {
    const { year, weight } = extractYearAndWeight(p.date);

    const a =
      acc.get(year) ?? { sumTmin: 0, wTmin: 0, sumTavg: 0, wTavg: 0, sumTmax: 0, wTmax: 0 };

    if (p.tmin !== undefined && p.tmin !== null && Number.isFinite(p.tmin)) {
      a.sumTmin += p.tmin * weight;
      a.wTmin += weight;
    }

    if (p.tavg !== undefined && p.tavg !== null && Number.isFinite(p.tavg)) {
      a.sumTavg += p.tavg * weight;
      a.wTavg += weight;
    }

    if (p.tmax !== undefined && p.tmax !== null && Number.isFinite(p.tmax)) {
      a.sumTmax += p.tmax * weight;
      a.wTmax += weight;
    }

    acc.set(year, a);
  }

  return [...acc.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([year, a]) => ({
      date: year,
      tmin: a.wTmin ? round1(a.sumTmin / a.wTmin) : undefined,
      tavg: a.wTavg ? round1(a.sumTavg / a.wTavg) : undefined,
      tmax: a.wTmax ? round1(a.sumTmax / a.wTmax) : undefined,
    }));
}

function isYearString(s: string) {
  return /^[0-9]{4}$/.test(s);
}

function areYearlyPoints(points: TemperaturePoint[]) {
  return points.every((p) => isYearString(String(p.date)));
}

export default function App() {
  const restoringRef = useRef(false);

  const [lat, setLat] = useState<number>(48.1372);
  const [lon, setLon] = useState<number>(11.5756);
  const [radiusKm, setRadiusKm] = useState<number>(50);
  const [limit, setLimit] = useState<number>(10);

  const [fromYear, setFromYear] = useState<number>(DEFAULT_FROM_YEAR);
  const [toYear, setToYear] = useState<number>(DEFAULT_TO_YEAR);

  const { fy, ty, from, to } = useMemo(
    () => yearRangeToDates(fromYear, toYear),
    [fromYear, toYear]
  );

  const [view, setView] = useState<"chart" | "table">("chart");

  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [activeStationId, setActiveStationId] = useState<string | null>(null);

  const activeStation = useMemo(
    () => stations.find((s) => s.id === activeStationId),
    [stations, activeStationId]
  );

  const [temps, setTemps] = useState<TemperaturePoint[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [loadingTemps, setLoadingTemps] = useState(false);
  const [warmingUp, setWarmingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hasPreviousConfig, setHasPreviousConfig] = useState<boolean>(() => storageHasPreviousConfig());

  const canSearch =
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    radiusKm > 0 &&
    limit > 0 &&
    fy <= ty &&
    !loadingStations;

  const canLoadTemps =
    !!selectedStationId &&
    fy <= ty &&
    !loadingStations &&
    !loadingTemps &&
    !warmingUp;

  useEffect(() => {
    setError(null);
  }, [lat, lon, radiusKm, limit, fy, ty, selectedStationId, view]);

  useEffect(() => {
    if (restoringRef.current) return;
    setStations([]);
    setSelectedStationId(null);
    setActiveStationId(null);
    setTemps([]);
  }, [fy, ty]);

  const resetAll = () => {
    setError(null);
    setStations([]);
    setSelectedStationId(null);
    setTemps([]);
    setView("chart");
    setActiveStationId(null);
    setWarmingUp(false);
    setFromYear(DEFAULT_FROM_YEAR);
    setToYear(DEFAULT_TO_YEAR);
  };

  const warmupStation = async (stationId: string, warmFrom: string, warmTo: string) => {
    if (!stationId) return;
    setWarmingUp(true);
    try {
      await fetch(`/api/temperatures?station_id=${encodeURIComponent(stationId)}&from=${warmFrom}&to=${warmTo}`);
    } finally {
      setWarmingUp(false);
    }
  };

  const onSearchStations = async (override?: SearchOverrides) => {
    try {
      setError(null);
      setLoadingStations(true);

      const latEff = override?.lat ?? lat;
      const lonEff = override?.lon ?? lon;
      const radiusEff = override?.radiusKm ?? radiusKm;
      const limitEff = override?.limit ?? limit;
      const fromYearEff = override?.fromYear ?? fy;
      const toYearEff = override?.toYear ?? ty;

      const { clampedRadiusKm, clampedLimit } = normalizeSearchParams(radiusEff, limitEff, fromYearEff, toYearEff);
      const { from: fromEff, to: toEff } = yearRangeToDates(fromYearEff, toYearEff);

      const res = await searchStations({
        lat: latEff,
        lon: lonEff,
        radiusKm: clampedRadiusKm,
        limit: clampedLimit,
        from: fromEff,
        to: toEff,
      });

      setStations(res);
      setSelectedStationId(null);
      setActiveStationId(null);
      setTemps([]);

      if (res.length === 0) {
        setError("Keine Stationen mit Daten im gewählten Zeitraum gefunden. Zeitraum oder Radius anpassen.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Fehler bei der Stationssuche");
    } finally {
      setLoadingStations(false);
    }
  };

  const onSelectStation = (stationId: string) => {
    setSelectedStationId(stationId);
    warmupStation(stationId, from, to);
  };

  const onLoadTemperatures = async (override?: LoadOverrides) => {
    const stationId = override?.stationId ?? selectedStationId;
    if (!stationId) return;

    try {
      setError(null);
      setLoadingTemps(true);
      setTemps([]);

      const fromYearEff = override?.fromYear ?? fy;
      const toYearEff = override?.toYear ?? ty;

      if (fromYearEff > toYearEff) {
        throw new Error("Startjahr darf nicht nach Endjahr liegen.");
      }

      const { from: fromEff, to: toEff } = yearRangeToDates(fromYearEff, toYearEff);

      const monthly = await fetchTemperatures({
        stationId,
        from: fromEff,
        to: toEff,
      });

      const yearly = aggregateMonthlyToYear(monthly);

      if (yearly.length === 0) {
        setError("Für diese Station sind im gewählten Zeitraum keine Daten verfügbar.");
        setActiveStationId(null);
        return;
      }

      setTemps(yearly);
      setSelectedStationId(stationId);
      setActiveStationId(stationId);

      const snapshot: ConfigSnapshotV1 = {
        v: 1,
        savedAt: new Date().toISOString(),
        lat,
        lon,
        radiusKm,
        limit,
        from: fromEff,
        to: toEff,
        view,
        stations,
        selectedStationId: stationId,
        activeStationId: stationId,
        temps: yearly,
      };

      const hist = pushConfigSnapshot(snapshot);
      setHasPreviousConfig(hist.items.length >= 2);
    } catch (e: any) {
      setError(e?.message ?? "Fehler beim Laden der Temperaturdaten");
    } finally {
      setLoadingTemps(false);
    }
  };

  const onLoadPreviousConfig = () => {
    const prev = getPreviousConfigSnapshot();

    if (!prev) {
      setError("Keine vorherige Konfiguration gespeichert. Führe mindestens zwei Suchen aus.");
      return;
    }

    restoringRef.current = true;

    setLat(prev.lat);
    setLon(prev.lon);
    setRadiusKm(prev.radiusKm);
    setLimit(prev.limit);

    const prevFromYear = Number(String(prev.from).slice(0, 4));
    const prevToYear = Number(String(prev.to).slice(0, 4));

    setFromYear(clampYear(prevFromYear));
    setToYear(clampYear(prevToYear));

    setView(prev.view);
    setStations(prev.stations ?? []);
    setSelectedStationId(prev.selectedStationId ?? null);
    setActiveStationId(prev.activeStationId ?? null);

    const prevTemps = prev.temps ?? [];
    const restored = areYearlyPoints(prevTemps) ? prevTemps : aggregateMonthlyToYear(prevTemps);
    setTemps(restored);

    setWarmingUp(false);
    setError(null);

    setTimeout(() => {
      restoringRef.current = false;
    }, 0);
  };

  return (
    <div className="appShell">
      <Toolbar
        lat={lat}
        lon={lon}
        radiusKm={radiusKm}
        limit={limit}
        fromYear={fy}
        toYear={ty}
        minYear={MIN_YEAR}
        maxYear={MAX_YEAR}
        stations={stations}
        selectedStationId={selectedStationId}
        view={view}
        loadingStations={loadingStations}
        loadingTemps={loadingTemps}
        onLoadTemperatures={onLoadTemperatures}
        canLoad={canLoadTemps}
        canSearch={canSearch}
        hasPreviousConfig={hasPreviousConfig}
        onLoadPreviousConfig={onLoadPreviousConfig}
        onChange={(patch) => {
          if (patch.lat !== undefined) setLat(patch.lat);
          if (patch.lon !== undefined) setLon(patch.lon);

          if (patch.radiusKm !== undefined) setRadiusKm(Math.min(100, Math.max(1, patch.radiusKm)));
          if (patch.limit !== undefined) setLimit(Math.min(10, Math.max(1, patch.limit)));

          if (patch.fromYear !== undefined) setFromYear(clampYear(patch.fromYear));
          if (patch.toYear !== undefined) setToYear(clampYear(patch.toYear));
        }}
        onSearchStations={onSearchStations}
        onSelectStation={onSelectStation}
        onReset={resetAll}
        onSetView={setView}
      />

      {error && <div className="errorBanner">{error}</div>}

      <main className="content">
        {view === "chart" && <ChartsPanel stationName={activeStation?.name} data={temps} loading={loadingTemps} />}
        {view === "table" && <TemperatureTable data={temps} />}
      </main>
    </div>
  );
}
