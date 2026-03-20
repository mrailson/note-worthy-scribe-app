import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
    if (!deepgramApiKey) {
      throw new Error('Deepgram API key not configured');
    }

    const { audio, mimeType } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    const resolvedMime = typeof mimeType === 'string' && mimeType.trim() ? mimeType : 'audio/webm';

    console.log('Processing audio chunk with Deepgram, size:', audio.length, 'mime:', resolvedMime);

    // Convert base64 to binary
    const binaryAudio = atob(audio);
    const bytes = new Uint8Array(binaryAudio.length);
    for (let i = 0; i < binaryAudio.length; i++) {
      bytes[i] = binaryAudio.charCodeAt(i);
    }

    console.log('Sending to Deepgram API...');

    // Send to Deepgram API
    const response = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-3&language=en-GB&smart_format=true&diarize=true&punctuate=true',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramApiKey}`,
          'Content-Type': resolvedMime,
        },
        body: bytes,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepgram API error:', response.status, errorText);
      throw new Error(`Deepgram API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    const alt = result?.results?.channels?.[0]?.alternatives?.[0];
    const rawTranscript = alt?.transcript || '';
    const confidence = typeof alt?.confidence === 'number' ? alt.confidence : 0;
    const words = alt?.words || [];

    // Build speaker-labelled transcript from word-level speaker data
    let transcript = rawTranscript;
    if (words.length > 0 && words.some((w: any) => w.speaker !== undefined)) {
      const segments: string[] = [];
      let currentSpeaker = -1;
      let currentWords: string[] = [];
      
      for (const w of words) {
        const speaker = w.speaker ?? 0;
        if (speaker !== currentSpeaker) {
          if (currentWords.length > 0) {
            segments.push(`[Speaker ${currentSpeaker + 1}]: ${currentWords.join(' ')}`);
          }
          currentSpeaker = speaker;
          currentWords = [w.punctuated_word || w.word];
        } else {
          currentWords.push(w.punctuated_word || w.word);
        }
      }
      if (currentWords.length > 0) {
        segments.push(`[Speaker ${currentSpeaker + 1}]: ${currentWords.join(' ')}`);
      }
      transcript = segments.join('\n');
      console.log(`[Standalone-Deepgram] Built speaker-labelled transcript with ${segments.length} segments`);
    }

    console.log('Deepgram transcription result:', (transcript || '[empty]').slice(0, 100) + '...');

    return new Response(
      JSON.stringify({ 
        text: transcript,
        service: 'deepgram',
        confidence
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Standalone Deepgram transcription error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        service: 'deepgram'
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