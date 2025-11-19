import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ServiceType = 'ai4pm' | 'ai4gp' | 'nres' | 'meeting_recorder' | 'complaints' | 'cqc';

export const useServiceActivation = () => {
  const { user } = useAuth();

  const { data: activations, isLoading } = useQuery({
    queryKey: ['service-activations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_service_activations')
        .select('service')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching service activations:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!user?.id,
  });

  const hasServiceAccess = (service: ServiceType): boolean => {
    if (!activations) return false;
    return activations.some((a: any) => a.service === service);
  };

  return {
    hasServiceAccess,
    isLoading,
    activations: activations || [],
  };
};
