import { useState, useMemo, useEffect, useRef } from 'react';
import { useNRESManagementTime, type ManagementRoleConfig } from '@/hooks/useNRESManagementTime';
import { useNRESBuyBackRateSettings } from '@/hooks/useNRESBuyBackRateSettings';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Loader2, Plus, Trash2, Send, CalendarIcon, ChevronDown, ChevronRight, ClipboardList, Download, Upload, FileText, X, Sparkles } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { exportManagementTimeDetail, exportManagementMonthlySummary } from '@/utils/buybackExcelExport';
import { showToast } from '@/utils/toastWrapper';

function fmtGBP(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_COLOURS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  verified: 'bg-indigo-100 text-indigo-700',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  queried: 'bg-orange-100 text-orange-700',
  invoiced: 'bg-purple-100 text-purple-700',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700',
};

// ────────────────────────────────────────────────────────────────────────────────
// LocalStorage helpers — scoped per user where possible
// ────────────────────────────────────────────────────────────────────────────────
function lsKey(uid: string | undefined, suffix: string) {
  return `nres-mgmt-${uid || 'anon'}-${suffix}`;
}
function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* quota / private mode */ }
}

// ────────────────────────────────────────────────────────────────────────────────
// Date / time helpers
// ────────────────────────────────────────────────────────────────────────────────
function parseHHMM(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]); const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}
function hoursFromTimes(start: string, end: string): number | null {
  const a = parseHHMM(start); const b = parseHHMM(end);
  if (a == null || b == null || b <= a) return null;
  const decimal = (b - a) / 60;
  return Math.round(decimal * 4) / 4; // round to 0.25
}
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Read failed'));
    reader.readAsDataURL(file);
  });
}
function fileTypeFor(file: File): 'pdf' | 'image' | 'word' | null {
  const n = file.name.toLowerCase();
  if (file.type === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(n)) return 'image';
  if (n.endsWith('.docx') || n.endsWith('.doc') || file.type.includes('officedocument.wordprocessing')) return 'word';
  return null;
}

// ────────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────────
type ExtractedRow = {
  id: string;
  include: boolean;
  work_date: string; // yyyy-MM-dd
  start_time: string; // HH:mm or ''
  end_time: string;   // HH:mm or ''
  hours: number;
  description: string;
};

