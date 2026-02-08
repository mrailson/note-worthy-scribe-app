import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🎯 Deepgram Realtime Token request received');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
    if (!DEEPGRAM_API_KEY) {
      console.error('❌ DEEPGRAM_API_KEY is not set');
      throw new Error('Deepgram API key is not configured');
    }

    console.log('✅ DEEPGRAM_API_KEY found, length:', DEEPGRAM_API_KEY.length);

    const { language, medicalBias, model } = await req.json().catch(() => ({}));
    console.log('📝 Request params:', { language, medicalBias, model });

    // Configure Deepgram parameters
    const deepgramModel = model || (medicalBias ? 'nova-3-medical' : 'nova-3');
    const languageCode = language === 'auto' ? 'en' : (language || 'en');

    // Create WebSocket URL with authentication token for Deepgram Streaming API
    const wsUrl = new URL('wss://api.deepgram.com/v1/listen');
    wsUrl.searchParams.set('model', deepgramModel);
    wsUrl.searchParams.set('language', languageCode);
    wsUrl.searchParams.set('encoding', 'linear16');
    wsUrl.searchParams.set('sample_rate', '24000');
    wsUrl.searchParams.set('channels', '1');
    wsUrl.searchParams.set('interim_results', 'true');
    wsUrl.searchParams.set('smart_format', 'true');
    wsUrl.searchParams.set('punctuate', 'true');
    wsUrl.searchParams.set('profanity_filter', 'false');
    wsUrl.searchParams.set('redact', 'false');
    wsUrl.searchParams.set('diarize', 'false');
    wsUrl.searchParams.set('filler_words', 'false');
    wsUrl.searchParams.set('numerals', 'true');
    wsUrl.searchParams.set('vad_events', 'true');
    // Include token in URL for authentication
    wsUrl.searchParams.set('token', DEEPGRAM_API_KEY);
    
    if (medicalBias) {
      wsUrl.searchParams.set('keywords', 'NHS:3,GP:3,prescription:2,medication:2,diagnosis:2,treatment:2,patient:2,clinical:2,medical:2');
    }

    console.log('📡 Deepgram WebSocket URL configured (token hidden)');

    // Return configuration for client to connect
    const sessionConfig = {
      url: wsUrl.toString(),
      token: DEEPGRAM_API_KEY,
      model: deepgramModel,
      language: languageCode,
      medicalBias,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
      // For compatibility with existing frontend code
      client_secret: {
        value: DEEPGRAM_API_KEY
      }
    };

    console.log('✅ Deepgram session configured successfully');

    return new Response(JSON.stringify(sessionConfig), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("❌ Error creating Deepgram session:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to create Deepgram realtime session'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});