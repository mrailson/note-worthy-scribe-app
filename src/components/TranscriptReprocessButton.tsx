import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TranscriptReprocessButtonProps {
  meetingId: string | undefined;
  userId: string | undefined;
  onTranscriptUpdated?: (newTranscript: string) => void;
  className?: string;
}

const TranscriptReprocessButton: React.FC<TranscriptReprocessButtonProps> = ({
  meetingId,
  userId,
  onTranscriptUpdated,
  className = ""
}) => {
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const handleReprocessAudio = async () => {
    if (!meetingId || !userId) {
      toast.error('Missing meeting or user information');
      return;
    }

    setIsReprocessing(true);
    setProgress(0);
    setError(null);
    setSuccess(false);
    setStatus('Finding audio backup...');

    try {
      // First, find the audio backup for this meeting
      setProgress(10);
      const { data: backups, error: backupError } = await supabase
        .from('meeting_audio_backups')
        .select('id, file_path, file_size')
        .eq('meeting_id', meetingId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (backupError) throw backupError;

      if (!backups || backups.length === 0) {
        // Try to find backup by user and proximity to meeting time
        setStatus('Searching for backup by time proximity...');
        const { data: proximityBackups, error: proximityError } = await supabase
          .from('meeting_audio_backups')
          .select('id, file_path, file_size, created_at')
          .eq('user_id', userId)
          .order('file_size', { ascending: false })
          .limit(5);

        if (proximityError) throw proximityError;

        if (!proximityBackups || proximityBackups.length === 0) {
          throw new Error('No audio backup found for this meeting');
        }

        // Use the largest backup (likely the most complete)
        const backup = proximityBackups[0];
        setStatus('Found audio backup, starting reprocessing...');
        setProgress(30);

        await reprocessBackup(backup.id);
      } else {
        const backup = backups[0];
        setStatus('Found audio backup, starting reprocessing...');
        setProgress(30);

        await reprocessBackup(backup.id);
      }

    } catch (err) {
      console.error('Reprocessing error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      toast.error('Reprocessing failed: ' + errorMessage);
    } finally {
      setIsReprocessing(false);
    }
  };

  const reprocessBackup = async (backupId: string) => {
    setStatus('Processing audio file...');
    setProgress(50);

    const { data, error } = await supabase.functions.invoke('reprocess-audio-backup', {
      body: { backupId }
    });

    if (error) throw error;

    if (!data.success) {
      throw new Error(data.error || 'Reprocessing failed');
    }

    setProgress(80);
    setStatus('Updating transcript in database...');

    // The transcript should already be updated by the edge function
    // Let's fetch the updated transcript from meeting_transcripts table
    const { data: transcripts, error: transcriptError } = await supabase
      .from('meeting_transcripts')
      .select('content')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true });

    if (transcriptError) {
      console.warn('Could not fetch updated transcript:', transcriptError);
    }

    setProgress(100);
    setStatus('Reprocessing complete!');
    setSuccess(true);

    // Call the callback with the new transcript
    if (onTranscriptUpdated && transcripts && transcripts.length > 0) {
      const fullTranscript = transcripts.map(t => t.content).join(' ');
      onTranscriptUpdated(fullTranscript);
    } else if (onTranscriptUpdated && data.transcription) {
      onTranscriptUpdated(data.transcription);
    }

    toast.success('Transcript successfully regenerated from audio backup!');

    // Clear success state after 3 seconds
    setTimeout(() => {
      setSuccess(false);
      setStatus('');
      setProgress(0);
    }, 3000);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Transcript successfully regenerated from audio backup!
          </AlertDescription>
        </Alert>
      )}

      {isReprocessing && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-3 w-3 animate-spin border border-current border-t-transparent rounded-full" />
            <span>{status}</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      )}

      <Button
        onClick={handleReprocessAudio}
        disabled={isReprocessing || !meetingId || !userId}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        {isReprocessing ? (
          <>
            <div className="h-3 w-3 animate-spin border border-current border-t-transparent rounded-full" />
            Reprocessing...
          </>
        ) : (
          <>
            <RefreshCw className="h-3 w-3" />
            Reprocess Audio
          </>
        )}
      </Button>

      {!isReprocessing && !success && (
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Regenerates full transcript from audio backup (~1-2 minutes)</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptReprocessButton;