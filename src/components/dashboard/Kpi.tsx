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
  icon?: ComponentType<LucideProps>;
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: KpiTone;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}

export const Kpi = ({ icon: Icon, label, value, sub, tone = "default", onClick, ariaLabel, className }: KpiProps) => {
  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-label={ariaLabel ?? (typeof label === "string" || typeof label === "number" ? `${label}: ${value}` : undefined)}
      className={cn(
        "group flex w-full items-start gap-3 border border-l-[3px] border-narp-line bg-card px-[18px] py-4 text-left font-narp-body",
        toneClasses[tone],
        onClick ? "cursor-pointer transition-colors duration-150 hover:bg-narp-paper" : "cursor-default",
        className,
      )}
    >
      {Icon && <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase leading-[1.3] tracking-[0.08em] text-narp-slate">{label}</div>
        <div className={cn("narp-display mt-0.5 break-words text-[28px] font-semibold leading-[1.1] text-narp-ink tabular-nums", onClick && "group-hover:underline")}>
          {value}
        </div>
        {sub && <div className="mt-1 text-xs leading-[1.4] text-narp-slate">{sub}</div>}
      </div>
    </Comp>
  );
};