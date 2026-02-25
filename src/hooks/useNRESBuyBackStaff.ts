import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface BuyBackStaffMember {
  id: string;
  user_id: string;
  practice_id: string | null;
  staff_name: string;
  staff_role: string;
  allocation_type: 'sessions' | 'wte';
  allocation_value: number;
  hourly_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useNRESBuyBackStaff() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<BuyBackStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const hasFetchedRef = useRef(false);

  const fetchStaff = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return;
    if (!forceRefresh && hasFetchedRef.current) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('nres_buyback_staff')
        .select('*')
        .eq('user_id', user.id)
        .order('staff_name');

      if (error) throw error;
      setStaff((data || []) as BuyBackStaffMember[]);
      hasFetchedRef.current = true;
    } catch (error) {
      console.error('Error fetching buyback staff:', error);
      toast.error('Failed to load buy-back staff');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) fetchStaff();
    return () => { hasFetchedRef.current = false; };
  }, [user?.id]);

  const addStaff = async (member: Omit<BuyBackStaffMember, 'id' | 'user_id' | 'practice_id' | 'created_at' | 'updated_at'>) => {
    if (!user?.id) return null;
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('nres_buyback_staff')
        .insert({ ...member, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      setStaff(prev => [...prev, data as BuyBackStaffMember]);
      toast.success('Staff member added');
      return data;
    } catch (error) {
      console.error('Error adding buyback staff:', error);
      toast.error('Failed to add staff member');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateStaff = async (id: string, updates: Partial<BuyBackStaffMember>) => {
    if (!user?.id) return null;
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('nres_buyback_staff')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      setStaff(prev => prev.map(s => s.id === id ? (data as BuyBackStaffMember) : s));
      toast.success('Staff member updated');
      return data;
    } catch (error) {
      console.error('Error updating buyback staff:', error);
      toast.error('Failed to update staff member');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const removeStaff = async (id: string) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('nres_buyback_staff')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      setStaff(prev => prev.filter(s => s.id !== id));
      toast.success('Staff member removed');
    } catch (error) {
      console.error('Error removing buyback staff:', error);
      toast.error('Failed to remove staff member');
    }
  };

  const activeStaff = staff.filter(s => s.is_active);

  return { staff, activeStaff, loading, saving, addStaff, updateStaff, removeStaff, refetch: () => fetchStaff(true) };
}
