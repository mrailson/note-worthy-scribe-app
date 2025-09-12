import { AlertTriangle, Wrench } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMaintenanceMode } from '@/hooks/useMaintenanceMode';

export const MaintenanceBanner = () => {
  const { maintenanceMode, loading } = useMaintenanceMode();

  if (loading || !maintenanceMode.enabled) {
    return null;
  }

  return (
    <Alert className="border-destructive bg-destructive/10 text-destructive mb-6 animate-in slide-in-from-top-2">
      <AlertTriangle className="h-5 w-5" />
      <AlertDescription className="flex items-center gap-2 font-medium">
        <Wrench className="h-4 w-4" />
        <span className="text-sm">
          {maintenanceMode.message}
        </span>
      </AlertDescription>
    </Alert>
  );
};