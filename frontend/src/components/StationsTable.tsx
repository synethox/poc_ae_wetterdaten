import type { Station } from "../api/types";

type Props = {
  stations: Station[];
  selectedStationId: string | null;
  onSelect: (stationId: string) => void;
  loading?: boolean;
};

export function StationsTable({ stations, selectedStationId, onSelect, loading }: Props) {
  return (
    <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>Stationen {loading ? "(lädt…)" : ""}</h2>

      {!stations.length ? (
        <p style={{ margin: 0 }}>Noch keine Ergebnisse. Starte eine Suche.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>ID</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Name</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Distanz (km)</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Lat</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Lon</th>
              </tr>
            </thead>
            <tbody>
              {stations.map(s => {
                const selected = s.id === selectedStationId;
                return (
                  <tr
                    key={s.id}
                    onClick={() => onSelect(s.id)}
                    style={{ cursor: "pointer", background: selected ? "#f3f6ff" : undefined }}
                  >
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{s.id}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{s.name}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee", textAlign: "right" }}>{s.distanceKm.toFixed(1)}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee", textAlign: "right" }}>{s.lat.toFixed(4)}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee", textAlign: "right" }}>{s.lon.toFixed(4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
