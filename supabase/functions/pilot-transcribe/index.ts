import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPPORTED_MODELS = new Set([
  "whisper-1",
  "gpt-4o-transcribe",
  "gpt-4o-mini-transcribe",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

    // Multipart form input — same shape as OpenAI's transcription endpoint.
    // Caller sends: file (Blob), model (string), prompt (optional string).
    const formData = await req.formData();
    const audioFile = formData.get("file") as File | null;
    const model = String(formData.get("model") || "whisper-1");
    const prompt = String(formData.get("prompt") || "");
    const language = String(formData.get("language") || "en");

    if (!audioFile) throw new Error("file is required");
    if (!SUPPORTED_MODELS.has(model)) {
      throw new Error(`model must be one of: ${Array.from(SUPPORTED_MODELS).join(", ")}`);
    }

    if (audioFile.size > 25 * 1024 * 1024) {
      throw new Error(`Audio file too large (${Math.round(audioFile.size / (1024 * 1024))}MB). OpenAI limit is 25MB.`);
    }

    console.log(`🧪 [${requestId}] Pilot transcribe: model=${model}, size=${audioFile.size}B, type=${audioFile.type}`);

    // Build the OpenAI request. gpt-4o-transcribe and gpt-4o-mini-transcribe
    // support only json or text response_format — verbose_json is whisper-1
    // only. We use json for all three to keep the comparison consistent.
    const oaForm = new FormData();
    oaForm.append("file", audioFile, audioFile.name || "audio.webm");
    oaForm.append("model", model);
    oaForm.append("language", language);
    oaForm.append("response_format", "json");
    oaForm.append("temperature", "0");
    if (prompt && prompt.trim()) {
      oaForm.append("prompt", prompt);
    }

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
      JSON.stringify({
        success: true,
        model,
        text,
        latencyMs,
        // Pass-through of any extra fields OpenAI returns, useful for
        // future cost calculation and analysis.
        raw: result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
