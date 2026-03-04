import type { Visibility } from "./DataToggles";

type YearlyPoint = {
  date: string;
  tmin: number | null;
  tavg: number | null;
  tmax: number | null;
};

type Props = {
  data: YearlyPoint[];
  visibility: Visibility["year"];
};

function cell(v: number | null) {
  if (v == null) return "";
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(v);
}

export function TemperatureTable({ data, visibility }: Props) {
  const showTmin = visibility.tmin;
  const showTavg = visibility.tavg;
  const showTmax = visibility.tmax;

  if (!showTmin && !showTavg && !showTmax) return null;

  return (
    <section className="panel">
      <h2 className="panel__title">Jahreswerte</h2>

      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Jahr</th>
              {showTmin && <th style={{ textAlign: "right" }}>tmin</th>}
              {showTavg && <th style={{ textAlign: "right" }}>tavg</th>}
              {showTmax && <th style={{ textAlign: "right" }}>tmax</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.date}>
                <td>{r.date}</td>
                {showTmin && <td style={{ textAlign: "right" }}>{cell(r.tmin)}</td>}
                {showTavg && <td style={{ textAlign: "right" }}>{cell(r.tavg)}</td>}
                {showTmax && <td style={{ textAlign: "right" }}>{cell(r.tmax)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
