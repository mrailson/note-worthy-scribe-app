import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useMockInspectionAccess } from '@/hooks/useMockInspectionAccess';

interface MockInspectionProtectedRouteProps {
  children: React.ReactNode;
  fallbackPath?: string;
}

/**
 * Protected route specifically for Mock CQC Inspection
 * Allows access if user has:
 * 1. cqc_compliance module access
 * 2. Session-level access granted via mock_inspection_access table
 * 3. System admin role
 */
export const MockInspectionProtectedRoute = ({ 
  children, 
  fallbackPath = '/' 
}: MockInspectionProtectedRouteProps) => {
  const { loading, user, isSystemAdmin } = useAuth();
  const { hasMockInspectionAccess, isLoading: accessLoading } = useMockInspectionAccess();
  const navigate = useNavigate();

  const isLoading = loading || accessLoading;

  useEffect(() => {
    // If user is not logged in, redirect to auth page
    if (!isLoading && !user) {
      toast.error('Please log in to access this page.');
      navigate('/auth', { replace: true });
      return;
    }

    // System admins can access all routes
    if (!isLoading && isSystemAdmin) {
      return;
    }

    // Check mock inspection access (module or session-level)
    if (!isLoading && !hasMockInspectionAccess) {
      toast.error('You do not have access to Mock CQC Inspection. Please contact your administrator.');
      navigate(fallbackPath, { replace: true });
      return;
    }
  }, [hasMockInspectionAccess, isLoading, navigate, fallbackPath, user, isSystemAdmin]);

  if (isLoading) {
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

  // Check access after loading
  if (!isSystemAdmin && !hasMockInspectionAccess) {
    return null;
  }

  return <>{children}</>;
};
