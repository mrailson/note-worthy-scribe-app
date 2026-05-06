import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Users, Download, ChevronRight, Search, Plus, Trash2, Pencil, AlertTriangle } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, parseISO, eachWeekOfInterval, addWeeks } from 'date-fns';
import { toast } from 'sonner';
import { formatDuration } from '@/utils/formatDuration';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, ReferenceLine,
} from 'recharts';

type Period = 'this-week' | 'this-month' | 'last-month' | 'custom';

interface TimeEntry {
  id: string;
  user_id: string;
  entry_date: string;
  activity: string;
  minutes: number;
  notes: string | null;
  entered_by: string | null;
  practice_id: string | null;
  created_at: string;
}

interface ProfileLite {
  user_id: string;
  full_name: string;
  email: string;
  role: string | null;
  is_verifier: boolean;
}

interface Practice { id: string; name: string; }
interface Target { id: string; role: string | null; user_id: string | null; period: 'week' | 'month'; target_hours: number; }

const NHS_BLUE = '#185FA5';
const MID_BLUE = '#378ADD';
const LIGHT_BLUE = '#85B7EB';

function periodRange(p: Period, customStart?: Date, customEnd?: Date): { start: Date; end: Date; label: string; prevStart: Date; prevEnd: Date } {
  const now = new Date();
  if (p === 'this-week') {
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    return { start, end, label: 'This week', prevStart: subWeeks(start, 1), prevEnd: subWeeks(end, 1) };
  }
  if (p === 'this-month') {
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return { start, end, label: 'This month', prevStart: startOfMonth(subMonths(now, 1)), prevEnd: endOfMonth(subMonths(now, 1)) };
  }
  if (p === 'last-month') {
    const lm = subMonths(now, 1);
    const start = startOfMonth(lm);
    const end = endOfMonth(lm);
    return { start, end, label: 'Last month', prevStart: startOfMonth(subMonths(lm, 1)), prevEnd: endOfMonth(subMonths(lm, 1)) };
  }
  const start = customStart ?? startOfMonth(now);
  const end = customEnd ?? endOfMonth(now);
  const span = end.getTime() - start.getTime();
  return { start, end, label: 'Custom', prevStart: new Date(start.getTime() - span), prevEnd: new Date(start.getTime() - 1) };
}

function inRange(dateStr: string, start: Date, end: Date) {
  const d = parseISO(dateStr);
  return d >= new Date(start.getFullYear(), start.getMonth(), start.getDate())
      && d <= new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59);
}

function targetForUser(user: ProfileLite, period: 'week' | 'month', targets: Target[]): number {
  const userT = targets.find(t => t.user_id === user.user_id && t.period === period);
  if (userT) return userT.target_hours;
  const role = (user.role || '').toLowerCase();
  const roleT = targets.find(t => t.role === role && t.period === period);
  if (roleT) return roleT.target_hours;
  // Default fallback: monthly 18.75, weekly 4.7
  return period === 'month' ? 18.75 : 4.7;
}

interface NRESTimeManagerViewProps {
  hideHeading?: boolean;
  onSummaryChange?: (s: { activeCount: number; totalEligible: number; practiceCount: number }) => void;
}

