import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Timer, Zap, ShieldCheck, Mic, GitMerge, Sparkles } from 'lucide-react';

interface NoteTiming {
  notes_generation_seconds?: number;
  qc_audit_seconds?: number;
  total_pipeline_seconds?: number;
}

interface ConsolidationTiming {
  merge_seconds?: number;
  hallucination_repair_seconds?: number;
  speaker_injection_seconds?: number;
  total_consolidation_seconds?: number;
}

interface ProcessingTimeBadgesProps {
  noteTiming?: NoteTiming | null;
  consolidationTiming?: ConsolidationTiming | null;
}

const fmt = (sec?: number): string => {
  if (sec == null) return '—';
  return `${sec.toFixed(1)}s`;
};

export const ProcessingTimeBadges: React.FC<ProcessingTimeBadgesProps> = ({
  noteTiming,
  consolidationTiming,
}) => {
  const hasMerge = consolidationTiming?.total_consolidation_seconds != null;
  const hasNotes = noteTiming?.total_pipeline_seconds != null;

  if (!hasMerge && !hasNotes) {
    return (
      <span className="text-xs text-muted-foreground italic">Not yet available</span>
    );
  }

  const grandTotal = (consolidationTiming?.total_consolidation_seconds || 0) + (noteTiming?.total_pipeline_seconds || 0);

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-1.5">
        {/* STT Merge */}
        {hasMerge && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="cursor-default bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-800">
                <GitMerge className="h-3 w-3 mr-1" />
                Merge {fmt(consolidationTiming?.merge_seconds)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Best-of-All 3-engine transcript merge</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Hallucination Repair */}
        {hasMerge && consolidationTiming?.hallucination_repair_seconds != null && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="cursor-default bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800">
                <Sparkles className="h-3 w-3 mr-1" />
                Repair {fmt(consolidationTiming.hallucination_repair_seconds)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Post-merge hallucination detection &amp; repair</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Speaker Injection */}
        {hasMerge && consolidationTiming?.speaker_injection_seconds != null && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="cursor-default bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800">
                <Mic className="h-3 w-3 mr-1" />
                Speakers {fmt(consolidationTiming.speaker_injection_seconds)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Speaker diarisation overlay (AssemblyAI + Deepgram)</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Notes Generation */}
        {hasNotes && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="cursor-default bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800">
                <Zap className="h-3 w-3 mr-1" />
                Notes {fmt(noteTiming?.notes_generation_seconds)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">LLM note generation time</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* QC Audit */}
        {hasNotes && noteTiming?.qc_audit_seconds != null && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="cursor-default bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800">
                <ShieldCheck className="h-3 w-3 mr-1" />
                QC {fmt(noteTiming.qc_audit_seconds)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Quality gate audit duration</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Grand Total */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="cursor-default bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700 font-semibold">
              <Timer className="h-3 w-3 mr-1" />
              Total {grandTotal.toFixed(1)}s
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">End-to-end processing time (consolidation + notes + QC)</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};
