import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🎙️ Speech-to-text request received');
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { audio } = await req.json();
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('📤 Converting base64 audio to blob...');
    
    // Convert base64 to binary
    const binaryAudio = atob(audio);
    const audioArray = new Uint8Array(binaryAudio.length);
    for (let i = 0; i < binaryAudio.length; i++) {
      audioArray[i] = binaryAudio.charCodeAt(i);
    }
    
    // Create blob and form data
    const audioBlob = new Blob([audioArray], { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    // Force English language to reduce hallucinations
    formData.append('language', 'en');
    // Add prompt to encourage English-only output and reduce hallucinations
    formData.append('prompt', 'This is a professional meeting or consultation recording in English. Please transcribe only clear English speech and ignore background noise, music, or unclear audio.');
    // Set temperature to 0 for more consistent output
    formData.append('temperature', '0');

    console.log('📡 Sending to OpenAI Whisper...');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI error:', errorText);
      throw new Error(`OpenAI error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Transcription successful:', result.text);

    // Remove the prompt text that sometimes appears in transcription results
    let cleanText = result.text || '';
    // Remove various forms of the prompt text that might appear
    cleanText = cleanText.replace(/Please transcribe only clear English speech and ignore background noise[,\s]*music[,\s]*or unclear audio\.?\s*/gi, '');
    cleanText = cleanText.replace(/This is a professional meeting or consultation recording in English\.?\s*/gi, '');
    cleanText = cleanText.trim();
    
    return new Response(JSON.stringify({ 
      text: cleanText 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Speech-to-text error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});