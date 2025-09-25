import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    console.log('Processing audio chunk, size:', audio.length);

    // Convert base64 to binary
    const binaryAudio = processBase64Chunks(audio);
    
    // Try multiple audio formats that OpenAI accepts
    const formats = [
      { type: 'audio/mp4', ext: 'mp4' },
      { type: 'audio/mpeg', ext: 'mp3' },
      { type: 'audio/wav', ext: 'wav' },
      { type: 'audio/webm', ext: 'webm' },
      { type: 'audio/ogg', ext: 'ogg' }
    ];
    
    let lastError = null;
    
    for (const format of formats) {
      try {
        // Prepare form data for Whisper API
        const formData = new FormData();
        const blob = new Blob([binaryAudio], { type: format.type });
        formData.append('file', blob, `audio.${format.ext}`);
        formData.append('model', 'whisper-1');
        formData.append('language', 'en');
        formData.append('response_format', 'json');

        console.log(`Trying format: ${format.type}`);

        // Send to OpenAI Whisper API
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
          },
          body: formData,
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Whisper transcription result:', result.text?.slice(0, 100) + '...');

          return new Response(
            JSON.stringify({ 
              text: result.text || '',
              service: 'whisper',
              format: format.type
            }),
            { 
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json' 
              } 
            }
          );
        } else {
          const errorText = await response.text();
          lastError = `${format.type}: ${response.status} ${errorText}`;
          console.log(`Format ${format.type} failed:`, lastError);
        }
      } catch (err) {
        lastError = `${format.type}: ${err.message}`;
        console.log(`Format ${format.type} error:`, err.message);
      }
    }
    
    throw new Error(`All audio formats failed. Last error: ${lastError}`);

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