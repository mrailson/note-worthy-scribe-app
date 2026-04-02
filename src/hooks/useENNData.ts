import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ENNHub {
  id: string;
  hub_name: string;
  hub_list_size: number;
  annual_income: number;
  weekly_appts_required: number;
  practice_id: string;
}

export interface ENNPracticeData {
  id: string;
  practice_id: string;
  ods_code: string;
  list_size: number;
  address: string | null;
  annual_appts_required: number;
  weekly_appts_required: number;
  participating_winter: boolean;
  winter_appts_required: number;
  non_winter_appts_required: number;
  weekly_non_winter_appts: number;
}

export interface ENNHubMapping {
  id: string;
  hub_id: string;
  practice_id: string;
}

export const useENNData = () => {
  const { user } = useAuth();

  const { data: hubs, isLoading: hubsLoading } = useQuery({
    queryKey: ['enn-hubs'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('enn_hubs')
        .select('*') as any);
      if (error) throw error;
      return (data || []) as ENNHub[];
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const { data: practiceData, isLoading: practiceLoading } = useQuery({
    queryKey: ['enn-practice-data'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('enn_practice_data')
        .select('*') as any);
      if (error) throw error;
      return (data || []) as ENNPracticeData[];
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const { data: hubMappings, isLoading: mappingsLoading } = useQuery({
    queryKey: ['enn-hub-mappings'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('enn_hub_practice_mappings')
        .select('*') as any);
      if (error) throw error;
      return (data || []) as ENNHubMapping[];
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const getHubForPractice = (practiceId: string): ENNHub | undefined => {
    const mapping = hubMappings?.find(m => m.practice_id === practiceId);
    if (!mapping) return undefined;
    return hubs?.find(h => h.id === mapping.hub_id);
  };

  const getPracticesForHub = (hubId: string): ENNPracticeData[] => {
    const mappings = hubMappings?.filter(m => m.hub_id === hubId) || [];
    const practiceIds = mappings.map(m => m.practice_id);
    return practiceData?.filter(p => practiceIds.includes(p.practice_id)) || [];
  };

  const totalListSize = practiceData?.reduce((sum, p) => sum + p.list_size, 0) || 0;
  const totalAnnualAppts = practiceData?.reduce((sum, p) => sum + p.annual_appts_required, 0) || 0;
  const totalWeeklyAppts = practiceData?.reduce((sum, p) => sum + p.weekly_appts_required, 0) || 0;
  const totalBudget = hubs?.reduce((sum, h) => sum + Number(h.annual_income), 0) || 0;

  return {
    hubs: hubs || [],
    practiceData: practiceData || [],
    hubMappings: hubMappings || [],
    getHubForPractice,
    getPracticesForHub,
    totalListSize,
    totalAnnualAppts,
    totalWeeklyAppts,
    totalBudget,
    isLoading: hubsLoading || practiceLoading || mappingsLoading,
  };
};
