import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PracticeContext } from '@/types/ai4gp';

export const usePracticeContext = () => {
  const { user } = useAuth();
  const [practiceContext, setPracticeContext] = useState<PracticeContext>({});
  const [practiceDetails, setPracticeDetails] = useState<any>(null);

  const loadPracticeContext = async () => {
    if (!user) {
      console.log('❌ No user found, clearing practice context');
      setPracticeContext({});
      setPracticeDetails(null);
      return;
    }

    try {
      console.log('🔄 Loading practice context for user:', user.id);
      
      // Get user profile information
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('👤 User profile loaded:', userProfile);

      // Get user roles
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role, practice_id')
        .eq('user_id', user.id);
      
      console.log('👥 User roles loaded:', userRoles);

      // CRITICAL: Only use practice details that belong to THIS specific user
      // First, try to get the user's own practice details directly (prioritize records with practice names)
      const { data: userPracticeDetails, error: userPracticeError } = await supabase
        .from('practice_details')
        .select('practice_name, pcn_code, user_id, logo_url, address, phone, email, website, email_signature, letter_signature')
        .eq('user_id', user.id)
        .not('practice_name', 'is', null)
        .neq('practice_name', '')
        .order('updated_at', { ascending: false })
        .maybeSingle();

      console.log('🏥 User practice details query result:', { userPracticeDetails, userPracticeError });

      if (userPracticeDetails && userPracticeDetails.user_id === user.id) {
        // SECURITY CHECK: Ensure the practice details actually belong to this user
        console.log('✅ Using user\'s own practice details:', userPracticeDetails.practice_name);
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

      // If user doesn't have their own practice details, try user_roles approach (BUT ONLY FOR THIS USER)
      console.log('❓ No user practice details found, checking user_roles for current user only...');
      
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('practice_id, role')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('🔍 User role query result:', { userRole, roleError });

      if (roleError || !userRole?.practice_id) {
        console.log('❌ No practice assignment found for current user - using empty context');
        setPracticeContext({
          userFullName: userProfile?.full_name,
          userEmail: userProfile?.email || user.email,
          userRole: userRoles?.[0]?.role,
          userRoles: userRoles?.map(r => r.role) || []
        });
        return;
      }

      // Get practice details including all information - ONLY if it exists
      const { data: practiceDetailsFromRoles } = await supabase
        .from('practice_details')
        .select('practice_name, pcn_code, user_id, logo_url, address, phone, email, website, email_signature, letter_signature')
        .eq('id', userRole.practice_id)
        .maybeSingle();

      console.log('🏢 Practice details from user_roles:', { practiceDetailsFromRoles });

      if (practiceDetailsFromRoles) {
        console.log('✅ Setting practice details from user_roles lookup');
        setPracticeDetails(practiceDetailsFromRoles);

        // Get practice manager name from profiles (if practice belongs to someone else)
        const { data: practiceManagerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', practiceDetailsFromRoles.user_id)
          .maybeSingle();

        // Get PCN information (if pcn_code exists)
        let pcnData = null;
        if (practiceDetailsFromRoles.pcn_code) {
          const { data: pcnResult } = await supabase
            .from('primary_care_networks')
            .select('pcn_name')
            .eq('pcn_code', practiceDetailsFromRoles.pcn_code)
            .maybeSingle();
          pcnData = pcnResult;
        }

        // Get other practices in the same PCN (if pcn_code exists)
        let otherPractices = [];
        if (practiceDetailsFromRoles.pcn_code) {
          const { data: otherPracticesResult } = await supabase
            .from('practice_details')
            .select('practice_name')
            .eq('pcn_code', practiceDetailsFromRoles.pcn_code)
            .neq('id', userRole.practice_id);
          otherPractices = otherPracticesResult || [];
        }

        // Get neighbourhood information (if exists)
        const { data: neighbourhoodData } = await supabase
          .from('neighbourhoods')
          .select('name')
          .limit(1);

        setPracticeContext({
          practiceName: practiceDetailsFromRoles.practice_name,
          practiceManagerName: practiceManagerProfile?.full_name,
          pcnName: pcnData?.pcn_name,
          neighbourhoodName: neighbourhoodData?.[0]?.name,
          otherPracticesInPCN: otherPractices?.map(p => p.practice_name) || [],
          logoUrl: practiceDetailsFromRoles.logo_url,
          // Enhanced practice details
          practiceAddress: practiceDetailsFromRoles.address,
          practicePhone: practiceDetailsFromRoles.phone,
          practiceEmail: practiceDetailsFromRoles.email,
          practiceWebsite: practiceDetailsFromRoles.website,
          // User details - ALWAYS use current user's details, not practice owner's
          userFullName: userProfile?.full_name,
          userEmail: userProfile?.email || user.email,
          userRole: userRoles?.[0]?.role,
          userRoles: userRoles?.map(r => r.role) || [],
          emailSignature: practiceDetailsFromRoles.email_signature,
          letterSignature: practiceDetailsFromRoles.letter_signature
        });

        console.log('✅ Practice context loaded from user_roles for current user:', {
          practiceName: practiceDetailsFromRoles.practice_name,
          pcnName: pcnData?.pcn_name,
          currentUser: userProfile?.full_name
        });
      } else {
        console.log('❌ No practice details found for assigned practice - using user-only context');
        setPracticeContext({
          userFullName: userProfile?.full_name,
          userEmail: userProfile?.email || user.email,
          userRole: userRoles?.[0]?.role,
          userRoles: userRoles?.map(r => r.role) || []
        });
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