import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MeetingEmailRequest {
  to_email: string;
  cc_emails?: string[];
  subject: string;
  html_content: string;
  from_name?: string;
  word_attachment?: {
    content: string;
    filename: string;
    type: string;
  };
  audio_attachment?: {
    content: string;
    filename: string;
    type: string;
  };
  extra_attachments?: Array<{
    content: string;
    filename: string;
    type: string;
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const emailData: MeetingEmailRequest = await req.json();
    
    console.log("📧 Received meeting email request:", {
      to: emailData.to_email,
      cc: emailData.cc_emails?.length || 0,
      subject: emailData.subject,
      hasWordAttachment: !!emailData.word_attachment,
      hasAudioAttachment: !!emailData.audio_attachment,
      extraAttachments: emailData.extra_attachments?.length || 0
    });

    // Validate required fields
    if (!emailData.to_email) {
      console.error("Missing recipient email");
      return new Response(JSON.stringify({ 
        error: "Missing recipient email address",
        success: false 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!emailData.subject || !emailData.html_content) {
      console.error("Missing subject or content");
      return new Response(JSON.stringify({ 
        error: "Missing email subject or content",
        success: false 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Build recipient list
    const toRecipients = [emailData.to_email];
    
    // Build CC list if provided
    const ccRecipients = emailData.cc_emails?.filter(email => email && email.trim()) || [];

    // Build attachments array if Word document is provided
    const attachments = [];
    if (emailData.word_attachment?.content) {
      attachments.push({
        filename: emailData.word_attachment.filename || 'meeting_notes.docx',
        content: emailData.word_attachment.content,
      });
      console.log("📎 Adding Word attachment:", emailData.word_attachment.filename);
    }
    
    // Add audio attachment if provided
    if (emailData.audio_attachment?.content) {
      attachments.push({
        filename: emailData.audio_attachment.filename || 'audio_overview.mp3',
        content: emailData.audio_attachment.content,
      });
      console.log("🔊 Adding Audio attachment:", emailData.audio_attachment.filename);
    }

    // Send email via Resend - always use Notewell AI as sender name
    const emailResponse = await resend.emails.send({
      from: `Notewell AI <noreply@bluepcn.co.uk>`,
      to: toRecipients,
      cc: ccRecipients.length > 0 ? ccRecipients : undefined,
      subject: emailData.subject,
      html: emailData.html_content,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    console.log("✅ Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: emailResponse.id,
      recipients: {
        to: toRecipients,
        cc: ccRecipients
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("❌ Error in send-meeting-email-resend function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send email',
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
