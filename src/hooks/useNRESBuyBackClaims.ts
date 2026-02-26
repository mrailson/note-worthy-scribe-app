import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { NRES_ADMIN_EMAILS } from '@/data/nresAdminEmails';
import { sendBuyBackEmail, type BuyBackEmailData } from '@/utils/buybackEmailService';
import type { BuyBackStaffMember } from './useNRESBuyBackStaff';

export interface BuyBackClaim {
  id: string;
  user_id: string;
  practice_id: string | null;
  practice_key: string | null;
  claim_month: string;
  staff_details: any[];
  calculated_amount: number;
  claimed_amount: number;
  declaration_confirmed: boolean;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submitted_at: string | null;
  submitted_by_email: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  approved_by_email: string | null;
  created_at: string;
  updated_at: string;
}

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return NRES_ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * ICB-approved annual cost basis (including on-costs).
 * Defaults used when no rate settings are provided.
 */
const DEFAULT_GP_SESSION_ANNUAL = 11000 * 1.2938;
const DEFAULT_WTE_ANNUAL        = 60000 * 1.2938;

export interface RateParams {
  onCostMultiplier: number;
  getRoleAnnualRate?: (roleLabel: string) => number | undefined;
  employerNiPct?: number;
  employerPensionPct?: number;
}

/** Calculate the maximum monthly claim amount for a staff member */
export function calculateStaffMonthlyAmount(
  staff: BuyBackStaffMember | { allocation_type: string; allocation_value: number; staff_role?: string },
  claimMonth?: string,
  startDate?: string | null,
  rateParams?: RateParams,
): number {
  let fullMonthly: number;

  if (rateParams?.getRoleAnnualRate && staff.staff_role) {
    // Dynamic rates from settings
    const roleRate = rateParams.getRoleAnnualRate(staff.staff_role);
    if (roleRate !== undefined) {
      const annualWithOnCosts = roleRate * rateParams.onCostMultiplier;
      if (staff.allocation_type === 'sessions') {
        fullMonthly = (staff.allocation_value * annualWithOnCosts) / 12;
      } else if (staff.allocation_type === 'hours') {
        fullMonthly = ((staff.allocation_value / 37.5) * annualWithOnCosts) / 12;
      } else {
        fullMonthly = (staff.allocation_value * annualWithOnCosts) / 12;
      }
    } else {
      // Fallback for unknown roles
      fullMonthly = calculateFallback(staff);
    }
  } else {
    fullMonthly = calculateFallback(staff);
  }

  // Pro-rata if start_date falls within the claim month
  if (claimMonth && startDate) {
    const claimStart = new Date(claimMonth);
    const claimYear = claimStart.getFullYear();
    const claimMonthNum = claimStart.getMonth();
    const staffStart = new Date(startDate);

    // Only pro-rata if staff starts in this specific month
    if (staffStart.getFullYear() === claimYear && staffStart.getMonth() === claimMonthNum) {
      const daysInMonth = new Date(claimYear, claimMonthNum + 1, 0).getDate();
      const startDay = staffStart.getDate(); // e.g. 15th
      const workingDays = daysInMonth - startDay + 1; // days from start to end of month inclusive
      fullMonthly = fullMonthly * (workingDays / daysInMonth);
    }
    // If staff starts after the claim month, no claim allowed
    if (staffStart > new Date(claimYear, claimMonthNum + 1, 0)) {
      return 0;
    }
  }

  return fullMonthly;
}

function calculateFallback(staff: { allocation_type: string; allocation_value: number }): number {
  if (staff.allocation_type === 'sessions') {
    return (staff.allocation_value * DEFAULT_GP_SESSION_ANNUAL) / 12;
  } else if (staff.allocation_type === 'hours') {
    return ((staff.allocation_value / 37.5) * DEFAULT_WTE_ANNUAL) / 12;
  }
  return (staff.allocation_value * DEFAULT_WTE_ANNUAL) / 12;
}

export interface BuyBackClaimsEmailConfig {
  emailTestingMode: boolean;
  currentUserEmail?: string;
  currentUserName?: string;
}

