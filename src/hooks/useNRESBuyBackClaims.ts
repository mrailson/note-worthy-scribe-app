import { useState, useEffect, useCallback, useRef } from 'react';
import { getSDAClaimGLCode, getGLInvoiceLabel, type ClaimType } from '@/utils/glCodes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { NRES_ADMIN_EMAILS } from '@/data/nresAdminEmails';
import { sendBuyBackEmail, type BuyBackEmailData } from '@/utils/buybackEmailService';
import { generateInvoiceNumber } from '@/utils/invoiceNumberGenerator';
import { generateInvoicePdf } from '@/utils/invoicePdfGenerator';
import { getPracticeName } from '@/data/nresPractices';
import type { NRESPracticeKey } from '@/data/nresPractices';
import type { BuyBackStaffMember } from './useNRESBuyBackStaff';

export interface BuyBackClaim {
  id: string;
  user_id: string;
  practice_id: string | null;
  practice_key: string | null;
  claim_month: string;
  claim_type: 'buyback' | 'additional';
  staff_details: any[];
  calculated_amount: number;
  claimed_amount: number;
  declaration_confirmed: boolean;
  status: 'draft' | 'submitted' | 'verified' | 'approved' | 'queried' | 'invoiced' | 'paid' | 'rejected';
  claim_ref: number | null;
  submitted_at: string | null;
  submitted_by_email: string | null;
  submitted_by_name: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  approved_by_email: string | null;
  verified_by: string | null;
  verified_at: string | null;
  verified_notes: string | null;
  // Invoice fields
  invoice_number: string | null;
  invoice_pdf_path: string | null;
  invoice_generated_at: string | null;
  gl_summary: any | null;
  // Query fields
  queried_at: string | null;
  queried_by: string | null;
  queried_by_role: string | null;
  query_notes: string | null;
  query_response: string | null;
  query_responded_at: string | null;
  // Payment fields
  paid_at: string | null;
  paid_by: string | null;
  // Payment workflow fields
  payment_status: string | null;
  pml_po_reference: string | null;
  payment_method: string | null;
  bacs_reference: string | null;
  expected_payment_date: string | null;
  actual_payment_date: string | null;
  payment_notes: string | null;
  payment_audit_trail: any[];
  practice_notes?: string | null;
  // Holiday deduction for management claims
  holiday_weeks_deducted: number;
  created_at: string;
  updated_at: string;
}

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return NRES_ADMIN_EMAILS.includes(email.toLowerCase());
}

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve((reader.result as string).split(',')[1] || '');
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

