import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LiveTranscriptModal } from '@/components/LiveTranscriptModal';
import { DeepgramRealtimeTranscriber, TranscriptData } from '@/utils/DeepgramRealtimeTranscriber';

const StandaloneTranscriptionViewer: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [transcriber, setTranscriber] = useState<DeepgramRealtimeTranscriber | null>(null);

  // Manage incremental vs final text to avoid duplication
  const [committedText, setCommittedText] = useState('');
  const [pendingText, setPendingText] = useState('');
  const lastFinalRef = useRef<string>('');

  const handleToggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

const handleTranscriptUpdate = (data: TranscriptData) => {
    const newText = (data.text || '').trim();
    if (!newText) return;

    if (data.is_final) {
      // Avoid appending the same final twice
      if (lastFinalRef.current === newText) return;
      lastFinalRef.current = newText;

      setCommittedText(prev => {
        const prevTrim = prev.trimEnd();
        // If the new final already matches the end, don't duplicate
        if (prevTrim.endsWith(newText)) return prevTrim;
        return (prevTrim ? prevTrim + ' ' : '') + newText;
      });
      setPendingText('');
    } else {
      // Interim text replaces the pending line (no duplication)
      setPendingText(newText);
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

  // Format text with natural breaks and paragraphs
  const formatTranscript = (text: string): string => {
    if (!text) return '';
    
    // Split into sentences (periods, question marks, exclamation marks)
    let formatted = text
      // Add line break after sentence-ending punctuation followed by space
      .replace(/([.!?])\s+/g, '$1\n')
      // Create paragraph breaks after 2-3 consecutive sentences
      .replace(/\n\n+/g, '\n\n');
    
    return formatted;
  };

  // Compose displayed transcript from committed + pending
  useEffect(() => {
    const combined = [committedText, pendingText].filter(Boolean).join(' ');
    setTranscriptText(formatTranscript(combined));
  }, [committedText, pendingText]);

// Auto-start/stop transcription when modal opens/closes
  useEffect(() => {
    if (!transcriber) return;

    if (isModalOpen && !isRecording) {
      transcriber
        .startTranscription()
        .then(() => setIsRecording(true))
        .catch((e) => console.error('Failed to start transcription', e));
    } else if (!isModalOpen && isRecording) {
      transcriber.stopTranscription();
      setIsRecording(false);
      setCommittedText('');
      setPendingText('');
      lastFinalRef.current = '';
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
