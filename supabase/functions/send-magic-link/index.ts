import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MagicLinkRequest {
  email: string;
  magic_link: string;
  user_name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, magic_link, user_name }: MagicLinkRequest = await req.json();

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
        to_name: user_name || email.split('@')[0],
        user_name: user_name || email.split('@')[0],
        magic_link: magic_link,
        from_name: "Notewell AI Login Service",
        reply_to: "malcolm.railson@nhs.net",
        subject: "Your Secure Login Link - Notewell AI",
        message: `Dear ${user_name || email.split('@')[0]},

As requested, here is your link to login to Notewell:

${magic_link}

This secure login link will expire in 60 minutes for your security.

Simply click the link above to access your Notewell AI account without needing to enter your password. This bypass method is particularly useful if you're experiencing VPN connectivity issues.

If you have any questions, please contact us on malcolm.railson@nhs.net

Best regards,
Notewell AI Login Service

---
This is an automated message. Please do not reply to this email.
If you did not request this login link, you can safely ignore this email.`
      }
    };

    console.log("Sending magic link email via EmailJS:", { 
      service_id: serviceId, 
      template_id: templateId,
      to_email: email 
    });

    // Send email via EmailJS API
    const emailjsResponse = await fetch(emailjsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Origin": "https://gnotewell.co.uk",
        "Referer": "https://gnotewell.co.uk/"
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
      message: "Magic link email sent successfully via EmailJS"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-magic-link function:", error);
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