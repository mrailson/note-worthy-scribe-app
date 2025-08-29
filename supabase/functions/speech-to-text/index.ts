import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = (origin: string | null) => ({
  'access-control-allow-origin': origin ?? '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization',
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS(req.headers.get('origin')) });
  }

  try {
    const origin = req.headers.get('origin');
    const ct = req.headers.get('content-type') || '';

    console.log('🎙️ Speech-to-text request received', {
      method: req.method,
      contentType: ct,
      hasBody: req.body !== null
    });

    // ---- 1) accept either raw binary or multipart (fallback) ----
    let blob: Blob | null = null;

    if (ct.startsWith('application/octet-stream')) {
      console.log('📤 Processing binary audio data...');
      const ab = await req.arrayBuffer(); // <-- binary path
      blob = new Blob([ab], { type: 'audio/webm' });
      console.log('✅ Binary audio processed:', {
        sizeBytes: ab.byteLength,
        sizeKB: Math.round(ab.byteLength / 1024)
      });
    } else if (ct.startsWith('multipart/form-data')) {
      console.log('📤 Processing multipart form data...');
      const form = await req.formData();
      const f = form.get('file');
      if (!(f instanceof Blob)) {
        return new Response(JSON.stringify({ error: 'file field missing' }), { status: 400, headers: CORS(origin) });
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
        return new Response(JSON.stringify({ error: 'audio data missing' }), { status: 400, headers: CORS(origin) });
      }
      const bin = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
      blob = new Blob([bin], { type: mimeType || 'audio/webm' });
      console.log('✅ Base64 audio processed:', {
        originalLength: audioData.length,
        sizeBytes: bin.length,
        sizeKB: Math.round(bin.length / 1024)
      });
    } else {
      return new Response(JSON.stringify({ error: `Unsupported content-type: ${ct}` }), { status: 415, headers: CORS(origin) });
    }

    // ---- 2) size guard ----
    if ((blob?.size ?? 0) > 8_000_000) {
      return new Response(JSON.stringify({ error: 'Chunk too large (max 8MB)' }), { status: 413, headers: CORS(origin) });
    }

    if ((blob?.size ?? 0) < 1000) {
      console.log('⚠️ Very small audio chunk, skipping:', blob?.size);
      return new Response(JSON.stringify({ text: '' }), {
        headers: { 'content-type': 'application/json', ...CORS(origin) },
      });
    }

    // ---- 3) forward to OpenAI Whisper ----
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

    const form = new FormData();
    form.append('file', blob!, 'chunk.webm');
    form.append('model', 'whisper-1');
    form.append('language', 'en');
    form.append('temperature', '0');
    form.append('prompt', 'NHS, PCN, DES, ARRS, QOF, EMIS, SystmOne, locum, CQC, practice, patient, consultation, medication, prescription, referral, appointment');

    console.log('📡 Sending to OpenAI Whisper...');

    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error('❌ OpenAI error:', detail);
      return new Response(JSON.stringify({ error: 'Upstream STT failed', status: r.status, detail }), {
        status: 502,
        headers: { 'content-type': 'application/json', ...CORS(origin) },
      });
    }

    const data = await r.json();
    console.log('✅ Transcription successful:', data.text || 'No text returned');

    return new Response(JSON.stringify({ text: data.text ?? '' }), {
      headers: { 'content-type': 'application/json', ...CORS(origin) },
    });

  } catch (e) {
    console.error('❌ Function error:', e);
    return new Response(JSON.stringify({ error: 'Function crash', detail: String(e) }), {
      status: 500,
      headers: { 'content-type': 'application/json', ...CORS(req.headers.get('origin')) },
    });
  }
});