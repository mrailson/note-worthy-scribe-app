import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

import { useNavigate, useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
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
  
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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
    const redirectUrl = `${window.location.origin}/reset-password`;
    
    // First generate the reset link via Supabase
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    
    if (error) {
      console.error("Password reset failed:", error.message);
      return { error };
    }

    // Then send custom email via EmailJS
    try {
      const { error: emailError } = await supabase.functions.invoke('send-password-reset-email', {
        body: {
          email: email,
          reset_link: redirectUrl,
          user_name: email.split('@')[0]
        }
      });

      if (emailError) {
        console.error("Email sending failed:", emailError.message);
        return { error: emailError };
      }
    } catch (emailError: any) {
      console.error("Email sending failed:", emailError.message);
    }
    
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
    signIn,
    signOut,
    resetPassword,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};