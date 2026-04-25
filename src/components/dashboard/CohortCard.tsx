import { ChevronRight, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { dashboardTokens } from "./tokens";

export type DashboardCohort = {
  id: string;
  label: string;
  definition: string;
  n: number;
  weeklyTarget: number;
  intervention: string;
  colour: string;
};

export const CohortCard = ({
  cohort,
  selected = false,
  onClick,
  onSendToWorklist,
  totalListSize,
  permissions = {},
  children,
}: {
  cohort: DashboardCohort;
  selected?: boolean;
  onClick: () => void;
  onSendToWorklist?: () => void;
  totalListSize: number;
  permissions?: { can_create_worklist?: boolean };
  children?: React.ReactNode;
}) => {
  const pctOfList = totalListSize ? ((cohort.n / totalListSize) * 100).toFixed(1) : null;
  const accentTeal = "#0b4f6c";

  return (
    <div
      className={cn(
        "flex min-h-[180px] flex-col border border-l-[3px] p-0 text-left font-narp-body transition-colors duration-150",
        selected ? "bg-narp-paper text-narp-ink" : cn("bg-card hover:bg-narp-paper hover:border-slate-300", dashboardTokens.line, dashboardTokens.ink),
      )}
      style={selected ? { borderColor: accentTeal, borderLeftColor: cohort.colour, borderBottomWidth: 2, boxShadow: `0 0 0 1px ${accentTeal}` } : { borderLeftColor: cohort.colour }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={`Select cohort: ${cohort.label}`}
        aria-pressed={selected}
        className="flex flex-1 flex-col gap-1.5 bg-transparent px-4 pb-3 pt-3.5 text-left text-inherit"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0" style={{ backgroundColor: cohort.colour }} />
          <span className={cn("min-w-0 truncate text-[11px] font-semibold uppercase leading-[1.3] tracking-[0.06em]", selected ? "text-[#0b4f6c]" : dashboardTokens.muted)}>{cohort.definition}</span>
          {children}
        </div>
        <div className="narp-display mt-0.5 text-lg font-medium leading-[1.25]">{cohort.label}</div>
        <p className={cn("text-xs leading-[1.45]", selected ? "text-slate-600" : dashboardTokens.ink2)}>{cohort.intervention}</p>
        <div className="mt-auto flex items-baseline justify-between pt-2">
          <span className="narp-display text-[26px] font-semibold leading-none tabular-nums">{cohort.n.toLocaleString("en-GB")}</span>
          <span className={cn("text-[11px] tabular-nums", selected ? "text-slate-600" : dashboardTokens.muted)}>
            {cohort.weeklyTarget}/week{pctOfList && <> · {pctOfList}% of list</>}
          </span>
        </div>
      </button>
      {selected && (
        <div className="flex items-center gap-2 border-t border-slate-200 bg-transparent px-3 py-2.5">
          {permissions.can_create_worklist && onSendToWorklist && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSendToWorklist();
              }}
              className={cn("inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-xs font-medium", dashboardTokens.ink, dashboardTokens.line, "bg-card hover:bg-narp-paper")}
            >
              <Send className="h-3 w-3" /> Send to worklist
            </button>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[#0b4f6c]">
            View details <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      )}
    </div>
  );
};

export default CohortCard;