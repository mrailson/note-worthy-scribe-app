import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { 
  ResponsibilityAssignment,
  AssignmentFormData,
  Responsibility,
  FrequencyType
} from '@/types/responsibilityTypes';
import { addMonths, addWeeks, setMonth, setDate, startOfYear, endOfYear } from 'date-fns';

export function useResponsibilityAssignments() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<ResponsibilityAssignment[]>([]);
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

  const fetchAssignments = useCallback(async () => {
    if (!user || !practiceId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pm_responsibility_assignments')
        .select(`
          *,
          responsibility:pm_responsibilities(
            *,
            category:pm_responsibility_categories(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Cast the response to match our types
      const typedData: ResponsibilityAssignment[] = (data || []).map(item => ({
        ...item,
        responsibility: item.responsibility ? {
          ...item.responsibility,
          frequency_type: item.responsibility.frequency_type as FrequencyType,
          category: item.responsibility.category || undefined,
        } : undefined,
      }));

      setAssignments(typedData);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [user, practiceId]);

  useEffect(() => {
    if (user && practiceId) {
      fetchAssignments();
    }
  }, [user, practiceId, fetchAssignments]);

  const createAssignment = async (data: AssignmentFormData): Promise<ResponsibilityAssignment | null> => {
    if (!user) return null;

    setSaving(true);
    try {
      // Create the assignment
      const { data: newAssignment, error } = await supabase
        .from('pm_responsibility_assignments')
        .insert({
          responsibility_id: data.responsibility_id,
          assigned_to_user_id: data.assigned_to_user_id,
          assigned_to_role: data.assigned_to_role,
          assigned_by: user.id,
          notes: data.notes || null,
        })
        .select(`
          *,
          responsibility:pm_responsibilities(
            *,
            category:pm_responsibility_categories(*)
          )
        `)
        .single();

      if (error) throw error;

      // Cast the response
      const typedAssignment: ResponsibilityAssignment = {
        ...newAssignment,
        responsibility: newAssignment.responsibility ? {
          ...newAssignment.responsibility,
          frequency_type: newAssignment.responsibility.frequency_type as FrequencyType,
          category: newAssignment.responsibility.category || undefined,
        } : undefined,
      };

      // If create_instances is true, generate instances based on frequency
      if (data.create_instances && typedAssignment) {
        await generateInstances(typedAssignment, data.start_date, data.custom_due_date);
      }

      setAssignments(prev => [typedAssignment, ...prev]);
      toast.success('Assignment created');
      return typedAssignment;
    } catch (error) {
      console.error('Error creating assignment:', error);
      toast.error('Failed to create assignment');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const generateInstances = async (
    assignment: ResponsibilityAssignment,
    startDate: string,
    customDueDate: string | null
  ) => {
    const resp = assignment.responsibility;
    if (!resp) return;

    const instances: { 
      responsibility_id: string;
      assignment_id: string;
      due_date: string;
      status: string;
    }[] = [];

    const start = new Date(startDate);
    const yearEnd = endOfYear(start);

    // Calculate due dates based on frequency
    if (customDueDate) {
      // Single custom due date
      instances.push({
        responsibility_id: resp.id,
        assignment_id: assignment.id,
        due_date: customDueDate,
        status: 'pending',
      });
    } else if (resp.frequency_type === 'one-off') {
      // One-off: just create one instance for start date
      instances.push({
        responsibility_id: resp.id,
        assignment_id: assignment.id,
        due_date: startDate,
        status: 'pending',
      });
    } else if (resp.frequency_type === 'annual') {
      // Annual: create for typical due month/day
      let dueDate = startOfYear(start);
      if (resp.typical_due_month) {
        dueDate = setMonth(dueDate, resp.typical_due_month - 1);
      }
      if (resp.typical_due_day) {
        dueDate = setDate(dueDate, resp.typical_due_day);
      }
      // If due date has passed this year, use next year
      if (dueDate < start) {
        dueDate = addMonths(dueDate, 12);
      }
      instances.push({
        responsibility_id: resp.id,
        assignment_id: assignment.id,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'pending',
      });
    } else if (resp.frequency_type === 'quarterly') {
      // Quarterly: create for rest of year
      let current = start;
      while (current <= yearEnd) {
        instances.push({
          responsibility_id: resp.id,
          assignment_id: assignment.id,
          due_date: current.toISOString().split('T')[0],
          status: 'pending',
        });
        current = addMonths(current, 3);
      }
    } else if (resp.frequency_type === 'monthly') {
      // Monthly: create for rest of year
      let current = start;
      while (current <= yearEnd) {
        instances.push({
          responsibility_id: resp.id,
          assignment_id: assignment.id,
          due_date: current.toISOString().split('T')[0],
          status: 'pending',
        });
        current = addMonths(current, 1);
      }
    } else if (resp.frequency_type === 'weekly') {
      // Weekly: create for next 12 weeks
      let current = start;
      for (let i = 0; i < 12; i++) {
        instances.push({
          responsibility_id: resp.id,
          assignment_id: assignment.id,
          due_date: current.toISOString().split('T')[0],
          status: 'pending',
        });
        current = addWeeks(current, 1);
      }
    } else if (resp.frequency_type === 'custom' && resp.frequency_value) {
      // Custom: every X months
      let current = start;
      while (current <= yearEnd) {
        instances.push({
          responsibility_id: resp.id,
          assignment_id: assignment.id,
          due_date: current.toISOString().split('T')[0],
          status: 'pending',
        });
        current = addMonths(current, resp.frequency_value);
      }
    }

    if (instances.length > 0) {
      const { error } = await supabase
        .from('pm_responsibility_instances')
        .insert(instances);

      if (error) {
        console.error('Error creating instances:', error);
      }
    }
  };

  const updateAssignment = async (id: string, data: Partial<AssignmentFormData>): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('pm_responsibility_assignments')
        .update({
          assigned_to_user_id: data.assigned_to_user_id,
          assigned_to_role: data.assigned_to_role,
          notes: data.notes,
        })
        .eq('id', id);

      if (error) throw error;

      await fetchAssignments();
      toast.success('Assignment updated');
      return true;
    } catch (error) {
      console.error('Error updating assignment:', error);
      toast.error('Failed to update assignment');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteAssignment = async (id: string): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('pm_responsibility_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAssignments(prev => prev.filter(a => a.id !== id));
      toast.success('Assignment deleted');
      return true;
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast.error('Failed to delete assignment');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const getAssignmentsByRole = (role: string) => {
    return assignments.filter(a => a.assigned_to_role === role);
  };

  const getAssignmentsByUser = (userId: string) => {
    return assignments.filter(a => a.assigned_to_user_id === userId);
  };

  return {
    assignments,
    loading,
    saving,
    fetchAssignments,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    getAssignmentsByRole,
    getAssignmentsByUser,
  };
}
