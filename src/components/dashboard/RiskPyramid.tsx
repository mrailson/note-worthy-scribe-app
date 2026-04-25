import { cn } from "@/lib/utils";

type RiskPyramidRow = {
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
}: {
  rows: RiskPyramidRow[];
  total: number;
  onTierClick?: (tierKey: string) => void;
  excludeUnknown?: boolean;
}) => {
  const visibleRows = excludeUnknown ? rows.filter((row) => row.tier !== "Unknown") : rows;
  const maxN = Math.max(...visibleRows.map((row) => row.n), 1);

  return (
    <div className="space-y-2 font-narp-body">
      {visibleRows.map((row) => {
        const width = (row.n / maxN) * 100;
        const pct = row.pct ?? (total ? (row.n / total) * 100 : 0);
        const tierKey = tierKeys[row.tier] ?? row.tier;
        const clickable = !!row.n && !!onTierClick;

        return (
          <button
            key={row.tier}
            type="button"
            disabled={!clickable}
            onClick={() => onTierClick?.(tierKey)}
            className={cn("group w-full text-left disabled:cursor-not-allowed disabled:opacity-50")}
          >
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-semibold text-narp-ink">
                {row.tier} <span className="font-normal text-narp-slate">· {row.band}</span>
              </span>
              <span className="tabular-nums text-narp-ink group-enabled:group-hover:underline">
                {row.n.toLocaleString("en-GB")} <span className="text-narp-slate">({pct.toFixed(1)}%)</span>
              </span>
            </div>
            <div className="h-5 overflow-hidden bg-narp-paper">
              <div className="h-full transition-opacity group-enabled:group-hover:opacity-80" style={{ width: `${width}%`, backgroundColor: row.colour }} />
            </div>
          </button>
        );
      })}
    </div>
  );
};