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
    const key = (Deno.env.get("OPENAI_API_KEY") || "").trim();
    const model = (Deno.env.get("OPENAI_STT_MODEL") || "whisper-1").trim();
    if (!key) return j(500, { success: false, error: "OPENAI_API_KEY missing in Function secrets" });

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return j(400, { success: false, error: "Content-Type must be multipart/form-data" });
    }

    let inForm: FormData;
    try { inForm = await req.formData(); }
    catch (e) { return j(400, { success: false, error: "Failed to parse formData()", detail: String(e) }); }

    let file = (inForm.get("file") || inForm.get("audio")) as File | null;
    if (!file) return j(400, { success: false, error: "No audio file provided (expected 'file' or 'audio')" });

    // Ensure filename & type for OpenAI
    const name = file.name && file.name !== "blob" ? file.name : "chunk.webm";
    const type = file.type || "audio/webm";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const normalized = new File([bytes], name.endsWith(".webm") ? name : `${name}.webm`, { type });

    const out = new FormData();
    out.append("model", model);
    out.append("language", "en"); // Force English transcription
    out.append("file", normalized, normalized.name);

    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: out,
    });

    const bodyText = await resp.text();
    const headers = { ...cors, "content-type": bodyText.trim().startsWith("{") ? "application/json" : "text/plain" };
    return new Response(bodyText, { status: resp.status, headers });
  } catch (err) {
    return j(500, { success: false, error: String(err?.message || err) });
  }
});

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
}