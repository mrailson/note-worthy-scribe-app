export const WHISPER_CHUNKING = {
  mimeType: 'audio/webm;codecs=opus',
  mediaRecorderTimesliceMs: 4000,
  // Updated: 15s chunks with 1.5s overlap (aligned with BestOfBothMerger config)
  // Purpose: Match merge algorithm's synthetic timeline expectations
  chunkDurationMs: 15000,      // 15 seconds per chunk (matches DEFAULT_MERGE_CONFIG.chunkDurationSec)
  overlapMs: 1500,             // 1.5 seconds overlap (matches DEFAULT_MERGE_CONFIG.overlapSec)
  accumulateUntilMs: 15000,    // Accumulate audio for 15s before processing
  maxChunkBytes: 1_500_000,
  maxInflight: 2,
  retry: { attempts: 3, backoffMs: [250, 600, 1200] },
  uploadUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speech-to-text-chunked`,
  useSupabaseClient: false,
};