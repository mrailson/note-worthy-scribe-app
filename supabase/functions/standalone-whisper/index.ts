import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Detect audio format from magic bytes for reliable format assignment.
 * Replaces the previous trial-and-error approach of sending multiple formats.
 */
function detectFormat(bytes: Uint8Array): { mimeType: string; extension: string } {
  if (bytes.length < 12) {
    return { mimeType: 'audio/webm', extension: 'webm' };
  }

  // WebM: EBML header
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
  // MP3: ID3 tag or MPEG sync word
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
    (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)
  ) {
    return { mimeType: 'audio/mpeg', extension: 'mp3' };
  }

  // Default to webm (most common browser format)
  return { mimeType: 'audio/webm', extension: 'webm' };
}

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { audio } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('Processing audio chunk, base64 size:', audio.length);

    // Convert base64 to binary
    const binaryAudio = processBase64Chunks(audio);
    console.log('Binary audio size:', binaryAudio.length, 'bytes');

    // Smart format detection from magic bytes (replaces trial-and-error loop)
    const format = detectFormat(binaryAudio);
    console.log(`🎵 Detected format: ${format.mimeType} (.${format.extension})`);

    // Single attempt with detected format
    const formData = new FormData();
    const blob = new Blob([binaryAudio], { type: format.mimeType });
    formData.append('file', blob, `audio.${format.extension}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('response_format', 'json');

    console.log(`📡 Sending to OpenAI Whisper API as ${format.mimeType}`);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
      },
      body: formData,
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Whisper transcription result:', result.text?.slice(0, 100) + '...');

      return new Response(
        JSON.stringify({ 
          text: result.text || '',
          service: 'whisper',
          format: format.mimeType
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    const errorText = await response.text();
    console.error(`❌ OpenAI API error (${response.status}):`, errorText);
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);

  } catch (error) {
    console.error('Standalone Whisper transcription error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        service: 'whisper'
      }),
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );
  }
});
