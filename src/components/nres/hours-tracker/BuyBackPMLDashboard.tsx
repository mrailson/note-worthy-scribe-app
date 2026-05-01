import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, Eye, AlertTriangle, CheckCircle2, XCircle, Lock, Landmark, HelpCircle, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPracticeName, NRES_PRACTICE_BANK_DETAILS, NRES_ODS_CODES, NRES_PRACTICES, NRES_PRACTICE_KEYS } from '@/data/nresPractices';
import type { NRESPracticeKey } from '@/data/nresPractices';
import type { BuyBackClaim, RateParams } from '@/hooks/useNRESBuyBackClaims';
import type { MeetingLogEntry } from '@/hooks/useNRESMeetingLog';
import { maskStaffName } from '@/utils/buybackStaffMasking';
import { InvoiceDownloadLink } from './InvoiceDownloadLink';
import { InvoicePreviewDialog } from './InvoicePreviewDialog';
import { ClaimsViewSwitcher } from './BuyBackPracticeDashboard';
import { supabase } from '@/integrations/supabase/client';
import { useNRESClaimEvidence } from '@/hooks/useNRESClaimEvidence';
import { StaffLineEvidence } from './ClaimEvidencePanel';
import { getSDAClaimGLCode } from '@/utils/glCodes';

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
  onSchedulePayment?: (id: string, date: string, bacsRef?: string, poRef?: string, payMethod?: string, notes?: string) => void;
  onApproveMeetingEntries?: (ids: string[], notes?: string) => Promise<boolean>;
  onQueryMeetingEntries?: (ids: string[], notes?: string) => Promise<boolean>;
  onRejectMeetingEntries?: (ids: string[], notes?: string) => Promise<boolean>;
  savingClaim?: boolean;
  defaultView?: PMLView;
  hideDirectorTab?: boolean;
  hideFinanceTab?: boolean;
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
    label: 'SNO Approver',
    subtitle: 'SNO Finance Director — Review, approve or query claims (Once approved, passed to SNO Finance Team for processing)',
    userLabel: 'SNO Approver',
  },
  finance: {
    label: 'PML Finance',
    subtitle: 'SNO Finance Director approved claims with Invoices — Finance Team View',
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

/** Read-only evidence section for PML view */
function PMLEvidenceSection({ claimId, staffLines }: { claimId: string; staffLines: any[] }) {
  const { getUploadedTypesForStaff, getFilesForStaff, getDownloadUrl } = useNRESClaimEvidence(claimId);
  const [expanded, setExpanded] = useState(true);
  const [openTrigger, setOpenTrigger] = useState<number | undefined>(undefined);
  const totalFiles = staffLines.reduce((sum: number, _: any, idx: number) => sum + getFilesForStaff(idx).length, 0);
  const hasAnyFiles = totalFiles > 0 || staffLines.some((_: any, idx: number) => Object.keys(getUploadedTypesForStaff(idx)).length > 0);
  if (!hasAnyFiles) return null;

  const handleViewAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!expanded) setExpanded(true);
    setOpenTrigger(t => (t === undefined ? 0 : t + 1));
  };

  return (
    <div style={{ marginTop: 12, borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', padding: '8px 14px', background: '#f8fafc', borderBottom: expanded ? '1px solid #e5e7eb' : 'none', fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <span>Supporting Evidence</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 999, padding: '1px 8px' }}>
          {totalFiles} uploaded
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={handleViewAll}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleViewAll(e as any); } }}
          style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}
        >
          <Eye className="w-3.5 h-3.5" /> View Evidence
        </span>
      </button>
      {expanded && staffLines.map((s: any, idx: number) => (
        <StaffLineEvidence
          key={idx}
          staffCategory={(s.staff_category || 'buyback') as 'buyback' | 'new_sda' | 'management' | 'gp_locum'}
          staffIndex={idx}
          staffName={s.staff_name || s.name}
          staffRole={s.staff_role || s.role}
          uploadedTypesForStaff={getUploadedTypesForStaff(idx)}
          allFilesForStaff={getFilesForStaff(idx)}
          canEdit={false}
          uploading={false}
          onUpload={async () => null}
          onDelete={async () => {}}
          onDownload={getDownloadUrl}
          hideHeader
          triggerOpenAt={idx === 0 ? openTrigger : undefined}
        />
      ))}
    </div>
  );
}

