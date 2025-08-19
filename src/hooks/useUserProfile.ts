import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UserProfile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  updated_at: string;
  ai4gp_access: boolean;
  department: string | null;
  last_login: string | null;
  meeting_retention_policy: string | null;
  mic_test_service_visible: boolean;
  display_name?: string | null; // Optional for backwards compatibility
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        // If profile doesn't exist, try to create one with basic user data
        if (error.code === 'PGRST116') { // No rows found
          try {
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({
                user_id: session.user.id,
                email: session.user.email,
                full_name: session.user.user_metadata?.full_name || session.user.email
              })
              .select()
              .single();
              
            if (createError) {
              console.error('Error creating profile:', createError);
              setError(createError.message);
              return;
            }
            
            setProfile(newProfile);
            return;
          } catch (createErr: any) {
            console.error('Profile creation failed:', createErr);
            setError(createErr.message);
            return;
          }
        }
        setError(error.message);
        return;
      }

      setProfile(data);
    } catch (err: any) {
      console.error('Profile fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Pick<UserProfile, 'email' | 'full_name' | 'display_name'>>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Not authenticated",
          description: "Please log in to update your profile.",
          variant: "destructive"
        });
        return false;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', session.user.id);

      if (error) {
        console.error('Error updating profile:', error);
        toast({
          title: "Update failed",
          description: error.message,
          variant: "destructive"
        });
        return false;
      }

      // Refresh profile data
      await fetchProfile();
      
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated."
      });
      
      return true;
    } catch (err: any) {
      console.error('Profile update error:', err);
      toast({
        title: "Update failed",
        description: err.message,
        variant: "destructive"
      });
      return false;
    }
  };

  useEffect(() => {
    fetchProfile();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          fetchProfile();
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile,
    updateProfile
  };
}