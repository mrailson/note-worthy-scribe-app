import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { exportClaimsDetail, exportMonthlySummary, exportYTDRunningTotals } from '@/utils/buybackExcelExport';
import { TestModeBar, type TestModeState } from './TestModeBar';
import { useAuth } from '@/contexts/AuthContext';
import { useNRESSystemRoles } from '@/hooks/useNRESSystemRoles';
import { useNRESBuyBackStaff, type BuyBackStaffMember } from '@/hooks/useNRESBuyBackStaff';
import { useNRESBuyBackClaims, calculateStaffMonthlyAmount, type BuyBackClaim, type RateParams } from '@/hooks/useNRESBuyBackClaims';
import { useNRESBuyBackAccess } from '@/hooks/useNRESBuyBackAccess';
import { maskStaffName, isBuybackApprover } from '@/utils/buybackStaffMasking';
import { StaffLineEvidence, useStaffLineEvidenceComplete } from './ClaimEvidencePanel';
import { UnclaimedFundsIndicator } from './UnclaimedFundsIndicator';
import { ManagementTimeTab } from './ManagementTimeTab';
import { ClaimsUserGuide } from './ClaimsUserGuide';
import { useNRESClaimEvidence } from '@/hooks/useNRESClaimEvidence';
import { useNRESEvidenceConfig } from '@/hooks/useNRESEvidenceConfig';
import { NRES_PRACTICES, NRES_PRACTICE_KEYS, NRES_ODS_CODES, getPracticeName, type NRESPracticeKey } from '@/data/nresPractices';
import { ENN_PRACTICES, ENN_PRACTICE_KEYS, type ENNPracticeKey } from '@/data/ennPractices';
import { PaymentWorkflowPanel } from './PaymentWorkflowPanel';

import { InfoTooltip } from '@/components/nres/InfoTooltip';
import { useNRESBuyBackRateSettings } from '@/hooks/useNRESBuyBackRateSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { Loader2, Plus, Trash2, Send, Users, FileText, Info, MessageSquarePlus, CalendarIcon, Calculator, CheckCircle2, XCircle, AlertTriangle, Download, ChevronRight, Pencil, ArrowUpDown, ArrowUp, ArrowDown, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EditStaffDialog } from './EditStaffDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

