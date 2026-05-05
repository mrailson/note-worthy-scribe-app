import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { format, addDays, startOfMonth, endOfMonth, isSameDay, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Clock, ChevronLeft, Trash2, Plus, X, Download, Settings2 } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Slider } from '@/components/ui/slider';
import { formatDuration } from '@/utils/formatDuration';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const DEFAULT_ACTIVITIES = [
  'Programme Board / Governance',
  'MoU & Standing Orders',
  'Buy-back Claims Processing',
  'Stakeholder Meeting (PML)',
  'Stakeholder Meeting (ICB)',
  'LTC Part B Workstream',
  'ENN Pilot Site',
  'Documentation / Briefing',
  'Email & Admin',
  'Strategy & Planning',
];

const DURATION_OPTIONS = [5, 10, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240];

interface Activity { id: string; label: string; is_default: boolean; sort_order: number; }
interface Entry {
  id: string; entry_date: string; activity: string; minutes: number;
  notes: string | null; created_at: string;
}

const NRESTimeTracker = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [notes, setNotes] = useState('');
  const [manageMode, setManageMode] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [newActivityLabel, setNewActivityLabel] = useState('');
  const [saving, setSaving] = useState(false);

  // Last 10 days
  const dateStrip = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 10 }, (_, i) => addDays(today, -i));
  }, []);

  const loadAll = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let { data: acts, error: aErr } = await (supabase as any)
        .from('nres_user_activities').select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (aErr) throw aErr;

      if (!acts || acts.length === 0) {
        const seed = DEFAULT_ACTIVITIES.map((label, i) => ({
          user_id: user.id, label, is_default: true, sort_order: i,
        }));
        const { data: inserted, error: iErr } = await (supabase as any)
          .from('nres_user_activities').insert(seed).select();
        if (iErr) throw iErr;
        acts = inserted;
      }
      setActivities(acts || []);

      const { data: ents, error: eErr } = await (supabase as any)
        .from('nres_time_entries').select('*')
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (eErr) throw eErr;
      setEntries(ents || []);
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to load tracker data');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Totals
  const { weekTotal, monthTotal } = useMemo(() => {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - dayOfWeek); weekStart.setHours(0,0,0,0);
    const monthStart = startOfMonth(now);
    let w = 0, m = 0;
    for (const e of entries) {
      const d = parseISO(e.entry_date);
      if (d >= monthStart) m += e.minutes;
      if (d >= weekStart) w += e.minutes;
    }
    return { weekTotal: w, monthTotal: m };
  }, [entries]);

  const handleSave = async () => {
    if (!user?.id || !selectedActivity) return;
    if (selectedDate > new Date()) { toast.error('Date cannot be in the future'); return; }
    if (selectedDuration < 5 || selectedDuration > 240 || selectedDuration % 5 !== 0) {
      toast.error('Duration must be between 5 and 180 minutes'); return;
    }
    setSaving(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data, error } = await (supabase as any).from('nres_time_entries').insert({
        user_id: user.id, entry_date: dateStr, activity: selectedActivity,
        minutes: selectedDuration, notes: notes.trim() || null,
      }).select().single();
      if (error) throw error;
      setEntries(prev => [data, ...prev]);
      toast.success(`Logged ${formatDuration(selectedDuration)} for ${format(selectedDate, 'd MMM')}`);
      setSelectedActivity(''); setNotes(''); setSelectedDuration(60);
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      const { error } = await (supabase as any).from('nres_time_entries').delete().eq('id', id);
      if (error) throw error;
      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success('Entry deleted');
    } catch (e: any) { toast.error('Delete failed'); }
  };

  const handleAddActivity = async () => {
    const label = newActivityLabel.trim();
    if (!user?.id) return;
    if (!label) { toast.error('Activity label required'); return; }
    if (label.length > 80) { toast.error('Max 80 characters'); return; }
    if (activities.some(a => a.label.toLowerCase() === label.toLowerCase())) {
      toast.error('Activity already exists'); return;
    }
    try {
      const { data, error } = await (supabase as any)
        .from('nres_user_activities')
        .insert({ user_id: user.id, label, is_default: false, sort_order: activities.length })
        .select().single();
      if (error) throw error;
      setActivities(prev => [...prev, data]);
      setNewActivityLabel(''); setShowAddActivity(false);
      toast.success('Activity added');
    } catch (e: any) { toast.error('Failed to add activity'); }
  };

  const handleDeleteActivity = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('nres_user_activities').delete().eq('id', id);
      if (error) throw error;
      setActivities(prev => prev.filter(a => a.id !== id));
    } catch { toast.error('Failed to delete'); }
  };

  // Exports — current month
  const monthEntries = useMemo(() => {
    const ms = startOfMonth(new Date()); const me = endOfMonth(new Date());
    return entries.filter(e => {
      const d = parseISO(e.entry_date); return d >= ms && d <= me;
    }).slice().sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  }, [entries]);

  const monthLabel = format(new Date(), 'yyyy-MM');
  const fileBase = `nres-time-${monthLabel}-${user?.email || 'user'}`;

  const exportCSV = () => {
    const rows: string[][] = [['Date', 'Day', 'Activity', 'Duration (mins)', 'Duration (hh:mm)', 'Notes']];
    let total = 0;
    const byAct: Record<string, number> = {};
    for (const e of monthEntries) {
      const d = parseISO(e.entry_date);
      rows.push([e.entry_date, format(d, 'EEE'), e.activity, String(e.minutes), formatDuration(e.minutes), (e.notes || '').replace(/"/g, '""')]);
      total += e.minutes;
      byAct[e.activity] = (byAct[e.activity] || 0) + e.minutes;
    }
    rows.push(['', '', '', 'Total', String(total), formatDuration(total), '']);
    rows.push(['', '', '', 'Activities:', '', '', '']);
    for (const [act, mins] of Object.entries(byAct)) {
      rows.push(['', '', act, String(mins), formatDuration(mins), '', '']);
    }
    const csv = rows.map(r => r.map(c => /[",\n]/.test(c) ? `"${c}"` : c).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${fileBase}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const monthStr = format(new Date(), 'MMMM yyyy');
    doc.setFontSize(16);
    doc.text(`NRES Time Recording — ${monthStr}`, 14, 18);
    doc.setFontSize(10);
    doc.text(`${user?.email || ''}`, 14, 26);
    doc.text(`Generated: ${format(new Date(), 'd MMM yyyy HH:mm')}`, 14, 32);

    const total = monthEntries.reduce((s, e) => s + e.minutes, 0);
    const byAct: Record<string, number> = {};
    monthEntries.forEach(e => { byAct[e.activity] = (byAct[e.activity] || 0) + e.minutes; });

    autoTable(doc, {
      startY: 40,
      head: [['Activity', 'Total time', '% of month']],
      body: Object.entries(byAct).map(([a, m]) => [
        a, formatDuration(m), total ? `${((m / total) * 100).toFixed(1)}%` : '0%',
      ]),
      headStyles: { fillColor: [5, 150, 105] },
    });

    autoTable(doc, {
      head: [['Date', 'Activity', 'Duration', 'Notes']],
      body: monthEntries.map(e => [
        format(parseISO(e.entry_date), 'dd/MM/yyyy'),
        e.activity, formatDuration(e.minutes), e.notes || '',
      ]),
      headStyles: { fillColor: [5, 150, 105] },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i); doc.setFontSize(8);
      doc.text(`Notewell AI — NRES Dashboard   Page ${i} of ${pageCount}`, 14, doc.internal.pageSize.height - 8);
    }
    doc.save(`${fileBase}.pdf`);
  };

  const dayLabel = (d: Date) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const cmp = new Date(d); cmp.setHours(0,0,0,0);
    const diff = (today.getTime() - cmp.getTime()) / 86400000;
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return format(d, 'EEE');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <Link to="/nres" className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Back to NRES
          </Link>
        </div>

        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" /> NRES Time Tracker
          </h1>
          <p className="text-sm text-slate-500">Quick entry for monthly claims</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="rounded-xl border-2 border-slate-200">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">This Week</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{formatDuration(weekTotal)}</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-2 border-emerald-700 bg-emerald-600 text-white">
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-emerald-100">This Month</div>
              <div className="text-2xl font-bold mt-1">{formatDuration(monthTotal)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Date strip */}
        <Card className="rounded-xl border-2 border-slate-200">
          <CardContent className="p-3">
            <div className="text-xs font-medium text-slate-500 mb-2">DATE</div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {dateStrip.map(d => {
                const active = isSameDay(d, selectedDate);
                return (
                  <button key={d.toISOString()} onClick={() => setSelectedDate(d)}
                    className={`shrink-0 rounded-lg px-3 py-2 text-center min-w-[64px] border-2 transition ${
                      active ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-white border-slate-200 text-slate-700'
                    }`}>
                    <div className={`text-[10px] uppercase font-medium ${active ? 'text-emerald-100' : 'text-slate-500'}`}>{dayLabel(d)}</div>
                    <div className="text-lg font-bold leading-none">{format(d, 'd')}</div>
                    <div className={`text-[10px] ${active ? 'text-emerald-100' : 'text-slate-500'}`}>{format(d, 'MMM')}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Activity picker */}
        <Card className="rounded-xl border-2 border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-slate-500">ACTIVITY</div>
              <button onClick={() => setManageMode(m => !m)}
                className="text-xs text-emerald-700 inline-flex items-center gap-1">
                <Settings2 className="w-3 h-3" /> {manageMode ? 'Done' : 'Manage'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {activities.map(a => {
                const active = selectedActivity === a.label;
                return (
                  <div key={a.id} className="relative">
                    <button onClick={() => !manageMode && setSelectedActivity(a.label)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm border-2 transition ${
                        active ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-white border-slate-200 text-slate-700'
                      }`}>
                      {a.label}
                    </button>
                    {manageMode && (
                      <button onClick={() => handleDeleteActivity(a.id)}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
              {!showAddActivity ? (
                <button onClick={() => setShowAddActivity(true)}
                  className="rounded-lg px-3 py-2 text-sm border-2 border-dashed border-slate-300 text-slate-500 hover:bg-slate-100 inline-flex items-center justify-center gap-1">
                  <Plus className="w-4 h-4" /> Add activity
                </button>
              ) : (
                <div className="col-span-2 flex gap-2">
                  <Input autoFocus value={newActivityLabel}
                    onChange={e => setNewActivityLabel(e.target.value)}
                    placeholder="New activity label" maxLength={80}
                    onKeyDown={e => e.key === 'Enter' && handleAddActivity()} />
                  <Button onClick={handleAddActivity} className="bg-emerald-600 hover:bg-emerald-700">Add</Button>
                  <Button variant="outline" onClick={() => { setShowAddActivity(false); setNewActivityLabel(''); }}>Cancel</Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Duration */}
        <DurationPicker selectedDuration={selectedDuration} setSelectedDuration={setSelectedDuration} />

        {/* Notes */}
        <Card className="rounded-xl border-2 border-slate-200">
          <CardContent className="p-3 space-y-2">
            <div className="text-xs font-medium text-slate-500">NOTES (OPTIONAL)</div>
            <Input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. v6 MoU review with Mark Gray" />
          </CardContent>
        </Card>

        {/* Save */}
        <Button disabled={!selectedActivity || saving} onClick={handleSave}
          className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base">
          {selectedActivity
            ? `Log ${formatDuration(selectedDuration)} — ${selectedActivity}`
            : 'Select an activity to log'}
        </Button>

        {/* Recent entries */}
        <Card className="rounded-xl border-2 border-slate-200">
          <CardHeader className="flex-row items-center justify-between space-y-0 p-3 pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Recent entries</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Download className="w-3 h-3 mr-1" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportCSV}>Export CSV (this month)</DropdownMenuItem>
                <DropdownMenuItem onClick={exportPDF}>Export PDF (this month)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent className="p-0">
            {loading && <div className="p-4 text-sm text-slate-500">Loading…</div>}
            {!loading && entries.length === 0 && (
              <div className="p-4 text-sm text-slate-500">No entries yet.</div>
            )}
            <ul className="divide-y divide-slate-100">
              {entries.slice(0, 50).map(e => (
                <li key={e.id} className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{e.activity}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {format(parseISO(e.entry_date), 'EEE d MMM')}{e.notes ? ` · ${e.notes}` : ''}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-700 shrink-0">{formatDuration(e.minutes)}</div>
                  <button onClick={() => handleDeleteEntry(e.id)} className="text-slate-400 hover:text-red-600 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NRESTimeTracker;

const DurationPicker = ({ selectedDuration, setSelectedDuration }: { selectedDuration: number; setSelectedDuration: (n: number) => void }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const idx = DURATION_OPTIONS.indexOf(selectedDuration);
  // pick visible range: prefer current as middle, show ±2
  const safeIdx = idx >= 0 ? idx : DURATION_OPTIONS.findIndex(o => o >= selectedDuration);
  const start = Math.max(0, Math.min(DURATION_OPTIONS.length - 5, (safeIdx < 0 ? 0 : safeIdx) - 2));
  const visible = DURATION_OPTIONS.slice(start, start + 5);

  return (
    <Card className="rounded-xl border-2 border-slate-200">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-slate-500">DURATION</div>
          <div className="text-sm font-semibold text-emerald-700">{formatDuration(selectedDuration)}</div>
        </div>
        <div ref={scrollRef} className="flex gap-2 justify-center pb-1">
          {visible.map(m => {
            const active = selectedDuration === m;
            return (
              <button key={m} onClick={() => setSelectedDuration(m)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium border-2 transition ${
                  active ? 'bg-emerald-600 border-emerald-700 text-white scale-110' : 'bg-white border-slate-200 text-slate-700'
                }`}>
                {formatDuration(m)}
              </button>
            );
          })}
        </div>
        <div className="px-1 pt-1">
          <Slider
            min={5}
            max={180}
            step={5}
            value={[selectedDuration]}
            onValueChange={(v) => setSelectedDuration(v[0])}
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>5m</span><span>1h</span><span>2h</span><span>3h</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

