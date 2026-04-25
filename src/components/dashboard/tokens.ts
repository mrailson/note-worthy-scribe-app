export const dashboardTokens = {
  ink: "text-narp-ink",
  ink2: "text-narp-ink-2",
  muted: "text-narp-slate",
  paper: "bg-narp-paper",
  paperHover: "hover:bg-narp-paper",
  card: "bg-card",
  line: "border-narp-line",
  accent: "text-narp-teal",
  accentBorder: "border-narp-teal",
  ok: "text-narp-good",
  warn: "text-narp-warn",
  high: "text-narp-high",
  vhigh: "text-narp-critical",
} as const;

export const kpiToneClasses = {
  default: "border-l-narp-teal text-narp-teal",
  critical: "border-l-narp-critical text-narp-critical",
  warn: "border-l-narp-warn text-narp-warn",
  good: "border-l-narp-good text-narp-good",
  rising: "border-l-narp-rising text-narp-rising",
  mod: "border-l-narp-warn text-narp-warn",
  high: "border-l-narp-high text-narp-high",
  vhigh: "border-l-narp-critical text-narp-critical",
  ok: "border-l-narp-good text-narp-good",
} as const;

export type KpiTone = keyof typeof kpiToneClasses;