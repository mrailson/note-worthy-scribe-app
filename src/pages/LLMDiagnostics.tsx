import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Loader2, Activity, AlertTriangle, Settings as SettingsIcon, Save } from 'lucide-react';
import { toast } from 'sonner';

type ReasoningMode = 'default' | 'excluded' | 'low' | 'minimal';

type PingResult = {
  status_code: number;
  elapsed_ms: number;
  body_preview: string;
  error_message: string | null;
  model_tested?: string;
  gateway_model?: string;
  max_tokens?: number;
  reasoning_mode?: ReasoningMode;
  finish_reason?: string | null;
  native_finish_reason?: string | null;
  total_tokens?: number | null;
};

type PingVariant = {
  key: string;
  label: string;
  model: 'gemini-3.1-pro' | 'gemini-3-flash';
  max_tokens: number;
  reasoning_mode: ReasoningMode;
  buttonVariant?: 'default' | 'secondary' | 'outline';
};

const VARIANTS: PingVariant[] = [
  { key: 'flash', label: 'Flash', model: 'gemini-3-flash', max_tokens: 1024, reasoning_mode: 'default', buttonVariant: 'secondary' },
  { key: 'pro-current', label: 'Pro (current)', model: 'gemini-3.1-pro', max_tokens: 1024, reasoning_mode: 'default' },
  { key: 'pro-16k', label: 'Pro (max 16k)', model: 'gemini-3.1-pro', max_tokens: 16000, reasoning_mode: 'default' },
  { key: 'pro-no-reasoning', label: 'Pro (reasoning off, max 16k)', model: 'gemini-3.1-pro', max_tokens: 16000, reasoning_mode: 'excluded' },
  { key: 'pro-low', label: 'Pro (reasoning low, max 16k)', model: 'gemini-3.1-pro', max_tokens: 16000, reasoning_mode: 'low' },
];

type PingRun = {
  id: string;
  variant: PingVariant;
  busy: boolean;
  result: PingResult | null;
};

type FallbackRow = {
  created_at: string;
  meeting_id: string;
  pro_status_code: number | null;
  pro_elapsed_ms: number | null;
  pro_error_message: string | null;
  fallback_reason: string | null;
  meeting_duration_seconds: number | null;
};

type Bucket = { label: string; min: number; max: number };
const BUCKETS: Bucket[] = [
  { label: '<10 min', min: 0, max: 600 },
  { label: '10–30 min', min: 600, max: 1800 },
  { label: '30–60 min', min: 1800, max: 3600 },
  { label: '60+ min', min: 3600, max: Number.POSITIVE_INFINITY },
];

