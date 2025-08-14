import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

import { useNavigate, useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userModules: string[];
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  hasModuleAccess: (module: string) => boolean;
  refreshUserModules: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userModules, setUserModules] = useState<string[]>([]);
  
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  // Function to fetch user modules from user_roles table
  const fetchUserModules = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('meeting_notes_access, gp_scribe_access, complaints_manager_access, ai_4_pm_access, enhanced_access, cqc_compliance_access, shared_drive_access, mic_test_service_access')
        .eq('user_id', userId)
        .limit(1)
        .single();
      
      if (error) {
        console.error('Error fetching user modules:', error);
        return;
      }
      
      // Convert the access flags to module names array
      const modules: string[] = [];
      if (data?.meeting_notes_access) modules.push('meeting_recorder');
      if (data?.gp_scribe_access) modules.push('gp_scribe');
      if (data?.complaints_manager_access) modules.push('complaints_system');
      if (data?.ai_4_pm_access) modules.push('ai_4_pm');
      if (data?.enhanced_access) modules.push('enhanced_access');
      if (data?.cqc_compliance_access) modules.push('cqc_compliance');
      if (data?.shared_drive_access) modules.push('shared_drive_access');
      if (data?.mic_test_service_access) modules.push('mic_test_service');
      
      setUserModules(modules);
    } catch (error) {
      console.error('Error fetching user modules:', error);
    }
  };

  // Function to check if user has access to a specific module
  const hasModuleAccess = (module: string) => {
    return userModules.includes(module);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Fetch user modules when user logs in
        if (session?.user) {
          setTimeout(() => {
            fetchUserModules(session.user.id);
          }, 0);
        } else {
          setUserModules([]);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      // Also fetch modules for existing session
      if (session?.user) {
        setTimeout(() => {
          fetchUserModules(session.user.id);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Force refresh user modules every 2 seconds to catch permission changes
  useEffect(() => {
    if (user?.id) {
      // Immediate refresh
      fetchUserModules(user.id);
      
      const interval = setInterval(() => {
        fetchUserModules(user.id);
      }, 2000); // Reduced to 2 seconds for faster updates
      
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error("Login Failed:", error.message);
    } else {
      // Only show welcome toast on desktop
      if (!isMobile) {
        console.log("Login Successful - Welcome to Notewell AI Meeting Notes Service");
      }
    }
    
    return { error };
  };


  const signOut = async () => {
    await supabase.auth.signOut();
    // Only show logout toast on desktop
    if (!isMobile) {
      console.log("Logged Out - You have been successfully logged out");
    }
    // Navigate to home page to show login form
    navigate('/', { replace: true });
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = 'https://notewell.dialai.co.uk/reset-password';
    
    // Generate the actual reset link via Supabase
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    
    if (error) {
      console.error("Password reset failed:", error.message);
      return { error };
    }

    // Don't send the custom EmailJS email since Supabase already sends the reset email
    // The Supabase email will contain the proper reset link with tokens
    
    return { error: null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    if (error) {
      console.error("Password update failed:", error.message);
    } else {
      console.log("Password updated successfully");
    }
    
    return { error };
  };

  const value = {
    user,
    session,
    loading,
    userModules,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    hasModuleAccess,
    refreshUserModules: () => user?.id ? fetchUserModules(user.id) : Promise.resolve(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};