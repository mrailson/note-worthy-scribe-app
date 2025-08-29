import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ ok: false, error: "Missing file" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const model = Deno.env.get("TRANSCRIBE_MODEL") || "whisper-1";
    const openAIFormData = new FormData();
    // Keep extension so OpenAI detects format reliably
    openAIFormData.append("file", file, file.name || "audio.webm");
    openAIFormData.append("model", model);

    const responseFormat = (formData.get("response_format") as string) || "verbose_json";
    openAIFormData.append("response_format", responseFormat); // supports: json|text|srt|verbose_json|vtt

    const language = (formData.get("language") as string) || "en";
    openAIFormData.append("language", language);

    const prompt = (formData.get("prompt") as string) || "";
    if (prompt) openAIFormData.append("prompt", prompt);

    const oaRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}` },
      body: openAIFormData,
    });

    const text = await oaRes.text(); // read once
    const body = (() => { try { return JSON.parse(text); } catch { return { raw: text }; } })();

    if (!oaRes.ok) {
      return new Response(JSON.stringify({ ok: false, providerStatus: oaRes.status, error: body }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      data: body,
      metadata: {
        sessionId: formData.get("sessionId"),
        chunkIndex: Number(formData.get("chunkIndex") || 0),
        windowStartMs: Number(formData.get("windowStartMs") || 0),
        windowEndMs: Number(formData.get("windowEndMs") || 0),
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error?.message || error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
