import { Navigate } from "react-router-dom";
import { usePopulationRiskAccess } from "@/hooks/usePopulationRiskAccess";
import { Loader2 } from "lucide-react";

interface PopulationRiskGuardProps {
  children: React.ReactNode;
}

export const PopulationRiskGuard = ({ children }: PopulationRiskGuardProps) => {
  const { isBlocked, isLoading } = usePopulationRiskAccess();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isBlocked) {
    return <Navigate to="/nres" replace />;
  }

  return <>{children}</>;
};
