import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { NRESHoursEntry } from '@/types/nresHoursTypes';

export function useNRESHoursTracker() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<NRESHoursEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('nres_hours_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('work_date', { ascending: false })
        .order('start_time', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching hours entries:', error);
      toast.error('Failed to load hours entries');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchEntries();
    }
  }, [user?.id, fetchEntries]);

  const addEntry = async (entry: Omit<NRESHoursEntry, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user?.id) return;

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('nres_hours_entries')
        .insert({
          ...entry,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;
      setEntries(prev => [data, ...prev]);
      toast.success('Hours entry added');
      return data;
    } catch (error) {
      console.error('Error adding hours entry:', error);
      toast.error('Failed to add hours entry');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateEntry = async (id: string, updates: Partial<NRESHoursEntry>) => {
    if (!user?.id) return;

    try {
      setSaving(true);
      const { data, error } = await supabase
        .from('nres_hours_entries')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      setEntries(prev => prev.map(e => e.id === id ? data : e));
      toast.success('Hours entry updated');
      return data;
    } catch (error) {
      console.error('Error updating hours entry:', error);
      toast.error('Failed to update hours entry');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('nres_hours_entries')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success('Hours entry deleted');
    } catch (error) {
      console.error('Error deleting hours entry:', error);
      toast.error('Failed to delete hours entry');
    }
  };

  const totalHours = entries.reduce((sum, e) => sum + Number(e.duration_hours), 0);

  return {
    entries,
    loading,
    saving,
    addEntry,
    updateEntry,
    deleteEntry,
    refetch: fetchEntries,
    totalHours
  };
}
