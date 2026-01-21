import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseDataUrl(dataUrl: string): { mimeType: string; base64Data: string } {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid data URL format");
  return { mimeType: matches[1], base64Data: matches[2] };
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function decodeXmlEntities(text: string): string {
  return text
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function xmlToPlainText(
  xml: string,
  opts: { paragraphClose: RegExp; lineBreak: RegExp; tab: RegExp },
): string {
  const withMarkers = xml
    .replace(opts.tab, "\t")
    .replace(opts.lineBreak, "\n")
    .replace(opts.paragraphClose, "\n")
    .replace(/<[^>]+>/g, "");

  return decodeXmlEntities(withMarkers)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function colLettersToIndex(letters: string): number {
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64);
  }
  return n - 1;
}

async function extractDocxText(zip: JSZip): Promise<string> {
  const candidates = [
    "word/document.xml",
    ...Object.keys(zip.files).filter((p) => /^word\/header\d+\.xml$/.test(p)),
    ...Object.keys(zip.files).filter((p) => /^word\/footer\d+\.xml$/.test(p)),
  ];

  const chunks: string[] = [];
  for (const path of candidates) {
    const f = zip.file(path);
    if (!f) continue;
    const xml = await f.async("string");
    const text = xmlToPlainText(xml, {
      paragraphClose: /<\/w:p>/g,
      lineBreak: /<w:br[^>]*\/>/g,
      tab: /<w:tab[^>]*\/>/g,
    });
    if (text) chunks.push(text);
  }

  if (chunks.length === 0) throw new Error("DOCX contained no readable XML parts");
  return chunks.join("\n\n").trim();
}

async function extractPptxText(zip: JSZip): Promise<string> {
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const ai = Number(a.match(/slide(\d+)\.xml$/)?.[1] || 0);
      const bi = Number(b.match(/slide(\d+)\.xml$/)?.[1] || 0);
      return ai - bi;
    });

  const notePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const ai = Number(a.match(/notesSlide(\d+)\.xml$/)?.[1] || 0);
      const bi = Number(b.match(/notesSlide(\d+)\.xml$/)?.[1] || 0);
      return ai - bi;
    });

  const parts: string[] = [];

  for (const path of slidePaths) {
    const xml = await zip.file(path)!.async("string");
    const text = xmlToPlainText(xml, {
      paragraphClose: /<\/a:p>/g,
      lineBreak: /<a:br[^>]*\/>/g,
      tab: /<a:tab[^>]*\/>/g,
    });
    if (text) parts.push(`--- ${path.split("/").pop() ?? "slide"} ---\n${text}`);
  }

  for (const path of notePaths) {
    const xml = await zip.file(path)!.async("string");
    const text = xmlToPlainText(xml, {
      paragraphClose: /<\/a:p>/g,
      lineBreak: /<a:br[^>]*\/>/g,
      tab: /<a:tab[^>]*\/>/g,
    });
    if (text) parts.push(`--- ${path.split("/").pop() ?? "notes"} ---\n${text}`);
  }

  if (parts.length === 0) throw new Error("PPTX contained no slide text");
  return parts.join("\n\n").trim();
}

function extractSharedStrings(sharedStringsXml: string): string[] {
  const strings: string[] = [];
  const regex = /<t[^>]*>([\s\S]*?)<\/t>/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(sharedStringsXml)) !== null) {
    strings.push(decodeXmlEntities(m[1] ?? ""));
  }
  return strings;
}

function parseXlsxSheetXml(sheetXml: string, sharedStrings: string[]): string[] {
  const rows: Record<number, Record<number, string>> = {};
  const rowRegex = /<row[^>]* r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;

  while ((rm = rowRegex.exec(sheetXml)) !== null) {
    const rowIndex = Number(rm[1]);
    const rowBody = rm[2] || "";

    const cellRegex = /<c[^>]* r="([A-Z]+)(\d+)"[^>]*?(?: t="([^"]+)")?[^>]*>([\s\S]*?)<\/c>/g;
    let cm: RegExpExecArray | null;

    while ((cm = cellRegex.exec(rowBody)) !== null) {
      const colLetters = cm[1];
      const t = cm[3] || "";
      const cellBody = cm[4] || "";

      const colIndex = colLettersToIndex(colLetters);

      const vMatch = cellBody.match(/<v[^>]*>([\s\S]*?)<\/v>/);
      const tMatch = cellBody.match(/<t[^>]*>([\s\S]*?)<\/t>/);

      let value = "";

      if (t === "s") {
        const idx = Number((vMatch?.[1] ?? "").trim());
        value = sharedStrings[idx] ?? "";
      } else if (t === "inlineStr") {
        value = decodeXmlEntities((tMatch?.[1] ?? "").trim());
      } else {
        value = decodeXmlEntities((vMatch?.[1] ?? "").trim());
      }

      if (!rows[rowIndex]) rows[rowIndex] = {};
      rows[rowIndex][colIndex] = value;
    }
  }

  const rowNumbers = Object.keys(rows).map(Number).sort((a, b) => a - b);
  const out: string[] = [];

  for (const r of rowNumbers) {
    const cols = rows[r];
    const colIndexes = Object.keys(cols).map(Number);
    const maxCol = colIndexes.length ? Math.max(...colIndexes) : -1;

    const cells: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      cells.push((cols[c] ?? "").replace(/\s+/g, " ").trim());
    }

    // Trim trailing empties
    while (cells.length && cells[cells.length - 1] === "") cells.pop();
    if (cells.length) out.push(cells.join("\t"));
  }

  return out;
}

