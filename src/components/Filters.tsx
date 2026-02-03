
type Props = {
  lat: number;
  lon: number;
  radiusKm: number;
  limit: number;
  from: string;
  to: string;
  onChange: (patch: Partial<Props>) => void;
  onSearch: () => void;
};

export function Filters(props: Props) {
  const { lat, lon, radiusKm, limit, from, to, onChange, onSearch } = props;

  return (
    <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>Filter</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(180px, 1fr))", gap: 12 }}>
        <label>
          Breitengrad (lat)
          <input
            type="number"
            step="0.0001"
            value={lat}
            onChange={(e) => onChange({ lat: Number(e.target.value) } as any)}
            style={{ width: "100%" }}
          />
        </label>

        <label>
          Längengrad (lon)
          <input
            type="number"
            step="0.0001"
            value={lon}
            onChange={(e) => onChange({ lon: Number(e.target.value) } as any)}
            style={{ width: "100%" }}
          />
        </label>

        <label>
          Radius (km)
          <input
            type="number"
            step="1"
            min="1"
            max="100"
            value={radiusKm}
            onChange={(e) => {
              const value = Math.min(100, Math.max(1, Number(e.target.value)));
              onChange({ radiusKm: value } as any);
            }}
            style={{ width: "100%" }}
          />
        </label>

        <label>
          Anzahl Stationen (limit)
          <input
            type="number"
            step="1"
            min="1"
            max="10"
            value={limit}
            onChange={(e) => {
              const value = Math.min(10, Math.max(1, Number(e.target.value)));
              onChange({ limit: value } as any);
            }}
            style={{ width: "100%" }}
          />
        </label>

        <label>
          Zeitraum von
          <input
            type="date"
            value={from}
            onChange={(e) => onChange({ from: e.target.value } as any)}
            style={{ width: "100%" }}
          />
        </label>

        <label>
          Zeitraum bis
          <input
            type="date"
            value={to}
            onChange={(e) => onChange({ to: e.target.value } as any)}
            style={{ width: "100%" }}
          />
        </label>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button onClick={onSearch}>Stationen suchen</button>
      </div>
    </section>
  );
}
