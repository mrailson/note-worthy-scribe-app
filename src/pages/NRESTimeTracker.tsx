import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, startOfMonth, endOfMonth, isSameDay, parseISO, subMonths, eachDayOfInterval, getDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Clock, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Trash2, Plus, X, Download, Settings2, Paperclip, ArrowLeftRight, CalendarDays, CalendarRange, Pencil, FileText, Activity as ActivityIcon, Timer, MoreHorizontal } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { TimeEntryAttachmentsModal } from '@/components/nres/time-tracker/TimeEntryAttachmentsModal';
import { useTimeEntryAttachmentCounts, useNRESTimeEntryAttachments } from '@/hooks/useNRESTimeEntryAttachments';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { Slider } from '@/components/ui/slider';
import { formatDuration } from '@/utils/formatDuration';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import nresLogoUrl from '@/assets/nres-logo.png';
import { Mic, MicOff, Users } from 'lucide-react';
import { BrowserSpeechRecognition } from '@/utils/BrowserSpeechRecognition';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useIsNRESVerifier } from '@/hooks/useIsNRESVerifier';
import { NRESTimeManagerView } from '@/components/nres/time-tracker/NRESTimeManagerView';

const DEFAULT_ACTIVITIES = [
  'Programme Board / Governance',
  'MoU & Standing Orders',
  'Buy-back Claims Processing',
  'Stakeholder Meeting (PML)',
  'Stakeholder Meeting (ICB)',
  'Practice / PCN Liaison',
  'Documentation / Briefing',
  'Reporting & Evidence',
  'Email & Admin',
  'Strategy & Planning',
];

const DURATION_OPTIONS = [5, 10, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240];

type CategoryT = 'general' | 'part_b';

const PART_B_COHORTS = ['COPD', 'Heart failure', 'Housebound', 'Palliative', 'Frailty', 'Multimorbidity', 'LD / MH', 'Other'];

// Universal Part B defaults — same for everyone (role concept removed)
const PART_B_DEFAULTS = [
  'Part B MDT',
  'Complex patient review',
  'Housebound review',
  'Discharge follow-up',
  'ReSPECT / palliative',
  'LTC 30-min appointment',
  'Audit / cohort prep',
  'Part B planning meeting',
  'Buy-back / claims admin',
  'Briefing / documentation',
];

interface Activity { id: string; label: string; is_default: boolean; sort_order: number; category?: CategoryT; user_id?: string; }
interface Entry {
  id: string; entry_date: string; activity: string; minutes: number;
  notes: string | null; created_at: string;
  user_id?: string; entered_by?: string | null; practice_id?: string | null;
  category?: CategoryT; cohort?: string | null;
  on_behalf_of_name?: string | null;
  logged_by?: string | null;
}

interface Colleague {
  user_id: string;
  display_name: string | null;
  staff_role: string | null;
  practice_id: string | null;
  practice_name: string | null;
}

type LogTarget = { id: string; name: string } | null; // null = self

