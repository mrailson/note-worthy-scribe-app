import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ChunkSequenceValidatorConfig {
  /** Meeting ID to validate */
  meetingId: string | null;
  /** Whether validation is active (should be true while recording) */
  isActive: boolean;
  /** How often to check in ms (default: 120000 = 2 minutes) */
  checkIntervalMs?: number;
  /** Callback when a gap is detected */
  onGapDetected?: (expected: number, actual: number, missingIndices: number[]) => void;
}

interface ChunkSequenceState {
  /** Last validated chunk count from database */
  lastValidatedCount: number;
  /** Expected chunk count (from local tracking) */
  expectedCount: number;
  /** Whether there are any detected gaps */
  hasGaps: boolean;
  /** Missing chunk indices */
  missingChunks: number[];
  /** Last check timestamp */
  lastCheckTime: Date | null;
  /** Whether a check is currently running */
  isChecking: boolean;
}

export function useChunkSequenceValidator(config: ChunkSequenceValidatorConfig) {
  const {
    meetingId,
    isActive,
    checkIntervalMs = 120000, // 2 minutes
    onGapDetected
  } = config;

  const [state, setState] = useState<ChunkSequenceState>({
    lastValidatedCount: 0,
    expectedCount: 0,
    hasGaps: false,
    missingChunks: [],
    lastCheckTime: null,
    isChecking: false
  });

  const expectedCountRef = useRef<number>(0);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);

  /**
   * Call this whenever a chunk is sent to the database.
   * Increments the expected count so we can compare against actual DB count.
   */
  const reportChunkSent = useCallback(() => {
    expectedCountRef.current += 1;
    setState(prev => ({
      ...prev,
      expectedCount: expectedCountRef.current
    }));
  }, []);

  /**
   * Run a validation check against the database.
   */
  const validateNow = useCallback(async () => {
    if (!meetingId || isCheckingRef.current) return;

    isCheckingRef.current = true;
    setState(prev => ({ ...prev, isChecking: true }));

    try {
      // Get chunk count and indices from database
      const { data, error } = await supabase
        .from('meeting_transcription_chunks')
        .select('chunk_number')
        .eq('meeting_id', meetingId)
        .order('chunk_number', { ascending: true });

      if (error) {
        console.error('❌ ChunkValidator: Failed to query chunks:', error);
        return;
      }

      const dbCount = data?.length || 0;
      const expected = expectedCountRef.current;
      const now = new Date();

      // Check for sequence gaps
      const chunkNumbers = (data || []).map(d => d.chunk_number);
      const missingIndices: number[] = [];
      
      if (chunkNumbers.length > 0) {
        const maxChunk = Math.max(...chunkNumbers);
        const chunkSet = new Set(chunkNumbers);
        
        for (let i = 0; i <= maxChunk; i++) {
          if (!chunkSet.has(i)) {
            missingIndices.push(i);
          }
        }
      }

      const hasGaps = missingIndices.length > 0 || (expected > 0 && dbCount < expected - 2);
      // Allow 2-chunk tolerance for in-flight chunks

      if (hasGaps) {
        console.warn(
          `⚠️ ChunkValidator: Gap detected! Expected ~${expected}, DB has ${dbCount}. ` +
          `Missing indices: [${missingIndices.slice(0, 10).join(', ')}${missingIndices.length > 10 ? '...' : ''}]`
        );
        onGapDetected?.(expected, dbCount, missingIndices);
      } else {
        console.log(`✅ ChunkValidator: ${dbCount} chunks verified (expected ~${expected})`);
      }

      setState({
        lastValidatedCount: dbCount,
        expectedCount: expected,
        hasGaps,
        missingChunks: missingIndices,
        lastCheckTime: now,
        isChecking: false
      });

    } catch (err) {
      console.error('❌ ChunkValidator: Validation error:', err);
    } finally {
      isCheckingRef.current = false;
      setState(prev => ({ ...prev, isChecking: false }));
    }
  }, [meetingId, onGapDetected]);

  // Periodic validation
  useEffect(() => {
    if (!isActive || !meetingId) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    console.log(`🔍 ChunkValidator: Starting periodic validation every ${checkIntervalMs / 1000}s`);

    checkIntervalRef.current = setInterval(() => {
      validateNow();
    }, checkIntervalMs);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [isActive, meetingId, checkIntervalMs, validateNow]);

  // Reset when meeting changes
  useEffect(() => {
    expectedCountRef.current = 0;
    setState({
      lastValidatedCount: 0,
      expectedCount: 0,
      hasGaps: false,
      missingChunks: [],
      lastCheckTime: null,
      isChecking: false
    });
  }, [meetingId]);

  return {
    ...state,
    reportChunkSent,
    validateNow
  };
}
