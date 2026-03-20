import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Brain, FileText, ShieldCheck, Scroll, Download, Timer } from 'lucide-react';
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

interface GenerationMetadata {
  model_used?: string;
  model?: string;
  transcript_source?: string;
  qc_status?: 'passed' | 'failed' | 'skipped';
  qc_details?: string | null;
  note_style?: string;
  generated_at?: string;
  qc?: QcResult;
}

interface NotesGenerationBadgesProps {
  metadata: GenerationMetadata | null | undefined;
  meetingTitle?: string;
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

const noteStyleLabel = (style?: string): string => {
  if (!style) return 'Unknown';
  switch (style) {
    case 'standard': return 'Standard';
    case '__structured__': return 'Headlines';
    case 'detailed': return 'Detailed';
    case 'brief': return 'Brief';
    default: return style;
  }
};

export const NotesGenerationBadges: React.FC<NotesGenerationBadgesProps> = ({ metadata, meetingTitle }) => {
  console.log('NotesGenerationBadges metadata:', metadata);

  const isLegacy = !metadata;
  const model = metadata?.model_used || metadata?.model;
  const source = metadata?.transcript_source;
  const noteStyle = metadata?.note_style;

  // Use new qc object if available, fall back to legacy flat fields
  const qc = metadata?.qc;
  const qcStatus = qc?.status || metadata?.qc_status;
  const qcScore = qc?.score;
  const qcFailedCount = qc?.failed_count;
  const qcErrorMessage = qc?.error_message;

  const isGemini = model?.includes('gemini') || (!model && !isLegacy);
  const isClaude = model?.includes('claude');

  // Get failed categories for popover
  const failedCategories = qc?.categories
    ? Object.entries(qc.categories).filter(([, cat]) => cat?.status === 'fail')
    : [];

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

  // QC badge — use Popover for failed (shows category breakdown), Tooltip for everything else
  const renderQcBadge = () => {
    const badge = (
      <Badge variant="outline" className={`cursor-default ${qcBadgeClass()}`}>
        <ShieldCheck className="h-3 w-3 mr-1" />
        {qcBadgeContent()}
      </Badge>
    );

    // Failed/issues state: just show the badge, no popover
    if (qcStatus === 'failed') {
      return badge;
    }

    // Error state: tooltip with error message
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

    // Passed / skipped / legacy: simple tooltip
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

      {/* QC Export — inline next to badge when failed/passed */}
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

      {/* Note Style Badge */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={
              isLegacy
                ? 'bg-muted/50 text-muted-foreground border-muted'
                : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700'
            }
          >
            <Scroll className="h-3 w-3 mr-1" />
            {isLegacy ? 'Style Unknown' : noteStyleLabel(noteStyle)}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Note format/style used for generation</p>
        </TooltipContent>
      </Tooltip>
    </div>
    </TooltipProvider>
  );
};
