import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GenerateMagicLinkRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: GenerateMagicLinkRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    console.log("Generating magic link for:", email);

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Generate magic link using Admin API
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: email,
    });

    // NOTE: We don't use redirectTo here because we'll build our own confirmation URL

    if (error) {
      console.error("Error generating magic link:", error);
      throw new Error(error.message);
    }

    if (!data?.properties?.hashed_token) {
      throw new Error("Failed to generate magic link - no hashed token returned");
    }

    // Build a confirmation URL that goes to our auth-confirm page first
    // This prevents email security scanners from consuming the one-time token
    const tokenHash = data.properties.hashed_token;
    const confirmUrl = `https://gpnotewell.co.uk/auth-confirm?token_hash=${tokenHash}&type=magiclink&redirect_to=${encodeURIComponent('https://gpnotewell.co.uk/')}`;
    
    const userName = email.split("@")[0];

    console.log("Magic link generated successfully, sending via EmailJS");

    // Send the email via the send-magic-link function
    const sendEmailResponse = await fetch(
      `${supabaseUrl}/functions/v1/send-magic-link`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          email: email,
          magic_link: confirmUrl,
          user_name: userName,
        }),
      }
    );

    if (!sendEmailResponse.ok) {
      const errorText = await sendEmailResponse.text();
      console.error("Error sending magic link email:", errorText);
      throw new Error(`Failed to send magic link email: ${errorText}`);
    }

    const sendResult = await sendEmailResponse.json();
    console.log("Magic link email sent successfully:", sendResult);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Magic link sent successfully via EmailJS",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in generate-magic-link function:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
