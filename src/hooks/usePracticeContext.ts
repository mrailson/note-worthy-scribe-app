import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PracticeContext } from '@/types/ai4gp';

export const usePracticeContext = () => {
  const { user } = useAuth();
  const [practiceContext, setPracticeContext] = useState<PracticeContext>({});
  const [practiceDetails, setPracticeDetails] = useState<any>(null);

  const loadPracticeContext = async () => {
    if (!user) return;

    try {
      // Get user's practice assignment
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('practice_id, role')
        .eq('user_id', user.id)
        .single();

      if (roleError || !userRole?.practice_id) {
        console.log('No practice assignment found for user');
        return;
      }

      // Get practice details including all information
      const { data: practiceDetails } = await supabase
        .from('practice_details')
        .select('practice_name, pcn_code, user_id, logo_url, address, phone, email, website')
        .eq('id', userRole.practice_id)
        .single();

      if (practiceDetails) {
        setPracticeDetails(practiceDetails);
      }

      if (!practiceDetails) {
        console.log('Practice details not found');
        return;
      }

      // Get practice manager name from profiles
      const { data: practiceManagerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', practiceDetails.user_id)
        .single();

      // Get PCN information
      const { data: pcnData } = await supabase
        .from('primary_care_networks')
        .select('pcn_name')
        .eq('pcn_code', practiceDetails.pcn_code)
        .single();

      // Get other practices in the same PCN
      const { data: otherPractices } = await supabase
        .from('practice_details')
        .select('practice_name')
        .eq('pcn_code', practiceDetails.pcn_code)
        .neq('id', userRole.practice_id);

      // Get neighbourhood information (if exists)
      const { data: neighbourhoodData } = await supabase
        .from('neighbourhoods')
        .select('name')
        .limit(1);

      setPracticeContext({
        practiceName: practiceDetails.practice_name,
        practiceManagerName: practiceManagerProfile?.full_name,
        pcnName: pcnData?.pcn_name,
        neighbourhoodName: neighbourhoodData?.[0]?.name,
        otherPracticesInPCN: otherPractices?.map(p => p.practice_name) || [],
        logoUrl: practiceDetails.logo_url
      });

      console.log('Practice context loaded:', {
        practiceName: practiceDetails.practice_name,
        pcnName: pcnData?.pcn_name
      });

    } catch (error) {
      console.error('Error loading practice context:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadPracticeContext();
    }
  }, [user]);

  return {
    practiceContext,
    practiceDetails,
    loadPracticeContext
  };
};