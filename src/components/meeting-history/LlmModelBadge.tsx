import { Badge } from "@/components/ui/badge";
import { Brain, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LlmModelBadgeProps {
  meetingId: string;
}

// Sonnet-only policy (May 2026): Meeting Recorder is locked to Claude Sonnet 4.6.
// Legacy keys are still recognised so historical meetings keep showing their badge.
const MODEL_LABELS: Record<string, { label: string; className: string }> = {
  'claude-sonnet-4-6': {
    label: 'Claude Sonnet 4.6',
    className: 'bg-amber-600 hover:bg-amber-600 text-white',
  },
  'gpt-5-emergency-fallback': {
    label: 'GPT-5 (emergency fallback)',
    className: 'bg-red-600 hover:bg-red-600 text-white',
  },
  'gemini-3-flash': {
    label: 'Gemini 3 Flash (legacy)',
    className: 'bg-emerald-700 hover:bg-emerald-700 text-white',
  },
  'claude-haiku-4-5': {
    label: 'Claude Haiku 4.5 (legacy)',
    className: 'bg-indigo-600 hover:bg-indigo-600 text-white',
  },
  'claude-haiku-4-5-20251001': {
    label: 'Claude Haiku 4.5 (legacy)',
    className: 'bg-indigo-600 hover:bg-indigo-600 text-white',
  },
};

/**
 * Extract a base model key from a stamped model string. The server may stamp the
 * value as e.g. "claude-sonnet-4-6 (standard)"; strip the parenthesised tier so
 * the lookup table still matches.
 */
const stripTier = (raw: string): string => raw.replace(/\s*\(.*?\)\s*$/, '').trim();

export const LlmModelBadge = ({ meetingId }: LlmModelBadgeProps) => {
  const [modelUsed, setModelUsed] = useState<string>('claude-sonnet-4-6');
  const [attempt, setAttempt] = useState<number>(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Prefer the authoritative DB value; fall back to localStorage hint for older meetings.
      const { data } = await supabase
        .from('meetings')
        .select('notes_model_used, notes_model_attempt')
        .eq('id', meetingId)
        .maybeSingle();
      if (cancelled) return;
      const lsHint = localStorage.getItem(`meeting-llm-used-${meetingId}`);
      const dbValue = (data as { notes_model_used?: string | null; notes_model_attempt?: number | null } | null);
      const model = dbValue?.notes_model_used || lsHint || 'claude-sonnet-4-6';
      setModelUsed(stripTier(model));
      setAttempt(typeof dbValue?.notes_model_attempt === 'number' ? dbValue.notes_model_attempt : 1);
    })();
    return () => { cancelled = true; };
  }, [meetingId]);

  const meta = MODEL_LABELS[modelUsed] || { label: modelUsed, className: 'bg-muted text-muted-foreground' };

  // Decorate the label so users can spot when Sonnet succeeded only on a retry,
  // or when the emergency GPT-5 fallback fired.
  let suffix = '';
  if (modelUsed === 'gpt-5-emergency-fallback') {
    suffix = '';
  } else if (attempt === 2) {
    suffix = ' · retry 2';
  } else if (attempt === 3) {
    suffix = ' · retry 3';
  } else if (attempt >= 4 && attempt < 99) {
    suffix = ` · retry ${attempt}`;
  }

  const isEmergency = modelUsed === 'gpt-5-emergency-fallback';
  const Icon = isEmergency ? AlertTriangle : Brain;

  return (
    <Badge className={`gap-1 cursor-default text-xs ${meta.className}`}>
      <Icon className="h-3 w-3" />
      {meta.label}{suffix}
    </Badge>
  );
};
