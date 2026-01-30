import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject, content, userEmail }: EmailRequest = await req.json();

    // Validate required fields
    if (!subject || !content) {
      console.error("Missing required fields:", { subject: !!subject, content: !!content });
      throw new Error("Missing required fields: subject and content are required");
    }

    let recipientEmail = userEmail;

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
        } else {
          // Try to get from user_profiles
          if (user?.id) {
            const { data: profile, error: profileError } = await supabase
              .from("user_profiles")
              .select("email")
              .eq("id", user.id)
              .single();

            if (!profileError && profile?.email) {
              recipientEmail = profile.email;
              console.log("Using email from profile:", recipientEmail);
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
  <div class="content">
    ${content.replace(/\n/g, '<br>')}
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
