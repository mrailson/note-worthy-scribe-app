import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns whether the regenerate button should be shown on policy cards.
 * Reads from system_settings; defaults to true if not set.
 */
export function usePolicyRegenerateVisible() {
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'policy_regenerate_button_visible')
          .maybeSingle();

        if (data) {
          const val = data.setting_value as { enabled?: boolean };
          setVisible(val?.enabled ?? true);
        }
      } catch {
        // default true
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { visible, loading };
}
