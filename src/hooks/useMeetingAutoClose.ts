import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseMeetingAutoCloseProps {
  enabled?: boolean;
  intervalMinutes?: number;
}

export const useMeetingAutoClose = ({ 
  enabled = true, 
  intervalMinutes = 5 
}: UseMeetingAutoCloseProps = {}) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const runAutoCloseCheck = async () => {
    try {
      console.log('🔄 Running meeting auto-close check...');
      
      const { data, error } = await supabase.functions.invoke('auto-close-inactive-meetings');
      
      if (error) {
        console.error('❌ Auto-close check failed:', error);
        return;
      }

      if (data?.closed_meetings > 0) {
        console.log(`✅ Auto-closed ${data.closed_meetings} inactive meetings`);
        
        // Optionally show a toast notification
        // toast.info(`Auto-closed ${data.closed_meetings} inactive meeting${data.closed_meetings > 1 ? 's' : ''}`);
      } else {
        console.log('ℹ️ No inactive meetings found to close');
      }
      
    } catch (error) {
      console.error('💥 Error in auto-close check:', error);
    }
  };

  useEffect(() => {
    if (!enabled) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Run initial check after 1 minute to avoid immediate execution
    const initialTimeout = setTimeout(() => {
      runAutoCloseCheck();
      
      // Set up recurring interval
      intervalRef.current = setInterval(
        runAutoCloseCheck,
        intervalMinutes * 60 * 1000 // Convert minutes to milliseconds
      );
    }, 60 * 1000); // 1 minute delay

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, intervalMinutes]);

  // Manual trigger function
  const triggerAutoClose = () => {
    runAutoCloseCheck();
  };

  return {
    triggerAutoClose
  };
};