import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle2, XCircle, ChevronDown, ChevronRight, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  model_used?: string;
  ran_at?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  fabricated_decisions: 'Decision accuracy',
  fabricated_actions: 'Action traceability',
  missing_speakers: 'Speaker attribution',
  currency_detection: 'Currency detection',
  attendee_gaps: 'Attendee completeness',
  prompt_leak: 'Prompt leak check',
  tone_escalation: 'Tone fidelity',
};

const CATEGORY_ORDER = [
  'fabricated_decisions',
  'fabricated_actions',
  'missing_speakers',
  'currency_detection',
  'attendee_gaps',
  'prompt_leak',
  'tone_escalation',
];

interface QualityReportSectionProps {
  qc: QcResult | null | undefined;
  meetingId: string | undefined;
  onQcUpdated: (newMetadata: any) => void;
}

export const QualityReportSection: React.FC<QualityReportSectionProps> = ({
  qc,
  meetingId,
  onQcUpdated,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRerunning, setIsRerunning] = useState(false);

  const handleRerunQc = async () => {
    if (!meetingId || isRerunning) return;
    setIsRerunning(true);

    try {
      // Fetch the transcript and notes for this meeting
      // Fetch transcript via RPC (handles chunk consolidation) and notes from summaries
      const [transcriptResult, summaryResult] = await Promise.all([
        supabase.rpc('get_meeting_full_transcript', { p_meeting_id: meetingId }),
        supabase.from('meeting_summaries').select('summary, generation_metadata').eq('meeting_id', meetingId).order('updated_at', { ascending: false }).maybeSingle(),
      ]);

      const transcript = Array.isArray(transcriptResult.data)
        ? transcriptResult.data.map((r: any) => r.transcript_text).join(' ')
        : (transcriptResult.data as any)?.transcript_text || '';
      const notes = summaryResult.data?.summary;

      if (!transcript || !notes) {
        toast.error('Missing transcript or notes — cannot re-run QC');
        return;
      }

      // Call the edge function with a special flag to re-run only QC
      const { data, error } = await supabase.functions.invoke('generate-meeting-notes-claude', {
        body: {
          transcript,
          meetingTitle: 'QC Re-run',
          meetingDate: '',
          meetingTime: '',
          meetingId,
          qcOnly: true,
          existingNotes: notes,
        },
      });

      if (error) throw error;

      if (data?.qc) {
        // Update the metadata in the parent
        const existingMeta = (summaryResult.data?.generation_metadata as any) || {};
        const updatedMeta = { ...existingMeta, qc: data.qc };
        onQcUpdated(updatedMeta);
        toast.success(data.qc.status === 'passed' ? 'QC passed' : `QC completed — ${data.qc.failed_count || 0} issues found`);
      }
    } catch (err: any) {
      console.error('Re-run QC error:', err);
      toast.error('Failed to re-run quality check');
    } finally {
      setIsRerunning(false);
    }
  };

  if (!qc && !meetingId) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4 border rounded-lg">
      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
        <span className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Quality report
        </span>
        {qc?.score != null && (
          <span className={`text-xs font-semibold ${qc.status === 'passed' ? 'text-emerald-600' : qc.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>
            {qc.score}/100
          </span>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="px-4 pb-4">
        {!qc || qc.status === 'error' ? (
          <div className="py-3">
            {qc?.status === 'error' ? (
              <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">QC audit encountered an error</p>
                  <p className="text-xs text-muted-foreground mt-1">{qc.error_message || 'Unknown error'}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Quality check has not been run for these notes.</p>
            )}
          </div>
        ) : (
          <>
            {/* Overall score */}
            <div className="flex items-center gap-4 py-3 mb-3 border-b">
              <span className={`text-4xl font-bold tabular-nums ${qc.status === 'passed' ? 'text-emerald-600' : 'text-red-600'}`}>
                {qc.score ?? '—'}
              </span>
              <div>
                <p className="text-sm font-medium">
                  {qc.status === 'passed' ? 'All checks passed' : `${qc.failed_count} ${qc.failed_count === 1 ? 'issue' : 'issues'} found`}
                </p>
                {qc.summary && <p className="text-xs text-muted-foreground mt-0.5">{qc.summary}</p>}
              </div>
            </div>

            {/* Category list */}
            <div className="space-y-2">
              {CATEGORY_ORDER.map((key) => {
                const cat = qc.categories?.[key as keyof typeof qc.categories];
                if (!cat) return null;
                const passed = cat.status === 'pass';
                return (
                  <div key={key} className="flex items-start gap-2.5 text-sm">
                    {passed ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                    )}
                    <div className="min-w-0">
                      <span className={`font-medium ${passed ? 'text-foreground' : 'text-red-700 dark:text-red-400'}`}>
                        {CATEGORY_LABELS[key] || key}
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{cat.findings}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Ran at timestamp */}
            {qc.ran_at && (
              <p className="text-xs text-muted-foreground mt-3">
                Last run: {new Date(qc.ran_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {qc.model_used && ` · ${qc.model_used}`}
              </p>
            )}
          </>
        )}

        {/* Re-run button */}
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={handleRerunQc}
          disabled={isRerunning || !meetingId}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRerunning ? 'animate-spin' : ''}`} />
          {isRerunning ? 'Running QC…' : 'Re-run QC'}
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
};
