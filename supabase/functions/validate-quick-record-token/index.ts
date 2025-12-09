import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up the token
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("quick_record_tokens")
      .select("*")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (tokenError || !tokenRecord) {
      console.error("Token lookup error:", tokenError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token has expired
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Token has expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_used_at
    await supabase
      .from("quick_record_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenRecord.id);

    // Get user details
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
      tokenRecord.user_id
    );

    if (userError || !userData.user) {
      console.error("User lookup error:", userError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a magic link for the user (creates a session)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email!,
      options: {
        redirectTo: `${req.headers.get("origin") || supabaseUrl}/?autoStart=true`,
      },
    });

    if (linkError) {
      console.error("Magic link generation error:", linkError);
      return new Response(
        JSON.stringify({ error: "Failed to generate session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract the token from the magic link to use for session creation
    const magicLinkUrl = new URL(linkData.properties.action_link);
    const authToken = magicLinkUrl.searchParams.get("token");
    const tokenType = magicLinkUrl.searchParams.get("type");

    return new Response(
      JSON.stringify({
        success: true,
        user_id: tokenRecord.user_id,
        email: userData.user.email,
        auth_token: authToken,
        token_type: tokenType,
        redirect_url: `/?autoStart=true`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
