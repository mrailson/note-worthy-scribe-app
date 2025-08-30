import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client',
};

serve(async (req) => {
  console.log('📨 SPEECH-TO-TEXT: Request received:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ SPEECH-TO-TEXT: Handling CORS preflight');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔑 SPEECH-TO-TEXT: Getting OpenAI API key...');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      console.error('❌ SPEECH-TO-TEXT: OpenAI API key not found');
      throw new Error('OpenAI API key not configured');
    }

    console.log('📥 SPEECH-TO-TEXT: Parsing request body...');
    const { audio } = await req.json();
    
    if (!audio) {
      console.error('❌ SPEECH-TO-TEXT: No audio data provided');
      throw new Error('No audio data provided');
    }

    console.log('📊 SPEECH-TO-TEXT: Audio data received, size:', audio.length, 'characters');

    // Convert base64 to binary
    console.log('🔄 SPEECH-TO-TEXT: Converting base64 to audio file...');
    const binaryString = atob(audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log('📦 SPEECH-TO-TEXT: Created audio buffer, size:', bytes.length, 'bytes');

    // Create form data for OpenAI API
    const formData = new FormData();
    const audioBlob = new Blob([bytes], { type: 'audio/webm' });
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('prompt', 'This is an English language meeting or consultation recording.');
    formData.append('response_format', 'json');

    console.log('📡 SPEECH-TO-TEXT: Sending request to OpenAI Whisper API...');
    
    // Send to OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    console.log('📨 SPEECH-TO-TEXT: OpenAI response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ SPEECH-TO-TEXT: OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ SPEECH-TO-TEXT: Transcription successful, text length:', result.text?.length || 0);
    console.log('📝 SPEECH-TO-TEXT: Transcript preview:', result.text?.slice(0, 100) + '...');

    return new Response(
      JSON.stringify({ 
        text: result.text || '',
        confidence: 0.95 // Default confidence for Whisper
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ SPEECH-TO-TEXT: Error processing request:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to transcribe audio',
        details: error.toString()
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