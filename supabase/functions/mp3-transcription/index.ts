import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

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
    console.log('Starting MP3 transcription...');
    
    const { audio, filename } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log(`Processing audio file: ${filename || 'unknown'}`);
    
    // Process audio in chunks to prevent memory issues
    const binaryAudio = processBase64Chunks(audio);
    console.log(`Processed audio size: ${binaryAudio.length} bytes`);
    
    // Prepare form data for OpenAI Whisper
    const formData = new FormData();
    const blob = new Blob([binaryAudio], { 
      type: filename?.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav'
    });
    formData.append('file', blob, filename || 'audio.mp3');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Force English transcription
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');

    console.log('Sending to OpenAI Whisper API...');

    // Send to OpenAI Whisper
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Transcription completed successfully');

    // Extract transcript with speaker detection (simplified)
    const transcript = result.text || '';
    const words = result.words || [];
    
    // Create segments for better readability
    const segments = [];
    if (words.length > 0) {
      let currentSegment = '';
      let segmentStart = 0;
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        currentSegment += word.word + ' ';
        
        // Create new segment every 50 words or at natural breaks
        if (i % 50 === 49 || word.word.includes('.') || word.word.includes('?') || word.word.includes('!')) {
          segments.push({
            text: currentSegment.trim(),
            start: segmentStart,
            end: word.end || 0,
            speaker: 'Speaker' // Could be enhanced with speaker detection
          });
          currentSegment = '';
          segmentStart = word.end || 0;
        }
      }
      
      // Add remaining text
      if (currentSegment.trim()) {
        segments.push({
          text: currentSegment.trim(),
          start: segmentStart,
          end: words[words.length - 1]?.end || 0,
          speaker: 'Speaker'
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        text: transcript,
        segments: segments,
        duration: result.duration || 0,
        language: result.language || 'unknown'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'MP3 transcription failed'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});