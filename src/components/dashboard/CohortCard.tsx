import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

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
  selected,
  onClick,
  onSendToWorklist,
  totalListSize,
  permissions,
  children,
}: {
  cohort: DashboardCohort;
  selected: boolean;
  onClick: () => void;
  onSendToWorklist?: () => void;
  totalListSize: number;
  permissions: { can_create_worklist?: boolean };
  children?: React.ReactNode;
}) => {
  const pct = totalListSize ? (cohort.n / totalListSize) * 100 : 0;

  return (
    <div
      className={cn(
        "border border-l-[3px] bg-card p-4 text-left font-narp-body",
        selected ? "border-narp-ink bg-narp-ink text-primary-foreground" : "border-narp-line hover:border-narp-slate",
      )}
      style={{ borderLeftColor: cohort.colour }}
    >
      <button type="button" onClick={onClick} className="w-full text-left">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0" style={{ backgroundColor: cohort.colour }} />
          <span className={cn("text-[10px] font-semibold uppercase tracking-[0.16em]", selected ? "text-primary-foreground/70" : "text-narp-slate")}>{cohort.definition}</span>
          {children}
        </div>
        <div className="mt-1 font-semibold">{cohort.label}</div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="narp-display text-2xl font-semibold tabular-nums hover:underline">{cohort.n.toLocaleString("en-GB")}</span>
          <span className={cn("text-xs tabular-nums", selected ? "text-primary-foreground/70" : "text-narp-slate")}>{cohort.weeklyTarget}/week · {pct.toFixed(1)}%</span>
        </div>
        <p className={cn("mt-2 text-xs leading-[1.45]", selected ? "text-primary-foreground/75" : "text-narp-ink-2")}>{cohort.intervention}</p>
      </button>
      {permissions.can_create_worklist && onSendToWorklist && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSendToWorklist();
          }}
          className={cn("mt-3 inline-flex items-center gap-1.5 border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]", selected ? "border-primary-foreground/25 text-primary-foreground hover:bg-primary-foreground/10" : "border-narp-line text-narp-teal hover:bg-narp-paper")}
        >
          <Send className="h-3 w-3" /> Send to worklist
        </button>
      )}
    </div>
  );
};