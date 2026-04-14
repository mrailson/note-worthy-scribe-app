import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface GroundRule {
  id: string;
  type: 'must_have' | 'must_not' | 'condition' | 'information';
  text: string;
  requires_acknowledgement: boolean;
}

export interface RoleConfig {
  key: string;
  label: string;
  annual_rate: number;
  allocation_default: 'sessions' | 'hours' | 'wte' | 'daily';
  working_hours_per_year: number;
  gl_code?: string;
  ground_rules?: GroundRule[];
  includes_on_costs?: boolean;
  daily_rate?: number;
}

export interface ManagementRoleConfig {
  key: string;
  label: string;
  person_name: string;
  person_email: string;
  hourly_rate: number;
  max_hours_per_week: number;
  billing_entity: string;
  billing_org_code: string;
  gl_code: string;
  is_active: boolean;
  role_type?: 'management' | 'attending_meeting';
  member_practice?: string;
}

export interface RateSettings {
  on_costs_pct: number;
  employer_ni_pct: number;
  employer_pension_pct: number;
  roles_config: RoleConfig[];
  email_testing_mode: boolean;
  email_sending_disabled: boolean;
  allow_invoice_email_when_suppressed: boolean;
  management_roles_config: ManagementRoleConfig[];
  meeting_gp_rate: number;
  meeting_pm_rate: number;
}

const DEFAULT_ROLES: RoleConfig[] = [
  { key: 'gp', label: 'GP', annual_rate: 11000, allocation_default: 'daily', working_hours_per_year: 1950, includes_on_costs: false, daily_rate: 750 },
  { key: 'anp', label: 'ANP', annual_rate: 55000, allocation_default: 'hours', working_hours_per_year: 1950, includes_on_costs: true },
  { key: 'acp', label: 'ACP', annual_rate: 50000, allocation_default: 'hours', working_hours_per_year: 1950, includes_on_costs: true },
  { key: 'practice_nurse', label: 'Practice Nurse', annual_rate: 35000, allocation_default: 'hours', working_hours_per_year: 1950, includes_on_costs: true },
  { key: 'hca', label: 'HCA', annual_rate: 25000, allocation_default: 'hours', working_hours_per_year: 1950, includes_on_costs: true },
  { key: 'pharmacist', label: 'Pharmacist', annual_rate: 45000, allocation_default: 'hours', working_hours_per_year: 1950, includes_on_costs: true },
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
    email_sending_disabled: false,
    allow_invoice_email_when_suppressed: false,
    management_roles_config: [],
    meeting_gp_rate: 85,
    meeting_pm_rate: 45,
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
          email_sending_disabled: data.email_sending_disabled ?? false,
          allow_invoice_email_when_suppressed: data.allow_invoice_email_when_suppressed ?? false,
          management_roles_config: (data.management_roles_config as ManagementRoleConfig[]) || [],
          meeting_gp_rate: data.meeting_gp_rate ?? 85,
          meeting_pm_rate: data.meeting_pm_rate ?? 45,
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

  const updateSettings = useCallback(async (niPct: number, pensionPct: number, rolesConfig: RoleConfig[], meetingGpRate?: number, meetingPmRate?: number) => {
    if (!user?.id) return;
    try {
      setSaving(true);
      const totalOnCosts = niPct + pensionPct;
      const upsertData: any = {
        id: 'default',
        on_costs_pct: totalOnCosts,
        employer_ni_pct: niPct,
        employer_pension_pct: pensionPct,
        roles_config: rolesConfig,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      };
      if (meetingGpRate !== undefined) upsertData.meeting_gp_rate = meetingGpRate;
      if (meetingPmRate !== undefined) upsertData.meeting_pm_rate = meetingPmRate;
      const { error } = await (supabase as any)
        .from('nres_buyback_rate_settings')
        .upsert(upsertData);

      if (error) throw error;
      setSettings(prev => ({
        ...prev,
        on_costs_pct: totalOnCosts,
        employer_ni_pct: niPct,
        employer_pension_pct: pensionPct,
        roles_config: rolesConfig,
        ...(meetingGpRate !== undefined ? { meeting_gp_rate: meetingGpRate } : {}),
        ...(meetingPmRate !== undefined ? { meeting_pm_rate: meetingPmRate } : {}),
      }));
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

  const toggleEmailSendingDisabled = useCallback(async (disabled: boolean) => {
    if (!user?.id) return;
    try {
      setSaving(true);
      const { error } = await (supabase as any)
        .from('nres_buyback_rate_settings')
        .upsert({
          id: 'default',
          email_sending_disabled: disabled,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        });
      if (error) throw error;
      setSettings(prev => ({ ...prev, email_sending_disabled: disabled }));
      toast.success(disabled ? 'Email sending disabled' : 'Email sending re-enabled');
    } catch (err) {
      console.error('Error toggling email sending:', err);
      toast.error('Failed to update email sending setting');
    } finally {
      setSaving(false);
    }
  }, [user?.id]);

  const updateManagementRoles = useCallback(async (mgmtRoles: ManagementRoleConfig[]) => {
    if (!user?.id) return;
    try {
      setSaving(true);
      const { error } = await (supabase as any)
        .from('nres_buyback_rate_settings')
        .upsert({
          id: 'default',
          management_roles_config: mgmtRoles,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        });
      if (error) throw error;
      setSettings(prev => ({ ...prev, management_roles_config: mgmtRoles }));
      toast.success('Management roles saved');
    } catch (err) {
      console.error('Error saving management roles:', err);
      toast.error('Failed to save management roles');
    } finally {
      setSaving(false);
    }
  }, [user?.id]);

  const toggleAllowInvoiceWhenSuppressed = useCallback(async (allowed: boolean) => {
    if (!user?.id) return;
    try {
      setSaving(true);
      const { error } = await (supabase as any)
        .from('nres_buyback_rate_settings')
        .upsert({
          id: 'default',
          allow_invoice_email_when_suppressed: allowed,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        });
      if (error) throw error;
      setSettings(prev => ({ ...prev, allow_invoice_email_when_suppressed: allowed }));
      toast.success(allowed ? 'Invoice emails will be sent even when suppressed' : 'Invoice emails will also be suppressed');
    } catch (err) {
      console.error('Error toggling invoice email exception:', err);
      toast.error('Failed to update setting');
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
    toggleEmailSendingDisabled,
    toggleAllowInvoiceWhenSuppressed,
    updateManagementRoles,
    onCostMultiplier,
    getRoleConfig,
    getAnnualRate,
    staffRoles,
    refetch: () => fetchSettings(true),
  };
}
