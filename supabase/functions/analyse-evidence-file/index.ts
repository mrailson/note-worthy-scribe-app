import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Detect evidence type from MIME type and filename
function detectEvidenceType(mimeType: string, fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (mimeType.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "flac", "aac"].includes(ext)) return "audio";
  if (mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "tiff", "tif"].includes(ext)) return "image";
  if (mimeType === "application/pdf" || ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext) || mimeType.includes("wordprocessing") || mimeType === "application/msword") return "document";
  if (["xls", "xlsx"].includes(ext) || mimeType.includes("spreadsheet") || mimeType === "application/vnd.ms-excel") return "spreadsheet";
  if (["ppt", "pptx"].includes(ext) || mimeType.includes("presentation") || mimeType === "application/vnd.ms-powerpoint") return "presentation";
  if (["eml", "msg"].includes(ext) || mimeType === "message/rfc822") return "email";
  if (ext === "zip" || mimeType === "application/zip") return "archive";
  if (["txt", "csv", "rtf"].includes(ext) || mimeType.startsWith("text/")) return "document";
  return "other";
}

// Extract text from .docx using JSZip
async function extractDocxText(data: Uint8Array): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(data);
    const docXml = await zip.file("word/document.xml")?.async("string");
    if (!docXml) return "[Could not extract document content]";
    // Strip XML tags, keep text
    const text = docXml
      .replace(/<w:p[^>]*>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return text.substring(0, 8000);
  } catch (e) {
    console.error("DOCX extraction error:", e);
    return "[Failed to extract document text]";
  }
}

// Extract text from .xlsx using JSZip
async function extractXlsxText(data: Uint8Array): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(data);
    // Get shared strings
    const sharedStringsXml = await zip.file("xl/sharedStrings.xml")?.async("string");
    const sharedStrings: string[] = [];
    if (sharedStringsXml) {
      const matches = sharedStringsXml.matchAll(/<t[^>]*>([^<]+)<\/t>/g);
      for (const m of matches) sharedStrings.push(m[1]);
    }
    // Get first sheet
    const sheet1 = await zip.file("xl/worksheets/sheet1.xml")?.async("string");
    if (!sheet1) return sharedStrings.join(", ").substring(0, 8000) || "[Empty spreadsheet]";
    // Extract cell values
    const cellValues: string[] = [];
    const cellMatches = sheet1.matchAll(/<v>([^<]+)<\/v>/g);
    for (const m of cellMatches) {
      const val = m[1];
      // If it's an index into shared strings
      const idx = parseInt(val);
      if (!isNaN(idx) && idx < sharedStrings.length) {
        cellValues.push(sharedStrings[idx]);
      } else {
        cellValues.push(val);
      }
    }
    return cellValues.join(", ").substring(0, 8000) || "[Empty spreadsheet]";
  } catch (e) {
    console.error("XLSX extraction error:", e);
    return "[Failed to extract spreadsheet content]";
  }
}

// Extract text from .pptx using JSZip
async function extractPptxText(data: Uint8Array): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(data);
    const texts: string[] = [];
    const slideFiles = Object.keys(zip.files)
      .filter((f) => f.match(/^ppt\/slides\/slide\d+\.xml$/))
      .sort();
    for (const slideFile of slideFiles.slice(0, 30)) {
      const xml = await zip.file(slideFile)?.async("string");
      if (!xml) continue;
      const slideText = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (slideText) texts.push(slideText);
    }
    return texts.join("\n\n").substring(0, 8000) || "[Empty presentation]";
  } catch (e) {
    console.error("PPTX extraction error:", e);
    return "[Failed to extract presentation content]";
  }
}

// Parse email (.eml) content
function parseEmlContent(text: string): string {
  const lines = text.split("\n");
  const headers: string[] = [];
  let bodyStart = false;
  const bodyLines: string[] = [];
  for (const line of lines) {
    if (!bodyStart) {
      if (line.trim() === "") {
        bodyStart = true;
        continue;
      }
      const headerMatch = line.match(/^(From|To|Subject|Date|Cc):\s*(.+)/i);
      if (headerMatch) {
        headers.push(`${headerMatch[1]}: ${headerMatch[2]}`);
      }
    } else {
      bodyLines.push(line);
    }
  }
  const body = bodyLines
    .join("\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [headers.join("\n"), "", body].join("\n").substring(0, 8000);
}

// List ZIP archive contents
async function listZipContents(data: Uint8Array): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(data);
    const fileNames = Object.keys(zip.files).filter((f) => !f.endsWith("/"));
    const summary = `Archive contains ${fileNames.length} file(s):\n${fileNames.slice(0, 50).join("\n")}`;
    return summary.substring(0, 4000);
  } catch (e) {
    console.error("ZIP listing error:", e);
    return "[Failed to read archive contents]";
  }
}

