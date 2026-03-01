import type { Station } from "../api/types";
import { RotateCcw, Search, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  lat: number;
  lon: number;
  radiusKm: number;
  limit: number;
  from: string;
  to: string;
  canSearch: boolean;
  stations: Station[];
  selectedStationId: string | null;
  view: "chart" | "table";

  onChange: (patch: Partial<{
    lat: number;
    lon: number;
    radiusKm: number;
    limit: number;
    from: string;
    to: string;
  }>) => void;

  onSearchStations: () => void;
  onSelectStation: (stationId: string) => void;
  onReset: () => void;
  onSetView: (v: "chart" | "table") => void;

  loadingStations?: boolean;
  loadingTemps?: boolean;
  onLoadTemperatures: () => void;
  canLoad: boolean;
};

export function Toolbar(props: Props) {
  const {
    lat, lon, radiusKm, limit, from, to,
    canSearch,
    stations, selectedStationId,
    view,
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

  useEffect(() => setRadiusText(String(radiusKm)), [radiusKm]);
  useEffect(() => setLimitText(String(limit)), [limit]);
  useEffect(() => setLatText(String(lat)), [lat]);
  useEffect(() => setLonText(String(lon)), [lon]);

  const statusText = loadingStations ? "Suche Stationen…" : loadingTemps ? "Lade Daten…" : "Bereit";
  const disableControls = !!loadingStations || !!loadingTemps;

  const onEnter = (e: any) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    if (canLoad) onLoadTemperatures();
    else if (canSearch) onSearchStations();
  };

  return (
    <header className="toolbar" onKeyDown={onEnter}>
      <div className="toolbar__row">
        <div className="toolbar__left">
          <div className="toolbar__brand">Wetterdaten</div>

          <div className="toolbar__actions">
            <button className="iconBtn" onClick={onReset} title="Reset" aria-label="Reset" type="button">
              <RotateCcw size={18} />
            </button>

            <button
              className="iconBtn"
              onClick={onSearchStations}
              disabled={disableControls || !canSearch}
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
              const n = Number(latText);
              if (!Number.isFinite(n)) {
                setLatText(String(lat));
                return;
              }
              const fixed = Math.max(-90, Math.min(90, n));
              setLatText(String(fixed));
              onChange({ lat: fixed });
            }}
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
              const n = Number(lonText);
              if (!Number.isFinite(n)) {
                setLonText(String(lon));
                return;
              }
              const fixed = Math.max(-180, Math.min(180, n));
              setLonText(String(fixed));
              onChange({ lon: fixed });
            }}
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
              const n = Number(radiusText);
              const fixed = Number.isFinite(n) ? Math.min(100, Math.max(1, Math.round(n))) : 50;
              setRadiusText(String(fixed));
              onChange({ radiusKm: fixed });
            }}
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
              const n = Number(limitText);
              const fixed = Number.isFinite(n) ? Math.min(10, Math.max(1, Math.round(n))) : 10;
              setLimitText(String(fixed));
              onChange({ limit: fixed });
            }}
          />
        </label>

        <label className="field">
          <span>Startdatum</span>
          <input
            type="date"
            value={from}
            onChange={(e) => onChange({ from: e.target.value })}
          />
        </label>

        <label className="field">
          <span>Enddatum</span>
          <input
            type="date"
            value={to}
            max="2025-12-31"
            onChange={(e) => onChange({ to: e.target.value })}
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

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              className="loadBtn"
              onClick={onLoadTemperatures}
              disabled={!canLoad}
              title={!canLoad ? "Station wählen & Zeitraum prüfen" : "Temperaturdaten laden"}
              type="button"
            >
              Daten laden
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