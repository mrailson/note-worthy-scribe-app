import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: PasswordResetRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    console.log("Generating password reset link for:", email);

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Generate password reset link using Admin API
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: "https://gpnotewell.co.uk/reset-password",
      },
    });

    if (error) {
      console.error("Error generating password reset link:", error);
      throw new Error(error.message);
    }

    if (!data?.properties?.action_link) {
      throw new Error("Failed to generate password reset link - no action link returned");
    }

    const resetLink = data.properties.action_link;
    const userName = email.split("@")[0];

    console.log("Password reset link generated successfully, sending via EmailJS");

    // Get EmailJS credentials
    const serviceId = Deno.env.get("EMAILJS_SERVICE_ID");
    const templateId = Deno.env.get("EMAILJS_TEMPLATE_ID");
    const publicKey = Deno.env.get("EMAILJS_PUBLIC_KEY");
    const privateKey = Deno.env.get("EMAILJS_PRIVATE_KEY");

    if (!serviceId || !templateId || !publicKey) {
      throw new Error("EmailJS credentials not configured");
    }

    // Prepare the EmailJS API request
    const emailjsUrl = "https://api.emailjs.com/api/v1.0/email/send";
    
    const payload = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: {
        to_email: email,
        to_name: userName,
        user_name: userName,
        magic_link: resetLink,
        from_name: "Notewell AI Password Reset",
        reply_to: "malcolm.railson@nhs.net",
        subject: "Password Reset Request - Notewell AI",
        message: `Dear ${userName},

You have requested to reset your password for Notewell AI.

Please click the link below to reset your password:

${resetLink}

This password reset link will expire in 60 minutes for your security.

If you did not request a password reset, please ignore this email or contact support if you have concerns.

Best regards,
Notewell AI Support Team

---
This is an automated message. Please do not reply to this email.`
      }
    };

    console.log("Sending password reset email via EmailJS:", { 
      service_id: serviceId, 
      template_id: templateId,
      to_email: email 
    });

    // Send email via EmailJS API
    const emailjsResponse = await fetch(emailjsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Origin": "https://gpnotewell.co.uk",
        "Referer": "https://gpnotewell.co.uk/"
      },
      body: JSON.stringify(payload),
    });

    if (!emailjsResponse.ok) {
      const errorText = await emailjsResponse.text();
      console.error("EmailJS API error:", errorText);
      throw new Error(`EmailJS API error: ${emailjsResponse.status} - ${errorText}`);
    }

    const result = await emailjsResponse.text();
    console.log("EmailJS response:", result);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password reset email sent successfully via EmailJS",
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
    console.error("Error in generate-password-reset function:", error);
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
