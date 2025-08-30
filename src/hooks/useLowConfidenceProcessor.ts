import { useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseLowConfidenceProcessorProps {
  meetingId?: string;
  sessionId?: string;
  isRecording: boolean;
  processingInterval?: number; // in milliseconds, default 30s
}

export function useLowConfidenceProcessor({
  meetingId,
  sessionId,
  isRecording,
  processingInterval = 30000 // 30 seconds
}: UseLowConfidenceProcessorProps) {
  const intervalRef = useRef<NodeJS.Timeout>();
  const lastProcessedCountRef = useRef(0);

  const processLowConfidenceChunks = useCallback(async () => {
    if (!meetingId || !sessionId) return;

    try {
      console.log('🔄 Auto-processing low-confidence chunks...');
      
      const { data, error } = await supabase.functions.invoke('ai-context-restorer', {
        body: {
          meetingId,
          sessionId,
          batchSize: 10
        }
      });

      if (error) {
        console.error('Auto-processing error:', error);
        return;
      }

      if (data.processedCount > 0) {
        console.log(`✅ Auto-processed ${data.processedCount} chunks, restored ${data.restoredCount} chunks`);
        lastProcessedCountRef.current += data.processedCount;

        // If there are remaining chunks, schedule another processing run
        if (data.remainingChunks) {
          setTimeout(() => processLowConfidenceChunks(), 5000); // 5s delay for batch processing
        }
      }
    } catch (error) {
      console.error('Error in auto-processing:', error);
    }
  }, [meetingId, sessionId]);

  useEffect(() => {
    if (isRecording && meetingId && sessionId) {
      // Start periodic processing
      intervalRef.current = setInterval(processLowConfidenceChunks, processingInterval);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    } else if (intervalRef.current) {
      // Stop processing when recording stops
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, [isRecording, meetingId, sessionId, processLowConfidenceChunks, processingInterval]);

  // Final processing run when recording stops
  useEffect(() => {
    if (!isRecording && meetingId && sessionId && lastProcessedCountRef.current > 0) {
      // Wait 2 seconds after recording stops, then do final processing
      const finalTimeout = setTimeout(() => {
        processLowConfidenceChunks();
      }, 2000);

      return () => clearTimeout(finalTimeout);
    }
  }, [isRecording, meetingId, sessionId, processLowConfidenceChunks]);

  return {
    triggerManualProcessing: processLowConfidenceChunks,
    totalProcessed: lastProcessedCountRef.current
  };
}