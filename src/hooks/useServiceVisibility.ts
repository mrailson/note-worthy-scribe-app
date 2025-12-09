import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ServiceVisibility {
  ai4pm_service: boolean;
  meeting_notes: boolean;
  gp_scribe: boolean;
  complaints_system: boolean;
  ai_4_pm: boolean;
  enhanced_access: boolean;
  cqc_compliance: boolean;
  shared_drive: boolean;
  nres: boolean;
  mic_test: boolean;
  translation: boolean;
  fridge_monitoring: boolean;
  lg_capture: boolean;
  bp_service: boolean;
}

const defaultVisibility: ServiceVisibility = {
  ai4pm_service: true,
  meeting_notes: true,
  gp_scribe: true,
  complaints_system: true,
  ai_4_pm: true,
  enhanced_access: true,
  cqc_compliance: true,
  shared_drive: true,
  nres: true,
  mic_test: true,
  translation: true,
  fridge_monitoring: true,
  lg_capture: true,
  bp_service: true,
};

export const useServiceVisibility = () => {
  const { user } = useAuth();
  const [visibility, setVisibility] = useState<ServiceVisibility>(defaultVisibility);
  const [loading, setLoading] = useState(true);

  const loadVisibility = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('setting_value')
        .eq('user_id', user.id)
        .eq('setting_key', 'service_visibility');

      if (error) throw error;

      if (data && data.length > 0) {
        const savedVisibility = data[0].setting_value as unknown as Partial<ServiceVisibility>;
        setVisibility({ ...defaultVisibility, ...savedVisibility });
      }
    } catch (error) {
      console.error('Error loading service visibility:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVisibility();
  }, [user]);

  const isServiceVisible = (serviceKey: keyof ServiceVisibility): boolean => {
    return visibility[serviceKey] ?? true;
  };

  return {
    visibility,
    loading,
    isServiceVisible,
    refresh: loadVisibility
  };
};
