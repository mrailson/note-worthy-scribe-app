import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ModuleAccess {
  meeting_notes_access: boolean;
  gp_scribe_access: boolean;
  complaints_manager_access: boolean;
  ai4gp_access: boolean;
  enhanced_access: boolean;
  cqc_compliance_access: boolean;
  shared_drive_access: boolean;
  mic_test_service_access: boolean;
  api_testing_service_access: boolean;
  translation_service_access: boolean;
  fridge_monitoring_access: boolean;
  cso_governance_access: boolean;
  lg_capture_access: boolean;
  bp_service_access: boolean;
}

interface WelcomeEmailRequest {
  user_email: string;
  user_name: string;
  temporary_password: string;
  user_role: string;
  practice_name?: string;
  module_access: ModuleAccess;
  test_mode?: boolean;
  test_email?: string;
}

// Module information for the email
const moduleInfo: Record<keyof ModuleAccess, { label: string; description: string; category: string }> = {
  meeting_notes_access: {
    label: 'Meeting Notes',
    description: 'Record meetings and automatically generate professional notes',
    category: 'Core Features'
  },
  shared_drive_access: {
    label: 'Shared Drive',
    description: 'Access shared file storage and team collaboration tools',
    category: 'Core Features'
  },
  translation_service_access: {
    label: 'Translation Service',
    description: 'Translate patient communications into multiple languages',
    category: 'Core Features'
  },
  gp_scribe_access: {
    label: 'GP Scribe',
    description: 'AI-powered consultation transcription and note generation',
    category: 'Clinical Tools'
  },
  bp_service_access: {
    label: 'BP Average Service',
    description: 'Calculate and analyse blood pressure readings',
    category: 'Clinical Tools'
  },
  ai4gp_access: {
    label: 'AI4GP Service',
    description: 'AI-powered GP practice support and clinical guidance',
    category: 'Clinical Tools'
  },
  complaints_manager_access: {
    label: 'Complaints Manager',
    description: 'View and manage patient complaints with AI assistance',
    category: 'Compliance & Governance'
  },
  cqc_compliance_access: {
    label: 'CQC Compliance',
    description: 'CQC compliance monitoring and assessment tools',
    category: 'Compliance & Governance'
  },
  cso_governance_access: {
    label: 'CSO Governance',
    description: 'Clinical Safety Officer reports and documentation',
    category: 'Compliance & Governance'
  },
  enhanced_access: {
    label: 'Enhanced Access',
    description: 'Extended hours appointment booking and patient services',
    category: 'Practice Management'
  },
  fridge_monitoring_access: {
    label: 'Fridge Monitoring',
    description: 'Practice fridge temperature monitoring and alerts',
    category: 'Practice Management'
  },
  lg_capture_access: {
    label: 'LG Capture',
    description: 'Lloyd George record scanning and digitisation',
    category: 'Practice Management'
  },
  mic_test_service_access: {
    label: 'Mic Test Service',
    description: 'Microphone testing and audio configuration',
    category: 'Developer & Testing'
  },
  api_testing_service_access: {
    label: 'API Testing Service',
    description: 'AI model comparison and API testing tools',
    category: 'Developer & Testing'
  }
};

const getRoleDisplayName = (role: string): string => {
  const roleNames: Record<string, string> = {
    'practice_user': 'Practice User',
    'practice_manager': 'Practice Manager',
    'pcn_manager': 'PCN Manager',
    'system_admin': 'System Administrator',
    'gp': 'GP',
    'nurse': 'Nurse',
    'admin_staff': 'Admin Staff',
    'icb_user': 'ICB User'
  };
  return roleNames[role] || role;
};

