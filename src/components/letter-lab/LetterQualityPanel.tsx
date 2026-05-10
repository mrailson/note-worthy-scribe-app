import React, { useEffect, useMemo, useRef, useState } from 'react';
import { diffLines, diffWordsWithSpace } from 'diff';
import {
  CheckCircle2,
  XCircle,
  History,
  Sparkles,
  Eye,
  GitCompare,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { showShadcnToast } from '@/utils/toastWrapper';
import type { LetterType } from './LetterEditor';

// ---------- Compliance ----------
interface CheckItem {
  id: string;
  label: string;
  test: (text: string) => boolean;
  /** Snippet text to insert if the user clicks a failed item. */
  snippet?: string;
}

const has = (t: string, ...needles: (string | RegExp)[]) =>
  needles.some((n) =>
    typeof n === 'string' ? t.toLowerCase().includes(n.toLowerCase()) : n.test(t),
  );

const ACK_CHECKS: CheckItem[] = [
  {
    id: 'receipt',
    label: 'Confirms receipt of the complaint',
    test: (t) => has(t, 'received', 'acknowledge', 'thank you for'),
    snippet:
      'Thank you for your complaint, which we received on [date]. I am writing to acknowledge receipt and confirm that we are taking your concerns seriously.',
  },
  {
    id: 'contact',
    label: 'Names a contact person or role',
    test: (t) =>
      has(t, 'practice manager', 'complaints lead', 'complaints manager') ||
      /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(t),
    snippet: 'Your complaint is being handled by [Name], Practice Manager.',
  },
  {
    id: 'procedure',
    label: "States the practice's complaints procedure",
    test: (t) => has(t, 'complaints procedure', 'complaints policy'),
    snippet:
      'A copy of our complaints procedure is enclosed and is also available on request from reception.',
  },
  {
    id: 'discuss',
    label: 'Offers to discuss the complaint',
    test: (t) => has(t, 'discuss', 'meeting', 'speak with', 'speak to'),
    snippet:
      'If it would be helpful, we would welcome the opportunity to discuss your concerns in person or by telephone.',
  },
  {
    id: 'timeframe',
    label: 'Mentions the timeframe for response',
    test: (t) =>
      has(t, 'working days', 'weeks', 'by ') ||
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(t) ||
      /\b\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(
        t,
      ),
    snippet:
      'We aim to provide a full written response within [X] working days. If we need more time, we will write to you to explain why.',
  },
  {
    id: 'phso',
    label: 'Mentions PHSO escalation right',
    test: (t) =>
      has(t, 'ombudsman', 'phso', 'parliamentary and health service'),
    snippet:
      'If you remain dissatisfied with our response, you may escalate your complaint to the Parliamentary and Health Service Ombudsman (PHSO).',
  },
  {
    id: 'advocacy',
    label: 'Mentions advocacy support',
    test: (t) => has(t, 'advocacy', 'independent advocate'),
    snippet:
      'You are entitled to free, independent advocacy support to help you make your complaint. Please ask us for details of local advocacy services.',
  },
];

const OUTCOME_CHECKS: CheckItem[] = [
  {
    id: 'considered',
    label: 'Explains how the complaint was considered',
    test: (t) => has(t, 'investigated', 'reviewed', 'considered'),
    snippet:
      'We have carefully investigated and reviewed the concerns you raised, including discussions with the staff involved and a review of the clinical records.',
  },
  {
    id: 'findings',
    label: 'States the findings',
    test: (t) => has(t, 'findings', 'conclude', 'we found'),
    snippet: 'Our findings are set out below: [summarise findings].',
  },
  {
    id: 'apology',
    label: 'Includes apology where appropriate',
    test: (t) => has(t, 'apologise', 'apologize', 'sorry', 'regret'),
    snippet:
      'I am sorry for the distress this has caused you, and I apologise on behalf of the practice.',
  },
  {
    id: 'remedy',
    label: 'Describes remedial action / learning',
    test: (t) => has(t, 'action', 'learning', 'changes', 'improve'),
    snippet:
      'As a result of your complaint, we have agreed the following actions and learning to improve our service: [list actions].',
  },
  {
    id: 'phso_full',
    label: 'Includes PHSO escalation right with contact details',
    test: (t) =>
      has(t, 'ombudsman') &&
      (has(t, '0345 015 4033') || has(t, 'ombudsman.org.uk')),
    snippet:
      'If you remain unhappy, you may refer your complaint to the Parliamentary and Health Service Ombudsman (PHSO): 0345 015 4033 · www.ombudsman.org.uk.',
  },
  {
    id: 'phso_time',
    label: 'Mentions 12-month PHSO time limit',
    test: (t) => has(t, '12 months', 'twelve months'),
    snippet:
      'You should normally contact the Ombudsman within 12 months of the events you are complaining about.',
  },
  {
    id: 'advocacy',
    label: 'Mentions advocacy support',
    test: (t) => has(t, 'advocacy'),
    snippet:
      'Free, independent advocacy support is available to help you take your complaint further if you wish.',
  },
];

function stripHtml(input: string): string {
  if (!input) return '';
  if (!input.includes('<')) return input;
  return input.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---------- Reading metrics ----------
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const cleaned = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/u, '').replace(/^y/, '');
  const groups = cleaned.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

interface Metrics {
  words: number;
  sentences: number;
  syllables: number;
  flesch: number;
  fkGrade: number;
  readingAge: number;
}

function computeMetrics(text: string): Metrics {
  const plain = stripHtml(text).trim();
  if (!plain) {
    return { words: 0, sentences: 0, syllables: 0, flesch: 0, fkGrade: 0, readingAge: 0 };
  }
  const sentenceMatches = plain.match(/[^.!?]+[.!?]+/g);
  const sentences = sentenceMatches ? sentenceMatches.length : 1;
  const wordTokens = plain.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  const words = wordTokens.length || 1;
  const syllables = wordTokens.reduce((acc, w) => acc + countSyllables(w), 0);
  const flesch = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  const fkGrade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
  const readingAge = Math.max(0, fkGrade + 5);
  return {
    words,
    sentences,
    syllables,
    flesch: Math.round(flesch * 10) / 10,
    fkGrade: Math.round(fkGrade * 10) / 10,
    readingAge: Math.round(readingAge * 10) / 10,
  };
}

function readingAgeColour(age: number): string {
  if (age <= 11) return 'text-emerald-600';
  if (age <= 14) return 'text-amber-600';
  return 'text-red-600';
}

// ---------- Versions ----------
interface VersionRow {
  id: string;
  version_number: number;
  body_markdown: string;
  reading_age: number | null;
  flesch_kincaid_grade: number | null;
  compliance_score: number | null;
  change_note: string | null;
  created_at: string;
  created_by: string | null;
  tone: string | null;
  length: string | null;
}

interface ProfileLite {
  user_id: string;
  full_name: string | null;
}

// ---------- Public metrics shape exposed upward ----------
export interface QualityMetrics {
  readingAge: number;
  fleschGrade: number;
  complianceScore: number;
  complianceMax: number;
}

export interface LetterQualityPanelProps {
  draftId: string | null;
  letterType: LetterType;
  body: string;
  onInsertSnippet: (text: string) => void;
  onRestoreVersion: (body: string) => void;
  /** Notified (debounced) of latest metrics so the parent can persist them with the next saved version. */
  onMetricsChange?: (m: QualityMetrics) => void;
  /** Bumped by parent each time a new version is written, so the panel reloads history. */
  versionsRefreshKey?: number;
}

export const LetterQualityPanel: React.FC<LetterQualityPanelProps> = ({
  draftId,
  letterType,
  body,
  onInsertSnippet,
  onRestoreVersion,
  onMetricsChange,
  versionsRefreshKey = 0,
}) => {
  const checks = letterType === 'outcome' ? OUTCOME_CHECKS : ACK_CHECKS;
  const plainBody = useMemo(() => stripHtml(body), [body]);

  // --- compliance ---
  const checkResults = useMemo(
    () => checks.map((c) => ({ ...c, ok: c.test(plainBody) })),
    [checks, plainBody],
  );
  const complianceScore = checkResults.filter((c) => c.ok).length;
  const complianceMax = checkResults.length;

  // --- debounced metrics ---
  const [metrics, setMetrics] = useState<Metrics>(() => computeMetrics(body));
  const metricsTimer = useRef<number | null>(null);
  useEffect(() => {
    if (metricsTimer.current) window.clearTimeout(metricsTimer.current);
    metricsTimer.current = window.setTimeout(() => {
      setMetrics(computeMetrics(body));
    }, 1500);
    return () => {
      if (metricsTimer.current) window.clearTimeout(metricsTimer.current);
    };
  }, [body]);

  // Notify parent of metrics so it can attach to the next saved version
  useEffect(() => {
    onMetricsChange?.({
      readingAge: metrics.readingAge,
      fleschGrade: metrics.fkGrade,
      complianceScore,
      complianceMax,
    });
  }, [metrics, complianceScore, complianceMax, onMetricsChange]);

  // --- versions ---
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewing, setViewing] = useState<VersionRow | null>(null);
  const [comparing, setComparing] = useState<VersionRow | null>(null);
  const [simplifying, setSimplifying] = useState(false);

  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('complaint_letter_lab_versions')
        .select(
          'id, version_number, body_markdown, reading_age, flesch_kincaid_grade, compliance_score, change_note, created_at, created_by, tone, length',
        )
        .eq('draft_id', draftId)
        .order('version_number', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.warn('[LetterQualityPanel] versions load failed:', error);
        return;
      }
      const rows = (data ?? []) as VersionRow[];
      setVersions(rows);
      const ids = Array.from(
        new Set(rows.map((r) => r.created_by).filter(Boolean) as string[]),
      );
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', ids);
        if (cancelled) return;
        const map: Record<string, string> = {};
        ((profs ?? []) as ProfileLite[]).forEach((p) => {
          if (p.display_name) map[p.id] = p.display_name;
        });
        setProfileMap(map);
      } else {
        setProfileMap({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftId, versionsRefreshKey]);

  const handleSimplify = async () => {
    setSimplifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('letter-lab-rewrite', {
        body: { mode: 'simplify', body: plainBody, letterType },
      });
      if (error) throw error;
      const rewritten = (data as any)?.body as string | undefined;
      if (rewritten) {
        onRestoreVersion(rewritten);
        showShadcnToast({ title: 'Simplified draft applied' });
      } else {
        showShadcnToast({
          title: 'Simplify unavailable',
          description: 'The rewrite service is not yet available — try again later.',
        });
      }
    } catch (e: any) {
      showShadcnToast({
        title: 'Simplify failed',
        description: e?.message ?? 'The rewrite service is not yet available.',
      });
    } finally {
      setSimplifying(false);
    }
  };

  const handleRestore = async (v: VersionRow) => {
    onRestoreVersion(v.body_markdown ?? '');
    setComparing(null);
    setViewing(null);
    setHistoryOpen(false);
    showShadcnToast({
      title: `Restored version ${v.version_number}`,
      description: 'Current draft saved as a new version before restoring.',
    });
  };

  const renderDiff = (oldText: string, newText: string) => {
    const lineParts = diffLines(oldText || '', newText || '');
    return (
      <div className="font-mono text-xs whitespace-pre-wrap leading-relaxed">
        {lineParts.map((part, i) => {
          if (!part.added && !part.removed) {
            return (
              <span key={i} className="text-muted-foreground">
                {part.value}
              </span>
            );
          }
          // word-level diff for changed regions for readability
          const words = part.value;
          return (
            <span
              key={i}
              className={cn(
                part.added && 'bg-emerald-100 text-emerald-900',
                part.removed && 'bg-red-100 text-red-900 line-through',
              )}
            >
              {words}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Letter quality</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSimplify}
            disabled={simplifying || !plainBody}
          >
            {simplifying ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            Simplify with AI
          </Button>
          <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <History className="h-4 w-4 mr-1" /> History
                {versions.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {versions.length}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[420px] sm:w-[520px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Version history</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-2">
                {versions.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No saved versions yet. Click "Save version" in the editor to capture
                    a snapshot.
                  </p>
                )}
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className="border rounded-md p-3 text-sm space-y-1 bg-muted/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">v{v.version_number}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(v.created_at).toLocaleString('en-GB', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {v.created_by && profileMap[v.created_by]
                        ? profileMap[v.created_by]
                        : 'Unknown user'}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {v.reading_age != null && (
                        <Badge variant="outline">RA {v.reading_age}</Badge>
                      )}
                      {v.compliance_score != null && (
                        <Badge variant="outline">
                          Compliance {v.compliance_score}
                        </Badge>
                      )}
                      {v.tone && <Badge variant="outline">{v.tone}</Badge>}
                    </div>
                    {v.change_note && (
                      <p className="text-xs italic text-muted-foreground">
                        "{v.change_note}"
                      </p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="ghost" onClick={() => setViewing(v)}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setComparing(v)}
                      >
                        <GitCompare className="h-3.5 w-3.5 mr-1" /> Compare
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Reading metrics */}
        <div className="rounded-md border p-3 bg-muted/20">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <div className={cn('text-2xl font-bold', readingAgeColour(metrics.readingAge))}>
                Reading age: {metrics.readingAge || '—'}
                {metrics.readingAge ? ' years' : ''}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Flesch-Kincaid Grade: {metrics.fkGrade} · Flesch Ease: {metrics.flesch}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              NHS plain English target: reading age 9–11
              <div className="mt-0.5">
                {metrics.words} words · {metrics.sentences} sentences
              </div>
            </div>
          </div>
        </div>

        {/* Compliance checklist */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">
              NHS Complaints Regs 2009 · {letterType === 'outcome' ? 'Outcome' : 'Acknowledgement'}
            </h4>
            <Badge
              variant="outline"
              className={cn(
                complianceScore === complianceMax
                  ? 'border-emerald-300 text-emerald-700'
                  : 'border-amber-300 text-amber-700',
              )}
            >
              Compliance score: {complianceScore}/{complianceMax}
            </Badge>
          </div>
          <ul className="space-y-1">
            {checkResults.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (c.ok || !c.snippet) return;
                    onInsertSnippet(c.snippet);
                    showShadcnToast({
                      title: 'Suggested snippet inserted',
                      description: 'Edit to fit the patient and complaint.',
                    });
                  }}
                  disabled={c.ok}
                  className={cn(
                    'w-full text-left flex items-start gap-2 text-sm rounded px-2 py-1.5 transition',
                    !c.ok && 'hover:bg-amber-50 cursor-pointer',
                    c.ok && 'cursor-default',
                  )}
                >
                  {c.ok ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 mt-0.5 text-red-600 shrink-0" />
                  )}
                  <span>
                    {c.label}
                    {!c.ok && c.snippet && (
                      <span className="block text-xs text-muted-foreground italic">
                        Click to insert a suggested snippet.
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>

      {/* View modal */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Version {viewing?.version_number} ·{' '}
              {viewing && new Date(viewing.created_at).toLocaleString('en-GB', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <pre className="whitespace-pre-wrap text-sm font-sans">
              {viewing?.body_markdown}
            </pre>
          </ScrollArea>
          <Separator />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setViewing(null)}>
              Close
            </Button>
            {viewing && (
              <Button onClick={() => handleRestore(viewing)}>
                <RotateCcw className="h-4 w-4 mr-1" /> Restore this version
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Compare modal */}
      <Dialog open={!!comparing} onOpenChange={(o) => !o && setComparing(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>
              Compare v{comparing?.version_number} → current
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            {comparing && renderDiff(comparing.body_markdown ?? '', plainBody)}
          </ScrollArea>
          <Separator />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setComparing(null)}>
              Close
            </Button>
            {comparing && (
              <Button onClick={() => handleRestore(comparing)}>
                <RotateCcw className="h-4 w-4 mr-1" /> Restore this version
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default LetterQualityPanel;
