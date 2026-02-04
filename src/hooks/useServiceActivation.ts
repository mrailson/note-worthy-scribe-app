import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ServiceType = 'ai4pm' | 'ai4gp' | 'nres' | 'meeting_recorder' | 'complaints' | 'cqc' | 'lg_capture' | 'bp_service' | 'policy_service';

// Map service types to user_roles column names
const serviceToRoleColumn: Record<string, string> = {
  'lg_capture': 'lg_capture_access',
  'bp_service': 'bp_service_access',
};

export const useServiceActivation = () => {
  const { user } = useAuth();

  // Fetch from user_service_activations table
  const { data: activations, isLoading: activationsLoading } = useQuery({
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
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Fetch from user_roles table for role-based access
  const { data: userRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ['user-roles-access', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('lg_capture_access, bp_service_access')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user roles:', error);
        return null;
      }

      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const hasServiceAccess = (service: ServiceType): boolean => {
    // Check if this service uses the user_roles table
    const roleColumn = serviceToRoleColumn[service];
    if (roleColumn && userRoles) {
      return (userRoles as any)[roleColumn] === true;
    }
    
    // Otherwise check user_service_activations table
    if (!activations) return false;
    return activations.some((a: any) => a.service === service);
  };

  return {
    hasServiceAccess,
    isLoading: activationsLoading || rolesLoading,
    activations: activations || [],
  };
};
