import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

type KpiTone = "default" | "critical" | "warn" | "good" | "rising" | "mod" | "high" | "vhigh" | "ok";

const toneClasses: Record<KpiTone, string> = {
  default: "border-l-narp-teal text-narp-teal",
  critical: "border-l-narp-critical text-narp-critical",
  warn: "border-l-narp-warn text-narp-warn",
  good: "border-l-narp-good text-narp-good",
  rising: "border-l-narp-rising text-narp-rising",
  mod: "border-l-narp-warn text-narp-warn",
  high: "border-l-narp-high text-narp-high",
  vhigh: "border-l-narp-critical text-narp-critical",
  ok: "border-l-narp-good text-narp-good",
};

interface KpiProps {
  icon: ComponentType<LucideProps>;
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: KpiTone;
  onClick?: () => void;
  className?: string;
}

export const Kpi = ({ icon: Icon, label, value, sub, tone = "default", onClick, className }: KpiProps) => {
  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group flex w-full items-start gap-3 border border-l-[3px] border-narp-line bg-card px-[18px] py-4 text-left",
        toneClasses[tone],
        onClick && "cursor-pointer transition-colors hover:bg-muted/30",
        className,
      )}
    >
      <Icon className="mt-0.5 h-[18px] w-[18px]" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-narp-slate">{label}</div>
        <div className={cn("narp-display mt-1 text-[28px] font-semibold leading-[1.1] text-narp-ink tabular-nums", onClick && "group-hover:underline")}>
          {value}
        </div>
        {sub && <div className="mt-1 text-xs text-narp-slate">{sub}</div>}
      </div>
    </Comp>
  );
};