// Call AI to summarise extracted text
async function aiSummarise(
  extractedText: string,
  fileName: string,
  evidenceType: string,
  apiKey: string
): Promise<string> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant summarising evidence files for a complaints investigation. Provide a brief 1-2 sentence description of the file's contents. Be factual and concise. Do not include the filename in your summary.",
          },
          {
            role: "user",
            content: `File: "${fileName}" (type: ${evidenceType})\n\nExtracted content:\n${extractedText.substring(0, 6000)}`,
          },
        ],
      }),
    });

    if (response.status === 429) {
      return "AI analysis rate limited — summary will be available on retry.";
    }
    if (response.status === 402) {
      return "AI analysis unavailable — credit limit reached.";
    }
    if (!response.ok) {
      console.error("AI gateway error:", response.status);
      return "AI summary could not be generated.";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "No summary generated.";
  } catch (e) {
    console.error("AI summarise error:", e);
    return "AI summary could not be generated.";
  }
}

// Use Gemini vision for images and PDFs
async function aiVisionAnalyse(
  base64Data: string,
  mimeType: string,
  fileName: string,
  evidenceType: string,
  apiKey: string
): Promise<string> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant analysing evidence files for a healthcare complaints investigation. Provide a brief 1-2 sentence description of the file's contents. Be factual and concise. If it's a document, extract key details. If it's an image, describe what it shows.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyse this ${evidenceType} file named "${fileName}" and provide a brief evidence summary.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (response.status === 429) {
      return "AI analysis rate limited — summary will be available on retry.";
    }
    if (response.status === 402) {
      return "AI analysis unavailable — credit limit reached.";
    }
    if (!response.ok) {
      const errText = await response.text();
      console.error("AI vision error:", response.status, errText);
      return "AI summary could not be generated.";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "No summary generated.";
  } catch (e) {
    console.error("AI vision error:", e);
    return "AI summary could not be generated.";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { base64Data, fileName, mimeType } = await req.json();

    if (!base64Data || !fileName) {
      return new Response(JSON.stringify({ error: "Missing base64Data or fileName" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const evidenceType = detectEvidenceType(mimeType || "", fileName);
    console.log(`Analysing file: ${fileName}, type: ${evidenceType}, mime: ${mimeType}`);

    let summary = "";

    // Decode base64 to bytes
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    switch (evidenceType) {
      case "audio": {
        summary = "Audio recording uploaded. Use the Transcribe button to extract the audio content.";
        break;
      }

      case "image": {
        // Use vision API
        summary = await aiVisionAnalyse(base64Data, mimeType || "image/jpeg", fileName, evidenceType, LOVABLE_API_KEY);
        break;
      }

      case "pdf": {
        // Use vision API for PDFs (send as image)
        summary = await aiVisionAnalyse(base64Data, mimeType || "application/pdf", fileName, evidenceType, LOVABLE_API_KEY);
        break;
      }

      case "document": {
        const ext = fileName.split(".").pop()?.toLowerCase() || "";
        if (ext === "docx") {
          const extractedText = await extractDocxText(bytes);
          summary = await aiSummarise(extractedText, fileName, evidenceType, LOVABLE_API_KEY);
        } else if (ext === "doc") {
          summary = "Microsoft Word (.doc) document uploaded. Content preview not available for legacy format.";
        } else {
          // Plain text, CSV, RTF
          const textContent = new TextDecoder().decode(bytes);
          summary = await aiSummarise(textContent.substring(0, 8000), fileName, evidenceType, LOVABLE_API_KEY);
        }
        break;
      }

      case "spreadsheet": {
        const ext = fileName.split(".").pop()?.toLowerCase() || "";
        if (ext === "xlsx") {
          const extractedText = await extractXlsxText(bytes);
          summary = await aiSummarise(extractedText, fileName, evidenceType, LOVABLE_API_KEY);
        } else {
          summary = "Spreadsheet uploaded. Content preview not available for legacy format.";
        }
        break;
      }

      case "presentation": {
        const ext = fileName.split(".").pop()?.toLowerCase() || "";
        if (ext === "pptx") {
          const extractedText = await extractPptxText(bytes);
          summary = await aiSummarise(extractedText, fileName, evidenceType, LOVABLE_API_KEY);
        } else {
          summary = "Presentation uploaded. Content preview not available for legacy format.";
        }
        break;
      }

      case "email": {
        const textContent = new TextDecoder().decode(bytes);
        const parsedEmail = parseEmlContent(textContent);
        summary = await aiSummarise(parsedEmail, fileName, evidenceType, LOVABLE_API_KEY);
        break;
      }

      case "archive": {
        const zipContents = await listZipContents(bytes);
        summary = await aiSummarise(zipContents, fileName, evidenceType, LOVABLE_API_KEY);
        break;
      }

      default: {
        summary = `File uploaded (${fileName}). Unable to extract content for this file type.`;
        break;
      }
    }

    console.log(`Analysis complete for ${fileName}: type=${evidenceType}`);

    return new Response(
      JSON.stringify({ evidenceType, summary }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("analyse-evidence-file error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
