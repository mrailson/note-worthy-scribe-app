export const WHISPER_CHUNKING = {
  mimeType: 'audio/webm;codecs=opus',
  mediaRecorderTimesliceMs: 4000,
  accumulateUntilMs: 15000,
  overlapMs: 1000,
  maxChunkBytes: 1_500_000,
  maxInflight: 2,
  retry: { attempts: 3, backoffMs: [250, 600, 1200] },
  uploadUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speech-to-text-chunked`,
  useSupabaseClient: false,
};