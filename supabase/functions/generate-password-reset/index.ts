import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: PasswordResetRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    console.log("Generating password reset link for:", email);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Generate password reset link using Admin API
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: "https://gpnotewell.co.uk/reset-password",
      },
    });

    if (error) {
      console.error("Error generating password reset link:", error);
      throw new Error(error.message);
    }

    if (!data?.properties?.action_link) {
      throw new Error("Failed to generate password reset link - no action link returned");
    }

    const resetLink = data.properties.action_link;
    const userName = email.split("@")[0];

    console.log("Password reset link generated successfully, sending via Resend");

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "Notewell AI <noreply@bluepcn.co.uk>",
      to: [email],
      subject: "Password Reset Request - Notewell AI",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🔐 Password Reset Request</h1>
          </div>
          
          <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin-top: 0;">Hello ${userName},</p>
            
            <p>We received a request to reset your password for your Notewell AI account. Click the button below to create a new password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Reset My Password
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="background: #e2e8f0; padding: 12px; border-radius: 6px; word-break: break-all; font-size: 12px; color: #475569;">
              ${resetLink}
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

    if (emailError) {
      console.error("Resend API error:", emailError);
      throw new Error(`Email sending failed: ${emailError.message}`);
    }

    console.log("Resend response:", emailData);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password reset email sent successfully via Resend",
        id: emailData?.id,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in generate-password-reset function:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
