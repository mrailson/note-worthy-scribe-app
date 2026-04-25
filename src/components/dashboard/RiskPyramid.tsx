import { cn } from "@/lib/utils";
import { dashboardTokens } from "./tokens";

type RiskPyramidRow = {
  key?: string;
  tier: string;
  band: string;
  n: number;
  pct?: number;
  colour: string;
};

const tierKeys: Record<string, string> = {
  "Very High": "tier_very_high",
  High: "tier_high",
  Moderate: "tier_moderate",
  Rising: "tier_rising",
  Low: "tier_low",
  Unknown: "tier_unknown",
};

export const RiskPyramid = ({
  rows,
  total,
  onTierClick,
  excludeUnknown = true,
  maxN,
}: {
  rows: RiskPyramidRow[];
  total: number;
  onTierClick?: (tierKey: string) => void;
  excludeUnknown?: boolean;
  maxN?: number;
}) => {
  const visibleRows = excludeUnknown ? rows.filter((row) => (row.key ?? tierKeys[row.tier] ?? row.tier) !== "tier_unknown") : rows;
  const scaleMax = maxN ?? Math.max(...visibleRows.map((row) => row.n), 1);
  const unknownRow = excludeUnknown ? rows.find((row) => (row.key ?? tierKeys[row.tier] ?? row.tier) === "tier_unknown") : undefined;

  return (
    <div className="space-y-2 font-narp-body">
      {visibleRows.map((row) => {
        const width = (row.n / scaleMax) * 100;
        const pct = row.pct ?? (total ? (row.n / total) * 100 : 0);
        const tierKey = row.key ?? tierKeys[row.tier] ?? row.tier;
        const clickable = !!row.n && !!onTierClick;

        return (
          <button
            key={tierKey}
            type="button"
            aria-label={`Drill into ${row.tier} risk tier — ${row.n.toLocaleString("en-GB")} patients`}
            disabled={!clickable}
            onClick={() => onTierClick?.(tierKey)}
            className="group w-full bg-transparent p-0 text-left disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span>
                <span className={cn("font-semibold", dashboardTokens.ink)}>{row.tier}</span>{" "}
                <span className={cn("font-normal", dashboardTokens.muted)}>· {row.band}</span>
              </span>
              <span className={cn("font-medium tabular-nums group-enabled:group-hover:underline", dashboardTokens.ink2)}>
                {row.n.toLocaleString("en-GB")} <span className={cn("font-normal", dashboardTokens.muted)}>({pct.toFixed(1)}%)</span>
              </span>
            </div>
            <div className={cn("h-6 overflow-hidden", dashboardTokens.paper)}>
              <div className="h-full transition-opacity group-enabled:group-hover:opacity-80" style={{ width: `${width}%`, backgroundColor: row.colour }} />
            </div>
          </button>
        );
      })}
      {unknownRow && unknownRow.n > 0 && (
        <div className={cn("mt-4 border-t border-dashed pt-3 text-[11px] leading-5", dashboardTokens.line, dashboardTokens.muted)}>
          {unknownRow.n.toLocaleString("en-GB")} patients ({(unknownRow.pct ?? (total ? (unknownRow.n / total) * 100 : 0)).toFixed(1)}%) have no PoA — typically new registrations or insufficient activity history.
        </div>
      )}
    </div>
  );
};

export default RiskPyramid;