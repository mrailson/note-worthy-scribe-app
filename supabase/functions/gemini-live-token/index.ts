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
    // ---- AUTH GUARD ----
    const __authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!__authHeader || !__authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    {
      const __token = __authHeader.replace("Bearer ", "");
      const __supaUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const __supaAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const __vr = await fetch(`${__supaUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${__token}`, apikey: __supaAnon },
      });
      if (!__vr.ok) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    // ---- /AUTH GUARD ----

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const model = "gemini-3.1-flash-live-preview";
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // Mint ephemeral token via Gemini auth_tokens endpoint
    const tokenResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key=${GEMINI_API_KEY}`,
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
      throw new Error(`Failed to create ephemeral token: ${tokenResponse.status} ${errText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log("Ephemeral token created successfully:", tokenData.name?.substring(0, 30));

    if (!tokenData.name) {
      throw new Error("No token name in response");
    }

    return new Response(
      JSON.stringify({
        token: tokenData.name,
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
