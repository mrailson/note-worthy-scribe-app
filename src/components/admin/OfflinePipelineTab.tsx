import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from '@/components/ui/tooltip';
import { MoreVertical, RefreshCw, ExternalLink, RotateCcw, Mail, Copy, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';

type PipelineState =
  | 'completed'
  | 'stuck_transcription'
  | 'stuck_notes'
  | 'in_flight'
  | 'failed_notes'
  | 'too_short'
  | 'notes_ready_email_pending'
  | 'notes_ready_email_stuck';

type FilterKey = 'all' | 'in_flight' | 'completed' | 'stuck' | 'failed' | 'too_short' | 'needs_attention';

interface PipelineRow {
  id: string;
  title: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  status: string;
  notes_generation_status: string | null;
  word_count: number | null;
  chunk_count: number | null;
  upload_session_id: string | null;
  notes_email_sent_at: string | null;
  created_at: string;
  updated_at: string;
  import_source: string | null;
  overview: string | null;
  whisper_transcript_text: string | null;
  user_email: string;
  user_name: string;
  has_summary: number;
  pipeline_state: PipelineState;
}

function computePipelineState(row: {
  notes_email_sent_at: string | null;
  has_summary: number;
  status: string;
  notes_generation_status: string | null;
  created_at: string;
  updated_at: string;
  overview: string | null;
}): PipelineState {
  const now = Date.now();
  const createdMs = new Date(row.created_at).getTime();
  const updatedMs = new Date(row.updated_at).getTime();
  const thirtyMin = 30 * 60 * 1000;
  const tenMin = 10 * 60 * 1000;

  if (row.notes_email_sent_at && row.has_summary > 0) return 'completed';
  if (row.notes_generation_status === 'failed' && row.overview?.toLowerCase().includes('too short')) return 'too_short';
  if (row.notes_generation_status === 'failed' && row.has_summary === 0) return 'failed_notes';
  if (row.status === 'pending_transcription' && (now - createdMs) > thirtyMin) return 'stuck_transcription';
  if (row.notes_generation_status === 'queued' && (now - updatedMs) > thirtyMin && row.has_summary === 0) return 'stuck_notes';
  if (row.has_summary > 0 && !row.notes_email_sent_at && (now - createdMs) <= tenMin) return 'notes_ready_email_pending';
  if (row.has_summary > 0 && !row.notes_email_sent_at && (now - createdMs) > tenMin) return 'notes_ready_email_stuck';
  if (row.status === 'pending_transcription' || ['queued', 'generating'].includes(row.notes_generation_status || '')) return 'in_flight';
  return 'completed';
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

function formatDuration(mins: number | null): string {
  if (!mins) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTimeDiff(start: string, end: string): string {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff < 0) return '—';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const stateColours: Record<PipelineState, { bg: string; text: string }> = {
  completed: { bg: 'bg-green-50 dark:bg-green-950', text: 'text-green-800 dark:text-green-300' },
  in_flight: { bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-800 dark:text-blue-300' },
  stuck_transcription: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-800 dark:text-red-300' },
  stuck_notes: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-800 dark:text-red-300' },
  failed_notes: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-800 dark:text-red-300' },
  too_short: { bg: 'bg-gray-50 dark:bg-gray-900', text: 'text-gray-600 dark:text-gray-400' },
  notes_ready_email_pending: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-800 dark:text-amber-300' },
  notes_ready_email_stuck: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-800 dark:text-red-300' },
};

function PipelineBadge({ state, label }: { state: PipelineState; label: string }) {
  const c = stateColours[state];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${c.bg} ${c.text}`}>
      {label}
    </span>
  );
}

const FILTER_MAP: Record<FilterKey, PipelineState[]> = {
  all: [],
  in_flight: ['in_flight'],
  completed: ['completed'],
  stuck: ['stuck_transcription', 'stuck_notes', 'notes_ready_email_stuck'],
  failed: ['failed_notes'],
  too_short: ['too_short'],
  needs_attention: ['stuck_transcription', 'stuck_notes', 'notes_ready_email_stuck', 'failed_notes'],
};

type SortField = 'created_at' | 'title' | 'duration_minutes' | 'word_count' | 'user_name';

export function OfflinePipelineTab() {
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [, setLastRefresh] = useState(Date.now());

  const fetchData = useCallback(async () => {
    setLoading(true);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: meetings, error } = await supabase
      .from('meetings')
      .select('id, title, user_id, start_time, end_time, duration_minutes, status, notes_generation_status, word_count, chunk_count, upload_session_id, notes_email_sent_at, created_at, updated_at, import_source, overview, whisper_transcript_text')
      .in('import_source', ['mobile_offline', 'mobile_live'])
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load pipeline data');
      setLoading(false);
      return;
    }

    if (!meetings || meetings.length === 0) {
      setRows([]);
      setLoading(false);
      setLastRefresh(Date.now());
      return;
    }

    const userIds = [...new Set(meetings.map(m => m.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email, full_name')
      .in('user_id', userIds);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    const meetingIds = meetings.map(m => m.id);
    const { data: summaries } = await supabase
      .from('meeting_summaries')
      .select('meeting_id')
      .in('meeting_id', meetingIds);

    const summarySet = new Set((summaries || []).map(s => s.meeting_id));

    const mapped: PipelineRow[] = meetings.map(m => {
      const profile = profileMap.get(m.user_id);
      const has_summary = summarySet.has(m.id) ? 1 : 0;
      const base = {
        ...m,
        user_email: profile?.email || 'Unknown',
        user_name: profile?.full_name || 'Unknown',
        has_summary,
        pipeline_state: 'completed' as PipelineState,
      };
      base.pipeline_state = computePipelineState(base);
      return base;
    });

    setRows(mapped);
    setLoading(false);
    setLastRefresh(Date.now());
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: rows.length, in_flight: 0, completed: 0, stuck: 0, failed: 0, too_short: 0, needs_attention: 0 };
    rows.forEach(r => {
      if (FILTER_MAP.in_flight.includes(r.pipeline_state)) c.in_flight++;
      if (FILTER_MAP.completed.includes(r.pipeline_state)) c.completed++;
      if (FILTER_MAP.stuck.includes(r.pipeline_state)) c.stuck++;
      if (FILTER_MAP.failed.includes(r.pipeline_state)) c.failed++;
      if (FILTER_MAP.too_short.includes(r.pipeline_state)) c.too_short++;
      if (FILTER_MAP.needs_attention.includes(r.pipeline_state)) c.needs_attention++;
    });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    let list = filter === 'all' ? rows : rows.filter(r => FILTER_MAP[filter].includes(r.pipeline_state));
    list = [...list].sort((a, b) => {
      let av: any = (a as any)[sortField];
      let bv: any = (b as any)[sortField];
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av == null) return 1;
      if (bv == null) return -1;
      return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return list;
  }, [rows, filter, sortField, sortAsc]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  }

  async function retryTranscription(meetingId: string) {
    const { error } = await supabase.functions.invoke('transcribe-offline-meeting', { body: { meetingId, chunkIndex: 0 } });
    if (error) toast.error(`Retry failed: ${error.message}`);
    else toast.success('Transcription retry dispatched');
    setTimeout(fetchData, 2000);
  }

  async function retryNotes(meetingId: string) {
    const { error } = await supabase.functions.invoke('auto-generate-meeting-notes', { body: { meetingId } });
    if (error) toast.error(`Retry failed: ${error.message}`);
    else toast.success('Notes generation retry dispatched');
    setTimeout(fetchData, 2000);
  }

  async function forceSendEmail(meetingId: string) {
    const { error } = await supabase.functions.invoke('deliver-mobile-meeting-email', { body: { meetingId } });
    if (error) toast.error(`Email send failed: ${error.message}`);
    else toast.success('Email delivery dispatched');
    setTimeout(fetchData, 2000);
  }

  function copyDiagnostic(row: PipelineRow) {
    const blob = JSON.stringify(row, null, 2);
    navigator.clipboard.writeText(blob);
    toast.success('Diagnostic JSON copied to clipboard');
  }

  function initials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  function renderTranscriptBadge(row: PipelineRow) {
    if (row.pipeline_state === 'stuck_transcription') {
      const mins = Math.floor((Date.now() - new Date(row.created_at).getTime()) / 60000);
      return <PipelineBadge state="stuck_transcription" label={`Stuck ${mins}m`} />;
    }
    if (row.pipeline_state === 'too_short') {
      return <PipelineBadge state="too_short" label={`${row.word_count || 0} w · short`} />;
    }
    if (row.status === 'pending_transcription') {
      return <PipelineBadge state="in_flight" label={`Transcribing`} />;
    }
    if (row.word_count && row.word_count > 0) {
      return <PipelineBadge state="completed" label={`${row.word_count.toLocaleString()} w`} />;
    }
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  function renderNotesBadge(row: PipelineRow) {
    if (row.pipeline_state === 'too_short') return <PipelineBadge state="too_short" label="Skipped" />;
    if (row.has_summary > 0) return <PipelineBadge state="completed" label="Ready" />;
    if (row.notes_generation_status === 'generating') return <PipelineBadge state="in_flight" label="Generating" />;
    if (row.notes_generation_status === 'queued') return <PipelineBadge state="in_flight" label="Queued" />;
    if (row.notes_generation_status === 'failed') return <PipelineBadge state="failed_notes" label="Failed" />;
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  function renderEmailBadge(row: PipelineRow) {
    if (row.notes_email_sent_at) {
      return (
        <Tooltip>
          <TooltipTrigger><PipelineBadge state="completed" label="Sent" /></TooltipTrigger>
          <TooltipContent>{new Date(row.notes_email_sent_at).toLocaleString('en-GB')}</TooltipContent>
        </Tooltip>
      );
    }
    if (row.pipeline_state === 'notes_ready_email_pending') return <PipelineBadge state="notes_ready_email_pending" label="Pending" />;
    if (row.pipeline_state === 'notes_ready_email_stuck') {
      const mins = Math.floor((Date.now() - new Date(row.created_at).getTime()) / 60000);
      return <PipelineBadge state="notes_ready_email_stuck" label={`Stuck ${mins}m`} />;
    }
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  function renderTotalTime(row: PipelineRow) {
    if (row.pipeline_state === 'completed' && row.notes_email_sent_at) {
      return <span className="text-xs">{formatTimeDiff(row.created_at, row.notes_email_sent_at)}</span>;
    }
    if (['stuck_transcription', 'stuck_notes', 'notes_ready_email_stuck', 'failed_notes'].includes(row.pipeline_state)) {
      return <span className="text-xs text-red-600 dark:text-red-400">Needs retry</span>;
    }
    if (row.pipeline_state === 'in_flight' || row.pipeline_state === 'notes_ready_email_pending') {
      return <span className="text-xs text-blue-600 dark:text-blue-400">In flight</span>;
    }
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(field)}>
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </div>
    </TableHead>
  );

  const filterPills: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'in_flight', label: 'In flight' },
    { key: 'completed', label: 'Completed' },
    { key: 'needs_attention', label: 'Needs attention' },
    { key: 'stuck', label: 'Stuck' },
    { key: 'failed', label: 'Failed' },
    { key: 'too_short', label: 'Too short' },
  ];

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">Offline Pipeline</h2>
            <p className="text-sm text-muted-foreground">Last 7 days · Mobile offline recordings</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            Auto-refresh · 30s
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-4 gap-3">
          <Card><CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{counts.all}</div>
            <div className="text-xs text-muted-foreground">Total recordings</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{counts.in_flight}</div>
            <div className="text-xs text-muted-foreground">In flight</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{counts.stuck}</div>
            <div className="text-xs text-muted-foreground">Stuck &gt; 30 min</div>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{counts.failed}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </CardContent></Card>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {filterPills.map(fp => (
            <Button
              key={fp.key}
              variant={filter === fp.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(fp.key)}
              className="text-xs"
            >
              {fp.label} · {counts[fp.key]}
            </Button>
          ))}
        </div>

        {/* Table */}
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">Loading pipeline data…</div>
        ) : filtered.length === 0 && filter === 'all' ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="font-medium">No offline mobile recordings in the last 7 days.</p>
              <p className="text-sm text-muted-foreground mt-1">Recordings made via the mobile recorder in offline mode will appear here once uploaded.</p>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">No recordings match this filter.</CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader field="user_name">User</SortHeader>
                  <SortHeader field="title">Title</SortHeader>
                  <SortHeader field="created_at">Recorded</SortHeader>
                  <SortHeader field="duration_minutes">Duration</SortHeader>
                  <TableHead>Transcript</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(row => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger>
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">{initials(row.user_name)}</AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>{row.user_email}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <a
                        href={`/meeting-summary/${row.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium hover:underline text-primary"
                      >
                        {row.title}
                      </a>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{relativeTime(row.start_time)}</TableCell>
                    <TableCell className="text-xs">{formatDuration(row.duration_minutes)}</TableCell>
                    <TableCell>{renderTranscriptBadge(row)}</TableCell>
                    <TableCell>{renderNotesBadge(row)}</TableCell>
                    <TableCell>{renderEmailBadge(row)}</TableCell>
                    <TableCell>{renderTotalTime(row)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => window.open(`/meeting-summary/${row.id}`, '_blank')}>
                            <ExternalLink className="h-4 w-4 mr-2" /> View meeting
                          </DropdownMenuItem>
                          {['stuck_transcription'].includes(row.pipeline_state) && (
                            <DropdownMenuItem onClick={() => retryTranscription(row.id)}>
                              <RotateCcw className="h-4 w-4 mr-2" /> Retry transcription
                            </DropdownMenuItem>
                          )}
                          {row.pipeline_state === 'failed_notes' && !row.whisper_transcript_text && (
                            <DropdownMenuItem onClick={() => retryTranscription(row.id)}>
                              <RotateCcw className="h-4 w-4 mr-2" /> Retry transcription
                            </DropdownMenuItem>
                          )}
                          {row.has_summary === 0 && row.whisper_transcript_text && (
                            <DropdownMenuItem onClick={() => retryNotes(row.id)}>
                              <RotateCcw className="h-4 w-4 mr-2" /> Retry notes
                            </DropdownMenuItem>
                          )}
                          {row.has_summary > 0 && !row.notes_email_sent_at && (
                            <DropdownMenuItem onClick={() => forceSendEmail(row.id)}>
                              <Mail className="h-4 w-4 mr-2" /> Force send email
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => copyDiagnostic(row)}>
                            <Copy className="h-4 w-4 mr-2" /> Copy diagnostic
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