const friendlyNameFromEmail = (email?: string | null) => {
  if (!email) return '';
  const local = email.split('@')[0] || '';
  return local.split(/[._-]/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
};

const formatApprovedDateTime = (iso?: string | null) => {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * ICB-approved annual cost basis (including on-costs).
 * Defaults used when no rate settings are provided.
 */
const DEFAULT_GP_SESSION_ANNUAL = 11000 * 1.2938;
const DEFAULT_WTE_ANNUAL        = 60000 * 1.2938;

function resolveClaimTypeFromStaff(staffMember: Pick<BuyBackStaffMember, 'staff_category'>, fallback: ClaimType = 'buyback'): ClaimType {
  if (staffMember.staff_category === 'new_sda' || staffMember.staff_category === 'gp_locum') return 'additional';
  if (staffMember.staff_category === 'buyback') return 'buyback';
  return fallback;
}

export interface RateParams {
  onCostMultiplier: number;
  getRoleAnnualRate?: (roleLabel: string) => number | undefined;
  getRoleConfig?: (roleLabel: string) => import('@/hooks/useNRESBuyBackRateSettings').RoleConfig | undefined;
  employerNiPct?: number;
  employerPensionPct?: number;
  /** Pre-calculated working weeks for a given claim month (used for management billing) */
  workingWeeksInMonth?: number;
  /** Raw weekday-based working weeks (weekdays ÷ 5, no bank holiday subtraction — used for management) */
  rawWorkingWeeksInMonth?: number;
  /** Working days in the claim month */
  workingDaysInMonth?: number;
  /** Number of bank holidays excluded from the month */
  bankHolidaysInMonth?: number;
  /** Detailed bank holiday info for display */
  bankHolidayDetails?: { name: string; formatted: string }[];
  /** Fixed meeting attendance rates used when creating attendance claimants */
  meetingGpRate?: number;
  meetingPmRate?: number;
}

/** GP Locum constants */
const GP_LOCUM_MAX_DAILY_RATE = 750;
const GP_LOCUM_SESSION_RATE = 375; // half of £750

/** Calculate the maximum monthly claim amount for a staff member */
export function calculateStaffMonthlyAmount(
  staff: BuyBackStaffMember | { allocation_type: string; allocation_value: number; staff_role?: string; staff_category?: string; hourly_rate?: number },
  claimMonth?: string,
  startDate?: string | null,
  rateParams?: RateParams,
  holidayWeeksDeducted: number = 0,
): number {
  let fullMonthly: number;

  const isGpLocum = (staff as any).staff_category === 'gp_locum';
  const isMeeting = (staff as any).staff_category === 'meeting';

  // Meeting attendance: allocation_value = total hours attended, hourly_rate = GP or PM rate
  if (isMeeting) {
    const totalHours = staff.allocation_value ?? 0;
    const rate = (staff as any).hourly_rate ?? 0;
    fullMonthly = totalHours * rate;
    return fullMonthly; // No pro-rata for meeting attendance — hours are actual
  }

  // GP Locum category: allocation_value = total days or sessions worked that month
  // Fixed rates: £750/day, £375/session. No on-costs (locums are self-employed).
  if (isGpLocum) {
    if (staff.allocation_type === 'daily') {
      fullMonthly = staff.allocation_value * GP_LOCUM_MAX_DAILY_RATE;
    } else if (staff.allocation_type === 'sessions') {
      fullMonthly = staff.allocation_value * GP_LOCUM_SESSION_RATE;
    } else {
      fullMonthly = staff.allocation_value * GP_LOCUM_MAX_DAILY_RATE;
    }
  }
  // Management category: hourly_rate × weekly_hours × working_weeks_in_month
  else if (((staff as any).staff_category === 'management' || staff.staff_role === 'NRES Management') && (staff as any).hourly_rate && (rateParams?.rawWorkingWeeksInMonth || rateParams?.workingWeeksInMonth)) {
    const hourlyRate = (staff as any).hourly_rate as number;
    const weeklyHours = staff.allocation_value;
    // Use raw weeks (weekdays ÷ 5, no bank holiday subtraction) for management
    const rawWeeks = rateParams.rawWorkingWeeksInMonth ?? rateParams.workingWeeksInMonth!;
    const workingWeeks = Math.max(0, rawWeeks - holidayWeeksDeducted);
    fullMonthly = hourlyRate * weeklyHours * workingWeeks;
  } else if (rateParams?.getRoleAnnualRate && staff.staff_role) {
    const roleRate = rateParams.getRoleAnnualRate(staff.staff_role);
    const roleConfig = rateParams.getRoleConfig?.(staff.staff_role);
    if (roleRate !== undefined) {
      const includesOnCosts = roleConfig?.includes_on_costs !== false;
      const multiplier = includesOnCosts ? rateParams.onCostMultiplier : 1;
      
      if (staff.allocation_type === 'daily') {
        const dailyRate = roleConfig?.daily_rate ?? staff.allocation_value;
        const workingDays = rateParams.workingDaysInMonth ?? 21.67;
        fullMonthly = dailyRate * workingDays;
      } else if (staff.allocation_type === 'sessions') {
        const annualWithOnCosts = roleRate * multiplier;
        fullMonthly = (staff.allocation_value * annualWithOnCosts) / 12;
      } else if (staff.allocation_type === 'hours') {
        const annualWithOnCosts = roleRate * multiplier;
        fullMonthly = ((staff.allocation_value / 37.5) * annualWithOnCosts) / 12;
      } else {
        const annualWithOnCosts = roleRate * multiplier;
        fullMonthly = (staff.allocation_value * annualWithOnCosts) / 12;
      }
    } else {
      fullMonthly = calculateFallback(staff);
    }
  } else {
    fullMonthly = calculateFallback(staff);
  }

  // Pro-rata if start_date falls within the claim month (skip for management — working weeks already handles it)
  const isManagement = (staff as any).staff_category === 'management' || staff.staff_role === 'NRES Management';
  if (!isManagement && claimMonth && startDate) {
    const claimStart = new Date(claimMonth);
    const claimYear = claimStart.getFullYear();
    const claimMonthNum = claimStart.getMonth();
    const staffStart = new Date(startDate);

    if (staffStart.getFullYear() === claimYear && staffStart.getMonth() === claimMonthNum) {
      const daysInMonth = new Date(claimYear, claimMonthNum + 1, 0).getDate();
      const startDay = staffStart.getDate();
      const workingDays = daysInMonth - startDay + 1;
      fullMonthly = fullMonthly * (workingDays / daysInMonth);
    }
    if (staffStart > new Date(claimYear, claimMonthNum + 1, 0)) {
      return 0;
    }
  }

  return fullMonthly;
}

function calculateFallback(staff: { allocation_type: string; allocation_value: number }): number {
  if (staff.allocation_type === 'daily') {
    // Default daily rate for fallback = allocation_value × ~21.67 working days
    return staff.allocation_value * 21.67;
  }
  if (staff.allocation_type === 'sessions') {
    return (staff.allocation_value * DEFAULT_GP_SESSION_ANNUAL) / 12;
  } else if (staff.allocation_type === 'hours') {
    return ((staff.allocation_value / 37.5) * DEFAULT_WTE_ANNUAL) / 12;
  }
  return (staff.allocation_value * DEFAULT_WTE_ANNUAL) / 12;
}

export interface BuyBackClaimsEmailConfig {
  emailTestingMode: boolean;
  emailSendingDisabled?: boolean;
  allowInvoiceWhenSuppressed?: boolean;
  notifySubmitterOnPaid?: boolean;
  currentUserEmail?: string;
  currentUserName?: string;
}

export function useNRESBuyBackClaims(emailConfig?: BuyBackClaimsEmailConfig) {
  const { user } = useAuth();
  const [claims, setClaims] = useState<BuyBackClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const hasFetchedRef = useRef(false);
  const [hasElevatedAccess, setHasElevatedAccess] = useState(false);

  const admin = isAdmin(user?.email) || hasElevatedAccess;

  // Check nres_system_roles for PML Director / PML Finance / Super Admin / Management Lead
  useEffect(() => {
    if (!user?.email) return;
    const checkSystemRole = async () => {
      try {
        const { data } = await supabase
          .from('nres_system_roles')
          .select('role')
          .eq('user_email', user.email!.toLowerCase())
          .eq('is_active', true);
        if (data && data.length > 0) {
          setHasElevatedAccess(true);
        }
      } catch {
        // ignore — fall back to NRES_ADMIN_EMAILS
      }
    };
    if (!isAdmin(user.email)) {
      checkSystemRole();
    } else {
      setHasElevatedAccess(true);
    }
  }, [user?.email]);

  const fetchClaims = useCallback(async (forceRefresh = false, elevatedOverride?: boolean) => {
    if (!user?.id) return;
    if (!forceRefresh && hasFetchedRef.current) return;

    const elevated = elevatedOverride ?? hasElevatedAccess;

    try {
      setLoading(true);

      // Users with a system role OR in NRES_ADMIN_EMAILS see all claims
      if (isAdmin(user.email) || elevated) {
        const { data, error } = await supabase
          .from('nres_buyback_claims')
          .select('*')
          .order('claim_month', { ascending: false });
        if (error) throw error;
        setClaims((data || []) as BuyBackClaim[]);
      } else {
        // Non-admin: fetch own claims + claims for practices they have access to
        const { data: accessRows } = await supabase
          .from('nres_buyback_access')
          .select('practice_key')
          .eq('user_id', user.id);
        const practiceKeys = [...new Set((accessRows || []).map(r => r.practice_key))];

        if (practiceKeys.length > 0) {
          // Fetch claims the user created OR claims belonging to their assigned practices
          const { data, error } = await supabase
            .from('nres_buyback_claims')
            .select('*')
            .or(`user_id.eq.${user.id},practice_key.in.(${practiceKeys.join(',')})`)
            .order('claim_month', { ascending: false });
          if (error) throw error;
          setClaims((data || []) as BuyBackClaim[]);
        } else {
          // No practice access — just own claims
          const { data, error } = await supabase
            .from('nres_buyback_claims')
            .select('*')
            .eq('user_id', user.id)
            .order('claim_month', { ascending: false });
          if (error) throw error;
          setClaims((data || []) as BuyBackClaim[]);
        }
      }

      hasFetchedRef.current = true;
    } catch (error) {
      console.error('Error fetching buyback claims:', error);
      toast.error('Failed to load buy-back claims');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.email, hasElevatedAccess]);

  useEffect(() => {
    if (user?.id) fetchClaims();
    return () => { hasFetchedRef.current = false; };
  }, [user?.id, fetchClaims]);

  // Re-fetch when elevated access is detected (initial fetch may have been user-scoped)
  useEffect(() => {
    if (hasElevatedAccess && user?.id) {
      hasFetchedRef.current = false;
      fetchClaims(true, true);
    }
  }, [hasElevatedAccess, user?.id, fetchClaims]);

  const createClaim = async (
    claimMonth: string,
    staffMembers: BuyBackStaffMember[],
    claimedAmount: number,
    calculatedAmount: number,
    practiceKey?: string | null,
    rateParams?: RateParams,
    claimType: ClaimType = 'buyback',
    holidayWeeksDeducted: number = 0,
  ) => {
    if (!user?.id) return null;
    try {
      setSaving(true);
      // For single-staff claims (typical locum/partial claim), apportion the
      // user-entered claimedAmount to that staff line. Otherwise default to the max.
      // This keeps Practice/Management dashboards (which sum staff_details.claimed_amount)
      // in sync with PML view & invoices (which read top-level claimed_amount).
      const isSingleLineClaim = staffMembers.length === 1;
      const effectiveClaimType = staffMembers.length === 1
        ? resolveClaimTypeFromStaff(staffMembers[0], claimType)
        : claimType;
      const staffSnapshot = staffMembers.map(s => {
        const maxAmount = calculateStaffMonthlyAmount(s, claimMonth, s.start_date, rateParams);
        const lineClaimType = resolveClaimTypeFromStaff(s, effectiveClaimType);
        const glCode = getSDAClaimGLCode(s, lineClaimType);
        const lineClaimedAmount = isSingleLineClaim && claimedAmount > 0 && claimedAmount !== maxAmount
          ? claimedAmount
          : maxAmount;
        return {
          staff_name: s.staff_name,
          staff_role: s.staff_role,
          staff_category: s.staff_category,
          allocation_type: s.allocation_type,
          allocation_value: s.allocation_value,
          hourly_rate: s.hourly_rate,
          start_date: s.start_date,
          practice_key: s.practice_key,
          claimed_amount: lineClaimedAmount,
          calculated_amount: maxAmount,
          gl_code: glCode,
          gl_category: glCode ?? 'N/A',
        };
      });

      const { data, error } = await supabase
        .from('nres_buyback_claims')
        .insert({
          user_id: user.id,
          claim_month: claimMonth,
          claim_type: effectiveClaimType,
          staff_details: staffSnapshot,
          calculated_amount: calculatedAmount,
          claimed_amount: claimedAmount,
          practice_key: practiceKey || null,
          status: 'draft',
          holiday_weeks_deducted: holidayWeeksDeducted,
        } as any)
        .select()
        .single();

      if (error) throw error;
      setClaims(prev => [data as BuyBackClaim, ...prev]);
      toast.success('Claim created');
      return data;
    } catch (error) {
      console.error('Error creating buyback claim:', error);
      toast.error('Failed to create claim');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submitClaimInFlight = useRef<Set<string>>(new Set());

  const submitClaim = async (id: string, queryResponseNotes?: string, practiceNotes?: string) => {
    if (!user?.id) return;
    // Prevent duplicate submissions (double-click guard)
    if (submitClaimInFlight.current.has(id)) {
      console.log('[submitClaim] Already in-flight for', id);
      return;
    }
    submitClaimInFlight.current.add(id);
    try {
      setSaving(true);
      const claim = claims.find(c => c.id === id);

      // Auto-confirm declaration if not already confirmed
      if (!claim?.declaration_confirmed) {
        await supabase
          .from('nres_buyback_claims')
          .update({ declaration_confirmed: true })
          .eq('id', id);
      }

      const updatePayload: any = {
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        submitted_by_email: user.email || null,
        submitted_by_name: emailConfig?.currentUserName || user.email || null,
      };
      // Save practice notes on submission
      if (practiceNotes !== undefined) {
        updatePayload.practice_notes = practiceNotes || null;
      }
      // Save the practice's response to a query when resubmitting
      if (queryResponseNotes) {
        updatePayload.query_response = queryResponseNotes;
        updatePayload.query_responded_at = new Date().toISOString();
      }

      let query = supabase
        .from('nres_buyback_claims')
        .update(updatePayload)
        .eq('id', id);
      // RLS enforces practice-level permissions
      const { data, error } = await query.select().single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === id ? (data as BuyBackClaim) : c));
      toast.success('Claim submitted for approval');

      // Send emails (non-blocking)
      if (emailConfig && claim.practice_key) {
        const staffDetails = claim.staff_details as any[] || [];
        const emailData: BuyBackEmailData = {
          claimId: id,
          practiceKey: claim.practice_key,
          claimMonth: claim.claim_month,
          totalAmount: claim.claimed_amount,
          staffLineCount: staffDetails.length,
          staffCategories: staffDetails.map((s: any) => s.staff_category).filter(Boolean),
          staffLines: staffDetails.map((s: any) => ({
            staff_name: s.staff_name || '',
            staff_role: s.staff_role || '',
            allocation_type: s.allocation_type || 'hours',
            allocation_value: s.allocation_value || 0,
            claimed_amount: s.claimed_amount || 0,
          })),
          submitterEmail: user.email || '',
          submitterName: emailConfig.currentUserName,
        };
        sendBuyBackEmail('claim_submitted', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail, emailConfig.emailSendingDisabled).catch(console.error);
        sendBuyBackEmail('submission_confirmation', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail, emailConfig.emailSendingDisabled).catch(console.error);
      }
    } catch (error) {
      console.error('Error submitting claim:', error);
      toast.error('Failed to submit claim');
    } finally {
      submitClaimInFlight.current.delete(id);
      setSaving(false);
    }
  };

  const updateClaimAmount = async (id: string, amount: number) => {
    if (!user?.id) return;
    try {
      let query = supabase
        .from('nres_buyback_claims')
        .update({ claimed_amount: amount })
        .eq('id', id);
      // RLS enforces practice-level permissions
      const { data, error } = await query.select().single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === id ? (data as BuyBackClaim) : c));
    } catch (error) {
      console.error('Error updating claim amount:', error);
    }
  };

  /** Update a single staff member's claimed amount within the claim's staff_details JSON */
  const updateStaffClaimedAmount = async (claimId: string, staffIndex: number, newAmount: number) => {
    if (!user?.id) return;
    try {
      const claim = claims.find(c => c.id === claimId);
      if (!claim) return;

      const updatedDetails = [...(claim.staff_details as any[])];
      updatedDetails[staffIndex] = { ...updatedDetails[staffIndex], claimed_amount: newAmount };

      const totalClaimed = updatedDetails.reduce((sum, s) => sum + (s.claimed_amount ?? calculateStaffMonthlyAmount(s as any)), 0);

      let query = supabase
        .from('nres_buyback_claims')
        .update({ staff_details: updatedDetails, claimed_amount: totalClaimed })
        .eq('id', claimId);
      // RLS enforces practice-level permissions
      const { data, error } = await query.select().single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === claimId ? (data as BuyBackClaim) : c));
    } catch (error) {
      console.error('Error updating staff claimed amount:', error);
    }
  };

  /** Remove a single staff member from a claim's staff_details, recalculating totals */
  const removeStaffFromClaim = async (claimId: string, staffIndex: number) => {
    if (!user?.id) return;
    try {
      const claim = claims.find(c => c.id === claimId);
      if (!claim) return;

      const updatedDetails = (claim.staff_details as any[]).filter((_, i) => i !== staffIndex);
      
      // If no staff left, delete the whole claim
      if (updatedDetails.length === 0) {
        await deleteClaim(claimId);
        return;
      }

      const totalCalc = updatedDetails.reduce((sum, s) => sum + calculateStaffMonthlyAmount(s as any), 0);
      const totalClaimed = updatedDetails.reduce((sum, s) => sum + (s.claimed_amount ?? calculateStaffMonthlyAmount(s as any)), 0);

      let query = supabase
        .from('nres_buyback_claims')
        .update({ staff_details: updatedDetails, calculated_amount: totalCalc, claimed_amount: totalClaimed })
        .eq('id', claimId);
      // RLS enforces practice-level permissions
      const { data, error } = await query.select().single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === claimId ? (data as BuyBackClaim) : c));
    } catch (error) {
      console.error('Error removing staff from claim:', error);
      toast.error('Failed to remove staff line');
    }
  };

  /** Update notes for a staff line within a claim */
  const updateStaffNotes = async (claimId: string, staffIndex: number, notes: string) => {
    if (!user?.id) return;
    try {
      const claim = claims.find(c => c.id === claimId);
      if (!claim) return;

      const updatedDetails = [...(claim.staff_details as any[])];
      updatedDetails[staffIndex] = { ...updatedDetails[staffIndex], notes };

      let query = supabase
        .from('nres_buyback_claims')
        .update({ staff_details: updatedDetails })
        .eq('id', claimId);
      // RLS enforces practice-level permissions
      const { data, error } = await query.select().single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === claimId ? (data as BuyBackClaim) : c));
    } catch (error) {
      console.error('Error updating staff notes:', error);
    }
  };

  /** Update invoice-facing claim description / practice notes */
  const updateClaimNotes = async (claimId: string, notes: string) => {
    if (!user?.id) return;
    try {
      const cleanNotes = notes.trim().slice(0, 1500);
      const { data, error } = await supabase
        .from('nres_buyback_claims')
        .update({ practice_notes: cleanNotes || null } as any)
        .eq('id', claimId)
        .select()
        .single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === claimId ? (data as BuyBackClaim) : c));
      toast.success('Invoice description saved');
    } catch (error) {
      console.error('Error updating claim notes:', error);
      toast.error('Failed to save invoice description');
    }
  };

  /** Update a staff line's editable fields within a claim, enforcing rate cap */
  const updateStaffLine = async (
    claimId: string,
    staffIndex: number,
    updates: {
      allocation_type?: string;
      allocation_value?: number;
      start_date?: string | null;
      claimed_amount?: number;
      notes?: string;
      acknowledged_rules?: string[];
    },
    rateParams?: RateParams,
  ) => {
    if (!user?.id) return;
    try {
      const claim = claims.find(c => c.id === claimId);
      if (!claim) return;
      if (claim.status !== 'draft' && claim.status !== 'queried') {
        toast.error('Can only edit draft or queried claims');
        return;
      }

      const updatedDetails = [...(claim.staff_details as any[])];
      const currentLine = { ...updatedDetails[staffIndex] };

      if (updates.allocation_type !== undefined) currentLine.allocation_type = updates.allocation_type;
      if (updates.allocation_value !== undefined) currentLine.allocation_value = updates.allocation_value;
      if (updates.start_date !== undefined) currentLine.start_date = updates.start_date;
      if (updates.notes !== undefined) currentLine.notes = updates.notes;
      if (updates.acknowledged_rules !== undefined) currentLine.acknowledged_rules = updates.acknowledged_rules;

      // Recalculate maximum
      const maxAmount = calculateStaffMonthlyAmount(
        {
          allocation_type: currentLine.allocation_type,
          allocation_value: currentLine.allocation_value,
          staff_role: currentLine.staff_role,
        },
        claim.claim_month,
        currentLine.start_date,
        rateParams,
      );

      // Enforce cap
      if (updates.claimed_amount !== undefined) {
        currentLine.claimed_amount = Math.min(updates.claimed_amount, maxAmount);
      } else if (currentLine.claimed_amount > maxAmount) {
        currentLine.claimed_amount = maxAmount;
      }
      currentLine.max_claimable = maxAmount;

      updatedDetails[staffIndex] = currentLine;

      const newCalculated = updatedDetails.reduce((sum, s) => {
        return sum + calculateStaffMonthlyAmount(
          { allocation_type: s.allocation_type, allocation_value: s.allocation_value, staff_role: s.staff_role },
          claim.claim_month, s.start_date, rateParams
        );
      }, 0);
      const newClaimed = updatedDetails.reduce((sum, s) => sum + (s.claimed_amount ?? 0), 0);

      // Optimistic update
      setClaims(prev => prev.map(c => c.id === claimId ? { ...c, staff_details: updatedDetails, calculated_amount: newCalculated, claimed_amount: newClaimed } : c));

      let query = supabase
        .from('nres_buyback_claims')
        .update({ staff_details: updatedDetails, calculated_amount: newCalculated, claimed_amount: newClaimed })
        .eq('id', claimId);
      // RLS enforces practice-level permissions
      const { error } = await query;
      if (error) throw error;
    } catch (error) {
      console.error('Error updating staff line:', error);
      toast.error('Failed to update');
    }
  };

  const confirmDeclaration = async (id: string, confirmed: boolean) => {
    if (!user?.id) return;
    try {
      let query = supabase
        .from('nres_buyback_claims')
        .update({ declaration_confirmed: confirmed })
        .eq('id', id);
      // RLS enforces practice-level permissions
      const { data, error } = await query.select().single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === id ? (data as BuyBackClaim) : c));
    } catch (error) {
      console.error('Error updating declaration:', error);
    }
  };

  const deleteClaim = async (id: string) => {
    if (!user?.id) return;
    try {
      // Delete associated evidence files from storage first
      const { data: evidence } = await supabase
        .from('nres_claim_evidence')
        .select('id, file_path')
        .eq('claim_id', id);

      if (evidence && evidence.length > 0) {
        const storagePaths = evidence.map(e => e.file_path).filter(Boolean);
        if (storagePaths.length > 0) {
          await supabase.storage.from('claim-evidence').remove(storagePaths);
        }
        // Delete evidence records
        await supabase.from('nres_claim_evidence').delete().eq('claim_id', id);
      }

      // Delete the claim itself
      const { error } = await supabase
        .from('nres_buyback_claims')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setClaims(prev => prev.filter(c => c.id !== id));
      
    } catch (error) {
      console.error('Error deleting claim:', error);
      toast.error('Failed to delete claim');
    }
  };

  const approveClaim = async (id: string, notes?: string) => {
    if (!user?.id || !admin) return;
    try {
      setSaving(true);
      const claim = claims.find(c => c.id === id);
      const { data, error } = await supabase
        .from('nres_buyback_claims')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
          approved_by_email: user.email || null,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === id ? (data as BuyBackClaim) : c));
      toast.success('Claim approved — generating invoice...');

      // Use fresh DB data (not stale local state) for invoice generation
      const freshClaim = (data as BuyBackClaim) || claim;
      const staffDetails = (freshClaim?.staff_details as any[]) || [];
      const glSummary = staffDetails.reduce((summary: Record<string, number>, s) => {
        const glCode = getSDAClaimGLCode(s, freshClaim?.claim_type || 'buyback') || 'N/A';
        summary[glCode] = (summary[glCode] || 0) + (s.claimed_amount || 0);
        return summary;
      }, {});

      // Generate invoice number and PDF
      try {
        const invoiceNum = await generateInvoiceNumber('NRES', freshClaim?.practice_key || '', freshClaim?.claim_month || '');
        const approvedClaim = { ...freshClaim, status: 'approved' as const } as BuyBackClaim;
        const pdfDoc = generateInvoicePdf({
          claim: approvedClaim,
          invoiceNumber: invoiceNum,
          neighbourhoodName: 'NRES',
        });
        const pdfBlob = pdfDoc.output('blob');

        // Upload to Supabase Storage
        const pdfPath = `invoices/${invoiceNum}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('nres-claim-evidence')
          .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });

        if (uploadError) {
          console.error('Failed to upload invoice PDF:', uploadError);
        }

        // Update claim with invoice details → status becomes 'invoiced'
        const { data: invoicedData } = await supabase
          .from('nres_buyback_claims')
          .update({
            status: 'invoiced',
            invoice_number: invoiceNum,
            invoice_pdf_path: pdfPath,
            invoice_generated_at: new Date().toISOString(),
            gl_summary: glSummary,
            payment_status: 'received',
            payment_audit_trail: [{ status: 'received', user_email: user.email || '', timestamp: new Date().toISOString(), notes: 'Auto-set on Director approval' }],
          })
          .eq('id', id)
          .select()
          .single();

        if (invoicedData) {
          setClaims(prev => prev.map(c => c.id === id ? (invoicedData as BuyBackClaim) : c));
          toast.success(`Invoice ${invoiceNum} generated`);

          // Email invoice PDF and supporting evidence to PML Finance.
          const practiceKey = freshClaim?.practice_key as NRESPracticeKey | undefined;
          console.log('[Invoice Email] emailConfig:', JSON.stringify({
            disabled: emailConfig?.emailSendingDisabled,
            allowInvoice: emailConfig?.allowInvoiceWhenSuppressed,
            testMode: emailConfig?.emailTestingMode,
            testEmail: emailConfig?.currentUserEmail,
          }));
          if (practiceKey) {
            const practiceName = getPracticeName(practiceKey);
            const claimDate = new Date(freshClaim?.claim_month || '');
            const claimMonthLabel = claimDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
            const pdfBase64 = await blobToBase64(pdfBlob);

            // If sending is disabled AND invoice exception is not enabled, skip invoice email
            if (emailConfig?.emailSendingDisabled && !emailConfig?.allowInvoiceWhenSuppressed) {
              console.log('[Email suppressed] Invoice email — sending disabled for high-volume testing');
            } else {
            const pmlFinanceEmail = 'amanda.palin2@nhs.net';
            const invoiceRecipient = (emailConfig?.emailTestingMode && emailConfig?.currentUserEmail)
              ? emailConfig.currentUserEmail
              : pmlFinanceEmail;
            const bccList = ['malcolm.railson@nhs.net', 'amanda.palin2@nhs.net']
              .filter(email => email.toLowerCase() !== invoiceRecipient.toLowerCase());
            const invoiceBcc = (emailConfig?.emailTestingMode && emailConfig?.currentUserEmail) ? [] : bccList;

            const { data: evidenceRows, error: evidenceError } = await supabase
              .from('nres_claim_evidence')
              .select('file_name, file_path, file_type')
              .eq('claim_id', id);

            if (evidenceError) {
              console.error('Failed to fetch claim evidence for invoice email:', evidenceError);
            }

            const evidenceAttachments = await Promise.all((evidenceRows || []).map(async (evidence: any) => {
              try {
                const { data: fileBlob, error: downloadError } = await supabase.storage
                  .from('nres-claim-evidence')
                  .download(evidence.file_path);
                if (downloadError || !fileBlob) throw downloadError || new Error('No file data returned');
                return {
                  content: await blobToBase64(fileBlob),
                  filename: evidence.file_name || 'supporting-evidence',
                  type: evidence.file_type || 'application/octet-stream',
                };
              } catch (attachmentError) {
                console.error('Failed to attach supporting evidence:', evidence.file_name, attachmentError);
                return null;
              }
            }));

            const evidenceAttachmentList = evidenceAttachments.filter(Boolean) as Array<{ content: string; filename: string; type: string }>;

            // Build approved-items rows + GL subtotals
            const glSummaryEntries = Object.entries(glSummary as Record<string, number>);
            const totalAmount = glSummaryEntries.reduce((sum, [, amount]) => sum + amount, 0);
            const totalLabel = `£${totalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const fmtAmt = (n: number) => `£${(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const itemsRows = (staffDetails || []).map((s: any) => {
              const gl = getSDAClaimGLCode(s, freshClaim?.claim_type || 'buyback') || 'N/A';
              const sessions = s.allocation_type === 'sessions'
                ? `${s.allocation_value ?? 0}`
                : s.allocation_type === 'hours'
                  ? `${s.allocation_value ?? 0} hrs`
                  : s.allocation_type === 'days'
                    ? `${s.allocation_value ?? 0} days`
                    : `${s.allocation_value ?? 0}`;
              return `<tr style="border-bottom:1px solid #eef1f5;">
                <td style="padding:8px 6px;font-size:13px;color:#111;">${escapeHtml(s.staff_name || '—')}</td>
                <td style="padding:8px 6px;font-size:13px;color:#444;">${escapeHtml(s.staff_role || '—')}</td>
                <td style="padding:8px 6px;font-size:13px;color:#444;">${escapeHtml(getGLInvoiceLabel(gl))}</td>
                <td style="padding:8px 6px;font-size:13px;color:#444;text-align:right;">${sessions}</td>
                <td style="padding:8px 6px;font-size:13px;color:#111;text-align:right;font-variant-numeric:tabular-nums;">${fmtAmt(s.claimed_amount || 0)}</td>
              </tr>`;
            }).join('');
            const glSubtotalRows = glSummaryEntries.length > 1
              ? glSummaryEntries.sort(([a], [b]) => a.localeCompare(b)).map(([gl, amount]) => `
              <tr style="background:#f8fafc;">
                <td colspan="4" style="padding:6px 6px;font-size:12px;color:#475569;text-align:right;">Subtotal — GL ${escapeHtml(getGLInvoiceLabel(gl))}</td>
                <td style="padding:6px 6px;font-size:12px;color:#475569;text-align:right;font-variant-numeric:tabular-nums;">${fmtAmt(amount)}</td>
              </tr>`).join('')
              : '';

            // Payment due = invoice date + 30 days
            const paymentDueDate = new Date();
            paymentDueDate.setDate(paymentDueDate.getDate() + 30);
            const paymentDueLabel = paymentDueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const invoiceDateLabel = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const pdfFilename = `Invoice_${invoiceNum}.pdf`;
            const approvedAt = (invoicedData as any)?.reviewed_at || freshClaim?.reviewed_at || new Date().toISOString();
            const approverName = emailConfig?.currentUserName || friendlyNameFromEmail(user.email) || 'Andrew Moore';
            const approvalStamp = formatApprovedDateTime(approvedAt);
            const attachmentCount = 1 + evidenceAttachmentList.length;

            // Derive a friendly claim type label from staff categories
            const claimTypeLabel = (() => {
              const cats = Array.from(new Set((staffDetails || []).map((s: any) => s.staff_category).filter(Boolean)));
              const labelMap: Record<string, string> = {
                gp_locum: 'GP Locum',
                meeting: 'Meeting Attendance',
                salaried: 'Buy-Back',
                buyback: 'Buy-Back',
                management: 'NRES Management',
                additional: 'SDA',
                sda: 'SDA',
              };
              if (cats.length === 0) {
                return (freshClaim?.claim_type === 'additional') ? 'SDA' : 'Buy-Back';
              }
              if (cats.length === 1) return labelMap[cats[0] as string] || 'Buy-Back';
              return 'Mixed';
            })();
            const claimTypeLabelLower = claimTypeLabel === 'Buy-Back' ? 'buy-back' : claimTypeLabel;

            supabase.functions.invoke('send-meeting-email-resend', {
              body: {
                to_email: invoiceRecipient,
                subject: `${claimTypeLabel} invoice approved — ${practiceName} — ${claimMonthLabel} — ${totalLabel}`,
                html_content: `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;color:#111;">
  <div style="background:#003087;padding:22px 28px;">
    <p style="color:#9fb6e0;font-size:11px;margin:0 0 6px;letter-spacing:1.4px;text-transform:uppercase;font-weight:600;">NRES NEIGHBOURHOOD ACCESS SERVICE</p>
    <h1 style="color:#ffffff;font-size:22px;margin:0 0 4px;font-weight:700;letter-spacing:-0.2px;">${claimTypeLabel} invoice approved — ${practiceName}</h1>
    <p style="color:#cdd9ee;font-size:13px;margin:0;">${practiceName} · ${claimMonthLabel}</p>
  </div>

  <div style="padding:26px 28px 8px;">
    <p style="margin:0 0 10px;font-size:15px;">Dear PML Finance,</p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#333;">This claim is part of the <strong>NRES SDA Pilot</strong>.</p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#333;">The claim has been approved by: <strong>SNO Approver ${escapeHtml(approverName)}</strong> on <strong>${approvalStamp}</strong>.</p>
    <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#333;">All evidence used in support of the claim has been added to this email. For any further details, please log into <strong>Notewell NRES Dashboard &gt; SDA Claims</strong> as needed.</p>

    <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:10px 0;margin:0 -10px 22px;">
      <tr>
        <td style="width:50%;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:8px;padding:16px 18px;vertical-align:top;">
          <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#15803d;font-weight:600;">Approved amount</p>
          <p style="margin:0;font-size:26px;font-weight:700;color:#14532d;font-variant-numeric:tabular-nums;">${totalLabel}</p>
        </td>
        <td style="width:50%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 18px;vertical-align:top;">
          <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#475569;font-weight:600;">Payment due by</p>
          <p style="margin:0;font-size:18px;font-weight:600;color:#0f172a;">${paymentDueLabel}</p>
        </td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 22px;">
      <tr style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 0;color:#64748b;width:40%;">Invoice number</td>
        <td style="padding:10px 0;text-align:right;font-weight:600;color:#0f172a;">${invoiceNum}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 0;color:#64748b;">Invoice date</td>
        <td style="padding:10px 0;text-align:right;color:#0f172a;">${invoiceDateLabel}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 0;color:#64748b;">Claim period</td>
        <td style="padding:10px 0;text-align:right;color:#0f172a;">${claimMonthLabel}</td>
      </tr>
    </table>

    <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#003087;margin:0 0 10px;font-weight:700;">Approved items</h2>
    <table style="width:100%;border-collapse:collapse;margin:0 0 6px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th align="left" style="padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#475569;border-bottom:1px solid #e2e8f0;">Staff member</th>
          <th align="left" style="padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#475569;border-bottom:1px solid #e2e8f0;">Role</th>
          <th align="left" style="padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#475569;border-bottom:1px solid #e2e8f0;">GL</th>
          <th align="right" style="padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#475569;border-bottom:1px solid #e2e8f0;">Sessions</th>
          <th align="right" style="padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#475569;border-bottom:1px solid #e2e8f0;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
        ${glSubtotalRows}
        <tr style="background:#003087;">
          <td colspan="4" style="padding:12px 8px;font-size:13px;color:#ffffff;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">Total</td>
          <td style="padding:12px 8px;font-size:15px;color:#ffffff;font-weight:700;text-align:right;font-variant-numeric:tabular-nums;">${totalLabel}</td>
        </tr>
      </tbody>
    </table>

    <div style="margin:22px 0 6px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;display:flex;align-items:center;">
      <div style="font-size:22px;margin-right:12px;">📎</div>
      <div>
        <p style="margin:0;font-size:13px;font-weight:600;color:#1e3a8a;">${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'} included</p>
        <p style="margin:2px 0 0;font-size:12px;color:#475569;">${pdfFilename} plus ${evidenceAttachmentList.length} supporting evidence file${evidenceAttachmentList.length === 1 ? '' : 's'}</p>
      </div>
    </div>
  </div>

  <div style="padding:14px 28px 22px;border-top:1px solid #eef1f5;">
    <p style="margin:0;font-size:11px;color:#64748b;line-height:1.5;">This automated notification was generated by Notewell for the NRES SDA Claims workflow.</p>
  </div>
</div>
                `,
                from_name: `NRES ${claimTypeLabel} Claims`,
                bcc_emails: invoiceBcc,
                extra_attachments: [{
                  content: pdfBase64,
                  filename: pdfFilename,
                  type: 'application/pdf',
                }, ...evidenceAttachmentList],
              },
            }).then(() => {
              const recipientLabel = (emailConfig?.emailTestingMode)
                ? `${invoiceRecipient} (test mode)`
                : invoiceRecipient;
              toast.success(`Invoice and evidence emailed to ${recipientLabel}`);
            }).catch((emailErr) => {
              console.error('Failed to email invoice to PML Finance:', emailErr);
              toast.error('Invoice generated but email failed to send');
            });
            } // end else (sending not disabled)
          }
        }
      } catch (invoiceError) {
        console.error('Invoice generation failed (claim still approved):', invoiceError);
        toast.error('Claim approved but invoice generation failed — can be retried');
      }

      // Send emails (non-blocking)
      if (emailConfig && claim?.practice_key) {
        const emailStaff = (claim.staff_details as any[]) || [];
        const emailData: BuyBackEmailData = {
          claimId: id,
          practiceKey: claim.practice_key,
          claimMonth: claim.claim_month,
          totalAmount: claim.claimed_amount,
          staffLineCount: emailStaff.length,
          staffCategories: emailStaff.map((s: any) => s.staff_category).filter(Boolean),
          staffLines: emailStaff.map((s: any) => ({
            staff_name: s.staff_name || '',
            staff_role: s.staff_role || '',
            allocation_type: s.allocation_type || 'hours',
            allocation_value: s.allocation_value || 0,
            claimed_amount: s.claimed_amount || 0,
          })),
          submitterEmail: claim.submitted_by_email || '',
          reviewerEmail: user.email || '',
          reviewerName: emailConfig.currentUserName,
          reviewNotes: notes,
        };
        sendBuyBackEmail('claim_approved', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail, emailConfig.emailSendingDisabled).catch(console.error);
        // approval_confirmation email removed — not needed
      }
    } catch (error) {
      console.error('Error approving claim:', error);
      toast.error('Failed to approve claim');
    } finally {
      setSaving(false);
    }
  };

  const rejectClaim = async (id: string, notes: string) => {
    if (!user?.id || !admin) return;
    try {
      setSaving(true);
      const claim = claims.find(c => c.id === id);
      const { data, error } = await supabase
        .from('nres_buyback_claims')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
          approved_by_email: user.email || null,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === id ? (data as BuyBackClaim) : c));
      toast.success('Claim rejected permanently — a new claim must be created');

      // Send emails (non-blocking)
      if (emailConfig && claim?.practice_key) {
        const staffDetails = (claim.staff_details as any[]) || [];
        const emailData: BuyBackEmailData = {
          claimId: id,
          practiceKey: claim.practice_key,
          claimMonth: claim.claim_month,
          totalAmount: claim.claimed_amount,
          staffLineCount: staffDetails.length,
          staffCategories: staffDetails.map((s: any) => s.staff_category).filter(Boolean),
          staffLines: staffDetails.map((s: any) => ({
            staff_name: s.staff_name || '',
            staff_role: s.staff_role || '',
            allocation_type: s.allocation_type || 'hours',
            allocation_value: s.allocation_value || 0,
            claimed_amount: s.claimed_amount || 0,
          })),
          submitterEmail: claim.submitted_by_email || '',
          reviewerEmail: user.email || '',
          reviewerName: emailConfig.currentUserName,
          reviewNotes: notes,
        };
        sendBuyBackEmail('claim_rejected', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail, emailConfig.emailSendingDisabled).catch(console.error);
        sendBuyBackEmail('rejection_confirmation', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail, emailConfig.emailSendingDisabled).catch(console.error);
      }
    } catch (error) {
      console.error('Error rejecting claim:', error);
      toast.error('Failed to reject claim');
    } finally {
      setSaving(false);
    }
  };

  /** Verify a Buy-Back claim (Submitted → Verified) */
  const verifyClaim = async (id: string, notes?: string) => {
    if (!user?.id || !admin) return;
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('nres_buyback_claims')
        .update({
          status: 'verified',
          verified_by: user.email || null,
          verified_at: new Date().toISOString(),
          verified_notes: notes || null,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === id ? (data as BuyBackClaim) : c));
      toast.success('Claim verified — forwarded to SNO for final approval');

      // Send email to SNO (non-blocking)
      const claim = claims.find(c => c.id === id);
      if (emailConfig && claim?.practice_key) {
        const staffDetails = (claim.staff_details as any[]) || [];
        const emailData: BuyBackEmailData = {
          claimId: id,
          practiceKey: claim.practice_key,
          claimMonth: claim.claim_month,
          totalAmount: claim.claimed_amount,
          staffLineCount: staffDetails.length,
          staffCategories: staffDetails.map((s: any) => s.staff_category).filter(Boolean),
          staffLines: staffDetails.map((s: any) => ({
            staff_name: s.staff_name || '',
            staff_role: s.staff_role || '',
            allocation_type: s.allocation_type || 'hours',
            allocation_value: s.allocation_value || 0,
            claimed_amount: s.claimed_amount || 0,
          })),
          submitterEmail: claim.submitted_by_email || '',
          reviewerEmail: user.email || '',
          reviewerName: emailConfig.currentUserName,
          reviewNotes: notes,
        };
        sendBuyBackEmail('claim_verified', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail, emailConfig.emailSendingDisabled).catch(console.error);
      }
    } catch (error) {
      console.error('Error verifying claim:', error);
      toast.error('Failed to verify claim');
    } finally {
      setSaving(false);
    }
  };

  /** Query a claim (Verified → Queried) — returns to editable status */
  const queryClaim = async (id: string, notes: string, queryRole?: string) => {
    if (!user?.id || !admin) return;
    if (!notes.trim()) {
      toast.error('Please provide query notes explaining what needs attention');
      return;
    }
    try {
      setSaving(true);

      // Parse flagged lines from notes if present
      const flaggedMatch = notes.match(/\[FLAGGED_LINES:(\[[\d,]*\])\]/);
      const flaggedLines: number[] = flaggedMatch ? JSON.parse(flaggedMatch[1]) : [];

      const { data, error } = await supabase
        .from('nres_buyback_claims')
        .update({
          status: 'queried',
          queried_by: user.email || null,
          queried_by_role: queryRole || null,
          queried_at: new Date().toISOString(),
          query_notes: notes,
          query_flagged_lines: flaggedLines.length > 0 ? flaggedLines : null,
          declaration_confirmed: false,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === id ? (data as BuyBackClaim) : c));
      toast.success('Claim queried — returned to practice for amendment');

      const claim = claims.find(c => c.id === id);
      if (emailConfig && claim?.practice_key) {
        const staffDetails = (claim.staff_details as any[]) || [];
        const emailData: BuyBackEmailData = {
          claimId: id,
          practiceKey: claim.practice_key,
          claimMonth: claim.claim_month,
          totalAmount: claim.claimed_amount,
          staffLineCount: staffDetails.length,
          staffCategories: staffDetails.map((s: any) => s.staff_category).filter(Boolean),
          staffLines: staffDetails.map((s: any) => ({
            staff_name: s.staff_name || '',
            staff_role: s.staff_role || '',
            allocation_type: s.allocation_type || 'hours',
            allocation_value: s.allocation_value || 0,
            claimed_amount: s.claimed_amount || 0,
          })),
          submitterEmail: claim.submitted_by_email || '',
          reviewerEmail: user.email || '',
          reviewerName: emailConfig.currentUserName,
          reviewNotes: notes.replace(/\n\n\[FLAGGED_LINES:\[[\d,]*\]\]/, ''),
        };
        sendBuyBackEmail('claim_queried' as any, emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail, emailConfig.emailSendingDisabled).catch(console.error);
      }
    } catch (error) {
      console.error('Error querying claim:', error);
      toast.error('Failed to query claim');
    } finally {
      setSaving(false);
    }
  };

  /** Update payment workflow status and fields */
  const updatePaymentStatus = async (id: string, updates: {
    payment_status?: string;
    pml_po_reference?: string;
    payment_method?: string;
    bacs_reference?: string;
    expected_payment_date?: string;
    actual_payment_date?: string;
    payment_notes?: string;
  }) => {
    if (!user?.id || !admin) return;
    try {
      setSaving(true);
      const claim = claims.find(c => c.id === id);
      const existingTrail = (claim as any)?.payment_audit_trail || [];

      const dbUpdates: any = { ...updates };

      // If status is changing, append to audit trail
      if (updates.payment_status) {
        dbUpdates.payment_audit_trail = [
          ...existingTrail,
          {
            status: updates.payment_status,
            user_email: user.email || '',
            timestamp: new Date().toISOString(),
            notes: updates.payment_notes || undefined,
          },
        ];

        // If final status, also mark as paid
        if (updates.payment_status === 'payment_sent') {
          dbUpdates.status = 'paid';
          dbUpdates.paid_at = new Date().toISOString();
          dbUpdates.paid_by = user.email || null;
        }
      }

      const { data, error } = await supabase
        .from('nres_buyback_claims')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === id ? (data as BuyBackClaim) : c));

      if (updates.payment_status) {
        const labels: Record<string, string> = {
          received: 'Received',
          entered_on_system: 'Entered on System',
          scheduled: 'Scheduled for Payment',
          payment_sent: 'Payment Sent',
          queried: 'Queried',
        };
        toast.success(`Payment status updated: ${labels[updates.payment_status] || updates.payment_status}`);
      } else {
        toast.success('Payment details saved');
      }

      // Send "claim paid" email to the original submitter when PML Finance marks payment_sent
      if (updates.payment_status === 'payment_sent') {
        try {
          const updatedClaim = data as BuyBackClaim;
          const submitterEmail = (updatedClaim as any)?.submitted_by_email || claim?.submitted_by_email || '';
          const notifyOn = emailConfig?.notifySubmitterOnPaid ?? true;
          const sendingDisabled = emailConfig?.emailSendingDisabled && !emailConfig?.allowInvoiceWhenSuppressed;

          if (notifyOn && submitterEmail && !sendingDisabled) {
            const recipient = (emailConfig?.emailTestingMode && emailConfig?.currentUserEmail)
              ? emailConfig.currentUserEmail
              : submitterEmail;

            const practiceKey = updatedClaim.practice_key as NRESPracticeKey | undefined;
            const practiceName = practiceKey ? getPracticeName(practiceKey) : (updatedClaim.practice_key || '');
            const claimDate = new Date(updatedClaim.claim_month || '');
            const claimMonthLabel = !isNaN(claimDate.getTime())
              ? claimDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
              : (updatedClaim.claim_month || '');
            const totalAmount = Number(updatedClaim.claimed_amount || updatedClaim.calculated_amount || 0);
            const totalLabel = `£${totalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const invoiceNum = updatedClaim.invoice_number || '—';

            const paymentDateRaw = updates.actual_payment_date || (updatedClaim as any).actual_payment_date || '';
            const paymentDateLabel = paymentDateRaw
              ? new Date(paymentDateRaw).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : '';
            const bacsRef = updates.bacs_reference || (updatedClaim as any).bacs_reference || '';
            const poRef = updates.pml_po_reference || (updatedClaim as any).pml_po_reference || '';
            const payMethod = updates.payment_method || (updatedClaim as any).payment_method || '';

            const submitterFirstName = (() => {
              const local = (submitterEmail.split('@')[0] || '');
              const first = local.split(/[._-]/)[0] || local;
              return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : '';
            })();

            const ccList = (emailConfig?.emailTestingMode && emailConfig?.currentUserEmail)
              ? []
              : ['amanda.palin2@nhs.net'];

            // Derive claim type label from staff categories
            const paidStaffDetails = (updatedClaim?.staff_details as any[]) || [];
            const paidClaimTypeLabel = (() => {
              const cats = Array.from(new Set(paidStaffDetails.map((s: any) => s.staff_category).filter(Boolean)));
              const labelMap: Record<string, string> = {
                gp_locum: 'GP Locum',
                meeting: 'Meeting Attendance',
                salaried: 'Buy-Back',
                buyback: 'Buy-Back',
                management: 'NRES Management',
                additional: 'SDA',
                sda: 'SDA',
              };
              if (cats.length === 0) {
                return (updatedClaim?.claim_type === 'additional') ? 'SDA' : 'Buy-Back';
              }
              if (cats.length === 1) return labelMap[cats[0] as string] || 'Buy-Back';
              return 'Mixed';
            })();
            const paidClaimTypeLabelLower = paidClaimTypeLabel === 'Buy-Back' ? 'buy-back' : paidClaimTypeLabel;

            // Build staff breakdown rows for paid email
            const paidItemsRows = paidStaffDetails.map((s: any) => {
              const catMap: Record<string, string> = { gp_locum: 'GP Locum', meeting: 'Meeting', salaried: 'Salaried', buyback: 'Buy-Back', management: 'Management', additional: 'SDA', sda: 'SDA' };
              const cat = catMap[s.staff_category] || s.staff_category || '';
              const amt = Number(s.claimed_amount || s.calculated_amount || 0);
              const amtLabel = `£${amt.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              return `<tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:8px 6px;font-size:12px;color:#0f172a;">${s.staff_member || '—'}</td>
                <td style="padding:8px 6px;font-size:12px;color:#475569;">${s.role || '—'}</td>
                <td style="padding:8px 6px;font-size:12px;color:#475569;">${cat}</td>
                <td style="padding:8px 6px;font-size:12px;text-align:right;font-variant-numeric:tabular-nums;color:#0f172a;">${amtLabel}</td>
              </tr>`;
            }).join('');

            supabase.functions.invoke('send-meeting-email-resend', {
              body: {
                to_email: recipient,
                subject: `Payment sent — ${practiceName} — ${claimMonthLabel} ${paidClaimTypeLabelLower} claim — ${totalLabel}`,
                html_content: `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;color:#111;">
  <div style="background:#166534;padding:22px 28px;">
    <p style="color:#bbf7d0;font-size:11px;margin:0 0 6px;letter-spacing:1.4px;text-transform:uppercase;font-weight:600;">NRES NEIGHBOURHOOD ACCESS SERVICE</p>
    <h1 style="color:#ffffff;font-size:22px;margin:0 0 4px;font-weight:700;">Payment sent — ${practiceName}</h1>
    <p style="color:#dcfce7;font-size:13px;margin:0;">${practiceName} · ${claimMonthLabel}</p>
  </div>
  <div style="padding:26px 28px 8px;">
    <p style="margin:0 0 10px;font-size:15px;">Hi ${submitterFirstName || 'there'},</p>
    <p style="margin:0 0 22px;font-size:14px;line-height:1.55;color:#333;">
      PML Finance has marked your ${claimMonthLabel} ${paidClaimTypeLabelLower} claim for <strong>${practiceName}</strong> as <strong>paid</strong>.
      ${paymentDateLabel ? `Payment was sent on <strong>${paymentDateLabel}</strong>.` : 'Payment has been issued.'}
      Please allow standard banking time for the funds to clear.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 22px;">
      <tr style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 0;color:#64748b;width:45%;">Claim type</td>
        <td style="padding:10px 0;text-align:right;font-weight:600;color:#0f172a;">${paidClaimTypeLabel}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 0;color:#64748b;">Amount paid</td>
        <td style="padding:10px 0;text-align:right;font-weight:700;color:#14532d;font-variant-numeric:tabular-nums;">${totalLabel}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 0;color:#64748b;">Invoice number</td>
        <td style="padding:10px 0;text-align:right;color:#0f172a;">${invoiceNum}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 0;color:#64748b;">Claim period</td>
        <td style="padding:10px 0;text-align:right;color:#0f172a;">${claimMonthLabel}</td>
      </tr>
      ${paymentDateLabel ? `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 0;color:#64748b;">Payment date</td>
        <td style="padding:10px 0;text-align:right;color:#0f172a;font-weight:600;">${paymentDateLabel}</td>
      </tr>` : ''}
      ${payMethod ? `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 0;color:#64748b;">Payment method</td>
        <td style="padding:10px 0;text-align:right;color:#0f172a;">${payMethod}</td>
      </tr>` : ''}
      ${bacsRef ? `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 0;color:#64748b;">BACS reference</td>
        <td style="padding:10px 0;text-align:right;color:#0f172a;font-family:monospace;">${bacsRef}</td>
      </tr>` : ''}
      ${poRef ? `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 0;color:#64748b;">PO reference</td>
        <td style="padding:10px 0;text-align:right;color:#0f172a;font-family:monospace;">${poRef}</td>
      </tr>` : ''}
    </table>

    ${paidStaffDetails.length > 0 ? `
    <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#166534;margin:0 0 10px;font-weight:700;">Staff breakdown</h2>
    <table style="width:100%;border-collapse:collapse;margin:0 0 22px;">
      <thead>
        <tr style="background:#f0fdf4;">
          <th align="left" style="padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#15803d;border-bottom:1px solid #bbf7d0;">Staff member</th>
          <th align="left" style="padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#15803d;border-bottom:1px solid #bbf7d0;">Role</th>
          <th align="left" style="padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#15803d;border-bottom:1px solid #bbf7d0;">Type</th>
          <th align="right" style="padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#15803d;border-bottom:1px solid #bbf7d0;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${paidItemsRows}
        <tr style="background:#166534;">
          <td colspan="3" style="padding:10px 6px;font-size:13px;color:#ffffff;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">Total</td>
          <td style="padding:10px 6px;font-size:14px;color:#ffffff;font-weight:700;text-align:right;font-variant-numeric:tabular-nums;">${totalLabel}</td>
        </tr>
      </tbody>
    </table>
    ` : ''}

    <p style="margin:0 0 8px;font-size:13px;color:#475569;line-height:1.5;">
      If you have not received the payment within 5 working days of the payment date, or if any details look incorrect, please contact PML Finance.
    </p>
  </div>
  <div style="padding:14px 28px 22px;border-top:1px solid #eef1f5;">
    <p style="margin:0;font-size:11px;color:#64748b;line-height:1.5;">Queries: contact PML Finance — Amanda Palin · <a href="mailto:amanda.palin2@nhs.net" style="color:#005EB8;text-decoration:none;">amanda.palin2@nhs.net</a></p>
  </div>
</div>`,
                from_name: `NRES ${paidClaimTypeLabel} Claims`,
                cc_emails: ccList,
              },
            }).then(() => {
              const label = emailConfig?.emailTestingMode ? `${recipient} (test mode)` : recipient;
              toast.success(`Payment confirmation emailed to ${label}`);
            }).catch((err) => {
              console.error('Failed to send payment-sent email:', err);
            });
          } else if (!notifyOn) {
            console.log('[Payment email] Skipped — notify_submitter_on_paid is disabled in settings');
          } else if (sendingDisabled) {
            console.log('[Payment email] Skipped — email sending is suppressed');
          } else {
            console.log('[Payment email] Skipped — no submitter email on claim');
          }
        } catch (emailErr) {
          console.error('Error preparing payment email:', emailErr);
        }
      }
    } catch (error) {
      console.error('Error updating payment:', error);
      toast.error('Failed to update payment');
    } finally {
      setSaving(false);
    }
  };

  return {
    claims,
    loading,
    saving,
    admin,
    createClaim,
    submitClaim,
    verifyClaim,
    queryClaim,
    approveClaim,
    rejectClaim,
    updatePaymentStatus,
    updateClaimAmount,
    updateStaffClaimedAmount,
    removeStaffFromClaim,
    updateStaffNotes,
    updateClaimNotes,
    updateStaffLine,
    confirmDeclaration,
    deleteClaim,
    refetch: () => fetchClaims(true),
  };
}
