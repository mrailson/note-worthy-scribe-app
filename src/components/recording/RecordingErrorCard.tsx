import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Phase = 'idle' | 'reprocessing' | 'done' | 'failed';
type RecordingStatus = 'too_short' | 'error';

interface RecordingErrorCardProps {
  meetingId: string;
  meetingTitle: string;
  wordCount: number | null;
  durationMinutes: number | null;
  importSource: string | null;
  onReprocessComplete?: (meetingId: string) => void;
}

const STATUS_CONFIG = {
  too_short: { label: 'Too short — no meeting created', variant: 'amber' as const },
  error: { label: 'Transcription failed', variant: 'red' as const },
  reprocessing: { label: 'Reprocessing…', variant: 'blue' as const },
  done: { label: 'Meeting created', variant: 'green' as const },
} as const;

function SpinnerDots() {
  return (
    <span className="ml-1.5 inline-flex items-center gap-[3px]">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1 h-1 rounded-full bg-blue-500"
          style={{ animation: `notewellPulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
      <style>{`
        @keyframes notewellPulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </span>
  );
}

export function RecordingErrorCard({
  meetingId,
  meetingTitle,
  wordCount,
  durationMinutes,
  importSource,
  onReprocessComplete,
}: RecordingErrorCardProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [resultWords, setResultWords] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const initialStatus: RecordingStatus = (wordCount === null || wordCount === 0) ? 'too_short' : 'error';

  // Animate progress bar during reprocessing
  useEffect(() => {
    if (phase !== 'reprocessing') return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 90) { clearInterval(interval); return 90; }
        return p + Math.random() * 12;
      });
    }, 300);
    return () => clearInterval(interval);
  }, [phase]);

  const handleReprocess = async () => {
    setPhase('reprocessing');
    setErrorMsg('');

    try {
      const { data, error } = await supabase.functions.invoke('transcribe-offline-meeting', {
        body: { meetingId, chunkIndex: 0 },
      });

      if (error) throw error;

      // Poll for completion — check word_count updates over 2 minutes
      let attempts = 0;
      const maxAttempts = 24; // 24 × 5s = 2 minutes
      const pollInterval = setInterval(async () => {
        attempts++;
        const { data: meeting } = await supabase
          .from('meetings')
          .select('word_count')
          .eq('id', meetingId)
          .single();

        if (meeting?.word_count && meeting.word_count > 0) {
          clearInterval(pollInterval);
          setProgress(100);
          setResultWords(meeting.word_count);
          setPhase('done');
          onReprocessComplete?.(meetingId);
        } else if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setPhase('failed');
          setErrorMsg('Reprocessing is taking longer than expected. Check back shortly — it may still complete.');
        }
      }, 5000);
    } catch (err: any) {
      console.error('Reprocess failed:', err);
      setPhase('failed');
      setErrorMsg(err?.message || 'Transcription service error — try again or check connection.');
    }
  };

  const currentConfig = phase === 'done' ? STATUS_CONFIG.done
    : phase === 'reprocessing' ? STATUS_CONFIG.reprocessing
    : STATUS_CONFIG[initialStatus];

  const badgeClasses = {
    amber: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400',
    red: 'bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-400',
    blue: 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-400',
    green: 'bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-400',
  };

  return (
    <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-2.5">
      {/* Status badge */}
      <div className="flex items-center justify-between gap-2">
        <Badge
          variant="outline"
          className={`text-[11px] font-medium ${badgeClasses[currentConfig.variant]}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
              currentConfig.variant === 'amber' ? 'bg-amber-500' :
              currentConfig.variant === 'red' ? 'bg-red-500' :
              currentConfig.variant === 'blue' ? 'bg-blue-500' :
              'bg-green-500'
            }`}
          />
          {currentConfig.label}
          {phase === 'reprocessing' && <SpinnerDots />}
        </Badge>

        {importSource && (
          <span className="text-[10px] text-muted-foreground">
            Source: {importSource.replace('_', ' ')}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {phase === 'reprocessing' && (
        <div className="h-1 bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Success result */}
      {phase === 'done' && resultWords !== null && (
        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/30 rounded-md px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
          <span className="text-xs text-green-700 dark:text-green-400">
            Meeting created · <strong>{resultWords.toLocaleString()} words</strong>
          </span>
        </div>
      )}

      {/* Error message */}
      {phase === 'failed' && errorMsg && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 rounded-md px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 text-red-600 flex-shrink-0 mt-0.5" />
          <span className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{errorMsg}</span>
        </div>
      )}

      {/* Actions */}
      {(phase === 'idle' || phase === 'failed') && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleReprocess();
            }}
            className="h-7 px-3 text-[11px] font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <RefreshCw className="h-3 w-3" />
            {phase === 'failed' ? 'Retry Transcription' : 'Reprocess Recording'}
          </Button>

          {phase === 'failed' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                toast.info(
                  `Diagnostic Info\n\nMeeting: ${meetingId}\nWord count: ${wordCount ?? 0}\nDuration: ${durationMinutes ?? 0} min\nSource: ${importSource ?? 'unknown'}\n\nLikely cause: Offline audio blob not fully reassembled before transcription. Only partial chunks were sent, producing a short transcript.`,
                  { duration: 10000 }
                );
              }}
              className="h-7 px-2.5 text-[11px] text-muted-foreground gap-1"
            >
              <Info className="h-3 w-3" />
              Diagnostics
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
