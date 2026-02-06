import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Format detection ────────────────────────────────────────────────────────

function detectFormat(bytes: Uint8Array): { mimeType: string; extension: string } {
  if (bytes.length < 12) return { mimeType: 'audio/webm', extension: 'webm' };

  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) return { mimeType: 'audio/webm', extension: 'webm' };
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return { mimeType: 'audio/wav', extension: 'wav' };
  if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return { mimeType: 'audio/ogg', extension: 'ogg' };
  if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) return { mimeType: 'audio/flac', extension: 'flac' };
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return { mimeType: 'audio/mp4', extension: 'm4a' };
  if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)) return { mimeType: 'audio/mpeg', extension: 'mp3' };

  return { mimeType: 'audio/webm', extension: 'webm' };
}

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;

  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);

    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }

    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

// ── Preprocessing helper ────────────────────────────────────────────────────

function inferExtension(mime: string): string {
  const m = (mime || '').toLowerCase();
  if (m.includes('flac')) return 'flac';
  if (m.includes('webm')) return 'webm';
  if (m.includes('wav')) return 'wav';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('m4a') || m.includes('mp4') || m.includes('aac')) return 'm4a';
  if (m.includes('mp3') || m.includes('mpeg')) return 'mp3';
  return 'bin';
}

/**
 * Preprocess audio through the transcode-audio service.
 * Feature-flagged via ENABLE_SERVER_PREPROCESSING env var.
 * Falls back to direct forward on error/timeout.
 */
async function preprocessAudioViaTranscode(
  audioBytes: Uint8Array,
  declaredMime: string,
  requestId: string
): Promise<{ bytes: Uint8Array; mimeType: string; extension: string; preprocessed: boolean }> {
  const enabled = Deno.env.get('ENABLE_SERVER_PREPROCESSING') === 'true';

  if (!enabled) {
    console.log(`ℹ️ [${requestId}] Server preprocessing disabled (ENABLE_SERVER_PREPROCESSING !== 'true')`);
    return { bytes: audioBytes, mimeType: declaredMime, extension: inferExtension(declaredMime), preprocessed: false };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !anonKey) {
    console.warn(`⚠️ [${requestId}] Missing SUPABASE_URL or SUPABASE_ANON_KEY, skipping preprocessing`);
    return { bytes: audioBytes, mimeType: declaredMime, extension: inferExtension(declaredMime), preprocessed: false };
  }

  const transcodeUrl = `${supabaseUrl}/functions/v1/transcode-audio`;
  console.log(`🔄 [${requestId}] Preprocessing: sending ${audioBytes.length}B (${declaredMime}) to transcode-audio…`);

  try {
    const fd = new FormData();
    fd.append('file', new Blob([audioBytes], { type: declaredMime }), 'input.audio');

    const response = await fetch(transcodeUrl, {
      method: 'POST',
      headers: { 'apikey': anonKey },
      body: fd,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.warn(`⚠️ [${requestId}] transcode-audio error ${response.status}: ${errBody.slice(0, 200)}, falling back to direct forward`);
      return { bytes: audioBytes, mimeType: declaredMime, extension: inferExtension(declaredMime), preprocessed: false };
    }

    const resultBytes = new Uint8Array(await response.arrayBuffer());
    const resultMime = response.headers.get('Content-Type') || declaredMime;
    const resultExt = response.headers.get('X-Audio-Extension') || inferExtension(resultMime);
    const wasTranscoded = response.headers.get('X-Audio-Transcoded') === 'true';

    console.log(`✅ [${requestId}] Preprocessing complete: ${audioBytes.length}B → ${resultBytes.length}B, ${declaredMime} → ${resultMime} (.${resultExt}), transcoded=${wasTranscoded}`);
    return { bytes: resultBytes, mimeType: resultMime, extension: resultExt, preprocessed: true };
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    console.warn(`⚠️ [${requestId}] transcode-audio ${isTimeout ? 'timed out' : 'failed'}: ${err?.message || err}, falling back to direct forward`);
    return { bytes: audioBytes, mimeType: declaredMime, extension: inferExtension(declaredMime), preprocessed: false };
  }
}

// ── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) throw new Error('OpenAI API key not configured');

    const { audio } = await req.json();
    if (!audio) throw new Error('No audio data provided');

    console.log(`📋 [${requestId}] Processing audio chunk, base64 size: ${audio.length}`);

    // Convert base64 to binary
    const binaryAudio = processBase64Chunks(audio);
    console.log(`📦 [${requestId}] Binary audio: ${binaryAudio.length} bytes`);

    // Smart format detection from magic bytes
    const format = detectFormat(binaryAudio);
    console.log(`🎵 [${requestId}] Detected format: ${format.mimeType} (.${format.extension})`);

    // ── Preprocess through transcode-audio ──
    const preprocessed = await preprocessAudioViaTranscode(binaryAudio, format.mimeType, requestId);

    const forwardMime = preprocessed.preprocessed ? preprocessed.mimeType : format.mimeType;
    const forwardExt = preprocessed.preprocessed ? preprocessed.extension : format.extension;

    console.log(`📡 [${requestId}] Forwarding to OpenAI: ${preprocessed.bytes.length}B as ${forwardMime} (.${forwardExt}), preprocessed=${preprocessed.preprocessed}`);

    // Single attempt with resolved format
    const formData = new FormData();
    const blob = new Blob([preprocessed.bytes], { type: forwardMime });
    formData.append('file', blob, `audio.${forwardExt}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('response_format', 'json');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openAIApiKey}` },
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ [${requestId}] Whisper result: ${result.text?.slice(0, 100)}…`);

      return new Response(
        JSON.stringify({
          text: result.text || '',
          service: 'whisper',
          format: forwardMime
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const errorText = await response.text();
    console.error(`❌ [${requestId}] OpenAI API error (${response.status}): ${errorText}`);
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);

  } catch (error) {
    console.error(`❌ [${requestId}] Standalone Whisper error:`, error);

    return new Response(
      JSON.stringify({
        error: error.message,
        service: 'whisper'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
