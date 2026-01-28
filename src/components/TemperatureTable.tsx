import type { TemperaturePoint } from "../api/types";

type Props = {
  data: TemperaturePoint[];
};

export function TemperatureTable({ data }: Props) {
  if (!data.length) {
    return <div className="panel">Keine Daten geladen.</div>;
  }

  return (
    <div className="panel">
      <h2 className="panel__title">Temperaturdaten (Tabelle)</h2>

      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Datum</th>
              <th style={{ textAlign: "right" }}>Tmin</th>
              <th style={{ textAlign: "right" }}>Tavg</th>
              <th style={{ textAlign: "right" }}>Tmax</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.date}>
                <td>{r.date}</td>
                <td style={{ textAlign: "right" }}>{r.tmin ?? ""}</td>
                <td style={{ textAlign: "right" }}>{r.tavg ?? ""}</td>
                <td style={{ textAlign: "right" }}>{r.tmax ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
