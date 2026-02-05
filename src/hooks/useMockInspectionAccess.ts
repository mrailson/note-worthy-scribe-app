import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to check if the current user has access to Mock CQC Inspections
 * Access is granted if:
 * 1. User has cqc_compliance_access in their user_roles (module-level access)
 * 2. User has been granted access to any session via mock_inspection_access table
 * 3. User is a system admin
 */
export const useMockInspectionAccess = () => {
  const { user, hasModuleAccess, isSystemAdmin, loading: authLoading } = useAuth();
  const [hasSessionAccess, setHasSessionAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSessionAccess = async () => {
      if (!user) {
        setHasSessionAccess(false);
        setIsLoading(false);
        return;
      }

      // System admins always have access
      if (isSystemAdmin) {
        setHasSessionAccess(true);
        setIsLoading(false);
        return;
      }

      // Check if user has module-level access
      // (matches usage elsewhere in the app, e.g. Header/ServiceVisibilitySettings)
      if (hasModuleAccess('cqc_compliance_access')) {
        setHasSessionAccess(true);
        setIsLoading(false);
        return;
      }

      // Check if user has any accessible mock inspection sessions.
      // This is more reliable than querying mock_inspection_access directly,
      // because session visibility already encapsulates all access rules (owner/shared/admin)
      // via existing RLS policies.
      try {
        const { data, error } = await supabase
          .from('mock_inspection_sessions')
          .select('id')
          .limit(1);

        if (error) {
          console.error('Error checking mock inspection access:', error);
          setHasSessionAccess(false);
        } else {
          setHasSessionAccess(data && data.length > 0);
        }
      } catch (err) {
        console.error('Error checking mock inspection access:', err);
        setHasSessionAccess(false);
      }

      setIsLoading(false);
    };

    // Don't block the access check on authLoading; we can still validate session access
    // as soon as we have a user id (module access will update automatically once loaded).
    checkSessionAccess();
  }, [user, hasModuleAccess, isSystemAdmin, authLoading]);

  const hasMockInspectionAccess =
    isSystemAdmin || hasModuleAccess('cqc_compliance_access') || hasSessionAccess;

  return {
    hasMockInspectionAccess,
    hasSessionAccess,
    isLoading: authLoading || isLoading,
  };
};
