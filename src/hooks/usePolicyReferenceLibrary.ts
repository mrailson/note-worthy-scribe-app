import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PolicyReference {
  id: string;
  policy_name: string;
  category: string;
  cqc_kloe: string;
  priority: string;
  guidance_sources: string[];
  required_services: string[];
  required_roles: string[];
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export const usePolicyReferenceLibrary = () => {
  const { data: policies = [], isLoading, error, refetch } = useQuery({
    queryKey: ['policy-reference-library'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('policy_reference_library')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('policy_name');

      if (error) {
        console.error('Error fetching policy reference library:', error);
        throw error;
      }

      return (data || []) as PolicyReference[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const getPolicyById = (id: string) => {
    return policies.find(p => p.id === id) || null;
  };

  const getPoliciesByCategory = (category: string) => {
    return policies.filter(p => p.category === category);
  };

  const getPoliciesByKloe = (kloe: string) => {
    return policies.filter(p => p.cqc_kloe === kloe);
  };

  const getPoliciesByPriority = (priority: string) => {
    return policies.filter(p => p.priority === priority);
  };

  return {
    policies,
    isLoading,
    error,
    refetch,
    getPolicyById,
    getPoliciesByCategory,
    getPoliciesByKloe,
    getPoliciesByPriority,
  };
};
