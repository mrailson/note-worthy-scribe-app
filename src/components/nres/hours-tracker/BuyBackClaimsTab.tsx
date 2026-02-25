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

  const handleSubmit = async () => {
    if (!name.trim() || !allocValue || !practice) return;
    await onAdd({
      staff_name: name.trim(),
      staff_role: role,
      allocation_type: allocType,
      allocation_value: parseFloat(allocValue),
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={v => setCategory(v as 'buyback' | 'new_sda')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="buyback">Buy-Back</SelectItem>
              <SelectItem value="new_sda">New SDA Recruit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Practice</Label>
          <Select value={practice} onValueChange={setPractice}>
            <SelectTrigger><SelectValue placeholder="Select practice" /></SelectTrigger>
            <SelectContent>
              {NRES_PRACTICE_KEYS.map(k => (
                <SelectItem key={k} value={k}>{NRES_PRACTICES[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="staff-name">Name</Label>
          <Input id="staff-name" value={name} onChange={e => setName(e.target.value)} placeholder="Staff name" />
        </div>
        <div>
          <Label>Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STAFF_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
        <div>
          <Label>Allocation Type</Label>
          <Select value={allocType} onValueChange={v => setAllocType(v as 'sessions' | 'wte' | 'hours')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sessions">Sessions</SelectItem>
              <SelectItem value="hours">Hours/week</SelectItem>
              <SelectItem value="wte">WTE</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{allocType === 'sessions' ? 'Sessions' : allocType === 'hours' ? 'Hours/week' : 'WTE'}</Label>
          <Input type="number" value={allocValue} onChange={e => setAllocValue(e.target.value)} placeholder="0" min="0" step="0.1" />
        </div>
        <div className="flex items-end">
          <Button onClick={handleSubmit} disabled={saving || !name.trim() || !practice || !allocValue} size="icon">
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
  const { claims, loading: loadingClaims, saving: savingClaim, admin: claimAdmin, createClaim, submitClaim, confirmDeclaration, deleteClaim, updateClaimAmount } = useNRESBuyBackClaims();

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

      {/* Claims History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Claims History</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredClaims.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No claims yet.</p>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium">Practice</th>
                    <th className="text-left p-2 font-medium">Month</th>
                    <th className="text-left p-2 font-medium">Staff</th>
                    <th className="text-right p-2 font-medium">Calculated</th>
                    <th className="text-right p-2 font-medium">Claimed</th>
                    <th className="text-center p-2 font-medium">Declaration</th>
                    <th className="text-center p-2 font-medium">Status</th>
                    <th className="p-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClaims.map(c => (
                    <ClaimRow key={c.id} claim={c} userId={user?.id} userEmail={user?.email} isAdmin={isAdmin} onSubmit={submitClaim} onDelete={deleteClaim} onConfirmDeclaration={confirmDeclaration} onUpdateAmount={updateClaimAmount} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ClaimRow({ claim, userId, userEmail, isAdmin, onSubmit, onDelete, onConfirmDeclaration, onUpdateAmount }: {
  claim: BuyBackClaim;
  userId?: string;
  userEmail?: string;
  isAdmin: boolean;
  onSubmit: (id: string) => void;
  onDelete: (id: string) => void;
  onConfirmDeclaration: (id: string, confirmed: boolean) => void;
  onUpdateAmount: (id: string, amount: number) => void;
}) {
  const isDraft = claim.status === 'draft';
  const canEdit = isDraft && (userId === claim.user_id || isAdmin);
  const staffNames = (claim.staff_details as any[])
    .map(s => maskStaffName(s.staff_name, userId, claim.user_id, userEmail))
    .join(', ');

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground',
      submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return <Badge className={variants[status] || ''}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  return (
    <tr className="border-t">
      <td className="p-2 text-xs">{getPracticeName(claim.practice_key)}</td>
      <td className="p-2">{format(new Date(claim.claim_month), 'MMMM yyyy')}</td>
      <td className="p-2 max-w-[200px] truncate" title={staffNames}>{staffNames}</td>
      <td className="p-2 text-right">{fmtGBP(claim.calculated_amount)}</td>
      <td className="p-2 text-right">
        {canEdit ? (
          <div className="space-y-1">
            <Input
              type="number"
              className="w-28 ml-auto text-right"
              value={claim.claimed_amount}
              onChange={e => {
                const val = parseFloat(e.target.value) || 0;
                onUpdateAmount(claim.id, Math.min(val, claim.calculated_amount));
              }}
              min="0"
              max={claim.calculated_amount}
              step="0.01"
            />
            <p className="text-[10px] text-muted-foreground text-right">
              Max: {fmtGBP(claim.calculated_amount)}
            </p>
          </div>
        ) : (
          fmtGBP(claim.claimed_amount)
        )}
      </td>
      <td className="p-2 text-center">
        {canEdit ? (
          <div className="flex flex-col items-center gap-1">
            <Checkbox
              checked={claim.declaration_confirmed}
              onCheckedChange={checked => onConfirmDeclaration(claim.id, !!checked)}
            />
            <span className="text-[10px] text-muted-foreground max-w-[150px] leading-tight">{DECLARATION_TEXT.substring(0, 60)}…</span>
          </div>
        ) : (
          claim.declaration_confirmed ? '✓' : '✗'
        )}
      </td>
      <td className="p-2 text-center">{statusBadge(claim.status)}</td>
      <td className="p-2">
        <div className="flex gap-1">
          {canEdit && (
            <>
              <Button size="sm" variant="default" onClick={() => onSubmit(claim.id)} disabled={!claim.declaration_confirmed} title="Submit for approval">
                <Send className="w-3 h-3 mr-1" /> Submit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(claim.id)}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </>
          )}
          {claim.review_notes && (
            <span className="text-xs text-muted-foreground italic" title={claim.review_notes}>Note</span>
          )}
        </div>
      </td>
    </tr>
  );
}
