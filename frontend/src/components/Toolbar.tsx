import type { Station } from "../api/types";
import { RotateCcw, Search, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  lat: number;
  lon: number;
  radiusKm: number;
  limit: number;

  fromYear: number;
  toYear: number;
  minYear: number;
  maxYear: number;

  canSearch: boolean;
  stations: Station[];
  selectedStationId: string | null;
  view: "chart" | "table";

  hasPreviousConfig: boolean;
  onLoadPreviousConfig: () => void;

  onChange: (patch: Partial<{
    lat: number;
    lon: number;
    radiusKm: number;
    limit: number;
    fromYear: number;
    toYear: number;
  }>) => void;

  onSearchStations: (override?: Partial<{
    lat: number;
    lon: number;
    radiusKm: number;
    limit: number;
    fromYear: number;
    toYear: number;
  }>) => void;

  onSelectStation: (stationId: string) => void;
  onReset: () => void;
  onSetView: (v: "chart" | "table") => void;

  loadingStations?: boolean;
  loadingTemps?: boolean;

  onLoadTemperatures: (override?: Partial<{
    stationId: string;
    fromYear: number;
    toYear: number;
  }>) => void;

  canLoad: boolean;
};

export function Toolbar(props: Props) {
  const {
    lat, lon, radiusKm, limit,
    fromYear, toYear, minYear, maxYear,
    canSearch,
    stations, selectedStationId,
    view,
    hasPreviousConfig,
    onLoadPreviousConfig,
    onChange, onSearchStations, onSelectStation,
    onReset,
    onSetView,
    loadingStations, loadingTemps,
    onLoadTemperatures,
    canLoad,
  } = props;

  const [latText, setLatText] = useState(String(lat));
  const [lonText, setLonText] = useState(String(lon));
  const [radiusText, setRadiusText] = useState(String(radiusKm));
  const [limitText, setLimitText] = useState(String(limit));
  const [fromYearText, setFromYearText] = useState(String(fromYear));
  const [toYearText, setToYearText] = useState(String(toYear));

  useEffect(() => setRadiusText(String(radiusKm)), [radiusKm]);
  useEffect(() => setLimitText(String(limit)), [limit]);
  useEffect(() => setLatText(String(lat)), [lat]);
  useEffect(() => setLonText(String(lon)), [lon]);
  useEffect(() => setFromYearText(String(fromYear)), [fromYear]);
  useEffect(() => setToYearText(String(toYear)), [toYear]);

  const statusText = loadingStations ? "Suche Stationen…" : loadingTemps ? "Lade Daten…" : "Bereit";
  const disableControls = !!loadingStations || !!loadingTemps;

  const parseLat = () => {
    const n = Number(latText);
    if (!Number.isFinite(n)) return lat;
    return Math.max(-90, Math.min(90, n));
  };

  const parseLon = () => {
    const n = Number(lonText);
    if (!Number.isFinite(n)) return lon;
    return Math.max(-180, Math.min(180, n));
  };

  const parseRadius = () => {
    const n = Number(radiusText);
    const base = Number.isFinite(n) ? n : radiusKm;
    return Math.min(100, Math.max(1, Math.round(base)));
  };

  const parseLimit = () => {
    const n = Number(limitText);
    const base = Number.isFinite(n) ? n : limit;
    return Math.min(10, Math.max(1, Math.round(base)));
  };

  const parseFromYear = () => {
    const n = Number(fromYearText);
    const base = Number.isFinite(n) ? n : fromYear;
    return Math.max(minYear, Math.min(maxYear, Math.round(base)));
  };

  const parseToYear = () => {
    const n = Number(toYearText);
    const base = Number.isFinite(n) ? n : toYear;
    return Math.max(minYear, Math.min(maxYear, Math.round(base)));
  };

  const commitAllFilters = () => {
    const patch = {
      lat: parseLat(),
      lon: parseLon(),
      radiusKm: parseRadius(),
      limit: parseLimit(),
      fromYear: parseFromYear(),
      toYear: parseToYear(),
    };

    setLatText(String(patch.lat));
    setLonText(String(patch.lon));
    setRadiusText(String(patch.radiusKm));
    setLimitText(String(patch.limit));
    setFromYearText(String(patch.fromYear));
    setToYearText(String(patch.toYear));

    onChange(patch);

    return patch;
  };

  const onEnterSearch = (e: any) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (disableControls) return;

    const patch = commitAllFilters();
    onSearchStations(patch);
  };

  const onEnterStation = (e: any) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (disableControls) return;

    const patch = commitAllFilters();

    if (selectedStationId) {
      onLoadTemperatures({ stationId: selectedStationId, fromYear: patch.fromYear, toYear: patch.toYear });
      return;
    }

    onSearchStations(patch);
  };

  return (
    <header className="toolbar">
      <div className="toolbar__row">
        <div className="toolbar__left">
          <div className="toolbar__brand">Wetterdaten</div>

          <div className="toolbar__actions">
            <button className="iconBtn" onClick={onReset} title="Reset" aria-label="Reset" type="button">
              <RotateCcw size={18} />
            </button>

            <button
              className="iconBtn"
              onClick={() => {
                const patch = commitAllFilters();
                onSearchStations(patch);
              }}
              disabled={disableControls}
              title={!canSearch ? "Bitte Eingaben prüfen (Koordinaten/Radius/Zeitraum)" : "Stationen suchen"}
              aria-label="Stationen suchen"
              type="button"
            >
              {loadingStations ? <Loader2 size={18} className="spin" /> : <Search size={18} />}
            </button>
          </div>
        </div>

        <div className="toolbar__views">
          <button
            className={`viewBtn ${view === "chart" ? "isActive" : ""}`}
            onClick={() => onSetView("chart")}
            type="button"
          >
            Chart
          </button>
          <button
            className={`viewBtn ${view === "table" ? "isActive" : ""}`}
            onClick={() => onSetView("table")}
            type="button"
          >
            Tabelle
          </button>
        </div>
      </div>

      <div className="toolbar__grid">
        <label className="field">
          <span>Breitengrad</span>
          <input
            type="number"
            step="0.0001"
            value={latText}
            onChange={(e) => setLatText(e.target.value)}
            onBlur={() => {
              const fixed = parseLat();
              setLatText(String(fixed));
              onChange({ lat: fixed });
            }}
            onKeyDown={onEnterSearch}
          />
        </label>

        <label className="field">
          <span>Längengrad</span>
          <input
            type="number"
            step="0.0001"
            value={lonText}
            onChange={(e) => setLonText(e.target.value)}
            onBlur={() => {
              const fixed = parseLon();
              setLonText(String(fixed));
              onChange({ lon: fixed });
            }}
            onKeyDown={onEnterSearch}
          />
        </label>

        <label className="field">
          <span>Radius (km)</span>
          <input
            type="number"
            step="1"
            min="1"
            max="100"
            value={radiusText}
            onChange={(e) => setRadiusText(e.target.value)}
            onBlur={() => {
              const fixed = parseRadius();
              setRadiusText(String(fixed));
              onChange({ radiusKm: fixed });
            }}
            onKeyDown={onEnterSearch}
          />
        </label>

        <label className="field">
          <span>Anzahl Stationen</span>
          <input
            type="number"
            step="1"
            min="1"
            max="10"
            value={limitText}
            onChange={(e) => setLimitText(e.target.value)}
            onBlur={() => {
              const fixed = parseLimit();
              setLimitText(String(fixed));
              onChange({ limit: fixed });
            }}
            onKeyDown={onEnterSearch}
          />
        </label>

        <label className="field">
          <span>Startjahr</span>
          <input
            type="number"
            step="1"
            min={minYear}
            max={maxYear}
            value={fromYearText}
            onChange={(e) => setFromYearText(e.target.value)}
            onBlur={() => {
              const fixed = parseFromYear();
              setFromYearText(String(fixed));
              onChange({ fromYear: fixed });
            }}
            onKeyDown={onEnterSearch}
          />
        </label>

        <label className="field">
          <span>Endjahr</span>
          <input
            type="number"
            step="1"
            min={minYear}
            max={maxYear}
            value={toYearText}
            onChange={(e) => setToYearText(e.target.value)}
            onBlur={() => {
              const fixed = parseToYear();
              setToYearText(String(fixed));
              onChange({ toYear: fixed });
            }}
            onKeyDown={onEnterSearch}
          />
        </label>

        <label className="field field--wide">
          <span>Verfügbare Stationen {loadingStations ? "(lädt…)" : ""}</span>
          <select
            value={selectedStationId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v) onSelectStation(v);
            }}
            onKeyDown={onEnterStation}
            disabled={!stations.length}
          >
            <option value="">
              {stations.length ? "Station wählen…" : "Keine Stationen (erst suchen)"}
            </option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.distanceKm.toFixed(1)} km
              </option>
            ))}
          </select>

          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button
              className="loadBtn"
              onClick={() => {
                if (!selectedStationId) return;
                const patch = commitAllFilters();
                onLoadTemperatures({ stationId: selectedStationId, fromYear: patch.fromYear, toYear: patch.toYear });
              }}
              disabled={disableControls || !selectedStationId}
              title={!selectedStationId ? "Station wählen" : !canLoad ? "Bitte Eingaben prüfen" : "Temperaturdaten laden"}
              type="button"
            >
              Daten laden
            </button>

            <button
              className="loadBtn"
              onClick={onLoadPreviousConfig}
              disabled={disableControls || !hasPreviousConfig}
              title={!hasPreviousConfig ? "Keine gespeicherte Konfiguration" : "Letzte Konfiguration laden"}
              type="button"
            >
              Letzte Konfiguration laden
            </button>
          </div>
        </label>

        <div className="toolbar__status">
          <span className="pill">{statusText}</span>
        </div>
      </div>
    </header>
  );
}