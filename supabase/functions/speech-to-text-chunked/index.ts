import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  console.log(`📨 WHISPER EDGE: ${req.method} request received`);
  
  if (req.method === "OPTIONS") {
    console.log("✅ WHISPER EDGE: Handling CORS preflight");
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Check for OpenAI API key first
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error("❌ WHISPER EDGE: OPENAI_API_KEY environment variable not set");
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "OpenAI API key not configured. Please add OPENAI_API_KEY to edge function secrets." 
      }), {
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log("✅ WHISPER EDGE: OpenAI API key found");
    console.log("📦 WHISPER EDGE: Parsing form data...");
    
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      console.error("❌ WHISPER EDGE: No file in form data");
      return new Response(JSON.stringify({ ok: false, error: "Missing file" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("📁 WHISPER EDGE: File received:", {
      name: file.name,
      size: file.size,
      type: file.type
    });

    const model = Deno.env.get("TRANSCRIBE_MODEL") || "whisper-1";
    const openAIFormData = new FormData();
    // Keep extension so OpenAI detects format reliably
    openAIFormData.append("file", file, file.name || "audio.webm");
    openAIFormData.append("model", model);

    const responseFormat = (formData.get("response_format") as string) || "verbose_json";
    openAIFormData.append("response_format", responseFormat);

    const language = (formData.get("language") as string) || "en";
    openAIFormData.append("language", language);

    const prompt = (formData.get("prompt") as string) || "";
    if (prompt) openAIFormData.append("prompt", prompt);

    console.log("🚀 WHISPER EDGE: Sending request to OpenAI API...", {
      model,
      responseFormat,
      language,
      hasPrompt: !!prompt
    });

    const oaRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiApiKey}` },
      body: openAIFormData,
    });

    console.log("📨 WHISPER EDGE: OpenAI API response:", {
      status: oaRes.status,
      statusText: oaRes.statusText,
      ok: oaRes.ok
    });

    const text = await oaRes.text(); // read once
    const body = (() => { 
      try { 
        return JSON.parse(text); 
      } catch { 
        console.warn("⚠️ WHISPER EDGE: Failed to parse OpenAI response as JSON, using raw text");
        return { raw: text }; 
      } 
    })();

    if (!oaRes.ok) {
      console.error("❌ WHISPER EDGE: OpenAI API error:", {
        status: oaRes.status,
        body: body
      });
      return new Response(JSON.stringify({ 
        ok: false, 
        providerStatus: oaRes.status, 
        error: body 
      }), {
        status: 502, 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("✅ WHISPER EDGE: OpenAI API success:", {
      hasText: !!body.text,
      textLength: body.text?.length || 0,
      textPreview: body.text?.slice(0, 100) || ''
    });

    const result = {
      ok: true,
      data: body,
      metadata: {
        sessionId: formData.get("sessionId"),
        chunkIndex: Number(formData.get("chunkIndex") || 0),
        windowStartMs: Number(formData.get("windowStartMs") || 0),
        windowEndMs: Number(formData.get("windowEndMs") || 0),
      },
    };

    console.log("🎉 WHISPER EDGE: Returning successful response");
    
    return new Response(JSON.stringify(result), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("❌ WHISPER EDGE: Unexpected error:", error);
    return new Response(JSON.stringify({ 
      ok: false, 
      error: String(error?.message || error) 
    }), {
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
