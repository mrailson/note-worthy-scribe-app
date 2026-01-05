import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { NRESUserSettings } from '@/types/nresHoursTypes';

export function useNRESUserSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NRESUserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchSettings();
    }
  }, [user?.id]);

  const fetchSettings = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('nres_user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching NRES settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveHourlyRate = async (rate: number) => {
    if (!user?.id) return;

    try {
      setSaving(true);
      
      if (settings) {
        // Update existing settings
        const { data, error } = await supabase
          .from('nres_user_settings')
          .update({ 
            hourly_rate: rate,
            rate_set_at: settings.rate_set_at || new Date().toISOString()
          })
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        setSettings(data);
      } else {
        // Create new settings
        const { data, error } = await supabase
          .from('nres_user_settings')
          .insert({
            user_id: user.id,
            hourly_rate: rate,
            rate_set_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;
        setSettings(data);
      }
      
      toast.success('Hourly rate saved');
    } catch (error) {
      console.error('Error saving hourly rate:', error);
      toast.error('Failed to save hourly rate');
    } finally {
      setSaving(false);
    }
  };

  return {
    settings,
    loading,
    saving,
    saveHourlyRate,
    hourlyRate: settings?.hourly_rate ?? null,
    hasRateSet: !!settings?.hourly_rate
  };
}
