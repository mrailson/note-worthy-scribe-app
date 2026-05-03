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
      return new Response(JSON.stringify({ error: 'Deepgram API key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action } = await req.json();
    if (action !== 'connect') {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!deepgramProjectId) {
      return new Response(JSON.stringify({
        error: 'DEEPGRAM_PROJECT_ID secret not configured — cannot mint ephemeral key',
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Mint an ephemeral Deepgram key (15 min) and embed THAT in the websocket URL —
    // never the master key.
    const ttlSeconds = 900;
    const expirationDate = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const mintRes = await fetch(`${DEEPGRAM_API_BASE}/projects/${deepgramProjectId}/keys`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: `realtime-${claimsData.claims.sub}-${Date.now()}`,
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
      diarize: 'true',
      multichannel: 'false',
      alternatives: '1',
      numerals: 'true',
      sentiment: 'false',
      summarize: 'false',
      detect_topics: 'false',
      detect_entities: 'false',
    }) + `&token=${mintData.key}`;

    return new Response(JSON.stringify({
      websocketUrl,
      expires_in: ttlSeconds,
      status: 'success',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Error in deepgram-realtime function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
