import { useState, useMemo, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { type BuyBackClaim } from '@/hooks/useNRESBuyBackClaims';
import type { MeetingLogEntry } from '@/hooks/useNRESMeetingLog';
import { InvoiceDownloadLink } from './InvoiceDownloadLink';

import { NRES_PRACTICES, NRES_ODS_CODES } from '@/data/nresPractices';
import { ChevronDown, ChevronRight, Shield, ShieldCheck, Landmark, Search, HelpCircle, Settings, Calendar as CalendarIcon, Eye, Mic, Square, Plus, Trash2, X, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { InvoicePreviewDialog } from './InvoicePreviewDialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Calendar } from '@/components/ui/calendar';
import { ClaimsViewSwitcher, type DirectorPracticeOption } from './BuyBackPracticeDashboard';
import { supabase } from '@/integrations/supabase/client';
import { useNRESClaimEvidence } from '@/hooks/useNRESClaimEvidence';
import { StaffLineEvidence } from './ClaimEvidencePanel';
import { getSDAClaimGLCode } from '@/utils/glCodes';
// ─── Types ────────────────────────────────────────────────────────────────────
interface VerifierDashboardProps {
  claims: BuyBackClaim[];
  onVerify: (claimId: string, notes?: string) => Promise<any>;
  onReturnToPractice: (claimId: string, notes?: string) => Promise<any>;
  onUpdateClaimNotes?: (claimId: string, notes: string) => Promise<void>;
  savingClaim: boolean;
  onGuideOpen?: () => void;
  onSettingsOpen?: () => void;
  showSettings?: boolean;
  meetingEntries?: MeetingLogEntry[];
  onVerifyMeetingEntries?: (ids: string[], notes?: string) => Promise<any>;
  onReturnMeetingEntries?: (ids: string[], notes?: string) => Promise<any>;
  userEmail?: string;
  userName?: string;
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


/** Evidence section for management/verifier view */
const VerifierEvidenceSection = ({ claimId, staffLines, canEdit }: { claimId: string; staffLines: any[]; canEdit: boolean }) => {
  const { getUploadedTypesForStaff, getFilesForStaff, getDownloadUrl, uploadEvidence, deleteEvidence, uploading } = useNRESClaimEvidence(claimId);
  const [expanded, setExpanded] = useState(false);
  const [openTrigger, setOpenTrigger] = useState<number | undefined>(undefined);
  const totalFiles = staffLines.reduce((sum: number, _: any, idx: number) => sum + getFilesForStaff(idx).length, 0);
  const hasAnyFiles = totalFiles > 0 || staffLines.some((_: any, idx: number) => Object.keys(getUploadedTypesForStaff(idx)).length > 0);

  // Management needs to be able to add further evidence before forwarding to the SNO Approver.
  // Once the claim has moved on, keep this as a read-only evidence viewer.
  if (!hasAnyFiles && !canEdit) return null;

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
        {totalFiles > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleViewAll}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleViewAll(e as any); } }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}
          >
            <Eye className="w-3.5 h-3.5" /> View Evidence
          </span>
        )}
        {canEdit && <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b', marginLeft: 'auto' }}>Upload or paste additional documents before forwarding</span>}
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
          canEdit={canEdit}
          uploading={uploading}
          onUpload={uploadEvidence}
          onDelete={deleteEvidence}
          onDownload={getDownloadUrl}
          hideHeader
          triggerOpenAt={idx === 0 ? openTrigger : undefined}
        />
      ))}
    </div>
  );
};

const dateStr = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} at ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

type InvoiceTableRow = { id: string; date: string; start: string; stop: string; details: string };
const INVOICE_TABLE_START = '[[INVOICE_TABLE]]';
const INVOICE_TABLE_END = '[[/INVOICE_TABLE]]';
const DESCRIPTION_LIMIT = 1500;
const MAX_LINE_CHARS = 106;
const capLineWidth = (text: string) =>
  text.split('\n').map(l => l.length > MAX_LINE_CHARS ? l.slice(0, MAX_LINE_CHARS) : l).join('\n');
const DEFAULT_START_TIME = '08:00';
const DEFAULT_STOP_TIME = '17:00';

const todayStr = () => format(new Date(), 'dd/MM/yyyy');
const nowTimeStr = () => format(new Date(), 'HH:mm');
const newInvoiceTableRow = (date = todayStr(), start = '', stop = '', details = ''): InvoiceTableRow => ({ id: crypto.randomUUID(), date, start, stop, details });

