import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Play, Mail, FileText, CheckCircle2, Clock, Trash2, Plus, X, Download } from 'lucide-react';
import { TEST_FIXTURES, type TestSize, getFixture } from '@/lib/pipelineTestFixtures';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// Models the dropdown offers. The `value` is what the orchestrator's
// modelOverride switch routes on (see auto-generate-meeting-notes/index.ts).
const MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', provider: 'Anthropic',
    note: 'Current default — quality baseline' },
  { value: 'gpt-5.2',           label: 'GPT-5.2',           provider: 'OpenAI',
    note: 'Flagship comparison' },
  { value: 'gemini-3.1-pro',    label: 'Gemini 3.1 Pro',    provider: 'Google',
    note: 'Google flagship' },
  { value: 'gemini-2.5-flash',  label: 'Gemini 2.5 Flash',  provider: 'Google',
    note: 'Fast, cheap, 1M context' },
  { value: 'gemini-3-flash',    label: 'Gemini 3 Flash',    provider: 'Google',
    note: 'Newest, cheapest' },
] as const;

const STAGES = [
  { key: 'meeting_inserted_at',              label: 'Meeting created',             icon: FileText,     indent: 0 },
  { key: 'transcript_inserted_at',           label: 'Transcript saved',            icon: FileText,     indent: 0 },
  { key: 'notes_invoked_at',                 label: 'Notes function invoked',      icon: Play,         indent: 0 },
  { key: 'notes_status_generating_at',       label: 'Generation started',          icon: Loader2,      indent: 0 },
  { key: 'notes_meeting_loaded_at',          label: 'Meeting + transcript loaded', icon: FileText,     indent: 1 },
  { key: 'notes_documents_loaded_at',        label: 'Documents extracted',         icon: FileText,     indent: 1 },
  { key: 'notes_title_generated_at',         label: 'Title generated',             icon: FileText,     indent: 1 },
  { key: 'notes_prompt_assembled_at',        label: 'Prompt assembled',            icon: FileText,     indent: 1 },
  { key: 'notes_request_dispatched_at',      label: 'Model request dispatched',    icon: Play,         indent: 1 },
  { key: 'notes_first_delta_at',             label: 'Model response started',      icon: Play,         indent: 1 },
  { key: 'notes_stream_complete_at',         label: 'Model response complete',     icon: CheckCircle2, indent: 1 },
  { key: 'notes_post_processing_complete_at',label: 'Post-processing complete',    icon: CheckCircle2, indent: 1 },
  { key: 'notes_completed_at',               label: 'Notes saved',                 icon: CheckCircle2, indent: 0 },
  { key: 'summary_inserted_at',              label: 'Summary inserted',            icon: CheckCircle2, indent: 0 },
  { key: 'email_triggered_at',               label: 'Email triggered',             icon: Mail,         indent: 0 },
  { key: 'email_sent_at',                    label: 'Email sent',                  icon: Mail,         indent: 0 },
] as const;

interface TestRun {
  id: string;
  test_size: TestSize;
  meeting_id: string | null;
  transcript_chars: number;
  transcript_words: number;
  started_at: string;
  meeting_inserted_at: string | null;
  transcript_inserted_at: string | null;
  notes_invoked_at: string | null;
  notes_status_generating_at: string | null;
  notes_meeting_loaded_at: string | null;
  notes_documents_loaded_at: string | null;
  notes_title_generated_at: string | null;
  notes_prompt_assembled_at: string | null;
  notes_request_dispatched_at: string | null;
  notes_first_delta_at: string | null;
  notes_stream_complete_at: string | null;
  notes_post_processing_complete_at: string | null;
  notes_completed_at: string | null;
  summary_inserted_at: string | null;
  email_triggered_at: string | null;
  email_sent_at: string | null;
  finished_at: string | null;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  notes_model_used: string | null;
  notes_path: string | null;
  notes_chars: number | null;
  action_count: number | null;
  email_recipient: string | null;
  error_message: string | null;
  model_override: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd_est: number | null;
  docx_storage_path: string | null;
  custom_test: boolean | null;
}

const STAGE_TIMEOUT_MS = 10 * 60 * 1000;

