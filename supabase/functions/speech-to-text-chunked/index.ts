import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPENAI_URL = "https://api.openai.com/v1/audio/transcriptions";
const MODEL = "whisper-1";
const MAX_BYTES = 1_000_000; // ~1MB max chunk size

function sleep(ms: number) { 
  return new Promise(r => setTimeout(r, ms)); 
}

console.log("🎙️ Speech-to-Text-Chunked Edge Function starting...");

serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`✅ WHISPER EDGE: Handling CORS preflight`);
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`📨 WHISPER EDGE: ${req.method} request received`);

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get OpenAI API key
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      console.error(`❌ [${requestId}] OpenAI API key not found`);
      return new Response(JSON.stringify({ error: "missing-openai-key" }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🔑 [${requestId}] OpenAI API key found: ${openAiApiKey.slice(0, 10)}...`);

    // Parse form data - fresh FormData every request
    const formData = await req.formData();
    const blob = formData.get('file') as Blob | null;
    const chunkIndex = Number(formData.get('chunkIndex') ?? 0);
    const isFinal = formData.get('isFinal') === 'true';
    const language = formData.get('language') as string | null;
    const prompt = formData.get('prompt') as string | null; // Previous transcript tail for continuity
    const meetingId = formData.get('meetingId') as string;
    const sessionId = formData.get('sessionId') as string;

    // Detect MIME type from blob
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
        // Final empty chunk - return success with empty result
        console.log(`🏁 [${requestId}] Final empty chunk received - session complete`);
        return new Response(JSON.stringify({
          data: {
            text: '',
            segments: []
          },
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

    console.log(`📡 [${requestId}] Sending to OpenAI Whisper API...`, {
      audioSize: blob.size,
      mimeType: incomingMimeType,
      chunkIndex,
      isFinal,
    });

    // Determine correct file extension based on MIME type
    // This is CRITICAL for iOS which uses audio/mp4
    let fileExtension = 'webm';
    if (incomingMimeType.includes('mp4') || incomingMimeType.includes('m4a') || incomingMimeType.includes('aac')) {
      fileExtension = 'm4a';
    } else if (incomingMimeType.includes('ogg')) {
      fileExtension = 'ogg';
    } else if (incomingMimeType.includes('wav')) {
      fileExtension = 'wav';
    }

    // Build a NEW FormData payload for OpenAI every time - prevents reuse issues
    const fd = new FormData();
    // Use the CORRECT MIME type and extension for the incoming audio
    fd.append("file", new File([blob], `chunk_${chunkIndex}.${fileExtension}`, { type: incomingMimeType }));
    fd.append("model", MODEL);
    fd.append("response_format", "verbose_json");
    // Anti-hallucination parameters
    fd.append("temperature", "0");
    fd.append("no_speech_threshold", "0.6"); 
    fd.append("condition_on_previous_text", "false");
    // Use prompt if provided (for continuity between chunks), otherwise empty
    fd.append("prompt", prompt || "");
    if (language) fd.append("language", language);

    // Idempotency for safe retries
    const idem = crypto.randomUUID();

    // Retry logic for 429/5xx from OpenAI with backoff
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

      const text = await res.text(); // loggable payload
      console.log(`📥 [${requestId}] OpenAI API response status: ${res.status} (attempt ${attempt + 1})`);

      if (res.ok) {
        const result = JSON.parse(text);
        console.log(`✅ [${requestId}] OpenAI transcription result:`, {
          textLength: result.text?.length || 0,
          text: result.text?.slice(0, 100) + (result.text?.length > 100 ? '...' : ''),
        });

        // Calculate real confidence from segments
        let confidence = 0.5; // Default fallback
        let audioQualityWarning: string | null = null;
        let avgNoSpeech = 0;
        
        if (result.segments && result.segments.length > 0) {
          const avgLogProb = result.segments.reduce((sum: number, seg: any) => 
            sum + (seg.avg_logprob || -2), 0) / result.segments.length;
          avgNoSpeech = result.segments.reduce((sum: number, seg: any) => 
            sum + (seg.no_speech_prob || 0.5), 0) / result.segments.length;
          
          // Convert log probability and no-speech probability to confidence score
          confidence = Math.max(0, Math.min(1, 
            (avgLogProb + 1) / 1 * (1 - avgNoSpeech)
          ));
          
          // Early audio quality detection - warn if mostly silence/music
          if (avgNoSpeech > 0.8) {
            audioQualityWarning = 'Audio contains insufficient speech for reliable transcription';
            console.log(`⚠️ [${requestId}] High no-speech probability: ${(avgNoSpeech * 100).toFixed(1)}%`);
          } else if (avgNoSpeech > 0.6 && confidence < 0.3) {
            audioQualityWarning = 'Audio quality may be too low for reliable transcription';
            console.log(`⚠️ [${requestId}] Low confidence with high no-speech: conf=${(confidence * 100).toFixed(1)}%, noSpeech=${(avgNoSpeech * 100).toFixed(1)}%`);
          }
        }

        // Return the transcription result with segments for timestamp-based deduplication
        const response = {
          data: {
            text: result.text || '',
            segments: result.segments || []
          },
          confidence: confidence, // Real confidence from Whisper segments
          audioQuality: audioQualityWarning ? 'poor' : (confidence >= 0.6 ? 'good' : 'acceptable'),
          audioQualityWarning: audioQualityWarning,
          noSpeechProbability: avgNoSpeech,
          chunkIndex,
          isFinal,
          sessionId,
          meetingId,
          timestamp: new Date().toISOString(),
        };

        console.log(`📤 [${requestId}] Sending response:`, {
          textLength: response.data.text.length,
          segmentsCount: response.data.segments.length,
          chunkIndex: response.chunkIndex,
          isFinal: response.isFinal,
        });

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Bubble up OpenAI's error body so the client can see it
      // If rate limited or transient, retry with backoff+jitter
      if (res.status === 429 || res.status >= 500) {
        lastErr = { status: res.status, body: text };
        console.warn(`⚠️ [${requestId}] Retryable error ${res.status}, attempt ${attempt + 1}/3`);
        await sleep(200 * (2 ** attempt) + Math.random() * 200);
        continue;
      }

      // Non-retryable (e.g., 400 invalid file)
      console.error(`❌ [${requestId}] Non-retryable OpenAI error:`, res.status, text);
      return new Response(text || JSON.stringify({ error: "openai-failed" }), { 
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // After retries failed
    console.error(`❌ [${requestId}] All retries failed:`, lastErr);
    return new Response(JSON.stringify({ 
      error: "openai-retry-failed", 
      detail: lastErr 
    }), { 
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    // Always return JSON with details; no generic 500 with empty body
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