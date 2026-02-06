// supabase/functions/process-meeting-audio/index.ts
import "https://deno.land/x/xhr@0.1.1/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

/**
 * Detect audio format from magic bytes for reliable MIME type assignment
 */
function detectFormatFromBytes(bytes: Uint8Array): { mimeType: string; extension: string } | null {
  if (bytes.length < 12) return null;

  // WebM: EBML header 0x1A 0x45 0xDF 0xA3
  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
    return { mimeType: 'audio/webm', extension: 'webm' };
  }
  // RIFF/WAV
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return { mimeType: 'audio/wav', extension: 'wav' };
  }
  // OGG
  if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return { mimeType: 'audio/ogg', extension: 'ogg' };
  }
  // FLAC
  if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return { mimeType: 'audio/flac', extension: 'flac' };
  }
  // MP4/M4A: 'ftyp' at bytes 4-7
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return { mimeType: 'audio/mp4', extension: 'm4a' };
  }
  // MP3: ID3 or MPEG sync
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
    (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)
  ) {
    return { mimeType: 'audio/mpeg', extension: 'mp3' };
  }

  return null;
}

/**
 * Normalise MIME type, stripping codec parameters
 */
function normaliseMime(raw: string): { mimeType: string; extension: string } {
  const lower = (raw || '').toLowerCase().split(';')[0].trim();
  if (lower.includes('flac')) return { mimeType: 'audio/flac', extension: 'flac' };
  if (lower.includes('webm')) return { mimeType: 'audio/webm', extension: 'webm' };
  if (lower.includes('wav')) return { mimeType: 'audio/wav', extension: 'wav' };
  if (lower.includes('ogg')) return { mimeType: 'audio/ogg', extension: 'ogg' };
  if (lower.includes('m4a') || lower.includes('mp4') || lower.includes('aac')) return { mimeType: 'audio/mp4', extension: 'm4a' };
  if (lower.includes('mp3') || lower.includes('mpeg')) return { mimeType: 'audio/mpeg', extension: 'mp3' };
  return { mimeType: 'audio/webm', extension: 'webm' };
}

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

    const bytes = new Uint8Array(await file.arrayBuffer());
    
    // Validate that we have actual audio data
    if (bytes.length === 0) {
      console.error("❌ Empty audio file");
      return j(400, { success: false, error: "Empty audio file provided" });
    }
    
    console.log("🔍 Audio data validation:", {
      byteLength: bytes.length,
      firstBytes: Array.from(bytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')
    });

    // Smart format detection: prefer magic bytes, fall back to declared MIME
    const detectedFormat = detectFormatFromBytes(bytes);
    const declaredFormat = normaliseMime(file.type);
    
    const finalMime = detectedFormat?.mimeType || declaredFormat.mimeType;
    const finalExt = detectedFormat?.extension || declaredFormat.extension;
    const fileName = `chunk.${finalExt}`;
    
    console.log("🎵 Format detection:", {
      declared: file.type,
      detected: detectedFormat?.mimeType || 'unknown',
      using: `${finalMime} (.${finalExt})`
    });

    const normalized = new File([bytes], fileName, { type: finalMime });

    console.log("📤 Sending to OpenAI with anti-hallucination settings");
    const out = new FormData();
    out.append("model", model);
    out.append("language", "en"); // Force English transcription
    out.append("temperature", "0"); // Reduce creativity and hallucinations
    out.append("prompt", "This is a medical meeting recording with healthcare professionals discussing patient care and clinical matters."); // Provide relevant context
    out.append("file", normalized, normalized.name);

    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: out,
    });

    console.log("📨 OpenAI response status:", resp.status);
    const bodyText = await resp.text();
    console.log("📨 OpenAI response body:", bodyText);
    
    // If OpenAI returns an error, parse it and return details
    if (!resp.ok) {
      let errorDetails = bodyText;
      try {
        const errorObj = JSON.parse(bodyText);
        if (errorObj.error?.message) {
          errorDetails = errorObj.error.message;
        }
      } catch (e) {
        console.log("Failed to parse OpenAI error response");
      }
      
      console.error("❌ OpenAI API error:", {
        status: resp.status,
        statusText: resp.statusText,
        errorDetails: errorDetails
      });
      
      return j(resp.status, { 
        success: false, 
        error: `OpenAI API error (${resp.status}): ${errorDetails}`,
        openai_status: resp.status,
        openai_error: errorDetails
      });
    }
    
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
