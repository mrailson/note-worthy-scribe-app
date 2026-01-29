import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { 
  Responsibility, 
  ResponsibilityCategory,
  ResponsibilityFormData,
  CategoryFormData,
  FrequencyType
} from '@/types/responsibilityTypes';

export function useResponsibilities() {
  const { user } = useAuth();
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [categories, setCategories] = useState<ResponsibilityCategory[]>([]);
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

  const fetchCategories = useCallback(async () => {
    if (!user || !practiceId) return;

    const { data, error } = await supabase
      .from('pm_responsibility_categories')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching categories:', error);
      return;
    }

    setCategories(data || []);
  }, [user, practiceId]);

  const fetchResponsibilities = useCallback(async () => {
    if (!user || !practiceId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pm_responsibilities')
        .select(`
          *,
          category:pm_responsibility_categories(*)
        `)
        .eq('is_active', true)
        .order('title');

      if (error) throw error;

      // Cast the response to match our types
      const typedData: Responsibility[] = (data || []).map(item => ({
        ...item,
        frequency_type: item.frequency_type as FrequencyType,
        category: item.category || undefined,
      }));

      setResponsibilities(typedData);
    } catch (error) {
      console.error('Error fetching responsibilities:', error);
      toast.error('Failed to load responsibilities');
    } finally {
      setLoading(false);
    }
  }, [user, practiceId]);

  useEffect(() => {
    if (user && practiceId) {
      fetchCategories();
      fetchResponsibilities();
    }
  }, [user, practiceId, fetchCategories, fetchResponsibilities]);

  const createCategory = async (data: CategoryFormData): Promise<ResponsibilityCategory | null> => {
    if (!user || !practiceId) return null;

    setSaving(true);
    try {
      const { data: newCategory, error } = await supabase
        .from('pm_responsibility_categories')
        .insert({
          name: data.name,
          description: data.description || null,
          colour: data.colour,
          practice_id: practiceId,
        })
        .select()
        .single();

      if (error) throw error;

      setCategories(prev => [...prev, newCategory]);
      toast.success('Category created');
      return newCategory;
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error('Failed to create category');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateCategory = async (id: string, data: Partial<CategoryFormData>): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('pm_responsibility_categories')
        .update({
          name: data.name,
          description: data.description,
          colour: data.colour,
        })
        .eq('id', id);

      if (error) throw error;

      setCategories(prev => 
        prev.map(cat => cat.id === id ? { ...cat, ...data } : cat)
      );
      toast.success('Category updated');
      return true;
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Failed to update category');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (id: string): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('pm_responsibility_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCategories(prev => prev.filter(cat => cat.id !== id));
      toast.success('Category deleted');
      return true;
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const createResponsibility = async (data: ResponsibilityFormData): Promise<Responsibility | null> => {
    if (!user || !practiceId) return null;

    setSaving(true);
    try {
      const { data: newResp, error } = await supabase
        .from('pm_responsibilities')
        .insert({
          title: data.title,
          description: data.description || null,
          category_id: data.category_id,
          frequency_type: data.frequency_type,
          frequency_value: data.frequency_value,
          typical_due_month: data.typical_due_month,
          typical_due_day: data.typical_due_day,
          is_mandatory: data.is_mandatory,
          reference_url: data.reference_url || null,
          practice_id: practiceId,
          created_by: user.id,
        })
        .select(`
          *,
          category:pm_responsibility_categories(*)
        `)
        .single();

      if (error) throw error;

      const typedResp: Responsibility = {
        ...newResp,
        frequency_type: newResp.frequency_type as FrequencyType,
        category: newResp.category || undefined,
      };

      setResponsibilities(prev => [...prev, typedResp]);
      toast.success('Responsibility created');
      return typedResp;
    } catch (error) {
      console.error('Error creating responsibility:', error);
      toast.error('Failed to create responsibility');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateResponsibility = async (id: string, data: Partial<ResponsibilityFormData>): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('pm_responsibilities')
        .update({
          title: data.title,
          description: data.description,
          category_id: data.category_id,
          frequency_type: data.frequency_type,
          frequency_value: data.frequency_value,
          typical_due_month: data.typical_due_month,
          typical_due_day: data.typical_due_day,
          is_mandatory: data.is_mandatory,
          reference_url: data.reference_url,
        })
        .eq('id', id);

      if (error) throw error;

      await fetchResponsibilities();
      toast.success('Responsibility updated');
      return true;
    } catch (error) {
      console.error('Error updating responsibility:', error);
      toast.error('Failed to update responsibility');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const archiveResponsibility = async (id: string): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('pm_responsibilities')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      setResponsibilities(prev => prev.filter(r => r.id !== id));
      toast.success('Responsibility archived');
      return true;
    } catch (error) {
      console.error('Error archiving responsibility:', error);
      toast.error('Failed to archive responsibility');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    responsibilities,
    categories,
    practiceId,
    loading,
    saving,
    fetchResponsibilities,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    createResponsibility,
    updateResponsibility,
    archiveResponsibility,
  };
}
