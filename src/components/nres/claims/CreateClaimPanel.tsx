import { useState } from 'react';
import { type Practice, type ClaimsRole, CATEGORIES, STAFF_ROLES, GL_CODES } from '@/hooks/useNRESClaims';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, X, Check } from 'lucide-react';

interface DraftLine {
  id: number;
  staffMember: string;
  category: string;
  role: string;
  gl: string;
  allocation: string;
  maxRate: string;
}

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

export function CreateClaimPanel({ practices, selectedPracticeId, claimsRole, saving, onCreateAndSubmit, onDeclareAndSubmit }: CreateClaimPanelProps) {
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newLine, setNewLine] = useState<Omit<DraftLine, 'id'>>({ staffMember: '', category: '', role: '', gl: '', allocation: '', maxRate: '' });

  const practice = practices.find(p => p.id === selectedPracticeId);
  const isSuperAdmin = claimsRole === 'super_admin';

  const addLine = () => {
    if (!newLine.staffMember || !newLine.role) return;
    setLines([...lines, { ...newLine, id: Date.now() }]);
    setNewLine({ staffMember: '', category: '', role: '', gl: '', allocation: '', maxRate: '' });
    setShowAdd(false);
  };

  const removeLine = (id: number) => setLines(lines.filter(l => l.id !== id));

  const handleDeclareAndSubmit = async (line: DraftLine) => {
    const monthIdx = MONTHS.indexOf(month) + 1;
    const claimMonth = `${year}-${String(monthIdx).padStart(2, '0')}-01`;

    const claimId = await onCreateAndSubmit({
      practice_id: selectedPracticeId,
      claim_month: claimMonth,
      staff_member: line.staffMember,
      category: line.category,
      role: line.role,
      gl_code: line.gl || undefined,
      allocation: line.allocation || undefined,
      max_rate: line.maxRate ? parseFloat(line.maxRate) : undefined,
      claimed_amount: line.maxRate ? parseFloat(line.maxRate) : undefined,
      on_behalf_of: isSuperAdmin ? practice?.name : undefined,
    });

    if (claimId) {
      await onDeclareAndSubmit(claimId, isSuperAdmin ? practice?.name : undefined);
      removeLine(line.id);
    }
  };

  return (
    <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">📋</span>
        <h3 className="m-0 text-[15px] font-bold text-slate-900">
          Create Claim Lines — {practice?.name || 'Select a practice'}
        </h3>
        {isSuperAdmin && (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            🛡️ Super Admin — on behalf of practice
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-4 max-w-[250px]">
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

      {lines.length > 0 && (
        <div className="overflow-x-auto mb-3">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50">
                {['Staff Member', 'Category', 'Role', 'GL', 'Allocation', 'Max Rate', ''].map(h => (
                  <th key={h} className="p-2 text-left font-semibold text-slate-500 border-b border-slate-200 text-[10px] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map(line => (
                <tr key={line.id} className="border-b border-slate-100">
                  <td className="p-2">{line.staffMember}</td>
                  <td className="p-2">{line.category}</td>
                  <td className="p-2">{line.role}</td>
                  <td className="p-2">{line.gl}</td>
                  <td className="p-2">{line.allocation}</td>
                  <td className="p-2">£{line.maxRate}</td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={() => handleDeclareAndSubmit(line)}
                        disabled={saving}
                        className="h-7 px-3 text-[11px] font-bold"
                        style={{ background: '#005eb8' }}
                      >
                        <Check className="w-3 h-3 mr-1" /> Declare & Submit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeLine(line.id)}
                        className="h-7 w-7 p-0"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd ? (
        <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 mb-2.5">
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div>
              <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Staff Member</Label>
              <Input value={newLine.staffMember} onChange={e => setNewLine({ ...newLine, staffMember: e.target.value })} placeholder="Name" className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Category</Label>
              <Select value={newLine.category} onValueChange={v => setNewLine({ ...newLine, category: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Role</Label>
              <Select value={newLine.role} onValueChange={v => setNewLine({ ...newLine, role: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{STAFF_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2.5">
            <div>
              <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">GL Code</Label>
              <Select value={newLine.gl} onValueChange={v => setNewLine({ ...newLine, gl: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{GL_CODES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Allocation</Label>
              <Input value={newLine.allocation} onChange={e => setNewLine({ ...newLine, allocation: e.target.value })} placeholder="e.g. 8 hours" className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Max Rate (£)</Label>
              <Input value={newLine.maxRate} onChange={e => setNewLine({ ...newLine, maxRate: e.target.value })} placeholder="e.g. 960.00" className="h-8 text-xs" />
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={addLine} className="text-xs" style={{ background: '#005eb8' }}>Add Line Item</Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)} className="text-xs">Cancel</Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => setShowAdd(true)}
          className="w-full border-dashed text-xs font-semibold"
          style={{ color: '#005eb8' }}
        >
          <Plus className="w-3 h-3 mr-1" /> Add Line Item
        </Button>
      )}
    </div>
  );
}
