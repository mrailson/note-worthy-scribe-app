import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { FlaskConical, Loader2, SlidersHorizontal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useLetterheadStatus } from '@/hooks/useLetterheadStatus';
import { showShadcnToast } from '@/utils/toastWrapper';
import type { EditorCommands } from '@/components/RichTextEditor';
import { ComplaintContextPane } from './ComplaintContextPane';
import { LetterEditor, type LetterType } from './LetterEditor';
import { LetterPreviewPane } from './LetterPreviewPane';
import {
  LetterControlsPanel,
  type ControlsValue,
  type Length,
  type SignatoryOption,
  type Tone,
} from './LetterControlsPanel';
import { LetterQualityPanel, type QualityMetrics } from './LetterQualityPanel';

interface LetterLabProps {
  complaintId: string;
}

interface ComplaintRow {
  id: string;
  reference_number: string | null;
  patient_name: string | null;
  patient_address: string | null;
  patient_contact_email: string | null;
  complaint_on_behalf: boolean | null;
  complaint_description: string | null;
  complaint_title: string | null;
  status: string | null;
  created_at: string | null;
  submitted_at: string | null;
  practice_id: string | null;
  response_due_date: string | null;
}

interface DraftRow {
  id: string;
  complaint_id: string;
  letter_type: LetterType;
  status: string;
  tone: string;
  length: string;
  signatory_ids: string[] | null;
  letter_date: string;
  response_due_date: string | null;
  reference_number: string | null;
  body_markdown: string;
  body_html: string;
  updated_at: string;
}

function markdownLikeToHtml(input: string): string {
  if (!input) return '';
  if (input.includes('<')) return input;
  return input
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

function deriveInitials(name: string | null): string {
  if (!name) return 'CMP';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.map((p) => p[0]).join('').toUpperCase().slice(0, 3)) || 'CMP';
}

function suggestReference(opts: { practiceName: string | null; complaintId: string; date: Date }): string {
  const initials = deriveInitials(opts.practiceName);
  const year = opts.date.getFullYear();
  const short = opts.complaintId.replace(/-/g, '').slice(0, 4).toUpperCase();
  return `${initials}-CMP-${year}-${short}`;
}

