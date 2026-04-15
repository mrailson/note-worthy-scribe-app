import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ChevronDown, AlertTriangle, CheckCircle2, XCircle, Lock, Landmark, HelpCircle, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPracticeName, NRES_PRACTICE_BANK_DETAILS, NRES_ODS_CODES } from '@/data/nresPractices';
import type { NRESPracticeKey } from '@/data/nresPractices';
import type { BuyBackClaim, RateParams } from '@/hooks/useNRESBuyBackClaims';
import type { MeetingLogEntry } from '@/hooks/useNRESMeetingLog';
import { maskStaffName } from '@/utils/buybackStaffMasking';
import { InvoiceDownloadLink } from './InvoiceDownloadLink';

// --- Types ---
type PMLView = 'director' | 'finance';

interface BuyBackPMLDashboardProps {
  claims: BuyBackClaim[];
  meetingEntries?: MeetingLogEntry[];
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
  onMarkPaid?: (id: string, notes?: string) => void;
  onSchedulePayment?: (id: string, date: string, bacsRef?: string, notes?: string) => void;
  onApproveMeetingEntries?: (ids: string[], notes?: string) => Promise<boolean>;
  onQueryMeetingEntries?: (ids: string[], notes?: string) => Promise<boolean>;
  onRejectMeetingEntries?: (ids: string[], notes?: string) => Promise<boolean>;
  savingClaim?: boolean;
  defaultView?: PMLView;
  onGuideOpen?: () => void;
  onSettingsOpen?: () => void;
  showSettings?: boolean;
}

// --- Mapped status: internal 'verified' → display 'awaiting_review' for Director ---
type DisplayStatus = 'awaiting_review' | 'approved' | 'paid' | 'queried' | 'rejected' | 'invoiced';

function toDisplayStatus(s: string): DisplayStatus {
  if (s === 'submitted' || s === 'verified') return 'awaiting_review';
  return s as DisplayStatus;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  awaiting_review: { label: 'Awaiting Review', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', dot: '#3b82f6' },
  approved: { label: 'Approved', color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', dot: '#8b5cf6' },
  invoiced: { label: 'Invoiced', color: '#d97706', bg: '#fffbeb', border: '#fcd34d', dot: '#f59e0b' },
  paid: { label: 'Paid', color: '#166534', bg: '#f0fdf4', border: '#86efac', dot: '#22c55e' },
  queried: { label: 'Queried', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', dot: '#ef4444' },
  rejected: { label: 'Rejected', color: '#991b1b', bg: '#fef2f2', border: '#fca5a5', dot: '#dc2626' },
};

const ROLE_CONFIG = {
  director: {
    label: 'PML Director',
    subtitle: 'Review, approve or reject claims before payment',
    userLabel: 'PML Director',
  },
  finance: {
    label: 'PML Finance',
    subtitle: 'Process payments on approved claims',
    userLabel: 'PML Finance',
  },
};

/** Format GBP */
function fmtGBP(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtShort(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 0 });
}

function claimTotal(claim: BuyBackClaim): number {
  const staffDets = (claim.staff_details || []) as any[];
  return staffDets.reduce((sum, s) => sum + (s.claimed_amount ?? s.calculated_amount ?? 0), 0);
}

function hasOverRate(claim: BuyBackClaim): boolean {
  const staffDets = (claim.staff_details || []) as any[];
  return staffDets.some(s => (s.claimed_amount ?? 0) > (s.calculated_amount ?? s.claimed_amount ?? 0) && (s.calculated_amount ?? 0) > 0);
}

function dateStr(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} at ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

// --- Sub-components ---

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.awaiting_review;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, lineHeight: '16px', letterSpacing: '0.01em' }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '14px 16px',
      border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
    }}>
      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: accent, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{sub}</div>
    </div>
  );
}

