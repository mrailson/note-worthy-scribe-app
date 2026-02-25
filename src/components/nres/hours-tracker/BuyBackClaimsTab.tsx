import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNRESBuyBackStaff, type BuyBackStaffMember } from '@/hooks/useNRESBuyBackStaff';
import { useNRESBuyBackClaims, calculateStaffMonthlyAmount, type BuyBackClaim } from '@/hooks/useNRESBuyBackClaims';
import { maskStaffName, isBuybackApprover } from '@/utils/buybackStaffMasking';
import { NRES_PRACTICES, NRES_PRACTICE_KEYS, getPracticeName, type NRESPracticeKey } from '@/data/nresPractices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Plus, Trash2, Send, Users, FileText, Info, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';

/** Format a number as £X,XXX.XX */
function fmtGBP(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Build a human-readable calculation breakdown for the live preview */
function calcBreakdown(allocType: 'sessions' | 'wte' | 'hours', allocValue: number): string {
  if (allocType === 'sessions') {
    return `${allocValue} session${allocValue !== 1 ? 's' : ''} × £11,000/yr ÷ 12 months × 1.2938 on-costs`;
  }
  if (allocType === 'hours') {
    const wteRatio = (allocValue / 37.5).toFixed(2);
    return `${allocValue} hrs/wk ÷ 37.5 = ${wteRatio} WTE × £60,000/yr ÷ 12 months × 1.2938 on-costs`;
  }
  return `${allocValue} WTE × £60,000/yr ÷ 12 months × 1.2938 on-costs`;
}

const DECLARATION_TEXT =
  "I confirm that all staff listed are working 100% on SDA (Part A) during their funded hours, with no LTC (Part B) activity, in accordance with the ICB-approved buy-back rules.";

const STAFF_ROLES = ['GP', 'ANP', 'ACP', 'Practice Nurse', 'HCA', 'Pharmacist', 'Other'];

/** Isolated add-staff form – keeps its own state so typing never loses focus */
function AddStaffForm({ saving, onAdd }: {
  saving: boolean;
  onAdd: (member: Omit<BuyBackStaffMember, 'id' | 'user_id' | 'practice_id' | 'created_at' | 'updated_at'>) => Promise<any>;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('GP');
  const [allocType, setAllocType] = useState<'sessions' | 'wte' | 'hours'>('sessions');
  const [allocValue, setAllocValue] = useState('');
  const [category, setCategory] = useState<'buyback' | 'new_sda'>('buyback');
  const [practice, setPractice] = useState<string>('');

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
    });
    setName('');
    setAllocValue('');
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 items-end">
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
          <Label className="text-xs">Practice</Label>
          <Select value={practice} onValueChange={setPractice}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {NRES_PRACTICE_KEYS.map(k => (
                <SelectItem key={k} value={k}>{NRES_PRACTICES[k]}</SelectItem>
              ))}
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
              {STAFF_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
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
        } as BuyBackStaffMember);
        return (
          <div className="rounded-md bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800 px-3 py-2 text-sm space-y-1">
            <div>
              <span className="text-muted-foreground">Max monthly claim: </span>
              <span className="font-semibold text-teal-800 dark:text-teal-200">{fmtGBP(monthly)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {calcBreakdown(allocType, val)} = {fmtGBP(monthly)}/month
            </p>
          </div>
        );
      })()}
    </>
  );
}

