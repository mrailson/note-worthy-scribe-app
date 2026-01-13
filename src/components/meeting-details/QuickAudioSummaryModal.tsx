import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Clock, Headphones, Check, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface QuickAudioSummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  meetingTitle: string;
}

type GenerationStatus = 'idle' | 'generating' | 'complete' | 'error';

interface DurationOption {
  value: number;
  label: string;
  description: string;
}

const DURATION_OPTIONS: DurationOption[] = [
  { value: 1, label: '1 Minute', description: 'Quick highlights' },
  { value: 2, label: '2 Minutes', description: 'Key points summary' },
  { value: 3, label: '3 Minutes', description: 'Detailed overview' },
  { value: 5, label: '5 Minutes', description: 'Comprehensive briefing' },
];

const DEFAULT_VOICE_ID = 'pFZP5JQG7iQjIQuC4Bku'; // Lily - British Female

export const QuickAudioSummaryModal: React.FC<QuickAudioSummaryModalProps> = ({
  open,
  onOpenChange,
  meetingId,
  meetingTitle,
}) => {
  const [selectedDuration, setSelectedDuration] = useState<number>(2);
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);

  const handleGenerate = async () => {
    setStatus('generating');
    setStatusMessage('Preparing meeting content...');
    setAudioUrl(null);
    setAudioDuration(null);

    try {
      // Update status messages as we progress
      setTimeout(() => {
        if (status === 'generating') {
          setStatusMessage('Generating audio script...');
        }
      }, 2000);

      setTimeout(() => {
        if (status === 'generating') {
          setStatusMessage('Converting to speech...');
        }
      }, 5000);

      setTimeout(() => {
        if (status === 'generating') {
          setStatusMessage('Finalising audio...');
        }
      }, 10000);

      const { data, error } = await supabase.functions.invoke('generate-audio-overview', {
        body: {
          meetingId,
          voiceProvider: 'elevenlabs',
          voiceId: DEFAULT_VOICE_ID,
          targetDuration: selectedDuration,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate audio');
      }

      if (data?.audioUrl) {
        setAudioUrl(data.audioUrl);
        setAudioDuration(data.duration || null);
        setStatus('complete');
        toast.success('Audio summary generated successfully');
      } else {
        throw new Error('No audio URL returned');
      }
    } catch (error) {
      console.error('Error generating audio summary:', error);
      setStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Failed to generate audio');
      toast.error('Failed to generate audio summary');
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;

    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `${meetingTitle.replace(/[^a-zA-Z0-9]/g, '-')}-audio-summary.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Audio download started');
  };

  const handleReset = () => {
    setStatus('idle');
    setStatusMessage('');
    setAudioUrl(null);
    setAudioDuration(null);
  };

  const handleClose = () => {
    if (status !== 'generating') {
      handleReset();
      onOpenChange(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5" />
            Generate Audio Summary
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {status === 'idle' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select the duration for your audio summary:
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                {DURATION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedDuration(option.value)}
                    className={cn(
                      'flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all',
                      'hover:border-primary/50 hover:bg-accent/50',
                      selectedDuration === option.value
                        ? 'border-primary bg-accent'
                        : 'border-border'
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      <Clock className="h-4 w-4" />
                      {option.label}
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>

              <Button onClick={handleGenerate} className="w-full mt-4">
                <Headphones className="h-4 w-4 mr-2" />
                Generate Audio
              </Button>
            </div>
          )}

          {status === 'generating' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">{statusMessage}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This may take a moment...
                </p>
              </div>
            </div>
          )}

          {status === 'complete' && audioUrl && (
            <div className="flex flex-col items-center space-y-4 py-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              
              <div className="text-center">
                <p className="font-medium text-green-600 dark:text-green-400">
                  Audio Ready!
                </p>
                {audioDuration && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Duration: {formatDuration(audioDuration)}
                  </p>
                )}
              </div>

              <audio controls src={audioUrl} className="w-full mt-2" />

              <div className="flex gap-2 w-full">
                <Button onClick={handleDownload} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Download MP3
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center space-y-4 py-4">
              <div className="text-center">
                <p className="font-medium text-destructive">Generation Failed</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {statusMessage}
                </p>
              </div>
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
