import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Brain, FileText, ShieldCheck, Scroll } from 'lucide-react';

interface GenerationMetadata {
  model_used?: string;
  transcript_source?: string;
  qc_status?: 'passed' | 'failed' | 'skipped';
  qc_details?: string | null;
  note_style?: string;
  generated_at?: string;
}

interface NotesGenerationBadgesProps {
  metadata: GenerationMetadata | null | undefined;
}

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

export const NotesGenerationBadges: React.FC<NotesGenerationBadgesProps> = ({ metadata }) => {
  const isLegacy = !metadata;

  const model = metadata?.model_used;
  const source = metadata?.transcript_source;
  const qcStatus = metadata?.qc_status;
  const qcDetails = metadata?.qc_details;
  const noteStyle = metadata?.note_style;

  const isGemini = model?.includes('gemini') || (!model && !isLegacy);
  const isClaude = model?.includes('claude');

  return (
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
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={
              isLegacy
                ? 'bg-muted/50 text-muted-foreground border-muted'
                : qcStatus === 'passed'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                  : qcStatus === 'failed'
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800'
                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'
            }
          >
            <ShieldCheck className="h-3 w-3 mr-1" />
            {isLegacy
              ? 'QC Unknown'
              : qcStatus === 'passed'
                ? 'QC Passed'
                : qcStatus === 'failed'
                  ? 'QC Failed'
                  : 'QC Skipped'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs max-w-xs">
            {isLegacy
              ? 'Quality check status unavailable for older notes'
              : qcStatus === 'passed'
                ? 'Post-generation quality verification passed'
                : qcStatus === 'failed'
                  ? `Quality check flagged issues: ${qcDetails || 'Details unavailable'}`
                  : 'Quality check layer did not run for this generation'}
          </p>
        </TooltipContent>
      </Tooltip>

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
  );
};
