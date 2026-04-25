import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionTitleProps {
  eyebrow: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
  tone?: "accent" | "ink";
  children?: ReactNode;
}

export const SectionTitle = ({ eyebrow, title, lede, align = "left", tone = "accent", children }: SectionTitleProps) => (
  <header className={cn("mb-5 font-narp-body", align === "center" && "text-center")}>
    <div className={cn("text-[11px] font-bold uppercase leading-[1.3] tracking-[0.16em]", tone === "ink" ? "text-narp-ink-2" : "text-narp-teal")}>{eyebrow}</div>
    <h2 className="narp-display my-[4px] text-2xl font-medium leading-[1.2] text-narp-ink tracking-[-0.01em]">{title}</h2>
    {lede && <p className={cn("m-0 max-w-[680px] text-[13px] leading-[1.55] text-narp-ink-2", align === "center" && "mx-auto max-w-[720px]")}>{lede}</p>}
    {children}
  </header>
);