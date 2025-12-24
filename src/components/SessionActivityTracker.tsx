import { useAuth } from '@/contexts/AuthContext';
import { useSessionActivity } from '@/hooks/useSessionActivity';

/**
 * Component that tracks user session activity.
 * Must be used within AuthProvider.
 */
export const SessionActivityTracker = () => {
  const { user } = useAuth();
  useSessionActivity(user);
  return null;
};
