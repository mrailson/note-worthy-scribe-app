import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ProfileChangeFlag {
  id: string;
  policy_id: string;
  profile_change_id: string;
  flagged_at: string;
  dismissed_at: string | null;
  dismissed_by: string | null;
  resolved_by_version_id: string | null;
  // Joined from profile_change_log
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
}

// Field name to friendly label mapping
const FIELD_LABELS: Record<string, string> = {
  practice_manager_name: 'Practice Manager',
  lead_gp_name: 'Lead GP',
  senior_gp_partner: 'Senior GP Partner',
  caldicott_guardian: 'Caldicott Guardian',
  dpo_name: 'Data Protection Officer',
  siro: 'SIRO',
  safeguarding_lead_adults: 'Safeguarding Lead (Adults)',
  safeguarding_lead_children: 'Safeguarding Lead (Children)',
  infection_control_lead: 'Infection Control Lead',
  health_safety_lead: 'Health & Safety Lead',
  fire_safety_officer: 'Fire Safety Officer',
  complaints_lead: 'Complaints Lead',
};

export const getFieldLabel = (fieldName: string): string => {
  return FIELD_LABELS[fieldName] || fieldName;
};

// Named person fields that should trigger policy scanning
export const NAMED_PERSON_FIELDS = Object.keys(FIELD_LABELS);

export const useProfileFlags = () => {
  const { user } = useAuth();
  const [flags, setFlags] = useState<Record<string, ProfileChangeFlag[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchFlags = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Fetch active (non-dismissed, non-resolved) flags with change details
      const { data: flagRows, error: flagError } = await supabase
        .from('policy_profile_flags')
        .select('*')
        .eq('user_id', user.id)
        .is('dismissed_at', null)
        .is('resolved_by_version_id', null);

      if (flagError) throw flagError;

      if (!flagRows || flagRows.length === 0) {
        setFlags({});
        setIsLoading(false);
        return;
      }

      // Fetch the associated change log entries
      const changeIds = [...new Set((flagRows as any[]).map(f => f.profile_change_id))];
      const { data: changeRows, error: changeError } = await supabase
        .from('profile_change_log')
        .select('*')
        .in('id', changeIds);

      if (changeError) throw changeError;

      const changeMap = new Map((changeRows || []).map(c => [c.id, c]));

      // Group by policy_id
      const grouped: Record<string, ProfileChangeFlag[]> = {};
      for (const flag of (flagRows as any[])) {
        const change = changeMap.get(flag.profile_change_id);
        if (!change) continue;
        const combined: ProfileChangeFlag = {
          id: flag.id,
          policy_id: flag.policy_id,
          profile_change_id: flag.profile_change_id,
          flagged_at: flag.flagged_at,
          dismissed_at: flag.dismissed_at,
          dismissed_by: flag.dismissed_by,
          resolved_by_version_id: flag.resolved_by_version_id,
          field_name: (change as any).field_name,
          old_value: (change as any).old_value,
          new_value: (change as any).new_value,
          changed_by: (change as any).changed_by,
          changed_at: (change as any).changed_at,
        };
        if (!grouped[flag.policy_id]) grouped[flag.policy_id] = [];
        grouped[flag.policy_id].push(combined);
      }

      setFlags(grouped);
    } catch (error) {
      console.error('Error fetching profile flags:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const dismissFlag = useCallback(async (flagId: string) => {
    if (!user) return;
    try {
      await supabase
        .from('policy_profile_flags')
        .update({
          dismissed_at: new Date().toISOString(),
          dismissed_by: user.email || 'Unknown',
        } as any)
        .eq('id', flagId)
        .eq('user_id', user.id);
      await fetchFlags();
    } catch (error) {
      console.error('Error dismissing flag:', error);
    }
  }, [user, fetchFlags]);

  const dismissAllForPolicy = useCallback(async (policyId: string) => {
    if (!user) return;
    try {
      await supabase
        .from('policy_profile_flags')
        .update({
          dismissed_at: new Date().toISOString(),
          dismissed_by: user.email || 'Unknown',
        } as any)
        .eq('policy_id', policyId)
        .eq('user_id', user.id)
        .is('dismissed_at', null)
        .is('resolved_by_version_id', null);
      await fetchFlags();
    } catch (error) {
      console.error('Error dismissing flags:', error);
    }
  }, [user, fetchFlags]);

  /**
   * Scan policies for a changed named person field and create flags.
   * Returns the number of affected policies.
   */
  const scanAndFlagPolicies = useCallback(async (
    fieldName: string,
    oldValue: string,
    newValue: string,
    practiceId?: string,
  ): Promise<number> => {
    if (!user || !oldValue?.trim()) return 0;

    try {
      // 1. Log the change
      const { data: changeLog, error: logError } = await supabase
        .from('profile_change_log')
        .insert({
          user_id: user.id,
          practice_id: practiceId || null,
          field_name: fieldName,
          old_value: oldValue,
          new_value: newValue,
          changed_by: user.email || 'Unknown',
          policies_affected: 0,
        } as any)
        .select()
        .single();

      if (logError) throw logError;

      // 2. Fetch all active policy completions for the user
      const { data: policies, error: polError } = await supabase
        .from('policy_completions')
        .select('id, policy_content')
        .eq('user_id', user.id)
        .eq('status', 'completed');

      if (polError) throw polError;

      // 3. Check which policies contain the old value
      const affected: string[] = [];
      for (const policy of (policies || [])) {
        if (policy.policy_content && policy.policy_content.toLowerCase().includes(oldValue.toLowerCase())) {
          affected.push(policy.id);
        }
      }

      if (affected.length === 0) return 0;

      // 4. Create flags for each affected policy
      const flagInserts = affected.map(policyId => ({
        policy_id: policyId,
        profile_change_id: (changeLog as any).id,
        user_id: user.id,
      }));

      await supabase
        .from('policy_profile_flags')
        .upsert(flagInserts as any[], { onConflict: 'policy_id,profile_change_id' });

      // 5. Update the change log with affected count
      await supabase
        .from('profile_change_log')
        .update({ policies_affected: affected.length } as any)
        .eq('id', (changeLog as any).id);

      await fetchFlags();
      return affected.length;
    } catch (error) {
      console.error('Error scanning policies:', error);
      return 0;
    }
  }, [user, fetchFlags]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  return {
    flags,
    isLoading,
    fetchFlags,
    dismissFlag,
    dismissAllForPolicy,
    scanAndFlagPolicies,
    getFieldLabel,
  };
};
