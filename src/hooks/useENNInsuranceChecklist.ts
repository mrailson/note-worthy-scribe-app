import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface InsuranceChecklistRow {
  id: string;
  practice_name: string;
  insurance_type: string;
  confirmed: boolean;
  amount: string;
  updated_by: string | null;
  updated_at: string;
}

export interface PracticeInsuranceGroup {
  practice: string;
  insurances: InsuranceChecklistRow[];
  lastUpdatedBy: string | null;
  lastUpdatedAt: string | null;
}

export const useENNInsuranceChecklist = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: rows, isLoading } = useQuery({
    queryKey: ['enn-insurance-checklist'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('enn_insurance_checklist')
        .select('*')
        .order('practice_name')
        .order('insurance_type') as any);
      if (error) throw error;
      return (data || []) as InsuranceChecklistRow[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const grouped: PracticeInsuranceGroup[] = (() => {
    if (!rows) return [];
    const map = new Map<string, InsuranceChecklistRow[]>();
    for (const r of rows) {
      const arr = map.get(r.practice_name) || [];
      arr.push(r);
      map.set(r.practice_name, arr);
    }
    return Array.from(map.entries()).map(([practice, insurances]) => {
      const latest = insurances.reduce((a, b) =>
        new Date(a.updated_at) > new Date(b.updated_at) ? a : b
      );
      return {
        practice,
        insurances,
        lastUpdatedBy: latest.updated_by,
        lastUpdatedAt: latest.updated_at,
      };
    });
  })();

  const toggleConfirmed = useMutation({
    mutationFn: async ({ id, confirmed }: { id: string; confirmed: boolean }) => {
      const { error } = await (supabase
        .from('enn_insurance_checklist')
        .update({
          confirmed,
          updated_by: user?.email || 'Unknown',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enn-insurance-checklist'] });
    },
    onError: () => {
      toast.error('Failed to update insurance status');
    },
  });

  const updateAmount = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: string }) => {
      const { error } = await (supabase
        .from('enn_insurance_checklist')
        .update({
          amount,
          updated_by: user?.email || 'Unknown',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enn-insurance-checklist'] });
      toast.success('Amount updated');
    },
    onError: () => {
      toast.error('Failed to update amount');
    },
  });

  return {
    practices: grouped,
    isLoading,
    toggleConfirmed: toggleConfirmed.mutate,
    updateAmount: updateAmount.mutate,
  };
};
