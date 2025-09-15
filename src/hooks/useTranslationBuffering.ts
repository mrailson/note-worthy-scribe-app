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
    if (!text || text.trim().length < 2) return false; // Reduced from 3 to 2 chars
    
    const trimmed = text.trim();
    
    // Check for sentence-ending punctuation
    const hasSentenceEnding = /[.!?]$/.test(trimmed);
    
    // Expanded complete thought indicators
    const hasCompleteThought = /\b(yes|no|okay|ok|sure|thanks|hello|goodbye|please|thank you|hi|bye|good|bad|here|there|now|later|today|yesterday|tomorrow|help|stop|wait|go|come|see|look|hear|speak|talk|understand|know|think|feel|want|need|have|get|give|take|make|do|can|will|should|must)\b/i.test(trimmed) ||
                              trimmed.length > 12; // Reduced from 15 to 12 chars
    
    // Expanded medical statement patterns
    const isMedicalStatement = /\b(pain|hurt|ache|sore|feel|symptom|sick|ill|doctor|nurse|medication|medicine|treatment|therapy|appointment|hospital|clinic|exam|check|test|blood|pressure|temperature|fever|cough|cold|headache|stomach|back|chest|arm|leg|head|neck|shoulder|knee|foot|hand|finger|toe|eye|ear|nose|mouth|throat|skin|heart|lung|kidney|liver|brain|muscle|bone|joint|allergy|asthma|diabetes|cancer|surgery|operation|prescription|pill|tablet|injection|shot)\b/i.test(trimmed);
    
    // Common conversational markers
    const isConversationalMarker = /\b(well|so|then|but|and|or|because|since|when|where|what|why|how|who|which|that|this|these|those|here|there|now|then|today|tomorrow|yesterday|morning|afternoon|evening|night)\b/i.test(trimmed);
    
    return hasSentenceEnding || hasCompleteThought || isMedicalStatement || isConversationalMarker;
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