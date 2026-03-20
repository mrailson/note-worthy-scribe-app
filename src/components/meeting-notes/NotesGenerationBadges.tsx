import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Brain, FileText, ShieldCheck, Download, Timer, Clock } from 'lucide-react';
import { downloadQcReport } from '@/utils/qcReportExport';

interface QcCategory {
  status: 'pass' | 'fail';
  findings: string;
}

interface QcResult {
  status: 'passed' | 'failed' | 'error';
  score?: number;
  failed_count?: number;
  error_message?: string;
  categories?: {
    fabricated_decisions?: QcCategory;
    fabricated_actions?: QcCategory;
    missing_speakers?: QcCategory;
    currency_detection?: QcCategory;
    attendee_gaps?: QcCategory;
    prompt_leak?: QcCategory;
    tone_escalation?: QcCategory;
  };
  summary?: string;
}

interface TimingData {
  notes_generation_seconds?: number;
  qc_audit_seconds?: number;
  total_pipeline_seconds?: number;
}

interface ConsolidationTimingData {
  merge_seconds?: number;
  hallucination_repair_seconds?: number;
  speaker_injection_seconds?: number;
  total_consolidation_seconds?: number;
}

interface GenerationMetadata {
  model_used?: string;
  model?: string;
  transcript_source?: string;
  qc_status?: 'passed' | 'failed' | 'skipped';
  qc_details?: string | null;
  note_style?: string;
  generated_at?: string;
  qc?: QcResult;
  timing?: TimingData;
}

interface NotesGenerationBadgesProps {
  metadata: GenerationMetadata | null | undefined;
  meetingTitle?: string;
  consolidationTiming?: ConsolidationTimingData | null;
}

const QC_CATEGORY_LABELS: Record<string, string> = {
  fabricated_decisions: 'Decision accuracy',
  fabricated_actions: 'Action traceability',
  missing_speakers: 'Speaker attribution',
  currency_detection: 'Currency detection',
  attendee_gaps: 'Attendee completeness',
  prompt_leak: 'Prompt leak check',
  tone_escalation: 'Tone fidelity',
};

const modelLabel = (model?: string): string => {
  if (!model) return 'Unknown';
  if (model.includes('gemini')) return 'Gemini 3 Flash';
  if (model.includes('sonnet')) return 'Claude Sonnet 4.6';
  if (model.includes('haiku')) return 'Claude Haiku 4.5';
  return model;
};

const transcriptSourceLabel = (source?: string): string => {
  if (!source) return 'Unknown';
  switch (source) {
    case 'best_of_all': return 'Best of All (3)';
    case 'consolidated': return 'Best of Both';
    case 'whisper': return 'Batch (Whisper)';
    case 'assembly': return 'Live (AssemblyAI)';
    case 'auto': return 'Auto';
    default: return source;
  }
};

const formatSec = (sec?: number): string => {
  if (sec == null) return '—';
  return `${sec.toFixed(1)}s`;
};

