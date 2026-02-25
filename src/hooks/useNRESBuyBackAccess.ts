import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { NRES_ADMIN_EMAILS } from '@/data/nresAdminEmails';

export type BuyBackAccessRole = 'submit' | 'view' | 'approver';

export interface BuyBackAccessRow {
  id: string;
  user_id: string;
  practice_key: string;
  access_role: BuyBackAccessRole;
  granted_by: string | null;
  granted_at: string;
}

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return NRES_ADMIN_EMAILS.includes(email.toLowerCase());
}

export function useNRESBuyBackAccess() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BuyBackAccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetchedRef = useRef(false);
  const admin = isAdmin(user?.email);

  const fetchAccess = useCallback(async (force = false) => {
    if (!user?.id) return;
    if (!force && hasFetchedRef.current) return;
    try {
      setLoading(true);
      // Admins see all rows; regular users only see their own (RLS handles it)
      const { data, error } = await supabase
        .from('nres_buyback_access')
        .select('*')
        .order('practice_key');
      if (error) throw error;
      setRows((data || []) as BuyBackAccessRow[]);
      hasFetchedRef.current = true;
    } catch (err) {
      console.error('Error fetching buyback access:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) fetchAccess();
    return () => { hasFetchedRef.current = false; };
  }, [user?.id]);

  /** Grant a role to a user for a practice */
  const grantAccess = useCallback(async (userId: string, practiceKey: string, role: BuyBackAccessRole) => {
    if (!user?.email) return;
    try {
      const { data, error } = await supabase
        .from('nres_buyback_access')
        .insert({ user_id: userId, practice_key: practiceKey, access_role: role, granted_by: user.email })
        .select()
        .single();
      if (error) {
        // Duplicate – ignore
        if (error.code === '23505') return;
        throw error;
      }
      setRows(prev => [...prev, data as BuyBackAccessRow]);
    } catch (err) {
      console.error('Error granting access:', err);
      toast.error('Failed to grant access');
    }
  }, [user?.email]);

  /** Revoke a specific access row by id */
  const revokeAccess = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('nres_buyback_access')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setRows(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Error revoking access:', err);
      toast.error('Failed to revoke access');
    }
  }, []);

  /** Revoke by composite key */
  const revokeByKey = useCallback(async (userId: string, practiceKey: string, role: BuyBackAccessRole) => {
    const row = rows.find(r => r.user_id === userId && r.practice_key === practiceKey && r.access_role === role);
    if (row) await revokeAccess(row.id);
  }, [rows, revokeAccess]);

  /** Check if a user has a specific role for a practice */
  const hasAccess = useCallback((userId: string, practiceKey: string, role: BuyBackAccessRole) => {
    return rows.some(r => r.user_id === userId && r.practice_key === practiceKey && r.access_role === role);
  }, [rows]);

  /** Get all practices the current user can access (any role) */
  const myPractices = useMemo(() => {
    if (!user?.id) return [];
    // Admins get all practices by default
    if (admin) {
      const assigned = rows.filter(r => r.user_id === user.id).map(r => r.practice_key);
      return [...new Set(assigned)];
    }
    const keys = rows.filter(r => r.user_id === user.id).map(r => r.practice_key);
    return [...new Set(keys)];
  }, [rows, user?.id, admin]);

  /** Get practices the current user can submit to */
  const mySubmitPractices = useMemo(() => {
    if (!user?.id) return [];
    return [...new Set(rows.filter(r => r.user_id === user.id && r.access_role === 'submit').map(r => r.practice_key))];
  }, [rows, user?.id]);

  /** Get practices the current user can approve */
  const myApproverPractices = useMemo(() => {
    if (!user?.id) return [];
    return [...new Set(rows.filter(r => r.user_id === user.id && r.access_role === 'approver').map(r => r.practice_key))];
  }, [rows, user?.id]);

  /** Check if a user has the approver role for any practice */
  const isApproverForAny = useCallback((userId: string) => {
    return rows.some(r => r.user_id === userId && r.access_role === 'approver');
  }, [rows]);

  return {
    rows,
    loading,
    admin,
    grantAccess,
    revokeAccess,
    revokeByKey,
    hasAccess,
    myPractices,
    mySubmitPractices,
    myApproverPractices,
    isApproverForAny,
    refetch: () => fetchAccess(true),
  };
}
