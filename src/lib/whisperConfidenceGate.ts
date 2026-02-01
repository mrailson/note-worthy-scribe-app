/**
 * Whisper Confidence Gate
 * 
 * Implements intelligent confidence-based flagging that:
 * 1. Detects low-confidence Whisper output
 * 2. Detects high deduplication rates (indicator of poor quality)
 * 3. Flags sections for AssemblyAI cross-check
 * 
 * This enables multi-engine verification for safety.
 */

export interface ConfidenceMetrics {
  confidence: number;
  noSpeechProbability: number;
  audioQuality: 'good' | 'acceptable' | 'poor';
  duplicatesRemoved: number;
  originalLength: number;
}

export interface ConfidenceResult {
  isLowConfidence: boolean;
  requiresCrossCheck: boolean;
  reason?: string;
  metrics: ConfidenceMetrics;
}

// Thresholds for flagging
const CONFIDENCE_THRESHOLD = 0.45; // Below this triggers flag
const NO_SPEECH_THRESHOLD = 0.6; // Above this triggers flag
const DEDUPLICATION_RATE_THRESHOLD = 0.3; // If >30% of text was duplicates
const MIN_WORDS_FOR_ANALYSIS = 5; // Don't flag very short segments

/**
 * Evaluate confidence metrics and determine if cross-check is needed
 */
export function evaluateConfidence(
  text: string,
  confidence: number,
  noSpeechProbability: number = 0,
  duplicatesRemoved: number = 0,
  originalTextLength: number = 0
): ConfidenceResult {
  const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  
  // Determine audio quality bucket
  let audioQuality: 'good' | 'acceptable' | 'poor' = 'good';
  if (noSpeechProbability > 0.8) {
    audioQuality = 'poor';
  } else if (noSpeechProbability > 0.5 || confidence < 0.4) {
    audioQuality = 'acceptable';
  }
  
  const metrics: ConfidenceMetrics = {
    confidence,
    noSpeechProbability,
    audioQuality,
    duplicatesRemoved,
    originalLength: originalTextLength
  };
  
  // Skip analysis for very short segments
  if (wordCount < MIN_WORDS_FOR_ANALYSIS) {
    return {
      isLowConfidence: false,
      requiresCrossCheck: false,
      metrics
    };
  }
  
  const reasons: string[] = [];
  let isLowConfidence = false;
  
  // Check confidence threshold
  if (confidence < CONFIDENCE_THRESHOLD) {
    isLowConfidence = true;
    reasons.push(`low confidence (${(confidence * 100).toFixed(0)}%)`);
  }
  
  // Check no-speech probability
  if (noSpeechProbability > NO_SPEECH_THRESHOLD) {
    isLowConfidence = true;
    reasons.push(`high no-speech probability (${(noSpeechProbability * 100).toFixed(0)}%)`);
  }
  
  // Check deduplication rate
  if (originalTextLength > 0 && duplicatesRemoved > 0) {
    // Estimate deduplication rate based on removed content
    const estimatedRemovedChars = duplicatesRemoved * 50; // Rough estimate per sentence
    const deduplicationRate = estimatedRemovedChars / originalTextLength;
    
    if (deduplicationRate > DEDUPLICATION_RATE_THRESHOLD) {
      isLowConfidence = true;
      reasons.push(`high deduplication rate (${duplicatesRemoved} sentences removed)`);
    }
  }
  
  // Determine if cross-check is warranted
  // Cross-check if low confidence AND we have enough content to matter
  const requiresCrossCheck = isLowConfidence && wordCount >= 10;
  
  return {
    isLowConfidence,
    requiresCrossCheck,
    reason: reasons.length > 0 ? reasons.join(', ') : undefined,
    metrics
  };
}

/**
 * State for tracking confidence across chunks
 */
export interface ConfidenceGateState {
  lowConfidenceChunks: number[];
  totalChunks: number;
  cumulativeConfidence: number;
  crossCheckRequested: boolean;
}

/**
 * Create initial confidence gate state
 */
export function createConfidenceGateState(): ConfidenceGateState {
  return {
    lowConfidenceChunks: [],
    totalChunks: 0,
    cumulativeConfidence: 0,
    crossCheckRequested: false
  };
}

/**
 * Update confidence gate state with new chunk result
 */
export function updateConfidenceGateState(
  state: ConfidenceGateState,
  chunkIndex: number,
  result: ConfidenceResult
): ConfidenceGateState {
  const newState = { ...state };
  
  newState.totalChunks++;
  newState.cumulativeConfidence += result.metrics.confidence;
  
  if (result.isLowConfidence) {
    newState.lowConfidenceChunks.push(chunkIndex);
  }
  
  if (result.requiresCrossCheck) {
    newState.crossCheckRequested = true;
  }
  
  return newState;
}

/**
 * Get average confidence across all processed chunks
 */
export function getAverageConfidence(state: ConfidenceGateState): number {
  if (state.totalChunks === 0) return 0;
  return state.cumulativeConfidence / state.totalChunks;
}

/**
 * Get percentage of chunks that were low confidence
 */
export function getLowConfidenceRate(state: ConfidenceGateState): number {
  if (state.totalChunks === 0) return 0;
  return state.lowConfidenceChunks.length / state.totalChunks;
}

/**
 * Determine if the overall session should use AssemblyAI cross-check
 * for the final merged transcript
 */
export function shouldUseCrossCheck(state: ConfidenceGateState): boolean {
  // If any chunk explicitly requested cross-check
  if (state.crossCheckRequested) return true;
  
  // If more than 25% of chunks were low confidence
  if (getLowConfidenceRate(state) > 0.25) return true;
  
  // If average confidence is below threshold
  if (state.totalChunks > 0 && getAverageConfidence(state) < CONFIDENCE_THRESHOLD) return true;
  
  return false;
}
