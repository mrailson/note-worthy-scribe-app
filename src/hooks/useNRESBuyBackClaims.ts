import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { BuyBackStaffMember } from './useNRESBuyBackStaff';

export interface BuyBackClaim {
  id: string;
  user_id: string;
  practice_id: string | null;
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

/** Calculate monthly amount from staff allocation */
export function calculateStaffMonthlyAmount(staff: BuyBackStaffMember): number {
  if (staff.allocation_type === 'sessions') {
    // sessions × 4 hours × hourly rate
    return staff.allocation_value * 4 * staff.hourly_rate;
  }
  // WTE × 37.5 hours × hourly rate (per week, ~4.33 weeks/month)
  return staff.allocation_value * 37.5 * staff.hourly_rate * 4.33;
}

export function useNRESBuyBackClaims() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<BuyBackClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const hasFetchedRef = useRef(false);

  const fetchClaims = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return;
    if (!forceRefresh && hasFetchedRef.current) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('nres_buyback_claims')
        .select('*')
        .eq('user_id', user.id)
        .order('claim_month', { ascending: false });

      if (error) throw error;
      setClaims((data || []) as BuyBackClaim[]);
      hasFetchedRef.current = true;
    } catch (error) {
      console.error('Error fetching buyback claims:', error);
      toast.error('Failed to load buy-back claims');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) fetchClaims();
    return () => { hasFetchedRef.current = false; };
  }, [user?.id]);

  const createClaim = async (
    claimMonth: string,
    staffMembers: BuyBackStaffMember[],
    claimedAmount: number,
    calculatedAmount: number
  ) => {
    if (!user?.id) return null;
    try {
      setSaving(true);
      const staffSnapshot = staffMembers.map(s => ({
        staff_name: s.staff_name,
        staff_role: s.staff_role,
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
      const { data, error } = await supabase
        .from('nres_buyback_claims')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
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
      const { data, error } = await supabase
        .from('nres_buyback_claims')
        .update({ claimed_amount: amount })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === id ? (data as BuyBackClaim) : c));
    } catch (error) {
      console.error('Error updating claim amount:', error);
    }
  };

  const confirmDeclaration = async (id: string, confirmed: boolean) => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('nres_buyback_claims')
        .update({ declaration_confirmed: confirmed })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      setClaims(prev => prev.map(c => c.id === id ? (data as BuyBackClaim) : c));
    } catch (error) {
      console.error('Error updating declaration:', error);
    }
  };

  const deleteClaim = async (id: string) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('nres_buyback_claims')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      setClaims(prev => prev.filter(c => c.id !== id));
      toast.success('Claim deleted');
    } catch (error) {
      console.error('Error deleting claim:', error);
      toast.error('Failed to delete claim');
    }
  };

  return {
    claims,
    loading,
    saving,
    createClaim,
    submitClaim,
    updateClaimAmount,
    confirmDeclaration,
    deleteClaim,
    refetch: () => fetchClaims(true),
  };
}
