import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type DetailTier = "concise" | "standard" | "detailed";

const STORAGE_KEY = "meeting-output-detail-tier";

const TIERS: Array<{
  key: DetailTier;
  label: string;
  hint: string;
  description: string;
}> = [
  {
    key: "concise",
    label: "Concise",
    hint: "~600–900 words",
    description:
      "Bullet-led summary. Decisions, actions and figures preserved; narrative texture stripped.",
  },
  {
    key: "standard",
    label: "Standard",
    hint: "Default",
    description:
      "Current baseline output — balanced governance notes with operational texture preserved.",
  },
  {
    key: "detailed",
    label: "Detailed",
    hint: "~2,000–3,500 words",
    description:
      "Full prose with quantitative detail, attributed concerns, and sub-points where they add clarity.",
  },
];

/**
 * Per-session (not persisted across sessions) helper for reading the user's
 * preferred output detail tier. Defaults to 'standard'.
 */
export function getSessionDetailTier(): DetailTier {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    if (v === "concise" || v === "standard" || v === "detailed") return v;
  } catch {
    /* sessionStorage may be unavailable — fall through */
  }
  return "standard";
}

export function setSessionDetailTier(tier: DetailTier) {
  try {
    sessionStorage.setItem(STORAGE_KEY, tier);
  } catch {
    /* ignore quota / privacy mode */
  }
}

interface DetailTierSelectorProps {
  /** Optional className for the trigger button */
  className?: string;
  /** Notify parent when user changes selection (optional). */
  onChange?: (tier: DetailTier) => void;
}

/**
 * Compact cog-icon popover that lets the user pick the output detail tier
 * for the next regeneration. Choice is persisted in sessionStorage only.
 */
export function DetailTierSelector({ className, onChange }: DetailTierSelectorProps) {
  const [tier, setTier] = useState<DetailTier>("standard");

  useEffect(() => {
    setTier(getSessionDetailTier());
  }, []);

  const handleSelect = (next: DetailTier) => {
    setTier(next);
    setSessionDetailTier(next);
    onChange?.(next);
  };

  const current = TIERS.find((t) => t.key === tier) ?? TIERS[1];
  const showBadge = tier !== "standard";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 gap-1.5 px-2 text-xs ${className ?? ""}`}
          title={`Output detail: ${current.label}`}
        >
          <Settings2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Detail</span>
          {showBadge && (
            <span className="rounded-sm bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {current.label}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="mb-2">
          <div className="text-sm font-semibold">Output detail</div>
          <div className="text-xs text-muted-foreground">
            Applies to your next regeneration. Resets when you close the tab.
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {TIERS.map((opt) => {
            const active = opt.key === tier;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleSelect(opt.key)}
                className={[
                  "flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50",
                ].join(" ")}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-medium">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {opt.hint}
                  </span>
                </div>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  {opt.description}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DetailTierSelector;