const TIME_OPTIONS_15_MIN = Array.from({ length: 96 }, (_, index) => {
  const minutes = index * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

const parseDisplayDate = (value: string): Date | undefined => {
  const [day, month, year] = value.split('/').map(Number);
  if (!day || !month || !year) return undefined;
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const claimMonthBounds = (claimMonth?: string | null) => {
  const base = claimMonth ? new Date(`${claimMonth.slice(0, 7)}-01T12:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  return {
    from: new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0),
    to: new Date(base.getFullYear(), base.getMonth() + 1, 0, 12, 0, 0),
  };
};

const parseInvoiceTableDescription = (description: string): InvoiceTableRow[] => {
  const start = description.indexOf(INVOICE_TABLE_START);
  const end = description.indexOf(INVOICE_TABLE_END);
  if (start === -1 || end === -1 || end <= start) return [];
  return description.slice(start + INVOICE_TABLE_START.length, end).trim().split('\n').map((line) => {
    const [date = '', startTime = '', stop = '', ...rest] = line.split('|').map(part => part.trim());
    if (!date && !startTime && !stop && rest.length === 0) return null;
    return newInvoiceTableRow(date, startTime, stop, rest.join(' | '));
  }).filter(Boolean) as InvoiceTableRow[];
};

const serialiseInvoiceTableRows = (rows: InvoiceTableRow[]) => {
  const validRows = rows.filter(row => row.date || row.start || row.stop || row.details.trim());
  if (!validRows.length) return '';
  return [
    INVOICE_TABLE_START,
    ...validRows.map(row => `${row.date || '—'} | ${row.start || '—'} | ${row.stop || '—'} | ${row.details.trim() || '—'}`),
    INVOICE_TABLE_END,
  ].join('\n').slice(0, DESCRIPTION_LIMIT);
};

const appendInvoiceText = (current: string, addition: string) => {
  const next = [current.trim(), addition.trim()].filter(Boolean).join(current.trim() ? '\n' : '');
  return next.slice(0, DESCRIPTION_LIMIT);
};

// ── Document import helpers (Management category only) ─────────────────────
function importFileTypeFor(file: File): 'pdf' | 'image' | 'word' | null {
  const n = file.name.toLowerCase();
  if (file.type === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(n)) return 'image';
  if (n.endsWith('.docx') || n.endsWith('.doc') || file.type.includes('officedocument.wordprocessing')) return 'word';
  return null;
}
function importFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Read failed'));
    reader.readAsDataURL(file);
  });
}
// ISO YYYY-MM-DD → DD/MM/YYYY (British)
function isoToDisplayDate(iso: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
function resolveSubmitterName(claim: BuyBackClaim, profileNames: Record<string, string>): string | undefined {
  const email = claim.submitted_by_email;
  if (email && profileNames[email.toLowerCase()]) return profileNames[email.toLowerCase()];
  const raw = (claim as any).submitted_by_name;
  if (!raw) return undefined;
  if (!raw.includes('@')) return raw;
  const local = raw.split('@')[0];
  return local.split(/[._-]/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

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
  submitted: { label: 'Awaiting Verification', color: '#0369a1', bg: '#f0f9ff', border: '#7dd3fc', dot: '#38bdf8' },
  verified: { label: 'Awaiting Approval', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', dot: '#34d399' },
  awaiting_review: { label: 'With Director', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', dot: '#3b82f6' },
  approved: { label: 'Approved – Invoice Pending', color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', dot: '#8b5cf6' },
  queried: { label: 'Action Needed – Query Raised', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', dot: '#ef4444' },
  paid: { label: 'Paid', color: '#166534', bg: '#f0fdf4', border: '#86efac', dot: '#22c55e' },
  rejected: { label: 'Rejected', color: '#991b1b', bg: '#fef2f2', border: '#fca5a5', dot: '#dc2626' },
  invoiced: { label: 'Invoice Issued', color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', dot: '#8b5cf6' },
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

const CATEGORY_BADGE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  buyback:    { label: 'Buy-Back',    color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
  new_sda:    { label: 'New SDA',     color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  gp_locum:   { label: 'GP Locum',    color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  management: { label: 'Management',  color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  meeting:    { label: 'Meeting',     color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8' },
  additional: { label: 'Additional',  color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
};

const ClaimTypeBadge = ({ claim }: { claim: BuyBackClaim }) => {
  const dets = ((claim as any).staff_lines ?? (claim as any).staff_details ?? []) as any[];
  const cats = Array.from(new Set(dets.map(d => d.staff_category || 'buyback')));
  const fallback = cats.length === 0 ? [claim.claim_type === 'additional' ? 'additional' : 'buyback'] : cats;
  return (
    <>
      {fallback.map(cat => {
        const cfg = CATEGORY_BADGE_CONFIG[cat] || CATEGORY_BADGE_CONFIG.buyback;
        return (
          <span key={cat} style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
            {cfg.label}
          </span>
        );
      })}
    </>
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
const VerifierClaimCard = ({ claim, expanded, onToggle, onVerify, onReturn, onUpdateClaimNotes, saving, profileNames }: {
  claim: BuyBackClaim; expanded: boolean; onToggle: () => void;
  onVerify: (id: string, notes?: string) => Promise<any>;
  onReturn: (id: string, notes?: string) => Promise<any>;
  onUpdateClaimNotes?: (id: string, notes: string) => Promise<void>;
  saving: boolean;
  profileNames?: Record<string, string>;
}) => {
  const [notes, setNotes] = useState('');
  const savedInvoiceDescription = (claim as any).practice_notes || '';
  const [invoiceDescription, setInvoiceDescription] = useState(savedInvoiceDescription);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [invoiceRows, setInvoiceRows] = useState<InvoiceTableRow[]>(() => parseInvoiceTableDescription(savedInvoiceDescription));
  const [quickLine, setQuickLine] = useState({ date: todayStr(), start: DEFAULT_START_TIME, stop: DEFAULT_STOP_TIME, details: '' });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement | null>(null);
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [voiceError, setVoiceError] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [importing, setImporting] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const claimDateBounds = claimMonthBounds(claim.claim_month);
  const total = claimTotal(claim);
  const hours = claimHours(claim);
  const lines = claimLines(claim);
  const isManagement = lines.length > 0 && lines.every((l: any) => l.staff_category === 'management');
  const isSubmitted = claim.status === 'submitted';
  const canEditInvoiceDescription = !!onUpdateClaimNotes && ['submitted', 'verified', 'awaiting_review', 'approved'].includes(String(claim.status));
  const hasPartA = (claim as any).part_a ?? true;
  const hasPartB = !!(claim as any).part_b;
  const partBDetail = (claim as any).part_b_detail;
  const bankDetails = (claim as any).bank_details;
  const directorNotes = ((claim as any).director_notes || (claim as any).query_notes || '').replace(/\n?\n?\[FLAGGED_LINES:\[[\d,]*\]\]/, '');
  const financeNotes = (claim as any).finance_notes || (claim as any).payment_notes || '';

  useEffect(() => {
    setInvoiceDescription(savedInvoiceDescription);
    const parsedRows = parseInvoiceTableDescription(savedInvoiceDescription);
    setInvoiceRows(parsedRows);
  }, [claim.id, savedInvoiceDescription]);

  useEffect(() => {
    if (!datePickerOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (!datePickerRef.current?.contains(event.target as Node)) setDatePickerOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [datePickerOpen]);

  const syncRows = (rows: InvoiceTableRow[]) => {
    setInvoiceRows(rows);
    setInvoiceDescription(serialiseInvoiceTableRows(rows));
  };

  const handleQuickDateSelect = (date?: Date) => {
    if (!date) return;
    setQuickLine(prev => ({ ...prev, date: format(date, 'dd/MM/yyyy') }));
    setDatePickerOpen(false);
  };
  const handleQuickStop = () => {
    const completed = { ...quickLine, start: quickLine.start || DEFAULT_START_TIME, stop: quickLine.stop || DEFAULT_STOP_TIME };
    setInvoiceDescription(prev => appendInvoiceText(prev, `${completed.date || todayStr()}, ${completed.start || '—'}–${completed.stop} — ${completed.details}`));
    setQuickLine(prev => ({ date: prev.date, start: DEFAULT_START_TIME, stop: DEFAULT_STOP_TIME, details: prev.details }));
  };

  // Import dates/times from a Word/PDF/image and append as table rows (Management only)
  const handleImportDocument = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large (max 10 MB)');
      return;
    }
    const ft = importFileTypeFor(file);
    if (!ft) {
      toast.error('Unsupported file type. Use Word (.docx), PDF or an image.');
      return;
    }
    setImporting(true);
    try {
      const dataUrl = await importFileToDataUrl(file);
      const { data: extractData, error: extractErr } = await supabase.functions.invoke('extract-document-text', {
        body: { fileType: ft, dataUrl, fileName: file.name },
      });
      if (extractErr) throw new Error(extractErr.message || 'Document text extraction failed');
      const text: string = extractData?.extractedText || '';
      if (!text || text.trim().length < 5) {
        toast.error('No readable text found in the document');
        return;
      }
      const { data: aiData, error: aiErr } = await supabase.functions.invoke('extract-management-time-entries', {
        body: { text },
      });
      if (aiErr) throw new Error(aiErr.message || 'AI extraction failed');
      const entries: any[] = aiData?.entries || [];
      if (!entries.length) {
        toast.warning('AI could not find any dated time entries in that document');
        return;
      }
      const newRows: InvoiceTableRow[] = entries.map((e) => newInvoiceTableRow(
        isoToDisplayDate(e.work_date || ''),
        e.start_time || '',
        e.end_time || '',
        (e.description || '').slice(0, MAX_LINE_CHARS - 40),
      ));
      syncRows([...invoiceRows, ...newRows]);
      toast.success(`Added ${newRows.length} line${newRows.length === 1 ? '' : 's'} from ${file.name}`);
    } catch (e: any) {
      console.error('Import failed:', e);
      toast.error(e?.message || 'Import failed');
    } finally {
      setImporting(false);
      if (importFileInputRef.current) importFileInputRef.current.value = '';
    }
  };

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    setVoiceState('processing');
    recorder.stop();
  };

  const startVoiceRecording = async () => {
    try {
      setVoiceError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : undefined });
      audioChunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        try {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (!blob.size) throw new Error('No audio captured');
          const base64Audio = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          const { data, error } = await supabase.functions.invoke('speech-to-text', { body: { audio: base64Audio } });
          if (error) throw error;
          const text = String(data?.text || '').trim();
          if (text) {
            setInvoiceDescription(prev => appendInvoiceText(prev, text));
          }
        } catch (error) {
          console.error('Invoice dictation failed:', error);
          setVoiceError('Could not transcribe the recording.');
        } finally {
          setVoiceState('idle');
          mediaRecorderRef.current = null;
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setVoiceState('recording');
    } catch (error) {
      console.error('Invoice dictation start failed:', error);
      setVoiceError('Could not access the microphone.');
      setVoiceState('idle');
    }
  };

  const updateInvoiceRow = (id: string, patch: Partial<InvoiceTableRow>) => syncRows(invoiceRows.map(row => row.id === id ? { ...row, ...patch } : row));
  const removeInvoiceRow = (id: string) => syncRows(invoiceRows.filter(row => row.id !== id));
  const addBlankInvoiceRow = () => syncRows([...invoiceRows, newInvoiceTableRow()]);

  // Convert clipboard text from Excel/Sheets (TSV) into a nicely aligned text table.
  // Each column is padded to its widest cell so things line up in the monospace textarea
  // and on the printed invoice. Returns null if the paste isn't tabular.
  const formatClipboardAsLines = (text: string): string | null => {
    const cleaned = text.replace(/\r\n?/g, '\n').replace(/\n+$/g, '');
    if (!cleaned) return null;
    const rawLines = cleaned.split('\n');
    if (!rawLines.some(l => l.includes('\t'))) return null;

    // Split into rows of cells; keep all cells (don't drop empties — we need column alignment).
    const rows = rawLines
      .map(line => line.split('\t').map(c => c.trim()))
      .filter(cells => cells.some(c => c.length > 0));
    if (!rows.length) return null;

    // Trim trailing empty columns globally.
    const colCount = Math.max(...rows.map(r => r.length));
    let lastNonEmpty = 0;
    for (let c = 0; c < colCount; c++) {
      if (rows.some(r => (r[c] || '').length > 0)) lastNonEmpty = c;
    }
    const trimmed = rows.map(r => {
      const out = r.slice(0, lastNonEmpty + 1);
      while (out.length < lastNonEmpty + 1) out.push('');
      return out;
    });

    // Compute width per column, but cap so we don't blow past the per-line limit.
    const cols = lastNonEmpty + 1;
    const sepWidth = 3; // " | "
    const maxRowWidth = MAX_LINE_CHARS;
    const rawWidths = Array.from({ length: cols }, (_, c) =>
      Math.max(1, ...trimmed.map(r => (r[c] || '').length))
    );
    const totalSep = sepWidth * (cols - 1);
    let budget = Math.max(cols, maxRowWidth - totalSep);
    const widths = [...rawWidths];
    // Shrink widest columns proportionally if over budget.
    let total = widths.reduce((a, b) => a + b, 0);
    while (total > budget) {
      const idx = widths.indexOf(Math.max(...widths));
      if (widths[idx] <= 4) break;
      widths[idx] -= 1;
      total -= 1;
    }

    const pad = (s: string, w: number) => {
      if (s.length > w) return s.slice(0, Math.max(1, w - 1)) + '…';
      return s + ' '.repeat(w - s.length);
    };
    const formatRow = (r: string[]) =>
      r.map((cell, i) => pad(cell, widths[i])).join(' | ').replace(/\s+$/, '');

    const out: string[] = [];
    trimmed.forEach((r, i) => {
      out.push(formatRow(r));
      if (i === 0 && trimmed.length > 1) {
        // Underline header row for readability.
        out.push(widths.map(w => '─'.repeat(w)).join('─┼─'));
      }
    });
    return out.join('\n');
  };

  // Paste handler for the textarea — preserves Excel table formatting as readable lines.
  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text/plain');
    const formatted = formatClipboardAsLines(text);
    if (!formatted) return; // not tabular — default paste
    e.preventDefault();
    const textarea = e.currentTarget;
    const start = textarea.selectionStart ?? invoiceDescription.length;
    const end = textarea.selectionEnd ?? invoiceDescription.length;
    const next = capLineWidth(invoiceDescription.slice(0, start) + formatted + invoiceDescription.slice(end)).slice(0, DESCRIPTION_LIMIT);
    setInvoiceDescription(next);
  };

  const handleVerify = async () => {
    if (onUpdateClaimNotes && invoiceDescription !== savedInvoiceDescription) {
      await onUpdateClaimNotes(claim.id, invoiceDescription);
    }
    await onVerify(claim.id, notes || undefined);
  };

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
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{getClaimMonthLabel(claim)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>Practice</span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{practiceName(claim.practice_key)}</span>
                <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{practiceCode(claim.practice_key)}</span>
              </span>
            </div>
          </div>
          {/* Row 2 — category & alerts (status moved to centre) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <ClaimTypeBadge claim={claim} />
            {isSubmitted && <span style={{ fontSize: 11, color: '#0369a1', fontWeight: 500 }}>Needs verification</span>}
          </div>
        </div>
        {/* Centre — Status with caption */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', flexShrink: 0, padding: '0 16px' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6 }}>Status</span>
          <StatusBadge status={claim.status} />
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
            {(() => { const name = resolveSubmitterName(claim, profileNames || {}); return name ? <InfoBlock label="Submitted by" value={name} sub={claim.submitted_by_email || undefined} /> : claim.submitted_by_email ? <InfoBlock label="Submitted by" value={claim.submitted_by_email} /> : null; })()}
            {claim.verified_by && <InfoBlock label="Verified by" value={claim.verified_by} sub={dateStr(claim.verified_at)} />}
            {claim.approved_by_email && <InfoBlock label="Approved by" value={claim.approved_by_email.split('@')[0].split(/[._-]/).filter(Boolean).map((part: string) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ')} sub={dateStr(claim.reviewed_at || (claim as any).approved_at)} />}
            {claim.invoice_number && <InvoiceDownloadLink claim={claim} />}
          </div>

          {/* Invoice description / claim details */}
          {canEditInvoiceDescription ? (
            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 700, color: '#78350f' }}>Invoice description / claim details</div>
                <div style={{ fontSize: 10, color: '#92400e', fontStyle: 'italic' }}>Tip: copy a row range from Excel and paste below — columns are preserved.</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
                <button onClick={voiceState === 'recording' ? stopVoiceRecording : startVoiceRecording} disabled={voiceState === 'processing'} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #d97706', background: voiceState === 'recording' ? '#fee2e2' : '#fff', color: '#92400e', fontSize: 12, fontWeight: 700, cursor: voiceState === 'processing' ? 'not-allowed' : 'pointer', display: 'inline-flex', gap: 5, alignItems: 'center' }}>{voiceState === 'recording' ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}{voiceState === 'recording' ? 'Stop speaking' : voiceState === 'processing' ? 'Transcribing…' : 'Speak description'}</button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                <div ref={datePickerRef} style={{ position: 'relative', display: 'inline-flex' }}>
                  <button type="button" onClick={() => setDatePickerOpen(open => !open)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #fcd34d', background: '#fff', color: '#92400e', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', gap: 5, alignItems: 'center' }}><CalendarIcon className="w-3.5 h-3.5" /> Date {quickLine.date}</button>
                  {datePickerOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 80, width: 294, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', boxShadow: '0 12px 28px rgba(15,23,42,0.18)' }}>
                      <div className="flex items-center justify-end border-b px-2 py-1">
                        <button type="button" onClick={() => setDatePickerOpen(false)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close calendar">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <Calendar mode="single" selected={parseDisplayDate(quickLine.date)} onSelect={handleQuickDateSelect} disabled={claimDateBounds ? { before: claimDateBounds.from, after: claimDateBounds.to } : undefined} className="p-3 pointer-events-auto" />
                    </div>
                  )}
                </div>
                <Select value={quickLine.start || undefined} onValueChange={value => setQuickLine(prev => ({ ...prev, start: value }))}>
                  <SelectTrigger className="h-8 w-[112px] border-amber-300 bg-background text-amber-800 text-xs font-semibold"><SelectValue placeholder="Start" /></SelectTrigger>
                  <SelectContent className="max-h-72">{TIME_OPTIONS_15_MIN.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={quickLine.stop || undefined} onValueChange={value => setQuickLine(prev => ({ ...prev, stop: value }))}>
                  <SelectTrigger className="h-8 w-[112px] border-amber-300 bg-background text-amber-800 text-xs font-semibold"><SelectValue placeholder="Stop" /></SelectTrigger>
                  <SelectContent className="max-h-72">{TIME_OPTIONS_15_MIN.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}</SelectContent>
                </Select>
                <button onClick={handleQuickStop} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #d97706', background: '#fef3c7', color: '#78350f', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Stop + add line</button>
                <input value={quickLine.details} onChange={e => setQuickLine(prev => ({ ...prev, details: e.target.value }))} placeholder="Line details" style={{ flex: '1 1 220px', minWidth: 180, padding: '5px 8px', borderRadius: 6, border: '1px solid #fcd34d', fontSize: 12 }} />
              </div>
              {voiceError && <div style={{ marginBottom: 6, color: '#b91c1c', fontSize: 11 }}>{voiceError}</div>}
              <textarea value={invoiceDescription} onChange={e => setInvoiceDescription(capLineWidth(e.target.value).slice(0, DESCRIPTION_LIMIT))} onPaste={handleTextareaPaste} placeholder="Add multiple dates, times or invoice wording to print on the invoice… (paste a range from Excel to keep columns)" rows={4} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #fcd34d', fontSize: 12, resize: 'vertical', outline: 'none', background: '#fff', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 11, color: '#92400e' }}>{invoiceDescription.split('\n').length} / 20 lines · max {MAX_LINE_CHARS} chars/line · {invoiceDescription.length}/{DESCRIPTION_LIMIT} characters — printed on the invoice if completed</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setInvoicePreviewOpen(true)}
                    style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #2563eb', background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  >
                    <Eye className="w-3.5 h-3.5" /> Preview invoice
                  </button>
                  <button
                    onClick={() => onUpdateClaimNotes(claim.id, invoiceDescription)}
                    disabled={saving || invoiceDescription === savedInvoiceDescription}
                    style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d97706', background: '#fff', color: '#92400e', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving || invoiceDescription === savedInvoiceDescription ? 0.55 : 1 }}
                  >
                    Save description
                  </button>
                </div>
              </div>
            </div>
          ) : (claim as any).practice_notes && (
            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
              <strong>Invoice description:</strong>
              {parseInvoiceTableDescription((claim as any).practice_notes).length ? (
                <div style={{ marginTop: 6, overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: 12 }}><thead><tr>{['Date', 'Start', 'Stop', 'Details'].map(h => <th key={h} style={{ textAlign: 'left', padding: '5px 7px', border: '1px solid #fde68a', color: '#78350f' }}>{h}</th>)}</tr></thead><tbody>{parseInvoiceTableDescription((claim as any).practice_notes).map(row => <tr key={row.id}><td style={{ padding: '5px 7px', border: '1px solid #fde68a' }}>{row.date}</td><td style={{ padding: '5px 7px', border: '1px solid #fde68a' }}>{row.start}</td><td style={{ padding: '5px 7px', border: '1px solid #fde68a' }}>{row.stop}</td><td style={{ padding: '5px 7px', border: '1px solid #fde68a' }}>{row.details}</td></tr>)}</tbody></table></div>
              ) : ` ${(claim as any).practice_notes}`}
              <button
                onClick={() => setInvoicePreviewOpen(true)}
                style={{ marginLeft: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #2563eb', background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <Eye className="w-3.5 h-3.5" /> Preview invoice
              </button>
            </div>
          )}

          <InvoicePreviewDialog open={invoicePreviewOpen} onOpenChange={setInvoicePreviewOpen} claim={claim} invoiceDescription={invoiceDescription} />

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
          {!isManagement && partBDetail && (
            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12, background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0c4a6e' }}>
              <strong>Part B Substantiation:</strong> {partBDetail}
            </div>
          )}
          {/* Part B Evidence Missing banner and Verification Checklist removed per request */}

          {/* Query & Response audit thread */}
          {(claim as any).query_notes && (
            <div style={{ marginTop: 10 }}>
              <div style={{ padding: '10px 14px', borderRadius: '8px 8px 0 0', fontSize: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
                <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                  Query from {(claim as any).queried_by_role || 'Reviewer'}{(claim as any).queried_by ? ` (${(claim as any).queried_by})` : ''}
                  {(claim as any).queried_at && (
                    <span style={{ fontWeight: 400, fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>
                      {format(new Date((claim as any).queried_at), 'd MMM yyyy, HH:mm')}
                    </span>
                  )}
                </div>
                {((claim as any).query_notes || '').replace(/\n?\n?\[FLAGGED_LINES:\[[\d,]*\]\]/, '')}
              </div>
              {(claim as any).query_response && (
                <div style={{ padding: '10px 14px', borderRadius: '0 0 8px 8px', fontSize: 12, background: '#fffbeb', border: '1px solid #fde68a', borderTop: 'none', color: '#92400e' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                    Practice Response
                    {((claim as any).query_responded_at || (claim as any).submitted_at) && (
                      <span style={{ fontWeight: 400, fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>
                        {format(new Date((claim as any).query_responded_at || (claim as any).submitted_at), 'd MMM yyyy, HH:mm')}
                      </span>
                    )}
                  </div>
                  {(claim as any).query_response}
                </div>
              )}
            </div>
          )}

          {/* Staff line items */}
          {lines.length > 0 && (() => {
            const hasLocum = lines.some((l: any) => l.staff_category === 'gp_locum');
            const MINS_PER_SESS = 250;
            const fmtLocum = (s: number) => { const t = Math.round(s * MINS_PER_SESS); const h = Math.floor(t/60); const m = t%60; return { display: m > 0 ? `${h}h ${m}m` : `${h}h`, decimal: (t/60).toFixed(1) }; };
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
            const totalClaimed = lines.reduce((a: number, l: any) => a + (l.claimed_amount ?? l.claimed ?? 0), 0);
            const totalMax = lines.reduce((a: number, l: any) => a + getMaxInfo(l).max, 0);
            const totalLocumHrs = hasLocum ? lines.reduce((a: number, l: any) => a + (l.staff_category === 'gp_locum' ? Math.round((l.allocation_value ?? 0) * MINS_PER_SESS) / 60 : 0), 0) : 0;

            return (
            <div style={{ margin: '12px 0 0' }}>
              <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {headers.map((h, i) => (
                      <th key={h} style={{ textAlign: i >= rightAlignIdx ? 'right' : 'left', padding: '7px 10px', fontSize: 11, fontWeight: 600, color: h === 'Max Claimable' ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l: any, idx: number) => {
                    const isLocum = l.staff_category === 'gp_locum';
                    const locHrs = isLocum ? fmtLocum(l.allocation_value || 0) : null;
                    const claimedAmt = l.claimed_amount ?? l.claimed ?? 0;
                    const mi = getMaxInfo(l);
                    const overMax = mi.max > 0 && claimedAmt > mi.max;
                    return (
                    <tr key={l.id ?? idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px', fontWeight: 500, color: '#111827' }}>{l.staff_name || l.name || '—'}</td>
                      <td style={{ padding: '10px', color: '#374151' }}>{l.staff_role || l.role || '—'}</td>
                      <td style={{ padding: '10px' }}>
                        <code style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f3f4f6', color: '#374151' }}>
                          {getSDAClaimGLCode(l, claim.claim_type || 'buyback') || '—'}
                        </code>
                      </td>
                      {hasLocum && (
                        <td style={{ padding: '10px', textAlign: 'center', color: '#374151', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {isLocum ? (l.allocation_value || 0) : '—'}
                        </td>
                      )}
                      <td style={{ padding: '10px', color: '#374151', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const raw = l.date || l.claim_month || claim.claim_month || '';
                          if (!raw) return '—';
                          const d = new Date(raw + (raw.length <= 7 ? '-01' : '') + 'T12:00:00');
                          return isNaN(d.getTime()) ? raw : d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
                        })()}
                      </td>
                      <td style={{ padding: '10px', color: '#374151', whiteSpace: 'nowrap' }}>
                        {isLocum && locHrs ? locHrs.display : l.staff_category === 'management' ? `${l.allocation_value ?? 0} hrs/wk` : (l.hours_worked || l.hours || '—')}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                        {isLocum && locHrs ? locHrs.decimal : (() => {
                          if (l.staff_category === 'management' && l.hourly_rate > 0 && (l.calculated_amount ?? 0) > 0) {
                            return (l.calculated_amount / l.hourly_rate).toFixed(1);
                          }
                          return (l.total_hours ?? l.totalHrs ?? 0).toFixed(1);
                        })()}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: overMax ? '#dc2626' : '#111827' }}>
                        {fmt(claimedAmt)}
                        {overMax && <span style={{ marginLeft: 4, fontSize: 10, color: '#dc2626', fontWeight: 700 }}>!</span>}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#9ca3af' }}>
                        {mi.max > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                            <span title={mi.formula}>{fmt(mi.max)}</span>
                            {l.staff_category === 'management' && (
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
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#111827', fontVariantNumeric: 'tabular-nums', borderTop: '2px solid #e5e7eb' }}>{fmt(totalClaimed)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, fontSize: 12, color: '#9ca3af', fontVariantNumeric: 'tabular-nums', borderTop: '2px solid #e5e7eb' }}>
                      {totalMax > 0 ? fmt(totalMax) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
              </div>
            </div>
            );
          })()}

          {/* Supporting Evidence */}
          {lines.length > 0 && <VerifierEvidenceSection claimId={claim.id} staffLines={lines} canEdit={isSubmitted} />}

          {/* Notes */}
          {directorNotes && (
            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12, background: '#f5f3ff', border: '1px solid #c4b5fd', color: '#5b21b6' }}>
              <strong>{(claim as any).queried_by_role || 'Director'}:</strong> {directorNotes}
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
                  onClick={handleVerify}
                  disabled={saving}
                  style={{
                    padding: '7px 18px', borderRadius: 8, border: '1.5px solid #059669',
                    background: (hasPartA && hasPartB) ? '#059669' : '#ecfdf5',
                    color: (hasPartA && hasPartB) ? '#fff' : '#059669',
                    fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 5, opacity: saving ? 0.6 : 1,
                  }}
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Verify & Forward to SNO Approver
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
                  placeholder="Notes for practice or SNO Approver…"
                  style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
                />
              </div>
            </div>
          )}

          {/* Already verified */}
          {claim.status === 'verified' && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#059669' }}>
              <ShieldCheck className="w-3.5 h-3.5" /> Verified by {claim.verified_by} — awaiting SNO Approver review
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Meeting Verifier Card ────────────────────────────────────────────────────
const MeetingVerifierCard = ({ entries, expanded, onToggle, onVerify, onReturn, saving }: {
  entries: MeetingLogEntry[];
  expanded: boolean;
  onToggle: () => void;
  onVerify: (ids: string[], notes?: string) => Promise<any>;
  onReturn: (ids: string[], notes?: string) => Promise<any>;
  saving: boolean;
}) => {
  const [notes, setNotes] = useState('');
  const personName = entries[0]?.person_name || '—';
  const practiceCode = entries[0]?.billing_org_code || '';
  const practiceName_ = Object.entries(NRES_ODS_CODES as Record<string, string>).find(([, v]) => v === practiceCode)?.[0];
  const practiceLabel = practiceName_ ? (NRES_PRACTICES as Record<string, string>)[practiceName_] || practiceName_ : practiceCode;
  const claimMonth = entries[0]?.claim_month || '';
  const monthLabel = (() => {
    if (!claimMonth) return '—';
    const d = new Date(claimMonth + (claimMonth.length <= 7 ? '-01' : ''));
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  })();
  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const totalAmount = entries.reduce((s, e) => s + e.total_amount, 0);
  const ids = entries.map(e => e.id);
  const allSubmitted = entries.every(e => e.status === 'submitted');

  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: `1px solid ${allSubmitted ? '#7dd3fc' : '#e5e7eb'}`,
      overflow: 'hidden',
      boxShadow: allSubmitted ? '0 0 0 1px #bae6fd, 0 2px 8px rgba(14,165,233,0.06)' : '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <button onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ color: '#9ca3af', flexShrink: 0 }}>
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <Calendar className="w-4 h-4" style={{ color: '#0369a1', flexShrink: 0 }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: '#111827', whiteSpace: 'nowrap' }}>{personName}</span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{practiceLabel}</span>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{monthLabel}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, color: '#0369a1', background: '#e0f2fe', border: '1px solid #bae6fd' }}>
            Meeting Attendance
          </span>
          <StatusBadge status={entries[0]?.status || 'submitted'} />
          {allSubmitted && <span style={{ fontSize: 11, color: '#0369a1', fontWeight: 500 }}>Needs verification</span>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 100 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalAmount)}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{entries.length} meeting{entries.length !== 1 ? 's' : ''} · {totalHours.toFixed(1)} hrs</div>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '0 18px 18px' }}>
          {/* Metadata */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, padding: '14px 0 12px', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
            <InfoBlock label="Person" value={personName} />
            <InfoBlock label="Practice" value={practiceLabel} sub={practiceCode} />
            <InfoBlock label="Period" value={monthLabel} />
            <InfoBlock label="Rate" value={`${fmt(entries[0]?.hourly_rate || 0)}/hr`} />
          </div>

          {/* Meeting line items */}
          <div style={{ overflowX: 'auto', margin: '12px 0 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Meeting', 'Date', 'Hours', 'Amount'].map((h, i) => (
                    <th key={h} style={{ textAlign: i >= 2 ? 'right' : 'left', padding: '7px 10px', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px', fontWeight: 500, color: '#111827' }}>{entry.description || 'Meeting'}</td>
                    <td style={{ padding: '10px', color: '#374151', whiteSpace: 'nowrap' }}>{new Date(entry.work_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{entry.hours.toFixed(1)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: '#111827' }}>{fmt(entry.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} style={{ padding: '10px' }} />
                  <td style={{ padding: '10px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Total</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#111827', fontVariantNumeric: 'tabular-nums', borderTop: '2px solid #e5e7eb' }}>{fmt(totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Action bar — submitted entries only */}
          {allSubmitted && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Shield className="w-4 h-4" /> Verification Decision
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => onVerify(ids, notes || undefined)}
                  disabled={saving}
                  style={{
                    padding: '7px 18px', borderRadius: 8, border: '1.5px solid #059669',
                    background: '#059669', color: '#fff',
                    fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 5, opacity: saving ? 0.6 : 1,
                  }}
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Verify & Forward to SNO Approver
                </button>
                <button
                  onClick={() => onReturn(ids, notes || undefined)}
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
                  placeholder="Notes for practice or SNO Approver…"
                  style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
                />
              </div>
            </div>
          )}

          {/* Already verified */}
          {!allSubmitted && entries[0]?.status === 'verified' && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#059669' }}>
              <ShieldCheck className="w-3.5 h-3.5" /> Verified — awaiting SNO Approver review
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Verification Log View ────────────────────────────────────────────────────
interface AuditEntry {
  id: string;
  claim_line_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  notes: string | null;
  performed_by: string | null;
  performed_by_name: string | null;
  performed_by_role: string | null;
  created_at: string;
}

const VerificationLogView = ({ claims, userEmail }: { claims: BuyBackClaim[]; userEmail?: string }) => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const claimIds = useMemo(() => claims.map(c => c.id), [claims]);
  const claimsById = useMemo(() => {
    const m: Record<string, BuyBackClaim> = {};
    claims.forEach(c => { m[c.id] = c; });
    return m;
  }, [claims]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (claimIds.length === 0) { setEntries([]); setLoading(false); return; }
      setLoading(true);
      // Pull recent audit entries for the user's accessible claims
      const { data, error } = await (supabase as any)
        .from('claim_audit_log')
        .select('*')
        .in('claim_line_id', claimIds.slice(0, 1000))
        .order('created_at', { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (error) { setEntries([]); setLoading(false); return; }
      const verifyActions = (data || []).filter((e: AuditEntry) => {
        const a = (e.action || '').toLowerCase();
        const isVerifyOrReturn =
          a.includes('verif') || a.includes('queried') || a.includes('return') ||
          e.to_status === 'verified' || e.to_status === 'queried';
        if (!isVerifyOrReturn) return false;
        if (userEmail) {
          // Filter to actions performed by this user (case-insensitive)
          return (e.performed_by || '').toLowerCase() === userEmail.toLowerCase();
        }
        return true;
      });
      setEntries(verifyActions);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [claimIds, userEmail]);

  const decisionMeta = (e: AuditEntry) => {
    const a = (e.action || '').toLowerCase();
    if (a.includes('queried') || a.includes('return') || e.to_status === 'queried') {
      return { label: 'Returned / Queried', color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
    }
    if (a.includes('verif') || e.to_status === 'verified') {
      return { label: 'Verified', color: '#059669', bg: '#ecfdf5', border: '#bbf7d0' };
    }
    return { label: e.action, color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' };
  };

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Shield className="w-4 h-4" style={{ color: '#005eb8' }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Verification Log</div>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>· {entries.length} action{entries.length !== 1 ? 's' : ''}</span>
      </div>
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading audit trail…</div>
      ) : entries.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
          No verification actions recorded yet for the current selection.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['When', 'Claim', 'Practice', 'Decision', 'Note', 'By'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const claim = claimsById[e.claim_line_id];
                const meta = decisionMeta(e);
                return (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#374151' }}>{dateStr(e.created_at)}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>{e.claim_line_id.slice(0, 8)}…</td>
                    <td style={{ padding: '10px 12px', color: '#111827', fontWeight: 500 }}>{claim ? practiceName(claim.practice_key) : '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 100, fontSize: 11, fontWeight: 600, color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#374151', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.notes || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>{e.performed_by_name || e.performed_by || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
type QueueTab = 'queue' | 'verified_by_me' | 'returned' | 'all';
type ListView = 'by_practice' | 'individual' | 'verification_log' | 'spreadsheet';

export function BuyBackVerifierDashboard({ claims, onVerify, onReturnToPractice, onUpdateClaimNotes, savingClaim, onGuideOpen, onSettingsOpen, showSettings, meetingEntries, onVerifyMeetingEntries, onReturnMeetingEntries, userEmail, userName }: VerifierDashboardProps) {
  const [queueTab, setQueueTab] = useState<QueueTab>('queue');
  const [listView, setListView] = useState<ListView>('individual');
  const [period, setPeriod] = useState('all');
  const [filterPractice, setFilterPractice] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRoute, setFilterRoute] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const hasAutoOpenedFirstEditableClaim = useRef(false);

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

  // Group meeting entries by person + claim_month for verifier view
  const visibleMeetingGroups = useMemo(() => {
    if (!meetingEntries) return [];
    const visible = meetingEntries.filter(e =>
      ['submitted', 'verified', 'approved', 'queried', 'paid'].includes(e.status)
    );
    const groups: Record<string, MeetingLogEntry[]> = {};
    visible.forEach(e => {
      const key = `${e.person_name}__${e.claim_month?.slice(0, 7) || ''}__${e.billing_org_code || ''}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return Object.values(groups);
  }, [meetingEntries]);

  // Only show statuses relevant to verifier
  const visibleClaims = useMemo(() => claims.filter(c =>
    ['submitted', 'verified', 'awaiting_review', 'approved', 'queried', 'paid', 'rejected', 'invoiced'].includes(c.status)
  ), [claims]);

  // Apply queue tab → status filter
  const tabFilteredClaims = useMemo(() => {
    return visibleClaims.filter(c => {
      if (queueTab === 'queue') return c.status === 'submitted';
      if (queueTab === 'verified_by_me') {
        if (!userEmail) { const s = c.status as string; return s === 'verified' || s === 'awaiting_review'; }
        return (c.verified_by || '').toLowerCase() === userEmail.toLowerCase();
      }
      if (queueTab === 'returned') return c.status === 'queried' || c.status === 'rejected';
      return true; // 'all'
    });
  }, [visibleClaims, queueTab, userEmail]);

  // Apply period (re-using YTD/this month logic)
  const periodFilteredClaims = useMemo(() => filterByPeriod(tabFilteredClaims, period), [tabFilteredClaims, period]);

  // Apply dropdown filters (Practice, Category, Status, Route)
  const dropdownFilteredClaims = useMemo(() => {
    return periodFilteredClaims.filter(c => {
      if (filterPractice !== 'all' && c.practice_key !== filterPractice) return false;
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      if (filterCategory !== 'all') {
        const dets = (c.staff_details || []) as any[];
        if (!dets.some(d => (d.staff_category || 'buyback') === filterCategory)) return false;
      }
      if (filterRoute !== 'all') {
        const dets = (c.staff_details || []) as any[];
        const routeOf = (cat: string) => (cat === 'management' || cat === 'meeting') ? 'pml' : 'icb';
        if (!dets.some(d => routeOf(d.staff_category || 'buyback') === filterRoute)) return false;
      }
      if (search && !practiceName(c.practice_key).toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [periodFilteredClaims, filterPractice, filterStatus, filterCategory, filterRoute, search]);

  const filteredMeetingGroups = useMemo(() => {
    return visibleMeetingGroups.filter(group => {
      const status = group[0]?.status || 'submitted';
      // Match queue tab
      if (queueTab === 'queue' && status !== 'submitted') return false;
      if (queueTab === 'returned' && !(status === 'queried' || status === 'rejected')) return false;
      if (queueTab === 'verified_by_me' && status !== 'verified') return false;
      if (filterStatus !== 'all' && status !== filterStatus) return false;
      if (search) {
        const practiceCode_ = group[0]?.billing_org_code || '';
        const practiceName__ = Object.entries(NRES_ODS_CODES as Record<string, string>).find(([, v]) => v === practiceCode_)?.[0];
        const label = practiceName__ ? (NRES_PRACTICES as Record<string, string>)[practiceName__] || '' : '';
        if (!label.toLowerCase().includes(search.toLowerCase()) && !group[0]?.person_name.toLowerCase().includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [visibleMeetingGroups, queueTab, filterStatus, search]);

  useEffect(() => {
    if (hasAutoOpenedFirstEditableClaim.current || listView !== 'individual' || expandedId) return;
    const firstEditableClaim = dropdownFilteredClaims.find(c => ['submitted', 'verified', 'awaiting_review', 'approved'].includes(String(c.status)));
    if (!firstEditableClaim) return;
    setExpandedId(firstEditableClaim.id);
    hasAutoOpenedFirstEditableClaim.current = true;
  }, [dropdownFilteredClaims, expandedId, listView]);

  const submittedMeetingCount = visibleMeetingGroups.filter(g => g[0]?.status === 'submitted').length;
  const submittedClaims = visibleClaims.filter(c => c.status === 'submitted');
  const submittedTotal = submittedClaims.reduce((a, c) => a + claimTotal(c), 0);
  const verifiedClaims = visibleClaims.filter(c => { const s = c.status as string; return s === 'verified' || s === 'awaiting_review'; });
  const verifiedTotal = verifiedClaims.reduce((a, c) => a + claimTotal(c), 0);
  const paidTotal = visibleClaims.filter(c => c.status === 'paid').reduce((a, c) => a + claimTotal(c), 0);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    visibleClaims.forEach(c => { m[c.status] = (m[c.status] || 0) + 1; });
    return m;
  }, [visibleClaims]);
  const uniqueSubmittedPractices = new Set(submittedClaims.map(c => c.practice_key)).size;

  // Queue tab counts
  const queueCount = visibleClaims.filter(c => c.status === 'submitted').length + submittedMeetingCount;
  const verifiedByMeCount = userEmail
    ? visibleClaims.filter(c => (c.verified_by || '').toLowerCase() === userEmail.toLowerCase()).length
    : verifiedClaims.length;
  const returnedCount = visibleClaims.filter(c => c.status === 'queried' || c.status === 'rejected').length;

  const QUEUE_TABS: { key: QueueTab; label: string; count: number; color: string }[] = [
    { key: 'queue', label: 'Queue', count: queueCount, color: '#0369a1' },
    { key: 'verified_by_me', label: 'Verified by me', count: verifiedByMeCount, color: '#059669' },
    { key: 'returned', label: 'Returned / Queried', count: returnedCount, color: '#d97706' },
    { key: 'all', label: 'All history', count: visibleClaims.length, color: '#6b7280' },
  ];

  const LIST_VIEWS: { key: ListView; label: string }[] = [
    { key: 'by_practice', label: 'By Practice' },
    { key: 'individual', label: 'Individual' },
    { key: 'verification_log', label: 'Verification Log' },
    { key: 'spreadsheet', label: 'Spreadsheet' },
  ];

  // Practice options for the dropdown — derived from visible claims
  const practiceKeys = useMemo(() => {
    const set = new Set(visibleClaims.map(c => c.practice_key).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [visibleClaims]);

  // Practice options for ClaimsViewSwitcher
  const directorPracticeOptions: DirectorPracticeOption[] = practiceKeys.map(k => ({
    key: k,
    name: practiceName(k),
  }));

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', color: '#111827' }}>
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
          <p style={{ margin: '2px 0 0 16px', fontSize: 13, color: '#6b7280' }}>NRES Management View — Verify submitted claims before SNO Finance Director review</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{userName || 'Amanda Palin'}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>Managerial Lead · Verifier</div>
        </div>
      </div>

      {/* Queue alert */}
      {(submittedClaims.length > 0 || submittedMeetingCount > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', marginBottom: 16, borderRadius: 10, background: '#f0f9ff', border: '1px solid #bae6fd', fontSize: 13, color: '#0c4a6e' }}>
          <Shield className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>{submittedClaims.length + submittedMeetingCount} item{(submittedClaims.length + submittedMeetingCount) !== 1 ? 's' : ''} awaiting your verification</strong>
            {submittedClaims.length > 0 && <> — {fmtShort(submittedTotal)} across {uniqueSubmittedPractices} practice{uniqueSubmittedPractices !== 1 ? 's' : ''}</>}
            {submittedMeetingCount > 0 && <> · {submittedMeetingCount} meeting claim{submittedMeetingCount !== 1 ? 's' : ''}</>}
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

      {/* Queue status tabs (with live counts) */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 14, flexWrap: 'wrap' }}>
        {QUEUE_TABS.map(t => {
          const active = queueTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setQueueTab(t.key)}
              style={{
                padding: '8px 14px',
                border: 'none',
                background: 'transparent',
                borderBottom: `2px solid ${active ? t.color : 'transparent'}`,
                color: active ? t.color : '#6b7280',
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: -1,
              }}
            >
              {t.label}
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 20, padding: '1px 7px', borderRadius: 100, fontSize: 10, fontWeight: 700,
                background: active ? t.color : '#e5e7eb',
                color: active ? '#fff' : '#6b7280',
              }}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* Unified filter bar — period buttons (left), view toggles + Export (right) */}
      {/* Uses the shared ClaimsViewSwitcher's own period/view chrome by switching to its 'spreadsheet' default — but we render our own here for tighter integration */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 p-3 rounded-lg border border-border bg-card">
        <div className="flex items-center gap-1 flex-wrap">
          {[
            { key: 'this_month', label: 'This Month' },
            { key: 'last_month', label: 'Last Month' },
            { key: 'ytd', label: 'YTD 26/27' },
            { key: 'all', label: 'All Time' },
          ].map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12,
                fontWeight: period === p.key ? 600 : 500,
                border: `1px solid ${period === p.key ? '#005eb8' : '#e5e7eb'}`,
                background: period === p.key ? '#eff6ff' : '#fff',
                color: period === p.key ? '#005eb8' : '#6b7280',
                cursor: 'pointer',
              }}
            >{p.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {LIST_VIEWS.map(v => {
            const active = listView === v.key;
            return (
              <button
                key={v.key}
                onClick={() => setListView(v.key)}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  border: `1px solid ${active ? '#005eb8' : '#e5e7eb'}`,
                  background: active ? '#eff6ff' : '#fff',
                  color: active ? '#005eb8' : '#6b7280',
                  cursor: 'pointer',
                }}
              >{v.label}</button>
            );
          })}
        </div>
      </div>

      {/* Filter dropdown row — Practice, Category, Status, Route */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div>
          <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Practice</Label>
          <Select value={filterPractice} onValueChange={setFilterPractice}>
            <SelectTrigger className="h-9"><SelectValue placeholder="All practices" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Practices</SelectItem>
              {practiceKeys.map(k => (
                <SelectItem key={k} value={k}>{practiceName(k)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Category</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="buyback">Buy-Back</SelectItem>
              <SelectItem value="gp_locum">GP Locum</SelectItem>
              <SelectItem value="new_sda">New SDA</SelectItem>
              <SelectItem value="management">NRES Management</SelectItem>
              <SelectItem value="meeting">Meeting Attendance</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="submitted">Awaiting Verification</SelectItem>
              <SelectItem value="verified">Awaiting Approval</SelectItem>
              <SelectItem value="approved">Approved – Invoice Pending</SelectItem>
              <SelectItem value="queried">Action Needed – Query Raised</SelectItem>
              <SelectItem value="invoiced">Invoice Issued</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Route</Label>
          <Select value={filterRoute} onValueChange={setFilterRoute}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Routes</SelectItem>
              <SelectItem value="icb">ICB Direct (Buy-Back / SDA / Locum)</SelectItem>
              <SelectItem value="pml">PML Route (Management / Meeting)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* View body */}
      {listView === 'by_practice' && (
        <div style={{ marginBottom: 16 }}>
          <PracticeQueueTable claims={dropdownFilteredClaims} />
        </div>
      )}

      {listView === 'verification_log' && (
        <div style={{ marginBottom: 16 }}>
          <VerificationLogView claims={dropdownFilteredClaims} userEmail={userEmail} />
        </div>
      )}

      {listView === 'spreadsheet' && (
        <div style={{ marginBottom: 16 }}>
          <ClaimsViewSwitcher
            claims={dropdownFilteredClaims}
            practiceKey={filterPractice === 'all' ? '' : filterPractice}
            practiceName={filterPractice === 'all' ? 'All Practices' : practiceName(filterPractice)}
            onToggleCard={(id) => setExpandedId(expandedId === id ? null : id)}
            expandedClaimId={expandedId}
            saving={savingClaim}
            directorMode
            practiceFilter={filterPractice}
            onPracticeFilterChange={setFilterPractice}
            practiceOptions={directorPracticeOptions}
            defaultView="spreadsheet"
            hideSummaryView
            exportVariant="director"
          />
        </div>
      )}

      {listView === 'individual' && (
        <>
          {/* Search */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search practice…"
                style={{ padding: '7px 14px 7px 32px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, width: 220, outline: 'none' }}
              />
            </div>
          </div>

          {/* Claims & Meeting entries list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dropdownFilteredClaims.length === 0 && filteredMeetingGroups.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                No claims match the current filters.
              </div>
            ) : (
              <>
                {dropdownFilteredClaims.map(c => (
                  <VerifierClaimCard
                    key={c.id}
                    claim={c}
                    expanded={expandedId === c.id}
                    onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    onVerify={onVerify}
                    onReturn={onReturnToPractice}
                    onUpdateClaimNotes={onUpdateClaimNotes}
                    saving={savingClaim}
                    profileNames={profileNames}
                  />
                ))}
                {filteredMeetingGroups.map((group) => {
                  const groupKey = `meeting-${group[0]?.person_name}-${group[0]?.claim_month}`;
                  return (
                    <MeetingVerifierCard
                      key={groupKey}
                      entries={group}
                      expanded={expandedId === groupKey}
                      onToggle={() => setExpandedId(expandedId === groupKey ? null : groupKey)}
                      onVerify={onVerifyMeetingEntries || (async () => {})}
                      onReturn={onReturnMeetingEntries || (async () => {})}
                      saving={savingClaim}
                    />
                  );
                })}
              </>
            )}
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{ marginTop: 20, padding: '12px 0', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af' }}>
        <span>NRES Claims Management &amp; Verification — Managerial Lead Verification Queue</span>
        <span>{dropdownFilteredClaims.length + filteredMeetingGroups.length} item{(dropdownFilteredClaims.length + filteredMeetingGroups.length) !== 1 ? 's' : ''} shown</span>
      </div>
    </div>
  );
}
