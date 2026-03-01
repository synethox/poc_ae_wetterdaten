import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from "recharts";
import type { TemperaturePoint } from "../api/types";


type Props = {
  stationName?: string;
  data: TemperaturePoint[];
  loading?: boolean;
};

export function ChartsPanel({ stationName, data, loading }: Props) {
  

  return (
    <section className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h2 className="panel__title" style={{ margin: 0 }}>
          Auswertung {stationName ? `(${stationName})` : ""}
          {loading ? " — lädt…" : ""}
        </h2>

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
                tickFormatter={(v: string) => {
                  const s = String(v);
                  const ym = s.length >= 7 ? s.slice(0, 7) : s; 
                  const [y, m] = ym.split("-");
                  if (!y || !m) return s;
                   return `${m}.${y}`;;}}
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
