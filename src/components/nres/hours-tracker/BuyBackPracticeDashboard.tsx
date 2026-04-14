import { useState, useMemo } from 'react';
import { ChevronDown, AlertTriangle, CheckCircle2, XCircle, Send, Clock, Reply } from 'lucide-react';
import { getPracticeName, NRES_ODS_CODES, NRES_PRACTICE_CONTACTS } from '@/data/nresPractices';
import type { BuyBackClaim } from '@/hooks/useNRESBuyBackClaims';

// --- Types ---
interface BuyBackPracticeDashboardProps {
  claims: BuyBackClaim[];
  practiceKey: string;
  onSubmit?: (id: string) => void;
  onResubmit?: (id: string, notes?: string) => void;
  savingClaim?: boolean;
}

// --- Status config ---
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  draft: { label: 'Draft', color: '#6b7280', bg: '#f9fafb', border: '#d1d5db', dot: '#9ca3af' },
  submitted: { label: 'Submitted', color: '#0369a1', bg: '#f0f9ff', border: '#7dd3fc', dot: '#38bdf8' },
  awaiting_review: { label: 'Awaiting Approval', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', dot: '#3b82f6' },
  verified: { label: 'Awaiting Approval', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', dot: '#3b82f6' },
  approved: { label: 'Approved', color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', dot: '#8b5cf6' },
  queried: { label: 'Queried', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', dot: '#ef4444' },
  paid: { label: 'Paid', color: '#166534', bg: '#f0fdf4', border: '#86efac', dot: '#22c55e' },
  rejected: { label: 'Rejected', color: '#991b1b', bg: '#fef2f2', border: '#fca5a5', dot: '#dc2626' },
  invoiced: { label: 'Invoiced', color: '#d97706', bg: '#fffbeb', border: '#fcd34d', dot: '#f59e0b' },
};

const PERIOD_OPTIONS = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'ytd', label: 'YTD 26/27' },
  { key: 'prev_fy', label: 'FY 25/26' },
  { key: 'all', label: 'All Time' },
];

// --- Helpers ---
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

function claimHours(claim: BuyBackClaim): number {
  const staffDets = (claim.staff_details || []) as any[];
  return staffDets.reduce((sum, s) => sum + (s.total_hours ?? s.allocation_value ?? 0), 0);
}

function claimStaffCount(claim: BuyBackClaim): number {
  return (claim.staff_details || []).length;
}

function dateStr(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} at ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function shortDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB');
}

