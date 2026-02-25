import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { NRES_ADMIN_EMAILS } from '@/data/nresAdminEmails';
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
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return NRES_ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * ICB-approved annual cost basis (including 29.38% on-costs):
 *  - GP session: £11,000 + 29.38% = £14,231.80/session/year → monthly = /12
 *  - WTE (37.5 hrs/wk): £60,000 + 29.38% = £77,628.00/year → monthly = /12
 *  - Hours: pro-rata of WTE based on hours ÷ 37.5
 */
const GP_SESSION_ANNUAL = 11000 * 1.2938;   // £14,231.80
const WTE_ANNUAL        = 60000 * 1.2938;   // £77,628.00

/** Calculate the maximum monthly claim amount for a staff member */
export function calculateStaffMonthlyAmount(staff: BuyBackStaffMember): number {
  if (staff.allocation_type === 'sessions') {
    // sessions × annual session cost ÷ 12 months
    return (staff.allocation_value * GP_SESSION_ANNUAL) / 12;
  }
  if (staff.allocation_type === 'hours') {
    // pro-rata WTE: (hours/week ÷ 37.5) × WTE annual ÷ 12
    return ((staff.allocation_value / 37.5) * WTE_ANNUAL) / 12;
  }
  // WTE
  return (staff.allocation_value * WTE_ANNUAL) / 12;
}

export function useNRESBuyBackClaims() {
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
    practiceKey?: string | null
  ) => {
    if (!user?.id) return null;
    try {
      setSaving(true);
      const staffSnapshot = staffMembers.map(s => ({
        staff_name: s.staff_name,
        staff_role: s.staff_role,
        staff_category: s.staff_category,
        allocation_type: s.allocation_type,
        allocation_value: s.allocation_value,
        hourly_rate: s.hourly_rate,
      }));

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
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', id);

      if (!admin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.select().single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === id ? (data as BuyBackClaim) : c));
      toast.success('Claim submitted for approval');
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

  return {
    claims,
    loading,
    saving,
    admin,
    createClaim,
    submitClaim,
    updateClaimAmount,
    confirmDeclaration,
    deleteClaim,
    refetch: () => fetchClaims(true),
  };
}
