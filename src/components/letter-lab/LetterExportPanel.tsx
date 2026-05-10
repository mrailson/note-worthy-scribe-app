import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  FileDown,
  Mail,
  Printer,
  Copy,
  History,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  generateNHSLetterBlob,
  type NHSLetterExportOptions,
} from '@/utils/nhsLetterExport';
import { formatLetterForEmail } from '@/utils/formatLetterForEmail';
import type { UseLetterheadStatusResult } from '@/hooks/useLetterheadStatus';
import type { LetterType } from './LetterEditor';
import type { SignatoryOption } from './LetterControlsPanel';
import './print.css';

export interface LetterExportPanelProps {
  draftId: string | null;
  letterType: LetterType;
  bodyMarkdown: string;
  bodyHtml: string;
  letterDate: Date;
  referenceNumber: string;
  signatoryIds: string[];
  signatories: SignatoryOption[];
  letterhead: UseLetterheadStatusResult;
  complianceItems: { label: string; present: boolean }[];
  readingAge: number;
  recipient: {
    name: string | null;
    address: string | null;
    email: string | null;
  };
  practice: {
    name: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
  /** Optional version_number snapshot (latest saved) used in export logs. */
  latestVersionNumber: number | null;
}

type ChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  blocking: boolean;
  fix?: { label: string; href?: string };
};

