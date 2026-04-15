import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, AlertTriangle, CheckCircle2, XCircle, Send, Clock, Reply, Plus, User, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import { getPracticeName, NRES_ODS_CODES, NRES_PRACTICE_CONTACTS } from '@/data/nresPractices';
import type { BuyBackClaim, RateParams } from '@/hooks/useNRESBuyBackClaims';
import type { BuyBackStaffMember } from '@/hooks/useNRESBuyBackStaff';
import type { ManagementRoleConfig } from '@/hooks/useNRESBuyBackRateSettings';
import { calculateStaffMonthlyAmount } from '@/hooks/useNRESBuyBackClaims';
import { InvoiceDownloadLink } from './InvoiceDownloadLink';
import { useNRESClaimEvidence } from '@/hooks/useNRESClaimEvidence';
import { useNRESEvidenceConfig } from '@/hooks/useNRESEvidenceConfig';
import { StaffLineEvidence, useStaffLineEvidenceComplete } from './ClaimEvidencePanel';

// --- Types ---
interface BuyBackPracticeDashboardProps {
  claims: BuyBackClaim[];
  practiceKey: string;
  staff: BuyBackStaffMember[];
  staffRoles?: string[];
  rateParams?: RateParams;
  managementRoles?: ManagementRoleConfig[];
  onSubmit?: (id: string) => void;
  onResubmit?: (id: string, notes?: string) => void;
  onCreateClaim?: (monthDate: string, staffMember: BuyBackStaffMember) => Promise<any>;
  onAddStaff?: (member: Omit<BuyBackStaffMember, 'id' | 'user_id' | 'practice_id' | 'created_at' | 'updated_at'>) => Promise<any>;
  onRemoveStaff?: (id: string) => Promise<void>;
  onUpdateStaff?: (id: string, updates: Partial<BuyBackStaffMember>) => Promise<any>;
  onCreateLocumClaim?: (monthDate: string, staffMember: BuyBackStaffMember, actualSessions: number, claimedAmount: number) => Promise<any>;
  onDeleteClaim?: (id: string) => Promise<void>;
  confirmDeclaration?: (id: string, confirmed: boolean) => Promise<void>;
  savingClaim?: boolean;
  savingStaff?: boolean;
}

