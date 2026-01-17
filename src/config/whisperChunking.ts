export const WHISPER_CHUNKING = {
  mimeType: 'audio/webm;codecs=opus',
  mediaRecorderTimesliceMs: 4000,
  // Updated chunking: 30s chunks with 3s overlap (per ChatGPT recommendations)
  // Purpose: Reduce mid-sentence truncation, improve sentence integrity at boundaries
  chunkDurationMs: 30000,      // 30 seconds per chunk
  overlapMs: 3000,             // 3 seconds overlap between chunks
  accumulateUntilMs: 30000,    // Accumulate audio for 30s before processing
  maxChunkBytes: 1_500_000,
  maxInflight: 2,
  retry: { attempts: 3, backoffMs: [250, 600, 1200] },
  uploadUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speech-to-text-chunked`,
  useSupabaseClient: false,
};