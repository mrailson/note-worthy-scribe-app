import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ChatEmailRequest {
  recipientEmails: string[];
  subject: string;
  chatContent: string;
  senderName: string;
  additionalNotes?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-chat-email function invoked");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmails, subject, chatContent, senderName, additionalNotes }: ChatEmailRequest = await req.json();

    console.log("Sending email to:", recipientEmails);
    console.log("Subject:", subject);

    if (!recipientEmails || recipientEmails.length === 0) {
      throw new Error("No recipient emails provided");
    }

    if (!chatContent) {
      throw new Error("No chat content provided");
    }

    // Build the email HTML
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
            .chat-content { background: white; padding: 16px; border-radius: 6px; border: 1px solid #e5e7eb; white-space: pre-wrap; font-size: 14px; }
            .notes { margin-top: 16px; padding: 12px; background: #fef3c7; border-radius: 6px; border-left: 4px solid #f59e0b; }
            .footer { margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
            h1 { margin: 0; font-size: 20px; }
            .from { margin-top: 8px; font-size: 14px; opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>AI4PM Chat Summary</h1>
            <div class="from">Shared by ${senderName}</div>
          </div>
          <div class="content">
            <div class="chat-content">${chatContent.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>
            ${additionalNotes ? `<div class="notes"><strong>Additional Notes:</strong><br>${additionalNotes.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>` : ''}
          </div>
          <div class="footer">
            <p>This email was sent from AI4PM - AI for Practice Management</p>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "AI4PM <onboarding@resend.dev>",
      to: recipientEmails,
      subject: subject,
      html: html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-chat-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
