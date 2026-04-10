import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface EvidenceConfigRow {
  id: string;
  evidence_type: string;
  label: string;
  description: string | null;
  is_mandatory: boolean;
  applies_to: 'all' | 'buyback' | 'new_sda' | 'management';
  sort_order: number;
  updated_by: string | null;
  updated_at: string;
}

export type StaffEvidenceCategory = 'buyback' | 'new_sda' | 'management' | 'mixed';

export type AppliesToValue = 'all' | 'buyback' | 'new_sda' | 'management';

export function useNRESEvidenceConfig() {
  const { user } = useAuth();
  const [config, setConfig] = useState<EvidenceConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetchedRef = useRef(false);

  const fetchConfig = useCallback(async (force = false) => {
    if (!force && hasFetchedRef.current) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('nres_claim_evidence_config')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setConfig((data || []) as EvidenceConfigRow[]);
      hasFetchedRef.current = true;
    } catch (err) {
      console.error('Error fetching evidence config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, []);

  const updateMandatory = useCallback(async (id: string, isMandatory: boolean) => {
    try {
      const { error } = await supabase
        .from('nres_claim_evidence_config')
        .update({ is_mandatory: isMandatory, updated_by: user?.email || null, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setConfig(prev => prev.map(c => c.id === id ? { ...c, is_mandatory: isMandatory } : c));
      toast.success('Evidence requirement updated');
    } catch (err) {
      console.error('Error updating evidence config:', err);
      toast.error('Failed to update evidence requirement');
    }
  }, [user?.email]);

  const updateAppliesTo = useCallback(async (id: string, appliesTo: AppliesToValue) => {
    try {
      const { error } = await supabase
        .from('nres_claim_evidence_config')
        .update({ applies_to: appliesTo, updated_by: user?.email || null, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setConfig(prev => prev.map(c => c.id === id ? { ...c, applies_to: appliesTo } : c));
      toast.success('Evidence scope updated');
    } catch (err) {
      console.error('Error updating applies_to:', err);
      toast.error('Failed to update evidence scope');
    }
  }, [user?.email]);

  const updateRow = useCallback(async (id: string, updates: { label: string; description: string; applies_to: AppliesToValue }) => {
    try {
      const { error } = await supabase
        .from('nres_claim_evidence_config')
        .update({
          label: updates.label,
          description: updates.description,
          applies_to: updates.applies_to,
          updated_by: user?.email || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      setConfig(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      toast.success('Evidence requirement saved');
    } catch (err) {
      console.error('Error updating evidence config:', err);
      toast.error('Failed to save evidence requirement');
    }
  }, [user?.email]);

  const addRow = useCallback(async () => {
    const maxOrder = config.reduce((max, c) => Math.max(max, c.sort_order), 0);
    const newRow = {
      evidence_type: `custom_${Date.now()}`,
      label: 'New evidence type',
      description: 'Description of the evidence required',
      applies_to: 'all',
      is_mandatory: false,
      sort_order: maxOrder + 1,
      updated_by: user?.email || null,
    };
    try {
      const { data, error } = await supabase
        .from('nres_claim_evidence_config')
        .insert(newRow)
        .select()
        .single();
      if (error) throw error;
      const inserted = data as EvidenceConfigRow;
      setConfig(prev => [...prev, inserted]);
      toast.success('Evidence type added');
      return inserted.id;
    } catch (err) {
      console.error('Error adding evidence config:', err);
      toast.error('Failed to add evidence type');
      return null;
    }
  }, [config, user?.email]);

  const deleteRow = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('nres_claim_evidence_config')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setConfig(prev => prev.filter(c => c.id !== id));
      toast.success('Evidence type removed');
    } catch (err) {
      console.error('Error deleting evidence config:', err);
      toast.error('Failed to remove evidence type');
    }
  }, []);

  /** Get config rows applicable to a given staff category */
  const getConfigForCategory = useCallback((category: StaffEvidenceCategory) => {
    if (category === 'mixed') {
      return config;
    }
    if (category === 'buyback') {
      return config.filter(c => c.applies_to === 'all' || c.applies_to === 'buyback');
    }
    if (category === 'management') {
      return config.filter(c => c.applies_to === 'all' || c.applies_to === 'management');
    }
    return config.filter(c => c.applies_to === 'all' || c.applies_to === 'new_sda');
  }, [config]);

  /** Get mandatory evidence types for a category */
  const getMandatoryForCategory = useCallback((category: 'buyback' | 'new_sda' | 'mixed') => {
    return getConfigForCategory(category).filter(c => c.is_mandatory);
  }, [getConfigForCategory]);

  return {
    config,
    loading,
    updateMandatory,
    updateAppliesTo,
    updateRow,
    addRow,
    deleteRow,
    getConfigForCategory,
    getMandatoryForCategory,
    refetch: () => fetchConfig(true),
  };
}
