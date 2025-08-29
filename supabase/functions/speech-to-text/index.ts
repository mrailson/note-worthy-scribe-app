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

    const { audioData, mimeType, language, temperature, prompt } = await req.json();
    if (!audioData) {
      throw new Error('No audio data provided');
    }

    console.log('📤 Processing binary audio data...', {
      audioLength: audioData.length,
      mimeType: mimeType || 'audio/webm',
      language: language || 'en'
    });
    
    // Convert byte array back to Uint8Array
    const audioArray = new Uint8Array(audioData);
    
    console.log('✅ Audio data processed:', {
      arrayLength: audioArray.length,
      sizeInKB: Math.round(audioArray.length / 1024)
    });
    
    // Create blob and form data using known-good approach
    const audioBlob = new Blob([audioArray], { type: mimeType || 'audio/webm' });
    const formData = new FormData();
    formData.append('file', audioBlob, 'chunk.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', language || 'en');
    formData.append('temperature', String(temperature ?? 0));
    
    // Add NHS-specific prompt for better transcription accuracy
    if (prompt) {
      formData.append('prompt', prompt);
    }

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
    console.log('✅ Transcription successful:', result.text || 'No text returned');

    return new Response(JSON.stringify({ 
      text: result.text || '',
      confidence: 0.9 // Default confidence for successful transcriptions
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