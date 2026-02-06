// supabase/functions/process-meeting-audio/index.ts
import "https://deno.land/x/xhr@0.1.1/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

// ── Format detection helpers ────────────────────────────────────────────────

function detectFormatFromBytes(bytes: Uint8Array): { mimeType: string; extension: string } | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) return { mimeType: 'audio/webm', extension: 'webm' };
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return { mimeType: 'audio/wav', extension: 'wav' };
  if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return { mimeType: 'audio/ogg', extension: 'ogg' };
  if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) return { mimeType: 'audio/flac', extension: 'flac' };
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return { mimeType: 'audio/mp4', extension: 'm4a' };
  if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)) return { mimeType: 'audio/mpeg', extension: 'mp3' };

  return null;
}

function normaliseMime(raw: string): { mimeType: string; extension: string } {
  const lower = (raw || '').toLowerCase().split(';')[0].trim();
  if (lower.includes('flac')) return { mimeType: 'audio/flac', extension: 'flac' };
  if (lower.includes('webm')) return { mimeType: 'audio/webm', extension: 'webm' };
  if (lower.includes('wav')) return { mimeType: 'audio/wav', extension: 'wav' };
  if (lower.includes('ogg')) return { mimeType: 'audio/ogg', extension: 'ogg' };
  if (lower.includes('m4a') || lower.includes('mp4') || lower.includes('aac')) return { mimeType: 'audio/mp4', extension: 'm4a' };
  if (lower.includes('mp3') || lower.includes('mpeg')) return { mimeType: 'audio/mpeg', extension: 'mp3' };
  return { mimeType: 'audio/webm', extension: 'webm' };
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    console.log(`🚀 [${requestId}] Process-meeting-audio function called`);

    const key = (Deno.env.get("OPENAI_API_KEY") || "").trim();
    const model = (Deno.env.get("OPENAI_STT_MODEL") || "whisper-1").trim();

    console.log(`🔑 [${requestId}] API Key: ${key ? "Present" : "Missing"}, Model: ${model}`);

    if (!key) {
      return j(500, { success: false, error: "OPENAI_API_KEY missing in Function secrets" });
    }

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return j(400, { success: false, error: "Content-Type must be multipart/form-data" });
    }

    let inForm: FormData;
    try {
      inForm = await req.formData();
    } catch (e) {
      console.error(`❌ [${requestId}] Failed to parse form data:`, e);
      return j(400, { success: false, error: "Failed to parse formData()", detail: String(e) });
    }

    let file = (inForm.get("file") || inForm.get("audio")) as File | null;
    if (!file) {
      console.error(`❌ [${requestId}] No audio file found, keys: ${Array.from(inForm.keys())}`);
      return j(400, { success: false, error: "No audio file provided (expected 'file' or 'audio')" });
    }

    console.log(`🎵 [${requestId}] Audio: name=${file.name}, type=${file.type}, size=${file.size}`);

    const bytes = new Uint8Array(await file.arrayBuffer());

    if (bytes.length === 0) {
      return j(400, { success: false, error: "Empty audio file provided" });
    }

    console.log(`🔍 [${requestId}] First bytes: ${Array.from(bytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

    // Smart format detection: prefer magic bytes, fall back to declared MIME
    const detectedFormat = detectFormatFromBytes(bytes);
    const declaredFormat = normaliseMime(file.type);

    const localMime = detectedFormat?.mimeType || declaredFormat.mimeType;
    const localExt = detectedFormat?.extension || declaredFormat.extension;

    console.log(`🎵 [${requestId}] Format: declared=${file.type}, detected=${detectedFormat?.mimeType || 'unknown'}, local=${localMime} (.${localExt})`);

    // ── Preprocess through transcode-audio ──
    const preprocessed = await preprocessAudioViaTranscode(bytes, localMime, requestId);

    const finalMime = preprocessed.preprocessed ? preprocessed.mimeType : localMime;
    const finalExt = preprocessed.preprocessed ? preprocessed.extension : localExt;
    const fileName = `chunk.${finalExt}`;

    console.log(`📤 [${requestId}] Forwarding to OpenAI: ${preprocessed.bytes.length}B as ${finalMime} (.${finalExt}), preprocessed=${preprocessed.preprocessed}`);

    const normalized = new File([preprocessed.bytes], fileName, { type: finalMime });

    const out = new FormData();
    out.append("model", model);
    out.append("language", "en");
    out.append("temperature", "0");
    out.append("prompt", "This is a medical meeting recording with healthcare professionals discussing patient care and clinical matters.");
    out.append("file", normalized, normalized.name);

    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: out,
    });

    console.log(`📨 [${requestId}] OpenAI response status: ${resp.status}`);
    const bodyText = await resp.text();

    if (!resp.ok) {
      let errorDetails = bodyText;
      try {
        const errorObj = JSON.parse(bodyText);
        if (errorObj.error?.message) errorDetails = errorObj.error.message;
      } catch (_) { /* ignore parse failure */ }

      console.error(`❌ [${requestId}] OpenAI API error: ${resp.status} ${errorDetails}`);

      return j(resp.status, {
        success: false,
        error: `OpenAI API error (${resp.status}): ${errorDetails}`,
        openai_status: resp.status,
        openai_error: errorDetails
      });
    }

    const headers = { ...cors, "content-type": bodyText.trim().startsWith("{") ? "application/json" : "text/plain" };
    return new Response(bodyText, { status: resp.status, headers });
  } catch (err) {
    console.error(`❌ [${requestId}] Function error:`, err);
    return j(500, { success: false, error: String(err?.message || err) });
  }
});

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
}
