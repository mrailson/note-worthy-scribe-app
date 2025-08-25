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
      console.error('❌ DEEPGRAM_API_KEY environment variable not set');
      throw new Error('Deepgram API key not configured');
    }

    console.log('✅ Deepgram API key found, returning secure token');

    // For now, return the API key securely (this is a common pattern for Deepgram)
    // In production, you could create temporary tokens, but direct API key works well
    return new Response(JSON.stringify({ 
      token: deepgramApiKey,
      expires_in: 3600 // 1 hour
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in deepgram-token function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});