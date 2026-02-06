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
    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
    
    if (!deepgramApiKey) {
      throw new Error('Deepgram API key not configured');
    }

    const { action } = await req.json();

    if (action === 'connect') {
      // Generate Deepgram WebSocket URL with API key
      const websocketUrl = `wss://api.deepgram.com/v1/listen?` + new URLSearchParams({
        model: 'nova-3',
        language: 'en-GB',
        smart_format: 'true',
        interim_results: 'true',
        endpointing: '300',
        vad_events: 'true',
        punctuate: 'true',
        profanity_filter: 'false',
        redact: 'false',
        diarize: 'false',
        multichannel: 'false',
        alternatives: '1',
        numerals: 'true',
        search: '',
        replace: '',
        keywords: '',
        sentiment: 'false',
        summarize: 'false',
        detect_topics: 'false',
        detect_entities: 'false'
      }) + `&token=${deepgramApiKey}`;

      return new Response(JSON.stringify({ 
        websocketUrl,
        status: 'success' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Invalid action' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in deepgram-realtime function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});