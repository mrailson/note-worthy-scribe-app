import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { useLGCapture } from '@/hooks/useLGCapture';
import { useLGUploadQueue } from '@/contexts/LGUploadQueueContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Camera, Loader2, Upload, Play } from 'lucide-react';
// Toast messages removed from LG Capture service

export default function LGCaptureStart() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createPatient, isLoading } = useLGCapture();
  const { activeUploads } = useLGUploadQueue();
  
  const [practiceOds, setPracticeOds] = useState('');
  const [uploaderName, setUploaderName] = useState('');
  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      // First try localStorage (fast cache)
      let savedOds = localStorage.getItem('lg_practice_ods');
      let savedName = localStorage.getItem('lg_uploader_name');
      
      // If localStorage empty, fallback to database (source of truth)
      if ((!savedOds || !savedName) && user?.id) {
        const { data } = await supabase
          .from('user_settings')
          .select('setting_value')
          .eq('user_id', user.id)
          .eq('setting_key', 'lg_capture_defaults')
          .maybeSingle();
        
        if (data?.setting_value) {
          const defaults = data.setting_value as { practiceOds?: string; uploaderName?: string; practiceName?: string };
          
          // Use database values if localStorage was empty
          if (!savedOds && defaults.practiceOds) {
            savedOds = defaults.practiceOds;
            localStorage.setItem('lg_practice_ods', savedOds);
          }
          if (!savedName && defaults.uploaderName) {
            savedName = defaults.uploaderName;
            localStorage.setItem('lg_uploader_name', savedName);
          }
          if (defaults.practiceName) {
            localStorage.setItem('lg_practice_name', defaults.practiceName);
          }
        }
      }
      
      if (savedOds && savedName) {
        setPracticeOds(savedOds);
        setUploaderName(savedName);
        setSettingsReady(true);
      } else {
        // No settings - redirect to landing to configure
        navigate('/lg-capture');
      }
    };
    
    loadSettings();
  }, [navigate, user?.id]);

  const handleBegin = async () => {
    const patientId = await createPatient({
      practice_ods: practiceOds.trim(),
      uploader_name: uploaderName.trim(),
    });

    if (patientId) {
      navigate(`/lg-capture/capture/${patientId}`, { replace: true });
    }
  };

  if (!settingsReady) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="container max-w-2xl mx-auto py-8 px-4 space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/lg-capture')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

      {/* Background upload indicator */}
      {activeUploads > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <Upload className="h-4 w-4 animate-pulse" />
          <span>{activeUploads} patient{activeUploads > 1 ? 's' : ''} uploading in background...</span>
        </div>
      )}

      <Card className="mt-8">
        <CardContent className="pt-12 pb-12 text-center space-y-8">
          <div className="space-y-4">
            <Camera className="h-16 w-16 mx-auto text-primary" />
            <h1 className="text-2xl font-bold">Ready to Capture</h1>
            <p className="text-muted-foreground text-lg">
              Click begin when ready with new patient records
            </p>
          </div>

          <Button
            onClick={handleBegin}
            disabled={isLoading}
            className="w-full max-w-xs h-16 text-xl"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="mr-2 h-6 w-6" />
                Begin
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground">
            {uploaderName} • {practiceOds}
          </p>
        </CardContent>
      </Card>
      </div>
    </>
  );
}
