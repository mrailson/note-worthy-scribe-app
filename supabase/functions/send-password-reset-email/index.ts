import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
  reset_link: string;
  user_name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, reset_link, user_name }: PasswordResetRequest = await req.json();

    // Get Resend API key from Supabase secrets
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      throw new Error("Email service not configured");
    }

    const resend = new Resend(resendApiKey);

    const displayName = user_name || email.split('@')[0];

    console.log("Sending password reset email via Resend:", { 
      to_email: email,
      user_name: displayName
    });

    const { data, error } = await resend.emails.send({
      from: "Notewell AI <noreply@bluepcn.co.uk>",
      to: [email],
      subject: "Reset Your Notewell AI Password",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🔐 Password Reset Request</h1>
          </div>
          
          <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin-top: 0;">Hello ${displayName},</p>
            
            <p>We received a request to reset your password for your Notewell AI account. Click the button below to create a new password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${reset_link}" style="display: inline-block; background: linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Reset My Password
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="background: #e2e8f0; padding: 12px; border-radius: 6px; word-break: break-all; font-size: 12px; color: #475569;">
              ${reset_link}
            </p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
            
            <div style="color: #64748b; font-size: 13px;">
              <p style="margin: 8px 0;">⏰ This link will expire in 1 hour</p>
              <p style="margin: 8px 0;">🔒 If you didn't request this reset, you can safely ignore this email</p>
              <p style="margin: 8px 0;">❓ Having trouble? Contact your system administrator</p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
            
            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-bottom: 0;">
              This email was sent by Notewell AI<br>
              NHS Meeting Notes & Practice Management
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend API error:", error);
      throw new Error(`Email sending failed: ${error.message}`);
    }

    console.log("Resend response:", data);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Password reset email sent successfully via Resend",
      id: data?.id
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-password-reset-email function:", error);
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