/** Format a number as £X,XXX.XX */
function fmtGBP(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Build a human-readable calculation breakdown for the live preview */
function calcBreakdown(allocType: 'sessions' | 'wte' | 'hours' | 'daily', allocValue: number, rateParams?: RateParams, role?: string, category?: string, hourlyRate?: number): string {
  // Management: hourly_rate × weekly_hours × working_weeks
  if ((category === 'management' || role === 'NRES Management') && hourlyRate && rateParams?.workingWeeksInMonth) {
    const ww = rateParams.workingWeeksInMonth;
    const bhNote = rateParams.bankHolidaysInMonth ? ` (${rateParams.bankHolidaysInMonth} bank hol${rateParams.bankHolidaysInMonth > 1 ? 's' : ''} excluded)` : '';
    return `${allocValue} hrs/wk × ${ww.toFixed(1)} working weeks${bhNote} × ${fmtGBP(hourlyRate)}/hr`;
  }

  const roleConfig = rateParams?.getRoleConfig?.(role ?? '');
  const includesOnCosts = roleConfig?.includes_on_costs !== false;
  const niPct = rateParams?.employerNiPct ?? 15;
  const penPct = rateParams?.employerPensionPct ?? 14.38;
  const totalPct = niPct + penPct;
  const onCostsLabel = includesOnCosts 
    ? `inc. ${totalPct.toFixed(2)}% on-costs (NI ${niPct}% + Pension ${penPct}%)`
    : 'excl. on-costs (Locum)';

  let baseRate = '£11,000';
  if (rateParams?.getRoleAnnualRate && role) {
    const r = rateParams.getRoleAnnualRate(role);
    if (r !== undefined) baseRate = fmtGBP(r);
  }

  if (allocType === 'daily') {
    const dailyRate = roleConfig?.daily_rate ?? allocValue;
    const workingDays = rateParams?.workingDaysInMonth ?? 21.67;
    return `${fmtGBP(dailyRate)}/day × ${workingDays} working days — excl. on-costs (Locum)`;
  }
  if (allocType === 'sessions') {
    return `${allocValue} session${allocValue !== 1 ? 's' : ''} × ${baseRate}/yr ÷ 12 months — ${onCostsLabel}`;
  }
  if (allocType === 'hours') {
    const wteRatio = (allocValue / 37.5).toFixed(2);
    return `${allocValue} hrs/wk ÷ 37.5 = ${wteRatio} WTE × ${baseRate}/yr ÷ 12 months — ${onCostsLabel}`;
  }
  return `${allocValue} WTE × ${baseRate}/yr ÷ 12 months — ${onCostsLabel}`;
}

const DECLARATION_TEXT =
  "I confirm that all staff listed are working 100% on SDA (Part A) during their funded hours, with no LTC (Part B) activity, in accordance with the ICB-approved buy-back rules.";

// STAFF_ROLES is now dynamic — see BuyBackClaimsTab below

/** Isolated add-staff form – keeps its own state so typing never loses focus */
function AddStaffForm({ saving, onAdd, staffRoles, rateParams, practiceKeys, practiceNames, managementRoles }: {
  saving: boolean;
  onAdd: (member: Omit<BuyBackStaffMember, 'id' | 'user_id' | 'practice_id' | 'created_at' | 'updated_at'>) => Promise<any>;
  staffRoles: string[];
  rateParams?: RateParams;
  practiceKeys: string[];
  practiceNames: Record<string, string>;
  managementRoles?: import('@/hooks/useNRESBuyBackRateSettings').ManagementRoleConfig[];
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('GP');
  const [allocType, setAllocType] = useState<'sessions' | 'wte' | 'hours' | 'daily'>('sessions');
  const [allocValue, setAllocValue] = useState('');
  const [category, setCategory] = useState<'buyback' | 'new_sda' | 'management'>('buyback');
  const [practice, setPractice] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [selectedMgmtKey, setSelectedMgmtKey] = useState('');

  // Management category only available for bugbrooke and bt_pcn
  const managementPractices = ['bugbrooke', 'bt_pcn'];
  const canShowManagement = managementPractices.includes(practice);

  // Reset category if practice changes to one that doesn't support management
  const handlePracticeChange = (newPractice: string) => {
    setPractice(newPractice);
    if (!managementPractices.includes(newPractice) && category === 'management') {
      setCategory('buyback');
      setName('');
      setSelectedMgmtKey('');
      setRole('GP');
      setAllocType('sessions');
      setAllocValue('');
    }
  };

  // Filter management roles by matching the practice's ODS code or name to billing config
  const availableMgmtRoles = useMemo(() => {
    if (!managementRoles || !practice) return [];
    const practiceOdsCode = NRES_ODS_CODES[practice as NRESPracticeKey] ?? '';
    const practiceName = NRES_PRACTICES[practice as NRESPracticeKey] ?? '';
    return managementRoles.filter(r => r.is_active && (
      r.billing_org_code === practiceOdsCode ||
      r.billing_entity === practiceName
    ));
  }, [managementRoles, practice]);

  // When management person is selected from picklist
  const handleMgmtPersonChange = (key: string) => {
    setSelectedMgmtKey(key);
    const mgmtRole = availableMgmtRoles.find(r => r.key === key);
    if (mgmtRole) {
      setName(mgmtRole.person_name);
      setRole('NRES Management');
      setAllocType('hours');
      setAllocValue(String(mgmtRole.max_hours_per_week));
    }
  };

  // When category changes
  const handleCategoryChange = (newCat: 'buyback' | 'new_sda' | 'management') => {
    setCategory(newCat);
    if (newCat === 'management') {
      setRole('NRES Management');
      setAllocType('hours');
      setAllocValue('');
      setName('');
      setSelectedMgmtKey('');
    } else {
      setSelectedMgmtKey('');
      if (role === 'NRES Management') {
        setRole('GP');
        setAllocType('sessions');
        setAllocValue('');
        setName('');
      }
    }
  };

  // Default allocation type based on role
  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    // Look up default allocation from role config
    const roleConfig = rateParams?.getRoleConfig?.(newRole);
    if (roleConfig?.allocation_default === 'daily') {
      setAllocType('daily');
    } else if (newRole === 'ANP' || newRole === 'ACP') {
      setAllocType('hours');
    } else if (newRole === 'GP') {
      setAllocType('daily');
    }
  };

  const isManagement = category === 'management';
  const selectedMgmtRole = isManagement ? availableMgmtRoles.find(r => r.key === selectedMgmtKey) : undefined;

  const maxAlloc = allocType === 'wte' ? 1 : allocType === 'hours' ? 37.5 : allocType === 'daily' ? 2000 : 9;

  const handleAllocValueChange = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num > maxAlloc) {
      setAllocValue(String(maxAlloc));
      return;
    }
    setAllocValue(val);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !allocValue || !practice) return;
    const numVal = parseFloat(allocValue);
    if (allocType === 'wte' && numVal > 1) return;
    await onAdd({
      staff_name: name.trim(),
      staff_role: role,
      allocation_type: allocType,
      allocation_value: numVal,
      hourly_rate: selectedMgmtRole?.hourly_rate ?? 0,
      is_active: true,
      staff_category: category,
      practice_key: practice,
      start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
    });
    setName('');
    setAllocValue('');
    setStartDate(undefined);
    setSelectedMgmtKey('');
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-2 items-end">
        <div>
          <Label className="text-xs">Practice</Label>
          <Select value={practice} onValueChange={handlePracticeChange}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {practiceKeys.map(k => (
                <SelectItem key={k} value={k}>{practiceNames[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Category</Label>
          <Select value={category} onValueChange={v => handleCategoryChange(v as 'buyback' | 'new_sda' | 'management')}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="buyback">Buy-Back</SelectItem>
              <SelectItem value="new_sda">New SDA</SelectItem>
              {canShowManagement && <SelectItem value="management">Management</SelectItem>}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Name</Label>
          {isManagement ? (
            <Select value={selectedMgmtKey} onValueChange={handleMgmtPersonChange}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select person" /></SelectTrigger>
              <SelectContent>
                {availableMgmtRoles.map(r => (
                  <SelectItem key={r.key} value={r.key}>{r.person_name} — {r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input id="staff-name" className="h-9" value={name} onChange={e => setName(e.target.value)} placeholder="Staff name" />
          )}
        </div>
        <div>
          <Label className="text-xs">Role</Label>
          {isManagement ? (
            <Input className="h-9 bg-muted" value="NRES Management" disabled />
          ) : (
            <Select value={role} onValueChange={handleRoleChange}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {staffRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <div>
          <Label className="text-xs">Allocation Type</Label>
          {isManagement ? (
            <Input className="h-9 bg-muted" value="Hrs/wk" disabled />
          ) : (
             <Select value={allocType} onValueChange={v => { setAllocType(v as 'sessions' | 'wte' | 'hours' | 'daily'); setAllocValue(''); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sessions">Sessions</SelectItem>
                <SelectItem value="hours">Hrs/wk</SelectItem>
                <SelectItem value="wte">WTE</SelectItem>
                <SelectItem value="daily">Daily Rate</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div>
          <Label className="text-xs">
            {allocType === 'sessions' ? 'Weekly Sessions' : allocType === 'hours' ? 'Weekly Hours' : allocType === 'daily' ? 'Daily Rate (£)' : 'WTE Value'}
          </Label>
          <Input
            type="number"
            className={cn("h-9 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none", isManagement && "bg-muted")}
            value={allocValue}
            onChange={e => handleAllocValueChange(e.target.value)}
            placeholder="0"
            min="0"
            max={maxAlloc}
            step={allocType === 'wte' ? 0.1 : 1}
            disabled={isManagement && !!selectedMgmtKey}
          />
        </div>
        <div>
          <div className="flex items-center gap-1">
            <Label className="text-xs">Start Date</Label>
            <InfoTooltip content="Leave blank if the staff member started before the claim month. Only set a date if they started during the claim month — this triggers pro-rata calculation." />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("h-9 w-full justify-start text-left font-normal text-xs", !startDate && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-1 h-3 w-3" />
                {startDate ? format(startDate, 'dd/MM/yyyy') : 'Select'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-end">
          <Button className="h-9" onClick={handleSubmit} disabled={saving || !name.trim() || !practice || !allocValue} size="icon">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {/* Live monthly amount preview with calculation breakdown */}
      {allocValue && parseFloat(allocValue) > 0 && (() => {
        const val = parseFloat(allocValue);
        const hourlyRate = selectedMgmtRole?.hourly_rate ?? 0;
        const monthly = calculateStaffMonthlyAmount({
          allocation_type: allocType,
          allocation_value: val,
          hourly_rate: hourlyRate,
          staff_role: role,
          staff_category: category,
        } as any, undefined, undefined, rateParams);
        return (
          <div className="rounded-md bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800 px-3 py-2 text-sm space-y-1">
            <div>
              <span className="text-muted-foreground">Max monthly claim: </span>
              <span className="font-semibold text-teal-800 dark:text-teal-200">{fmtGBP(monthly)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {calcBreakdown(allocType, val, rateParams, role, category, hourlyRate)} = {fmtGBP(monthly)}/month
            </p>
          </div>
        );
      })()}
    </>
  );
}

export function BuyBackClaimsTab({ neighbourhoodName = 'NRES' }: { neighbourhoodName?: 'NRES' | 'ENN' } = {}) {
  const isENN = neighbourhoodName === 'ENN';
  const practiceCount = isENN ? '10' : '7';
  const contractValue = isENN ? '£2.38M' : '£2.34M';
  const patientCount = isENN ? '~90,241' : '~89,584';
  const neighbourhoodLabel = isENN ? 'ENN' : 'NRES';
  const managerName = isENN ? 'Rebecca Gane (Transformation Manager, 3Sixty Care Partnership)' : 'Malcolm Railson (Neighbourhood Manager, PCN Services Ltd)';
  const { user } = useAuth();
  const { activeStaff, loading: loadingStaff, saving: savingStaff, admin, addStaff, updateStaff, removeStaff } = useNRESBuyBackStaff();
  const { staffRoles, settings: rateSettings, onCostMultiplier, getAnnualRate, loading: loadingRates } = useNRESBuyBackRateSettings();
  const emailConfig = useMemo(() => ({
    emailTestingMode: rateSettings.email_testing_mode,
    currentUserEmail: user?.email || undefined,
    currentUserName: user?.user_metadata?.full_name || user?.email || undefined,
  }), [rateSettings.email_testing_mode, user?.email, user?.user_metadata?.full_name]);
  const { claims, loading: loadingClaims, saving: savingClaim, admin: claimAdmin, createClaim, submitClaim, verifyClaim, queryClaim, approveClaim, rejectClaim, updatePaymentStatus, confirmDeclaration, deleteClaim, updateClaimAmount, updateStaffClaimedAmount, removeStaffFromClaim, updateStaffNotes, updateStaffLine } = useNRESBuyBackClaims(emailConfig);
  const { myPractices, mySubmitPractices, myApproverPractices, myVerifierPractices, loading: loadingAccess, admin: accessAdmin, hasAccess, grantAccess, revokeByKey } = useNRESBuyBackAccess();

  // New claim state — declared early so bank holidays can reference claimMonth
  const [claimMonth, setClaimMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Fetch bank holidays for working-weeks calculation (management claims)
  const [bankHolidayData, setBankHolidayData] = useState<{ date: string; name: string }[]>([]);
  useEffect(() => {
    const fetchBH = async () => {
      try {
        const { data } = await (supabase as any)
          .from('bank_holidays_closed_days')
          .select('date, name')
          .eq('type', 'bank_holiday');
        if (data) setBankHolidayData(data.map((r: any) => ({ date: r.date, name: r.name })));
      } catch { /* ignore */ }
    };
    fetchBH();
  }, []);

  const bankHolidayDates = useMemo(() => bankHolidayData.map(b => b.date), [bankHolidayData]);

  const { getWorkingWeeksInMonth: calcWorkingWeeks, getWorkingDaysInMonth: calcWorkingDays } = useMemo(() => {
    // Inline helpers using fetched bank holidays
    const getWorkingDaysInMonth = (claimMonth: string): number => {
      const start = new Date(claimMonth);
      const year = start.getFullYear();
      const month = start.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      let weekdays = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const day = new Date(year, month, d).getDay();
        if (day !== 0 && day !== 6) weekdays++;
      }
      const bhInMonth = bankHolidayDates.filter(dateStr => {
        const bh = new Date(dateStr);
        return bh.getFullYear() === year && bh.getMonth() === month && bh.getDay() !== 0 && bh.getDay() !== 6;
      });
      return weekdays - bhInMonth.length;
    };
    const getWorkingWeeksInMonth = (claimMonth: string): number => getWorkingDaysInMonth(claimMonth) / 5;
    return { getWorkingWeeksInMonth, getWorkingDaysInMonth };
  }, [bankHolidayDates]);

  // Get bank holidays in a specific month with names and formatted dates
  const getBankHolidaysInMonth = useCallback((claimMonth: string): number => {
    const start = new Date(claimMonth);
    const year = start.getFullYear();
    const month = start.getMonth();
    return bankHolidayDates.filter(dateStr => {
      const bh = new Date(dateStr);
      return bh.getFullYear() === year && bh.getMonth() === month && bh.getDay() !== 0 && bh.getDay() !== 6;
    }).length;
  }, [bankHolidayDates]);

  const getBankHolidayDetailsInMonth = useCallback((claimMonth: string): { date: string; name: string; formatted: string }[] => {
    const start = new Date(claimMonth);
    const year = start.getFullYear();
    const month = start.getMonth();
    const ordinal = (n: number) => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    return bankHolidayData
      .filter(b => {
        const bh = new Date(b.date);
        return bh.getFullYear() === year && bh.getMonth() === month && bh.getDay() !== 0 && bh.getDay() !== 6;
      })
      .map(b => {
        const d = new Date(b.date);
        const dayName = d.toLocaleDateString('en-GB', { weekday: 'long' });
        const dayNum = d.getDate();
        const monthName = d.toLocaleDateString('en-GB', { month: 'long' });
        return { date: b.date, name: b.name, formatted: `${dayName} ${ordinal(dayNum)} ${monthName}` };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [bankHolidayData]);

  // Build rateParams with working weeks for the current claim month
  const claimMonthDate = `${claimMonth}-01`;
  const workingWeeksForMonth = calcWorkingWeeks(claimMonthDate);
  const bankHolidaysForMonth = getBankHolidaysInMonth(claimMonthDate);
  const bankHolidayDetailsForMonth = getBankHolidayDetailsInMonth(claimMonthDate);

  const rateParams: RateParams = {
    onCostMultiplier,
    getRoleAnnualRate: (label) => { const v = getAnnualRate(label); return v > 0 ? v : undefined; },
    getRoleConfig: (label) => rateSettings.roles_config.find(r => r.label.toLowerCase() === label.toLowerCase()),
    employerNiPct: rateSettings.employer_ni_pct,
    employerPensionPct: rateSettings.employer_pension_pct,
    workingWeeksInMonth: workingWeeksForMonth,
    workingDaysInMonth: calcWorkingDays(claimMonthDate),
    bankHolidaysInMonth: bankHolidaysForMonth,
    bankHolidayDetails: bankHolidayDetailsForMonth,
  };

  const { roles, isPMLFinance, isPMLDirector, isAnyPML, isManagementLead, isSuperAdmin } = useNRESSystemRoles();
  const pmlFinanceEmails = roles.filter(r => r.role === 'pml_finance' && r.is_active).map(r => r.user_email);

  // isAdmin = NRES_ADMIN_EMAILS check; elevate PML role holders to see all claims
  const isAdmin = admin || isPMLFinance || isPMLDirector || isManagementLead || isSuperAdmin;

  // Test mode state — UI-only, admin users only
  const [testMode, setTestMode] = useState<TestModeState>({ enabled: true, role: 'admin' });
  const testActive = isAdmin && testMode.enabled && testMode.role !== 'admin';

  const [claimPractice, setClaimPractice] = useState<string>('');

  // Filters (admin)
  const [filterPractice, setFilterPractice] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>(isPMLFinance ? 'approved' : 'all');

  const [proposalOpen, setProposalOpen] = useState(false);
  const [claimsHistoryOpen, setClaimsHistoryOpen] = useState(isPMLFinance);
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);
  const [editingStaff, setEditingStaff] = useState<BuyBackStaffMember | null>(null);
  const [staffSortCol, setStaffSortCol] = useState<string>('practice');
  const [staffSortDir, setStaffSortDir] = useState<'asc' | 'desc'>('asc');
  const isLoading = loadingStaff || loadingClaims || loadingAccess || loadingRates;

  // Determine which practices to show based on access assignments
  const ALL_PRACTICE_KEYS = isENN ? ENN_PRACTICE_KEYS as string[] : NRES_PRACTICE_KEYS as string[];
  const ALL_PRACTICES: Record<string, string> = isENN ? ENN_PRACTICES : NRES_PRACTICES;
  const resolvePracticeName = (key: string | null | undefined) => {
    if (!key) return '—';
    return ALL_PRACTICES[key] ?? getPracticeName(key);
  };

  // === Test mode overrides ===
  const effectiveIsAdmin = testActive ? (testMode.role !== 'practice') : isAdmin;
  const effectiveFilterPractice = testActive && testMode.role === 'practice' && testMode.selectedPractice
    ? testMode.selectedPractice
    : filterPractice;
  const effectiveFilterStatus = testActive
    ? (testMode.role === 'mgmt_lead' ? 'submitted'
      : testMode.role === 'pml_director' ? filterStatus
      : testMode.role === 'pml_finance' ? filterStatus
      : testMode.role === 'practice' ? 'all'
      : filterStatus)
    : filterStatus;
  const effectiveCanCreateClaim = !testActive || testMode.role === 'admin' || testMode.role === 'practice';
  const effectiveShowStaffMgmt = !testActive || testMode.role === 'admin' || testMode.role === 'practice';

  // System-level admins (super_admin, management_lead, etc.) always see all practices
  const hasAnyAssignment = myPractices.length > 0;
  const accessFilteredPracticeKeys = (isSuperAdmin || isManagementLead || isPMLDirector || isPMLFinance)
    ? ALL_PRACTICE_KEYS
    : (isAdmin && !hasAnyAssignment)
      ? ALL_PRACTICE_KEYS
      : ALL_PRACTICE_KEYS.filter(k => myPractices.includes(k));

  // In practice test mode, lock to selected practice
  const effectivePracticeKeys = testActive && testMode.role === 'practice' && testMode.selectedPractice
    ? [testMode.selectedPractice]
    : accessFilteredPracticeKeys;

  // Practices user can submit claims for
  const submitPracticeKeys = testActive && testMode.role === 'practice' && testMode.selectedPractice
    ? [testMode.selectedPractice]
    : (isAdmin && !hasAnyAssignment
      ? ALL_PRACTICE_KEYS
      : ALL_PRACTICE_KEYS.filter(k => mySubmitPractices.includes(k)));

  // Auto-set practice selections when in practice test mode
  const testPracticeLocked = testActive && testMode.role === 'practice' && testMode.selectedPractice;
  const effectiveClaimPractice = testPracticeLocked ? testMode.selectedPractice! : claimPractice;
  const effectiveFilterPracticeForStaff = testPracticeLocked ? testMode.selectedPractice! : effectiveFilterPractice;

  // Filter staff by practice — respect access assignments (use effective keys for test mode)
  const accessFilteredStaff = activeStaff.filter(s =>
    !s.practice_key || effectivePracticeKeys.includes(s.practice_key as string)
  );
  const filteredStaff = effectiveFilterPracticeForStaff === 'all'
    ? accessFilteredStaff
    : accessFilteredStaff.filter(s => s.practice_key === effectiveFilterPracticeForStaff);

  const totalCalculated = filteredStaff.reduce((sum, s) => sum + calculateStaffMonthlyAmount(s, undefined, undefined, rateParams), 0);

  const claimsHistoryRef = useRef<HTMLDivElement>(null);

  const handleCreateClaim = async () => {
    if (filteredStaff.length === 0) {
      toast.error('No staff members found for this practice');
      return;
    }
    const practiceForClaim = effectiveClaimPractice || (effectiveFilterPractice !== 'all' ? effectiveFilterPractice : '');
    if (!practiceForClaim) {
      toast.error('Please select a practice');
      return;
    }
    const monthDate = `${claimMonth}-01`;
    // Use filteredStaff directly — already filtered by the effective practice
    const staffForClaim = filteredStaff.filter(s => !s.practice_key || s.practice_key === practiceForClaim);
    if (staffForClaim.length === 0) {
      toast.error('No staff matched for the selected practice — check staff assignments');
      console.warn('handleCreateClaim: staffForClaim empty. practiceForClaim:', practiceForClaim, 'filteredStaff practice_keys:', filteredStaff.map(s => s.practice_key));
      return;
    }
    const calcAmount = staffForClaim.reduce((sum, s) => sum + calculateStaffMonthlyAmount(s, monthDate, s.start_date, rateParams), 0);
    const result = await createClaim(monthDate, staffForClaim, calcAmount, calcAmount, practiceForClaim, rateParams);

    // After successful creation, open claims history and scroll to it
    if (result) {
      setClaimsHistoryOpen(true);
      setTimeout(() => {
        claimsHistoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  };

  // Filter claims by access then practice/status (use effective overrides for test mode)
  const accessFilteredClaims = claims.filter(c =>
    !c.practice_key || effectivePracticeKeys.includes(c.practice_key as string)
  );
  const practiceFilteredClaims = effectiveFilterPractice === 'all'
    ? accessFilteredClaims
    : accessFilteredClaims.filter(c => c.practice_key === effectiveFilterPractice);

  const filteredClaims = effectiveFilterStatus === 'all'
    ? practiceFilteredClaims
    : practiceFilteredClaims.filter(c => c.status === effectiveFilterStatus);

  // Status counts for badges
  const statusCounts = {
    all: practiceFilteredClaims.length,
    submitted: practiceFilteredClaims.filter(c => c.status === 'submitted').length,
    verified: practiceFilteredClaims.filter(c => c.status === 'verified').length,
    approved: practiceFilteredClaims.filter(c => c.status === 'approved').length,
    queried: practiceFilteredClaims.filter(c => c.status === 'queried').length,
    invoiced: practiceFilteredClaims.filter(c => c.status === 'invoiced').length,
    paid: practiceFilteredClaims.filter(c => c.status === 'paid').length,
    rejected: practiceFilteredClaims.filter(c => c.status === 'rejected').length,
    draft: practiceFilteredClaims.filter(c => c.status === 'draft').length,
  };

  // Auto-expand claims section when there are claims to show
  useEffect(() => {
    if (!hasAutoExpanded && filteredClaims.length > 0) {
      setClaimsHistoryOpen(true);
      setHasAutoExpanded(true);
    }
  }, [filteredClaims.length, hasAutoExpanded]);

  const categoryBadge = (cat: string) => {
    if (cat === 'new_sda') return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs">New SDA</Badge>;
    if (cat === 'management') return <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 text-xs">Management</Badge>;
    return <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 text-xs">Buy-Back</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Test Mode Bar — admin only */}
      {isAdmin && (
        <TestModeBar
          state={testMode}
          onChange={setTestMode}
          practiceKeys={ALL_PRACTICE_KEYS}
          practiceNames={ALL_PRACTICES}
        />
      )}


      {effectiveIsAdmin && !testActive && (
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium">Filter by Practice:</Label>
          <Select value={filterPractice} onValueChange={setFilterPractice}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All practices" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Practices</SelectItem>
              {effectivePracticeKeys.map(k => (
                <SelectItem key={k} value={k}>{ALL_PRACTICES[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Staff Management — hidden in mgmt_lead, pml_director, pml_finance test modes */}
      {effectiveShowStaffMgmt && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5" />
            {neighbourhoodLabel} SDA Staff Claim &amp; Buy-Back Staff Claim
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddStaffForm saving={savingStaff} onAdd={addStaff} staffRoles={staffRoles} rateParams={rateParams} practiceKeys={effectivePracticeKeys} practiceNames={ALL_PRACTICES} managementRoles={rateSettings.management_roles_config} />

          {/* Staff list */}
          {filteredStaff.length > 0 && (() => {
            const toggleSort = (col: string) => {
              if (staffSortCol === col) {
                setStaffSortDir(d => d === 'asc' ? 'desc' : 'asc');
              } else {
                setStaffSortCol(col);
                setStaffSortDir('asc');
              }
            };
            const SortIcon = ({ col }: { col: string }) => {
              if (staffSortCol !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
              return staffSortDir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
            };
            const sortedStaff = [...filteredStaff].sort((a, b) => {
              const dir = staffSortDir === 'asc' ? 1 : -1;
              switch (staffSortCol) {
                case 'practice': return dir * (resolvePracticeName(a.practice_key)).localeCompare(resolvePracticeName(b.practice_key));
                case 'category': return dir * (a.staff_category || '').localeCompare(b.staff_category || '');
                case 'name': return dir * (a.staff_name || '').localeCompare(b.staff_name || '');
                case 'role': return dir * (a.staff_role || '').localeCompare(b.staff_role || '');
                case 'allocation': return dir * ((a.allocation_value || 0) - (b.allocation_value || 0));
                case 'start_date': return dir * ((a.start_date || '').localeCompare(b.start_date || ''));
                case 'monthly': return dir * (calculateStaffMonthlyAmount(a, undefined, undefined, rateParams) - calculateStaffMonthlyAmount(b, undefined, undefined, rateParams));
                default: return 0;
              }
            });
            return (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                   <tr>
                     {[
                       { key: 'practice', label: 'Practice', align: 'left' },
                       { key: 'category', label: 'Category', align: 'left' },
                       { key: 'name', label: 'Name', align: 'left' },
                       { key: 'role', label: 'Role', align: 'left' },
                       { key: 'allocation', label: 'Allocation', align: 'left' },
                       { key: 'start_date', label: 'Start Date', align: 'left' },
                       { key: 'monthly', label: 'Monthly Max Claim', align: 'right' },
                     ].map(col => (
                       <th
                         key={col.key}
                         className={cn("p-2 font-medium cursor-pointer select-none hover:bg-muted/80 transition-colors", col.align === 'right' ? 'text-right' : 'text-left')}
                         onClick={() => toggleSort(col.key)}
                       >
                         <span className="inline-flex items-center">
                           {col.label}
                           <SortIcon col={col.key} />
                         </span>
                       </th>
                     ))}
                     <th className="p-2"></th>
                   </tr>
                 </thead>
                 <tbody>
                   {sortedStaff.map(s => {
                     const displayName = maskStaffName(s.staff_name, user?.id, s.user_id, user?.email);
                     const monthly = calculateStaffMonthlyAmount(s, undefined, undefined, rateParams);
                     return (
                       <tr key={s.id} className="border-t">
                          <td className="p-2 text-xs">{resolvePracticeName(s.practice_key)}</td>
                          <td className="p-2">{categoryBadge(s.staff_category)}</td>
                         <td className="p-2">{displayName}</td>
                         <td className="p-2">{s.staff_role}</td>
                         <td className="p-2">{s.allocation_type === 'daily' ? `${fmtGBP(s.allocation_value)}/day` : `${s.allocation_value} ${s.allocation_type}`}</td>
                         <td className="p-2 text-xs">{s.start_date ? format(new Date(s.start_date), 'dd/MM/yyyy') : <span className="text-muted-foreground italic">Prior to claim month</span>}</td>
                          <td className="p-2 text-right font-medium">
                            <CalcBreakdownHover staff={s} amount={monthly} rateParams={rateParams} />
                          </td>
                          <td className="p-2 text-right space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => setEditingStaff(s)}>
                              <Pencil className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Staff Member</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to remove <span className="font-semibold">{displayName}</span> from the staff list? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => removeStaff(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                           </td>
                       </tr>
                     );
                   })}
                   <tr className="border-t bg-muted/30 font-semibold">
                     <td colSpan={7} className="p-2 text-right">Total Calculated Monthly</td>
                     <td className="p-2 text-right">{fmtGBP(totalCalculated)}</td>
                     <td></td>
                   </tr>
                </tbody>
              </table>
            </div>
            );
          })()}
        </CardContent>
      </Card>
      )}

      <EditStaffDialog
        open={!!editingStaff}
        onOpenChange={(open) => { if (!open) setEditingStaff(null); }}
        staff={editingStaff}
        saving={savingStaff}
        onSave={updateStaff}
        staffRoles={staffRoles}
        practiceKeys={effectivePracticeKeys}
        practiceNames={ALL_PRACTICES}
      />

      {effectiveCanCreateClaim && <Separator />}

      {/* Create Claim — hidden in mgmt_lead, pml_director, pml_finance test modes */}
      {effectiveCanCreateClaim && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5" />
            Create Monthly Claim
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label>Practice</Label>
              <Select value={effectiveClaimPractice} onValueChange={setClaimPractice} disabled={!!testPracticeLocked}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select practice" />
                </SelectTrigger>
                <SelectContent>
                  {submitPracticeKeys.map(k => (
                    <SelectItem key={k} value={k}>{ALL_PRACTICES[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Claim Month</Label>
              <Input type="month" value={claimMonth} onChange={e => setClaimMonth(e.target.value)} />
            </div>
            <Button onClick={handleCreateClaim} disabled={savingClaim || filteredStaff.length === 0 || !effectiveClaimPractice}>
              {savingClaim ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Claim
            </Button>
          </div>
          {filteredStaff.length === 0 && (
            <p className="text-sm text-muted-foreground">Add staff members above before creating a claim.</p>
          )}
          {!effectiveClaimPractice && filteredStaff.length > 0 && (
            <p className="text-sm text-muted-foreground">Select a practice to create a claim.</p>
          )}
        </CardContent>
      </Card>
      )}

      <Separator />

      {/* Claims */}
      <div ref={claimsHistoryRef}>
      <Collapsible open={claimsHistoryOpen} onOpenChange={setClaimsHistoryOpen}>
      <Card>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 w-full text-left">
              <ChevronRight className={cn("w-4 h-4 transition-transform", claimsHistoryOpen && "rotate-90")} />
              <CardTitle className="text-lg">
                {filteredClaims.some(c => c.status === 'draft') ? 'Current Claim' : 'Claims History'}
              </CardTitle>
              <Badge variant="secondary" className="ml-auto text-xs">{filteredClaims.length}</Badge>
            </button>
          </CollapsibleTrigger>
          {claimsHistoryOpen && effectiveIsAdmin && (!testActive || testMode.role === 'pml_finance' || testMode.role === 'pml_director') && (
            <div className="flex flex-wrap gap-2 mt-2 items-center">
              {([
                { key: 'all', label: 'All' },
                { key: 'submitted', label: 'Outstanding' },
                { key: 'verified', label: 'Verified' },
                { key: 'approved', label: 'Approved' },
                { key: 'queried', label: 'Queried' },
                { key: 'invoiced', label: 'Invoiced' },
                { key: 'paid', label: 'Paid' },
                { key: 'rejected', label: 'Rejected' },
                { key: 'draft', label: 'Draft' },
              ] as const).filter(({ key }) => key === 'all' || statusCounts[key] > 0).map(({ key, label }) => (
                <Button
                  key={key}
                  size="sm"
                  variant={filterStatus === key ? 'default' : 'outline'}
                  className="text-xs"
                  onClick={() => setFilterStatus(key)}
                >
                  {label}
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                    {statusCounts[key]}
                  </Badge>
                </Button>
              ))}
            </div>
          )}
          {claimsHistoryOpen && effectiveIsAdmin && (
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => exportClaimsDetail(accessFilteredClaims, effectiveFilterPractice, effectiveFilterStatus)}>
                <Download className="w-3 h-3" /> Export Detail
              </Button>
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => exportMonthlySummary(accessFilteredClaims, effectiveFilterPractice)}>
                <Download className="w-3 h-3" /> Export Summary
              </Button>
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => exportYTDRunningTotals(accessFilteredClaims)}>
                <Download className="w-3 h-3" /> Export YTD
              </Button>
            </div>
          )}
        </CardHeader>
        <CollapsibleContent>
        {effectiveIsAdmin && (
          <div className="px-6 pb-2">
            <UnclaimedFundsIndicator claims={claims} practiceKeys={ALL_PRACTICE_KEYS} />
          </div>
        )}
        <CardContent>
          {filteredClaims.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No claims yet.</p>
          ) : (
            <div className="space-y-6">
              {filteredClaims.map(c => {
                const staffDets = c.staff_details as any[];
                const categories = [...new Set(staffDets.map((s: any) => s.staff_category).filter(Boolean))];
                const claimCategory: 'buyback' | 'new_sda' | 'management' | 'mixed' = categories.length === 0 ? 'buyback'
                  : categories.length === 1 ? (categories[0] as 'buyback' | 'new_sda' | 'management')
                  : 'mixed';
                const isBuyBack = claimCategory === 'buyback' || claimCategory === 'mixed';
                
                // Test mode overrides for verify/approve
                let canVerifyClaim: boolean;
                let canApproveThisClaim: boolean;

                if (testActive) {
                  canVerifyClaim = testMode.role === 'mgmt_lead' && c.status === 'submitted';
                  canApproveThisClaim = testMode.role === 'pml_director' && c.status === 'verified';
                } else {
                  canVerifyClaim = isAdmin && c.status === 'submitted' && (
                    (!hasAnyAssignment) || myVerifierPractices.includes(c.practice_key || '')
                  );
                  canApproveThisClaim = isAdmin && c.status === 'verified' && (
                    (!hasAnyAssignment) || myApproverPractices.includes(c.practice_key || '')
                  );
                }

                return (
                  <ClaimCard
                    key={c.id}
                    claim={c}
                    claimCategory={claimCategory}
                    userId={user?.id}
                    userEmail={user?.email}
                    isAdmin={testActive ? (testMode.role !== 'practice') : isAdmin}
                    isSuperAdmin={testActive ? false : isSuperAdmin}
                    isPMLDirector={testActive ? (testMode.role === 'pml_director') : isPMLDirector}
                    pmlFinanceEmails={pmlFinanceEmails}
                    canApproveClaim={canApproveThisClaim}
                    canVerifyClaim={canVerifyClaim}
                    rateParams={rateParams}
                    rolesConfig={rateSettings.roles_config}
                    onSubmit={submitClaim}
                    onDelete={deleteClaim}
                    onConfirmDeclaration={confirmDeclaration}
                    onUpdateStaffAmount={updateStaffClaimedAmount}
                    onRemoveStaff={removeStaffFromClaim}
                    onUpdateStaffNotes={updateStaffNotes}
                    onUpdateStaffLine={updateStaffLine}
                    onApprove={approveClaim}
                    onReject={rejectClaim}
                    onVerify={verifyClaim}
                    onQuery={queryClaim}
                    onUpdatePayment={updatePaymentStatus}
                    savingPayment={savingClaim}
                    testActive={testActive}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
        </CollapsibleContent>
      </Card>
      </Collapsible>
      </div>

      {/* Management Time Section — hidden for mgmt_lead, pml_director, pml_finance */}
      {effectiveIsAdmin && !isENN && !isManagementLead && !isPMLDirector && !isPMLFinance && effectiveShowStaffMgmt && (
        <>
          <Separator className="my-6" />
          <ManagementTimeTab isAdmin={effectiveIsAdmin} />
        </>
      )}

    </div>
  );
}

/** Helper to get the max monthly amount for a staff detail entry, with optional pro-rata */
function getStaffMaxAmount(staff: any, claimMonth?: string, rateParams?: RateParams): number {
  return calculateStaffMonthlyAmount({
    allocation_type: staff.allocation_type,
    allocation_value: staff.allocation_value,
    staff_role: staff.staff_role,
    staff_category: staff.staff_category,
    hourly_rate: staff.hourly_rate,
  } as any, claimMonth, staff.start_date, rateParams);
}

/** Build a detailed calculation breakdown for hover display */
function buildCalcTooltip(staff: any, claimMonth?: string, rateParams?: RateParams) {
  const allocType = staff.allocation_type as 'sessions' | 'wte' | 'hours' | 'daily';
  const allocValue = staff.allocation_value as number;
  const isManagement = staff.staff_category === 'management' || staff.staff_role === 'NRES Management';

  // Management: simple hourly × weekly hours × working weeks
  if (isManagement && staff.hourly_rate && rateParams?.workingWeeksInMonth) {
    const hourlyRate = staff.hourly_rate as number;
    const workingWeeks = rateParams.workingWeeksInMonth;
    const totalHours = allocValue * workingWeeks;
    const finalMonthly = hourlyRate * totalHours;
    const bhCount = rateParams.bankHolidaysInMonth ?? 0;

    // Reverse-engineer on-costs from the gross hourly rate
    const onCostPct = rateParams ? (rateParams.onCostMultiplier - 1) * 100 : 29.38;
    const mgmtNiPct = rateParams?.employerNiPct ?? 15;
    const mgmtPensionPct = rateParams?.employerPensionPct ?? 14.38;
    const baseHourlyRate = hourlyRate / (1 + onCostPct / 100);
    const niPerHour = baseHourlyRate * (mgmtNiPct / 100);
    const pensionPerHour = baseHourlyRate * (mgmtPensionPct / 100);
    const onCostsPerHour = niPerHour + pensionPerHour;
    const grossHoursCost = totalHours * baseHourlyRate;
    const totalOnCosts = totalHours * onCostsPerHour;

    return {
      isManagement: true, isDaily: false, includesOnCosts: true,
      hourlyRate, baseHourlyRate, niPerHour, pensionPerHour, onCostsPerHour,
      mgmtNiPct, mgmtPensionPct, mgmtOnCostPct: onCostPct,
      grossHoursCost, totalOnCosts, weeklyHours: allocValue, workingWeeks, totalHours,
      bankHolidaysExcluded: bhCount, bankHolidayDetails: rateParams.bankHolidayDetails ?? [],
      baseSalary: 0, baseLabel: '', niPct: 0, pensionPct: 0, niValue: 0, pensionValue: 0,
      onCostsValue: 0, onCostPct: 0, annualBase: 0, fullMonthly: finalMonthly,
      proRataInfo: null, finalMonthly, baseRate: fmtGBP(hourlyRate),
      dailyRate: 0, workingDays: 0,
    };
  }

  const roleConfig = rateParams?.getRoleConfig?.(staff.staff_role ?? '');
  const includesOnCosts = roleConfig?.includes_on_costs !== false;

  const niPct = rateParams?.employerNiPct ?? 15;
  const pensionPct = rateParams?.employerPensionPct ?? 14.38;
  const onCostRate = includesOnCosts ? (rateParams ? (rateParams.onCostMultiplier - 1) : 0.2938) : 0;
  const onCostPct = onCostRate * 100;

  let roleAnnualRate: number | undefined;
  if (rateParams?.getRoleAnnualRate && staff.staff_role) {
    roleAnnualRate = rateParams.getRoleAnnualRate(staff.staff_role);
  }

  // Daily rate calculation
  if (allocType === 'daily') {
    const dailyRate = roleConfig?.daily_rate ?? allocValue;
    const workingDays = rateParams?.workingDaysInMonth ?? 21.67;
    const finalMonthly = dailyRate * workingDays;
    
    let proRataInfo: any = null;
    let proRatedMonthly = finalMonthly;
    if (claimMonth && staff.start_date) {
      const claimStart = new Date(claimMonth);
      const staffStart = new Date(staff.start_date);
      if (staffStart.getFullYear() === claimStart.getFullYear() && staffStart.getMonth() === claimStart.getMonth()) {
        const daysInMonth = new Date(claimStart.getFullYear(), claimStart.getMonth() + 1, 0).getDate();
        const startDay = staffStart.getDate();
        const remainingDays = daysInMonth - startDay + 1;
        const ratio = remainingDays / daysInMonth;
        proRataInfo = { daysInMonth, workingDays: remainingDays, startDay, ratio };
        proRatedMonthly = finalMonthly * ratio;
      }
    }

    return {
      isManagement: false, isDaily: true, includesOnCosts: false,
      dailyRate, workingDays,
      baseSalary: 0, baseLabel: `${fmtGBP(dailyRate)}/day × ${workingDays} working days`,
      niPct: 0, pensionPct: 0, niValue: 0, pensionValue: 0,
      onCostsValue: 0, onCostPct: 0, annualBase: 0,
      fullMonthly: finalMonthly, proRataInfo, finalMonthly: proRatedMonthly,
      baseRate: fmtGBP(dailyRate),
      hourlyRate: 0, baseHourlyRate: 0, niPerHour: 0, pensionPerHour: 0, onCostsPerHour: 0,
      mgmtNiPct: 0, mgmtPensionPct: 0, mgmtOnCostPct: 0,
      grossHoursCost: 0, totalOnCosts: 0, weeklyHours: 0, workingWeeks: 0, totalHours: 0,
      bankHolidaysExcluded: 0, bankHolidayDetails: [],
    };
  }

  const baseRate = roleAnnualRate ?? (allocType === 'sessions' ? 11000 : 60000);
  const rateLabel = fmtGBP(baseRate);

  let baseSalary: number;
  let baseLabel: string;

  if (allocType === 'sessions') {
    baseSalary = allocValue * baseRate;
    baseLabel = `${allocValue} session${allocValue !== 1 ? 's' : ''} × ${rateLabel}/yr`;
  } else if (allocType === 'hours') {
    const wteRatio = allocValue / 37.5;
    baseSalary = wteRatio * baseRate;
    baseLabel = `${allocValue} hrs/wk ÷ 37.5 = ${parseFloat(wteRatio.toFixed(4))} WTE × ${rateLabel}/yr`;
  } else {
    baseSalary = allocValue * baseRate;
    baseLabel = `${allocValue} WTE × ${rateLabel}/yr`;
  }

  const niValue = includesOnCosts ? baseSalary * (niPct / 100) : 0;
  const pensionValue = includesOnCosts ? baseSalary * (pensionPct / 100) : 0;
  const onCostsValue = niValue + pensionValue;
  const annualBase = baseSalary + onCostsValue;
  const fullMonthly = annualBase / 12;

  let proRataInfo: { daysInMonth: number; workingDays: number; startDay: number; ratio: number } | null = null;
  let finalMonthly = fullMonthly;

  if (claimMonth && staff.start_date) {
    const claimStart = new Date(claimMonth);
    const claimYear = claimStart.getFullYear();
    const claimMonthNum = claimStart.getMonth();
    const staffStart = new Date(staff.start_date);

    if (staffStart.getFullYear() === claimYear && staffStart.getMonth() === claimMonthNum) {
      const daysInMonth = new Date(claimYear, claimMonthNum + 1, 0).getDate();
      const startDay = staffStart.getDate();
      const workingDays = daysInMonth - startDay + 1;
      const ratio = workingDays / daysInMonth;
      proRataInfo = { daysInMonth, workingDays, startDay, ratio };
      finalMonthly = fullMonthly * ratio;
    }
  }

  return {
    isManagement: false, isDaily: false, includesOnCosts,
    baseSalary, baseLabel, niPct: includesOnCosts ? niPct : 0, pensionPct: includesOnCosts ? pensionPct : 0,
    niValue, pensionValue, onCostsValue, onCostPct, annualBase, fullMonthly, proRataInfo, finalMonthly,
    baseRate: rateLabel, dailyRate: 0, workingDays: 0,
    hourlyRate: 0, baseHourlyRate: 0, niPerHour: 0, pensionPerHour: 0, onCostsPerHour: 0,
    mgmtNiPct: 0, mgmtPensionPct: 0, mgmtOnCostPct: 0,
    grossHoursCost: 0, totalOnCosts: 0, weeklyHours: 0, workingWeeks: 0, totalHours: 0,
    bankHolidaysExcluded: 0, bankHolidayDetails: [],
  };
}

/** Hover card showing the full calculation breakdown for a staff line's monthly amount */
function CalcBreakdownHover({ staff, claimMonth, amount, rateParams }: { staff: any; claimMonth?: string; amount: number; rateParams?: RateParams }) {
  const breakdown = buildCalcTooltip(staff, claimMonth, rateParams);
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1 cursor-help text-right hover:text-primary transition-colors">
          <span>{fmtGBP(amount)}</span>
          <Calculator className="h-3 w-3 text-muted-foreground" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-0" align="end" side="left" sideOffset={5}>
        <div className="p-2.5 bg-muted/50 border-b">
          <h4 className="font-semibold text-xs flex items-center gap-1.5">
            <Calculator className="h-3.5 w-3.5" />
            Calculation Breakdown
          </h4>
        </div>
        <div className="p-3 space-y-2 text-xs">
          {breakdown.isManagement ? (
            <>
              {/* Management: hourly rate with on-costs breakdown */}
              <div>
                <p className="text-muted-foreground font-medium mb-0.5">Gross Hourly Rate (inclusive of on-costs)</p>
                <p className="font-semibold">{fmtGBP(breakdown.hourlyRate ?? 0)}/hr</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground font-medium mb-0.5">Rate Breakdown (incl. {(breakdown.mgmtOnCostPct ?? 29.38).toFixed(2)}% on-costs)</p>
                <p className="text-foreground">Base rate: {fmtGBP(breakdown.baseHourlyRate ?? 0)}/hr</p>
                <p className="text-foreground">Employer NI ({breakdown.mgmtNiPct ?? 15}%): {fmtGBP(breakdown.niPerHour ?? 0)}/hr</p>
                <p className="text-foreground">Employer Pension ({breakdown.mgmtPensionPct ?? 14.38}%): {fmtGBP(breakdown.pensionPerHour ?? 0)}/hr</p>
                <p className="text-foreground">On-costs total: {fmtGBP(breakdown.onCostsPerHour ?? 0)}/hr</p>
                <p className="font-semibold">Gross rate: {fmtGBP(breakdown.baseHourlyRate ?? 0)} + {fmtGBP(breakdown.onCostsPerHour ?? 0)} = {fmtGBP(breakdown.hourlyRate ?? 0)}/hr</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground font-medium mb-0.5">Weekly Hours</p>
                <p className="font-semibold">{breakdown.weeklyHours} hrs/wk</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground font-medium mb-0.5">Working Weeks in Month</p>
                <p className="text-foreground">{(breakdown.workingWeeks ?? 0).toFixed(1)} weeks (working days ÷ 5)</p>
                {(breakdown.bankHolidaysExcluded ?? 0) > 0 && (
                  <div className="mt-1">
                    <p className="text-muted-foreground italic mb-0.5">{breakdown.bankHolidaysExcluded} bank holiday{(breakdown.bankHolidaysExcluded ?? 0) > 1 ? 's' : ''} excluded:</p>
                    {(breakdown.bankHolidayDetails ?? []).map((bh: any, i: number) => (
                      <p key={i} className="text-muted-foreground italic pl-2">• {bh.formatted} — {bh.name}</p>
                    ))}
                  </div>
                )}
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground font-medium mb-0.5">Total Hours</p>
                <p className="text-foreground">{breakdown.weeklyHours} hrs × {(breakdown.workingWeeks ?? 0).toFixed(1)} weeks = {(breakdown.totalHours ?? 0).toFixed(1)} hrs</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground font-medium mb-0.5">Monthly Cost Breakdown</p>
                <p className="text-foreground">Gross hours cost: {(breakdown.totalHours ?? 0).toFixed(1)} hrs × {fmtGBP(breakdown.baseHourlyRate ?? 0)}/hr = {fmtGBP(breakdown.grossHoursCost ?? 0)}</p>
                <p className="text-foreground">Total on-costs: {fmtGBP(breakdown.totalOnCosts ?? 0)}</p>
                <p className="font-semibold">Total: {fmtGBP(breakdown.grossHoursCost ?? 0)} + {fmtGBP(breakdown.totalOnCosts ?? 0)} = {fmtGBP(breakdown.finalMonthly)}</p>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold text-sm">
                <span>Maximum Claimable</span>
                <span className="text-primary">{fmtGBP(breakdown.finalMonthly)}</span>
              </div>
            </>
          ) : breakdown.isDaily ? (
            <>
              {/* Daily rate calculation */}
              <div>
                <p className="text-muted-foreground font-medium mb-0.5">Daily Rate (Locum)</p>
                <p className="text-foreground">{breakdown.baseLabel}</p>
                <p className="font-semibold">= {fmtGBP(breakdown.fullMonthly)}/month</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground font-medium mb-0.5">On-Costs</p>
                <p className="text-foreground italic">Excluded — Locum/daily rate (no employer NI or pension)</p>
              </div>
              {breakdown.proRataInfo && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground font-medium mb-0.5">Pro-Rata Adjustment</p>
                    <p className="text-foreground">
                      Staff started on day {breakdown.proRataInfo.startDay} of {breakdown.proRataInfo.daysInMonth}
                    </p>
                    <p className="text-foreground">
                      {breakdown.proRataInfo.workingDays} of {breakdown.proRataInfo.daysInMonth} days = {(breakdown.proRataInfo.ratio * 100).toFixed(1)}%
                    </p>
                    <p className="font-semibold">= {fmtGBP(breakdown.finalMonthly)}/month (pro-rated)</p>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between font-semibold text-sm">
                <span>Maximum Claimable</span>
                <span className="text-primary">{fmtGBP(breakdown.finalMonthly)}</span>
              </div>
            </>
          ) : (
            <>
              {/* Step 1: Base salary */}
              <div>
                <p className="text-muted-foreground font-medium mb-0.5">Base Salary</p>
                <p className="text-foreground">{breakdown.baseLabel}</p>
                <p className="font-semibold">= {fmtGBP(breakdown.baseSalary)}/year</p>
              </div>
              <Separator />
              {/* Step 2: On-costs — show differently based on includes_on_costs */}
              {breakdown.includesOnCosts ? (
                <div>
                  <p className="text-muted-foreground font-medium mb-0.5">+ Employer On-Costs ({breakdown.onCostPct.toFixed(2)}%)</p>
                  <p className="text-foreground">Employer NI ({breakdown.niPct}%): {fmtGBP(breakdown.niValue)}</p>
                  <p className="text-foreground">Employer Pension ({breakdown.pensionPct}%): {fmtGBP(breakdown.pensionValue)}</p>
                  <p className="text-foreground">Total on-costs: {fmtGBP(breakdown.onCostsValue)}</p>
                  <p className="font-semibold">Total annual: {fmtGBP(breakdown.baseSalary)} + {fmtGBP(breakdown.onCostsValue)} = {fmtGBP(breakdown.annualBase)}/year</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 italic">On-costs included (Employed Staff)</p>
                </div>
              ) : (
                <div>
                  <p className="text-muted-foreground font-medium mb-0.5">On-Costs</p>
                  <p className="text-foreground italic">Excluded — Locum (no employer NI or pension)</p>
                  <p className="font-semibold">Total annual: {fmtGBP(breakdown.baseSalary)}/year</p>
                </div>
              )}
              <Separator />
              {/* Step 3: Monthly */}
              <div>
                <p className="text-muted-foreground font-medium mb-0.5">Monthly Amount</p>
                <p className="text-foreground">{fmtGBP(breakdown.annualBase || breakdown.baseSalary)} ÷ 12 months</p>
                <p className="font-semibold">= {fmtGBP(breakdown.fullMonthly)}/month</p>
              </div>
              {/* Step 4: Pro-rata if applicable */}
              {breakdown.proRataInfo && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground font-medium mb-0.5">Pro-Rata Adjustment</p>
                    <p className="text-foreground">
                      Staff started on day {breakdown.proRataInfo.startDay} of {breakdown.proRataInfo.daysInMonth}
                    </p>
                    <p className="text-foreground">
                      {breakdown.proRataInfo.workingDays} of {breakdown.proRataInfo.daysInMonth} days = {(breakdown.proRataInfo.ratio * 100).toFixed(1)}%
                    </p>
                    <p className="font-semibold">= {fmtGBP(breakdown.finalMonthly)}/month (pro-rated)</p>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between font-semibold text-sm">
                <span>Maximum Claimable</span>
                <span className="text-primary">{fmtGBP(breakdown.finalMonthly)}</span>
              </div>
            </>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/** Inline PDF viewer button — opens invoice in a dialog */
function InvoiceViewerButton({ invoicePdfPath, invoiceNumber }: { invoicePdfPath: string; invoiceNumber: string }) {
  const [open, setOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const { data, error } = await supabase.storage.from('nres-claim-evidence').download(invoicePdfPath);
      if (error) throw error;
      if (data) {
        const blobUrl = URL.createObjectURL(data);
        setPdfUrl(blobUrl);
      }
    } catch (e) {
      console.error('Failed to load invoice PDF:', e);
    } finally {
      setLoading(false);
    }
  };

  // Clean up blob URL on unmount or close
  React.useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  return (
    <>
      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleOpen}>
        <Eye className="w-3 h-3" /> View Invoice
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-4 pb-2">
            <DialogTitle className="text-sm">Invoice {invoiceNumber}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            {loading ? (
              <div className="flex items-center justify-center h-[600px]">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-[600px] rounded-md border"
                title={`Invoice ${invoiceNumber}`}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Failed to load invoice PDF.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ClaimCard({ claim, claimCategory, userId, userEmail, isAdmin, isSuperAdmin, isPMLDirector, pmlFinanceEmails, canApproveClaim, canVerifyClaim, rateParams, rolesConfig, onSubmit, onDelete, onConfirmDeclaration, onUpdateStaffAmount, onRemoveStaff, onUpdateStaffNotes, onUpdateStaffLine, onApprove, onReject, onVerify, onQuery, onUpdatePayment, savingPayment, testActive }: {
  claim: BuyBackClaim;
  claimCategory: 'buyback' | 'new_sda' | 'management' | 'mixed';
  userId?: string;
  userEmail?: string;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  isPMLDirector?: boolean;
  pmlFinanceEmails?: string[];
  canApproveClaim?: boolean;
  canVerifyClaim?: boolean;
  rateParams?: RateParams;
  rolesConfig?: import('@/hooks/useNRESBuyBackRateSettings').RoleConfig[];
  onSubmit: (id: string) => void;
  onDelete: (id: string) => void;
  onConfirmDeclaration: (id: string, confirmed: boolean) => void;
  onUpdateStaffAmount: (claimId: string, staffIndex: number, amount: number) => void;
  onRemoveStaff: (claimId: string, staffIndex: number) => void;
  onUpdateStaffNotes: (claimId: string, staffIndex: number, notes: string) => void;
  onUpdateStaffLine: (claimId: string, staffIndex: number, updates: { allocation_type?: string; allocation_value?: number; start_date?: string | null; claimed_amount?: number; notes?: string; acknowledged_rules?: string[] }, rateParams?: RateParams) => void;
  onApprove: (id: string, notes?: string) => void;
  onReject: (id: string, notes: string) => void;
  onVerify?: (id: string, notes?: string) => void;
  onQuery?: (id: string, notes: string) => void;
  onUpdatePayment?: (claimId: string, updates: any) => Promise<void>;
  savingPayment?: boolean;
  testActive?: boolean;
}) {
  const [editingNoteIdx, setEditingNoteIdx] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [autoFilling, setAutoFilling] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const debouncedUpdateStaffLine = useCallback((claimId: string, staffIndex: number, updates: any) => {
    const key = `${claimId}-${staffIndex}`;
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(() => {
      onUpdateStaffLine(claimId, staffIndex, updates, rateParams);
      delete debounceRef.current[key];
    }, 400);
  }, [onUpdateStaffLine, rateParams]);
  const isDraft = claim.status === 'draft';
  const isQueried = claim.status === 'queried';
  const isRejected = claim.status === 'rejected';
  const isSubmitted = claim.status === 'submitted';
  const isVerified = claim.status === 'verified';
  const canEdit = (isDraft || isQueried) && (userId === claim.user_id || isAdmin);
  const canApprove = canApproveClaim;
  const staffDetails = claim.staff_details as any[];

  // Shared evidence state — single instance for all staff lines
  const { files: evidenceFiles, uploading: evidenceUploading, uploadedTypes, uploadEvidence, deleteEvidence, getDownloadUrl, getUploadedTypesForStaff, refetch: refetchEvidence } = useNRESClaimEvidence(claim.id);
  const { getConfigForCategory } = useNRESEvidenceConfig();
  const { allComplete: evidenceComplete } = useStaffLineEvidenceComplete(staffDetails, getUploadedTypesForStaff, getConfigForCategory);

  // Ground rules helpers
  const getRulesForRole = (roleLabel: string) => {
    const rc = (rolesConfig || []).find(r => r.label.toLowerCase() === roleLabel?.toLowerCase());
    return rc?.ground_rules || [];
  };

  const isRuleAcknowledged = (staffIdx: number, ruleId: string) => {
    const acked: string[] = staffDetails[staffIdx]?.acknowledged_rules || [];
    return acked.includes(ruleId);
  };

  const handleAcknowledgeRule = (staffIdx: number, ruleId: string, checked: boolean) => {
    const current: string[] = staffDetails[staffIdx]?.acknowledged_rules || [];
    const updated = checked ? [...current, ruleId] : current.filter(id => id !== ruleId);
    onUpdateStaffLine(claim.id, staffIdx, { acknowledged_rules: updated });
  };

  // Count all unacknowledged required rules across all staff
  const unacknowledgedTotal = staffDetails.reduce((sum, s, idx) => {
    const rules = getRulesForRole(s.staff_role);
    const required = rules.filter(r => r.requires_acknowledgement);
    const acked: string[] = s.acknowledged_rules || [];
    return sum + required.filter(r => !acked.includes(r.id)).length;
  }, 0);

  // Test auto-fill: acknowledge all rules, confirm declaration, upload dummy evidence
  const handleTestAutoFill = async () => {
    if (autoFilling) return;
    setAutoFilling(true);
    try {
      // 1. Acknowledge all ground rules for every staff member (sequentially to avoid race conditions)
      for (let idx = 0; idx < staffDetails.length; idx++) {
        const s = staffDetails[idx];
        const rules = getRulesForRole(s.staff_role);
        const requiredRules = rules.filter((r: any) => r.requires_acknowledgement);
        if (requiredRules.length > 0) {
          const allIds = requiredRules.map((r: any) => r.id);
          await onUpdateStaffLine(claim.id, idx, { acknowledged_rules: allIds });
        }
      }

      // 2. Confirm declaration
      if (!claim.declaration_confirmed) {
        onConfirmDeclaration(claim.id, true);
      }

      // 3. Generate a professional DOCX test evidence file and upload to all mandatory slots
      const generateTestDocx = (staffName: string, evidenceLabel: string) => {
        const now = new Date();
        const dateStr = format(now, 'dd MMMM yyyy');
        const timeStr = format(now, 'HH:mm');
        const content = [
          'NRES Buy-Back Service — Test Evidence Document',
          '',
          `Date Generated: ${dateStr} at ${timeStr}`,
          `Staff Member: ${staffName}`,
          `Evidence Type: ${evidenceLabel}`,
          `Claim Reference: ${claim.id.slice(0, 8).toUpperCase()}`,
          `Practice: ${getPracticeName(claim.practice_key)}`,
          `Claim Period: ${format(new Date(claim.claim_month), 'MMMM yyyy')}`,
          '',
          '─────────────────────────────────────────────',
          '',
          'This document has been automatically generated for the sole purpose of testing',
          'the NRES Buy-Back claims submission workflow. It is not a genuine piece of',
          'supporting evidence and must not be treated as such.',
          '',
          'The auto-fill function populates all mandatory evidence slots with this placeholder',
          'document so that administrators can rapidly verify the end-to-end claim lifecycle',
          '— from draft creation through to submission, verification, and approval — without',
          'needing to source and upload real documentation.',
          '',
          'Key Points:',
          '  • This file was created by the Test Mode auto-fill feature.',
          '  • It satisfies the mandatory upload requirement for testing purposes only.',
          '  • All ground-rule acknowledgements have been simultaneously confirmed.',
          '  • The declaration checkbox has been automatically ticked.',
          '',
          'If you are reviewing this claim as part of a live workflow test, you may proceed',
          'to submit, verify, and approve as normal. The claim will behave identically to a',
          'genuine submission throughout the pipeline.',
          '',
          '─────────────────────────────────────────────',
          '',
          'Generated by: NRES Buy-Back Test Mode',
          `Timestamp: ${now.toISOString()}`,
        ].join('\r\n');
        return new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      };

      for (let idx = 0; idx < staffDetails.length; idx++) {
        const s = staffDetails[idx];
        const cat = (s.staff_category || 'buyback') as 'buyback' | 'new_sda' | 'management';
        const configItems = getConfigForCategory(cat);
        const mandatoryItems = configItems.filter((c: any) => c.is_mandatory);
        const uploadedForStaff = getUploadedTypesForStaff(idx);

        for (const cfg of mandatoryItems) {
          if (!uploadedForStaff[cfg.evidence_type]) {
            const docxBlob = generateTestDocx(s.staff_name, cfg.label);
            const file = new File([docxBlob], `Test-Evidence-${cfg.evidence_type}.docx`, {
              type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });
            await uploadEvidence(cfg.evidence_type, file, idx, true);
          }
        }
      }
    } catch (err) {
      console.error('Test auto-fill error:', err);
      toast.error('Auto-fill failed');
    } finally {
      setAutoFilling(false);
    }
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground',
      submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      verified: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      queried: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      invoiced: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    const labels: Record<string, string> = {
      draft: 'Draft',
      submitted: 'Submitted',
      verified: 'Verified',
      approved: 'Approved',
      queried: 'Queried — Awaiting Amendment',
      invoiced: 'Invoiced',
      paid: 'Paid',
      rejected: 'Rejected (Closed)',
    };
    return <Badge className={variants[status] || ''}>{labels[status] || status}</Badge>;
  };

  const totalCalculated = staffDetails.reduce((sum, s) => sum + getStaffMaxAmount(s, claim.claim_month, rateParams), 0);
  const totalClaimed = staffDetails.reduce((sum, s) => sum + (s.claimed_amount ?? getStaffMaxAmount(s, claim.claim_month, rateParams)), 0);

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Header */}
      <div className="bg-muted/50 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium">{getPracticeName(claim.practice_key)}</span>
          <span className="text-muted-foreground">—</span>
          <span>{format(new Date(claim.claim_month), 'MMMM yyyy')}</span>
          {statusBadge(claim.status)}
        </div>
        <div className="flex items-center gap-1">
          {testActive && canEdit && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-amber-400 text-amber-700 hover:bg-amber-50" onClick={handleTestAutoFill} disabled={autoFilling}>
              {autoFilling ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              ⚡ Auto-Fill
            </Button>
          )}
          {canEdit && isDraft && (
            <Button size="sm" variant="ghost" onClick={() => onDelete(claim.id)}>
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          )}
          {/* Super admins can delete any claim regardless of status */}
          {!canEdit && isSuperAdmin && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" onClick={() => {
                    if (window.confirm('Delete this ' + claim.status + ' claim? This action cannot be undone.')) {
                      onDelete(claim.id);
                    }
                  }}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Admin: Delete {claim.status} claim</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Staff lines */}
      <table className="w-full text-sm">
        <tbody>
          {staffDetails.map((s, idx) => {
            const colCount = canEdit ? 9 : 8;
            const headerRow = (
              <>
                {idx > 0 && (
                  <tr key={`spacer-${idx}`}><td colSpan={colCount} className="h-3"></td></tr>
                )}
                <tr key={`header-${idx}`} className="bg-muted/20">
                  <th className="text-left p-2 font-medium">Staff Member</th>
                  <th className="text-left p-2 font-medium">Category</th>
                  <th className="text-left p-2 font-medium">Role</th>
                  <th className="text-left p-2 font-medium">GL</th>
                  <th className="text-left p-2 font-medium">Allocation</th>
                  <th className="text-left p-2 font-medium">Start Date</th>
                  <th className="text-right p-2 font-medium">Max Rate</th>
                  <th className="text-right p-2 font-medium">Claimed</th>
                  {canEdit && <th className="p-2 font-medium w-20"></th>}
                </tr>
              </>
            );
            const maxAmount = getStaffMaxAmount(s, claim.claim_month, rateParams);
            const claimedAmount = s.claimed_amount ?? maxAmount;
            const displayName = maskStaffName(s.staff_name, userId, claim.user_id, userEmail);
            const hasNotes = !!s.notes;
            const belowMax = claimedAmount < maxAmount && maxAmount > 0;
            return (
              <Fragment key={`staff-block-${idx}`}>
                {headerRow}
                <tr className="border-b">
                  <td className="p-2">{displayName}</td>
                  <td className="p-2">
                    {(s.staff_category || 'buyback') === 'new_sda'
                      ? <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs">New SDA</Badge>
                      : (s.staff_category || 'buyback') === 'management'
                      ? <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 text-xs">Management</Badge>
                      : <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 text-xs">Buy-Back</Badge>}
                  </td>
                  <td className="p-2">{s.staff_role}</td>
                  <td className="p-2">
                    {(s.gl_category || (s.staff_role === 'GP' ? 'GP' : 'Other Clinical')) === 'GP'
                      ? <Badge className="bg-blue-100 text-blue-800 text-[10px]">GP</Badge>
                      : <Badge className="bg-purple-100 text-purple-800 text-[10px]">Other</Badge>}
                  </td>
                  {/* Allocation — editable in draft/queried */}
                  <td className="p-2">
                    {canEdit ? (
                      <div className="flex items-center gap-1">
                         <Select
                          value={s.allocation_type}
                          onValueChange={(v) => {
                            onUpdateStaffLine(claim.id, idx, { allocation_type: v }, rateParams);
                          }}
                        >
                          <SelectTrigger className="h-7 w-[80px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sessions">Sessions</SelectItem>
                            <SelectItem value="hours">Hrs/wk</SelectItem>
                            <SelectItem value="wte">WTE</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          className="h-7 w-16 text-xs text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          defaultValue={s.allocation_value}
                          min={0}
                          max={s.allocation_type === 'sessions' ? 9 : s.allocation_type === 'hours' ? 37.5 : s.allocation_type === 'daily' ? 2000 : 1}
                          step={s.allocation_type === 'wte' ? 0.1 : s.allocation_type === 'hours' ? 0.5 : 1}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val >= 0) {
                              debouncedUpdateStaffLine(claim.id, idx, { allocation_value: val });
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <span className="text-xs">
                        {s.allocation_type === 'daily' ? `${fmtGBP(s.allocation_value)}/day` : `${s.allocation_value} ${s.allocation_type}`}
                      </span>
                    )}
                  </td>
                  {/* Start Date — editable */}
                  <td className="p-2">
                    {canEdit ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="h-7 text-xs w-24 justify-start font-normal">
                            <CalendarIcon className="w-3 h-3 mr-1" />
                            {s.start_date ? format(new Date(s.start_date), 'dd/MM/yy') : '—'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={s.start_date ? new Date(s.start_date) : undefined}
                            onSelect={(date) => onUpdateStaffLine(claim.id, idx, { start_date: date ? format(date, 'yyyy-MM-dd') : null }, rateParams)}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <span className="text-xs">{s.start_date ? format(new Date(s.start_date), 'dd/MM/yyyy') : '—'}</span>
                    )}
                  </td>
                  {/* Max Rate */}
                  <td className="p-2 text-right">
                    <CalcBreakdownHover staff={s} claimMonth={claim.claim_month} amount={maxAmount} rateParams={rateParams} />
                  </td>
                  {/* Claimed Amount — editable */}
                  <td className="p-2 text-right">
                    {canEdit ? (
                      <div className="space-y-0.5">
                        <Input
                          type="number"
                          className="h-7 w-28 ml-auto text-right text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          defaultValue={claimedAmount.toFixed(2)}
                          min={0}
                          max={maxAmount}
                          step={0.01}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const capped = Math.min(val, maxAmount);
                            if (val > maxAmount) {
                              toast.info(`Capped at maximum reclaimable rate: ${fmtGBP(maxAmount)}`);
                            }
                            debouncedUpdateStaffLine(claim.id, idx, { claimed_amount: capped });
                          }}
                        />
                        <p className="text-[10px] text-muted-foreground text-right">Max: {fmtGBP(maxAmount)}</p>
                        {belowMax && (
                          <p className="text-[10px] text-amber-600 text-right">
                            Below max by {fmtGBP(maxAmount - claimedAmount)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <span>{fmtGBP(claimedAmount)}</span>
                        {belowMax && (
                          <p className="text-[10px] text-amber-600">Below max by {fmtGBP(maxAmount - claimedAmount)}</p>
                        )}
                      </div>
                    )}
                  </td>
                  {canEdit && (
                    <td className="p-2">
                      <div className="flex gap-1 justify-end">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => {
                                  if (editingNoteIdx === idx) {
                                    setEditingNoteIdx(null);
                                  } else {
                                    setNoteText(s.notes || '');
                                    setEditingNoteIdx(idx);
                                  }
                                }}
                              >
                                <MessageSquarePlus className={`w-3.5 h-3.5 ${hasNotes ? 'text-blue-600' : 'text-muted-foreground'}`} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              {hasNotes ? 'Edit notes' : 'Add notes'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            if (window.confirm(`Remove ${displayName} from this claim?`)) {
                              onRemoveStaff(claim.id, idx);
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
                {/* Saved notes row */}
                {hasNotes && editingNoteIdx !== idx && (
                  <tr key={`saved-note-${idx}`} className="border-b">
                    <td colSpan={canEdit ? 9 : 8} className="px-2 py-1">
                      <p className="text-xs text-muted-foreground italic">
                        <MessageSquarePlus className="w-3 h-3 inline mr-1 text-blue-600" />
                        {s.notes}
                      </p>
                    </td>
                  </tr>
                )}
                {/* Inline notes editor */}
                {editingNoteIdx === idx && canEdit && (
                  <tr key={`note-${idx}`} className="border-b bg-muted/10">
                    <td colSpan={canEdit ? 9 : 8} className="p-2">
                      <div className="flex gap-2 items-start">
                        <Input
                          className="flex-1 text-xs"
                          placeholder="Add notes or supporting information..."
                          value={noteText}
                          onChange={e => setNoteText(e.target.value)}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9"
                          onClick={() => {
                            onUpdateStaffNotes(claim.id, idx, noteText);
                            setEditingNoteIdx(null);
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9"
                          onClick={() => setEditingNoteIdx(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                      {hasNotes && (
                        <p className="text-xs text-muted-foreground mt-1">Current: {s.notes}</p>
                      )}
                    </td>
                  </tr>
                )}
                {/* Inline staff evidence — collapsed by default */}
                <tr key={`evidence-${idx}`} className="border-b">
                  <td colSpan={canEdit ? 9 : 8} className="p-0">
                    <Collapsible>
                      <CollapsibleTrigger className="w-full px-4 py-1.5 flex items-center gap-2 hover:bg-muted/30 transition-colors">
                        <ChevronRight className="w-3 h-3 text-primary transition-transform [[data-state=open]>&]:rotate-90" />
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[11px] font-semibold text-primary">Evidence</span>
                        <Badge variant="outline" className="text-[10px] ml-auto">
                          {Object.keys(getUploadedTypesForStaff(idx)).length} uploaded
                        </Badge>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <StaffLineEvidence
                          staffCategory={(s.staff_category || 'buyback') as 'buyback' | 'new_sda' | 'management'}
                          staffIndex={idx}
                          staffName={s.staff_name}
                          staffRole={s.staff_role}
                          uploadedTypesForStaff={getUploadedTypesForStaff(idx)}
                          allFilesForStaff={evidenceFiles.filter(f => f.staff_index === idx)}
                          canEdit={canEdit}
                          uploading={evidenceUploading}
                          onUpload={uploadEvidence}
                          onDelete={deleteEvidence}
                          onDownload={getDownloadUrl}
                          hideHeader
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  </td>
                </tr>
                {/* Ground rules for this role */}
                {(() => {
                  const rules = getRulesForRole(s.staff_role);
                  if (rules.length === 0) return null;
                  const acked: string[] = s.acknowledged_rules || [];
                  const requiredRules = rules.filter(r => r.requires_acknowledgement);
                  const unacked = requiredRules.filter(r => !acked.includes(r.id)).length;
                  return (
                    <tr key={`rules-${idx}`} className="border-b">
                      <td colSpan={canEdit ? 9 : 8} className="px-2 py-1">
                        <Collapsible>
                          <CollapsibleTrigger className="text-xs flex items-center gap-1 text-primary hover:underline">
                            <FileText className="w-3 h-3" />
                            Role Requirements ({rules.length})
                            {unacked > 0 && (
                              <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 text-[10px] ml-1">
                                {unacked} to confirm
                              </Badge>
                            )}
                            {unacked === 0 && requiredRules.length > 0 && (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 text-[10px] ml-1">
                                All confirmed
                              </Badge>
                            )}
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-primary/20">
                              {rules.map(rule => (
                                <div key={rule.id} className="flex items-start gap-2 text-xs">
                                  {rule.type === 'must_have' && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />}
                                  {rule.type === 'must_not' && <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />}
                                  {rule.type === 'condition' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />}
                                  {rule.type === 'information' && <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />}
                                  <div className="flex-1">
                                    <span className={rule.type === 'must_not' ? 'text-red-700 dark:text-red-400' : ''}>{rule.text}</span>
                                  </div>
                                  {rule.requires_acknowledgement && canEdit && (
                                    <Checkbox
                                      checked={isRuleAcknowledged(idx, rule.id)}
                                      onCheckedChange={(checked) => handleAcknowledgeRule(idx, rule.id, !!checked)}
                                      className="mt-0.5"
                                    />
                                  )}
                                  {rule.requires_acknowledgement && !canEdit && (
                                    <span className="text-[10px] shrink-0">
                                      {isRuleAcknowledged(idx, rule.id) ? '✓ Confirmed' : '✗ Not confirmed'}
                                    </span>
                                  )}
                                </div>
                              ))}
                              {canEdit && unacked > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-2 h-6 text-[10px] px-2 gap-1"
                                  onClick={() => {
                                    const allRequiredIds = requiredRules.map(r => r.id);
                                    onUpdateStaffLine(claim.id, idx, { acknowledged_rules: allRequiredIds });
                                  }}
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  Confirm all
                                </Button>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </td>
                    </tr>
                  );
                })()}
              </Fragment>
            );
          })}
          {/* Total row */}
          <tr className="bg-muted/30 font-semibold border-t">
            <td colSpan={5} className="p-2 text-right">Total</td>
            <td className="p-2 text-right">{fmtGBP(totalCalculated)}</td>
            <td className="p-2 text-right">{fmtGBP(totalClaimed)}</td>
            {canEdit && <td></td>}
          </tr>
        </tbody>
      </table>

      {/* Evidence is now inline per staff row above */}

      {/* Submission info */}
      {claim.submitted_at && (
        <div className="px-3 py-2 border-t bg-blue-50/50 dark:bg-blue-950/20 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span>Submitted by: <strong className="text-foreground">{claim.submitted_by_email || '—'}</strong></span>
          <span>on <strong className="text-foreground">{format(new Date(claim.submitted_at), 'dd/MM/yyyy')} at {format(new Date(claim.submitted_at), 'HH:mm')}</strong></span>
          {!canEdit && (
            <span className="ml-auto">Declaration: {claim.declaration_confirmed ? '✓ Confirmed' : '✗ Not confirmed'}</span>
          )}
        </div>
      )}

      {/* Verification info */}
      {claim.verified_at && (
        <div className="px-3 py-2 border-t bg-amber-50/50 dark:bg-amber-950/20 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span>Verified by: <strong className="text-foreground">{claim.verified_by || '—'}</strong></span>
          <span>on <strong className="text-foreground">{format(new Date(claim.verified_at), 'dd/MM/yyyy')} at {format(new Date(claim.verified_at), 'HH:mm')}</strong></span>
          {claim.verified_notes && <span>Notes: <em className="text-foreground">{claim.verified_notes}</em></span>}
        </div>
      )}

      {/* Approval info */}
      {(claim.status === 'approved' || claim.status === 'rejected' || claim.status === 'paid') && claim.reviewed_at && (
        <div className={`px-3 py-2 border-t text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 ${claim.status === 'rejected' ? 'bg-red-50/50 dark:bg-red-950/20' : 'bg-green-50/50 dark:bg-green-950/20'}`}>
          <span>{claim.status === 'rejected' ? 'Rejected' : 'Approved'} by: <strong className="text-foreground">{claim.approved_by_email || '—'}</strong></span>
          <span>on <strong className="text-foreground">{format(new Date(claim.reviewed_at), 'dd/MM/yyyy')} at {format(new Date(claim.reviewed_at), 'HH:mm')}</strong></span>
          {claim.review_notes && <span>Notes: <em className="text-foreground">{claim.review_notes}</em></span>}
        </div>
      )}

      {/* Query notes banner */}
      {claim.status === 'queried' && claim.query_notes && (
        <div className="px-3 py-2 border-t bg-orange-50 dark:bg-orange-950/20 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-orange-800 dark:text-orange-200">PML Query:</span>
              <p className="text-orange-700 dark:text-orange-300 mt-0.5">{claim.query_notes}</p>
              <span className="text-muted-foreground">Queried by: {claim.queried_by} on {claim.queried_at ? format(new Date(claim.queried_at), 'dd/MM/yyyy') + ' at ' + format(new Date(claim.queried_at), 'HH:mm') : '—'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Rejected claim terminal state */}
      {claim.status === 'rejected' && (
        <div className="px-3 py-2 border-t bg-red-50 dark:bg-red-950/20 text-xs flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="text-red-700 dark:text-red-300 font-medium">This claim has been permanently rejected. A new claim must be created.</span>
        </div>
      )}

      {/* Invoice info & download — moved above payment processing */}
      {claim.invoice_number && (
        <div className="px-3 py-2 border-t bg-blue-50/50 dark:bg-blue-950/20 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Invoice: <strong className="text-foreground">{claim.invoice_number}</strong></span>
            {claim.invoice_generated_at && (
              <span>Generated {format(new Date(claim.invoice_generated_at), 'dd/MM/yyyy HH:mm')}</span>
            )}
            {claim.gl_summary && (
              <span className="ml-2">GL: GP {fmtGBP(claim.gl_summary.gp_total || 0)} / Other {fmtGBP(claim.gl_summary.other_clinical_total || 0)}</span>
            )}
          </div>
          {claim.invoice_pdf_path && (
            <div className="flex items-center gap-1.5">
              <InvoiceViewerButton invoicePdfPath={claim.invoice_pdf_path} invoiceNumber={claim.invoice_number} />
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={async () => {
                const { data } = await supabase.storage.from('nres-claim-evidence').createSignedUrl(claim.invoice_pdf_path!, 300);
                if (data?.signedUrl) window.open(data.signedUrl, '_blank');
              }}>
                <Download className="w-3 h-3" /> Download PDF
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Payment workflow panel for approved/invoiced/paid claims — visible to admin (not PML Director) */}
      {isAdmin && !isPMLDirector && (claim.status === 'approved' || claim.status === 'invoiced' || claim.status === 'paid') && onUpdatePayment && (
        <PaymentWorkflowPanel
          claim={claim}
          onUpdatePayment={onUpdatePayment}
          saving={savingPayment}
        />
      )}

      {/* Read-only payment info for non-admin or PML Director */}
      {(!isAdmin || isPMLDirector) && claim.paid_at && (
        <div className="px-3 py-2 border-t bg-green-50/50 dark:bg-green-950/20 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span>Paid by: <strong className="text-foreground">{claim.paid_by || '—'}</strong></span>
          <span>on <strong className="text-foreground">{format(new Date(claim.paid_at), 'dd/MM/yyyy')} at {format(new Date(claim.paid_at), 'HH:mm')}</strong></span>
        </div>
      )}

      {(() => {
        const mismatched = staffDetails.filter(s => s.practice_key && s.practice_key !== claim.practice_key);
        if (mismatched.length === 0) return null;
        return (
          <div className="px-3 py-2 border-t bg-amber-50 dark:bg-amber-950/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <strong>Practice mismatch warning:</strong> The following staff {mismatched.length === 1 ? 'member is' : 'members are'} assigned to a different practice than this claim ({getPracticeName(claim.practice_key)}):
              <ul className="list-disc list-inside mt-1">
                {mismatched.map((s, i) => (
                  <li key={i}>{s.staff_name} — assigned to {getPracticeName(s.practice_key)}</li>
                ))}
              </ul>
            </div>
          </div>
        );
      })()}

      {/* Declaration & Submit */}
      <div className="px-3 py-3 flex items-center justify-between border-t bg-muted/10">
        <div className="flex items-center gap-3">
          {canEdit ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 cursor-help">
                    <Checkbox
                      checked={claim.declaration_confirmed}
                      onCheckedChange={checked => onConfirmDeclaration(claim.id, !!checked)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {claimCategory === 'buyback' || claimCategory === 'mixed'
                        ? "I confirm that all staff listed are delivering SDA (Part A) activity during their attributed hours. I confirm that matching Part B (LTC) provision has been delivered and the supporting evidence has been uploaded. The practice has verified the professional qualifications, registration status, and competencies of all staff members listed."
                        : "I confirm all staff listed are working 100% on SDA (Part A) during their funded hours. The practice has verified the professional qualifications, registration status, and competencies of all staff members listed in this claim."
                      }
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {DECLARATION_TEXT}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {!evidenceComplete && (
              <span className="text-[10px] text-red-500">Upload all required evidence first</span>
            )}
            {unacknowledgedTotal > 0 && (
              <span className="text-[10px] text-red-500">
                {unacknowledgedTotal} role requirement{unacknowledgedTotal !== 1 ? 's' : ''} need confirming
              </span>
            )}
            <Button size="sm" onClick={() => onSubmit(claim.id)} disabled={!claim.declaration_confirmed || !evidenceComplete || unacknowledgedTotal > 0}>
              <Send className="w-3 h-3 mr-1" /> Submit
            </Button>
          </div>
        )}
      </div>

      {/* Verifier Actions (Buy-Back: Submitted → Verified) */}
      {canVerifyClaim && (
        <div className="px-3 py-3 border-t bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Verify this claim (evidence review)</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                className="text-xs"
                placeholder="Verification notes (optional)..."
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
              />
            </div>
            <Button size="sm" variant="default" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => { onVerify?.(claim.id, reviewNotes); setReviewNotes(''); }}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Verify
            </Button>
            <Button size="sm" variant="destructive" onClick={() => { if (!reviewNotes.trim()) { setShowRejectInput(true); return; } onReject(claim.id, reviewNotes); setReviewNotes(''); }} disabled={showRejectInput && !reviewNotes.trim()}>
              <XCircle className="w-3.5 h-3.5 mr-1" /> Return
            </Button>
          </div>
          {showRejectInput && !reviewNotes.trim() && (
            <p className="text-xs text-destructive">Please enter a reason for returning the claim.</p>
          )}
        </div>
      )}

      {/* Admin Approval Actions — with Query option */}
      {canApprove && (
        <div className="px-3 py-3 border-t bg-indigo-50/50 dark:bg-indigo-950/20 space-y-2">
          <p className="text-xs font-medium text-indigo-800 dark:text-indigo-200">PML Finance Review</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                className="text-xs"
                placeholder="Notes (required for Query and Reject)..."
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
              />
            </div>
            <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => { onApprove(claim.id, reviewNotes); setReviewNotes(''); }}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="outline" className="border-orange-400 text-orange-700 hover:bg-orange-50" onClick={() => { if (!reviewNotes.trim()) { setShowRejectInput(true); return; } onQuery?.(claim.id, reviewNotes); setReviewNotes(''); }}>
              <MessageSquarePlus className="w-3.5 h-3.5 mr-1" /> Query
            </Button>
            <Button size="sm" variant="destructive" onClick={() => { if (!reviewNotes.trim()) { setShowRejectInput(true); return; } onReject(claim.id, reviewNotes); setReviewNotes(''); }}>
              <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
            </Button>
          </div>
          {showRejectInput && !reviewNotes.trim() && (
            <p className="text-xs text-destructive">Please enter notes above before querying or rejecting.</p>
          )}
          <p className="text-[10px] text-muted-foreground">Query returns claim for amendment. Reject closes it permanently.</p>
        </div>
      )}

      {/* PML Director Approval Confirmation Panel */}
      {isPMLDirector && !isSuperAdmin && (claim.status === 'approved' || claim.status === 'paid') && (
        <div className="px-4 py-4 border-t bg-green-50 dark:bg-green-950/30 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <h4 className="text-sm font-semibold text-green-800 dark:text-green-200">Claim Approved Successfully</h4>
          </div>

          {claim.invoice_number && (
            <div className="bg-white dark:bg-background rounded-md border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Invoice Details</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span>Invoice: <strong className="text-foreground">{claim.invoice_number}</strong></span>
                {claim.invoice_generated_at && (
                  <span>Generated: <strong className="text-foreground">{format(new Date(claim.invoice_generated_at), 'dd/MM/yyyy HH:mm')}</strong></span>
                )}
                <span>Total: <strong className="text-foreground">{fmtGBP(claim.claimed_amount || 0)}</strong></span>
              </div>
              {claim.invoice_pdf_path && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 mt-1" onClick={async () => {
                  const { data } = await supabase.storage.from('nres-claim-evidence').createSignedUrl(claim.invoice_pdf_path!, 300);
                  if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                }}>
                  <Download className="w-3 h-3" /> Download Invoice PDF
                </Button>
              )}
            </div>
          )}

          <div className="bg-white dark:bg-background rounded-md border p-3 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Notifications Sent</p>
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                <span>Practice notified — invoice attached</span>
              </div>
              <div className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                <span>PML Finance notified: {pmlFinanceEmails && pmlFinanceEmails.length > 0
                  ? <strong className="text-foreground">{pmlFinanceEmails.join(', ')}</strong>
                  : <em className="text-muted-foreground">No PML Finance users configured</em>
                }</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
