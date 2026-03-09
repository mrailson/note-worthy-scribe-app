import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { NRESExpense } from '@/types/nresHoursTypes';

export function useNRESExpenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<NRESExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const resolvePracticeId = useCallback(async (): Promise<string | null> => {
    if (practiceId) return practiceId;
    if (!user?.id) return null;
    try {
      const { data } = await supabase.rpc('get_user_practice_ids', { p_user_id: user.id });
      if (data && data.length > 0) {
        setPracticeId(data[0]);
        return data[0];
      }
    } catch (err) {
      console.error('Error resolving practice ID:', err);
    }
    return null;
  }, [user?.id, practiceId]);

  const fetchExpenses = useCallback(async (forceRefresh = false) => {
    if (!user?.id) return;
    if (!forceRefresh && hasFetchedRef.current) return;

    try {
      setLoading(true);

      // RLS handles practice/PCN-level visibility
      const { data, error } = await supabase
        .from('nres_expenses')
        .select('*')
        .order('expense_date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
      hasFetchedRef.current = true;
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchExpenses();
    }
    return () => {
      hasFetchedRef.current = false;
    };
  }, [user?.id]);

  const addExpense = async (expense: Omit<NRESExpense, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user?.id) return;

    try {
      setSaving(true);
      const pId = await resolvePracticeId();
      const { data, error } = await supabase
        .from('nres_expenses')
        .insert({
          ...expense,
          user_id: user.id,
          practice_id: pId
        })
        .select()
        .single();

      if (error) throw error;
      setExpenses(prev => [data, ...prev]);
      toast.success('Expense added');
      return data;
    } catch (error) {
      console.error('Error adding expense:', error);
      toast.error('Failed to add expense');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateExpense = async (id: string, updates: Partial<NRESExpense>) => {
    if (!user?.id) return;

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('nres_expenses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setExpenses(prev => prev.map(e => e.id === id ? data : e));
      toast.success('Expense updated');
      return data;
    } catch (error) {
      console.error('Error updating expense:', error);
      toast.error('Failed to update expense');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('nres_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setExpenses(prev => prev.filter(e => e.id !== id));
      toast.success('Expense deleted');
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('Failed to delete expense');
    }
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return {
    expenses,
    loading,
    saving,
    addExpense,
    updateExpense,
    deleteExpense,
    refetch: () => fetchExpenses(true),
    totalExpenses
  };
}
