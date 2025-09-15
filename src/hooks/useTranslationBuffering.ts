import { useState, useRef } from 'react';

export const useTranslationBuffering = () => {
  const [isAudioBuffering, setIsAudioBuffering] = useState(false);
  const [incompleteMessageBuffer, setIncompleteMessageBuffer] = useState<string>('');
  const [lastProcessingTime, setLastProcessingTime] = useState(0);
  
  // Refs to ensure buffering never "loses" latest state
  const lastProcessingTimeRef = useRef<number>(0);
  const incompleteMessageBufferRef = useRef<string>('');
  const bufferTimerRef = useRef<number | null>(null);

  // Enhanced sentence completion detection
  const isCompleteSentence = (text: string): boolean => {
    if (!text || text.trim().length < 3) return false;
    
    const trimmed = text.trim();
    
    // Check for sentence-ending punctuation
    const hasSentenceEnding = /[.!?]$/.test(trimmed);
    
    // Check for complete thought indicators
    const hasCompleteThought = /\b(yes|no|okay|sure|thanks|hello|goodbye|please|thank you)\b/i.test(trimmed) ||
                              trimmed.length > 15; // Longer messages are likely complete
    
    // Check if it looks like a medical statement
    const isMedicalStatement = /\b(pain|hurt|feel|symptom|doctor|medication|treatment|appointment)\b/i.test(trimmed);
    
    return hasSentenceEnding || hasCompleteThought || isMedicalStatement;
  };

  const resetBuffer = () => {
    setIncompleteMessageBuffer('');
    incompleteMessageBufferRef.current = '';
    setIsAudioBuffering(false);
    if (bufferTimerRef.current) {
      clearTimeout(bufferTimerRef.current);
      bufferTimerRef.current = null;
    }
  };

  return {
    isAudioBuffering,
    setIsAudioBuffering,
    incompleteMessageBuffer,
    setIncompleteMessageBuffer,
    lastProcessingTime,
    setLastProcessingTime,
    lastProcessingTimeRef,
    incompleteMessageBufferRef,
    bufferTimerRef,
    isCompleteSentence,
    resetBuffer
  };
};