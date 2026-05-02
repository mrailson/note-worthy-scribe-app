import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RegenerateWithSonnetButtonProps {
  meetingId: string;
  /** Called after a successful regenerate so the parent can refresh notes. */
  onRefined?: () => void;
  className?: string;
}

/**
 * Refine button — visible only when notes_model_used ends with `+chunked-haiku`.
 *
 * Clicking it re-runs the FULL notes generation from the transcript using
 * single-shot Sonnet 4.6 (skipping the chunked path even though the transcript
 * is over the 15k threshold). This produces a clean independent Sonnet pass —
 * not a polish of the chunked output.
 *
 * Behaviour matches spec:
 *   - notes_generation_status flips to 'queued' → 'generating' during the run
 *   - on success, notes_model_used is updated to "claude-sonnet-4-6+refined"
 *     (the edge function adds the +refined suffix when forceSingleShot=true)
 *   - on failure, the original chunked notes are left intact and an error
 *     toast surfaces. GPT-5 emergency rescue is unchanged.
 *   - refine_count on the meeting row is bumped server-side.
 */
export const RegenerateWithSonnetButton = ({
  meetingId,
  onRefined,
  className,
}: RegenerateWithSonnetButtonProps) => {
  const [shouldShow, setShouldShow] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

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
        const raw = (data as any)?.notes_model_used as string | null | undefined;
        // Only surface the refine button when the saved notes were produced
        // via the chunked path. That's the only case where a single-shot
        // Sonnet pass would be a meaningful upgrade.
        setShouldShow(typeof raw === 'string' && raw.includes('+chunked-haiku'));
      } catch (err) {
        // Silent — the button just stays hidden.
        console.warn('⚠️ RegenerateWithSonnetButton: could not load notes_model_used', err);
      }
    })();
    return () => { cancelled = true; };
  }, [meetingId]);

  const handleClick = async () => {
    if (isRunning) return;
    setIsRunning(true);
    try {
      // Mirror the manual-regenerate UX: flip status to 'queued' so any
      // status-watching UI shows the spinner immediately rather than waiting
      // for the edge function to flip it to 'generating'.
      await supabase
        .from('meetings')
        .update({ notes_generation_status: 'queued' })
        .eq('id', meetingId);

      const { data, error } = await supabase.functions.invoke(
        'auto-generate-meeting-notes',
        {
          body: {
            meetingId,
            forceRegenerate: true,
            forceSingleShot: true,
          },
        }
      );

      if (error) throw error;
      if ((data as any)?.skipped) {
        throw new Error((data as any)?.message || 'Refine was skipped by the server.');
      }

      toast.success('Notes refined with single-shot Claude Sonnet 4.6.');
      // Re-check whether the chunked stamp is now gone, and tell the parent
      // it can refresh the notes view.
      const { data: after } = await supabase
        .from('meetings')
        .select('notes_model_used')
        .eq('id', meetingId)
        .maybeSingle();
      const stillChunked =
        typeof (after as any)?.notes_model_used === 'string' &&
        ((after as any).notes_model_used as string).includes('+chunked-haiku');
      setShouldShow(stillChunked);
      onRefined?.();
    } catch (err: any) {
      console.error('❌ Regenerate with Sonnet failed:', err);
      toast.error(
        err?.message
          ? `Refine failed: ${err.message}. Original notes are untouched.`
          : 'Refine failed. Original notes are untouched.'
      );
      // Roll the status field back from 'queued' so the spinner clears.
      await supabase
        .from('meetings')
        .update({ notes_generation_status: 'completed' })
        .eq('id', meetingId);
    } finally {
      setIsRunning(false);
    }
  };

  if (!shouldShow) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isRunning}
      className={className}
      title="Re-run the full notes generation as a single-shot Claude Sonnet 4.6 pass — slower but higher fidelity than the chunked default."
    >
      {isRunning ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      {isRunning ? 'Refining…' : 'Regenerate with Sonnet'}
    </Button>
  );
};
