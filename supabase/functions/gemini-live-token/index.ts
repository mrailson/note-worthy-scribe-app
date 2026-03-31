import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    const model = "gemini-3.1-flash-live-preview";

    // Mint an ephemeral token via the Gemini Auth Tokens API
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    const tokenResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1alpha/authTokens?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uses: 1,
          expire_time: expireTime,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("Ephemeral token error:", tokenResponse.status, errText);
      throw new Error(`Failed to create ephemeral token: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    console.log("Ephemeral token created:", tokenData.name ? "success" : "no name field", JSON.stringify(Object.keys(tokenData)));

    return new Response(
      JSON.stringify({
        token: tokenData.name, // e.g. "auth_tokens/abc123..."
        model,
        expiresAt: expireTime,
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
