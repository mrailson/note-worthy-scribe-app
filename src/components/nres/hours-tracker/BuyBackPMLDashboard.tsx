import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ChevronDown, Clock, Building2, PoundSterling, AlertTriangle, CheckCircle2, XCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getPracticeName } from '@/data/nresPractices';
import type { BuyBackClaim, RateParams } from '@/hooks/useNRESBuyBackClaims';
import { maskStaffName } from '@/utils/buybackStaffMasking';

// --- Types ---
type PMLView = 'director' | 'finance';
type ClaimStatus = 'draft' | 'submitted' | 'verified' | 'approved' | 'queried' | 'invoiced' | 'paid' | 'rejected';

interface BuyBackPMLDashboardProps {
  claims: BuyBackClaim[];
  userId?: string;
  userEmail?: string;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  isPMLDirector?: boolean;
  isPMLFinance?: boolean;
  rateParams?: RateParams;
  onVerify?: (id: string, notes?: string) => void;
  onQuery?: (id: string, notes: string) => void;
  onApprove: (id: string, notes?: string) => void;
  onReject: (id: string, notes: string) => void;
  savingClaim?: boolean;
  defaultView?: PMLView;
}

// --- Status config ---
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  submitted: { label: 'Submitted', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  verified: { label: 'Verified', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  approved: { label: 'Approved', color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
  invoiced: { label: 'Invoiced', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  paid: { label: 'Paid', color: '#166534', bg: '#f0fdf4', border: '#86efac' },
  queried: { label: 'Queried', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  rejected: { label: 'Rejected', color: '#991b1b', bg: '#fef2f2', border: '#fca5a5' },
};

const VIEW_CONFIG = {
  director: {
    label: 'PML Director',
    description: 'Review and verify claims before finance processing',
    visibleStatuses: ['submitted', 'verified', 'approved', 'invoiced', 'paid', 'queried', 'rejected'] as ClaimStatus[],
    actionStatus: ['submitted'] as ClaimStatus[],
    pendingLabel: 'need verification',
  },
  finance: {
    label: 'PML Finance',
    description: 'Approve, query or reject verified claims for payment',
    visibleStatuses: ['verified', 'approved', 'invoiced', 'paid', 'queried', 'rejected'] as ClaimStatus[],
    actionStatus: ['verified', 'queried'] as ClaimStatus[],
    pendingLabel: 'need finance review',
  },
};

/** Format GBP */
function fmtGBP(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getStaffMaxAmount(staff: any): number {
  return staff.claimed_amount ?? staff.calculated_amount ?? 0;
}

// --- Sub-components ---

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.submitted;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  );
}

function SummaryCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className="flex-1 min-w-[140px] bg-white rounded-xl p-[18px_20px] border border-gray-200 flex flex-col gap-1"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center gap-1.5 text-gray-500 text-[13px] font-medium">
        {icon}{label}
      </div>
      <div className="text-[28px] font-bold tracking-tight leading-none mt-0.5"
        style={{ color: accent || '#111827' }}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function FilterPill({ label, active, onClick, count, color }: {
  label: string; active: boolean; onClick: () => void; count: number; color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs cursor-pointer transition-all duration-150"
      style={{
        border: '1px solid',
        borderColor: active ? (color || '#111827') : '#d1d5db',
        background: active ? (color ? `${color}10` : '#f9fafb') : '#fff',
        color: active ? (color || '#111827') : '#6b7280',
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
      <span
        className="text-[10px] font-semibold px-1.5 py-px rounded-full"
        style={{
          background: active ? (color || '#111827') : '#e5e7eb',
          color: active ? '#fff' : '#6b7280',
        }}
      >
        {count}
      </span>
    </button>
  );
}

function RequirementPill({ label, met }: { label: string; met: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
      style={{
        background: met ? '#ecfdf5' : '#fef2f2',
        color: met ? '#059669' : '#dc2626',
        border: `1px solid ${met ? '#a7f3d0' : '#fecaca'}`,
      }}
    >
      {met ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {label}
    </span>
  );
}

function ActionBtn({ label, color, bg, onClick, disabled }: {
  label: string; color: string; bg: string; onClick?: () => void; disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-1.5 rounded-lg text-[13px] font-semibold cursor-pointer transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        border: `1.5px solid ${color}`,
        background: hovered ? color : bg,
        color: hovered ? '#fff' : color,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {label}
    </button>
  );
}

function ClaimCard({ claim, view, expanded, onToggle, userId, userEmail, isAdmin, rateParams, onVerify, onQuery, onApprove, onReject, saving }: {
  claim: BuyBackClaim;
  view: PMLView;
  expanded: boolean;
  onToggle: () => void;
  userId?: string;
  userEmail?: string;
  isAdmin: boolean;
  rateParams?: RateParams;
  onVerify?: (id: string, notes?: string) => void;
  onQuery?: (id: string, notes: string) => void;
  onApprove: (id: string, notes?: string) => void;
  onReject: (id: string, notes: string) => void;
  saving?: boolean;
}) {
  const [reviewNotes, setReviewNotes] = useState('');
  const staffDetails = (claim.staff_details || []) as any[];
  const practiceName = getPracticeName(claim.practice_key);
  const monthLabel = format(new Date(claim.claim_month), 'MMMM yyyy');
  const totalClaimed = staffDetails.reduce((sum, s) => sum + (s.claimed_amount ?? s.calculated_amount ?? 0), 0);
  const totalMax = staffDetails.reduce((sum, s) => sum + (s.calculated_amount ?? s.claimed_amount ?? 0), 0);
  const hasOverRate = staffDetails.some(s => (s.claimed_amount ?? 0) > (s.calculated_amount ?? s.claimed_amount ?? 0));

  const viewCfg = VIEW_CONFIG[view];
  const showDirectorActions = view === 'director' && claim.status === 'submitted';
  const showFinanceActions = view === 'finance' && (claim.status === 'verified' || claim.status === 'queried');

  // Evidence / requirements
  const hasPartA = claim.declaration_confirmed;
  const hasPartB = staffDetails.length > 0; // Simplified — real check would use evidence

  const handleAction = (action: 'verify' | 'approve' | 'query' | 'reject') => {
    if (action === 'verify' && onVerify) onVerify(claim.id, reviewNotes || undefined);
    if (action === 'approve') onApprove(claim.id, reviewNotes || undefined);
    if (action === 'query' && onQuery) {
      if (!reviewNotes.trim()) return;
      onQuery(claim.id, reviewNotes);
    }
    if (action === 'reject') {
      if (!reviewNotes.trim()) return;
      onReject(claim.id, reviewNotes);
    }
    setReviewNotes('');
  };

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-shadow duration-200"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      {/* Collapsed header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-[18px] py-3.5 border-none bg-transparent cursor-pointer text-left text-sm"
      >
        <ChevronDown
          className={cn('w-[18px] h-[18px] text-gray-500 transition-transform duration-200', expanded && 'rotate-180')}
        />
        <div className="flex-1 flex items-center gap-2.5 flex-wrap">
          <span className="font-semibold text-gray-900 text-sm">{practiceName}</span>
          <span className="text-gray-500 text-[13px]">{monthLabel}</span>
          <StatusBadge status={claim.status} />
          {hasOverRate && (
            <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5" /> Over threshold
            </span>
          )}
        </div>
        <div className="text-right min-w-[100px]">
          <div className="font-bold text-gray-900 text-[15px]">{fmtGBP(totalClaimed)}</div>
          <div className="text-[11px] text-gray-400">{staffDetails.length} staff</div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-[18px] pb-[18px]">
          {/* Metadata row */}
          <div className="flex flex-wrap gap-5 py-3.5 border-b border-gray-100 text-xs text-gray-500">
            <div>
              <span className="font-semibold">Submitted:</span> {claim.submitted_by_email || '—'}
              <br />
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {claim.submitted_at ? format(new Date(claim.submitted_at), "dd/MM/yyyy 'at' HH:mm") : '—'}
              </span>
            </div>
            {claim.verified_by && (
              <div>
                <span className="font-semibold">Verified:</span> {claim.verified_by}
                <br />
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {claim.verified_at ? format(new Date(claim.verified_at), "dd/MM/yyyy 'at' HH:mm") : '—'}
                </span>
              </div>
            )}
            <div className="flex gap-1.5 items-center">
              <RequirementPill label="Part A" met={!!hasPartA} />
              <RequirementPill label="Part B" met={hasPartB} />
            </div>
          </div>

          {/* Staff detail table */}
          <div className="overflow-x-auto mt-3">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  {['Staff Member', 'Category', 'Role', 'Allocation', 'Start Date', 'Sessions', 'Max Rate', 'Claimed'].map(h => (
                    <th
                      key={h}
                      className={cn(
                        'py-2 px-2.5 font-semibold text-gray-700 text-xs uppercase tracking-wider',
                        ['Max Rate', 'Claimed', 'Sessions'].includes(h) ? 'text-right' : 'text-left'
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staffDetails.map((s, idx) => {
                  const maxAmt = s.calculated_amount ?? s.claimed_amount ?? 0;
                  const claimedAmt = s.claimed_amount ?? maxAmt;
                  const overRate = claimedAmt > maxAmt && maxAmt > 0;
                  const displayName = maskStaffName(s.staff_name, userId, claim.user_id, userEmail, isAdmin);
                  const allocLabel = s.allocation_type === 'daily'
                    ? `${s.allocation_value} day${s.allocation_value !== 1 ? 's' : ''}`
                    : s.allocation_type === 'sessions'
                    ? `${s.allocation_value} session${s.allocation_value !== 1 ? 's' : ''}/wk`
                    : s.allocation_type === 'hours'
                    ? `${s.allocation_value} hrs/wk`
                    : `${s.allocation_value} WTE`;

                  return (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-2.5 px-2.5 font-medium text-gray-900">{displayName}</td>
                      <td className="py-2.5 px-2.5">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold"
                          style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                          {s.staff_category === 'new_sda' ? 'New SDA'
                            : s.staff_category === 'management' ? 'Management'
                            : s.staff_category === 'gp_locum' ? 'GP Locum'
                            : s.staff_category === 'meeting' ? 'Meeting'
                            : 'Buy-Back'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 text-gray-700">{s.staff_role}</td>
                      <td className="py-2.5 px-2.5 text-gray-700">{allocLabel}</td>
                      <td className="py-2.5 px-2.5 text-gray-700">
                        {s.start_date ? format(new Date(s.start_date), 'd MMM yyyy') : '—'}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-gray-700">
                        {s.allocation_type === 'sessions' ? s.allocation_value : '—'}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-gray-700 tabular-nums">
                        {fmtGBP(maxAmt)}
                      </td>
                      <td className={cn('py-2.5 px-2.5 text-right font-semibold tabular-nums', overRate ? 'text-red-600' : 'text-gray-900')}>
                        {fmtGBP(claimedAmt)}
                        {overRate && <span className="text-[10px] ml-1 text-red-600">!</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200">
                  <td colSpan={6} />
                  <td className="py-2.5 px-2.5 text-right font-semibold text-xs text-gray-500">TOTAL</td>
                  <td className="py-2.5 px-2.5 text-right font-bold text-sm text-gray-900 tabular-nums">
                    {fmtGBP(totalClaimed)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {(claim.review_notes || claim.query_notes || claim.verified_notes) && (
            <div className="mt-3 flex flex-col gap-1.5">
              {(claim.review_notes || claim.query_notes) && (
                <div className="px-3.5 py-2.5 rounded-lg text-[13px]"
                  style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
                  <strong>Note:</strong> {claim.query_notes || claim.review_notes}
                </div>
              )}
              {claim.verified_notes && (
                <div className="px-3.5 py-2.5 rounded-lg text-[13px]"
                  style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
                  <strong>Verification:</strong> {claim.verified_notes}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          {showDirectorActions && (
            <div className="mt-4 flex gap-2 items-center pt-3.5 border-t border-gray-100">
              <span className="text-[13px] font-semibold text-gray-700 mr-2">Director Review:</span>
              <ActionBtn label="Verify" color="#059669" bg="#ecfdf5" onClick={() => handleAction('verify')} disabled={saving} />
              <ActionBtn label="Query" color="#d97706" bg="#fffbeb" onClick={() => handleAction('query')} disabled={saving || !reviewNotes.trim()} />
              <ActionBtn label="Reject" color="#dc2626" bg="#fef2f2" onClick={() => handleAction('reject')} disabled={saving || !reviewNotes.trim()} />
              <input
                type="text"
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                placeholder="Add review notes…"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-[13px] outline-none ml-1"
              />
            </div>
          )}
          {showFinanceActions && (
            <div className="mt-4 flex gap-2 items-center pt-3.5 border-t border-gray-100">
              <span className="text-[13px] font-semibold text-gray-700 mr-2">Finance Review:</span>
              <ActionBtn label="Approve" color="#059669" bg="#ecfdf5" onClick={() => handleAction('approve')} disabled={saving} />
              <ActionBtn label="Query" color="#d97706" bg="#fffbeb" onClick={() => handleAction('query')} disabled={saving || !reviewNotes.trim()} />
              <ActionBtn label="Reject" color="#dc2626" bg="#fef2f2" onClick={() => handleAction('reject')} disabled={saving || !reviewNotes.trim()} />
              <input
                type="text"
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                placeholder="Notes (required for Query and Reject)…"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-[13px] outline-none ml-1"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Main Dashboard ---
export function BuyBackPMLDashboard({
  claims,
  userId,
  userEmail,
  isAdmin,
  isSuperAdmin,
  isPMLDirector,
  isPMLFinance,
  rateParams,
  onVerify,
  onQuery,
  onApprove,
  onReject,
  savingClaim,
  defaultView,
}: BuyBackPMLDashboardProps) {
  const [view, setView] = useState<PMLView>(defaultView || (isPMLFinance ? 'finance' : 'director'));
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const viewCfg = VIEW_CONFIG[view];

  // All claims visible in current view (before status/search filter)
  const viewClaims = useMemo(() =>
    claims.filter(c => viewCfg.visibleStatuses.includes(c.status as ClaimStatus)),
    [claims, viewCfg.visibleStatuses]
  );

  // Status counts from view claims
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    viewClaims.forEach(c => {
      counts[c.status] = (counts[c.status] || 0) + 1;
    });
    return counts;
  }, [viewClaims]);

  // Filtered claims
  const filteredClaims = useMemo(() =>
    viewClaims.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (searchTerm) {
        const name = getPracticeName(c.practice_key).toLowerCase();
        if (!name.includes(searchTerm.toLowerCase())) return false;
      }
      return true;
    }),
    [viewClaims, statusFilter, searchTerm]
  );

  const totalValue = filteredClaims.reduce((sum, c) => {
    const staffDets = (c.staff_details || []) as any[];
    return sum + staffDets.reduce((s, st) => s + (st.claimed_amount ?? st.calculated_amount ?? 0), 0);
  }, 0);

  const pendingCount = viewClaims.filter(c =>
    viewCfg.actionStatus.includes(c.status as ClaimStatus)
  ).length;

  return (
    <div className="max-w-[960px] mx-auto py-6 px-4 text-gray-900">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-2 h-7 rounded" style={{ background: '#005eb8' }} />
          <h1 className="text-[22px] font-bold tracking-tight m-0">Buy-Back Claims</h1>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-white"
            style={{ background: '#005eb8', letterSpacing: '0.03em' }}>
            NRES
          </span>
        </div>
        <p className="text-[13px] text-gray-500 ml-[18px]">{viewCfg.description}</p>
      </div>

      {/* View toggle */}
      <div className="inline-flex bg-gray-100 rounded-[10px] p-[3px] mb-5 gap-0.5">
        {(['director', 'finance'] as PMLView[]).map(key => (
          <button
            key={key}
            onClick={() => { setView(key); setStatusFilter('all'); setExpandedId(null); }}
            className={cn(
              'px-5 py-2 rounded-lg border-none text-[13px] cursor-pointer transition-all duration-150',
              view === key
                ? 'bg-white text-gray-900 font-semibold shadow-sm'
                : 'bg-transparent text-gray-500 font-medium'
            )}
          >
            {VIEW_CONFIG[key].label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <SummaryCard
          icon={<Building2 className="w-4 h-4" />}
          label="Total Claims"
          value={viewClaims.length}
          sub="in pipeline"
        />
        <SummaryCard
          icon={<PoundSterling className="w-4 h-4" />}
          label="Total Value"
          value={`£${totalValue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          sub="filtered view"
          accent="#005eb8"
        />
        <SummaryCard
          icon={<Clock className="w-4 h-4" />}
          label="Awaiting Action"
          value={pendingCount}
          sub={viewCfg.pendingLabel}
          accent={pendingCount > 0 ? '#d97706' : '#059669'}
        />
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search practice…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-[13px] w-[200px] outline-none"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <FilterPill
            label="All"
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
            count={viewClaims.length}
          />
          {viewCfg.visibleStatuses.map(s => (
            <FilterPill
              key={s}
              label={STATUS_CONFIG[s]?.label || s}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              count={statusCounts[s] || 0}
              color={STATUS_CONFIG[s]?.color}
            />
          ))}
        </div>
      </div>

      {/* Claims list */}
      <div className="flex flex-col gap-2.5">
        {filteredClaims.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
            No claims match the current filters.
          </div>
        ) : (
          filteredClaims.map(c => (
            <ClaimCard
              key={c.id}
              claim={c}
              view={view}
              expanded={expandedId === c.id}
              onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
              userId={userId}
              userEmail={userEmail}
              isAdmin={isAdmin}
              rateParams={rateParams}
              onVerify={onVerify}
              onQuery={onQuery}
              onApprove={onApprove}
              onReject={onReject}
              saving={savingClaim}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-3.5 border-t border-gray-200 flex justify-between items-center text-xs text-gray-400">
        <span>NRES New Models of Care — Buy-Back Claims Pipeline</span>
        <span>{filteredClaims.length} claim{filteredClaims.length !== 1 ? 's' : ''} shown</span>
      </div>
    </div>
  );
}
