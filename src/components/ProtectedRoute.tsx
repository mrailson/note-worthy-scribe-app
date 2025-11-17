import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredModule?: string;
  fallbackPath?: string;
}

export const ProtectedRoute = ({ 
  children, 
  requiredModule, 
  fallbackPath = '/' 
}: ProtectedRouteProps) => {
  const { hasModuleAccess, loading, user, isSystemAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If user is not logged in, redirect to home
    if (!loading && !user) {
      toast.error('Please log in to access this page.');
      navigate('/', { replace: true });
      return;
    }

    // If no specific module is required, just check authentication
    if (!requiredModule) {
      return;
    }

    // System admins can access all routes regardless of module access
    if (!loading && isSystemAdmin) {
      return;
    }

    // Check module access if requiredModule is specified
    if (!loading && !hasModuleAccess(requiredModule)) {
      // Special handling for practice manager access
      if (requiredModule === 'practice_manager_access') {
        // Check if user has practice_manager role
        const checkPracticeManagerRole = async () => {
          if (!user) return false;
          
          try {
            const { data, error } = await supabase
              .rpc('has_role', { _user_id: user.id, _role: 'practice_manager' });
            return !error && data;
          } catch (error) {
            console.error('Error checking practice manager role:', error);
            return false;
          }
        };

        checkPracticeManagerRole().then(isPracticeManager => {
          if (!isPracticeManager) {
            toast.error('You must be a practice manager to access this module.');
            navigate(fallbackPath, { replace: true });
          }
        });
        return;
      }

      toast.error('You do not have access to this module. Please contact your administrator.');
      navigate(fallbackPath, { replace: true });
    }
  }, [hasModuleAccess, requiredModule, loading, navigate, fallbackPath, user, isSystemAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (requiredModule && !isSystemAdmin && !hasModuleAccess(requiredModule)) {
    return null;
  }

  return <>{children}</>;
};