// --- Constants ---
const DECLARATION_TEXT = "I confirm that all staff listed are working 100% on SDA (Part A) during their funded hours, with no LTC (Part B) activity, in accordance with the ICB-approved buy-back rules.";
const LOCUM_DECLARATION_TEXT = "I confirm this GP locum provided additional sessional SDA capacity. This claim represents the actual cost of sessions worked and does not exceed the ICB-approved maximum reimbursement rate. GP locums are by definition providing Part A SDA additional resource only — there is no LTC (Part B) activity.";
const PILOT_START = new Date(2026, 3, 1); // 1 April 2026

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  draft: { label: 'Draft', color: '#6b7280', bg: '#f9fafb', border: '#d1d5db', dot: '#9ca3af' },
  submitted: { label: 'Submitted', color: '#0369a1', bg: '#f0f9ff', border: '#7dd3fc', dot: '#38bdf8' },
  verified: { label: 'Pending', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', dot: '#3b82f6' },
  approved: { label: 'Approved', color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', dot: '#8b5cf6' },
  queried: { label: 'Queried!', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', dot: '#ef4444' },
  paid: { label: 'Paid', color: '#166534', bg: '#f0fdf4', border: '#86efac', dot: '#22c55e' },
  invoiced: { label: 'Invoiced', color: '#d97706', bg: '#fffbeb', border: '#fcd34d', dot: '#f59e0b' },
  rejected: { label: 'Rejected', color: '#991b1b', bg: '#fef2f2', border: '#fca5a5', dot: '#dc2626' },
};

const CATEGORY_COLORS: Record<string, string> = {
  buyback: '#0d9488',
  gp_locum: '#d97706',
  new_sda: '#7c3aed',
  management: '#005eb8',
};

const CATEGORY_LABELS: Record<string, string> = {
  buyback: 'Buy-Back',
  gp_locum: 'GP Locum',
  new_sda: 'New SDA',
  management: 'NRES Management & Meeting Attendance',
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

function getClaimMonths(): { label: string; monthDate: string; month: number; year: number }[] {
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

function findClaimForStaffMonth(claims: BuyBackClaim[], staffMember: BuyBackStaffMember, monthDate: string): BuyBackClaim | null {
  return claims.find(c => {
    if (c.claim_month.slice(0, 7) !== monthDate.slice(0, 7)) return false;
    const dets = (c.staff_details || []) as any[];
    return dets.some((s: any) => s.staff_name === staffMember.staff_name && s.staff_role === staffMember.staff_role);
  }) || null;
}

// --- Sub-components ---

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: accent, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{sub}</div>}
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
}: {
  staffMember: BuyBackStaffMember;
  monthDate: string;
  monthLabel: string;
  existingClaim: BuyBackClaim | null;
  rateParams?: RateParams;
  onCreateClaim?: (monthDate: string, staffMember: BuyBackStaffMember) => Promise<any>;
  onCreateLocumClaim?: (monthDate: string, staffMember: BuyBackStaffMember, actualSessions: number, claimedAmount: number) => Promise<any>;
  onDeleteClaim?: (id: string) => Promise<void>;
  onSubmit?: (id: string) => void;
  onResubmit?: (id: string, notes?: string) => void;
  confirmDeclaration?: (id: string, confirmed: boolean) => Promise<void>;
  onClose: () => void;
  saving?: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [declared, setDeclared] = useState(false);
  const [queryResponse, setQueryResponse] = useState('');
  const [localClaim, setLocalClaim] = useState<BuyBackClaim | null>(existingClaim);

  useEffect(() => { setLocalClaim(existingClaim); }, [existingClaim]);

  const isLocum = staffMember.staff_category === 'gp_locum';
  const configuredSessions = staffMember.allocation_value || 0;
  const sessionRate = staffMember.hourly_rate || 0;

  const [locumSessions, setLocumSessions] = useState<number>(configuredSessions);
  const [locumClaimAmount, setLocumClaimAmount] = useState<number>(0);
  const [deletingDraft, setDeletingDraft] = useState(false);

  const locumMaxAmount = useMemo(() => locumSessions * sessionRate, [locumSessions, sessionRate]);

  useEffect(() => {
    setLocumClaimAmount(prev => {
      if (prev === 0 || prev > locumMaxAmount) return locumMaxAmount;
      return prev;
    });
  }, [locumMaxAmount]);

  const calculatedAmount = useMemo(() => {
    if (!rateParams) return 0;
    return calculateStaffMonthlyAmount(staffMember, monthDate, staffMember.start_date, rateParams);
  }, [staffMember, monthDate, rateParams]);

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
    onSubmit(localClaim.id);
  };

  const handleDeleteDraft = async () => {
    if (!localClaim || !onDeleteClaim) return;
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

  return (
    <tr>
      <td colSpan={6} style={{ padding: 0 }}>
        <div style={{
          margin: '0 12px 10px', padding: '16px 18px', borderRadius: 10,
          background: '#fafbfc', border: '1px solid #e5e7eb',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                Claim for {monthLabel} — {staffMember.staff_name}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
                {staffMember.staff_role} · {getAllocDisplay(staffMember.allocation_type, staffMember.allocation_value)}
              </div>
            </div>
            <button onClick={onClose} style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db',
              background: '#fff', fontSize: 11, color: '#6b7280', cursor: 'pointer', fontWeight: 500,
            }}>
              Close
            </button>
          </div>

          {/* No claim yet — create draft */}
          {!claim && (
            <div>
              {isLocum ? (
                /* ── Locum: sessions + amount entry ── */
                <div>
                  {/* Step 1: Actual sessions */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                      Step 1 — Actual sessions worked this month
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
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
                        <span style={{ fontSize: 13, color: '#6b7280' }}>sessions</span>
                        {sessionRate > 0 && (
                          <>
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>×</span>
                            <span style={{ fontSize: 13, color: '#6b7280' }}>{fmtGBP(sessionRate)}/session</span>
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>=</span>
                            <span style={{ fontSize: 16, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                              max {fmtGBP(locumMaxAmount)}
                            </span>
                          </>
                        )}
                      </div>
                      {configuredSessions > 0 && locumSessions !== configuredSessions && (
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>
                          (configured: {configuredSessions} sess/mo)
                        </span>
                      )}
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
                        const result = await onCreateLocumClaim(monthDate, staffMember, locumSessions, locumClaimAmount);
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
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 12,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Calculated Amount</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtGBP(calculatedAmount)}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        Based on {getAllocDisplay(staffMember.allocation_type, staffMember.allocation_value)} allocation
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleCreateDraft}
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
                </div>
                <StatusPill status="draft" />
              </div>

              {/* Evidence */}
              <div style={{ marginBottom: 12 }}>
                {staffDets.map((s: any, idx: number) => (
                  <StaffLineEvidence
                    key={idx}
                    staffCategory={s.staff_category === 'gp_locum' ? 'buyback' : (s.staff_category || 'buyback')}
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
                  <span>{isLocum ? LOCUM_DECLARATION_TEXT : DECLARATION_TEXT}</span>
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
                    onClick={handleDeleteDraft}
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
                    <AlertTriangle style={{ width: 14, height: 14 }} /> Query from PML Director
                  </div>
                  {claim.query_notes}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
                <input
                  type="text"
                  value={queryResponse}
                  onChange={(e) => setQueryResponse(e.target.value)}
                  placeholder="Your response to the query…"
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
                      onClick={handleDeleteDraft}
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

          {/* Submitted/verified/approved/paid/invoiced — read-only */}
          {claim && !isDraft && !isQueried && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Claim Amount</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtGBP(claimTotal(claim))}
                  </div>
                </div>
                <StatusPill status={claim.status} />
              </div>
              {claim.submitted_at && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                  Submitted {dateStr(claim.submitted_at)}
                </div>
              )}
              {claim.paid_at && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#166534', fontWeight: 500 }}>
                  Paid {shortDate(claim.paid_at)}
                </div>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <select
          value={editRole}
          onChange={e => setEditRole(e.target.value)}
          style={{ padding: '2px 4px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 10, maxWidth: 90 }}
        >
          {(staffRoles || ['GP', 'ANP', 'Pharmacist', 'Nurse', 'HCA', 'Paramedic', 'Admin']).map(r => (
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
              await onUpdateStaff(member.id, {
                staff_role: editRole,
                allocation_type: editAllocType as any,
                allocation_value: Number(editAllocValue) || member.allocation_value,
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


function StaffRosterSection({
  title,
  category,
  staffList,
  claims,
  claimMonths,
  onClickClaim,
  activeClaimKey,
  onAddStaff,
  onRemoveStaff,
  onUpdateStaff,
  staffRoles,
  showAddButton,
  rateParams,
  onCreateClaim,
  onSubmit,
  onResubmit,
  confirmDeclaration,
  practiceKey,
  saving,
}: {
  title: string;
  category: string;
  staffList: BuyBackStaffMember[];
  claims: BuyBackClaim[];
  claimMonths: { label: string; monthDate: string; month: number; year: number }[];
  onClickClaim: (key: string) => void;
  activeClaimKey: string | null;
  onAddStaff?: (member: Omit<BuyBackStaffMember, 'id' | 'user_id' | 'practice_id' | 'created_at' | 'updated_at'>) => Promise<any>;
  onRemoveStaff?: (id: string) => Promise<void>;
  onUpdateStaff?: (id: string, updates: Partial<BuyBackStaffMember>) => Promise<any>;
  staffRoles?: string[];
  showAddButton: boolean;
  rateParams?: RateParams;
  onCreateClaim?: (monthDate: string, staffMember: BuyBackStaffMember) => Promise<any>;
  onSubmit?: (id: string) => void;
  onResubmit?: (id: string, notes?: string) => void;
  confirmDeclaration?: (id: string, confirmed: boolean) => Promise<void>;
  practiceKey?: string;
  saving?: boolean;
}) {
  const accent = CATEGORY_COLORS[category] || '#6b7280';
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addRole, setAddRole] = useState('');
  const [addAllocType, setAddAllocType] = useState<'sessions'|'wte'|'hours'|'daily'>('sessions');
  const [addAllocValue, setAddAllocValue] = useState('');
  const [addHourlyRate, setAddHourlyRate] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  const handleAddStaff = async () => {
    if (!addName.trim() || !addRole || !addAllocValue) return;
    setAddSaving(true);
    try {
      await onAddStaff?.({
        staff_name: addName.trim(),
        staff_role: addRole,
        allocation_type: addAllocType,
        allocation_value: Number(addAllocValue),
        hourly_rate: Number(addHourlyRate) || 0,
        is_active: true,
        staff_category: category as any,
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
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderLeft: `4px solid ${accent}`,
        background: `${accent}08`, borderRadius: '0 8px 8px 0', marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{title}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 100,
            background: accent, color: '#fff',
          }}>
            {staffList.length}
          </span>
        </div>
        {showAddButton && onAddStaff && (
          <button onClick={() => setShowAddForm(prev => !prev)} style={{
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
              {staffRoles && staffRoles.length > 0 ? (
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
            <div style={{ flex: '0 1 100px', minWidth: 80 }}>
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
            </div>
            <div style={{ flex: '0 1 70px', minWidth: 60 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Value</div>
              <input
                type="number"
                value={addAllocValue}
                onChange={(e) => setAddAllocValue(e.target.value)}
                placeholder="e.g. 4"
                style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', textAlign: 'right' }}
              />
            </div>
            {category === 'gp_locum' && (
              <div style={{ flex: '0 1 80px', minWidth: 70 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Day rate £</div>
                <input
                  type="number"
                  value={addHourlyRate}
                  onChange={(e) => setAddHourlyRate(e.target.value)}
                  placeholder="e.g. 750"
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', textAlign: 'right' }}
                />
              </div>
            )}
            <button onClick={handleAddStaff} disabled={addSaving || !addName.trim() || !addAllocValue} style={{
              padding: '7px 16px', borderRadius: 7, border: 'none', background: accent,
              color: '#fff', fontSize: 12, fontWeight: 600, cursor: addSaving ? 'not-allowed' : 'pointer',
              opacity: (addSaving || !addName.trim() || !addAllocValue) ? 0.5 : 1,
            }}>
              {addSaving ? 'Saving…' : 'Add'}
            </button>
          </div>
        </div>
      )}


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
                  const isCurrentMo = cm.monthDate.slice(0, 7) === currentMonthStr;
                  const isLastMo = cm.monthDate.slice(0, 7) === lastMonthStr;
                  return (
                    <th key={cm.monthDate} style={{
                      textAlign: 'center', padding: '6px 10px', fontSize: 10, fontWeight: 600,
                      color: isCurrentMo ? '#2563eb' : isLastMo ? '#92400e' : '#9ca3af',
                      textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                      borderBottom: '2px solid #e5e7eb',
                      background: isCurrentMo ? '#eff6ff' : isLastMo ? '#fffbeb' : 'transparent',
                    }}>
                      <div>{cm.label}</div>
                      {isCurrentMo && <div style={{ fontSize: 9, fontWeight: 400, color: '#93c5fd', marginTop: 1 }}>This month</div>}
                      {isLastMo && <div style={{ fontSize: 9, fontWeight: 400, color: '#fcd34d', marginTop: 1 }}>Last month</div>}
                    </th>
                  );
                })}
                <th style={{ textAlign: 'center', padding: '6px 10px', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.04em', borderBottom: '2px solid #e5e7eb', width: 70 }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {staffList.map(member => {
                const rowCells = claimMonths.map(cm => {
                  const claim = findClaimForStaffMonth(claims, member, cm.monthDate);
                  const isCurrentMo = cm.monthDate.slice(0, 7) === currentMonthStr;
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
                        {getAllocDisplay(member.allocation_type, member.allocation_value)}
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
                    {/* Inline claim panel */}
                    {activeMonth && (
                      <InlineClaimPanel
                        staffMember={member}
                        monthDate={activeMonth.monthDate}
                        monthLabel={activeMonth.label}
                        existingClaim={activeClaim}
                        rateParams={rateParams}
                        onCreateClaim={onCreateClaim}
                        onSubmit={onSubmit}
                        onResubmit={onResubmit}
                        confirmDeclaration={confirmDeclaration}
                        onClose={() => onClickClaim('')}
                        saving={saving}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- History Summary (preserved) ---
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' as const, gap: 8 }}>
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
              <tr key={row.month} style={{ borderBottom: '1px solid #f3f4f6' }}>
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

// --- Claim Card (preserved) ---
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
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{monthLabel}</span>
          {(() => {
            const cfg = claim.claim_type === 'additional'
              ? { label: 'Additional', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' }
              : { label: 'Buy-Back', color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' };
            return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>;
          })()}
          <StatusPill status={claim.status} />
          {isQueried && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: '#dc2626' }}>
              <AlertTriangle style={{ width: 12, height: 12 }} /> Action required
            </span>
          )}
          {isDraft && <span style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>Not yet submitted</span>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 100, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmtGBP(total)}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{staffCount} staff · {hours.toFixed(1)} hrs</div>
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
            {claim.submitted_at && <InfoBlock label="Submitted" value={dateStr(claim.submitted_at)} />}
            {claim.verified_by && <InfoBlock label="Verified by" value={claim.verified_by} sub={dateStr(claim.verified_at)} />}
            {(claim as any).approved_by_email && <InfoBlock label="Approved by" value={(claim as any).approved_by_email.split('@')[0].replace(/\./g,' ').replace(/\w/g, (c: string) => c.toUpperCase())} sub={dateStr((claim as any).approved_at)} highlight="#7c3aed" />}
            {(claim as any).expected_payment_date && !claim.paid_at && (
              <InfoBlock label="Scheduled payment" value={shortDate((claim as any).expected_payment_date)} highlight="#d97706" />
            )}
            {(claim as any).bacs_reference && <InfoBlock label="BACS ref" value={(claim as any).bacs_reference} />}
            {claim.paid_at && <InfoBlock label="Paid" value={shortDate((claim as any).actual_payment_date || claim.paid_at)} highlight="#166534" sub={claim.paid_by ? claim.paid_by.split('@')[0] : undefined} />}
            {claim.invoice_number && <InvoiceDownloadLink claim={claim} />}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <EvidencePill label="Evidence" met={evidenceComplete} />
            </div>
          </div>

          {isQueried && claim.query_notes && (
            <div style={{
              marginTop: 10, padding: '12px 14px', borderRadius: 8, fontSize: 13,
              background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <AlertTriangle style={{ width: 14, height: 14 }} /> Query from PML Director
              </div>
              {claim.query_notes}
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

          <div style={{ overflowX: 'auto', margin: '12px 0 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Name', 'Role', 'GL Cat', 'Allocation', 'Amount'].map((h, i) => (
                    <th key={h} style={{
                      textAlign: i >= 3 ? 'right' : 'left', padding: '7px 10px',
                      fontSize: 11, fontWeight: 600, color: '#6b7280',
                      textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                      borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' as const,
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
                  <td style={{ padding: '10px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' as const }}>Total</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#111827', fontVariantNumeric: 'tabular-nums', borderTop: '2px solid #e5e7eb' }}>
                    {fmtGBP(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {(isDraft || isQueried) && (
            <div style={{ marginTop: 12 }}>
              {staffDets.map((s: any, idx: number) => (
                <StaffLineEvidence
                  key={idx}
                  staffCategory={s.staff_category === 'gp_locum' ? 'buyback' : (s.staff_category || 'buyback')}
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

          {isDraft && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
              {!evidenceComplete && (
                <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 500 }}>
                  Upload all required evidence before submitting ({totalUploaded}/{totalMandatory})
                </span>
              )}
              <button
                onClick={() => onSubmit?.(claim.id)}
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
                  placeholder="Your response to the PML Director query…"
                  style={{ flex: 1, minWidth: 250, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none' }}
                />
                <button
                  onClick={() => { onResubmit?.(claim.id, queryResponse); setQueryResponse(''); }}
                  disabled={saving}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 18px',
                    borderRadius: 8, border: 'none', background: '#059669', color: '#fff',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Send style={{ width: 14, height: 14 }} />
                  Resubmit
                </button>
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
  claims,
  practiceKey,
  staff,
  staffRoles,
  rateParams,
  managementRoles,
  onSubmit,
  onResubmit,
  onCreateClaim,
  onAddStaff,
  onRemoveStaff,
  onUpdateStaff,
  confirmDeclaration,
  savingClaim,
  savingStaff,
}: BuyBackPracticeDashboardProps) {
  const [activeClaimKey, setActiveClaimKey] = useState<string | null>(null);
  const [expandedClaimId, setExpandedClaimId] = useState<string | null>(null);

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
    if (!managementRoles) return staff.filter(s => s.staff_category === 'management' && s.is_active);
    const fromConfig = managementRoles
      .filter(r => r.is_active && (!r.member_practice || r.member_practice === practiceKey))
      .map((r): BuyBackStaffMember => ({
        id: r.key,
        user_id: '',
        practice_id: null,
        staff_name: r.person_name,
        staff_role: 'NRES Management',
        allocation_type: 'hours' as const,
        allocation_value: r.max_hours_per_week,
        hourly_rate: r.hourly_rate,
        is_active: true,
        staff_category: 'management' as const,
        practice_key: practiceKey,
        start_date: null,
        created_at: '',
        updated_at: '',
      }));
    const fromStaff = staff.filter(s => s.staff_category === 'management' && s.is_active);
    // Merge, avoiding duplicates by name
    const names = new Set(fromConfig.map(s => s.staff_name));
    return [...fromConfig, ...fromStaff.filter(s => !names.has(s.staff_name))];
  }, [managementRoles, staff, practiceKey]);

  // KPI counts
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: practiceClaims.length };
    practiceClaims.forEach(c => { m[c.status] = (m[c.status] || 0) + 1; });
    return m;
  }, [practiceClaims]);

  const totals = useMemo(() => {
    const draft = practiceClaims.filter(c => c.status === 'draft').reduce((a, c) => a + claimTotal(c), 0);
    const pending = practiceClaims.filter(c => ['submitted', 'verified'].includes(c.status)).reduce((a, c) => a + claimTotal(c), 0);
    const queried = practiceClaims.filter(c => c.status === 'queried').reduce((a, c) => a + claimTotal(c), 0);
    const paid = practiceClaims.filter(c => c.status === 'paid').reduce((a, c) => a + claimTotal(c), 0);
    return { draft, pending, queried, paid };
  }, [practiceClaims]);

  const queriedCount = counts.queried || 0;

  const handleClickClaim = (key: string) => {
    setActiveClaimKey(prev => prev === key ? null : key);
  };

  // Claims history — all non-draft claims
  const historyClaims = useMemo(() => {
    const order: Record<string, number> = { queried: 0, draft: 1, submitted: 2, verified: 3, approved: 4, invoiced: 5, paid: 6, rejected: 7 };
    return [...practiceClaims].sort((a, b) => (order[a.status] ?? 99) - (order[b.status] ?? 99));
  }, [practiceClaims]);

  const rosterSectionProps = {
    claims: practiceClaims,
    claimMonths,
    practiceKey,
    onClickClaim: handleClickClaim,
    activeClaimKey,
    onAddStaff,
    onRemoveStaff,
    onUpdateStaff,
    staffRoles,
    rateParams,
    onCreateClaim,
    onSubmit,
    onResubmit,
    confirmDeclaration,
    saving: savingClaim,
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
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Buy-Back Claims</h1>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 100, background: '#005eb8', color: '#fff', letterSpacing: '0.03em' }}>NRES</span>
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
            {' — please respond to the PML Director queries below'}
          </span>
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        <KpiCard label="Drafts" value={counts.draft || 0} sub={fmtShort(totals.draft)} accent={(counts.draft || 0) > 0 ? '#6b7280' : '#d1d5db'} />
        <KpiCard label="In Pipeline" value={(counts.submitted || 0) + (counts.verified || 0)} sub={fmtShort(totals.pending)} accent="#2563eb" />
        <KpiCard label="Queried" value={queriedCount} sub={fmtShort(totals.queried)} accent={queriedCount > 0 ? '#dc2626' : '#d1d5db'} />
        <KpiCard label="Paid" value={counts.paid || 0} sub={fmtShort(totals.paid)} accent="#059669" />
      </div>

      {/* Staff Roster */}
      <div style={{
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

      {/* Claims History Summary */}
      <HistorySummary claims={practiceClaims} />

      {/* Claims list */}
      {historyClaims.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 12 }}>All Claims</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {historyClaims.map(c => (
              <PracticeClaimCard
                key={c.id}
                claim={c}
                expanded={expandedClaimId === c.id}
                onToggle={() => setExpandedClaimId(expandedClaimId === c.id ? null : c.id)}
                onSubmit={onSubmit}
                onResubmit={onResubmit}
                saving={savingClaim}
              />
            ))}
          </div>
        </div>
      )}

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