export const LetterLab: React.FC<LetterLabProps> = ({ complaintId }) => {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');

  const [complaint, setComplaint] = useState<ComplaintRow | null>(null);
  const [practiceName, setPracticeName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [letterType, setLetterType] = useState<LetterType>('acknowledgement');
  const [draft, setDraft] = useState<DraftRow | null>(null);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [signatories, setSignatories] = useState<SignatoryOption[]>([]);
  const [signatoriesLoading, setSignatoriesLoading] = useState(false);

  const [controls, setControls] = useState<ControlsValue>({
    tone: 'formal',
    length: 'standard',
    signatoryIds: [],
    letterDate: new Date(),
    responseDueDate: null,
    agreedTimeframe: null,
    referenceNumber: '',
  });
  const [settingsChanged, setSettingsChanged] = useState(false);
  const [versionsRefreshKey, setVersionsRefreshKey] = useState(0);
  const latestMetricsRef = useRef<QualityMetrics | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const letterhead = useLetterheadStatus(complaint?.practice_id);
  const debounceRef = useRef<number | null>(null);
  const controlsDebounceRef = useRef<number | null>(null);
  const skipNextAutoSave = useRef(true);
  const skipControlsAutoSave = useRef(true);
  const editorCmdsRef = useRef<EditorCommands | null>(null);

  // Load complaint + practice name
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('complaints')
        .select(
          'id, reference_number, patient_name, patient_address, complaint_on_behalf, complaint_description, complaint_title, status, created_at, submitted_at, practice_id, response_due_date',
        )
        .eq('id', complaintId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('[LetterLab] complaint load failed:', error);
      } else {
        setComplaint(data as ComplaintRow);
        if (data?.practice_id) {
          const { data: p } = await supabase
            .from('gp_practices')
            .select('name')
            .eq('id', data.practice_id)
            .maybeSingle();
          if (!cancelled) setPracticeName((p as any)?.name ?? null);
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [complaintId]);

  // Load signatories for practice
  useEffect(() => {
    if (!complaint?.practice_id) return;
    let cancelled = false;
    (async () => {
      setSignatoriesLoading(true);
      const { data, error } = await supabase
        .from('complaint_signatures')
        .select('id, name, job_title, signature_image_url')
        .eq('practice_id', complaint.practice_id)
        .order('is_default', { ascending: false })
        .order('name');
      if (cancelled) return;
      if (error) {
        console.warn('[LetterLab] signatories load failed:', error);
      } else {
        setSignatories((data ?? []) as SignatoryOption[]);
      }
      setSignatoriesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [complaint?.practice_id]);

  // Load or create the active draft
  useEffect(() => {
    if (!complaint) return;
    let cancelled = false;
    (async () => {
      skipNextAutoSave.current = true;
      skipControlsAutoSave.current = true;
      const { data: existing, error } = await supabase
        .from('complaint_letter_lab_drafts')
        .select('*')
        .eq('complaint_id', complaintId)
        .eq('letter_type', letterType)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('[LetterLab] draft fetch failed:', error);
        return;
      }

      const seedDate = new Date();
      const initialRef = suggestReference({
        practiceName,
        complaintId,
        date: seedDate,
      });

      if (existing) {
        const row = existing as DraftRow;
        setDraft(row);
        setBody(row.body_markdown ?? '');
        setLastSavedAt(new Date(row.updated_at));
        setControls({
          tone: (row.tone as Tone) ?? 'formal',
          length: (row.length as Length) ?? 'standard',
          signatoryIds: row.signatory_ids ?? [],
          letterDate: row.letter_date ? new Date(row.letter_date) : seedDate,
          responseDueDate: row.response_due_date ? new Date(row.response_due_date) : null,
          agreedTimeframe: null,
          referenceNumber: row.reference_number ?? initialRef,
        });
        setSettingsChanged(false);
        return;
      }

      // Create new
      const { data: created, error: createErr } = await supabase
        .from('complaint_letter_lab_drafts')
        .insert({
          complaint_id: complaintId,
          letter_type: letterType,
          body_markdown: '',
          body_html: '',
          reference_number: initialRef,
        })
        .select()
        .single();
      if (cancelled) return;
      if (createErr) {
        console.error('[LetterLab] draft create failed:', createErr);
        showShadcnToast({
          title: 'Could not create draft',
          description: createErr.message,
          variant: 'destructive',
        });
        return;
      }
      const row = created as DraftRow;
      setDraft(row);
      setBody('');
      setLastSavedAt(null);
      setControls({
        tone: 'formal',
        length: 'standard',
        signatoryIds: [],
        letterDate: seedDate,
        responseDueDate: null,
        agreedTimeframe: null,
        referenceNumber: initialRef,
      });
      setSettingsChanged(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [complaint, complaintId, letterType, practiceName]);

  const persistDraft = useCallback(
    async (nextBody: string) => {
      if (!draft) return;
      setSaving(true);
      const html = markdownLikeToHtml(nextBody);
      const { error } = await supabase
        .from('complaint_letter_lab_drafts')
        .update({ body_markdown: nextBody, body_html: html })
        .eq('id', draft.id);
      setSaving(false);
      if (error) {
        console.error('[LetterLab] autosave failed:', error);
        return;
      }
      setLastSavedAt(new Date());
    },
    [draft],
  );

  // Body autosave
  useEffect(() => {
    if (skipNextAutoSave.current) {
      skipNextAutoSave.current = false;
      return;
    }
    if (!draft) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void persistDraft(body);
    }, 1500);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [body, draft, persistDraft]);

  // Controls autosave (debounced)
  useEffect(() => {
    if (skipControlsAutoSave.current) {
      skipControlsAutoSave.current = false;
      return;
    }
    if (!draft) return;
    if (controlsDebounceRef.current) window.clearTimeout(controlsDebounceRef.current);
    controlsDebounceRef.current = window.setTimeout(async () => {
      const { error } = await supabase
        .from('complaint_letter_lab_drafts')
        .update({
          tone: controls.tone,
          length: controls.length,
          signatory_ids: controls.signatoryIds,
          letter_date: controls.letterDate.toISOString().slice(0, 10),
          response_due_date: controls.responseDueDate
            ? controls.responseDueDate.toISOString().slice(0, 10)
            : null,
          reference_number: controls.referenceNumber || null,
        })
        .eq('id', draft.id);
      if (error) console.warn('[LetterLab] controls autosave failed:', error);
    }, 800);
    return () => {
      if (controlsDebounceRef.current) window.clearTimeout(controlsDebounceRef.current);
    };
  }, [controls, draft]);

  const handleControlsChange = (patch: Partial<ControlsValue>) => {
    setControls((prev) => ({ ...prev, ...patch }));
    if (
      patch.tone !== undefined ||
      patch.length !== undefined ||
      patch.signatoryIds !== undefined
    ) {
      setSettingsChanged(true);
    }
  };

  const handleSaveDraft = async () => {
    await persistDraft(body);
    showShadcnToast({ title: 'Draft saved' });
  };

  const writeVersion = useCallback(
    async (opts: { bodyText: string; changeNote?: string }) => {
      if (!draft) return null;
      const { data: versions } = await supabase
        .from('complaint_letter_lab_versions')
        .select('version_number')
        .eq('draft_id', draft.id)
        .order('version_number', { ascending: false })
        .limit(1);
      const nextNumber = ((versions?.[0]?.version_number as number | undefined) ?? 0) + 1;
      const { data: userRes } = await supabase.auth.getUser();
      const m = latestMetricsRef.current;
      const { error } = await supabase.from('complaint_letter_lab_versions').insert({
        draft_id: draft.id,
        version_number: nextNumber,
        body_markdown: opts.bodyText,
        tone: controls.tone,
        length: controls.length,
        reading_age: m?.readingAge ?? null,
        flesch_kincaid_grade: m?.fleschGrade ?? null,
        compliance_score: m?.complianceScore ?? null,
        change_note: opts.changeNote ?? null,
        created_by: userRes?.user?.id ?? null,
      });
      if (error) {
        showShadcnToast({
          title: 'Version save failed',
          description: error.message,
          variant: 'destructive',
        });
        return null;
      }
      setVersionsRefreshKey((k) => k + 1);
      return nextNumber;
    },
    [draft, controls.tone, controls.length],
  );

  const handleGenerateVersion = async () => {
    if (!draft) return;
    await persistDraft(body);
    const n = await writeVersion({ bodyText: body });
    if (n != null) {
      setSettingsChanged(false);
      showShadcnToast({ title: `Version ${n} saved` });
    }
  };

  const handleRestoreVersion = async (restoredBody: string) => {
    if (!draft) return;
    // Snapshot current first so nothing is lost
    if (body && body !== restoredBody) {
      await writeVersion({ bodyText: body, changeNote: 'Auto-snapshot before restore' });
    }
    setBody(restoredBody);
    await persistDraft(restoredBody);
  };

  const runAi = useCallback(
    async (mode: 'generate' | 'regenerate' | 'simplify' | 'rewrite-section', sectionText?: string) => {
      if (!draft) return;
      setAiLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('letter-lab-generate', {
          body: { draftId: draft.id, mode, sectionText },
        });
        if (error) throw error;
        const result = data as {
          bodyMarkdown?: string;
          warnings?: string[];
        } | null;
        const next = result?.bodyMarkdown ?? '';
        if (!next) {
          showShadcnToast({ title: 'AI returned no content', variant: 'destructive' });
          return;
        }
        if (mode === 'rewrite-section' && editorCmdsRef.current) {
          editorCmdsRef.current.insertText(next);
        } else {
          setBody(next);
        }
        if (mode === 'regenerate') setSettingsChanged(false);
        showShadcnToast({
          title:
            mode === 'simplify'
              ? 'Simplified draft applied'
              : mode === 'rewrite-section'
                ? 'Section rewritten'
                : 'AI draft applied',
          description: result?.warnings?.length ? result.warnings.join(' · ') : undefined,
        });
      } catch (e: any) {
        console.error('[LetterLab] AI call failed:', e);
        showShadcnToast({
          title: 'AI generation failed',
          description: e?.message ?? 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        setAiLoading(false);
      }
    },
    [draft],
  );

  const handleRegenerate = () => {
    void runAi('regenerate');
  };

  const handleAiGenerate = () => {
    void runAi('generate');
  };

  const handleAiRewriteSelection = () => {
    const sel = typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '';
    if (!sel) {
      showShadcnToast({
        title: 'No selection',
        description: 'Select text in the editor first, then click "Rewrite selection".',
      });
      return;
    }
    void runAi('rewrite-section', sel);
  };

  const handleAiSimplify = async () => {
    await runAi('simplify');
  };

  const handleInsertSnippet = (text: string) => {
    if (editorCmdsRef.current) {
      editorCmdsRef.current.insertText(text + '\n\n');
    } else {
      setBody((b) => (b ? b + '\n\n' + text : text));
    }
  };

  if (loading || !complaint) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading Letter Lab…
        </CardContent>
      </Card>
    );
  }

  const controlsPanel = (
    <LetterControlsPanel
      letterType={letterType}
      value={controls}
      onChange={handleControlsChange}
      signatories={signatories}
      signatoriesLoading={signatoriesLoading}
      settingsChanged={settingsChanged}
      onRegenerate={handleRegenerate}
      onInsertSnippet={handleInsertSnippet}
    />
  );

  const editorPane = (
    <div className="relative">
      <LetterEditor
        letterType={letterType}
        onLetterTypeChange={setLetterType}
        body={body}
        onBodyChange={setBody}
        saving={saving}
        lastSavedAt={lastSavedAt}
        onSaveDraft={handleSaveDraft}
        onGenerateVersion={handleGenerateVersion}
        onEditorReady={(cmds) => {
          editorCmdsRef.current = cmds;
        }}
        onAiGenerate={handleAiGenerate}
        onAiRewriteSelection={handleAiRewriteSelection}
        aiLoading={aiLoading}
      />
      {/* Desktop drawer trigger */}
      {isDesktop && (
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="absolute -right-3 top-2 z-10 shadow-md"
              title="Letter controls"
            >
              <SlidersHorizontal className="h-4 w-4 mr-1" /> Controls
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[380px] sm:w-[420px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Letter Controls</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{controlsPanel}</div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );

  const qualityPanel = (
    <LetterQualityPanel
      draftId={draft?.id ?? null}
      letterType={letterType}
      body={body}
      onInsertSnippet={handleInsertSnippet}
      onRestoreVersion={handleRestoreVersion}
      onSimplify={handleAiSimplify}
      onMetricsChange={(m) => {
        latestMetricsRef.current = m;
      }}
      versionsRefreshKey={versionsRefreshKey}
    />
  );

  const previewPane = (
    <LetterPreviewPane
      letterhead={letterhead}
      bodyHtml={markdownLikeToHtml(body)}
      recipientName={complaint.patient_name}
      recipientAddress={complaint.patient_address}
      reference={controls.referenceNumber || complaint.reference_number}
      letterDate={controls.letterDate}
      letterType={letterType}
    />
  );

  const contextPane = <ComplaintContextPane complaint={complaint} />;

  const header = (
    <div className="flex items-center justify-between gap-2 mb-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-purple-600" /> Letter Lab
          <Badge variant="outline" className="border-purple-300 text-purple-700">
            Beta
          </Badge>
        </h2>
        <p className="text-xs text-muted-foreground">
          Experimental letter generator — runs alongside the live tools so output can be compared.
        </p>
      </div>
    </div>
  );

  // Desktop — three column layout, controls in right-edge sheet
  if (isDesktop) {
    return (
      <div>
        {header}
        <div className="grid grid-cols-10 gap-4">
          <div className="col-span-3">{contextPane}</div>
          <div className="col-span-4 space-y-4">
            {editorPane}
            {qualityPanel}
          </div>
          <div className="col-span-3">{previewPane}</div>
        </div>
      </div>
    );
  }

  // Tablet — controls accordion strip, then Editor / Preview tabs
  if (isTablet) {
    return (
      <div>
        {header}
        <Accordion type="multiple" defaultValue={['controls']} className="mb-3 space-y-2">
          <AccordionItem value="controls">
            <AccordionTrigger className="text-sm">Letter controls</AccordionTrigger>
            <AccordionContent>{controlsPanel}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="ctx">
            <AccordionTrigger className="text-sm">Complaint context</AccordionTrigger>
            <AccordionContent>{contextPane}</AccordionContent>
          </AccordionItem>
        </Accordion>
        <Tabs defaultValue="editor">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="quality">Quality</TabsTrigger>
          </TabsList>
          <TabsContent value="editor">{editorPane}</TabsContent>
          <TabsContent value="preview">{previewPane}</TabsContent>
          <TabsContent value="quality">{qualityPanel}</TabsContent>
        </Tabs>
      </div>
    );
  }

  // Mobile — stacked accordions
  return (
    <div>
      {header}
      <Accordion type="multiple" defaultValue={['editor']} className="space-y-2">
        <AccordionItem value="controls">
          <AccordionTrigger className="text-sm">Letter controls</AccordionTrigger>
          <AccordionContent>{controlsPanel}</AccordionContent>
        </AccordionItem>
        <AccordionItem value="ctx">
          <AccordionTrigger className="text-sm">Complaint context</AccordionTrigger>
          <AccordionContent>{contextPane}</AccordionContent>
        </AccordionItem>
        <AccordionItem value="editor">
          <AccordionTrigger className="text-sm">Editor</AccordionTrigger>
          <AccordionContent>{editorPane}</AccordionContent>
        </AccordionItem>
        <AccordionItem value="preview">
          <AccordionTrigger className="text-sm">Preview</AccordionTrigger>
          <AccordionContent>{previewPane}</AccordionContent>
        </AccordionItem>
        <AccordionItem value="quality">
          <AccordionTrigger className="text-sm">Quality &amp; history</AccordionTrigger>
          <AccordionContent>{qualityPanel}</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default LetterLab;
