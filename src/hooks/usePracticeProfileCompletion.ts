import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PERSONNEL_ROLES = [
  { key: 'practice_manager_name', label: 'Practice Manager' },
  { key: 'lead_gp_name', label: 'Lead GP' },
  { key: 'senior_gp_partner', label: 'Senior GP Partner' },
  { key: 'caldicott_guardian', label: 'Caldicott Guardian' },
  { key: 'dpo_name', label: 'Data Protection Officer' },
  { key: 'siro', label: 'SIRO' },
  { key: 'safeguarding_lead_adults', label: 'Safeguarding Lead (Adults)' },
  { key: 'safeguarding_lead_children', label: 'Safeguarding Lead (Children)' },
  { key: 'infection_control_lead', label: 'Infection Control Lead' },
  { key: 'health_safety_lead', label: 'Health & Safety Lead' },
  { key: 'fire_safety_officer', label: 'Fire Safety Officer' },
  { key: 'complaints_lead', label: 'Complaints Lead' },
] as const;

export interface ProfileCompletion {
  total: number;
  filled: number;
  missing: string[];
  isLoading: boolean;
}

export const usePracticeProfileCompletion = (): ProfileCompletion => {
  const [state, setState] = useState<ProfileCompletion>({
    total: PERSONNEL_ROLES.length,
    filled: 0,
    missing: [],
    isLoading: true,
  });

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const { data: pd } = await supabase
        .from('practice_details')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();

      const record: any = pd || {};
      const missing = PERSONNEL_ROLES
        .filter(r => !record[r.key]?.trim?.())
        .map(r => r.label);

      setState({
        total: PERSONNEL_ROLES.length,
        filled: PERSONNEL_ROLES.length - missing.length,
        missing,
        isLoading: false,
      });
    };

    fetch();
  }, []);

  return state;
};
