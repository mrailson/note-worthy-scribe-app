import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LiveTranscriptModal } from '@/components/LiveTranscriptModal';
import { DeepgramRealtimeTranscriber, TranscriptData } from '@/utils/DeepgramRealtimeTranscriber';

interface StandaloneTranscriptionViewerProps {
  onTranscriptUpdate?: (text: string) => void;
}

const StandaloneTranscriptionViewer: React.FC<StandaloneTranscriptionViewerProps> = ({ onTranscriptUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [transcriber, setTranscriber] = useState<DeepgramRealtimeTranscriber | null>(null);

  // Manage incremental vs final text to avoid duplication
  const [committedText, setCommittedText] = useState('');
  const [pendingText, setPendingText] = useState('');
  const lastFinalRef = useRef<string>('');
  const lastInterimRef = useRef<string>('');

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
      lastInterimRef.current = '';
    } else {
      // Interim: commit stable words, keep only the last ~10 words as pending
      const words = newText.split(/\s+/);
      const UNSTABLE_WORD_COUNT = 10;
      
      if (words.length > UNSTABLE_WORD_COUNT) {
        // Split into stable (commit) and unstable (pending)
        const stableWords = words.slice(0, -UNSTABLE_WORD_COUNT);
        const unstableWords = words.slice(-UNSTABLE_WORD_COUNT);
        
        const stableText = stableWords.join(' ');
        const unstableText = unstableWords.join(' ');
        
        // Only commit stable text if it's new (not already committed)
        if (stableText !== lastInterimRef.current) {
          setCommittedText(prev => {
            const prevTrim = prev.trimEnd();
            // Find what's new in stable text
            if (lastInterimRef.current && stableText.startsWith(lastInterimRef.current)) {
              const newPortion = stableText.slice(lastInterimRef.current.length).trim();
              if (newPortion) {
                return (prevTrim ? prevTrim + ' ' : '') + newPortion;
              }
              return prevTrim;
            }
            // First interim or completely different
            return (prevTrim ? prevTrim + ' ' : '') + stableText;
          });
          lastInterimRef.current = stableText;
        }
        
        setPendingText(unstableText);
      } else {
        // Less than 10 words, keep all as pending
        setPendingText(newText);
      }
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
    const formatted = formatTranscript(combined);
    setTranscriptText(formatted);
    
    // Call the callback if provided
    if (onTranscriptUpdate) {
      onTranscriptUpdate(formatted);
    }
  }, [committedText, pendingText, onTranscriptUpdate]);

// Auto-start transcription immediately when component mounts
  useEffect(() => {
    if (!transcriber) return;

    // Start transcription immediately
    if (!isRecording) {
      transcriber
        .startTranscription()
        .then(() => setIsRecording(true))
        .catch((e) => console.error('Failed to start transcription', e));
    }

    // Cleanup on unmount
    return () => {
      if (transcriber.isActive()) {
        transcriber.stopTranscription();
        setIsRecording(false);
        setCommittedText('');
        setPendingText('');
        lastFinalRef.current = '';
        lastInterimRef.current = '';
        setTranscriptText('');
      }
    };
  }, [transcriber]);

  return (
    <>
      {/* Floating button - only show if onTranscriptUpdate is not provided */}
      {!onTranscriptUpdate && (
        <>
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
              <span className="text-2xl font-bold text-white">D</span>
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
      )}
    </>
  );
};

export default StandaloneTranscriptionViewer;
