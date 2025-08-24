import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Lock, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoginForm } from '@/components/LoginForm';
import { Header } from '@/components/Header';
import AI4GPService from '@/components/AI4GPService';
import { DrugQuickModal } from '@/components/DrugQuickModal';
import { FormularyImportButton } from '@/components/FormularyImportButton';
import { FloatingQuickActions } from '@/components/ai4gp/FloatingQuickActions';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const AI4GP = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [drugModalOpen, setDrugModalOpen] = useState(false);

  // Keyboard shortcut for Drug Quick Lookup (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'k') {
        event.preventDefault();
        setDrugModalOpen(true);
      }
    };

    const handleOpenDrugModal = () => {
      setDrugModalOpen(true);
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('openDrugModal', handleOpenDrugModal);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('openDrugModal', handleOpenDrugModal);
    };
  }, []);

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
            <LoginForm />
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
      
      {/* Drug Quick Lookup Button */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-2 sm:px-4 py-2">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDrugModalOpen(true)}
              className="gap-2"
            >
              <Search className="h-4 w-4" />
              Drug Quick Lookup
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">Ctrl</span>K
              </kbd>
            </Button>
            
            {/* Admin Tools - Development */}
            <div className="ml-auto">
              <FormularyImportButton />
            </div>
          </div>
        </div>
      </div>
      
      <main className="flex-1 flex flex-col min-h-0 mobile-scroll">
        <div className="flex-1 container mx-auto px-2 sm:px-4 py-4 sm:py-6 flex flex-col min-h-0 overflow-y-auto space-y-6">
          <AI4GPService />
        </div>
        
        {/* Floating Quick Actions */}
        {user && profile?.ai4gp_access && (
          <FloatingQuickActions
            setInput={() => {}}
            onOpenDrugModal={() => setDrugModalOpen(true)}
            onOpenAITestModal={() => {}}
            onOpenNews={() => {}}
            onOpenImageService={() => {}}
            onOpenQuickImageModal={() => {}}
          />
        )}
      </main>

      {/* Drug Quick Lookup Modal */}
      <DrugQuickModal 
        open={drugModalOpen} 
        onClose={() => setDrugModalOpen(false)} 
      />
    </div>
  );
};

export default AI4GP;