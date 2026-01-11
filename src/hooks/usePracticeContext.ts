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
        .select('full_name, email, phone')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('👤 User profile loaded:', userProfile);

      // Get user roles with practice_id
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role, practice_id')
        .eq('user_id', user.id);
      
      console.log('👥 User roles loaded:', userRoles);

      // Find the user's practice_id from user_roles
      const userRoleWithPractice = userRoles?.find(r => r.practice_id);
      const practiceId = userRoleWithPractice?.practice_id;

      console.log('🏢 User practice_id:', practiceId);

      // SHARED PRACTICE DETAILS: Look up practice_details by practice_id (gp_practices.id)
      // This ensures all users in the same organisation see the same details
      let sharedPracticeDetails = null;
      
      if (practiceId) {
        // First, get the gp_practice info
        const { data: gpPractice } = await supabase
          .from('gp_practices')
          .select('id, name, organisation_type, email, phone, address, website, pcn_code')
          .eq('id', practiceId)
          .maybeSingle();

        console.log('🏥 GP Practice from user_roles:', gpPractice);

        // Then look for practice_details that match this organisation
        // Priority: practice_details with matching practice name (case-insensitive)
        if (gpPractice?.name) {
          const { data: matchedDetails } = await supabase
            .from('practice_details')
            .select('*')
            .ilike('practice_name', gpPractice.name)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (matchedDetails) {
            console.log('✅ Found shared practice_details for organisation:', matchedDetails.practice_name);
            sharedPracticeDetails = matchedDetails;
          }
        }

        // If no matching practice_details, create context from gp_practices
        if (!sharedPracticeDetails && gpPractice) {
          console.log('📝 Using gp_practices data as base (no practice_details found)');
          sharedPracticeDetails = {
            practice_name: gpPractice.name,
            address: gpPractice.address,
            phone: gpPractice.phone,
            email: gpPractice.email,
            website: gpPractice.website,
            pcn_code: gpPractice.pcn_code,
            organisation_type: gpPractice.organisation_type
          };
        }
      }

      // Fallback: Check user's own practice_details if no shared details found
      if (!sharedPracticeDetails) {
        const { data: userPracticeDetails } = await supabase
          .from('practice_details')
          .select('*')
          .eq('user_id', user.id)
          .not('practice_name', 'is', null)
          .neq('practice_name', '')
          .order('updated_at', { ascending: false })
          .maybeSingle();

        if (userPracticeDetails) {
          console.log('📋 Using user-specific practice_details as fallback:', userPracticeDetails.practice_name);
          sharedPracticeDetails = userPracticeDetails;
        }
      }

      if (sharedPracticeDetails) {
        setPracticeDetails(sharedPracticeDetails);

        // Get PCN information
        let pcnData = null;
        if (sharedPracticeDetails.pcn_code) {
          const { data: pcnResult } = await supabase
            .from('primary_care_networks')
            .select('pcn_name')
            .eq('pcn_code', sharedPracticeDetails.pcn_code)
            .maybeSingle();
          pcnData = pcnResult;
        }

        // Get other practices in the same PCN
        let otherPractices: any[] = [];
        if (sharedPracticeDetails.pcn_code) {
          const { data: otherPracticesResult } = await supabase
            .from('practice_details')
            .select('practice_name')
            .eq('pcn_code', sharedPracticeDetails.pcn_code)
            .neq('practice_name', sharedPracticeDetails.practice_name);
          otherPractices = otherPracticesResult || [];
        }

        // Get neighbourhood information
        const { data: neighbourhoodData } = await supabase
          .from('neighbourhoods')
          .select('name')
          .limit(1);

        setPracticeContext({
          practiceName: sharedPracticeDetails.practice_name,
          organisationType: sharedPracticeDetails.organisation_type || 'GP Practice',
          pcnName: pcnData?.pcn_name,
          neighbourhoodName: neighbourhoodData?.[0]?.name,
          otherPracticesInPCN: otherPractices?.map(p => p.practice_name) || [],
          logoUrl: sharedPracticeDetails.logo_url,
          practiceAddress: sharedPracticeDetails.address,
          practicePhone: sharedPracticeDetails.phone,
          practiceEmail: sharedPracticeDetails.email,
          practiceWebsite: sharedPracticeDetails.website,
          userFullName: userProfile?.full_name,
          userEmail: userProfile?.email || user.email,
          userPhone: userProfile?.phone,
          userRole: userRoles?.[0]?.role,
          userRoles: userRoles?.map(r => r.role) || [],
          emailSignature: sharedPracticeDetails.email_signature,
          letterSignature: sharedPracticeDetails.letter_signature
        });

        console.log('✅ Practice context loaded (shared across organisation):', {
          practiceName: sharedPracticeDetails.practice_name,
          pcnName: pcnData?.pcn_name,
          currentUser: userProfile?.full_name
        });
      } else {
        // No practice details found - user-only context
        console.log('❌ No practice details found - using user-only context');
        setPracticeContext({
          userFullName: userProfile?.full_name,
          userEmail: userProfile?.email || user.email,
          userPhone: userProfile?.phone,
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