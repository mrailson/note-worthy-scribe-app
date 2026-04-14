import { useState, useMemo } from 'react';
import { type BuyBackClaim } from '@/hooks/useNRESBuyBackClaims';
import { NRES_PRACTICES, NRES_ODS_CODES } from '@/data/nresPractices';
import { ChevronDown, ChevronRight, Shield, ShieldCheck, Landmark, Search } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface VerifierDashboardProps {
  claims: BuyBackClaim[];
  onVerify: (claimId: string, notes?: string) => Promise<any>;
  onReturnToPractice: (claimId: string, notes?: string) => Promise<any>;
  savingClaim: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) => `£${v.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
const fmtShort = (v: number) => `£${v.toLocaleString('en-GB', { minimumFractionDigits: 0 })}`;

const claimTotal = (c: BuyBackClaim) => {
  if (c.claimed_amount != null) return c.claimed_amount;
  return ((c as any).staff_lines ?? c.staff_details ?? []).reduce((a: number, l: any) => a + (l.claimed_amount ?? l.claimed ?? 0), 0);
};

const claimHours = (c: BuyBackClaim) =>
  ((c as any).staff_lines ?? c.staff_details ?? []).reduce((a: number, l: any) => a + (l.total_hours ?? l.totalHrs ?? 0), 0);

const claimLines = (c: BuyBackClaim): any[] => (c as any).staff_lines ?? c.staff_details ?? [];

const dateStr = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} at ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const practiceName = (key: string | null | undefined) => {
  if (!key) return '—';
  return (NRES_PRACTICES as Record<string, string>)[key] ?? key;
};

const practiceCode = (key: string | null | undefined) => {
  if (!key) return '';
  return (NRES_ODS_CODES as Record<string, string>)[key] ?? '';
};

const getClaimMonthLabel = (c: BuyBackClaim) => {
  if (!c.claim_month) return '—';
  const d = new Date(c.claim_month + (c.claim_month.length <= 7 ? '-01' : ''));
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  submitted: { label: 'Submitted', color: '#0369a1', bg: '#f0f9ff', border: '#7dd3fc', dot: '#38bdf8' },
  verified: { label: 'Verified', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', dot: '#34d399' },
  awaiting_review: { label: 'With Director', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', dot: '#3b82f6' },
  approved: { label: 'Approved', color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', dot: '#8b5cf6' },
  queried: { label: 'Queried', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', dot: '#ef4444' },
  paid: { label: 'Paid', color: '#166534', bg: '#f0fdf4', border: '#86efac', dot: '#22c55e' },
  rejected: { label: 'Rejected', color: '#991b1b', bg: '#fef2f2', border: '#fca5a5', dot: '#dc2626' },
  invoiced: { label: 'Invoiced', color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', dot: '#8b5cf6' },
  draft: { label: 'Draft', color: '#6b7280', bg: '#f9fafb', border: '#d1d5db', dot: '#9ca3af' },
};

const PERIOD_OPTIONS = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'ytd', label: 'YTD 26/27' },
  { key: 'all', label: 'All Time' },
];

const filterByPeriod = (claims: BuyBackClaim[], periodKey: string) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  return claims.filter((c) => {
    if (!c.claim_month) return periodKey === 'all';
    const d = new Date(c.claim_month + (c.claim_month.length <= 7 ? '-01' : ''));
    const cm = d.getMonth();
    const cy = d.getFullYear();
    switch (periodKey) {
      case 'this_month': return cm === currentMonth && cy === currentYear;
      case 'last_month': {
        const pm = currentMonth === 0 ? 11 : currentMonth - 1;
        const py = currentMonth === 0 ? currentYear - 1 : currentYear;
        return cm === pm && cy === py;
      }
      case 'ytd': return (cy > 2026) || (cy === 2026 && cm >= 3);
      default: return true;
    }
  });
};

// ─── Badge ────────────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_MAP[status] ?? STATUS_MAP.draft;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, border: `1px solid ${s.border}`, lineHeight: '16px' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {s.label}
    </span>
  );
};

const ClaimTypeBadge = ({ type }: { type?: string }) => {
  const cfg = type === 'additional'
    ? { label: 'Additional', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' }
    : { label: 'Buy-Back', color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  );
};

const EvidencePill = ({ label, met }: { label: string; met: boolean }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500, background: met ? '#ecfdf5' : '#fef2f2', color: met ? '#059669' : '#dc2626', border: `1px solid ${met ? '#a7f3d0' : '#fecaca'}` }}>
    {met ? '✓' : '✗'} {label}
  </span>
);

const InfoBlock = ({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: string }) => (
  <div>
    <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, marginBottom: 1 }}>{label}</div>
    <div style={{ fontWeight: 600, color: highlight || '#374151', fontSize: 13 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{sub}</div>}
  </div>
);

const KpiCard = ({ label, value, sub, accent }: { label: string; value: number | string; sub: string; accent: string }) => (
  <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
    <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 700, color: accent, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</div>
    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{sub}</div>
  </div>
);

// ─── Verification Checklist ───────────────────────────────────────────────────
const VerificationChecklist = ({ claim }: { claim: BuyBackClaim }) => {
  const lines = claimLines(claim);
  const hasPartA = (claim as any).part_a !== undefined ? !!(claim as any).part_a : true;
  const hasPartB = !!(claim as any).part_b;
  const partBDetail = (claim as any).part_b_detail;
  const bankDetails = (claim as any).bank_details;

  const checks = [
    { label: 'Staff names and roles confirmed', auto: true, met: lines.every((l: any) => l.staff_name && l.staff_role) },
    { label: 'GL categories assigned', auto: true, met: lines.every((l: any) => l.gl_code || l.gl || l.staff_category) },
    { label: 'Dates and hours recorded', auto: true, met: lines.every((l: any) => (l.date || l.claim_month) && (l.total_hours ?? l.totalHrs ?? 0) > 0) },
    { label: 'Part A claim submitted', auto: true, met: hasPartA },
    { label: 'Part B substantiation provided', auto: true, met: hasPartB && !!partBDetail },
    { label: 'Bank details present', auto: true, met: !!bankDetails },
    { label: 'Amounts within expected thresholds', auto: false, met: null as boolean | null },
  ];
  const autoPassCount = checks.filter(c => c.auto && c.met).length;
  const autoTotal = checks.filter(c => c.auto).length;
  const allAutoPass = autoPassCount === autoTotal;

  return (
    <div style={{ background: allAutoPass ? '#f0fdf4' : '#fffbeb', border: `1px solid ${allAutoPass ? '#bbf7d0' : '#fde68a'}`, borderRadius: 10, padding: '14px 16px', marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Shield className="w-3.5 h-3.5" /> Verification Checklist
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: allAutoPass ? '#059669' : '#d97706' }}>
          {autoPassCount}/{autoTotal} auto-checks passed
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {checks.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            {c.auto ? (
              c.met ? <span style={{ color: '#059669', fontSize: 14 }}>✓</span> : <span style={{ color: '#dc2626', fontSize: 14 }}>✗</span>
            ) : (
              <span style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px solid #d1d5db', display: 'inline-block', flexShrink: 0 }} />
            )}
            <span style={{ color: c.auto ? (c.met ? '#374151' : '#dc2626') : '#6b7280', fontWeight: c.auto && !c.met ? 600 : 400 }}>
              {c.label}
              {!c.auto && <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>(manual check)</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Practice Queue Table ─────────────────────────────────────────────────────
const PracticeQueueTable = ({ claims }: { claims: BuyBackClaim[] }) => {
  const [period, setPeriod] = useState('all');
  const periodClaims = useMemo(() => filterByPeriod(claims, period), [claims, period]);

  const byPractice = useMemo(() => {
    const m: Record<string, { practice: string; code: string; submitted: number; submittedVal: number; verified: number; approved: number; paid: number; total: number; totalVal: number }> = {};
    periodClaims.forEach(c => {
      const name = practiceName(c.practice_key);
      const code = practiceCode(c.practice_key);
      if (!m[name]) m[name] = { practice: name, code, submitted: 0, submittedVal: 0, verified: 0, approved: 0, paid: 0, total: 0, totalVal: 0 };
      const r = m[name];
      const t = claimTotal(c);
      r.total += 1; r.totalVal += t;
      if (c.status === 'submitted') { r.submitted += 1; r.submittedVal += t; }
      else if (c.status === 'verified' || (c as any).status === 'awaiting_review') { r.verified += 1; }
      else if (c.status === 'approved') { r.approved += 1; }
      else if (c.status === 'paid') { r.paid += 1; }
    });
    return Object.values(m).sort((a, b) => b.submitted - a.submitted || b.totalVal - a.totalVal);
  }, [periodClaims]);

  const totals = useMemo(() => byPractice.reduce((a, r) => ({
    submitted: a.submitted + r.submitted, submittedVal: a.submittedVal + r.submittedVal,
    verified: a.verified + r.verified, approved: a.approved + r.approved,
    paid: a.paid + r.paid, total: a.total + r.total, totalVal: a.totalVal + r.totalVal,
  }), { submitted: 0, submittedVal: 0, verified: 0, approved: 0, paid: 0, total: 0, totalVal: 0 }), [byPractice]);

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Verification Queue by Practice</div>
        <div style={{ display: 'flex', gap: 3 }}>
          {PERIOD_OPTIONS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)} style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: period === p.key ? 600 : 400,
              border: `1px solid ${period === p.key ? '#005eb8' : '#e5e7eb'}`,
              background: period === p.key ? '#eff6ff' : '#fff',
              color: period === p.key ? '#005eb8' : '#6b7280', cursor: 'pointer',
            }}>{p.label}</button>
          ))}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {[
                { l: 'Practice', a: 'left' as const }, { l: 'Code', a: 'left' as const, w: 65 },
                { l: 'Awaiting You', a: 'center' as const, w: 90 }, { l: 'Value', a: 'right' as const, w: 80 },
                { l: 'Verified', a: 'center' as const, w: 70 }, { l: 'Approved', a: 'center' as const, w: 75 },
                { l: 'Paid', a: 'center' as const, w: 55 }, { l: 'Total', a: 'right' as const, w: 85 },
              ].map(h => (
                <th key={h.l} style={{ textAlign: h.a, padding: '7px 8px', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', width: h.w }}>{h.l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {byPractice.map(r => (
              <tr key={r.practice} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '8px', fontWeight: 500, color: '#374151', whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.practice}</td>
                <td style={{ padding: '8px', fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{r.code}</td>
                <td style={{ padding: '8px', textAlign: 'center', fontWeight: r.submitted > 0 ? 700 : 400, color: r.submitted > 0 ? '#dc2626' : '#d1d5db' }}>{r.submitted > 0 ? r.submitted : '—'}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.submittedVal > 0 ? '#dc2626' : '#d1d5db', fontWeight: r.submittedVal > 0 ? 600 : 400 }}>{r.submittedVal > 0 ? fmtShort(r.submittedVal) : '—'}</td>
                <td style={{ padding: '8px', textAlign: 'center', color: r.verified > 0 ? '#059669' : '#d1d5db' }}>{r.verified > 0 ? r.verified : '—'}</td>
                <td style={{ padding: '8px', textAlign: 'center', color: r.approved > 0 ? '#7c3aed' : '#d1d5db' }}>{r.approved > 0 ? r.approved : '—'}</td>
                <td style={{ padding: '8px', textAlign: 'center', color: r.paid > 0 ? '#166534' : '#d1d5db' }}>{r.paid > 0 ? r.paid : '—'}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#111827' }}>{fmtShort(r.totalVal)}</td>
              </tr>
            ))}
          </tbody>
          {byPractice.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                <td style={{ padding: '9px 8px', fontWeight: 700, color: '#374151' }}>TOTALS</td>
                <td style={{ padding: '9px 8px' }} />
                <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 700, color: totals.submitted > 0 ? '#dc2626' : '#d1d5db' }}>{totals.submitted || '—'}</td>
                <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: totals.submittedVal > 0 ? '#dc2626' : '#d1d5db' }}>{totals.submittedVal > 0 ? fmtShort(totals.submittedVal) : '—'}</td>
                <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 700, color: '#059669' }}>{totals.verified || '—'}</td>
                <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 700, color: '#7c3aed' }}>{totals.approved || '—'}</td>
                <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 700, color: '#166534' }}>{totals.paid || '—'}</td>
                <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: '#111827' }}>{fmtShort(totals.totalVal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

// ─── Claim Card ───────────────────────────────────────────────────────────────
const VerifierClaimCard = ({ claim, expanded, onToggle, onVerify, onReturn, saving }: {
  claim: BuyBackClaim; expanded: boolean; onToggle: () => void;
  onVerify: (id: string, notes?: string) => Promise<any>;
  onReturn: (id: string, notes?: string) => Promise<any>;
  saving: boolean;
}) => {
  const [notes, setNotes] = useState('');
  const total = claimTotal(claim);
  const hours = claimHours(claim);
  const lines = claimLines(claim);
  const isSubmitted = claim.status === 'submitted';
  const hasPartA = (claim as any).part_a ?? true;
  const hasPartB = !!(claim as any).part_b;
  const partBDetail = (claim as any).part_b_detail;
  const bankDetails = (claim as any).bank_details;
  const directorNotes = (claim as any).director_notes || (claim as any).query_notes || '';
  const financeNotes = (claim as any).finance_notes || (claim as any).payment_notes || '';

  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: `1px solid ${isSubmitted ? '#7dd3fc' : '#e5e7eb'}`,
      overflow: 'hidden',
      boxShadow: isSubmitted ? '0 0 0 1px #bae6fd, 0 2px 8px rgba(14,165,233,0.06)' : '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <button onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ color: '#9ca3af', flexShrink: 0 }}>
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#111827', whiteSpace: 'nowrap' }}>{practiceName(claim.practice_key)}</span>
          <span style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>{practiceCode(claim.practice_key)}</span>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{getClaimMonthLabel(claim)}</span>
          <ClaimTypeBadge type={claim.claim_type} />
          <StatusBadge status={claim.status} />
          {isSubmitted && <span style={{ fontSize: 11, color: '#0369a1', fontWeight: 500 }}>Needs verification</span>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 100 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmt(total)}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{lines.length} staff · {hours.toFixed(1)} hrs</div>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '0 18px 18px' }}>
          {/* Metadata */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, padding: '14px 0 12px', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
            <InfoBlock label="Practice Manager" value={(claim as any).manager_name || '—'} />
            <InfoBlock label="Submitted" value={dateStr(claim.submitted_at)} />
            {claim.verified_by && <InfoBlock label="Verified by" value={claim.verified_by} sub={dateStr(claim.verified_at)} />}
            {claim.invoice_number && <InvoiceDownloadLink claim={claim} />}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <EvidencePill label="Part A" met={hasPartA} />
              <EvidencePill label="Part B" met={hasPartB} />
            </div>
          </div>

          {/* Bank details */}
          {bankDetails && (
            <div style={{ display: 'flex', gap: 20, padding: '10px 0', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #f3f4f6', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Landmark className="w-3.5 h-3.5 text-gray-500" />
                <span style={{ fontWeight: 600, color: '#374151', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Payment Details</span>
              </div>
              <InfoBlock label="Account Name" value={bankDetails.accountName || bankDetails.account_name || '—'} />
              <InfoBlock label="Sort Code" value={bankDetails.sortCode || bankDetails.sort_code || '—'} />
              <InfoBlock label="Account (last 4)" value={`••••${bankDetails.accountLast4 || bankDetails.account_last4 || '—'}`} />
            </div>
          )}

          {/* Part B substantiation */}
          {partBDetail && (
            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12, background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0c4a6e' }}>
              <strong>Part B Substantiation:</strong> {partBDetail}
            </div>
          )}
          {hasPartA && !hasPartB && (
            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
              <strong>Part B Evidence Missing:</strong> Practice has not provided Part B substantiation. Return to practice for completion before verifying.
            </div>
          )}

          {/* Verification checklist — submitted only */}
          {isSubmitted && <VerificationChecklist claim={claim} />}

          {/* Staff line items */}
          {lines.length > 0 && (
            <div style={{ overflowX: 'auto', margin: '12px 0 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Name', 'Role', 'GL Cat', 'Date', 'Hours Worked', 'Hrs', 'Amount'].map((h, i) => (
                      <th key={h} style={{ textAlign: i >= 5 ? 'right' : 'left', padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l: any, idx: number) => (
                    <tr key={l.id ?? idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px', fontWeight: 500, color: '#111827' }}>{l.staff_name || l.name || '—'}</td>
                      <td style={{ padding: '10px', color: '#374151' }}>{l.staff_role || l.role || '—'}</td>
                      <td style={{ padding: '10px' }}>
                        <code style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f3f4f6', color: '#374151' }}>
                          {l.gl_code || l.gl || l.staff_category || '—'}
                        </code>
                      </td>
                      <td style={{ padding: '10px', color: '#374151', whiteSpace: 'nowrap' }}>{l.date || l.claim_month || '—'}</td>
                      <td style={{ padding: '10px', color: '#374151', whiteSpace: 'nowrap' }}>{l.hours_worked || l.hours || '—'}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{(l.total_hours ?? l.totalHrs ?? 0).toFixed(1)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#111827' }}>{fmt(l.claimed_amount ?? l.claimed ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ padding: '10px' }} />
                    <td style={{ padding: '10px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Total</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#111827', fontVariantNumeric: 'tabular-nums', borderTop: '2px solid #e5e7eb' }}>{fmt(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Notes */}
          {directorNotes && (
            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12, background: '#f5f3ff', border: '1px solid #c4b5fd', color: '#5b21b6' }}>
              <strong>Director:</strong> {directorNotes}
            </div>
          )}
          {financeNotes && (
            <div style={{ marginTop: 6, padding: '10px 14px', borderRadius: 8, fontSize: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
              <strong>Finance:</strong> {financeNotes}
            </div>
          )}

          {/* Action bar — submitted claims only */}
          {isSubmitted && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Shield className="w-4 h-4" /> Verification Decision
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => onVerify(claim.id, notes || undefined)}
                  disabled={saving}
                  style={{
                    padding: '7px 18px', borderRadius: 8, border: '1.5px solid #059669',
                    background: (hasPartA && hasPartB) ? '#059669' : '#ecfdf5',
                    color: (hasPartA && hasPartB) ? '#fff' : '#059669',
                    fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 5, opacity: saving ? 0.6 : 1,
                  }}
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Verify & Forward to Director
                </button>
                <button
                  onClick={() => onReturn(claim.id, notes || undefined)}
                  disabled={saving}
                  style={{
                    padding: '7px 18px', borderRadius: 8, border: '1.5px solid #d97706',
                    background: '#fffbeb', color: '#d97706',
                    fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 5, opacity: saving ? 0.6 : 1,
                  }}
                >
                  Return to Practice
                </button>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Notes for practice or Director…"
                  style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
                />
              </div>
            </div>
          )}

          {/* Already verified */}
          {claim.status === 'verified' && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#059669' }}>
              <ShieldCheck className="w-3.5 h-3.5" /> Verified by {claim.verified_by} — awaiting Director review
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export function BuyBackVerifierDashboard({ claims, onVerify, onReturnToPractice, savingClaim }: VerifierDashboardProps) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Only show statuses relevant to verifier
  const visibleClaims = claims.filter(c =>
    ['submitted', 'verified', 'awaiting_review', 'approved', 'queried', 'paid', 'rejected', 'invoiced'].includes(c.status)
  );

  const submittedClaims = visibleClaims.filter(c => c.status === 'submitted');

  const filtered = useMemo(() => {
    return visibleClaims.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (search && !practiceName(c.practice_key).toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [visibleClaims, statusFilter, search]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: visibleClaims.length };
    visibleClaims.forEach(c => { m[c.status] = (m[c.status] || 0) + 1; });
    return m;
  }, [visibleClaims]);

  const submittedTotal = submittedClaims.reduce((a, c) => a + claimTotal(c), 0);
  const verifiedClaims = visibleClaims.filter(c => c.status === 'verified' || (c as any).status === 'awaiting_review');
  const verifiedTotal = verifiedClaims.reduce((a, c) => a + claimTotal(c), 0);
  const _approvedTotal = visibleClaims.filter(c => c.status === 'approved').reduce((a, c) => a + claimTotal(c), 0);
  const paidTotal = visibleClaims.filter(c => c.status === 'paid').reduce((a, c) => a + claimTotal(c), 0);

  const uniqueSubmittedPractices = new Set(submittedClaims.map(c => c.practice_key)).size;

  const STATUS_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'verified', label: 'Verified' },
    { key: 'approved', label: 'Approved' },
    { key: 'queried', label: 'Queried' },
    { key: 'paid', label: 'Paid' },
    { key: 'rejected', label: 'Rejected' },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', color: '#111827' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <div style={{ width: 6, height: 26, background: '#005eb8', borderRadius: 3 }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Buy-Back Claims</h1>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 100, background: '#005eb8', color: '#fff', letterSpacing: '0.03em' }}>NRES</span>
          </div>
          <p style={{ margin: '2px 0 0 16px', fontSize: 13, color: '#6b7280' }}>Verify submitted claims before Director review</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Amanda Palin</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>Managerial Lead · Verifier</div>
        </div>
      </div>

      {/* Queue alert */}
      {submittedClaims.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', marginBottom: 16, borderRadius: 10, background: '#f0f9ff', border: '1px solid #bae6fd', fontSize: 13, color: '#0c4a6e' }}>
          <Shield className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>{submittedClaims.length} claim{submittedClaims.length !== 1 ? 's' : ''} awaiting your verification</strong> — {fmtShort(submittedTotal)} across {uniqueSubmittedPractices} practice{uniqueSubmittedPractices !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <KpiCard label="Awaiting Verification" value={counts.submitted || 0} sub={fmtShort(submittedTotal)} accent={submittedClaims.length > 0 ? '#0369a1' : '#d1d5db'} />
        <KpiCard label="Verified (with Director)" value={(counts.verified || 0) + (counts.awaiting_review || 0)} sub={fmtShort(verifiedTotal)} accent="#059669" />
        <KpiCard label="Approved" value={counts.approved || 0} sub="by Director" accent="#7c3aed" />
        <KpiCard label="Paid" value={counts.paid || 0} sub={fmtShort(paidTotal)} accent="#166534" />
      </div>

      {/* Practice queue table */}
      <div style={{ marginBottom: 16 }}>
        <PracticeQueueTable claims={visibleClaims} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search practice…"
            style={{ padding: '7px 14px 7px 32px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, width: 200, outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(f => {
            const s = STATUS_MAP[f.key];
            const c = s?.color || '#374151';
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                style={{
                  padding: '5px 12px', borderRadius: 100, fontSize: 11, fontWeight: statusFilter === f.key ? 600 : 400,
                  border: `1px solid ${statusFilter === f.key ? c : '#d1d5db'}`,
                  background: statusFilter === f.key ? `${c}12` : '#fff',
                  color: statusFilter === f.key ? c : '#6b7280',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
                }}
              >
                {f.label}
                <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 100, background: statusFilter === f.key ? c : '#e5e7eb', color: statusFilter === f.key ? '#fff' : '#6b7280' }}>
                  {counts[f.key] || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Claims list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
            No claims match the current filters.
          </div>
        ) : filtered.map(c => (
          <VerifierClaimCard
            key={c.id}
            claim={c}
            expanded={expandedId === c.id}
            onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
            onVerify={onVerify}
            onReturn={onReturnToPractice}
            saving={savingClaim}
          />
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 20, padding: '12px 0', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af' }}>
        <span>NRES New Models of Care — Managerial Lead Verification Queue</span>
        <span>{filtered.length} claim{filtered.length !== 1 ? 's' : ''} shown</span>
      </div>
    </div>
  );
}
