// Transcript Quality Analyser - Aggregate quality assessment for NHS/CQC compliance
import { getTranscriptQualityStatus, getQualityDescription, type TranscriptQualityStatus } from './confidenceGating';
import { isLikelyHallucination } from './whisperHallucinationPatterns';

export interface ChunkAnalysis {
  text: string;
  confidence: number;
  wasFiltered: boolean;
  filterReason?: string;
}

export interface TranscriptQualityReport {
  status: TranscriptQualityStatus | 'hallucination_dominant';
  avgConfidence: number;
  totalChunks: number;
  filteredChunks: number;
  mergedChunks: number;
  repetitionScore: number;  // 0-1, higher = more repetition detected
  hallucinationScore: number;  // 0-1, proportion of chunks flagged as hallucination
  warnings: string[];
  recommendation: string;
  isUsable: boolean;
}

/**
 * Analyse transcript quality from chunk data
 * Returns a comprehensive report for NHS/CQC compliance
 */
export function analyseTranscriptQuality(
  chunks: ChunkAnalysis[],
  mergedText: string
): TranscriptQualityReport {
  const totalChunks = chunks.length;
  const filteredChunks = chunks.filter(c => c.wasFiltered).length;
  const mergedChunks = totalChunks - filteredChunks;
  
  // Calculate average confidence from non-filtered chunks
  const validConfidences = chunks
    .filter(c => !c.wasFiltered && typeof c.confidence === 'number')
    .map(c => c.confidence);
  
  const avgConfidence = validConfidences.length > 0
    ? validConfidences.reduce((sum, c) => sum + c, 0) / validConfidences.length
    : 0;
  
  // Calculate repetition score from merged text
  const repetitionScore = calculateRepetitionScore(mergedText);
  
  // Calculate hallucination score
  const hallucinationScore = calculateHallucinationScore(chunks);
  
  // Determine warnings
  const warnings: string[] = [];
  
  if (filteredChunks > totalChunks * 0.5) {
    warnings.push(`${filteredChunks} of ${totalChunks} chunks were filtered (${((filteredChunks / totalChunks) * 100).toFixed(0)}%)`);
  }
  
  if (avgConfidence < 0.30) {
    warnings.push(`Average confidence is very low (${(avgConfidence * 100).toFixed(0)}%)`);
  }
  
  if (repetitionScore > 0.3) {
    warnings.push('High repetition detected in transcript');
  }
  
  if (hallucinationScore > 0.3) {
    warnings.push('Multiple potential hallucinations detected');
  }
  
  // Determine overall status
  let status: TranscriptQualityStatus | 'hallucination_dominant';
  
  if (hallucinationScore > 0.5 || (filteredChunks > totalChunks * 0.7 && avgConfidence < 0.25)) {
    status = 'hallucination_dominant';
  } else {
    status = getTranscriptQualityStatus(avgConfidence);
  }
  
  // Generate recommendation
  let recommendation: string;
  let isUsable: boolean;
  
  switch (status) {
    case 'hallucination_dominant':
      recommendation = 'This transcript should not be used for summaries, decisions, or minutes. The audio may not be suitable for transcription.';
      isUsable = false;
      break;
    case 'unreliable':
      recommendation = 'Review this transcript carefully before use. Consider re-recording with better audio quality.';
      isUsable = false;
      break;
    case 'degraded':
      recommendation = 'This transcript may contain inaccuracies. Manual review is recommended before clinical use.';
      isUsable = true;
      break;
    case 'reliable':
      recommendation = 'Transcript quality is acceptable for use.';
      isUsable = true;
      break;
  }
  
  return {
    status,
    avgConfidence,
    totalChunks,
    filteredChunks,
    mergedChunks,
    repetitionScore,
    hallucinationScore,
    warnings,
    recommendation,
    isUsable
  };
}

/**
 * Calculate repetition score based on sentence/phrase repetition
 */
function calculateRepetitionScore(text: string): number {
  if (!text || text.length < 100) return 0;
  
  // Split into sentences
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 10);
  
  if (sentences.length < 3) return 0;
  
  // Count unique sentences
  const uniqueSentences = new Set(sentences);
  const uniqueRatio = uniqueSentences.size / sentences.length;
  
  // Invert: lower unique ratio = higher repetition score
  return Math.max(0, Math.min(1, 1 - uniqueRatio));
}

/**
 * Calculate hallucination score from chunk analysis
 */
function calculateHallucinationScore(chunks: ChunkAnalysis[]): number {
  if (chunks.length === 0) return 0;
  
  let hallucinationCount = 0;
  
  for (const chunk of chunks) {
    // Check if chunk was filtered due to hallucination
    if (chunk.filterReason?.toLowerCase().includes('hallucination')) {
      hallucinationCount++;
      continue;
    }
    
    // Also check text content for hallucination patterns
    if (!chunk.wasFiltered) {
      const check = isLikelyHallucination(chunk.text, chunk.confidence);
      if (check.isHallucination) {
        hallucinationCount++;
      }
    }
  }
  
  return hallucinationCount / chunks.length;
}

/**
 * Get a summary badge text for the quality status
 */
export function getQualityBadgeInfo(status: TranscriptQualityStatus | 'hallucination_dominant'): {
  text: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: 'check' | 'alert-triangle' | 'x-circle';
} {
  switch (status) {
    case 'reliable':
      return { text: 'Good Quality', variant: 'default', icon: 'check' };
    case 'degraded':
      return { text: 'Reduced Quality', variant: 'secondary', icon: 'alert-triangle' };
    case 'unreliable':
      return { text: 'Poor Quality', variant: 'destructive', icon: 'x-circle' };
    case 'hallucination_dominant':
      return { text: 'Unreliable - Review Required', variant: 'destructive', icon: 'x-circle' };
  }
}
