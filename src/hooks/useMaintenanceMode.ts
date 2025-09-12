import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface MaintenanceMode {
  enabled: boolean;
  message: string;
}

const STORAGE_KEY = 'maintenance_mode_settings';

export const useMaintenanceMode = () => {
  const { isSystemAdmin } = useAuth();
  const [maintenanceMode, setMaintenanceMode] = useState<MaintenanceMode>({
    enabled: false,
    message: 'System is currently down for maintenance. Please try again later.'
  });
  const [loading, setLoading] = useState(true);

  const fetchMaintenanceMode = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setMaintenanceMode(parsed);
      }
    } catch (error) {
      console.error('Error fetching maintenance mode:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateMaintenanceMode = async (enabled: boolean, message?: string) => {
    if (!isSystemAdmin) {
      throw new Error('Unauthorized: System admin access required');
    }

    try {
      const newState = {
        enabled,
        message: message !== undefined ? message : maintenanceMode.message
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      setMaintenanceMode(newState);

      // Broadcast change to other tabs
      window.dispatchEvent(new CustomEvent('maintenanceModeChanged', {
        detail: newState
      }));

      return { success: true };
    } catch (error) {
      console.error('Error updating maintenance mode:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchMaintenanceMode();

    // Listen for changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setMaintenanceMode(parsed);
        } catch (error) {
          console.error('Error parsing maintenance mode from storage:', error);
        }
      }
    };

    const handleCustomEvent = (e: CustomEvent) => {
      setMaintenanceMode(e.detail);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('maintenanceModeChanged', handleCustomEvent as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('maintenanceModeChanged', handleCustomEvent as EventListener);
    };
  }, []);

  return {
    maintenanceMode,
    loading,
    updateMaintenanceMode,
    refreshMaintenanceMode: fetchMaintenanceMode
  };
};