import { useState, useMemo } from 'react';
import { type ClaimLine, type ClaimsRole, type Practice, type ClaimEvidence, type ClaimAuditEntry, STATUS_CONFIG, type ClaimStatus } from '@/hooks/useNRESClaims';
import { ClaimStatusBadge } from './ClaimStatusBadge';
import { ClaimStatusPipeline } from './ClaimStatusPipeline';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface ClaimsHistoryProps {
  claims: ClaimLine[];
  practices: Practice[];
  role: ClaimsRole;
  evidence: Record<string, ClaimEvidence[]>;
  auditLog: Record<string, ClaimAuditEntry[]>;
  saving: boolean;
  getAction: (claim: ClaimLine) => { from: ClaimStatus; to: ClaimStatus; label: string; icon: string } | null;
  canQuery: (claim: ClaimLine) => boolean;
  onAdvanceStatus: (claimId: string, from: ClaimStatus, to: ClaimStatus) => void;
  onResubmit: (claimId: string) => void;
  onQuery: (claimId: string, note: string) => void;
  onExpandClaim: (claimId: string) => void;
}

const IN_PROGRESS = ['submitted', 'verified', 'approved', 'invoice_created', 'scheduled'];

// Grouped filter keys for role-specific views
const GROUPED_FILTERS: Record<string, string[]> = {
  awaiting_pml_approval: ['verified'],
  awaiting_finance: ['approved', 'invoice_created', 'scheduled'],
  approved_and_paid: ['approved', 'invoice_created', 'scheduled', 'paid'],
  finance_pipeline: ['approved', 'invoice_created', 'scheduled'],
};

interface FilterPill {
  key: string;
  label: string;
  bg?: string;
  color?: string;
}

function getFilterPills(role: ClaimsRole, claims: ClaimLine[], statusCounts: Record<string, number>): FilterPill[] {
  if (role === 'approver') {
    const awaitingCount = statusCounts['verified'] || 0;
    const financeCount = (statusCounts['approved'] || 0) + (statusCounts['invoice_created'] || 0) + (statusCounts['scheduled'] || 0);
    const paidCount = statusCounts['paid'] || 0;
    return [
      { key: 'awaiting_pml_approval', label: `Awaiting PML Approval (${awaitingCount})`, bg: '#ede9fe', color: '#7c3aed' },
      { key: 'awaiting_finance', label: `Approved — Awaiting Finance (${financeCount})`, bg: '#fef3c7', color: '#d97706' },
      { key: 'approved_and_paid', label: `Approved & Paid (${financeCount + paidCount})`, bg: '#d1fae5', color: '#059669' },
      { key: 'all', label: `All (${statusCounts.all})` },
    ];
  }
  if (role === 'finance') {
    return [
      { key: 'finance_pipeline', label: `Awaiting Processing (${(statusCounts['approved'] || 0) + (statusCounts['invoice_created'] || 0) + (statusCounts['scheduled'] || 0)})`, bg: '#fef3c7', color: '#d97706' },
      { key: 'paid', label: `Paid (${statusCounts['paid'] || 0})`, bg: '#bbf7d0', color: '#16a34a' },
      { key: 'all', label: `All (${statusCounts.all})` },
    ];
  }
  // Default pills for other roles
  return [
    { key: 'all', label: `All (${statusCounts.all})` },
    { key: 'in_progress', label: `In Progress (${statusCounts.in_progress})` },
    ...Object.entries(STATUS_CONFIG)
      .filter(([k]) => k !== 'draft' || role === 'practice' || role === 'super_admin')
      .map(([key, cfg]) => ({ key, label: `${cfg.label} (${statusCounts[key] || 0})`, bg: cfg.bg, color: cfg.color })),
  ];
}

