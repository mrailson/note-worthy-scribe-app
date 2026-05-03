import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEEPGRAM_API_BASE = 'https://api.deepgram.com/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- AUTH GUARD ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid authentication token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // ---- /AUTH GUARD ----

    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
    const deepgramProjectId = Deno.env.get('DEEPGRAM_PROJECT_ID');
    if (!deepgramApiKey) {
      console.error('❌ DEEPGRAM_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Deepgram API key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mint an ephemeral Deepgram key (1 hour TTL) instead of returning the master key.
    if (!deepgramProjectId) {
      console.error('❌ DEEPGRAM_PROJECT_ID not configured — cannot mint ephemeral keys');
      return new Response(JSON.stringify({
        error: 'Deepgram project id not configured. Add DEEPGRAM_PROJECT_ID secret to enable ephemeral tokens.',
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const ttlSeconds = 3600;
    const expirationDate = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const mintRes = await fetch(`${DEEPGRAM_API_BASE}/projects/${deepgramProjectId}/keys`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: `ephemeral-${claimsData.claims.sub}-${Date.now()}`,
        scopes: ['usage:write'],
        expiration_date: expirationDate,
      }),
    });

    if (!mintRes.ok) {
      const errText = await mintRes.text();
      console.error('Deepgram key mint failed:', mintRes.status, errText);
      return new Response(JSON.stringify({ error: 'Failed to mint ephemeral key' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const mintData = await mintRes.json();

    return new Response(JSON.stringify({
      token: mintData.key,
      key_id: mintData.api_key_id,
      expires_in: ttlSeconds,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Error in deepgram-token function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
