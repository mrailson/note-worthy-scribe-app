import { useState } from 'react';
import { type Practice, type ClaimsRole, CATEGORIES, STAFF_ROLES, GL_CODES } from '@/hooks/useNRESClaims';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CreateClaimPanelProps {
  practices: Practice[];
  selectedPracticeId: string;
  claimsRole: ClaimsRole;
  saving: boolean;
  onCreateAndSubmit: (entry: {
    practice_id: string;
    claim_month: string;
    staff_member: string;
    category: string;
    role: string;
    gl_code?: string;
    allocation?: string;
    max_rate?: number;
    claimed_amount?: number;
    on_behalf_of?: string;
  }) => Promise<string | undefined>;
  onDeclareAndSubmit: (claimId: string, onBehalfOf?: string) => Promise<void>;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const emptyForm = { staffMember: '', category: '', role: '', gl: '', allocation: '', maxRate: '' };

export function CreateClaimPanel({ practices, selectedPracticeId, claimsRole, saving, onCreateAndSubmit, onDeclareAndSubmit }: CreateClaimPanelProps) {
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [form, setForm] = useState(emptyForm);

  const practice = practices.find(p => p.id === selectedPracticeId);
  const isSuperAdmin = claimsRole === 'super_admin';
  const canSubmit = form.staffMember.trim() && form.category && form.role;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const monthIdx = MONTHS.indexOf(month) + 1;
    const claimMonth = `${year}-${String(monthIdx).padStart(2, '0')}-01`;

    const claimId = await onCreateAndSubmit({
      practice_id: selectedPracticeId,
      claim_month: claimMonth,
      staff_member: form.staffMember.trim(),
      category: form.category,
      role: form.role,
      gl_code: form.gl || undefined,
      allocation: form.allocation || undefined,
      max_rate: form.maxRate ? parseFloat(form.maxRate) : undefined,
      claimed_amount: form.maxRate ? parseFloat(form.maxRate) : undefined,
      on_behalf_of: isSuperAdmin ? practice?.name : undefined,
    });

    if (claimId) {
      await onDeclareAndSubmit(claimId, isSuperAdmin ? practice?.name : undefined);
      toast.success('Claim submitted', { description: `${form.staffMember} — ${form.category} declared & submitted.` });
      setForm(emptyForm);
    }
  };

  return (
    <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">📋</span>
        <h3 className="m-0 text-[15px] font-bold text-slate-900">
          Create Claim — {practice?.name || 'Select a practice'}
        </h3>
        {isSuperAdmin && (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            🛡️ Super Admin — on behalf of practice
          </span>
        )}
      </div>

      {/* Month / Year */}
      <div className="grid grid-cols-2 gap-2.5 mb-5 max-w-[250px]">
        <div>
          <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Claim Month</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Year</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['2025', '2026', '2027'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Single-entry form */}
      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Staff Member *</Label>
            <Input value={form.staffMember} onChange={e => setForm({ ...form, staffMember: e.target.value })} placeholder="Full name" className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Category *</Label>
            <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Role *</Label>
            <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{STAFF_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">GL Code</Label>
            <Select value={form.gl} onValueChange={v => setForm({ ...form, gl: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{GL_CODES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Allocation</Label>
            <Input value={form.allocation} onChange={e => setForm({ ...form, allocation: e.target.value })} placeholder="e.g. 8 hours" className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Max Rate (£)</Label>
            <Input value={form.maxRate} onChange={e => setForm({ ...form, maxRate: e.target.value })} placeholder="e.g. 960.00" className="h-8 text-xs" type="number" step="0.01" />
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={saving || !canSubmit}
          className="text-xs font-bold"
          style={{ background: '#005eb8' }}
        >
          {saving ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Check className="w-3 h-3 mr-1.5" />}
          Declare & Submit
        </Button>
      </div>

      <p className="text-[10px] text-slate-400 mt-3">
        Each submission creates one claim line with its own reference and invoice. Fill in the details and submit — repeat for each staff member.
      </p>
    </div>
  );
}
