import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const MEMBER_PRACTICES = [
  'Brackley Medical Centre',
  'Springfield Surgery',
  'The Brook Health Centre',
  'Towcester Medical Centre',
  'Denton Surgery',
  'Bugbrooke Medical Practice',
  'The Parks Medical Practice',
  'Brackley & Towcester PCN'
] as const;

export type MemberPractice = typeof MEMBER_PRACTICES[number];

export interface NRESClaimant {
  id: string;
  practice_id: string;
  name: string;
  role: 'gp' | 'pm';
  member_practice: MemberPractice | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useNRESClaimants() {
  const { user } = useAuth();
  const [claimants, setClaimants] = useState<NRESClaimant[]>([]);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Track if initial fetch has been done to prevent duplicate fetches
  const hasFetchedRef = useRef(false);

  // Get user's practice ID
  const fetchPracticeId = useCallback(async () => {
    if (!user?.id) return null;
    
    try {
      const { data: practiceIds } = await supabase.rpc('get_user_practice_ids', {
        p_user_id: user.id
      });
      
      if (practiceIds && practiceIds.length > 0) {
        setPracticeId(practiceIds[0]);
        return practiceIds[0];
      }
      return null;
    } catch (error) {
      console.error('Error fetching practice ID:', error);
      return null;
    }
  }, [user?.id]);

  const fetchClaimants = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return;
    
    // Prevent duplicate fetches on initial load
    if (!forceRefresh && hasFetchedRef.current) return;
    
    try {
      setLoading(true);
      const pId = practiceId || await fetchPracticeId();
      
      if (!pId) {
        setClaimants([]);
        hasFetchedRef.current = true;
        return;
      }

      const { data, error } = await supabase
        .from('nres_claimants')
        .select('*')
        .eq('practice_id', pId)
        .order('name');

      if (error) throw error;
      
      // Cast the role and member_practice fields properly
      const castClaimants = (data || []).map(c => ({
        ...c,
        role: c.role as 'gp' | 'pm',
        member_practice: c.member_practice as MemberPractice | null
      }));
      
      setClaimants(castClaimants);
      hasFetchedRef.current = true;
    } catch (error) {
      console.error('Error fetching claimants:', error);
      toast.error('Failed to load claimants');
    } finally {
      setLoading(false);
    }
  }, [user?.id, fetchPracticeId]); // Removed practiceId from deps to prevent re-fetch loop

  useEffect(() => {
    if (user?.id) {
      fetchClaimants();
    }
    
    // Reset fetch flag when user changes
    return () => {
      hasFetchedRef.current = false;
    };
  }, [user?.id]); // Only depend on user?.id, not fetchClaimants

  const addClaimant = async (name: string, role: 'gp' | 'pm', memberPractice?: MemberPractice) => {
    if (!user?.id) return null;
    
    const pId = practiceId || await fetchPracticeId();
    if (!pId) {
      toast.error('No practice found for your account');
      return null;
    }

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('nres_claimants')
        .insert({
          practice_id: pId,
          name: name.trim(),
          role,
          member_practice: memberPractice || null,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      
      const newClaimant = { 
        ...data, 
        role: data.role as 'gp' | 'pm',
        member_practice: data.member_practice as MemberPractice | null
      };
      setClaimants(prev => [...prev, newClaimant].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success('Claimant added');
      return newClaimant;
    } catch (error) {
      console.error('Error adding claimant:', error);
      toast.error('Failed to add claimant');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateClaimant = async (id: string, updates: { name?: string; role?: 'gp' | 'pm'; member_practice?: MemberPractice | null; is_active?: boolean }) => {
    if (!user?.id) return null;

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('nres_claimants')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      const updatedClaimant = { 
        ...data, 
        role: data.role as 'gp' | 'pm',
        member_practice: data.member_practice as MemberPractice | null
      };
      setClaimants(prev => 
        prev.map(c => c.id === id ? updatedClaimant : c)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      toast.success('Claimant updated');
      return updatedClaimant;
    } catch (error) {
      console.error('Error updating claimant:', error);
      toast.error('Failed to update claimant');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const deleteClaimant = async (id: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('nres_claimants')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setClaimants(prev => prev.filter(c => c.id !== id));
      toast.success('Claimant deleted');
    } catch (error) {
      console.error('Error deleting claimant:', error);
      toast.error('Failed to delete claimant');
    }
  };

  const activeClaimants = claimants.filter(c => c.is_active);

  return {
    claimants,
    activeClaimants,
    loading,
    saving,
    practiceId,
    addClaimant,
    updateClaimant,
    deleteClaimant,
    refetch: () => fetchClaimants(true)
  };
}
