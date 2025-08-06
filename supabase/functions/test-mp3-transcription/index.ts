import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return new Response(JSON.stringify({ error: 'No audio file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing audio file: ${audioFile.name}, size: ${audioFile.size} bytes, type: ${audioFile.type}`);

    // Create a new file with proper format for Whisper
    let processedFile = audioFile;
    
    // If it's WebM, rename it to ensure Whisper accepts it
    if (audioFile.type.includes('webm') || audioFile.name.includes('.webm')) {
      console.log('Converting WebM file for Whisper compatibility...');
      processedFile = new File([audioFile], 'audio.webm', { type: 'audio/webm' });
    }

    // Prepare form data for OpenAI
    const whisperFormData = new FormData();
    whisperFormData.append('file', processedFile);
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('language', 'en');
    whisperFormData.append('response_format', 'verbose_json');
    whisperFormData.append('temperature', '0');
    // Remove the prompt to prevent hallucinations - let Whisper transcribe without context
    // whisperFormData.append('prompt', '');

    console.log("Sending MP3 to OpenAI Whisper API...");
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: whisperFormData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Whisper API failed:", response.status, errorText);
      return new Response(JSON.stringify({ 
        error: `Whisper API error: ${response.status}`,
        details: errorText 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    console.log("Whisper transcription result:", result.text);

    // Calculate confidence score
    let confidence = 0.5;
    if (result.segments && result.segments.length > 0) {
      const avgLogProb = result.segments.reduce((sum: number, seg: any) => 
        sum + (seg.avg_logprob || -2), 0) / result.segments.length;
      const avgNoSpeech = result.segments.reduce((sum: number, seg: any) => 
        sum + (seg.no_speech_prob || 0.5), 0) / result.segments.length;
      
      confidence = Math.max(0, Math.min(1, 
        (avgLogProb + 1) / 1 * (1 - avgNoSpeech)
      ));
    }

    return new Response(JSON.stringify({
      text: result.text || '',
      confidence: confidence,
      duration: result.duration,
      language: result.language,
      segments: result.segments || [],
      raw_response: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error in MP3 transcription test:", error);
    return new Response(JSON.stringify({ 
      error: `MP3 transcription error: ${error.message}`,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});