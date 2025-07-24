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
    console.log('Processing audio data with Deepgram...');
    
    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
    if (!deepgramApiKey) {
      throw new Error('DEEPGRAM_API_KEY is not set');
    }

    const { audio } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('Sending to Deepgram...');

    // Process audio in chunks
    const binaryAudio = processBase64Chunks(audio);
    
    // Send to Deepgram
    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&diarize=false&language=en&encoding=webm', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramApiKey}`,
        'Content-Type': 'audio/webm',
      },
      body: binaryAudio,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepgram API error:', response.status, errorText);
      throw new Error(`Deepgram API error: ${errorText}`);
    }

    const result = await response.json();
    console.log('Deepgram response:', JSON.stringify(result, null, 2));

    // Extract transcription from Deepgram response
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
    const words = result.results?.channels?.[0]?.alternatives?.[0]?.words || [];

    if (!transcript || transcript.trim().length === 0) {
      console.log('No transcription text received from Deepgram');
      return new Response(
        JSON.stringify({ text: '', confidence: 0, filtered: true, reason: 'no_text' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const text = transcript.trim();

    console.log('Deepgram transcription:', {
      text,
      confidence,
      wordCount: words.length
    });

    // Enhanced hallucination detection
    const isHallucination = isLikelyHallucination(text.toLowerCase());
    
    if (isHallucination) {
      console.log('Rejected: Likely hallucination:', text);
      return new Response(
        JSON.stringify({ text: '', confidence: 0, filtered: true, reason: 'hallucination', original_text: text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter out very low confidence results
    if (confidence < 0.3) {
      console.log('Rejected: Low confidence:', confidence);
      return new Response(
        JSON.stringify({ text: '', confidence: 0, filtered: true, reason: 'low_confidence', original_text: text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        text: text,
        confidence: confidence,
        words: words,
        duration: result.metadata?.duration || 0,
        provider: 'deepgram'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Speech-to-text error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function isLikelyHallucination(text: string): boolean {
  // Common speech-to-text hallucinations - exact matches only
  const exactHallucinations = [
    'bye', 'bye-bye', 'bye bye', 'goodbye',
    'thank you', 'thanks', 'thank you very much', 
    'thank you for listening', 'thank you for joining',
    'thank you for watching', 'thank you for your time',
    'good night', 'goodnight', 'good morning', 'good afternoon',
    'thank you. bye', 'thank you. bye.', 'thanks. bye',
    'thanks. bye.', 'thank you, bye', 'thanks, bye'
  ];

  // Religious/Arabic phrases that can be hallucinated
  const religiousPatterns = [
    'bi hurmati', 'muhammad', 'al-mustafa', 'surat', 'al-fatiha', 'bismillah'
  ];

  // Check exact matches
  if (exactHallucinations.includes(text)) {
    return true;
  }

  // Check for religious patterns
  if (religiousPatterns.some(pattern => text.includes(pattern))) {
    return true;
  }

  // Only filter extremely repetitive patterns (same word 4+ times)
  const words = text.split(' ');
  if (words.length >= 4) {
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    if (uniqueWords.size === 1) {
      return true; // Repetitive like "bye bye bye bye"
    }
  }

  return false;
}