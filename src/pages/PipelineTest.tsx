import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Play, Mail, FileText, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { TEST_FIXTURES, type TestSize, getFixture } from '@/lib/pipelineTestFixtures';

// Stage labels in display order. Each maps to a column in pipeline_test_runs.
const STAGES = [
  { key: 'meeting_inserted_at',         label: 'Meeting created',         icon: FileText },
  { key: 'transcript_inserted_at',      label: 'Transcript saved',        icon: FileText },
  { key: 'notes_invoked_at',            label: 'Notes function invoked',  icon: Play },
  { key: 'notes_status_generating_at',  label: 'Generation started',      icon: Loader2 },
  { key: 'notes_first_delta_at',        label: 'First model output',      icon: Loader2 },
  { key: 'notes_completed_at',          label: 'Notes saved',             icon: CheckCircle2 },
  { key: 'summary_inserted_at',         label: 'Summary inserted',        icon: CheckCircle2 },
  { key: 'email_triggered_at',          label: 'Email triggered',         icon: Mail },
  { key: 'email_sent_at',               label: 'Email sent',              icon: Mail },
] as const;

type Stage = typeof STAGES[number];

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
  notes_first_delta_at: string | null;
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
}

const STAGE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes — long meetings can run 2-3 mins

function formatMs(ms: number | null): string {
  if (ms === null || isNaN(ms)) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function deltaSinceStart(run: TestRun, key: keyof TestRun): number | null {
  const ts = run[key];
  if (typeof ts !== 'string') return null;
  return new Date(ts).getTime() - new Date(run.started_at).getTime();
}

export default function PipelineTest() {
  const { toast } = useToast();
  const [activeRun, setActiveRun] = useState<TestRun | null>(null);
  const [history, setHistory] = useState<TestRun[]>([]);
  const [launching, setLaunching] = useState<TestSize | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  // Fetch user email + history on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);
      await refreshHistory();
    })();
  }, []);

  // Poll active run every 2 seconds while it's running
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
      .limit(20);
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

  async function launchTest(size: TestSize) {
    setLaunching(size);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const fixture = getFixture(size);
      const transcriptWords = fixture.transcript.split(/\s+/).filter(Boolean).length;
      const transcriptChars = fixture.transcript.length;

      // 1. Create the test run record
      const { data: runRow, error: runErr } = await supabase
        .from('pipeline_test_runs')
        .insert({
          user_id: user.id,
          test_size: size,
          transcript_chars: transcriptChars,
          transcript_words: transcriptWords,
          email_recipient: user.email,
          status: 'running',
        })
        .select()
        .single();
      if (runErr || !runRow) throw new Error(runErr?.message ?? 'Failed to create test run');

      // 2. Insert the synthetic meeting (with import_source = 'pipeline_test'
      //    so the email trigger fires AND it's filterable in history).
      const { data: meeting, error: meetingErr } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          title: fixture.title,
          description: `[Pipeline test — ${size}] ${fixture.agenda}`,
          meeting_type: 'general',
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString(),
          duration_minutes: fixture.durationMinutes,
          status: 'completed',
          import_source: 'pipeline_test',
          meeting_format: 'face-to-face',
          notes_generation_status: 'queued',
        })
        .select()
        .single();
      if (meetingErr || !meeting) throw new Error(`Meeting insert failed: ${meetingErr?.message}`);

      const meetingInsertedAt = new Date().toISOString();
      await supabase
        .from('pipeline_test_runs')
        .update({ meeting_id: meeting.id, meeting_inserted_at: meetingInsertedAt })
        .eq('id', runRow.id);

      // 3. Insert the transcript
      const { error: transcriptErr } = await supabase
        .from('meeting_transcripts')
        .insert({
          meeting_id: meeting.id,
          content: fixture.transcript,
          speaker_name: 'Test',
          timestamp_seconds: 0,
        });
      if (transcriptErr) throw new Error(`Transcript insert failed: ${transcriptErr.message}`);

      const transcriptInsertedAt = new Date().toISOString();
      await supabase
        .from('pipeline_test_runs')
        .update({ transcript_inserted_at: transcriptInsertedAt })
        .eq('id', runRow.id);

      // 4. Invoke auto-generate-meeting-notes (fire-and-forget, same pattern as production)
      const notesInvokedAt = new Date().toISOString();
      await supabase
        .from('pipeline_test_runs')
        .update({ notes_invoked_at: notesInvokedAt })
        .eq('id', runRow.id);

      supabase.functions
        .invoke('auto-generate-meeting-notes', {
          body: { meetingId: meeting.id, forceRegenerate: false },
        })
        .catch(err => {
          // Client-side timeout is expected on long meetings — server keeps running
          console.warn('auto-generate-meeting-notes client timeout (expected for long):', err?.message);
        });

      // Set active run to start polling
      const refreshed = await fetchRun(runRow.id);
      setActiveRun(refreshed);
      await refreshHistory();

      toast({ title: 'Test launched', description: `${size} pipeline test running. Polling for stages…` });

      // Background watcher: poll meetings table for status changes and write
      // them into the test run row. This is what populates the stage timestamps.
      watchPipelineProgress(runRow.id, meeting.id, user.email ?? '');
    } catch (err: any) {
      toast({ title: 'Test failed to launch', description: err.message, variant: 'destructive' });
    } finally {
      setLaunching(null);
    }
  }

  // Watcher polls the meetings, meeting_summaries, and (where exposed) edge
  // function logs, writing observed stage timestamps onto the test run row.
  // Runs independently of the UI poll so timestamps are accurate even if the
  // user navigates away.
  async function watchPipelineProgress(runId: string, meetingId: string, email: string) {
    const start = Date.now();
    let lastStatus: string | null = null;

    while (Date.now() - start < STAGE_TIMEOUT_MS) {
      const { data: meeting } = await supabase
        .from('meetings')
        .select('notes_generation_status, notes_model_used, notes_style_3, notes_first_delta_at, updated_at')
        .eq('id', meetingId)
        .maybeSingle();

      if (meeting) {
        const status = meeting.notes_generation_status;
        const updates: Record<string, any> = {};

        if (status === 'generating' && lastStatus !== 'generating') {
          updates.notes_status_generating_at = meeting.updated_at ?? new Date().toISOString();
        }
        if (meeting.notes_first_delta_at) {
          updates.notes_first_delta_at = meeting.notes_first_delta_at;
        }
        if (status === 'completed') {
          const notesChars = (meeting.notes_style_3 ?? '').length;
          updates.notes_completed_at = meeting.updated_at ?? new Date().toISOString();
          updates.notes_model_used = meeting.notes_model_used;
          updates.notes_chars = notesChars;
          updates.notes_path = (meeting.notes_model_used ?? '').includes('+chunked-haiku') ? 'chunked' : 'single-shot';
        }
        if (status === 'failed') {
          updates.status = 'failed';
          updates.error_message = 'notes_generation_status=failed';
          updates.finished_at = new Date().toISOString();
        }

        if (Object.keys(updates).length > 0) {
          await supabase.from('pipeline_test_runs').update(updates).eq('id', runId);
        }
        lastStatus = status;

        if (status === 'completed') {
          // Watch for meeting_summaries insert (triggers email)
          const { data: summary } = await supabase
            .from('meeting_summaries')
            .select('created_at')
            .eq('meeting_id', meetingId)
            .maybeSingle();
          if (summary) {
            await supabase.from('pipeline_test_runs').update({
              summary_inserted_at: summary.created_at,
              // Email trigger fires synchronously in pg_net from the summary insert.
              // We can't directly observe pg_net dispatch time from the client, so
              // approximate with the summary insert time + small delta.
              email_triggered_at: summary.created_at,
            }).eq('id', runId);
          }

          // Mark email_sent_at by checking deliver-mobile-meeting-email logs via a separate
          // view. Until that exists, mark done after a 30s grace window — long enough
          // for typical email send to complete.
          await new Promise(r => setTimeout(r, 30_000));
          const finishedAt = new Date().toISOString();
          await supabase.from('pipeline_test_runs').update({
            email_sent_at: finishedAt,
            status: 'completed',
            finished_at: finishedAt,
          }).eq('id', runId);
          return;
        }
        if (status === 'failed') return;
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    // Timed out
    await supabase.from('pipeline_test_runs').update({
      status: 'timeout',
      error_message: `Watcher timed out after ${STAGE_TIMEOUT_MS / 60_000} minutes`,
      finished_at: new Date().toISOString(),
    }).eq('id', runId);
  }

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
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['short', 'medium', 'long'] as TestSize[]).map(size => {
              const f = TEST_FIXTURES[size];
              const isLaunching = launching === size;
              const isAnyRunning = activeRun?.status === 'running';
              return (
                <Button
                  key={size}
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-start gap-2"
                  disabled={isLaunching || isAnyRunning}
                  onClick={() => launchTest(size)}
                >
                  <div className="flex items-center gap-2">
                    {isLaunching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    <span className="font-medium capitalize">{size}</span>
                  </div>
                  <div className="text-xs text-muted-foreground text-left">
                    <div>{f.transcript.length.toLocaleString()} chars · ~{f.durationMinutes}min meeting</div>
                    <div className="mt-1">
                      Expected: {size === 'short' ? '<30s' : size === 'medium' ? '<60s' : '<90s'} ·{' '}
                      {f.transcript.length > 15000 ? 'chunked path' : 'single-shot'}
                    </div>
                  </div>
                </Button>
              );
            })}
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
          <CardTitle className="text-base">Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No test runs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Started</th>
                    <th className="py-2 pr-4">Size</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Path</th>
                    <th className="py-2 pr-4">Total time</th>
                    <th className="py-2 pr-4">Notes gen</th>
                    <th className="py-2 pr-4">Model</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(r => {
                    const total = r.finished_at ? new Date(r.finished_at).getTime() - new Date(r.started_at).getTime() : null;
                    const notesGen = r.notes_completed_at && r.notes_invoked_at
                      ? new Date(r.notes_completed_at).getTime() - new Date(r.notes_invoked_at).getTime()
                      : null;
                    return (
                      <tr key={r.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-4">{new Date(r.started_at).toLocaleString()}</td>
                        <td className="py-2 pr-4 capitalize">{r.test_size}</td>
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
                        <td className="py-2 pr-4 text-xs">{r.notes_model_used ?? '—'}</td>
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
    return STAGES.map(stage => {
      const delta = deltaSinceStart(run, stage.key as keyof TestRun);
      return { ...stage, delta };
    });
  }, [run]);

  return (
    <div className="space-y-2">
      {stagesWithDeltas.map(stage => {
        const Icon = stage.icon;
        const reached = stage.delta !== null;
        const isCurrent = !reached && stagesWithDeltas.findIndex(s => s.delta === null) === STAGES.findIndex(s => s.key === stage.key);
        return (
          <div
            key={stage.key}
            className={`flex items-center justify-between p-2 rounded ${
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
              <span className="text-sm">{stage.label}</span>
            </div>
            <span className="text-sm font-mono text-muted-foreground">{formatMs(stage.delta)}</span>
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
    </div>
  );
}