function getClaimMonthLabel(claim: BuyBackClaim): string {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const d = new Date(claim.claim_month);
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getClaimMonthParts(claim: BuyBackClaim): { month: number; year: number } {
  const d = new Date(claim.claim_month);
  return { month: d.getMonth(), year: d.getFullYear() };
}

/** Map internal status to display status for practice view */
function toDisplayStatus(s: string): string {
  if (s === 'verified') return 'awaiting_review';
  return s;
}

function filterByPeriod(claims: BuyBackClaim[], periodKey: string): BuyBackClaim[] {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  return claims.filter((c) => {
    const cm = getClaimMonthParts(c);
    switch (periodKey) {
      case 'this_month': return cm.month === currentMonth && cm.year === currentYear;
      case 'last_month': {
        const lm = currentMonth === 0 ? 11 : currentMonth - 1;
        const ly = currentMonth === 0 ? currentYear - 1 : currentYear;
        return cm.month === lm && cm.year === ly;
      }
      case 'ytd': return (cm.year > 2026) || (cm.year === 2026 && cm.month >= 3);
      case 'prev_fy': return (cm.year === 2025 && cm.month >= 3) || (cm.year === 2026 && cm.month < 3);
      case 'all':
      default: return true;
    }
  });
}

// --- Sub-components ---

function StatusBadge({ status }: { status: string }) {
  const displayStatus = toDisplayStatus(status);
  const cfg = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.draft;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, lineHeight: '16px' }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function EvidencePill({ label, met }: { label: string; met: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
      style={{
        background: met ? '#ecfdf5' : '#fef2f2',
        color: met ? '#059669' : '#dc2626',
        border: `1px solid ${met ? '#a7f3d0' : '#fecaca'}`,
      }}
    >
      {met ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </span>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
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

function ActionBtn({ label, color, bg, bold, icon, onClick, disabled }: {
  label: string; color: string; bg?: string; bold?: boolean; icon?: React.ReactNode; onClick?: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 cursor-pointer transition-all border-none"
      style={{
        padding: '7px 18px', borderRadius: 8, border: `1.5px solid ${color}`,
        background: bold ? color : (bg || '#fff'), color: bold ? '#fff' : color,
        fontSize: 13, fontWeight: 600, opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {icon}{label}
    </button>
  );
}

// --- History Summary ---
function HistorySummary({ claims }: { claims: BuyBackClaim[] }) {
  const [period, setPeriod] = useState('all');
  const periodClaims = useMemo(() => filterByPeriod(claims, period), [claims, period]);

  const byMonth = useMemo(() => {
    const m: Record<string, any> = {};
    periodClaims.forEach((c) => {
      const label = getClaimMonthLabel(c);
      if (!m[label]) m[label] = { month: label, claims: 0, hours: 0, sessions: 0, awaiting: 0, queried: 0, approved: 0, paid: 0, total: 0 };
      const r = m[label];
      const t = claimTotal(c);
      r.claims += 1;
      r.hours += claimHours(c);
      r.sessions += claimStaffCount(c);
      r.total += t;
      const ds = toDisplayStatus(c.status);
      if (ds === 'awaiting_review' || ds === 'submitted') r.awaiting += t;
      else if (ds === 'queried') r.queried += t;
      else if (ds === 'approved' || ds === 'invoiced') r.approved += t;
      else if (ds === 'paid') r.paid += t;
    });
    const monthOrder = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return (Object.values(m) as any[]).sort((a: any, b: any) => {
      const [am, ay] = [monthOrder.indexOf(a.month.split(' ')[0]), parseInt(a.month.split(' ')[1])];
      const [bm, by] = [monthOrder.indexOf(b.month.split(' ')[0]), parseInt(b.month.split(' ')[1])];
      return by !== ay ? by - ay : bm - am;
    });
  }, [periodClaims]);

  const totals = useMemo(() => byMonth.reduce((acc: any, r: any) => ({
    claims: acc.claims + r.claims, hours: acc.hours + r.hours, sessions: acc.sessions + r.sessions,
    awaiting: acc.awaiting + r.awaiting, queried: acc.queried + r.queried,
    approved: acc.approved + r.approved, paid: acc.paid + r.paid, total: acc.total + r.total,
  }), { claims: 0, hours: 0, sessions: 0, awaiting: 0, queried: 0, approved: 0, paid: 0, total: 0 }), [byMonth]);

  const COLS = [
    { key: 'month', label: 'Period', align: 'left' as const },
    { key: 'claims', label: 'Claims', align: 'center' as const, w: 55 },
    { key: 'sessions', label: 'Staff', align: 'center' as const, w: 55 },
    { key: 'hours', label: 'Hours', align: 'right' as const, w: 60 },
    { key: 'awaiting', label: 'Awaiting', align: 'right' as const, w: 80, color: '#2563eb' },
    { key: 'queried', label: 'Queried', align: 'right' as const, w: 75, color: '#dc2626' },
    { key: 'approved', label: 'Approved', align: 'right' as const, w: 80, color: '#7c3aed' },
    { key: 'paid', label: 'Paid', align: 'right' as const, w: 80, color: '#059669' },
    { key: 'total', label: 'Total', align: 'right' as const, w: 90 },
  ];

  const cellVal = (row: any, col: any) => {
    const v = row[col.key];
    if (col.key === 'month') return v;
    if (col.key === 'claims' || col.key === 'sessions') return v;
    if (col.key === 'hours') return v.toFixed(1);
    if (v === 0) return '—';
    return fmtShort(v);
  };

  const cellColor = (row: any, col: any) => {
    if (col.key === 'month') return '#374151';
    if (col.key === 'claims' || col.key === 'sessions' || col.key === 'hours') return '#6b7280';
    if (col.key === 'total') return '#111827';
    if (row[col.key] === 0) return '#d1d5db';
    return col.color || '#111827';
  };

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Claims History</div>
        <div style={{ display: 'flex', gap: 3 }}>
          {PERIOD_OPTIONS.map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)} style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: period === p.key ? 600 : 400,
              border: `1px solid ${period === p.key ? '#005eb8' : '#e5e7eb'}`,
              background: period === p.key ? '#eff6ff' : '#fff',
              color: period === p.key ? '#005eb8' : '#6b7280',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>{p.label}</button>
          ))}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {COLS.map((col) => (
                <th key={col.key} style={{
                  textAlign: col.align, padding: '7px 8px', fontSize: 10, fontWeight: 600,
                  color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em',
                  borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', width: col.w,
                }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {byMonth.length === 0 ? (
              <tr><td colSpan={COLS.length} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No claims in this period.</td></tr>
            ) : byMonth.map((row: any) => (
              <tr key={row.month} style={{ borderBottom: '1px solid #f3f4f6' }}>
                {COLS.map((col) => (
                  <td key={col.key} style={{
                    padding: '8px 8px', textAlign: col.align,
                    fontVariantNumeric: col.key !== 'month' ? 'tabular-nums' : undefined,
                    fontWeight: col.key === 'month' || col.key === 'total' ? 600 : 400,
                    color: cellColor(row, col), whiteSpace: 'nowrap',
                  }}>{cellVal(row, col)}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {byMonth.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                {COLS.map((col) => (
                  <td key={col.key} style={{
                    padding: '9px 8px', textAlign: col.align,
                    fontVariantNumeric: col.key !== 'month' ? 'tabular-nums' : undefined,
                    fontWeight: 700, fontSize: col.key === 'total' ? 13 : 12,
                    color: col.key === 'month' ? '#374151' : col.key === 'total' ? '#111827' : cellColor(totals, col),
                  }}>{col.key === 'month' ? 'TOTALS' : cellVal(totals, col)}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af', display: 'flex', justifyContent: 'space-between' }}>
        <span>{byMonth.length} period{byMonth.length !== 1 ? 's' : ''} · {totals.claims} claim{totals.claims !== 1 ? 's' : ''} · {totals.hours.toFixed(1)} total hours</span>
        <span>{PERIOD_OPTIONS.find((p) => p.key === period)?.label}</span>
      </div>
    </div>
  );
}

// --- Claim Card ---
function PracticeClaimCard({ claim, expanded, onToggle, onSubmit, onResubmit, saving }: {
  claim: BuyBackClaim;
  expanded: boolean;
  onToggle: () => void;
  onSubmit?: (id: string) => void;
  onResubmit?: (id: string, notes?: string) => void;
  saving?: boolean;
}) {
  const [queryResponse, setQueryResponse] = useState('');
  const total = claimTotal(claim);
  const hours = claimHours(claim);
  const staffCount = claimStaffCount(claim);
  const isDraft = claim.status === 'draft';
  const isQueried = claim.status === 'queried';
  const needsAction = isDraft || isQueried;
  const monthLabel = getClaimMonthLabel(claim);

  const staffDets = (claim.staff_details || []) as any[];

  // Check Part A/B evidence
  const hasPartA = staffDets.length > 0;
  const hasPartB = !!claim.review_notes || !!claim.verified_notes; // proxy for part B

  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: `1px solid ${needsAction ? (isQueried ? '#fca5a5' : '#d1d5db') : '#e5e7eb'}`,
      overflow: 'hidden',
      boxShadow: needsAction
        ? isQueried ? '0 0 0 1px #fecaca, 0 2px 8px rgba(220,38,38,0.06)' : '0 1px 3px rgba(0,0,0,0.06)'
        : '0 1px 3px rgba(0,0,0,0.04)',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Collapsed header */}
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 18px', border: 'none', background: 'transparent',
        cursor: 'pointer', textAlign: 'left',
      }}>
        <ChevronDown
          className="w-4 h-4 text-slate-400 flex-shrink-0 transition-transform"
          style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{monthLabel}</span>
          <StatusBadge status={claim.status} />
          {isQueried && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: '#dc2626' }}>
              <AlertTriangle className="w-3 h-3" /> Action required
            </span>
          )}
          {isDraft && <span style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>Not yet submitted</span>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 100 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmtGBP(total)}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{staffCount} staff · {hours.toFixed(1)} hrs</div>
        </div>
      </button>

      {/* Expanded */}
      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '0 18px 18px' }}>
          {/* Status timeline */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 20, padding: '14px 0 12px',
            fontSize: 12, color: '#6b7280', borderBottom: '1px solid #f3f4f6',
          }}>
            {claim.submitted_at && <InfoBlock label="Submitted" value={dateStr(claim.submitted_at)} />}
            {claim.verified_by && <InfoBlock label="Verified by" value={claim.verified_by} sub={dateStr(claim.verified_at)} />}
            {claim.invoice_number && <InfoBlock label="Invoice No" value={claim.invoice_number} highlight="#7c3aed" />}
            {claim.paid_at && <InfoBlock label="Paid" value={shortDate(claim.paid_at)} highlight="#166534" />}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <EvidencePill label="Part A" met={hasPartA} />
              <EvidencePill label="Part B" met={hasPartB} />
            </div>
          </div>

          {/* Director query — needs response */}
          {isQueried && claim.query_notes && (
            <div style={{
              marginTop: 10, padding: '12px 14px', borderRadius: 8, fontSize: 13,
              background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <AlertTriangle className="w-3.5 h-3.5" /> Query from PML Director
              </div>
              {claim.query_notes}
            </div>
          )}

          {/* Part B substantiation */}
          {claim.verified_notes && (
            <div style={{
              marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12,
              background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0c4a6e',
            }}>
              <strong>Part B Substantiation:</strong> {claim.verified_notes}
            </div>
          )}
          {hasPartA && !hasPartB && isDraft && (
            <div style={{
              marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12,
              background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e',
            }}>
              <strong>Part B Evidence Required:</strong> You need to provide Part B substantiation before this claim can be submitted.
            </div>
          )}

          {/* Finance notes */}
          {claim.payment_notes && (
            <div style={{
              marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12,
              background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534',
            }}>
              <strong>Finance:</strong> {claim.payment_notes}
            </div>
          )}

          {/* Line items table */}
          <div style={{ overflowX: 'auto', margin: '12px 0 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Name', 'Role', 'GL Cat', 'Allocation', 'Amount'].map((h, i) => (
                    <th key={h} style={{
                      textAlign: i >= 3 ? 'right' : 'left', padding: '7px 10px',
                      fontSize: 11, fontWeight: 600, color: '#6b7280',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staffDets.map((s: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px', fontWeight: 500, color: '#111827' }}>{s.staff_name || '—'}</td>
                    <td style={{ padding: '10px', color: '#374151' }}>{s.staff_role || '—'}</td>
                    <td style={{ padding: '10px' }}>
                      <code style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f3f4f6', color: '#374151' }}>
                        {s.gl_code || (s.staff_category === 'management' ? 'N/A' : '—')}
                      </code>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                      {s.allocation_value} {s.allocation_type}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#111827' }}>
                      {fmtGBP(s.claimed_amount ?? s.calculated_amount ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ padding: '10px' }} />
                  <td style={{ padding: '10px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Total</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#111827', fontVariantNumeric: 'tabular-nums', borderTop: '2px solid #e5e7eb' }}>
                    {fmtGBP(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Action bar — draft */}
          {isDraft && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <ActionBtn
                label="Submit Claim"
                color="#005eb8"
                bg="#eff6ff"
                bold
                icon={<Send className="w-3.5 h-3.5" />}
                onClick={() => onSubmit?.(claim.id)}
                disabled={saving}
              />
            </div>
          )}

          {/* Action bar — queried */}
          {isQueried && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Reply className="w-3.5 h-3.5" /> Respond to Query
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={queryResponse}
                  onChange={(e) => setQueryResponse(e.target.value)}
                  placeholder="Your response to the PML Director query…"
                  style={{ flex: 1, minWidth: 250, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
                />
                <ActionBtn
                  label="Resubmit"
                  color="#059669"
                  bg="#ecfdf5"
                  bold
                  icon={<Send className="w-3.5 h-3.5" />}
                  onClick={() => {
                    onResubmit?.(claim.id, queryResponse);
                    setQueryResponse('');
                  }}
                  disabled={saving}
                />
              </div>
            </div>
          )}

          {/* Submitted — awaiting */}
          {claim.status === 'submitted' && (
            <div style={{
              marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af',
            }}>
              <Clock className="w-3.5 h-3.5" /> Awaiting verification by Managerial Lead before Director review
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Main Dashboard ---
export function BuyBackPracticeDashboard({
  claims,
  practiceKey,
  onSubmit,
  onResubmit,
  savingClaim,
}: BuyBackPracticeDashboardProps) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const practiceName = getPracticeName(practiceKey);
  const practiceCode = NRES_ODS_CODES[practiceKey] || '—';
  const contact = NRES_PRACTICE_CONTACTS[practiceKey as keyof typeof NRES_PRACTICE_CONTACTS];
  const managerName = contact?.practiceManager || '—';

  // Filter claims for this practice
  const practiceClaims = useMemo(() =>
    claims.filter(c => c.practice_key === practiceKey),
    [claims, practiceKey]
  );

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return practiceClaims;
    if (statusFilter === 'awaiting_review') return practiceClaims.filter(c => c.status === 'verified' || c.status === 'submitted');
    return practiceClaims.filter(c => c.status === statusFilter);
  }, [practiceClaims, statusFilter]);

  // Sort: drafts & queried first
  const sortedClaims = useMemo(() => {
    const order: Record<string, number> = { draft: 0, queried: 1, submitted: 2, verified: 3, approved: 4, invoiced: 5, paid: 6, rejected: 7 };
    return [...filtered].sort((a, b) => (order[a.status] ?? 99) - (order[b.status] ?? 99));
  }, [filtered]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: practiceClaims.length };
    practiceClaims.forEach((c) => {
      const ds = toDisplayStatus(c.status);
      m[ds] = (m[ds] || 0) + 1;
      // Also count raw status
      m[c.status] = (m[c.status] || 0) + 1;
    });
    // Merge submitted + verified into awaiting_review
    m.awaiting_review = (m.awaiting_review || 0) + (m.submitted || 0);
    return m;
  }, [practiceClaims]);

  const totals = useMemo(() => {
    const draft = practiceClaims.filter(c => c.status === 'draft').reduce((a, c) => a + claimTotal(c), 0);
    const pending = practiceClaims.filter(c => ['submitted', 'verified'].includes(c.status)).reduce((a, c) => a + claimTotal(c), 0);
    const queried = practiceClaims.filter(c => c.status === 'queried').reduce((a, c) => a + claimTotal(c), 0);
    const paid = practiceClaims.filter(c => c.status === 'paid').reduce((a, c) => a + claimTotal(c), 0);
    return { draft, pending, queried, paid };
  }, [practiceClaims]);

  const actionCount = (counts.draft || 0) + (counts.queried || 0);

  const statusFilters = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Draft', color: '#6b7280' },
    { key: 'submitted', label: 'Submitted', color: '#0369a1' },
    { key: 'awaiting_review', label: 'Awaiting Approval', color: '#2563eb' },
    { key: 'approved', label: 'Approved', color: '#7c3aed' },
    { key: 'queried', label: 'Queried', color: '#dc2626' },
    { key: 'paid', label: 'Paid', color: '#166534' },
    { key: 'rejected', label: 'Rejected', color: '#991b1b' },
  ];

  return (
    <div style={{
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      maxWidth: 1000, margin: '0 auto', padding: '28px 16px',
      color: '#111827',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <div style={{ width: 6, height: 26, background: '#005eb8', borderRadius: 3 }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Buy-Back Claims</h1>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 100, background: '#005eb8', color: '#fff', letterSpacing: '0.03em' }}>NRES</span>
          </div>
          <p style={{ margin: '2px 0 0 16px', fontSize: 13, color: '#6b7280' }}>Submit, manage and track your practice claims</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{practiceName}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{practiceCode} · {managerName}</div>
        </div>
      </div>

      {/* Action required banner */}
      {actionCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', marginBottom: 16, borderRadius: 10,
          background: '#fffbeb', border: '1px solid #fde68a',
          fontSize: 13, color: '#92400e',
        }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>{actionCount} claim{actionCount !== 1 ? 's' : ''} need your attention</strong>
            {(counts.draft || 0) > 0 && <span> · {counts.draft} draft{counts.draft !== 1 ? 's' : ''} to complete</span>}
            {(counts.queried || 0) > 0 && <span> · {counts.queried} quer{counts.queried !== 1 ? 'ies' : 'y'} to respond to</span>}
          </span>
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <KpiCard label="Drafts" value={counts.draft || 0} sub={fmtShort(totals.draft)} accent={(counts.draft || 0) > 0 ? '#6b7280' : '#d1d5db'} />
        <KpiCard label="In Pipeline" value={counts.awaiting_review || 0} sub={fmtShort(totals.pending)} accent="#2563eb" />
        <KpiCard label="Queried" value={counts.queried || 0} sub={fmtShort(totals.queried)} accent={(counts.queried || 0) > 0 ? '#dc2626' : '#d1d5db'} />
        <KpiCard label="Paid" value={counts.paid || 0} sub={fmtShort(totals.paid)} accent="#059669" />
      </div>

      {/* Claims History Summary */}
      <div style={{ marginBottom: 16 }}>
        <HistorySummary claims={practiceClaims} />
      </div>

      {/* Claims header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Claims</div>
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {statusFilters.map((f) => {
          const count = f.key === 'all' ? counts.all : (counts[f.key] || 0);
          if (f.key !== 'all' && count === 0) return null;
          return (
            <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{
              padding: '5px 12px', borderRadius: 100, fontSize: 11,
              fontWeight: statusFilter === f.key ? 600 : 400,
              border: `1px solid ${statusFilter === f.key ? (f.color || '#374151') : '#d1d5db'}`,
              background: statusFilter === f.key ? `${f.color || '#374151'}12` : '#fff',
              color: statusFilter === f.key ? (f.color || '#374151') : '#6b7280',
              cursor: 'pointer', transition: 'all 0.15s',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              {f.label}
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 100,
                background: statusFilter === f.key ? (f.color || '#374151') : '#e5e7eb',
                color: statusFilter === f.key ? '#fff' : '#6b7280',
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Claims list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sortedClaims.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
            No claims match the current filter.
          </div>
        ) : sortedClaims.map((c) => (
          <PracticeClaimCard
            key={c.id}
            claim={c}
            expanded={expandedId === c.id}
            onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
            onSubmit={onSubmit}
            onResubmit={onResubmit}
            saving={savingClaim}
          />
        ))}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 20, padding: '12px 0', borderTop: '1px solid #e5e7eb',
        display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af',
      }}>
        <span>NRES New Models of Care — {practiceName} Claims</span>
        <span>{sortedClaims.length} claim{sortedClaims.length !== 1 ? 's' : ''} shown</span>
      </div>
    </div>
  );
}
