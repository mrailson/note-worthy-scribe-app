import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react';
import { BuyBackPMLDashboard } from './BuyBackPMLDashboard';
import { BuyBackPracticeDashboard, KpiCard, StaffRosterSection, ClaimsViewSwitcher, getClaimMonths, fmtShort, CATEGORY_COLORS, type DirectorPracticeOption } from './BuyBackPracticeDashboard';
import { BuyBackVerifierDashboard } from './BuyBackVerifierDashboard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { exportClaimsDetail } from '@/utils/buybackExcelExport';
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
import { MeetingScheduleSection } from './MeetingScheduleSection';
import { ClaimsUserGuide } from './ClaimsUserGuide';
import { useNRESClaimEvidence } from '@/hooks/useNRESClaimEvidence';
import { useNRESEvidenceConfig } from '@/hooks/useNRESEvidenceConfig';
import { NRES_PRACTICES, NRES_PRACTICE_KEYS, NRES_ODS_CODES, getPracticeName, type NRESPracticeKey } from '@/data/nresPractices';
import { ENN_PRACTICES, ENN_PRACTICE_KEYS, type ENNPracticeKey } from '@/data/ennPractices';
import { PaymentWorkflowPanel } from './PaymentWorkflowPanel';
import { generateInvoicePdf } from '@/utils/invoicePdfGenerator';
import { getSDAClaimGLCode } from '@/utils/glCodes';

import { InfoTooltip } from '@/components/nres/InfoTooltip';
import { useNRESBuyBackRateSettings } from '@/hooks/useNRESBuyBackRateSettings';
import { useNRESMeetingLog } from '@/hooks/useNRESMeetingLog';
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
import { Loader2, Plus, Trash2, Send, Users, FileText, Info, MessageSquarePlus, CalendarIcon, Calculator, CheckCircle2, XCircle, AlertTriangle, Download, ChevronRight, Pencil, ArrowUpDown, ArrowUp, ArrowDown, Eye, HelpCircle, Settings, Upload, ListChecks } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EditStaffDialog } from './EditStaffDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

