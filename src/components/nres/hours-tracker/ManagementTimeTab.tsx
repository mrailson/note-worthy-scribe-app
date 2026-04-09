import { useState, useMemo } from 'react';
import { useNRESManagementTime, type ManagementRoleConfig } from '@/hooks/useNRESManagementTime';
import { useNRESBuyBackRateSettings } from '@/hooks/useNRESBuyBackRateSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Loader2, Plus, Trash2, Send, CalendarIcon, ChevronDown, ChevronRight, ClipboardList, Download } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { exportManagementTimeDetail, exportManagementMonthlySummary } from '@/utils/buybackExcelExport';

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

export function ManagementTimeTab({ isAdmin }: { isAdmin: boolean }) {
  const { entries, loading, saving, addEntry, deleteEntry, submitMonth } = useNRESManagementTime();
  const { settings } = useNRESBuyBackRateSettings();
  const mgmtRoles = (settings as any).management_roles_config as ManagementRoleConfig[] | undefined;
  const activeRoles = useMemo(() => (mgmtRoles || []).filter(r => r.is_active), [mgmtRoles]);

  // Add entry form state
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [workDate, setWorkDate] = useState<Date | undefined>(undefined);
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');

  // Filters
  const [filterPerson, setFilterPerson] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const selectedRoleConfig = useMemo(() => activeRoles.find(r => r.key === selectedRole), [activeRoles, selectedRole]);

  const claimMonthForDate = (d: Date) => format(startOfMonth(d), 'yyyy-MM-dd');

  const handleAdd = async () => {
    if (!selectedRoleConfig || !workDate || !hours || Number(hours) <= 0) return;
    await addEntry({
      management_role_key: selectedRoleConfig.key,
      person_name: selectedRoleConfig.person_name,
      work_date: format(workDate, 'yyyy-MM-dd'),
      hours: Number(hours),
      description: description || undefined,
      claim_month: claimMonthForDate(workDate),
      billing_entity: selectedRoleConfig.billing_entity,
      billing_org_code: selectedRoleConfig.billing_org_code,
      hourly_rate: selectedRoleConfig.hourly_rate,
    });
    setHours('');
    setDescription('');
    setWorkDate(undefined);
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

  // Monthly summary
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

      {/* Add Entry Form */}
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Person</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                      <SelectContent>
                        {activeRoles.map(r => (
                          <SelectItem key={r.key} value={r.key}>{r.person_name} — {r.label}</SelectItem>
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
                        <Calendar mode="single" selected={workDate} onSelect={setWorkDate} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="text-xs">Hours</Label>
                    <Input type="number" min="0.25" max="24" step="0.25" value={hours} onChange={e => setHours(e.target.value)} placeholder="e.g. 3.5" />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAdd} disabled={saving || !selectedRole || !workDate || !hours} className="w-full">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                      Add Entry
                    </Button>
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
