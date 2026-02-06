export const WHISPER_CHUNKING = {
  mimeType: 'audio/webm;codecs=opus',
  mediaRecorderTimesliceMs: 4000,
  // Option A: 90s chunks with 3s overlap
  // Gives Whisper enough context to stabilise sentences without repeat-heavy joins
  // Stride = 87s new audio + 3s overlap
  chunkDurationMs: 90000,      // 90 seconds per chunk
  overlapMs: 3000,             // 3 seconds overlap
  accumulateUntilMs: 90000,    // Accumulate audio for 90s before processing
  maxChunkBytes: 4_000_000,    // ~4MB to accommodate 90s chunks (FLAC 16kHz mono)
  maxInflight: 2,
  retry: { attempts: 3, backoffMs: [250, 600, 1200] },
  uploadUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speech-to-text-chunked`,
  useSupabaseClient: false,
  // Whisper decode settings (sent to API; unsupported params are ignored by OpenAI)
  decode: {
    temperature: 0.0,
    beam_size: 5,
    condition_on_previous_text: true,
    no_repeat_ngram_size: 3,
    compression_ratio_threshold: 2.4,
    logprob_threshold: -1.0,
    hallucination_silence_threshold: 0.6,
    no_speech_threshold: 0.6,
  },
  // Stitching deduplication: compare last 2–3 sentences of chunk N
  // with first 2–3 sentences of chunk N+1; drop prefix if similarity >= 0.6
  deduplication: {
    enabled: true,
    sentencesToCompare: 3,
    similarityThreshold: 0.60,
    tokenOverlapThreshold: 0.60,
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
