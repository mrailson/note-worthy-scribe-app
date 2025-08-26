import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useAI4GPDisclaimer = () => {
  const { user } = useAuth();
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [disclaimerCollapsed, setDisclaimerCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDisclaimerPreference();
    }
  }, [user]);

  const fetchDisclaimerPreference = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('show_ai4gp_disclaimer, ai4gp_disclaimer_collapsed')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      
      setShowDisclaimer(data?.show_ai4gp_disclaimer ?? true);
      setDisclaimerCollapsed(data?.ai4gp_disclaimer_collapsed ?? false);
    } catch (error) {
      console.error('Error fetching disclaimer preference:', error);
      // Default to showing disclaimer on error
      setShowDisclaimer(true);
    } finally {
      setLoading(false);
    }
  };

  const updateDisclaimerPreference = async (show: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ show_ai4gp_disclaimer: show })
        .eq('user_id', user?.id);

      if (error) throw error;
      
      setShowDisclaimer(show);
    } catch (error) {
      console.error('Error updating disclaimer preference:', error);
    }
  };

  const updateCollapsedPreference = async (collapsed: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ai4gp_disclaimer_collapsed: collapsed })
        .eq('user_id', user?.id);

      if (error) throw error;
      
      setDisclaimerCollapsed(collapsed);
    } catch (error) {
      console.error('Error updating disclaimer collapsed preference:', error);
    }
  };

  const hideDisclaimer = () => updateDisclaimerPreference(false);
  const showDisclaimerAgain = () => updateDisclaimerPreference(true);

  return {
    showDisclaimer,
    disclaimerCollapsed,
    loading,
    hideDisclaimer,
    showDisclaimerAgain,
    updateDisclaimerPreference,
    updateCollapsedPreference
  };
};