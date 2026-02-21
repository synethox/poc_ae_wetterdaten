import { useMemo, useState, useEffect } from "react";
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

function normalizeSearchParams(radiusKm: number, limit: number, from: string, to: string) {
  const clampedRadiusKm = Math.max(1, Math.min(100, radiusKm));
  const clampedLimit = Math.max(1, Math.min(10, limit));
  if (from > to) {
    throw new Error("Startdatum darf nicht nach Enddatum liegen.");
  }
  return { clampedRadiusKm, clampedLimit };
}

export default function App() {
  const [lat, setLat] = useState<number>(48.1372);
  const [lon, setLon] = useState<number>(11.5756);
  const [radiusKm, setRadiusKm] = useState<number>(50);
  const [limit, setLimit] = useState<number>(10);
  const [from, setFrom] = useState<string>(daysAgoISO(30));
  const [to, setTo] = useState<string>(todayISO());

  const [view, setView] = useState<"chart" | "table" >("chart");

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

  // UX: Buttons nur aktiv, wenn sinnvoll
  const canSearch =
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    radiusKm > 0 &&
    limit > 0 &&
    from <= to &&
    !loadingStations;

  const canLoadTemps =
    !!selectedStationId &&
    from <= to &&
    !loadingStations &&
    !loadingTemps;

  // UX: Fehler verschwindet, sobald User etwas ändert
  useEffect(() => {
    setError(null);
  }, [lat, lon, radiusKm, limit, from, to, selectedStationId, view]);

  // UX: Wenn Zeitraum geändert wird, alte Ergebnisse zurücksetzen (simpel & sicher)
  useEffect(() => {
    setStations([]);
    setSelectedStationId(null);
    setActiveStationId(null);
    setTemps([]);
  }, [from, to]);

  const resetAll = () => {
    setError(null);
    setStations([]);
    setSelectedStationId(null);
    setTemps([]);
    setView("chart");
    setActiveStationId(null);
  };

  const onSearchStations = async () => {
    try {
      setError(null);
      setLoadingStations(true);

      const { clampedRadiusKm, clampedLimit } = normalizeSearchParams(radiusKm, limit, from, to);

      const res = await searchStations({
        lat,
        lon,
        radiusKm: clampedRadiusKm,
        limit: clampedLimit,
        from,
        to,
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
  };

  const onLoadTemperatures = async () => {
    if (!selectedStationId) return;

    try {
      setError(null);
      setLoadingTemps(true);
      setTemps([]);

      const res = await fetchTemperatures({ stationId: selectedStationId, from, to });
      setTemps(res);

      if (res.length === 0) {
        setError("Für diese Station sind im gewählten Zeitraum keine Daten verfügbar.");
        setActiveStationId(null);
        return;
      }

      setActiveStationId(selectedStationId);
    } catch (e: any) {
      setError(e?.message ?? "Fehler beim Laden der Temperaturdaten");
    } finally {
      setLoadingTemps(false);
    }
  };

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
        canLoad={canLoadTemps}
        canSearch={canSearch}
        onChange={(patch) => {
          if (patch.lat !== undefined) setLat(patch.lat);
          if (patch.lon !== undefined) setLon(patch.lon);

          if (patch.radiusKm !== undefined) {
            setRadiusKm(Math.min(100, Math.max(1, patch.radiusKm)));
          }
          if (patch.limit !== undefined) {
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

      {error && <div className="errorBanner">{error}</div>}

      <main className="content">
        {view === "chart" && (
          <ChartsPanel stationName={activeStation?.name} data={temps} loading={loadingTemps} />
        )}

        {view === "table" && <TemperatureTable data={temps} />}

        
      </main>
    </div>
  );
}

