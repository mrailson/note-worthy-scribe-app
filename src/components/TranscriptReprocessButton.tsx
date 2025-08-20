import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, FileAudio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TranscriptReprocessButtonProps {
  meetingId: string | undefined;
  userId: string | undefined;
  onTranscriptUpdated?: (newTranscript: string) => void;
  className?: string;
}

interface ProcessingStep {
  step: string;
  description: string;
  progress: number;
  completed: boolean;
}

const TranscriptReprocessButton: React.FC<TranscriptReprocessButtonProps> = ({
  meetingId,
  userId,
  onTranscriptUpdated,
  className = ""
}) => {
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<ProcessingStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);

  const steps: ProcessingStep[] = [
    { step: 'finding', description: 'Finding audio backup...', progress: 10, completed: false },
    { step: 'downloading', description: 'Downloading audio file...', progress: 25, completed: false },
    { step: 'chunking', description: 'Splitting audio into chunks...', progress: 40, completed: false },
    { step: 'transcribing', description: 'Transcribing audio chunks...', progress: 75, completed: false },
    { step: 'saving', description: 'Saving transcript to database...', progress: 90, completed: false },
    { step: 'complete', description: 'Reprocessing complete!', progress: 100, completed: false }
  ];

  const updateStep = (stepName: string) => {
    const step = steps.find(s => s.step === stepName);
    if (step) {
      setCurrentStep(step);
      setProcessingSteps(prev => {
        const updated = [...prev];
        const index = updated.findIndex(s => s.step === stepName);
        if (index >= 0) {
          updated[index] = { ...step, completed: true };
        } else {
          updated.push({ ...step, completed: true });
        }
        return updated;
      });
    }
  };

  const handleReprocessAudio = async (e: React.MouseEvent) => {
    // Prevent collapse behavior
    e.preventDefault();
    e.stopPropagation();
    
    if (!meetingId || !userId) {
      toast.error('Missing meeting or user information');
      return;
    }

    setIsReprocessing(true);
    setError(null);
    setSuccess(false);
    setProcessingSteps([]);
    
    try {
      updateStep('finding');
      toast.info('Starting audio reprocessing...', {
        description: 'This will regenerate the full transcript from audio backup'
      });

      // First, find the audio backup for this meeting
      const { data: backups, error: backupError } = await supabase
        .from('meeting_audio_backups')
        .select('id, file_path, file_size, created_at')
        .eq('meeting_id', meetingId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (backupError) throw backupError;

      if (!backups || backups.length === 0) {
        throw new Error(`No audio backup found for meeting ${meetingId}. Please ensure audio was recorded for this specific meeting.`);
      }

      const backup = backups[0];
      console.log(`Found audio backup: ${backup.file_path} (${backup.file_size} bytes, created: ${backup.created_at})`);
      
      toast.info(`Using audio backup: ${backup.file_path}`, {
        description: `File size: ${Math.round(backup.file_size / 1024 / 1024)} MB`
      });

      updateStep('downloading');
      
      // Use the chunked reprocessing function
      updateStep('chunking');
      updateStep('transcribing');
      
      const { data, error } = await supabase.functions.invoke('reprocess-audio-chunks', {
        body: { 
          meetingId,
          userId,
          audioFilePath: backup.file_path
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Reprocessing failed');
      }

      updateStep('saving');
      
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

      updateStep('complete');
      setSuccess(true);

      // Call the callback with the new transcript
      if (onTranscriptUpdated && transcripts && transcripts.length > 0) {
        const fullTranscript = transcripts.map(t => t.content).join(' ');
        onTranscriptUpdated(fullTranscript);
      } else if (onTranscriptUpdated && data.transcription) {
        onTranscriptUpdated(data.transcription);
      }

      toast.success('Transcript successfully regenerated!', {
        description: `Processed ${data.chunksProcessed || 'multiple'} audio chunks`
      });

      // Clear success state after 5 seconds
      setTimeout(() => {
        setSuccess(false);
        setCurrentStep(null);
        setProcessingSteps([]);
      }, 5000);

    } catch (err) {
      console.error('Reprocessing error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      toast.error('Reprocessing failed: ' + errorMessage);
    } finally {
      setIsReprocessing(false);
    }
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

      {isReprocessing && currentStep && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="h-3 w-3 animate-spin border border-current border-t-transparent rounded-full" />
            <span className="font-medium">{currentStep.description}</span>
          </div>
          <Progress value={currentStep.progress} className="w-full" />
          
          {processingSteps.length > 0 && (
            <div className="space-y-1">
              {processingSteps.map((step, index) => (
                <div key={step.step} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>{step.description}</span>
                </div>
              ))}
            </div>
          )}
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
            <FileAudio className="h-3 w-3" />
            <span>Regenerates full transcript from audio backup in chunks (~2-3 minutes)</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TranscriptReprocessButton;