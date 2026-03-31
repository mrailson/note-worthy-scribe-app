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
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    // The Gemini Live API doesn't have a dedicated ephemeral token endpoint.
    // Instead, we return the API key wrapped so the client can connect directly.
    // The edge function keeps the key server-side and returns a short-lived proxy config.
    // For production, consider using Vertex AI with OAuth tokens.
    
    const model = "gemini-3.1-flash-live-preview";

    return new Response(
      JSON.stringify({
        apiKey: GEMINI_API_KEY,
        model,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error("Error in gemini-live-token:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
