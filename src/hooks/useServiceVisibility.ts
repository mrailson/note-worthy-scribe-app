import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  survey_manager: boolean;
  policy_service: boolean;
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
  survey_manager: true,
  policy_service: true,
};

export const useServiceVisibility = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: visibility, isLoading: loading } = useQuery({
    queryKey: ['service-visibility', user?.id],
    queryFn: async () => {
      if (!user) return defaultVisibility;

      const { data, error } = await supabase
        .from('user_settings')
        .select('setting_value')
        .eq('user_id', user.id)
        .eq('setting_key', 'service_visibility');

      if (error) {
        console.error('Error loading service visibility:', error);
        return defaultVisibility;
      }

      if (data && data.length > 0) {
        const savedVisibility = data[0].setting_value as unknown as Partial<ServiceVisibility>;
        return { ...defaultVisibility, ...savedVisibility };
      }

      return defaultVisibility;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes - visibility rarely changes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on every tab switch
  });

  const isServiceVisible = (serviceKey: keyof ServiceVisibility): boolean => {
    return visibility?.[serviceKey] ?? true;
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['service-visibility', user?.id] });
  };

  return {
    visibility: visibility ?? defaultVisibility,
    loading,
    isServiceVisible,
    refresh
  };
};
