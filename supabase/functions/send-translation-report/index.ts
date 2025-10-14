import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TranslationEntry {
  speaker: string;
  originalText: string;
  translatedText: string;
  timestamp: string;
}

interface EmailRequest {
  recipientEmail: string;
  sessionTitle: string;
  targetLanguage: string;
  translations: TranslationEntry[];
  sessionStart: string;
  sessionDuration: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const { recipientEmail, sessionTitle, targetLanguage, translations, sessionStart, sessionDuration }: EmailRequest =
      await req.json();

    // Generate HTML email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background-color: #005EB8; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .translation-entry { background-color: #f8f9fa; border-left: 4px solid #005EB8; padding: 15px; margin: 15px 0; }
            .speaker { font-weight: bold; color: #005EB8; }
            .timestamp { font-size: 0.85em; color: #666; }
            .footer { background-color: #f8f9fa; padding: 15px; text-align: centre; font-size: 0.85em; color: #666; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>NHS Translation Service Report</h1>
          </div>
          <div class="content">
            <h2>${sessionTitle}</h2>
            <p><strong>Target Language:</strong> ${targetLanguage}</p>
            <p><strong>Session Start:</strong> ${new Date(sessionStart).toLocaleString('en-GB')}</p>
            <p><strong>Duration:</strong> ${sessionDuration}</p>
            <p><strong>Total Translations:</strong> ${translations.length}</p>
            
            <h3>Translation History:</h3>
            ${translations
              .map(
                (t, idx) => `
              <div class="translation-entry">
                <div class="speaker">${idx + 1}. ${t.speaker === 'gp' ? '👨‍⚕️ GP' : '👤 Patient'}</div>
                <div class="timestamp">${new Date(t.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                <p><strong>Original:</strong> ${t.originalText}</p>
                <p><strong>Translation:</strong> ${t.translatedText}</p>
              </div>
            `
              )
              .join("")}
          </div>
          <div class="footer">
            <p>This is an automated translation report from the NHS Translation Service.</p>
            <p><em>Please note: Automated translations may not be 100% accurate. Review carefully for medical contexts.</em></p>
          </div>
        </body>
      </html>
    `;

    // Send email using Resend (you'll need to add RESEND_API_KEY secret)
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "NHS Translation Service <onboarding@resend.dev>",
        to: [recipientEmail],
        subject: `Translation Report - ${sessionTitle}`,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend API error:", errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const emailData = await emailResponse.json();
    console.log("Email sent successfully:", emailData);

    return new Response(JSON.stringify({ success: true, emailData }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-translation-report function:", error);
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