export function ManagementTimeTab({ isAdmin }: { isAdmin: boolean }) {
  const { user } = useAuth();
  const { entries, loading, saving, addEntry, deleteEntry, submitMonth } = useNRESManagementTime();
  const { settings } = useNRESBuyBackRateSettings();
  const mgmtRoles = (settings as any).management_roles_config as ManagementRoleConfig[] | undefined;
  const activeRoles = useMemo(() => (mgmtRoles || []).filter(r => r.is_active), [mgmtRoles]);

  // ── Add entry form state ──
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [workDate, setWorkDate] = useState<Date | undefined>(() => new Date()); // default to today
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');

  // ── Filters ──
  const [filterPerson, setFilterPerson] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // ── Document import state ──
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importedRows, setImportedRows] = useState<ExtractedRow[]>([]);
  const [importPersonRole, setImportPersonRole] = useState('');
  const [importedFileName, setImportedFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Restore persisted preferences on mount / user change ──
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const lastMonth = lsGet(lsKey(user?.id, 'last-month')); // yyyy-MM
    const lastStart = lsGet(lsKey(user?.id, 'last-start'));
    const lastEnd = lsGet(lsKey(user?.id, 'last-end'));
    if (lastMonth && /^\d{4}-\d{2}$/.test(lastMonth)) {
      setWorkDate(new Date(`${lastMonth}-01T12:00:00`));
    }
    if (lastStart) setStartTime(lastStart);
    if (lastEnd) setEndTime(lastEnd);
  }, [user?.id]);

  // ── Persist start/end times on change ──
  useEffect(() => { if (startTime) lsSet(lsKey(user?.id, 'last-start'), startTime); }, [startTime, user?.id]);
  useEffect(() => { if (endTime) lsSet(lsKey(user?.id, 'last-end'), endTime); }, [endTime, user?.id]);

  // ── Auto-derive hours from start/end when both present ──
  useEffect(() => {
    const auto = hoursFromTimes(startTime, endTime);
    if (auto != null) setHours(String(auto));
  }, [startTime, endTime]);

  const selectedRoleConfig = useMemo(() => activeRoles.find(r => r.key === selectedRole), [activeRoles, selectedRole]);
  const importPersonConfig = useMemo(() => activeRoles.find(r => r.key === importPersonRole), [activeRoles, importPersonRole]);

  const claimMonthForDate = (d: Date) => format(startOfMonth(d), 'yyyy-MM-dd');
  const claimMonthLabel = workDate ? format(startOfMonth(workDate), 'MMMM yyyy') : '—';

  const handleAdd = async () => {
    if (!selectedRoleConfig || !workDate || !hours || Number(hours) <= 0) return;
    const fullDescription = (() => {
      const base = description.trim();
      if (startTime && endTime) {
        return base ? `${base} (${startTime}–${endTime})` : `Worked ${startTime}–${endTime}`;
      }
      return base || undefined as any;
    })();
    await addEntry({
      management_role_key: selectedRoleConfig.key,
      person_name: selectedRoleConfig.person_name,
      work_date: format(workDate, 'yyyy-MM-dd'),
      hours: Number(hours),
      description: fullDescription,
      claim_month: claimMonthForDate(workDate),
      billing_entity: selectedRoleConfig.billing_entity,
      billing_org_code: selectedRoleConfig.billing_org_code,
      hourly_rate: selectedRoleConfig.hourly_rate,
    });
    // Persist last month
    lsSet(lsKey(user?.id, 'last-month'), format(workDate, 'yyyy-MM'));
    // Clear only hours & description; keep start/end and date for repeat entries
    setHours('');
    setDescription('');
  };

  // ── Document import handler ──
  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast.error('File too large (max 10 MB)', { section: 'system' });
      return;
    }
    const ft = fileTypeFor(file);
    if (!ft) {
      showToast.error('Unsupported file type. Use Word (.docx), PDF or an image.', { section: 'system' });
      return;
    }
    setImporting(true);
    setImportedFileName(file.name);
    setImportedRows([]);
    try {
      const dataUrl = await fileToDataUrl(file);
      const { data: extractData, error: extractErr } = await supabase.functions.invoke('extract-document-text', {
        body: { fileType: ft, dataUrl, fileName: file.name },
      });
      if (extractErr) throw new Error(extractErr.message || 'Document text extraction failed');
      const text: string = extractData?.extractedText || '';
      if (!text || text.trim().length < 5) {
        showToast.error('No readable text found in the document', { section: 'system' });
        return;
      }
      const { data: aiData, error: aiErr } = await supabase.functions.invoke('extract-management-time-entries', {
        body: { text },
      });
      if (aiErr) throw new Error(aiErr.message || 'AI extraction failed');
      const rows: ExtractedRow[] = (aiData?.entries || []).map((e: any, i: number) => ({
        id: `imp-${Date.now()}-${i}`,
        include: true,
        work_date: e.work_date || '',
        start_time: e.start_time || '',
        end_time: e.end_time || '',
        hours: typeof e.hours === 'number' ? e.hours : (hoursFromTimes(e.start_time || '', e.end_time || '') || 0),
        description: e.description || '',
      }));
      if (rows.length === 0) {
        showToast.warning('AI could not find any dated time entries in that document', { section: 'system' });
        return;
      }
      setImportedRows(rows);
      showToast.success(`Extracted ${rows.length} entries — review and confirm before adding`, { section: 'system' });
    } catch (e: any) {
      console.error('Import failed:', e);
      showToast.error(e?.message || 'Import failed', { section: 'system' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateImportedRow = (id: string, patch: Partial<ExtractedRow>) => {
    setImportedRows(rs => rs.map(r => {
      if (r.id !== id) return r;
      const merged = { ...r, ...patch };
      // Re-derive hours if times changed and user hasn't overridden hours in same patch
      if (('start_time' in patch || 'end_time' in patch) && !('hours' in patch)) {
        const auto = hoursFromTimes(merged.start_time, merged.end_time);
        if (auto != null) merged.hours = auto;
      }
      return merged;
    }));
  };

  const addImportedToEntries = async () => {
    if (!importPersonConfig) {
      showToast.error('Select a person before adding the imported entries', { section: 'system' });
      return;
    }
    const toAdd = importedRows.filter(r => r.include && r.work_date && r.hours > 0);
    if (toAdd.length === 0) {
      showToast.error('No valid rows ticked', { section: 'system' });
      return;
    }
    let added = 0;
    for (const r of toAdd) {
      const desc = (() => {
        const base = (r.description || '').trim();
        if (r.start_time && r.end_time) return base ? `${base} (${r.start_time}–${r.end_time})` : `Worked ${r.start_time}–${r.end_time}`;
        return base || undefined as any;
      })();
      try {
        await addEntry({
          management_role_key: importPersonConfig.key,
          person_name: importPersonConfig.person_name,
          work_date: r.work_date,
          hours: r.hours,
          description: desc,
          claim_month: claimMonthForDate(new Date(r.work_date + 'T12:00:00')),
          billing_entity: importPersonConfig.billing_entity,
          billing_org_code: importPersonConfig.billing_org_code,
          hourly_rate: importPersonConfig.hourly_rate,
        });
        added++;
      } catch (e) {
        console.error('Failed to add imported entry:', r, e);
      }
    }
    if (added > 0) {
      const lastMonth = format(startOfMonth(new Date(toAdd[toAdd.length - 1].work_date + 'T12:00:00')), 'yyyy-MM');
      lsSet(lsKey(user?.id, 'last-month'), lastMonth);
      showToast.success(`Added ${added} entr${added === 1 ? 'y' : 'ies'} from document`, { section: 'system' });
      setImportedRows([]);
      setImportedFileName('');
    }
  };

  // Unique months for filter
  const months = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => { if (e.claim_month) set.add(e.claim_month); });
    return Array.from(set).sort().reverse();
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filterPerson !== 'all' && e.management_role_key !== filterPerson) return false;
      if (filterMonth !== 'all' && e.claim_month !== filterMonth) return false;
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      return true;
    });
  }, [entries, filterPerson, filterMonth, filterStatus]);

  const monthlySummary = useMemo(() => {
    const targetMonth = filterMonth !== 'all' ? filterMonth : (months[0] || null);
    if (!targetMonth) return null;
    const monthEntries = entries.filter(e => e.claim_month === targetMonth);
    const byPerson = new Map<string, { name: string; role: string; hours: number; amount: number; entity: string; orgCode: string }>();
    monthEntries.forEach(e => {
      const existing = byPerson.get(e.management_role_key) || { name: e.person_name, role: activeRoles.find(r => r.key === e.management_role_key)?.label || e.management_role_key, hours: 0, amount: 0, entity: e.billing_entity || '', orgCode: e.billing_org_code || '' };
      existing.hours += e.hours;
      existing.amount += e.total_amount;
      byPerson.set(e.management_role_key, existing);
    });
    const draftCount = monthEntries.filter(e => e.status === 'draft').length;
    return { month: targetMonth, items: Array.from(byPerson.values()), totalHours: monthEntries.reduce((s, e) => s + e.hours, 0), totalAmount: monthEntries.reduce((s, e) => s + e.total_amount, 0), draftCount };
  }, [entries, filterMonth, months, activeRoles]);

  const costPreview = selectedRoleConfig && hours ? Number(hours) * selectedRoleConfig.hourly_rate : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm text-muted-foreground">Loading management time...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">NRES Management Time</h3>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => exportManagementTimeDetail(entries)}>
              <Download className="w-3 h-3 mr-1" /> Export Detail
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportManagementMonthlySummary(entries)}>
              <Download className="w-3 h-3 mr-1" /> Export Summary
            </Button>
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground">Track and claim management hours for the NRES programme team</p>

      {/* ── Document Import (NEW) ───────────────────────────────────────────── */}
      {isAdmin && (
        <Collapsible open={importOpen} onOpenChange={setImportOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              {importOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Import claim details from a document
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Upload a Word document, PDF or image (e.g. a diary screenshot or scanned worksheet). We will extract dates, start &amp; end times, hours and a short description into a review table for you to confirm.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx,.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(e) => handleFileSelected(e.target.files?.[0] || undefined)}
                  />
                  <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                    {importing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                    {importing ? 'Extracting…' : 'Choose document'}
                  </Button>
                  {importedFileName && !importing && (
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <FileText className="w-3 h-3" /> {importedFileName}
                    </span>
                  )}
                </div>

                {importedRows.length > 0 && (
                  <div className="space-y-3 border-t pt-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex-1 min-w-[220px]">
                        <Label className="text-xs">Person these entries belong to</Label>
                        <Select value={importPersonRole} onValueChange={setImportPersonRole}>
                          <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                          <SelectContent>
                            {activeRoles.map(r => (
                              <SelectItem key={r.key} value={r.key}>
                                {r.person_name} — {r.label}{r.member_practice ? ` (${r.member_practice})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" onClick={addImportedToEntries} disabled={!importPersonRole || saving}>
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add {importedRows.filter(r => r.include).length} selected to entries
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setImportedRows([]); setImportedFileName(''); }}>
                        <X className="w-3.5 h-3.5 mr-1" /> Discard
                      </Button>
                    </div>

                    <div className="overflow-x-auto border rounded-md">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="p-2 w-8 text-center">Inc.</th>
                            <th className="p-2 text-left font-medium">Date</th>
                            <th className="p-2 text-left font-medium">Start</th>
                            <th className="p-2 text-left font-medium">End</th>
                            <th className="p-2 text-right font-medium">Hours</th>
                            <th className="p-2 text-left font-medium">Description</th>
                            <th className="p-2 w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {importedRows.map(r => (
                            <tr key={r.id} className="border-b">
                              <td className="p-2 text-center">
                                <Checkbox
                                  checked={r.include}
                                  onCheckedChange={(v) => updateImportedRow(r.id, { include: !!v })}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="date"
                                  value={r.work_date}
                                  onChange={(e) => updateImportedRow(r.id, { work_date: e.target.value })}
                                  className="h-7 text-xs"
                                />
                              </td>
                              <td className="p-2">
                                <Input type="time" value={r.start_time} onChange={(e) => updateImportedRow(r.id, { start_time: e.target.value })} className="h-7 text-xs" />
                              </td>
                              <td className="p-2">
                                <Input type="time" value={r.end_time} onChange={(e) => updateImportedRow(r.id, { end_time: e.target.value })} className="h-7 text-xs" />
                              </td>
                              <td className="p-2 text-right">
                                <Input
                                  type="number" min="0.25" step="0.25" max="24"
                                  value={r.hours}
                                  onChange={(e) => updateImportedRow(r.id, { hours: Number(e.target.value) })}
                                  className="h-7 text-xs text-right w-[70px] ml-auto"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  value={r.description}
                                  onChange={(e) => updateImportedRow(r.id, { description: e.target.value })}
                                  className="h-7 text-xs"
                                />
                              </td>
                              <td className="p-2">
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive"
                                  onClick={() => setImportedRows(rs => rs.filter(x => x.id !== r.id))}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Edit any row before adding. Hours auto-recalculate from start/end times.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* ── Add Entry Form ──────────────────────────────────────────────────── */}
      {isAdmin && (
        <Collapsible open={formOpen} onOpenChange={setFormOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              {formOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <Plus className="w-3.5 h-3.5" /> Add Time Entry
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Person</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                      <SelectContent>
                        {activeRoles.map(r => (
                          <SelectItem key={r.key} value={r.key}>
                            {r.person_name} — {r.label}{r.member_practice ? ` (${r.member_practice})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !workDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {workDate ? format(workDate, 'dd/MM/yyyy') : 'Pick date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={workDate}
                          onSelect={(d) => {
                            setWorkDate(d);
                            if (d) lsSet(lsKey(user?.id, 'last-month'), format(d, 'yyyy-MM'));
                          }}
                          defaultMonth={workDate || new Date()}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Claim month: <span className="font-medium text-foreground">{claimMonthLabel}</span>
                    </p>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAdd} disabled={saving || !selectedRole || !workDate || !hours} className="w-full">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                      Add Entry
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Start time</Label>
                    <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">End time</Label>
                    <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Hours</Label>
                    <Input type="number" min="0.25" max="24" step="0.25" value={hours} onChange={e => setHours(e.target.value)} placeholder="e.g. 3.5" />
                    <p className="text-[10px] text-muted-foreground mt-1">Auto-calculated from start/end. Editable.</p>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Description</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Programme Board preparation, practice visit Brackley" />
                </div>
                {costPreview > 0 && selectedRoleConfig && (
                  <p className="text-xs text-muted-foreground">
                    {hours} hours × {fmtGBP(selectedRoleConfig.hourly_rate)}/hr = <span className="font-semibold text-foreground">{fmtGBP(costPreview)}</span>
                  </p>
                )}
                {selectedRoleConfig && (
                  <p className="text-[10px] text-muted-foreground">
                    Billing: {selectedRoleConfig.billing_entity} ({selectedRoleConfig.billing_org_code})
                  </p>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={filterPerson} onValueChange={setFilterPerson}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All people" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All People</SelectItem>
            {activeRoles.map(r => (
              <SelectItem key={r.key} value={r.key}>{r.person_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All months" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {months.map(m => (
              <SelectItem key={m} value={m}>{format(new Date(m), 'MMM yyyy')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {['draft','submitted','approved','invoiced','paid','rejected'].map(s => (
              <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Entries Table */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium">{filtered.length} Entries</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No time entries found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-2 font-medium">Date</th>
                    <th className="text-left p-2 font-medium">Person</th>
                    <th className="text-left p-2 font-medium">Role</th>
                    <th className="text-right p-2 font-medium">Hours</th>
                    <th className="text-right p-2 font-medium">Rate</th>
                    <th className="text-right p-2 font-medium">Amount</th>
                    <th className="text-left p-2 font-medium">Description</th>
                    <th className="text-center p-2 font-medium">Status</th>
                    <th className="text-center p-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => (
                    <tr key={e.id} className="border-b hover:bg-muted/20">
                      <td className="p-2">{format(new Date(e.work_date), 'dd/MM/yyyy')}</td>
                      <td className="p-2 font-medium">{e.person_name}</td>
                      <td className="p-2 text-muted-foreground">{activeRoles.find(r => r.key === e.management_role_key)?.label || e.management_role_key}</td>
                      <td className="p-2 text-right">{e.hours}</td>
                      <td className="p-2 text-right">{fmtGBP(e.hourly_rate)}</td>
                      <td className="p-2 text-right font-medium">{fmtGBP(e.total_amount)}</td>
                      <td className="p-2 max-w-[200px] truncate">{e.description || '—'}</td>
                      <td className="p-2 text-center">
                        <Badge variant="secondary" className={cn('text-[10px]', STATUS_COLOURS[e.status])}>{e.status}</Badge>
                      </td>
                      <td className="p-2 text-center">
                        {e.status === 'draft' && isAdmin && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteEntry(e.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Summary */}
      {monthlySummary && monthlySummary.items.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium">{format(new Date(monthlySummary.month), 'MMMM yyyy')} Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-2 font-medium">Person</th>
                  <th className="text-left p-2 font-medium">Role</th>
                  <th className="text-right p-2 font-medium">Hours</th>
                  <th className="text-right p-2 font-medium">Amount</th>
                  <th className="text-left p-2 font-medium">Billing Entity</th>
                  <th className="text-left p-2 font-medium">Org Code</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummary.items.map((item, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2 font-medium">{item.name}</td>
                    <td className="p-2 text-muted-foreground">{item.role}</td>
                    <td className="p-2 text-right">{item.hours}</td>
                    <td className="p-2 text-right font-medium">{fmtGBP(item.amount)}</td>
                    <td className="p-2">{item.entity}</td>
                    <td className="p-2">{item.orgCode}</td>
                  </tr>
                ))}
                <tr className="bg-muted/30 font-semibold">
                  <td className="p-2" colSpan={2}>Total</td>
                  <td className="p-2 text-right">{monthlySummary.totalHours}</td>
                  <td className="p-2 text-right">{fmtGBP(monthlySummary.totalAmount)}</td>
                  <td className="p-2" colSpan={2}></td>
                </tr>
              </tbody>
            </table>
            {isAdmin && monthlySummary.draftCount > 0 && (
              <div className="p-3 border-t flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{monthlySummary.draftCount} draft entries ready to submit</p>
                <Button size="sm" onClick={() => submitMonth(monthlySummary.month)} disabled={saving}>
                  <Send className="w-3.5 h-3.5 mr-1" /> Submit Monthly Claim
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
