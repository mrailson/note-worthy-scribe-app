import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNRESSystemRoles } from './useNRESSystemRoles';

/**
 * Returns true if the current user can see the NRES Time Tracker Manager View.
 * Verifier flag (profiles.is_verifier) OR Super Admin / Management Lead system roles.
 */
export function useIsNRESVerifier() {
  const { user } = useAuth();
  const { isSuperAdmin, isManagementLead } = useNRESSystemRoles();
  const [profileFlag, setProfileFlag] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) { setLoading(false); return; }
      try {
        const { data } = await supabase
          .from('profiles')
          .select('is_verifier')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!cancelled) setProfileFlag(!!(data as any)?.is_verifier);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const isVerifier = profileFlag || isSuperAdmin || isManagementLead;
  return { isVerifier, loading };
}