/** Format a number as £X,XXX.XX */
function fmtGBP(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** GP Locum constants */
const GP_LOCUM_MAX_DAILY_RATE = 750;
const GP_LOCUM_SESSION_RATE = 375;

/** Build a human-readable calculation breakdown for the live preview */
function calcBreakdown(allocType: 'sessions' | 'wte' | 'hours' | 'daily', allocValue: number, rateParams?: RateParams, role?: string, category?: string, hourlyRate?: number): string {
  // GP Locum: allocation_value = total days or sessions worked that month
  if (category === 'gp_locum') {
    if (allocType === 'daily') {
      return `${allocValue} day${allocValue !== 1 ? 's' : ''} × ${fmtGBP(GP_LOCUM_MAX_DAILY_RATE)}/day — excl. on-costs (Locum)`;
    }
    if (allocType === 'sessions') {
      return `${allocValue} session${allocValue !== 1 ? 's' : ''} × ${fmtGBP(GP_LOCUM_SESSION_RATE)}/session — excl. on-costs (Locum)`;
    }
  }

  // Management: hourly_rate × weekly_hours × working_weeks (no bank holiday subtraction)
  if ((category === 'management' || role === 'NRES Management') && hourlyRate && (rateParams?.rawWorkingWeeksInMonth || rateParams?.workingWeeksInMonth)) {
    const ww = rateParams.rawWorkingWeeksInMonth ?? rateParams.workingWeeksInMonth!;
    return `${allocValue} hrs/wk × ${ww.toFixed(1)} weeks × ${fmtGBP(hourlyRate)}/hr`;
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
  const [category, setCategory] = useState<'buyback' | 'new_sda' | 'management' | 'gp_locum' | 'meeting'>('buyback');
  const [practice, setPractice] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [selectedMgmtKey, setSelectedMgmtKey] = useState('');

  const meetingAttendanceRoles = useMemo(() => [
    { label: 'Practice Manager', rate: rateParams?.meetingPmRate ?? 50 },
    { label: 'GP Partner', rate: rateParams?.meetingGpRate ?? 100 },
  ], [rateParams?.meetingGpRate, rateParams?.meetingPmRate]);

  const selectedMeetingRole = meetingAttendanceRoles.find(r => r.label === role) ?? meetingAttendanceRoles[0];

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
  const handleCategoryChange = (newCat: 'buyback' | 'new_sda' | 'management' | 'gp_locum' | 'meeting') => {
    setCategory(newCat);
    if (newCat === 'management') {
      setRole('NRES Management');
      setAllocType('hours');
      setAllocValue('');
      setName('');
      setSelectedMgmtKey('');
    } else if (newCat === 'gp_locum') {
      setRole('GP Locum');
      setAllocType('daily');
      setAllocValue('');
      setName('');
      setSelectedMgmtKey('');
    } else if (newCat === 'meeting') {
      setRole(meetingAttendanceRoles[0].label);
      setAllocType('hours');
      setAllocValue('0');
      setName('');
      setSelectedMgmtKey('');
    } else {
      setSelectedMgmtKey('');
      if (role === 'NRES Management' || role === 'GP Locum') {
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
  const isGpLocum = category === 'gp_locum';
  const isMeeting = category === 'meeting';
  const selectedMgmtRole = isManagement ? availableMgmtRoles.find(r => r.key === selectedMgmtKey) : undefined;

  const maxAlloc = isGpLocum
    ? (allocType === 'daily' ? 23 : 46)
    : (allocType === 'wte' ? 1 : allocType === 'hours' ? 37.5 : allocType === 'daily' ? 2000 : 9);

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
      hourly_rate: isMeeting ? selectedMeetingRole.rate : selectedMgmtRole?.hourly_rate ?? 0,
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
           <Select value={category} onValueChange={v => handleCategoryChange(v as 'buyback' | 'new_sda' | 'management' | 'gp_locum' | 'meeting')}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="buyback">Buy-Back</SelectItem>
              <SelectItem value="new_sda">New SDA</SelectItem>
              <SelectItem value="gp_locum">GP Locum</SelectItem>
              <SelectItem value="meeting">Meeting Attendance</SelectItem>
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
          ) : isGpLocum ? (
            <Input className="h-9 bg-muted" value="GP Locum" disabled />
          ) : isMeeting ? (
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {meetingAttendanceRoles.map(r => (
                  <SelectItem key={r.label} value={r.label}>{r.label} — {fmtGBP(r.rate)}/hr</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          {isMeeting ? (
            <Input className="h-9 bg-muted text-xs" value="From attendance" disabled />
          ) : isManagement ? (
            <Input className="h-9 bg-muted" value="Hrs/wk" disabled />
          ) : isGpLocum ? (
            <Select value={allocType} onValueChange={v => { setAllocType(v as 'sessions' | 'daily'); setAllocValue(''); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Days/month</SelectItem>
                <SelectItem value="sessions">Sessions/month</SelectItem>
              </SelectContent>
            </Select>
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
        {!isMeeting && (
        <div>
          <Label className="text-xs">
            {isGpLocum ? (allocType === 'daily' ? 'Days Worked' : 'Sessions Worked') : allocType === 'sessions' ? 'Weekly Sessions' : allocType === 'hours' ? 'Weekly Hours' : allocType === 'daily' ? 'Daily Rate (£)' : 'WTE Value'}
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
        )}
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

export function BuyBackClaimsTab({ neighbourhoodName = 'NRES', onGuideOpen, onSettingsOpen, showSettings }: { neighbourhoodName?: 'NRES' | 'ENN'; onGuideOpen?: () => void; onSettingsOpen?: () => void; showSettings?: boolean } = {}) {
  const isENN = neighbourhoodName === 'ENN';
  const practiceCount = isENN ? '10' : '7';
  const contractValue = isENN ? '£2.38M' : '£2.34M';
  const patientCount = isENN ? '~90,241' : '~89,584';
  const neighbourhoodLabel = isENN ? 'ENN' : 'NRES';
  const managerName = isENN ? 'Rebecca Gane (Transformation Manager, 3Sixty Care Partnership)' : 'Malcolm Railson (Neighbourhood Manager, PCN Services Ltd)';
  const { user } = useAuth();
  // Fetch profile name (profiles table is the source of truth, not auth metadata)
  const [profileName, setProfileName] = useState<string | undefined>();
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (data?.full_name) setProfileName(data.full_name);
    });
  }, [user?.id]);
  const { activeStaff, loading: loadingStaff, saving: savingStaff, admin, addStaff, updateStaff, removeStaff } = useNRESBuyBackStaff();
  const { staffRoles, settings: rateSettings, onCostMultiplier, getAnnualRate, loading: loadingRates } = useNRESBuyBackRateSettings();
  const resolvedUserName = profileName || user?.user_metadata?.full_name || user?.email || undefined;
  const emailConfig = useMemo(() => ({
    emailTestingMode: rateSettings.email_testing_mode,
    emailSendingDisabled: rateSettings.email_sending_disabled,
    allowInvoiceWhenSuppressed: rateSettings.allow_invoice_email_when_suppressed,
    notifySubmitterOnPaid: rateSettings.notify_submitter_on_paid,
    currentUserEmail: user?.email || undefined,
    currentUserName: resolvedUserName,
  }), [rateSettings.email_testing_mode, rateSettings.email_sending_disabled, rateSettings.allow_invoice_email_when_suppressed, rateSettings.notify_submitter_on_paid, user?.email, resolvedUserName]);
  const { claims, loading: loadingClaims, saving: savingClaim, admin: claimAdmin, createClaim, submitClaim, verifyClaim, queryClaim, approveClaim, rejectClaim, updatePaymentStatus, confirmDeclaration, deleteClaim, updateClaimAmount, updateStaffClaimedAmount, removeStaffFromClaim, updateStaffNotes, updateClaimNotes, updateStaffLine, refetch: refetchClaims } = useNRESBuyBackClaims(emailConfig);
  const { myPractices, mySubmitPractices, myApproverPractices, myVerifierPractices, loading: loadingAccess, admin: accessAdmin, hasAccess, grantAccess, revokeByKey } = useNRESBuyBackAccess();
  const { entries: meetingLogEntries, addMeetingEntry, deleteMeetingEntry, submitMonthEntries, verifyMeetingEntries, returnMeetingEntries, approveMeetingEntries, rejectMeetingEntries, queryMeetingEntries, refetch: refetchMeetingLog } = useNRESMeetingLog();

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

  const { getWorkingWeeksInMonth: calcWorkingWeeks, getWorkingDaysInMonth: calcWorkingDays, getRawWorkingWeeksInMonth: calcRawWorkingWeeks } = useMemo(() => {
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
    // Raw weekdays / 5 — no bank holiday subtraction (for management claims)
    const getRawWorkingWeeksInMonth = (claimMonth: string): number => {
      const start = new Date(claimMonth);
      const year = start.getFullYear();
      const month = start.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      let weekdays = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const day = new Date(year, month, d).getDay();
        if (day !== 0 && day !== 6) weekdays++;
      }
      return weekdays / 5;
    };
    const getWorkingWeeksInMonth = (claimMonth: string): number => getWorkingDaysInMonth(claimMonth) / 5;
    return { getWorkingWeeksInMonth, getWorkingDaysInMonth, getRawWorkingWeeksInMonth };
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
  const rawWorkingWeeksForMonth = calcRawWorkingWeeks(claimMonthDate);
  const bankHolidaysForMonth = getBankHolidaysInMonth(claimMonthDate);
  const bankHolidayDetailsForMonth = getBankHolidayDetailsInMonth(claimMonthDate);

  const rateParams: RateParams = {
    onCostMultiplier,
    getRoleAnnualRate: (label) => { const v = getAnnualRate(label); return v > 0 ? v : undefined; },
    getRoleConfig: (label) => rateSettings.roles_config.find(r => r.label.toLowerCase() === label.toLowerCase()),
    employerNiPct: rateSettings.employer_ni_pct,
    employerPensionPct: rateSettings.employer_pension_pct,
    workingWeeksInMonth: workingWeeksForMonth,
    rawWorkingWeeksInMonth: rawWorkingWeeksForMonth,
    workingDaysInMonth: calcWorkingDays(claimMonthDate),
    bankHolidaysInMonth: bankHolidaysForMonth,
    bankHolidayDetails: bankHolidayDetailsForMonth,
    meetingGpRate: rateSettings.meeting_gp_rate,
    meetingPmRate: rateSettings.meeting_pm_rate,
  };

  const { roles, loading: loadingRoles, isPMLFinance, isPMLDirector, isAnyPML, isManagementLead, isSuperAdmin } = useNRESSystemRoles();
  const pmlFinanceEmails = roles.filter(r => r.role === 'pml_finance' && r.is_active).map(r => r.user_email);

  // isAdmin = NRES_ADMIN_EMAILS check; elevate PML role holders to see all claims
  const isAdmin = admin || isPMLFinance || isPMLDirector || isManagementLead || isSuperAdmin;

  // Compute default test role and hidden roles based on system permissions
  const isFullAdmin = isSuperAdmin || isManagementLead;
  const defaultTestRole: import('./TestModeBar').TestRole =
    !isFullAdmin && isPMLDirector ? 'pml_director' :
    !isFullAdmin && isPMLFinance ? 'pml_finance' : 'admin';
  const hiddenTestRoles: import('./TestModeBar').TestRole[] =
    !isFullAdmin && (isPMLDirector || isPMLFinance) ? ['admin'] : [];

  const canUseTestMode = isFullAdmin;

  // Test mode state — UI-only, full admin users only
  const [testMode, setTestMode] = useState<TestModeState>({ enabled: true, role: defaultTestRole });
  const testActive = canUseTestMode && testMode.enabled && testMode.role !== defaultTestRole;

  const [claimPractice, setClaimPractice] = useState<string>('');

  // Filters (admin)
   const [filterPractice, setFilterPractice] = useState<string>('all');
   const [filterStatus, setFilterStatus] = useState<string>(isPMLFinance ? 'invoiced' : isPMLDirector ? 'verified' : 'all');
   const [adminExpandedClaimId, setAdminExpandedClaimId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterRoute, setFilterRoute] = useState<string>('all');

  const [proposalOpen, setProposalOpen] = useState(false);
  const [claimsHistoryOpen, setClaimsHistoryOpen] = useState(isPMLFinance);
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [editingStaff, setEditingStaff] = useState<BuyBackStaffMember | null>(null);
  const [staffSortCol, setStaffSortCol] = useState<string>('practice');
  const [staffSortDir, setStaffSortDir] = useState<'asc' | 'desc'>('asc');

  // Super-admin only: wipe all test claims, meeting log entries, and hours entries
  // so we can retest the submission flow from scratch.
  // NOTE: must be declared above any early returns to preserve hook order.
  const handleResetAllTestData = useCallback(async () => {
    if (!isSuperAdmin) {
      toast.error('Only super-admins can reset test data');
      return;
    }
    setResetting(true);
    try {
      const invoicePaths = (claims || [])
        .map(c => c.invoice_pdf_path)
        .filter((p): p is string => !!p);

      const deleteAllRows = (table: 'nres_buyback_claims' | 'nres_management_time' | 'nres_hours_entries') =>
        supabase.from(table).delete().not('id', 'is', null);

      const [r1, r2, r3] = await Promise.all([
        deleteAllRows('nres_buyback_claims'),
        deleteAllRows('nres_management_time'),
        deleteAllRows('nres_hours_entries'),
      ]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
      if (r3.error) throw r3.error;

      if (invoicePaths.length > 0) {
        await supabase.storage.from('nres-claim-evidence').remove(invoicePaths).catch(() => {});
      }

      await Promise.all([
        refetchClaims?.(),
        refetchMeetingLog?.(),
      ]);

      toast.success('Reset complete — all test claims, meeting entries and hours entries cleared. Ready for new claims.');
    } catch (err: any) {
      console.error('Reset failed:', err);
      toast.error(`Reset failed: ${err?.message || 'unknown error'}`);
    } finally {
      setResetting(false);
      setResetConfirmOpen(false);
    }
  }, [isSuperAdmin, claims, refetchClaims, refetchMeetingLog]);

  const isLoading = loadingStaff || loadingClaims || loadingAccess || loadingRates || loadingRoles;

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

    // Create one claim per staff member — each is an individual submission/invoice
    let createdCount = 0;
    for (const staff of staffForClaim) {
      const staffAmount = calculateStaffMonthlyAmount(staff, monthDate, staff.start_date, rateParams);
      const claimType = staff.staff_category === 'new_sda' || staff.staff_category === 'gp_locum' ? 'additional' : 'buyback';
      const result = await createClaim(monthDate, [staff], staffAmount, staffAmount, practiceForClaim, rateParams, claimType);
      if (result) createdCount++;
    }

    if (createdCount > 0) {
      toast.success(`${createdCount} individual claim${createdCount > 1 ? 's' : ''} created — one per staff member`);
      setClaimsHistoryOpen(true);
      setTimeout(() => {
        claimsHistoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  };

  // Filter claims by access then practice/status (use effective overrides for test mode)
  // Apply role-based visibility: restrict which statuses each role can see
  const getVisibleStatuses = (): string[] | null => {
    const role = testActive ? testMode.role : null;
    if (role === 'pml_director') return ['verified', 'approved', 'invoiced', 'paid', 'queried'];
    if (role === 'pml_finance') return ['approved', 'invoiced', 'paid'];
    if (role === 'mgmt_lead') return ['submitted', 'verified', 'approved', 'invoiced', 'paid', 'queried'];
    if (role === 'practice') return null; // practice sees own claims (filtered by practice key)
    // For real (non-test) users, apply role restrictions
    if (!testActive) {
      if (isPMLDirector && !isSuperAdmin && !isManagementLead) return ['verified', 'approved', 'invoiced', 'paid', 'queried'];
      if (isPMLFinance && !isSuperAdmin && !isManagementLead && !isPMLDirector) return ['approved', 'invoiced', 'paid'];
      if (isManagementLead && !isSuperAdmin) return ['submitted', 'verified', 'approved', 'invoiced', 'paid', 'queried'];
    }
    return null; // admin/super_admin sees all
  };
  const visibleStatuses = getVisibleStatuses();

  const accessFilteredClaims = claims.filter(c => {
    if (c.practice_key && !effectivePracticeKeys.includes(c.practice_key as string)) return false;
    if (visibleStatuses && !visibleStatuses.includes(c.status)) return false;
    return true;
  });
  const basePracticeFilteredClaims = effectiveFilterPractice === 'all'
    ? accessFilteredClaims
    : accessFilteredClaims.filter(c => c.practice_key === effectiveFilterPractice);

  // Apply category & route filters (admin view extras)
  const practiceFilteredClaims = basePracticeFilteredClaims.filter(c => {
    if (filterCategory !== 'all') {
      const dets = (c.staff_details || []) as any[];
      if (!dets.some(d => (d.staff_category || 'buyback') === filterCategory)) return false;
    }
    if (filterRoute !== 'all') {
      // Route maps to staff category route: 'pml' for management/meeting, 'icb' for buyback/sda/locum
      const dets = (c.staff_details || []) as any[];
      const routeOf = (cat: string) => (cat === 'management' || cat === 'meeting') ? 'pml' : 'icb';
      if (!dets.some(d => routeOf(d.staff_category || 'buyback') === filterRoute)) return false;
    }
    return true;
  });

  // Sort: drafts first so the next claim to process is always at the top
  const STATUS_SORT_ORDER: Record<string, number> = {
    draft: 0,
    queried: 1,
    submitted: 2,
    verified: 3,
    approved: 4,
    invoiced: 5,
    paid: 6,
    rejected: 7,
  };

  const filteredClaims = (effectiveFilterStatus === 'all'
    ? practiceFilteredClaims
    : practiceFilteredClaims.filter(c => c.status === effectiveFilterStatus)
  ).sort((a, b) => (STATUS_SORT_ORDER[a.status] ?? 99) - (STATUS_SORT_ORDER[b.status] ?? 99));

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
    if (cat === 'gp_locum') return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs">GP Locum</Badge>;
    if (cat === 'meeting') return <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200 text-xs">Meeting</Badge>;
    return <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 text-xs">Buy-Back</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Determine if the PML Dashboard should be shown
  const showPMLDashboard = (() => {
    if (testActive && (testMode.role === 'pml_director' || testMode.role === 'pml_finance')) return true;
    if (!testActive && (isPMLDirector || isPMLFinance) && !isSuperAdmin && !isManagementLead) return true;
    return false;
  })();

  // Determine if the Practice Dashboard should be shown
  // True for: (a) admin in test mode previewing as practice, OR
  // (b) non-admin user who has practice-level access assignments and no elevated system role
  const showPracticeDashboard = (() => {
    if (testActive && testMode.role === 'practice' && testMode.selectedPractice) return true;
    // Real practice users: not admin, not PML, not verifier/management lead — but have practice assignments
    if (!isAdmin && !isPMLDirector && !isPMLFinance && !isManagementLead && !isSuperAdmin && hasAnyAssignment) return true;
    return false;
  })();

  // The practice key to show in the practice dashboard
  const practiceDashboardKey = testActive && testMode.role === 'practice' && testMode.selectedPractice
    ? testMode.selectedPractice
    : myPractices[0] || '';

  // Determine if the Verifier Dashboard should be shown
  const showVerifierDashboard = (() => {
    if (testActive && testMode.role === 'mgmt_lead') return true;
    if (!testActive && isManagementLead && !isSuperAdmin && !isPMLDirector && !isPMLFinance) return true;
    return false;
  })();

  const pmlDashboardView = testActive
    ? (testMode.role === 'pml_finance' ? 'finance' : 'director')
    : (isPMLFinance ? 'finance' : 'director');

  if (showPracticeDashboard) {
    const practiceStaff = activeStaff.filter(
      s => s.practice_key === practiceDashboardKey
    );
    const canSubmitForPractice = submitPracticeKeys.includes(practiceDashboardKey);

    return (
      <div className="space-y-6">
        {canUseTestMode && (
          <TestModeBar
            state={testMode}
            onChange={setTestMode}
            practiceKeys={ALL_PRACTICE_KEYS}
            practiceNames={ALL_PRACTICES}
            hiddenRoles={hiddenTestRoles}
          />
        )}
        <BuyBackPracticeDashboard
          claims={claims}
          practiceKey={practiceDashboardKey}
          staff={practiceStaff}
          onSubmit={canSubmitForPractice ? (id: string, practiceNotes?: string) => submitClaim(id, undefined, practiceNotes) : undefined}
          onResubmit={canSubmitForPractice ? (id, notes) => submitClaim(id, notes) : undefined}
          onUpdateClaimNotes={canSubmitForPractice ? updateClaimNotes : undefined}
          onCreateClaim={canSubmitForPractice ? (monthDate, staffMember, claimedAmount, holidayWeeksDeducted) => {
            const maxAmt = calculateStaffMonthlyAmount(staffMember, monthDate, staffMember.start_date, rateParams, holidayWeeksDeducted ?? 0);
            const actualClaimed = (claimedAmount && claimedAmount > 0 && claimedAmount <= maxAmt)
              ? claimedAmount
              : maxAmt;
            const claimType = staffMember.staff_category === 'new_sda' || staffMember.staff_category === 'gp_locum' ? 'additional' : 'buyback';
            return createClaim(monthDate, [staffMember], actualClaimed, maxAmt, practiceDashboardKey, rateParams, claimType, holidayWeeksDeducted ?? 0);
          } : undefined}
          onAddStaff={canSubmitForPractice ? addStaff : undefined}
          onRemoveStaff={canSubmitForPractice ? removeStaff : undefined}
          onUpdateStaff={canSubmitForPractice ? updateStaff : undefined}
          staffRoles={staffRoles}
          rateParams={rateParams}
          managementRoles={rateSettings.management_roles_config}
          savingClaim={savingClaim}
          savingStaff={savingStaff}
          confirmDeclaration={canSubmitForPractice ? confirmDeclaration : undefined}
          onDeleteClaim={canSubmitForPractice ? async (id: string) => { await deleteClaim(id); } : undefined}
          onCreateLocumClaim={canSubmitForPractice ? async (monthDate: string, staffMember: any, actualSessions: number, claimedAmount: number) => {
            const modifiedStaff = { ...staffMember, allocation_value: actualSessions };
            const maxAmount = actualSessions * (staffMember.hourly_rate || 0);
            return createClaim(
              monthDate,
              [modifiedStaff],
              claimedAmount,
              maxAmount,
              practiceDashboardKey,
              rateParams,
              'additional'
            );
          } : undefined}
          onGuideOpen={onGuideOpen}
          onSettingsOpen={onSettingsOpen}
          showSettings={showSettings}
          meetingLogEntries={meetingLogEntries}
          canAddOnBehalf={isAdmin}
          onAddMeetingEntry={canSubmitForPractice ? async (practiceKey, roleConfig, meetingName, meetingDate, hours) => {
            await addMeetingEntry({ practiceKey, roleConfig, meetingName, meetingDate, hours, claimMonth: meetingDate.slice(0, 7) + '-01', addedByAdmin: isAdmin });
          } : undefined}
          onDeleteMeetingEntry={canSubmitForPractice ? async (id) => { await deleteMeetingEntry(id); } : undefined}
          onSubmitMeetingEntries={canSubmitForPractice ? async (practiceKey, claimMonth) => { await submitMonthEntries(practiceKey, claimMonth, user?.email); } : undefined}
        />
      </div>
    );
  }

  if (showVerifierDashboard) {
    return (
      <div className="space-y-6">
        {canUseTestMode && (
          <TestModeBar
            state={testMode}
            onChange={setTestMode}
            practiceKeys={ALL_PRACTICE_KEYS}
            practiceNames={ALL_PRACTICES}
            hiddenRoles={hiddenTestRoles}
          />
        )}
        <BuyBackVerifierDashboard
          claims={accessFilteredClaims}
          onVerify={verifyClaim}
          onReturnToPractice={(id, notes) => queryClaim(id, notes, 'Verifier')}
          onUpdateClaimNotes={updateClaimNotes}
          savingClaim={savingClaim}
          onGuideOpen={onGuideOpen}
          onSettingsOpen={onSettingsOpen}
          showSettings={showSettings}
          meetingEntries={meetingLogEntries}
          onVerifyMeetingEntries={async (ids, notes) => { await verifyMeetingEntries(ids, notes); }}
          onReturnMeetingEntries={async (ids, notes) => { await returnMeetingEntries(ids, notes); }}
          userEmail={user?.email}
          userName={user?.user_metadata?.full_name || user?.email}
        />
      </div>
    );
  }

  if (showPMLDashboard) {
    return (
      <div className="space-y-6">
        {canUseTestMode && (
          <TestModeBar
            state={testMode}
            onChange={setTestMode}
            practiceKeys={ALL_PRACTICE_KEYS}
            practiceNames={ALL_PRACTICES}
            hiddenRoles={hiddenTestRoles}
          />
        )}
        <BuyBackPMLDashboard
          claims={accessFilteredClaims}
          meetingEntries={meetingLogEntries}
          userId={user?.id}
          userEmail={user?.email}
          isAdmin={isAdmin}
          isSuperAdmin={isSuperAdmin}
          isPMLDirector={isPMLDirector}
          isPMLFinance={isPMLFinance}
          rateParams={rateParams}
          onVerify={verifyClaim}
          onQuery={(id: string, notes: string) => queryClaim(id, notes, 'SNO Approver')}
          onApprove={approveClaim}
          onReject={rejectClaim}
          onMarkPaid={(id: string, notes?: string) => updatePaymentStatus(id, {
            payment_status: 'payment_sent',
            payment_notes: notes || undefined,
          })}
          onSchedulePayment={(id: string, date: string, bacsRef?: string, notes?: string) => updatePaymentStatus(id, {
            expected_payment_date: date,
            bacs_reference: bacsRef || undefined,
            payment_notes: notes || undefined,
            payment_status: 'scheduled',
          })}
          onApproveMeetingEntries={approveMeetingEntries}
          onQueryMeetingEntries={queryMeetingEntries}
          onRejectMeetingEntries={rejectMeetingEntries}
          savingClaim={savingClaim}
          defaultView={pmlDashboardView as 'director' | 'finance'}
          hideDirectorTab={pmlDashboardView === 'finance'}
          hideFinanceTab={pmlDashboardView === 'director'}
          onGuideOpen={onGuideOpen}
          onSettingsOpen={onSettingsOpen}
          showSettings={showSettings}
        />
      </div>
    );
  }

  // Practice options for ClaimsViewSwitcher (admin/director mode)
  const directorPracticeOptions: DirectorPracticeOption[] = effectivePracticeKeys.map(k => ({
    key: k,
    name: ALL_PRACTICES[k],
  }));

  // Group active staff by category for the new admin Staff Roster (across all practices)
  const adminBuybackStaff = accessFilteredStaff.filter(s => s.staff_category === 'buyback' && s.is_active);
  const adminGpLocumStaff = accessFilteredStaff.filter(s => s.staff_category === 'gp_locum' && s.is_active);
  const adminNewSdaStaff = accessFilteredStaff.filter(s => s.staff_category === 'new_sda' && s.is_active);
  const adminMgmtStaff = accessFilteredStaff.filter(s => (s.staff_category === 'management' || s.staff_category === 'meeting') && s.is_active);

  const adminClaimMonths = getClaimMonths();

  // KPI counts/totals (line-level, matching Practice view structure)
  const adminKpiLines = practiceFilteredClaims.flatMap(c => {
    const dets = (c.staff_details || []) as any[];
    return dets.map((d: any) => ({
      status: c.status,
      amount: d.claimed_amount ?? d.calculated_amount ?? 0,
    }));
  });
  const adminCounts: Record<string, number> = { all: adminKpiLines.length };
  adminKpiLines.forEach(l => { adminCounts[l.status] = (adminCounts[l.status] || 0) + 1; });
  const adminTotals = { draft: 0, submitted: 0, verified: 0, approved: 0, invoiced: 0, paid: 0, queried: 0 };
  adminKpiLines.forEach(l => {
    if (l.status === 'draft') adminTotals.draft += l.amount;
    else if (l.status === 'submitted') adminTotals.submitted += l.amount;
    else if (l.status === 'verified') adminTotals.verified += l.amount;
    else if (l.status === 'approved') adminTotals.approved += l.amount;
    else if (l.status === 'invoiced') adminTotals.invoiced += l.amount;
    else if (l.status === 'paid') adminTotals.paid += l.amount;
    else if (l.status === 'queried') adminTotals.queried += l.amount;
  });
  const adminQueriedCount = adminCounts.queried || 0;

  // Wrappers to satisfy StaffRosterSection signature (Practice form expects practice_key)
  const adminAddStaff = isAdmin
    ? async (member: Omit<BuyBackStaffMember, 'id' | 'user_id' | 'practice_id' | 'created_at' | 'updated_at'>) => {
        const pk = member.practice_key || (effectiveFilterPractice !== 'all' ? effectiveFilterPractice : effectivePracticeKeys[0]);
        return addStaff({ ...member, practice_key: pk });
      }
    : undefined;

  // (bulkOpen/importOpen state declared earlier — see top of component)
  // (handleResetAllTestData moved above early returns to preserve hook order)

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif", maxWidth: 1200, margin: '0 auto', padding: '28px 16px' }}>
      {/* Test Mode Bar — admin only — placed at top of page to align with Practice/Verifier/PML views */}
      {isAdmin && (
        <div style={{ marginBottom: 16 }}>
          <TestModeBar
            state={testMode}
            onChange={setTestMode}
            practiceKeys={ALL_PRACTICE_KEYS}
            practiceNames={ALL_PRACTICES}
            hiddenRoles={hiddenTestRoles}
          />
        </div>
      )}
      {!testActive && effectiveIsAdmin && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
              <div style={{ width: 6, height: 26, background: '#005eb8', borderRadius: 3 }} />
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: '#111827' }}>Claims — Notewell Admin View</h1>
              {onGuideOpen && (
                <button onClick={onGuideOpen} title="Claims Guide" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, border: '1px solid #e5e7eb', background: 'transparent', cursor: 'pointer', color: '#6b7280', marginLeft: 2 }}>
                  <HelpCircle style={{ width: 14, height: 14 }} />
                </button>
              )}
            </div>
            <p style={{ margin: '2px 0 0 16px', fontSize: 13, color: '#6b7280' }}>
               Manage staff, create and review claims across all practices
             </p>
          </div>

          {/* Toolbar: Bulk · Import · Settings */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Popover open={bulkOpen} onOpenChange={setBulkOpen}>
              <PopoverTrigger asChild>
                <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <ListChecks style={{ width: 14, height: 14 }} /> Bulk actions
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-1">
                <button
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={statusCounts.submitted === 0}
                  onClick={() => {
                    setBulkOpen(false);
                    practiceFilteredClaims.filter(c => c.status === 'submitted').forEach(c => verifyClaim(c.id));
                    toast.success(`Verifying ${statusCounts.submitted} submitted claim${statusCounts.submitted !== 1 ? 's' : ''}…`);
                  }}
                >
                  ✓ Verify all submitted ({statusCounts.submitted})
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={statusCounts.verified === 0}
                  onClick={() => {
                    setBulkOpen(false);
                    practiceFilteredClaims.filter(c => c.status === 'verified').forEach(c => approveClaim(c.id));
                    toast.success(`Approving ${statusCounts.verified} verified claim${statusCounts.verified !== 1 ? 's' : ''}…`);
                  }}
                >
                  ✓ Approve all verified ({statusCounts.verified})
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={statusCounts.approved + statusCounts.invoiced === 0}
                  onClick={() => {
                    setBulkOpen(false);
                    practiceFilteredClaims.filter(c => c.status === 'approved' || c.status === 'invoiced').forEach(c => updatePaymentStatus(c.id, { payment_status: 'payment_sent' }));
                    toast.success(`Marking ${statusCounts.approved + statusCounts.invoiced} claim${statusCounts.approved + statusCounts.invoiced !== 1 ? 's' : ''} as paid…`);
                  }}
                >
                  £ Mark all approved as paid ({statusCounts.approved + statusCounts.invoiced})
                </button>
                <Separator className="my-1" />
                <button
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-muted"
                  onClick={() => { setBulkOpen(false); exportClaimsDetail(accessFilteredClaims, effectiveFilterPractice, effectiveFilterStatus); }}
                >
                  ⬇ Export current filter to Excel
                </button>
                {isSuperAdmin && (
                  <>
                    <Separator className="my-1" />
                    <button
                      className="w-full text-left px-3 py-2 text-sm rounded text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      disabled={resetting}
                      onClick={() => { setBulkOpen(false); setResetConfirmOpen(true); }}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>
                        Delete all test invoices &amp; claims
                        <span className="block text-[11px] text-muted-foreground font-normal">
                          Resets buy-back, GP locum &amp; meeting attendance for fresh testing
                        </span>
                      </span>
                    </button>
                  </>
                )}
              </PopoverContent>
            </Popover>

            {/* Reset confirmation — super-admin only */}
            <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete all test invoices &amp; claims?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2 text-sm">
                      <p>This will permanently delete every row in:</p>
                      <ul className="list-disc pl-5 text-foreground">
                        <li><strong>{claims?.length ?? 0}</strong> buy-back / GP locum claim{(claims?.length ?? 0) === 1 ? '' : 's'} (incl. invoices)</li>
                        <li>All NRES management &amp; meeting-attendance entries</li>
                        <li>All NRES hours entries</li>
                      </ul>
                      <p>Generated invoice PDFs in storage will also be removed. Each practice will return to a clean &ldquo;ready for new claims&rdquo; state.</p>
                      <p className="text-destructive font-medium">This cannot be undone — use only on the test environment.</p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); handleResetAllTestData(); }}
                    disabled={resetting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {resetting ? 'Resetting…' : 'Yes, delete everything'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <button
              onClick={() => { setImportOpen(true); toast.info('Use the Spreadsheet view to bulk-edit, or contact your admin for CSV import.'); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              <Upload style={{ width: 14, height: 14 }} /> Import
            </button>

            {showSettings && onSettingsOpen && (
              <button
                onClick={onSettingsOpen}
                title="Buy-Back Settings"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid #005eb8', background: '#005eb8', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                <Settings style={{ width: 14, height: 14 }} /> Settings
              </button>
            )}
          </div>
        </div>
      )}
      {/* (Test Mode Bar moved to top of page — see start of return) */}


      {effectiveIsAdmin && !testActive && (
        <>
          {/* Queried alert banner */}
          {adminQueriedCount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', marginBottom: 16, borderRadius: 10,
              background: '#fffbeb', border: '1px solid #fde68a',
              fontSize: 13, color: '#92400e',
            }}>
              <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>
                <strong>{adminQueriedCount} claim line{adminQueriedCount !== 1 ? 's' : ''} need attention</strong>
                {' — practices have outstanding queries to address'}
              </span>
            </div>
          )}

          {/* KPI cards — 6-column grid matching Practice view */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 16 }}>
            <KpiCard label="Drafts" value={adminCounts.draft || 0} sub={fmtShort(adminTotals.draft)} accent={(adminCounts.draft || 0) > 0 ? '#64748b' : '#d1d5db'} tooltip="Claims being prepared, not yet submitted" />
            <KpiCard label="Awaiting Verification" value={adminCounts.submitted || 0} sub={fmtShort(adminTotals.submitted)} accent="#2563eb" tooltip="Submitted by practice, awaiting NRES verification" />
            <KpiCard label="Awaiting Approval" value={adminCounts.verified || 0} sub={fmtShort(adminTotals.verified)} accent="#7c3aed" tooltip="Verified, awaiting PML Finance Director approval" />
            <KpiCard label="Invoiced" value={(adminCounts.approved || 0) + (adminCounts.invoiced || 0)} sub={fmtShort(adminTotals.approved + adminTotals.invoiced)} accent="#d97706" tooltip="Approved and invoiced, awaiting payment" />
            <KpiCard label="Paid" value={adminCounts.paid || 0} sub={fmtShort(adminTotals.paid)} accent="#16a34a" tooltip="Payment completed and confirmed" />
            <KpiCard label="Queried" value={adminQueriedCount} sub={fmtShort(adminTotals.queried)} accent={adminQueriedCount > 0 ? '#dc2626' : '#d1d5db'} tooltip="Returned with queries — action required from practice" />
          </div>

          {/* Unified filter row — 4 equal columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Practice</Label>
              <Select value={filterPractice} onValueChange={setFilterPractice}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All practices" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Practices</SelectItem>
                  {effectivePracticeKeys.map(k => (
                    <SelectItem key={k} value={k}>{ALL_PRACTICES[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="buyback">Buy-Back</SelectItem>
                  <SelectItem value="gp_locum">GP Locum</SelectItem>
                  <SelectItem value="new_sda">New SDA</SelectItem>
                  <SelectItem value="management">NRES Management</SelectItem>
                  <SelectItem value="meeting">Meeting Attendance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Awaiting Verification</SelectItem>
                  <SelectItem value="verified">Awaiting Approval</SelectItem>
                  <SelectItem value="approved">Approved – Invoice Pending</SelectItem>
                  <SelectItem value="queried">Action Needed – Query Raised</SelectItem>
                  <SelectItem value="invoiced">Invoice Issued</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Route</Label>
              <Select value={filterRoute} onValueChange={setFilterRoute}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Routes</SelectItem>
                  <SelectItem value="icb">ICB Direct (Buy-Back / SDA / Locum)</SelectItem>
                  <SelectItem value="pml">PML Route (Management / Meeting)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Staff Roster — Practice-style, scoped across all NRES practices */}
          <div style={{
            background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
            padding: '20px 20px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Staff Roster</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>
                  {accessFilteredStaff.length} staff across {effectivePracticeKeys.length} practice{effectivePracticeKeys.length !== 1 ? 's' : ''}
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 100, background: '#f1f5f9', color: '#475569' }}>
                Total: {accessFilteredStaff.length}
              </span>
            </div>

            <StaffRosterSection
              title="Buy-Back"
              category="buyback"
              staffList={adminBuybackStaff}
              showAddButton
              claims={accessFilteredClaims}
              claimMonths={adminClaimMonths}
              onClickClaim={() => {}}
              activeClaimKey={null}
              onAddStaff={adminAddStaff}
              onRemoveStaff={removeStaff}
              onUpdateStaff={updateStaff}
              staffRoles={staffRoles}
              rateParams={rateParams}
              managementRoles={rateSettings.management_roles_config}
              saving={savingClaim}
            />
            <StaffRosterSection
              title="GP Locum"
              category="gp_locum"
              staffList={adminGpLocumStaff}
              showAddButton
              claims={accessFilteredClaims}
              claimMonths={adminClaimMonths}
              onClickClaim={() => {}}
              activeClaimKey={null}
              onAddStaff={adminAddStaff}
              onRemoveStaff={removeStaff}
              onUpdateStaff={updateStaff}
              staffRoles={staffRoles}
              rateParams={rateParams}
              managementRoles={rateSettings.management_roles_config}
              saving={savingClaim}
            />
            <StaffRosterSection
              title="New SDA"
              category="new_sda"
              staffList={adminNewSdaStaff}
              showAddButton
              claims={accessFilteredClaims}
              claimMonths={adminClaimMonths}
              onClickClaim={() => {}}
              activeClaimKey={null}
              onAddStaff={adminAddStaff}
              onRemoveStaff={removeStaff}
              onUpdateStaff={updateStaff}
              staffRoles={staffRoles}
              rateParams={rateParams}
              managementRoles={rateSettings.management_roles_config}
              saving={savingClaim}
            />
            <StaffRosterSection
              title="NRES Management & Meeting Attendance"
              category="management"
              staffList={adminMgmtStaff}
              showAddButton
              claims={accessFilteredClaims}
              claimMonths={adminClaimMonths}
              onClickClaim={() => {}}
              activeClaimKey={null}
              onAddStaff={adminAddStaff}
              onRemoveStaff={removeStaff}
              onUpdateStaff={updateStaff}
              staffRoles={staffRoles}
              rateParams={rateParams}
              managementRoles={rateSettings.management_roles_config}
              saving={savingClaim}
            />
          </div>

          {/* Unified Claims section — Practice-style ClaimsViewSwitcher with view tabs + Export */}
          <ClaimsViewSwitcher
            claims={practiceFilteredClaims}
            practiceKey={effectiveFilterPractice === 'all' ? '' : effectiveFilterPractice}
            practiceName={effectiveFilterPractice === 'all' ? 'All Practices' : (ALL_PRACTICES[effectiveFilterPractice] || '')}
            onToggleCard={(id) => setAdminExpandedClaimId(adminExpandedClaimId === id ? null : id)}
             expandedClaimId={adminExpandedClaimId}
            onSubmit={submitClaim}
            onResubmit={(id, notes) => submitClaim(id, notes)}
            saving={savingClaim}
            directorMode
            practiceFilter={effectiveFilterPractice}
            onPracticeFilterChange={setFilterPractice}
            practiceOptions={directorPracticeOptions}
            defaultView="cards"
            exportVariant={isPMLFinance ? 'finance' : 'director'}
          />
        </>
      )}

      {/* Staff Management — hidden in mgmt_lead, pml_director, pml_finance test modes.
          Also hidden in the admin view (replaced by new Practice-style Staff Roster above). */}
      {effectiveShowStaffMgmt && (!effectiveIsAdmin || testActive) && (
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
                     const displayName = maskStaffName(s.staff_name, user?.id, s.user_id, user?.email, isAdmin);
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

      {/* Meeting Schedule & Attendance — between staff management and create claim.
          Hidden in admin view (replaced by Practice-style Staff Roster). */}
      {effectiveShowStaffMgmt && (!effectiveIsAdmin || testActive) && filteredStaff.some(s => s.staff_category === 'meeting') && (
        <>
          <Separator />
          <MeetingScheduleSection
            neighbourhoodName={neighbourhoodName}
            practiceKey={effectiveFilterPractice}
            claimMonth={claimMonth}
            practiceKeys={effectivePracticeKeys}
            practiceNames={ALL_PRACTICES}
            meetingStaff={filteredStaff.filter(s => s.staff_category === 'meeting')}
            meetingGpRate={rateSettings.meeting_gp_rate}
            meetingPmRate={rateSettings.meeting_pm_rate}
          />
        </>
      )}

      {effectiveCanCreateClaim && (!effectiveIsAdmin || testActive) && <Separator />}

      {/* Create Claim — hidden in mgmt_lead, pml_director, pml_finance test modes.
          Also hidden in admin view (admins manage via spreadsheet/individual views above). */}
      {effectiveCanCreateClaim && (!effectiveIsAdmin || testActive) && (
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

      {(!effectiveIsAdmin || testActive) && <Separator />}

      {/* Claims — hidden in admin view (replaced by ClaimsViewSwitcher above). */}
      {(!effectiveIsAdmin || testActive) && (
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
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#475569', borderRadius: 100, padding: '2px 10px' }}>
                {filteredClaims.length}
              </span>
            </button>
          </CollapsibleTrigger>
          {claimsHistoryOpen && effectiveIsAdmin && (!testActive || testMode.role === 'pml_finance' || testMode.role === 'pml_director') && (
            <div style={{ marginTop: 12 }}>
              {/* Status pill filters */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {([
                  { key:'all', label:'All', color:'#374151' },
                  { key:'submitted', label:'Outstanding', color:'#2563eb' },
                  { key:'verified', label:'Verified', color:'#0369a1' },
                  { key:'approved', label:'Approved', color:'#7c3aed' },
                  { key:'queried', label:'Queried', color:'#dc2626' },
                  { key:'invoiced', label:'Invoiced', color:'#d97706' },
                  { key:'paid', label:'Paid', color:'#166534' },
                  { key:'rejected', label:'Rejected', color:'#991b1b' },
                  { key:'draft', label:'Draft', color:'#6b7280' },
                ] as const).filter(({ key }) => key === 'all' || statusCounts[key] > 0).map(({ key, label, color }) => {
                  const active = filterStatus === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setFilterStatus(key)}
                      style={{
                        padding:'5px 12px', borderRadius:100, fontSize:11,
                        fontWeight: active ? 600 : 400,
                        border:`1px solid ${active ? color : '#d1d5db'}`,
                        background: active ? `${color}12` : '#fff',
                        color: active ? color : '#6b7280',
                        cursor:'pointer', transition:'all 0.15s',
                        display:'inline-flex', alignItems:'center', gap:5,
                      }}
                    >
                      {label}
                      <span style={{ fontSize:10, borderRadius:100, padding:'1px 5px', background: active ? color : '#f1f5f9', color: active ? '#fff' : '#6b7280', fontWeight:600 }}>
                        {statusCounts[key]}
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => exportClaimsDetail(accessFilteredClaims, effectiveFilterPractice, effectiveFilterStatus)}
                  style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:8, border:'1px solid #d1d5db', background:'#fff', color:'#374151', fontSize:12, fontWeight:500, cursor:'pointer' }}
                >
                  <Download className="w-3 h-3" /> Export Detail
                </button>
              </div>
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
                const claimCategory: 'buyback' | 'new_sda' | 'management' | 'gp_locum' | 'mixed' = categories.length === 0 ? 'buyback'
                  : categories.length === 1 ? (categories[0] as 'buyback' | 'new_sda' | 'management' | 'gp_locum')
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
                    onQuery={(id: string, notes: string) => queryClaim(id, notes, isPMLDirector ? 'SNO Approver' : 'NRES Management')}
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
      )}

      {/* NRES Management Time section removed — superseded by NRES Management & Meeting Attendance above */}

      {/* Footer */}
      {effectiveIsAdmin && !testActive && (
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>NRES New Models of Care — Admin View</span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{filteredClaims.length} claim{filteredClaims.length !== 1 ? 's' : ''} shown · {practiceFilteredClaims.length} total</span>
        </div>
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
  const isGpLocum = staff.staff_category === 'gp_locum';
  const isMeeting = staff.staff_category === 'meeting';

  // Meeting attendance: simple hours × rate
  if (isMeeting) {
    const totalHours = allocValue ?? 0;
    const rate = staff.hourly_rate ?? 0;
    const finalMonthly = totalHours * rate;
    const meetingCount = staff.meeting_breakdown?.length ?? 0;
    return {
      isMeeting: true, isManagement: false, isDaily: false, isGpLocum: false, includesOnCosts: false,
      totalHours, hourlyRate: rate, meetingCount,
      meetingBreakdown: staff.meeting_breakdown ?? [],
      baseSalary: 0, baseLabel: '', niPct: 0, pensionPct: 0, niValue: 0, pensionValue: 0,
      onCostsValue: 0, onCostPct: 0, annualBase: 0, fullMonthly: finalMonthly,
      proRataInfo: null, finalMonthly, baseRate: fmtGBP(rate),
      dailyRate: 0, workingDays: 0,
      baseHourlyRate: 0, niPerHour: 0, pensionPerHour: 0, onCostsPerHour: 0,
      mgmtNiPct: 0, mgmtPensionPct: 0, mgmtOnCostPct: 0,
      grossHoursCost: 0, totalOnCosts: 0, weeklyHours: 0, workingWeeks: 0,
      bankHolidaysExcluded: 0, bankHolidayDetails: [],
    };
  }

  // GP Locum: fixed rates, no on-costs
  if (isGpLocum) {
    const workingDays = rateParams?.workingDaysInMonth ?? 21.67;
    let dailyRate: number;
    let baseLabel: string;
    if (allocType === 'daily') {
      dailyRate = Math.min(allocValue, 750);
      baseLabel = `${fmtGBP(dailyRate)}/day × ${workingDays} working days`;
    } else {
      // sessions per week
      dailyRate = 375;
      const workingWeeks = workingDays / 5;
      baseLabel = `${allocValue} session${allocValue !== 1 ? 's' : ''}/wk × ${fmtGBP(375)}/session × ${workingWeeks.toFixed(1)} working weeks`;
    }
    const fullMonthly = allocType === 'daily'
      ? dailyRate * workingDays
      : allocValue * 375 * (workingDays / 5);

    let proRataInfo: any = null;
    let finalMonthly = fullMonthly;
    if (claimMonth && staff.start_date) {
      const claimStart = new Date(claimMonth);
      const staffStart = new Date(staff.start_date);
      if (staffStart.getFullYear() === claimStart.getFullYear() && staffStart.getMonth() === claimStart.getMonth()) {
        const daysInMonth = new Date(claimStart.getFullYear(), claimStart.getMonth() + 1, 0).getDate();
        const startDay = staffStart.getDate();
        const remainingDays = daysInMonth - startDay + 1;
        const ratio = remainingDays / daysInMonth;
        proRataInfo = { daysInMonth, workingDays: remainingDays, startDay, ratio };
        finalMonthly = fullMonthly * ratio;
      }
    }

    return {
      isManagement: false, isDaily: allocType === 'daily', isGpLocum: true, includesOnCosts: false,
      dailyRate, workingDays,
      baseSalary: 0, baseLabel,
      niPct: 0, pensionPct: 0, niValue: 0, pensionValue: 0,
      onCostsValue: 0, onCostPct: 0, annualBase: 0,
      fullMonthly, proRataInfo, finalMonthly,
      baseRate: fmtGBP(dailyRate),
      hourlyRate: 0, baseHourlyRate: 0, niPerHour: 0, pensionPerHour: 0, onCostsPerHour: 0,
      mgmtNiPct: 0, mgmtPensionPct: 0, mgmtOnCostPct: 0,
      grossHoursCost: 0, totalOnCosts: 0, weeklyHours: 0, workingWeeks: 0, totalHours: 0,
      bankHolidaysExcluded: 0, bankHolidayDetails: [],
    };
  }

  // Management: simple hourly × weekly hours × working weeks (no bank holiday subtraction)
  if (isManagement && staff.hourly_rate && (rateParams?.rawWorkingWeeksInMonth || rateParams?.workingWeeksInMonth)) {
    const hourlyRate = staff.hourly_rate as number;
    const workingWeeks = rateParams.rawWorkingWeeksInMonth ?? rateParams.workingWeeksInMonth!;
    const totalHours = allocValue * workingWeeks;
    const finalMonthly = hourlyRate * totalHours;

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
      bankHolidaysExcluded: 0, bankHolidayDetails: [],
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
          {breakdown.isMeeting ? (
            <>
              {/* Meeting attendance breakdown */}
              <div>
                <p className="text-muted-foreground font-medium mb-0.5">Meeting Attendance</p>
                <p className="text-foreground">{breakdown.meetingCount} meeting{breakdown.meetingCount !== 1 ? 's' : ''} attended</p>
                <p className="text-foreground">Total hours: {(breakdown.totalHours ?? 0).toFixed(1)}h</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground font-medium mb-0.5">Hourly Rate</p>
                <p className="font-semibold">{fmtGBP(breakdown.hourlyRate ?? 0)}/hr</p>
                <p className="text-[10px] text-muted-foreground italic">No on-costs — fixed meeting rate</p>
              </div>
              {breakdown.meetingBreakdown && breakdown.meetingBreakdown.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground font-medium mb-1">Meetings Breakdown</p>
                    {breakdown.meetingBreakdown.map((m: any, i: number) => (
                      <p key={i} className="text-foreground">• {m.title || m.meeting_type || 'Meeting'} — {m.date ? format(new Date(m.date), 'dd/MM/yyyy') : '—'} — {m.duration_hours}h</p>
                    ))}
                  </div>
                </>
              )}
              <Separator />
              <div>
                <p className="text-muted-foreground font-medium mb-0.5">Calculation</p>
                <p className="font-semibold">{(breakdown.totalHours ?? 0).toFixed(1)}h × {fmtGBP(breakdown.hourlyRate ?? 0)}/hr = {fmtGBP(breakdown.finalMonthly)}</p>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold text-sm">
                <span>Maximum Claimable</span>
                <span className="text-primary">{fmtGBP(breakdown.finalMonthly)}</span>
              </div>
            </>
          ) : breakdown.isManagement ? (
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

/** Inline PDF viewer button — regenerates invoice from live claim data */
function InvoiceViewerButton({ claim }: { claim: BuyBackClaim }) {
  const [open, setOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const handleOpen = () => {
    setOpen(true);
    try {
      const pdfDoc = generateInvoicePdf({
        claim,
        invoiceNumber: claim.invoice_number || '',
        neighbourhoodName: 'NRES',
      });
      const pdfBlob = pdfDoc.output('blob');
      const blobUrl = URL.createObjectURL(new Blob([pdfBlob], { type: 'application/pdf' }));
      setPdfUrl(blobUrl);
    } catch (e) {
      console.error('Failed to generate invoice PDF:', e);
    }
  };

  const handleClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen && pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleOpen}>
        <Eye className="w-3 h-3" /> View Invoice
      </Button>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-4 pb-2">
            <DialogTitle className="text-sm">Invoice {claim.invoice_number}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            {pdfUrl ? (
              <object
                data={pdfUrl}
                type="application/pdf"
                className="w-full h-[600px] rounded-md border"
              >
                <div className="flex flex-col items-center justify-center h-[600px] gap-3">
                  <p className="text-sm text-muted-foreground">Unable to display PDF inline.</p>
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
                    Open PDF in new tab
                  </a>
                </div>
              </object>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Failed to generate invoice PDF.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ClaimCard({ claim, claimCategory, userId, userEmail, isAdmin, isSuperAdmin, isPMLDirector, pmlFinanceEmails, canApproveClaim, canVerifyClaim, rateParams, rolesConfig, onSubmit, onDelete, onConfirmDeclaration, onUpdateStaffAmount, onRemoveStaff, onUpdateStaffNotes, onUpdateStaffLine, onApprove, onReject, onVerify, onQuery, onUpdatePayment, savingPayment, testActive }: {
  claim: BuyBackClaim;
  claimCategory: 'buyback' | 'new_sda' | 'management' | 'gp_locum' | 'mixed';
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
          `Claim Reference: ${claim.claim_ref != null ? `#${claim.claim_ref}` : claim.id.slice(0, 8).toUpperCase()}`,
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
        const cat = (s.staff_category || 'buyback') as 'buyback' | 'new_sda' | 'management' | 'gp_locum';
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
      // Refresh evidence state to pick up all uploaded files
      await refetchEvidence();
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
      submitted: 'Awaiting Verification',
      verified: 'Awaiting Approval',
      approved: 'Approved – Invoice Pending',
      queried: 'Action Needed – Query Raised',
      invoiced: 'Invoice Issued',
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
      <div className="bg-muted/50 px-3 py-2 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5 min-w-0">
          {/* Row 1 — captioned identification fields */}
          <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
            {claim.claim_ref != null && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold tracking-wider uppercase text-slate-400">Claim ID</span>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded border border-slate-300 bg-slate-100 text-slate-800 text-xs font-bold font-mono self-start"
                  title="Claim ID — use this when communicating about this claim"
                >
                  #{claim.claim_ref}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] font-bold tracking-wider uppercase text-slate-400">Claim Period</span>
              <span className="text-[13px] font-semibold text-slate-900">{format(new Date(claim.claim_month), 'MMMM yyyy')}</span>
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[9px] font-bold tracking-wider uppercase text-slate-400">Practice</span>
              <span className="text-[13px] font-semibold text-slate-900 truncate">{getPracticeName(claim.practice_key)}</span>
            </div>
          </div>
        </div>
        {/* Centre — Status with caption */}
        <div className="flex flex-col items-center gap-0.5 shrink-0 px-4">
          <span className="text-[9px] font-bold tracking-wider uppercase text-slate-400">Status</span>
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
            const displayName = maskStaffName(s.staff_name, userId, claim.user_id, userEmail, isAdmin);
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
                      : (s.staff_category || 'buyback') === 'meeting'
                      ? <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200 text-xs">Meeting</Badge>
                      : (s.staff_category || 'buyback') === 'gp_locum'
                      ? <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs">GP Locum</Badge>
                      : <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 text-xs">Buy-Back</Badge>}
                  </td>
                  <td className="p-2">{s.staff_role}</td>
                  <td className="p-2">
                    <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground">
                      {getSDAClaimGLCode(s, claim.claim_type || 'buyback') || '—'}
                    </code>
                  </td>
                  {/* Allocation — editable in draft/queried, read-only for meeting staff */}
                  <td className="p-2">
                    {(s.staff_category === 'meeting') ? (
                      <HoverCard openDelay={200} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <span className="text-xs cursor-help text-muted-foreground hover:text-foreground">
                            {s.meeting_breakdown?.length ?? 0} meeting{(s.meeting_breakdown?.length ?? 0) !== 1 ? 's' : ''} · {s.allocation_value ?? 0}h total
                          </span>
                        </HoverCardTrigger>
                        {s.meeting_breakdown && s.meeting_breakdown.length > 0 && (
                          <HoverCardContent className="w-64 text-xs" align="start">
                            <p className="font-medium mb-1">Meeting Breakdown</p>
                            {s.meeting_breakdown.map((m: any, i: number) => (
                              <p key={i} className="text-muted-foreground">• {m.title || m.meeting_type || 'Meeting'} — {m.date ? format(new Date(m.date), 'dd/MM/yy') : '—'} — {m.duration_hours}h</p>
                            ))}
                          </HoverCardContent>
                        )}
                      </HoverCard>
                    ) : canEdit ? (
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
                          staffCategory={(s.staff_category || 'buyback') as 'buyback' | 'new_sda' | 'management' | 'gp_locum'}
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

      {/* Query notes banner — enhanced with flagged lines */}
      {claim.status === 'queried' && claim.query_notes && (() => {
        // Parse flagged lines from query notes
        const flaggedMatch = claim.query_notes.match(/\[FLAGGED_LINES:(\[[\d,]*\])\]/);
        const flaggedLineIndices: number[] = flaggedMatch ? JSON.parse(flaggedMatch[1]) : [];
        const displayNotes = claim.query_notes.replace(/\n\n\[FLAGGED_LINES:\[[\d,]*\]\]/, '');
        return (
          <div className="px-3 py-3 border-t bg-red-50 dark:bg-red-950/20">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-bold text-red-800 dark:text-red-200">⚠️ QUERIED BY {((claim as any).queried_by_role || 'REVIEWER').toUpperCase()} — Action Required</div>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{displayNotes}</p>
                <span className="text-xs text-muted-foreground mt-1 block">Queried by: {claim.queried_by} on {claim.queried_at ? format(new Date(claim.queried_at), 'dd/MM/yyyy') + ' at ' + format(new Date(claim.queried_at), 'HH:mm') : '—'}</span>
              </div>
            </div>
            {flaggedLineIndices.length > 0 && (
              <div className="mt-2 ml-7 space-y-1">
                <p className="text-xs font-semibold text-red-800 dark:text-red-200">Flagged Lines:</p>
                {flaggedLineIndices.map(idx => {
                  const s = staffDetails[idx];
                  if (!s) return null;
                  return (
                    <div key={idx} className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300 pl-2 border-l-2 border-red-400">
                      <span className="font-medium">{s.staff_name}</span> — <span>{s.staff_role}</span>
                      <Badge className="bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200 text-[10px]">Flagged</Badge>
                    </div>
                  );
                })}
              </div>
            )}
            {canEdit && (
              <div className="flex gap-2 mt-3 ml-7">
                <Button size="sm" variant="default" className="bg-blue-600 hover:bg-blue-700 text-white gap-1" onClick={() => {
                  if (!claim.declaration_confirmed) { onConfirmDeclaration(claim.id, true); }
                  onSubmit(claim.id);
                }}>
                  <Send className="w-3 h-3" /> Resubmit Claim
                </Button>
                <Button size="sm" variant="destructive" className="gap-1" onClick={() => {
                  if (window.confirm('Delete this queried claim? This cannot be undone.')) {
                    onDelete(claim.id);
                  }
                }}>
                  <Trash2 className="w-3 h-3" /> Delete Claim
                </Button>
              </div>
            )}
          </div>
        );
      })()}

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
              <InvoiceViewerButton claim={claim} />
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => {
                try {
                  const pdfDoc = generateInvoicePdf({ claim, invoiceNumber: claim.invoice_number || '', neighbourhoodName: 'NRES' });
                  const pdfBlob = pdfDoc.output('blob');
                  const blobUrl = URL.createObjectURL(new Blob([pdfBlob], { type: 'application/pdf' }));
                  window.open(blobUrl, '_blank');
                } catch (e) {
                  console.error('Failed to generate PDF:', e);
                  toast.error('Failed to generate invoice PDF');
                }
              }}>
                <Download className="w-3 h-3" /> Download PDF
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Payment workflow panel for approved/invoiced/paid claims — visible to admin (not SNO Approver) */}
      {isAdmin && !isPMLDirector && (claim.status === 'approved' || claim.status === 'invoiced' || claim.status === 'paid') && onUpdatePayment && (
        <PaymentWorkflowPanel
          claim={claim}
          onUpdatePayment={onUpdatePayment}
          saving={savingPayment}
        />
      )}

      {/* Read-only payment info for non-admin or SNO Approver */}
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
      {canEdit && (
        <div className="px-3 py-3 border-t bg-muted/10 space-y-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {claimCategory === 'buyback' || claimCategory === 'mixed'
              ? "By submitting this claim you confirm that all staff listed are delivering SDA (Part A) activity during their attributed hours, that matching Part B (LTC) provision has been delivered and the supporting evidence has been uploaded, and that the practice has verified the professional qualifications, registration status, and competencies of all staff members listed."
              : "By submitting this claim you confirm all staff listed are working 100% on SDA (Part A) during their funded hours and the practice has verified the professional qualifications, registration status, and competencies of all staff members listed."
            }
            {staffDetails.some((s: any) => s.staff_category === 'meeting') && (
              <> For meeting attendance lines, you confirm that signed attendance registers are held on file at the practice.</>
            )}
          </p>
          <div className="flex items-center justify-end gap-2">
            {!evidenceComplete && (
              <span className="text-[10px] text-red-500">Upload all required evidence first</span>
            )}
            {unacknowledgedTotal > 0 && (
              <span className="text-[10px] text-red-500">
                {unacknowledgedTotal} role requirement{unacknowledgedTotal !== 1 ? 's' : ''} need confirming
              </span>
            )}
            <Button size="sm" onClick={() => { if (!claim.declaration_confirmed) { onConfirmDeclaration(claim.id, true); } onSubmit(claim.id); }} disabled={!evidenceComplete || unacknowledgedTotal > 0}>
              <Send className="w-3 h-3 mr-1" /> Submit Claim
            </Button>
          </div>
        </div>
      )}

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

      {/* Admin Approval Actions — with Query option (no Reject for SNO Approver) */}
      {canApprove && (
        <div className="px-3 py-3 border-t bg-indigo-50/50 dark:bg-indigo-950/20 space-y-2">
          <p className="text-xs font-medium text-indigo-800 dark:text-indigo-200">PML Finance Review</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                className="text-xs"
                placeholder={isPMLDirector && !isSuperAdmin ? "Notes (required for Query)..." : "Notes (required for Query and Reject)..."}
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
            {/* Only show Reject for super_admin, hide for SNO Approver */}
            {(!isPMLDirector || isSuperAdmin) && (
              <Button size="sm" variant="destructive" onClick={() => { if (!reviewNotes.trim()) { setShowRejectInput(true); return; } onReject(claim.id, reviewNotes); setReviewNotes(''); }}>
                <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
              </Button>
            )}
          </div>
          {showRejectInput && !reviewNotes.trim() && (
            <p className="text-xs text-destructive">Please enter notes above before querying{(!isPMLDirector || isSuperAdmin) ? ' or rejecting' : ''}.</p>
          )}
          <p className="text-[10px] text-muted-foreground">Query returns claim for amendment.{(!isPMLDirector || isSuperAdmin) ? ' Reject closes it permanently.' : ''}</p>
        </div>
      )}

      {/* SNO Approver Approval Confirmation Panel */}
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
              {claim.invoice_number && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 mt-1" onClick={() => {
                  try {
                    const pdfDoc = generateInvoicePdf({ claim, invoiceNumber: claim.invoice_number || '', neighbourhoodName: 'NRES' });
                    const pdfBlob = pdfDoc.output('blob');
                    const blobUrl = URL.createObjectURL(new Blob([pdfBlob], { type: 'application/pdf' }));
                    window.open(blobUrl, '_blank');
                  } catch (e) {
                    console.error('Failed to generate PDF:', e);
                    toast.error('Failed to generate invoice PDF');
                  }
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
