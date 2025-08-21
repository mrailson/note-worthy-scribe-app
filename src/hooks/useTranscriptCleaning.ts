// Hook for managing transcript cleaning with ChatGPT's enhanced algorithms

import { useState, useCallback } from 'react';
import { streamingTranscriptCleaner } from '@/utils/StreamingTranscriptCleaner';

export interface UseTranscriptCleaningOptions {
  enableAutoClean?: boolean;
  onCleanedUpdate?: (cleanedText: string, stats: any) => void;
}

export const useTranscriptCleaning = (options: UseTranscriptCleaningOptions = {}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<any>({});

  // Process new transcript segment with enhanced overlap detection
  const processTranscriptSegment = useCallback(async (
    text: string, 
    confidence?: number,
    words?: Array<{ word: string; start: number; end: number; confidence: number }>
  ) => {
    if (!options.enableAutoClean || !text?.trim()) return text;

    setIsProcessing(true);
    
    try {
      // Map word format to match AdvancedTranscriptCleaner interface
      const mappedWords = words?.map(w => ({
        text: w.word,
        start: w.start,
        end: w.end
      }));

      const result = streamingTranscriptCleaner.processStreamingSegment({
        text,
        timestamp: Date.now(),
        confidence: confidence || 1.0,
        words: mappedWords,
        is_final: true
      });

      setStats(result.stats);
      
      if (options.onCleanedUpdate) {
        options.onCleanedUpdate(result.text, result.stats);
      }

      console.log('🧹 Transcript processing complete:', {
        inputLength: text.length,
        outputLength: result.text.length,
        wasUpdate: result.isUpdate,
        stats: result.stats
      });

      return result.text;
    } catch (error) {
      console.error('Error processing transcript:', error);
      return text; // Fallback to original text
    } finally {
      setIsProcessing(false);
    }
  }, [options.enableAutoClean, options.onCleanedUpdate]);

  // Reset cleaner state (e.g., when starting new meeting)
  const reset = useCallback(() => {
    streamingTranscriptCleaner.reset();
    setStats({});
    console.log('🔄 Transcript cleaner reset');
  }, []);

  // Get current processing statistics
  const getCurrentStats = useCallback(() => {
    return {
      ...stats,
      ...streamingTranscriptCleaner.getStats()
    };
  }, [stats]);

  return {
    processTranscriptSegment,
    reset,
    isProcessing,
    stats: getCurrentStats(),
  };
};