import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_MODELS = new Set([
  "whisper-1",
  "gpt-4o-transcribe",
  "gpt-4o-mini-transcribe",
]);

const ASSEMBLY_MODELS = new Set(["assemblyai"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const formData = await req.formData();
    const audioFile = formData.get("file") as File | null;
    const model = String(formData.get("model") || "whisper-1");
    const prompt = String(formData.get("prompt") || "");
    const language = String(formData.get("language") || "en");

    if (!audioFile) throw new Error("file is required");
    if (audioFile.size > 25 * 1024 * 1024) {
      throw new Error(`Audio file too large (${Math.round(audioFile.size / (1024 * 1024))}MB). Limit is 25MB.`);
    }

    console.log(`🧪 [${requestId}] Pilot transcribe: model=${model}, size=${audioFile.size}B, type=${audioFile.type}`);

    if (OPENAI_MODELS.has(model)) {
      return await runOpenAI({ requestId, audioFile, model, prompt, language });
    }
    if (ASSEMBLY_MODELS.has(model)) {
      return await runAssemblyAI({ requestId, audioFile, prompt });
    }
    throw new Error(`model must be one of: ${[...OPENAI_MODELS, ...ASSEMBLY_MODELS].join(", ")}`);
  } catch (err) {
    console.error(`❌ [${requestId}] pilot-transcribe error:`, err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function runOpenAI(opts: {
  requestId: string;
  audioFile: File;
  model: string;
  prompt: string;
  language: string;
}): Promise<Response> {
  const { requestId, audioFile, model, prompt, language } = opts;
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const oaForm = new FormData();
  oaForm.append("file", audioFile, audioFile.name || "audio.webm");
  oaForm.append("model", model);
  oaForm.append("language", language);
  oaForm.append("response_format", "json");
  oaForm.append("temperature", "0");
  if (prompt && prompt.trim()) oaForm.append("prompt", prompt);

  const startedAt = Date.now();
  const oaResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: oaForm,
  });
  const latencyMs = Date.now() - startedAt;

  if (!oaResponse.ok) {
    const errBody = await oaResponse.text();
    console.error(`❌ [${requestId}] OpenAI ${oaResponse.status}: ${errBody.slice(0, 300)}`);
    return new Response(
      JSON.stringify({
        success: false,
        model,
        error: `OpenAI ${oaResponse.status}: ${errBody.slice(0, 500)}`,
        latencyMs,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const result = await oaResponse.json();
  const text = String(result?.text || "");
  console.log(`✅ [${requestId}] ${model} returned ${text.length} chars in ${latencyMs}ms`);

  return new Response(
    JSON.stringify({ success: true, model, text, latencyMs, raw: result }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function runAssemblyAI(opts: {
  requestId: string;
  audioFile: File;
  prompt: string;
}): Promise<Response> {
  const { requestId, audioFile, prompt } = opts;
  const apiKey = Deno.env.get("ASSEMBLYAI_API_KEY");
  if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY not configured");

  const startedAt = Date.now();

  // 1. Upload raw audio bytes
  const audioBytes = new Uint8Array(await audioFile.arrayBuffer());
  const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/octet-stream",
    },
    body: audioBytes,
  });
  if (!uploadRes.ok) {
    const errBody = await uploadRes.text();
    return new Response(
      JSON.stringify({
        success: false,
        model: "assemblyai",
        error: `AssemblyAI upload ${uploadRes.status}: ${errBody.slice(0, 500)}`,
        latencyMs: Date.now() - startedAt,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const { upload_url } = await uploadRes.json();

  // 2. Build word boost list from caller prompt (capitalised + acronym tokens)
  const wordBoost = extractBoostTerms(prompt);

  // 3. Submit transcript job — best model, British English
  const submitBody: Record<string, unknown> = {
    audio_url: upload_url,
    language_code: "en_uk",
    speech_model: "best",
    punctuate: true,
    format_text: true,
  };
  if (wordBoost.length > 0) {
    submitBody.word_boost = wordBoost.slice(0, 1000);
    submitBody.boost_param = "high";
  }

  const submitRes = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(submitBody),
  });
  if (!submitRes.ok) {
    const errBody = await submitRes.text();
    return new Response(
      JSON.stringify({
        success: false,
        model: "assemblyai",
        error: `AssemblyAI submit ${submitRes.status}: ${errBody.slice(0, 500)}`,
        latencyMs: Date.now() - startedAt,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const { id: transcriptId } = await submitRes.json();

  // 4. Poll until completion (max ~5 minutes)
  const pollUrl = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(pollUrl, { headers: { Authorization: apiKey } });
    if (!pollRes.ok) continue;
    const poll = await pollRes.json();
    if (poll.status === "completed") {
      const text = String(poll.text || "");
      const latencyMs = Date.now() - startedAt;
      console.log(`✅ [${requestId}] assemblyai returned ${text.length} chars in ${latencyMs}ms`);
      return new Response(
        JSON.stringify({ success: true, model: "assemblyai", text, latencyMs, raw: poll }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (poll.status === "error") {
      return new Response(
        JSON.stringify({
          success: false,
          model: "assemblyai",
          error: `AssemblyAI: ${poll.error || "transcription failed"}`,
          latencyMs: Date.now() - startedAt,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(
    JSON.stringify({
      success: false,
      model: "assemblyai",
      error: "AssemblyAI polling timeout (>5 min)",
      latencyMs: Date.now() - startedAt,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function extractBoostTerms(prompt: string): string[] {
  if (!prompt) return [];
  const tokens = prompt.match(/\b[A-Z][A-Za-z0-9'-]{1,}\b/g) || [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    const k = t.trim();
    if (k.length < 2) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}
