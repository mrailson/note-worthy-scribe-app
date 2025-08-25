import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const transcribeModel = Deno.env.get('OPENAI_TRANSCRIBE_MODEL') || 'whisper-1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";

async function extractFromDocx(buffer: Uint8Array): Promise<string> {
  // For Deno, we'll need to use a different approach since mammoth is Node-specific
  // This is a simplified text extraction - in production you might want to use a more robust solution
  const decoder = new TextDecoder();
  const text = decoder.decode(buffer);
  
  // Basic XML text extraction for DOCX (which is a ZIP with XML files)
  // This is simplified - a full implementation would parse the XML properly
  const textMatches = text.match(/>([^<]+)</g);
  if (textMatches) {
    return textMatches
      .map(match => match.slice(1, -1))
      .filter(text => text.trim().length > 0)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  return '';
}

async function extractFromPdf(buffer: Uint8Array): Promise<string> {
  // For PDF extraction in Deno, we'll use a basic approach
  // In production, you might want to use a more robust PDF parsing solution
  const decoder = new TextDecoder();
  const text = decoder.decode(buffer);
  
  // Basic PDF text extraction - look for text between stream markers
  const textMatches = text.match(/stream\s*(.*?)\s*endstream/gs);
  if (textMatches) {
    return textMatches
      .map(match => {
        // Remove stream markers and clean up
        return match.replace(/^stream\s*/, '').replace(/\s*endstream$/, '');
      })
      .join(' ')
      .replace(/[^\x20-\x7E\n\r]/g, ' ') // Remove non-printable characters
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  return '';
}

function extractFromTxt(buffer: Uint8Array): string {
  const decoder = new TextDecoder();
  const text = decoder.decode(buffer);
  
  return text
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const formData = await req.formData();
    const audio = formData.get("audio") as File | null;
    const doc = formData.get("doc") as File | null;

    if (!audio && !doc) {
      return new Response(JSON.stringify({ 
        error: "Upload a file: `audio` (mp3/wav/m4a/webm/ogg) or `doc` (docx/pdf/txt)" 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (audio && doc) {
      return new Response(JSON.stringify({ 
        error: "Upload only one file at a time (audio OR doc)." 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // AUDIO → Whisper
    if (audio) {
      const ext = audio.name.split(".").pop()?.toLowerCase();
      const allowedAudioTypes = ["mp3", "wav", "m4a", "webm", "ogg"];
      
      if (!ext || !allowedAudioTypes.includes(ext)) {
        return new Response(JSON.stringify({ 
          error: "Unsupported audio type. Allowed: mp3, wav, m4a, webm, ogg." 
        }), {
          status: 415,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Build multipart form data for OpenAI
      const audioBuffer = await audio.arrayBuffer();
      const boundary = "----openaiForm" + Math.random().toString(16).slice(2);
      const crlf = "\r\n";
      
      const encoder = new TextEncoder();
      const parts: Uint8Array[] = [];

      // Model field
      parts.push(encoder.encode(`--${boundary}${crlf}`));
      parts.push(encoder.encode(`Content-Disposition: form-data; name="model"${crlf}${crlf}`));
      parts.push(encoder.encode(`${transcribeModel}${crlf}`));

      // File field
      parts.push(encoder.encode(`--${boundary}${crlf}`));
      parts.push(encoder.encode(
        `Content-Disposition: form-data; name="file"; filename="${audio.name}"${crlf}` +
        `Content-Type: ${audio.type || "application/octet-stream"}${crlf}${crlf}`
      ));
      parts.push(new Uint8Array(audioBuffer));
      parts.push(encoder.encode(crlf));

      // End boundary
      parts.push(encoder.encode(`--${boundary}--${crlf}`));

      // Combine all parts
      const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
      const body = new Uint8Array(totalLength);
      let offset = 0;
      for (const part of parts) {
        body.set(part, offset);
        offset += part.length;
      }

      const response = await fetch(OPENAI_TRANSCRIBE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAIApiKey}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`
        },
        body
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI transcription error:', errorText);
        return new Response(JSON.stringify({ 
          error: `OpenAI transcribe error: ${response.status} ${errorText}` 
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      const text = data?.text || "";
      
      return new Response(JSON.stringify({ text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DOC → extract text
    if (doc) {
      const buffer = new Uint8Array(await doc.arrayBuffer());
      const fileName = doc.name.toLowerCase();
      let text = "";

      try {
        if (fileName.endsWith(".docx")) {
          text = await extractFromDocx(buffer);
        } else if (fileName.endsWith(".pdf")) {
          text = await extractFromPdf(buffer);
        } else if (fileName.endsWith(".txt")) {
          text = extractFromTxt(buffer);
        } else {
          return new Response(JSON.stringify({ 
            error: "Unsupported document type. Allowed: .docx, .pdf, .txt" 
          }), {
            status: 415,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ text }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (extractError) {
        console.error('Text extraction error:', extractError);
        return new Response(JSON.stringify({ 
          error: `Failed to extract text from ${fileName}: ${extractError.message}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Unknown request" }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('upload-to-text error:', error);
    return new Response(JSON.stringify({ error: error?.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});