export const NotesGenerationBadges: React.FC<NotesGenerationBadgesProps> = ({ metadata, meetingTitle, consolidationTiming }) => {
  console.log('NotesGenerationBadges metadata:', metadata);

  const isLegacy = !metadata;
  const model = metadata?.model_used || metadata?.model;
  const source = metadata?.transcript_source;
  const timing = metadata?.timing;

  // Use new qc object if available, fall back to legacy flat fields
  const qc = metadata?.qc;
  const qcStatus = qc?.status || metadata?.qc_status;
  const qcScore = qc?.score;
  const qcFailedCount = qc?.failed_count;
  const qcErrorMessage = qc?.error_message;

  const isGemini = model?.includes('gemini') || (!model && !isLegacy);
  const isClaude = model?.includes('claude');

  const qcBadgeContent = () => {
    if (isLegacy) return 'QC Unknown';
    if (qcStatus === 'passed') return `QC Passed${qcScore != null ? ` ${qcScore}` : ''}`;
    if (qcStatus === 'failed') return `QC Issues${qcFailedCount != null ? ` (${qcFailedCount})` : ''}`;
    if (qcStatus === 'error') return 'QC Error';
    return 'QC Skipped';
  };

  const qcBadgeClass = () => {
    if (isLegacy) return 'bg-muted/50 text-muted-foreground border-muted';
    if (qcStatus === 'passed') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800';
    if (qcStatus === 'failed') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800';
    if (qcStatus === 'error') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800';
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800';
  };

  const renderQcBadge = () => {
    const badge = (
      <Badge variant="outline" className={`cursor-default ${qcBadgeClass()}`}>
        <ShieldCheck className="h-3 w-3 mr-1" />
        {qcBadgeContent()}
      </Badge>
    );

    if (qcStatus === 'failed') return badge;

    if (qcStatus === 'error') {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p className="text-xs max-w-xs">{qcErrorMessage || 'QC audit encountered an error'}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="text-xs max-w-xs">
            {isLegacy
              ? 'Quality check status unavailable for older notes'
              : qcStatus === 'passed'
                ? `Post-generation quality verification passed${qcScore != null ? ` (score: ${qcScore}/100)` : ''}`
                : 'Quality check layer did not run for this generation'}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  };

  // Check if we have any timing data at all
  const hasNoteTiming = timing?.total_pipeline_seconds != null;
  const hasMergeTiming = consolidationTiming?.total_consolidation_seconds != null;
  const hasAnyTiming = hasNoteTiming || hasMergeTiming;

  // Calculate grand total
  const grandTotal = (consolidationTiming?.total_consolidation_seconds || 0) + (timing?.total_pipeline_seconds || 0);

  return (
    <TooltipProvider>
    <div className="flex flex-wrap items-center gap-1.5 py-2">
      {/* LLM Model Badge */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={
              isLegacy
                ? 'bg-muted/50 text-muted-foreground border-muted'
                : isClaude
                  ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
            }
          >
            <Brain className="h-3 w-3 mr-1" />
            {isLegacy ? 'Model Unknown' : modelLabel(model)}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">LLM used to generate these notes</p>
        </TooltipContent>
      </Tooltip>

      {/* Transcript Source Badge */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={
              isLegacy
                ? 'bg-muted/50 text-muted-foreground border-muted'
                : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800'
            }
          >
            <FileText className="h-3 w-3 mr-1" />
            {isLegacy ? 'Source Unknown' : transcriptSourceLabel(source)}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Transcript version fed to the LLM</p>
        </TooltipContent>
      </Tooltip>

      {/* Quality Check Badge */}
      {renderQcBadge()}

      {/* QC Export */}
      {qc && qcStatus && qcStatus !== 'error' && !isLegacy && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => downloadQcReport(qc, meetingTitle)}
              className="inline-flex items-center justify-center h-6 w-6 rounded-md border border-border bg-background hover:bg-muted transition-colors"
            >
              <Download className="h-3 w-3 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Export QC report as Word</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Pipeline Timing Badge — shows grand total with full breakdown in tooltip */}
      {hasAnyTiming && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700"
            >
              <Timer className="h-3 w-3 mr-1" />
              {grandTotal.toFixed(1)}s
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="text-xs space-y-1">
              <p className="font-semibold border-b border-border pb-1 mb-1">Processing Time Breakdown</p>
              {hasMergeTiming && (
                <>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">STT Merge</span>
                    <span className="font-mono">{formatSec(consolidationTiming?.merge_seconds)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Hallucination Repair</span>
                    <span className="font-mono">{formatSec(consolidationTiming?.hallucination_repair_seconds)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Speaker Injection</span>
                    <span className="font-mono">{formatSec(consolidationTiming?.speaker_injection_seconds)}</span>
                  </div>
                  <div className="flex justify-between gap-4 font-medium">
                    <span>Consolidation Total</span>
                    <span className="font-mono">{formatSec(consolidationTiming?.total_consolidation_seconds)}</span>
                  </div>
                </>
              )}
              {hasNoteTiming && (
                <>
                  {hasMergeTiming && <div className="border-t border-border my-1" />}
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Notes Generation</span>
                    <span className="font-mono">{formatSec(timing?.notes_generation_seconds)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">QC Audit</span>
                    <span className="font-mono">{formatSec(timing?.qc_audit_seconds)}</span>
                  </div>
                  <div className="flex justify-between gap-4 font-medium">
                    <span>Notes Pipeline Total</span>
                    <span className="font-mono">{formatSec(timing?.total_pipeline_seconds)}</span>
                  </div>
                </>
              )}
              <div className="border-t border-border mt-1 pt-1 flex justify-between gap-4 font-semibold">
                <span>Grand Total</span>
                <span className="font-mono">{grandTotal.toFixed(1)}s</span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
    </TooltipProvider>
  );
};
