import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  to_email: string;
  user_name: string;
  user_email: string;
  temporary_password: string;
  user_role: string;
  practice_name: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const emailData: WelcomeEmailRequest = await req.json();

    // Get EmailJS credentials from Supabase secrets
    const serviceId = Deno.env.get("EMAILJS_SERVICE_ID");
    const templateId = Deno.env.get("EMAILJS_TEMPLATE_ID");
    const publicKey = Deno.env.get("EMAILJS_PUBLIC_KEY");
    const privateKey = Deno.env.get("EMAILJS_PRIVATE_KEY");

    if (!serviceId || !templateId || !publicKey) {
      throw new Error("EmailJS credentials not configured");
    }

    // Prepare the EmailJS API request for welcome email
    const emailjsUrl = "https://api.emailjs.com/api/v1.0/email/send";
    
    const welcomeEmailContent = `
Dear ${emailData.user_name},

Welcome to Notewell AI Meeting Notes Service!

Your account has been successfully created with the following details:

• Email: ${emailData.user_email}
• Role: ${emailData.user_role.replace('_', ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())}
• Practice: ${emailData.practice_name}
• Temporary Password: ${emailData.temporary_password}

ABOUT NOTEWELL AI MEETING NOTES SERVICE:

Notewell AI is a revolutionary healthcare meeting documentation service designed specifically for NHS practices and healthcare organizations. Our platform transforms how you capture, organize, and share meeting insights.

KEY FEATURES:
✓ Real-time AI transcription during meetings
✓ Automatic generation of meeting summaries and action items
✓ NHS-compliant data security and privacy protection
✓ Integration with healthcare workflows
✓ Searchable meeting archives
✓ Customizable templates for different meeting types
✓ Automated distribution of meeting notes to attendees

GETTING STARTED:
1. Visit: https://notewell.dialai.co.uk/
2. Sign in using your email address: ${emailData.user_email}
3. Use your temporary password: ${emailData.temporary_password}
4. You'll be prompted to change your password on first login

SECURITY NOTE:
Please change your temporary password immediately after logging in for security purposes.

If you have any questions or need assistance, please don't hesitate to contact our support team.

Best regards,
The Notewell AI Team

---
This is an automated message. Please do not reply to this email.
`;

    const payload = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: {
        to_email: emailData.to_email,
        subject: "Welcome to Notewell AI Meeting Notes Service",
        message: welcomeEmailContent
      }
    };

    console.log("Sending welcome email via EmailJS to:", emailData.to_email);

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
    console.log("Welcome email sent successfully:", result);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Welcome email sent successfully",
      emailjs_response: result
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
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