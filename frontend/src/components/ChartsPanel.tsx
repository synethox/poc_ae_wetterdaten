import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { Visibility } from "./DataToggles";

type YearlyPoint = {
  date: string;
  tmin: number | null;
  tavg: number | null;
  tmax: number | null;
};

type SeasonRow = {
  year: string;
  season: string;
  tmin: number | null;
  tavg: number | null;
  tmax: number | null;
};

type Props = {
  stationName?: string;
  yearly: YearlyPoint[];
  seasons: SeasonRow[];
  visibility: Visibility;
  loading?: boolean;
};

function seasonKey(label: string): "spring" | "summer" | "autumn" | "winter" | null {
  const s = label.toLowerCase();
  if (s.startsWith("fr")) return "spring";
  if (s.startsWith("som")) return "summer";
  if (s.startsWith("her")) return "autumn";
  if (s.startsWith("win")) return "winter";
  return null;
}

export function ChartsPanel({ stationName, yearly, seasons, visibility, loading }: Props) {
  const byYear = new Map<string, any>();

  for (const y of yearly) {
    byYear.set(y.date, {
      date: y.date,
      year_tmin: y.tmin,
      year_tavg: y.tavg,
      year_tmax: y.tmax,
      spring_tmin: null,
      spring_tmax: null,
      summer_tmin: null,
      summer_tmax: null,
      autumn_tmin: null,
      autumn_tmax: null,
      winter_tmin: null,
      winter_tmax: null,
    });
  }

  for (const r of seasons) {
    const k = seasonKey(r.season);
    if (!k) continue;
    const row = byYear.get(r.year);
    if (!row) continue;
    row[`${k}_tmin`] = r.tmin;
    row[`${k}_tmax`] = r.tmax;
  }

  const chartData = [...byYear.values()].sort((a, b) => Number(a.date) - Number(b.date));

  const showAny =
    visibility.year.tmin ||
    visibility.year.tavg ||
    visibility.year.tmax ||
    visibility.spring.tmin ||
    visibility.spring.tmax ||
    visibility.summer.tmin ||
    visibility.summer.tmax ||
    visibility.autumn.tmin ||
    visibility.autumn.tmax ||
    visibility.winter.tmin ||
    visibility.winter.tmax;

  return (
    <section className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h2 className="panel__title" style={{ margin: 0 }}>
          Auswertung {stationName ? `(${stationName})` : ""}
          {loading ? " — lädt…" : ""}
        </h2>
      </div>

      {!chartData.length || !showAny ? (
        <p style={{ marginTop: 12 }}>Wähle Werte über die Checkboxen und lade Daten.</p>
      ) : (
        <div style={{ height: 360, marginTop: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip
                labelFormatter={(label) => `Jahr: ${String(label)}`}
                formatter={(value: any, name: any) => [value == null ? "" : `${value} °C`, name]}
              />
              <Legend />

              {visibility.year.tmax && (
                <Line type="monotone" dataKey="year_tmax" name="Jahr tmax" dot={false} stroke="#e11d48" strokeWidth={2} connectNulls={false} />
              )}
              {visibility.year.tavg && (
                <Line type="monotone" dataKey="year_tavg" name="Jahr tavg" dot={false} stroke="#64748b" strokeWidth={2} connectNulls={false} />
              )}
              {visibility.year.tmin && (
                <Line type="monotone" dataKey="year_tmin" name="Jahr tmin" dot={false} stroke="#2563eb" strokeWidth={2} connectNulls={false} />
              )}

              {visibility.spring.tmax && (
                <Line type="monotone" dataKey="spring_tmax" name="Frühling tmax" dot={false} stroke="#f97316" strokeWidth={2} connectNulls={false} />
              )}
              {visibility.spring.tmin && (
                <Line type="monotone" dataKey="spring_tmin" name="Frühling tmin" dot={false} stroke="#22c55e" strokeWidth={2} connectNulls={false} />
              )}

              {visibility.summer.tmax && (
                <Line type="monotone" dataKey="summer_tmax" name="Sommer tmax" dot={false} stroke="#fb7185" strokeWidth={2} connectNulls={false} />
              )}
              {visibility.summer.tmin && (
                <Line type="monotone" dataKey="summer_tmin" name="Sommer tmin" dot={false} stroke="#38bdf8" strokeWidth={2} connectNulls={false} />
              )}

              {visibility.autumn.tmax && (
                <Line type="monotone" dataKey="autumn_tmax" name="Herbst tmax" dot={false} stroke="#a855f7" strokeWidth={2} connectNulls={false} />
              )}
              {visibility.autumn.tmin && (
                <Line type="monotone" dataKey="autumn_tmin" name="Herbst tmin" dot={false} stroke="#14b8a6" strokeWidth={2} connectNulls={false} />
              )}

              {visibility.winter.tmax && (
                <Line type="monotone" dataKey="winter_tmax" name="Winter tmax" dot={false} stroke="#f59e0b" strokeWidth={2} connectNulls={false} />
              )}
              {visibility.winter.tmin && (
                <Line type="monotone" dataKey="winter_tmin" name="Winter tmin" dot={false} stroke="#60a5fa" strokeWidth={2} connectNulls={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}