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
  applies_to: 'all' | 'buyback' | 'new_sda';
  sort_order: number;
  updated_by: string | null;
  updated_at: string;
}

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

  /** Get config rows applicable to a given staff category */
  const getConfigForCategory = useCallback((category: 'buyback' | 'new_sda' | 'mixed') => {
    if (category === 'buyback' || category === 'mixed') {
      return config; // Buy-back gets all evidence types
    }
    // New SDA only gets 'all' evidence types (SDA slot type + rota)
    return config.filter(c => c.applies_to === 'all');
  }, [config]);

  /** Get mandatory evidence types for a category */
  const getMandatoryForCategory = useCallback((category: 'buyback' | 'new_sda' | 'mixed') => {
    return getConfigForCategory(category).filter(c => c.is_mandatory);
  }, [getConfigForCategory]);

  return {
    config,
    loading,
    updateMandatory,
    getConfigForCategory,
    getMandatoryForCategory,
    refetch: () => fetchConfig(true),
  };
}