async function extractXlsxText(zip: JSZip): Promise<string> {
  const sharedStringsXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  const sharedStrings = sharedStringsXml ? extractSharedStrings(sharedStringsXml) : [];

  const sheetPaths = Object.keys(zip.files)
    .filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p))
    .sort((a, b) => {
      const ai = Number(a.match(/sheet(\d+)\.xml$/)?.[1] || 0);
      const bi = Number(b.match(/sheet(\d+)\.xml$/)?.[1] || 0);
      return ai - bi;
    });

  if (sheetPaths.length === 0) throw new Error("XLSX contained no worksheet XML");

  const parts: string[] = [];
  for (const path of sheetPaths) {
    const xml = await zip.file(path)!.async("string");
    const rows = parseXlsxSheetXml(xml, sharedStrings);
    const label = path.split("/").pop()?.replace(".xml", "") || "sheet";
    const body = rows.join("\n");
    if (body.trim()) parts.push(`--- ${label} ---\n${body}`);
  }

  return parts.join("\n\n").trim();
}

// Extract text from RTF content by stripping formatting codes
function extractRtfText(rtfContent: string): string {
  // Remove RTF header/control groups
  let text = rtfContent;
  
  // Remove nested groups but preserve their text content
  let prevLength = -1;
  while (prevLength !== text.length) {
    prevLength = text.length;
    // Remove control groups that don't contain text
    text = text.replace(/\{\\[^{}]*\}/g, '');
  }
  
  // Remove remaining braces
  text = text.replace(/[{}]/g, '');
  
  // Remove RTF control words (e.g., \par, \b, \i, \f0, etc.)
  text = text.replace(/\\[a-z]+\d*\s?/gi, ' ');
  
  // Convert RTF line breaks to newlines
  text = text.replace(/\\par\s*/gi, '\n');
  text = text.replace(/\\line\s*/gi, '\n');
  text = text.replace(/\\tab\s*/gi, '\t');
  
  // Remove escape sequences
  text = text.replace(/\\'[0-9a-f]{2}/gi, ''); // Hex escaped chars
  text = text.replace(/\\\\/g, '\\');
  text = text.replace(/\\~/g, ' '); // Non-breaking space
  text = text.replace(/\\_/g, '-'); // Non-breaking hyphen
  text = text.replace(/\\-/g, ''); // Optional hyphen
  
  // Clean up whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n[ \t]+/g, '\n');
  text = text.replace(/[ \t]+\n/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  
  return text.trim();
}

// Extract text from email content (EML format)
function extractEmailText(emailContent: string, fileName: string): string {
  const lines = emailContent.split(/\r?\n/);
  const headers: Record<string, string> = {};
  let bodyStartIndex = 0;
  let inHeaders = true;
  
  // Parse headers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line === '' && inHeaders) {
      bodyStartIndex = i + 1;
      inHeaders = false;
      break;
    }
    
    if (inHeaders) {
      // Check if it's a continuation of previous header
      if (line.startsWith(' ') || line.startsWith('\t')) {
        const lastKey = Object.keys(headers).pop();
        if (lastKey) {
          headers[lastKey] += ' ' + line.trim();
        }
      } else {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).toLowerCase();
          const value = line.substring(colonIndex + 1).trim();
          headers[key] = value;
        }
      }
    }
  }
  
  // Extract body
  let body = lines.slice(bodyStartIndex).join('\n');
  
  // Handle quoted-printable encoding
  if (headers['content-transfer-encoding']?.toLowerCase().includes('quoted-printable')) {
    body = decodeQuotedPrintable(body);
  }
  
  // Handle base64 encoding
  if (headers['content-transfer-encoding']?.toLowerCase().includes('base64')) {
    try {
      body = atob(body.replace(/\s/g, ''));
    } catch {
      // Keep original if decode fails
    }
  }
  
  // Strip HTML tags if content is HTML
  if (headers['content-type']?.toLowerCase().includes('text/html')) {
    body = body.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    body = body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    body = body.replace(/<[^>]+>/g, ' ');
    body = decodeXmlEntities(body);
  }
  
  // Build output
  const output: string[] = ['=== EMAIL MESSAGE ==='];
  
  if (headers['from']) output.push(`From: ${headers['from']}`);
  if (headers['to']) output.push(`To: ${headers['to']}`);
  if (headers['cc']) output.push(`CC: ${headers['cc']}`);
  if (headers['date']) output.push(`Date: ${headers['date']}`);
  if (headers['subject']) output.push(`Subject: ${headers['subject']}`);
  
  output.push('');
  output.push('--- Message Body ---');
  output.push(body.replace(/\n{3,}/g, '\n\n').trim());
  
  return output.join('\n');
}

