import React, { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, Eye, AlertTriangle, CheckCircle2, XCircle, Send, Clock, Reply, Plus, User, AlertCircle, Pencil, Trash2, HelpCircle, Settings, Calendar, FileText, Download } from 'lucide-react';
import { getPracticeName, NRES_ODS_CODES, NRES_PRACTICE_CONTACTS } from '@/data/nresPractices';
import type { BuyBackClaim, RateParams } from '@/hooks/useNRESBuyBackClaims';
import type { BuyBackStaffMember } from '@/hooks/useNRESBuyBackStaff';
import type { ManagementRoleConfig } from '@/hooks/useNRESBuyBackRateSettings';
import { calculateStaffMonthlyAmount } from '@/hooks/useNRESBuyBackClaims';
import { InvoiceDownloadLink } from './InvoiceDownloadLink';
import { exportClaimsDetail, exportDirectorClaimsDetail, exportFinanceClaimsDetail } from '@/utils/buybackExcelExport';
import { generateInvoicePdf } from '@/utils/invoicePdfGenerator';
import { useNRESClaimEvidence } from '@/hooks/useNRESClaimEvidence';
import { useNRESEvidenceConfig } from '@/hooks/useNRESEvidenceConfig';
import { StaffLineEvidence, useStaffLineEvidenceComplete } from './ClaimEvidencePanel';
import type { MeetingLogEntry } from '@/hooks/useNRESMeetingLog';
import { getSDAClaimGLCode } from '@/utils/glCodes';

const HOURS_PER_SESSION = 25 / 6;

const isSessionPricedRole = (roleLabel?: string | null, roleConfig?: { allocation_default?: string } | null, annualRate?: number): boolean => {
  if (roleConfig?.allocation_default === 'sessions') return true;
  const role = (roleLabel || '').toLowerCase();
  return role.includes('gp') && !!annualRate && annualRate > 0 && annualRate <= 20000;
};

// --- Types ---
interface BuyBackPracticeDashboardProps {
  claims: BuyBackClaim[];
  practiceKey: string;
  staff: BuyBackStaffMember[];
  staffRoles?: string[];
  rateParams?: RateParams;
  managementRoles?: ManagementRoleConfig[];
  onSubmit?: (id: string, practiceNotes?: string) => void;
  onResubmit?: (id: string, notes?: string) => void;
  onUpdateClaimNotes?: (id: string, notes: string) => Promise<void>;
  onCreateClaim?: (monthDate: string, staffMember: BuyBackStaffMember, claimedAmount?: number, holidayWeeksDeducted?: number) => Promise<any>;
  onAddStaff?: (member: Omit<BuyBackStaffMember, 'id' | 'user_id' | 'practice_id' | 'created_at' | 'updated_at'>) => Promise<any>;
  onRemoveStaff?: (id: string) => Promise<void>;
  onUpdateStaff?: (id: string, updates: Partial<BuyBackStaffMember>) => Promise<any>;
  onCreateLocumClaim?: (monthDate: string, staffMember: BuyBackStaffMember, actualSessions: number, claimedAmount: number) => Promise<any>;
  onDeleteClaim?: (id: string) => Promise<void>;
  confirmDeclaration?: (id: string, confirmed: boolean) => Promise<void>;
  savingClaim?: boolean;
  savingStaff?: boolean;
  onGuideOpen?: () => void;
  onSettingsOpen?: () => void;
  showSettings?: boolean;
  meetingLogEntries?: MeetingLogEntry[];
  onAddMeetingEntry?: (practiceKey: string, roleConfig: ManagementRoleConfig, meetingName: string, meetingDate: string, hours: number) => Promise<void>;
  onDeleteMeetingEntry?: (id: string) => Promise<void>;
  onSubmitMeetingEntries?: (practiceKey: string, claimMonth: string) => Promise<void>;
  canAddOnBehalf?: boolean;
}

// --- Constants ---
const DECLARATION_TEXT = "I confirm that all staff listed are working 100% on SDA (Part A) during their funded hours, with no LTC (Part B) activity, in accordance with the ICB-approved buy-back rules.";
const BUYBACK_DECLARATION_TEXT = "I confirm that the staff listed are existing practice employees released from core practice duties to deliver SDA during the periods claimed. The claimed amount reflects the genuine backfill cost to the practice. I confirm no LTC activity was undertaken during the bought-back sessions and that Part B supporting evidence is attached or will be provided on request.";
const LOCUM_DECLARATION_TEXT = "I confirm this GP locum provided additional sessional SDA capacity. This claim represents the actual cost of sessions worked and does not exceed the ICB-approved maximum reimbursement rate. GP locums are by definition providing Part A SDA additional resource only — there is no LTC (Part B) activity.";
const MANAGEMENT_DECLARATION_TEXT = "I confirm this resource has been assigned to the NRES New Models of Care programme and the claim is aligned to the agreed rates, terms, and on-cost calculations as approved by the ICB.";
const MEETING_DECLARATION_TEXT = "I confirm that the attendance recorded above is accurate and that the meeting(s) listed related to NRES SDA programme business. The amount claimed is based on the ICB-approved rate for this role and the actual hours attended. No other NRES hours are included in this claim.";
const PILOT_START = new Date(2026, 3, 1); // 1 April 2026

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  draft: { label: 'Draft', color: '#6b7280', bg: '#f9fafb', border: '#d1d5db', dot: '#9ca3af' },
  submitted: { label: 'Awaiting Verification', color: '#0369a1', bg: '#f0f9ff', border: '#7dd3fc', dot: '#38bdf8' },
  verified: { label: 'Awaiting Approval', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', dot: '#3b82f6' },
  approved: { label: 'Approved – Invoice Pending', color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', dot: '#8b5cf6' },
  queried: { label: 'Action Needed – Query Raised', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', dot: '#ef4444' },
  paid: { label: 'Paid', color: '#166534', bg: '#f0fdf4', border: '#86efac', dot: '#22c55e' },
  invoiced: { label: 'Invoice Issued', color: '#d97706', bg: '#fffbeb', border: '#fcd34d', dot: '#f59e0b' },
  rejected: { label: 'Rejected', color: '#991b1b', bg: '#fef2f2', border: '#fca5a5', dot: '#dc2626' },
};

export const CATEGORY_COLORS: Record<string, string> = {
  buyback: '#0d9488',
  gp_locum: '#d97706',
  new_sda: '#7c3aed',
  management: '#005eb8',
  meeting: '#0369a1',
};

export const CATEGORY_LABELS: Record<string, string> = {
  buyback: 'Buy-Back',
  gp_locum: 'GP Locum',
  new_sda: 'New SDA',
  management: 'NRES Management',
  meeting: 'Meeting Attendance',
};

export const PERIOD_OPTIONS = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'ytd', label: 'YTD 26/27' },
  { key: 'all', label: 'All Time' },
];

// --- Helpers ---
export function fmtGBP(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmtShort(n: number): string {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 0 });
}

function claimTotal(claim: BuyBackClaim): number {
  const staffDets = (claim.staff_details || []) as any[];
  return staffDets.reduce((sum: number, s: any) => sum + (s.claimed_amount ?? s.calculated_amount ?? 0), 0);
}

