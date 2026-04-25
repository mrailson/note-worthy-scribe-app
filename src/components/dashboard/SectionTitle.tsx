import type { ReactNode } from "react";

interface SectionTitleProps {
  eyebrow: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
}

export const SectionTitle = ({ eyebrow, title, lede, children }: SectionTitleProps) => (
  <div className="mb-4">
    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-narp-teal">{eyebrow}</div>
    <h2 className="narp-display mt-1 text-2xl font-medium text-narp-ink">{title}</h2>
    {lede && <p className="mt-1 max-w-[680px] text-[13px] leading-[1.55] text-narp-ink-2">{lede}</p>}
    {children}
  </div>
);