function stripHtml(input: string): string {
  if (!input) return '';
  if (!input.includes('<')) return input;
  return input.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/^[#>\s]+/gm, '')
    .replace(/[*_`~]/g, '')
    .trim();
}

function safeFilename(s: string): string {
  return (s || 'letter').replace(/[^a-z0-9_\-]+/gi, '_');
}

export const LetterExportPanel: React.FC<LetterExportPanelProps> = ({
  draftId,
  letterType,
  bodyMarkdown,
  bodyHtml,
  letterDate,
  referenceNumber,
  signatoryIds,
  signatories,
  letterhead,
  complianceItems,
  readingAge,
  recipient,
  practice,
  latestVersionNumber,
}) => {
  const plainBody = useMemo(() => stripHtml(bodyHtml || bodyMarkdown), [bodyHtml, bodyMarkdown]);

  // ---- Recipient regex ----
  const hasRecipientName = !!recipient.name && plainBody.includes(recipient.name.split(/\s+/)[0]);
  // accept either explicit recipient address presence or postcode-like pattern in body
  const hasRecipientAddress =
    !!recipient.address ||
    /\b[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}\b/.test(plainBody);

  // ---- Mandatory compliance subset ----
  const mandatoryLabels = letterType === 'outcome'
    ? ['Includes PHSO escalation right with contact details', 'States the findings', 'Includes apology where appropriate']
    : ['Mentions PHSO escalation right', "States the practice's complaints procedure", 'Mentions advocacy support'];
  const mandatoryItems = complianceItems.filter((c) => mandatoryLabels.includes(c.label));
  const allMandatoryPass =
    mandatoryItems.length === mandatoryLabels.length && mandatoryItems.every((c) => c.present);

  // ---- PII check ----
  const [piiLoading, setPiiLoading] = useState(false);
  const [piiUnexpected, setPiiUnexpected] = useState<string[] | null>(null);
  const [piiChecked, setPiiChecked] = useState(false);

  const runPiiCheck = useCallback(async () => {
    if (!plainBody) return;
    setPiiLoading(true);
    try {
      const expected = [
        recipient.name,
        ...signatories.filter((s) => signatoryIds.includes(s.id)).map((s) => s.name),
        practice.name,
      ].filter(Boolean) as string[];
      const { data, error } = await supabase.functions.invoke('letter-lab-pii-check', {
        body: { body: plainBody, expectedNames: expected },
      });
      if (error) throw error;
      const list = ((data as any)?.unexpectedNames ?? []) as string[];
      setPiiUnexpected(list);
      setPiiChecked(true);
    } catch (e) {
      console.warn('[LetterExportPanel] PII check failed:', e);
      setPiiUnexpected([]);
      setPiiChecked(true);
    } finally {
      setPiiLoading(false);
    }
  }, [plainBody, recipient.name, signatories, signatoryIds, practice.name]);

  // Auto-run PII check when body changes substantively (debounced)
  useEffect(() => {
    setPiiChecked(false);
    setPiiUnexpected(null);
    if (!plainBody || plainBody.length < 80) return;
    const t = window.setTimeout(() => {
      void runPiiCheck();
    }, 2500);
    return () => window.clearTimeout(t);
  }, [plainBody, runPiiCheck]);

  // ---- Build checklist ----
  const checklist: ChecklistItem[] = useMemo(() => {
    const items: ChecklistItem[] = [
      {
        id: 'recipient',
        label: 'Recipient name and address present',
        ok: hasRecipientName && hasRecipientAddress,
        blocking: true,
        fix: { label: 'Add recipient details to the editor' },
      },
      {
        id: 'date',
        label: 'Letter date set',
        ok: !!letterDate,
        blocking: true,
        fix: { label: 'Set the letter date in Controls' },
      },
      {
        id: 'ref',
        label: 'Reference number set',
        ok: !!referenceNumber.trim(),
        blocking: true,
        fix: { label: 'Set a reference number in Controls' },
      },
      {
        id: 'signatory',
        label: 'At least one signatory selected',
        ok: signatoryIds.length > 0,
        blocking: true,
        fix: { label: 'Pick a signatory in Controls' },
      },
      {
        id: 'letterhead',
        label: 'Letterhead active',
        ok: letterhead.status === 'active',
        blocking: true,
        fix: { label: 'Upload a letterhead', href: '/complaints/letterhead-settings' },
      },
      {
        id: 'compliance',
        label: 'Mandatory compliance items pass',
        ok: allMandatoryPass,
        blocking: true,
        fix: { label: 'Add missing snippets in the Quality panel' },
      },
      {
        id: 'reading',
        label: `Reading age ≤ 14 (currently ${readingAge || '—'})`,
        ok: !readingAge || readingAge <= 14,
        blocking: false,
        fix: { label: 'Use Simplify with AI in the Quality panel' },
      },
      {
        id: 'pii',
        label: piiChecked
          ? piiUnexpected && piiUnexpected.length > 0
            ? `PII leak: ${piiUnexpected.join(', ')}`
            : 'No PII leaks detected'
          : 'PII leak check pending',
        ok: piiChecked && (!piiUnexpected || piiUnexpected.length === 0),
        blocking: true,
        fix: { label: 'Re-run PII check' },
      },
    ];
    return items;
  }, [
    hasRecipientName,
    hasRecipientAddress,
    letterDate,
    referenceNumber,
    signatoryIds.length,
    letterhead.status,
    allMandatoryPass,
    readingAge,
    piiChecked,
    piiUnexpected,
  ]);

  const passedCount = checklist.filter((c) => c.ok).length;
  const totalCount = checklist.length;
  const blockingFails = checklist.filter((c) => c.blocking && !c.ok);
  const ready = blockingFails.length === 0;
  const readinessPct = Math.round((passedCount / totalCount) * 100);

  // ---- Export history ----
  type ExportRow = {
    id: string;
    format: string;
    exported_at: string;
    exported_by: string | null;
    version_number: number | null;
    recipient_email: string | null;
    notes: string | null;
  };
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ExportRow[]>([]);

  const loadHistory = useCallback(async () => {
    if (!draftId) return;
    const { data, error } = await supabase
      .from('complaint_letter_lab_exports')
      .select('id, format, exported_at, exported_by, version_number, recipient_email, notes')
      .eq('draft_id', draftId)
      .order('exported_at', { ascending: false });
    if (error) {
      console.warn('[LetterExportPanel] history load failed:', error);
      return;
    }
    setHistory((data ?? []) as ExportRow[]);
  }, [draftId]);

  useEffect(() => {
    if (historyOpen) void loadHistory();
  }, [historyOpen, loadHistory]);

  const logExport = useCallback(
    async (
      formatKey: 'docx' | 'pdf' | 'email' | 'print' | 'plaintext',
      extras?: { recipient_email?: string | null; file_size_bytes?: number | null; notes?: string | null },
    ) => {
      if (!draftId) return;
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from('complaint_letter_lab_exports').insert({
        draft_id: draftId,
        version_number: latestVersionNumber,
        format: formatKey,
        exported_by: userRes?.user?.id ?? null,
        recipient_email: extras?.recipient_email ?? null,
        file_size_bytes: extras?.file_size_bytes ?? null,
        notes: extras?.notes ?? null,
      });
      if (error) console.warn('[LetterExportPanel] export log failed:', error);
    },
    [draftId, latestVersionNumber],
  );

  // ---- Export actions ----
  const primarySignatory = signatories.find((s) => signatoryIds.includes(s.id)) ?? null;
  const dateStr = format(letterDate, 'yyyy-MM-dd');
  const baseName = `${safeFilename(referenceNumber || 'letter')}_${letterType}_${dateStr}`;

  const handleDocx = async () => {
    try {
      const opts: NHSLetterExportOptions = {
        content: stripMarkdown(bodyMarkdown),
        filename: `${baseName}.docx`,
        practiceName: practice.name ?? undefined,
        practiceAddress: practice.address ?? undefined,
        practicePhone: practice.phone ?? undefined,
        practiceEmail: practice.email ?? undefined,
        practiceLogoUrl: letterhead.letterhead?.signed_url ?? undefined,
        clinicianName: primarySignatory?.name ?? undefined,
        clinicianTitle: primarySignatory?.job_title ?? undefined,
      };
      const blob = await generateNHSLetterBlob(opts);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      void logExport('docx', { file_size_bytes: blob.size });
      toast.success('Word document downloaded');
    } catch (e: any) {
      console.error('[LetterExportPanel] docx failed:', e);
      toast.error('Word export failed', { description: e?.message });
    }
  };

  const handlePrint = (asPdf: boolean) => {
    // Reuse the existing on-screen .letter-print-area via the print stylesheet.
    window.print();
    void logExport(asPdf ? 'pdf' : 'print');
    if (asPdf) {
      toast('Choose "Save as PDF" in the print dialog');
    }
  };

  const handleCopyHtml = async () => {
    try {
      const html = formatLetterForEmail(
        bodyMarkdown,
        undefined,
        letterhead.letterhead
          ? {
              signed_url: letterhead.letterhead.signed_url,
              height_cm: letterhead.letterhead.height_cm,
              alignment: letterhead.letterhead.alignment,
              top_margin_cm: letterhead.letterhead.top_margin_cm,
            }
          : null,
      );
      await navigator.clipboard.writeText(html);
      void logExport('email', { notes: 'copied HTML to clipboard' });
      toast.success('Email-ready HTML copied — paste into Outlook or Gmail');
    } catch (e: any) {
      toast.error('Could not copy HTML', { description: e?.message });
    }
  };

  const handleOpenGmail = () => {
    const subject = `Re: Complaint ${referenceNumber} — ${letterType}`;
    const body = stripMarkdown(bodyMarkdown);
    const to = recipient.email ?? '';
    if (!to) {
      toast.warning('No recipient email on the complaint — opening blank "to" field');
    }
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    void logExport('email', { recipient_email: to || null, notes: 'opened Gmail compose' });
  };

  const handleCopyPlain = async () => {
    try {
      await navigator.clipboard.writeText(stripMarkdown(bodyMarkdown));
      void logExport('plaintext');
      toast.success('Plain-text letter copied to clipboard');
    } catch (e: any) {
      toast.error('Could not copy text', { description: e?.message });
    }
  };

  // ---- Render ----
  const [checklistOpen, setChecklistOpen] = useState(false);

  const ExportButton = ({
    icon: Icon,
    label,
    onClick,
    note,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
    note?: string;
  }) => (
    <div className="flex flex-col gap-1">
      <Button
        variant={ready ? 'default' : 'outline'}
        size="sm"
        onClick={() => (ready ? onClick() : setChecklistOpen(true))}
        disabled={!ready}
        className="justify-start"
      >
        <Icon className="h-4 w-4 mr-2" />
        {label}
        {ready && (
          <Badge variant="secondary" className="ml-auto text-[10px] py-0">
            Ready
          </Badge>
        )}
      </Button>
      {note && <span className="text-[11px] text-muted-foreground pl-1">{note}</span>}
    </div>
  );

  return (
    <Card className="mt-4 no-print">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileDown className="h-4 w-4" /> Export &amp; send
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHistoryOpen(true)}
            title="Export history"
          >
            <History className="h-4 w-4 mr-1" /> History
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Readiness */}
        <button
          type="button"
          className="w-full text-left rounded-md border p-3 hover:bg-muted/40 transition"
          onClick={() => setChecklistOpen(true)}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-medium">
              Ready to send: {passedCount}/{totalCount}{' '}
              {ready ? '✓' : <span className="text-amber-600">— review checklist</span>}
            </span>
            <span className="text-xs text-muted-foreground">
              {blockingFails.length > 0 && `${blockingFails.length} blocking`}
            </span>
          </div>
          <Progress value={readinessPct} className="h-2" />
        </button>

        {/* Export buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ExportButton icon={FileText} label="Word (.docx)" onClick={handleDocx} />
          <ExportButton
            icon={FileDown}
            label="PDF"
            onClick={() => handlePrint(true)}
            note="Opens print dialog — choose 'Save as PDF'"
          />
          <ExportButton icon={Mail} label="Copy HTML for email" onClick={handleCopyHtml} />
          <ExportButton icon={Mail} label="Open in Gmail" onClick={handleOpenGmail} />
          <ExportButton icon={Printer} label="Print" onClick={() => handlePrint(false)} />
          <ExportButton icon={Copy} label="Copy plain text" onClick={handleCopyPlain} />
        </div>

        {!ready && (
          <p className="text-xs text-muted-foreground flex items-start gap-1">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-600" />
            Complete the pre-send checklist to unlock exports.
          </p>
        )}
      </CardContent>

      {/* Checklist modal */}
      <Dialog open={checklistOpen} onOpenChange={setChecklistOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" /> Pre-send checklist
            </DialogTitle>
            <DialogDescription>
              All blocking items must pass before exports unlock.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 mt-2">
            {checklist.map((c) => (
              <li
                key={c.id}
                className={cn(
                  'flex items-start gap-2 rounded p-2 border',
                  c.ok
                    ? 'border-emerald-200 bg-emerald-50'
                    : c.blocking
                      ? 'border-red-200 bg-red-50'
                      : 'border-amber-200 bg-amber-50',
                )}
              >
                {c.ok ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle
                    className={cn(
                      'h-4 w-4 mt-0.5 shrink-0',
                      c.blocking ? 'text-red-600' : 'text-amber-600',
                    )}
                  />
                )}
                <div className="flex-1 text-sm">
                  <div>
                    {c.label}
                    {!c.blocking && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        warn-only
                      </Badge>
                    )}
                  </div>
                  {!c.ok && c.fix && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Suggested fix: {c.fix.label}
                      {c.id === 'pii' && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 ml-2 text-xs"
                          disabled={piiLoading}
                          onClick={runPiiCheck}
                        >
                          {piiLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            'Re-run check'
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {/* History drawer */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="right" className="w-[420px] sm:w-[520px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Export history</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground">No exports yet for this draft.</p>
            )}
            {history.map((row) => (
              <div key={row.id} className="border rounded-md p-3 text-sm bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="font-semibold uppercase">{row.format}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(row.exported_at).toLocaleString('en-GB', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                  {row.version_number != null && <span>Version {row.version_number}</span>}
                  {row.recipient_email && <span>→ {row.recipient_email}</span>}
                </div>
                {row.notes && (
                  <p className="text-xs italic text-muted-foreground mt-1">{row.notes}</p>
                )}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
};

export default LetterExportPanel;
