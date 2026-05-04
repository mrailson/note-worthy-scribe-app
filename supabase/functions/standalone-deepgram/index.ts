import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Detect MIME type from the first bytes of a binary buffer.
 */
function detectMimeType(buf: Uint8Array): string {
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45) {
    return 'audio/wav';
  }
  if (buf[0] === 0x66 && buf[1] === 0x4C && buf[2] === 0x61 && buf[3] === 0x43) {
    return 'audio/flac';
  }
  if (buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
    return 'audio/ogg';
  }
  if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) {
    return 'audio/webm';
  }
  if ((buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) ||
      (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0)) {
    return 'audio/mpeg';
  }
  if (buf.length > 7 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    return 'audio/mp4';
  }
  return 'audio/webm';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ---- AUTH GUARD ----
    const __authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!__authHeader || !__authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    {
      const __token = __authHeader.replace("Bearer ", "");
      const __serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      // Allow service-role calls (e.g. mobile offline path via transcribe-offline-meeting)
      if (__serviceKey && __token === __serviceKey) {
        // trusted internal caller — skip user JWT validation
      } else {
        const __supaUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const __supaAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
        const __vr = await fetch(`${__supaUrl}/auth/v1/user`, {
          headers: { Authorization: `Bearer ${__token}`, apikey: __supaAnon },
        });
        if (!__vr.ok) {
          return new Response(JSON.stringify({ error: "Invalid token" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }
    // ---- /AUTH GUARD ----

    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
    if (!deepgramApiKey) {
      throw new Error('Deepgram API key not configured');
    }

    const { audio, mimeType, storagePath, bucket } = await req.json();

    if (!audio && !storagePath) {
      throw new Error('No audio data or storagePath provided');
    }

    // Build Deepgram URL
    const dgParams = new URLSearchParams({
      model: 'nova-3',
      language: 'en-GB',
      smart_format: 'true',
      diarize: 'true',
      punctuate: 'true',
    });
    const dgUrl = `https://api.deepgram.com/v1/listen?${dgParams.toString()}`;

    // ============ URL-based path (mobile offline / large files) ============
    let response: Response;
    let fileSizeKB = '0';
    let contentType = 'application/json';
    let usedUrlPath = false;
    const startMs = Date.now();

    if (storagePath) {
      usedUrlPath = true;
      const supaUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const targetBucket = (typeof bucket === 'string' && bucket.trim()) ? bucket : 'meeting-audio';

      const makeSignedUrl = async (): Promise<string> => {
        const r = await fetch(
          `${supaUrl}/storage/v1/object/sign/${targetBucket}/${storagePath}`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ expiresIn: 3600 }),
          }
        );
        if (!r.ok) throw new Error(`Signed URL failed ${r.status}: ${await r.text()}`);
        const j = await r.json();
        return `${supaUrl}/storage/v1${j.signedURL || j.signedUrl}`;
      };

      const callDeepgramWithUrl = async (audioUrl: string) => {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 120_000);
        try {
          return await fetch(dgUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Token ${deepgramApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: audioUrl }),
            signal: ctrl.signal,
          });
        } finally {
          clearTimeout(tid);
        }
      };

      console.log(`[Standalone-Deepgram] URL-mode: storagePath=${storagePath}, bucket=${targetBucket}`);

      try {
        const signedUrl1 = await makeSignedUrl();
        response = await callDeepgramWithUrl(signedUrl1);
        if (!response.ok && (response.status >= 500 || response.status === 408 || response.status === 403)) {
          // Retry once with a fresh signed URL (in case URL expired silently)
          const errBody = await response.text().catch(() => '');
          console.warn(`[Standalone-Deepgram] First attempt ${response.status}: ${errBody.slice(0, 200)} — retrying with fresh signed URL`);
          const signedUrl2 = await makeSignedUrl();
          response = await callDeepgramWithUrl(signedUrl2);
        }
      } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') {
          console.warn(`[Standalone-Deepgram] First attempt timed out — retrying once with fresh signed URL`);
          try {
            const signedUrl2 = await makeSignedUrl();
            response = await callDeepgramWithUrl(signedUrl2);
          } catch (retryErr: any) {
            if (retryErr.name === 'AbortError') {
              throw new Error('Deepgram API timeout (URL mode) exceeded 120s on both attempts');
            }
            throw retryErr;
          }
        } else {
          throw fetchErr;
        }
      }
    } else {
      // ============ Legacy base64 path (live web recordings, GP Scribe) ============
      const binaryAudio = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
      fileSizeKB = (binaryAudio.length / 1024).toFixed(1);
      const detectedMime = detectMimeType(binaryAudio);
      contentType = (typeof mimeType === 'string' && mimeType.trim()) ? mimeType : detectedMime;

      console.log(`[Standalone-Deepgram] Audio: ${fileSizeKB}KB, detected=${detectedMime}, using=${contentType}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120_000);

      try {
        response = await fetch(dgUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${deepgramApiKey}`,
            'Content-Type': contentType,
          },
          body: binaryAudio,
          signal: controller.signal,
        });
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          console.error(`❌ Deepgram API timed out after 120s (${fileSizeKB}KB)`);
          throw new Error(`Deepgram API timeout (${fileSizeKB}KB) exceeded 120s`);
        }
        throw fetchErr;
      }
      clearTimeout(timeoutId);
    }

    const elapsedMs = Date.now() - startMs;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Deepgram API error: ${response.status} - ${errorText}`);
      throw new Error(`Deepgram API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    // === DIAGNOSTIC LOGGING ===
    const dgMeta = result.metadata;
    const dgDuration = dgMeta?.duration || 0;
    const dgRequestId = dgMeta?.request_id || 'n/a';
    const dgWarnings = result.metadata?.warnings || result.warnings;

    console.log(`📊 DEEPGRAM DIAGNOSTICS: request_id=${dgRequestId}, duration=${dgDuration.toFixed(2)}s, latency=${elapsedMs}ms, size=${fileSizeKB}KB, content-type=${contentType}`);

    if (dgWarnings) {
      console.warn(`⚠️ Deepgram warnings: ${JSON.stringify(dgWarnings)}`);
    }

    const alt = result?.results?.channels?.[0]?.alternatives?.[0];
    const rawTranscript = alt?.transcript || '';
    const confidence = typeof alt?.confidence === 'number' ? alt.confidence : 0;
    const words = alt?.words || [];

    console.log(`📊 Raw transcript: ${rawTranscript.length} chars, ${words.length} words`);

    // Warn on suspiciously low word count
    if (dgDuration > 60 && words.length < dgDuration * 0.5) {
      console.warn(`⚠️ POSSIBLE TRUNCATION: ${words.length} words for ${dgDuration.toFixed(0)}s (~${(words.length / dgDuration * 60).toFixed(0)} wpm — expected 100-180)`);
    }

    // Build speaker-labelled transcript from word-level speaker data
    let transcript = rawTranscript;
    if (words.length > 0 && words.some((w: any) => w.speaker !== undefined)) {
      const segments: string[] = [];
      let currentSpeaker = -1;
      let currentWords: string[] = [];
      
      for (const w of words) {
        const speaker = w.speaker ?? 0;
        if (speaker !== currentSpeaker) {
          if (currentWords.length > 0) {
            segments.push(`[Speaker ${currentSpeaker + 1}]: ${currentWords.join(' ')}`);
          }
          currentSpeaker = speaker;
          currentWords = [w.punctuated_word || w.word];
        } else {
          currentWords.push(w.punctuated_word || w.word);
        }
      }
      if (currentWords.length > 0) {
        segments.push(`[Speaker ${currentSpeaker + 1}]: ${currentWords.join(' ')}`);
      }
      transcript = segments.join('\n');
      console.log(`[Standalone-Deepgram] Built speaker-labelled transcript with ${segments.length} segments`);
    }

    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
    console.log(`✅ Standalone-Deepgram: ${wordCount} words, confidence=${confidence.toFixed(3)}, duration=${dgDuration.toFixed(1)}s`);

    return new Response(
      JSON.stringify({ 
        text: transcript,
        service: 'deepgram',
        confidence,
        diagnostics: {
          duration_s: dgDuration,
          word_count: wordCount,
          file_size_kb: parseFloat(fileSizeKB),
          content_type: contentType,
          api_latency_ms: elapsedMs,
          request_id: dgRequestId,
          warnings: dgWarnings || null,
        },
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Standalone Deepgram transcription error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        service: 'deepgram'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
