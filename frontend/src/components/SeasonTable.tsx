import type { Visibility } from "./DataToggles";

type Hemisphere = "north" | "south";

export type SeasonRow = {
  year: string;
  season: string;
  tmin: number | null;
  tavg: number | null;
  tmax: number | null;
};

type Props = {
  rows: SeasonRow[];
  hemisphere: Hemisphere;
  visibility: Visibility;
};

function cell(v: number | null) {
  if (v == null) return "";
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(v);
}

function seasonKey(label: string): keyof Omit<Visibility, "year"> | null {
  const s = label.toLowerCase();
  if (s.startsWith("fr")) return "spring";
  if (s.startsWith("som")) return "summer";
  if (s.startsWith("her")) return "autumn";
  if (s.startsWith("win")) return "winter";
  return null;
}

export function SeasonTable({ rows, hemisphere, visibility }: Props) {
  if (!rows.length) return null;

  const showTmin = rows.some((row) => {
    const key = seasonKey(row.season);
    return key ? visibility[key].tmin : false;
  });
  const showTmax = rows.some((row) => {
    const key = seasonKey(row.season);
    return key ? visibility[key].tmax : false;
  });

  const visibleRows = rows.filter((row) => {
    const key = seasonKey(row.season);
    if (!key) return false;
    return visibility[key].tmin || visibility[key].tmax;
  });

  if (!visibleRows.length || (!showTmin && !showTmax)) return null;

  return (
    <section className="panel">
      <h2 className="panel__title">
        Saisonwerte ({hemisphere === "south" ? "Südhalbkugel" : "Nordhalbkugel"})
      </h2>

      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Jahr</th>
              <th>Saison</th>
              {showTmin && <th style={{ textAlign: "right" }}>tmin</th>}
              {showTmax && <th style={{ textAlign: "right" }}>tmax</th>}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r, i) => (
              <tr key={`${r.year}-${r.season}-${i}`}>
                <td>{r.year}</td>
                <td>{r.season}</td>
                {showTmin && <td style={{ textAlign: "right" }}>{cell(r.tmin)}</td>}
                {showTmax && <td style={{ textAlign: "right" }}>{cell(r.tmax)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
