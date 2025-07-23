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
    console.log('Processing audio data...');
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const { audio } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('Sending to OpenAI Whisper...');

    // Process audio in chunks
    const binaryAudio = processBase64Chunks(audio);
    
    // Prepare form data for OpenAI Whisper
    const formData = new FormData();
    const blob = new Blob([binaryAudio], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('temperature', '0');
    formData.append('language', 'en');

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
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const result = await response.json();
    console.log('OpenAI Whisper response:', JSON.stringify(result, null, 2));

    // Enhanced quality filtering using OpenAI's detailed response
    if (!result.text || result.text.trim().length === 0) {
      console.log('No transcription text received from Whisper');
      return new Response(
        JSON.stringify({ text: '', confidence: 0, filtered: true, reason: 'no_text' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const text = result.text.trim();
    const segments = result.segments || [];
    
    // Calculate average confidence metrics
    let avgNoSpeechProb = 0;
    let avgLogProb = 0;
    
    if (segments.length > 0) {
      avgNoSpeechProb = segments.reduce((sum: number, seg: any) => sum + (seg.no_speech_prob || 0), 0) / segments.length;
      avgLogProb = segments.reduce((sum: number, seg: any) => sum + (seg.avg_logprob || 0), 0) / segments.length;
    }

    console.log('Quality metrics:', {
      text,
      avgNoSpeechProb,
      avgLogProb,
      duration: result.duration
    });

    // Strict quality thresholds
    if (avgNoSpeechProb > 0.7) {
      console.log('Rejected: High no_speech_prob:', avgNoSpeechProb);
      return new Response(
        JSON.stringify({ text: '', confidence: 0, filtered: true, reason: 'high_no_speech_prob', metrics: { avgNoSpeechProb, avgLogProb } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (avgLogProb < -1.5) {
      console.log('Rejected: Low confidence logprob:', avgLogProb);
      return new Response(
        JSON.stringify({ text: '', confidence: 0, filtered: true, reason: 'low_confidence', metrics: { avgNoSpeechProb, avgLogProb } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enhanced hallucination detection
    const isHallucination = isLikelyHallucination(text.toLowerCase());
    
    if (isHallucination) {
      console.log('Rejected: Likely hallucination:', text);
      return new Response(
        JSON.stringify({ text: '', confidence: 0, filtered: true, reason: 'hallucination', original_text: text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Transcription successful, accepted:', text);

    return new Response(
      JSON.stringify({ 
        text: text,
        confidence: Math.max(0, 1 + avgLogProb / 2), // Convert logprob to confidence
        segments: segments,
        duration: result.duration,
        metrics: { avgNoSpeechProb, avgLogProb }
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
  // Common Whisper hallucinations (exact matches)
  const exactHallucinations = [
    'bye', 'bye-bye', 'bye bye', 'goodbye',
    'thank you', 'thanks', 'thank you very much', 
    'thank you for listening', 'thank you for joining',
    'thank you for watching', 'thank you for your time',
    'good night', 'goodnight', 'good morning', 'good afternoon',
    'hello', 'hi there', 'welcome', 'cheers',
    'music', 'applause', 'laughter', 'silence',
    'okay', 'ok', 'um', 'uh', 'hmm', 'you', 'me'
  ];

  // Religious/Arabic phrases that Whisper hallucinates
  const religiousPatterns = [
    'bi hurmati', 'muhammad', 'al-mustafa', 'surat', 'al-fatiha', 
    'bismillah', 'allahu akbar', 'subhanallah'
  ];

  // Check exact matches
  if (exactHallucinations.includes(text)) {
    return true;
  }

  // Check for religious patterns
  if (religiousPatterns.some(pattern => text.includes(pattern))) {
    return true;
  }

  // Check for very short text that's likely noise
  if (text.length < 4) {
    return true;
  }

  // Check for repetitive patterns
  const words = text.split(' ');
  if (words.length > 2) {
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    if (uniqueWords.size === 1) {
      return true; // All words are the same
    }
  }

  // Check for overly repetitive phrases
  if (words.length > 3) {
    const repeatedWord = words[0].toLowerCase();
    const allSame = words.every(word => word.toLowerCase() === repeatedWord);
    if (allSame) {
      return true;
    }
  }

  return false;
}