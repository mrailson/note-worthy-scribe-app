import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  userEmail: string;
  meetingTitle: string;
  audioUrl: string;
  scriptText: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, meetingTitle, audioUrl, scriptText }: EmailRequest = await req.json();

    console.log(`📧 Sending audio summary email to: ${userEmail}`);

    // Validate required fields
    if (!userEmail || !meetingTitle || !audioUrl || !scriptText) {
      throw new Error("Missing required fields: userEmail, meetingTitle, audioUrl, or scriptText");
    }

    const emailResponse = await resend.emails.send({
      from: "NoteWell AI <onboarding@resend.dev>",
      to: [userEmail],
      subject: `Audio Overview: ${meetingTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px 20px;
                border-radius: 8px 8px 0 0;
                text-align: center;
              }
              .content {
                background: #f9fafb;
                padding: 30px 20px;
                border: 1px solid #e5e7eb;
                border-top: none;
              }
              .button {
                display: inline-block;
                background: #667eea;
                color: white !important;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                margin: 20px 0;
              }
              .script-section {
                background: white;
                padding: 20px;
                border-radius: 6px;
                border-left: 4px solid #667eea;
                margin: 20px 0;
                white-space: pre-wrap;
                word-wrap: break-word;
                font-size: 14px;
                line-height: 1.8;
              }
              .divider {
                border: none;
                border-top: 2px solid #e5e7eb;
                margin: 30px 0;
              }
              .footer {
                text-align: center;
                color: #6b7280;
                font-size: 12px;
                padding: 20px;
              }
              h1 {
                margin: 0;
                font-size: 24px;
              }
              h2 {
                color: #374151;
                font-size: 18px;
                margin-top: 0;
              }
              .icon {
                font-size: 32px;
                margin-bottom: 10px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="icon">🎧</div>
              <h1>Audio Overview Ready</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Your meeting audio summary is ready to listen</p>
            </div>
            
            <div class="content">
              <h2>Meeting: ${meetingTitle}</h2>
              
              <p>Your audio summary is ready. You can listen to it or download it using the link below:</p>
              
              <a href="${audioUrl}" class="button">🎧 Listen/Download Audio</a>
              
              <hr class="divider">
              
              <h2>Narration Script</h2>
              <div class="script-section">${scriptText}</div>
              
              <hr class="divider">
            </div>
            
            <div class="footer">
              <p>This email was sent from <strong>NoteWell AI</strong></p>
              <p>You received this because you requested an audio overview via the NoteWell platform.</p>
            </div>
          </body>
        </html>
      `,
    });

    console.log("✅ Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("❌ Error in send-audio-email-resend function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: "Failed to send audio summary email" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
