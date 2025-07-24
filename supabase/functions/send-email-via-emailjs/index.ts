import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  // Meeting summary email fields
  to_email?: string;
  all_emails?: string;
  meeting_title?: string;
  meeting_date?: string;
  duration?: string;
  practice_name?: string;
  meeting_notes?: string;
  include_transcript?: string;
  transcript?: string;
  from_name?: string;
  reply_to?: string;
  
  // Welcome email fields
  user_name?: string;
  user_email?: string;
  temporary_password?: string;
  user_role?: string;
  template_type?: string;
  login_url?: string;
  support_email?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const emailData: EmailRequest = await req.json();

    // Get EmailJS credentials from Supabase secrets
    const serviceId = Deno.env.get("EMAILJS_SERVICE_ID");
    const templateId = Deno.env.get("EMAILJS_TEMPLATE_ID");
    const publicKey = Deno.env.get("EMAILJS_PUBLIC_KEY");
    const privateKey = Deno.env.get("EMAILJS_PRIVATE_KEY");

    if (!serviceId || !templateId || !publicKey) {
      throw new Error("EmailJS credentials not configured");
    }

    // Enhance the email data for welcome emails
    let enhancedEmailData = { ...emailData };
    
    if (emailData.template_type === 'welcome') {
      enhancedEmailData = {
        ...emailData,
        login_url: `https://dphcnbricafkbtizkoal.supabase.co/auth/v1/authorize?redirect_to=${encodeURIComponent('https://91f61816-7ac8-43e0-a21d-31572f57dcab.lovableproject.com/')}`,
        support_email: "support@gp-tools.nhs.uk",
        app_name: "GP Tools Suite"
      };
    }

    // Prepare the EmailJS API request
    const emailjsUrl = "https://api.emailjs.com/api/v1.0/email/send";
    
    const payload = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: enhancedEmailData
    };

    console.log("Sending email via EmailJS:", { 
      service_id: serviceId, 
      template_id: templateId,
      to_email: emailData.to_email,
      template_type: emailData.template_type || 'meeting',
      user_name: emailData.user_name,
      meeting_title: emailData.meeting_title 
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
      message: "Email sent successfully via EmailJS",
      emailjs_response: result
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-email-via-emailjs function:", error);
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