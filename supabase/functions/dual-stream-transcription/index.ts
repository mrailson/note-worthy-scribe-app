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
  mimeType?: string; // Original MIME type
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

// Convert WebM audio chunk to WAV format
function convertToWav(audioBytes: Uint8Array): Uint8Array {
  // Simple WAV header for 16kHz mono audio
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = audioBytes.length;
  const fileSize = 36 + dataSize;

  const wav = new Uint8Array(44 + dataSize);
  const view = new DataView(wav.buffer);

  // RIFF header
  wav.set(new TextEncoder().encode('RIFF'), 0);
  view.setUint32(4, fileSize, true);
  wav.set(new TextEncoder().encode('WAVE'), 8);

  // fmt chunk
  wav.set(new TextEncoder().encode('fmt '), 12);
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  wav.set(new TextEncoder().encode('data'), 36);
  view.setUint32(40, dataSize, true);
  
  // Copy audio data (assuming it's already PCM data)
  wav.set(audioBytes, 44);

  return wav;
}

// Transcribe audio using Deepgram
async function transcribeAudio(audioBase64: string, stream: string, chunk: AudioChunk): Promise<string> {
  const deepgramKey = Deno.env.get('DEEPGRAM_API_KEY');
  
  if (!deepgramKey) {
    throw new Error('Deepgram API key not configured');
  }

  try {
    // Convert base64 to proper binary data
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log(`Converting ${stream} audio: ${bytes.length} bytes, original MIME: ${chunk.mimeType || 'unknown'}`);
    
    // Check if audio data is too small to be valid
    if (bytes.length < 500) {
      console.log(`Skipping ${stream} audio: too small (${bytes.length} bytes)`);
      return '';
    }
    
    // Convert to WAV format for better compatibility
    const wavBytes = convertToWav(bytes);
    
    console.log(`Transcribing ${stream} audio chunk (${wavBytes.length} bytes WAV) with Deepgram`);

    // Send WAV data to Deepgram
    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramKey}`,
        'Content-Type': 'audio/wav',
      },
      body: wavBytes,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Deepgram API error for ${stream}:`, errorText);
      throw new Error(`Deepgram API error: ${errorText}`);
    }

    const result = await response.json();
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    console.log(`${stream} transcription result:`, transcript || 'No text returned');
    return transcript;
    
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
    
    // Filter out chunks that are too small or potentially malformed
    const validChunks = audioChunks.filter(chunk => {
      if (!chunk.audio || chunk.audio.length < 100) {
        console.log(`Skipping invalid ${chunk.stream} chunk: too small or empty`);
        return false;
      }
      return true;
    });
    
    console.log(`Valid chunks after filtering: ${validChunks.length}/${audioChunks.length}`);
    
    if (validChunks.length === 0) {
      console.log('No valid chunks to process');
      return new Response(
        JSON.stringify({ 
          transcript: '',
          processedChunks: 0,
          totalChunks: audioChunks.length
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Process all valid audio chunks in parallel
    const transcriptionPromises = validChunks.map(async (chunk: AudioChunk) => {
      const text = await transcribeAudio(chunk.audio, chunk.stream, chunk);
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