export function BuyBackClaimsTab() {
  const { user } = useAuth();
  const { activeStaff, loading: loadingStaff, saving: savingStaff, admin, addStaff, updateStaff, removeStaff } = useNRESBuyBackStaff();
  const { claims, loading: loadingClaims, saving: savingClaim, admin: claimAdmin, createClaim, submitClaim, confirmDeclaration, deleteClaim, updateClaimAmount, updateStaffClaimedAmount } = useNRESBuyBackClaims();

  const isAdmin = admin;

  // New claim state
  const [claimMonth, setClaimMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [claimPractice, setClaimPractice] = useState<string>('');

  // Filters (admin)
  const [filterPractice, setFilterPractice] = useState<string>('all');

  const [guideOpen, setGuideOpen] = useState(false);
  const isLoading = loadingStaff || loadingClaims;

  // Filter staff by practice if filter is active
  const filteredStaff = filterPractice === 'all'
    ? activeStaff
    : activeStaff.filter(s => s.practice_key === filterPractice);

  const totalCalculated = filteredStaff.reduce((sum, s) => sum + calculateStaffMonthlyAmount(s), 0);

  const handleCreateClaim = async () => {
    if (filteredStaff.length === 0) return;
    const practiceForClaim = claimPractice || (filterPractice !== 'all' ? filterPractice : '');
    if (!practiceForClaim) return;
    const monthDate = `${claimMonth}-01`;
    const staffForClaim = filteredStaff.filter(s => s.practice_key === practiceForClaim);
    if (staffForClaim.length === 0) return;
    const calcAmount = staffForClaim.reduce((sum, s) => sum + calculateStaffMonthlyAmount(s), 0);
    // Pre-populate claimed amount at the calculated max — user can lower but not raise
    await createClaim(monthDate, staffForClaim, calcAmount, calcAmount, practiceForClaim);
  };

  // Filter claims by practice
  const filteredClaims = filterPractice === 'all'
    ? claims
    : claims.filter(c => c.practice_key === filterPractice);

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
                  This tab manages claims for two categories of staff working on the NRES SDA Programme:
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
              <div className="pt-1">
                <Button variant="outline" className="border-teal-300 text-teal-700 hover:bg-teal-50" asChild>
                  <a href="/buyback-explainer" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Full Explainer Guide
                  </a>
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Practice Filter (admin) */}
      {isAdmin && (
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium">Filter by Practice:</Label>
          <Select value={filterPractice} onValueChange={setFilterPractice}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All practices" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Practices</SelectItem>
              {NRES_PRACTICE_KEYS.map(k => (
                <SelectItem key={k} value={k}>{NRES_PRACTICES[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Staff Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5" />
            NRES SDA Staff
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddStaffForm saving={savingStaff} onAdd={addStaff} />

          {/* Staff list */}
          {filteredStaff.length > 0 && (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                   <tr>
                     <th className="text-left p-2 font-medium">Category</th>
                     <th className="text-left p-2 font-medium">Practice</th>
                     <th className="text-left p-2 font-medium">Name</th>
                     <th className="text-left p-2 font-medium">Role</th>
                     <th className="text-left p-2 font-medium">Allocation</th>
                     <th className="text-right p-2 font-medium">Monthly</th>
                     <th className="p-2"></th>
                   </tr>
                 </thead>
                 <tbody>
                   {filteredStaff.map(s => {
                     const displayName = maskStaffName(s.staff_name, user?.id, s.user_id, user?.email);
                     const monthly = calculateStaffMonthlyAmount(s);
                     return (
                       <tr key={s.id} className="border-t">
                         <td className="p-2">{categoryBadge(s.staff_category)}</td>
                         <td className="p-2 text-xs">{getPracticeName(s.practice_key)}</td>
                         <td className="p-2">{displayName}</td>
                         <td className="p-2">{s.staff_role}</td>
                         <td className="p-2">{s.allocation_value} {s.allocation_type}</td>
                         <td className="p-2 text-right font-medium">{fmtGBP(monthly)}</td>
                         <td className="p-2 text-right">
                           <Button variant="ghost" size="icon" onClick={() => removeStaff(s.id)}>
                             <Trash2 className="w-4 h-4 text-destructive" />
                           </Button>
                         </td>
                       </tr>
                     );
                   })}
                   <tr className="border-t bg-muted/30 font-semibold">
                     <td colSpan={5} className="p-2 text-right">Total Calculated Monthly</td>
                     <td className="p-2 text-right">{fmtGBP(totalCalculated)}</td>
                     <td></td>
                   </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Create Claim */}
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
                  {NRES_PRACTICE_KEYS.map(k => (
                    <SelectItem key={k} value={k}>{NRES_PRACTICES[k]}</SelectItem>
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

      <Separator />

      {/* Claims */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {filteredClaims.some(c => c.status === 'draft') ? 'Current Claim' : 'Claims History'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredClaims.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No claims yet.</p>
          ) : (
            <div className="space-y-6">
              {filteredClaims.map(c => (
                <ClaimCard
                  key={c.id}
                  claim={c}
                  userId={user?.id}
                  userEmail={user?.email}
                  isAdmin={isAdmin}
                  onSubmit={submitClaim}
                  onDelete={deleteClaim}
                  onConfirmDeclaration={confirmDeclaration}
                  onUpdateStaffAmount={updateStaffClaimedAmount}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Helper to get the max monthly amount for a staff detail entry */
function getStaffMaxAmount(staff: any): number {
  return calculateStaffMonthlyAmount({
    allocation_type: staff.allocation_type,
    allocation_value: staff.allocation_value,
    staff_role: staff.staff_role,
  } as BuyBackStaffMember);
}

function ClaimCard({ claim, userId, userEmail, isAdmin, onSubmit, onDelete, onConfirmDeclaration, onUpdateStaffAmount }: {
  claim: BuyBackClaim;
  userId?: string;
  userEmail?: string;
  isAdmin: boolean;
  onSubmit: (id: string) => void;
  onDelete: (id: string) => void;
  onConfirmDeclaration: (id: string, confirmed: boolean) => void;
  onUpdateStaffAmount: (claimId: string, staffIndex: number, amount: number) => void;
}) {
  const isDraft = claim.status === 'draft';
  const canEdit = isDraft && (userId === claim.user_id || isAdmin);
  const staffDetails = claim.staff_details as any[];

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground',
      submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return <Badge className={variants[status] || ''}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  const totalCalculated = staffDetails.reduce((sum, s) => sum + getStaffMaxAmount(s), 0);
  const totalClaimed = staffDetails.reduce((sum, s) => sum + (s.claimed_amount ?? getStaffMaxAmount(s)), 0);

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
        {canEdit && (
          <Button size="sm" variant="ghost" onClick={() => onDelete(claim.id)}>
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        )}
      </div>

      {/* Staff lines */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/20">
            <th className="text-left p-2 font-medium">Staff Member</th>
            <th className="text-left p-2 font-medium">Role</th>
            <th className="text-left p-2 font-medium">Allocation</th>
            <th className="text-right p-2 font-medium">Calculated</th>
            <th className="text-right p-2 font-medium">Claimed</th>
          </tr>
        </thead>
        <tbody>
          {staffDetails.map((s, idx) => {
            const maxAmount = getStaffMaxAmount(s);
            const claimedAmount = s.claimed_amount ?? maxAmount;
            const displayName = maskStaffName(s.staff_name, userId, claim.user_id, userEmail);
            return (
              <tr key={idx} className="border-b">
                <td className="p-2">{displayName}</td>
                <td className="p-2">{s.staff_role}</td>
                <td className="p-2">{s.allocation_value} {s.allocation_type}</td>
                <td className="p-2 text-right">{fmtGBP(maxAmount)}</td>
                <td className="p-2 text-right">
                  {canEdit ? (
                    <div className="space-y-0.5">
                      <Input
                        type="number"
                        className="w-28 ml-auto text-right"
                        value={claimedAmount.toFixed(2)}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          onUpdateStaffAmount(claim.id, idx, Math.min(val, maxAmount));
                        }}
                        min="0"
                        max={maxAmount}
                        step="0.01"
                      />
                      <p className="text-[10px] text-muted-foreground text-right">Max: {fmtGBP(maxAmount)}</p>
                    </div>
                  ) : (
                    fmtGBP(claimedAmount)
                  )}
                </td>
              </tr>
            );
          })}
          {/* Total row */}
          <tr className="bg-muted/30 font-semibold border-t">
            <td colSpan={3} className="p-2 text-right">Total</td>
            <td className="p-2 text-right">{fmtGBP(totalCalculated)}</td>
            <td className="p-2 text-right">{fmtGBP(totalClaimed)}</td>
          </tr>
        </tbody>
      </table>

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
                      I confirm all staff listed are working 100% on SDA (Part A) during their funded hours
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
          <Button size="sm" onClick={() => onSubmit(claim.id)} disabled={!claim.declaration_confirmed}>
            <Send className="w-3 h-3 mr-1" /> Submit
          </Button>
        )}
        {claim.review_notes && (
          <span className="text-xs text-muted-foreground italic ml-2" title={claim.review_notes}>Review note</span>
        )}
      </div>
    </div>
  );
}
