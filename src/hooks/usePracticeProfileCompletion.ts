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
    const fetchCompletion = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // 1. Fetch user's own record
      const { data: pd } = await supabase
        .from('practice_details')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();

      const ownRecord: any = pd || {};

      // 2. Count how many personnel fields the user has filled
      const ownFilled = PERSONNEL_ROLES.filter(r => ownRecord[r.key]?.trim?.()).length;

      let mergedRecord = ownRecord;

      // 3. If mostly empty, look for a shared colleague's record
      if (ownFilled < 3) {
        // Get practice name from own record or from user_roles + gp_practices
        let practiceName: string | null = ownRecord.practice_name || null;

        if (!practiceName) {
          const { data: ur } = await supabase
            .from('user_roles')
            .select('practice_id, gp_practices(name)')
            .eq('user_id', user.id)
            .not('practice_id', 'is', null)
            .limit(1)
            .maybeSingle();

          const gp = ur?.gp_practices as any;
          practiceName = gp?.name || null;
        }

        if (practiceName) {
          const stripped = practiceName.replace(/^the\s+/i, '');
          const { data: sharedPd } = await supabase
            .from('practice_details')
            .select('*')
            .ilike('practice_name', `%${stripped}%`)
            .neq('user_id', user.id)
            .eq('is_default', true)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (sharedPd) {
            // Merge: prefer own value, fall back to shared
            const shared: any = sharedPd;
            const merged: any = { ...ownRecord };
            for (const role of PERSONNEL_ROLES) {
              if (!merged[role.key]?.trim?.() && shared[role.key]?.trim?.()) {
                merged[role.key] = shared[role.key];
              }
            }
            mergedRecord = merged;
          }
        }
      }

      const missing = PERSONNEL_ROLES
        .filter(r => !mergedRecord[r.key]?.trim?.())
        .map(r => r.label);

      setState({
        total: PERSONNEL_ROLES.length,
        filled: PERSONNEL_ROLES.length - missing.length,
        missing,
        isLoading: false,
      });
    };

    fetchCompletion();
  }, []);

  return state;
};
