import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  
  if (req.method === 'OPTIONS') {
    console.log(`🔄 [${requestId}] CORS preflight check received`);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const origin = req.headers.get('origin');
    const ct = req.headers.get('content-type') || '';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    console.log(`🎙️ [${requestId}] Speech-to-text request received`, {
      method: req.method,
      contentType: ct,
      hasBody: req.body !== null,
      origin: origin,
      userAgent: userAgent.substring(0, 100), // First 100 chars
      timestamp: new Date().toISOString()
    });

    // ---- 1) accept either raw binary or multipart (fallback) ----
    let blob: Blob | null = null;

    if (ct.startsWith('application/octet-stream')) {
      console.log(`📤 [${requestId}] Processing binary audio data...`);
      const ab = await req.arrayBuffer(); // <-- binary path
      blob = new Blob([ab], { type: 'audio/webm' });
      console.log(`✅ [${requestId}] Binary audio processed:`, {
        sizeBytes: ab.byteLength,
        sizeKB: Math.round(ab.byteLength / 1024),
        timestamp: new Date().toISOString()
      });
    } else if (ct.startsWith('multipart/form-data')) {
      console.log('📤 Processing multipart form data...');
      const form = await req.formData();
      const f = form.get('file');
      if (!(f instanceof Blob)) {
        return new Response(JSON.stringify({ error: 'file field missing' }), { status: 400, headers: corsHeaders });
      }
      blob = f;
      console.log('✅ Multipart audio processed:', {
        sizeBytes: f.size,
        sizeKB: Math.round(f.size / 1024)
      });
    } else if (ct.startsWith('application/json')) {
      console.log('📤 Processing legacy base64 JSON...');
      // legacy base64 JSON
      const { audio, audioBase64, mimeType } = await req.json();
      const audioData = audio || audioBase64;
      if (!audioData) {
        return new Response(JSON.stringify({ error: 'audio data missing' }), { status: 400, headers: corsHeaders });
      }
      const bin = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
      blob = new Blob([bin], { type: mimeType || 'audio/webm' });
      console.log('✅ Base64 audio processed:', {
        originalLength: audioData.length,
        sizeBytes: bin.length,
        sizeKB: Math.round(bin.length / 1024)
      });
    } else {
      return new Response(JSON.stringify({ error: `Unsupported content-type: ${ct}` }), { status: 415, headers: corsHeaders });
    }

    // ---- 2) size guard ----
    if ((blob?.size ?? 0) > 8_000_000) {
      return new Response(JSON.stringify({ error: 'Chunk too large (max 8MB)' }), { status: 413, headers: corsHeaders });
    }

    if ((blob?.size ?? 0) < 1000) {
      console.log('⚠️ Very small audio chunk, skipping:', blob?.size);
      return new Response(JSON.stringify({ text: '' }), {
        headers: { 'content-type': 'application/json', ...corsHeaders },
      });
    }

    // ---- 3) forward to OpenAI Whisper ----
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    console.log(`🔑 [${requestId}] OpenAI API key status:`, {
      hasKey: !!OPENAI_API_KEY,
      keyLength: OPENAI_API_KEY ? OPENAI_API_KEY.length : 0,
      keyPrefix: OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 7) + '...' : 'none'
    });
    
    if (!OPENAI_API_KEY) {
      console.error(`❌ [${requestId}] OPENAI_API_KEY not set in environment variables`);
      throw new Error('OPENAI_API_KEY not set');
    }

    const form = new FormData();
    form.append('file', blob!, 'chunk.webm');
    form.append('model', 'whisper-1');
    form.append('language', 'en');
    form.append('temperature', '0');
    form.append('prompt', 'NHS, PCN, DES, ARRS, QOF, EMIS, SystmOne, locum, CQC, practice, patient, consultation, medication, prescription, referral, appointment');

    console.log(`📡 [${requestId}] Sending to OpenAI Whisper API...`, {
      model: 'whisper-1',
      audioSize: blob!.size,
      timestamp: new Date().toISOString()
    });

    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });

    console.log(`📥 [${requestId}] OpenAI API response received:`, {
      status: r.status,
      statusText: r.statusText,
      ok: r.ok,
      headers: Object.fromEntries(r.headers.entries()),
      timestamp: new Date().toISOString()
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error(`❌ [${requestId}] OpenAI API error:`, {
        status: r.status,
        statusText: r.statusText,
        detail: detail,
        timestamp: new Date().toISOString()
      });
      return new Response(JSON.stringify({ error: 'Upstream STT failed', status: r.status, detail }), {
        status: 502,
        headers: { 'content-type': 'application/json', ...corsHeaders },
      });
    }

    const data = await r.json();
    console.log(`✅ [${requestId}] Transcription successful:`, {
      hasText: !!data.text,
      textLength: data.text ? data.text.length : 0,
      text: data.text || 'No text returned',
      fullResponse: data,
      timestamp: new Date().toISOString()
    });

    return new Response(JSON.stringify({ text: data.text ?? '' }), {
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });

  } catch (e) {
    console.error(`❌ [DIAGNOSTIC] Function error:`, {
      error: e,
      message: e instanceof Error ? e.message : 'Unknown error',
      stack: e instanceof Error ? e.stack : 'No stack trace',
      timestamp: new Date().toISOString()
    });
    return new Response(JSON.stringify({ error: 'Function crash', detail: String(e) }), {
      status: 500,
      headers: { 'content-type': 'application/json', ...corsHeaders },
    });
  }
});