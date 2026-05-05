import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userModules: string[];
  isSystemAdmin: boolean;
  canViewConsultationExamples: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  hasModuleAccess: (module: string) => boolean;
  refreshUserModules: () => Promise<void>;
  refreshSessionStatus: () => Promise<Session | null>;
  checkConsultationExamplesVisibility: () => Promise<void>;
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
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [canViewConsultationExamples, setCanViewConsultationExamples] = useState(true);
  
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  // Function to fetch user modules from user_roles table
  const fetchUserModules = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, meeting_notes_access, gp_scribe_access, complaints_manager_access, enhanced_access, cqc_compliance_access, shared_drive_access, mic_test_service_access, api_testing_service_access, translation_service_access, fridge_monitoring_access, cso_governance_access, lg_capture_access, bp_service_access, survey_manager_access, document_signoff_access')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error fetching user modules:', error);
        return;
      }
      
      // Handle empty result set
      if (!data || data.length === 0) {
        setUserModules([]);
        return;
      }
      
      // Cast data to expected type (types.ts may lag behind actual DB schema)
      const roleRecords = data as unknown as Array<{
        role?: string;
        meeting_notes_access: boolean;
        gp_scribe_access: boolean;
        complaints_manager_access: boolean;
        enhanced_access: boolean;
        cqc_compliance_access: boolean;
        shared_drive_access: boolean;
        mic_test_service_access: boolean;
        api_testing_service_access: boolean;
        translation_service_access: boolean;
        fridge_monitoring_access: boolean;
        cso_governance_access: boolean;
        lg_capture_access: boolean;
        bp_service_access: boolean;
        survey_manager_access?: boolean;
        document_signoff_access?: boolean;
      }>;

      // Aggregate access flags across ALL role records using OR logic
      // If ANY role grants access to a module, the user gets access
      const aggregatedAccess = roleRecords.reduce((acc, roleRecord) => ({
        meeting_notes_access: acc.meeting_notes_access || roleRecord.meeting_notes_access,
        gp_scribe_access: acc.gp_scribe_access || roleRecord.gp_scribe_access,
        complaints_manager_access: acc.complaints_manager_access || roleRecord.complaints_manager_access,
        enhanced_access: acc.enhanced_access || roleRecord.enhanced_access,
        cqc_compliance_access: acc.cqc_compliance_access || roleRecord.cqc_compliance_access,
        shared_drive_access: acc.shared_drive_access || roleRecord.shared_drive_access,
        mic_test_service_access: acc.mic_test_service_access || roleRecord.mic_test_service_access,
        api_testing_service_access: acc.api_testing_service_access || roleRecord.api_testing_service_access,
        translation_service_access: acc.translation_service_access || roleRecord.translation_service_access,
        fridge_monitoring_access: acc.fridge_monitoring_access || roleRecord.fridge_monitoring_access,
        cso_governance_access: acc.cso_governance_access || roleRecord.cso_governance_access,
        lg_capture_access: acc.lg_capture_access || roleRecord.lg_capture_access,
        bp_service_access: acc.bp_service_access || roleRecord.bp_service_access,
        survey_manager_access: acc.survey_manager_access || (roleRecord.survey_manager_access ?? false),
        document_signoff_access: acc.document_signoff_access || (roleRecord.document_signoff_access ?? false),
      }), {
        meeting_notes_access: false,
        gp_scribe_access: false,
        complaints_manager_access: false,
        enhanced_access: false,
        cqc_compliance_access: false,
        shared_drive_access: false,
        mic_test_service_access: false,
        api_testing_service_access: false,
        translation_service_access: false,
        fridge_monitoring_access: false,
        cso_governance_access: false,
        lg_capture_access: false,
        bp_service_access: false,
        survey_manager_access: false,
        document_signoff_access: false,
      });
      
      // Convert the aggregated access flags to module names array
      const modules: string[] = [];
      if (aggregatedAccess.meeting_notes_access) modules.push('meeting_recorder');
      if (aggregatedAccess.gp_scribe_access) modules.push('gp_scribe');
      if (aggregatedAccess.complaints_manager_access) modules.push('complaints_system');
      if (aggregatedAccess.enhanced_access) modules.push('enhanced_access');
      if (aggregatedAccess.cqc_compliance_access) modules.push('cqc_compliance');
      if (aggregatedAccess.shared_drive_access) modules.push('shared_drive_access');
      if (aggregatedAccess.mic_test_service_access) modules.push('mic_test_service_access');
      if (aggregatedAccess.api_testing_service_access) modules.push('api_testing_service');
      if (aggregatedAccess.translation_service_access) modules.push('translation_service');
      if (aggregatedAccess.fridge_monitoring_access) modules.push('fridge_monitoring_access');
      if (aggregatedAccess.cso_governance_access) modules.push('cso_governance_access');
      if (aggregatedAccess.lg_capture_access) modules.push('lg_capture_access');
      if (aggregatedAccess.bp_service_access) modules.push('bp_service_access');
      if (aggregatedAccess.survey_manager_access) modules.push('survey_manager_access');
      if (aggregatedAccess.document_signoff_access) modules.push('document_signoff_access');
      
      console.log(`Found ${data.length} role record(s) for user, aggregated modules:`, modules);
      setUserModules(modules);
    } catch (error) {
      console.error('Error fetching user modules:', error);
    }
  };

  // Function to check if user is system admin
  const checkSystemAdmin = async (userId: string) => {
    try {
      console.log('Checking system admin status for user:', userId);
      const { data, error } = await supabase
        .rpc('is_system_admin', { _user_id: userId });
      
      console.log('System admin check result:', { data, error });
      if (!error) {
        setIsSystemAdmin(data || false);
        console.log('Set isSystemAdmin to:', data || false);
      } else {
        console.error('RPC error:', error);
        setIsSystemAdmin(false);
      }
    } catch (error) {
      console.error('Error checking system admin status:', error);
      setIsSystemAdmin(false);
    }
  };

  // Function to check consultation examples visibility
  const checkConsultationExamplesVisibility = async () => {
    if (!user) {
      setCanViewConsultationExamples(true);
      return;
    }
    
    try {
      const { data, error } = await supabase.rpc('can_view_consultation_examples', {
        _user_id: user.id
      });
      
      if (error) {
        console.error('Error checking consultation examples visibility:', error);
        setCanViewConsultationExamples(true); // Default to true on error
      } else {
        setCanViewConsultationExamples(data ?? true);
      }
    } catch (error) {
      console.error('Error in checkConsultationExamplesVisibility:', error);
      setCanViewConsultationExamples(true);
    }
  };

  // Function to check if user has access to a specific module
  const hasModuleAccess = (module: string) => {
    // Special handling for practice manager access
    if (module === 'practice_manager_access') {
      // This should be checked via the role, not module access
      // The ProtectedRoute component will handle this check
      return true; // Allow the component to handle the actual check
    }
    return userModules.includes(module);
  };

  // Track if we've already fetched for the current user to prevent duplicate fetches
  const fetchedUserIdRef = React.useRef<string | null>(null);

  const fetchUserData = async (userId: string, forceRefresh = false) => {
    // Prevent duplicate fetches for the same user unless forced
    if (!forceRefresh && fetchedUserIdRef.current === userId) {
      return;
    }
    fetchedUserIdRef.current = userId;
    
    // Fetch all user data in parallel
    await Promise.all([
      fetchUserModules(userId),
      checkSystemAdmin(userId),
      checkConsultationExamplesVisibility()
    ]);
  };

  const applySessionState = (currentSession: Session | null) => {
    setSession(currentSession);
    setUser(currentSession?.user ?? null);
    if (currentSession?.user) {
      setTimeout(() => {
        fetchUserData(currentSession.user.id);
      }, 0);
    } else {
      fetchedUserIdRef.current = null;
      setUserModules([]);
      setIsSystemAdmin(false);
      setCanViewConsultationExamples(true);
    }
  };

  const refreshSessionStatus = async (): Promise<Session | null> => {
    try {
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession?.user) {
        applySessionState(existingSession);
        return existingSession;
      }

      const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
      applySessionState(refreshedSession ?? null);
      return refreshedSession ?? null;
    } catch (error) {
      console.warn('Session refresh/check failed:', error);
      applySessionState(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        applySessionState(session);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      applySessionState(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Update session activity every 5 minutes and cleanup expired sessions
  useEffect(() => {
    if (!user?.id) return;

    const updateActivity = async () => {
      try {
        await supabase.rpc('update_session_activity', { p_user_id: user.id });
      } catch (error) {
        console.error('Error updating session activity:', error);
      }
    };

    const cleanupSessions = async () => {
      try {
        await supabase.rpc('cleanup_expired_sessions');
      } catch (error) {
        console.error('Error cleaning up expired sessions:', error);
      }
    };

    // Update activity immediately
    updateActivity();
    
    // Set up intervals
    const activityInterval = setInterval(updateActivity, 5 * 60 * 1000); // Every 5 minutes
    const cleanupInterval = setInterval(cleanupSessions, 15 * 60 * 1000); // Every 15 minutes

    return () => {
      clearInterval(activityInterval);
      clearInterval(cleanupInterval);
    };
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error("Login Failed:", error.message);
        
        // Enhanced error messages for common issues
        if (error.message?.includes('fetch') || error.message?.includes('Failed to fetch') || 
            error.message?.includes('network') || error.message?.includes('timeout')) {
          const enhancedError = {
            ...error,
            message: 'Connection failed. If using a corporate VPN, try disconnecting temporarily.',
            isVpnRelated: true
          };
          return { error: enhancedError };
        }
        
        return { error };
      }

      // Success
      if (!isMobile) {
        console.log("Login Successful - Welcome to Notewell AI Meeting Notes Service");
      }
      return { error: null };

    } catch (authError: any) {
      console.error("Authentication error:", authError);
      
      // Handle fetch errors
      if (authError.message?.includes('fetch') || authError.message?.includes('Failed to fetch')) {
        const enhancedError = {
          ...authError,
          message: 'Connection failed. If using a corporate VPN, try disconnecting temporarily.',
          isVpnRelated: true
        };
        return { error: enhancedError };
      }
      
      return { error: authError };
    }
  };


  const signOut = async () => {
    try {
      console.log('Starting logout process...');
      
      // Set flag to prevent magic link re-authentication
      sessionStorage.setItem('just_logged_out', 'true');
      
      // Clear any auth tokens from URL hash
      if (window.location.hash && window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      
      // Mark session as inactive in database before signing out
      if (user?.id) {
        try {
          await supabase.rpc('mark_session_inactive', { p_user_id: user.id });
          console.log('Session marked as inactive');
        } catch (sessionError) {
          console.error('Error marking session inactive:', sessionError);
        }
      }
      
      // Sign out globally to invalidate all sessions
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      
      if (error) {
        // Handle common logout errors gracefully
        if (error.message?.includes('Auth session missing') || error.message?.includes('session_not_found')) {
          console.log('Session already expired or missing - proceeding with logout');
        } else {
          console.error('Logout error:', error);
        }
      } else {
        console.log('Logout successful');
      }
      
      // Clear local state immediately
      setUser(null);
      setSession(null);
      setUserModules([]);
      setIsSystemAdmin(false);
      setCanViewConsultationExamples(true);
      
      // Only show logout toast on desktop
      if (!isMobile) {
        console.log("Logged Out - You have been successfully logged out");
      }
      
      // Navigate to home page to show login form with forced reload on mobile browsers
      navigate('/', { replace: true });
      
      // Force page refresh on Edge/mobile browsers to ensure clean state
      if (navigator.userAgent.includes('Edge') || navigator.userAgent.includes('Edg/')) {
        setTimeout(() => {
          window.location.href = '/';
        }, 100);
      }
    } catch (error: any) {
      // Handle common logout errors gracefully
      if (error.message?.includes('Auth session missing') || error.message?.includes('session_not_found')) {
        console.log('Session already expired - logout completed');
      } else {
        console.error('Error during logout:', error);
      }
      
      // Clear local state and navigate regardless of error
      setUser(null);
      setSession(null);
      setUserModules([]);
      setIsSystemAdmin(false);
      setCanViewConsultationExamples(true);
      navigate('/', { replace: true });
    }
  };

  const resetPassword = async (email: string) => {
    try {
      // Use our custom edge function to generate password reset link and send via EmailJS
      const { data, error } = await supabase.functions.invoke('generate-password-reset', {
        body: { email: email }
      });

      if (error) {
        console.error("Password reset failed:", error.message);
        return { error };
      }

      if (data?.success) {
        console.log("Password reset email sent successfully via EmailJS");
        return { error: null };
      } else {
        console.error("Password reset failed:", data?.error);
        return { error: { message: data?.error || "Failed to send password reset email" } };
      }
    } catch (err: any) {
      console.error("Password reset error:", err);
      return { error: { message: err.message || "An error occurred while sending reset email" } };
    }
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
    isSystemAdmin,
    canViewConsultationExamples,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    hasModuleAccess,
    refreshUserModules: () => user?.id ? fetchUserData(user.id, true) : Promise.resolve(),
    refreshSessionStatus,
    checkConsultationExamplesVisibility,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};