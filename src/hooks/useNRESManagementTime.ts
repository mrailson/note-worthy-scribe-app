import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { NRES_ADMIN_EMAILS } from '@/data/nresAdminEmails';

export interface ManagementTimeEntry {
  id: string;
  user_id: string;
  management_role_key: string;
  person_name: string;
  work_date: string;
  hours: number;
  description: string | null;
  claim_month: string | null;
  billing_entity: string | null;
  billing_org_code: string | null;
  hourly_rate: number;
  total_amount: number;
  status: 'draft' | 'submitted' | 'verified' | 'approved' | 'queried' | 'invoiced' | 'paid' | 'rejected';
  submitted_at: string | null;
  submitted_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  query_notes: string | null;
  invoice_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManagementRoleConfig {
  key: string;
  label: string;
  person_name: string;
  person_email: string;
  hourly_rate: number;
  billing_entity: string;
  billing_org_code: string;
  is_active: boolean;
}

export function useNRESManagementTime() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<ManagementTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const admin = user?.email ? NRES_ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;

  const fetchEntries = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('nres_management_time')
        .select('*')
        .order('work_date', { ascending: false });
      if (error) throw error;
      setEntries((data || []) as ManagementTimeEntry[]);
    } catch (error) {
      console.error('Error fetching management time:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { if (user?.id) fetchEntries(); }, [user?.id, fetchEntries]);

  const addEntry = useCallback(async (entry: {
    management_role_key: string;
    person_name: string;
    work_date: string;
    hours: number;
    description?: string;
    claim_month: string;
    billing_entity: string;
    billing_org_code: string;
    hourly_rate: number;
  }) => {
    if (!user?.id) return;
    try {
      setSaving(true);
      const { data, error } = await (supabase as any)
        .from('nres_management_time')
        .insert({ ...entry, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      setEntries(prev => [data as ManagementTimeEntry, ...prev]);
      toast.success('Time entry added');
      return data;
    } catch (error) {
      console.error('Error adding entry:', error);
      toast.error('Failed to add entry');
    } finally {
      setSaving(false);
    }
  }, [user?.id]);

  const deleteEntry = useCallback(async (id: string) => {
    try {
      const { error } = await (supabase as any).from('nres_management_time').delete().eq('id', id);
      if (error) throw error;
      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success('Entry deleted');
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Failed to delete entry');
    }
  }, []);

  const submitMonth = useCallback(async (claimMonth: string) => {
    if (!user?.email) return;
    try {
      setSaving(true);
      const drafts = entries.filter(e => e.claim_month === claimMonth && e.status === 'draft');
      if (drafts.length === 0) { toast.error('No draft entries for this month'); return; }
      const ids = drafts.map(e => e.id);
      const { error } = await (supabase as any)
        .from('nres_management_time')
        .update({ status: 'submitted', submitted_at: new Date().toISOString(), submitted_by: user.email })
        .in('id', ids);
      if (error) throw error;
      setEntries(prev => prev.map(e => ids.includes(e.id) ? { ...e, status: 'submitted' as const, submitted_at: new Date().toISOString(), submitted_by: user.email! } : e));
      toast.success(`${drafts.length} entries submitted`);
    } catch (error) {
      console.error('Error submitting entries:', error);
      toast.error('Failed to submit');
    } finally {
      setSaving(false);
    }
  }, [user?.email, entries]);

  const approveEntries = useCallback(async (ids: string[]) => {
    if (!user?.email) return;
    try {
      setSaving(true);
      const { error } = await (supabase as any)
        .from('nres_management_time')
        .update({ status: 'approved', approved_by: user.email, approved_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
      setEntries(prev => prev.map(e => ids.includes(e.id) ? { ...e, status: 'approved' as const, approved_by: user.email!, approved_at: new Date().toISOString() } : e));
      toast.success('Entries approved');
    } catch (error) {
      console.error('Error approving:', error);
      toast.error('Failed to approve');
    } finally {
      setSaving(false);
    }
  }, [user?.email]);

  const markEntriesPaid = useCallback(async (ids: string[]) => {
    try {
      setSaving(true);
      const { error } = await (supabase as any)
        .from('nres_management_time')
        .update({ status: 'paid' })
        .in('id', ids);
      if (error) throw error;
      setEntries(prev => prev.map(e => ids.includes(e.id) ? { ...e, status: 'paid' as const } : e));
      toast.success('Entries marked as paid');
    } catch (error) {
      console.error('Error marking paid:', error);
      toast.error('Failed to mark as paid');
    } finally {
      setSaving(false);
    }
  }, []);

  return { entries, loading, saving, admin, addEntry, deleteEntry, submitMonth, approveEntries, markEntriesPaid, refetch: fetchEntries };
}
