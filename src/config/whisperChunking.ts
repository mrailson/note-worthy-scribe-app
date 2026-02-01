export const WHISPER_CHUNKING = {
  mimeType: 'audio/webm;codecs=opus',
  mediaRecorderTimesliceMs: 4000,
  // Updated: 15s chunks with 1s overlap (reduced from 1.5s to minimize echoing)
  // Purpose: Match merge algorithm's synthetic timeline expectations
  chunkDurationMs: 15000,      // 15 seconds per chunk (matches DEFAULT_MERGE_CONFIG.chunkDurationSec)
  overlapMs: 1000,             // 1 second overlap (reduced from 1.5s - Whisper is resilient)
  accumulateUntilMs: 15000,    // Accumulate audio for 15s before processing
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