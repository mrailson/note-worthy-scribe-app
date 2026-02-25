import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNRESBuyBackStaff, type BuyBackStaffMember } from '@/hooks/useNRESBuyBackStaff';
import { useNRESBuyBackClaims, calculateStaffMonthlyAmount, type BuyBackClaim } from '@/hooks/useNRESBuyBackClaims';
import { maskStaffName, isBuybackApprover } from '@/utils/buybackStaffMasking';
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

const DECLARATION_TEXT =
  "I confirm that all staff listed are working 100% on SDA (Part A) during their funded hours, with no LTC (Part B) activity, in accordance with the ICB-approved buy-back rules.";

const STAFF_ROLES = ['GP', 'ANP', 'ACP', 'Practice Nurse', 'HCA', 'Pharmacist', 'Other'];

export function BuyBackClaimsTab() {
  const { user } = useAuth();
  const { activeStaff, loading: loadingStaff, saving: savingStaff, addStaff, updateStaff, removeStaff } = useNRESBuyBackStaff();
  const { claims, loading: loadingClaims, saving: savingClaim, createClaim, submitClaim, confirmDeclaration, deleteClaim, updateClaimAmount } = useNRESBuyBackClaims();

  // New staff form state
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('GP');
  const [newAllocType, setNewAllocType] = useState<'sessions' | 'wte'>('sessions');
  const [newAllocValue, setNewAllocValue] = useState('');
  const [newRate, setNewRate] = useState('');

  // New claim state
  const [claimMonth, setClaimMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [guideOpen, setGuideOpen] = useState(false);
  const isLoading = loadingStaff || loadingClaims;

  const handleAddStaff = async () => {
    if (!newName.trim() || !newAllocValue || !newRate) return;
    await addStaff({
      staff_name: newName.trim(),
      staff_role: newRole,
      allocation_type: newAllocType,
      allocation_value: parseFloat(newAllocValue),
      hourly_rate: parseFloat(newRate),
      is_active: true,
    });
    setNewName('');
    setNewAllocValue('');
    setNewRate('');
  };

  const totalCalculated = activeStaff.reduce((sum, s) => sum + calculateStaffMonthlyAmount(s), 0);

  const handleCreateClaim = async () => {
    if (activeStaff.length === 0) return;
    const monthDate = `${claimMonth}-01`;
    // Find previous approved claim for default amount
    const prevApproved = claims.find(c => c.status === 'approved');
    const defaultAmount = prevApproved ? prevApproved.claimed_amount : totalCalculated;
    await createClaim(monthDate, activeStaff, defaultAmount, totalCalculated);
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground',
      submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return <Badge className={variants[status] || ''}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
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
      {/* Buy-Back Scheme Guide */}
      <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
        <div className="bg-white rounded-lg shadow-sm border border-teal-200 overflow-hidden">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 hover:bg-teal-50/50 transition-colors text-left">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-teal-100 text-teal-700">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#003087]">How the Buy-Back Scheme Works</h2>
                  <p className="text-sm text-muted-foreground">Quick reference guide, key rules &amp; claim steps</p>
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
                  The Neighbourhood Buy-Back Scheme allows practices to claim reimbursement for staff time dedicated
                  100% to <strong>SDA (Part A)</strong> work. Claims are overseen by the Senior Neighbourhood Officer (SNO) and
                  must follow ICB-approved rules.
                </p>
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
                  <li>Add staff members with their role, allocation and hourly rate</li>
                  <li>Set session or WTE allocations for each staff member</li>
                  <li>Create a monthly claim — the amount auto-calculates</li>
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

      {/* Staff Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5" />
            Buy-Back Staff
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add staff form */}
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
            <div className="sm:col-span-2">
              <Label htmlFor="staff-name">Name</Label>
              <Input id="staff-name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Staff name" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAFF_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={newAllocType} onValueChange={v => setNewAllocType(v as 'sessions' | 'wte')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sessions">Sessions</SelectItem>
                  <SelectItem value="wte">WTE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{newAllocType === 'sessions' ? 'Sessions' : 'WTE'}</Label>
              <Input type="number" value={newAllocValue} onChange={e => setNewAllocValue(e.target.value)} placeholder="0" min="0" step="0.1" />
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label>£/hr</Label>
                <Input type="number" value={newRate} onChange={e => setNewRate(e.target.value)} placeholder="0" min="0" step="0.01" />
              </div>
              <Button onClick={handleAddStaff} disabled={savingStaff || !newName.trim()} size="icon">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Staff list */}
          {activeStaff.length > 0 && (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium">Name</th>
                    <th className="text-left p-2 font-medium">Role</th>
                    <th className="text-left p-2 font-medium">Allocation</th>
                    <th className="text-right p-2 font-medium">Rate</th>
                    <th className="text-right p-2 font-medium">Monthly</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {activeStaff.map(s => {
                    const displayName = maskStaffName(s.staff_name, user?.id, s.user_id, user?.email);
                    const monthly = calculateStaffMonthlyAmount(s);
                    return (
                      <tr key={s.id} className="border-t">
                        <td className="p-2">{displayName}</td>
                        <td className="p-2">{s.staff_role}</td>
                        <td className="p-2">{s.allocation_value} {s.allocation_type}</td>
                        <td className="p-2 text-right">£{s.hourly_rate.toFixed(2)}</td>
                        <td className="p-2 text-right font-medium">£{monthly.toFixed(2)}</td>
                        <td className="p-2 text-right">
                          <Button variant="ghost" size="icon" onClick={() => removeStaff(s.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td colSpan={4} className="p-2 text-right">Total Calculated Monthly</td>
                    <td className="p-2 text-right">£{totalCalculated.toFixed(2)}</td>
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
              <Label>Claim Month</Label>
              <Input type="month" value={claimMonth} onChange={e => setClaimMonth(e.target.value)} />
            </div>
            <Button onClick={handleCreateClaim} disabled={savingClaim || activeStaff.length === 0}>
              {savingClaim ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Claim
            </Button>
          </div>
          {activeStaff.length === 0 && (
            <p className="text-sm text-muted-foreground">Add staff members above before creating a claim.</p>
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
          {claims.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No claims yet.</p>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
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
                  {claims.map(c => (
                    <ClaimRow key={c.id} claim={c} userId={user?.id} userEmail={user?.email} onSubmit={submitClaim} onDelete={deleteClaim} onConfirmDeclaration={confirmDeclaration} onUpdateAmount={updateClaimAmount} />
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

function ClaimRow({ claim, userId, userEmail, onSubmit, onDelete, onConfirmDeclaration, onUpdateAmount }: {
  claim: BuyBackClaim;
  userId?: string;
  userEmail?: string;
  onSubmit: (id: string) => void;
  onDelete: (id: string) => void;
  onConfirmDeclaration: (id: string, confirmed: boolean) => void;
  onUpdateAmount: (id: string, amount: number) => void;
}) {
  const isDraft = claim.status === 'draft';
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
      <td className="p-2">{format(new Date(claim.claim_month), 'MMMM yyyy')}</td>
      <td className="p-2 max-w-[200px] truncate" title={staffNames}>{staffNames}</td>
      <td className="p-2 text-right">£{claim.calculated_amount.toFixed(2)}</td>
      <td className="p-2 text-right">
        {isDraft ? (
          <Input
            type="number"
            className="w-24 ml-auto text-right"
            value={claim.claimed_amount}
            onChange={e => onUpdateAmount(claim.id, parseFloat(e.target.value) || 0)}
            min="0"
            step="0.01"
          />
        ) : (
          `£${claim.claimed_amount.toFixed(2)}`
        )}
      </td>
      <td className="p-2 text-center">
        {isDraft ? (
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
          {isDraft && (
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