const generateEmailHTML = (data: WelcomeEmailRequest): string => {
  // Group enabled modules by category
  const enabledModules: Record<string, Array<{ label: string; description: string }>> = {};
  
  for (const [key, enabled] of Object.entries(data.module_access)) {
    if (enabled && moduleInfo[key as keyof ModuleAccess]) {
      const info = moduleInfo[key as keyof ModuleAccess];
      if (!enabledModules[info.category]) {
        enabledModules[info.category] = [];
      }
      enabledModules[info.category].push({
        label: info.label,
        description: info.description
      });
    }
  }

  // Generate modules HTML
  let modulesHTML = '';
  const categoryOrder = ['Core Features', 'Clinical Tools', 'Compliance & Governance', 'Practice Management', 'Developer & Testing'];
  
  for (const category of categoryOrder) {
    const modules = enabledModules[category];
    if (modules && modules.length > 0) {
      modulesHTML += `
        <div style="margin-bottom: 20px;">
          <h3 style="color: #0EA5E9; font-size: 14px; font-weight: 600; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">
            ${category}
          </h3>
          ${modules.map(m => `
            <div style="background: #F8FAFC; border-radius: 8px; padding: 12px 15px; margin-bottom: 8px; border-left: 3px solid #0EA5E9;">
              <div style="font-weight: 600; color: #1E293B; font-size: 14px;">${m.label}</div>
              <div style="color: #64748B; font-size: 12px; margin-top: 2px;">${m.description}</div>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  if (!modulesHTML) {
    modulesHTML = `
      <div style="background: #FEF3C7; border-radius: 8px; padding: 15px; border-left: 3px solid #F59E0B;">
        <div style="color: #92400E; font-size: 14px;">No modules have been enabled for your account yet. Please contact your administrator.</div>
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to GP Notewell AI</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F1F5F9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F1F5F9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%); padding: 40px 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: 700;">
                🏥 Welcome to GP Notewell AI
              </h1>
              <p style="margin: 10px 0 0; color: #94A3B8; font-size: 14px;">
                Your AI-powered practice management platform
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 30px 40px 20px;">
              <p style="margin: 0; color: #1E293B; font-size: 16px; line-height: 1.6;">
                Hello <strong>${data.user_name}</strong>,
              </p>
              <p style="margin: 15px 0 0; color: #475569; font-size: 14px; line-height: 1.6;">
                Your account has been created for GP Notewell AI. Below you'll find your login details and a summary of the features available to you.
              </p>
            </td>
          </tr>

          <!-- Login Details Box -->
          <tr>
            <td style="padding: 0 40px 25px;">
              <div style="background: linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%); border-radius: 12px; padding: 25px; color: #FFFFFF;">
                <h2 style="margin: 0 0 20px; font-size: 16px; font-weight: 600; color: #0EA5E9; text-transform: uppercase; letter-spacing: 0.5px;">
                  📋 Your Login Details
                </h2>
                
                <div style="margin-bottom: 15px;">
                  <div style="color: #94A3B8; font-size: 12px; margin-bottom: 4px;">Login URL</div>
                  <a href="https://gpnotewell.co.uk" style="color: #0EA5E9; font-size: 16px; font-weight: 600; text-decoration: none;">
                    https://gpnotewell.co.uk
                  </a>
                </div>
                
                <div style="margin-bottom: 15px;">
                  <div style="color: #94A3B8; font-size: 12px; margin-bottom: 4px;">Email Address</div>
                  <div style="color: #FFFFFF; font-size: 16px; font-weight: 500;">${data.user_email}</div>
                </div>
                
                <div style="margin-bottom: 0;">
                  <div style="color: #94A3B8; font-size: 12px; margin-bottom: 4px;">Temporary Password</div>
                  <div style="background: #1E293B; border-radius: 6px; padding: 10px 15px; font-family: monospace; font-size: 16px; color: #22D3EE; letter-spacing: 1px;">
                    ${data.temporary_password}
                  </div>
                </div>
              </div>
            </td>
          </tr>

          <!-- Password Change Notice -->
          <tr>
            <td style="padding: 0 40px 25px;">
              <div style="background: #FEF3C7; border-radius: 8px; padding: 15px; border-left: 4px solid #F59E0B;">
                <div style="display: flex; align-items: flex-start;">
                  <span style="font-size: 18px; margin-right: 10px;">⚠️</span>
                  <div>
                    <div style="color: #92400E; font-weight: 600; font-size: 14px;">Important: Change Your Password</div>
                    <div style="color: #A16207; font-size: 13px; margin-top: 4px;">
                      Please change your password after your first login via your profile settings for security.
                    </div>
                  </div>
                </div>
              </div>
            </td>
          </tr>

          <!-- Practice Assignment -->
          ${data.practice_name ? `
          <tr>
            <td style="padding: 0 40px 25px;">
              <div style="background: #F0FDF4; border-radius: 8px; padding: 15px; border-left: 4px solid #22C55E;">
                <h3 style="margin: 0 0 8px; color: #166534; font-size: 14px; font-weight: 600;">
                  🏥 Practice Assignment
                </h3>
                <div style="color: #15803D; font-size: 14px;">
                  You have been assigned to: <strong>${data.practice_name}</strong>
                </div>
                <div style="color: #16A34A; font-size: 13px; margin-top: 4px;">
                  Role: <strong>${getRoleDisplayName(data.user_role)}</strong>
                </div>
              </div>
            </td>
          </tr>
          ` : `
          <tr>
            <td style="padding: 0 40px 25px;">
              <div style="background: #EFF6FF; border-radius: 8px; padding: 15px; border-left: 4px solid #3B82F6;">
                <h3 style="margin: 0 0 8px; color: #1E40AF; font-size: 14px; font-weight: 600;">
                  👤 Your Role
                </h3>
                <div style="color: #1D4ED8; font-size: 14px;">
                  Role: <strong>${getRoleDisplayName(data.user_role)}</strong>
                </div>
              </div>
            </td>
          </tr>
          `}

          <!-- Enabled Features -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <h2 style="margin: 0 0 20px; font-size: 16px; font-weight: 600; color: #1E293B; border-bottom: 2px solid #E2E8F0; padding-bottom: 10px;">
                ✅ Your Enabled Features
              </h2>
              ${modulesHTML}
            </td>
          </tr>

          <!-- Getting Started -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <div style="background: #EFF6FF; border-radius: 12px; padding: 20px; text-align: center;">
                <h3 style="margin: 0 0 10px; color: #1E40AF; font-size: 16px;">Ready to Get Started?</h3>
                <p style="margin: 0 0 15px; color: #3B82F6; font-size: 14px;">
                  Click the button below to login to your account
                </p>
                <a href="https://gpnotewell.co.uk" style="display: inline-block; background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%); color: #FFFFFF; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 14px 0 rgba(14, 165, 233, 0.35);">
                  Login to GP Notewell AI →
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #F8FAFC; padding: 25px 40px; border-radius: 0 0 16px 16px; text-align: center; border-top: 1px solid #E2E8F0;">
              <p style="margin: 0 0 8px; color: #64748B; font-size: 13px;">
                Need help? Contact your system administrator or email
                <a href="mailto:support@gpnotewell.co.uk" style="color: #0EA5E9; text-decoration: none;">support@gpnotewell.co.uk</a>
              </p>
              <p style="margin: 0; color: #94A3B8; font-size: 12px;">
                © ${new Date().getFullYear()} GP Notewell AI. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured", success: false }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resend = new Resend(resendApiKey);
    const data: WelcomeEmailRequest = await req.json();

    console.log("Sending welcome email for user:", data.user_email);
    console.log("Test mode:", data.test_mode);

    // Validate required fields
    if (!data.user_email || !data.user_name || !data.temporary_password) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_email, user_name, temporary_password", success: false }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Determine recipient email
    const recipientEmail = data.test_mode && data.test_email ? data.test_email : data.user_email;
    console.log("Sending to:", recipientEmail);

    // Generate the email HTML
    const htmlContent = generateEmailHTML(data);

    // Build subject line
    const subject = data.test_mode 
      ? `[TEST] Welcome to GP Notewell AI - Account Created for ${data.user_name}`
      : `Welcome to GP Notewell AI - Your Account Details`;

    // Send email via Resend
    const { data: emailResult, error } = await resend.emails.send({
      from: "GP Notewell AI <noreply@bluepcn.co.uk>",
      to: [recipientEmail],
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(
        JSON.stringify({ error: error.message, success: false }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Welcome email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: emailResult?.id,
        recipient: recipientEmail,
        test_mode: data.test_mode || false
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("Error in send-user-welcome-email function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
