import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 Edge function invoked - method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📡 Processing transcription request');
    
    // Check API keys
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    console.log('🔑 OpenAI API key available:', !!openaiApiKey);
    
    if (!openaiApiKey) {
      console.error('❌ No OpenAI API key found');
      return new Response(JSON.stringify({
        success: false,
        error: 'OpenAI API key not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse form data
    console.log('📥 Parsing form data...');
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      console.error('❌ No audio file in request');
      return new Response(JSON.stringify({
        success: false,
        error: 'No audio file provided'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🎵 Audio file received:', audioFile.size, 'bytes, type:', audioFile.type);

    // Create form data for OpenAI
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile, 'audio.webm');
    whisperFormData.append('model', 'whisper-1');
    
    console.log('📤 Sending to OpenAI Whisper...');
    
    // Call OpenAI Whisper
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: whisperFormData,
    });

    console.log('📥 OpenAI response status:', whisperResponse.status);

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('❌ OpenAI error:', errorText);
      return new Response(JSON.stringify({
        success: false,
        error: `OpenAI error: ${whisperResponse.status}`,
        details: errorText
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const whisperResult = await whisperResponse.json();
    console.log('✅ Transcription successful:', whisperResult.text);

    return new Response(JSON.stringify({
      success: true,
      transcript: whisperResult.text || '',
      confidence: 1.0,
      words: [],
      is_final: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Edge function error:', error);
    console.error('❌ Error stack:', error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});