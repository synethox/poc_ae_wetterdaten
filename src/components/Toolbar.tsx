import type { Station } from "../api/types";
import { RotateCcw, Search, Loader2 } from "lucide-react";

type Props = {
  
  lat: number;
  lon: number;
  radiusKm: number;
  limit: number;
  from: string;
  to: string;
  canSearch?: boolean;  
  stations: Station[];
  selectedStationId: string | null; 
  view: "chart" | "table" ;

  
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

  onSetView: (v: "chart" | "table" ) => void;

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

  const statusText = loadingStations ? "Suche Stationen…" : loadingTemps ? "Lade Daten…" : "Bereit";
  const disableControls = !!loadingStations || !!loadingTemps;


  return (
    <header className="toolbar">
      <div className="toolbar__row">
        <div className="toolbar__left">
          <div className="toolbar__brand">Wetterdaten</div>

          <div className="toolbar__actions">
            <button className="iconBtn" onClick={onReset} title="Reset" aria-label="Reset" type="button">  <RotateCcw size={18} /> </button>
            <button className="iconBtn" onClick={onSearchStations} disabled={disableControls || canSearch === false} title={canSearch === false ? "Bitte Eingaben prüfen (Koordinaten/Radius/Zeitraum)" : "Stationen suchen"} >
            {loadingStations ? <Loader2 size={18} className="spin" /> : <Search size={18} />}
      
            </button>
          </div>
        </div>

        <div className="toolbar__views">
          <button
            className={`viewBtn ${view === "chart" ? "isActive" : ""}`}
            onClick={() => onSetView("chart")}
          >
            Chart
          </button>
          <button
            className={`viewBtn ${view === "table" ? "isActive" : ""}`}
            onClick={() => onSetView("table")}
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
            value={lat}
            onChange={(e) => onChange({ lat: Number(e.target.value) })}
          />
        </label>

        <label className="field">
          <span>Längengrad</span>
          <input
            type="number"
            step="0.0001"
            value={lon}
            onChange={(e) => onChange({ lon: Number(e.target.value) })}
          />
        </label>

        <label className="field">
          <span>Radius (km)</span>
          <input
            type="number"
            step="1"
            min="1"
            max="100"
            value={radiusKm}
            onChange={(e) => {
              const value = Math.min(100, Math.max(1, Number(e.target.value)));
              onChange({ radiusKm: value });
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
            value={limit}
            onChange={(e) => {
              const value = Math.min(10, Math.max(1, Number(e.target.value)));
              onChange({ limit: value });
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
            onChange={(e) => onChange({ to: e.target.value })}
          />
        </label>

        <label className="field field--wide">
          <span>Available Stations {loadingStations ? "(lädt…)" : ""}</span>
          <select
            value={selectedStationId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setTimeout(() => { if (v) onSelectStation(v); }, 0);
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
        </label>

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

        <div className="toolbar__status">
          <span className="pill">{statusText}</span>
        </div>
      </div>
    </header>
  );
}
