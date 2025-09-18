import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SimpleLoginForm } from '@/components/SimpleLoginForm';
import { Header } from '@/components/Header';
import { MaintenanceBanner } from '@/components/MaintenanceBanner';
import AI4GPService from '@/components/AI4GPService';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

const AI4GP = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  
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
  
  // Trigger regeneration for the General Meeting (one-time demo)
  useEffect(() => {
    const triggerRegeneration = async () => {
      try {
        toast.info('🔄 Regenerating meeting notes with British English formatting...');
        await regenerateMeetingNotes('77b6b634-4946-4d96-a403-7bf1b641cb89');
        toast.success('✅ Meeting notes regenerated successfully! Check your meetings list.');
      } catch (error) {
        console.error('Failed to regenerate notes:', error);
        toast.error('❌ Failed to regenerate meeting notes');
      }
    };
    
    // Only run once per session
    const hasRun = sessionStorage.getItem('notes-regenerated-demo');
    if (!hasRun && user) {
      triggerRegeneration();
      sessionStorage.setItem('notes-regenerated-demo', 'true');
    }
  }, [user]);
  


  // Fetch user profile to check AI4GP access
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('ai4gp_access')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!user?.id,
  });

  const requestAccess = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would send a request to administrators
      // For now, we'll just show a message
      alert('Access request submitted. Please contact your administrator for AI4GP access.');
    } catch (error) {
      console.error('Error requesting access:', error);
    } finally {
      setLoading(false);
    }
  };


  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
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

  // Check if user has AI4GP access
  if (!profile?.ai4gp_access) {
    return (
      <div className="min-h-screen bg-background">
        <Header onNewMeeting={() => {}} />
        <div className="flex items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <Card className="w-full max-w-md p-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Access Required</h2>
                <p className="text-muted-foreground mb-4">
                  You need permission to access the AI4GP service. Please contact your administrator to request access.
                </p>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  AI4GP access is controlled at the user level and must be granted by system administrators.
                </AlertDescription>
              </Alert>

              <Button 
                onClick={requestAccess} 
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Requesting...' : 'Request Access'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col mobile-container safe-area-top safe-area-bottom">
      <Header onNewMeeting={() => {}} />
      
      
      <Separator />
      
      <main className="flex-1 flex flex-col min-h-0 mobile-scroll overflow-x-hidden">
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
          <MaintenanceBanner />
          <AI4GPService />
        </div>
        
      </main>

    </div>
  );
};

export default AI4GP;