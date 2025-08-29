// supabase/functions/process-meeting-audio/index.ts
import "https://deno.land/x/xhr@0.1.1/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    console.log("🚀 Process-meeting-audio function called");
    
    const key = (Deno.env.get("OPENAI_API_KEY") || "").trim();
    const model = (Deno.env.get("OPENAI_STT_MODEL") || "whisper-1").trim();
    
    console.log("🔑 API Key status:", key ? "Present" : "Missing");
    console.log("🤖 Model:", model);
    
    if (!key) {
      console.error("❌ OPENAI_API_KEY missing");
      return j(500, { success: false, error: "OPENAI_API_KEY missing in Function secrets" });
    }

    const ct = req.headers.get("content-type") || "";
    console.log("📝 Content-Type:", ct);
    
    if (!ct.includes("multipart/form-data")) {
      console.error("❌ Invalid content type:", ct);
      return j(400, { success: false, error: "Content-Type must be multipart/form-data" });
    }

    let inForm: FormData;
    try { 
      console.log("📋 Parsing form data...");
      inForm = await req.formData(); 
      console.log("✅ Form data parsed successfully");
    }
    catch (e) { 
      console.error("❌ Failed to parse form data:", e);
      return j(400, { success: false, error: "Failed to parse formData()", detail: String(e) }); 
    }

    let file = (inForm.get("file") || inForm.get("audio")) as File | null;
    if (!file) {
      console.error("❌ No audio file found in form data");
      console.log("📋 Available form keys:", Array.from(inForm.keys()));
      return j(400, { success: false, error: "No audio file provided (expected 'file' or 'audio')" });
    }

    console.log("🎵 Audio file details:", {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Ensure filename & type for OpenAI - clean the mime type
    const name = file.name && file.name !== "blob" ? file.name : "chunk.webm";
    // Remove codecs from mime type - OpenAI only accepts "audio/webm" not "audio/webm;codecs=opus"
    const cleanType = file.type ? file.type.split(';')[0] : "audio/webm";
    const finalType = cleanType === "audio/webm" ? "audio/webm" : "audio/webm";
    
    console.log("🎵 Original type:", file.type, "-> Clean type:", finalType);
    
    const bytes = new Uint8Array(await file.arrayBuffer());
    const normalized = new File([bytes], name.endsWith(".webm") ? name : `${name}.webm`, { type: finalType });

    console.log("📤 Sending to OpenAI with language=en and English prompt");
    const out = new FormData();
    out.append("model", model);
    out.append("language", "en"); // Force English transcription
    out.append("prompt", "This is an English language test recording of a transcription service."); // Guide toward English
    out.append("file", normalized, normalized.name);

    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: out,
    });

    console.log("📨 OpenAI response status:", resp.status);
    const bodyText = await resp.text();
    console.log("📨 OpenAI response body:", bodyText);
    
    const headers = { ...cors, "content-type": bodyText.trim().startsWith("{") ? "application/json" : "text/plain" };
    return new Response(bodyText, { status: resp.status, headers });
  } catch (err) {
    console.error("❌ Function error:", err);
    return j(500, { success: false, error: String(err?.message || err) });
  }
});

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
}