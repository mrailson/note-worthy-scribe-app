import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🎯 OpenAI Realtime Token request received');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY is not set');
      throw new Error('OpenAI API key is not configured');
    }

    console.log('✅ OPENAI_API_KEY found, length:', OPENAI_API_KEY.length);

    const { language, medicalBias } = await req.json().catch(() => ({}));
    console.log('📝 Request params:', { language, medicalBias });

    const instructions = medicalBias 
      ? "You are a medical transcription AI. Transcribe UK primary care speech with medical abbreviations (e.g., PCN DES, CQC, ARRS). Preserve drug names, doses, routes, and timings accurately. Use UK spelling. Focus on medical terminology and be precise with clinical language."
      : "Transcribe speech clearly and accurately. Use appropriate punctuation and formatting.";

    console.log('📡 Creating realtime session with OpenAI...');

    const requestBody = {
      model: "gpt-4o-realtime-preview-2024-12-17",
      voice: "alloy",
      instructions,
      modalities: ["text", "audio"],
      input_audio_format: "pcm16",
      output_audio_format: "pcm16",
      input_audio_transcription: {
        model: "whisper-1"
      },
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500
      }
    };

    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

    // Request an ephemeral token from OpenAI Realtime API
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Session created successfully:', data.id);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("❌ Error creating realtime session:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to create OpenAI realtime session'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});