const NRESTimeTracker = ({ embedded = false }: { embedded?: boolean } = {}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [attachmentEntry, setAttachmentEntry] = useState<Entry | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const pendingInputRef = useRef<HTMLInputElement | null>(null);
  const [activityOpen, setActivityOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editActivity, setEditActivity] = useState('');
  const [editMinutes, setEditMinutes] = useState(60);
  const [editNotes, setEditNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const { uploadFile: uploadStandalone } = useNRESTimeEntryAttachments(undefined);

  // Part B state
  const [category, setCategory] = useState<CategoryT>('general');
  const [cohort, setCohort] = useState<string | null>(null);
  const [cohortOther, setCohortOther] = useState('');
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Log-for picker state
  const [logFor, setLogFor] = useState<LogTarget>(null); // null = self
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [colleagueActivities, setColleagueActivities] = useState<Activity[]>([]);
  const targetUserId = logFor?.id || user?.id;
  const isSelf = !logFor;

  const visibleActivities = useMemo(() => {
    const src = isSelf ? activities : colleagueActivities;
    const filtered = src.filter(a => (a.category || 'general') === category);
    // Fallback: if the target user has no activities for this category yet,
    // surface the universal defaults so the picker is never empty.
    if (filtered.length === 0) {
      const defaults = category === 'part_b' ? PART_B_DEFAULTS : DEFAULT_ACTIVITIES;
      return defaults.map((label, i) => ({
        id: `virtual-${category}-${i}`,
        user_id: targetUserId || '',
        label,
        is_default: true,
        sort_order: i,
        category,
      })) as Activity[];
    }
    return filtered;
  }, [activities, colleagueActivities, isSelf, category, targetUserId]);
  const recentEntries = useMemo(
    () => entries.filter(e => (e.category || 'general') === category).slice(0, 50),
    [entries, category]
  );
  const { counts: attachmentCounts, refresh: refreshCounts } = useTimeEntryAttachmentCounts(recentEntries.map(e => e.id));

  // Discreet voice-to-text for notes (native Web Speech API for instant real-time)
  const [micRecording, setMicRecording] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const notesBaseRef = useRef('');
  const finalSegmentsRef = useRef<string>('');
  const notesElRef = useRef<HTMLTextAreaElement | null>(null);
  const autoGrowNotes = useCallback(() => {
    requestAnimationFrame(() => {
      const el = notesElRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  const stopMic = useCallback(() => {
    try { recognitionRef.current?.stopRecognition(); } catch {}
    recognitionRef.current = null;
    setMicRecording(false);
  }, []);

  const startMic = useCallback(async () => {
    if (micRecording) return;

    // Capability check
    const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    if (!supported) {
      toast.error('Voice input requires Chrome or Edge');
      return;
    }

    notesBaseRef.current = notes ? notes.replace(/\s+$/, '') : '';
    finalSegmentsRef.current = '';

    const rec = new BrowserSpeechRecognition(
      ({ text, isFinal }) => {
        if (isFinal) {
          // Append final segment permanently
          finalSegmentsRef.current = (finalSegmentsRef.current + ' ' + text).replace(/\s+/g, ' ').trim();
          const base = notesBaseRef.current;
          const merged = (base ? base + ' ' : '') + finalSegmentsRef.current;
          setNotes(merged);
          autoGrowNotes();
        } else {
          // Live interim — show base + finals so far + interim
          const base = notesBaseRef.current;
          const finals = finalSegmentsRef.current;
          const live = [base, finals, text].filter(Boolean).join(' ').replace(/\s+/g, ' ');
          setNotes(live);
          autoGrowNotes();
        }
      },
      (err) => {
        console.error('Speech error:', err);
        if (err && !/no-speech|aborted/i.test(err)) {
          toast.error(err);
        }
        stopMic();
      },
      (status) => {
        if (status === 'listening') setMicRecording(true);
        if (status === 'stopped' || status === 'ended') setMicRecording(false);
      }
    );

    recognitionRef.current = rec;
    setMicRecording(true);
    try {
      await rec.startRecognition();
    } catch (err) {
      console.error('Failed to start voice input:', err);
      toast.error('Could not start voice input');
      stopMic();
    }
  }, [notes, micRecording, stopMic, autoGrowNotes]);

  useEffect(() => () => { try { recognitionRef.current?.stopRecognition(); } catch {} }, []);


  const draftKey = user?.id ? `nres-time-draft:${user.id}` : null;
  const draftLoadedRef = useRef(false);

  // Restore draft once user is known
  useEffect(() => {
    if (!draftKey || draftLoadedRef.current) return;
    draftLoadedRef.current = true;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.selectedDate) setSelectedDate(new Date(d.selectedDate));
      if (d.selectedActivity) setSelectedActivity(d.selectedActivity);
      if (typeof d.selectedDuration === 'number') setSelectedDuration(d.selectedDuration);
      if (typeof d.notes === 'string') setNotes(d.notes);
      if (Array.isArray(d.pendingFiles) && d.pendingFiles.length) {
        const restored: File[] = d.pendingFiles.map((f: any) => {
          const bin = atob(f.data);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          return new File([arr], f.name, { type: f.type });
        });
        setPendingFiles(restored);
      }
    } catch (e) { console.warn('draft restore failed', e); }
  }, [draftKey]);

  // Persist draft as it changes
  useEffect(() => {
    if (!draftKey || !draftLoadedRef.current) return;
    const hasContent = selectedActivity || notes.trim() || pendingFiles.length > 0;
    if (!hasContent) { localStorage.removeItem(draftKey); return; }
    const writeDraft = async () => {
      try {
        const filesPayload: any[] = [];
        let total = 0;
        for (const f of pendingFiles) {
          if (total + f.size > 3_500_000) break; // ~3.5MB cap
          const buf = await f.arrayBuffer();
          let bin = '';
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          filesPayload.push({ name: f.name, type: f.type, data: btoa(bin) });
          total += f.size;
        }
        localStorage.setItem(draftKey, JSON.stringify({
          selectedDate: selectedDate.toISOString(),
          selectedActivity, selectedDuration, notes,
          pendingFiles: filesPayload,
        }));
      } catch (e) { console.warn('draft save failed', e); }
    };
    writeDraft();
  }, [draftKey, selectedDate, selectedActivity, selectedDuration, notes, pendingFiles]);

  // Date strip controls
  const [dateReversed, setDateReversed] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = last 7 days, 1 = previous 7, etc.
  const [showMonth, setShowMonth] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, 1 = previous

  const dateStrip = useMemo(() => {
    const today = new Date();
    const start = addDays(today, -7 * weekOffset);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, -i));
    return dateReversed ? [...days].reverse() : days;
  }, [dateReversed, weekOffset]);

  const monthDays = useMemo(() => {
    const anchor = subMonths(new Date(), monthOffset);
    const start = startOfMonth(anchor);
    const end = endOfMonth(anchor);
    return { anchor, days: eachDayOfInterval({ start, end }), leadingBlanks: (getDay(start) + 6) % 7 };
  }, [monthOffset]);

  const seedPartBDefaults = useCallback(async (existingActs: Activity[]): Promise<Activity[]> => {
    if (!user?.id) return [];
    const existingLabels = new Set(
      existingActs.filter(a => (a.category || 'general') === 'part_b').map(a => a.label.toLowerCase())
    );
    const toInsert = PART_B_DEFAULTS
      .filter(l => !existingLabels.has(l.toLowerCase()))
      .map((label, i) => ({
        user_id: user.id, label, is_default: true,
        sort_order: existingActs.length + i,
        category: 'part_b' as const,
      }));
    if (toInsert.length === 0) return [];
    const { data: inserted, error } = await (supabase as any)
      .from('nres_user_activities').insert(toInsert).select();
    if (error) { console.error(error); toast.error('Failed to seed Part B activities'); return []; }
    return (inserted as Activity[]) || [];
  }, [user?.id]);

  const loadAll = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let { data: acts, error: aErr } = await (supabase as any)
        .from('nres_user_activities').select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (aErr) throw aErr;

      if (!acts || acts.length === 0) {
        const seed = DEFAULT_ACTIVITIES.map((label, i) => ({
          user_id: user.id, label, is_default: true, sort_order: i, category: 'general',
        }));
        const { data: inserted, error: iErr } = await (supabase as any)
          .from('nres_user_activities').insert(seed).select();
        if (iErr) throw iErr;
        acts = inserted;
      }
      setActivities(acts || []);

      // Profile (last_category + last_logged_for)
      const { data: prof } = await (supabase as any)
        .from('nres_user_profile').select('*').eq('user_id', user.id).maybeSingle();
      if (prof) {
        setCategory((prof.last_category as CategoryT) || 'general');
      }
      setProfileLoaded(true);

      // Entries: where I am the time-owner OR where I logged it
      const { data: ents, error: eErr } = await (supabase as any)
        .from('nres_time_entries').select('*')
        .or(`user_id.eq.${user.id},logged_by.eq.${user.id}`)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (eErr) throw eErr;
      setEntries(ents || []);

      // Practice colleagues
      const { data: cols } = await (supabase as any).rpc('get_nres_practice_colleagues');
      setColleagues((cols as Colleague[]) || []);
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to load tracker data');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Auto-seed Part B defaults the first time a user lands on Part B with no part_b activities
  useEffect(() => {
    if (!profileLoaded || category !== 'part_b' || !isSelf) return;
    const hasPartB = activities.some(a => (a.category || 'general') === 'part_b');
    if (hasPartB) return;
    seedPartBDefaults(activities).then(inserted => {
      if (inserted.length > 0) setActivities(prev => [...prev, ...inserted]);
    });
  }, [profileLoaded, category, isSelf, activities, seedPartBDefaults]);

  // Load colleague's activities (read-only) when target changes
  useEffect(() => {
    if (isSelf) { setColleagueActivities([]); return; }
    const colleagueId = logFor?.id;
    if (!colleagueId) return;
    (async () => {
      const { data, error } = await (supabase as any)
        .from('nres_user_activities').select('*')
        .eq('user_id', colleagueId)
        .order('sort_order', { ascending: true });
      if (error) { console.error(error); setColleagueActivities([]); return; }
      setColleagueActivities((data as Activity[]) || []);
    })();
  }, [isSelf, logFor?.id]);

  // Persist last_category when user switches tabs
  const persistCategory = useCallback(async (next: CategoryT) => {
    if (!user?.id) return;
    try {
      await (supabase as any).from('nres_user_profile').upsert({
        user_id: user.id, last_category: next,
      }, { onConflict: 'user_id' });
    } catch (e) { console.warn('persist category failed', e); }
  }, [user?.id]);

  const handleCategoryChange = useCallback((next: CategoryT) => {
    setCategory(next);
    setSelectedActivity('');
    setCohort(null); setCohortOther('');
    persistCategory(next);
  }, [persistCategory]);

  const persistLastLoggedFor = useCallback(async (colleagueId: string | null) => {
    if (!user?.id || !colleagueId) return;
    try {
      await (supabase as any).from('nres_user_profile').upsert({
        user_id: user.id, last_logged_for: colleagueId,
      }, { onConflict: 'user_id' });
    } catch (e) { console.warn('persist last_logged_for failed', e); }
  }, [user?.id]);

  const selectLogTarget = useCallback((target: LogTarget) => {
    setLogFor(target);
    setSelectedActivity('');
    setPickerOpen(false);
    setPickerSearch('');
    if (target?.id) persistLastLoggedFor(target.id);
  }, [persistLastLoggedFor]);



  // Totals
  const { weekTotal, monthTotal, lastMonthTotal } = useMemo(() => {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - dayOfWeek); weekStart.setHours(0,0,0,0);
    const monthStart = startOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));
    let w = 0, m = 0, lm = 0;
    for (const e of entries) {
      if (e.user_id !== user?.id) continue; // exclude entries logged on behalf of others
      const eCat = (e.category || 'general');
      if (eCat !== category) continue; // only count totals for the active category (General / Part B)
      const d = parseISO(e.entry_date);
      if (d >= monthStart) m += e.minutes;
      if (d >= weekStart) w += e.minutes;
      if (d >= lastMonthStart && d <= lastMonthEnd) lm += e.minutes;
    }
    return { weekTotal: w, monthTotal: m, lastMonthTotal: lm };
  }, [entries, user?.id, category]);

  // Note suggestions: recent unique (last 5) then most-frequent (not already shown)
  const noteSuggestions = useMemo(() => {
    const cleanedAll = entries
      .map(e => (e.notes || '').trim())
      .filter(Boolean);
    if (cleanedAll.length === 0) return [] as string[];

    const recent: string[] = [];
    const seen = new Set<string>();
    for (const n of cleanedAll) {
      const key = n.toLowerCase();
      if (!seen.has(key)) { seen.add(key); recent.push(n); }
      if (recent.length >= 5) break;
    }

    const freq = new Map<string, { label: string; count: number }>();
    for (const n of cleanedAll) {
      const key = n.toLowerCase();
      const existing = freq.get(key);
      if (existing) existing.count += 1;
      else freq.set(key, { label: n, count: 1 });
    }
    const top = Array.from(freq.values())
      .filter(x => x.count >= 2 && !seen.has(x.label.toLowerCase()))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(x => x.label);

    return [...recent, ...top].slice(0, 10);
  }, [entries]);

  const handleSave = async () => {
    if (!user?.id || !selectedActivity) return;
    if (selectedDate > new Date()) { toast.error('Date cannot be in the future'); return; }
    const maxDuration = category === 'part_b' ? 500 : 240;
    if (selectedDuration < 5 || selectedDuration > maxDuration || selectedDuration % 5 !== 0) {
      toast.error(`Duration must be between 5 and ${maxDuration} minutes`); return;
    }
    setSaving(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const resolvedCohort = category === 'part_b'
        ? (cohort === 'Other' ? (cohortOther.trim().slice(0, 40) || null) : cohort)
        : null;
      const ownerId = logFor?.id || user.id;
      let ownerPracticeId: string | null = null;
      try {
        const { data: pids } = await supabase.rpc('get_user_practice_ids', { p_user_id: ownerId });
        if (pids && pids.length > 0) ownerPracticeId = pids[0];
      } catch {}
      const { data, error } = await (supabase as any).from('nres_time_entries').insert({
        user_id: ownerId,
        logged_by: user.id,
        entry_date: dateStr, activity: selectedActivity,
        minutes: selectedDuration, notes: notes.trim() || null,
        category, cohort: resolvedCohort,
        on_behalf_of_name: logFor ? logFor.name : null,
        practice_id: ownerPracticeId,
      }).select().single();
      if (error) throw error;
      const newEntry = data as Entry;
      if (pendingFiles.length > 0) {
        for (const f of pendingFiles) {
          await uploadStandalone(f, newEntry.id);
        }
      }
      setEntries(prev => [newEntry, ...prev]);
      const partBSuffix = category === 'part_b'
        ? ` Part B${resolvedCohort ? ` (${resolvedCohort})` : ''}`
        : '';
      const forSuffix = logFor ? ` for ${logFor.name.split(' ')[0]}` : '';
      toast.success(`Logged ${formatDuration(selectedDuration)}${partBSuffix}${forSuffix} · ${format(selectedDate, 'd MMM')}${pendingFiles.length ? ` · ${pendingFiles.length} attachment${pendingFiles.length > 1 ? 's' : ''}` : ''}`);
      setSelectedActivity(''); setNotes(''); setSelectedDuration(60); setPendingFiles([]);
      setCohort(null); setCohortOther('');
      if (draftKey) localStorage.removeItem(draftKey);
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

  const openEditEntry = (e: Entry) => {
    setEditEntry(e);
    setEditDate(e.entry_date);
    setEditActivity(e.activity);
    setEditMinutes(e.minutes);
    setEditNotes(e.notes || '');
  };

  const saveEditEntry = async () => {
    if (!editEntry) return;
    if (!editActivity.trim()) { toast.error('Activity required'); return; }
    if (editMinutes < 5 || editMinutes > 6000) { toast.error('Duration must be 5–6000 minutes'); return; }
    setEditSaving(true);
    try {
      const updates = {
        entry_date: editDate,
        activity: editActivity.trim(),
        minutes: editMinutes,
        notes: editNotes.trim() || null,
      };
      const { data, error } = await (supabase as any)
        .from('nres_time_entries').update(updates).eq('id', editEntry.id).select().single();
      if (error) throw error;
      setEntries(prev => prev.map(e => e.id === editEntry.id ? { ...e, ...(data || updates) } : e));
      toast.success('Entry updated');
      setEditEntry(null);
    } catch (e: any) {
      console.error(e); toast.error(e?.message || 'Update failed');
    } finally { setEditSaving(false); }
  };
  const handleAddActivity = async () => {
    const label = newActivityLabel.trim();
    if (!user?.id) return;
    if (!label) { toast.error('Activity label required'); return; }
    if (label.length > 80) { toast.error('Max 80 characters'); return; }
    if (activities.some(a => (a.category || 'general') === category && a.label.toLowerCase() === label.toLowerCase())) {
      toast.error('Activity already exists in this tab'); return;
    }
    try {
      const { data, error } = await (supabase as any)
        .from('nres_user_activities')
        .insert({ user_id: user.id, label, is_default: false, sort_order: activities.length, category, role: null })
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
        .from('nres_user_activities').delete().eq('id', id).eq('user_id', user!.id);
      if (error) throw error;
      setActivities(prev => prev.filter(a => a.id !== id));
    } catch { toast.error('Failed to delete'); }
  };

  // Exports — current month
  type ExportRange = 'this-month' | 'last-month' | 'all-time';

  const getRangeData = (range: ExportRange) => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;
    let label = '';
    let fileTag = '';
    if (range === 'this-month') {
      start = startOfMonth(now); end = endOfMonth(now);
      label = format(now, 'MMMM yyyy');
      fileTag = format(now, 'yyyy-MM');
    } else if (range === 'last-month') {
      const lm = subMonths(now, 1);
      start = startOfMonth(lm); end = endOfMonth(lm);
      label = format(lm, 'MMMM yyyy');
      fileTag = format(lm, 'yyyy-MM');
    } else {
      label = 'All time';
      fileTag = 'all-time';
    }
    const filtered = entries.filter(e => {
      if (!start || !end) return true;
      const d = parseISO(e.entry_date);
      return d >= start && d <= end;
    }).slice().sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    const fileBase = `nres-time-${fileTag}-${user?.email || 'user'}`;
    return { entries: filtered, label, fileBase };
  };

  const exportCSV = (range: ExportRange) => {
    const { entries: rangeEntries, label, fileBase } = getRangeData(range);
    const youName = (user as any)?.user_metadata?.full_name || user?.email || 'Me';
    const youEmail = user?.email || '';
    const colleagueName = (id: string | null | undefined) =>
      id ? (colleagues.find(c => c.user_id === id)?.display_name || '') : '';
    const colleagueEmail = (id: string | null | undefined) =>
      id ? ((colleagues.find(c => c.user_id === id) as any)?.email || '') : '';

    const rows: string[][] = [['Date', 'Day', 'Tracked for (name)', 'Tracked for (email)', 'Logged by', 'Category', 'Cohort', 'Activity', 'Duration (mins)', 'Duration (hh:mm)', 'Notes']];
    let total = 0;
    const byAct: Record<string, { mins: number; count: number }> = {};
    const byCohort: Record<string, { mins: number; count: number }> = {};
    for (const e of rangeEntries) {
      const d = parseISO(e.entry_date);
      const cat = (e.category || 'general') === 'part_b' ? 'Part B' : 'General';
      const isMine = e.user_id === user?.id;
      const trackedName = isMine
        ? youName
        : ((e as any).on_behalf_of_name || colleagueName(e.user_id) || 'Colleague');
      const trackedEmail = isMine ? youEmail : colleagueEmail(e.user_id);
      const loggedBy = (e.entered_by && e.entered_by !== e.user_id) ? youName : trackedName;
      rows.push([
        e.entry_date, format(d, 'EEE'),
        trackedName, trackedEmail, loggedBy,
        cat, e.cohort || '', e.activity,
        String(e.minutes), formatDuration(e.minutes),
        (e.notes || '').replace(/"/g, '""'),
      ]);
      total += e.minutes;
      if (!byAct[e.activity]) byAct[e.activity] = { mins: 0, count: 0 };
      byAct[e.activity].mins += e.minutes;
      byAct[e.activity].count += 1;
      if ((e.category || 'general') === 'part_b') {
        const c = e.cohort || '(no cohort)';
        if (!byCohort[c]) byCohort[c] = { mins: 0, count: 0 };
        byCohort[c].mins += e.minutes;
        byCohort[c].count += 1;
      }
    }
    const pad = (extra: number) => Array(extra).fill('');
    rows.push([]);
    rows.push(['', '', '', '', '', '', '', `Range: ${label}`, '', '', '']);
    rows.push(['', '', '', '', '', '', '', 'Total entries', String(rangeEntries.length), '', '']);
    rows.push(['', '', '', '', '', '', '', 'Total time', String(total), formatDuration(total), '']);
    rows.push([]);
    rows.push(['Activity breakdown', 'Entries', 'Minutes', 'Duration (hh:mm)', ...pad(7)]);
    for (const [act, v] of Object.entries(byAct)) {
      rows.push([act, String(v.count), String(v.mins), formatDuration(v.mins), ...pad(7)]);
    }
    if (Object.keys(byCohort).length > 0) {
      rows.push([]);
      rows.push(['Part B by cohort', 'Entries', 'Minutes', 'Duration (hh:mm)', ...pad(7)]);
      for (const [c, v] of Object.entries(byCohort)) {
        rows.push([c, String(v.count), String(v.mins), formatDuration(v.mins), ...pad(7)]);
      }
    }
    const csv = rows.map(r => r.map(c => /[",\n]/.test(c) ? `"${c}"` : c).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${fileBase}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const exportPDF = async (range: ExportRange = 'this-month', groupBy: 'activity' | 'cohort' = 'activity') => {
    const { entries: rangeEntries, label, fileBase } = getRangeData(range);
    const doc = new jsPDF();

    // NRES logo (top right)
    try {
      const res = await fetch(nresLogoUrl);
      const blob = await res.blob();
      const dataUrl: string = await new Promise((resolve) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.readAsDataURL(blob);
      });
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.addImage(dataUrl, 'PNG', pageWidth - 20 - 30, 8, 30, 30);
    } catch {}

    doc.setFontSize(16);
    doc.text(`NRES Time Recording — ${label}`, 14, 18);
    doc.setFontSize(10);
    doc.text(`${user?.email || ''}`, 14, 26);
    doc.text(`Generated: ${format(new Date(), 'd MMM yyyy HH:mm')}`, 14, 32);

    // For cohort grouping, restrict to Part B entries
    const focused = groupBy === 'cohort'
      ? rangeEntries.filter(e => (e.category || 'general') === 'part_b')
      : rangeEntries;

    const total = focused.reduce((s, e) => s + e.minutes, 0);
    const buckets: Record<string, { mins: number; count: number }> = {};
    focused.forEach(e => {
      const key = groupBy === 'cohort' ? (e.cohort || '(no cohort)') : e.activity;
      if (!buckets[key]) buckets[key] = { mins: 0, count: 0 };
      buckets[key].mins += e.minutes;
      buckets[key].count += 1;
    });

    doc.setFontSize(11);
    const groupLabel = groupBy === 'cohort' ? 'Part B by cohort' : 'By activity';
    doc.text(`${groupLabel}    Total entries: ${focused.length}    Total time: ${formatDuration(total)}`, 14, 40);

    autoTable(doc, {
      startY: 46,
      head: [[groupBy === 'cohort' ? 'Cohort' : 'Activity', 'Entries', 'Total time', '% of total']],
      body: [
        ...Object.entries(buckets).map(([a, v]) => [
          a, String(v.count), formatDuration(v.mins), total ? `${((v.mins / total) * 100).toFixed(1)}%` : '0%',
        ]),
        [
          { content: 'Total', styles: { fontStyle: 'bold' as const } },
          { content: String(focused.length), styles: { fontStyle: 'bold' as const } },
          { content: formatDuration(total), styles: { fontStyle: 'bold' as const } },
          { content: '100%', styles: { fontStyle: 'bold' as const } },
        ],
      ],
      headStyles: { fillColor: [5, 150, 105] },
    });

    autoTable(doc, {
      head: [['Date', 'Cat', 'Cohort', 'Activity', 'Duration', 'Notes']],
      body: [
        ...focused.map(e => [
          format(parseISO(e.entry_date), 'dd/MM/yyyy'),
          (e.category || 'general') === 'part_b' ? 'Part B' : 'Gen',
          e.cohort || '',
          e.activity, formatDuration(e.minutes), e.notes || '',
        ]),
        [
          { content: `Total entries: ${focused.length}`, colSpan: 4, styles: { fontStyle: 'bold' as const } },
          { content: formatDuration(total), styles: { fontStyle: 'bold' as const } },
          { content: '', styles: {} },
        ],
      ],
      headStyles: { fillColor: [5, 150, 105] },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i); doc.setFontSize(8);
      doc.text(`Notewell AI — NRES Dashboard   Page ${i} of ${pageCount}`, 14, doc.internal.pageSize.height - 8);
    }
    const suffix = groupBy === 'cohort' ? '-by-cohort' : '';
    doc.save(`${fileBase}${suffix}.pdf`);
  };

  const exportPartBPDF = async (scope: 'mine' | 'practice', range: ExportRange) => {
    const { label, fileBase } = getRangeData(range);

    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;
    if (range === 'this-month') { start = startOfMonth(now); end = endOfMonth(now); }
    else if (range === 'last-month') { const lm = subMonths(now, 1); start = startOfMonth(lm); end = endOfMonth(lm); }

    let scopedEntries: Entry[] = [];
    let scopeLabel = '';
    let practiceNames: string[] = [];

    if (scope === 'mine') {
      scopeLabel = 'My Part B Activity';
      scopedEntries = entries.filter(e =>
        e.user_id === user?.id && (e.category || 'general') === 'part_b'
      );
      if (start && end) {
        scopedEntries = scopedEntries.filter(e => {
          const d = parseISO(e.entry_date);
          return d >= start! && d <= end!;
        });
      }
    } else {
      scopeLabel = 'My Practice Part B Activity';
      try {
        const { data: pids } = await (supabase as any).rpc('get_user_practice_ids', { p_user_id: user?.id });
        const practiceIds: string[] = (pids || []).map((p: any) => p.practice_id || p);
        if (practiceIds.length === 0) {
          toast.error('No practice found for your account');
          return;
        }
        let q = (supabase as any).from('nres_time_entries').select('*')
          .in('practice_id', practiceIds)
          .eq('category', 'part_b');
        if (start && end) {
          q = q.gte('entry_date', format(start, 'yyyy-MM-dd')).lte('entry_date', format(end, 'yyyy-MM-dd'));
        }
        const { data, error } = await q.order('entry_date', { ascending: false });
        if (error) throw error;
        scopedEntries = (data || []) as Entry[];

        const { data: pracs } = await (supabase as any)
          .from('gp_practices').select('name').in('id', practiceIds);
        practiceNames = (pracs || []).map((p: any) => p.name).filter(Boolean);
      } catch (err: any) {
        console.error(err);
        toast.error('Failed to load practice Part B entries');
        return;
      }
    }

    scopedEntries = scopedEntries.slice().sort((a, b) => b.entry_date.localeCompare(a.entry_date));

    let userNameById: Record<string, string> = {};
    if (scope === 'practice') {
      const ids = Array.from(new Set(scopedEntries.map(e => e.user_id).filter(Boolean))) as string[];
      if (ids.length > 0) {
        const { data: profs } = await (supabase as any)
          .from('profiles').select('user_id, full_name, email').in('user_id', ids);
        for (const p of (profs || [])) {
          userNameById[p.user_id] = p.full_name || p.email || p.user_id;
        }
      }
    }

    const doc = new jsPDF();
    try {
      const res = await fetch(nresLogoUrl);
      const blob = await res.blob();
      const dataUrl: string = await new Promise((resolve) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.readAsDataURL(blob);
      });
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.addImage(dataUrl, 'PNG', pageWidth - 20 - 30, 8, 30, 30);
    } catch {}

    doc.setFontSize(16);
    doc.text(`NRES Part B — ${scopeLabel}`, 14, 18);
    doc.setFontSize(10);
    doc.text(`${label}`, 14, 26);
    doc.text(scope === 'practice'
      ? (practiceNames.join(', ') || 'Practice')
      : (user?.email || ''), 14, 32);
    doc.text(`Generated: ${format(new Date(), 'd MMM yyyy HH:mm')}`, 14, 38);

    const total = scopedEntries.reduce((s, e) => s + e.minutes, 0);

    const byCohort: Record<string, { mins: number; count: number }> = {};
    scopedEntries.forEach(e => {
      const k = e.cohort || '(no cohort)';
      if (!byCohort[k]) byCohort[k] = { mins: 0, count: 0 };
      byCohort[k].mins += e.minutes;
      byCohort[k].count += 1;
    });

    doc.setFontSize(11);
    doc.text(`Total entries: ${scopedEntries.length}    Total time: ${formatDuration(total)}`, 14, 46);

    autoTable(doc, {
      startY: 52,
      head: [['Cohort', 'Entries', 'Total time', '% of total']],
      body: [
        ...Object.entries(byCohort).map(([c, v]) => [
          c, String(v.count), formatDuration(v.mins), total ? `${((v.mins / total) * 100).toFixed(1)}%` : '0%',
        ]),
        [
          { content: 'Total', styles: { fontStyle: 'bold' as const } },
          { content: String(scopedEntries.length), styles: { fontStyle: 'bold' as const } },
          { content: formatDuration(total), styles: { fontStyle: 'bold' as const } },
          { content: '100%', styles: { fontStyle: 'bold' as const } },
        ],
      ],
      headStyles: { fillColor: [5, 150, 105] },
    });

    const detailHead = scope === 'practice'
      ? [['Date', 'User', 'Cohort', 'Activity', 'Duration', 'Notes']]
      : [['Date', 'Cohort', 'Activity', 'Duration', 'Notes']];
    const detailBody = scopedEntries.map(e => scope === 'practice'
      ? [
          format(parseISO(e.entry_date), 'dd/MM/yyyy'),
          userNameById[e.user_id || ''] || '',
          e.cohort || '',
          e.activity, formatDuration(e.minutes), e.notes || '',
        ]
      : [
          format(parseISO(e.entry_date), 'dd/MM/yyyy'),
          e.cohort || '',
          e.activity, formatDuration(e.minutes), e.notes || '',
        ]);
    const totalRow = scope === 'practice'
      ? [
          { content: `Total entries: ${scopedEntries.length}`, colSpan: 4, styles: { fontStyle: 'bold' as const } },
          { content: formatDuration(total), styles: { fontStyle: 'bold' as const } },
          { content: '', styles: {} },
        ]
      : [
          { content: `Total entries: ${scopedEntries.length}`, colSpan: 3, styles: { fontStyle: 'bold' as const } },
          { content: formatDuration(total), styles: { fontStyle: 'bold' as const } },
          { content: '', styles: {} },
        ];

    autoTable(doc, {
      head: detailHead,
      body: [...detailBody, totalRow as any],
      headStyles: { fillColor: [5, 150, 105] },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i); doc.setFontSize(8);
      doc.text(`Notewell AI — NRES Dashboard   Page ${i} of ${pageCount}`, 14, doc.internal.pageSize.height - 8);
    }
    const scopeTag = scope === 'practice' ? 'practice-part-b' : 'my-part-b';
    doc.save(`${fileBase}-${scopeTag}.pdf`);
  };

  const dayLabel = (d: Date) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const cmp = new Date(d); cmp.setHours(0,0,0,0);
    const diff = (today.getTime() - cmp.getTime()) / 86400000;
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return format(d, 'EEE');
  };

  const { isVerifier } = useIsNRESVerifier();
  const [topTab, setTopTab] = useState<'mine' | 'manager'>('mine');

  const [managerSummary, setManagerSummary] = useState<{ activeCount: number; totalEligible: number; practiceCount: number } | null>(null);
  const categoryLabel = category === 'part_b' ? 'Part B' : 'General';
  const subtitle = topTab === 'manager'
    ? (managerSummary
        ? `All NRES users · ${managerSummary.activeCount} active across ${managerSummary.practiceCount} ${managerSummary.practiceCount === 1 ? 'practice' : 'practices'}`
        : 'All NRES users')
    : `Your ${categoryLabel} time entries`;

  return (
    <div className={embedded ? '' : 'min-h-screen bg-slate-50'}>
      {!embedded && <Header />}
      <div className={cn('mx-auto px-4 py-4', topTab === 'manager' ? 'max-w-7xl' : 'max-w-2xl')}>
        {/* Title row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" /> NRES Time Tracker
          </h1>
          {isVerifier && (
            <div className="inline-flex items-center gap-1 rounded-full bg-stone-100 p-1">
              {([
                { id: 'mine' as const, label: 'My time', Icon: Clock },
                { id: 'manager' as const, label: 'Manager view', Icon: Users },
              ]).map(({ id, label, Icon }) => {
                const active = topTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTopTab(id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium transition-all px-[18px] py-2',
                      active
                        ? 'bg-[#1D9E75] text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                        : 'bg-transparent text-[#5F5E5A] hover:bg-white hover:shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {/* Subtitle */}
        <p className="mt-2 mb-5 text-[13px] text-slate-500">{subtitle}</p>

        {topTab === 'manager' && isVerifier ? (
          <NRESTimeManagerView hideHeading onSummaryChange={setManagerSummary} />
        ) : (
        <div className="space-y-4">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="rounded-xl border-2 border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wide text-slate-500 truncate">This Week</div>
                  <div className="text-[10px] text-slate-400 truncate">&nbsp;</div>
                </div>
                <span className={cn('shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none', category === 'part_b' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700')}>{categoryLabel}</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{formatDuration(weekTotal)}</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-2 border-emerald-700 bg-emerald-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wide text-emerald-100 truncate">This Month</div>
                  <div className="text-[10px] text-emerald-100/80 truncate">{format(new Date(), 'MMMM yyyy')}</div>
                </div>
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none bg-white/20 text-white">{categoryLabel}</span>
              </div>
              <div className="text-2xl font-bold mt-1">{formatDuration(monthTotal)}</div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-2 border-slate-200 bg-slate-50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wide text-slate-500 truncate">Last Month</div>
                  <div className="text-[10px] text-slate-400 truncate">{format(subMonths(new Date(), 1), 'MMMM yyyy')}</div>
                </div>
                <span className={cn('shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none', category === 'part_b' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700')}>{categoryLabel}</span>
              </div>
              <div className="text-2xl font-bold text-slate-700 mt-1">{formatDuration(lastMonthTotal)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Category tabs (General / Part B) */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="inline-flex items-center gap-1 rounded-md bg-slate-100 p-1">
            {([
              { id: 'general' as const, label: 'General' },
              { id: 'part_b' as const, label: 'Part B' },
            ]).map(({ id, label }) => {
              const active = category === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleCategoryChange(id)}
                  className={cn(
                    'rounded-md px-4 py-1.5 text-sm font-medium transition',
                    active ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Log-for picker */}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className={cn(
            'w-full flex items-center justify-between gap-2 rounded-md px-3 h-9 text-sm transition',
            isSelf
              ? 'border border-slate-200 bg-transparent text-slate-600 hover:border-slate-300'
              : 'border-2 border-emerald-600 bg-emerald-50 text-emerald-900 font-medium'
          )}
        >
          <span className="flex items-center gap-2">
            <Users className={cn('w-4 h-4', isSelf ? 'text-slate-500' : 'text-emerald-600')} />
            {isSelf ? 'For me' : `Logging for ${logFor!.name}`}
          </span>
          <ChevronDown className="w-4 h-4 opacity-60" />
        </button>

        {/* Date strip */}
        <Card className="rounded-xl border-2 border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">
                  {showMonth ? `MONTH — ${format(monthDays.anchor, 'MMMM yyyy')}` : 'DATE'}
                </span>
                {!showMonth && (
                  <button
                    onClick={() => setDateReversed(r => !r)}
                    title={dateReversed ? 'Today first' : 'Today last'}
                    className="text-xs flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-700">
                    <ArrowLeftRight className="w-3 h-3" /> Reverse
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                {showMonth ? (
                  <>
                    <button
                      onClick={() => setMonthOffset(o => o + 1)}
                      title="Previous month"
                      className="text-xs flex items-center gap-1 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-700">
                      <ChevronLeft className="w-3 h-3" /> Prev month
                    </button>
                    {monthOffset > 0 && (
                      <button
                        onClick={() => setMonthOffset(o => Math.max(0, o - 1))}
                        title="Next month"
                        className="text-xs flex items-center gap-1 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-700">
                        Next <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => { setShowMonth(false); setMonthOffset(0); }}
                      title="Days view"
                      className="text-xs flex items-center gap-1 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-700">
                      <CalendarDays className="w-3 h-3" /> Days
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setWeekOffset(o => o + 1)}
                      title="Previous 7 days"
                      className="text-xs flex items-center gap-1 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-700">
                      <ChevronLeft className="w-3 h-3" /> Prev
                    </button>
                    {weekOffset > 0 && (
                      <button
                        onClick={() => setWeekOffset(o => Math.max(0, o - 1))}
                        title="Next 7 days"
                        className="text-xs flex items-center gap-1 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-700">
                        Next <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => setShowMonth(true)}
                      title="Month view"
                      className="text-xs flex items-center gap-1 px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-700">
                      <CalendarRange className="w-3 h-3" /> Month
                    </button>
                  </>
                )}
              </div>
            </div>

            {showMonth ? (
              <div>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                    <div key={d} className="text-[10px] uppercase text-slate-400 text-center font-medium">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: monthDays.leadingBlanks }).map((_, i) => (
                    <div key={`b${i}`} />
                  ))}
                  {monthDays.days.map(d => {
                    const active = isSameDay(d, selectedDate);
                    const isToday = isSameDay(d, new Date());
                    const isFuture = d.getTime() > new Date().setHours(23,59,59,999);
                    return (
                      <button
                        key={d.toISOString()}
                        disabled={isFuture}
                        onClick={() => setSelectedDate(d)}
                        className={`rounded-lg py-2 text-center border-2 transition ${
                          active
                            ? 'bg-emerald-600 border-emerald-700 text-white'
                            : isToday
                              ? 'bg-white border-emerald-500 text-slate-800'
                              : 'bg-white border-slate-200 text-slate-700'
                        } ${isFuture ? 'opacity-30 cursor-not-allowed' : 'hover:border-emerald-400'}`}>
                        <div className="text-sm font-bold leading-none">{format(d, 'd')}</div>
                        <div className={`text-[9px] mt-0.5 ${active ? 'text-emerald-100' : 'text-slate-400'}`}>{format(d, 'EEE')}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <DateStripScroller>
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
              </DateStripScroller>
            )}
          </CardContent>
        </Card>

        {/* Activity picker */}
        <Card className="rounded-xl border-2 border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setActivityOpen(o => !o)}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                {activityOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                ACTIVITY
                {!activityOpen && (
                  <span className="ml-2 normal-case text-slate-600">
                    · {visibleActivities.length} {visibleActivities.length === 1 ? 'activity' : 'activities'} — click to expand
                    {selectedActivity && <span className="ml-1 text-emerald-700">(selected: {selectedActivity})</span>}
                  </span>
                )}
              </button>
              {activityOpen && isSelf && (
                <button onClick={() => setManageMode(m => !m)}
                  className="text-xs text-emerald-700 inline-flex items-center gap-1">
                  <Settings2 className="w-3 h-3" /> {manageMode ? 'Done' : 'Manage'}
                </button>
              )}
            </div>
            {activityOpen && (
              <div className="grid grid-cols-2 gap-2">
                {visibleActivities.map(a => {
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
            )}
          </CardContent>
        </Card>

        {/* Cohort chips (Part B only) */}
        {category === 'part_b' && (
          <Card className="rounded-xl border-2 border-slate-200">
            <CardContent className="p-3 space-y-2">
              <div className="text-xs font-medium text-slate-500">
                COHORT <span className="text-slate-400 normal-case">(optional)</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PART_B_COHORTS.map(c => {
                  const active = cohort === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setCohort(active ? null : c); if (c !== 'Other') setCohortOther(''); }}
                      className={cn(
                        'rounded-full px-3 h-8 text-xs font-medium border transition',
                        active
                          ? 'bg-green-100 border-green-300 text-green-900'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'
                      )}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
              {cohort === 'Other' && (
                <Input
                  autoFocus
                  value={cohortOther}
                  onChange={e => setCohortOther(e.target.value.slice(0, 40))}
                  placeholder="Specify cohort (max 40 chars)"
                  maxLength={40}
                  className="h-8 text-sm"
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Duration */}
        <DurationPicker selectedDuration={selectedDuration} setSelectedDuration={setSelectedDuration} category={category} />

        {/* Notes & attachments */}
        <Card className="rounded-xl border-2 border-slate-200">
          <CardContent
            className="p-3 space-y-2"
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.length) {
                setPendingFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
              }
            }}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-slate-500">NOTES & ATTACHMENTS (OPTIONAL)</div>
              <button
                type="button"
                onClick={() => pendingInputRef.current?.click()}
                className="text-[11px] text-emerald-700 font-medium hover:underline flex items-center gap-1"
              >
                <Paperclip className="w-3 h-3" /> Attach
              </button>
              <input
                ref={pendingInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                  e.target.value = '';
                }}
              />
            </div>
            {noteSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {noteSuggestions.map((s, i) => (
                  <button
                    key={`${i}-${s}`}
                    type="button"
                    onClick={() => setNotes(s)}
                    title={s}
                    className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 max-w-[220px] truncate">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="relative">
              <Textarea
                ref={notesElRef}
                value={notes}
                rows={2}
                onChange={e => {
                  setNotes(e.target.value);
                  notesBaseRef.current = e.target.value;
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
                  el.scrollTop = el.scrollHeight;
                }}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  const pasted: File[] = [];
                  for (let i = 0; i < items.length; i++) {
                    const it = items[i];
                    if (it.kind === 'file') {
                      const f = it.getAsFile();
                      if (f) {
                        const ext = (f.type.split('/')[1] || 'png');
                        const named = f.name && f.name !== 'image.png'
                          ? f
                          : new File([f], `screenshot-${new Date().toISOString().replace(/[:.]/g,'-')}.${ext}`, { type: f.type });
                        pasted.push(named);
                      }
                    }
                  }
                  if (pasted.length > 0) {
                    e.preventDefault();
                    setPendingFiles(prev => [...prev, ...pasted]);
                    toast.success(`Attached ${pasted.length} file${pasted.length > 1 ? 's' : ''} from clipboard`);
                  }
                }}
                placeholder="e.g. v6 MoU review with Mark Gray (Ctrl+V to paste a screenshot)"
                className="pr-9 resize-none overflow-y-auto max-h-40 min-h-[44px]"
              />
              <button
                type="button"
                onClick={micRecording ? stopMic : startMic}
                title={micRecording ? 'Stop voice input' : 'Dictate notes'}
                aria-label={micRecording ? 'Stop voice input' : 'Dictate notes'}
                className={cn(
                  'absolute right-1.5 top-1.5 h-7 w-7 rounded-full flex items-center justify-center transition-all duration-300',
                  micRecording
                    ? 'bg-red-500 text-white shadow-[0_0_0_4px_rgba(239,68,68,0.18)] animate-pulse'
                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                )}
              >
                {micRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            </div>
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {pendingFiles.map((f, i) => {
                  const isImg = f.type.startsWith('image/');
                  return (
                    <div key={i} className="relative group rounded-md border border-slate-200 bg-slate-50 p-1 flex items-center gap-2 max-w-[180px]">
                      {isImg ? (
                        <img src={URL.createObjectURL(f)} alt={f.name} className="w-10 h-10 object-cover rounded" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-semibold">
                          {(f.name.split('.').pop() || '?').slice(0, 4).toUpperCase()}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-600 truncate">{f.name}</div>
                      <button
                        type="button"
                        onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 bg-white border border-slate-300 rounded-full w-4 h-4 flex items-center justify-center text-slate-500 hover:text-red-600"
                        title="Remove"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save */}
        <Button disabled={!selectedActivity || saving} onClick={handleSave}
          className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base">
          {(() => {
            if (!selectedActivity) return 'Select an activity to log';
            const dur = formatDuration(selectedDuration);
            if (category !== 'part_b') return `Log ${dur} — ${selectedActivity}`;
            const c = cohort === 'Other' ? cohortOther.trim() : cohort;
            return c
              ? `Log ${dur} Part B — ${selectedActivity} (${c})`
              : `Log ${dur} Part B — ${selectedActivity}`;
          })()}
        </Button>

        {/* Recent entries */}
        <Card className="rounded-xl border-2 border-slate-200">
          <CardHeader className="flex-row items-center justify-between space-y-0 p-3 pb-2">
            <button
              type="button"
              onClick={() => setRecentOpen(o => !o)}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900"
            >
              {recentOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Recent entries
              <span className="text-xs font-normal text-slate-500">
                ({recentEntries.length} {recentEntries.length === 1 ? 'entry' : 'entries'}){!recentOpen && ' — click to expand'}
              </span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Download className="w-3 h-3 mr-1" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Export CSV</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => exportCSV('this-month')}>This month</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportCSV('last-month')}>Last month</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportCSV('all-time')}>All time</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>PDF — by activity</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => exportPDF('this-month', 'activity')}>This month</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportPDF('last-month', 'activity')}>Last month</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportPDF('all-time', 'activity')}>All time</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                {entries.some(e => (e.category || 'general') === 'part_b') && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>PDF — Part B by cohort</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => exportPDF('this-month', 'cohort')}>This month</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportPDF('last-month', 'cohort')}>Last month</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportPDF('all-time', 'cohort')}>All time</DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                {category === 'part_b' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>PDF — My Part B Activity</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => exportPartBPDF('mine', 'this-month')}>This month</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportPartBPDF('mine', 'last-month')}>Last month</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportPartBPDF('mine', 'all-time')}>All time</DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>PDF — My Practice Part B</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => exportPartBPDF('practice', 'this-month')}>This month</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportPartBPDF('practice', 'last-month')}>Last month</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportPartBPDF('practice', 'all-time')}>All time</DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          {recentOpen && (
            <CardContent className="p-0">
              {loading && <div className="p-4 text-sm text-slate-500">Loading…</div>}
              {!loading && entries.length === 0 && (
                <div className="p-4 text-sm text-slate-500">No entries yet.</div>
              )}
              <ul className="divide-y divide-slate-100">
                {recentEntries.map(e => {
                  const count = attachmentCounts[e.id] || 0;
                  return (
                    <li key={e.id} className="flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate flex items-center gap-1.5">
                          {(e.category || 'general') === 'part_b' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 shrink-0">Part B</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 shrink-0">General</span>
                          )}
                          <span className="truncate">{e.activity}</span>
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {format(parseISO(e.entry_date), 'EEE d MMM')}
                          {e.notes ? ` · ${e.notes}` : ''}
                        </div>
                        {(() => {
                          const youName = (user as any)?.user_metadata?.full_name || 'you';
                          const colleagueName = (id: string | null | undefined) =>
                            id ? (colleagues.find(c => c.user_id === id)?.display_name || 'colleague') : 'colleague';
                          const forName = e.user_id === user?.id
                            ? youName
                            : (e.on_behalf_of_name || colleagueName(e.user_id));
                          const addedByDifferent = e.logged_by && e.user_id && e.logged_by !== e.user_id;
                          const addedByName = !addedByDifferent
                            ? null
                            : (e.logged_by === user?.id ? youName : colleagueName(e.logged_by));
                          return (
                            <div className="text-[11px] text-slate-400 truncate">
                              For: <span className="text-slate-600 font-medium">{forName}</span>
                              {addedByName && <> · Added by: <span className="text-slate-600 font-medium">{addedByName}</span></>}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {e.cohort && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-900 text-[10px] font-medium">
                            {e.cohort}
                          </span>
                        )}
                        <div className="text-sm font-semibold text-emerald-700">{formatDuration(e.minutes)}</div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            title="More actions"
                            className="relative shrink-0 p-1.5 rounded-md text-slate-400 hover:text-emerald-700 hover:bg-slate-100 transition"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                            {count > 0 && (
                              <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{count}</span>
                            )}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => setAttachmentEntry(e)}>
                            <Paperclip className="w-4 h-4 mr-2" />
                            Attachments{count > 0 ? ` (${count})` : ''}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditEntry(e)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit entry
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDeleteEntry(e.id)} className="text-red-600 focus:text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          )}
        </Card>
        </div>
        )}
      </div>

      <TimeEntryAttachmentsModal
        open={!!attachmentEntry}
        entryId={attachmentEntry?.id || null}
        entryLabel={attachmentEntry ? `${attachmentEntry.activity} · ${format(parseISO(attachmentEntry.entry_date), 'EEE d MMM')}` : undefined}
        onClose={() => { setAttachmentEntry(null); refreshCounts(); }}
      />

      {/* Log-for picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0">
          <DialogHeader className="px-5 py-4">
            <DialogTitle>Log time for…</DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-3">
            <Input
              autoFocus
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              placeholder="Search colleagues…"
              className="h-9 text-sm"
            />
          </div>
          <div className="max-h-[50vh] overflow-y-auto border-t">
            <button
              type="button"
              onClick={() => selectLogTarget(null)}
              className={cn(
                'w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 transition',
                isSelf && 'bg-emerald-50'
              )}
            >
              <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-semibold">Me</span>
              <span className="flex-1">
                <div className="text-sm font-medium text-slate-900">Me</div>
                <div className="text-xs text-slate-500">{user?.email}</div>
              </span>
            </button>
            {colleagues
              .filter(c => {
                const q = pickerSearch.trim().toLowerCase();
                if (!q) return true;
                return (c.display_name || '').toLowerCase().includes(q) || (c.staff_role || '').toLowerCase().includes(q);
              })
              .map(c => {
                const name = c.display_name || 'Unnamed';
                const initials = name.split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase();
                const active = logFor?.id === c.user_id;
                return (
                  <button
                    key={c.user_id}
                    type="button"
                    onClick={() => selectLogTarget({ id: c.user_id, name })}
                    className={cn(
                      'w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 transition border-t',
                      active && 'bg-emerald-50'
                    )}
                  >
                    <span className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold">{initials || '?'}</span>
                    <span className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{name}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {[c.staff_role, c.practice_name].filter(Boolean).join(' · ')}
                      </div>
                    </span>
                  </button>
                );
              })}
            {colleagues.length === 0 && (
              <div className="px-5 py-6 text-sm text-slate-500 text-center">
                No practice colleagues found. Add staff in the Buy-back tab to enable logging on their behalf.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editEntry} onOpenChange={(o) => !o && setEditEntry(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-slate-800 text-lg">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600">
                <Pencil className="w-4 h-4" />
              </span>
              Edit entry
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4">
            {/* Date */}
            <Card className="rounded-xl border-2 border-slate-200">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <CalendarDays className="w-3.5 h-3.5" /> DATE
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex flex-col items-center justify-center rounded-xl border-2 border-emerald-600 bg-emerald-50 px-5 py-2 text-emerald-800 hover:bg-emerald-100 transition"
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wider">
                        {editDate ? format(parseISO(editDate), 'EEE') : '—'}
                      </span>
                      <span className="text-2xl font-bold leading-none">
                        {editDate ? format(parseISO(editDate), 'd') : '—'}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider">
                        {editDate ? format(parseISO(editDate), 'MMM') : ''}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editDate ? parseISO(editDate) : undefined}
                      onSelect={(d) => d && setEditDate(format(d, 'yyyy-MM-dd'))}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </CardContent>
            </Card>

            {/* Activity */}
            <Card className="rounded-xl border-2 border-slate-200">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <ActivityIcon className="w-3.5 h-3.5" /> ACTIVITY
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activities.map(a => {
                    const active = editActivity === a.label;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setEditActivity(a.label)}
                        className={cn(
                          'rounded-full px-4 py-2 text-sm font-medium border-2 text-left transition',
                          active
                            ? 'bg-emerald-600 border-emerald-700 text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-400'
                        )}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
                {!activities.some(a => a.label === editActivity) && editActivity && (
                  <div className="text-xs text-slate-500 pt-1">
                    Custom: <span className="font-medium text-slate-700">{editActivity}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Duration */}
            <Card className="rounded-xl border-2 border-slate-200">
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Timer className="w-3.5 h-3.5" /> DURATION
                  </div>
                  <div className="text-lg font-semibold text-emerald-700">{formatDuration(editMinutes)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[30, 45, 60, 75, 90].map(m => {
                    const active = editMinutes === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setEditMinutes(m)}
                        className={cn(
                          'rounded-full px-4 py-2 text-sm font-medium border-2 transition',
                          active
                            ? 'bg-emerald-600 border-emerald-700 text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-400'
                        )}
                      >
                        {formatDuration(m)}
                      </button>
                    );
                  })}
                </div>
                <div className="px-1 pt-1">
                  <Slider
                    min={5}
                    max={240}
                    step={5}
                    value={[Math.min(240, Math.max(5, editMinutes))]}
                    onValueChange={(v) => setEditMinutes(v[0])}
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>5m</span><span>1h</span><span>2h</span><span>3h</span><span>4h</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="rounded-xl border-2 border-slate-200">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <FileText className="w-3.5 h-3.5" /> NOTES
                </div>
                <Textarea
                  id="edit-notes"
                  rows={4}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Add any context, decisions, or follow-ups…"
                  className="rounded-lg border-slate-200 focus-visible:ring-emerald-500 focus-visible:ring-2 focus-visible:ring-offset-0"
                />
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setEditEntry(null)} disabled={editSaving}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={saveEditEntry}
              disabled={editSaving}
            >
              {editSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NRESTimeTracker;

const DurationPicker = ({ selectedDuration, setSelectedDuration, category }: { selectedDuration: number; setSelectedDuration: (n: number) => void; category?: string }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const idx = DURATION_OPTIONS.indexOf(selectedDuration);
  const safeIdx = idx >= 0 ? idx : DURATION_OPTIONS.findIndex(o => o >= selectedDuration);
  const start = Math.max(0, Math.min(DURATION_OPTIONS.length - 5, (safeIdx < 0 ? 0 : safeIdx) - 2));
  const visible = DURATION_OPTIONS.slice(start, start + 5);
  const isPartB = category === 'part_b';
  const sliderValue = Math.min(240, Math.max(5, selectedDuration));

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
        {isPartB && (
          <div className="flex flex-wrap gap-2 justify-center pt-1 border-t border-slate-100">
            {[
              { label: 'Full Session', sub: '4h 10m', mins: 250 },
              { label: 'Full Day', sub: '2 sessions · 8h 20m', mins: 500 },
            ].map(p => {
              const active = selectedDuration === p.mins;
              return (
                <button key={p.mins} onClick={() => setSelectedDuration(p.mins)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium border-2 transition ${
                    active ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                  }`}>
                  <div className="font-semibold">{p.label}</div>
                  <div className="text-[10px] opacity-80">{p.sub}</div>
                </button>
              );
            })}
          </div>
        )}
        <div className="px-1 pt-1">
          <Slider
            min={5}
            max={240}
            step={5}
            value={[sliderValue]}
            onValueChange={(v) => setSelectedDuration(v[0])}
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>5m</span><span>1h</span><span>2h</span><span>3h</span><span>4h</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/** Horizontal scroller that shows a slider only when content overflows. */
const DateStripScroller = ({ children }: { children: React.ReactNode }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [maxScroll, setMaxScroll] = useState(0);
  const [scrollPos, setScrollPos] = useState(0);

  const recalc = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setMaxScroll(max);
    setOverflow(max > 4);
    setScrollPos(el.scrollLeft);
  }, []);

  useEffect(() => {
    recalc();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(recalc);
    ro.observe(el);
    Array.from(el.children).forEach(c => ro.observe(c as Element));
    return () => ro.disconnect();
  }, [recalc, children]);

  return (
    <div className="space-y-2">
      <div
        ref={scrollRef}
        onScroll={e => setScrollPos((e.target as HTMLDivElement).scrollLeft)}
        className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {children}
      </div>
      {overflow && (
        <input
          type="range"
          min={0}
          max={maxScroll}
          value={scrollPos}
          onChange={e => {
            const v = Number(e.target.value);
            if (scrollRef.current) scrollRef.current.scrollLeft = v;
          }}
          className="w-full h-1 accent-emerald-600 cursor-pointer"
          aria-label="Scroll dates" />
      )}
    </div>
  );
};

