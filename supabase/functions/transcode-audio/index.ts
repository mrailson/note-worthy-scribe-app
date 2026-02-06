import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * transcode-audio Edge Function
 * 
 * Server-side audio preprocessing service for batch transcription.
 * Accepts any audio format and returns normalised audio ready for ASR.
 * 
 * CURRENT STATE: Pass-through with MIME normalisation and format detection.
 * FUTURE STATE: Full ffmpeg.wasm transcoding to FLAC 16kHz mono 16-bit
 *               with highpass=f=80 and loudnorm=I=-16:TP=-1.5:LRA=11.
 * 
 * Designed for internal function-to-function calls from STT edge functions.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_INPUT_BYTES = 24 * 1024 * 1024; // 24 MB hard limit
const WARN_BYTES = 20 * 1024 * 1024; // 20 MB warning threshold

/**
 * Detect audio format from magic bytes
 */
function detectFormat(bytes: Uint8Array): { mimeType: string; extension: string } {
  if (bytes.length < 12) {
    return { mimeType: 'application/octet-stream', extension: 'bin' };
  }

  // WebM: starts with 0x1A 0x45 0xDF 0xA3 (EBML header)
  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
    return { mimeType: 'audio/webm', extension: 'webm' };
  }

  // RIFF/WAV: starts with 'RIFF'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return { mimeType: 'audio/wav', extension: 'wav' };
  }

  // OGG: starts with 'OggS'
  if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return { mimeType: 'audio/ogg', extension: 'ogg' };
  }

  // FLAC: starts with 'fLaC'
  if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return { mimeType: 'audio/flac', extension: 'flac' };
  }

  // MP4/M4A: has 'ftyp' at bytes 4-7
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return { mimeType: 'audio/mp4', extension: 'm4a' };
  }

  // MP3: starts with ID3 tag or sync word (0xFF 0xFB/0xF3/0xF2)
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || // ID3
    (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) // MPEG sync
  ) {
    return { mimeType: 'audio/mpeg', extension: 'mp3' };
  }

  return { mimeType: 'application/octet-stream', extension: 'bin' };
}

/**
 * Normalise MIME type string to a clean, standard form
 */
function normaliseMimeType(raw: string): { mimeType: string; extension: string } {
  const lower = (raw || '').toLowerCase().split(';')[0].trim();

  if (lower.includes('webm')) return { mimeType: 'audio/webm', extension: 'webm' };
  if (lower.includes('flac')) return { mimeType: 'audio/flac', extension: 'flac' };
  if (lower.includes('wav')) return { mimeType: 'audio/wav', extension: 'wav' };
  if (lower.includes('ogg')) return { mimeType: 'audio/ogg', extension: 'ogg' };
  if (lower.includes('m4a')) return { mimeType: 'audio/m4a', extension: 'm4a' };
  if (lower.includes('aac')) return { mimeType: 'audio/aac', extension: 'aac' };
  if (lower.includes('mp4')) return { mimeType: 'audio/mp4', extension: 'm4a' };
  if (lower.includes('mp3') || lower.includes('mpeg')) return { mimeType: 'audio/mpeg', extension: 'mp3' };

  return { mimeType: lower || 'application/octet-stream', extension: 'bin' };
}

serve(async (req: Request) => {
  const requestId = crypto.randomUUID().slice(0, 8);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log(`🔄 [${requestId}] transcode-audio: request received`);

    // Accept FormData (field: 'file') or raw binary body
    let audioBytes: Uint8Array;
    let declaredMime = '';

    const ct = req.headers.get('content-type') || '';

    if (ct.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | Blob | null;
      if (!file) {
        return new Response(JSON.stringify({ error: 'No file field in FormData' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      audioBytes = new Uint8Array(await file.arrayBuffer());
      declaredMime = (file as File).type || '';
    } else {
      // Raw binary body
      audioBytes = new Uint8Array(await req.arrayBuffer());
      declaredMime = ct.split(';')[0].trim();
    }

    // File size checks
    if (audioBytes.length === 0) {
      return new Response(JSON.stringify({ error: 'Empty audio data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (audioBytes.length > MAX_INPUT_BYTES) {
      console.error(`❌ [${requestId}] Audio exceeds 24MB limit: ${(audioBytes.length / 1024 / 1024).toFixed(2)}MB`);
      return new Response(JSON.stringify({
        error: 'Audio file too large',
        size: audioBytes.length,
        maxSize: MAX_INPUT_BYTES,
      }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (audioBytes.length > WARN_BYTES) {
      console.warn(`⚠️ [${requestId}] Large audio file: ${(audioBytes.length / 1024 / 1024).toFixed(2)}MB`);
    }

    // Detect format from magic bytes (more reliable than declared MIME)
    const detected = detectFormat(audioBytes);
    const declared = normaliseMimeType(declaredMime);

    // Prefer magic-byte detection; fall back to declared MIME
    const finalMime = detected.mimeType !== 'application/octet-stream'
      ? detected.mimeType
      : declared.mimeType;
    const finalExt = detected.extension !== 'bin'
      ? detected.extension
      : declared.extension;

    console.log(`📊 [${requestId}] Audio: ${(audioBytes.length / 1024).toFixed(1)}KB, declared=${declaredMime}, detected=${detected.mimeType}, using=${finalMime}`);

    // ──────────────────────────────────────────────────────────────────────
    // FUTURE: ffmpeg.wasm transcoding to FLAC 16kHz mono 16-bit
    //
    // When ffmpeg.wasm is available in Deno edge functions:
    //
    //   const ffmpeg = createFFmpeg({ log: false });
    //   await ffmpeg.load();
    //   ffmpeg.FS('writeFile', `input.${finalExt}`, audioBytes);
    //   await ffmpeg.run(
    //     '-i', `input.${finalExt}`,
    //     '-af', 'highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11',
    //     '-ar', '16000', '-ac', '1',
    //     '-c:a', 'flac', '-sample_fmt', 's16',
    //     'output.flac'
    //   );
    //   audioBytes = ffmpeg.FS('readFile', 'output.flac');
    //   finalMime = 'audio/flac';
    //   finalExt = 'flac';
    //
    // Until then, this function normalises MIME types and passes through.
    // The ASR providers (OpenAI, Deepgram, AssemblyAI) accept WebM, M4A,
    // WAV, etc. natively, so pass-through is functional.
    // ──────────────────────────────────────────────────────────────────────

    const transcoded = false; // Will be true when ffmpeg.wasm is active

    console.log(`✅ [${requestId}] Returning audio: ${finalMime} (${finalExt}), ${(audioBytes.length / 1024).toFixed(1)}KB, transcoded=${transcoded}`);

    // Return binary audio with metadata headers
    return new Response(audioBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': finalMime,
        'X-Audio-Extension': finalExt,
        'X-Audio-Transcoded': String(transcoded),
        'X-Audio-Original-Size': String(audioBytes.length),
        'X-Audio-Format-Detected': detected.mimeType,
        'X-Audio-Format-Declared': declaredMime,
      },
    });
  } catch (err) {
    console.error(`❌ [${requestId}] transcode-audio error:`, err);
    return new Response(JSON.stringify({
      error: 'Transcoding failed',
      message: String(err?.message || err),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
