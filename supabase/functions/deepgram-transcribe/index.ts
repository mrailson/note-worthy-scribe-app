import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Detect MIME type from the first bytes of a binary buffer.
 * Falls back to audio/webm if unrecognised.
 */
function detectMimeType(buf: Uint8Array): string {
  // RIFF....WAVE → audio/wav
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45) {
    return 'audio/wav';
  }
  // fLaC → audio/flac
  if (buf[0] === 0x66 && buf[1] === 0x4C && buf[2] === 0x61 && buf[3] === 0x43) {
    return 'audio/flac';
  }
  // OggS → audio/ogg
  if (buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
    return 'audio/ogg';
  }
  // 1A 45 DF A3 → WebM/Matroska (EBML header)
  if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) {
    return 'audio/webm';
  }
  // MP3: ID3 tag or MPEG sync word
  if ((buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) ||
      (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0)) {
    return 'audio/mpeg';
  }
  // MP4/M4A: ftyp box
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    return 'audio/mp4';
  }
  return 'audio/webm'; // default fallback
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🎤 Deepgram transcription request received');
    
    const { audio, meetingId, sessionId, chunkNumber, mimeType } = await req.json();
    
    console.log(`📦 Request details: meetingId=${meetingId}, sessionId=${sessionId}, chunk=${chunkNumber}, audioBase64Length=${audio?.length || 0}`);
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
    if (!DEEPGRAM_API_KEY) {
      console.error('❌ DEEPGRAM_API_KEY not configured');
      throw new Error('DEEPGRAM_API_KEY not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('❌ Authentication failed:', userError);
      throw new Error('Authentication failed');
    }

    console.log(`✅ User authenticated: ${user.id}`);

    // Convert base64 to binary
    const binaryAudio = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    const fileSizeKB = (binaryAudio.length / 1024).toFixed(1);
    
    // Detect actual content type from magic bytes
    const detectedMime = detectMimeType(binaryAudio);
    const contentType = (typeof mimeType === 'string' && mimeType.trim()) ? mimeType : detectedMime;
    
    console.log(`📦 Audio binary: ${fileSizeKB}KB, detected=${detectedMime}, using=${contentType}`);

    // Build Deepgram URL with parameters
    const dgParams = new URLSearchParams({
      model: 'nova-3',
      smart_format: 'true',
      punctuate: 'true',
      diarize: 'true',
      language: 'en-GB',
    });
    const dgUrl = `https://api.deepgram.com/v1/listen?${dgParams.toString()}`;

    // Use AbortController for a 120-second timeout to prevent silent truncation
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    console.log(`🌐 Sending ${fileSizeKB}KB to Deepgram API (timeout: 120s)...`);
    const startMs = Date.now();

    let deepgramResponse: Response;
    try {
      deepgramResponse = await fetch(dgUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': contentType,
        },
        body: binaryAudio,
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        console.error(`❌ Deepgram API timed out after 120s for chunk ${chunkNumber} (${fileSizeKB}KB)`);
        throw new Error(`Deepgram API timeout: chunk ${chunkNumber} (${fileSizeKB}KB) exceeded 120s`);
      }
      throw fetchErr;
    }
    clearTimeout(timeoutId);

    const elapsedMs = Date.now() - startMs;
    console.log(`📡 Deepgram response: status=${deepgramResponse.status}, took=${elapsedMs}ms`);

    if (!deepgramResponse.ok) {
      const errorText = await deepgramResponse.text();
      console.error(`❌ Deepgram API error: ${deepgramResponse.status} - ${errorText}`);
      throw new Error(`Deepgram API error: ${deepgramResponse.status} - ${errorText}`);
    }

    const deepgramResult = await deepgramResponse.json();

    // === DIAGNOSTIC LOGGING ===
    const dgMeta = deepgramResult.metadata;
    const dgDuration = dgMeta?.duration || 0;
    const dgChannels = dgMeta?.channels || 0;
    const dgModelInfo = dgMeta?.model_info ? JSON.stringify(dgMeta.model_info) : 'n/a';
    const dgRequestId = dgMeta?.request_id || 'n/a';
    const dgWarnings = deepgramResult.metadata?.warnings || deepgramResult.warnings;

    console.log(`📊 DEEPGRAM DIAGNOSTICS: request_id=${dgRequestId}`);
    console.log(`📊   Duration reported: ${dgDuration.toFixed(2)}s`);
    console.log(`📊   Channels: ${dgChannels}`);
    console.log(`📊   Model: ${dgModelInfo}`);
    console.log(`📊   API latency: ${elapsedMs}ms`);
    console.log(`📊   File size: ${fileSizeKB}KB, content-type: ${contentType}`);

    if (dgWarnings) {
      console.warn(`⚠️ Deepgram warnings: ${JSON.stringify(dgWarnings)}`);
    }

    // Extract transcript and confidence
    const alt = deepgramResult.results?.channels?.[0]?.alternatives?.[0];
    const rawTranscript = alt?.transcript || '';
    const confidence = alt?.confidence || 0;
    const words = alt?.words || [];

    console.log(`📊   Raw transcript length: ${rawTranscript.length} chars, word count: ${words.length}`);

    // Warn if word count seems suspiciously low relative to duration
    if (dgDuration > 60 && words.length < dgDuration * 0.5) {
      console.warn(`⚠️ POSSIBLE TRUNCATION: ${words.length} words for ${dgDuration.toFixed(0)}s of audio (~${(words.length / dgDuration * 60).toFixed(0)} words/min — expected 100-180)`);
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
      console.log(`[Deepgram] Built speaker-labelled transcript with ${segments.length} segments`);
    }

    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
    console.log(`✅ Deepgram chunk ${chunkNumber}: ${wordCount} words, confidence=${confidence.toFixed(3)}, duration=${dgDuration.toFixed(1)}s`);

    // Save to database
    const { error: dbError } = await supabase
      .from('deepgram_transcriptions')
      .insert({
        meeting_id: meetingId,
        user_id: user.id,
        session_id: sessionId,
        chunk_number: chunkNumber,
        transcription_text: transcript,
        confidence: confidence,
        is_final: true,
        word_count: wordCount
      });

    if (dbError) {
      console.error('❌ Database save error:', dbError);
      throw dbError;
    }

    console.log(`💾 Saved Deepgram chunk ${chunkNumber} to database`);

    return new Response(
      JSON.stringify({
        text: transcript,
        confidence,
        words,
        duration: dgDuration,
        diagnostics: {
          duration_s: dgDuration,
          word_count: wordCount,
          file_size_kb: parseFloat(fileSizeKB),
          content_type: contentType,
          api_latency_ms: elapsedMs,
          request_id: dgRequestId,
          warnings: dgWarnings || null,
        },
        success: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Deepgram transcription error:', error);
    console.error('❌ Error stack:', error.stack);
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
