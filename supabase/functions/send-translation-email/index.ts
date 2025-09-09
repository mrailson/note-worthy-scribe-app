import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

    const emailResponse = await resend.emails.send({
      from: "AI4GP Translation <onboarding@resend.dev>",
      to: [to],
      subject: subject,
      html: emailContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
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