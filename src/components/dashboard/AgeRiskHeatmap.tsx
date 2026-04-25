import { cn } from "@/lib/utils";
import { dashboardTokens } from "./tokens";

type AgeRiskRow = {
  age: string;
  VeryHigh: number;
  High: number;
  Moderate: number;
  Rising: number;
  Low: number;
};

const tiers = [
  { key: "very_high", label: "Very High", field: "VeryHigh", colour: "var(--narp-critical)" },
  { key: "high", label: "High", field: "High", colour: "var(--narp-high)" },
  { key: "moderate", label: "Moderate", field: "Moderate", colour: "var(--narp-warn)" },
  { key: "rising", label: "Rising", field: "Rising", colour: "var(--narp-rising)" },
  { key: "low", label: "Low", field: "Low", colour: "var(--narp-good)", subtle: true },
] as const;

const hsla = (token: string, alpha: number) => `hsl(${token} / ${alpha})`;

export const AgeRiskHeatmap = ({
  data,
  onCellClick,
  showLegend = true,
}: {
  data: AgeRiskRow[];
  onCellClick?: (ageBand: string, tier: string) => void;
  showLegend?: boolean;
}) => {
  const columnMax = tiers.reduce<Record<string, number>>((acc, tier) => {
    acc[tier.field] = Math.max(...data.map((row) => row[tier.field] as number), 1);
    return acc;
  }, {});

  return (
    <div className="font-narp-body">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs tabular-nums">
          <thead>
            <tr>
              <th className={cn("border-b px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em]", dashboardTokens.line, dashboardTokens.paper, dashboardTokens.muted)}>Age band</th>
              {tiers.map((tier) => <th key={tier.key} className={cn("border-b px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.08em]", dashboardTokens.line, dashboardTokens.paper, dashboardTokens.muted)}>{tier.label}</th>)}
              <th className={cn("border-b px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em]", dashboardTokens.line, dashboardTokens.paper, dashboardTokens.muted)}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const total = tiers.reduce((sum, tier) => sum + (row[tier.field] as number), 0);

              return (
                <tr key={row.age}>
                  <td className={cn("border-b p-3 text-[13px] font-semibold", dashboardTokens.line, dashboardTokens.ink)}>{row.age}</td>
                  {tiers.map((tier) => {
                    const value = row[tier.field] as number;
                    const intensity = Math.min(value / columnMax[tier.field], 1);
                    const subtle = "subtle" in tier && tier.subtle;
                    const background = subtle ? hsla(tier.colour, intensity * 0.12) : hsla(tier.colour, intensity * 0.85 + 0.05);
                    const useLightText = !subtle && intensity > 0.55;

                    return (
                      <td key={tier.key} className={cn("border-b p-0 text-center text-[13px]", dashboardTokens.line)} style={{ backgroundColor: background }}>
                      <button
                        type="button"
                        disabled={!value || !onCellClick}
                        onClick={() => onCellClick?.(row.age, tier.key)}
                        aria-label={`${value.toLocaleString("en-GB")} patients`}
                        className={cn(
                          "block h-full w-full bg-transparent p-3 text-center tabular-nums disabled:cursor-default disabled:no-underline enabled:hover:brightness-90",
                          useLightText ? "text-primary-foreground" : dashboardTokens.ink,
                        )}
                        style={{ fontWeight: intensity > 0.4 ? 600 : 400 }}
                      >
                        {value.toLocaleString("en-GB")}
                      </button>
                      </td>
                    );
                  })}
                  <td className={cn("border-b p-3 text-right text-[13px] tabular-nums", dashboardTokens.line, dashboardTokens.muted)}>{total.toLocaleString("en-GB")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showLegend && (
        <div className={cn("mt-3 flex items-center gap-3 border-t border-dashed pt-2.5 text-[11px]", dashboardTokens.line, dashboardTokens.muted)}>
          <span>Cell intensity scaled within each column</span>
          <span className="ml-auto">Click a cell with patients to drill in</span>
        </div>
      )}
    </div>
  );
};

export default AgeRiskHeatmap;