export function ClaimsHistory({
  claims, practices, role, evidence, auditLog, saving,
  getAction, canQuery, onAdvanceStatus, onResubmit, onQuery, onExpandClaim,
}: ClaimsHistoryProps) {
  const defaultFilter = role === 'approver' ? 'awaiting_pml_approval' : role === 'finance' ? 'finance_pipeline' : 'all';
  const [statusFilter, setStatusFilter] = useState(defaultFilter);
  const [practiceFilter, setPracticeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [queryNote, setQueryNote] = useState('');
  const [queryingId, setQueryingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return claims.filter(c => {
      // Check grouped filters first
      const groupedStatuses = GROUPED_FILTERS[statusFilter];
      if (groupedStatuses) return groupedStatuses.includes(c.status);
      if (statusFilter === 'in_progress') return IN_PROGRESS.includes(c.status);
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (practiceFilter !== 'all' && c.practice_id !== practiceFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return c.staff_member.toLowerCase().includes(term) || (c.claim_ref || '').toLowerCase().includes(term);
      }
      return true;
    });
  }, [claims, statusFilter, practiceFilter, searchTerm]);

  const totalValue = filtered.reduce((s, c) => s + (c.claimed_amount || 0), 0);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: claims.length, in_progress: claims.filter(c => IN_PROGRESS.includes(c.status)).length };
    claims.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return counts;
  }, [claims]);

  const handleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      onExpandClaim(id);
    }
  };

  const getPracticeName = (practiceId: string) => practices.find(p => p.id === practiceId)?.name || practiceId;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <h3 className="m-0 text-[15px] font-bold text-slate-900">Claims History</h3>
          <span className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-200 text-slate-600">{filtered.length}</span>
        </div>
        <div className="text-xs font-semibold text-slate-900">
          Total: £{totalValue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
        </div>
      </div>

      {/* Quick filter pills */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {getFilterPills(role, claims, statusCounts).map(item => (
          <button
            key={item.key}
            onClick={() => setStatusFilter(item.key)}
            className="px-2.5 py-1 rounded-full border-none text-[10px] font-semibold cursor-pointer transition-all"
            style={
              statusFilter === item.key
                ? { background: '#005eb8', color: '#fff' }
                : item.bg
                ? { background: item.bg, color: item.color }
                : { background: '#f1f5f9', color: '#64748b' }
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Search + practice filter */}
      <div className="grid grid-cols-[1fr_200px] gap-2 mb-3.5">
        <Input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search staff name or claim ID..."
          className="h-8 text-xs"
        />
        <Select value={practiceFilter} onValueChange={setPracticeFilter}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Practices" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Practices</SelectItem>
            {practices.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Claims list */}
      <div className="flex flex-col gap-1.5">
        {filtered.length === 0 && (
          <div className="p-7 text-center text-slate-400 text-xs bg-slate-50 rounded-lg border border-dashed border-slate-200">
            No claims match the current filters
          </div>
        )}
        {filtered.map(claim => {
          const action = getAction(claim);
          const expanded = expandedId === claim.id;
          const claimEvidence = evidence[claim.id] || [];
          const claimAudit = auditLog[claim.id] || [];

          return (
            <div key={claim.id} className="rounded-lg border border-slate-200 overflow-hidden">
              {/* Summary row */}
              <div
                onClick={() => handleExpand(claim.id)}
                className="grid items-center gap-1.5 px-3 py-2.5 cursor-pointer transition-colors"
                style={{
                  gridTemplateColumns: '85px 1fr 120px 90px 110px 28px',
                  background: expanded ? '#f8fafc' : '#fff',
                }}
              >
                <span className="text-[10px] font-semibold font-mono" style={{ color: '#005eb8' }}>{claim.claim_ref || '—'}</span>
                <div>
                  <div className="text-xs font-semibold text-slate-900">{claim.staff_member}</div>
                  <div className="text-[10px] text-slate-400">{getPracticeName(claim.practice_id)} — {new Date(claim.claim_month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
                </div>
                <div className="text-[11px] text-slate-600">{claim.role}</div>
                <div className="text-xs font-semibold text-slate-900">
                  {claim.claimed_amount ? `£${claim.claimed_amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—'}
                </div>
                <ClaimStatusBadge status={claim.status} />
                <span className="text-xs text-slate-400 text-center">
                  {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </span>
              </div>

              {/* Expanded detail */}
              {expanded && (
                <div className="p-3 pt-3 pb-4 bg-slate-50 border-t border-slate-200">
                  <ClaimStatusPipeline currentStatus={claim.status} />

                  <div className="grid grid-cols-4 gap-2.5 mt-2.5">
                    {[
                      ['Category', claim.category],
                      ['GL Code', claim.gl_code || '—'],
                      ['Allocation', claim.allocation || '—'],
                      ['Start Date', claim.start_date ? new Date(claim.start_date).toLocaleDateString('en-GB') : '—'],
                      ['Max Rate', claim.max_rate ? `£${claim.max_rate.toFixed(2)}` : '—'],
                      ['Claimed', claim.claimed_amount ? `£${claim.claimed_amount.toFixed(2)}` : '—'],
                      ['Submitted By', claim.submitted_by || '—'],
                      ['Submitted At', formatDate(claim.submitted_at)],
                    ].map(([l, v]) => (
                      <div key={l as string}>
                        <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{l}</div>
                        <div className="text-[11px] font-medium text-slate-900">{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Evidence */}
                  <div className="mt-2.5 p-2 bg-white rounded-md border border-slate-200">
                    <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Evidence</div>
                    {claimEvidence.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {claimEvidence.map(e => (
                          <span key={e.id} className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-medium">📎 {e.file_name}</span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-red-600 italic">No evidence uploaded</div>
                    )}
                  </div>

                  {/* Query note */}
                  {claim.status === 'queried' && claim.query_note && (
                    <div className="mt-2 p-2 bg-red-50 rounded-md border border-red-300 text-[11px] text-red-900">
                      <strong>Query:</strong> {claim.query_note}
                    </div>
                  )}

                  {/* Declaration */}
                  {claim.declared_by && (
                    <div className="mt-2 p-2 bg-blue-100 rounded-md text-[10px] text-blue-800 border border-blue-300">
                      <strong>Declaration:</strong> {claim.declaration_text} — <em>{claim.declared_by}</em>, {formatDate(claim.declared_at)}
                      {claim.on_behalf_of && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-semibold border border-amber-300">
                          🛡️ Submitted on behalf of {claim.on_behalf_of}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Audit trail */}
                  {claimAudit.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-[10px] font-semibold text-slate-500 cursor-pointer">Audit Trail ({claimAudit.length} entries)</summary>
                      <div className="mt-1 space-y-1">
                        {claimAudit.map(a => (
                          <div key={a.id} className="text-[10px] text-slate-600 flex gap-2 items-start">
                            <span className="text-slate-400 whitespace-nowrap">{formatDate(a.created_at)}</span>
                            <span>
                              <strong>{a.action}</strong>
                              {a.from_status && a.to_status && <> ({a.from_status} → {a.to_status})</>}
                              {' — '}{a.performed_by_name || a.performed_by}
                              {a.on_behalf_of && <span className="text-amber-700"> (on behalf of {a.on_behalf_of})</span>}
                              {a.notes && <span className="text-red-600"> — {a.notes}</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* Actions */}
                  <div className="flex gap-1.5 mt-2.5 items-center">
                    {action && (
                      <>
                        <Button
                          size="sm"
                          disabled={saving}
                          className="h-7 px-4 text-[11px] font-bold text-white"
                          style={{
                            background: STATUS_CONFIG[action.to]?.color || '#005eb8',
                            boxShadow: `0 1px 3px ${STATUS_CONFIG[action.to]?.color || '#005eb8'}44`,
                          }}
                          onClick={e => {
                            e.stopPropagation();
                            if (action.from === 'queried') {
                              onResubmit(claim.id);
                            } else {
                              onAdvanceStatus(claim.id, action.from, action.to);
                            }
                          }}
                        >
                          {action.icon} {action.label}
                        </Button>
                        {role === 'super_admin' && (
                          <span className="text-[9px] text-amber-800 font-semibold bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                            🛡️ Super Admin override
                          </span>
                        )}
                      </>
                    )}
                    {canQuery(claim) && (
                      queryingId === claim.id ? (
                        <div className="flex gap-1 flex-1">
                          <Input
                            value={queryNote}
                            onChange={e => setQueryNote(e.target.value)}
                            placeholder="Query reason..."
                            className="h-7 text-[11px] flex-1 border-red-300"
                            onClick={e => e.stopPropagation()}
                          />
                          <Button
                            size="sm"
                            className="h-7 px-3 text-[11px] font-semibold bg-red-600 text-white"
                            onClick={e => {
                              e.stopPropagation();
                              if (queryNote.trim()) {
                                onQuery(claim.id, queryNote);
                                setQueryingId(null);
                                setQueryNote('');
                              }
                            }}
                          >Send Query</Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={e => { e.stopPropagation(); setQueryingId(null); }}
                          >Cancel</Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3.5 text-[11px] font-semibold text-red-600 border-red-300"
                          onClick={e => { e.stopPropagation(); setQueryingId(claim.id); }}
                        >
                          <AlertTriangle className="w-3 h-3 mr-1" /> Raise Query
                        </Button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
