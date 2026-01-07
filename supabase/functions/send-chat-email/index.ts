import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "npm:docx@8.5.0";

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
  includeWordDoc?: boolean;
}

// Generate a Word document from the chat content
async function generateWordDoc(subject: string, chatContent: string, senderName: string, additionalNotes?: string): Promise<Uint8Array> {
  const children: Paragraph[] = [];

  // Title
    children.push(
    new Paragraph({
      text: "Notewell AI Chat Summary",
      heading: HeadingLevel.HEADING_1,
    })
  );

  // Shared by
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Shared by: ", bold: true }),
        new TextRun({ text: senderName }),
      ],
      spacing: { after: 200 },
    })
  );

  // Subject
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Subject: ", bold: true }),
        new TextRun({ text: subject }),
      ],
      spacing: { after: 400 },
    })
  );

  // Content header
  children.push(
    new Paragraph({
      text: "Content",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200 },
    })
  );

  // Split content into paragraphs and add them
  const contentLines = chatContent.split('\n');
  for (const line of contentLines) {
    children.push(
      new Paragraph({
        text: line || ' ',
        spacing: { after: 100 },
      })
    );
  }

  // Additional notes if present
  if (additionalNotes) {
    children.push(
      new Paragraph({
        text: "Additional Notes",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400 },
      })
    );

    const notesLines = additionalNotes.split('\n');
    for (const line of notesLines) {
      children.push(
        new Paragraph({
          text: line || ' ',
          spacing: { after: 100 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-chat-email function invoked");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmails, subject, chatContent, senderName, additionalNotes, includeWordDoc = false }: ChatEmailRequest = await req.json();

    console.log("Sending email to:", recipientEmails);
    console.log("Subject:", subject);
    console.log("Include Word doc:", includeWordDoc);

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
            .attachment-note { margin-top: 16px; padding: 12px; background: #e0f2fe; border-radius: 6px; border-left: 4px solid #0284c7; font-size: 13px; }
            h1 { margin: 0; font-size: 20px; }
            .from { margin-top: 8px; font-size: 14px; opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Notewell AI Chat Summary</h1>
            <div class="from">Shared by ${senderName}</div>
          </div>
          <div class="content">
            <div class="chat-content">${chatContent.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>
            ${additionalNotes ? `<div class="notes"><strong>Additional Notes:</strong><br>${additionalNotes.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>` : ''}
            ${includeWordDoc ? `<div class="attachment-note">📎 A Word document version is attached to this email.</div>` : ''}
          </div>
          <div class="footer">
            <p>This email was sent from Notewell AI</p>
          </div>
        </body>
      </html>
    `;

    // Prepare email options
    const emailOptions: any = {
      from: "Notewell AI <noreply@bluepcn.co.uk>",
      to: recipientEmails,
      subject: subject,
      html: html,
    };

    // Generate and attach Word document if requested
    if (includeWordDoc) {
      console.log("Generating Word document...");
      const wordDocBuffer = await generateWordDoc(subject, chatContent, senderName, additionalNotes);
      
      // Convert to base64 for attachment
      const base64Content = btoa(String.fromCharCode(...wordDocBuffer));
      
      emailOptions.attachments = [
        {
          filename: "AI4PM-Chat-Summary.docx",
          content: base64Content,
        },
      ];
      console.log("Word document attached");
    }

    const emailResponse = await resend.emails.send(emailOptions);

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