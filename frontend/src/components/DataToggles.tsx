type YearVis = { tmin: boolean; tavg: boolean; tmax: boolean };
type SeasonVis = { tmin: boolean; tmax: boolean };

export type Visibility = {
  year: YearVis;
  spring: SeasonVis;
  summer: SeasonVis;
  autumn: SeasonVis;
  winter: SeasonVis;
};

type Props = {
  value: Visibility;
  onChange: (next: Visibility) => void;
  disabledYear?: boolean;
  disabledSeasons?: boolean;
};

export function DataToggles({ value, onChange, disabledYear, disabledSeasons }: Props) {
  const setYear = (k: keyof YearVis) =>
    onChange({ ...value, year: { ...value.year, [k]: !value.year[k] } });

  const setSeason = (s: keyof Omit<Visibility, "year">, k: keyof SeasonVis) =>
    onChange({ ...value, [s]: { ...value[s], [k]: !value[s][k] } as any });

  return (
    <div style={{ display: "inline-block", marginTop: 8 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "110px 70px 70px 70px",
          gap: 8,
          alignItems: "center",
          padding: 10,
          border: "1px solid #cbd5e1",
          borderRadius: 12,
          background: "#ffffff",
          color: "#0f172a",
        }}
      >
        <div />
        <div style={{ fontSize: 12, opacity: 0.9, color: "#475569" }}>TMIN</div>
        <div style={{ fontSize: 12, opacity: 0.9, color: "#475569" }}>TAVG</div>
        <div style={{ fontSize: 12, opacity: 0.9, color: "#475569" }}>TMAX</div>

        <div style={{ fontSize: 12, opacity: 0.9, color: "#475569" }}>Jahr</div>
        <input
          type="checkbox"
          checked={value.year.tmin}
          onChange={() => setYear("tmin")}
          disabled={!!disabledYear}
        />
        <input
          type="checkbox"
          checked={value.year.tavg}
          onChange={() => setYear("tavg")}
          disabled={!!disabledYear}
        />
        <input
          type="checkbox"
          checked={value.year.tmax}
          onChange={() => setYear("tmax")}
          disabled={!!disabledYear}
        />

        <div style={{ fontSize: 12, opacity: 0.9, color: "#475569" }}>Frühling</div>
        <input
          type="checkbox"
          checked={value.spring.tmin}
          onChange={() => setSeason("spring", "tmin")}
          disabled={!!disabledSeasons}
        />
        <div />
        <input
          type="checkbox"
          checked={value.spring.tmax}
          onChange={() => setSeason("spring", "tmax")}
          disabled={!!disabledSeasons}
        />

        <div style={{ fontSize: 12, opacity: 0.9, color: "#475569" }}>Sommer</div>
        <input
          type="checkbox"
          checked={value.summer.tmin}
          onChange={() => setSeason("summer", "tmin")}
          disabled={!!disabledSeasons}
        />
        <div />
        <input
          type="checkbox"
          checked={value.summer.tmax}
          onChange={() => setSeason("summer", "tmax")}
          disabled={!!disabledSeasons}
        />

        <div style={{ fontSize: 12, opacity: 0.9, color: "#475569" }}>Herbst</div>
        <input
          type="checkbox"
          checked={value.autumn.tmin}
          onChange={() => setSeason("autumn", "tmin")}
          disabled={!!disabledSeasons}
        />
        <div />
        <input
          type="checkbox"
          checked={value.autumn.tmax}
          onChange={() => setSeason("autumn", "tmax")}
          disabled={!!disabledSeasons}
        />

        <div style={{ fontSize: 12, opacity: 0.9, color: "#475569" }}>Winter</div>
        <input
          type="checkbox"
          checked={value.winter.tmin}
          onChange={() => setSeason("winter", "tmin")}
          disabled={!!disabledSeasons}
        />
        <div />
        <input
          type="checkbox"
          checked={value.winter.tmax}
          onChange={() => setSeason("winter", "tmax")}
          disabled={!!disabledSeasons}
        />
      </div>
    </div>
  );
}
