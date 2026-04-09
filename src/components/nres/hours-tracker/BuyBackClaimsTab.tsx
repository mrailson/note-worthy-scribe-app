import { useState, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { exportClaimsDetail, exportMonthlySummary, exportYTDRunningTotals } from '@/utils/buybackExcelExport';
import { TestModeBar, type TestModeState } from './TestModeBar';
import { useAuth } from '@/contexts/AuthContext';
import { useNRESBuyBackStaff, type BuyBackStaffMember } from '@/hooks/useNRESBuyBackStaff';
import { useNRESBuyBackClaims, calculateStaffMonthlyAmount, type BuyBackClaim, type RateParams } from '@/hooks/useNRESBuyBackClaims';
import { useNRESBuyBackAccess } from '@/hooks/useNRESBuyBackAccess';
import { maskStaffName, isBuybackApprover } from '@/utils/buybackStaffMasking';
import { StaffLineEvidence, useStaffLineEvidenceComplete } from './ClaimEvidencePanel';
import { UnclaimedFundsIndicator } from './UnclaimedFundsIndicator';
import { ManagementTimeTab } from './ManagementTimeTab';
import { useNRESClaimEvidence } from '@/hooks/useNRESClaimEvidence';
import { useNRESEvidenceConfig } from '@/hooks/useNRESEvidenceConfig';
import { NRES_PRACTICES, NRES_PRACTICE_KEYS, getPracticeName, type NRESPracticeKey } from '@/data/nresPractices';
import { ENN_PRACTICES, ENN_PRACTICE_KEYS, type ENNPracticeKey } from '@/data/ennPractices';

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
import { Loader2, Plus, Trash2, Send, Users, FileText, Info, ExternalLink, ChevronDown, ChevronRight, MessageSquarePlus, CalendarIcon, Calculator, CheckCircle2, XCircle, AlertTriangle, Download } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';
import BoardPresentationExplainer from './BoardPresentationExplainer';
import ENNBoardPresentationExplainer from '@/components/enn/ENNBoardPresentationExplainer';
import BoardPresentation from './BoardPresentation';

/** Format a number as £X,XXX.XX */
function fmtGBP(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Build a human-readable calculation breakdown for the live preview */
function calcBreakdown(allocType: 'sessions' | 'wte' | 'hours', allocValue: number, rateParams?: RateParams, role?: string): string {
  const niPct = rateParams?.employerNiPct ?? 15;
  const penPct = rateParams?.employerPensionPct ?? 14.38;
  const totalPct = niPct + penPct;
  const onCostsLabel = `${totalPct.toFixed(2)}% on-costs (NI ${niPct}% + Pension ${penPct}%)`;

  let baseRate = '£11,000';
  if (rateParams?.getRoleAnnualRate && role) {
    const r = rateParams.getRoleAnnualRate(role);
    if (r !== undefined) baseRate = fmtGBP(r);
  }

  if (allocType === 'sessions') {
    return `${allocValue} session${allocValue !== 1 ? 's' : ''} × ${baseRate}/yr ÷ 12 months × ${onCostsLabel}`;
  }
  if (allocType === 'hours') {
    const wteRatio = (allocValue / 37.5).toFixed(2);
    return `${allocValue} hrs/wk ÷ 37.5 = ${wteRatio} WTE × ${baseRate}/yr ÷ 12 months × ${onCostsLabel}`;
  }
  return `${allocValue} WTE × ${baseRate}/yr ÷ 12 months × ${onCostsLabel}`;
}

const DECLARATION_TEXT =
  "I confirm that all staff listed are working 100% on SDA (Part A) during their funded hours, with no LTC (Part B) activity, in accordance with the ICB-approved buy-back rules.";

// STAFF_ROLES is now dynamic — see BuyBackClaimsTab below

/** Isolated add-staff form – keeps its own state so typing never loses focus */
function AddStaffForm({ saving, onAdd, staffRoles, rateParams, practiceKeys, practiceNames }: {
  saving: boolean;
  onAdd: (member: Omit<BuyBackStaffMember, 'id' | 'user_id' | 'practice_id' | 'created_at' | 'updated_at'>) => Promise<any>;
  staffRoles: string[];
  rateParams?: RateParams;
  practiceKeys: string[];
  practiceNames: Record<string, string>;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('GP');
  const [allocType, setAllocType] = useState<'sessions' | 'wte' | 'hours'>('sessions');
  const [allocValue, setAllocValue] = useState('');
  const [category, setCategory] = useState<'buyback' | 'new_sda'>('buyback');
  const [practice, setPractice] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);

  // Default allocation type based on role
  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    if (newRole === 'ANP' || newRole === 'ACP') {
      setAllocType('hours');
    } else if (newRole === 'GP') {
      setAllocType('sessions');
    }
  };

  const maxAlloc = allocType === 'wte' ? 1 : allocType === 'hours' ? 37.5 : 9;

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
      hourly_rate: 0,
      is_active: true,
      staff_category: category,
      practice_key: practice,
      start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
    });
    setName('');
    setAllocValue('');
    setStartDate(undefined);
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-2 items-end">
        <div>
          <Label className="text-xs">Practice</Label>
          <Select value={practice} onValueChange={setPractice}>
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
          <Select value={category} onValueChange={v => setCategory(v as 'buyback' | 'new_sda')}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="buyback">Buy-Back</SelectItem>
              <SelectItem value="new_sda">New SDA</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Name</Label>
          <Input id="staff-name" className="h-9" value={name} onChange={e => setName(e.target.value)} placeholder="Staff name" />
        </div>
        <div>
          <Label className="text-xs">Role</Label>
          <Select value={role} onValueChange={handleRoleChange}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {staffRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Allocation Type</Label>
          <Select value={allocType} onValueChange={v => { setAllocType(v as 'sessions' | 'wte' | 'hours'); setAllocValue(''); }}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sessions">Sessions</SelectItem>
              <SelectItem value="hours">Hrs/wk</SelectItem>
              <SelectItem value="wte">WTE</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">
            {allocType === 'sessions' ? 'Weekly Sessions' : allocType === 'hours' ? 'Weekly Hours' : 'WTE Value'}
          </Label>
          <Input
            type="number"
            className="h-9 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            value={allocValue}
            onChange={e => handleAllocValueChange(e.target.value)}
            placeholder="0"
            min="0"
            max={maxAlloc}
            step={allocType === 'wte' ? 0.1 : 1}
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
        const monthly = calculateStaffMonthlyAmount({
          allocation_type: allocType,
          allocation_value: val,
          hourly_rate: 0,
          staff_role: role,
        } as BuyBackStaffMember, undefined, undefined, rateParams);
        return (
          <div className="rounded-md bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800 px-3 py-2 text-sm space-y-1">
            <div>
              <span className="text-muted-foreground">Max monthly claim: </span>
              <span className="font-semibold text-teal-800 dark:text-teal-200">{fmtGBP(monthly)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {calcBreakdown(allocType, val, rateParams, role)} = {fmtGBP(monthly)}/month
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
  const { claims, loading: loadingClaims, saving: savingClaim, admin: claimAdmin, createClaim, submitClaim, verifyClaim, queryClaim, approveClaim, rejectClaim, markPaid, confirmDeclaration, deleteClaim, updateClaimAmount, updateStaffClaimedAmount, removeStaffFromClaim, updateStaffNotes, updateStaffLine } = useNRESBuyBackClaims(emailConfig);
  const { myPractices, mySubmitPractices, myApproverPractices, myVerifierPractices, loading: loadingAccess, admin: accessAdmin, hasAccess, grantAccess, revokeByKey } = useNRESBuyBackAccess();
  const rateParams: RateParams = { onCostMultiplier, getRoleAnnualRate: (label) => { const v = getAnnualRate(label); return v > 0 ? v : undefined; }, employerNiPct: rateSettings.employer_ni_pct, employerPensionPct: rateSettings.employer_pension_pct };

  const isAdmin = admin;

  // Test mode state — UI-only, admin users only
  const [testMode, setTestMode] = useState<TestModeState>({ enabled: false, role: 'admin' });
  const testActive = isAdmin && testMode.enabled && testMode.role !== 'admin';

  // New claim state
  const [claimMonth, setClaimMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [claimPractice, setClaimPractice] = useState<string>('');

  // Filters (admin)
  const [filterPractice, setFilterPractice] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [guideOpen, setGuideOpen] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
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
      : testMode.role === 'pml_director' ? 'verified'
      : testMode.role === 'pml_finance' ? 'approved'
      : filterStatus)
    : filterStatus;
  const effectiveCanCreateClaim = !testActive || testMode.role === 'admin' || testMode.role === 'practice';
  const effectiveShowStaffMgmt = !testActive || testMode.role === 'admin' || testMode.role === 'practice';

  // Admins with no assignments see everything; otherwise filtered
  const hasAnyAssignment = myPractices.length > 0;
  const accessFilteredPracticeKeys = isAdmin && !hasAnyAssignment
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

  const handleCreateClaim = async () => {
    if (filteredStaff.length === 0) return;
    const practiceForClaim = claimPractice || (effectiveFilterPractice !== 'all' ? effectiveFilterPractice : '');
    if (!practiceForClaim) return;
    const monthDate = `${claimMonth}-01`;
    const staffForClaim = filteredStaff.filter(s => s.practice_key === practiceForClaim);
    if (staffForClaim.length === 0) return;
    const calcAmount = staffForClaim.reduce((sum, s) => sum + calculateStaffMonthlyAmount(s, monthDate, s.start_date, rateParams), 0);
    await createClaim(monthDate, staffForClaim, calcAmount, calcAmount, practiceForClaim, rateParams);
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

  const categoryBadge = (cat: string) => {
    if (cat === 'new_sda') return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs">New SDA</Badge>;
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

      {/* Guide */}
      <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
        <div className="bg-white rounded-lg shadow-sm border border-teal-200 overflow-hidden">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 hover:bg-teal-50/50 transition-colors text-left">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-teal-100 text-teal-700">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#003087]">How the Staff Claims Scheme Works</h2>
                  <p className="text-sm text-muted-foreground">Buy-back &amp; new SDA staff — quick reference guide, key rules &amp; claim steps</p>
                </div>
              </div>
              <div className="text-slate-500">
                {guideOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-5 space-y-4 border-t border-teal-100 pt-4">
              <div>
                <h3 className="font-semibold text-[#003087] mb-1">Overview</h3>
                <p className="text-sm text-muted-foreground">
                  This tab manages claims for two categories of staff working on the {neighbourhoodLabel} SDA Programme:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside mt-1 space-y-1">
                  <li><strong>Buy-Back Staff</strong> — existing practice staff whose time is bought back for 100% SDA (Part A) work.</li>
                  <li><strong>New SDA Recruits</strong> — newly recruited GPs, ACPs/ANPs hired specifically for the programme.</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-[#003087] mb-1">The Golden Rule</h3>
                <p className="text-sm text-muted-foreground">
                  Staff must be working <strong>exclusively on SDA (Part A)</strong> during their funded hours. No LTC (Part B) activity
                  is permitted during buy-back time. Mixed roles must have clear, separated allocations.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-[#003087] mb-1">How to Claim</h3>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                  <li>Add staff members with their category (buy-back or new SDA), practice, role, allocation and hourly rate</li>
                  <li>Set session or WTE allocations for each staff member</li>
                  <li>Select the practice and create a monthly claim — the amount auto-calculates</li>
                  <li>Review the claim and confirm the declaration checkbox</li>
                  <li>Submit for approval by your SNO</li>
                </ol>
              </div>
              <div>
                <h3 className="font-semibold text-[#003087] mb-1">Approvals</h3>
                <p className="text-sm text-muted-foreground">
                  Submitted claims are reviewed by your Senior Neighbourhood Officer. Once approved, the claim is
                  forwarded for payment processing.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-[#003087] mb-2">Maximum Rates per Role</h3>
                <p className="text-xs text-muted-foreground mb-2">(as configured in Settings)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 font-medium">Role</th>
                        <th className="text-right p-2 font-medium">Base Annual Rate</th>
                        <th className="text-right p-2 font-medium">Base Hourly Rate</th>
                        <th className="text-right p-2 font-medium">
                          <div className="flex items-center justify-end gap-1">
                            Hourly Rate (incl. On-Costs)
                            <InfoTooltip content={`Base hourly rate × ${onCostMultiplier.toFixed(4)} (1 + ${rateSettings.on_costs_pct.toFixed(2)}% on-costs)`} />
                          </div>
                        </th>
                        <th className="text-right p-2 font-medium">Employer NI ({rateSettings.employer_ni_pct}%)</th>
                        <th className="text-right p-2 font-medium">Employer Pension ({rateSettings.employer_pension_pct}%)</th>
                        <th className="text-right p-2 font-medium">Total Annual (incl. On-Costs)</th>
                        <th className="text-right p-2 font-medium">
                          <div className="flex items-center justify-end gap-1">
                            Max Monthly Claim
                            <InfoTooltip content="For sessional GPs, the max monthly claim is based on 9 sessions (1 WTE equivalent). The per-session annual rate is multiplied by 9 to give the full-time annual cost, then divided by 12 for the monthly figure." />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rateSettings.roles_config.map(role => {
                        const niAmt = role.annual_rate * (rateSettings.employer_ni_pct / 100);
                        const penAmt = role.annual_rate * (rateSettings.employer_pension_pct / 100);
                        const totalAnnual = role.annual_rate + niAmt + penAmt;
                        const fullTimeAnnual = role.allocation_default === 'sessions' ? role.annual_rate * 9 : role.annual_rate;
                        const hourlyRate = fullTimeAnnual / (37.5 * 52);
                        const maxAlloc = role.allocation_default === 'sessions' ? 9 : role.allocation_default === 'hours' ? 37.5 : 1;
                        const maxMonthly = role.allocation_default === 'sessions'
                          ? (maxAlloc * totalAnnual) / 12
                          : role.allocation_default === 'hours'
                          ? ((maxAlloc / 37.5) * totalAnnual) / 12
                          : (maxAlloc * totalAnnual) / 12;
                        return (
                          <tr key={role.key} className="border-t">
                            <td className="p-2 font-medium">
                              <div className="flex items-center gap-1">
                                {role.label}
                                {role.allocation_default === 'sessions' && <span className="text-muted-foreground font-normal ml-1">(per session/yr)</span>}
                                {role.key === 'acp' && (
                                  <InfoTooltip content="ACP requires a Level 7 (Master's degree) qualification — this is the key distinction. ACP is a role, not a profession, and demands formal accreditation (e.g. via the Centre for Advancing Practice) across all four pillars: clinical practice, leadership, education, and research. Being an ANP alone does not make someone an ACP. Many ANPs are working towards ACP status but have not yet completed the Master's-level training or achieved accreditation. The higher ACP rate reflects this Level 7 qualification and broader scope of practice." />
                                )}
                              </div>
                            </td>
                            <td className="p-2 text-right">{fmtGBP(role.annual_rate)}</td>
                            <td className="p-2 text-right">{fmtGBP(hourlyRate)}/hr</td>
                            <td className="p-2 text-right font-medium">{fmtGBP(hourlyRate * onCostMultiplier)}/hr</td>
                            <td className="p-2 text-right">{fmtGBP(niAmt)}</td>
                            <td className="p-2 text-right">{fmtGBP(penAmt)}</td>
                            <td className="p-2 text-right font-medium">{fmtGBP(totalAnnual)}</td>
                            <td className="p-2 text-right font-semibold text-primary">{fmtGBP(maxMonthly)}/mo</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  On-costs: Employer NI ({rateSettings.employer_ni_pct}%) + Employer Pension ({rateSettings.employer_pension_pct}%) = {rateSettings.on_costs_pct.toFixed(2)}% total. Max monthly assumes full allocation (9 sessions, 37.5 hrs, or 1.0 WTE). Rates can be updated via Settings.
                </p>
              </div>
              <div className="pt-1">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="border-teal-300 text-teal-700 hover:bg-teal-50">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Buy-Back Explainer Guide
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[95vw] w-[95vw] max-h-[92vh] h-[92vh] p-0 overflow-hidden">
                    {isENN ? <ENNBoardPresentationExplainer /> : <BoardPresentationExplainer />}
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

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
            {neighbourhoodLabel} SDA Staff
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddStaffForm saving={savingStaff} onAdd={addStaff} staffRoles={staffRoles} rateParams={rateParams} practiceKeys={effectivePracticeKeys} practiceNames={ALL_PRACTICES} />

          {/* Staff list */}
          {filteredStaff.length > 0 && (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                   <tr>
                     <th className="text-left p-2 font-medium">Practice</th>
                     <th className="text-left p-2 font-medium">Category</th>
                     <th className="text-left p-2 font-medium">Name</th>
                     <th className="text-left p-2 font-medium">Role</th>
                     <th className="text-left p-2 font-medium">Allocation</th>
                     <th className="text-left p-2 font-medium">Start Date</th>
                     <th className="text-right p-2 font-medium">Monthly</th>
                     <th className="p-2"></th>
                   </tr>
                 </thead>
                 <tbody>
                   {filteredStaff.map(s => {
                     const displayName = maskStaffName(s.staff_name, user?.id, s.user_id, user?.email);
                     const monthly = calculateStaffMonthlyAmount(s, undefined, undefined, rateParams);
                     return (
                       <tr key={s.id} className="border-t">
                          <td className="p-2 text-xs">{resolvePracticeName(s.practice_key)}</td>
                          <td className="p-2">{categoryBadge(s.staff_category)}</td>
                         <td className="p-2">{displayName}</td>
                         <td className="p-2">{s.staff_role}</td>
                         <td className="p-2">{s.allocation_value} {s.allocation_type}</td>
                         <td className="p-2 text-xs">{s.start_date ? format(new Date(s.start_date), 'dd/MM/yyyy') : '—'}</td>
                          <td className="p-2 text-right font-medium">
                            <CalcBreakdownHover staff={s} amount={monthly} rateParams={rateParams} />
                          </td>
                         <td className="p-2 text-right">
                           <Button variant="ghost" size="icon" onClick={() => {
                             if (window.confirm(`Remove ${displayName} from the staff list?`)) {
                               removeStaff(s.id);
                             }
                           }}>
                             <Trash2 className="w-4 h-4 text-destructive" />
                           </Button>
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
          )}
        </CardContent>
      </Card>
      )}

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
              <Select value={claimPractice} onValueChange={setClaimPractice}>
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
            <Button onClick={handleCreateClaim} disabled={savingClaim || filteredStaff.length === 0 || !claimPractice}>
              {savingClaim ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Claim
            </Button>
          </div>
          {filteredStaff.length === 0 && (
            <p className="text-sm text-muted-foreground">Add staff members above before creating a claim.</p>
          )}
          {!claimPractice && filteredStaff.length > 0 && (
            <p className="text-sm text-muted-foreground">Select a practice to create a claim.</p>
          )}
        </CardContent>
      </Card>
      )}

      <Separator />

      {/* Claims */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {filteredClaims.some(c => c.status === 'draft') ? 'Current Claim' : 'Claims History'}
          </CardTitle>
          {effectiveIsAdmin && !testActive && (
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
              ] as const).map(({ key, label }) => (
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
          {effectiveIsAdmin && (
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
                const claimCategory: 'buyback' | 'new_sda' | 'mixed' = categories.length === 0 ? 'buyback'
                  : categories.length === 1 ? (categories[0] as 'buyback' | 'new_sda')
                  : 'mixed';
                const isBuyBack = claimCategory === 'buyback' || claimCategory === 'mixed';
                
                // Test mode overrides for verify/approve
                let canVerifyClaim: boolean;
                let canApproveThisClaim: boolean;

                if (testActive) {
                  canVerifyClaim = testMode.role === 'mgmt_lead' && isBuyBack && c.status === 'submitted';
                  const canApproveBB = isBuyBack && c.status === 'verified';
                  const canApproveNS = !isBuyBack && c.status === 'submitted';
                  canApproveThisClaim = testMode.role === 'pml_director' && (canApproveBB || canApproveNS);
                } else {
                  canVerifyClaim = isAdmin && isBuyBack && c.status === 'submitted' && (
                    (!hasAnyAssignment) || myVerifierPractices.includes(c.practice_key || '')
                  );
                  const canApproveBuyBack = isBuyBack && c.status === 'verified';
                  const canApproveNewSda = !isBuyBack && c.status === 'submitted';
                  canApproveThisClaim = isAdmin && (canApproveBuyBack || canApproveNewSda) && (
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
                    isAdmin={testActive ? (testMode.role !== 'practice' && testMode.role !== 'pml_finance') : isAdmin}
                    canApproveClaim={canApproveThisClaim}
                    canVerifyClaim={canVerifyClaim}
                    rateParams={rateParams}
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
                    onMarkPaid={markPaid}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Management Time Section */}
      {effectiveIsAdmin && !isENN && (
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
  } as BuyBackStaffMember, claimMonth, staff.start_date, rateParams);
}

/** Build a detailed calculation breakdown for hover display */
function buildCalcTooltip(staff: any, claimMonth?: string, rateParams?: RateParams) {
  const allocType = staff.allocation_type as 'sessions' | 'wte' | 'hours';
  const allocValue = staff.allocation_value as number;
  const niPct = rateParams?.employerNiPct ?? 15;
  const pensionPct = rateParams?.employerPensionPct ?? 14.38;
  const onCostRate = rateParams ? (rateParams.onCostMultiplier - 1) : 0.2938;
  const onCostPct = onCostRate * 100;

  let roleAnnualRate: number | undefined;
  if (rateParams?.getRoleAnnualRate && staff.staff_role) {
    roleAnnualRate = rateParams.getRoleAnnualRate(staff.staff_role);
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

  const niValue = baseSalary * (niPct / 100);
  const pensionValue = baseSalary * (pensionPct / 100);
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

  return { baseSalary, baseLabel, niPct, pensionPct, niValue, pensionValue, onCostsValue, onCostPct, annualBase, fullMonthly, proRataInfo, finalMonthly, baseRate: rateLabel };
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
          {/* Step 1: Base salary */}
          <div>
            <p className="text-muted-foreground font-medium mb-0.5">Base Salary</p>
            <p className="text-foreground">{breakdown.baseLabel}</p>
            <p className="font-semibold">= {fmtGBP(breakdown.baseSalary)}/year</p>
          </div>
          <Separator />
          {/* Step 2: On-costs split */}
          <div>
            <p className="text-muted-foreground font-medium mb-0.5">+ Employer On-Costs ({breakdown.onCostPct.toFixed(2)}%)</p>
            <p className="text-foreground">Employer NI ({breakdown.niPct}%): {fmtGBP(breakdown.niValue)}</p>
            <p className="text-foreground">Employer Pension ({breakdown.pensionPct}%): {fmtGBP(breakdown.pensionValue)}</p>
            <p className="text-foreground">Total on-costs: {fmtGBP(breakdown.onCostsValue)}</p>
            <p className="font-semibold">Total annual: {fmtGBP(breakdown.baseSalary)} + {fmtGBP(breakdown.onCostsValue)} = {fmtGBP(breakdown.annualBase)}/year</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 italic">Rates as configured in Settings</p>
          </div>
          <Separator />
          {/* Step 2: Monthly */}
          <div>
            <p className="text-muted-foreground font-medium mb-0.5">Monthly Amount</p>
            <p className="text-foreground">{fmtGBP(breakdown.annualBase)} ÷ 12 months</p>
            <p className="font-semibold">= {fmtGBP(breakdown.fullMonthly)}/month</p>
          </div>
          {/* Step 3: Pro-rata if applicable */}
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
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function ClaimCard({ claim, claimCategory, userId, userEmail, isAdmin, canApproveClaim, canVerifyClaim, rateParams, onSubmit, onDelete, onConfirmDeclaration, onUpdateStaffAmount, onRemoveStaff, onUpdateStaffNotes, onUpdateStaffLine, onApprove, onReject, onVerify, onQuery, onMarkPaid }: {
  claim: BuyBackClaim;
  claimCategory: 'buyback' | 'new_sda' | 'mixed';
  userId?: string;
  userEmail?: string;
  isAdmin: boolean;
  canApproveClaim?: boolean;
  canVerifyClaim?: boolean;
  rateParams?: RateParams;
  onSubmit: (id: string) => void;
  onDelete: (id: string) => void;
  onConfirmDeclaration: (id: string, confirmed: boolean) => void;
  onUpdateStaffAmount: (claimId: string, staffIndex: number, amount: number) => void;
  onRemoveStaff: (claimId: string, staffIndex: number) => void;
  onUpdateStaffNotes: (claimId: string, staffIndex: number, notes: string) => void;
  onUpdateStaffLine: (claimId: string, staffIndex: number, updates: { allocation_type?: string; allocation_value?: number; start_date?: string | null; claimed_amount?: number; notes?: string }, rateParams?: RateParams) => void;
  onApprove: (id: string, notes?: string) => void;
  onReject: (id: string, notes: string) => void;
  onVerify?: (id: string, notes?: string) => void;
  onQuery?: (id: string, notes: string) => void;
  onMarkPaid?: (id: string) => void;
}) {
  const [editingNoteIdx, setEditingNoteIdx] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
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
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={() => onDelete(claim.id)}>
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          )}
          {/* Testing-only: allow malcolm.railson to delete approved/rejected claims */}
          {!canEdit && (claim.status === 'approved' || claim.status === 'rejected' || claim.status === 'submitted') && userEmail?.toLowerCase() === 'malcolm.railson@nhs.net' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" onClick={() => {
                    if (window.confirm('Delete this ' + claim.status + ' claim? This is a testing function.')) {
                      onDelete(claim.id);
                    }
                  }}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Testing: Delete {claim.status} claim</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Staff lines */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/20">
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
        </thead>
        <tbody>
          {staffDetails.map((s, idx) => {
            const maxAmount = getStaffMaxAmount(s, claim.claim_month, rateParams);
            const claimedAmount = s.claimed_amount ?? maxAmount;
            const displayName = maskStaffName(s.staff_name, userId, claim.user_id, userEmail);
            const hasNotes = !!s.notes;
            const belowMax = claimedAmount < maxAmount && maxAmount > 0;
            return (
              <>
                <tr key={idx} className="border-b">
                  <td className="p-2">{displayName}</td>
                  <td className="p-2">
                    {(s.staff_category || 'buyback') === 'new_sda'
                      ? <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs">New SDA</Badge>
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
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          className="h-7 w-16 text-xs text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          defaultValue={s.allocation_value}
                          min={0}
                          max={s.allocation_type === 'sessions' ? 9 : s.allocation_type === 'hours' ? 37.5 : 1}
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
                      <span className="text-xs">{s.allocation_value} {s.allocation_type}</span>
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
                {/* Inline staff evidence */}
                <tr key={`evidence-${idx}`} className="border-b">
                  <td colSpan={canEdit ? 9 : 8} className="p-0">
                    <StaffLineEvidence
                      staffCategory={(s.staff_category || 'buyback') as 'buyback' | 'new_sda'}
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
                    />
                  </td>
                </tr>
              </>
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
      {(claim.status === 'approved' || claim.status === 'rejected') && claim.reviewed_at && (
        <div className={`px-3 py-2 border-t text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 ${claim.status === 'approved' ? 'bg-green-50/50 dark:bg-green-950/20' : 'bg-red-50/50 dark:bg-red-950/20'}`}>
          <span>{claim.status === 'approved' ? 'Approved' : 'Rejected'} by: <strong className="text-foreground">{claim.approved_by_email || '—'}</strong></span>
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

      {/* Payment info */}
      {claim.paid_at && (
        <div className="px-3 py-2 border-t bg-green-50/50 dark:bg-green-950/20 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span>Paid by: <strong className="text-foreground">{claim.paid_by || '—'}</strong></span>
          <span>on <strong className="text-foreground">{format(new Date(claim.paid_at), 'dd/MM/yyyy')} at {format(new Date(claim.paid_at), 'HH:mm')}</strong></span>
        </div>
      )}

      {/* Invoice info & download */}
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
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={async () => {
              const { data } = await supabase.storage.from('nres-claim-evidence').createSignedUrl(claim.invoice_pdf_path!, 300);
              if (data?.signedUrl) window.open(data.signedUrl, '_blank');
            }}>
              <Download className="w-3 h-3" /> Download PDF
            </Button>
          )}
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
          ) : (
            <span className="text-xs text-muted-foreground">
              Declaration: {claim.declaration_confirmed ? '✓ Confirmed' : '✗ Not confirmed'}
            </span>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {!evidenceComplete && (
              <span className="text-[10px] text-red-500">Upload all required evidence first</span>
            )}
            <Button size="sm" onClick={() => onSubmit(claim.id)} disabled={!claim.declaration_confirmed || !evidenceComplete}>
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

      {/* Mark as Paid action for approved/invoiced claims */}
      {isAdmin && (claim.status === 'approved' || claim.status === 'invoiced') && onMarkPaid && (
        <div className="px-3 py-3 border-t bg-green-50/50 dark:bg-green-950/20 flex items-center justify-between">
          <p className="text-xs font-medium text-green-800 dark:text-green-200">Payment Processing</p>
          <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => onMarkPaid(claim.id)}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark as Paid
          </Button>
        </div>
      )}
    </div>
  );
}
