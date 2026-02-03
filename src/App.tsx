import { useMemo, useState } from "react";
import { Toolbar } from "./components/Toolbar";
import { ChartsPanel } from "./components/ChartsPanel";
import { TemperatureTable } from "./components/TemperatureTable";
import { searchStations, fetchTemperatures } from "./api/client";
import type { Station, TemperaturePoint } from "./api/types";
import "./App.css";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function App() {
  // Filter state
  const [lat, setLat] = useState<number>(48.1372);
  const [lon, setLon] = useState<number>(11.5756);
  const [radiusKm, setRadiusKm] = useState<number>(50);
  const [limit, setLimit] = useState<number>(10);
  const [from, setFrom] = useState<string>(daysAgoISO(30));
  const [to, setTo] = useState<string>(todayISO());

  // View state (Chart / Tabelle / Map)
  const [view, setView] = useState<"chart" | "table" | "map">("chart");

  // Data state
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
  const [error, setError] = useState<string | null>(null);

  const resetAll = () => {
    setError(null);
    setStations([]);
    setSelectedStationId(null);
    setTemps([]);
    setView("chart");
    setActiveStationId(null);
  };

  const onSearchStations = async () => {
    setError(null);
    setLoadingStations(true);
    setStations([]);
    setSelectedStationId(null);
    setActiveStationId(null);
    setTemps([]);

    try {
      // Validierung: Limit auf 10, Radius auf 100km begrenzen
      const clampedRadiusKm = Math.min(100, Math.max(1, radiusKm));
      const clampedLimit = Math.min(10, Math.max(1, limit));
      
      // Werte aktualisieren falls sie außerhalb der Limits waren
      if (clampedRadiusKm !== radiusKm) setRadiusKm(clampedRadiusKm);
      if (clampedLimit !== limit) setLimit(clampedLimit);
      
      const res = await searchStations({ lat, lon, radiusKm: clampedRadiusKm, limit: clampedLimit });
      setStations(res);
    } catch (e: any) {
      setError(e?.message ?? "Fehler bei der Stationssuche");
    } finally {
      setLoadingStations(false);
    }
  };

  const onSelectStation = (stationId: string) => {
    setSelectedStationId(stationId);
  };
  const onLoadTemperatures = async () => {
    if (!selectedStationId) return;

    if (from > to) {
      setError("Startdatum darf nicht nach Enddatum liegen.");
      return;
    }

    setError(null);
    setLoadingTemps(true);
    setTemps([]);

    try {
      const res = await fetchTemperatures({ stationId: selectedStationId, from, to });
      setTemps(res);
      setActiveStationId(selectedStationId);
    } catch (e: any) {
      setError(e?.message ?? "Fehler beim Laden der Temperaturdaten");
    } finally {
      setLoadingTemps(false);
    }
};


  
  const canLoad = !!selectedStationId && !loadingStations && !loadingTemps && from <= to;

  return (
    <div className="appShell">
      <Toolbar
        lat={lat}
        lon={lon}
        radiusKm={radiusKm}
        limit={limit}
        from={from}
        to={to}
        stations={stations}
        selectedStationId={selectedStationId}
        view={view}
        loadingStations={loadingStations}
        loadingTemps={loadingTemps}
        onLoadTemperatures={onLoadTemperatures}
        canLoad={canLoad}
        onChange={(patch) => {
          if (patch.lat !== undefined) setLat(patch.lat);
          if (patch.lon !== undefined) setLon(patch.lon);
          if (patch.radiusKm !== undefined) {
            // Radius auf 100km begrenzen
            setRadiusKm(Math.min(100, Math.max(1, patch.radiusKm)));
          }
          if (patch.limit !== undefined) {
            // Limit auf 10 begrenzen
            setLimit(Math.min(10, Math.max(1, patch.limit)));
          }
          if (patch.from !== undefined) setFrom(patch.from);
          if (patch.to !== undefined) setTo(patch.to);
        }}
        onSearchStations={onSearchStations}
        onSelectStation={onSelectStation}
        onReset={resetAll}
        onSetView={setView}
        
        
        />

      {error && (
        <div className="errorBanner">
          {error}
        </div>
      )}

      <main className="content">
        {view === "chart" && (
          <ChartsPanel stationName={activeStation?.name} data={temps} loading={loadingTemps} />
        )}

        {view === "table" && (
          <TemperatureTable data={temps} />
        )}

        {view === "map" && (
          <div className="panel">
            <h2 className="panel__title">Map View</h2>
            <p>
              Placeholder: Hier können wir später Leaflet einbauen (Kreis um Standort + Stationen als Marker).
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
