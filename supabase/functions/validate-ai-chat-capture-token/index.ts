import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, shortCode } = await req.json();

    if (!token && !shortCode) {
      return new Response(
        JSON.stringify({ valid: false, error: "Token or short code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const lookupValue = shortCode || token;
    const lookupField = shortCode ? "short_code" : "session_token";
    console.log(`Validating AI chat capture by ${lookupField}:`, lookupValue.substring(0, 6) + "...");

    // Look up the session by short_code or session_token
    const { data: session, error: sessionError } = await supabase
      .from("ai_chat_capture_sessions")
      .select("id, user_id, expires_at, is_active")
      .eq(lookupField, lookupValue)
      .single();

    if (sessionError || !session) {
      console.error("Session lookup error:", sessionError);
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid or expired session" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if session is active
    if (!session.is_active) {
      return new Response(
        JSON.stringify({ valid: false, error: "Session is no longer active" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if session has expired
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: "Session has expired" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Session validated successfully:", session.id);

    return new Response(
      JSON.stringify({
        valid: true,
        session_id: session.id,
        user_id: session.user_id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ valid: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
