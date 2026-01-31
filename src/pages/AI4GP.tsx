import React, { useState, useEffect, useMemo } from 'react';
import { SEO } from '@/components/SEO';
import { useAuth } from '@/contexts/AuthContext';
import { SimpleLoginForm } from '@/components/SimpleLoginForm';
import { Header } from '@/components/Header';
import { MaintenanceBanner } from '@/components/MaintenanceBanner';
import AI4GPService from '@/components/AI4GPService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FlaskConical } from 'lucide-react';

const AI4GP = () => {
  const { user, loading: authLoading } = useAuth();
  
  // Demo mode detection - only works on preview/localhost environments
  const isDemoMode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const isDemo = params.get('demo') === 'true';
    const isAllowedHost = 
      window.location.hostname.includes('lovableproject.com') ||
      window.location.hostname.includes('lovable.app') && !window.location.hostname.includes('meetingmagic.lovable.app') ||
      window.location.hostname.includes('localhost') ||
      window.location.hostname.includes('preview');
    
    // Production URL is explicitly blocked
    const isProduction = window.location.hostname === 'meetingmagic.lovable.app';
    
    return isDemo && isAllowedHost && !isProduction;
  }, []);
  
  // Function to regenerate meeting notes using GPT auto-generation for consistent formatting
  const regenerateMeetingNotes = async (meetingId: string) => {
    try {
      console.log('🔄 Regenerating meeting notes for meeting:', meetingId);
      
      const { data, error } = await supabase.functions.invoke('auto-generate-meeting-notes', {
        body: { 
          meetingId: meetingId, 
          forceRegenerate: true 
        }
      });

      if (error) {
        console.error('❌ Error regenerating meeting notes:', error);
        throw error;
      }

      console.log('✅ Successfully regenerated meeting notes with GPT formatting');
      return data;
    } catch (error) {
      console.error('❌ Failed to regenerate meeting notes:', error);
      throw error;
    }
  };
  
  // DISABLED: Demo feature for regenerating meeting notes
  // Uncomment to test British English formatting on a specific meeting
  // useEffect(() => {
  //   const triggerRegeneration = async () => {
  //     try {
  //       toast.info('🔄 Regenerating meeting notes with British English formatting...');
  //       await regenerateMeetingNotes('YOUR_MEETING_ID_HERE');
  //       toast.success('✅ Meeting notes regenerated successfully! Check your meetings list.');
  //     } catch (error) {
  //       console.error('Failed to regenerate notes:', error);
  //       toast.error('❌ Failed to regenerate meeting notes');
  //     }
  //   };
  //   
  //   // Only run once per session
  //   const hasRun = sessionStorage.getItem('notes-regenerated-demo');
  //   if (!hasRun && user) {
  //     triggerRegeneration();
  //     sessionStorage.setItem('notes-regenerated-demo', 'true');
  //   }
  // }, [user]);
  





  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Allow access if user is logged in OR if demo mode is active
  if (!user && !isDemoMode) {
    return (
      <div className="min-h-screen bg-background">
        <Header onNewMeeting={() => {}} />
        <div className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <div className="w-full max-w-md">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-foreground mb-2">AI4GP Service</h1>
              <p className="text-muted-foreground">
                Please log in to access the AI4GP service
              </p>
            </div>
            <SimpleLoginForm />
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background flex flex-col ai4gp-no-transform safe-area-top safe-area-bottom">
      <SEO 
        title="AI4GP | AI Assistant for General Practice | NoteWell AI"
        description="Advanced AI-powered consultation assistance for GP practices. Real-time voice interaction, clinical guidance, and intelligent documentation support for NHS primary care."
        canonical="https://www.gpnotewell.co.uk/ai4gp"
        keywords="AI GP assistant, voice-activated consultation tool, clinical AI, NHS GP AI, general practice assistant, consultation support"
      />
      <Header onNewMeeting={() => {}} />
      
      
      <Separator />
      
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <Alert className="mx-4 mt-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <FlaskConical className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>Demo Mode Active</strong> — You're testing Ask AI without authentication. 
            This mode is only available on preview environments. No real patient data is accessible.
          </AlertDescription>
        </Alert>
      )}
      
      <main className="flex-1 flex flex-col min-h-0 mobile-scroll overflow-x-hidden">
        <div className="flex-1 w-full max-w-[1536px] mx-auto px-0 sm:px-6 lg:px-8 py-0 sm:py-6 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
          <MaintenanceBanner />
          <AI4GPService isDemoMode={isDemoMode} />
        </div>
        
      </main>

    </div>
  );
};

export default AI4GP;