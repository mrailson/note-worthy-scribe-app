import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AudioChunk {
  audio: string; // base64 encoded audio
  stream: 'microphone' | 'speaker';
  timestamp: number;
  sequence: number;
}

interface TranscriptionResult {
  text: string;
  stream: 'microphone' | 'speaker';
  timestamp: number;
  sequence: number;
}

// Clean up transcription text by removing filler words and fixing punctuation
function cleanupTranscript(text: string): string {
  // Remove common filler words and sounds
  const fillerWords = [
    /\b(um|uh|er|ah|like|you know|actually|basically|literally|sort of|kind of)\b/gi,
    /\b(erm|uhm|hmm|mhm|yeah yeah|ok ok|right right)\b/gi,
    /\s{2,}/g // Multiple spaces
  ];

  let cleaned = text;
  
  // Remove filler words
  fillerWords.forEach(pattern => {
    cleaned = cleaned.replace(pattern, pattern === /\s{2,}/g ? ' ' : '');
  });

  // Fix punctuation and capitalization
  cleaned = cleaned
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .replace(/\s*,\s*/g, ', ') // Fix comma spacing
    .replace(/\s*\.\s*/g, '. ') // Fix period spacing
    .replace(/\s*\?\s*/g, '? ') // Fix question mark spacing
    .replace(/\s*!\s*/g, '! ') // Fix exclamation mark spacing
    .replace(/(\w)\s*'\s*(\w)/g, "$1'$2") // Fix contractions
    .trim();

  // Capitalize first letter of sentences
  cleaned = cleaned.replace(/(^|[.!?]\s+)([a-z])/g, (match, prefix, letter) => {
    return prefix + letter.toUpperCase();
  });

  // Ensure first character is capitalized
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

// Transcribe audio using OpenAI Whisper
async function transcribeAudio(audioBase64: string, stream: string): Promise<string> {
  const openAIKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openAIKey) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    // Convert base64 to blob
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const formData = new FormData();
    const blob = new Blob([bytes], { type: 'audio/webm' });
    formData.append('file', blob, `${stream}-audio.webm`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('response_format', 'json');
    formData.append('temperature', '0.1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const result = await response.json();
    return result.text || '';
  } catch (error) {
    console.error(`Transcription error for ${stream}:`, error);
    throw error;
  }
}

// Merge and format transcriptions from both streams
function mergeTranscriptions(transcriptions: TranscriptionResult[]): string {
  // Sort by timestamp to maintain chronological order
  const sorted = transcriptions.sort((a, b) => a.timestamp - b.timestamp);
  
  let mergedText = '';
  let currentSpeaker = '';
  
  for (const transcript of sorted) {
    const cleanText = cleanupTranscript(transcript.text);
    
    if (!cleanText || cleanText.trim().length === 0) {
      continue;
    }
    
    const speaker = transcript.stream === 'microphone' ? 'User' : 'Speaker';
    
    // Add speaker label if speaker changed
    if (currentSpeaker !== speaker) {
      if (mergedText) {
        mergedText += '\n\n';
      }
      mergedText += `${speaker}: `;
      currentSpeaker = speaker;
    } else {
      mergedText += ' ';
    }
    
    mergedText += cleanText;
  }
  
  return mergedText.trim();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audioChunks } = await req.json();
    
    if (!audioChunks || !Array.isArray(audioChunks)) {
      throw new Error('Invalid audio chunks provided');
    }

    console.log(`Processing ${audioChunks.length} audio chunks`);
    
    // Process all audio chunks in parallel
    const transcriptionPromises = audioChunks.map(async (chunk: AudioChunk) => {
      const text = await transcribeAudio(chunk.audio, chunk.stream);
      return {
        text,
        stream: chunk.stream,
        timestamp: chunk.timestamp,
        sequence: chunk.sequence
      } as TranscriptionResult;
    });

    const transcriptions = await Promise.all(transcriptionPromises);
    
    // Filter out empty transcriptions
    const validTranscriptions = transcriptions.filter(t => t.text.trim().length > 0);
    
    // Merge transcriptions into final transcript
    const finalTranscript = mergeTranscriptions(validTranscriptions);
    
    console.log(`Generated final transcript: ${finalTranscript.length} characters`);
    
    return new Response(
      JSON.stringify({ 
        transcript: finalTranscript,
        processedChunks: validTranscriptions.length,
        totalChunks: audioChunks.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Dual stream transcription error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        transcript: '',
        processedChunks: 0,
        totalChunks: 0
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});