export function NRESTimeManagerView({ hideHeading, onSummaryChange }: NRESTimeManagerViewProps = {}) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('this-month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [users, setUsers] = useState<ProfileLite[]>([]);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterPractice, setFilterPractice] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterActivity, setFilterActivity] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const [drillUserId, setDrillUserId] = useState<string | null>(null);
  const [logBehalfOpen, setLogBehalfOpen] = useState(false);

  const range = useMemo(() => periodRange(period,
    customStart ? new Date(customStart) : undefined,
    customEnd ? new Date(customEnd) : undefined,
  ), [period, customStart, customEnd]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [eRes, pRes, prRes, tRes, aRes] = await Promise.all([
        supabase.from('nres_time_entries' as any).select('*'),
        supabase.from('profiles').select('user_id, full_name, email, role, is_verifier'),
        supabase.from('gp_practices').select('id, name, practice_code').order('name'),
        supabase.from('nres_time_targets' as any).select('*'),
        supabase.from('user_service_activations').select('user_id').eq('service', 'nres'),
      ]);
      if (eRes.error) throw eRes.error;
      const nresIds = new Set(((aRes.data || []) as any[]).map(r => r.user_id));
      const profilesAll = ((pRes.data || []) as any) as ProfileLite[];
      // Only NRES-assigned users
      setUsers(profilesAll.filter(p => nresIds.has(p.user_id)));
      // Only entries belonging to NRES-assigned users
      const nresEntries = ((eRes.data || []) as any[]).filter(e => nresIds.has(e.user_id));
      setEntries(nresEntries as any);

      // Restrict practices to the canonical NRES neighbourhood (by ODS code)
      const { NRES_ODS_CODES } = await import('@/data/nresPractices');
      const nresOds = new Set(Object.values(NRES_ODS_CODES));
      const allPractices = ((prRes.data || []) as any[]) as (Practice & { practice_code?: string })[];
      setPractices(allPractices.filter(p => p.practice_code && nresOds.has(p.practice_code)));
      setTargets(((tRes.data || []) as any) as Target[]);
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to load manager view');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const periodKey: 'week' | 'month' = period === 'this-week' ? 'week' : 'month';

  // Filter entries by period + filters
  const periodEntries = useMemo(() => entries.filter(e => inRange(e.entry_date, range.start, range.end)), [entries, range.start, range.end]);
  const prevPeriodEntries = useMemo(() => entries.filter(e => inRange(e.entry_date, range.prevStart, range.prevEnd)), [entries, range.prevStart, range.prevEnd]);

  const userById = useMemo(() => {
    const m = new Map<string, ProfileLite>();
    for (const u of users) m.set(u.user_id, u);
    return m;
  }, [users]);

  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    users.forEach(u => u.role && set.add(u.role));
    return Array.from(set).sort();
  }, [users]);

  const activityOptions = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => set.add(e.activity));
    return Array.from(set).sort();
  }, [entries]);

  const filteredEntries = useMemo(() => periodEntries.filter(e => {
    const u = userById.get(e.user_id);
    if (filterPractice !== 'all' && e.practice_id !== filterPractice) return false;
    if (filterRole !== 'all' && (u?.role || '') !== filterRole) return false;
    if (filterActivity !== 'all' && e.activity !== filterActivity) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(u?.full_name || '').toLowerCase().includes(q) && !(u?.email || '').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [periodEntries, userById, filterPractice, filterRole, filterActivity, search]);

  // KPIs
  const totalMins = filteredEntries.reduce((s, e) => s + e.minutes, 0);
  const prevTotalMins = prevPeriodEntries.reduce((s, e) => s + e.minutes, 0);
  const delta = prevTotalMins ? ((totalMins - prevTotalMins) / prevTotalMins) * 100 : 0;

  const userIdsWithEntries = new Set(filteredEntries.map(e => e.user_id));

  // "Active NRES users" = users that match role/practice filter (or all if no filter)
  const eligibleUsers = useMemo(() => users.filter(u => {
    if (filterRole !== 'all' && (u.role || '') !== filterRole) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(u.full_name || '').toLowerCase().includes(q) && !(u.email || '').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [users, filterRole, search]);

  const activeCount = eligibleUsers.filter(u => userIdsWithEntries.has(u.user_id)).length;
  const totalEligible = eligibleUsers.length;
  const notLogged = totalEligible - activeCount;

  const userMins = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of filteredEntries) m.set(e.user_id, (m.get(e.user_id) || 0) + e.minutes);
    return m;
  }, [filteredEntries]);

  const meanMins = activeCount ? totalMins / activeCount : 0;
  const sortedMins = Array.from(userMins.values()).sort((a, b) => a - b);
  const medianMins = sortedMins.length
    ? (sortedMins.length % 2 ? sortedMins[(sortedMins.length - 1) / 2] : (sortedMins[sortedMins.length / 2 - 1] + sortedMins[sortedMins.length / 2]) / 2)
    : 0;

  const activityTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of filteredEntries) m.set(e.activity, (m.get(e.activity) || 0) + e.minutes);
    return Array.from(m.entries()).map(([activity, mins]) => ({ activity, mins })).sort((a, b) => b.mins - a.mins);
  }, [filteredEntries]);
  const topActivity = activityTotals[0];

  const behindCount = useMemo(() => eligibleUsers.filter(u => {
    const target = targetForUser(u, periodKey, targets);
    const logged = (userMins.get(u.user_id) || 0) / 60;
    return logged < target * 0.5;
  }).length, [eligibleUsers, periodKey, targets, userMins]);

  // By-user table rows
  const userRows = useMemo(() => {
    return eligibleUsers.map(u => {
      const mins = userMins.get(u.user_id) || 0;
      const userEntries = filteredEntries.filter(e => e.user_id === u.user_id);
      const actMap = new Map<string, number>();
      userEntries.forEach(e => actMap.set(e.activity, (actMap.get(e.activity) || 0) + e.minutes));
      const top = Array.from(actMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
      // Week vs Month
      const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
      const we = endOfWeek(new Date(), { weekStartsOn: 1 });
      const ms = startOfMonth(new Date());
      const me = endOfMonth(new Date());
      let weekMins = 0, monthMins = 0;
      for (const e of entries) {
        if (e.user_id !== u.user_id) continue;
        if (inRange(e.entry_date, ws, we)) weekMins += e.minutes;
        if (inRange(e.entry_date, ms, me)) monthMins += e.minutes;
      }
      const target = targetForUser(u, periodKey, targets);
      const periodHours = mins / 60;
      const behind = periodHours < target * 0.5;
      return { user: u, mins, weekMins, monthMins, top, target, behind };
    }).sort((a, b) => b.mins - a.mins);
  }, [eligibleUsers, userMins, filteredEntries, entries, periodKey, targets]);

  const topContributors = userRows.slice(0, 7);
  const visibleUserRows = showAll ? userRows : userRows.slice(0, 7);

  // By-practice rows
  const practiceRows = useMemo(() => {
    const m = new Map<string, { mins: number; users: Set<string>; activities: Map<string, number> }>();
    for (const e of filteredEntries) {
      const key = e.practice_id || 'unassigned';
      if (!m.has(key)) m.set(key, { mins: 0, users: new Set(), activities: new Map() });
      const r = m.get(key)!;
      r.mins += e.minutes;
      r.users.add(e.user_id);
      r.activities.set(e.activity, (r.activities.get(e.activity) || 0) + e.minutes);
    }
    return Array.from(m.entries()).map(([pid, r]) => ({
      practice: pid === 'unassigned' ? 'Unassigned' : (practices.find(p => p.id === pid)?.name || 'Unknown'),
      practiceId: pid,
      mins: r.mins,
      contributors: r.users.size,
      activities: Array.from(r.activities.entries()).sort((a, b) => b[1] - a[1]),
    })).sort((a, b) => b.mins - a.mins);
  }, [filteredEntries, practices]);

  // Trends — last 12 weeks
  const trendData = useMemo(() => {
    const end = endOfWeek(new Date(), { weekStartsOn: 1 });
    const start = startOfWeek(subWeeks(new Date(), 11), { weekStartsOn: 1 });
    const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
    return weeks.map(w => {
      const ws = startOfWeek(w, { weekStartsOn: 1 });
      const we = endOfWeek(w, { weekStartsOn: 1 });
      let mins = 0;
      for (const e of entries) {
        if (inRange(e.entry_date, ws, we)) mins += e.minutes;
      }
      return { week: format(ws, 'd MMM'), hours: Math.round((mins / 60) * 10) / 10 };
    });
  }, [entries]);

  const weeklyTargetSum = useMemo(() => eligibleUsers.reduce((s, u) => s + targetForUser(u, 'week', targets), 0), [eligibleUsers, targets]);

  const exportCSV = () => {
    const rows: string[][] = [['User', 'Role', 'Practice (entry)', 'Date', 'Activity', 'Duration (hours)', 'Notes', 'Logged By', 'Logged At']];
    for (const e of filteredEntries) {
      const u = userById.get(e.user_id);
      const eb = userById.get(e.entered_by || e.user_id);
      const pname = e.practice_id ? (practices.find(p => p.id === e.practice_id)?.name || '') : '';
      rows.push([
        u?.full_name || u?.email || e.user_id,
        u?.role || '',
        pname,
        e.entry_date,
        e.activity,
        (e.minutes / 60).toFixed(2),
        (e.notes || '').replace(/"/g, '""'),
        eb?.full_name || eb?.email || '',
        e.created_at,
      ]);
    }
    const csv = rows.map(r => r.map(c => /[",\n]/.test(c) ? `"${c}"` : c).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nres-time-${range.label.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
  // Notify parent of summary so the page subtitle can reflect scope
  useEffect(() => {
    if (onSummaryChange) {
      onSummaryChange({ activeCount, totalEligible, practiceCount: practices.length });
    }
  }, [activeCount, totalEligible, practices.length, onSummaryChange]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {hideHeading ? <div /> : (
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900">
            <Users className="w-5 h-5" style={{ color: NHS_BLUE }} />
            NRES Time Tracker — Management View
          </h2>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1 rounded-full bg-stone-100 p-1 text-[13px]">
            {(['this-week', 'this-month', 'last-month', 'custom'] as Period[]).map(p => {
              const active = period === p;
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'rounded-full font-medium transition-all px-3.5 py-1.5',
                    active
                      ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                      : 'bg-transparent text-[#5F5E5A] hover:bg-white/60'
                  )}
                >
                  {p === 'this-week' ? 'This week' : p === 'this-month' ? 'This month' : p === 'last-month' ? 'Last month' : 'Custom'}
                </button>
              );
            })}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-1">
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 w-36 text-xs" />
              <span className="text-xs text-slate-400">→</span>
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-8 w-36 text-xs" />
            </div>
          )}
          <Button size="sm" variant="outline" onClick={exportCSV} className="gap-1">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total hours logged"
          value={`${(totalMins / 60).toFixed(0)}h`}
          sub={prevTotalMins ? `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(0)}% vs prev` : 'No prior data'}
          subTone={delta >= 0 ? 'up' : 'down'}
        />
        <KpiCard
          label="Active users"
          value={`${activeCount} / ${totalEligible}`}
          sub={`${notLogged} not logged · ${behindCount} behind target`}
          subTone={behindCount > 0 ? 'warn' : 'neutral'}
        />
        <KpiCard
          label="Avg hours / user"
          value={`${(meanMins / 60).toFixed(1)}h`}
          sub={`Median ${(medianMins / 60).toFixed(1)}h`}
        />
        <KpiCard
          label="Top activity"
          value={topActivity ? topActivity.activity : '—'}
          sub={topActivity ? `${formatDuration(topActivity.mins)} · ${totalMins ? ((topActivity.mins / totalMins) * 100).toFixed(0) : 0}%` : ''}
        />
      </div>

      {/* Filter bar */}
      <Card className="rounded-lg border border-slate-200">
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <Select value={filterPractice} onValueChange={setFilterPractice}>
            <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue placeholder="Practice" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All practices</SelectItem>
              {practices.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roleOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterActivity} onValueChange={setFilterActivity}>
            <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue placeholder="Activity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All activities</SelectItem>
              {activityOptions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex-1 min-w-[180px] relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search user…"
              className="h-8 pl-7 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sub-tabs */}
      <Tabs defaultValue="by-user">
        <TabsList>
          <TabsTrigger value="by-user">By user</TabsTrigger>
          <TabsTrigger value="by-activity">By activity</TabsTrigger>
          <TabsTrigger value="by-practice">By practice</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="by-user" className="space-y-3">
          {/* Top contributors chart */}
          <Card className="rounded-lg border border-slate-200">
            <CardContent className="p-3">
              <div className="text-xs font-semibold text-slate-500 mb-2">TOP CONTRIBUTORS</div>
              <div style={{ width: '100%', height: Math.max(120, topContributors.length * 32) }}>
                <ResponsiveContainer>
                  <BarChart
                    layout="vertical"
                    data={topContributors.map((r, i) => ({
                      name: r.user.full_name || r.user.email,
                      hours: Math.round((r.mins / 60) * 10) / 10,
                      fill: i < 2 ? NHS_BLUE : i < 4 ? MID_BLUE : LIGHT_BLUE,
                    }))}
                    margin={{ left: 30, right: 30 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                    <Tooltip formatter={(v: any) => `${v}h`} />
                    <Bar dataKey="hours" radius={[3, 3, 3, 3]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* All users table */}
          <Card className="rounded-lg border border-slate-200">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Week</TableHead>
                    <TableHead className="text-right">Month</TableHead>
                    <TableHead>Top activity</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleUserRows.map(row => {
                    const monthTarget = targetForUser(row.user, 'month', targets);
                    const monthHrs = row.monthMins / 60;
                    const behindMonth = monthHrs < monthTarget * 0.5;
                    return (
                      <TableRow
                        key={row.user.user_id}
                        className="cursor-pointer"
                        onClick={() => setDrillUserId(row.user.user_id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700">
                              {(row.user.full_name || row.user.email).slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{row.user.full_name || row.user.email}</div>
                              <div className="text-[11px] text-slate-500">{row.user.role || '—'}</div>
                            </div>
                            {behindMonth && (
                              <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 bg-amber-50" title={`Target ${monthTarget}h, logged ${monthHrs.toFixed(1)}h this month`}>
                                <AlertTriangle className="w-3 h-3 mr-1" /> Behind
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={cn('text-right text-sm', row.behind && periodKey === 'week' && 'text-amber-700 font-semibold')}>
                          {formatDuration(row.weekMins)}
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatDuration(row.monthMins)}</TableCell>
                        <TableCell className="text-sm text-slate-600 truncate max-w-[200px]">{row.top}</TableCell>
                        <TableCell><ChevronRight className="w-4 h-4 text-slate-400" /></TableCell>
                      </TableRow>
                    );
                  })}
                  {userRows.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-slate-500 py-6">No users match the current filters.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              {userRows.length > 7 && (
                <div className="p-2 border-t border-slate-100 text-center">
                  <Button variant="ghost" size="sm" onClick={() => setShowAll(s => !s)}>
                    {showAll ? 'Show fewer' : `Show all ${userRows.length}`}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-activity">
          <Card className="rounded-lg border border-slate-200">
            <CardContent className="p-3">
              <div className="text-xs font-semibold text-slate-500 mb-2">ACTIVITIES</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Contributors</TableHead>
                    <TableHead>Top contributor</TableHead>
                    <TableHead className="text-right">% total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityTotals.map(a => {
                    const ents = filteredEntries.filter(e => e.activity === a.activity);
                    const byUser = new Map<string, number>();
                    ents.forEach(e => byUser.set(e.user_id, (byUser.get(e.user_id) || 0) + e.minutes));
                    const top = Array.from(byUser.entries()).sort((x, y) => y[1] - x[1])[0];
                    const topName = top ? (userById.get(top[0])?.full_name || userById.get(top[0])?.email || '—') : '—';
                    return (
                      <TableRow key={a.activity}>
                        <TableCell className="text-sm">{a.activity}</TableCell>
                        <TableCell className="text-right text-sm">{formatDuration(a.mins)}</TableCell>
                        <TableCell className="text-right text-sm">{byUser.size}</TableCell>
                        <TableCell className="text-sm text-slate-600">{topName}</TableCell>
                        <TableCell className="text-right text-sm">{totalMins ? ((a.mins / totalMins) * 100).toFixed(0) : 0}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-practice">
          <Card className="rounded-lg border border-slate-200">
            <CardContent className="p-3">
              <div className="text-xs font-semibold text-slate-500 mb-2">PRACTICES (FOR PML RECHARGE)</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Practice</TableHead>
                    <TableHead className="text-right">Total hours</TableHead>
                    <TableHead className="text-right">Contributors</TableHead>
                    <TableHead>Top activities</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {practiceRows.map(p => (
                    <TableRow key={p.practiceId}>
                      <TableCell className="text-sm font-medium">{p.practice}</TableCell>
                      <TableCell className="text-right text-sm">{(p.mins / 60).toFixed(1)}h</TableCell>
                      <TableCell className="text-right text-sm">{p.contributors}</TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {p.activities.slice(0, 3).map(([a, m]) => `${a} (${(m / 60).toFixed(1)}h)`).join(' · ')}
                      </TableCell>
                    </TableRow>
                  ))}
                  {practiceRows.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-sm text-slate-500 py-6">No practice-tagged entries in this period.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card className="rounded-lg border border-slate-200">
            <CardContent className="p-3">
              <div className="text-xs font-semibold text-slate-500 mb-2">WEEKLY TOTALS — LAST 12 WEEKS</div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => `${v}h`} />
                    {weeklyTargetSum > 0 && (
                      <ReferenceLine y={weeklyTargetSum} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: `Target ${weeklyTargetSum.toFixed(0)}h`, fontSize: 10, fill: '#64748b' }} />
                    )}
                    <Line type="monotone" dataKey="hours" stroke={NHS_BLUE} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Drill-over panel */}
      <Sheet open={!!drillUserId} onOpenChange={(o) => !o && setDrillUserId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {drillUserId && (
            <DrillUser
              user={userById.get(drillUserId)!}
              currentUserId={user?.id || ''}
              entries={entries.filter(e => e.user_id === drillUserId && inRange(e.entry_date, range.start, range.end))}
              practices={practices}
              userById={userById}
              targets={targets}
              periodKey={periodKey}
              onChanged={loadAll}
              onClose={() => setDrillUserId(null)}
              onLogBehalf={() => setLogBehalfOpen(true)}
              logBehalfOpen={logBehalfOpen}
              setLogBehalfOpen={setLogBehalfOpen}
            />
          )}
        </SheetContent>
      </Sheet>

      {loading && <div className="text-xs text-slate-400 text-center py-2">Loading…</div>}
    </div>
  );
}

function KpiCard({ label, value, sub, subTone = 'neutral' as 'neutral' | 'up' | 'down' | 'warn' }: { label: string; value: string; sub?: string; subTone?: 'neutral' | 'up' | 'down' | 'warn' }) {
  const subColor = subTone === 'up' ? 'text-emerald-700' : subTone === 'down' ? 'text-red-600' : subTone === 'warn' ? 'text-amber-700' : 'text-slate-500';
  return (
    <Card className="rounded-lg border border-slate-200 bg-muted">
      <CardContent className="p-3">
        <div className="text-[13px] text-slate-500 mb-0.5">{label}</div>
        <div className="text-[24px] font-medium text-slate-900 leading-tight truncate" title={value}>{value}</div>
        {sub && <div className={cn('text-[11px] mt-1', subColor)}>{sub}</div>}
      </CardContent>
    </Card>
  );
}

interface DrillUserProps {
  user: ProfileLite;
  currentUserId: string;
  entries: TimeEntry[];
  practices: Practice[];
  userById: Map<string, ProfileLite>;
  targets: Target[];
  periodKey: 'week' | 'month';
  onChanged: () => void;
  onClose: () => void;
  onLogBehalf: () => void;
  logBehalfOpen: boolean;
  setLogBehalfOpen: (b: boolean) => void;
}

function DrillUser({ user, currentUserId, entries, practices, userById, targets, periodKey, onChanged, onLogBehalf, logBehalfOpen, setLogBehalfOpen }: DrillUserProps) {
  const totalMins = entries.reduce((s, e) => s + e.minutes, 0);
  const target = targetForUser(user, periodKey, targets);
  const pct = target ? Math.min(100, (totalMins / 60 / target) * 100) : 0;

  const [editId, setEditId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editActivity, setEditActivity] = useState('');
  const [editMinutes, setEditMinutes] = useState(60);
  const [editNotes, setEditNotes] = useState('');
  const [editPractice, setEditPractice] = useState<string>('');

  const beginEdit = (e: TimeEntry) => {
    setEditId(e.id);
    setEditDate(e.entry_date);
    setEditActivity(e.activity);
    setEditMinutes(e.minutes);
    setEditNotes(e.notes || '');
    setEditPractice(e.practice_id || '');
  };

  const saveEdit = async () => {
    if (!editId) return;
    const { error } = await supabase.from('nres_time_entries' as any).update({
      entry_date: editDate,
      activity: editActivity.trim(),
      minutes: editMinutes,
      notes: editNotes.trim() || null,
      practice_id: editPractice || null,
    }).eq('id', editId);
    if (error) { toast.error(error.message); return; }
    toast.success('Entry updated');
    setEditId(null);
    onChanged();
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    const { error } = await supabase.from('nres_time_entries' as any).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Entry deleted');
    onChanged();
  };

  // Log on behalf form
  const [behalfDate, setBehalfDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [behalfActivity, setBehalfActivity] = useState('');
  const [behalfMinutes, setBehalfMinutes] = useState(60);
  const [behalfNotes, setBehalfNotes] = useState('');
  const [behalfPractice, setBehalfPractice] = useState('');
  const [behalfSaving, setBehalfSaving] = useState(false);

  const saveBehalf = async () => {
    if (!behalfActivity.trim()) { toast.error('Activity required'); return; }
    setBehalfSaving(true);
    try {
      const { error } = await supabase.from('nres_time_entries' as any).insert({
        user_id: user.user_id,
        entered_by: currentUserId,
        entry_date: behalfDate,
        activity: behalfActivity.trim(),
        minutes: behalfMinutes,
        notes: behalfNotes.trim() || null,
        practice_id: behalfPractice || null,
      });
      if (error) throw error;
      toast.success(`Logged ${formatDuration(behalfMinutes)} for ${user.full_name}`);
      setBehalfActivity(''); setBehalfNotes(''); setBehalfMinutes(60); setBehalfPractice('');
      setLogBehalfOpen(false);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
    } finally { setBehalfSaving(false); }
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-700">
            {(user.full_name || user.email).slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-base">{user.full_name || user.email}</div>
            <div className="text-xs font-normal text-slate-500">{user.role || '—'} · {user.email}</div>
          </div>
        </SheetTitle>
      </SheetHeader>

      <div className="mt-4 space-y-3">
        <Card className="bg-muted">
          <CardContent className="p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Period total</span>
              <span className="font-semibold">{formatDuration(totalMins)} / {target}h target</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={cn('h-full transition-all', pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500')}
                style={{ width: `${pct}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={() => setLogBehalfOpen(!logBehalfOpen)} variant="outline" className="w-full gap-2">
          <Plus className="w-4 h-4" /> {logBehalfOpen ? 'Cancel' : 'Log on behalf'}
        </Button>

        {logBehalfOpen && (
          <Card className="border-blue-300 bg-blue-50/50">
            <CardContent className="p-3 space-y-2">
              <div className="text-xs font-semibold text-blue-900">Logging on behalf of {user.full_name || user.email}</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={behalfDate} onChange={e => setBehalfDate(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Minutes</Label>
                  <Input type="number" min={5} max={600} step={5} value={behalfMinutes} onChange={e => setBehalfMinutes(Number(e.target.value))} className="h-8 text-xs" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Activity</Label>
                <Input value={behalfActivity} onChange={e => setBehalfActivity(e.target.value)} className="h-8 text-xs" placeholder="e.g. Programme Board / Governance" />
              </div>
              <div>
                <Label className="text-xs">Practice (optional)</Label>
                <Select value={behalfPractice || 'none'} onValueChange={(v) => setBehalfPractice(v === 'none' ? '' : v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {practices.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea value={behalfNotes} onChange={e => setBehalfNotes(e.target.value)} rows={2} className="text-xs" />
              </div>
              <Button onClick={saveBehalf} disabled={behalfSaving} className="w-full">
                {behalfSaving ? 'Saving…' : 'Save entry'}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="text-xs font-semibold text-slate-500 pt-2">ENTRIES IN PERIOD ({entries.length})</div>
        <div className="space-y-2">
          {entries.length === 0 && <div className="text-sm text-slate-500 italic">No entries in this period.</div>}
          {entries.map(e => {
            const eb = e.entered_by && e.entered_by !== e.user_id ? userById.get(e.entered_by) : null;
            const isEditing = editId === e.id;
            return (
              <Card key={e.id} className="border border-slate-200">
                <CardContent className="p-3">
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input type="date" value={editDate} onChange={ev => setEditDate(ev.target.value)} className="h-8 text-xs" />
                        <Input type="number" min={5} step={5} value={editMinutes} onChange={ev => setEditMinutes(Number(ev.target.value))} className="h-8 text-xs" />
                      </div>
                      <Input value={editActivity} onChange={ev => setEditActivity(ev.target.value)} className="h-8 text-xs" />
                      <Select value={editPractice || 'none'} onValueChange={(v) => setEditPractice(v === 'none' ? '' : v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Practice" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {practices.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Textarea value={editNotes} onChange={ev => setEditNotes(ev.target.value)} rows={2} className="text-xs" />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit} className="flex-1">Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-slate-500">{format(parseISO(e.entry_date), 'EEE d MMM yyyy')} · {formatDuration(e.minutes)}</div>
                          <div className="text-sm font-medium">{e.activity}</div>
                          {e.notes && <div className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap">{e.notes}</div>}
                          {eb && (
                            <Badge variant="outline" className="mt-1 text-[10px] border-blue-300 text-blue-700 bg-blue-50">
                              Logged by {eb.full_name || eb.email}
                            </Badge>
                          )}
                          {e.practice_id && (
                            <span className="text-[10px] text-slate-500 ml-2">{practices.find(p => p.id === e.practice_id)?.name}</span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => beginEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => deleteEntry(e.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
