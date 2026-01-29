import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { 
  ResponsibilityInstance,
  InstanceStatus,
  FrequencyType
} from '@/types/responsibilityTypes';
import { startOfMonth, endOfMonth, format, isBefore, startOfDay } from 'date-fns';

export function useResponsibilityInstances() {
  const { user } = useAuth();
  const [instances, setInstances] = useState<ResponsibilityInstance[]>([]);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch user's practice_id from user_roles
  useEffect(() => {
    const fetchPracticeId = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('user_roles')
        .select('practice_id')
        .eq('user_id', user.id)
        .not('practice_id', 'is', null)
        .limit(1)
        .maybeSingle();
      
      if (data?.practice_id) {
        setPracticeId(data.practice_id);
      }
    };
    
    fetchPracticeId();
  }, [user]);

  const fetchInstances = useCallback(async (startDate?: Date, endDate?: Date) => {
    if (!user || !practiceId) return;

    setLoading(true);
    try {
      let query = supabase
        .from('pm_responsibility_instances')
        .select(`
          *,
          responsibility:pm_responsibilities(
            *,
            category:pm_responsibility_categories(*)
          ),
          assignment:pm_responsibility_assignments(
            *
          )
        `)
        .order('due_date', { ascending: true });

      if (startDate && endDate) {
        query = query
          .gte('due_date', format(startDate, 'yyyy-MM-dd'))
          .lte('due_date', format(endDate, 'yyyy-MM-dd'));
      }

      const { data, error } = await query;

      if (error) throw error;

      // Auto-update overdue status and cast types
      const today = startOfDay(new Date());
      const typedInstances: ResponsibilityInstance[] = (data || []).map(item => {
        let status = item.status as InstanceStatus;
        if (status === 'pending' && isBefore(new Date(item.due_date), today)) {
          status = 'overdue';
        }
        return {
          ...item,
          status,
          responsibility: item.responsibility ? {
            ...item.responsibility,
            frequency_type: item.responsibility.frequency_type as FrequencyType,
            category: item.responsibility.category || undefined,
          } : undefined,
          assignment: item.assignment || undefined,
        };
      });

      setInstances(typedInstances);
    } catch (error) {
      console.error('Error fetching instances:', error);
      toast.error('Failed to load task instances');
    } finally {
      setLoading(false);
    }
  }, [user, practiceId]);

  useEffect(() => {
    if (user && practiceId) {
      fetchInstances();
    }
  }, [user, practiceId, fetchInstances]);

  const fetchInstancesForMonth = useCallback(async (date: Date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    await fetchInstances(start, end);
  }, [fetchInstances]);

  const updateInstanceStatus = async (
    id: string, 
    status: InstanceStatus,
    evidenceNotes?: string,
    evidenceUrl?: string
  ): Promise<boolean> => {
    if (!user) return false;

    setSaving(true);
    try {
      const updates: Record<string, unknown> = { status };
      
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
        updates.completed_by = user.id;
      }
      
      if (evidenceNotes !== undefined) {
        updates.evidence_notes = evidenceNotes;
      }
      
      if (evidenceUrl !== undefined) {
        updates.evidence_url = evidenceUrl;
      }

      const { error } = await supabase
        .from('pm_responsibility_instances')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setInstances(prev => 
        prev.map(inst => inst.id === id ? { ...inst, ...updates, status } : inst)
      );
      
      toast.success(`Task marked as ${status}`);
      return true;
    } catch (error) {
      console.error('Error updating instance:', error);
      toast.error('Failed to update task');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const createInstance = async (
    responsibilityId: string,
    assignmentId: string | null,
    dueDate: string
  ): Promise<ResponsibilityInstance | null> => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('pm_responsibility_instances')
        .insert({
          responsibility_id: responsibilityId,
          assignment_id: assignmentId,
          due_date: dueDate,
          status: 'pending',
        })
        .select(`
          *,
          responsibility:pm_responsibilities(
            *,
            category:pm_responsibility_categories(*)
          ),
          assignment:pm_responsibility_assignments(*)
        `)
        .single();

      if (error) throw error;

      const typedInstance: ResponsibilityInstance = {
        ...data,
        status: data.status as InstanceStatus,
        responsibility: data.responsibility ? {
          ...data.responsibility,
          frequency_type: data.responsibility.frequency_type as FrequencyType,
          category: data.responsibility.category || undefined,
        } : undefined,
        assignment: data.assignment || undefined,
      };

      setInstances(prev => [...prev, typedInstance]);
      toast.success('Task instance created');
      return typedInstance;
    } catch (error) {
      console.error('Error creating instance:', error);
      toast.error('Failed to create task instance');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const deleteInstance = async (id: string): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('pm_responsibility_instances')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setInstances(prev => prev.filter(i => i.id !== id));
      toast.success('Task instance deleted');
      return true;
    } catch (error) {
      console.error('Error deleting instance:', error);
      toast.error('Failed to delete task instance');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Stats helpers
  const getOverdueInstances = () => 
    instances.filter(i => i.status === 'overdue');

  const getPendingInstances = () => 
    instances.filter(i => i.status === 'pending' || i.status === 'in_progress');

  const getCompletedInstances = () => 
    instances.filter(i => i.status === 'completed');

  const getInstancesByDate = (date: string) =>
    instances.filter(i => i.due_date === date);

  const getInstancesByRole = (role: string) =>
    instances.filter(i => i.assignment?.assigned_to_role === role);

  const getInstancesByUser = (userId: string) =>
    instances.filter(i => i.assignment?.assigned_to_user_id === userId);

  const getCompletionRate = () => {
    if (instances.length === 0) return 0;
    const completed = instances.filter(i => i.status === 'completed').length;
    return Math.round((completed / instances.length) * 100);
  };

  return {
    instances,
    loading,
    saving,
    fetchInstances,
    fetchInstancesForMonth,
    updateInstanceStatus,
    createInstance,
    deleteInstance,
    getOverdueInstances,
    getPendingInstances,
    getCompletedInstances,
    getInstancesByDate,
    getInstancesByRole,
    getInstancesByUser,
    getCompletionRate,
  };
}
