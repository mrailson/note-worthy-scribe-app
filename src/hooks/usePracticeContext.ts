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
      console.log('Loading practice context for user:', user.id);
      
      // Get user profile information
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', user.id)
        .maybeSingle();

      // Get user roles
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role, practice_id')
        .eq('user_id', user.id);
      
      // First, try to get the user's own practice details directly
      const { data: userPracticeDetails, error: userPracticeError } = await supabase
        .from('practice_details')
        .select('practice_name, pcn_code, user_id, logo_url, address, phone, email, website, email_signature, letter_signature')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('User practice details query result:', { userPracticeDetails, userPracticeError });

      if (userPracticeDetails) {
        // User has their own practice details
        setPracticeDetails(userPracticeDetails);

        // Get practice manager name (which should be the user themselves)
        const { data: practiceManagerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', userPracticeDetails.user_id)
          .maybeSingle();

        // Get PCN information
        const { data: pcnData } = await supabase
          .from('primary_care_networks')
          .select('pcn_name')
          .eq('pcn_code', userPracticeDetails.pcn_code)
          .maybeSingle();

        // Get other practices in the same PCN
        const { data: otherPractices } = await supabase
          .from('practice_details')
          .select('practice_name')
          .eq('pcn_code', userPracticeDetails.pcn_code)
          .neq('user_id', user.id);

        // Get neighbourhood information (if exists)
        const { data: neighbourhoodData } = await supabase
          .from('neighbourhoods')
          .select('name')
          .limit(1);

        setPracticeContext({
          practiceName: userPracticeDetails.practice_name,
          practiceManagerName: practiceManagerProfile?.full_name,
          pcnName: pcnData?.pcn_name,
          neighbourhoodName: neighbourhoodData?.[0]?.name,
          otherPracticesInPCN: otherPractices?.map(p => p.practice_name) || [],
          logoUrl: userPracticeDetails.logo_url,
          // Enhanced practice details
          practiceAddress: userPracticeDetails.address,
          practicePhone: userPracticeDetails.phone,
          practiceEmail: userPracticeDetails.email,
          practiceWebsite: userPracticeDetails.website,
          // User details
          userFullName: userProfile?.full_name,
          userEmail: userProfile?.email || user.email,
          userRole: userRoles?.[0]?.role,
          userRoles: userRoles?.map(r => r.role) || [],
          emailSignature: userPracticeDetails.email_signature,
          letterSignature: userPracticeDetails.letter_signature
        });

        console.log('Practice context loaded from user practice details:', {
          practiceName: userPracticeDetails.practice_name,
          pcnName: pcnData?.pcn_name
        });
        return;
      }

      // If user doesn't have their own practice details, try user_roles approach
      console.log('No user practice details found, checking user_roles...');
      
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('practice_id, role')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('User role query result:', { userRole, roleError });

      if (roleError || !userRole?.practice_id) {
        console.log('No practice assignment found for user');
        return;
      }

      // Get practice details including all information
      const { data: practiceDetails } = await supabase
        .from('practice_details')
        .select('practice_name, pcn_code, user_id, logo_url, address, phone, email, website, email_signature, letter_signature')
        .eq('id', userRole.practice_id)
        .maybeSingle();

      console.log('Practice details from user_roles:', { practiceDetails });

      if (practiceDetails) {
        setPracticeDetails(practiceDetails);

        // Get practice manager name from profiles
        const { data: practiceManagerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', practiceDetails.user_id)
          .maybeSingle();

        // Get PCN information
        const { data: pcnData } = await supabase
          .from('primary_care_networks')
          .select('pcn_name')
          .eq('pcn_code', practiceDetails.pcn_code)
          .maybeSingle();

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
          logoUrl: practiceDetails.logo_url,
          // Enhanced practice details
          practiceAddress: practiceDetails.address,
          practicePhone: practiceDetails.phone,
          practiceEmail: practiceDetails.email,
          practiceWebsite: practiceDetails.website,
          // User details
          userFullName: userProfile?.full_name,
          userEmail: userProfile?.email || user.email,
          userRole: userRoles?.[0]?.role,
          userRoles: userRoles?.map(r => r.role) || [],
          emailSignature: practiceDetails.email_signature,
          letterSignature: practiceDetails.letter_signature
        });

        console.log('Practice context loaded from user_roles:', {
          practiceName: practiceDetails.practice_name,
          pcnName: pcnData?.pcn_name
        });
      } else {
        console.log('Practice details not found');
      }

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