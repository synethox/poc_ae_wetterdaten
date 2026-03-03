import type { Station, TemperaturePoint } from "../api/types";

export const STORAGE_PREFIX = "app-wetterdaten:";
export const CONFIG_HISTORY_KEY = `${STORAGE_PREFIX}configHistory`;
export const LEGACY_LAST_CONFIG_KEY = `${STORAGE_PREFIX}lastConfig`;
export const CONFIG_HISTORY_MAX = 5;

export type ConfigSnapshotV1 = {
  v: 1;
  savedAt: string;
  lat: number;
  lon: number;
  radiusKm: number;
  limit: number;
  from: string;
  to: string;
  view: "chart" | "table";
  stations: Station[];
  selectedStationId: string | null;
  activeStationId: string | null;
  temps: TemperaturePoint[];
};

export type ConfigHistoryV1 = {
  v: 1;
  max: number;
  items: ConfigSnapshotV1[];
};

function storageAvailable() {
  try {
    const x = "__wetterdaten_storage_test__";
    localStorage.setItem(x, x);
    localStorage.removeItem(x);
    return true;
  } catch {
    return false;
  }
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function coerceHistory(raw: unknown, max: number): ConfigHistoryV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as any;
  if (r.v !== 1) return null;
  const items = Array.isArray(r.items) ? (r.items as any[]) : null;
  if (!items) return null;

  const normalized = items
    .filter((it) => it && typeof it === "object" && it.v === 1 && typeof it.savedAt === "string")
    .slice(-max) as ConfigSnapshotV1[];

  return { v: 1, max, items: normalized };
}

function coerceSnapshot(raw: unknown): ConfigSnapshotV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as any;

  if (r.v !== 1) return null;
  if (typeof r.savedAt !== "string") return null;
  if (typeof r.lat !== "number" || typeof r.lon !== "number") return null;
  if (typeof r.radiusKm !== "number" || typeof r.limit !== "number") return null;
  if (typeof r.from !== "string" || typeof r.to !== "string") return null;
  if (r.view !== "chart" && r.view !== "table") return null;
  if (!Array.isArray(r.stations)) return null;
  if (!Array.isArray(r.temps)) return null;

  const selectedStationId = typeof r.selectedStationId === "string" ? r.selectedStationId : null;
  const activeStationId = typeof r.activeStationId === "string" ? r.activeStationId : null;

  return {
    v: 1,
    savedAt: r.savedAt,
    lat: r.lat,
    lon: r.lon,
    radiusKm: r.radiusKm,
    limit: r.limit,
    from: r.from,
    to: r.to,
    view: r.view,
    stations: r.stations as Station[],
    selectedStationId,
    activeStationId,
    temps: r.temps as TemperaturePoint[],
  };
}

export function readConfigHistory(max: number = CONFIG_HISTORY_MAX): ConfigHistoryV1 {
  if (!storageAvailable()) return { v: 1, max, items: [] };

  const raw = localStorage.getItem(CONFIG_HISTORY_KEY);
  if (raw) {
    const parsed = safeJsonParse<unknown>(raw);
    const hist = coerceHistory(parsed, max);
    if (hist) return hist;
  }

  const legacyRaw = localStorage.getItem(LEGACY_LAST_CONFIG_KEY);
  if (legacyRaw) {
    const parsed = safeJsonParse<unknown>(legacyRaw);
    const snap = coerceSnapshot(parsed);
    if (snap) {
      const hist: ConfigHistoryV1 = { v: 1, max, items: [snap] };
      writeConfigHistory(hist);
      return hist;
    }
  }

  return { v: 1, max, items: [] };
}

export function writeConfigHistory(history: ConfigHistoryV1) {
  if (!storageAvailable()) return;

  const trimmed: ConfigHistoryV1 = {
    v: 1,
    max: history.max,
    items: (history.items ?? []).slice(-history.max),
  };

  localStorage.setItem(CONFIG_HISTORY_KEY, JSON.stringify(trimmed));
}

export function pushConfigSnapshot(snapshot: ConfigSnapshotV1, max: number = CONFIG_HISTORY_MAX): ConfigHistoryV1 {
  const hist = readConfigHistory(max);
  const nextItems = [...hist.items, snapshot].slice(-max);
  const next: ConfigHistoryV1 = { v: 1, max, items: nextItems };
  writeConfigHistory(next);
  return next;
}

export function getPreviousConfigSnapshot(max: number = CONFIG_HISTORY_MAX): ConfigSnapshotV1 | null {
  const hist = readConfigHistory(max);
  if (hist.items.length < 2) return null;
  return hist.items[hist.items.length - 2] ?? null;
}

export function hasPreviousConfig(max: number = CONFIG_HISTORY_MAX): boolean {
  const hist = readConfigHistory(max);
  return hist.items.length >= 2;
}
