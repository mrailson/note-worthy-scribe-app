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
      
      // PARALLEL FETCH: Get user profile and roles simultaneously for faster initial load
      const [profileResult, rolesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, email, phone, letter_signature, email_signature')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role, practice_id')
          .eq('user_id', user.id)
      ]);
      
      const userProfile = profileResult.data;
      const userRoles = rolesResult.data;

      console.log('👤 User profile loaded:', userProfile);
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
        // Priority: practice_details with matching practice name (flexible matching)
        if (gpPractice?.name) {
          // Clean the name for flexible matching (remove common prefixes like "The")
          const cleanedName = gpPractice.name.replace(/^the\s+/i, '').trim();
          
          // Try exact match first, then flexible match
          let { data: matchedDetails } = await supabase
            .from('practice_details')
            .select('*')
            .ilike('practice_name', gpPractice.name)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          // If no exact match, try flexible match (contains the cleaned name)
          if (!matchedDetails && cleanedName.length > 5) {
            const { data: flexibleMatch } = await supabase
              .from('practice_details')
              .select('*')
              .ilike('practice_name', `%${cleanedName}%`)
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            matchedDetails = flexibleMatch;
          }
          
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

        // PARALLEL FETCH: Get PCN, other practices, and neighbourhood data simultaneously
        const [pcnResult, otherPracticesResult, neighbourhoodResult] = await Promise.all([
          // Get PCN information
          sharedPracticeDetails.pcn_code
            ? supabase
                .from('primary_care_networks')
                .select('pcn_name')
                .eq('pcn_code', sharedPracticeDetails.pcn_code)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          // Get other practices in the same PCN
          sharedPracticeDetails.pcn_code
            ? supabase
                .from('practice_details')
                .select('practice_name')
                .eq('pcn_code', sharedPracticeDetails.pcn_code)
                .neq('practice_name', sharedPracticeDetails.practice_name)
            : Promise.resolve({ data: [] }),
          // Get neighbourhood information
          supabase
            .from('neighbourhoods')
            .select('name')
            .limit(1)
        ]);

        const pcnData = pcnResult.data;
        const otherPractices = otherPracticesResult.data || [];
        const neighbourhoodData = neighbourhoodResult.data;

        setPracticeContext({
          practiceName: sharedPracticeDetails.practice_name,
          organisationType: sharedPracticeDetails.organisation_type || 'GP Practice',
          pcnName: pcnData?.pcn_name,
          neighbourhoodName: neighbourhoodData?.[0]?.name,
          otherPracticesInPCN: otherPractices?.map((p: any) => p.practice_name) || [],
          logoUrl: sharedPracticeDetails.practice_logo_url || sharedPracticeDetails.logo_url,
          practiceAddress: sharedPracticeDetails.address,
          practicePhone: sharedPracticeDetails.phone,
          practiceEmail: sharedPracticeDetails.email,
          practiceWebsite: sharedPracticeDetails.website,
          userFullName: userProfile?.full_name,
          userEmail: userProfile?.email || user.email,
          userPhone: userProfile?.phone,
          userRole: userRoles?.[0]?.role,
          userRoles: userRoles?.map(r => r.role) || [],
          // Signatures come from user's profile (personal, not shared)
          emailSignature: userProfile?.email_signature,
          letterSignature: userProfile?.letter_signature
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
          userRoles: userRoles?.map(r => r.role) || [],
          // Include personal signatures even without practice details
          emailSignature: userProfile?.email_signature,
          letterSignature: userProfile?.letter_signature
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