export function useNRESBuyBackClaims(emailConfig?: BuyBackClaimsEmailConfig) {
  const { user } = useAuth();
  const [claims, setClaims] = useState<BuyBackClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const hasFetchedRef = useRef(false);

  const admin = isAdmin(user?.email);

  const fetchClaims = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return;
    if (!forceRefresh && hasFetchedRef.current) return;

    try {
      setLoading(true);
      let query = supabase
        .from('nres_buyback_claims')
        .select('*')
        .order('claim_month', { ascending: false });

      if (!isAdmin(user.email)) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setClaims((data || []) as BuyBackClaim[]);
      hasFetchedRef.current = true;
    } catch (error) {
      console.error('Error fetching buyback claims:', error);
      toast.error('Failed to load buy-back claims');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (user?.id) fetchClaims();
    return () => { hasFetchedRef.current = false; };
  }, [user?.id]);

  const createClaim = async (
    claimMonth: string,
    staffMembers: BuyBackStaffMember[],
    claimedAmount: number,
    calculatedAmount: number,
    practiceKey?: string | null,
    rateParams?: RateParams,
  ) => {
    if (!user?.id) return null;
    try {
      setSaving(true);
      const staffSnapshot = staffMembers.map(s => {
        const maxAmount = calculateStaffMonthlyAmount(s, claimMonth, s.start_date, rateParams);
        return {
          staff_name: s.staff_name,
          staff_role: s.staff_role,
          staff_category: s.staff_category,
          allocation_type: s.allocation_type,
          allocation_value: s.allocation_value,
          hourly_rate: s.hourly_rate,
          start_date: s.start_date,
          practice_key: s.practice_key,
          claimed_amount: maxAmount,
        };
      });

      const { data, error } = await supabase
        .from('nres_buyback_claims')
        .insert({
          user_id: user.id,
          claim_month: claimMonth,
          staff_details: staffSnapshot,
          calculated_amount: calculatedAmount,
          claimed_amount: claimedAmount,
          practice_key: practiceKey || null,
          status: 'draft',
        })
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

  const submitClaim = async (id: string) => {
    if (!user?.id) return;
    try {
      setSaving(true);
      const claim = claims.find(c => c.id === id);
      if (!claim?.declaration_confirmed) {
        toast.error('You must confirm the declaration before submitting');
        return;
      }

      let query = supabase
        .from('nres_buyback_claims')
        .update({ status: 'submitted', submitted_at: new Date().toISOString(), submitted_by_email: user.email || null })
        .eq('id', id);

      if (!admin) {
        query = query.eq('user_id', user.id);
      }

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
          submitterEmail: user.email || '',
          submitterName: emailConfig.currentUserName,
        };
        sendBuyBackEmail('claim_submitted', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail).catch(console.error);
        sendBuyBackEmail('submission_confirmation', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail).catch(console.error);
      }
    } catch (error) {
      console.error('Error submitting claim:', error);
      toast.error('Failed to submit claim');
    } finally {
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

      if (!admin) {
        query = query.eq('user_id', user.id);
      }

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

      if (!admin) {
        query = query.eq('user_id', user.id);
      }

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

      if (!admin) {
        query = query.eq('user_id', user.id);
      }

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

      if (!admin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.select().single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === claimId ? (data as BuyBackClaim) : c));
    } catch (error) {
      console.error('Error updating staff notes:', error);
    }
  };

  const confirmDeclaration = async (id: string, confirmed: boolean) => {
    if (!user?.id) return;
    try {
      let query = supabase
        .from('nres_buyback_claims')
        .update({ declaration_confirmed: confirmed })
        .eq('id', id);

      if (!admin) {
        query = query.eq('user_id', user.id);
      }

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
      let query = supabase
        .from('nres_buyback_claims')
        .delete()
        .eq('id', id);

      if (!admin) {
        query = query.eq('user_id', user.id);
      }

      const { error } = await query;
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
      toast.success('Claim approved');

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
          submitterEmail: claim.submitted_by_email || '',
          reviewerEmail: user.email || '',
          reviewerName: emailConfig.currentUserName,
          reviewNotes: notes,
        };
        sendBuyBackEmail('claim_approved', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail).catch(console.error);
        sendBuyBackEmail('approval_confirmation', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail).catch(console.error);
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
      toast.success('Claim rejected');

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
          submitterEmail: claim.submitted_by_email || '',
          reviewerEmail: user.email || '',
          reviewerName: emailConfig.currentUserName,
          reviewNotes: notes,
        };
        sendBuyBackEmail('claim_rejected', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail).catch(console.error);
        sendBuyBackEmail('rejection_confirmation', emailData, emailConfig.emailTestingMode, emailConfig.currentUserEmail).catch(console.error);
      }
    } catch (error) {
      console.error('Error rejecting claim:', error);
      toast.error('Failed to reject claim');
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
    approveClaim,
    rejectClaim,
    updateClaimAmount,
    updateStaffClaimedAmount,
    removeStaffFromClaim,
    updateStaffNotes,
    confirmDeclaration,
    deleteClaim,
    refetch: () => fetchClaims(true),
  };
}
