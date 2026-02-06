import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPENAI_URL = "https://api.openai.com/v1/audio/transcriptions";
const MODEL = "whisper-1";
const MAX_BYTES = 4_000_000; // ~4MB max chunk size (90s chunks)

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
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
 * Always enabled — strips non-audio streams (-sn -dn) before Whisper.
 * Falls back to direct forward on error/timeout.
 */
async function preprocessAudioViaTranscode(
  audioBytes: Uint8Array,
  declaredMime: string,
  requestId: string
): Promise<{ bytes: Uint8Array; mimeType: string; extension: string; preprocessed: boolean }> {

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

console.log("🎙️ Speech-to-Text-Chunked Edge Function starting…");

serve(async (req) => {
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
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      console.error(`❌ [${requestId}] OpenAI API key not found`);
      return new Response(JSON.stringify({ error: "missing-openai-key" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔑 [${requestId}] OpenAI API key found: ${openAiApiKey.slice(0, 10)}…`);

    const formData = await req.formData();
    const blob = formData.get('file') as Blob | null;
    const chunkIndex = Number(formData.get('chunkIndex') ?? 0);
    const isFinal = formData.get('isFinal') === 'true';
    const language = formData.get('language') as string | null;
    const prompt = formData.get('prompt') as string | null;
    const meetingId = formData.get('meetingId') as string;
    const sessionId = formData.get('sessionId') as string;

    const incomingMimeType = blob?.type || 'audio/webm';

    console.log(`📋 [${requestId}] Form data parsed:`, {
      hasAudioFile: !!blob,
      fileSize: blob?.size,
      fileType: incomingMimeType,
      chunkIndex,
      isFinal,
      hasPrompt: !!prompt,
      meetingId,
      sessionId,
    });

    if (!blob || typeof blob.stream !== "function") {
      if (isFinal) {
        console.log(`🏁 [${requestId}] Final empty chunk received – session complete`);
        return new Response(JSON.stringify({
          data: { text: '', segments: [] },
          isFinal: true,
          chunkIndex,
          message: 'Session completed'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: "no-file" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (blob.size > MAX_BYTES) {
      return new Response(JSON.stringify({
        error: "chunk-too-large",
        size: blob.size,
        maxSize: MAX_BYTES
      }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Preprocess through transcode-audio ──
    const rawBytes = new Uint8Array(await blob.arrayBuffer());
    const preprocessed = await preprocessAudioViaTranscode(rawBytes, incomingMimeType, requestId);

    // Determine file extension for OpenAI
    let fileExtension: string;
    if (preprocessed.preprocessed) {
      fileExtension = preprocessed.extension;
    } else {
      // Fallback: local MIME-based extension detection
      fileExtension = 'webm';
      if (incomingMimeType.includes('flac')) fileExtension = 'flac';
      else if (incomingMimeType.includes('mp4') || incomingMimeType.includes('m4a') || incomingMimeType.includes('aac')) fileExtension = 'm4a';
      else if (incomingMimeType.includes('ogg')) fileExtension = 'ogg';
      else if (incomingMimeType.includes('wav')) fileExtension = 'wav';
    }

    const forwardMime = preprocessed.preprocessed ? preprocessed.mimeType : incomingMimeType;

    console.log(`📡 [${requestId}] Forwarding to OpenAI: ${preprocessed.bytes.length}B as ${forwardMime} (.${fileExtension}), preprocessed=${preprocessed.preprocessed}`);

    // Build a NEW FormData payload for OpenAI
    const fd = new FormData();
    fd.append("file", new File([preprocessed.bytes], `chunk_${chunkIndex}.${fileExtension}`, { type: forwardMime }));
    fd.append("model", MODEL);
    fd.append("response_format", "verbose_json");
    // Whisper decode settings (Option A – 90s chunks)
    fd.append("temperature", "0");                         // Reduces creative drift
    fd.append("condition_on_previous_text", "true");       // Continuity within chunk
    fd.append("no_speech_threshold", "0.6");               // Hallucination silence gate
    // Extended decode params (used by self-hosted Whisper; ignored by OpenAI API)
    fd.append("beam_size", "5");
    fd.append("no_repeat_ngram_size", "3");                // Stops local looping
    fd.append("compression_ratio_threshold", "2.4");       // Catches runaway repetition
    fd.append("logprob_threshold", "-1.0");
    fd.append("hallucination_silence_threshold", "0.6");   // Avoids filler hallucinations
    fd.append("prompt", prompt || "");
    if (language) fd.append("language", language);

    const idem = crypto.randomUUID();

    // Retry logic for 429/5xx
    let lastErr: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openAiApiKey}`,
          "Idempotency-Key": idem,
        },
        body: fd,
      });

      const text = await res.text();
      console.log(`📥 [${requestId}] OpenAI response status: ${res.status} (attempt ${attempt + 1})`);

      if (res.ok) {
        const result = JSON.parse(text);
        console.log(`✅ [${requestId}] Transcription result: ${result.text?.length || 0} chars`);

        let confidence = 0.5;
        let audioQualityWarning: string | null = null;
        let avgNoSpeech = 0;

        if (result.segments && result.segments.length > 0) {
          const avgLogProb = result.segments.reduce((sum: number, seg: any) =>
            sum + (seg.avg_logprob || -2), 0) / result.segments.length;
          avgNoSpeech = result.segments.reduce((sum: number, seg: any) =>
            sum + (seg.no_speech_prob || 0.5), 0) / result.segments.length;

          confidence = Math.max(0, Math.min(1,
            (avgLogProb + 1) / 1 * (1 - avgNoSpeech)
          ));

          if (avgNoSpeech > 0.8) {
            audioQualityWarning = 'Audio contains insufficient speech for reliable transcription';
          } else if (avgNoSpeech > 0.6 && confidence < 0.3) {
            audioQualityWarning = 'Audio quality may be too low for reliable transcription';
          }
        }

        const response = {
          data: {
            text: result.text || '',
            segments: result.segments || []
          },
          confidence,
          audioQuality: audioQualityWarning ? 'poor' : (confidence >= 0.6 ? 'good' : 'acceptable'),
          audioQualityWarning,
          noSpeechProbability: avgNoSpeech,
          chunkIndex,
          isFinal,
          sessionId,
          meetingId,
          timestamp: new Date().toISOString(),
        };

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (res.status === 429 || res.status >= 500) {
        lastErr = { status: res.status, body: text };
        console.warn(`⚠️ [${requestId}] Retryable error ${res.status}, attempt ${attempt + 1}/3`);
        await sleep(200 * (2 ** attempt) + Math.random() * 200);
        continue;
      }

      console.error(`❌ [${requestId}] Non-retryable OpenAI error: ${res.status} ${text}`);
      return new Response(text || JSON.stringify({ error: "openai-failed" }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.error(`❌ [${requestId}] All retries failed:`, lastErr);
    return new Response(JSON.stringify({
      error: "openai-retry-failed",
      detail: lastErr
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error(`❌ [${requestId}] Edge function exception:`, e);
    return new Response(JSON.stringify({
      error: "edge-exception",
      message: String(e?.message || e),
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
