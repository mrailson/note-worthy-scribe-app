import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

/**
 * Hook to track user session activity and update last_activity timestamp
 * Updates activity every 5 minutes and on user interactions
 * 
 * IMPORTANT: This hook accepts user as a parameter to avoid context dependency issues
 */
export const useSessionActivity = (user: User | null) => {
  const lastActivityRef = useRef<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout>();

  const updateActivity = async () => {
    if (!user?.id) return;
    
    try {
      await supabase.rpc('update_session_activity', { p_user_id: user.id });
      lastActivityRef.current = Date.now();
    } catch (error) {
      console.log('Error updating session activity:', error);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    // Update activity immediately when user changes
    updateActivity();

    // Set up interval to update activity every 5 minutes
    intervalRef.current = setInterval(() => {
      updateActivity();
    }, 5 * 60 * 1000); // 5 minutes

    // Update activity on user interactions - throttled to every 5 minutes
    const handleUserActivity = () => {
      const now = Date.now();
      // Only update if it's been more than 5 minutes since last update
      if (now - lastActivityRef.current > 5 * 60 * 1000) {
        updateActivity();
      }
    };

    // Add event listeners for user activity
    // Reduce event list on mobile to lower CPU overhead from high-frequency events
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const events = isMobile 
      ? ['touchstart', 'click'] // Minimal set for mobile - scroll/mousemove fire too often
      : ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, { passive: true });
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity);
      });
    };
  }, [user?.id]);

  return { updateActivity };
};
