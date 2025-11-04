import React, { useState, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LiveTranscriptModal } from '@/components/LiveTranscriptModal';
import { DeepgramRealtimeTranscriber } from '@/utils/DeepgramRealtimeTranscriber';

const StandaloneTranscriptionViewer: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [transcriber, setTranscriber] = useState<DeepgramRealtimeTranscriber | null>(null);

  const handleToggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  const handleTranscriptUpdate = (data: any) => {
    if (data.text) {
      setTranscriptText(prev => prev + (prev ? ' ' : '') + data.text);
    }
  };

  const handleError = (error: string) => {
    console.error('Transcription error:', error);
  };

  const handleStatusChange = (status: string) => {
    console.log('Transcription status:', status);
  };

  // Initialize transcriber
  useEffect(() => {
    const newTranscriber = new DeepgramRealtimeTranscriber(
      handleTranscriptUpdate,
      handleError,
      handleStatusChange
    );
    setTranscriber(newTranscriber);

    return () => {
      if (newTranscriber.isActive()) {
        newTranscriber.stopTranscription();
      }
    };
  }, []);

  // Auto-start/stop transcription when modal opens/closes
  useEffect(() => {
    if (!transcriber) return;

    if (isModalOpen && !isRecording) {
      // Start transcription
      transcriber.startTranscription();
      setIsRecording(true);
    } else if (!isModalOpen && isRecording) {
      // Stop transcription and clear
      transcriber.stopTranscription();
      setIsRecording(false);
      setTranscriptText('');
    }
  }, [isModalOpen, transcriber]);

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2">
        <Button
          onClick={handleToggleModal}
          size="lg"
          className={cn(
            "h-14 w-14 rounded-full shadow-lg transition-all duration-300",
            isRecording 
              ? "bg-destructive hover:bg-destructive/90 animate-pulse" 
              : "bg-primary hover:bg-primary/90"
          )}
          title={isRecording ? "Stop transcription" : "Start live transcription"}
        >
          {isRecording ? (
            <MicOff className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </Button>
        <span className="text-xs font-medium text-muted-foreground">
          {isRecording ? "Live" : "Deepgram"}
        </span>
      </div>

      {/* Live transcript modal */}
      <LiveTranscriptModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        transcriptText={transcriptText}
      />
    </>
  );
};

export default StandaloneTranscriptionViewer;
