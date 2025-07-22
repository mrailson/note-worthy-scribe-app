import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
  reset_link: string;
  user_name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, reset_link, user_name }: PasswordResetRequest = await req.json();

    // Get EmailJS credentials from Supabase secrets
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
        user_name: user_name || email.split('@')[0],
        reset_link: reset_link,
        from_name: "Notewell AI Support"
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

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Password reset email sent successfully via EmailJS"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-password-reset-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);