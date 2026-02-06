export const WHISPER_CHUNKING = {
  mimeType: 'audio/webm;codecs=opus',
  mediaRecorderTimesliceMs: 4000,
  // Updated: 25s chunks with 2.5s overlap (standardised per transcription plan)
  // Purpose: Balance transcription accuracy with file size; within 20-30s guidance
  chunkDurationMs: 25000,      // 25 seconds per chunk
  overlapMs: 2500,             // 2.5 seconds overlap
  accumulateUntilMs: 25000,    // Accumulate audio for 25s before processing
  maxChunkBytes: 1_500_000,
  maxInflight: 2,
  retry: { attempts: 3, backoffMs: [250, 600, 1200] },
  uploadUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speech-to-text-chunked`,
  useSupabaseClient: false,
  // Deduplication settings
  deduplication: {
    enabled: true,
    sentencesToCompare: 2,
    similarityThreshold: 0.85,
    tokenOverlapThreshold: 0.70,
  },
  // Confidence gate settings
  confidenceGate: {
    enabled: true,
    confidenceThreshold: 0.45,
    noSpeechThreshold: 0.60,
    enableCrossCheck: true,
  },
  // Sentence repair settings
  sentenceRepair: {
    enabled: true,
    removeFillers: true,
    fixBoundaries: true,
  },
};
