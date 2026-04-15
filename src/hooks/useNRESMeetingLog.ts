import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { NRES_ADMIN_EMAILS } from '@/data/nresAdminEmails';
import { NRES_ODS_CODES } from '@/data/nresPractices';
import type { ManagementRoleConfig } from '@/hooks/useNRESBuyBackRateSettings';

export interface MeetingLogEntry {
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
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useNRESMeetingLog() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<MeetingLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isAdmin = user?.email ? NRES_ADMIN_EMAILS.includes(user.email.toLowerCase()) : false;

  const fetchEntries = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      // Only fetch attending_meeting type entries (identified by role_key prefix or description)
      // We filter in-memory by role_type after fetch since DB has no role_type column
      const { data, error } = await (supabase as any)
        .from('nres_management_time')
        .select('*')
        .order('work_date', { ascending: false });
      if (error) throw error;
      setEntries((data || []) as MeetingLogEntry[]);
    } catch (e) {
      console.error('[useNRESMeetingLog] fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { if (user?.id) fetchEntries(); }, [user?.id, fetchEntries]);

  /** Get entries for a specific practice (filtered by billing_org_code) and claim month */
  const getEntriesForPractice = useCallback((practiceKey: string, claimMonth: string): MeetingLogEntry[] => {
    const odsCode = NRES_ODS_CODES[practiceKey] || '';
    return entries.filter(e =>
      e.billing_org_code === odsCode &&
      e.claim_month === claimMonth
    );
  }, [entries]);

  /** Add a meeting attendance entry */
  const addMeetingEntry = useCallback(async (params: {
    practiceKey: string;
    roleConfig: ManagementRoleConfig;
    meetingName: string;
    meetingDate: string;
    hours: number;
    claimMonth: string;
    addedByAdmin?: boolean;
  }): Promise<MeetingLogEntry | null> => {
    if (!user?.id) return null;
    const { practiceKey, roleConfig, meetingName, meetingDate, hours, claimMonth } = params;
    const odsCode = NRES_ODS_CODES[practiceKey] || roleConfig.billing_org_code || '';
    try {
      setSaving(true);
      const { data, error } = await (supabase as any)
        .from('nres_management_time')
        .insert({
          user_id: user.id,
          management_role_key: roleConfig.key,
          person_name: roleConfig.person_name,
          work_date: meetingDate,
          hours,
          description: meetingName,
          claim_month: claimMonth,
          billing_entity: roleConfig.billing_entity,
          billing_org_code: odsCode,
          hourly_rate: roleConfig.hourly_rate,
          status: 'draft',
        })
        .select()
        .single();
      if (error) throw error;
      setEntries(prev => [data as MeetingLogEntry, ...prev]);
      toast.success('Meeting logged');
      return data as MeetingLogEntry;
    } catch (e: any) {
      console.error('[useNRESMeetingLog] addEntry error', e);
      toast.error('Failed to log meeting');
      return null;
    } finally {
      setSaving(false);
    }
  }, [user?.id]);

  /** Delete a draft entry */
  const deleteMeetingEntry = useCallback(async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('nres_management_time')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success('Entry removed');
    } catch (e) {
      console.error('[useNRESMeetingLog] delete error', e);
      toast.error('Failed to remove entry');
    }
  }, []);

  /** Submit all draft entries for a practice+month combination */
  const submitMonthEntries = useCallback(async (practiceKey: string, claimMonth: string, submittedBy?: string): Promise<boolean> => {
    const odsCode = NRES_ODS_CODES[practiceKey] || '';
    const cm = claimMonth.slice(0, 7);
    const drafts = entries.filter(e =>
      e.billing_org_code === odsCode &&
      (e.claim_month?.slice(0, 7) || '') === cm &&
      (e.status === 'draft' || e.status === 'queried')
    );
    if (drafts.length === 0) {
      toast.error('No draft or queried meeting entries to submit for this month');
      return false;
    }
    try {
      setSaving(true);
      const ids = drafts.map(e => e.id);
      const { error } = await (supabase as any)
        .from('nres_management_time')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          submitted_by: submittedBy || user?.email || '',
        })
        .in('id', ids);
      if (error) throw error;
      setEntries(prev => prev.map(e =>
        ids.includes(e.id)
          ? { ...e, status: 'submitted' as const, submitted_at: new Date().toISOString(), submitted_by: submittedBy || user?.email || '' }
          : e
      ));
      toast.success(`${drafts.length} meeting ${drafts.length === 1 ? 'entry' : 'entries'} submitted for ${claimMonth}`);
      return true;
    } catch (e) {
      console.error('[useNRESMeetingLog] submit error', e);
      toast.error('Failed to submit entries');
      return false;
    } finally {
      setSaving(false);
    }
  }, [entries, user?.email]);

  /** Verify meeting entries (submitted → verified) */
  const verifyMeetingEntries = useCallback(async (ids: string[], notes?: string): Promise<boolean> => {
    if (!user?.email) return false;
    try {
      setSaving(true);
      const { error } = await (supabase as any)
        .from('nres_management_time')
        .update({
          status: 'verified',
          verified_by: user.email,
          verified_at: new Date().toISOString(),
          notes: notes || null,
        })
        .in('id', ids);
      if (error) throw error;
      setEntries(prev => prev.map(e =>
        ids.includes(e.id)
          ? { ...e, status: 'verified' as const, notes: notes || e.notes }
          : e
      ));
      toast.success(`${ids.length} meeting ${ids.length === 1 ? 'entry' : 'entries'} verified`);
      return true;
    } catch (e) {
      console.error('[useNRESMeetingLog] verify error', e);
      toast.error('Failed to verify entries');
      return false;
    } finally {
      setSaving(false);
    }
  }, [user?.email]);

  /** Return meeting entries to practice (submitted → queried) */
  const returnMeetingEntries = useCallback(async (ids: string[], notes?: string): Promise<boolean> => {
    if (!user?.email) return false;
    try {
      setSaving(true);
      const { error } = await (supabase as any)
        .from('nres_management_time')
        .update({
          status: 'queried',
          query_notes: notes || null,
        })
        .in('id', ids);
      if (error) throw error;
      setEntries(prev => prev.map(e =>
        ids.includes(e.id)
          ? { ...e, status: 'queried' as const, query_notes: notes || null } as any
          : e
      ));
      toast.success(`${ids.length} meeting ${ids.length === 1 ? 'entry' : 'entries'} returned to practice`);
      return true;
    } catch (e) {
      console.error('[useNRESMeetingLog] return error', e);
      toast.error('Failed to return entries');
      return false;
    } finally {
      setSaving(false);
    }
  }, [user?.email]);

  /** Approve meeting entries (verified → approved) */
  const approveMeetingEntries = useCallback(async (ids: string[], notes?: string): Promise<boolean> => {
    if (!user?.email) return false;
    try {
      setSaving(true);
      const { error } = await (supabase as any)
        .from('nres_management_time')
        .update({
          status: 'approved',
          approved_by: user.email,
          approved_at: new Date().toISOString(),
          notes: notes || null,
        })
        .in('id', ids);
      if (error) throw error;
      setEntries(prev => prev.map(e =>
        ids.includes(e.id)
          ? { ...e, status: 'approved' as const, notes: notes || e.notes }
          : e
      ));
      toast.success(`${ids.length} meeting ${ids.length === 1 ? 'entry' : 'entries'} approved`);
      return true;
    } catch (e) {
      console.error('[useNRESMeetingLog] approve error', e);
      toast.error('Failed to approve entries');
      return false;
    } finally {
      setSaving(false);
    }
  }, [user?.email]);

  /** Reject meeting entries (→ rejected) */
  const rejectMeetingEntries = useCallback(async (ids: string[], notes?: string): Promise<boolean> => {
    if (!user?.email) return false;
    try {
      setSaving(true);
      const { error } = await (supabase as any)
        .from('nres_management_time')
        .update({
          status: 'rejected',
          notes: notes || null,
        })
        .in('id', ids);
      if (error) throw error;
      setEntries(prev => prev.map(e =>
        ids.includes(e.id)
          ? { ...e, status: 'rejected' as const, notes: notes || e.notes }
          : e
      ));
      toast.success(`${ids.length} meeting ${ids.length === 1 ? 'entry' : 'entries'} rejected`);
      return true;
    } catch (e) {
      console.error('[useNRESMeetingLog] reject error', e);
      toast.error('Failed to reject entries');
      return false;
    } finally {
      setSaving(false);
    }
  }, [user?.email]);

  /** Query meeting entries from Director (verified → queried) */
  const queryMeetingEntries = useCallback(async (ids: string[], notes?: string): Promise<boolean> => {
    if (!user?.email) return false;
    try {
      setSaving(true);
      const { error } = await (supabase as any)
        .from('nres_management_time')
        .update({
          status: 'queried',
          query_notes: notes || null,
        })
        .in('id', ids);
      if (error) throw error;
      setEntries(prev => prev.map(e =>
        ids.includes(e.id)
          ? { ...e, status: 'queried' as const } as any
          : e
      ));
      toast.success(`${ids.length} meeting ${ids.length === 1 ? 'entry' : 'entries'} queried`);
      return true;
    } catch (e) {
      console.error('[useNRESMeetingLog] query error', e);
      toast.error('Failed to query entries');
      return false;
    } finally {
      setSaving(false);
    }
  }, [user?.email]);

  return {
    entries,
    loading,
    saving,
    isAdmin,
    getEntriesForPractice,
    addMeetingEntry,
    deleteMeetingEntry,
    submitMonthEntries,
    verifyMeetingEntries,
    returnMeetingEntries,
    approveMeetingEntries,
    rejectMeetingEntries,
    queryMeetingEntries,
    refetch: fetchEntries,
  };
}