// Decode quoted-printable encoding
function decodeQuotedPrintable(text: string): string {
  // Handle soft line breaks
  text = text.replace(/=\r?\n/g, '');
  
  // Decode encoded characters
  text = text.replace(/=([0-9A-F]{2})/gi, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  
  return text;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileType, dataUrl, fileName } = await req.json();
    console.log(`Processing ${fileType} file: ${fileName}`);

    let extractedText = "";

    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
      throw new Error("Missing or invalid dataUrl");
    }

    const { mimeType, base64Data } = parseDataUrl(dataUrl);
    console.log(`File MIME type: ${mimeType}, Base64 length: ${base64Data.length}`);

    if (fileType === "image") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const ocrResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    'Extract all text from this image. Return ONLY the extracted text, no other commentary. If there is no text, return "No text found in image".',
                },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      });

      if (!ocrResponse.ok) {
        const errorText = await ocrResponse.text();
        console.error("OCR API error:", ocrResponse.status, errorText);
        throw new Error(`OCR failed: ${ocrResponse.status}`);
      }

      const ocrData = await ocrResponse.json();
      extractedText = ocrData.choices?.[0]?.message?.content || "Failed to extract text from image";

    } else if (fileType === "pdf") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const docResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "Extract ALL text content from this PDF document. Return ONLY the extracted text, preserving the structure, headings, bullet points, and formatting. Include all text from all pages. Do not add any commentary.",
                },
                {
                  type: "file",
                  file: {
                    filename: fileName || "document.pdf",
                    file_data: dataUrl,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!docResponse.ok) {
        const errorText = await docResponse.text();
        console.error("PDF extraction API error:", docResponse.status, errorText);
        throw new Error(`Document extraction failed: ${docResponse.status}`);
      }

      const docData = await docResponse.json();
      extractedText = docData.choices?.[0]?.message?.content || "Failed to extract text from PDF";

    } else if (fileType === "word" || fileType === "powerpoint" || fileType === "excel") {
      // Avoid sending base64 blobs to the AI gateway (often exceeds limits / unsupported).
      // Office formats are zipped XML; extract deterministically.
      const zipBytes = base64ToUint8Array(base64Data);
      const zip = await JSZip.loadAsync(zipBytes);

      if (fileType === "word") {
        extractedText = await extractDocxText(zip);
      } else if (fileType === "powerpoint") {
        extractedText = await extractPptxText(zip);
      } else {
        extractedText = await extractXlsxText(zip);
      }

      console.log(`${fileType} extracted text length:`, extractedText.length);

    } else if (fileType === "text") {
      // Plain text files - just decode the base64
      const decoder = new TextDecoder('utf-8');
      extractedText = decoder.decode(base64ToUint8Array(base64Data));
      console.log(`Plain text extracted, length: ${extractedText.length}`);

    } else if (fileType === "rtf") {
      // RTF files - strip RTF formatting codes to extract plain text
      const decoder = new TextDecoder('utf-8');
      const rtfContent = decoder.decode(base64ToUint8Array(base64Data));
      extractedText = extractRtfText(rtfContent);
      console.log(`RTF text extracted, length: ${extractedText.length}`);

    } else if (fileType === "email") {
      // Email files (EML/MSG) - extract headers and body
      const decoder = new TextDecoder('utf-8');
      const emailContent = decoder.decode(base64ToUint8Array(base64Data));
      extractedText = extractEmailText(emailContent, fileName || 'email');
      console.log(`Email text extracted, length: ${extractedText.length}`);

    } else {
      console.log(`Unknown file type: ${fileType}, returning empty text`);
      extractedText = "";
    }

    return new Response(JSON.stringify({ extractedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in extract-document-text:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
