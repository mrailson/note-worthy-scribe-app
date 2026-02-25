import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { practices as defaultPractices, RecruitmentPractice } from '@/data/nresRecruitmentData';

export function useRecruitmentConfig() {
  const { user } = useAuth();
  const [practices, setPractices] = useState<RecruitmentPractice[]>(defaultPractices);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('nres_recruitment_config' as any)
        .select('*')
        .eq('id', 'default')
        .single();

      if (error) {
        console.error('Error fetching recruitment config:', error);
        return;
      }

      if (data) {
        const row = data as any;
        if (row.practices_data && Array.isArray(row.practices_data) && row.practices_data.length > 0) {
          setPractices(row.practices_data as RecruitmentPractice[]);
        }
        setUpdatedAt(row.updated_at);
      }
    } catch (err) {
      console.error('Error fetching recruitment config:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateConfig = useCallback(async (newPractices: RecruitmentPractice[]) => {
    if (!user) {
      toast.error('You must be logged in to update configuration.');
      return false;
    }

    try {
      const { error } = await supabase
        .from('nres_recruitment_config' as any)
        .upsert({
          id: 'default',
          practices_data: newPractices,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        } as any);

      if (error) {
        console.error('Error updating recruitment config:', error);
        toast.error('Failed to save changes.');
        return false;
      }

      setPractices(newPractices);
      setUpdatedAt(new Date().toISOString());
      toast.success('Recruitment data saved successfully.');
      return true;
    } catch (err) {
      console.error('Error updating recruitment config:', err);
      toast.error('Failed to save changes.');
      return false;
    }
  }, [user]);

  return {
    practices,
    updatedAt,
    isLoading,
    updateConfig,
  };
}
