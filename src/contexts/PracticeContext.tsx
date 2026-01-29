import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PracticeContext as PracticeContextType } from '@/types/ai4gp';

interface PracticeContextState {
  practiceContext: PracticeContextType;
  practiceDetails: any;
  isLoading: boolean;
  loadPracticeContext: () => Promise<void>;
}

const PracticeContextContext = createContext<PracticeContextState | undefined>(undefined);

export const PracticeContextProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [practiceContext, setPracticeContext] = useState<PracticeContextType>({});
  const [practiceDetails, setPracticeDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadPracticeContext = useCallback(async () => {
    if (!user) {
      setPracticeContext({});
      setPracticeDetails(null);
      setHasLoaded(false);
      return;
    }

    // Skip if already loaded for this user
    if (hasLoaded) {
      return;
    }

    setIsLoading(true);

    try {
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

      // Find the user's practice_id from user_roles
      const userRoleWithPractice = userRoles?.find(r => r.practice_id);
      const practiceId = userRoleWithPractice?.practice_id;

      // SHARED PRACTICE DETAILS: Look up practice_details by practice_id (gp_practices.id)
      let sharedPracticeDetails = null;
      
      if (practiceId) {
        // First, get the gp_practice info
        const { data: gpPractice } = await supabase
          .from('gp_practices')
          .select('id, name, organisation_type, email, phone, address, website, pcn_code')
          .eq('id', practiceId)
          .maybeSingle();

        // Then look for practice_details that match this organisation
        if (gpPractice?.name) {
          const cleanedName = gpPractice.name.replace(/^the\s+/i, '').trim();
          
          let { data: matchedDetails } = await supabase
            .from('practice_details')
            .select('*')
            .ilike('practice_name', gpPractice.name)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
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
            sharedPracticeDetails = matchedDetails;
          }
        }

        // If no matching practice_details, create context from gp_practices
        if (!sharedPracticeDetails && gpPractice) {
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
          sharedPracticeDetails = userPracticeDetails;
        }
      }

      if (sharedPracticeDetails) {
        setPracticeDetails(sharedPracticeDetails);

        // PARALLEL FETCH: Get PCN, other practices, and neighbourhood data simultaneously
        const [pcnResult, otherPracticesResult, neighbourhoodResult] = await Promise.all([
          sharedPracticeDetails.pcn_code
            ? supabase
                .from('primary_care_networks')
                .select('pcn_name')
                .eq('pcn_code', sharedPracticeDetails.pcn_code)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          sharedPracticeDetails.pcn_code
            ? supabase
                .from('practice_details')
                .select('practice_name')
                .eq('pcn_code', sharedPracticeDetails.pcn_code)
                .neq('practice_name', sharedPracticeDetails.practice_name)
            : Promise.resolve({ data: [] }),
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
          emailSignature: userProfile?.email_signature,
          letterSignature: userProfile?.letter_signature
        });
      } else {
        setPracticeContext({
          userFullName: userProfile?.full_name,
          userEmail: userProfile?.email || user.email,
          userPhone: userProfile?.phone,
          userRole: userRoles?.[0]?.role,
          userRoles: userRoles?.map(r => r.role) || [],
          emailSignature: userProfile?.email_signature,
          letterSignature: userProfile?.letter_signature
        });
      }

      setHasLoaded(true);
    } catch (error) {
      console.error('Error loading practice context:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, hasLoaded]);

  // Reset when user changes
  useEffect(() => {
    setHasLoaded(false);
    setPracticeContext({});
    setPracticeDetails(null);
  }, [user?.id]);

  // Load practice context once when user is available
  useEffect(() => {
    if (user && !hasLoaded && !isLoading) {
      loadPracticeContext();
    }
  }, [user, hasLoaded, isLoading, loadPracticeContext]);

  const value = useMemo(() => ({
    practiceContext,
    practiceDetails,
    isLoading,
    loadPracticeContext
  }), [practiceContext, practiceDetails, isLoading, loadPracticeContext]);

  return (
    <PracticeContextContext.Provider value={value}>
      {children}
    </PracticeContextContext.Provider>
  );
};

export const usePracticeContextFromProvider = () => {
  const context = useContext(PracticeContextContext);
  if (context === undefined) {
    throw new Error('usePracticeContextFromProvider must be used within a PracticeContextProvider');
  }
  return context;
};
