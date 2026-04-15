import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { NRES_ADMIN_EMAILS } from '@/data/nresAdminEmails';

export interface BuyBackStaffMember {
  id: string;
  user_id: string;
  practice_id: string | null;
  staff_name: string;
  staff_role: string;
  allocation_type: 'sessions' | 'wte' | 'hours' | 'daily';
  allocation_value: number;
  hourly_rate: number;
  is_active: boolean;
  staff_category: 'buyback' | 'new_sda' | 'management' | 'gp_locum' | 'meeting';
  practice_key: string | null;
  start_date: string | null;
  created_at: string;
  updated_at: string;
}

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return NRES_ADMIN_EMAILS.includes(email.toLowerCase());
}

export function useNRESBuyBackStaff() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<BuyBackStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const hasFetchedRef = useRef(false);

  const admin = isAdmin(user?.email);

  const fetchStaff = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return;
    if (!forceRefresh && hasFetchedRef.current) return;

    try {
      setLoading(true);
      let query = supabase
        .from('nres_buyback_staff')
        .select('*')
        .order('staff_name');

      // Non-admins only see their own staff
      if (!isAdmin(user.email)) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStaff((data || []) as BuyBackStaffMember[]);
      hasFetchedRef.current = true;
    } catch (error) {
      console.error('Error fetching buyback staff:', error);
      toast.error('Failed to load buy-back staff');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.email]);

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
      let query = supabase
        .from('nres_buyback_staff')
        .update(updates)
        .eq('id', id);

      if (!admin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.select().single();
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
      // Always filter by user_id — admins must not delete other users' staff
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

  return { staff, activeStaff, loading, saving, admin, addStaff, updateStaff, removeStaff, refetch: () => fetchStaff(true) };
}