function claimHours(claim: BuyBackClaim): number {
  const staffDets = (claim.staff_details || []) as any[];
  return staffDets.reduce((sum: number, s: any) => sum + (s.total_hours ?? s.allocation_value ?? 0), 0);
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

/** Convert an NHS email to a readable name: "andrew.moore@nhs.net" → "Andrew Moore" */
function emailToName(email: string | null | undefined): string {
  if (!email) return '—';
  const local = email.split('@')[0];
  return local.split('.').map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

/** Compute due date: invoice date + 30 days */
function dueDate(invoiceDate: string | null | undefined): string {
  if (!invoiceDate) return '—';
  const d = new Date(invoiceDate);
  d.setDate(d.getDate() + 30);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
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

function getAllocDisplay(allocType: string, allocValue: number): string {
  switch (allocType) {
    case 'sessions': return `${allocValue} sess/mo`;
    case 'wte': return `${allocValue} WTE`;
    case 'hours': return `${allocValue} hrs/wk`;
    case 'daily': return `${allocValue} days/mo`;
    default: return `${allocValue}`;
  }
}

export function getClaimMonths(): { label: string; monthDate: string; month: number; year: number }[] {
  const months: { label: string; monthDate: string; month: number; year: number }[] = [];
  const now = new Date();
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    if (d < PILOT_START) continue;
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    const monthDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    months.push({ label, monthDate, month: d.getMonth(), year: d.getFullYear() });
  }
  return months;
}

/**
 * The default claim month for the Practice Claim UI.
 * On days 1–15 of the calendar month, default to the previous month
 * (because most practices are still claiming for the month just ended).
 * On day 16 onward, default to the current calendar month.
 * Returns "YYYY-MM".
 */
export function getDefaultClaimMonthStr(): string {
  const now = new Date();
  const useLast = now.getDate() <= 15;
  const target = useLast
    ? new Date(now.getFullYear(), now.getMonth() - 1, 1)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
}

function findClaimForStaffMonth(claims: BuyBackClaim[], staffMember: BuyBackStaffMember, monthDate: string): BuyBackClaim | null {
  return claims.find(c => {
    if (c.claim_month.slice(0, 7) !== monthDate.slice(0, 7)) return false;
    const dets = (c.staff_details || []) as any[];
    return dets.some((s: any) => s.staff_name === staffMember.staff_name && s.staff_role === staffMember.staff_role);
  }) || null;
}

// --- Sub-components ---

export function KpiCard({ label, value, sub, accent, tooltip, onClick, active }: { label: string; value: string | number; sub?: string; accent?: string; tooltip?: string; onClick?: () => void; active?: boolean }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{ background: active ? (accent ? `${accent}10` : '#f0f9ff') : '#fff', borderRadius: 10, padding: '10px 12px', border: `1px solid ${active ? accent || '#005eb8' : '#e5e7eb'}`, boxShadow: active ? `0 0 0 1px ${accent || '#005eb8'}` : '0 1px 2px rgba(0,0,0,0.03)', cursor: onClick ? 'pointer' : (tooltip ? 'help' : 'default'), borderLeft: `3px solid ${accent || '#e5e7eb'}`, position: 'relative' as const, transition: 'all 0.15s ease' }}
    >
      <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginBottom: 2, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>{sub}</div>}
      {tooltip && hover && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 6, padding: '8px 12px', borderRadius: 8,
          background: '#1e293b', color: '#fff', fontSize: 11, lineHeight: 1.4,
          whiteSpace: 'normal' as const, width: 200, textAlign: 'center' as const,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 50, pointerEvents: 'none' as const,
        }}>
          {tooltip}
          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #1e293b' }} />
        </div>
      )}
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
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 500,
      background: met ? '#ecfdf5' : '#fef2f2',
      color: met ? '#059669' : '#dc2626',
      border: `1px solid ${met ? '#a7f3d0' : '#fecaca'}`,
    }}>
      {met ? <CheckCircle2 style={{ width: 12, height: 12 }} /> : <XCircle style={{ width: 12, height: 12 }} />}
      {label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 100,
      fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' as const,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

// --- Month Status Cell ---
function MonthStatusCell({
  claim,
  monthDate,
  staffMember,
  onClickClaim,
  activeClaimKey,
  isCurrentMonth,
}: {
  claim: BuyBackClaim | null;
  monthDate: string;
  staffMember: BuyBackStaffMember;
  onClickClaim: (key: string) => void;
  activeClaimKey: string | null;
  isCurrentMonth: boolean;
}) {
  const cellKey = `${staffMember.id}_${monthDate}`;
  const isActive = activeClaimKey === cellKey;

  if (claim) {
    return (
      <td style={{ padding: '8px 6px', textAlign: 'center', verticalAlign: 'middle' }}>
        <button
          onClick={() => onClickClaim(cellKey)}
          style={{
            cursor: 'pointer', border: 'none', background: 'transparent', padding: 0,
            opacity: isActive ? 1 : 0.9,
          }}
        >
          <StatusPill status={claim.status} />
        </button>
      </td>
    );
  }

  // No claim yet — show "Claim" button
  const now = new Date();
  const [y, m] = monthDate.split('-').map(Number);
  const isFuture = y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 1);

  if (isFuture) {
    return (
      <td style={{ padding: '8px 6px', textAlign: 'center', verticalAlign: 'middle' }}>
        <span style={{ fontSize: 11, color: '#d1d5db' }}>—</span>
      </td>
    );
  }

  return (
    <td style={{ padding: '8px 6px', textAlign: 'center', verticalAlign: 'middle' }}>
      <button
        onClick={() => onClickClaim(cellKey)}
        style={{
          padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
          border: `1px solid ${isCurrentMonth ? '#93c5fd' : '#d1d5db'}`,
          background: isCurrentMonth ? '#eff6ff' : '#fff',
          color: isCurrentMonth ? '#2563eb' : '#6b7280',
          cursor: 'pointer', transition: 'all 0.15s',
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}
      >
        <Plus style={{ width: 10, height: 10 }} />
        Claim
      </button>
    </td>
  );
}

// --- Inline Claim Panel ---
function InlineClaimPanel({
  staffMember,
  monthDate,
  monthLabel,
  existingClaim,
  rateParams,
  onCreateClaim,
  onCreateLocumClaim,
  onDeleteClaim,
  onSubmit,
  onResubmit,
  confirmDeclaration,
  onClose,
  saving,
  claimMonths,
  onChangeMonth,
}: {
  staffMember: BuyBackStaffMember;
  monthDate: string;
  monthLabel: string;
  existingClaim: BuyBackClaim | null;
  rateParams?: RateParams;
  onCreateClaim?: (monthDate: string, staffMember: BuyBackStaffMember, claimedAmount?: number, holidayWeeksDeducted?: number) => Promise<any>;
  onCreateLocumClaim?: (monthDate: string, staffMember: BuyBackStaffMember, actualSessions: number, claimedAmount: number) => Promise<any>;
  onDeleteClaim?: (id: string) => Promise<void>;
  onSubmit?: (id: string, practiceNotes?: string) => void;
  onResubmit?: (id: string, notes?: string) => void;
  confirmDeclaration?: (id: string, confirmed: boolean) => Promise<void>;
  onClose: () => void;
  saving?: boolean;
  /** All months selectable from this panel (passed in from the parent table). */
  claimMonths?: { label: string; monthDate: string; month: number; year: number }[];
  /** Switch the panel to a different month for the same staff member. */
  onChangeMonth?: (newMonthDate: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [declared, setDeclared] = useState(false);
  const [queryResponse, setQueryResponse] = useState('');
  const [practiceNotes, setPracticeNotes] = useState('');
  const [localClaim, setLocalClaim] = useState<BuyBackClaim | null>(existingClaim);

  useEffect(() => { setLocalClaim(existingClaim); }, [existingClaim]);
  useEffect(() => { setPracticeNotes((localClaim as any)?.practice_notes || ''); }, [localClaim?.id, (localClaim as any)?.practice_notes]);

  const isLocum = staffMember.staff_category === 'gp_locum';
  const isManagement = staffMember.staff_category === 'management';
  const isMeeting = staffMember.staff_category === 'meeting';

  // Claimed amount state for standard (non-locum, non-meeting) claims
  const [standardClaimedAmount, setStandardClaimedAmount] = useState<number>(0);
  // Holiday weeks deducted for management claims
  const [holidayWeeks, setHolidayWeeks] = useState<number>(0);
  const meetingRate = staffMember.hourly_rate || 0;
  const [meetingHours, setMeetingHours] = useState<number>(0);
  const meetingMaxAmount = useMemo(() => meetingHours * meetingRate, [meetingHours, meetingRate]);
  const configuredSessions = staffMember.allocation_value || 0;
  // Derive the authoritative per-session rate from master settings (rateParams)
  // rather than the potentially stale hourly_rate stored on the staff record.
  // calculateStaffMonthlyAmount with allocation_value:1 gives exactly one session's worth
  // at the current master rate for this role.
  const sessionRate = useMemo(() => {
    if (!isLocum) return staffMember.hourly_rate || 0;
    // Try master settings via role config first
    if (rateParams?.getRoleConfig) {
      const cfg = rateParams.getRoleConfig(staffMember.staff_role);
      if (cfg?.annual_rate && cfg.annual_rate > 0) return cfg.annual_rate;
    }
    // Fall back: derive from calculateStaffMonthlyAmount for 1 unit
    if (rateParams) {
      const oneUnit = calculateStaffMonthlyAmount(
        { ...staffMember, allocation_value: 1 },
        monthDate,
        staffMember.start_date,
        rateParams
      );
      if (oneUnit > 0) return oneUnit;
    }
    // Final fallback to stored rate
    return staffMember.hourly_rate || 0;
  }, [isLocum, staffMember, monthDate, rateParams]);

  const [locumSessions, setLocumSessions] = useState<number>(configuredSessions);
  const [locumClaimAmount, setLocumClaimAmount] = useState<number>(0);
  const [deletingDraft, setDeletingDraft] = useState(false);
  const [locumUnit, setLocumUnit] = useState<'sessions' | 'hours'>('sessions');

  const locumMaxAmount = useMemo(() => locumSessions * sessionRate, [locumSessions, sessionRate]);
  const hourlyRateFromSession = useMemo(() => sessionRate / HOURS_PER_SESSION, [sessionRate]);
  const locumHoursValue = useMemo(() => locumSessions * HOURS_PER_SESSION, [locumSessions]);
  const formatHoursMins = (h: number) => {
    const totalMins = Math.round(h * 60);
    const hh = Math.floor(totalMins / 60);
    const mm = totalMins % 60;
    if (hh && mm) return `${hh}h ${mm}m`;
    if (hh) return `${hh}h`;
    return `${mm}m`;
  };

  useEffect(() => {
    setLocumClaimAmount(prev => {
      if (prev === 0 || prev > locumMaxAmount) return locumMaxAmount;
      return prev;
    });
  }, [locumMaxAmount]);

  const calculatedAmount = useMemo(() => {
    if (!rateParams) return 0;
    return calculateStaffMonthlyAmount(staffMember, monthDate, staffMember.start_date, rateParams, holidayWeeks);
  }, [staffMember, monthDate, rateParams, holidayWeeks]);

  // Sync to calculatedAmount whenever it changes
  useEffect(() => {
    setStandardClaimedAmount(Math.round(calculatedAmount * 100) / 100);
  }, [calculatedAmount]);

  const handleCreateDraft = async () => {
    if (!onCreateClaim || creating) return;
    setCreating(true);
    try {
      const result = await onCreateClaim(monthDate, staffMember);
      if (result) setLocalClaim(result);
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = async () => {
    if (!localClaim || !onSubmit) return;
    if (confirmDeclaration) {
      await confirmDeclaration(localClaim.id, true);
    }
    onSubmit(localClaim.id, practiceNotes.trim() || undefined);
  };

  const handleDeleteDraft = async (requireConfirm = false) => {
    if (!localClaim || !onDeleteClaim) return;
    if (requireConfirm) {
      const confirmed = window.confirm(
        'Are you sure you want to delete this claim?\n\nAll submission data for this claim will be permanently deleted, including any supporting documents and evidence.\n\nThis action cannot be undone.'
      );
      if (!confirmed) return;
    }
    setDeletingDraft(true);
    try {
      await onDeleteClaim(localClaim.id);
      setLocalClaim(null);
      setLocumSessions(configuredSessions);
      setLocumClaimAmount(locumMaxAmount);
      setDeclared(false);
    } finally {
      setDeletingDraft(false);
    }
  };

  const claim = localClaim;
  const isDraft = claim?.status === 'draft';
  const isQueried = claim?.status === 'queried';

  // Evidence hooks — only active when we have a claim
  const claimIdForEvidence = claim?.id || '__none__';
  const staffDets = claim ? ((claim.staff_details || []) as any[]) : [];
  const { uploading, uploadEvidence, deleteEvidence, getDownloadUrl, getUploadedTypesForStaff, getFilesForStaff } = useNRESClaimEvidence(claimIdForEvidence);
  const { getConfigForCategory } = useNRESEvidenceConfig();
  const { allComplete: evidenceComplete, totalMandatory, totalUploaded } = useStaffLineEvidenceComplete(
    staffDets, getUploadedTypesForStaff, getConfigForCategory
  );

  const getCalcBreakdown = () => {
    if (!rateParams) return null;
    const role = staffMember.staff_role;
    const allocType = staffMember.allocation_type;
    const allocValue = staffMember.allocation_value;
    const roleConfig = rateParams.getRoleConfig?.(role);
    const annualRate = rateParams.getRoleAnnualRate?.(role) ?? 0;
    const includesOnCosts = roleConfig?.includes_on_costs !== false;
    const multiplier = includesOnCosts ? (rateParams.onCostMultiplier ?? 1) : 1;
    const niPct = rateParams.employerNiPct ?? 13.8;
    const penPct = rateParams.employerPensionPct ?? 14.38;
    const annualWithOnCosts = annualRate * multiplier;
    const niAmount = annualRate * (niPct / 100);
    const penAmount = annualRate * (penPct / 100);
    const totalOnCostAmount = niAmount + penAmount;

    if (allocType === 'sessions') {
      return {
        primary: [
          { label: `${allocValue} session${allocValue !== 1 ? 's' : ''}`, accent: true },
          { label: '×' },
          { label: `${fmtGBP(annualRate)}/yr`, accent: true },
          { label: '÷' },
          { label: '12 months', accent: true },
          { label: includesOnCosts ? `× ${multiplier.toFixed(4)} on-costs` : '(excl. on-costs)', accent: includesOnCosts },
          { label: '=' },
          { label: `${fmtGBP(calculatedAmount)}/month`, result: true },
        ],
        breakdown: includesOnCosts ? [
          { l: `Base annual salary (${role})`, r: fmtGBP(annualRate) + '/yr' },
          { l: `+ Employer NI (${niPct}%)`, r: fmtGBP(niAmount) + '/yr' },
          { l: `+ Employer Pension (${penPct}%)`, r: fmtGBP(penAmount) + '/yr' },
          { l: 'Total incl. on-costs', r: fmtGBP(annualWithOnCosts) + '/yr', bold: true },
          { l: `Monthly max (× ${allocValue} sess ÷ 12)`, r: fmtGBP(calculatedAmount), bold: true, large: true },
        ] : [
          { l: `${allocValue} session${allocValue !== 1 ? 's' : ''} × ${fmtGBP(annualRate)}/yr ÷ 12`, r: fmtGBP(calculatedAmount) + '/month', bold: true },
        ],
      };
    }

    if (allocType === 'wte') {
      return {
        primary: [
          { label: `${allocValue} WTE`, accent: true },
          { label: '×' },
          { label: `${fmtGBP(annualRate)}/yr`, accent: true },
          { label: includesOnCosts ? `× ${multiplier.toFixed(4)} on-costs` : '(excl. on-costs)', accent: includesOnCosts },
          { label: '÷' },
          { label: '12 months', accent: true },
          { label: '=' },
          { label: `${fmtGBP(calculatedAmount)}/month`, result: true },
        ],
        breakdown: includesOnCosts ? [
          { l: `Base annual salary (${role})`, r: fmtGBP(annualRate) + '/yr' },
          { l: `+ Employer NI (${niPct}%)`, r: fmtGBP(niAmount) + '/yr' },
          { l: `+ Employer Pension (${penPct}%)`, r: fmtGBP(penAmount) + '/yr' },
          { l: 'Total incl. on-costs', r: fmtGBP(annualWithOnCosts) + '/yr', bold: true },
          { l: `Monthly max (${allocValue} WTE × total ÷ 12)`, r: fmtGBP(calculatedAmount), bold: true, large: true },
        ] : null,
      };
    }

    if (allocType === 'hours') {
      const isSessionPriced = isSessionPricedRole(role, roleConfig, annualRate);
      const sessions = allocValue / HOURS_PER_SESSION;
      const wteRatio = allocValue / 37.5;
      return {
        primary: isSessionPriced ? [
          { label: `${allocValue} hrs/wk`, accent: true },
          { label: '÷ 4 hrs 10 mins/session =' },
          { label: `${sessions.toFixed(2)} sess/wk`, accent: true },
          { label: '×' },
          { label: `${fmtGBP(annualRate)}/yr per session`, accent: true },
          { label: includesOnCosts ? `× ${multiplier.toFixed(4)} on-costs` : '', accent: includesOnCosts },
          { label: '÷ 12' },
          { label: '=' },
          { label: `${fmtGBP(calculatedAmount)}/month`, result: true },
        ] : [
          { label: `${allocValue} hrs/wk`, accent: true },
          { label: '÷ 37.5 =' },
          { label: `${wteRatio.toFixed(2)} WTE`, accent: true },
          { label: '×' },
          { label: `${fmtGBP(annualRate)}/yr`, accent: true },
          { label: includesOnCosts ? `× ${multiplier.toFixed(4)} on-costs` : '', accent: includesOnCosts },
          { label: '÷ 12' },
          { label: '=' },
          { label: `${fmtGBP(calculatedAmount)}/month`, result: true },
        ],
        breakdown: includesOnCosts ? [
          { l: `Base annual rate (${role}${isSessionPriced ? ', per session/yr' : ''})`, r: fmtGBP(annualRate) + '/yr' },
          { l: `+ Employer NI (${niPct}%)`, r: fmtGBP(niAmount) + '/yr' },
          { l: `+ Employer Pension (${penPct}%)`, r: fmtGBP(penAmount) + '/yr' },
          { l: 'Total incl. on-costs', r: fmtGBP(annualWithOnCosts) + '/yr', bold: true },
          { l: isSessionPriced
              ? `Monthly max (${sessions.toFixed(2)} sess × total ÷ 12)`
              : `Monthly max (${wteRatio.toFixed(2)} WTE × total ÷ 12)`,
            r: fmtGBP(calculatedAmount), bold: true, large: true },
        ] : null,
      };
    }

    return null;
  };

  const calcBreakdownData = (!isLocum && !isMeeting) ? getCalcBreakdown() : null;
  const catAccentColor = CATEGORY_COLORS[staffMember.staff_category] || '#7c3aed';

  return (
    <tr>
      <td colSpan={6} style={{ padding: 0 }}>
        <div style={{
          margin: '0 12px 10px', padding: '16px 18px', borderRadius: 10,
          background: '#fafbfc', border: '1px solid #e5e7eb',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          {/* Header — clear claim context */}
          {(() => {
            // Full month name from monthDate ("2026-04-01" → "April 2026")
            const fullMonth = new Date(monthDate + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
            const practiceName = staffMember.practice_key ? getPracticeName(staffMember.practice_key) : null;
            const fyYear = (() => {
              const d = new Date(monthDate + 'T12:00:00');
              const m = d.getMonth(); // 0-indexed
              const y = d.getFullYear();
              return m >= 3 ? `${y}/${String(y+1).slice(2)}` : `${y-1}/${String(y).slice(2)}`;
            })();
            // Category accent colour matching the section
            const catColor = CATEGORY_COLORS[staffMember.staff_category] || '#6b7280';
            const catLabel = CATEGORY_LABELS[staffMember.staff_category] || staffMember.staff_category;
            // Current claim status for the badge
            const currentStatus = existingClaim?.status || 'new';
            const statusLabel = currentStatus === 'new' ? 'Not yet claimed'
              : currentStatus === 'draft' ? 'Draft'
              : currentStatus === 'submitted' ? 'Awaiting Verification'
              : currentStatus === 'verified' ? 'Awaiting Approval'
              : currentStatus === 'approved' ? 'Approved – Invoice Pending'
              : currentStatus === 'queried' ? 'Action Needed – Query Raised'
              : currentStatus === 'invoiced' ? 'Invoice Issued'
              : currentStatus === 'paid' ? 'Paid'
              : currentStatus;
            return (
              <div style={{
                background: '#fff',
                borderRadius: 10,
                border: `1px solid ${catColor}30`,
                borderLeft: `4px solid ${catColor}`,
                padding: '14px 16px',
                marginBottom: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                  <div>
                    {/* Month prominently */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' as const }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>
                        {fullMonth}
                      </div>
                      {onChangeMonth && (() => {
                        // Build a broader month list specifically for the dropdown so
                        // users can switch claim month even when the table only shows
                        // a single column (e.g. early in the pilot).
                        const today = new Date();
                        const currentYM = today.getFullYear() * 100 + (today.getMonth() + 1);
                        const optionMap = new Map<string, { monthDate: string; year: number; month: number }>();
                        // Walk from pilot start up to one month past today (for forward visibility),
                        // capped at 36 months to avoid runaway lists.
                        const start = new Date(PILOT_START.getFullYear(), PILOT_START.getMonth(), 1);
                        const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
                        const cursor = new Date(start);
                        let safety = 0;
                        while (cursor <= end && safety < 36) {
                          const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-01`;
                          optionMap.set(key, { monthDate: key, year: cursor.getFullYear(), month: cursor.getMonth() });
                          cursor.setMonth(cursor.getMonth() + 1);
                          safety++;
                        }
                        // Make sure the currently-open month is selectable even if outside the window.
                        if (!optionMap.has(monthDate)) {
                          const [y, m] = monthDate.split('-').map(Number);
                          optionMap.set(monthDate, { monthDate, year: y, month: m - 1 });
                        }
                        // Also fold in any months from the parent table list (defensive).
                        (claimMonths || []).forEach(cm => {
                          if (!optionMap.has(cm.monthDate)) optionMap.set(cm.monthDate, cm);
                        });
                        const options = Array.from(optionMap.values()).sort((a, b) =>
                          a.monthDate < b.monthDate ? -1 : a.monthDate > b.monthDate ? 1 : 0
                        );
                        if (options.length < 2) return null;
                        return (
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
                            <span>Change month:</span>
                            <select
                              value={monthDate}
                              onChange={(e) => {
                                const next = e.target.value;
                                if (next && next !== monthDate) onChangeMonth(next);
                              }}
                              style={{
                                padding: '3px 8px',
                                borderRadius: 6,
                                border: '1px solid #d1d5db',
                                background: '#fff',
                                fontSize: 12,
                                color: '#111827',
                                fontWeight: 500,
                                cursor: 'pointer',
                              }}
                            >
                              {options.map(cm => {
                                const cmYM = cm.year * 100 + (cm.month + 1);
                                const isFuture = cmYM > currentYM;
                                const fullCm = new Date(cm.monthDate + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                                return (
                                  <option key={cm.monthDate} value={cm.monthDate} disabled={isFuture}>
                                    {fullCm}{isFuture ? ' (future)' : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </label>
                        );
                      })()}
                    </div>
                    {/* Category + status pills */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 100,
                        background: `${catColor}15`, color: catColor, border: `1px solid ${catColor}30`,
                      }}>
                        {catLabel}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 500, padding: '2px 9px', borderRadius: 100,
                        background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb',
                      }}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    style={{
                      padding: '5px 12px', borderRadius: 7, border: '1px solid #d1d5db',
                      background: '#fff', fontSize: 11, color: '#6b7280',
                      cursor: 'pointer', fontWeight: 500, flexShrink: 0,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    ✕ Close
                  </button>
                </div>
                {/* Context rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 12, flexWrap: 'wrap' }}>
                    <span style={{ color: '#9ca3af', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 54, flexShrink: 0 }}>Staff</span>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{staffMember.staff_name}</span>
                    <span style={{ color: '#9ca3af' }}>·</span>
                    <span style={{ color: '#6b7280' }}>{staffMember.staff_role}</span>
                    <span style={{ color: '#9ca3af' }}>·</span>
                    <span style={{ color: '#6b7280' }}>{getAllocDisplay(staffMember.allocation_type, staffMember.allocation_value)}</span>
                    {(() => {
                      const annualRate = rateParams?.getRoleAnnualRate?.(staffMember.staff_role) ?? 0;
                      const roleConfig = rateParams?.getRoleConfig?.(staffMember.staff_role);
                      const isSessionPriced = isSessionPricedRole(staffMember.staff_role, roleConfig, annualRate);
                      if (!annualRate || isLocum || isMeeting) return null;
                      return (
                        <>
                          <span style={{ color: '#9ca3af' }}>·</span>
                          <span style={{ color: '#374151', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {fmtGBP(annualRate)}/yr
                          </span>
                          <span style={{ color: '#9ca3af', fontSize: 11 }}>{isSessionPriced ? '(per session/year)' : '(WTE rate)'}</span>
                        </>
                      );
                    })()}
                  </div>
                  {practiceName && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 12 }}>
                      <span style={{ color: '#9ca3af', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 54, flexShrink: 0 }}>Practice</span>
                      <span style={{ fontWeight: 500, color: '#005eb8' }}>{practiceName}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 12 }}>
                    <span style={{ color: '#9ca3af', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 54, flexShrink: 0 }}>Period</span>
                    <span style={{ color: '#6b7280' }}>{fullMonth} — NRES SDA Programme {fyYear}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* No claim yet — create draft */}
          {!claim && (
            <div>
              {isLocum ? (
                /* ── Locum: sessions + amount entry ── */
                <div>
                  {/* Step 1: Actual sessions or hours */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                        Step 1 — Actual locum work this month
                      </div>
                      <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: 6, padding: 2, border: '1px solid #e5e7eb' }}>
                        {(['sessions', 'hours'] as const).map(u => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setLocumUnit(u)}
                            style={{
                              padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer',
                              fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
                              background: locumUnit === u ? '#fff' : 'transparent',
                              color: locumUnit === u ? '#111827' : '#6b7280',
                              boxShadow: locumUnit === u ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                            }}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                        {locumUnit === 'sessions' ? (
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={locumSessions}
                            onChange={e => setLocumSessions(Math.max(0, Number(e.target.value)))}
                            style={{
                              width: 72, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db',
                              fontSize: 18, fontWeight: 700, textAlign: 'center', outline: 'none',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          />
                        ) : (
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            value={Number(locumHoursValue.toFixed(2))}
                            onChange={e => {
                              const hrs = Math.max(0, Number(e.target.value));
                              setLocumSessions(hrs / HOURS_PER_SESSION);
                            }}
                            style={{
                              width: 84, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db',
                              fontSize: 18, fontWeight: 700, textAlign: 'center', outline: 'none',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          />
                        )}
                        <span style={{ fontSize: 13, color: '#6b7280' }}>{locumUnit}</span>
                        {sessionRate > 0 && (
                          <>
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>×</span>
                            <span style={{ fontSize: 13, color: '#6b7280' }}>
                              {locumUnit === 'sessions'
                                ? `${fmtGBP(sessionRate)}/session`
                                : `${fmtGBP(hourlyRateFromSession)}/hour`}
                            </span>
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>=</span>
                            <span style={{ fontSize: 16, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                              max {fmtGBP(locumMaxAmount)}
                            </span>
                          </>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>
                        {locumUnit === 'sessions'
                          ? `(= ${formatHoursMins(locumHoursValue)} equivalent)`
                          : `(= ${locumSessions.toFixed(2)} sessions equivalent)`}
                      </span>
                      {configuredSessions > 0 && locumSessions !== configuredSessions && (
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>
                          (configured: {configuredSessions} sess/mo)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                      1 session = 4h 10m. The maximum claimable is the same whether you enter sessions or hours.
                    </div>
                  </div>
                  {/* Step 2: Actual claim amount */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                      Step 2 — Actual invoice amount to claim
                    </div>
                    <div style={{ background: '#fff', padding: '12px 14px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 16, color: '#374151', fontWeight: 500 }}>£</span>
                          <input
                            type="number"
                            min="0"
                            max={locumMaxAmount}
                            step="0.01"
                            value={locumClaimAmount}
                            onChange={e => {
                              const v = Math.min(Number(e.target.value), locumMaxAmount);
                              setLocumClaimAmount(Math.max(0, v));
                            }}
                            style={{
                              width: 110, padding: '7px 10px', borderRadius: 7,
                              border: `1px solid ${locumClaimAmount >= locumMaxAmount ? '#d97706' : '#d1d5db'}`,
                              fontSize: 18, fontWeight: 700, textAlign: 'right',
                              outline: 'none', fontVariantNumeric: 'tabular-nums',
                            }}
                          />
                        </div>
                        <button
                          onClick={() => setLocumClaimAmount(locumMaxAmount)}
                          style={{
                            padding: '6px 12px', borderRadius: 6,
                            border: '1px solid #d97706', background: '#fffbeb',
                            color: '#92400e', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          Use max ({fmtGBP(locumMaxAmount)})
                        </button>
                        {locumClaimAmount < locumMaxAmount && locumClaimAmount > 0 && (
                          <span style={{ fontSize: 11, color: '#059669', fontWeight: 500 }}>
                            £{(locumMaxAmount - locumClaimAmount).toFixed(2)} below max
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
                        Max claimable is {fmtGBP(locumMaxAmount)} — enter the actual locum invoice amount. You cannot claim above the ICB-approved maximum rate.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!onCreateLocumClaim || creating || locumSessions <= 0 || locumClaimAmount <= 0) return;
                      setCreating(true);
                      try {
                        const enrichedStaff = { ...staffMember, entry_unit: locumUnit, entered_value: locumUnit === 'sessions' ? locumSessions : Number(locumHoursValue.toFixed(2)) };
                        const result = await onCreateLocumClaim(monthDate, enrichedStaff, locumSessions, locumClaimAmount);
                        if (result) setLocalClaim(result);
                      } finally {
                        setCreating(false);
                      }
                    }}
                    disabled={creating || saving || locumSessions <= 0 || locumClaimAmount <= 0}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px',
                      borderRadius: 8, border: 'none', background: '#005eb8', color: '#fff',
                      fontSize: 13, fontWeight: 600,
                      cursor: creating || locumSessions <= 0 || locumClaimAmount <= 0 ? 'not-allowed' : 'pointer',
                      opacity: creating || locumSessions <= 0 || locumClaimAmount <= 0 ? 0.55 : 1,
                    }}
                  >
                    {creating ? 'Creating…' : 'Create Draft'}
                  </button>
                </div>
              ) : (
                /* ── Standard: show calculated amount ── */
                <div>
                  {/* Amount header */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Maximum claimable</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtGBP(calculatedAmount)}
                    </div>
                  </div>

                  {/* Management breakdown (existing rich rows) */}
                  {(staffMember.staff_category === 'management' || staffMember.staff_role === 'NRES Management') && (rateParams?.rawWorkingWeeksInMonth || rateParams?.workingWeeksInMonth) && staffMember.hourly_rate ? (() => {
                    const rawWw = rateParams.rawWorkingWeeksInMonth ?? rateParams.workingWeeksInMonth!;
                    const effectiveWw = Math.max(0, rawWw - holidayWeeks);
                    const baseRate = staffMember.hourly_rate;
                    const multiplier = rateParams.onCostMultiplier ?? 1;
                    const effectiveRate = baseRate * multiplier;
                    const weeklyHours = staffMember.allocation_value;
                    const niPct = rateParams.employerNiPct ?? 13.8;
                    const penPct = rateParams.employerPensionPct ?? 14.38;
                    const fullMonth = new Date(monthDate + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                    return (
                      <div style={{ marginBottom: 12 }}>
                        {/* Holiday selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 12px', background: '#f0fdf4', borderRadius: 7, border: '1px solid #bbf7d0' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>Holiday taken this month</span>
                          <select
                            value={holidayWeeks}
                            onChange={e => setHolidayWeeks(Number(e.target.value))}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #86efac', fontSize: 13, fontWeight: 600, background: '#fff', color: '#15803d', cursor: 'pointer' }}
                          >
                            {[0, 0.5, 1, 1.5, 2].map(v => (
                              <option key={v} value={v}>{v === 0 ? 'None' : `${v} week${v > 1 ? 's' : ''}`}</option>
                            ))}
                          </select>
                          {holidayWeeks > 0 && (
                            <span style={{ fontSize: 11, color: '#059669', fontWeight: 500 }}>
                              ({rawWw.toFixed(1)} less {holidayWeeks} wk holiday = {effectiveWw.toFixed(1)} weeks)
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, marginBottom: 8, fontSize: 13 }}>
                          <span style={{ fontWeight: 700, color: '#005eb8' }}>{weeklyHours} hrs/wk</span>
                          <span style={{ color: '#9ca3af', fontSize: 11 }}>×</span>
                          <span style={{ fontWeight: 700, color: '#005eb8' }}>
                            {effectiveWw.toFixed(1)} weeks in {fullMonth}
                            {holidayWeeks > 0 && <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 11 }}> ({rawWw.toFixed(1)} − {holidayWeeks} hol)</span>}
                          </span>
                          <span style={{ color: '#9ca3af', fontSize: 11 }}>×</span>
                          <span style={{ fontWeight: 700, color: '#005eb8' }}>{fmtGBP(baseRate)}/hr</span>
                          <span style={{ color: '#9ca3af', fontSize: 11 }}>=</span>
                          <span style={{ fontWeight: 700, color: '#111827', borderLeft: '2px solid #005eb8', paddingLeft: 8, fontSize: 14 }}>{fmtGBP(calculatedAmount)}</span>
                        </div>
                      </div>
                    );
                  })() : calcBreakdownData ? (
                    /* SDA / Buy-Back breakdown */
                    <div style={{ marginBottom: 12 }}>
                      {/* Primary formula row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' as const, fontSize: 12, marginBottom: 8 }}>
                        {calcBreakdownData.primary.map((item, i) => (
                          item.label ? (
                            <span key={i} style={{
                              fontWeight: item.result ? 700 : item.accent ? 700 : 400,
                              color: item.result ? '#111827' : item.accent ? catAccentColor : '#9ca3af',
                              borderLeft: item.result ? `2px solid ${catAccentColor}` : 'none',
                              paddingLeft: item.result ? 7 : 0,
                              fontSize: item.result ? 13 : 12,
                            }}>{item.label}</span>
                          ) : null
                        ))}
                      </div>
                      {/* On-costs breakdown box */}
                      {calcBreakdownData.breakdown && (
                        <div style={{ background: `${catAccentColor}08`, border: `1px solid ${catAccentColor}20`, borderRadius: 8, padding: '10px 12px', fontSize: 11 }}>
                          {calcBreakdownData.breakdown.map((row, i) => (
                            <div key={i} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                              padding: '2px 0',
                              borderTop: row.bold ? `1px solid ${catAccentColor}20` : 'none',
                              marginTop: row.bold ? 4 : 0,
                              paddingTop: row.bold ? 5 : 2,
                            }}>
                              <span style={{ color: '#6b7280' }}>{row.l}</span>
                              <span style={{ fontWeight: row.bold ? 700 : 500, color: row.bold ? catAccentColor : '#374151', fontSize: row.large ? 13 : 11 }}>{row.r}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>
                      Based on {getAllocDisplay(staffMember.allocation_type, staffMember.allocation_value)} allocation
                    </div>
                  )}

                  {/* Actual claimed amount input — for all non-management categories */}
                  {staffMember.staff_category !== 'management' && staffMember.staff_role !== 'NRES Management' && calculatedAmount > 0 && (
                    <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Amount to claim this month</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' as const }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 15, color: '#374151', fontWeight: 500 }}>£</span>
                          <input
                            type="number"
                            min="0"
                            max={calculatedAmount}
                            step="0.01"
                            value={standardClaimedAmount}
                            onChange={e => {
                              const v = Math.round(Math.min(Number(e.target.value), calculatedAmount) * 100) / 100;
                              setStandardClaimedAmount(Math.max(0, v));
                            }}
                            style={{
                              width: 120, padding: '7px 10px', borderRadius: 7,
                              border: `1px solid ${standardClaimedAmount < calculatedAmount && standardClaimedAmount > 0 ? '#d1d5db' : catAccentColor + '60'}`,
                              fontSize: 18, fontWeight: 700, textAlign: 'right',
                              outline: 'none', fontVariantNumeric: 'tabular-nums',
                            }}
                          />
                        </div>
                        {standardClaimedAmount < calculatedAmount && (
                          <button
                            onClick={() => setStandardClaimedAmount(Math.round(calculatedAmount * 100) / 100)}
                            style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${catAccentColor}40`, background: `${catAccentColor}08`, color: catAccentColor, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Use max ({fmtGBP(calculatedAmount)})
                          </button>
                        )}
                        {standardClaimedAmount < calculatedAmount && standardClaimedAmount > 0 && (
                          <span style={{ fontSize: 11, color: '#059669', fontWeight: 500 }}>
                            {fmtGBP(calculatedAmount - standardClaimedAmount)} below max
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 10, color: '#9ca3af', margin: 0 }}>
                        Maximum claimable is {fmtGBP(calculatedAmount)}. Enter a lower amount if your actual staff cost is less this month.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={async () => {
                      if (!onCreateClaim || creating) return;
                      setCreating(true);
                      try {
                        const amountToUse = (staffMember.staff_category !== 'management' && staffMember.staff_role !== 'NRES Management')
                          ? (standardClaimedAmount > 0 ? standardClaimedAmount : calculatedAmount)
                          : calculatedAmount;
                        const holWeeks = (staffMember.staff_category === 'management' || staffMember.staff_role === 'NRES Management') ? holidayWeeks : 0;
                        const result = await onCreateClaim(monthDate, staffMember, amountToUse, holWeeks);
                        if (result) setLocalClaim(result);
                      } finally {
                        setCreating(false);
                      }
                    }}
                    disabled={creating || saving}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px',
                      borderRadius: 8, border: 'none', background: '#005eb8', color: '#fff',
                      fontSize: 13, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer',
                      opacity: creating ? 0.6 : 1,
                    }}
                  >
                    {creating ? 'Creating…' : 'Create Draft'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Draft — evidence + declare + submit */}
          {isDraft && claim && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>
                    {isLocum ? 'Claiming' : 'Claim Amount'}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtGBP(claimTotal(claim))}
                  </div>
                  {isLocum && sessionRate > 0 && (
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                      {(claim.staff_details as any[])?.[0]?.allocation_value || locumSessions} sessions · max {fmtGBP(((claim.staff_details as any[])?.[0]?.allocation_value || locumSessions) * sessionRate)}
                    </div>
                  )}
                  {isManagement && staffMember.hourly_rate && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6, padding: '6px 10px', background: '#f8fafc', borderRadius: 6, border: '1px solid #f1f5f9' }}>
                      Hourly rate: <strong>{fmtGBP(staffMember.hourly_rate)}/hr</strong> (inclusive of on-costs — employer NI &amp; pension already included)
                    </div>
                  )}
                </div>
                <StatusPill status="draft" />
              </div>

              {/* Evidence */}
              <div style={{ marginBottom: 12 }}>
                {isLocum && (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '10px 12px', marginBottom: 8,
                    background: '#fff7ed', border: '1px solid #fed7aa',
                    borderRadius: 8, fontSize: 12, color: '#9a3412', lineHeight: 1.45,
                  }}>
                    <span style={{ fontSize: 14, lineHeight: 1 }}>📎</span>
                    <span>
                      <strong>Please add evidence of all session dates and times worked by the GP Locum</strong> to the claim supporting information (e.g. locum invoice or timesheet showing dates, sessions and rate).
                    </span>
                  </div>
                )}
                {staffDets.map((s: any, idx: number) => (
                  <StaffLineEvidence
                    key={idx}
                    staffCategory={(s.staff_category || 'buyback') as 'buyback' | 'new_sda' | 'management' | 'gp_locum'}
                    staffIndex={idx}
                    staffName={s.staff_name}
                    staffRole={s.staff_role}
                    uploadedTypesForStaff={getUploadedTypesForStaff(idx)}
                    allFilesForStaff={getFilesForStaff(idx)}
                    canEdit
                    uploading={uploading}
                    onUpload={uploadEvidence}
                    onDelete={deleteEvidence}
                    onDownload={getDownloadUrl}
                  />
                ))}
              </div>

              {/* Invoice description / claim details */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Invoice description / claim details <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional — printed on the invoice)</span>
                </label>
                <textarea
                  value={practiceNotes}
                  onChange={(e) => setPracticeNotes(e.target.value)}
                  placeholder="Add dates, times or notes to print on the invoice, e.g. 03/04/2026 10:00–12:00 Programme planning meeting."
                  maxLength={1500}
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
                    fontSize: 13, color: '#374151', resize: 'vertical', fontFamily: 'inherit',
                    background: '#ffffff',
                  }}
                />
                {practiceNotes.length > 0 && (
                  <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'right', marginTop: 2 }}>{practiceNotes.length}/1500</div>
                )}
              </div>

              {/* Declaration */}
              <div style={{
                padding: '12px 14px', borderRadius: 8, marginBottom: 12,
                background: declared ? '#f0fdf4' : '#fafafa',
                border: `1px solid ${declared ? '#bbf7d0' : '#e5e7eb'}`,
                transition: 'all 0.2s',
              }}>
                <label style={{ display: 'flex', gap: 10, cursor: 'pointer', fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                  <input
                    type="checkbox"
                    checked={declared}
                    onChange={(e) => setDeclared(e.target.checked)}
                    style={{ marginTop: 2, accentColor: '#005eb8' }}
                  />
                  <span>{isLocum ? LOCUM_DECLARATION_TEXT : isMeeting ? MEETING_DECLARATION_TEXT : isManagement ? MANAGEMENT_DECLARATION_TEXT : staffMember.staff_category === 'buyback' ? BUYBACK_DECLARATION_TEXT : DECLARATION_TEXT}</span>
                </label>
              </div>

              {/* Submit */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {!evidenceComplete && (
                    <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 500 }}>
                      Evidence: {totalUploaded}/{totalMandatory} uploaded
                    </span>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={saving || !declared || !evidenceComplete}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px',
                      borderRadius: 8, border: 'none',
                      background: (saving || !declared || !evidenceComplete) ? '#94a3b8' : '#005eb8',
                      color: '#fff', fontSize: 13, fontWeight: 600,
                      cursor: (saving || !declared || !evidenceComplete) ? 'not-allowed' : 'pointer',
                      opacity: (saving || !declared || !evidenceComplete) ? 0.6 : 1,
                    }}
                  >
                    <Send style={{ width: 14, height: 14 }} />
                    Submit Claim →
                  </button>
                </div>
                {onDeleteClaim && (
                  <button
                    onClick={() => handleDeleteDraft(false)}
                    disabled={deletingDraft}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px',
                      borderRadius: 7, border: '1px solid #fca5a5', background: '#fff',
                      color: '#dc2626', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      opacity: deletingDraft ? 0.5 : 1,
                    }}
                  >
                    <Trash2 style={{ width: 12, height: 12 }} />
                    {deletingDraft ? 'Deleting…' : 'Delete Draft'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Queried — respond */}
          {isQueried && claim && (
            <div>
              {claim.query_notes && (
                <div style={{
                  padding: '12px 14px', borderRadius: 8, marginBottom: 12,
                  background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13,
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <AlertTriangle style={{ width: 14, height: 14 }} /> Query from {(claim as any).queried_by_role || 'Reviewer'}{(claim as any).queried_by ? ` (${(claim as any).queried_by})` : ''}
                    {(claim as any).queried_at && (
                      <span style={{ fontWeight: 400, fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>
                        {format(new Date((claim as any).queried_at), 'd MMM yyyy, HH:mm')}
                      </span>
                    )}
                  </div>
                  {claim.query_notes.replace(/\n?\n?\[FLAGGED_LINES:\[[\d,]*\]\]/, '')}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
                <input
                  type="text"
                  value={queryResponse}
                  onChange={(e) => setQueryResponse(e.target.value)}
                  placeholder={`Your response to the ${(claim as any).queried_by_role || 'Reviewer'} query…`}
                  style={{
                    flex: 1, minWidth: 220, padding: '8px 12px', borderRadius: 8,
                    border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
                  }}
                />
                <button
                  onClick={() => { onResubmit?.(claim.id, queryResponse); setQueryResponse(''); }}
                  disabled={saving}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 16px',
                    borderRadius: 8, border: 'none', background: '#059669', color: '#fff',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Reply style={{ width: 14, height: 14 }} />
                  Resubmit
                </button>
                  {onDeleteClaim && (
                    <button
                      onClick={() => handleDeleteDraft(true)}
                      disabled={deletingDraft}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px',
                        borderRadius: 7, border: '1px solid #fca5a5', background: '#fff',
                        color: '#dc2626', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        opacity: deletingDraft ? 0.5 : 1,
                      }}
                    >
                      <Trash2 style={{ width: 12, height: 12 }} />
                      {deletingDraft ? 'Deleting…' : 'Delete & Restart'}
                    </button>
                  )}
              </div>
            </div>
          )}

          {/* Submitted/verified/approved/paid/invoiced — rich panel for invoiced/paid, simple for earlier statuses */}
          {claim && !isDraft && !isQueried && (() => {
            const isInvoicedOrPaid = claim.status === 'invoiced' || claim.status === 'paid';
            const isPaid = claim.status === 'paid';

            if (!isInvoicedOrPaid) {
              // Simple view for submitted/verified/approved
              const claimedAmt = claimTotal(claim);
              const maxAmt = isLocum ? locumMaxAmount : (isMeeting ? meetingMaxAmount : calculatedAmount);
              const belowMax = maxAmt > 0 && claimedAmt < maxAmt ? maxAmt - claimedAmt : 0;
              return (
                <div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Claim Amount</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtGBP(claimedAmt)}
                      </div>
                    </div>
                    <StatusPill status={claim.status} />
                  </div>

                  {/* Calculation breakdown */}
                  {maxAmt > 0 && (
                    <div style={{ marginTop: 10, padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 8 }}>
                        Claim Calculation
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: '#6b7280' }}>Max claimable:</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmtGBP(maxAmt)}</span>
                      </div>
                      {belowMax > 0 && (
                        <div style={{ fontSize: 11, color: '#059669', fontWeight: 500, marginBottom: 6 }}>
                          Practice claimed {fmtGBP(claimedAmt)} — {fmtGBP(belowMax)} below maximum
                        </div>
                      )}
                      {/* Locum breakdown */}
                      {isLocum && sessionRate > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' as const, fontSize: 12, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, color: catAccentColor }}>{configuredSessions} session{configuredSessions !== 1 ? 's' : ''}</span>
                          <span style={{ color: '#9ca3af' }}>×</span>
                          <span style={{ fontWeight: 600, color: catAccentColor }}>{fmtGBP(sessionRate)}/session</span>
                          <span style={{ color: '#9ca3af' }}>=</span>
                          <span style={{ fontWeight: 700, color: '#111827' }}>{fmtGBP(maxAmt)}</span>
                        </div>
                      )}
                      {/* Management breakdown */}
                      {!isLocum && !isMeeting && (staffMember.staff_category === 'management' || staffMember.staff_role === 'NRES Management') && rateParams?.workingWeeksInMonth && staffMember.hourly_rate ? (() => {
                        const ww = rateParams.workingWeeksInMonth!;
                        const baseRate = staffMember.hourly_rate;
                        const multiplier = rateParams.onCostMultiplier ?? 1;
                        const effectiveRate = baseRate * multiplier;
                        const weeklyHours = staffMember.allocation_value;
                        const niPct = rateParams.employerNiPct ?? 13.8;
                        const penPct = rateParams.employerPensionPct ?? 14.38;
                        return (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' as const, fontSize: 12, marginBottom: 4 }}>
                              <span style={{ fontWeight: 600, color: '#005eb8' }}>{weeklyHours} hrs/wk</span>
                              <span style={{ color: '#9ca3af' }}>×</span>
                              <span style={{ fontWeight: 600, color: '#005eb8' }}>{ww.toFixed(1)} weeks</span>
                              <span style={{ color: '#9ca3af' }}>×</span>
                              <span style={{ fontWeight: 600, color: '#005eb8' }}>{fmtGBP(effectiveRate)}/hr</span>
                              <span style={{ color: '#9ca3af', fontSize: 10 }}>(incl. on-costs)</span>
                              <span style={{ color: '#9ca3af' }}>=</span>
                              <span style={{ fontWeight: 700, color: '#111827' }}>{fmtGBP(maxAmt)}</span>
                            </div>
                          </div>
                        );
                      })() : null}
                      {/* Standard (SDA/Buy-Back) formula + on-costs */}
                      {!isLocum && !isMeeting && calcBreakdownData && !(staffMember.staff_category === 'management' || staffMember.staff_role === 'NRES Management') && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' as const, fontSize: 12, marginBottom: 6 }}>
                            {calcBreakdownData.primary.map((item, i) => (
                              item.label ? (
                                <span key={i} style={{
                                  fontWeight: item.result ? 700 : item.accent ? 700 : 400,
                                  color: item.result ? '#111827' : item.accent ? catAccentColor : '#9ca3af',
                                  borderLeft: item.result ? `2px solid ${catAccentColor}` : 'none',
                                  paddingLeft: item.result ? 6 : 0,
                                  fontSize: item.result ? 13 : 12,
                                }}>{item.label}</span>
                              ) : null
                            ))}
                          </div>
                          {calcBreakdownData.breakdown && (
                            <div style={{ background: `${catAccentColor}08`, border: `1px solid ${catAccentColor}20`, borderRadius: 7, padding: '8px 10px', fontSize: 11 }}>
                              {calcBreakdownData.breakdown.map((row, i) => (
                                <div key={i} style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                                  padding: '2px 0',
                                  borderTop: row.bold ? `1px solid ${catAccentColor}20` : 'none',
                                  marginTop: row.bold ? 3 : 0,
                                  paddingTop: row.bold ? 4 : 2,
                                }}>
                                  <span style={{ color: '#6b7280' }}>{row.l}</span>
                                  <span style={{ fontWeight: row.bold ? 700 : 500, color: row.bold ? catAccentColor : '#374151', fontSize: row.large ? 13 : 11 }}>{row.r}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Meeting breakdown */}
                      {isMeeting && meetingRate > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' as const, fontSize: 12 }}>
                          <span style={{ fontWeight: 600, color: catAccentColor }}>{fmtGBP(meetingRate)}/hr</span>
                          <span style={{ color: '#9ca3af', fontSize: 10 }}>meeting attendance rate</span>
                        </div>
                      )}
                      {/* What this covers */}
                      <div style={{ marginTop: 6, fontSize: 10, color: '#9ca3af' }}>
                        {staffMember.staff_role} · {getAllocDisplay(staffMember.allocation_type, staffMember.allocation_value)}
                        {staffMember.staff_category && ` · ${CATEGORY_LABELS[staffMember.staff_category] || staffMember.staff_category}`}
                      </div>
                    </div>
                  )}

                  {claim.submitted_at && <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>Submitted by {(claim as any).submitted_by_name || emailToName(claim.submitted_by_email || '') || 'Practice'} · {dateStr(claim.submitted_at)}</div>}
                </div>
              );
            }

            // Build audit timeline for paid status
            const trail: { label: string; detail?: string; time?: string | null; color?: string }[] = [];
            if (claim.submitted_at) trail.push({ label: `Submitted by ${(claim as any).submitted_by_name || emailToName(claim.submitted_by_email || '') || 'practice'}`, time: claim.submitted_at, color: '#6b7280' });
            if (claim.verified_by) trail.push({ label: `Verified by ${emailToName(claim.verified_by)} (Management Lead)`, time: claim.verified_at, color: '#0369a1' });
            if (claim.approved_by_email) trail.push({ label: `Approved by ${emailToName(claim.approved_by_email)} (SNO Approver)`, time: claim.reviewed_at || (claim as any).approved_at, color: '#7c3aed' });
            if (claim.invoice_generated_at) trail.push({ label: `Invoice ${claim.invoice_number || ''} generated`, time: claim.invoice_generated_at, color: '#d97706' });
            if (claim.expected_payment_date && !isPaid) trail.push({ label: 'Payment scheduled by PML Finance', detail: `Due ${new Date(claim.expected_payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, time: null, color: '#d97706' });
            if (isPaid) trail.push({ label: `Payment sent${claim.bacs_reference ? ` · BACS: ${claim.bacs_reference}` : ''}`, detail: claim.paid_by ? `Processed by ${emailToName(claim.paid_by)} (PML Finance)` : undefined, time: claim.actual_payment_date || claim.paid_at, color: '#059669' });

            return (
              <div>

                {/* Invoice header card */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                  background: isPaid ? '#f0fdf4' : '#fffbeb', borderRadius: 10,
                  border: `1px solid ${isPaid ? '#86efac' : '#fcd34d'}`, marginBottom: 14,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: isPaid ? '#166534' : '#92400e' }}>
                        {isPaid
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                               <CheckCircle2 style={{ width: 13, height: 13 }} /> PAID
                            </span>
                          : 'INVOICED'
                        }
                      </span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtGBP(claimTotal(claim))}
                    </div>
                    {claim.invoice_number && (
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                        Invoice {claim.invoice_number}
                        {claim.invoice_generated_at && ` · ${new Date(claim.invoice_generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                      </div>
                    )}
                  </div>
                  {claim.invoice_number && (
                    <InvoiceDownloadLink claim={claim} />
                  )}
                </div>

                {/* Calculation breakdown */}
                {(() => {
                  const claimedAmt = claimTotal(claim);
                  const maxAmt = isLocum ? locumMaxAmount : (isMeeting ? meetingMaxAmount : calculatedAmount);
                  const belowMax = maxAmt > 0 && claimedAmt < maxAmt ? maxAmt - claimedAmt : 0;
                  if (maxAmt <= 0) return null;
                  return (
                    <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 8 }}>
                        Claim Calculation
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: '#6b7280' }}>Max claimable:</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmtGBP(maxAmt)}</span>
                      </div>
                      {belowMax > 0 && (
                        <div style={{ fontSize: 11, color: '#059669', fontWeight: 500, marginBottom: 6 }}>
                          Practice claimed {fmtGBP(claimedAmt)} — {fmtGBP(belowMax)} below maximum
                        </div>
                      )}
                      {isLocum && sessionRate > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' as const, fontSize: 12, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, color: catAccentColor }}>{configuredSessions} session{configuredSessions !== 1 ? 's' : ''}</span>
                          <span style={{ color: '#9ca3af' }}>×</span>
                          <span style={{ fontWeight: 600, color: catAccentColor }}>{fmtGBP(sessionRate)}/session</span>
                          <span style={{ color: '#9ca3af' }}>=</span>
                          <span style={{ fontWeight: 700, color: '#111827' }}>{fmtGBP(maxAmt)}</span>
                        </div>
                      )}
                      {!isLocum && !isMeeting && (staffMember.staff_category === 'management' || staffMember.staff_role === 'NRES Management') && rateParams?.workingWeeksInMonth && staffMember.hourly_rate ? (() => {
                        const ww = rateParams.workingWeeksInMonth!;
                        const baseRate = staffMember.hourly_rate;
                        const multiplier = rateParams.onCostMultiplier ?? 1;
                        const effectiveRate = baseRate * multiplier;
                        const weeklyHours = staffMember.allocation_value;
                        const niPct = rateParams.employerNiPct ?? 13.8;
                        const penPct = rateParams.employerPensionPct ?? 14.38;
                        return (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' as const, fontSize: 12, marginBottom: 4 }}>
                              <span style={{ fontWeight: 600, color: '#005eb8' }}>{weeklyHours} hrs/wk</span>
                              <span style={{ color: '#9ca3af' }}>×</span>
                              <span style={{ fontWeight: 600, color: '#005eb8' }}>{ww.toFixed(1)} weeks</span>
                              <span style={{ color: '#9ca3af' }}>×</span>
                              <span style={{ fontWeight: 600, color: '#005eb8' }}>{fmtGBP(effectiveRate)}/hr</span>
                              <span style={{ color: '#9ca3af', fontSize: 10 }}>(incl. on-costs)</span>
                              <span style={{ color: '#9ca3af' }}>=</span>
                              <span style={{ fontWeight: 700, color: '#111827' }}>{fmtGBP(maxAmt)}</span>
                            </div>
                          </div>
                        );
                      })() : null}
                      {!isLocum && !isMeeting && calcBreakdownData && !(staffMember.staff_category === 'management' || staffMember.staff_role === 'NRES Management') && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' as const, fontSize: 12, marginBottom: 6 }}>
                            {calcBreakdownData.primary.map((item, i) => (
                              item.label ? (
                                <span key={i} style={{
                                  fontWeight: item.result ? 700 : item.accent ? 700 : 400,
                                  color: item.result ? '#111827' : item.accent ? catAccentColor : '#9ca3af',
                                  borderLeft: item.result ? `2px solid ${catAccentColor}` : 'none',
                                  paddingLeft: item.result ? 6 : 0,
                                  fontSize: item.result ? 13 : 12,
                                }}>{item.label}</span>
                              ) : null
                            ))}
                          </div>
                          {calcBreakdownData.breakdown && (
                            <div style={{ background: `${catAccentColor}08`, border: `1px solid ${catAccentColor}20`, borderRadius: 7, padding: '8px 10px', fontSize: 11 }}>
                              {calcBreakdownData.breakdown.map((row, i) => (
                                <div key={i} style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                                  padding: '2px 0',
                                  borderTop: row.bold ? `1px solid ${catAccentColor}20` : 'none',
                                  marginTop: row.bold ? 3 : 0,
                                  paddingTop: row.bold ? 4 : 2,
                                }}>
                                  <span style={{ color: '#6b7280' }}>{row.l}</span>
                                  <span style={{ fontWeight: row.bold ? 700 : 500, color: row.bold ? catAccentColor : '#374151', fontSize: row.large ? 13 : 11 }}>{row.r}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {isMeeting && meetingRate > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' as const, fontSize: 12 }}>
                          <span style={{ fontWeight: 600, color: catAccentColor }}>{fmtGBP(meetingRate)}/hr</span>
                          <span style={{ color: '#9ca3af', fontSize: 10 }}>meeting attendance rate</span>
                        </div>
                      )}
                      <div style={{ marginTop: 6, fontSize: 10, color: '#9ca3af' }}>
                        {staffMember.staff_role} · {getAllocDisplay(staffMember.allocation_type, staffMember.allocation_value)}
                        {staffMember.staff_category && ` · ${CATEGORY_LABELS[staffMember.staff_category] || staffMember.staff_category}`}
                      </div>
                    </div>
                  );
                })()}

                {/* Detail grid */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10,
                  padding: '12px 14px', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 14,
                }}>
                  {/* Approved by */}
                  {claim.approved_by_email && (
                    <div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>Approved by</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{emailToName(claim.approved_by_email)}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>SNO Approver</div>
                      {(claim.reviewed_at || (claim as any).approved_at) && <div style={{ fontSize: 10, color: '#9ca3af' }}>{dateStr(claim.reviewed_at || (claim as any).approved_at)}</div>}
                    </div>
                  )}

                  {/* Payment terms */}
                  <div>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>Payment terms</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Net 30 days</div>
                    {claim.invoice_generated_at && (
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>Due by {dueDate(claim.invoice_generated_at)}</div>
                    )}
                  </div>

                  {/* Scheduled payment or paid date */}
                  {isPaid ? (
                    <div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>Paid</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>{shortDate(claim.actual_payment_date || claim.paid_at)}</div>
                      {claim.bacs_reference && <div style={{ fontSize: 10, color: '#6b7280' }}>BACS: {claim.bacs_reference}</div>}
                      {claim.paid_by && <div style={{ fontSize: 10, color: '#9ca3af' }}>{emailToName(claim.paid_by)} · PML Finance</div>}
                    </div>
                  ) : claim.expected_payment_date ? (
                    <div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>Scheduled payment</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#d97706' }}>{new Date(claim.expected_payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>Set by PML Finance</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>Payment</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#d97706' }}>Awaiting scheduling</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>PML Finance to confirm</div>
                    </div>
                  )}

                  {/* Payment notes from Finance */}
                  {claim.payment_notes && (
                    <div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>Finance note</div>
                      <div style={{ fontSize: 12, color: '#374151' }}>{claim.payment_notes}</div>
                    </div>
                  )}
                </div>

                {/* Audit trail — only shown for paid claims */}
                {isPaid && trail.length > 0 && (
                  <div style={{ padding: '10px 14px', background: '#fafbfc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 8 }}>
                      Claim Journey
                    </div>
                    <div style={{ position: 'relative' as const }}>
                      {trail.map((t, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < trail.length - 1 ? 10 : 0, position: 'relative' as const }}>
                          {/* Connector line */}
                          {i < trail.length - 1 && (
                            <div style={{ position: 'absolute' as const, left: 5, top: 12, bottom: -10, width: 1, background: '#e5e7eb' }} />
                          )}
                          {/* Dot */}
                          <div style={{ width: 11, height: 11, borderRadius: '50%', background: t.color || '#9ca3af', border: '2px solid #fff', boxShadow: '0 0 0 1px #e5e7eb', flexShrink: 0, marginTop: 2 }} />
                          <div>
                            <div style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{t.label}</div>
                            {t.detail && <div style={{ fontSize: 11, color: '#6b7280' }}>{t.detail}</div>}
                            {t.time && <div style={{ fontSize: 10, color: '#9ca3af' }}>{dateStr(t.time)}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </td>
    </tr>
  );
}

// --- Meeting Attendance Log ---
function MeetingAttendanceLog({
  staffMember, monthDate, monthLabel, practiceKey, entries, onAdd, onDelete, onSubmit, saving, canAddOnBehalf,
}: {
  staffMember: BuyBackStaffMember; monthDate: string; monthLabel: string; practiceKey: string;
  entries: MeetingLogEntry[];
  onAdd: (meetingName: string, meetingDate: string, hours: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSubmit: () => Promise<void>;
  saving?: boolean; canAddOnBehalf?: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [meetingName, setMeetingName] = useState('');
  const [meetingDate, setMeetingDate] = useState(monthDate.slice(0, 7) + '-01');
  const [meetingHours, setMeetingHours] = useState('');
  const [addingSaving, setAddingSaving] = useState(false);
  const [declared, setDeclared] = useState(false);

  const monthEntries = entries.filter(e => (e.claim_month?.slice(0, 7) || '') === monthDate.slice(0, 7));
  const editableStatuses = ['draft', 'queried'];
  const draftEntries = monthEntries.filter(e => editableStatuses.includes(e.status));
  const submittedEntries = monthEntries.filter(e => !editableStatuses.includes(e.status));
  const totalHours = monthEntries.reduce((s, e) => s + e.hours, 0);
  const draftHours = draftEntries.reduce((s, e) => s + e.hours, 0);
  const draftAmount = draftEntries.reduce((s, e) => s + e.total_amount, 0);
  const rate = staffMember.hourly_rate || 0;
  const isFullySubmitted = draftEntries.length === 0 && submittedEntries.length > 0;
  const hasQueriedEntries = monthEntries.some(e => e.status === 'queried');

  const handleAdd = async () => {
    if (!meetingName.trim() || !meetingDate || !meetingHours) return;
    setAddingSaving(true);
    try {
      await onAdd(meetingName.trim(), meetingDate, Number(meetingHours));
      setMeetingName(''); setMeetingHours(''); setShowForm(false);
    } finally { setAddingSaving(false); }
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = { draft: '#6b7280', submitted: '#0369a1', verified: '#7c3aed', approved: '#059669', invoiced: '#d97706', paid: '#166534', queried: '#dc2626' };
    return map[status] || '#9ca3af';
  };

  return (
    <tr><td colSpan={99} style={{ padding: 0 }}>
      <div style={{ margin: '0 10px 12px', borderRadius: 12, border: '1px solid #bae6fd', background: '#f0f9ff', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #bae6fd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0c4a6e', marginBottom: 4 }}>{monthLabel}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#0369a1', background: '#e0f2fe', padding: '2px 8px', borderRadius: 6 }}>Meeting Attendance</span>
                {isFullySubmitted && <span style={{ fontSize: 11, color: '#059669', fontWeight: 500 }}>Submitted</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' as const }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}><span style={{ fontWeight: 600 }}>Person</span> {staffMember.staff_name} <span style={{ color: '#d1d5db' }}>·</span> {staffMember.staff_role} <span style={{ color: '#d1d5db' }}>·</span> {fmtGBP(rate)}/hr</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}><span style={{ fontWeight: 600 }}>Practice</span> {getPracticeName(practiceKey)}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}><span style={{ fontWeight: 600 }}>Period</span> {monthLabel} — NRES SDA Programme</div>
          </div>
        </div>
        <div style={{ padding: '14px 18px' }}>
          {monthEntries.length > 0 && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' as const }}>
              <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e0f2fe', padding: '10px 14px', minWidth: 120 }}>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Meetings logged</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0c4a6e' }}>{monthEntries.length}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{totalHours.toFixed(1)} hrs total</div>
              </div>
              {draftEntries.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #fcd34d', padding: '10px 14px', minWidth: 120 }}>
                  <div style={{ fontSize: 11, color: '#92400e' }}>Pending claim</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#92400e' }}>{fmtGBP(draftAmount)}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{draftHours.toFixed(1)} hrs · {draftEntries.length} {draftEntries.length === 1 ? 'entry' : 'entries'}</div>
                </div>
              )}
              {submittedEntries.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #86efac', padding: '10px 14px', minWidth: 120 }}>
                  <div style={{ fontSize: 11, color: '#166534' }}>Submitted</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#166534' }}>{fmtGBP(submittedEntries.reduce((s,e)=>s+e.total_amount,0))}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{submittedEntries.reduce((s,e)=>s+e.hours,0).toFixed(1)} hrs · {submittedEntries.length} {submittedEntries.length===1?'entry':'entries'}</div>
                </div>
              )}
            </div>
          )}
          {monthEntries.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Meeting log</div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
                {monthEntries.map(entry => (
                  <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    <Calendar size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{entry.description || 'Meeting'}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(entry.work_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {entry.hours}h</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmtGBP(entry.total_amount)}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: statusColor(entry.status), textTransform: 'uppercase' as const, flexShrink: 0 }}>{entry.status}</span>
                    {editableStatuses.includes(entry.status) && (
                      <button onClick={() => onDelete(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 16, lineHeight: 1, padding: '2px 4px', flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#dc2626'}
                        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = '#d1d5db'}
                      >×</button>
                    )}
                  </div>
                ))}
              </div>
              {hasQueriedEntries && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#991b1b' }}>
                  <strong>⚠ Queried:</strong> One or more entries have been returned by the verifier. You may delete and re-log them, or resubmit as-is.
                </div>
              )}
            </div>
          )}
          {!isFullySubmitted && (
            <div style={{ marginBottom: 14 }}>
              {!showForm ? (
                <button onClick={() => setShowForm(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: '1px solid #0369a1', background: '#e0f2fe', color: '#0369a1', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Log Meeting</button>
              ) : (
                <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Log a meeting{canAddOnBehalf ? ' (on behalf of practice)' : ''}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'flex-end' }}>
                    <div style={{ flex: '2 1 160px' }}>
                      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Meeting name</div>
                      <input value={meetingName} onChange={e => setMeetingName(e.target.value)} placeholder="e.g. NRES Programme Board" onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }} />
                    </div>
                    <div style={{ flex: '1 1 120px' }}>
                      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Date</div>
                      <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }} />
                    </div>
                    <div style={{ flex: '0 0 80px' }}>
                      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>Hours</div>
                      <input type="number" min="0" step="0.5" value={meetingHours} onChange={e => setMeetingHours(e.target.value)} placeholder="e.g. 2"
                        style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', textAlign: 'right' }} />
                    </div>
                    {meetingHours && Number(meetingHours) > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', padding: '7px 0' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0369a1' }}>{fmtGBP(Number(meetingHours) * rate)}</span>
                      </div>
                    )}
                    <button onClick={handleAdd} disabled={addingSaving || !meetingName.trim() || !meetingHours} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: (!meetingName.trim() || !meetingHours) ? '#94a3b8' : '#0369a1', color: '#fff', fontSize: 12, fontWeight: 600, cursor: (!meetingName.trim() || !meetingHours) ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
                      {addingSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setShowForm(false)} style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {draftEntries.length > 0 && (
            <div style={{ borderTop: '1px solid #bae6fd', paddingTop: 14 }}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'flex', gap: 8, fontSize: 11, color: '#374151', cursor: 'pointer', alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={declared} onChange={e => setDeclared(e.target.checked)} style={{ marginTop: 2, accentColor: '#0369a1' }} />
                  <span>{MEETING_DECLARATION_TEXT}</span>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const }}>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Submitting {draftEntries.length} {draftEntries.length === 1 ? 'entry' : 'entries'} totalling {fmtGBP(draftAmount)}</div>
                <button onClick={() => { if (declared) onSubmit(); }} disabled={saving || !declared}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 8, border: 'none', background: (saving || !declared) ? '#94a3b8' : '#0369a1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: (saving || !declared) ? 'not-allowed' : 'pointer', opacity: (saving || !declared) ? 0.6 : 1 }}>
                  <Send size={14} />
                  Submit {draftEntries.length} {draftEntries.length === 1 ? 'entry' : 'entries'} →
                </button>
              </div>
            </div>
          )}
          {isFullySubmitted && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac' }}>
              <CheckCircle2 size={16} style={{ color: '#059669' }} />
              <span style={{ fontSize: 12, color: '#166534' }}>All entries submitted for {monthLabel}. Awaiting verification.</span>
            </div>
          )}
          {monthEntries.length === 0 && (
            <div style={{ padding: '16px 14px', background: '#fff', borderRadius: 8, border: '1px dashed #d1d5db', textAlign: 'center' as const, color: '#9ca3af', fontSize: 12 }}>
              No meetings logged for {monthLabel} yet. Tap "+ Log Meeting" to add your first entry.
            </div>
          )}
        </div>
      </div>
    </td></tr>
  );
}

// --- Staff Actions (Edit / Remove) ---
function StaffActions({
  member,
  category,
  onRemoveStaff,
  onUpdateStaff,
  staffRoles,
}: {
  member: BuyBackStaffMember;
  category: string;
  onRemoveStaff?: (id: string) => Promise<void>;
  onUpdateStaff?: (id: string, updates: Partial<BuyBackStaffMember>) => Promise<any>;
  staffRoles?: string[];
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editRole, setEditRole] = useState(member.staff_role);
  const [editAllocType, setEditAllocType] = useState(member.allocation_type || 'sessions');
  const [editAllocValue, setEditAllocValue] = useState(String(member.allocation_value ?? ''));
  const [saving, setSaving] = useState(false);

  // Config-driven management roles (id is a key like "nres_cd", not a UUID) — don't allow edit/remove
  const isConfigDriven = category === 'management' && member.user_id === '' && member.created_at === '';
  if (isConfigDriven) {
    return <span style={{ fontSize: 10, color: '#d1d5db' }}>—</span>;
  }

  if (confirmRemove) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={async () => {
            if (onRemoveStaff) {
              setSaving(true);
              await onRemoveStaff(member.id);
              setSaving(false);
            }
            setConfirmRemove(false);
          }}
          disabled={saving}
          style={{
            padding: '3px 8px', borderRadius: 5, border: '1px solid #fca5a5',
            background: '#fef2f2', color: '#dc2626', fontSize: 10, fontWeight: 600,
            cursor: 'pointer', opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? '...' : 'Yes'}
        </button>
        <button
          onClick={() => setConfirmRemove(false)}
          style={{
            padding: '3px 8px', borderRadius: 5, border: '1px solid #d1d5db',
            background: '#fff', color: '#6b7280', fontSize: 10, fontWeight: 500, cursor: 'pointer',
          }}
        >
          No
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap', justifyContent: 'center' }}>
        <select
          value={category === 'gp_locum' ? 'GP Locum' : editRole}
          onChange={e => setEditRole(e.target.value)}
          disabled={category === 'gp_locum'}
          style={{ padding: '2px 4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 10, maxWidth: 90 }}
        >
          {(category === 'gp_locum'
            ? ['GP Locum']
            : (staffRoles || ['GP', 'ANP', 'Pharmacist', 'Nurse', 'HCA', 'Paramedic', 'Admin'])
          ).map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <input
          value={editAllocValue}
          onChange={e => setEditAllocValue(e.target.value)}
          style={{ padding: '2px 4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 10, width: 40, textAlign: 'center' }}
          placeholder="Qty"
        />
        <select
          value={editAllocType}
          onChange={e => setEditAllocType(e.target.value as any)}
          style={{ padding: '2px 4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 10, maxWidth: 70 }}
        >
          <option value="sessions">sess</option>
          <option value="wte">WTE</option>
          <option value="hours">hrs</option>
          <option value="daily">days</option>
        </select>
        <button
          onClick={async () => {
            if (onUpdateStaff) {
              setSaving(true);
              // Cap non-locum allocations at 1.0 WTE / 37.5 hrs per week
              let valNum = Number(editAllocValue) || member.allocation_value;
              if (category !== 'gp_locum') {
                if (editAllocType === 'wte' && valNum > 1) valNum = 1;
                if (editAllocType === 'hours' && valNum > 37.5) valNum = 37.5;
              }
              await onUpdateStaff(member.id, {
                staff_role: editRole,
                allocation_type: editAllocType as any,
                allocation_value: valNum,
              });
              setSaving(false);
            }
            setEditing(false);
          }}
          disabled={saving}
          style={{
            padding: '2px 6px', borderRadius: 4, border: 'none',
            background: '#059669', color: '#fff', fontSize: 10, fontWeight: 600,
            cursor: 'pointer', opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? '...' : '✓'}
        </button>
        <button
          onClick={() => setEditing(false)}
          style={{
            padding: '2px 6px', borderRadius: 4, border: '1px solid #d1d5db',
            background: '#fff', color: '#6b7280', fontSize: 10, cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center' }}>
      {onUpdateStaff && (
        <button
          onClick={() => setEditing(true)}
          title="Edit staff member"
          style={{
            padding: 4, borderRadius: 4, border: 'none', background: 'transparent',
            color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#3b82f6')}
          onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
        >
          <Pencil style={{ width: 13, height: 13 }} />
        </button>
      )}
      {onRemoveStaff && (
        <button
          onClick={() => setConfirmRemove(true)}
          title="Remove staff member"
          style={{
            padding: 4, borderRadius: 4, border: 'none', background: 'transparent',
            color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
          onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
        >
          <Trash2 style={{ width: 13, height: 13 }} />
        </button>
      )}
    </div>
  );
}


export function StaffRosterSection({
  title, category, staffList, claims, claimMonths, onClickClaim, activeClaimKey,
  onAddStaff, onRemoveStaff, onUpdateStaff, staffRoles, showAddButton, rateParams,
  onCreateClaim, onCreateLocumClaim, onDeleteClaim, onSubmit, onResubmit,
  confirmDeclaration, practiceKey, saving,
  meetingLogEntries, onAddMeetingEntry, onDeleteMeetingEntry, onSubmitMeetingEntries, canAddOnBehalf, managementRoles,
}: {
  title: string; category: string; staffList: BuyBackStaffMember[]; claims: BuyBackClaim[];
  claimMonths: { label: string; monthDate: string; month: number; year: number }[];
  onClickClaim: (key: string) => void; activeClaimKey: string | null;
  onAddStaff?: (member: Omit<BuyBackStaffMember, 'id' | 'user_id' | 'practice_id' | 'created_at' | 'updated_at'>) => Promise<any>;
  onRemoveStaff?: (id: string) => Promise<void>;
  onUpdateStaff?: (id: string, updates: Partial<BuyBackStaffMember>) => Promise<any>;
  staffRoles?: string[]; showAddButton: boolean; rateParams?: RateParams;
  onCreateClaim?: (monthDate: string, staffMember: BuyBackStaffMember, claimedAmount?: number, holidayWeeksDeducted?: number) => Promise<any>;
  onCreateLocumClaim?: (monthDate: string, staffMember: BuyBackStaffMember, actualSessions: number, claimedAmount: number) => Promise<any>;
  onDeleteClaim?: (id: string) => Promise<void>;
  onSubmit?: (id: string, practiceNotes?: string) => void; onResubmit?: (id: string, notes?: string) => void;
  confirmDeclaration?: (id: string, confirmed: boolean) => Promise<void>;
  practiceKey?: string; saving?: boolean;
  meetingLogEntries?: MeetingLogEntry[];
  onAddMeetingEntry?: (practiceKey: string, roleConfig: ManagementRoleConfig, meetingName: string, meetingDate: string, hours: number) => Promise<void>;
  onDeleteMeetingEntry?: (id: string) => Promise<void>;
  onSubmitMeetingEntries?: (practiceKey: string, claimMonth: string) => Promise<void>;
  canAddOnBehalf?: boolean; managementRoles?: ManagementRoleConfig[];
}) {
  const accent = CATEGORY_COLORS[category] || '#6b7280';
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  // Default highlighted claim target: previous month if today is 1–15, else current month.
  const defaultClaimMonthStr = getDefaultClaimMonthStr();

  // Always collapsed by default for a cleaner view
  const [sectionOpen, setSectionOpen] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addRole, setAddRole] = useState(category === 'gp_locum' ? 'GP Locum' : '');
  const [addAllocType, setAddAllocType] = useState<'sessions'|'wte'|'hours'|'daily'>('sessions');
  const [addAllocValue, setAddAllocValue] = useState('');
  const [addHourlyRate, setAddHourlyRate] = useState('');
  const [addCategory, setAddCategory] = useState(category);
  const [addSaving, setAddSaving] = useState(false);
  const meetingAttendanceRoles = useMemo(() => [
    { label: 'Practice Manager', rate: rateParams?.meetingPmRate ?? 50 },
    { label: 'GP Partner', rate: rateParams?.meetingGpRate ?? 100 },
  ], [rateParams?.meetingGpRate, rateParams?.meetingPmRate]);
  const selectedMeetingRole = meetingAttendanceRoles.find(r => r.label === addRole) ?? meetingAttendanceRoles[0];
  const isAddingMeeting = addCategory === 'meeting';

  const handleAddStaff = async () => {
    if (!addName.trim() || !addRole || (!isAddingMeeting && !addAllocValue)) return;
    setAddSaving(true);
    try {
      await onAddStaff?.({
        staff_name: addName.trim(),
        staff_role: addRole,
        allocation_type: isAddingMeeting ? 'hours' : addAllocType,
        allocation_value: isAddingMeeting ? 0 : Number(addAllocValue),
        hourly_rate: isAddingMeeting ? selectedMeetingRole.rate : Number(addHourlyRate) || 0,
        is_active: true,
        staff_category: addCategory as any,
        practice_key: practiceKey || null,
        start_date: null,
      });
      setAddName(''); setAddRole(''); setAddAllocValue(''); setAddHourlyRate('');
      setShowAddForm(false);
    } finally {
      setAddSaving(false);
    }
  };

  return (
    <div style={{ marginBottom: 18 }}>
      {/* Section header — click to toggle */}
      <div
        onClick={() => setSectionOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderLeft: `4px solid ${accent}`,
          background: `${accent}08`, borderRadius: '0 8px 8px 0', marginBottom: 8,
          cursor: 'pointer', userSelect: 'none' as const,
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          title={!sectionOpen && staffList.length > 0 ? staffList.map(s => s.staff_name).join(', ') : undefined}
        >
          <ChevronDown style={{
            width: 14, height: 14, color: accent, flexShrink: 0,
            transition: 'transform 0.2s',
            transform: sectionOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
          }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{title}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 100,
            background: accent, color: '#fff',
          }}>
            {staffList.length}
          </span>
          {!sectionOpen && staffList.length > 0 && (
            <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400, marginLeft: 4, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
              {staffList.map(s => s.staff_name).join(', ')}
            </span>
          )}
        </div>
        {showAddButton && onAddStaff && (
          <button onClick={(e) => { e.stopPropagation(); setAddCategory(category); setShowAddForm(prev => !prev); }} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px',
            borderRadius: 6, border: `1px solid ${accent}40`, background: showAddForm ? `${accent}15` : '#fff',
            color: accent, fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>
            <Plus style={{ width: 11, height: 11 }} />
            {showAddForm ? 'Cancel' : `Add ${category === 'gp_locum' ? 'Locum' : 'Staff'}`}
          </button>
        )}
      </div>

      {showAddForm && onAddStaff && (
        <div style={{ padding: '12px 14px', background: '#fafbfc', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'flex-end' }}>
            {category === 'management' && (
              <div style={{ flex: '0 1 150px', minWidth: 130 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Claim type</div>
                <select
                  value={addCategory}
                  onChange={(e) => { setAddCategory(e.target.value); setAddRole(''); setAddAllocValue(e.target.value === 'meeting' ? '0' : ''); }}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer' }}
                >
                  <option value="management">NRES Management</option>
                  <option value="meeting">Meeting Attendance</option>
                </select>
              </div>
            )}
            <div style={{ flex: '1 1 140px', minWidth: 120 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Name</div>
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder={`e.g. ${category === 'gp_locum' ? 'Dr J Smith' : 'Sarah Jones'}`}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
              />
            </div>
            <div style={{ flex: '1 1 120px', minWidth: 100 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Role</div>
              {isAddingMeeting ? (
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer' }}
                >
                  <option value="">Select role</option>
                  {meetingAttendanceRoles.map(r => <option key={r.label} value={r.label}>{r.label} — {fmtGBP(r.rate)}/hr</option>)}
                </select>
              ) : staffRoles && staffRoles.length > 0 ? (
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer' }}
                >
                  <option value="">Select role</option>
                  {staffRoles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <input
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                  placeholder="e.g. GP Standard"
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
                />
              )}
            </div>
            {!isAddingMeeting && <div style={{ flex: '0 1 100px', minWidth: 80 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Allocation type</div>
              <select
                value={addAllocType}
                onChange={(e) => setAddAllocType(e.target.value as any)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer' }}
              >
                <option value="sessions">Sessions</option>
                <option value="wte">WTE</option>
                <option value="hours">Hours/wk</option>
                <option value="daily">Days/mo</option>
              </select>
            </div>}
            {!isAddingMeeting && <div style={{ flex: '0 1 70px', minWidth: 60 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Value</div>
              <input
                type="number"
                value={addAllocValue}
                onChange={(e) => setAddAllocValue(e.target.value)}
                placeholder="e.g. 4"
                style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', textAlign: 'right' }}
              />
            </div>}
            {/* GP Locum rates are governed by master settings (£375/session = £90/hr) — no per-staff rate input needed */}
            <button onClick={handleAddStaff} disabled={addSaving || !addName.trim() || !addRole || (!isAddingMeeting && !addAllocValue)} style={{
              padding: '7px 16px', borderRadius: 7, border: 'none', background: accent,
              color: '#fff', fontSize: 12, fontWeight: 600, cursor: addSaving ? 'not-allowed' : 'pointer',
              opacity: (addSaving || !addName.trim() || !addRole || (!isAddingMeeting && !addAllocValue)) ? 0.5 : 1,
            }}>
              {addSaving ? 'Saving…' : 'Add'}
            </button>
          </div>
        </div>
      )}


      {sectionOpen && (
        <>
      {staffList.length === 0 ? (
        <div style={{
          padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13,
          background: '#fafafa', borderRadius: 8, border: '1px dashed #d1d5db',
        }}>
          <User style={{ width: 20, height: 20, margin: '0 auto 6px', color: '#d1d5db' }} />
          <div>No {CATEGORY_LABELS[category]?.toLowerCase() || category} staff added yet</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb' }}>
                  Name
                </th>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb' }}>
                  Role
                </th>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb' }}>
                  Allocation
                </th>
                {claimMonths.map(cm => {
                  const monthKey = cm.monthDate.slice(0, 7);
                  const isDefaultMo = monthKey === defaultClaimMonthStr;
                  const isCurrentMo = monthKey === currentMonthStr;
                  const isLastMo = monthKey === lastMonthStr;
                  // Only show the secondary "current/last" label if it's NOT already the default,
                  // to avoid double-labelling.
                  const showCurrentBadge = isCurrentMo && !isDefaultMo;
                  const showLastBadge = isLastMo && !isDefaultMo;
                  return (
                    <th key={cm.monthDate} style={{
                      textAlign: 'center', padding: '6px 10px', fontSize: 10, fontWeight: 600,
                      color: isDefaultMo ? '#2563eb' : showLastBadge ? '#92400e' : showCurrentBadge ? '#2563eb' : '#9ca3af',
                      textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                      borderBottom: '2px solid #e5e7eb',
                      background: isDefaultMo ? '#eff6ff' : showLastBadge ? '#fffbeb' : 'transparent',
                    }}>
                      <div>{cm.label}</div>
                      {isDefaultMo && <div style={{ fontSize: 9, fontWeight: 400, color: '#93c5fd', marginTop: 1 }}>Default claim month</div>}
                      {showCurrentBadge && <div style={{ fontSize: 9, fontWeight: 400, color: '#93c5fd', marginTop: 1 }}>This month</div>}
                      {showLastBadge && <div style={{ fontSize: 9, fontWeight: 400, color: '#fcd34d', marginTop: 1 }}>Last month</div>}
                    </th>
                  );
                })}
                <th style={{ textAlign: 'center', padding: '6px 10px', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb', width: 280, minWidth: 280 }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {staffList.map(member => {
                const rowCells = claimMonths.map(cm => {
                  const claim = findClaimForStaffMonth(claims, member, cm.monthDate);
                  // Highlight the DEFAULT claim month (prev month on days 1–15, otherwise current).
                  const isCurrentMo = cm.monthDate.slice(0, 7) === defaultClaimMonthStr;
                  return { cm, claim, isCurrentMo };
                });

                const activeMonth = claimMonths.find(cm => activeClaimKey === `${member.id}_${cm.monthDate}`);
                const activeClaim = activeMonth ? findClaimForStaffMonth(claims, member, activeMonth.monthDate) : null;

                return (
                  <React.Fragment key={member.id}>
                    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' as const }}>
                        {member.staff_name}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 6,
                          fontSize: 11, fontWeight: 500, background: `${accent}10`, color: accent,
                          border: `1px solid ${accent}30`,
                        }}>
                          {member.staff_role}
                        </span>
                      </td>
                      <td style={{ padding: '10px', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' as const }}>
                        {member.staff_category === 'meeting'
                          ? `${fmtGBP(member.hourly_rate || 0)}/hr · variable`
                          : getAllocDisplay(member.allocation_type, member.allocation_value)}
                      </td>
                      {rowCells.map(({ cm, claim, isCurrentMo }) => (
                        <MonthStatusCell
                          key={cm.monthDate}
                          claim={claim}
                          monthDate={cm.monthDate}
                          staffMember={member}
                          onClickClaim={onClickClaim}
                          activeClaimKey={activeClaimKey}
                          isCurrentMonth={isCurrentMo}
                        />
                      ))}
                      <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' as const }}>
                        <StaffActions
                          member={member}
                          category={category}
                          onRemoveStaff={onRemoveStaff}
                          onUpdateStaff={onUpdateStaff}
                          staffRoles={staffRoles}
                        />
                      </td>
                    </tr>
                    {/* Meeting log or standard claim panel */}
                    {activeMonth && (
                      member.staff_category === 'meeting' ? (
                        <MeetingAttendanceLog
                          staffMember={member}
                          monthDate={activeMonth.monthDate}
                          monthLabel={activeMonth.label}
                          practiceKey={practiceKey || ''}
                          entries={meetingLogEntries || []}
                          onAdd={async (name, date, hours) => {
                            const cfg = managementRoles?.find(r => r.key === member.id) ?? {
                              key: member.id,
                              label: member.staff_role,
                              person_name: member.staff_name,
                              person_email: '',
                              hourly_rate: member.hourly_rate || 0,
                              max_hours_per_week: 0,
                              billing_entity: getPracticeName(practiceKey || ''),
                              billing_org_code: NRES_ODS_CODES[practiceKey || ''] || '',
                              gl_code: getSDAClaimGLCode({ staff_category: 'meeting', staff_role: member.staff_role }) || '',
                              is_active: true,
                              role_type: 'attending_meeting' as const,
                              member_practice: practiceKey,
                            };
                            if (onAddMeetingEntry) await onAddMeetingEntry(practiceKey || '', cfg, name, date, hours);
                          }}
                          onDelete={async (id) => { if (onDeleteMeetingEntry) await onDeleteMeetingEntry(id); }}
                          onSubmit={async () => { if (onSubmitMeetingEntries) await onSubmitMeetingEntries(practiceKey || '', activeMonth.monthDate.slice(0, 7)); }}
                          saving={saving}
                          canAddOnBehalf={canAddOnBehalf}
                        />
                      ) : (
                        <InlineClaimPanel
                          staffMember={member}
                          monthDate={activeMonth.monthDate}
                          monthLabel={activeMonth.label}
                          existingClaim={activeClaim}
                          rateParams={rateParams}
                          onCreateClaim={onCreateClaim}
                          onCreateLocumClaim={onCreateLocumClaim}
                          onDeleteClaim={onDeleteClaim}
                          onSubmit={onSubmit}
                          onResubmit={onResubmit}
                          confirmDeclaration={confirmDeclaration}
                          onClose={() => onClickClaim('')}
                          saving={saving}
                          claimMonths={claimMonths}
                          onChangeMonth={(newMonthDate) => onClickClaim(`${member.id}_${newMonthDate}`)}
                        />
                      )
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}
    </div>
  );
}

// --- History Summary (preserved) ---
function HistorySummary({ claims, hidePeriodFilter, directorMode }: { claims: BuyBackClaim[]; hidePeriodFilter?: boolean; directorMode?: boolean }) {
  const [period, setPeriod] = useState('all');
  const periodClaims = hidePeriodFilter ? claims : filterByPeriod(claims, period);

  const byMonth = useMemo(() => {
    const m: Record<string, any> = {};
    periodClaims.forEach((c) => {
      const monthLabel = getClaimMonthLabel(c);
      const practice = directorMode ? (getPracticeName(c.practice_key) || '—') : '';
      const key = directorMode ? `${monthLabel}__${practice}` : monthLabel;
      if (!m[key]) m[key] = { key, month: monthLabel, practice, claims: 0, hours: 0, sessions: 0, awaiting: 0, queried: 0, approved: 0, paid: 0, total: 0 };
      const r = m[key];
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
      if (by !== ay) return by - ay;
      if (bm !== am) return bm - am;
      return (a.practice || '').localeCompare(b.practice || '');
    });
  }, [periodClaims, directorMode]);

  const totals = useMemo(() => byMonth.reduce((acc: any, r: any) => ({
    claims: acc.claims + r.claims, hours: acc.hours + r.hours, sessions: acc.sessions + r.sessions,
    awaiting: acc.awaiting + r.awaiting, queried: acc.queried + r.queried,
    approved: acc.approved + r.approved, paid: acc.paid + r.paid, total: acc.total + r.total,
  }), { claims: 0, hours: 0, sessions: 0, awaiting: 0, queried: 0, approved: 0, paid: 0, total: 0 }), [byMonth]);

  const COLS = [
    { key: 'month', label: 'Period', align: 'left' as const },
    ...(directorMode ? [{ key: 'practice', label: 'Practice', align: 'left' as const }] : []),
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
    if (col.key === 'month' || col.key === 'practice') return v;
    if (col.key === 'claims' || col.key === 'sessions') return v;
    if (col.key === 'hours') return v.toFixed(1);
    if (v === 0) return '—';
    return fmtShort(v);
  };

  const cellColor = (row: any, col: any) => {
    if (col.key === 'month' || col.key === 'practice') return '#374151';
    if (col.key === 'claims' || col.key === 'sessions' || col.key === 'hours') return '#6b7280';
    if (col.key === 'total') return '#111827';
    if (row[col.key] === 0) return '#d1d5db';
    return col.color || '#111827';
  };

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' as const, gap: 8 }}>
        {!hidePeriodFilter && (
          <>
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
          </>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {COLS.map((col) => (
                <th key={col.key} style={{
                  textAlign: col.align, padding: '7px 8px', fontSize: 10, fontWeight: 600,
                  color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                  borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' as const, width: col.w,
                }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {byMonth.length === 0 ? (
              <tr><td colSpan={COLS.length} style={{ padding: 20, textAlign: 'center', color: '#9ca3af' }}>No claims in this period.</td></tr>
            ) : byMonth.map((row: any) => (
              <tr key={row.key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                {COLS.map((col) => (
                  <td key={col.key} style={{
                    padding: '8px 8px', textAlign: col.align,
                    fontVariantNumeric: col.key !== 'month' ? 'tabular-nums' : undefined,
                    fontWeight: col.key === 'month' || col.key === 'total' ? 600 : 400,
                    color: cellColor(row, col), whiteSpace: 'nowrap' as const,
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
                  }}>{col.key === 'month' ? 'TOTALS' : col.key === 'practice' ? '' : cellVal(totals, col)}</td>
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

type ClaimsView = 'summary' | 'cards' | 'invoices' | 'spreadsheet';

export interface DirectorPracticeOption { key: string; name: string; }

export function ClaimsViewSwitcher({
  claims,
  practiceKey,
  practiceName,
  onToggleCard,
  expandedClaimId,
  onSubmit,
  onResubmit,
  onUpdateClaimNotes,
  onDeleteClaim,
  onContinueDraft,
  saving,
  // Director-mode extensions (all optional, off by default)
  directorMode = false,
  practiceFilter,
  onPracticeFilterChange,
  practiceOptions,
  defaultView,
  hideSummaryView = false,
  exportVariant = 'practice',
  statusFilter,
  onStatusFilterChange,
}: {
  claims: BuyBackClaim[];
  practiceKey: string;
  practiceName: string;
  onToggleCard: (id: string) => void;
  expandedClaimId: string | null;
  onSubmit?: (id: string, practiceNotes?: string) => void;
  onResubmit?: (id: string, notes?: string) => void;
  onUpdateClaimNotes?: (id: string, notes: string) => Promise<void>;
  onDeleteClaim?: (id: string) => Promise<void>;
  onContinueDraft?: (claim: BuyBackClaim) => void;
  saving?: boolean;
  directorMode?: boolean;
  practiceFilter?: string;
  onPracticeFilterChange?: (key: string) => void;
  practiceOptions?: DirectorPracticeOption[];
  defaultView?: ClaimsView;
  hideSummaryView?: boolean;
  exportVariant?: 'practice' | 'director' | 'finance';
  statusFilter?: string | null;
  onStatusFilterChange?: (status: string | null) => void;
}) {
  const [view, setView] = useState<ClaimsView>(defaultView || 'cards');

  useEffect(() => {
    if (defaultView) setView(defaultView);
  }, [defaultView]);
  const [period, setPeriod] = useState('all');
  const [downloadingAll, setDownloadingAll] = useState(false);

  // Spreadsheet sort & filter state
  const [sortCol, setSortCol] = useState<string>('month');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterName, setFilterName] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');

  const scopedClaims = useMemo(() => {
    if (!directorMode || !practiceFilter || practiceFilter === 'all') return claims;
    return claims.filter(c => c.practice_key === practiceFilter);
  }, [claims, directorMode, practiceFilter]);
  const periodClaims = useMemo(() => filterByPeriod(scopedClaims, period), [scopedClaims, period]);

  const sorted = useMemo(() => {
    const order: Record<string, number> = { queried: 0, draft: 1, submitted: 2, verified: 3, approved: 4, invoiced: 5, paid: 6, rejected: 7 };
    let filtered = [...periodClaims];
    if (statusFilter) {
      if (statusFilter === 'invoiced') {
        filtered = filtered.filter(c => c.status === 'approved' || c.status === 'invoiced');
      } else {
        filtered = filtered.filter(c => c.status === statusFilter);
      }
    }
    return filtered.sort((a, b) => (order[a.status] ?? 99) - (order[b.status] ?? 99));
  }, [periodClaims, statusFilter]);

  // Flatten staff lines for spreadsheet
  type FlatLine = { claimId: string; claim: BuyBackClaim; staff: any; monthLabel: string; monthDate: string; allocDisplay: string; maxAmt: number; claimedAmt: number; isBelow: boolean };
  const flatLines = useMemo<FlatLine[]>(() => {
    return sorted.flatMap(c => {
      const staffDets = (c.staff_details as any[]) || [];
      const monthLabel = getClaimMonthLabel(c);
      return staffDets.map((s: any) => {
        const allocDisplay = s.allocation_type === 'sessions' ? `${s.allocation_value} sess/mo`
          : s.allocation_type === 'wte' ? `${s.allocation_value} WTE`
          : s.allocation_type === 'hours' ? `${s.allocation_value} hrs/wk`
          : `${s.allocation_value}`;
        const maxAmt = s.calculated_amount ?? s.claimed_amount ?? 0;
        const claimedAmt = s.claimed_amount ?? maxAmt;
        return { claimId: c.id, claim: c, staff: s, monthLabel, monthDate: c.claim_month, allocDisplay, maxAmt, claimedAmt, isBelow: claimedAmt < maxAmt && maxAmt > 0 };
      });
    });
  }, [sorted]);

  // Unique values for filter dropdowns
  const uniqueCategories = useMemo(() => [...new Set(flatLines.map(l => l.staff.staff_category).filter(Boolean))].sort(), [flatLines]);
  const uniqueRoles = useMemo(() => [...new Set(flatLines.map(l => l.staff.staff_role).filter(Boolean))].sort(), [flatLines]);
  const uniqueNames = useMemo(() => [...new Set(flatLines.map(l => l.staff.staff_name).filter(Boolean))].sort(), [flatLines]);
  const uniqueMonths = useMemo(() => {
    const months = [...new Set(flatLines.map(l => l.monthLabel).filter(Boolean))];
    const monthOrder = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return months.sort((a, b) => {
      const [am, ay] = [monthOrder.indexOf(a.split(' ')[0]), parseInt(a.split(' ')[1])];
      const [bm, by] = [monthOrder.indexOf(b.split(' ')[0]), parseInt(b.split(' ')[1])];
      return by !== ay ? by - ay : bm - am;
    });
  }, [flatLines]);

  // Filtered + sorted flat lines
  const filteredLines = useMemo(() => {
    let lines = flatLines;
    if (filterMonth !== 'all') lines = lines.filter(l => l.monthLabel === filterMonth);
    if (filterCategory !== 'all') lines = lines.filter(l => l.staff.staff_category === filterCategory);
    if (filterRole !== 'all') lines = lines.filter(l => l.staff.staff_role === filterRole);
    if (filterName !== 'all') lines = lines.filter(l => l.staff.staff_name === filterName);

    const cmp = (a: FlatLine, b: FlatLine): number => {
      let av: any, bv: any;
      switch (sortCol) {
        case 'month': av = a.monthDate; bv = b.monthDate; break;
        case 'name': av = (a.staff.staff_name || '').toLowerCase(); bv = (b.staff.staff_name || '').toLowerCase(); break;
        case 'role': av = (a.staff.staff_role || '').toLowerCase(); bv = (b.staff.staff_role || '').toLowerCase(); break;
        case 'category': av = (a.staff.staff_category || '').toLowerCase(); bv = (b.staff.staff_category || '').toLowerCase(); break;
        case 'allocation': av = a.staff.allocation_value ?? 0; bv = b.staff.allocation_value ?? 0; break;
        case 'max': av = a.maxAmt; bv = b.maxAmt; break;
        case 'claimed': av = a.claimedAmt; bv = b.claimedAmt; break;
        case 'invoice': av = a.claim.invoice_number || ''; bv = b.claim.invoice_number || ''; break;
        case 'status': av = a.claim.status; bv = b.claim.status; break;
        case 'paid': av = a.claim.paid_at || ''; bv = b.claim.paid_at || ''; break;
        default: av = a.monthDate; bv = b.monthDate;
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    };
    return [...lines].sort(cmp);
  }, [flatLines, filterMonth, filterCategory, filterRole, filterName, sortCol, sortAsc]);

  const handleSort = (col: string) => {
    if (sortCol === col) { setSortAsc(!sortAsc); } else { setSortCol(col); setSortAsc(true); }
  };

  const sortArrow = (col: string) => sortCol === col ? (sortAsc ? ' ▲' : ' ▼') : '';

  const invoicedClaims = useMemo(() => sorted.filter(c => c.invoice_number && (c.status === 'invoiced' || c.status === 'paid')), [sorted]);

  const handleExcelExport = () => {
    if (directorMode) {
      const practiceLabel = !practiceFilter || practiceFilter === 'all'
        ? 'AllPractices'
        : (practiceOptions?.find(p => p.key === practiceFilter)?.name) || practiceFilter;
      const timeWindowLabel = PERIOD_OPTIONS.find(p => p.key === period)?.label || 'AllTime';
      const lines = filteredLines.map(l => ({ claim: l.claim, staff: l.staff, monthLabel: l.monthLabel }));
      if (exportVariant === 'finance') {
        exportFinanceClaimsDetail(lines, { practiceLabel, timeWindowLabel });
      } else {
        exportDirectorClaimsDetail(lines, { practiceLabel, timeWindowLabel });
      }
    } else {
      exportClaimsDetail(sorted, practiceKey);
    }
  };

  const handleDownloadAll = async () => {
    if (invoicedClaims.length === 0) return;
    setDownloadingAll(true);
    try {
      for (let i = 0; i < invoicedClaims.length; i++) {
        const claim = invoicedClaims[i];
        if (!claim.invoice_number) continue;
        const doc = generateInvoicePdf({ claim, invoiceNumber: claim.invoice_number, neighbourhoodName: 'NRES' });
        doc.save(`${claim.invoice_number}.pdf`);
        if (i < invoicedClaims.length - 1) await new Promise(r => setTimeout(r, 400));
      }
    } finally {
      setDownloadingAll(false);
    }
  };

  const handleDownloadOne = (claim: BuyBackClaim) => {
    if (!claim.invoice_number) return;
    const doc = generateInvoicePdf({ claim, invoiceNumber: claim.invoice_number, neighbourhoodName: 'NRES' });
    doc.save(`${claim.invoice_number}.pdf`);
  };

  const statusColor = (status: string) => {
    const m: Record<string, string> = { draft: '#6b7280', submitted: '#2563eb', verified: '#7c3aed', approved: '#7c3aed', invoiced: '#d97706', paid: '#059669', queried: '#dc2626', rejected: '#dc2626' };
    return m[status] || '#6b7280';
  };

  const catColor = (cat: string) => {
    const m: Record<string, string> = { buyback: '#0d9488', new_sda: '#7c3aed', gp_locum: '#d97706', management: '#005eb8', meeting: '#0369a1' };
    return m[cat] || '#6b7280';
  };

  const catLabel = (cat: string) => {
    const m: Record<string, string> = { buyback: 'Buy-Back', new_sda: 'New SDA', gp_locum: 'GP Locum', management: 'NRES Management', meeting: 'Meeting' };
    return m[cat] || cat;
  };

  const VIEW_TABS: { key: ClaimsView; label: string; icon: string }[] = [
    ...(hideSummaryView ? [] : [{ key: 'summary' as ClaimsView, label: 'Summary', icon: '📋' }]),
    { key: 'cards', label: 'Individual Claim View', icon: '🃏' },
    { key: 'invoices', label: 'Invoices', icon: '📄' },
    { key: 'spreadsheet', label: 'Spreadsheet', icon: '📊' },
  ];

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>

      {/* Section header with view switcher + period filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>

        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Claims</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Period filter */}
          <div style={{ display: 'flex', gap: 4 }}>
            {PERIOD_OPTIONS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                padding: '4px 9px', borderRadius: 5, fontSize: 11, fontWeight: period === p.key ? 600 : 400,
                border: `1px solid ${period === p.key ? '#005eb8' : '#e5e7eb'}`,
                background: period === p.key ? '#eff6ff' : '#fff',
                color: period === p.key ? '#005eb8' : '#6b7280', cursor: 'pointer',
              }}>{p.label}</button>
            ))}
          </div>

          {/* View tabs */}
          <div style={{ display: 'flex', gap: 2, background: '#f3f4f6', borderRadius: 8, padding: 2 }}>
            {VIEW_TABS.map(t => (
              <button key={t.key} onClick={() => setView(t.key)} style={{
                padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 11,
                fontWeight: view === t.key ? 600 : 400,
                background: view === t.key ? '#fff' : 'transparent',
                color: view === t.key ? '#111827' : '#6b7280',
                cursor: 'pointer', boxShadow: view === t.key ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

        </div>

      </div>

      {sorted.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
          No claims in this period.
        </div>
      )}

      {/* ── SUMMARY VIEW ───────────────────────────────────────── */}
      {view === 'summary' && (
        <HistorySummary claims={periodClaims} hidePeriodFilter directorMode={directorMode} />
      )}

      {/* ── Status filter indicator ─────────────────────────── */}
      {statusFilter && view === 'cards' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', marginBottom: 8, fontSize: 12 }}>
          <span style={{ color: '#0369a1', fontWeight: 600 }}>
            Filtered: {statusFilter === 'invoiced' ? 'Invoiced' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} ({sorted.length} claim{sorted.length !== 1 ? 's' : ''})
          </span>
          <button onClick={() => onStatusFilterChange?.(null)} style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 4, border: '1px solid #93c5fd', background: '#fff', color: '#2563eb', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
            Clear filter
          </button>
        </div>
      )}

      {/* ── CARDS VIEW ────────────────────────────────────────── */}
      {view === 'cards' && sorted.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map(c => (
            <PracticeClaimCard
              key={c.id}
              claim={c}
              expanded={expandedClaimId === c.id}
              onToggle={() => onToggleCard(c.id)}
              onSubmit={onSubmit}
              onResubmit={onResubmit}
              onUpdateClaimNotes={onUpdateClaimNotes}
              onDeleteClaim={onDeleteClaim}
              onContinueDraft={onContinueDraft}
              showPracticeName={directorMode}
              saving={saving}
            />
          ))}
        </div>
      )}

      {/* ── INVOICES VIEW ─────────────────────────────────────── */}
      {view === 'invoices' && (
        <div>
          {/* Download all bar */}
          {invoicedClaims.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f5f3ff', borderRadius: 8, marginBottom: 10, border: '1px solid #e9d5ff' }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                {invoicedClaims.length} invoice{invoicedClaims.length !== 1 ? 's' : ''} available
                {' · '}total {fmtGBP(invoicedClaims.reduce((s, c) => s + claimTotal(c), 0))}
              </span>
              <button onClick={handleDownloadAll} disabled={downloadingAll} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 6, border: '1px solid #c4b5fd', background: '#7c3aed', color: '#fff', fontSize: 11, fontWeight: 600, cursor: downloadingAll ? 'wait' : 'pointer', opacity: downloadingAll ? 0.7 : 1 }}>
                <Download style={{ width: 13, height: 13 }} />
                {downloadingAll ? 'Downloading…' : `Download All (${invoicedClaims.length})`}
              </button>
            </div>
          )}

          {/* Invoice rows */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {sorted.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No invoices in this period.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                      {['Month', 'Staff Member', 'Category', 'Invoice No.', 'Amount', 'Status', 'Download'].map((h, i) => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: i >= 4 ? 'right' : 'left', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.04em', whiteSpace: 'nowrap' as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(c => {
                      const staffDets = (c.staff_details as any[]) || [];
                      const firstName = staffDets[0]?.staff_name || '—';
                      const moreName = staffDets.length > 1 ? ` +${staffDets.length - 1}` : '';
                      const primaryCat = staffDets[0]?.staff_category || '';
                      const monthLabel = getClaimMonthLabel(c);
                      const hasInvoice = !!c.invoice_number;
                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' as const }}>{monthLabel}</td>
                          <td style={{ padding: '8px 10px' }}>{firstName}{moreName}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, color: catColor(primaryCat), background: `${catColor(primaryCat)}14` }}>
                              {catLabel(primaryCat)}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11 }}>
                            {c.invoice_number || <span style={{ color: '#d1d5db', fontStyle: 'italic' }}>No invoice yet</span>}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{fmtGBP(claimTotal(c))}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, color: statusColor(c.status), background: `${statusColor(c.status)}14` }}>
                              {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                            {hasInvoice ? (
                              <button onClick={() => handleDownloadOne(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: '1px solid #e9d5ff', background: '#f5f3ff', color: '#7c3aed', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                <Download style={{ width: 11, height: 11 }} /> PDF
                              </button>
                            ) : (
                              <span style={{ color: '#d1d5db', fontSize: 11 }}>Pending</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f9fafb' }}>
                      <td colSpan={4} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>
                        {sorted.length} claim{sorted.length !== 1 ? 's' : ''} · {invoicedClaims.length} invoiced
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                        {fmtGBP(sorted.reduce((s, c) => s + claimTotal(c), 0))}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SPREADSHEET VIEW ──────────────────────────────────── */}
      {view === 'spreadsheet' && (
        <div>
          {/* Filter bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {directorMode && practiceOptions && onPracticeFilterChange && (
              <select
                value={practiceFilter || 'all'}
                onChange={e => onPracticeFilterChange(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 11, color: '#374151', background: '#fff', fontWeight: 600 }}
                title="Filter by practice"
              >
                <option value="all">All Practices</option>
                {practiceOptions.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
              </select>
            )}
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 11, color: '#374151', background: '#fff' }}>
              <option value="all">All Months</option>
              {uniqueMonths.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 11, color: '#374151', background: '#fff' }}>
              <option value="all">All Categories</option>
              {uniqueCategories.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
            </select>
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 11, color: '#374151', background: '#fff' }}>
              <option value="all">All Roles</option>
              {uniqueRoles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={filterName} onChange={e => setFilterName(e.target.value)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 11, color: '#374151', background: '#fff' }}>
              <option value="all">All Staff</option>
              {uniqueNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            {(filterMonth !== 'all' || filterCategory !== 'all' || filterRole !== 'all' || filterName !== 'all') && (
              <button onClick={() => { setFilterMonth('all'); setFilterCategory('all'); setFilterRole('all'); setFilterName('all'); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                Clear Filters
              </button>
            )}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{filteredLines.length} of {flatLines.length} lines</span>
            <button onClick={handleExcelExport} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 6, border: '1px solid #86efac', background: '#166534', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              <FileText style={{ width: 13, height: 13 }} />
              Export to Excel
            </button>
          </div>

          {/* Flat table — one row per staff line */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                    {([
                      ...(directorMode ? [{ key: 'practice', label: 'Practice', align: 'left' as const }] : []),
                      { key: 'month', label: 'Month', align: 'left' as const },
                      { key: 'name', label: 'Staff Name', align: 'left' as const },
                      { key: 'role', label: 'Role', align: 'left' as const },
                      { key: 'category', label: 'Category', align: 'left' as const },
                      { key: 'allocation', label: 'Allocation', align: 'left' as const },
                      { key: 'max', label: 'Max £', align: 'right' as const },
                      { key: 'claimed', label: 'Claimed £', align: 'right' as const },
                      { key: 'invoice', label: 'Invoice No.', align: 'left' as const },
                      { key: 'status', label: 'Status', align: 'right' as const },
                      { key: 'paid', label: 'Paid Date', align: 'right' as const },
                    ]).map(col => (
                      <th key={col.key} onClick={() => handleSort(col.key)} style={{ padding: '8px 10px', textAlign: col.align as any, fontSize: 10, fontWeight: 600, color: sortCol === col.key ? '#111827' : '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.04em', whiteSpace: 'nowrap' as const, cursor: 'pointer', userSelect: 'none' }}>
                        {col.label}{sortArrow(col.key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLines.map((l, idx) => (
                    <tr key={`${l.claimId}-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      {directorMode && (
                        <td style={{ padding: '8px 10px', fontWeight: 500, color: '#005eb8', whiteSpace: 'nowrap' as const }}>
                          {getPracticeName(l.claim.practice_key)}
                        </td>
                      )}
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' as const }}>{l.monthLabel}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 500 }}>{l.staff.staff_name || '—'}</td>
                      <td style={{ padding: '8px 10px' }}>{l.staff.staff_role || '—'}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, color: catColor(l.staff.staff_category), background: `${catColor(l.staff.staff_category)}14` }}>
                          {catLabel(l.staff.staff_category)}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px' }}>{l.allocDisplay}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 11 }}>{fmtGBP(l.maxAmt)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                        {fmtGBP(l.claimedAmt)}
                        {l.isBelow && <span style={{ color: '#d97706', fontSize: 9, marginLeft: 4 }}>(below max)</span>}
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11 }}>
                        {l.claim.invoice_number ? (
                          <InvoiceDownloadLink claim={l.claim} />
                        ) : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, color: statusColor(l.claim.status), background: `${statusColor(l.claim.status)}14` }}>
                          {l.claim.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11 }}>
                        {l.claim.paid_at ? new Date(l.claim.paid_at).toLocaleDateString('en-GB') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f9fafb' }}>
                    <td colSpan={directorMode ? 6 : 5} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>
                      {filteredLines.length} line{filteredLines.length !== 1 ? 's' : ''}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, fontSize: 12 }}>
                      {fmtGBP(filteredLines.reduce((s, l) => s + l.maxAmt, 0))}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                      {fmtGBP(filteredLines.reduce((s, l) => s + l.claimedAmt, 0))}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div style={{ marginTop: 8, fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
            The Excel export includes full audit details including submission dates, verifier, approver, GL codes and calculation notes.
          </div>
        </div>
      )}
    </div>
  );
}

// --- Claim Card (preserved) ---
/** Read-only collapsible Supporting Evidence section for the Practice view */
function PracticeEvidenceSection({ claimId, staffLines }: { claimId: string; staffLines: any[] }) {
  const { getUploadedTypesForStaff, getFilesForStaff, getDownloadUrl } = useNRESClaimEvidence(claimId);
  const [expanded, setExpanded] = useState(false);
  const [openTrigger, setOpenTrigger] = useState<number | undefined>(undefined);
  const totalFiles = staffLines.reduce((sum: number, _: any, idx: number) => sum + getFilesForStaff(idx).length, 0);
  const hasAnyFiles = totalFiles > 0 || staffLines.some((_: any, idx: number) => Object.keys(getUploadedTypesForStaff(idx)).length > 0);
  if (!hasAnyFiles) return null;

  const handleViewAll = (e: React.MouseEvent | React.KeyboardEvent) => {
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
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleViewAll(e); } }}
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}
          >
            <Eye className="w-3.5 h-3.5" /> View Evidence
          </span>
        )}
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

function PracticeClaimCard({ claim, expanded, onToggle, onSubmit, onResubmit, onUpdateClaimNotes, onDeleteClaim, onContinueDraft, showPracticeName, saving }: {
  claim: BuyBackClaim;
  expanded: boolean;
  onToggle: () => void;
  onSubmit?: (id: string, practiceNotes?: string) => void;
  onResubmit?: (id: string, notes?: string) => void;
  onUpdateClaimNotes?: (id: string, notes: string) => Promise<void>;
  onDeleteClaim?: (id: string) => Promise<void>;
  onContinueDraft?: (claim: BuyBackClaim) => void;
  showPracticeName?: boolean;
  saving?: boolean;
}) {
  const [queryResponse, setQueryResponse] = useState('');
  const [deletingClaim, setDeletingClaim] = useState(false);
  const [invoiceDescription, setInvoiceDescription] = useState((claim as any).practice_notes || '');
  const total = claimTotal(claim);
  const hours = claimHours(claim);
  const staffCount = claimStaffCount(claim);
  const isDraft = claim.status === 'draft';
  const isQueried = claim.status === 'queried';
  const needsAction = isDraft || isQueried;
  const monthLabel = getClaimMonthLabel(claim);

  const staffDets = (claim.staff_details || []) as any[];

  useEffect(() => {
    setInvoiceDescription((claim as any).practice_notes || '');
  }, [claim.id, (claim as any).practice_notes]);

  // Staff names for collapsed summary — show up to 2 names
  const staffNames = staffDets.map((s: any) => s.staff_name).filter(Boolean);
  const staffSummary = staffNames.length === 0 ? null
    : staffNames.length === 1 ? staffNames[0]
    : staffNames.length === 2 ? staffNames.join(' & ')
    : staffNames.slice(0, 2).join(', ') + ` +${staffNames.length - 2} more`;

  // Primary category from first staff member
  const primaryCategory = staffDets[0]?.staff_category as string | undefined;
  const categoryLabel = CATEGORY_LABELS[primaryCategory || ''] || null;
  const categoryColor = CATEGORY_COLORS[primaryCategory || ''] || '#6b7280';

  const { uploading, uploadEvidence, deleteEvidence, getDownloadUrl, getUploadedTypesForStaff, getFilesForStaff } = useNRESClaimEvidence(claim.id);
  const { getConfigForCategory } = useNRESEvidenceConfig();
  const { allComplete: evidenceComplete, totalMandatory, totalUploaded } = useStaffLineEvidenceComplete(
    staffDets, getUploadedTypesForStaff, getConfigForCategory
  );

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
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 18px', border: 'none', background: 'transparent',
        cursor: 'pointer', textAlign: 'left',
      }}>
        <ChevronDown
          style={{
            width: 16, height: 16, color: '#94a3b8', flexShrink: 0,
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 6, minWidth: 0 }}>
          {/* Row 1 — captioned identification fields */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' as const }}>
            {/* Claim ID moved into expanded view */}
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 0.6 }}>Claim Period</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{monthLabel}</span>
            </div>
            {showPracticeName && claim.practice_key && (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 0.6 }}>Practice</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{getPracticeName(claim.practice_key)}</span>
              </div>
            )}
            {staffSummary && (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 0.6 }}>Staff</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{staffSummary}</span>
              </div>
            )}
          </div>
          {/* Row 2 — category & alerts (status moved to centre) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
            {categoryLabel ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6,
                fontSize: 10, fontWeight: 600,
                color: categoryColor, background: `${categoryColor}12`, border: `1px solid ${categoryColor}30`,
              }}>{categoryLabel}</span>
            ) : (
              (() => {
                const cfg = claim.claim_type === 'additional'
                  ? { label: 'Additional', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' }
                  : { label: 'Buy-Back', color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' };
                return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>;
              })()
            )}
            {isQueried && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: '#dc2626' }}>
                <AlertTriangle style={{ width: 12, height: 12 }} /> Action required
              </span>
            )}
            {isDraft && <span style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>Not yet submitted</span>}
          </div>
        </div>
        {/* Centre — Status with caption */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2, alignItems: 'center', flexShrink: 0, padding: '0 16px' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 0.6 }}>Status</span>
          <StatusPill status={claim.status} />
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 90, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmtGBP(total)}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>
              {staffDets[0]?.staff_role && `${staffDets[0].staff_role}`}
              {staffDets[0]?.staff_role && staffCount > 1 && ` +${staffCount - 1}`}
              {!staffDets[0]?.staff_role && `${staffCount} staff`}
            </div>
          </div>
          {claim.invoice_number && (
            <div onClick={(e) => e.stopPropagation()}>
              <InvoiceDownloadLink claim={claim} />
            </div>
          )}
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '0 18px 18px' }}>
          <div style={{
            display: 'flex', flexWrap: 'wrap' as const, gap: 20, padding: '14px 0 12px',
            fontSize: 12, color: '#6b7280', borderBottom: '1px solid #f3f4f6',
          }}>
            {claim.claim_ref != null && (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 0.6 }}>Claim ID</span>
                <span
                  title="Claim ID — use this when communicating about this claim"
                  style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 13, fontWeight: 700, color: '#1e293b', background: '#f1f5f9', border: '1px solid #cbd5e1', fontFamily: 'monospace', letterSpacing: 0.3, alignSelf: 'flex-start', whiteSpace: 'nowrap' as const }}
                >
                  #{claim.claim_ref}
                </span>
              </div>
            )}
            {claim.submitted_at && <InfoBlock label="Submitted by" value={(claim as any).submitted_by_name || emailToName(claim.submitted_by_email || '') || 'Practice'} sub={dateStr(claim.submitted_at)} />}
            {claim.verified_by && <InfoBlock label="Verified by" value={emailToName(claim.verified_by)} sub={dateStr(claim.verified_at)} />}
            {claim.approved_by_email && <InfoBlock label="Approved by" value={emailToName(claim.approved_by_email)} sub={dateStr(claim.reviewed_at || (claim as any).approved_at)} highlight="#7c3aed" />}
            {claim.invoice_generated_at && <InfoBlock label="Invoice date" value={shortDate(claim.invoice_generated_at)} />}
            {claim.invoice_generated_at && <InfoBlock label="Payment terms" value="Net 30 days" sub={`Due ${dueDate(claim.invoice_generated_at)}`} />}
            {claim.expected_payment_date && !claim.paid_at && <InfoBlock label="Scheduled payment" value={new Date(claim.expected_payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} highlight="#d97706" />}
            {claim.bacs_reference && <InfoBlock label="BACS ref" value={claim.bacs_reference} />}
            {claim.paid_at && <InfoBlock label="Paid" value={shortDate(claim.actual_payment_date || claim.paid_at)} highlight="#166534" sub={claim.paid_by ? emailToName(claim.paid_by) + ' · PML Finance' : undefined} />}
            {claim.invoice_number && <InvoiceDownloadLink claim={claim} />}
          </div>

          {isQueried && claim.query_notes && (
            <div style={{
              marginTop: 10, padding: '12px 14px', borderRadius: 8, fontSize: 13,
              background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <AlertTriangle style={{ width: 14, height: 14 }} /> Query from {(claim as any).queried_by_role || 'Reviewer'}{(claim as any).queried_by ? ` (${(claim as any).queried_by})` : ''}
                {(claim as any).queried_at && (
                  <span style={{ fontWeight: 400, fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>
                    {format(new Date((claim as any).queried_at), 'd MMM yyyy, HH:mm')}
                  </span>
                )}
              </div>
              {claim.query_notes.replace(/\n?\n?\[FLAGGED_LINES:\[[\d,]*\]\]/, '')}
            </div>
          )}

          {claim.verified_notes && (
            <div style={{
              marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12,
              background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0c4a6e',
            }}>
              <strong>Part B Substantiation:</strong> {claim.verified_notes}
            </div>
          )}

          {claim.payment_notes && (
            <div style={{
              marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12,
              background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534',
            }}>
              <strong>Finance:</strong> {claim.payment_notes}
            </div>
          )}

          {(() => {
            const hasLocum = staffDets.some((s: any) => s.staff_category === 'gp_locum');
            const MINUTES_PER_SESSION = 250; // 4h 10m
            const headers = hasLocum
              ? ['Name', 'Role', 'GL Cat', 'Sessions', 'Date', 'Hours Worked', 'Hrs', 'Amount', 'Max Claimable']
              : ['Name', 'Role', 'GL Cat', 'Allocation', 'Amount', 'Max Claimable'];
            const rightAlignFrom = hasLocum ? 5 : 3;
            const colCount = headers.length;

            const formatLocumHrs = (sessions: number) => {
              const totalMins = Math.round(sessions * MINUTES_PER_SESSION);
              const h = Math.floor(totalMins / 60);
              const m = totalMins % 60;
              return { display: m > 0 ? `${h}h ${m}m` : `${h}h`, decimal: (totalMins / 60).toFixed(1) };
            };

            const totalLocumHrs = hasLocum ? staffDets.reduce((sum: number, s: any) => {
              const sess = s.staff_category === 'gp_locum' ? (s.allocation_value || 0) : 0;
              return sum + Math.round(sess * MINUTES_PER_SESSION) / 60;
            }, 0) : 0;

            // Max claimable helper inline
            const fmtMoney = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const getMaxInfo = (s: any) => {
              const cat = s.staff_category || 'buyback';
              const allocVal = s.allocation_value ?? 0;
              const calcAmt = s.calculated_amount ?? 0;
              const role = s.staff_role || '';
              if (cat === 'gp_locum') {
                if (s.allocation_type === 'daily') {
                  const max = calcAmt || allocVal * 750;
                  return { max, formula: `${allocVal} day${allocVal === 1 ? '' : 's'} × £750/day = ${fmtMoney(max)}` };
                }
                const max = calcAmt || allocVal * 375;
                return { max, formula: `${allocVal} session${allocVal === 1 ? '' : 's'} × £375/session = ${fmtMoney(max)}` };
              }
              if (cat === 'meeting') {
                const hrs = s.total_hours ?? allocVal ?? 0;
                const rate = s.hourly_rate ?? 0;
                const max = calcAmt || hrs * rate;
                return { max, formula: `${hrs} hr${hrs === 1 ? '' : 's'} × £${rate}/hr = ${fmtMoney(max)}` };
              }
              if (cat === 'management' && s.allocation_type === 'hours') {
                const rate = s.hourly_rate ?? 0;
                const wks = (rate > 0 && allocVal > 0 && calcAmt > 0) ? (calcAmt / (allocVal * rate)) : 0;
                return { max: calcAmt, formula: `${allocVal} hrs/wk × ${wks ? wks.toFixed(2) : '?'} working wks × £${rate}/hr = ${fmtMoney(calcAmt)}` };
              }
              if (calcAmt > 0) {
                if (s.allocation_type === 'sessions') return { max: calcAmt, formula: `${allocVal} session${allocVal === 1 ? '' : 's'}/wk × ${role} annual rate (incl. on-costs) ÷ 12 = ${fmtMoney(calcAmt)}` };
                if (s.allocation_type === 'hours') {
                  const isSessionPriced = !!s.is_session_priced || isSessionPricedRole(role, undefined, s.hourly_rate_with_on_costs ? 10500 : undefined);
                  return isSessionPriced
                    ? { max: calcAmt, formula: `${allocVal} hrs/wk ÷ 4 hrs 10 mins/session × ${role} per-session annual rate (incl. on-costs) ÷ 12 = ${fmtMoney(calcAmt)}` }
                    : { max: calcAmt, formula: `${allocVal} hrs/wk ÷ 37.5 × ${role} annual rate (incl. on-costs) ÷ 12 = ${fmtMoney(calcAmt)}` };
                }
                if (s.allocation_type === 'daily') return { max: calcAmt, formula: `${allocVal} day${allocVal === 1 ? '' : 's'} × daily rate = ${fmtMoney(calcAmt)}` };
                if (s.allocation_type === 'wte') return { max: calcAmt, formula: `${allocVal} WTE × ${role} annual rate (incl. on-costs) ÷ 12 = ${fmtMoney(calcAmt)}` };
                return { max: calcAmt, formula: `${role || 'Role'} max for the month = ${fmtMoney(calcAmt)}` };
              }
              return { max: 0, formula: '—' };
            };

            const totalClaimed = staffDets.reduce((sum: number, s: any) => sum + (s.claimed_amount ?? s.calculated_amount ?? 0), 0);
            const totalMax = staffDets.reduce((sum: number, s: any) => sum + getMaxInfo(s).max, 0);

            return (
              <div style={{ margin: '12px 0 0' }}>
                <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {headers.map((h, i) => (
                        <th key={h} style={{
                          textAlign: i >= rightAlignFrom ? 'right' : 'left', padding: '7px 10px',
                          fontSize: 11, fontWeight: 600, color: h === 'Max Claimable' ? '#9ca3af' : '#6b7280',
                          textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                          borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' as const,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffDets.map((s: any, i: number) => {
                      const isLocum = s.staff_category === 'gp_locum';
                      const locumHrs = isLocum ? formatLocumHrs(s.allocation_value || 0) : null;
                      const claimedAmt = s.claimed_amount ?? s.calculated_amount ?? 0;
                      const maxInfo = getMaxInfo(s);
                      const overMax = maxInfo.max > 0 && claimedAmt > maxInfo.max;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '10px', fontWeight: 500, color: '#111827' }}>{s.staff_name || '—'}</td>
                          <td style={{ padding: '10px', color: '#374151' }}>{s.staff_role || '—'}</td>
                          <td style={{ padding: '10px' }}>
                            <code style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f3f4f6', color: '#374151' }}>
                              {getSDAClaimGLCode(s, claim.claim_type || 'buyback') || '—'}
                            </code>
                          </td>
                          {hasLocum ? (
                            <>
                              <td style={{ padding: '10px', textAlign: 'center', color: '#374151', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                {isLocum ? (s.allocation_value || 0) : '—'}
                              </td>
                              <td style={{ padding: '10px', color: '#374151' }}>{s.start_date ? new Date(s.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}</td>
                              <td style={{ padding: '10px', textAlign: 'right', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                                {isLocum && locumHrs ? locumHrs.display : '—'}
                              </td>
                              <td style={{ padding: '10px', textAlign: 'right', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                                {isLocum && locumHrs ? locumHrs.decimal : '—'}
                              </td>
                            </>
                          ) : (
                            <td style={{ padding: '10px', textAlign: 'right', color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                              {s.allocation_value} {s.allocation_type}
                            </td>
                          )}
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: overMax ? '#dc2626' : '#111827' }}>
                            {fmtGBP(claimedAmt)}
                            {overMax && <span style={{ marginLeft: 4, fontSize: 10, color: '#dc2626', fontWeight: 700 }}>!</span>}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11, color: '#9ca3af' }}>
                            {maxInfo.max > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 2 }}>
                                <span title={maxInfo.formula}>{fmtGBP(maxInfo.max)}</span>
                                <span style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.35, textAlign: 'right' as const, maxWidth: 260, fontStyle: 'italic' as const }}>
                                  {maxInfo.formula}
                                </span>
                              </div>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      {hasLocum ? (
                        <>
                          <td colSpan={colCount - 4} style={{ padding: '10px' }} />
                          <td style={{ padding: '10px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const }}>Total</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: '#374151', fontVariantNumeric: 'tabular-nums', borderTop: '2px solid #e5e7eb' }}>
                            {totalLocumHrs.toFixed(1)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td colSpan={colCount - 3} style={{ padding: '10px' }} />
                          <td style={{ padding: '10px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const }}>Total</td>
                        </>
                      )}
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

          {(isDraft || isQueried) && (
            <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 8, border: '1px solid #dbeafe', background: '#eff6ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a8a' }}>Invoice description / claim details</div>
                <span style={{ fontSize: 11, color: invoiceDescription.length > 1400 ? '#b45309' : '#64748b' }}>{invoiceDescription.length}/1500</span>
              </div>
              <textarea
                value={invoiceDescription}
                maxLength={1500}
                onChange={(e) => setInvoiceDescription(e.target.value)}
                placeholder="Add dates, times or notes to print on the invoice, e.g. 03/04/2026 10:00–12:00 Programme planning meeting."
                style={{ width: '100%', minHeight: 78, resize: 'vertical', padding: '9px 10px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#fff', fontSize: 13, lineHeight: 1.45, outline: 'none', color: '#0f172a' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' as const }}>
                <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>This text will appear on the generated invoice.</p>
                {onUpdateClaimNotes && (
                  <button
                    onClick={() => onUpdateClaimNotes(claim.id, invoiceDescription)}
                    disabled={saving}
                    style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #93c5fd', background: '#fff', color: '#1d4ed8', fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
                  >
                    Save description
                  </button>
                )}
              </div>
            </div>
          )}

          {!isDraft && !isQueried && (claim as any).practice_notes && (() => {
            const notes = String((claim as any).practice_notes || '');
            const rows = notes.split('\n').map(l => l.trim()).filter(Boolean)
              .map(l => l.split('|').map(c => c.trim()))
              .filter(parts => parts.length >= 4 && /^\d{1,2}[\/\-.]\d{1,2}/.test(parts[0]));
            const isTable = rows.length > 0;
            return (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#eff6ff', fontSize: 12, color: '#1e3a8a' }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Invoice description</div>
                {isTable ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: 12 }}>
                      <thead>
                        <tr>{['Date', 'Start', 'Stop', 'Description'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '5px 8px', border: '1px solid #bfdbfe', color: '#1e3a8a', background: '#dbeafe' }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i}>
                            <td style={{ padding: '5px 8px', border: '1px solid #bfdbfe' }}>{r[0]}</td>
                            <td style={{ padding: '5px 8px', border: '1px solid #bfdbfe' }}>{r[1]}</td>
                            <td style={{ padding: '5px 8px', border: '1px solid #bfdbfe' }}>{r[2]}</td>
                            <td style={{ padding: '5px 8px', border: '1px solid #bfdbfe' }}>{r.slice(3).join(' | ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{notes}</div>
                )}
              </div>
            );
          })()}

          {(isDraft || isQueried) && (
            <div style={{ marginTop: 12 }}>
              {staffDets.map((s: any, idx: number) => (
                <StaffLineEvidence
                  key={idx}
                  staffCategory={(s.staff_category || 'buyback') as 'buyback' | 'new_sda' | 'management' | 'gp_locum'}
                  staffIndex={idx}
                  staffName={s.staff_name}
                  staffRole={s.staff_role}
                  uploadedTypesForStaff={getUploadedTypesForStaff(idx)}
                  allFilesForStaff={getFilesForStaff(idx)}
                  canEdit
                  uploading={uploading}
                  onUpload={uploadEvidence}
                  onDelete={deleteEvidence}
                  onDownload={getDownloadUrl}
                />
              ))}
            </div>
          )}
          {!isDraft && !isQueried && staffDets.length > 0 && (
            <PracticeEvidenceSection claimId={claim.id} staffLines={staffDets} />
          )}

          {isDraft && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
              {!evidenceComplete && (
                <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 500 }}>
                  Upload all required evidence before submitting ({totalUploaded}/{totalMandatory})
                </span>
              )}
              <button
                onClick={() => onSubmit?.(claim.id, invoiceDescription)}
                disabled={saving || !evidenceComplete}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 18px',
                  borderRadius: 8, border: 'none', background: '#005eb8', color: '#fff',
                  fontSize: 13, fontWeight: 600, cursor: (saving || !evidenceComplete) ? 'not-allowed' : 'pointer',
                  opacity: (saving || !evidenceComplete) ? 0.5 : 1,
                }}
              >
                <Send style={{ width: 14, height: 14 }} />
                Submit Claim
              </button>
              {onDeleteClaim && (
                <button
                  onClick={async () => {
                    const confirmed = window.confirm(
                      'Are you sure you want to delete this draft claim?\n\nAll claim data and any uploaded supporting evidence will be permanently deleted.\n\nThis action cannot be undone.'
                    );
                    if (!confirmed) return;
                    setDeletingClaim(true);
                    try {
                      await onDeleteClaim(claim.id);
                    } finally {
                      setDeletingClaim(false);
                    }
                  }}
                  disabled={saving || deletingClaim}
                  title="Delete this draft claim"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px',
                    borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#dc2626',
                    fontSize: 13, fontWeight: 600, cursor: (saving || deletingClaim) ? 'not-allowed' : 'pointer',
                    opacity: (saving || deletingClaim) ? 0.6 : 1,
                  }}
                >
                  <Trash2 style={{ width: 14, height: 14 }} />
                  {deletingClaim ? 'Deleting…' : 'Delete Draft'}
                </button>
              )}
            </div>
          )}

          {isQueried && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Reply style={{ width: 14, height: 14 }} /> Respond to Query
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
                <input
                  type="text"
                  value={queryResponse}
                  onChange={(e) => setQueryResponse(e.target.value)}
                  placeholder={`Your response to the ${(claim as any).queried_by_role || 'Reviewer'} query…`}
                  style={{ flex: 1, minWidth: 250, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
                />
                <button
                  onClick={async () => { await onUpdateClaimNotes?.(claim.id, invoiceDescription); onResubmit?.(claim.id, queryResponse); setQueryResponse(''); }}
                  disabled={saving || deletingClaim}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 18px',
                    borderRadius: 8, border: 'none', background: '#059669', color: '#fff',
                    fontSize: 13, fontWeight: 600, cursor: (saving || deletingClaim) ? 'not-allowed' : 'pointer',
                    opacity: (saving || deletingClaim) ? 0.6 : 1,
                  }}
                >
                  <Send style={{ width: 14, height: 14 }} />
                  Resubmit
                </button>
                {onDeleteClaim && (
                  <button
                    onClick={async () => {
                      const confirmed = window.confirm(
                        'Are you sure you want to delete this claim?\n\nAll submission data for this claim will be permanently deleted, including any supporting documents and evidence.\n\nThis action cannot be undone.'
                      );
                      if (!confirmed) return;
                      setDeletingClaim(true);
                      try {
                        await onDeleteClaim(claim.id);
                      } finally {
                        setDeletingClaim(false);
                      }
                    }}
                    disabled={saving || deletingClaim}
                    title="Delete this returned claim"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px',
                      borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#dc2626',
                      fontSize: 13, fontWeight: 600, cursor: (saving || deletingClaim) ? 'not-allowed' : 'pointer',
                      opacity: (saving || deletingClaim) ? 0.6 : 1,
                    }}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                    {deletingClaim ? 'Deleting…' : 'Delete Claim'}
                  </button>
                )}
              </div>
            </div>
          )}

          {claim.status === 'submitted' && (
            <div style={{
              marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af',
            }}>
              <Clock style={{ width: 14, height: 14 }} /> Awaiting verification by Managerial Lead before Director review
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Main Dashboard ---
export function BuyBackPracticeDashboard({
  claims, practiceKey, staff, staffRoles, rateParams, managementRoles,
  onSubmit, onResubmit, onUpdateClaimNotes, onCreateClaim, onCreateLocumClaim, onDeleteClaim,
  onAddStaff, onRemoveStaff, onUpdateStaff, confirmDeclaration,
  savingClaim, savingStaff, onGuideOpen, onSettingsOpen, showSettings,
  meetingLogEntries, onAddMeetingEntry, onDeleteMeetingEntry, onSubmitMeetingEntries, canAddOnBehalf,
}: BuyBackPracticeDashboardProps) {
  const [activeClaimKey, setActiveClaimKey] = useState<string | null>(null);
  const [expandedClaimId, setExpandedClaimId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const claimsRef = React.useRef<HTMLDivElement>(null);
  const rosterRef = React.useRef<HTMLDivElement>(null);

  const practiceName = getPracticeName(practiceKey);
  const practiceCode = NRES_ODS_CODES[practiceKey] || '—';
  const contact = NRES_PRACTICE_CONTACTS[practiceKey as keyof typeof NRES_PRACTICE_CONTACTS];
  const managerName = contact?.practiceManager || '—';

  const claimMonths = useMemo(() => getClaimMonths(), []);

  // Filter claims for this practice
  const practiceClaims = useMemo(() =>
    claims.filter(c => c.practice_key === practiceKey),
    [claims, practiceKey]
  );

  // Group staff by category
  const buybackStaff = useMemo(() => staff.filter(s => s.staff_category === 'buyback' && s.is_active), [staff]);
  const gpLocumStaff = useMemo(() => staff.filter(s => s.staff_category === 'gp_locum' && s.is_active), [staff]);
  const newSdaStaff = useMemo(() => staff.filter(s => s.staff_category === 'new_sda' && s.is_active), [staff]);

  // Convert management roles to staff-like shape
  const managementStaff = useMemo<BuyBackStaffMember[]>(() => {
    const practiceOdsCode = NRES_ODS_CODES[practiceKey] || '';
    if (!managementRoles) return staff.filter(s => (s.staff_category === 'management' || s.staff_category === 'meeting') && s.is_active);
    const fromConfig = managementRoles
      .filter(r => {
        if (!r.is_active) return false;
        const hasBillingOrg = !!r.billing_org_code;
        const hasMemberPractice = !!r.member_practice;
        if (!hasBillingOrg && !hasMemberPractice) return true;
        if (hasBillingOrg && practiceOdsCode && r.billing_org_code === practiceOdsCode) return true;
        if (hasMemberPractice && r.member_practice === practiceKey) return true;
        return false;
      })
      .map((r): BuyBackStaffMember => {
        const isMeetingRole = r.role_type === 'attending_meeting';
        return {
          id: r.key,
          user_id: '',
          practice_id: null,
          staff_name: r.person_name,
          staff_role: isMeetingRole ? r.label : 'NRES Management',
          allocation_type: 'hours' as const,
          allocation_value: isMeetingRole ? 0 : r.max_hours_per_week,
          hourly_rate: r.hourly_rate,
          is_active: true,
          staff_category: isMeetingRole ? 'meeting' as const : 'management' as const,
          practice_key: practiceKey,
          start_date: null,
          created_at: '',
          updated_at: '',
        };
      });
    const fromStaff = staff.filter(s => (s.staff_category === 'management' || s.staff_category === 'meeting') && s.is_active);
    const names = new Set(fromConfig.map(s => s.staff_name));
    return [...fromConfig, ...fromStaff.filter(s => !names.has(s.staff_name))];
  }, [managementRoles, staff, practiceKey]);

  // Flatten claims to individual staff lines for accurate KPI counts
  const kpiLines = useMemo(() => {
    return practiceClaims.flatMap(c => {
      const staffDets = (c.staff_details as any[]) || [];
      return staffDets.map((s: any) => ({
        status: c.status,
        amount: s.claimed_amount ?? s.calculated_amount ?? 0,
      }));
    });
  }, [practiceClaims]);

  // KPI counts per status (line-level)
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: kpiLines.length };
    kpiLines.forEach(l => { m[l.status] = (m[l.status] || 0) + 1; });
    return m;
  }, [kpiLines]);

  const totals = useMemo(() => {
    const t = { draft: 0, submitted: 0, verified: 0, approved: 0, invoiced: 0, paid: 0, queried: 0 };
    kpiLines.forEach(l => {
      if (l.status === 'draft') t.draft += l.amount;
      else if (l.status === 'submitted') t.submitted += l.amount;
      else if (l.status === 'verified') t.verified += l.amount;
      else if (l.status === 'approved') t.approved += l.amount;
      else if (l.status === 'invoiced') t.invoiced += l.amount;
      else if (l.status === 'paid') t.paid += l.amount;
      else if (l.status === 'queried') t.queried += l.amount;
    });
    return t;
  }, [kpiLines]);

  const queriedCount = counts.queried || 0;

  const handleClickClaim = (key: string) => {
    setActiveClaimKey(prev => prev === key ? null : key);
  };

  const handleContinueDraft = (claim: BuyBackClaim) => {
    const dets = (claim.staff_details || []) as any[];
    const first = dets[0];
    if (!first) return;
    // Find the matching staff/management roster entry
    const allRosterMembers = [...buybackStaff, ...gpLocumStaff, ...newSdaStaff, ...managementStaff];
    const member = allRosterMembers.find(m =>
      m.staff_name === first.staff_name && m.staff_role === first.staff_role
    );
    if (!member) {
      window.alert('Could not locate this staff member in the roster — they may have been removed.');
      return;
    }
    const monthKey = claim.claim_month.slice(0, 7) + '-01';
    setActiveClaimKey(`${member.id}_${monthKey}`);
    setTimeout(() => rosterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  // Claims history — all non-draft claims
  const historyClaims = useMemo(() => {
    const order: Record<string, number> = { queried: 0, draft: 1, submitted: 2, verified: 3, approved: 4, invoiced: 5, paid: 6, rejected: 7 };
    return [...practiceClaims].sort((a, b) => (order[a.status] ?? 99) - (order[b.status] ?? 99));
  }, [practiceClaims]);

  const rosterSectionProps = {
    claims: practiceClaims, claimMonths, practiceKey,
    onClickClaim: handleClickClaim, activeClaimKey,
    onAddStaff, onRemoveStaff, onUpdateStaff, staffRoles, rateParams,
    onCreateClaim, onCreateLocumClaim, onDeleteClaim, onSubmit, onResubmit,
    confirmDeclaration, saving: savingClaim,
    meetingLogEntries, onAddMeetingEntry, onDeleteMeetingEntry, onSubmitMeetingEntries,
    canAddOnBehalf, managementRoles,
  };

  return (
    <div style={{
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      maxWidth: 1000, margin: '0 auto', padding: '28px 16px',
      color: '#111827',
    }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap' as const, gap: 12 }}>
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
          <p style={{ margin: '2px 0 0 16px', fontSize: 13, color: '#6b7280' }}>
            Submit, manage and track your practice claims
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{practiceName}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{practiceCode} · {managerName}</div>
        </div>
      </div>

      {/* Queried alert banner */}
      {queriedCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', marginBottom: 16, borderRadius: 10,
          background: '#fffbeb', border: '1px solid #fde68a',
          fontSize: 13, color: '#92400e',
        }}>
          <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
          <span>
            <strong>{queriedCount} claim{queriedCount !== 1 ? 's' : ''} need your attention</strong>
            {' — please respond to the queries below'}
          </span>
        </div>
      )}

      {/* KPI cards — clickable to filter claims */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 20 }}>
        <KpiCard label="Drafts" value={counts.draft || 0} sub={fmtShort(totals.draft)} accent={(counts.draft || 0) > 0 ? '#64748b' : '#d1d5db'} tooltip="Claims being prepared, not yet submitted to NRES" onClick={() => { setStatusFilter(statusFilter === 'draft' ? null : 'draft'); setTimeout(() => claimsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} active={statusFilter === 'draft'} />
        <KpiCard label="Awaiting Verification" value={counts.submitted || 0} sub={fmtShort(totals.submitted)} accent="#2563eb" tooltip="Submitted by practice, awaiting NRES Verification" onClick={() => { setStatusFilter(statusFilter === 'submitted' ? null : 'submitted'); setTimeout(() => claimsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} active={statusFilter === 'submitted'} />
        <KpiCard label="Awaiting Approval" value={counts.verified || 0} sub={fmtShort(totals.verified)} accent="#7c3aed" tooltip="Verified by NRES, awaiting PML Finance Director Approval" onClick={() => { setStatusFilter(statusFilter === 'verified' ? null : 'verified'); setTimeout(() => claimsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} active={statusFilter === 'verified'} />
        <KpiCard label="Invoiced" value={(counts.approved || 0) + (counts.invoiced || 0)} sub={fmtShort(totals.approved + totals.invoiced)} accent="#d97706" tooltip="Approved and invoiced, awaiting payment" onClick={() => { setStatusFilter(statusFilter === 'invoiced' ? null : 'invoiced'); setTimeout(() => claimsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} active={statusFilter === 'invoiced'} />
        <KpiCard label="Paid" value={counts.paid || 0} sub={fmtShort(totals.paid)} accent="#16a34a" tooltip="Payment completed and confirmed" onClick={() => { setStatusFilter(statusFilter === 'paid' ? null : 'paid'); setTimeout(() => claimsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} active={statusFilter === 'paid'} />
        <KpiCard label="Queried" value={queriedCount} sub={fmtShort(totals.queried)} accent={queriedCount > 0 ? '#dc2626' : '#d1d5db'} tooltip="Returned with queries — action required from practice" onClick={() => { setStatusFilter(statusFilter === 'queried' ? null : 'queried'); setTimeout(() => claimsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }} active={statusFilter === 'queried'} />
      </div>

      {/* Staff Roster */}
      <div ref={rosterRef} style={{
        background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
        padding: '20px 20px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 20,
      }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Staff Roster</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>
            Manage the staff included in your monthly buy-back claims
          </div>
        </div>

        <StaffRosterSection
          title="Buy-Back"
          category="buyback"
          staffList={buybackStaff}
          showAddButton
          {...rosterSectionProps}
        />
        <StaffRosterSection
          title="GP Locum"
          category="gp_locum"
          staffList={gpLocumStaff}
          showAddButton
          {...rosterSectionProps}
        />
        <StaffRosterSection
          title="New SDA"
          category="new_sda"
          staffList={newSdaStaff}
          showAddButton
          {...rosterSectionProps}
        />
        <StaffRosterSection
          title="NRES Management & Meeting Attendance Claims"
          category="management"
          staffList={managementStaff}
          showAddButton
          {...rosterSectionProps}
        />
      </div>

      {/* Separator */}
      <div style={{ height: 1, background: '#e5e7eb', margin: '8px 0 20px' }} />

      {/* Unified Claims section */}
      <div ref={claimsRef}>
        <ClaimsViewSwitcher
          claims={practiceClaims}
          practiceKey={practiceKey}
          practiceName={practiceName}
          onToggleCard={(id) => setExpandedClaimId(expandedClaimId === id ? null : id)}
          expandedClaimId={expandedClaimId}
          onSubmit={onSubmit}
          onResubmit={onResubmit}
          onUpdateClaimNotes={onUpdateClaimNotes}
          onDeleteClaim={onDeleteClaim}
          onContinueDraft={handleContinueDraft}
          saving={savingClaim}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 20, padding: '12px 0', borderTop: '1px solid #e5e7eb',
        display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af',
      }}>
        <span>NRES New Models of Care — {practiceName} Claims</span>
        <span>{staff.length} staff · {practiceClaims.length} claim{practiceClaims.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
