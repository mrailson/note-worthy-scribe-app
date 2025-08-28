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
    const apiKey = Deno.env.get('ASSEMBLYAI_API_KEY');
    if (!apiKey) {
      console.error('[AssemblyAI-Token] Missing ASSEMBLYAI_API_KEY env var');
      return new Response(JSON.stringify({ error: "Missing ASSEMBLYAI_API_KEY env var" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[AssemblyAI-Token] Minting realtime token...');

    // Mint a short-lived realtime token
    const response = await fetch("https://api.assemblyai.com/v2/realtime/token", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expires_in: 3600 }), // 1 hour
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[AssemblyAI-Token] Token mint failed:', response.status, text);
      return new Response(JSON.stringify({ error: `Token mint failed: ${text}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json(); // { token: "..." }
    console.log('[AssemblyAI-Token] Token minted successfully');
    
    return new Response(JSON.stringify({ token: data.token }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[AssemblyAI-Token] Error:', err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});