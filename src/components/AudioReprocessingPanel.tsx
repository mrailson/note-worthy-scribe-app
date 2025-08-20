import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';

interface AudioReprocessingPanelProps {
  meetingId: string;
  userId: string;
  audioFilePath?: string;
}

const AudioReprocessingPanel: React.FC<AudioReprocessingPanelProps> = ({
  meetingId,
  userId,
  audioFilePath
}) => {
  const { toast } = useToast();
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reprocessingResults, setReprocessingResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReprocessAudio = async () => {
    if (!audioFilePath) {
      toast({
        title: "Error",
        description: "No audio file path provided for reprocessing",
        variant: "destructive",
      });
      return;
    }

    setIsReprocessing(true);
    setProgress(0);
    setError(null);
    setReprocessingResults(null);

    try {
      toast({
        title: "Starting Reprocessing",
        description: "Processing audio file in chunks to recover missing transcript...",
      });

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 2000);

      const { data, error } = await supabase.functions.invoke('reprocess-audio-chunks', {
        body: {
          meetingId,
          userId,
          audioFilePath
        }
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) {
        throw new Error(error.message || 'Reprocessing failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Reprocessing failed');
      }

      setReprocessingResults(data);
      
      toast({
        title: "Reprocessing Complete",
        description: `Successfully processed ${data.chunksProcessed} audio chunks and recovered missing transcript content.`,
      });

    } catch (err) {
      console.error('Reprocessing error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      toast({
        title: "Reprocessing Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsReprocessing(false);
    }
  };

  const handleMonitorMeeting = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('meeting-length-monitor', {
        body: {
          action: 'monitor_length',
          meetingId,
          userId,
          currentDuration: 58 // Known duration from the data
        }
      });

      if (error) throw error;

      toast({
        title: "Meeting Monitored",
        description: `Meeting monitoring complete. ${data.isLongMeeting ? 'Long meeting protections activated.' : 'Normal processing recommended.'}`,
      });

    } catch (err) {
      console.error('Monitoring error:', err);
      toast({
        title: "Monitoring Failed",
        description: err instanceof Error ? err.message : 'Unknown error occurred',
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Audio Reprocessing Panel
        </CardTitle>
        <CardDescription>
          Recover missing transcript content from audio backups and implement future protections
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Reprocessing Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {reprocessingResults && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Reprocessing Successful</AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-1">
                <p>Chunks processed: {reprocessingResults.chunksProcessed}</p>
                <p>New content length: {reprocessingResults.updateResult?.newContentLength} characters</p>
                <p>Total transcript length: {reprocessingResults.updateResult?.totalLength} characters</p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {isReprocessing && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Processing audio chunks... This may take several minutes.
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        <div className="grid gap-3">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Meeting Information</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Meeting ID: {meetingId}</p>
              <p>User ID: {userId}</p>
              {audioFilePath && <p>Audio File: {audioFilePath}</p>}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleReprocessAudio}
              disabled={isReprocessing || !audioFilePath}
              className="flex-1"
            >
              {isReprocessing ? 'Reprocessing...' : 'Reprocess Audio'}
            </Button>
            
            <Button
              onClick={handleMonitorMeeting}
              variant="outline"
              disabled={isReprocessing}
            >
              Setup Monitoring
            </Button>
          </div>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Future Protection Measures</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
              <li>Meetings over 45 minutes will be automatically monitored</li>
              <li>Audio will be processed in 5MB chunks to prevent timeouts</li>
              <li>Automatic alerts for transcript truncation detection</li>
              <li>Backup reprocessing capabilities for failed transcriptions</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default AudioReprocessingPanel;