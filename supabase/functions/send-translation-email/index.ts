import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  translatedText: string;
  originalText?: string;
  isPatientEmail?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, translatedText, originalText, isPatientEmail }: EmailRequest = await req.json();

    console.log("Sending translation email to:", to);

    const emailContent = isPatientEmail 
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            Document Translation
          </h1>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #374151; margin-top: 0;">Translated Document:</h2>
            <div style="background-color: white; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">
              ${translatedText.replace(/\n/g, '<br>')}
            </div>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            This is an automated translation. Please consult with your healthcare provider for any questions.
          </p>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            Document Translation Report
          </h1>
          
          ${originalText ? `
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #92400e; margin-top: 0;">Original Text:</h2>
            <div style="background-color: white; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">
              ${originalText.replace(/\n/g, '<br>')}
            </div>
          </div>
          ` : ''}
          
          <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #065f46; margin-top: 0;">Translated Text:</h2>
            <div style="background-color: white; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">
              ${translatedText.replace(/\n/g, '<br>')}
            </div>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Generated on: ${new Date().toLocaleString()}<br>
            This translation was processed using AI translation services.
          </p>
        </div>
      `;

    // Get EmailJS configuration from environment variables
    const serviceId = Deno.env.get("EMAILJS_SERVICE_ID");
    const templateId = Deno.env.get("EMAILJS_TEMPLATE_ID");
    const publicKey = Deno.env.get("EMAILJS_PUBLIC_KEY");
    const privateKey = Deno.env.get("EMAILJS_PRIVATE_KEY");

    if (!serviceId || !templateId || !publicKey || !privateKey) {
      throw new Error("EmailJS configuration is missing");
    }

    // Prepare EmailJS request
    const emailJSData = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: {
        to_email: to,
        subject: subject,
        message: emailContent,
        from_name: "AI4GP Translation Service"
      }
    };

    // Send email via EmailJS
    const emailResponse = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      body: JSON.stringify(emailJSData)
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`EmailJS API error: ${emailResponse.status} - ${errorText}`);
    }

    console.log("Email sent successfully via EmailJS");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-translation-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);