function formatMs(ms: number | null): string {
  if (ms === null || isNaN(ms)) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export default function PipelineTest() {
  const { toast } = useToast();
  const [activeRun, setActiveRun] = useState<TestRun | null>(null);
  const [history, setHistory] = useState<TestRun[]>([]);
  const [launching, setLaunching] = useState<TestSize | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('claude-sonnet-4-6');
  const [forceSingleShot, setForceSingleShot] = useState<boolean>(false);
  const [outputTier, setOutputTier] = useState<'executive' | 'full' | 'verbatim'>('full');

  // Real Meeting Replay
  interface ReplayMeeting {
    id: string;
    title: string | null;
    created_at: string;
    duration_minutes: number | null;
    notes_model_used: string | null;
    transcript_chars: number;
  }
  const [replayMeetings, setReplayMeetings] = useState<ReplayMeeting[]>([]);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [replayLimit, setReplayLimit] = useState(50);

  // Filters
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Queue
  type QueueItem =
    | { id: string; kind: 'fixture'; size: TestSize; model: string; forceSingleShot?: boolean }
    | { id: string; kind: 'custom'; model: string; transcript: string; title: string; durationMinutes: number; forceSingleShot?: boolean };
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueRunning, setQueueRunning] = useState(false);
  const [queueProgress, setQueueProgress] = useState<{ index: number; total: number; completed: number; failed: number } | null>(null);
  const cancelQueueRef = useRef(false);

  // Custom transcript
  const [customTab, setCustomTab] = useState<'paste' | 'upload'>('paste');
  const [customText, setCustomText] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customDuration, setCustomDuration] = useState<number | ''>('');
  const [customLaunching, setCustomLaunching] = useState(false);
  const [customExtracting, setCustomExtracting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);
      await refreshHistory();
    })();
  }, []);

  useEffect(() => {
    if (!activeRun || activeRun.status !== 'running') return;
    const interval = setInterval(async () => {
      const updated = await fetchRun(activeRun.id);
      if (updated) {
        setActiveRun(updated);
        if (updated.status !== 'running') {
          await refreshHistory();
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [activeRun?.id, activeRun?.status]);

  async function refreshHistory() {
    const { data } = await supabase
      .from('pipeline_test_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50);
    setHistory((data ?? []) as TestRun[]);
  }

  async function fetchRun(id: string): Promise<TestRun | null> {
    const { data } = await supabase
      .from('pipeline_test_runs')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return data as TestRun | null;
  }

  interface RunSpec {
    title: string;
    agenda: string;
    transcript: string;
    durationMinutes: number;
    size: TestSize;
    model: string;
    isCustom: boolean;
    forceSingleShot?: boolean;
    tier?: 'executive' | 'full' | 'verbatim';
    suppressEmail?: boolean;
    replayOf?: { id: string; title: string };
  }

  function classifySize(words: number): TestSize {
    if (words < 500) return 'short';
    if (words < 5000) return 'medium';
    return 'long';
  }

  /** Launch a run. Returns the runId, or null on launch failure. */
  async function launchRun(spec: RunSpec): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not signed in');

    const transcriptWords = spec.transcript.split(/\s+/).filter(Boolean).length;
    const transcriptChars = spec.transcript.length;
    const importSource = spec.isCustom ? 'pipeline_test_custom' : 'pipeline_test';

    const { data: runRow, error: runErr } = await supabase
      .from('pipeline_test_runs')
      .insert({
        user_id: user.id,
        test_size: spec.size,
        model_override: spec.model,
        transcript_chars: transcriptChars,
        transcript_words: transcriptWords,
        email_recipient: user.email,
        status: 'running',
        custom_test: spec.isCustom,
      } as any)
      .select()
      .single();
    if (runErr || !runRow) throw new Error(runErr?.message ?? 'Failed to create test run');

    const meetingInsertPayload: any = {
      user_id: user.id,
      title: spec.title,
      description: `[Pipeline test — ${spec.size}${spec.isCustom ? ' / custom' : ''}${spec.replayOf ? ' / replay' : ''}] ${spec.agenda}`,
      meeting_type: 'general',
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      duration_minutes: spec.durationMinutes,
      status: 'completed',
      import_source: spec.replayOf ? 'pipeline_test_replay' : importSource,
      meeting_format: 'face-to-face',
      notes_generation_status: 'queued',
    };
    if (spec.replayOf) {
      meetingInsertPayload.import_metadata = {
        source: 'real-meeting-replay',
        original_meeting_id: spec.replayOf.id,
        original_meeting_title: spec.replayOf.title,
      };
    }
    const { data: meeting, error: meetingErr } = await supabase
      .from('meetings')
      .insert(meetingInsertPayload)
      .select()
      .single();
    if (meetingErr || !meeting) throw new Error(`Meeting insert failed: ${meetingErr?.message}`);

    const meetingInsertedAt = new Date().toISOString();
    await supabase
      .from('pipeline_test_runs')
      .update({ meeting_id: meeting.id, meeting_inserted_at: meetingInsertedAt })
      .eq('id', runRow.id);

    const { error: transcriptErr } = await supabase
      .from('meeting_transcripts')
      .insert({
        meeting_id: meeting.id,
        content: spec.transcript,
        speaker_name: 'Test',
        timestamp_seconds: 0,
      });
    if (transcriptErr) throw new Error(`Transcript insert failed: ${transcriptErr.message}`);

    const transcriptInsertedAt = new Date().toISOString();
    await supabase
      .from('pipeline_test_runs')
      .update({ transcript_inserted_at: transcriptInsertedAt })
      .eq('id', runRow.id);

    const notesInvokedAt = new Date().toISOString();
    await supabase
      .from('pipeline_test_runs')
      .update({ notes_invoked_at: notesInvokedAt })
      .eq('id', runRow.id);

    supabase.functions
      .invoke('auto-generate-meeting-notes', {
        body: {
          meetingId: meeting.id,
          forceRegenerate: false,
          modelOverride: spec.model,
          forceSingleShot: spec.forceSingleShot === true,
          tier: spec.tier,
          suppressEmail: spec.suppressEmail === true,
        },
      })
      .catch(err => {
        console.warn('auto-generate-meeting-notes client timeout (expected for long):', err?.message);
      });

    const refreshed = await fetchRun(runRow.id);
    setActiveRun(refreshed);
    await refreshHistory();
    watchPipelineProgress(runRow.id, meeting.id, user.email ?? '');
    return runRow.id;
  }

  async function launchTest(size: TestSize) {
    setLaunching(size);
    try {
      const fixture = getFixture(size);
      await launchRun({
        title: fixture.title,
        agenda: fixture.agenda,
        transcript: fixture.transcript,
        durationMinutes: fixture.durationMinutes,
        size,
        model: selectedModel,
        isCustom: false,
        forceSingleShot,
        tier: outputTier,
      });
      const modelLabel = MODELS.find(m => m.value === selectedModel)?.label ?? selectedModel;
      toast({ title: 'Test launched', description: `${size} test on ${modelLabel}. Polling for stages…` });
    } catch (err: any) {
      toast({ title: 'Test failed to launch', description: err.message, variant: 'destructive' });
    } finally {
      setLaunching(null);
    }
  }

  /** Wait until a run reaches a terminal status. */
  async function waitForRun(runId: string, timeoutMs = STAGE_TIMEOUT_MS + 60_000): Promise<TestRun | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const r = await fetchRun(runId);
      if (r && r.status !== 'running') return r;
      await new Promise(res => setTimeout(res, 2500));
    }
    return await fetchRun(runId);
  }

  // ---------- Queue ----------
  function addToQueue(item: Omit<Extract<QueueItem, { kind: 'fixture' }>, 'id'> | Omit<Extract<QueueItem, { kind: 'custom' }>, 'id'>) {
    setQueue(q => [...q, { ...item, id: crypto.randomUUID() } as QueueItem]);
  }
  function removeFromQueue(id: string) {
    setQueue(q => q.filter(item => item.id !== id));
  }
  function clearQueue() { setQueue([]); }

  function estimateCost(model: string, size: TestSize): number {
    const matches = history.filter(h =>
      h.model_override === model && h.test_size === size && h.cost_usd_est != null
    );
    if (matches.length > 0) {
      const avg = matches.reduce((s, h) => s + Number(h.cost_usd_est), 0) / matches.length;
      return avg;
    }
    // Hardcoded fallback (rough)
    const baseChars = size === 'short' ? 1500 : size === 'medium' ? 12000 : 38000;
    const inTok = baseChars / 4;
    const outTok = inTok * 0.3;
    const rates: Record<string, [number, number]> = {
      'claude-sonnet-4-6': [3, 15],
      'gpt-5.2': [2.5, 10],
      'gemini-3.1-pro': [2, 8],
      'gemini-2.5-flash': [0.3, 1.2],
      'gemini-3-flash': [0.2, 0.8],
    };
    const [inR, outR] = rates[model] ?? [2, 8];
    return ((inTok / 1_000_000) * inR) + ((outTok / 1_000_000) * outR);
  }

  function estimateSeconds(size: TestSize): number {
    return size === 'short' ? 30 : size === 'medium' ? 90 : 180;
  }

  const queueTotals = useMemo(() => {
    let cost = 0; let secs = 0;
    for (const item of queue) {
      const size: TestSize = item.kind === 'fixture' ? item.size : classifySize(item.transcript.split(/\s+/).filter(Boolean).length);
      cost += estimateCost(item.model, size);
      secs += estimateSeconds(size);
    }
    return { cost, secs };
  }, [queue, history]);

  async function runQueue() {
    if (queue.length === 0) return;
    setQueueRunning(true);
    cancelQueueRef.current = false;
    let completed = 0; let failed = 0;
    setQueueProgress({ index: 0, total: queue.length, completed, failed });
    for (let i = 0; i < queue.length; i++) {
      if (cancelQueueRef.current) break;
      const item = queue[i];
      setQueueProgress({ index: i, total: queue.length, completed, failed });
      try {
        let runId: string | null = null;
        if (item.kind === 'fixture') {
          const fixture = getFixture(item.size);
          runId = await launchRun({
            title: fixture.title, agenda: fixture.agenda, transcript: fixture.transcript,
            durationMinutes: fixture.durationMinutes, size: item.size, model: item.model, isCustom: false,
            forceSingleShot: item.forceSingleShot === true,
            tier: outputTier,
          });
        } else {
          const words = item.transcript.split(/\s+/).filter(Boolean).length;
          runId = await launchRun({
            title: item.title, agenda: 'Custom transcript', transcript: item.transcript,
            durationMinutes: item.durationMinutes, size: classifySize(words),
            model: item.model, isCustom: true,
            forceSingleShot: item.forceSingleShot === true,
            tier: outputTier,
          });
        }
        if (runId) {
          const finalRun = await waitForRun(runId);
          if (finalRun?.status === 'completed') completed++; else failed++;
        } else { failed++; }
      } catch (err: any) {
        console.error('Queue item failed:', err);
        failed++;
      }
      setQueueProgress({ index: i + 1, total: queue.length, completed, failed });
    }
    setQueueRunning(false);
    toast({
      title: 'Queue complete',
      description: `${completed} completed, ${failed} failed of ${queue.length} runs`,
    });
    setQueue([]);
    setQueueProgress(null);
  }

  // ---------- Custom transcript ----------
  async function handleCustomFileUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum 5MB.', variant: 'destructive' });
      return;
    }
    setCustomExtracting(true);
    try {
      if (file.name.toLowerCase().endsWith('.txt')) {
        const text = await file.text();
        setCustomText(text);
      } else {
        // .docx via extract-document-text
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        const { data, error } = await supabase.functions.invoke('extract-document-text', {
          body: { fileName: file.name, fileBase64: base64, mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        });
        if (error) throw error;
        const extracted = (data as any)?.text ?? (data as any)?.content ?? '';
        if (!extracted) throw new Error('No text extracted from document');
        setCustomText(extracted);
      }
      toast({ title: 'Transcript loaded', description: `${file.name}` });
    } catch (err: any) {
      toast({ title: 'Extraction failed', description: err.message ?? 'Try pasting instead.', variant: 'destructive' });
    } finally {
      setCustomExtracting(false);
    }
  }

  async function launchCustom() {
    const text = customText.trim();
    if (!text) {
      toast({ title: 'No transcript', description: 'Paste or upload a transcript first.', variant: 'destructive' });
      return;
    }
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words < 100) {
      toast({ title: 'Too short', description: 'Transcript needs at least 100 words.', variant: 'destructive' });
      return;
    }
    setCustomLaunching(true);
    try {
      const size = classifySize(words);
      const stamp = new Date().toLocaleString('en-GB');
      const title = customTitle.trim() || `Custom test — ${stamp}`;
      const duration = typeof customDuration === 'number' && customDuration > 0
        ? customDuration
        : Math.max(5, Math.round(words / 150));
      await launchRun({
        title, agenda: 'Custom transcript', transcript: text,
        durationMinutes: duration, size, model: selectedModel, isCustom: true,
        tier: outputTier,
      });
      toast({ title: 'Custom test launched', description: `${words.toLocaleString()} words → ${size} path` });
      setCustomText('');
      setCustomTitle('');
      setCustomDuration('');
    } catch (err: any) {
      toast({ title: 'Custom test failed', description: err.message, variant: 'destructive' });
    } finally {
      setCustomLaunching(false);
    }
  }

  async function downloadDocx(run: TestRun) {
    if (!run.docx_storage_path) return;
    try {
      const { data, error } = await supabase.storage
        .from('pipeline-test-artifacts')
        .download(run.docx_storage_path);
      if (error || !data) throw error ?? new Error('Download failed');
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      const modelLabel = MODELS.find(m => m.value === run.model_override)?.label ?? run.model_override ?? 'unknown';
      const dateStamp = new Date(run.started_at).toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `pipeline_${run.test_size}_${modelLabel.replace(/\s+/g, '_')}_${dateStamp}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: 'Download failed', description: err.message, variant: 'destructive' });
    }
  }


  async function watchPipelineProgress(runId: string, meetingId: string, _email: string) {
    const start = Date.now();
    let lastStatus: string | null = null;

    while (Date.now() - start < STAGE_TIMEOUT_MS) {
      const { data: meeting } = await supabase
        .from('meetings')
        .select(`
          notes_generation_status, notes_model_used, notes_style_3, updated_at,
          notes_input_tokens, notes_output_tokens, notes_cost_usd_est,
          notes_meeting_loaded_at, notes_documents_loaded_at,
          notes_title_generated_at, notes_prompt_assembled_at,
          notes_request_dispatched_at, notes_first_delta_at,
          notes_stream_complete_at, notes_post_processing_complete_at
        `)
        .eq('id', meetingId)
        .maybeSingle();

      if (meeting) {
        const status = meeting.notes_generation_status;
        const updates: Record<string, any> = {};

        if (status === 'generating' && lastStatus !== 'generating') {
          updates.notes_status_generating_at = meeting.updated_at ?? new Date().toISOString();
        }
        const subStageColumns = [
          'notes_meeting_loaded_at', 'notes_documents_loaded_at',
          'notes_title_generated_at', 'notes_prompt_assembled_at',
          'notes_request_dispatched_at', 'notes_first_delta_at',
          'notes_stream_complete_at', 'notes_post_processing_complete_at',
        ] as const;
        for (const col of subStageColumns) {
          const v = (meeting as Record<string, any>)[col];
          if (v) updates[col] = v;
        }
        if (status === 'completed') {
          const notesChars = (meeting.notes_style_3 ?? '').length;
          updates.notes_completed_at = meeting.updated_at ?? new Date().toISOString();
          updates.notes_model_used = meeting.notes_model_used;
          updates.notes_chars = notesChars;
          updates.notes_path = (meeting.notes_model_used ?? '').includes('+chunked-haiku') ? 'chunked' : 'single-shot';
          // Pull token + cost from the meeting row.
          if (meeting.notes_input_tokens != null) updates.input_tokens = meeting.notes_input_tokens;
          if (meeting.notes_output_tokens != null) updates.output_tokens = meeting.notes_output_tokens;
          if (meeting.notes_cost_usd_est != null) updates.cost_usd_est = meeting.notes_cost_usd_est;
        }
        if (status === 'failed') {
          updates.status = 'failed';
          updates.error_message = 'notes_generation_status=failed';
          updates.finished_at = new Date().toISOString();
        }
        if (status === 'insufficient_content') {
          updates.status = 'failed';
          updates.error_message = 'insufficient_content: transcript rejected by pipeline guard (likely <100 words or non-meeting content)';
          updates.finished_at = new Date().toISOString();
        }

        if (Object.keys(updates).length > 0) {
          await supabase.from('pipeline_test_runs').update(updates).eq('id', runId);
        }
        lastStatus = status;

        if (status === 'completed') {
          const { data: summary } = await supabase
            .from('meeting_summaries')
            .select('created_at')
            .eq('meeting_id', meetingId)
            .maybeSingle();
          if (summary) {
            await supabase.from('pipeline_test_runs').update({
              summary_inserted_at: summary.created_at,
              email_triggered_at: summary.created_at,
            }).eq('id', runId);
          }

          // Keep polling for ~15s so late-arriving stamps (post_processing_complete,
          // tokens, cost) — written by the orchestrator AFTER it flips status to
          // 'completed' — get mirrored across to pipeline_test_runs.
          for (let i = 0; i < 8; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const { data: late } = await supabase
              .from('meetings')
              .select('notes_post_processing_complete_at, notes_input_tokens, notes_output_tokens, notes_cost_usd_est')
              .eq('id', meetingId)
              .maybeSingle();
            if (late) {
              const lateUpdates: Record<string, any> = {};
              if (late.notes_post_processing_complete_at) lateUpdates.notes_post_processing_complete_at = late.notes_post_processing_complete_at;
              if (late.notes_input_tokens != null) lateUpdates.input_tokens = late.notes_input_tokens;
              if (late.notes_output_tokens != null) lateUpdates.output_tokens = late.notes_output_tokens;
              if (late.notes_cost_usd_est != null) lateUpdates.cost_usd_est = late.notes_cost_usd_est;
              if (Object.keys(lateUpdates).length > 0) {
                await supabase.from('pipeline_test_runs').update(lateUpdates).eq('id', runId);
              }
              if (late.notes_post_processing_complete_at && late.notes_input_tokens != null) break;
            }
          }

          await new Promise(r => setTimeout(r, 15_000));
          const finishedAt = new Date().toISOString();
          await supabase.from('pipeline_test_runs').update({
            email_sent_at: finishedAt,
            status: 'completed',
            finished_at: finishedAt,
          }).eq('id', runId);
          return;
        }
        if (status === 'failed' || status === 'insufficient_content') return;
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    await supabase.from('pipeline_test_runs').update({
      status: 'timeout',
      error_message: `Watcher timed out after ${STAGE_TIMEOUT_MS / 60_000} minutes`,
      finished_at: new Date().toISOString(),
    }).eq('id', runId);
  }

  const filteredHistory = useMemo(() => {
    return history.filter(r =>
      (sizeFilter === 'all' || r.test_size === sizeFilter) &&
      (modelFilter === 'all' || r.model_override === modelFilter) &&
      (statusFilter === 'all' || r.status === statusFilter)
    );
  }, [history, sizeFilter, modelFilter, statusFilter]);

  async function deleteRun(runId: string) {
    const run = history.find(r => r.id === runId);
    if (!run) return;
    if (!confirm('Delete this test run? This cannot be undone.')) return;
    if (run.docx_storage_path) {
      await supabase.storage.from('pipeline-test-artifacts').remove([run.docx_storage_path]);
    }
    if (run.meeting_id && confirm('Also delete the associated test meeting from Meeting History?')) {
      await supabase.from('meetings').delete().eq('id', run.meeting_id);
    }
    await supabase.from('pipeline_test_runs').delete().eq('id', runId);
    await refreshHistory();
    toast({ title: 'Run deleted' });
  }

  async function deleteFiltered() {
    if (filteredHistory.length === 0) return;
    if (!confirm(`Delete all ${filteredHistory.length} filtered runs? This cannot be undone.`)) return;
    const idsToDelete = filteredHistory.map(r => r.id);
    const meetingIds = filteredHistory
      .map(r => r.meeting_id)
      .filter((id): id is string => id !== null);
    const docxPaths = filteredHistory
      .map(r => r.docx_storage_path)
      .filter((p): p is string => !!p);
    if (docxPaths.length > 0) {
      await supabase.storage.from('pipeline-test-artifacts').remove(docxPaths);
    }
    if (meetingIds.length > 0 && confirm(`Also delete ${meetingIds.length} associated test meetings from Meeting History?`)) {
      await supabase.from('meetings').delete().in('id', meetingIds);
    }
    await supabase.from('pipeline_test_runs').delete().in('id', idsToDelete);
    await refreshHistory();
    toast({ title: `${idsToDelete.length} runs deleted` });
  }

  const isAnyRunning = (activeRun?.status === 'running') || queueRunning;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Pipeline Test</h1>
        <p className="text-muted-foreground text-sm mt-1">
          End-to-end test of the recording → transcript → notes → email pipeline using synthetic meetings of varying sizes.
          Test emails will be sent to <strong>{userEmail || '(your account email)'}</strong>.
        </p>
      </div>

      {/* Launch buttons */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Run a test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Model selector */}
          <div className="flex flex-col gap-2 max-w-md">
            <label className="text-xs font-medium text-muted-foreground">Model</label>
            <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isAnyRunning}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map(m => (
                  <SelectItem key={m.value} value={m.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{m.label}</span>
                      <span className="text-xs text-muted-foreground">{m.provider} · {m.note}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Output tier selector — picks the NHS PCN minute prompt template. */}
          <div className="flex flex-col gap-2 max-w-md">
            <label className="text-xs font-medium text-muted-foreground">Output tier</label>
            <RadioGroup
              value={outputTier}
              onValueChange={(v) => setOutputTier(v as any)}
              className="grid grid-cols-1 gap-1.5"
            >
              {[
                { v: 'executive', label: 'Executive', hint: '~700 words — circulation copy' },
                { v: 'full',      label: 'Full',      hint: '~1,800 words — governance record' },
                { v: 'verbatim',  label: 'Verbatim',  hint: '~3,000+ words — defensible record (SEAs / complaints / Programme Board)' },
              ].map(opt => (
                <label key={opt.v} className="flex items-start gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value={opt.v} disabled={isAnyRunning} className="mt-0.5" />
                  <span>
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-xs text-muted-foreground"> — {opt.hint}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Force single-shot toggle — bypasses chunked path even on long fixtures.
              Mirrors the production "Regenerate with Sonnet" refine flow. */}
          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer max-w-2xl">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={forceSingleShot}
              onChange={e => setForceSingleShot(e.target.checked)}
              disabled={isAnyRunning}
            />
            <span>
              <span className="font-medium text-foreground">Force single-shot</span> — skip the chunked map-reduce path on long Claude runs and send the full transcript in one prompt. Slower and pricier, but preserves all topics. Equivalent to the production "Regenerate with Sonnet" button.
            </span>
          </label>

          {/* Size buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['short', 'medium', 'long'] as TestSize[]).map(size => {
              const f = TEST_FIXTURES[size];
              const isLaunching = launching === size;
              return (
                <div key={size} className="border rounded-md p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize text-sm">{size}</span>
                    <Button
                      variant="ghost" size="sm" className="h-7 px-2 text-xs"
                      disabled={isAnyRunning}
                      onClick={() => addToQueue({ kind: 'fixture', size, model: selectedModel, forceSingleShot })}
                      title="Add to queue"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Queue
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <div>{f.transcript.length.toLocaleString()} chars · ~{f.durationMinutes}min meeting</div>
                    <div className="mt-1">
                      Expected: {size === 'short' ? '<30s' : size === 'medium' ? '<60s' : '<90s'} ·{' '}
                      {f.transcript.length > 15000 ? 'chunked path' : 'single-shot'}
                    </div>
                  </div>
                  <Button
                    variant="outline" size="sm"
                    disabled={isLaunching || isAnyRunning}
                    onClick={() => launchTest(size)}
                  >
                    {isLaunching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                    Run now
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Queue panel */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Queue ({queue.length})</span>
            {queueProgress && (
              <span className="text-xs font-normal text-muted-foreground">
                Running {queueProgress.index + (queueRunning ? 1 : 0)} of {queueProgress.total} · ✓ {queueProgress.completed} · ✗ {queueProgress.failed}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {queue.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Queue is empty. Click <strong>Queue</strong> on a size above (or in the Custom panel below) to stage runs. They run sequentially.
            </p>
          ) : (
            <div className="space-y-1">
              {queue.map((item, i) => {
                const modelLabel = MODELS.find(m => m.value === item.model)?.label ?? item.model;
                const sizeLabel = item.kind === 'fixture' ? item.size : 'custom';
                const label = item.kind === 'custom' ? `“${item.title}”` : '';
                return (
                  <div key={item.id} className="flex items-center justify-between text-sm border rounded px-3 py-1.5">
                    <span>
                      <span className="text-muted-foreground mr-2">{i + 1}.</span>
                      <span className="capitalize">{sizeLabel}</span>
                      <span className="mx-2 text-muted-foreground">·</span>
                      <span>{modelLabel}</span>
                      {item.forceSingleShot && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">single-shot</span>
                      )}
                      {label && <span className="ml-2 text-xs text-muted-foreground truncate max-w-xs inline-block align-bottom">{label}</span>}
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                      disabled={queueRunning}
                      onClick={() => removeFromQueue(item.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          {queue.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {queue.length} runs queued · estimated cost ~${queueTotals.cost.toFixed(3)} · estimated time ~{Math.ceil(queueTotals.secs / 60)}m
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={runQueue} disabled={queue.length === 0 || isAnyRunning}>
              {queueRunning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              Run queue
            </Button>
            <Button variant="outline" onClick={clearQueue} disabled={queue.length === 0 || queueRunning}>
              Clear queue
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Custom transcript */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Custom transcript test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs value={customTab} onValueChange={(v) => setCustomTab(v as 'paste' | 'upload')}>
            <TabsList>
              <TabsTrigger value="paste">Paste text</TabsTrigger>
              <TabsTrigger value="upload">Upload .docx / .txt</TabsTrigger>
            </TabsList>
            <TabsContent value="paste" className="space-y-2">
              <Textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Paste a meeting transcript here…"
                className="min-h-[200px] font-mono text-xs"
                disabled={isAnyRunning || customLaunching}
              />
            </TabsContent>
            <TabsContent value="upload" className="space-y-2">
              <Input
                type="file"
                accept=".docx,.txt"
                disabled={customExtracting || isAnyRunning || customLaunching}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCustomFileUpload(f);
                  e.currentTarget.value = '';
                }}
              />
              {customExtracting && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Extracting…
                </div>
              )}
              {customText && (
                <div className="text-xs text-muted-foreground">Loaded {customText.length.toLocaleString()} chars. Switch to Paste tab to edit.</div>
              )}
            </TabsContent>
          </Tabs>

          {(() => {
            const words = customText.trim() ? customText.trim().split(/\s+/).filter(Boolean).length : 0;
            const chars = customText.length;
            const size = classifySize(words);
            return (
              <div className="text-xs text-muted-foreground">
                {chars.toLocaleString()} chars · {words.toLocaleString()} words ·{' '}
                {words < 100 ? <span className="text-destructive">below 100-word minimum</span> : <span>auto-classify: <strong>{size}</strong> ({chars > 15000 ? 'chunked' : 'single-shot'} path)</span>}
              </div>
            );
          })()}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={`Custom test — ${new Date().toLocaleString('en-GB')}`}
                disabled={isAnyRunning || customLaunching}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Duration (minutes)</label>
              <Input
                type="number"
                value={customDuration}
                onChange={(e) => setCustomDuration(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="auto from word count"
                disabled={isAnyRunning || customLaunching}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={launchCustom} disabled={isAnyRunning || customLaunching || !customText.trim()}>
              {customLaunching ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              Run with custom transcript
            </Button>
            <Button
              variant="outline"
              disabled={isAnyRunning || !customText.trim()}
              onClick={() => {
                const text = customText.trim();
                if (!text) return;
                const words = text.split(/\s+/).filter(Boolean).length;
                if (words < 100) {
                  toast({ title: 'Too short', description: 'Need at least 100 words.', variant: 'destructive' });
                  return;
                }
                const stamp = new Date().toLocaleString('en-GB');
                const title = customTitle.trim() || `Custom test — ${stamp}`;
                const duration = typeof customDuration === 'number' && customDuration > 0
                  ? customDuration : Math.max(5, Math.round(words / 150));
                addToQueue({ kind: 'custom', model: selectedModel, transcript: text, title, durationMinutes: duration, forceSingleShot });
                toast({ title: 'Added to queue' });
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Add to queue
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active run progress */}
      {activeRun && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Loader2 className={`h-4 w-4 ${activeRun.status === 'running' ? 'animate-spin' : ''}`} />
              {activeRun.status === 'running' ? 'Running' : activeRun.status === 'completed' ? 'Completed' : 'Stopped'} —{' '}
              {activeRun.test_size} test
              {activeRun.model_override && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {MODELS.find(m => m.value === activeRun.model_override)?.label ?? activeRun.model_override}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StageProgressList run={activeRun} />
            {activeRun.status === 'completed' && <SummaryStats run={activeRun} />}
            {activeRun.error_message && (
              <div className="mt-3 text-sm text-destructive">{activeRun.error_message}</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Recent runs ({filteredHistory.length})</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={sizeFilter} onValueChange={setSizeFilter}>
                <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="Size" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sizes</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                </SelectContent>
              </Select>
              <Select value={modelFilter} onValueChange={setModelFilter}>
                <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Model" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All models</SelectItem>
                  {MODELS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="timeout">Timeout</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={deleteFiltered}
                disabled={filteredHistory.length === 0}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete filtered
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No test runs match the current filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Started</th>
                    <th className="py-2 pr-4">Size</th>
                    <th className="py-2 pr-4">Model</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Path</th>
                    <th className="py-2 pr-4">Total time</th>
                    <th className="py-2 pr-4">Notes gen</th>
                    <th className="py-2 pr-4">Tokens (in/out)</th>
                    <th className="py-2 pr-4">Cost (USD)</th>
                    <th className="py-2 pr-4 w-10">Doc</th>
                    <th className="py-2 pr-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(r => {
                    const total = r.finished_at ? new Date(r.finished_at).getTime() - new Date(r.started_at).getTime() : null;
                    const notesGen = r.notes_completed_at && r.notes_invoked_at
                      ? new Date(r.notes_completed_at).getTime() - new Date(r.notes_invoked_at).getTime()
                      : null;
                    const modelLabel = MODELS.find(m => m.value === r.model_override)?.label
                      ?? r.model_override
                      ?? '—';
                    return (
                      <tr key={r.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 whitespace-nowrap">{new Date(r.started_at).toLocaleString()}</td>
                        <td className="py-2 pr-4 capitalize">{r.test_size}</td>
                        <td className="py-2 pr-4 text-xs">{modelLabel}</td>
                        <td className="py-2 pr-4">
                          <Badge
                            variant={
                              r.status === 'completed' ? 'default' :
                              r.status === 'failed' || r.status === 'timeout' ? 'destructive' : 'secondary'
                            }
                          >
                            {r.status}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4">{r.notes_path ?? '—'}</td>
                        <td className="py-2 pr-4 font-mono">{formatMs(total)}</td>
                        <td className="py-2 pr-4 font-mono">{formatMs(notesGen)}</td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {r.input_tokens != null && r.output_tokens != null
                            ? `${r.input_tokens.toLocaleString()} / ${r.output_tokens.toLocaleString()}`
                            : '—'}
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">
                          {r.cost_usd_est != null ? `$${Number(r.cost_usd_est).toFixed(4)}` : '—'}
                        </td>
                        <td className="py-2 pr-4">
                          {r.docx_storage_path ? (
                            <Button variant="ghost" size="sm" onClick={() => downloadDocx(r)}
                              className="h-7 w-7 p-0" title="Download Word doc">
                              <Download className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteRun(r.id)}
                            className="h-7 w-7 p-0"
                            title="Delete this run"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StageProgressList({ run }: { run: TestRun }) {
  const stagesWithDeltas = useMemo(() => {
    let prevReachedTs: string | null = run.started_at;
    return STAGES.map(stage => {
      const ts = run[stage.key as keyof TestRun] as string | null;
      let delta: number | null = null;
      if (typeof ts === 'string') {
        if (stage.indent === 1 && prevReachedTs) {
          delta = new Date(ts).getTime() - new Date(prevReachedTs).getTime();
        } else {
          delta = new Date(ts).getTime() - new Date(run.started_at).getTime();
        }
        prevReachedTs = ts;
      }
      return { ...stage, delta, reached: typeof ts === 'string' };
    });
  }, [run]);

  return (
    <div className="space-y-2">
      {stagesWithDeltas.map((stage, idx) => {
        const reached = stage.reached;
        const isCurrent = !reached && stagesWithDeltas.findIndex(s => !s.reached) === idx;
        return (
          <div
            key={stage.key}
            className={`flex items-center justify-between p-2 rounded ${
              stage.indent === 1 ? 'ml-8 text-xs' : ''
            } ${
              reached ? 'bg-muted/40' : isCurrent ? 'bg-primary/5' : 'opacity-50'
            }`}
          >
            <div className="flex items-center gap-3">
              {reached ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : isCurrent ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={stage.indent === 1 ? 'text-xs' : 'text-sm'}>{stage.label}</span>
            </div>
            <span className="text-sm font-mono text-muted-foreground">
              {stage.indent === 1 && stage.delta !== null ? '+' : ''}{formatMs(stage.delta)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SummaryStats({ run }: { run: TestRun }) {
  const total = run.finished_at ? new Date(run.finished_at).getTime() - new Date(run.started_at).getTime() : null;
  const notesGen = run.notes_completed_at && run.notes_invoked_at
    ? new Date(run.notes_completed_at).getTime() - new Date(run.notes_invoked_at).getTime()
    : null;
  const firstDelta = run.notes_first_delta_at && run.notes_invoked_at
    ? new Date(run.notes_first_delta_at).getTime() - new Date(run.notes_invoked_at).getTime()
    : null;

  return (
    <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
      <div>
        <div className="text-muted-foreground text-xs">Total wall clock</div>
        <div className="font-mono">{formatMs(total)}</div>
      </div>
      <div>
        <div className="text-muted-foreground text-xs">Notes generation</div>
        <div className="font-mono">{formatMs(notesGen)}</div>
      </div>
      <div>
        <div className="text-muted-foreground text-xs">Time to first token</div>
        <div className="font-mono">{formatMs(firstDelta)}</div>
      </div>
      <div>
        <div className="text-muted-foreground text-xs">Notes output</div>
        <div className="font-mono">{run.notes_chars?.toLocaleString() ?? '—'} chars</div>
      </div>
      <div>
        <div className="text-muted-foreground text-xs">Tokens (in / out)</div>
        <div className="font-mono">
          {run.input_tokens != null && run.output_tokens != null
            ? `${run.input_tokens.toLocaleString()} / ${run.output_tokens.toLocaleString()}`
            : '—'}
        </div>
      </div>
      <div>
        <div className="text-muted-foreground text-xs">Estimated cost</div>
        <div className="font-mono">
          {run.cost_usd_est != null ? `$${Number(run.cost_usd_est).toFixed(4)}` : '—'}
        </div>
      </div>
    </div>
  );
}
