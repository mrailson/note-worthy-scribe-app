import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { TEST_FIXTURES, type TestSize, getFixture } from '@/lib/pipelineTestFixtures';

const MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-7',
  'gpt-5.2',
  'gpt-4o',
  'gemini-2.5-pro',
] as const;

const FIXTURES: { value: TestSize; label: string }[] = [
  { value: 'short',  label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long',   label: 'Long' },
];

interface HistoryRow {
  id: string;
  title: string | null;
  created_at: string;
  notes_model_used: string | null;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function PipelineTestRunner() {
  const { user, isSystemAdmin, loading } = useAuth();
  const navigate = useNavigate();

  const [fixture, setFixture] = useState<TestSize>('short');
  const [model, setModel] = useState<string>('claude-sonnet-4-6');
  const [mode, setMode] = useState<'single' | 'chunked'>('single');
  const [skipQc, setSkipQc] = useState(false);
  const [recipient, setRecipient] = useState('malcolm.railson@nhs.net');
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  // Admin guard
  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/auth', { replace: true }); return; }
    if (!isSystemAdmin) {
      toast.error('Admin only');
      navigate('/', { replace: true });
    }
  }, [loading, user, isSystemAdmin, navigate]);

  const refreshHistory = async () => {
    const { data } = await supabase
      .from('meetings')
      .select('id,title,created_at,notes_model_used')
      .ilike('title', 'Pipeline Test%')
      .order('created_at', { ascending: false })
      .limit(20);
    setHistory((data ?? []) as HistoryRow[]);
  };

  useEffect(() => { if (isSystemAdmin) refreshHistory(); }, [isSystemAdmin]);

  const runTest = async () => {
    if (!user) return;
    setRunning(true);
    try {
      const fx = getFixture(fixture);
      const forceSingleShot = mode === 'single';
      const qcLabel = skipQc ? 'no-qc' : 'qc';
      const title = `Pipeline Test [${fixture}] [${model}] [${mode}] [${qcLabel}] — ${new Date().toISOString()}`;

      const { data: meeting, error: meetingErr } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          title,
          description: `[Pipeline Test Runner — ${fixture}] ${fx.agenda}`,
          meeting_type: 'general',
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString(),
          duration_minutes: fx.durationMinutes,
          status: 'completed',
          import_source: 'pipeline_test_runner',
          meeting_format: 'face-to-face',
          notes_generation_status: 'queued',
        })
        .select()
        .single();
      if (meetingErr || !meeting) throw new Error(meetingErr?.message ?? 'meeting insert failed');

      const { error: tErr } = await supabase.from('meeting_transcripts').insert({
        meeting_id: meeting.id,
        content: fx.transcript,
        speaker_name: 'Test',
        timestamp_seconds: 0,
      });
      if (tErr) throw new Error(`transcript insert failed: ${tErr.message}`);

      // Override the meeting's recipient via user email field if needed.
      // Email dispatch is handled server-side by auto-generate-meeting-notes
      // chaining into deliver-mobile-meeting-email — no extra call needed.

      // Fire-and-forget invoke with 10s client timeout.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      supabase.functions
        .invoke('auto-generate-meeting-notes', {
          body: {
            meetingId: meeting.id,
            forceRegenerate: false,
            modelOverride: model,
            forceSingleShot,
            skipQc,
            emailRecipient: recipient,
          },
        })
        .catch((e) => {
          // 504 / timeout / abort all expected for long fixtures.
          console.warn('[pipeline-tests] invoke detached:', e?.message);
        })
        .finally(() => clearTimeout(timer));

      toast.success('Generation continuing server-side — check email in 2–4 minutes.');
      await refreshHistory();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to start test');
    } finally {
      setRunning(false);
    }
  };

  if (loading || !isSystemAdmin) {
    return <div className="p-6 text-sm text-muted-foreground">Checking access…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-4 space-y-4">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">Pipeline Test Runner</h1>
      </div>

      <Card>
        <CardContent className="p-4 space-y-5">
          <div className="space-y-2">
            <Label>Fixture</Label>
            <RadioGroup value={fixture} onValueChange={(v) => setFixture(v as TestSize)} className="flex gap-3">
              {FIXTURES.map(f => (
                <label key={f.value} className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value={f.value} /> {f.label}
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODELS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Mode</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="flex gap-3">
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="single" /> Single-shot
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="chunked" /> Chunked
              </label>
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="skipqc" className="cursor-pointer">Skip QC</Label>
            <Switch id="skipqc" checked={skipQc} onCheckedChange={setSkipQc} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient">Email recipient</Label>
            <Input
              id="recipient"
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              inputMode="email"
            />
          </div>

          <Button onClick={runTest} disabled={running || !recipient} className="w-full">
            {running
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Launching…</>
              : <><Play className="mr-2 h-4 w-4" /> Run Test</>}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Recent runs</CardTitle></CardHeader>
        <CardContent className="p-2">
          {history.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">No runs yet.</div>
          )}
          <ul className="divide-y">
            {history.map(h => {
              // Title format: Pipeline Test [fixture] [model] [mode] [qc] — iso
              const m = h.title?.match(/\[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\]/);
              const fx = m?.[1] ?? '?';
              const mdl = m?.[2] ?? '?';
              const md = m?.[3] ?? '?';
              const qc = m?.[4] ?? '?';
              return (
                <li key={h.id}>
                  <Link
                    to={`/meeting-history?meetingId=${h.id}`}
                    className="flex flex-col gap-1 px-2 py-2 active:bg-muted rounded"
                  >
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-[10px]">{fx}</Badge>
                      <Badge variant="outline" className="text-[10px]">{mdl}</Badge>
                      <Badge variant="outline" className="text-[10px]">{md}</Badge>
                      <Badge variant="outline" className="text-[10px]">{qc}</Badge>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>{relativeTime(h.created_at)}</span>
                      {h.notes_model_used && <span>used: {h.notes_model_used}</span>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
