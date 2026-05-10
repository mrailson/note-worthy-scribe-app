import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FlaskConical, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useLetterheadStatus } from '@/hooks/useLetterheadStatus';
import { showShadcnToast } from '@/utils/toastWrapper';
import { ComplaintContextPane } from './ComplaintContextPane';
import { LetterEditor, type LetterType } from './LetterEditor';
import { LetterPreviewPane } from './LetterPreviewPane';

interface LetterLabProps {
  complaintId: string;
}

interface ComplaintRow {
  id: string;
  reference_number: string | null;
  patient_name: string | null;
  patient_address: string | null;
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
  letter_date: string;
  response_due_date: string | null;
  reference_number: string | null;
  body_markdown: string;
  body_html: string;
  updated_at: string;
}

// Convert basic markdown-ish HTML to a clean HTML string.
// RichTextEditor stores its onChange output as markdown-converted; for the
// preview we just show the value directly — the editor already handles HTML.
function markdownLikeToHtml(input: string): string {
  if (!input) return '';
  if (input.includes('<')) return input; // already HTML
  return input
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

export const LetterLab: React.FC<LetterLabProps> = ({ complaintId }) => {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');

  const [complaint, setComplaint] = useState<ComplaintRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [letterType, setLetterType] = useState<LetterType>('acknowledgement');
  const [draft, setDraft] = useState<DraftRow | null>(null);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const letterhead = useLetterheadStatus(complaint?.practice_id);
  const debounceRef = useRef<number | null>(null);
  const skipNextAutoSave = useRef(true);

  // Load complaint
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
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [complaintId]);

  // Load or create the active draft for this complaint + letter type
  useEffect(() => {
    let cancelled = false;
    (async () => {
      skipNextAutoSave.current = true;
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
      if (existing) {
        setDraft(existing as DraftRow);
        setBody((existing as DraftRow).body_markdown ?? '');
        setLastSavedAt(new Date((existing as DraftRow).updated_at));
        return;
      }
      // No draft yet — create one
      const { data: created, error: createErr } = await supabase
        .from('complaint_letter_lab_drafts')
        .insert({
          complaint_id: complaintId,
          letter_type: letterType,
          body_markdown: '',
          body_html: '',
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
      setDraft(created as DraftRow);
      setBody('');
      setLastSavedAt(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [complaintId, letterType]);

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

  // Debounced autosave on body change
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

  const handleSaveDraft = async () => {
    await persistDraft(body);
    showShadcnToast({ title: 'Draft saved' });
  };

  const handleGenerateVersion = async () => {
    if (!draft) return;
    await persistDraft(body);
    const { data: versions } = await supabase
      .from('complaint_letter_lab_versions')
      .select('version_number')
      .eq('draft_id', draft.id)
      .order('version_number', { ascending: false })
      .limit(1);
    const nextNumber = ((versions?.[0]?.version_number as number | undefined) ?? 0) + 1;
    const { error } = await supabase.from('complaint_letter_lab_versions').insert({
      draft_id: draft.id,
      version_number: nextNumber,
      body_markdown: body,
      tone: draft.tone,
      length: draft.length,
    });
    if (error) {
      showShadcnToast({
        title: 'Version save failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    showShadcnToast({ title: `Version ${nextNumber} saved` });
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

  const editorPane = (
    <LetterEditor
      letterType={letterType}
      onLetterTypeChange={setLetterType}
      body={body}
      onBodyChange={setBody}
      saving={saving}
      lastSavedAt={lastSavedAt}
      onSaveDraft={handleSaveDraft}
      onGenerateVersion={handleGenerateVersion}
    />
  );

  const previewPane = (
    <LetterPreviewPane
      letterhead={letterhead}
      bodyHtml={markdownLikeToHtml(body)}
      recipientName={complaint.patient_name}
      recipientAddress={complaint.patient_address}
      reference={draft?.reference_number ?? complaint.reference_number}
      letterDate={draft?.letter_date ? new Date(draft.letter_date) : new Date()}
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

  // Desktop — three column layout
  if (isDesktop) {
    return (
      <div>
        {header}
        <div className="grid grid-cols-10 gap-4">
          <div className="col-span-3">{contextPane}</div>
          <div className="col-span-4">{editorPane}</div>
          <div className="col-span-3">{previewPane}</div>
        </div>
      </div>
    );
  }

  // Tablet — Editor / Preview tabs + collapsible context
  if (isTablet) {
    return (
      <div>
        {header}
        <Accordion type="single" collapsible defaultValue="ctx" className="mb-3">
          <AccordionItem value="ctx">
            <AccordionTrigger className="text-sm">Complaint context</AccordionTrigger>
            <AccordionContent>{contextPane}</AccordionContent>
          </AccordionItem>
        </Accordion>
        <Tabs defaultValue="editor">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="editor">{editorPane}</TabsContent>
          <TabsContent value="preview">{previewPane}</TabsContent>
        </Tabs>
      </div>
    );
  }

  // Mobile — stacked accordions
  return (
    <div>
      {header}
      <Accordion type="multiple" defaultValue={['editor']} className="space-y-2">
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
      </Accordion>
    </div>
  );
};

export default LetterLab;
