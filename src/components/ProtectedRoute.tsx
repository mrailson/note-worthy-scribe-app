import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredModule: string;
  fallbackPath?: string;
}

export const ProtectedRoute = ({ 
  children, 
  requiredModule, 
  fallbackPath = '/' 
}: ProtectedRouteProps) => {
  const { hasModuleAccess, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !hasModuleAccess(requiredModule)) {
      toast.error('You do not have access to this module. Please contact your administrator.');
      navigate(fallbackPath, { replace: true });
    }
  }, [hasModuleAccess, requiredModule, loading, navigate, fallbackPath]);

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

  if (!hasModuleAccess(requiredModule)) {
    return null;
  }

  return <>{children}</>;
};