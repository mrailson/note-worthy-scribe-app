type AgeRiskRow = {
  age: string;
  VeryHigh: number;
  High: number;
  Moderate: number;
  Rising: number;
  Low: number;
};

const tiers = [
  { key: "very_high", label: "Very High", field: "VeryHigh", colour: "#7f1d1d" },
  { key: "high", label: "High", field: "High", colour: "#b91c1c" },
  { key: "moderate", label: "Moderate", field: "Moderate", colour: "#d97706" },
  { key: "rising", label: "Rising", field: "Rising", colour: "#ca8a04" },
  { key: "low", label: "Low", field: "Low", colour: "#15803d", subtle: true },
] as const;

const hexToRgba = (hex: string, alpha: number) => {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export const AgeRiskHeatmap = ({
  data,
  onCellClick,
  showLegend = true,
}: {
  data: AgeRiskRow[];
  onCellClick?: (ageBand: string, tier: string) => void;
  showLegend?: boolean;
}) => {
  const maxByField = (field: keyof AgeRiskRow) => Math.max(...data.map((row) => row[field] as number), 1);

  return (
    <div className="font-narp-body">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="uppercase tracking-wide text-narp-slate">
              <th className="border-b p-2 text-left">Age band</th>
              {tiers.map((tier) => <th key={tier.key} className="border-b p-2">{tier.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.age}>
                <td className="border-b p-3 font-semibold text-narp-ink">{row.age}</td>
                {tiers.map((tier) => {
                  const value = row[tier.field] as number;
                  const intensity = Math.min(value / maxByField(tier.field), 1);
                  const subtle = "subtle" in tier && tier.subtle;
                  const background = subtle ? hexToRgba(tier.colour, intensity * 0.12) : hexToRgba(tier.colour, intensity * 0.85 + 0.05);
                  const readableDark = subtle || intensity <= 0.5;

                  return (
                    <td key={tier.key} className="border-b p-0" style={{ backgroundColor: background }}>
                      <button
                        type="button"
                        disabled={!value || !onCellClick}
                        onClick={() => onCellClick?.(row.age, tier.key)}
                        className="h-full w-full p-3 text-center tabular-nums disabled:cursor-not-allowed disabled:no-underline enabled:hover:underline"
                        style={{ color: readableDark ? "#0f172a" : "#ffffff", fontWeight: intensity > 0.4 ? 600 : 400 }}
                      >
                        {value.toLocaleString("en-GB")}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showLegend && (
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-narp-slate">
          {tiers.map((tier) => (
            <span key={tier.key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5" style={{ backgroundColor: tier.colour }} /> {tier.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};