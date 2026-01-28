import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from "recharts";
import type { TemperaturePoint } from "../api/types";
import { exportCsv } from "../utils/exportCsv";

type Props = {
  stationName?: string;
  data: TemperaturePoint[];
  loading?: boolean;
};

function formatDateLabel(iso: string) {
  // ISO: YYYY-MM-DD -> DD.MM
  const [y, m, d] = iso.split("-");
  return `${d}.${m}`;
}

export function ChartsPanel({ stationName, data, loading }: Props) {
  const canExport = data.length > 0;

  return (
    <section className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h2 className="panel__title" style={{ margin: 0 }}>
          Auswertung {stationName ? `(${stationName})` : ""}
          {loading ? " — lädt…" : ""}
        </h2>

        <button
          onClick={() => exportCsv("temperatures.csv", data)}
          disabled={!canExport}
          title={!canExport ? "Keine Daten zum Export" : "CSV exportieren"}
          className="exportBtn"
          type="button"
        >
          Export CSV
        </button>
      </div>

      {!data.length ? (
        <p style={{ marginTop: 12 }}>Wähle eine Station, dann „Daten laden“.</p>
      ) : (
        <div style={{ height: 360, marginTop: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateLabel}
                minTickGap={20}
                interval="preserveStartEnd"
              />
              <YAxis />
              <Tooltip
                labelFormatter={(label) => `Datum: ${label}`}
                formatter={(value: any, name: any) => [`${value} °C`, name]}
              />
              <Legend />

              {/* Farben nach Wunsch */}
              <Line type="monotone" dataKey="tmax" name="tmax" dot={false} stroke="#e11d48" strokeWidth={2} />
              <Line type="monotone" dataKey="tavg" name="tavg" dot={false} stroke="#64748b" strokeWidth={2} />
              <Line type="monotone" dataKey="tmin" name="tmin" dot={false} stroke="#2563eb" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