function InfoBlock({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, marginBottom: 1 }}>{label}</div>
      <div style={{ fontWeight: 600, color: highlight || '#374151', fontSize: 13 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function EvidencePill({ label, met }: { label: string; met: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium"
      style={{
        padding: '2px 8px', borderRadius: 6,
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

function ActionBtn({ label, color, bg, bold, onClick, disabled }: {
  label: string; color: string; bg: string; bold?: boolean; onClick?: () => void; disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-[18px] py-[7px] rounded-lg text-[13px] font-semibold cursor-pointer transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        border: `1.5px solid ${color}`,
        background: hovered ? color : (bold ? color : bg),
        color: hovered ? '#fff' : (bold ? '#fff' : color),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {label}
    </button>
  );
}

// ─── Period filter ────────────────────────────────────────────────────────────
const PERIOD_OPTIONS = [
  { key: 'ytd', label: 'YTD 26/27' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'all', label: 'All Time' },
];

function filterByPeriod(claims: BuyBackClaim[], periodKey: string): BuyBackClaim[] {
  const now = new Date();
  const nowMonth = now.getMonth(); // 0-indexed
  const nowYear = now.getFullYear();
  const fyStartMonth = 3; // April
  const fyStartYear = nowMonth >= 3 ? nowYear : nowYear - 1;

  return claims.filter(c => {
    const d = new Date(c.claim_month);
    const cm = d.getMonth();
    const cy = d.getFullYear();
    switch (periodKey) {
      case 'ytd':
        if (cy > fyStartYear) return true;
        if (cy === fyStartYear && cm >= fyStartMonth) return true;
        return false;
      case 'this_month':
        return cm === nowMonth && cy === nowYear;
      case 'last_month': {
        const lastM = nowMonth === 0 ? 11 : nowMonth - 1;
        const lastY = nowMonth === 0 ? nowYear - 1 : nowYear;
        return cm === lastM && cy === lastY;
      }
      case 'all':
      default:
        return true;
    }
  });
}

// ─── Practice Spend Tracker ───────────────────────────────────────────────────
function PracticeSummary({ claims }: { claims: BuyBackClaim[] }) {
  const [period, setPeriod] = useState('all');
  const [practiceFilter, setPracticeFilter] = useState('all');

  const allPractices = useMemo(() => {
    const set = new Set<string>();
    claims.forEach(c => set.add(getPracticeName(c.practice_key)));
    return Array.from(set).sort();
  }, [claims]);

  const periodClaims = useMemo(() => filterByPeriod(claims, period), [claims, period]);
  const filteredClaims = useMemo(() => {
    if (practiceFilter === 'all') return periodClaims;
    return periodClaims.filter(c => getPracticeName(c.practice_key) === practiceFilter);
  }, [periodClaims, practiceFilter]);

  const rows = useMemo(() => {
    const byPractice: Record<string, { practice: string; claims: number; awaiting: number; queried: number; approved: number; paid: number; total: number }> = {};
    filteredClaims.forEach(c => {
      const name = getPracticeName(c.practice_key);
      if (!byPractice[name]) byPractice[name] = { practice: name, claims: 0, awaiting: 0, queried: 0, approved: 0, paid: 0, total: 0 };
      const t = claimTotal(c);
      const r = byPractice[name];
      r.claims += 1;
      r.total += t;
      const ds = toDisplayStatus(c.status);
      if (ds === 'awaiting_review') r.awaiting += t;
      else if (ds === 'queried') r.queried += t;
      else if (ds === 'approved') r.approved += t;
      else if (ds === 'paid') r.paid += t;
    });
    return Object.values(byPractice).sort((a, b) => b.total - a.total);
  }, [filteredClaims]);

  const grandTotals = useMemo(() =>
    rows.reduce((acc, r) => ({
      claims: acc.claims + r.claims, awaiting: acc.awaiting + r.awaiting,
      queried: acc.queried + r.queried, approved: acc.approved + r.approved,
      paid: acc.paid + r.paid, total: acc.total + r.total,
    }), { claims: 0, awaiting: 0, queried: 0, approved: 0, paid: 0, total: 0 }),
    [rows]
  );

  const COLS = [
    { key: 'practice', label: 'Practice', align: 'left' as const },
    { key: 'claims', label: 'Claims', align: 'center' as const },
    { key: 'awaiting', label: 'Awaiting Approval', align: 'right' as const, color: '#2563eb' },
    { key: 'queried', label: 'Queried', align: 'right' as const, color: '#dc2626' },
    { key: 'approved', label: 'Approved', align: 'right' as const, color: '#7c3aed' },
    { key: 'paid', label: 'Paid', align: 'right' as const, color: '#059669' },
    { key: 'total', label: 'Total Claimed', align: 'right' as const },
  ];

  const cellVal = (row: any, col: any) => {
    const v = row[col.key];
    if (col.key === 'practice') return v;
    if (col.key === 'claims') return v;
    if (v === 0) return '—';
    return fmtShort(v);
  };

  const cellColor = (row: any, col: any) => {
    if (col.key === 'practice') return '#374151';
    if (col.key === 'claims') return '#6b7280';
    if (col.key === 'total') return '#111827';
    if (row[col.key] === 0) return '#d1d5db';
    return col.color || '#111827';
  };

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
      padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Spend by Practice</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {PERIOD_OPTIONS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: period === p.key ? 600 : 400,
                  border: `1px solid ${period === p.key ? '#005eb8' : '#e5e7eb'}`,
                  background: period === p.key ? '#eff6ff' : '#fff',
                  color: period === p.key ? '#005eb8' : '#6b7280',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >{p.label}</button>
            ))}
          </div>
          <select
            value={practiceFilter}
            onChange={e => setPracticeFilter(e.target.value)}
            style={{
              padding: '4px 8px', borderRadius: 6, fontSize: 11, border: '1px solid #e5e7eb',
              color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none', maxWidth: 180,
            }}
          >
            <option value="all">All Practices</option>
            {allPractices.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {COLS.map(col => (
                <th key={col.key} style={{
                  textAlign: col.align, padding: '7px 8px', fontSize: 10, fontWeight: 600, color: '#9ca3af',
                  textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap',
                }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={COLS.length} style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>No claims in this period.</td></tr>
            ) : rows.map(row => (
              <tr key={row.practice} style={{ borderBottom: '1px solid #f3f4f6' }}>
                {COLS.map(col => (
                  <td key={col.key} style={{
                    padding: '8px', textAlign: col.align,
                    fontVariantNumeric: col.key !== 'practice' ? 'tabular-nums' : undefined,
                    fontWeight: col.key === 'practice' || col.key === 'total' ? 600 : 400,
                    color: cellColor(row, col), whiteSpace: col.key === 'practice' ? 'nowrap' : undefined,
                    maxWidth: col.key === 'practice' ? 200 : undefined, overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{cellVal(row, col)}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                {COLS.map(col => (
                  <td key={col.key} style={{
                    padding: '9px 8px', textAlign: col.align,
                    fontVariantNumeric: col.key !== 'practice' ? 'tabular-nums' : undefined,
                    fontWeight: 700, fontSize: col.key === 'total' ? 13 : 12,
                    color: col.key === 'practice' ? '#374151' : col.key === 'total' ? '#111827' : cellColor(grandTotals, col),
                  }}>
                    {col.key === 'practice' ? 'TOTALS' : cellVal(grandTotals, col)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af', display: 'flex', justifyContent: 'space-between' }}>
        <span>{rows.length} practice{rows.length !== 1 ? 's' : ''} · {grandTotals.claims} claim{grandTotals.claims !== 1 ? 's' : ''}</span>
        <span>{PERIOD_OPTIONS.find(p => p.key === period)?.label}{practiceFilter !== 'all' ? ` · ${practiceFilter}` : ''}</span>
      </div>
    </div>
  );
}

// ─── Claim Card ───────────────────────────────────────────────────────────────
function ClaimCard({ claim, view, expanded, onToggle, userId, userEmail, isAdmin, rateParams, onApprove, onQuery, onReject, onMarkPaid, onSchedulePayment, saving }: {
  claim: BuyBackClaim;
  view: PMLView;
  expanded: boolean;
  onToggle: () => void;
  userId?: string;
  userEmail?: string;
  isAdmin: boolean;
  rateParams?: RateParams;
  onApprove: (id: string, notes?: string) => void;
  onQuery?: (id: string, notes: string) => void;
  onReject: (id: string, notes: string) => void;
  onMarkPaid?: (id: string, notes?: string) => void;
  onSchedulePayment?: (id: string, date: string, bacsRef?: string, notes?: string) => void;
  saving?: boolean;
}) {
  const [reviewNotes, setReviewNotes] = useState('');
  const [payDate, setPayDate] = useState('');
  const [bacsRef, setBacsRef] = useState('');
  const [payMode, setPayMode] = useState<'schedule'|'pay'>('schedule');
  const staffDetails = (claim.staff_details || []) as any[];
  const practiceName = getPracticeName(claim.practice_key);
  const monthLabel = format(new Date(claim.claim_month), 'MMMM yyyy');
  const total = claimTotal(claim);
  const over = hasOverRate(claim);
  const displayStatus = toDisplayStatus(claim.status);

  const needsAction = (view === 'director' && (displayStatus === 'awaiting_review' || displayStatus === 'queried'))
    || (view === 'finance' && displayStatus === 'approved');
  const highlightColor = view === 'finance' ? '#c4b5fd' : '#93c5fd';
  const glowColor = view === 'finance' ? 'rgba(139,92,246,0.06)' : 'rgba(59,130,246,0.06)';

  const hasPartA = claim.declaration_confirmed;
  const hasPartB = staffDetails.length > 0;

  const handleAction = (action: 'approve' | 'query' | 'reject' | 'mark_paid') => {
    if (action === 'approve') onApprove(claim.id, reviewNotes || undefined);
    if (action === 'query' && onQuery) {
      if (!reviewNotes.trim()) return;
      onQuery(claim.id, reviewNotes);
    }
    if (action === 'reject') {
      if (!reviewNotes.trim()) return;
      onReject(claim.id, reviewNotes);
    }
    if (action === 'mark_paid' && payMode === 'pay' && onMarkPaid) {
      onMarkPaid(claim.id, reviewNotes || undefined);
      setBacsRef(''); setPayDate(''); setReviewNotes('');
    }
    if (action === 'mark_paid' && payMode === 'schedule' && onSchedulePayment) {
      if (!payDate) return;
      onSchedulePayment(claim.id, payDate, bacsRef || undefined, reviewNotes || undefined);
      setBacsRef(''); setPayDate(''); setReviewNotes('');
    }
    if (action !== 'mark_paid') setReviewNotes('');
  };

  const sessionCount = staffDetails.reduce((sum, s) => sum + (s.allocation_type === 'sessions' ? (s.allocation_value ?? 0) : s.allocation_type === 'daily' ? (s.allocation_value ?? 0) : 0), 0);

  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: `1px solid ${needsAction ? highlightColor : '#e5e7eb'}`,
      overflow: 'hidden',
      boxShadow: needsAction
        ? `0 0 0 1px ${highlightColor}, 0 2px 8px ${glowColor}`
        : '0 1px 3px rgba(0,0,0,0.04)',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Collapsed header */}
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 18px', border: 'none', background: 'transparent',
        cursor: 'pointer', textAlign: 'left', fontSize: 14,
      }}>
        <ChevronDown
          className={cn('w-[18px] h-[18px] text-gray-400 transition-transform duration-200', expanded && 'rotate-180')}
        />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#111827', whiteSpace: 'nowrap' }}>{practiceName}</span>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{monthLabel}</span>
          {(() => {
            const cfg = claim.claim_type === 'additional'
              ? { label: 'Additional', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' }
              : { label: 'Buy-Back', color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' };
            return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>;
          })()}
          <StatusBadge status={displayStatus} />
          {over && (
            <span className="inline-flex items-center gap-1 text-amber-600 text-[11px] font-medium">
              <AlertTriangle className="w-3.5 h-3.5" /> Over threshold
            </span>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 90 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmtGBP(total)}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            {staffDetails.length} line{staffDetails.length !== 1 ? 's' : ''} · {sessionCount} session{sessionCount !== 1 ? 's' : ''}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '0 18px 18px' }}>
          {/* Metadata */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 20, padding: '14px 0 12px',
            fontSize: 12, color: '#6b7280', borderBottom: '1px solid #f3f4f6',
          }}>
            <InfoBlock label="Verified by" value={claim.verified_by || '—'} sub={dateStr(claim.verified_at)} />
            <InfoBlock label="Submitted" value={dateStr(claim.submitted_at)} />
            {claim.invoice_number && <InvoiceDownloadLink claim={claim} />}
            {(claim as any).approved_by_email && (
              <InfoBlock label="Approved by" value={(claim as any).approved_by_email.split('@')[0].replace(/\./g,' ').replace(/\w/g, (c: string) => c.toUpperCase())} sub={dateStr((claim as any).approved_at)} highlight="#7c3aed" />
            )}
            {(claim as any).expected_payment_date && !claim.paid_at && (
              <InfoBlock label="Scheduled payment" value={new Date((claim as any).expected_payment_date).toLocaleDateString('en-GB')} highlight="#d97706" />
            )}
            {(claim as any).bacs_reference && (
              <InfoBlock label="BACS ref" value={(claim as any).bacs_reference} />
            )}
            {claim.paid_at && <InfoBlock label="Paid" value={new Date(claim.paid_at).toLocaleDateString('en-GB')} highlight="#166534" />}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <EvidencePill label="Part A" met={!!hasPartA} />
              <EvidencePill label="Part B" met={hasPartB} />
            </div>
          </div>

          {/* Bank details for payment verification */}
          {(() => {
            const bankDetails = NRES_PRACTICE_BANK_DETAILS[claim.practice_key as NRESPracticeKey];
            if (!bankDetails) return null;
            return (
              <div style={{
                display: 'flex', gap: 20, padding: '10px 0', fontSize: 12, color: '#6b7280',
                borderBottom: '1px solid #f3f4f6', alignItems: 'center', flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Landmark className="w-3.5 h-3.5 text-gray-500" />
                  <span style={{ fontWeight: 600, color: '#374151', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Payment Details</span>
                </div>
                <InfoBlock label="Account Name" value={bankDetails.accountName} />
                <InfoBlock label="Sort Code" value={bankDetails.sortCode} />
                <InfoBlock label="Account No" value={bankDetails.accountNumber} />
                {bankDetails.bankName && <InfoBlock label="Bank" value={bankDetails.bankName} />}
              </div>
            );
          })()}
          {hasPartA && hasPartB && claim.review_notes && (
            <div style={{
              marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12,
              background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0c4a6e',
            }}>
              <strong>Part B Substantiation:</strong> {claim.review_notes}
            </div>
          )}
          {hasPartA && !hasPartB && (
            <div style={{
              marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12,
              background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
            }}>
              <strong>Part B Evidence Missing:</strong> Part A claim submitted but Part B substantiation has not been provided. Evidence required before approval.
            </div>
          )}

          {/* Line items table */}
          <div style={{ overflowX: 'auto', margin: '12px 0 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Name', 'Role', 'GL Cat', 'Date', 'Hours Worked', 'Hrs', 'Amount'].map((h, i) => (
                    <th key={h} style={{
                      textAlign: i >= 5 ? 'right' : 'left',
                      padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#6b7280',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staffDetails.map((s: any, idx: number) => {
                  const maxAmt = s.calculated_amount ?? s.claimed_amount ?? 0;
                  const claimedAmt = s.claimed_amount ?? maxAmt;
                  const lineOver = claimedAmt > maxAmt && maxAmt > 0;
                  const displayName = maskStaffName(s.staff_name, userId, claim.user_id, userEmail, isAdmin);
                  const glCat = s.gl_code || s.gl_category || (s.staff_role === 'GP' ? '5421' : '—');
                  const hoursWorked = s.allocation_type === 'hours' ? `${s.allocation_value ?? 0} hrs/wk` : s.allocation_type === 'sessions' ? `${s.allocation_value ?? 0} sessions` : s.allocation_type === 'daily' ? `${s.allocation_value ?? 0} days` : `${s.allocation_value ?? 0} WTE`;
                  const totalHrs = s.allocation_type === 'hours' ? (s.allocation_value ?? 0) : null;

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px', fontWeight: 500, color: '#111827' }}>{displayName}</td>
                      <td style={{ padding: '10px', color: '#374151' }}>{s.staff_role}</td>
                      <td style={{ padding: '10px' }}>
                        <code style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f3f4f6', color: '#374151' }}>{glCat}</code>
                      </td>
                      <td style={{ padding: '10px', color: '#374151', whiteSpace: 'nowrap' }}>
                        {s.start_date ? format(new Date(s.start_date), 'd MMM yyyy') : '—'}
                      </td>
                      <td style={{ padding: '10px', color: '#374151', whiteSpace: 'nowrap' }}>{hoursWorked}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                        {totalHrs !== null ? totalHrs.toFixed(1) : '—'}
                      </td>
                      <td style={{
                        padding: '10px', textAlign: 'right', fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums', color: lineOver ? '#dc2626' : '#111827'
                      }}>
                        {fmtGBP(claimedAmt)}
                        {lineOver && <span style={{ marginLeft: 4, fontSize: 10, color: '#dc2626', fontWeight: 700 }}>+{fmtGBP(claimedAmt - maxAmt)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ padding: '10px' }} />
                  <td style={{ padding: '10px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Total</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#111827', fontVariantNumeric: 'tabular-nums', borderTop: '2px solid #e5e7eb' }}>
                    {fmtGBP(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Finance notes */}
          {(claim.query_notes || claim.verified_notes || claim.payment_notes) && (
            <div className="mt-3 flex flex-col gap-1.5">
              {claim.query_notes && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, fontSize: 13,
                  background: claim.status === 'queried' ? '#fef2f2' : '#fffbeb',
                  border: `1px solid ${claim.status === 'queried' ? '#fecaca' : '#fde68a'}`,
                  color: claim.status === 'queried' ? '#991b1b' : '#92400e',
                }}>
                  <strong>Query Note:</strong> {claim.query_notes}
                </div>
              )}
              {claim.verified_notes && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, fontSize: 13,
                  background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534',
                }}>
                  <strong>Verification:</strong> {claim.verified_notes}
                </div>
              )}
              {claim.payment_notes && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, fontSize: 13,
                  background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534',
                }}>
                  <strong>Finance Note:</strong> {claim.payment_notes}
                </div>
              )}
            </div>
          )}

          {/* Director action bar — Approve / Query / Reject */}
          {view === 'director' && (displayStatus === 'awaiting_review' || displayStatus === 'queried') && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Director Decision</span>
                {(!hasPartA || !hasPartB) && (
                  <span style={{ fontSize: 11, color: '#d97706', fontWeight: 500, marginLeft: 6 }}>
                    Evidence incomplete — review before approving
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <ActionBtn label="Approve" color="#059669" bg="#ecfdf5" bold={hasPartA && hasPartB}
                  onClick={() => handleAction('approve')} disabled={saving} />
                <ActionBtn label="Query" color="#d97706" bg="#fffbeb"
                  onClick={() => handleAction('query')} disabled={saving || !reviewNotes.trim()} />
                <ActionBtn label="Reject" color="#dc2626" bg="#fef2f2"
                  onClick={() => handleAction('reject')} disabled={saving || !reviewNotes.trim()} />
                <input
                  type="text"
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder="Notes (required for Query / Reject)…"
                  style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
                />
              </div>
            </div>
          )}

          {/* Finance action bar — Process Payment on approved claims */}
          {view === 'finance' && displayStatus === 'approved' && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Payment Processing</div>

              {/* Mode toggle */}
              <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 8, padding: 3, marginBottom: 12, gap: 2 }}>
                {(['schedule', 'pay'] as const).map(m => (
                  <button key={m} onClick={() => setPayMode(m)} style={{
                    padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: payMode === m ? 600 : 400,
                    background: payMode === m ? '#fff' : 'transparent',
                    color: payMode === m ? '#111827' : '#6b7280',
                    cursor: 'pointer', boxShadow: payMode === m ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                    transition: 'all .15s',
                  }}>
                    {m === 'schedule' ? '📅 Schedule Payment' : '✓ Mark as Paid'}
                  </button>
                ))}
              </div>

              {payMode === 'schedule' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'flex-end' }}>
                  <div style={{ minWidth: 140 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Scheduled payment date</div>
                    <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', cursor: 'pointer' }} />
                  </div>
                  <div style={{ flex: '1 1 140px', minWidth: 120 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>BACS reference (optional)</div>
                    <input value={bacsRef} onChange={e => setBacsRef(e.target.value)}
                      placeholder="e.g. NRES-APR26-001"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }} />
                  </div>
                  <div style={{ flex: '1 1 140px', minWidth: 120 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Note (optional)</div>
                    <input value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
                      placeholder="e.g. April BACS run"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }} />
                  </div>
                  <ActionBtn label="Schedule Payment" color="#d97706" bg="#fffbeb" bold
                    onClick={() => handleAction('mark_paid')} disabled={saving || !payDate} />
                </div>
              )}

              {payMode === 'pay' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 140px', minWidth: 120 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>BACS reference</div>
                    <input value={bacsRef} onChange={e => setBacsRef(e.target.value)}
                      placeholder="e.g. NRES-APR26-001"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }} />
                  </div>
                  <div style={{ flex: '1 1 140px', minWidth: 120 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Payment note</div>
                    <input value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
                      placeholder="Invoice ref / payment confirmation"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }} />
                  </div>
                  <ActionBtn label="Mark as Paid" color="#166534" bg="#f0fdf4" bold
                    onClick={() => handleAction('mark_paid')} disabled={saving} />
                </div>
              )}
            </div>
          )}

          {/* Finance view-only notice on claims awaiting director review */}
          {view === 'finance' && (displayStatus === 'awaiting_review' || displayStatus === 'queried') && (
            <div style={{
              marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: '#9ca3af',
            }}>
              <Lock className="w-3.5 h-3.5 text-gray-300" />
              <span>Awaiting PML Director decision before payment can be processed</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Meeting Claim Card (for PML Director) ──────────────────────────────────
function MeetingClaimCard({ group, view, expanded, onToggle, onApprove, onQuery, onReject, saving }: {
  group: { key: string; person_name: string; practice_name: string; claim_month: string; month_label: string; entries: MeetingLogEntry[]; total_hours: number; total_amount: number; status: string };
  view: PMLView;
  expanded: boolean;
  onToggle: () => void;
  onApprove?: (ids: string[], notes?: string) => Promise<boolean>;
  onQuery?: (ids: string[], notes?: string) => Promise<boolean>;
  onReject?: (ids: string[], notes?: string) => Promise<boolean>;
  saving?: boolean;
}) {
  const [reviewNotes, setReviewNotes] = useState('');
  const displayStatus = toDisplayStatus(group.status);
  const needsAction = view === 'director' && (displayStatus === 'awaiting_review' || displayStatus === 'queried');
  const highlightColor = '#93c5fd';
  const glowColor = 'rgba(59,130,246,0.06)';
  const ids = group.entries.map(e => e.id);

  const handleAction = async (action: 'approve' | 'query' | 'reject') => {
    if (action === 'approve' && onApprove) { await onApprove(ids, reviewNotes || undefined); setReviewNotes(''); }
    if (action === 'query' && onQuery && reviewNotes.trim()) { await onQuery(ids, reviewNotes); setReviewNotes(''); }
    if (action === 'reject' && onReject && reviewNotes.trim()) { await onReject(ids, reviewNotes); setReviewNotes(''); }
  };

  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: `1px solid ${needsAction ? highlightColor : '#e5e7eb'}`,
      overflow: 'hidden',
      boxShadow: needsAction ? `0 0 0 1px ${highlightColor}, 0 2px 8px ${glowColor}` : '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 18px', border: 'none', background: 'transparent',
        cursor: 'pointer', textAlign: 'left', fontSize: 14,
      }}>
        <ChevronDown className={cn('w-[18px] h-[18px] text-gray-400 transition-transform duration-200', expanded && 'rotate-180')} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#111827', whiteSpace: 'nowrap' }}>{group.practice_name}</span>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{group.month_label}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, color: '#0369a1', background: '#e0f2fe', border: '1px solid #bae6fd' }}>Meeting Attendance</span>
          <StatusBadge status={displayStatus} />
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 90 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmtGBP(group.total_amount)}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{group.entries.length} meeting{group.entries.length !== 1 ? 's' : ''} · {group.total_hours.toFixed(1)} hrs</div>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '0 18px 18px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, padding: '14px 0 12px', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
            <InfoBlock label="Person" value={group.person_name} />
            <InfoBlock label="Practice" value={group.practice_name} />
            <InfoBlock label="Period" value={group.month_label} />
            <InfoBlock label="Rate" value={group.entries[0] ? `${fmtGBP(group.entries[0].hourly_rate)}/hr` : '—'} />
          </div>

          {/* Meeting line items */}
          <div style={{ overflowX: 'auto', margin: '12px 0 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Meeting', 'Date', 'Hours', 'Rate', 'Amount'].map((h, i) => (
                    <th key={h} style={{
                      textAlign: i >= 2 ? 'right' : 'left', padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#6b7280',
                      textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.entries.map(entry => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px', fontWeight: 500, color: '#111827' }}>{entry.description || 'Meeting'}</td>
                    <td style={{ padding: '10px', color: '#374151', whiteSpace: 'nowrap' }}>
                      {new Date(entry.work_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{entry.hours.toFixed(1)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#374151' }}>{fmtGBP(entry.hourly_rate)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#111827' }}>{fmtGBP(entry.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} style={{ padding: '10px' }} />
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{group.total_hours.toFixed(1)}</td>
                  <td style={{ padding: '10px' }} />
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#111827', fontVariantNumeric: 'tabular-nums', borderTop: '2px solid #e5e7eb' }}>
                    {fmtGBP(group.total_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Director action bar */}
          {view === 'director' && (displayStatus === 'awaiting_review' || displayStatus === 'queried') && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Director Decision</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <ActionBtn label="Approve" color="#059669" bg="#ecfdf5" bold onClick={() => handleAction('approve')} disabled={saving} />
                <ActionBtn label="Query" color="#d97706" bg="#fffbeb" onClick={() => handleAction('query')} disabled={saving || !reviewNotes.trim()} />
                <ActionBtn label="Reject" color="#dc2626" bg="#fef2f2" onClick={() => handleAction('reject')} disabled={saving || !reviewNotes.trim()} />
                <input type="text" value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
                  placeholder="Notes (required for Query / Reject)…"
                  style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }} />
              </div>
            </div>
          )}

          {view === 'finance' && (displayStatus === 'awaiting_review' || displayStatus === 'queried') && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af' }}>
              <Lock className="w-3.5 h-3.5 text-gray-300" />
              <span>Awaiting PML Director decision before payment can be processed</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export function BuyBackPMLDashboard({
  claims,
  meetingEntries,
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
  onMarkPaid,
  onSchedulePayment,
  onApproveMeetingEntries,
  onQueryMeetingEntries,
  onRejectMeetingEntries,
  savingClaim,
  defaultView,
  onGuideOpen,
  onSettingsOpen,
  showSettings,
}: BuyBackPMLDashboardProps) {
  const [view, setView] = useState<PMLView>(defaultView || (isPMLFinance ? 'finance' : 'director'));
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const cfg = ROLE_CONFIG[view];

  // Group meeting entries by person+month+practice (only non-draft)
  const meetingGroups = useMemo(() => {
    if (!meetingEntries?.length) return [];
    const validStatuses = ['submitted', 'verified', 'approved', 'queried', 'rejected', 'paid'];
    const filtered = meetingEntries.filter(e => validStatuses.includes(e.status));
    const byKey: Record<string, typeof filtered> = {};
    filtered.forEach(e => {
      const key = `${e.person_name}|${e.billing_org_code}|${(e.claim_month || '').slice(0, 7)}`;
      if (!byKey[key]) byKey[key] = [];
      byKey[key].push(e);
    });
    return Object.entries(byKey).map(([key, entries]) => {
      const first = entries[0];
      const practiceKey = Object.entries(NRES_ODS_CODES).find(([, code]) => code === first.billing_org_code)?.[0] || '';
      const cm = (first.claim_month || '').slice(0, 7);
      // Use the "worst" status (verified > submitted)
      const statusPriority: Record<string, number> = { queried: 0, submitted: 1, verified: 2, approved: 3, paid: 4, rejected: 5 };
      const worstStatus = entries.reduce((s, e) => statusPriority[e.status] < statusPriority[s] ? e.status : s, entries[0].status);
      return {
        key,
        person_name: first.person_name,
        practice_name: practiceKey ? getPracticeName(practiceKey) : first.billing_org_code || 'Unknown',
        billing_org_code: first.billing_org_code || '',
        claim_month: cm,
        month_label: cm ? format(new Date(cm + '-01'), 'MMMM yyyy') : '—',
        entries,
        total_hours: entries.reduce((s, e) => s + e.hours, 0),
        total_amount: entries.reduce((s, e) => s + e.total_amount, 0),
        status: worstStatus,
      };
    });
  }, [meetingEntries]);

  // Map all claims to display statuses
  const displayClaims = useMemo(() =>
    claims.filter(c => c.status !== 'draft'),
    [claims]
  );

  // Status counts (including meeting groups)
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: displayClaims.length + meetingGroups.length };
    displayClaims.forEach(c => {
      const ds = toDisplayStatus(c.status);
      m[ds] = (m[ds] || 0) + 1;
    });
    meetingGroups.forEach(g => {
      const ds = toDisplayStatus(g.status);
      m[ds] = (m[ds] || 0) + 1;
    });
    return m;
  }, [displayClaims, meetingGroups]);

  // KPI totals (including meeting groups)
  const totals = useMemo(() => {
    let awaitingVal = displayClaims.filter(c => toDisplayStatus(c.status) === 'awaiting_review' || toDisplayStatus(c.status) === 'queried').reduce((a, c) => a + claimTotal(c), 0);
    let approvedVal = displayClaims.filter(c => toDisplayStatus(c.status) === 'approved').reduce((a, c) => a + claimTotal(c), 0);
    let paidVal = displayClaims.filter(c => toDisplayStatus(c.status) === 'paid').reduce((a, c) => a + claimTotal(c), 0);
    meetingGroups.forEach(g => {
      const ds = toDisplayStatus(g.status);
      if (ds === 'awaiting_review' || ds === 'queried') awaitingVal += g.total_amount;
      else if (ds === 'approved') approvedVal += g.total_amount;
      else if (ds === 'paid') paidVal += g.total_amount;
    });
    return { awaiting: awaitingVal, approved: approvedVal, paid: paidVal };
  }, [displayClaims, meetingGroups]);

  // Filtered claims
  const filteredClaims = useMemo(() =>
    displayClaims.filter(c => {
      if (statusFilter !== 'all' && toDisplayStatus(c.status) !== statusFilter) return false;
      if (searchTerm) {
        const name = getPracticeName(c.practice_key).toLowerCase();
        if (!name.includes(searchTerm.toLowerCase())) return false;
      }
      return true;
    }),
    [displayClaims, statusFilter, searchTerm]
  );

  // Filtered meeting groups
  const filteredMeetingGroups = useMemo(() =>
    meetingGroups.filter(g => {
      if (statusFilter !== 'all' && toDisplayStatus(g.status) !== statusFilter) return false;
      if (searchTerm && !g.practice_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    }),
    [meetingGroups, statusFilter, searchTerm]
  );

  const switchView = (v: PMLView) => {
    setView(v);
    setStatusFilter('all');
    setExpandedId(null);
  };

  const statusFilters = [
    { key: 'all', label: 'All' },
    ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ key: k, label: v.label, color: v.color })),
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 16px', color: '#111827' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <div style={{ width: 6, height: 26, background: '#005eb8', borderRadius: 3 }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Buy-Back Claims</h1>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 100, background: '#005eb8', color: '#fff', letterSpacing: '0.03em' }}>NRES</span>
            {onGuideOpen && (
              <button onClick={onGuideOpen} title="Claims Guide" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, border: '1px solid #e5e7eb', background: 'transparent', cursor: 'pointer', color: '#6b7280', marginLeft: 2 }}>
                <HelpCircle style={{ width: 14, height: 14 }} />
              </button>
            )}
            {showSettings && onSettingsOpen && (
              <button onClick={onSettingsOpen} title="Access Settings" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, border: '1px solid #e5e7eb', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}>
                <Settings style={{ width: 14, height: 14 }} />
              </button>
            )}
          </div>
          <p style={{ margin: '2px 0 0 16px', fontSize: 13, color: '#6b7280' }}>{cfg.subtitle}</p>
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'right' }}>
          <div>{userEmail || cfg.userLabel}</div>
          <div style={{ color: '#d1d5db' }}>Principal Medical Limited</div>
        </div>
      </div>

      {/* Role toggle */}
      <div style={{
        display: 'inline-flex', background: '#f3f4f6', borderRadius: 10, padding: 3,
        marginBottom: 18, gap: 2,
      }}>
        {(['director', 'finance'] as PMLView[]).map(key => {
          const active = view === key;
          return (
            <button
              key={key}
              onClick={() => switchView(key)}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                background: active ? '#fff' : 'transparent',
                color: active ? '#111827' : '#6b7280',
                fontWeight: active ? 600 : 500, fontSize: 13,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {key === 'finance' && <Lock className="w-3 h-3" style={{ color: active ? '#9ca3af' : '#d1d5db' }} />}
              {ROLE_CONFIG[key].label}
            </button>
          );
        })}
      </div>

      {/* Finance role banner */}
      {view === 'finance' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', marginBottom: 16, borderRadius: 10,
          background: '#f8fafc', border: '1px solid #e2e8f0',
          fontSize: 13, color: '#64748b',
        }}>
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span><strong>Payment processing only</strong> — Claim approval is handled by the PML Director. You can process payment on approved claims.</span>
        </div>
      )}

      {/* Spend by Practice */}
      <div style={{ marginBottom: 16 }}>
        <PracticeSummary claims={displayClaims} />
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        <KpiCard
          label="Awaiting Review"
          value={counts.awaiting_review || 0}
          sub={fmtShort(totals.awaiting)}
          accent={(counts.awaiting_review || 0) > 0 ? '#2563eb' : '#059669'}
        />
        <KpiCard
          label="Queried"
          value={counts.queried || 0}
          sub="need response"
          accent={(counts.queried || 0) > 0 ? '#dc2626' : '#9ca3af'}
        />
        <KpiCard
          label="Approved"
          value={counts.approved || 0}
          sub={fmtShort(totals.approved)}
          accent="#7c3aed"
        />
        <KpiCard
          label="Paid"
          value={counts.paid || 0}
          sub={fmtShort(totals.paid)}
          accent="#059669"
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search practice…"
          style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, width: 200, outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {statusFilters.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              style={{
                padding: '5px 12px', borderRadius: 100, fontSize: 11,
                fontWeight: statusFilter === f.key ? 600 : 400,
                border: `1px solid ${statusFilter === f.key ? ((f as any).color || '#374151') : '#d1d5db'}`,
                background: statusFilter === f.key ? `${(f as any).color || '#374151'}12` : '#fff',
                color: statusFilter === f.key ? ((f as any).color || '#374151') : '#6b7280',
                cursor: 'pointer', transition: 'all 0.15s',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}
            >
              {f.label}
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 100,
                background: statusFilter === f.key ? ((f as any).color || '#374151') : '#e5e7eb',
                color: statusFilter === f.key ? '#fff' : '#6b7280',
              }}>
                {counts[f.key] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Claims list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredClaims.length === 0 && filteredMeetingGroups.length === 0 ? (
          <div style={{
            padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14,
            background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
          }}>
            No claims match the current filters.
          </div>
        ) : (
          <>
            {filteredClaims.map(c => (
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
                onApprove={onApprove}
                onQuery={onQuery}
                onReject={onReject}
                onMarkPaid={onMarkPaid}
                onSchedulePayment={onSchedulePayment}
                saving={savingClaim}
              />
            ))}
            {filteredMeetingGroups.map(g => (
              <MeetingClaimCard
                key={`meeting-${g.key}`}
                group={g}
                view={view}
                expanded={expandedId === `meeting-${g.key}`}
                onToggle={() => setExpandedId(expandedId === `meeting-${g.key}` ? null : `meeting-${g.key}`)}
                onApprove={onApproveMeetingEntries}
                onQuery={onQueryMeetingEntries}
                onReject={onRejectMeetingEntries}
                saving={savingClaim}
              />
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 20, padding: '12px 0', borderTop: '1px solid #e5e7eb',
        display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af',
      }}>
        <span>NRES New Models of Care — {cfg.label} Claims Pipeline</span>
        <span>{filteredClaims.length + filteredMeetingGroups.length} claim{(filteredClaims.length + filteredMeetingGroups.length) !== 1 ? 's' : ''} shown</span>
      </div>
    </div>
  );
}