const truncate = (s: string | null, n: number) => {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const LLMDiagnostics = () => {
  const { user, isSystemAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [pingRuns, setPingRuns] = useState<PingRun[]>([]);
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());

  const [fallbackRows, setFallbackRows] = useState<FallbackRow[]>([]);
  const [bucketStats, setBucketStats] = useState<Array<{ label: string; total: number; fallbacks: number; pct: number }>>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Current configuration panel
  const PER_ATTEMPT_TIMEOUT_S = 30;
  const [activeModel, setActiveModel] = useState<string>('gemini-3-flash');
  const [pendingModel, setPendingModel] = useState<string>('gemini-3-flash');
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [stats24h, setStats24h] = useState<{ total: number; firstAttemptOk: number; fallbacks: number } | null>(null);

  // Auth gate
  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/auth', { replace: true }); return; }
    if (!isSystemAdmin) {
      toast.error('System admin access required.');
      navigate('/', { replace: true });
    }
  }, [authLoading, user, isSystemAdmin, navigate]);

  const runPing = useCallback(async (variant: PingVariant) => {
    const id = `${variant.key}-${Date.now()}`;
    setBusyKeys(prev => { const n = new Set(prev); n.add(variant.key); return n; });
    setPingRuns(prev => [{ id, variant, busy: true, result: null }, ...prev]);
    try {
      const { data, error } = await supabase.functions.invoke('gemini-ping', {
        body: {
          model: variant.model,
          max_tokens: variant.max_tokens,
          reasoning_mode: variant.reasoning_mode,
        },
      });
      if (error) throw error;
      setPingRuns(prev => prev.map(r => r.id === id ? { ...r, busy: false, result: data as PingResult } : r));
    } catch (err: any) {
      setPingRuns(prev => prev.map(r => r.id === id ? {
        ...r,
        busy: false,
        result: {
          status_code: 0,
          elapsed_ms: 0,
          body_preview: '',
          error_message: err?.message || String(err),
        },
      } : r));
    } finally {
      setBusyKeys(prev => { const n = new Set(prev); n.delete(variant.key); return n; });
    }
  }, []);

  const clearPingRuns = useCallback(() => setPingRuns([]), []);

  const loadData = useCallback(async () => {
    if (!isSystemAdmin) return;
    setLoadingData(true);
    try {
      // Section 2: last 10 fallback events (Pro → Flash)
      const { data: rows, error: rowsErr } = await supabase
        .from('meeting_generation_log')
        .select('created_at, meeting_id, pro_status_code, pro_elapsed_ms, pro_error_message, fallback_reason')
        .eq('primary_model', 'gemini-3.1-pro')
        .eq('actual_model_used', 'gemini-3-flash')
        .order('created_at', { ascending: false })
        .limit(10);
      if (rowsErr) throw rowsErr;

      const meetingIds = (rows || []).map((r: any) => r.meeting_id).filter(Boolean);
      let durationMap = new Map<string, number>();
      if (meetingIds.length > 0) {
        const { data: meetings } = await supabase
          .from('meetings')
          .select('id, duration_minutes')
          .in('id', meetingIds);
        (meetings || []).forEach((m: any) => {
          if (m.duration_minutes != null) durationMap.set(m.id, Number(m.duration_minutes) * 60);
        });
      }
      const enriched: FallbackRow[] = (rows || []).map((r: any) => ({
        ...r,
        meeting_duration_seconds: durationMap.get(r.meeting_id) ?? null,
      }));
      setFallbackRows(enriched);

      // Section 3: fallback rate by duration bucket, last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: weekLogs, error: weekErr } = await supabase
        .from('meeting_generation_log')
        .select('meeting_id, primary_model, actual_model_used')
        .gte('created_at', sevenDaysAgo)
        .eq('primary_model', 'gemini-3.1-pro')
        .limit(2000);
      if (weekErr) throw weekErr;

      const weekMeetingIds = Array.from(new Set((weekLogs || []).map((l: any) => l.meeting_id).filter(Boolean)));
      let weekDurationMap = new Map<string, number>();
      if (weekMeetingIds.length > 0) {
        // Chunk in case >1000
        for (let i = 0; i < weekMeetingIds.length; i += 500) {
          const slice = weekMeetingIds.slice(i, i + 500);
          const { data: ms } = await supabase
            .from('meetings')
            .select('id, duration_minutes')
            .in('id', slice);
          (ms || []).forEach((m: any) => {
            if (m.duration_minutes != null) weekDurationMap.set(m.id, Number(m.duration_minutes) * 60);
          });
        }
      }

      const counts = BUCKETS.map(b => ({ ...b, total: 0, fallbacks: 0 }));
      for (const log of (weekLogs || []) as any[]) {
        const dur = weekDurationMap.get(log.meeting_id);
        if (dur == null) continue;
        const bucket = counts.find(b => dur >= b.min && dur < b.max);
        if (!bucket) continue;
        bucket.total += 1;
        if (log.actual_model_used === 'gemini-3-flash') bucket.fallbacks += 1;
      }
      setBucketStats(counts.map(b => ({
        label: b.label,
        total: b.total,
        fallbacks: b.fallbacks,
        pct: b.total > 0 ? Math.round((b.fallbacks / b.total) * 100) : 0,
      })));
    } catch (err: any) {
      console.error('Failed to load diagnostics:', err);
      toast.error(`Failed to load diagnostics: ${err?.message || 'unknown error'}`);
    } finally {
      setLoadingData(false);
    }
  }, [isSystemAdmin]);

  useEffect(() => {
    if (!isSystemAdmin) return;
    loadData();
    const t = setInterval(loadData, 30_000);
    return () => clearInterval(t);
  }, [isSystemAdmin, loadData]);

  const maxPct = useMemo(() => Math.max(10, ...bucketStats.map(b => b.pct)), [bucketStats]);

  if (authLoading || !user || !isSystemAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const finishReasonClass = (fr?: string | null): string => {
    if (fr === 'stop') return 'bg-green-600 hover:bg-green-600 text-white border-transparent';
    if (fr === 'length') return 'bg-amber-500 hover:bg-amber-500 text-white border-transparent';
    if (fr) return 'bg-destructive text-destructive-foreground border-transparent';
    return 'bg-muted text-muted-foreground border-transparent';
  };

  const renderPingCard = (run: PingRun) => {
    const { variant, busy, result } = run;
    return (
      <Card key={run.id}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> {variant.label}
          </CardTitle>
          <CardDescription className="text-xs">
            {variant.model} · max_tokens {variant.max_tokens} · reasoning {variant.reasoning_mode}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {busy && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Calling model directly…
            </div>
          )}
          {result && (
            <>
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant={result.status_code >= 200 && result.status_code < 300 ? 'default' : 'destructive'}>
                  HTTP {result.status_code}
                </Badge>
                <Badge variant="secondary">{result.elapsed_ms} ms</Badge>
                {result.gateway_model && <Badge variant="outline">{result.gateway_model}</Badge>}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Badge className={finishReasonClass(result.finish_reason)}>
                  finish: {result.finish_reason ?? '—'}
                </Badge>
                <Badge variant="outline">native: {result.native_finish_reason ?? '—'}</Badge>
                <Badge variant="outline">tokens: {result.total_tokens ?? '—'}</Badge>
              </div>
              {result.error_message && (
                <div className="flex items-start gap-1 text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span className="break-all">{result.error_message}</span>
                </div>
              )}
              <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs font-mono whitespace-pre-wrap break-words">
{result.body_preview || '(empty body)'}
              </pre>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-subtle">
        <Header onNewMeeting={() => {}} />
        <main className="container mx-auto px-4 py-6 space-y-6 max-w-6xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">LLM Diagnostics — Gemini Pro Fallback</h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
                This page diagnoses whether <code>gemini-3.1-pro</code> is genuinely failing in production
                or whether our generation pipeline is misreporting a different problem as a timeout.
                Section 1 pings each model directly (no fallback wrapper) so you see the raw HTTP behaviour,
                and lets you compare Pro with different <code>max_tokens</code> and reasoning settings to
                isolate whether the MAX_TOKENS truncation is fixed by raising the limit, by disabling
                reasoning, or only by both together.
                Section 2 lists the most recent meetings where Pro fell back to Flash, with the captured
                status code, elapsed time and error message. Section 3 shows the fallback rate over the last
                7 days bucketed by meeting length — if the &lt;10 min bucket shows a high fallback %, Pro is
                broken across the board, not just on long meetings.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loadingData}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingData ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* SECTION 1 */}
          <Card>
            <CardHeader>
              <CardTitle>1. Live model ping test</CardTitle>
              <CardDescription>
                Sends a fixed one-sentence summarisation prompt directly to each model — no fallback chain,
                no wrapper. Each click is a fresh request and accumulates as a card below for comparison.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <strong>Goal:</strong> a Pro variant that returns <code>finish_reason='stop'</code> with a complete summary in the body. That's your fix.
              </p>
              <div className="flex flex-wrap gap-2">
                {VARIANTS.map(v => {
                  const busy = busyKeys.has(v.key);
                  return (
                    <Button
                      key={v.key}
                      size="sm"
                      variant={v.buttonVariant ?? 'default'}
                      onClick={() => runPing(v)}
                      disabled={busy}
                    >
                      {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Test {v.label}
                    </Button>
                  );
                })}
              </div>
              {pingRuns.length > 0 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={clearPingRuns}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    Clear results
                  </button>
                </div>
              )}
              {pingRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No results yet — click any button above.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {pingRuns.map(renderPingCard)}
                </div>
              )}
            </CardContent>
          </Card>


          {/* SECTION 2 */}
          <Card>
            <CardHeader>
              <CardTitle>2. Recent Pro → Flash fallback events (last 10)</CardTitle>
              <CardDescription>
                Meetings where Pro was tried first and Flash succeeded as a fallback.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fallbackRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No fallback events recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Pro status</TableHead>
                        <TableHead>Pro elapsed</TableHead>
                        <TableHead>Pro error</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fallbackRows.map((r, idx) => {
                        const dur = r.meeting_duration_seconds;
                        const durLabel = dur == null
                          ? '—'
                          : dur < 60
                            ? `${dur}s`
                            : `${Math.floor(dur / 60)}m ${Math.round(dur % 60)}s`;
                        return (
                          <TableRow key={`${r.meeting_id}-${idx}`}>
                            <TableCell className="whitespace-nowrap text-xs">{formatDateTime(r.created_at)}</TableCell>
                            <TableCell className="whitespace-nowrap">{durLabel}</TableCell>
                            <TableCell>
                              {r.pro_status_code == null ? '—' : (
                                <Badge variant={r.pro_status_code >= 200 && r.pro_status_code < 300 ? 'secondary' : 'destructive'}>
                                  {r.pro_status_code === 0 ? 'n/a' : r.pro_status_code}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{r.pro_elapsed_ms == null ? '—' : `${r.pro_elapsed_ms} ms`}</TableCell>
                            <TableCell className="max-w-xs">
                              {r.pro_error_message ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs text-destructive cursor-help">{truncate(r.pro_error_message, 200)}</span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-md">
                                    <p className="text-xs whitespace-pre-wrap break-words">{r.pro_error_message}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              {r.fallback_reason ? <Badge variant="outline">{r.fallback_reason}</Badge> : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SECTION 3 */}
          <Card>
            <CardHeader>
              <CardTitle>3. Fallback rate by meeting duration (last 7 days)</CardTitle>
              <CardDescription>
                Of meetings where Pro was the primary model, how often did we fall back to Flash?
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bucketStats.every(b => b.total === 0) ? (
                <p className="text-sm text-muted-foreground">No Pro generations recorded in the last 7 days.</p>
              ) : (
                <div className="space-y-3">
                  {bucketStats.map(b => (
                    <div key={b.label} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3">
                      <div className="text-sm font-medium">{b.label}</div>
                      <div className="relative h-7 rounded bg-muted overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-primary transition-all"
                          style={{ width: `${b.total === 0 ? 0 : (b.pct / maxPct) * 100}%` }}
                        />
                        <div className="absolute inset-0 flex items-center px-2 text-xs font-medium">
                          {b.total === 0 ? 'no data' : `${b.pct}% (${b.fallbacks}/${b.total})`}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums w-20 text-right">
                        {b.total} meeting{b.total === 1 ? '' : 's'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </TooltipProvider>
  );
};

export default LLMDiagnostics;
