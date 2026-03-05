import { useMemo, useState, useEffect, useRef } from "react";
import { Toolbar } from "./components/Toolbar";
import { ChartsPanel } from "./components/ChartsPanel";
import { TemperatureTable } from "./components/TemperatureTable";
import { SeasonTable } from "./components/SeasonTable";
import { searchStations, fetchTemperatures } from "./api/client";
import type { Station, TemperaturePoint } from "./api/types";
import "./App.css";
import { DataToggles } from "./components/DataToggles";
import type { Visibility } from "./components/DataToggles";

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
const MIN_SEASON_MONTHS = 1;
const MIN_YEAR_MONTHS = 1;

type YearlyPoint = {
  date: string;
  tmin: number | null;
  tavg: number | null;
  tmax: number | null;
};

type Hemisphere = "north" | "south";

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

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthKey(year: number, month: number) {
  return `${year}-${pad2(month)}`;
}

function daysInMonthUTC(year: number, month1to12: number) {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function parseYearMonth(dateStr: string): { year: number; month: number } | null {
  const s = String(dateStr);
  if (s.length < 7) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return { year: y, month: m };
}

type MonthlyRec = {
  year: number;
  month: number;
  key: string;
  days: number;
  tmin: number | null;
  tavg: number | null;
  tmax: number | null;
};

function buildMonthlyIndex(points: TemperaturePoint[]) {
  const idx = new Map<string, MonthlyRec>();

  for (const p of points) {
    const ym = parseYearMonth(p.date);
    if (!ym) continue;

    const tmin = isFiniteNumber(p.tmin) ? p.tmin : null;
    const tmax = isFiniteNumber(p.tmax) ? p.tmax : null;
    const tavg = isFiniteNumber(p.tavg) ? p.tavg : null;

    if (tmin === null && tmax === null && tavg === null) continue;

    const key = monthKey(ym.year, ym.month);
    idx.set(key, {
      year: ym.year,
      month: ym.month,
      key,
      days: daysInMonthUTC(ym.year, ym.month),
      tmin,
      tavg,
      tmax,
    });
  }

  return idx;
}

function fillMissingYears(map: Map<string, YearlyPoint>, fromYear: number, toYear: number): YearlyPoint[] {
  const out: YearlyPoint[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    const k = String(y);
    out.push(map.get(k) ?? { date: k, tmin: null, tavg: null, tmax: null });
  }
  return out;
}

function aggregateMonthlyToYearStrict(monthIdx: Map<string, MonthlyRec>, fromYear: number, toYear: number): YearlyPoint[] {
  const outMap = new Map<string, YearlyPoint>();

  for (let y = fromYear; y <= toYear; y++) {
    let tminMonths = 0;
    let tmaxMonths = 0;
    let tavgMonths = 0;
    let tminDays = 0;
    let tmaxDays = 0;
    let tavgDays = 0;
    let sumTmin = 0;
    let sumTmax = 0;
    let sumTavg = 0;

    for (let m = 1; m <= 12; m++) {
      const rec = monthIdx.get(monthKey(y, m));
      if (!rec) continue;

      if (rec.tmin !== null) {
        tminMonths += 1;
        tminDays += rec.days;
        sumTmin += rec.tmin * rec.days;
      }
      if (rec.tmax !== null) {
        tmaxMonths += 1;
        tmaxDays += rec.days;
        sumTmax += rec.tmax * rec.days;
      }
      if (rec.tavg !== null) {
        tavgMonths += 1;
        tavgDays += rec.days;
        sumTavg += rec.tavg * rec.days;
      }
    }

    outMap.set(String(y), {
      date: String(y),
      tmin: tminMonths >= MIN_YEAR_MONTHS && tminDays > 0 ? round1(sumTmin / tminDays) : null,
      tavg: tavgMonths >= MIN_YEAR_MONTHS && tavgDays > 0 ? round1(sumTavg / tavgDays) : null,
      tmax: tmaxMonths >= MIN_YEAR_MONTHS && tmaxDays > 0 ? round1(sumTmax / tmaxDays) : null,
    });
  }

  return fillMissingYears(outMap, fromYear, toYear);
}

function aggregateMonthsForSeason(
  monthIdx: Map<string, MonthlyRec>,
  months: Array<{ y: number; m: number }>,
  minPresentMonths = 1
) {
  let tminMonths = 0;
  let tmaxMonths = 0;
  let tavgMonths = 0;
  let tminDays = 0;
  let tmaxDays = 0;
  let tavgDays = 0;
  let sumTmin = 0;
  let sumTmax = 0;
  let sumTavg = 0;

  for (const mm of months) {
    const rec = monthIdx.get(monthKey(mm.y, mm.m));
    if (!rec) continue;

    if (rec.tmin !== null) {
      tminMonths += 1;
      tminDays += rec.days;
      sumTmin += rec.tmin * rec.days;
    }
    if (rec.tmax !== null) {
      tmaxMonths += 1;
      tmaxDays += rec.days;
      sumTmax += rec.tmax * rec.days;
    }
    if (rec.tavg !== null) {
      tavgMonths += 1;
      tavgDays += rec.days;
      sumTavg += rec.tavg * rec.days;
    }
  }

  return {
    tmin: tminMonths >= minPresentMonths && tminDays > 0 ? round1(sumTmin / tminDays) : null,
    tavg: tavgMonths >= minPresentMonths && tavgDays > 0 ? round1(sumTavg / tavgDays) : null,
    tmax: tmaxMonths >= minPresentMonths && tmaxDays > 0 ? round1(sumTmax / tmaxDays) : null,
  };
}

function computeSeasonsForRange(
  monthIdx: Map<string, MonthlyRec>,
  fromYear: number,
  toYear: number,
  hemisphere: Hemisphere
) {
  const rows: Array<{
    year: string;
    season: string;
    tmin: number | null;
    tavg: number | null;
    tmax: number | null;
  }> = [];

  const seasonByLabelNorth: Record<string, "DJF" | "MAM" | "JJA" | "SON"> = {
    Winter: "DJF",
    Frühling: "MAM",
    Sommer: "JJA",
    Herbst: "SON",
  };

  const seasonByLabelSouth: Record<string, "DJF" | "MAM" | "JJA" | "SON"> = {
    Winter: "JJA",
    Frühling: "SON",
    Sommer: "DJF",
    Herbst: "MAM",
  };

  const labels = ["Winter", "Frühling", "Sommer", "Herbst"];
  const mapping = hemisphere === "south" ? seasonByLabelSouth : seasonByLabelNorth;

  for (let y = fromYear; y <= toYear; y++) {
    for (const label of labels) {
      const code = mapping[label];

      const months =
        code === "DJF"
          ? [{ y: y - 1, m: 12 }, { y, m: 1 }, { y, m: 2 }]
          : code === "MAM"
          ? [{ y, m: 3 }, { y, m: 4 }, { y, m: 5 }]
          : code === "JJA"
          ? [{ y, m: 6 }, { y, m: 7 }, { y, m: 8 }]
          : [{ y, m: 9 }, { y, m: 10 }, { y, m: 11 }];

      const agg = aggregateMonthsForSeason(monthIdx, months, MIN_SEASON_MONTHS);

      rows.push({
        year: String(y),
        season: label,
        tmin: agg.tmin,
        tavg: agg.tavg,
        tmax: agg.tmax,
      });
    }
  }

  return rows;
}


const DEFAULT_VISIBILITY: Visibility = {
  year: { tmin: true, tavg: true, tmax: true },
  spring: { tmin: false, tmax: false },
  summer: { tmin: false, tmax: false },
  autumn: { tmin: false, tmax: false },
  winter: { tmin: false, tmax: false },
};

export default function App() {
  const restoringRef = useRef(false);

  const [lat, setLat] = useState<number>(48.1372);
  const [lon, setLon] = useState<number>(11.5756);
  const [radiusKm, setRadiusKm] = useState<number>(50);
  const [limit, setLimit] = useState<number>(10);

  const [fromYear, setFromYear] = useState<number>(DEFAULT_FROM_YEAR);
  const [toYear, setToYear] = useState<number>(DEFAULT_TO_YEAR);

  const { fy, ty, from, to } = useMemo(() => yearRangeToDates(fromYear, toYear), [fromYear, toYear]);

  const [view, setView] = useState<"chart" | "table">("chart");

  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [activeStationId, setActiveStationId] = useState<string | null>(null);

  const activeStation = useMemo(
    () => stations.find((s) => s.id === activeStationId),
    [stations, activeStationId]
  );

  
  const [yearlyTemps, setYearlyTemps] = useState<YearlyPoint[]>([]);
  const [seasonRows, setSeasonRows] = useState<Array<{ year: string; season: string; tmin: number | null; tavg: number | null; tmax: number | null }>>([]);
  const [hemisphere, setHemisphere] = useState<Hemisphere>("north");

  const [loadingStations, setLoadingStations] = useState(false);
  const [loadingTemps, setLoadingTemps] = useState(false);
  const [warmingUp, setWarmingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [visibility, setVisibility] = useState<Visibility>(DEFAULT_VISIBILITY);

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
    setYearlyTemps([]);
    setSeasonRows([]);
  }, [fy, ty]);

  const resetAll = () => {
    setError(null);
    setStations([]);
    setSelectedStationId(null);
    setActiveStationId(null);
    setYearlyTemps([]);
    setSeasonRows([]);
    setView("chart");
    setWarmingUp(false);
    setFromYear(DEFAULT_FROM_YEAR);
    setToYear(DEFAULT_TO_YEAR);
    setVisibility(DEFAULT_VISIBILITY);
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
      setYearlyTemps([]);
      setSeasonRows([]);

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
      setYearlyTemps([]);
      setSeasonRows([]);

      const fromYearEff = override?.fromYear ?? fy;
      const toYearEff = override?.toYear ?? ty;
      if (fromYearEff > toYearEff) throw new Error("Startjahr darf nicht nach Endjahr liegen.");

      const { from: fromEff, to: toEff } = yearRangeToDates(fromYearEff, toYearEff);

      const padFromYear = Math.max(MIN_YEAR, fromYearEff - 1);
      const paddedFrom = `${padFromYear}-12-01`;

      const monthly = await fetchTemperatures({ stationId, from: paddedFrom, to: toEff });
      if (!monthly.length) {
        setError("Für diese Station sind im gewählten Zeitraum keine Daten verfügbar.");
        setActiveStationId(null);
        return;
      }

      const stationLat = stations.find((s) => s.id === stationId)?.lat ?? 48.0;
      const hemi: Hemisphere = stationLat < 0 ? "south" : "north";
      setHemisphere(hemi);

      const idx = buildMonthlyIndex(monthly);
      const yearly = aggregateMonthlyToYearStrict(idx, fromYearEff, toYearEff);
      const seasons = computeSeasonsForRange(idx, fromYearEff, toYearEff, hemi);

      
      setYearlyTemps(yearly);
      setSeasonRows(seasons);

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
        temps: monthly,
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
    

    const stationLat = (prev.stations ?? []).find((s) => s.id === prev.selectedStationId)?.lat ?? 48.0;
    const hemi: Hemisphere = stationLat < 0 ? "south" : "north";
    setHemisphere(hemi);

    const idx = buildMonthlyIndex(prevTemps);
    const yearly = aggregateMonthlyToYearStrict(idx, prevFromYear, prevToYear);
    const seasons = computeSeasonsForRange(idx, prevFromYear, prevToYear, hemi);

    setYearlyTemps(yearly);
    setSeasonRows(seasons);

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
        {view === "chart" && (
          <>
            <div style={{ marginBottom: 12 }}>
              <DataToggles
                value={visibility}
                onChange={setVisibility}
                disabledYear={!yearlyTemps.length}
                disabledSeasons={!seasonRows.length}
              />
            </div>

            <ChartsPanel
              stationName={activeStation?.name}
              yearly={yearlyTemps}
              seasons={seasonRows}
              visibility={visibility}
              loading={loadingTemps}
            />
          </>
        )}

  {view === "table" && (
    <>
      <div style={{ marginBottom: 12 }}>
        <DataToggles
          value={visibility}
          onChange={setVisibility}
          disabledYear={!yearlyTemps.length}
          disabledSeasons={!seasonRows.length}
        />
      </div>

      <TemperatureTable data={yearlyTemps} visibility={visibility.year} />
      <SeasonTable rows={seasonRows} hemisphere={hemisphere} visibility={visibility} />
    </>
  )}
</main>
    </div>
  );
}
