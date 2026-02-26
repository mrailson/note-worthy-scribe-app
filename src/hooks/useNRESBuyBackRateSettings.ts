import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface RoleConfig {
  key: string;
  label: string;
  annual_rate: number;
  allocation_default: 'sessions' | 'hours' | 'wte';
  working_hours_per_year: number;
}

export interface RateSettings {
  on_costs_pct: number;
  employer_ni_pct: number;
  employer_pension_pct: number;
  roles_config: RoleConfig[];
  email_testing_mode: boolean;
}

const DEFAULT_ROLES: RoleConfig[] = [
  { key: 'gp', label: 'GP', annual_rate: 11000, allocation_default: 'sessions', working_hours_per_year: 1950 },
  { key: 'anp', label: 'ANP', annual_rate: 55000, allocation_default: 'hours', working_hours_per_year: 1950 },
  { key: 'acp', label: 'ACP', annual_rate: 50000, allocation_default: 'hours', working_hours_per_year: 1950 },
  { key: 'practice_nurse', label: 'Practice Nurse', annual_rate: 35000, allocation_default: 'hours', working_hours_per_year: 1950 },
  { key: 'hca', label: 'HCA', annual_rate: 25000, allocation_default: 'hours', working_hours_per_year: 1950 },
  { key: 'pharmacist', label: 'Pharmacist', annual_rate: 45000, allocation_default: 'hours', working_hours_per_year: 1950 },
];

const DEFAULT_ON_COSTS_PCT = 29.38;
const DEFAULT_EMPLOYER_NI_PCT = 15;
const DEFAULT_EMPLOYER_PENSION_PCT = 14.38;

export function useNRESBuyBackRateSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<RateSettings>({
    on_costs_pct: DEFAULT_ON_COSTS_PCT,
    employer_ni_pct: DEFAULT_EMPLOYER_NI_PCT,
    employer_pension_pct: DEFAULT_EMPLOYER_PENSION_PCT,
    roles_config: DEFAULT_ROLES,
    email_testing_mode: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const hasFetchedRef = useRef(false);

  const fetchSettings = useCallback(async (force = false) => {
    if (!user?.id) return;
    if (!force && hasFetchedRef.current) return;
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('nres_buyback_rate_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (error) throw error;
      if (data) {
        const niPct = Number(data.employer_ni_pct) || DEFAULT_EMPLOYER_NI_PCT;
        const pensionPct = Number(data.employer_pension_pct) || DEFAULT_EMPLOYER_PENSION_PCT;
        setSettings({
          on_costs_pct: niPct + pensionPct,
          employer_ni_pct: niPct,
          employer_pension_pct: pensionPct,
          roles_config: (data.roles_config as RoleConfig[]) || DEFAULT_ROLES,
          email_testing_mode: data.email_testing_mode ?? false,
        });
      }
      hasFetchedRef.current = true;
    } catch (err) {
      console.error('Error fetching rate settings:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) fetchSettings();
    return () => { hasFetchedRef.current = false; };
  }, [user?.id]);

  const updateSettings = useCallback(async (niPct: number, pensionPct: number, rolesConfig: RoleConfig[]) => {
    if (!user?.id) return;
    try {
      setSaving(true);
      const totalOnCosts = niPct + pensionPct;
      const { error } = await (supabase as any)
        .from('nres_buyback_rate_settings')
        .upsert({
          id: 'default',
          on_costs_pct: totalOnCosts,
          employer_ni_pct: niPct,
          employer_pension_pct: pensionPct,
          roles_config: rolesConfig,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        });

      if (error) throw error;
      setSettings(prev => ({ ...prev, on_costs_pct: totalOnCosts, employer_ni_pct: niPct, employer_pension_pct: pensionPct, roles_config: rolesConfig }));
      toast.success('Rate settings saved');
    } catch (err) {
      console.error('Error saving rate settings:', err);
      toast.error('Failed to save rate settings');
    } finally {
      setSaving(false);
    }
  }, [user?.id]);

  const onCostMultiplier = useMemo(() => 1 + settings.on_costs_pct / 100, [settings.on_costs_pct]);

  const getRoleConfig = useCallback((roleLabel: string): RoleConfig | undefined => {
    return settings.roles_config.find(r => r.label.toLowerCase() === roleLabel.toLowerCase());
  }, [settings.roles_config]);

  const getAnnualRate = useCallback((roleLabel: string): number => {
    const role = getRoleConfig(roleLabel);
    return role?.annual_rate ?? 0;
  }, [getRoleConfig]);

  const staffRoles = useMemo(() => settings.roles_config.map(r => r.label), [settings.roles_config]);

  const toggleEmailTestingMode = useCallback(async (enabled: boolean) => {
    if (!user?.id) return;
    try {
      setSaving(true);
      const { error } = await (supabase as any)
        .from('nres_buyback_rate_settings')
        .upsert({
          id: 'default',
          email_testing_mode: enabled,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        });
      if (error) throw error;
      setSettings(prev => ({ ...prev, email_testing_mode: enabled }));
      toast.success(enabled ? 'Email testing mode enabled' : 'Email testing mode disabled');
    } catch (err) {
      console.error('Error toggling email testing mode:', err);
      toast.error('Failed to update email testing mode');
    } finally {
      setSaving(false);
    }
  }, [user?.id]);

  return {
    settings,
    loading,
    saving,
    updateSettings,
    toggleEmailTestingMode,
    onCostMultiplier,
    getRoleConfig,
    getAnnualRate,
    staffRoles,
    refetch: () => fetchSettings(true),
  };
}
