import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, ArrowRight, ArrowDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { diffWords } from 'diff';
import { useIsMobile } from '@/hooks/use-mobile';

interface RunRow {
  id: string;
  user_id: string;
  test_size: string | null;
  meeting_id: string | null;
  model_override: string | null;
  notes_model_used: string | null;
  notes_chars: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd_est: number | null;
  started_at: string;
  finished_at: string | null;
  notes_invoked_at: string | null;
  notes_first_delta_at: string | null;
  notes_completed_at: string | null;
  status: string | null;
}

interface MeetingRow {
  id: string;
  title: string | null;
  import_source: string | null;
  import_metadata: any;
  notes_style_3: string | null;
}

interface FullRun {
  run: RunRow;
  meeting: MeetingRow | null;
  notes: string;
}

const SECTION_HEADINGS = [
  'METADATA',
  'ATTENDEES',
  'MEETING PURPOSE',
  'HEADLINE POSITION',
  'DECISIONS',
  'DECISIONS REGISTER',
  'NOTED',
  'OPEN ITEMS',
  'KEY RISKS',
  'RISKS',
  'ACTION',
  'ACTIONS',
  'NEXT MEETING',
];

function ms(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  return new Date(b).getTime() - new Date(a).getTime();
}
function formatMs(v: number | null): string {
  if (v === null || isNaN(v)) return '—';
  if (v < 1000) return `${v}ms`;
  if (v < 60_000) return `${(v / 1000).toFixed(1)}s`;
  return `${Math.floor(v / 60_000)}m ${Math.round((v % 60_000) / 1000)}s`;
}
function deltaColour(a: number | null, b: number | null, lowerIsBetter: boolean): string {
  if (a == null || b == null || a === 0) return 'text-muted-foreground';
  const change = (b - a) / a;
  if (Math.abs(change) < 0.05) return 'text-muted-foreground';
  const better = lowerIsBetter ? b < a : b > a;
  return better ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
}
function deltaText(a: number | null, b: number | null, fmt: (n: number) => string, suffix = ''): string {
  if (a == null || b == null) return '—';
  const diff = b - a;
  const pct = a === 0 ? 0 : (diff / a) * 100;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${fmt(diff)}${suffix} (${sign}${pct.toFixed(0)}%)`;
}

function parseTier(modelStr: string | null): string | null {
  if (!modelStr) return null;
  const m = modelStr.match(/\+filter:(executive|full|verbatim)/);
  return m?.[1] ?? null;
}

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) || []).length;
}

function quickChecks(notes: string) {
  // Decisions: lines starting with AGREED — / NOTED — / RESOLVED — OR bullets in DECISIONS section.
  const decisionLines = countMatches(notes, /^\s*(?:[-*]\s*)?(?:AGREED|NOTED|RESOLVED)\s*[—-]/gim);
  // Actions: rows in markdown table after an ACTION(S) heading.
  let actionsCount = 0;
  let actionsWithDeadline = 0;
  const actionMatch = notes.match(/#{1,6}\s*ACTIONS?[\s\S]*?(?=\n#{1,6}\s|\n*$)/i);
  if (actionMatch) {
    const rows = actionMatch[0].split('\n').filter(l => /^\s*\|/.test(l) && !/^\s*\|\s*[-:|\s]+\|\s*$/.test(l));
    // First row is header
    const dataRows = rows.slice(1);
    actionsCount = dataRows.length;
    for (const r of dataRows) {
      const cells = r.split('|').map(c => c.trim()).filter(Boolean);
      const last = cells[cells.length - 1] ?? '';
      if (last && !/not specified|tbc|tba|—|^-$/i.test(last)) actionsWithDeadline++;
    }
  }
  const risksMatch = notes.match(/#{1,6}\s*(?:KEY\s+)?RISKS?[\s\S]*?(?=\n#{1,6}\s|\n*$)/i)
    ?? notes.match(/#{1,6}\s*OPEN ITEMS[\s\S]*?(?=\n#{1,6}\s|\n*$)/i);
  const risksCount = risksMatch
    ? risksMatch[0].split('\n').filter(l => /^\s*[-*]\s+/.test(l)).length
    : 0;
  const chars = notes.length;

  // Orphan formatting markers
  const warnings: string[] = [];
  const boldOpens = countMatches(notes, /\*\*/g);
  if (boldOpens % 2 !== 0) warnings.push('Unbalanced ** markers');
  // Empty headers (heading immediately followed by blank line then another heading or EOF)
  if (/#{1,6}\s+\S[^\n]*\n\s*\n\s*(#{1,6}\s|$)/.test(notes)) warnings.push('Possible empty section header');
  // Stray pipes outside of tables (a single line containing only "|")
  if (/^\s*\|\s*$/m.test(notes)) warnings.push('Stray pipe character');
  return { decisionLines, actionsCount, actionsWithDeadline, risksCount, chars, warnings };
}

function splitBySections(notes: string): Array<{ heading: string; body: string }> {
  const lines = notes.split('\n');
  const sections: Array<{ heading: string; body: string }> = [];
  let current: { heading: string; body: string } = { heading: 'PREAMBLE', body: '' };
  for (const line of lines) {
    const h = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (h) {
      if (current.body.trim() || current.heading !== 'PREAMBLE') sections.push(current);
      current = { heading: h[1].toUpperCase(), body: '' };
    } else {
      current.body += line + '\n';
    }
  }
  if (current.body.trim() || sections.length === 0) sections.push(current);
  return sections;
}

function DiffBlock({ a, b }: { a: string; b: string }) {
  const parts = useMemo(() => diffWords(a, b), [a, b]);
  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap font-mono">
      {parts.map((p, i) => {
        if (p.added) return <span key={i} className="bg-green-500/20 text-green-800 dark:text-green-300">{p.value}</span>;
        if (p.removed) return <span key={i} className="bg-red-500/20 text-red-800 dark:text-red-300 line-through">{p.value}</span>;
        return <span key={i} className="text-muted-foreground">{p.value}</span>;
      })}
    </div>
  );
}

function SectionedDiff({ a, b }: { a: string; b: string }) {
  const aSecs = splitBySections(a);
  const bSecs = splitBySections(b);
  const headings = Array.from(new Set([...aSecs.map(s => s.heading), ...bSecs.map(s => s.heading)]));
  // Order known headings first
  headings.sort((x, y) => {
    const xi = SECTION_HEADINGS.findIndex(h => x.includes(h));
    const yi = SECTION_HEADINGS.findIndex(h => y.includes(h));
    if (xi === -1 && yi === -1) return x.localeCompare(y);
    if (xi === -1) return 1;
    if (yi === -1) return -1;
    return xi - yi;
  });
  return (
    <div className="space-y-4">
      {headings.map(h => {
        const aBody = aSecs.find(s => s.heading === h)?.body ?? '';
        const bBody = bSecs.find(s => s.heading === h)?.body ?? '';
        return (
          <div key={h} className="border rounded p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{h}</div>
            <DiffBlock a={aBody} b={bBody} />
          </div>
        );
      })}
    </div>
  );
}

function MetricRow({ label, a, b, lowerIsBetter, fmt, suffix = '' }: {
  label: string; a: number | null; b: number | null; lowerIsBetter: boolean;
  fmt: (n: number) => string; suffix?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-sm py-1 items-center">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono text-right">{a != null ? fmt(a) + suffix : '—'}</div>
      <div className="text-muted-foreground"><ArrowRight className="h-3 w-3" /></div>
      <div className={`font-mono text-right ${deltaColour(a, b, lowerIsBetter)}`}>
        {b != null ? fmt(b) + suffix : '—'}
        <span className="ml-2 text-xs">{deltaText(a, b, (n) => fmt(Math.abs(n)), suffix)}</span>
      </div>
    </div>
  );
}

function ColumnHeader({ label, run }: { label: string; run: FullRun }) {
  const tier = parseTier(run.run.notes_model_used) ?? parseTier(run.run.model_override);
  const original = run.meeting?.import_metadata?.original_meeting_title;
  const source = original ?? run.meeting?.title ?? `${run.run.test_size ?? '?'} fixture`;
  return (
    <div className="border rounded-md p-3 bg-muted/30 space-y-1">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{label}</Badge>
        {tier && <Badge variant="outline" className="text-[10px] uppercase">{tier}</Badge>}
      </div>
      <div className="text-sm font-medium font-mono break-all">{run.run.notes_model_used ?? run.run.model_override ?? '—'}</div>
      <div className="text-xs text-muted-foreground truncate" title={source}>{source}</div>
      <div className="text-[11px] text-muted-foreground">{new Date(run.run.started_at).toLocaleString('en-GB')}</div>
    </div>
  );
}

function MetricsBlock({ run }: { run: FullRun }) {
  const totalMs = ms(run.run.started_at, run.run.finished_at);
  const ttftMs = ms(run.run.notes_invoked_at, run.run.notes_first_delta_at);
  return (
    <div className="text-xs grid grid-cols-2 gap-x-3 gap-y-1 border rounded p-2">
      <div className="text-muted-foreground">Total time</div><div className="font-mono">{formatMs(totalMs)}</div>
      <div className="text-muted-foreground">Time to first token</div><div className="font-mono">{formatMs(ttftMs)}</div>
      <div className="text-muted-foreground">Tokens in/out</div>
      <div className="font-mono">{run.run.input_tokens?.toLocaleString() ?? '—'} / {run.run.output_tokens?.toLocaleString() ?? '—'}</div>
      <div className="text-muted-foreground">Cost (GBP)</div>
      <div className="font-mono">{run.run.cost_usd_est != null ? `£${(Number(run.run.cost_usd_est) * 0.79).toFixed(4)}` : '—'}</div>
      <div className="text-muted-foreground">Output chars</div>
      <div className="font-mono">{run.notes.length.toLocaleString()}</div>
    </div>
  );
}

export default function PipelineCompare() {
  const { user, isSystemAdmin, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [a, setA] = useState<FullRun | null>(null);
  const [b, setB] = useState<FullRun | null>(null);
  const [showDiff, setShowDiff] = useState(true);

  const ids = useMemo(() => (params.get('compare') ?? '').split(',').map(s => s.trim()).filter(Boolean), [params]);

  useEffect(() => {
    (async () => {
      if (authLoading) return;
      if (!user) { setError('Sign in to view comparison'); setLoading(false); return; }
      if (ids.length !== 2) { setError('Provide exactly two run IDs in ?compare=runId1,runId2'); setLoading(false); return; }
      setLoading(true);
      try {
        const { data: runs, error: rErr } = await supabase
          .from('pipeline_test_runs')
          .select('*')
          .in('id', ids);
        if (rErr) throw rErr;
        if (!runs || runs.length !== 2) throw new Error('One or both runs not found');
        // Ownership check (server-side via RLS, but assert here too)
        if (!isSystemAdmin && runs.some((r: any) => r.user_id !== user.id)) {
          throw new Error('You can only compare your own runs');
        }
        const meetingIds = runs.map((r: any) => r.meeting_id).filter(Boolean);
        const { data: meetings } = await supabase
          .from('meetings')
          .select('id,title,import_source,import_metadata,notes_style_3')
          .in('id', meetingIds);
        const meetingMap: Record<string, MeetingRow> = {};
        for (const m of (meetings ?? []) as MeetingRow[]) meetingMap[m.id] = m;
        const built: FullRun[] = ids.map(id => {
          const r = runs.find((x: any) => x.id === id) as RunRow;
          const m = r.meeting_id ? meetingMap[r.meeting_id] ?? null : null;
          return { run: r, meeting: m, notes: m?.notes_style_3 ?? '' };
        });
        setA(built[0]); setB(built[1]);
      } catch (err: any) {
        setError(err.message ?? 'Failed to load comparison');
      } finally {
        setLoading(false);
      }
    })();
  }, [ids.join(','), user?.id, authLoading, isSystemAdmin]);

  if (authLoading || loading) {
    return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading comparison…</div>;
  }
  if (error || !a || !b) {
    return (
      <div className="p-6 max-w-xl mx-auto space-y-3">
        <div className="text-destructive text-sm">{error}</div>
        <Link to="/admin/pipeline-test" className="text-sm text-primary underline">← Back to Pipeline Test</Link>
      </div>
    );
  }

  const checksA = quickChecks(a.notes);
  const checksB = quickChecks(b.notes);

  const totalA = ms(a.run.started_at, a.run.finished_at);
  const totalB = ms(b.run.started_at, b.run.finished_at);
  const ttftA = ms(a.run.notes_invoked_at, a.run.notes_first_delta_at);
  const ttftB = ms(b.run.notes_invoked_at, b.run.notes_first_delta_at);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Compare Runs</h1>
          <p className="text-xs text-muted-foreground">Read-only side-by-side. Computed client-side from saved outputs.</p>
        </div>
        <Link to="/admin/pipeline-test" className="text-xs text-primary underline inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Pipeline Test
        </Link>
      </div>

      {/* Metrics delta strip */}
      <Card>
        <CardHeader className="p-3 pb-1"><CardTitle className="text-sm">Metrics delta (A → B)</CardTitle></CardHeader>
        <CardContent className="p-3 pt-1 space-y-1">
          <MetricRow label="Total time"          a={totalA} b={totalB} lowerIsBetter fmt={(n) => formatMs(Math.round(n))} />
          <MetricRow label="Time to first token" a={ttftA}  b={ttftB}  lowerIsBetter fmt={(n) => formatMs(Math.round(n))} />
          <MetricRow label="Input tokens"        a={a.run.input_tokens}  b={b.run.input_tokens}  lowerIsBetter fmt={(n) => Math.round(n).toLocaleString()} />
          <MetricRow label="Output tokens"       a={a.run.output_tokens} b={b.run.output_tokens} lowerIsBetter={false} fmt={(n) => Math.round(n).toLocaleString()} />
          <MetricRow label="Cost (GBP)"          a={a.run.cost_usd_est != null ? Number(a.run.cost_usd_est) * 0.79 : null}
                                                  b={b.run.cost_usd_est != null ? Number(b.run.cost_usd_est) * 0.79 : null}
                                                  lowerIsBetter fmt={(n) => `£${n.toFixed(4)}`} />
          <MetricRow label="Output chars"        a={a.notes.length} b={b.notes.length} lowerIsBetter={false} fmt={(n) => Math.round(n).toLocaleString()} />
        </CardContent>
      </Card>

      {/* Side-by-side */}
      {isMobile ? (
        <Tabs defaultValue="a">
          <TabsList className="sticky top-0 z-10 w-full">
            <TabsTrigger value="a" className="flex-1">Run A</TabsTrigger>
            <TabsTrigger value="b" className="flex-1">Run B</TabsTrigger>
          </TabsList>
          <TabsContent value="a" className="space-y-2">
            <ColumnHeader label="A" run={a} />
            <MetricsBlock run={a} />
            <NotesPane notes={a.notes} />
          </TabsContent>
          <TabsContent value="b" className="space-y-2">
            <ColumnHeader label="B" run={b} />
            <MetricsBlock run={b} />
            <NotesPane notes={b.notes} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <ColumnHeader label="A" run={a} />
            <MetricsBlock run={a} />
            <NotesPane notes={a.notes} />
          </div>
          <div className="space-y-2">
            <ColumnHeader label="B" run={b} />
            <MetricsBlock run={b} />
            <NotesPane notes={b.notes} />
          </div>
        </div>
      )}

      {/* Diff toggle */}
      <Card>
        <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Content diff (word-level, by section)</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="diff" className="text-xs cursor-pointer">Show diff</Label>
            <Switch id="diff" checked={showDiff} onCheckedChange={setShowDiff} />
          </div>
        </CardHeader>
        {showDiff && (
          <CardContent className="p-3 pt-1">
            <div className="text-xs text-muted-foreground mb-2 flex gap-3">
              <span><span className="bg-green-500/20 px-1">added in B</span></span>
              <span><span className="bg-red-500/20 px-1 line-through">removed from A</span></span>
              <span><span className="text-muted-foreground">unchanged</span></span>
            </div>
            <SectionedDiff a={a.notes} b={b.notes} />
          </CardContent>
        )}
      </Card>

      {/* Quick checks */}
      <Card>
        <CardHeader className="p-3 pb-1"><CardTitle className="text-sm">Quick checks</CardTitle></CardHeader>
        <CardContent className="p-3 pt-1">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="text-left py-1">Signal</th><th className="text-right py-1">A</th><th className="text-right py-1">B</th><th className="text-right py-1">Δ</th></tr>
            </thead>
            <tbody>
              {[
                ['Decisions', checksA.decisionLines, checksB.decisionLines],
                ['Actions', checksA.actionsCount, checksB.actionsCount],
                ['Actions with deadlines', checksA.actionsWithDeadline, checksB.actionsWithDeadline],
                ['Risks', checksA.risksCount, checksB.risksCount],
                ['Output chars', checksA.chars, checksB.chars],
              ].map(([label, x, y]) => (
                <tr key={label as string} className="border-t">
                  <td className="py-1">{label}</td>
                  <td className="py-1 font-mono text-right">{(x as number).toLocaleString()}</td>
                  <td className="py-1 font-mono text-right">{(y as number).toLocaleString()}</td>
                  <td className={`py-1 font-mono text-right ${(y as number) === (x as number) ? 'text-muted-foreground' : ((y as number) > (x as number) ? 'text-green-600' : 'text-red-600')}`}>
                    {((y as number) - (x as number) > 0 ? '+' : '') + ((y as number) - (x as number)).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(checksA.warnings.length > 0 || checksB.warnings.length > 0) && (
            <div className="mt-3 space-y-1">
              {checksA.warnings.map(w => (
                <div key={'a-' + w} className="flex items-center gap-2 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" /> A: {w}
                </div>
              ))}
              {checksB.warnings.map(w => (
                <div key={'b-' + w} className="flex items-center gap-2 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" /> B: {w}
                </div>
              ))}
            </div>
          )}
          {checksA.warnings.length === 0 && checksB.warnings.length === 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-green-600">
              <CheckCircle2 className="h-3 w-3" /> No orphaned formatting markers detected.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NotesPane({ notes }: { notes: string }) {
  return (
    <div className="border rounded p-3 max-h-[600px] overflow-y-auto">
      <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">{notes || <span className="text-muted-foreground">No notes saved.</span>}</pre>
    </div>
  );
}
