import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LlmModelBadgeProps {
  meetingId: string;
}

interface BadgeStyle {
  label: string;
  className: string;
}

const BASE_LABELS: Record<string, BadgeStyle> = {
  'gemini-3-flash': {
    label: 'Gemini 3 Flash',
    className: 'bg-emerald-600 hover:bg-emerald-600 text-white',
  },
  'claude-sonnet-4-6': {
    label: 'Claude Sonnet 4.6',
    className: 'bg-amber-600 hover:bg-amber-600 text-white',
  },
  'claude-haiku-4-5': {
    label: 'Claude Haiku 4.5',
    className: 'bg-indigo-600 hover:bg-indigo-600 text-white',
  },
  'claude-haiku-4-5-20251001': {
    label: 'Claude Haiku 4.5',
    className: 'bg-indigo-600 hover:bg-indigo-600 text-white',
  },
};

const GPT5_FALLBACK_STYLE: BadgeStyle = {
  label: 'GPT-5 emergency fallback',
  className: 'bg-rose-600 hover:bg-rose-600 text-white',
};

/**
 * Decode a `notes_model_used` value into a badge label + colour.
 *
 * Suffix taxonomy (set by auto-generate-meeting-notes/index.ts):
 *   `claude-sonnet-4-6`                  → "Claude Sonnet 4.6"               single-shot, full quality
 *   `claude-sonnet-4-6+chunked-haiku`    → "Claude Sonnet 4.6 · chunked"     default for transcripts >15k chars
 *   `claude-sonnet-4-6+refined`          → "Claude Sonnet 4.6 · refined"     user clicked Regenerate with Sonnet
 *   `gpt-5` (when reached as rescue)     → "GPT-5 emergency fallback"
 *   `<model> (detailed)` etc.            → tier suffix preserved as-is
 */
function decodeModelLabel(rawModelUsed: string | null | undefined): BadgeStyle {
  if (!rawModelUsed) {
    return BASE_LABELS['claude-sonnet-4-6'];
  }

  // Strip optional tier suffix in parentheses (e.g. " (detailed)") so we can
  // match the underlying model id, then re-append it for display.
  const tierMatch = rawModelUsed.match(/\s*\(([^)]+)\)\s*$/);
  const tierSuffix = tierMatch ? ` (${tierMatch[1]})` : '';
  const withoutTier = tierMatch ? rawModelUsed.slice(0, tierMatch.index).trim() : rawModelUsed;

  // Suffix flags (mutually meaningful but technically combinable)
  const isChunked = withoutTier.includes('+chunked-haiku');
  const isRefined = withoutTier.includes('+refined');
  const baseModel = withoutTier.replace(/\+chunked-haiku/g, '').replace(/\+refined/g, '');

  // GPT-5 reached on this path is by definition the emergency rescue.
  if (baseModel === 'gpt-5' || baseModel === 'openai/gpt-5') {
    return {
      label: `${GPT5_FALLBACK_STYLE.label}${tierSuffix}`,
      className: GPT5_FALLBACK_STYLE.className,
    };
  }

  const base = BASE_LABELS[baseModel] || {
    label: baseModel || 'Unknown model',
    className: 'bg-muted text-muted-foreground',
  };

  let label = base.label;
  if (isChunked) label += ' · chunked';
  if (isRefined) label += ' · refined';
  label += tierSuffix;

  return { label, className: base.className };
}

export const LlmModelBadge = ({ meetingId }: LlmModelBadgeProps) => {
  const [model, setModel] = useState<BadgeStyle>(() =>
    decodeModelLabel(null)
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('meetings')
          .select('notes_model_used')
          .eq('id', meetingId)
          .maybeSingle();
        if (cancelled) return;
        const raw = (data as any)?.notes_model_used ?? null;
        setModel(decodeModelLabel(raw));
      } catch (err) {
        console.warn('⚠️ LlmModelBadge: could not load notes_model_used', err);
      }
    })();
    return () => { cancelled = true; };
  }, [meetingId]);

  return (
    <Badge className={`gap-1 cursor-default text-xs ${model.className}`}>
      <Brain className="h-3 w-3" />
      {model.label}
    </Badge>
  );
};

// Exported for use by the refine button so it can decide whether to show
// itself based on the same suffix taxonomy.
export { decodeModelLabel };
