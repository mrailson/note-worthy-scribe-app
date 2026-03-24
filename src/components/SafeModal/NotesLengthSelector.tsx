// NotesLengthSelector.tsx
// Drop this into your components/SafeModal/ folder in Lovable
// Usage: <NotesLengthSelector value={notesLength} onChange={setNotesLength} />

import { Info } from "lucide-react";

export type NotesLength = "brief" | "standard" | "detailed" | "comprehensive";

interface LengthOption {
  key: NotesLength;
  label: string;
  hint: string;
  description: string;
  pages: string;
  wordDoc: string;
}

const LENGTH_OPTIONS: LengthOption[] = [
  {
    key: "brief",
    label: "Brief",
    hint: "~1 page",
    pages: "~1 page",
    wordDoc: "Compact single-page Word document",
    description:
      "One-page summary — key decisions, actions and headline context only. Ideal for rapid review and sharing.",
  },
  {
    key: "standard",
    label: "Standard",
    hint: "~2–3 pages",
    pages: "~2–3 pages",
    wordDoc: "Structured multi-section Word document",
    description:
      "Balanced notes covering context, discussion points, agreed actions and implications. Default for most meetings.",
  },
  {
    key: "detailed",
    label: "Detailed",
    hint: "~4–5 pages",
    pages: "~4–5 pages",
    wordDoc: "Extended Word document with full action log",
    description:
      "Comprehensive notes with extended discussion, evidence references and a full numbered action log.",
  },
  {
    key: "comprehensive",
    label: "Full",
    hint: "Full detail",
    pages: "Unrestricted",
    wordDoc: "Full governance-grade Word document (DOCX)",
    description:
      "Maximum detail — full discussion capture, all attendees, complete clinical and governance record. Generates full NHS-grade Word document.",
  },
];

interface NotesLengthSelectorProps {
  value: NotesLength;
  onChange: (length: NotesLength) => void;
  className?: string;
  /** Render only the segmented buttons (no description row) */
  compact?: boolean;
}

/** Inline segmented control — use compact for toolbar rows */
export function NotesLengthSelector({
  value,
  onChange,
  className = "",
  compact = false,
}: NotesLengthSelectorProps) {
  const selected = LENGTH_OPTIONS.find((o) => o.key === value) ?? LENGTH_OPTIONS[1];

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {/* Segmented control row */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Length
        </span>

        <div className="flex rounded-md border border-border overflow-hidden bg-muted/30">
          {LENGTH_OPTIONS.map((opt, i) => {
            const isActive = opt.key === value;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => onChange(opt.key)}
                className={[
                  "px-2.5 py-1 text-xs font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  i > 0 ? "border-l border-border" : "",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <span className="text-xs text-primary font-medium whitespace-nowrap">
          {selected.hint}
        </span>
      </div>

      {/* Description bar — hidden in compact mode */}
      {!compact && (
        <div className="flex items-start gap-1.5 rounded-md bg-muted/20 border border-border/50 px-2.5 py-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
          <span className="text-xs text-muted-foreground leading-relaxed">
            {selected.description}
            {value === "comprehensive" && (
              <span className="ml-1 inline-flex items-center gap-1 text-xs text-primary font-medium">
                · Includes Word document
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

/** Standalone description bar for rendering on a second row */
export function NotesLengthDescription({ value }: { value: NotesLength }) {
  const selected = LENGTH_OPTIONS.find((o) => o.key === value) ?? LENGTH_OPTIONS[1];
  return (
    <div className="flex items-start gap-1.5 rounded-md bg-muted/20 border border-border/50 px-2.5 py-1.5 w-full">
      <Info className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
      <span className="text-xs text-muted-foreground leading-relaxed">
        {selected.description}
        {value === "comprehensive" && (
          <span className="ml-1 inline-flex items-center gap-1 text-xs text-primary font-medium">
            · Includes Word document
          </span>
        )}
      </span>
    </div>
  );
}

export default NotesLengthSelector;
