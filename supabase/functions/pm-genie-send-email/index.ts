import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Buffer } from "node:buffer";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  subject: string;
  content: string;
  userEmail?: string; // Optional - will fetch from profile if not provided
  imageUrl?: string;  // Optional - URL or data URL of an infographic
}

type ResendAttachment = {
  filename: string;
  content: string; // base64
};

const parseDataUrl = (dataUrl: string): { mime: string; base64: string } | null => {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match?.[1] || !match?.[2]) return null;
  return { mime: match[1], base64: match[2] };
};

const extFromMime = (mime: string): string => {
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  return 'png';
};

const fetchUrlAsBase64 = async (url: string): Promise<{ base64: string; mime: string }> => {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch image (${resp.status})`);
  const mime = resp.headers.get('content-type') || 'image/png';
  const ab = await resp.arrayBuffer();
  const base64 = Buffer.from(ab).toString('base64');
  return { base64, mime };
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject, content, userEmail, imageUrl }: EmailRequest = await req.json();

    // Validate required fields
    if (!subject || !content) {
      console.error("Missing required fields:", { subject: !!subject, content: !!content });
      throw new Error("Missing required fields: subject and content are required");
    }

    let recipientEmail = userEmail;
    let userName = 'there';

    // If no email provided, try to get from user profile
    if (!recipientEmail) {
      const authHeader = req.headers.get("authorization");
      if (authHeader) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } },
        });

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error("Error getting user:", userError);
        }
        
        if (user?.email) {
          recipientEmail = user.email;
          console.log("Using email from auth user:", recipientEmail);
        }
        
        // Get user profile for name and practice info
        if (user?.id) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("email, full_name, display_name")
            .eq("user_id", user.id)
            .single();

          if (!profileError && profile) {
            if (!recipientEmail && profile.email) {
              recipientEmail = profile.email;
              console.log("Using email from profile:", recipientEmail);
            }
            if (profile.full_name || profile.display_name) {
              userName = (profile.full_name || profile.display_name || '').split(' ')[0];
            }
          }
        }
      }
    }

    if (!recipientEmail) {
      console.error("No recipient email available");
      throw new Error("No recipient email available. Please ensure you're logged in.");
    }

    console.log("Sending email to:", recipientEmail);
    console.log("Subject:", subject);
    console.log("Has infographic image:", imageUrl ? `Yes (${imageUrl.length} chars)` : 'No');

    const isDataUrl = Boolean(imageUrl && imageUrl.startsWith('data:'));

    // Prepare an attachment for better email client support (Outlook often blocks data: images)
    let attachments: ResendAttachment[] | undefined;
    if (imageUrl) {
      try {
        let base64 = '';
        let mime = 'image/png';
        if (isDataUrl) {
          const parsed = parseDataUrl(imageUrl);
          if (!parsed) throw new Error('Invalid data URL');
          base64 = parsed.base64;
          mime = parsed.mime;
        } else {
          const fetched = await fetchUrlAsBase64(imageUrl);
          base64 = fetched.base64;
          mime = fetched.mime;
        }

        const ext = extFromMime(mime);
        const filename = `infographic.${ext}`;
        attachments = [{ filename, content: base64 }];
        console.log('Prepared infographic attachment:', filename);
      } catch (e) {
        console.warn('Failed to prepare infographic attachment:', e);
      }
    }

    // Build image section if an infographic URL is provided
    // - For data URLs: don't inline (many email clients will strip/block it); rely on attachment instead.
    // - For normal URLs: inline for convenience.
    const imageSection = imageUrl
      ? isDataUrl
        ? `<p style="margin-top: 16px; font-size: 12px; color: #6b7280;">(Infographic attached)</p>`
        : `
          <div style="margin: 20px 0; text-align: center;">
            <img src="${imageUrl}" alt="Generated Infographic" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
          </div>
        `
      : '';

    // Function to convert markdown to clean HTML
    const formatContentAsHtml = (text: string): string => {
      let formatted = text;
      
      // Convert headers (## Header -> <h2>Header</h2>) - must be at start of line
      formatted = formatted.replace(/^### (.+)$/gm, '<h3 style="color: #1a365d; margin: 16px 0 8px 0; font-size: 16px;">$1</h3>');
      formatted = formatted.replace(/^## (.+)$/gm, '<h2 style="color: #1a365d; margin: 20px 0 12px 0; font-size: 18px;">$1</h2>');
      formatted = formatted.replace(/^# (.+)$/gm, '<h1 style="color: #1a365d; margin: 24px 0 16px 0; font-size: 22px;">$1</h1>');
      
      // Convert bold (**text** or __text__) - use non-greedy match and handle multiline
      // Also handle **HEADING** style patterns at start of lines
      formatted = formatted.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
      formatted = formatted.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
      
      // Convert italic (*text* or _text_) - be careful not to match bold markers or list items
      formatted = formatted.replace(/(?<![*_])\*([^*\n]+)\*(?![*])/g, '<em>$1</em>');
      formatted = formatted.replace(/(?<![*_])_([^_\n]+)_(?![_])/g, '<em>$1</em>');
      
      // Convert bullet points (- item or * item at start of line only)
      formatted = formatted.replace(/^- (.+)$/gm, '<li style="margin: 6px 0;">$1</li>');
      formatted = formatted.replace(/^\* (.+)$/gm, '<li style="margin: 6px 0;">$1</li>');
      
      // Wrap consecutive <li> elements in <ul>
      formatted = formatted.replace(/(<li[^>]*>.*?<\/li>\n?)+/gs, (match) => {
        return `<ul style="margin: 12px 0; padding-left: 24px; list-style-type: disc;">${match}</ul>`;
      });
      
      // Convert numbered lists (1. item at start of line)
      formatted = formatted.replace(/^\d+\.\s+(.+)$/gm, '<li style="margin: 6px 0;">$1</li>');
      
      // Wrap numbered list items in <ol> (if not already wrapped)
      formatted = formatted.replace(/(<li[^>]*>.*?<\/li>\n?)+/gs, (match) => {
        if (!match.includes('<ul')) {
          return `<ol style="margin: 12px 0; padding-left: 24px;">${match}</ol>`;
        }
        return match;
      });
      
      // Convert line breaks to <br> for remaining newlines
      formatted = formatted.replace(/\n/g, '<br>');
      
      // Clean up excessive <br> tags
      formatted = formatted.replace(/(<br>\s*){3,}/g, '<br><br>');
      
      // Remove any remaining stray ** markers that weren't matched
      formatted = formatted.replace(/\*\*/g, '');
      
      return formatted;
    };

    const formattedContent = formatContentAsHtml(content);

    // Format content as HTML with proper styling
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3 {
      color: #1a365d;
    }
    ul, ol {
      margin: 16px 0;
      padding-left: 24px;
    }
    li {
      margin: 8px 0;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .greeting {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 16px;
    }
    .content {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .footer {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; color: white;">NoteWell PM Assistant</h1>
  </div>
  <div class="greeting">Hi ${userName},</div>
  <div class="content">
    ${formattedContent}
    ${imageSection}
  </div>
  <div class="footer">
    <p>This email was sent by your NoteWell PM Assistant based on your voice request.</p>
    <p>© ${new Date().getFullYear()} NoteWell AI</p>
  </div>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "NoteWell PM Assistant <noreply@bluepcn.co.uk>",
      to: [recipientEmail],
      subject: subject,
      html: htmlContent,
      attachments,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Email sent successfully to ${recipientEmail}`,
        id: emailResponse.data?.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in pm-genie-send-email function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