function dateStr(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} at ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/** Resolve a display name — if stored value looks like an email, derive a readable name from it */
function resolveSubmitterName(claim: BuyBackClaim, profileNames: Record<string, string>): string | undefined {
  const email = claim.submitted_by_email;
  if (email && profileNames[email.toLowerCase()]) return profileNames[email.toLowerCase()];
  const raw = (claim as any).submitted_by_name;
  if (!raw) return undefined;
  if (!raw.includes('@')) return raw;
  // Derive name from email: malcolm.railson@nhs.net → Malcolm Railson
  const local = raw.split('@')[0];
  return local.split(/[._-]/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
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
function ClaimCard({ claim, view, expanded, onToggle, userId, userEmail, isAdmin, rateParams, onApprove, onQuery, onReject, onMarkPaid, onSchedulePayment, saving, profileNames }: {
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
  onSchedulePayment?: (id: string, date: string, bacsRef?: string, poRef?: string, payMethod?: string, notes?: string) => void;
  saving?: boolean;
  profileNames?: Record<string, string>;
}) {
  const [reviewNotes, setReviewNotes] = useState('');
  const [flaggedLines, setFlaggedLines] = useState<number[]>([]);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);

  // Finance payment state
  const [schedDate, setSchedDate] = useState(
    (claim as any).expected_payment_date ? (claim as any).expected_payment_date.slice(0, 10) : ''
  );
  const [bacsRef, setBacsRef] = useState((claim as any).bacs_reference || '');
  const [poRef, setPoRef] = useState((claim as any).pml_po_reference || '');
  const [payMethod, setPayMethod] = useState((claim as any).payment_method || 'BACS');
  const [actualDate, setActualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [financeNote, setFinanceNote] = useState('');
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

  const isManagement = staffDetails.length > 0 && staffDetails.every((s: any) => s.staff_category === 'management');
  const hasPartA = claim.declaration_confirmed;
  const hasPartB = staffDetails.length > 0;

  const handleAction = (action: 'approve' | 'query') => {
    if (action === 'approve') onApprove(claim.id, reviewNotes || undefined);
    if (action === 'query' && onQuery) {
      if (!reviewNotes.trim()) return;
      // Encode flagged lines into query notes
      const queryPayload = flaggedLines.length > 0
        ? `${reviewNotes}\n\n[FLAGGED_LINES:${JSON.stringify(flaggedLines)}]`
        : reviewNotes;
      onQuery(claim.id, queryPayload);
    }
    setReviewNotes('');
    setFlaggedLines([]);
  };

  // Derived payment state
  const payStatus = (claim as any).payment_status || (displayStatus === 'approved' ? 'pending' : '');
  const isReceived = payStatus === 'received' || payStatus === 'scheduled' || payStatus === 'payment_sent';
  const isScheduled = payStatus === 'scheduled';
  const isPaidFull = displayStatus === 'paid' || payStatus === 'payment_sent';

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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          {/* Row 1 — captioned identification fields */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' }}>
            {claim.claim_ref != null && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>Claim ID</span>
                <span
                  title="Claim ID — use this when communicating about this claim"
                  style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, color: '#1e293b', background: '#f1f5f9', border: '1px solid #cbd5e1', fontFamily: 'monospace', letterSpacing: 0.3, alignSelf: 'flex-start' }}
                >
                  #{claim.claim_ref}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>Claim Period</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{monthLabel}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>Practice</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{practiceName}</span>
            </div>
          </div>
          {/* Row 2 — status & category badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {(() => {
              const CATEGORY_BADGE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
                buyback:    { label: 'Buy-Back',    color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
                new_sda:    { label: 'New SDA',     color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
                gp_locum:   { label: 'GP Locum',    color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
                management: { label: 'Management',  color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
                meeting:    { label: 'Meeting',     color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8' },
                additional: { label: 'Additional',  color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
              };
              const dets = ((claim as any).staff_details || []) as any[];
              const cats = Array.from(new Set(dets.map(d => d.staff_category || 'buyback')));
              const fallback = cats.length === 0 ? [claim.claim_type === 'additional' ? 'additional' : 'buyback'] : cats;
              return fallback.map(cat => {
                const cfg = CATEGORY_BADGE_CONFIG[cat] || CATEGORY_BADGE_CONFIG.buyback;
                return <span key={cat} style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>;
              });
            })()}
            <StatusBadge status={displayStatus} />
            {over && (
              <span className="inline-flex items-center gap-1 text-amber-600 text-[11px] font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> Over threshold
              </span>
            )}
          </div>
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
            {(() => {
              const name = resolveSubmitterName(claim, profileNames || {});
              const submitter = name || claim.submitted_by_email || '—';
              return <InfoBlock label="Submitted by" value={submitter} sub={dateStr(claim.submitted_at)} />;
            })()}
            <InfoBlock label="Verified by" value={claim.verified_by || '—'} sub={dateStr(claim.verified_at)} />
            {((claim as any).approved_by_email || claim.reviewed_at || (claim as any).approved_at) && (() => {
              const approverEmail = (claim as any).approved_by_email || '';
              const approverName = approverEmail
                ? approverEmail.split('@')[0].split(/[._-]/).filter(Boolean).map((part: string) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ')
                : 'SNO Approver';
              const approvalTime = claim.reviewed_at || (claim as any).approved_at || null;
              return <InfoBlock label="Approved by" value={approverName} sub={dateStr(approvalTime)} highlight="#7c3aed" />;
            })()}
            {claim.invoice_number && <InvoiceDownloadLink claim={claim} />}
            <button
              type="button"
              onClick={() => setInvoicePreviewOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 6, border: '1px solid #c4b5fd', background: '#f5f3ff', color: '#5b21b6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              title="Preview the invoice exactly as it will be issued once approved"
            >
              <Eye className="w-3.5 h-3.5" /> Preview invoice
            </button>
            <InvoicePreviewDialog open={invoicePreviewOpen} onOpenChange={setInvoicePreviewOpen} claim={claim} />
            {(claim as any).expected_payment_date && !claim.paid_at && (
              <InfoBlock label="Scheduled payment" value={new Date((claim as any).expected_payment_date).toLocaleDateString('en-GB')} highlight="#d97706" />
            )}
            {(claim as any).bacs_reference && (
              <InfoBlock label="BACS ref" value={(claim as any).bacs_reference} />
            )}
            {claim.paid_at && <InfoBlock label="Paid" value={new Date(claim.paid_at).toLocaleDateString('en-GB')} highlight="#166534" />}
          </div>

          {/* Practice notes */}
          {(claim as any).practice_notes && (
            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
              <strong>Practice Note:</strong> {(claim as any).practice_notes}
            </div>
          )}

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
          {!isManagement && hasPartA && hasPartB && claim.review_notes && (
            <div style={{
              marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12,
              background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0c4a6e',
            }}>
              <strong>Part B Substantiation:</strong> {claim.review_notes}
            </div>
          )}
          {!isManagement && hasPartA && !hasPartB && (
            <div style={{
              marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12,
              background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
            }}>
              <strong>Part B Evidence Missing:</strong> Part A claim submitted but Part B substantiation has not been provided. Evidence required before approval.
            </div>
          )}

          {/* Line items table */}
          {(() => {
            const hasLocum = staffDetails.some((s: any) => s.staff_category === 'gp_locum');
            const MINS_PER_SESS = 250;
            const fmtLocum = (sessions: number) => { const t = Math.round(sessions * MINS_PER_SESS); const h = Math.floor(t/60); const m = t%60; return { display: m > 0 ? `${h}h ${m}m` : `${h}h`, decimal: (t/60).toFixed(1) }; };
            const getMaxInfo = (s: any) => {
              const cat = s.staff_category || 'buyback'; const av = s.allocation_value ?? 0; const ca = s.calculated_amount ?? 0;
              if (cat === 'gp_locum') return s.allocation_type === 'daily' ? { max: ca || av*750, formula: `${av} days × £750` } : { max: ca || av*375, formula: `${av} sess × £375` };
              if (cat === 'meeting') { const hrs = s.total_hours ?? av; const r = s.hourly_rate ?? 0; return { max: ca || hrs*r, formula: `${hrs} hrs × £${r}/hr` }; }
              if (cat === 'management' && s.allocation_type === 'hours') { const r = s.hourly_rate ?? 0; const wks = (r > 0 && av > 0 && ca > 0) ? (ca / (av * r)).toFixed(1) : '?'; return { max: ca, formula: `${av} hrs/wk × ${wks} wks × £${r}/hr` }; }
              if (ca > 0) return { max: ca, formula: s.allocation_type === 'wte' ? `${av} WTE × on-costs` : 'Max' };
              return { max: 0, formula: '—' };
            };
            const headers = hasLocum
              ? ['Name', 'Role', 'GL Cat', 'Sessions', 'Date', 'Hours Worked', 'Hrs', 'Amount', 'Max Claimable']
              : ['Name', 'Role', 'GL Cat', 'Date', 'Hours Worked', 'Hrs', 'Amount', 'Max Claimable'];
            const rightAlignIdx = hasLocum ? 5 : 4;
            const totalClaimed = staffDetails.reduce((sum: number, s: any) => sum + (s.claimed_amount ?? s.calculated_amount ?? 0), 0);
            const totalMax = staffDetails.reduce((sum: number, s: any) => sum + getMaxInfo(s).max, 0);

            return (
          <div style={{ margin: '12px 0 0' }}>
            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {headers.map((h, i) => (
                    <th key={h} style={{
                      textAlign: i >= rightAlignIdx ? 'right' : 'left',
                      padding: '7px 10px', fontSize: 11, fontWeight: 600, color: h === 'Max Claimable' ? '#9ca3af' : '#6b7280',
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
                  const glCat = getSDAClaimGLCode(s, claim.claim_type || 'buyback') || '—';
                  const hoursWorked = s.allocation_type === 'hours' ? `${s.allocation_value ?? 0} hrs/wk` : s.allocation_type === 'sessions' ? `${s.allocation_value ?? 0} sessions` : s.allocation_type === 'daily' ? `${s.allocation_value ?? 0} days` : `${s.allocation_value ?? 0} WTE`;
                  const totalHrs = s.allocation_type === 'hours' ? (s.allocation_value ?? 0) : null;
                  const isLocum = s.staff_category === 'gp_locum';
                  const locHrs = isLocum ? fmtLocum(s.allocation_value || 0) : null;
                  const mi = getMaxInfo(s);

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px', fontWeight: 500, color: '#111827' }}>{displayName}</td>
                      <td style={{ padding: '10px', color: '#374151' }}>{s.staff_role}</td>
                      <td style={{ padding: '10px' }}>
                        <code style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f3f4f6', color: '#374151' }}>{glCat}</code>
                      </td>
                      {hasLocum && (
                        <td style={{ padding: '10px', textAlign: 'center', color: '#374151', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {isLocum ? (s.allocation_value || 0) : '—'}
                        </td>
                      )}
                      <td style={{ padding: '10px', color: '#374151', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const raw = s.start_date || claim.claim_month || '';
                          if (!raw) return '—';
                          const d = new Date(raw + (raw.length <= 7 ? '-01' : '') + 'T12:00:00');
                          return isNaN(d.getTime()) ? raw : d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
                        })()}
                      </td>
                      <td style={{ padding: '10px', color: '#374151', whiteSpace: 'nowrap' }}>
                        {isLocum && locHrs ? locHrs.display : hoursWorked}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                        {isLocum && locHrs ? locHrs.decimal : (() => {
                          if (s.staff_category === 'management' && s.hourly_rate > 0 && (s.calculated_amount ?? 0) > 0) {
                            return (s.calculated_amount / s.hourly_rate).toFixed(1);
                          }
                          return totalHrs !== null ? totalHrs.toFixed(1) : '—';
                        })()}
                      </td>
                      <td style={{
                        padding: '10px', textAlign: 'right', fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums', color: lineOver ? '#dc2626' : '#111827'
                      }}>
                        {fmtGBP(claimedAmt)}
                        {lineOver && <span style={{ marginLeft: 4, fontSize: 10, color: '#dc2626', fontWeight: 700 }}>+{fmtGBP(claimedAmt - maxAmt)}</span>}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#9ca3af' }}>
                        {mi.max > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                            <span title={mi.formula}>{fmtGBP(mi.max)}</span>
                            {s.staff_category === 'management' && (
                              <span style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.35, textAlign: 'right', maxWidth: 220 }}>
                                {mi.formula}
                              </span>
                            )}
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={headers.length - 3} style={{ padding: '10px' }} />
                  <td style={{ padding: '10px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Total</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#111827', fontVariantNumeric: 'tabular-nums', borderTop: '2px solid #e5e7eb' }}>
                    {fmtGBP(totalClaimed)}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, fontSize: 12, color: '#9ca3af', fontVariantNumeric: 'tabular-nums', borderTop: '2px solid #e5e7eb' }}>
                    {totalMax > 0 ? fmtGBP(totalMax) : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
            </div>
          </div>
            );
          })()}

          {/* Supporting Evidence (read-only) */}
          {staffDetails.length > 0 && <PMLEvidenceSection claimId={claim.id} staffLines={staffDetails} />}
          {(claim.query_notes || claim.verified_notes || claim.payment_notes) && (
            <div className="mt-3 flex flex-col gap-1.5">
              {claim.query_notes && (
                <div style={{ borderRadius: (claim as any).query_response ? '8px 8px 0 0' : 8 }}>
                  <div style={{
                    padding: '10px 14px', borderRadius: (claim as any).query_response ? '8px 8px 0 0' : 8, fontSize: 13,
                    background: claim.status === 'queried' ? '#fef2f2' : '#fffbeb',
                    border: `1px solid ${claim.status === 'queried' ? '#fecaca' : '#fde68a'}`,
                    color: claim.status === 'queried' ? '#991b1b' : '#92400e',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                      Query from {(claim as any).queried_by_role || 'Reviewer'}{(claim as any).queried_by ? ` (${(claim as any).queried_by})` : ''}
                      {(claim as any).queried_at && (
                        <span style={{ fontWeight: 400, fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>
                          {format(new Date((claim as any).queried_at), 'd MMM yyyy, HH:mm')}
                        </span>
                      )}
                    </div>
                    {claim.query_notes.replace(/\n?\n?\[FLAGGED_LINES:\[[\d,]*\]\]/, '')}
                  </div>
                  {(claim as any).query_response && (
                    <div style={{
                      padding: '10px 14px', borderRadius: '0 0 8px 8px', fontSize: 13,
                      background: '#fffbeb', border: '1px solid #fde68a', borderTop: 'none', color: '#92400e',
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                        Practice Response
                        {((claim as any).query_responded_at || claim.submitted_at) && (
                          <span style={{ fontWeight: 400, fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>
                            {format(new Date((claim as any).query_responded_at || claim.submitted_at), 'd MMM yyyy, HH:mm')}
                          </span>
                        )}
                      </div>
                      {(claim as any).query_response}
                    </div>
                  )}
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

          {/* Director action bar — Approve / Query (no Reject for Director) */}
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
              {/* Line-level flagging checkboxes */}
              {reviewNotes.trim() && (
                <div style={{ marginBottom: 10, padding: '10px 14px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e', marginBottom: 6 }}>Flag specific lines for attention (optional):</div>
                  {staffDetails.map((s: any, idx: number) => {
                    const displayName = maskStaffName(s.staff_name, userId, claim.user_id, userEmail, isAdmin);
                    return (
                      <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={flaggedLines.includes(idx)}
                          onChange={e => {
                            if (e.target.checked) setFlaggedLines(prev => [...prev, idx]);
                            else setFlaggedLines(prev => prev.filter(i => i !== idx));
                          }}
                          style={{ accentColor: '#d97706' }}
                        />
                        {displayName} — {s.staff_role}
                      </label>
                    );
                  })}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <ActionBtn label="Approve" color="#059669" bg="#ecfdf5" bold={hasPartA && hasPartB}
                  onClick={() => handleAction('approve')} disabled={saving} />
                <ActionBtn label="Query" color="#d97706" bg="#fffbeb"
                  onClick={() => handleAction('query')} disabled={saving || !reviewNotes.trim()} />
                <input
                  type="text"
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder="Notes (required for Query)…"
                  style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
                />
              </div>
            </div>
          )}

          {/* Finance payment processing panel */}
          {view === 'finance' && (displayStatus === 'approved' || displayStatus === 'invoiced' || isPaidFull) && (() => {
            const steps = [
              { key: 'received', label: 'Received', color: '#0369a1' },
              { key: 'payment_sent', label: 'Paid', color: '#166534' },
            ];
            const currentStep = isPaidFull ? 1 : isReceived ? 0 : -1;

            return (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
                {/* Step indicator */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 18, padding: '0 20px' }}>
                  {steps.map((s, i) => {
                    const done = currentStep >= i;
                    const active = currentStep === i;
                    return (
                      <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700,
                            background: done ? s.color : '#f3f4f6',
                            color: done ? '#fff' : '#9ca3af',
                            border: active ? `2px solid ${s.color}` : 'none',
                            boxShadow: active ? `0 0 0 3px ${s.color}22` : 'none',
                            transition: 'all 0.3s',
                          }}>
                            {done ? (currentStep > i ? '✓' : String(i + 1)) : String(i + 1)}
                          </div>
                          <span style={{ fontSize: 10, fontWeight: done ? 600 : 400, color: done ? s.color : '#9ca3af', whiteSpace: 'nowrap' }}>{s.label}</span>
                        </div>
                        {i < steps.length - 1 && (
                          <div style={{ width: 40, height: 3, borderRadius: 2, background: currentStep > i ? steps[i].color : '#e5e7eb', maxWidth: 60, marginBottom: 14, transition: 'background 0.3s' }} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* STATE 1: Not yet received */}
                {!isReceived && !isPaidFull && (
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
                      Claim approved by SNO Approver. Acknowledge receipt to begin payment processing.
                    </div>
                    <button
                      onClick={() => onMarkPaid && onMarkPaid(claim.id, 'received')}
                      disabled={saving}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px',
                        borderRadius: 9, border: 'none', background: '#0369a1', color: '#fff',
                        fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.6 : 1, letterSpacing: '-0.01em',
                      }}
                    >
                      ✓ Received &amp; Processing
                    </button>
                  </div>
                )}

                {/* STATE 2: Received (or legacy Scheduled) — record payment */}
                {(isReceived || isScheduled) && !isPaidFull && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Record payment</div>
                    {isScheduled && (claim as any).expected_payment_date && (
                      <div style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', padding: '6px 10px', borderRadius: 6, marginBottom: 10 }}>
                        Legacy scheduled payment date: {new Date((claim as any).expected_payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Payment date <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></div>
                        <input type="date" value={actualDate} onChange={e => setActualDate(e.target.value)}
                          style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #86efac', fontSize: 13, outline: 'none', cursor: 'pointer' }} />
                      </div>
                      <div style={{ flex: '1 1 120px', minWidth: 120 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>BACS / Cheque ref <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></div>
                        <input value={bacsRef} onChange={e => setBacsRef(e.target.value)} placeholder="e.g. NRES-APR26-003"
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }} />
                      </div>
                      <div style={{ flex: '1 1 120px', minWidth: 120 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>PO reference <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></div>
                        <input value={poRef} onChange={e => setPoRef(e.target.value)} placeholder="Optional"
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Method</div>
                        <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                          style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer' }}>
                          <option>BACS</option>
                          <option>CHAPS</option>
                          <option>Cheque</option>
                          <option>Other</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => {
                          if (!onMarkPaid) return;
                          const paidDate = actualDate || new Date().toISOString().slice(0, 10);
                          // Persist optional fields via the existing schedule path so BACS / PO / method / date columns are saved
                          if (onSchedulePayment) {
                            onSchedulePayment(claim.id, paidDate, bacsRef || undefined, poRef || undefined, payMethod || undefined, financeNote || undefined);
                          }
                          const noteParts = [`Paid ${paidDate}`];
                          if (bacsRef) noteParts.push(`BACS: ${bacsRef}`);
                          if (financeNote) noteParts.push(financeNote);
                          onMarkPaid(claim.id, noteParts.join(' · '));
                        }}
                        disabled={saving}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px',
                          borderRadius: 8, border: 'none', background: saving ? '#94a3b8' : '#166534',
                          color: '#fff', fontSize: 13, fontWeight: 700,
                          cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
                        }}
                      >
                        ✓ Mark as Paid
                      </button>
                      <input value={financeNote} onChange={e => setFinanceNote(e.target.value)} placeholder="Optional note…"
                        style={{ flex: 1, minWidth: 140, padding: '8px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, outline: 'none' }} />
                    </div>
                  </div>
                )}

                {/* STATE 3: Paid — audit summary */}
                {isPaidFull && (
                  <div>
                    <div style={{ textAlign: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>✓ Payment Complete</span>
                    </div>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12, color: '#374151' }}>
                      {(claim as any).actual_payment_date && (
                        <div>
                          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>Paid on</div>
                          <div style={{ fontWeight: 600 }}>{new Date((claim as any).actual_payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                        </div>
                      )}
                      {(claim as any).bacs_reference && (
                        <div>
                          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>BACS ref</div>
                          <div style={{ fontWeight: 600 }}>{(claim as any).bacs_reference}</div>
                        </div>
                      )}
                      {(claim as any).pml_po_reference && (
                        <div>
                          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>PO ref</div>
                          <div style={{ fontWeight: 600 }}>{(claim as any).pml_po_reference}</div>
                        </div>
                      )}
                      {(claim as any).payment_method && (
                        <div>
                          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>Method</div>
                          <div style={{ fontWeight: 600 }}>{(claim as any).payment_method}</div>
                        </div>
                      )}
                      {claim.paid_by && (
                        <div>
                          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>Processed by</div>
                          <div style={{ fontWeight: 600 }}>{claim.paid_by.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</div>
                        </div>
                      )}
                    </div>
                    {Array.isArray((claim as any).payment_audit_trail) && (claim as any).payment_audit_trail.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>Payment history</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {((claim as any).payment_audit_trail as any[]).map((t: any, i: number) => (
                            <div key={i} style={{ fontSize: 11, color: '#374151', display: 'flex', gap: 6, alignItems: 'center' }}>
                              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#9ca3af', flexShrink: 0 }} />
                              <span style={{ color: '#9ca3af' }}>
                                {t.timestamp ? new Date(t.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                              </span>
                              <span>{(t.status || '').replace(/_/g, ' ')}</span>
                              {t.user_email && <span style={{ color: '#9ca3af' }}>· {t.user_email.split('@')[0].replace(/\./g, ' ')}</span>}
                              {t.notes && <span style={{ color: '#6b7280', fontStyle: 'italic' }}>· {t.notes}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Finance view-only notice on claims awaiting director review */}
          {view === 'finance' && (displayStatus === 'awaiting_review' || displayStatus === 'queried') && (
            <div style={{
              marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: '#9ca3af',
            }}>
              <Lock className="w-3.5 h-3.5 text-gray-300" />
              <span>Awaiting SNO Approver decision before payment can be processed</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Meeting Claim Card (for SNO Approver) ──────────────────────────────────
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
              <span>Awaiting SNO Approver decision before payment can be processed</span>
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
  hideDirectorTab,
  hideFinanceTab,
  onGuideOpen,
  onSettingsOpen,
  showSettings,
}: BuyBackPMLDashboardProps) {
  const [view, setView] = useState<PMLView>(defaultView || (isPMLFinance ? 'finance' : 'director'));
  const sessionKey = `nres-pml-statusFilter-${view}`;
  const initialStatus = (() => {
    // Director view always defaults to "Awaiting Review" and Finance to "Invoiced"
    // on mount, ignoring any previously persisted filter, per product requirement.
    if (view === 'director') return 'awaiting_review';
    if (view === 'finance') return 'invoiced';
    try {
      const saved = sessionStorage.getItem(sessionKey);
      if (saved) return saved;
    } catch {}
    return 'invoiced';
  })();
  const [statusFilter, setStatusFilterRaw] = useState<string>(initialStatus);
  const setStatusFilter = (s: string) => {
    setStatusFilterRaw(s);
    try { sessionStorage.setItem(sessionKey, s); } catch {}
  };
  const [practiceFilter, setPracticeFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [financeStatusFilter, setFinanceStatusFilter] = useState<string | null>('invoiced');

  // Resolve profile names for submitter emails
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  useEffect(() => {
    const emails = [...new Set(claims.map(c => c.submitted_by_email).filter(Boolean))] as string[];
    if (!emails.length) return;
    supabase.from('profiles').select('email, full_name').in('email', emails).then(({ data }) => {
      if (!data) return;
      const map: Record<string, string> = {};
      data.forEach((p: any) => { if (p.email && p.full_name) map[p.email.toLowerCase()] = p.full_name; });
      setProfileNames(map);
    });
  }, [claims]);

  useEffect(() => {
    if (hideDirectorTab) {
      setView('finance');
      setStatusFilterRaw('invoiced');
      try { sessionStorage.setItem('nres-pml-statusFilter-finance', 'invoiced'); } catch {}
      return;
    }

    if (hideFinanceTab) {
      setView('director');
      setStatusFilterRaw('awaiting_review');
      return;
    }

    if (defaultView) {
      setView(defaultView);
      setStatusFilterRaw(defaultView === 'finance' ? 'invoiced' : 'awaiting_review');
    }
  }, [defaultView, hideDirectorTab, hideFinanceTab]);

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
    // Virtual Finance "to process" bucket = approved + invoiced
    m['to_process'] = (m['approved'] || 0) + (m['invoiced'] || 0);
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

  // Practice options (all 8 NRES practices, alphabetical)
  const practiceOptions = useMemo(() => {
    return (Object.entries(NRES_PRACTICES) as [string, string][])
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  // Status filter test — handles virtual "to_process" (approved + invoiced)
  const statusMatches = (raw: string, filter: string) => {
    if (filter === 'all') return true;
    const ds = toDisplayStatus(raw);
    if (filter === 'to_process') return ds === 'approved' || ds === 'invoiced';
    return ds === filter;
  };

  // Apply practice + status + search filtering
  const filteredClaims = useMemo(() =>
    displayClaims.filter(c => {
      if (!statusMatches(c.status, statusFilter)) return false;
      if (practiceFilter !== 'all' && c.practice_key !== practiceFilter) return false;
      if (searchTerm) {
        const name = getPracticeName(c.practice_key).toLowerCase();
        if (!name.includes(searchTerm.toLowerCase())) return false;
      }
      return true;
    }),
    [displayClaims, statusFilter, practiceFilter, searchTerm]
  );

  const filteredMeetingGroups = useMemo(() =>
    meetingGroups.filter(g => {
      if (!statusMatches(g.status, statusFilter)) return false;
      if (practiceFilter !== 'all') {
        const code = NRES_ODS_CODES[practiceFilter];
        if (code && g.billing_org_code !== code) return false;
      }
      if (searchTerm && !g.practice_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    }),
    [meetingGroups, statusFilter, practiceFilter, searchTerm]
  );

  // On first mount for Director view: if "Awaiting Review" is empty, fall back gracefully.
  // Finance view ALWAYS lands on "Invoiced" (per product requirement) so the user goes
  // straight to the section where they can open invoices and mark them paid.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(sessionKey)) return; // user has a stored choice
    } catch {}
    if (view === 'finance') return; // never auto-redirect away from Invoiced
    const preferred = 'awaiting_review';
    if (statusFilter !== preferred) return;
    if ((counts[preferred] || 0) > 0) return;
    if ((counts.queried || 0) > 0) setStatusFilter('queried');
    else setStatusFilter('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts, view]);

  const switchView = (v: PMLView) => {
    setView(v);
    setExpandedId(null);
    try {
      const k = `nres-pml-statusFilter-${v}`;
      const saved = sessionStorage.getItem(k);
      setStatusFilterRaw(saved || (v === 'finance' ? 'invoiced' : 'awaiting_review'));
    } catch {
      setStatusFilterRaw(v === 'finance' ? 'invoiced' : 'awaiting_review');
    }
  };

  // Status filter chips — Finance only shows finance-relevant stages
  const statusFilters = view === 'finance'
    ? [
        { key: 'all', label: 'All' },
        { key: 'invoiced', label: STATUS_CONFIG.invoiced.label, color: STATUS_CONFIG.invoiced.color },
        { key: 'paid', label: STATUS_CONFIG.paid.label, color: STATUS_CONFIG.paid.color },
      ]
    : [
        { key: 'all', label: 'All' },
        ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ key: k, label: v.label, color: v.color })),
      ];

  // Action queue is the cards list. Director: awaiting_review. Finance: to_process (approved + invoiced).
  const actionQueueStatus = view === 'finance' ? 'invoiced' : 'awaiting_review';
  const showActionQueue = statusFilter === actionQueueStatus;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 16px', color: '#111827' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <div style={{ width: 6, height: 26, background: '#005eb8', borderRadius: 3 }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>SDA &amp; Buy-Back Claims</h1>
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

      {/* Role toggle — Finance-only users (not Director / Super Admin / Mgmt Lead) see only the Finance tab */}
      {(() => {
        const financeOnly = hideDirectorTab || (isPMLFinance && !isPMLDirector && !isSuperAdmin);
        const directorOnly = hideFinanceTab;
        const visibleViews: PMLView[] = directorOnly ? ['director'] : financeOnly ? ['finance'] : ['director', 'finance'];
        return (
      <div style={{
        display: 'inline-flex', background: '#f3f4f6', borderRadius: 10, padding: 3,
        marginBottom: 18, gap: 2,
      }}>
        {visibleViews.map(key => {
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
        );
      })()}

      {/* Finance role banner */}
      {view === 'finance' && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '12px 16px', marginBottom: 16, borderRadius: 10,
          background: '#eff6ff', border: '1px solid #bfdbfe',
          fontSize: 13, color: '#1e3a8a',
        }}>
          <Lock className="w-4 h-4" style={{ color: '#2563eb', marginTop: 1, flexShrink: 0 }} />
          <span>
            <strong>Automatic invoice generation</strong> — all approved claims are automatically invoiced. A generated invoice PDF and supporting information are sent to <strong>pml.finance@nhs.net</strong>; this view is for payment processing and tracking.
          </span>
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
        <select
          value={practiceFilter}
          onChange={e => setPracticeFilter(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, background: '#fff', color: '#111827', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
          title="Filter by practice"
        >
          <option value="all">All Practices</option>
          {practiceOptions.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
        </select>
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
        {showActionQueue ? (
          filteredClaims.length === 0 && filteredMeetingGroups.length === 0 ? (
            <div style={{
              padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14,
              background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
            }}>
              {view === 'finance'
                ? 'No claims need processing right now.'
                : 'No claims awaiting review.'}
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
                  profileNames={profileNames}
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
          )
        ) : (
          <ClaimsViewSwitcher
            claims={filteredClaims}
            practiceKey={practiceFilter === 'all' ? 'all' : practiceFilter}
            practiceName={practiceFilter === 'all' ? 'All Practices' : getPracticeName(practiceFilter)}
            onToggleCard={(id) => setExpandedId(expandedId === id ? null : id)}
            expandedClaimId={expandedId}
            saving={savingClaim}
            directorMode
            practiceFilter={practiceFilter}
            onPracticeFilterChange={setPracticeFilter}
            practiceOptions={practiceOptions}
            defaultView={view === 'finance' ? 'invoices' : 'spreadsheet'}
            exportVariant={view === 'finance' ? 'finance' : 'director'}
            statusFilter={view === 'finance' ? financeStatusFilter : undefined}
            onStatusFilterChange={view === 'finance' ? setFinanceStatusFilter : undefined}
          />
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
