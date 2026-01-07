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
  password_reset_link?: string;
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

  // Generate modules HTML - simple list format
  let modulesHTML = '';
  const categoryOrder = ['Core Features', 'Clinical Tools', 'Compliance & Governance', 'Practice Management', 'Developer & Testing'];
  
  for (const category of categoryOrder) {
    const modules = enabledModules[category];
    if (modules && modules.length > 0) {
      modulesHTML += `
        <tr>
          <td style="padding: 0 0 15px 0;">
            <div style="color: #005EB8; font-size: 13px; font-weight: 600; margin-bottom: 8px; text-transform: uppercase;">
              ${category}
            </div>
            ${modules.map(m => `
              <div style="padding: 8px 12px; margin-bottom: 6px; background: #F0F4F5; border-left: 3px solid #005EB8;">
                <div style="font-weight: 600; color: #212B32; font-size: 14px;">${m.label}</div>
                <div style="color: #4C6272; font-size: 12px;">${m.description}</div>
              </div>
            `).join('')}
          </td>
        </tr>
      `;
    }
  }

  if (!modulesHTML) {
    modulesHTML = `
      <tr>
        <td style="padding: 15px; background: #FFF9C4; border-left: 3px solid #FFB300;">
          <div style="color: #7A4A00; font-size: 14px;">No modules have been enabled for your account yet. Please contact your administrator.</div>
        </td>
      </tr>
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
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #E8EDEE;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #E8EDEE;">
    <tr>
      <td align="center" style="padding: 30px 15px;">
        <table role="presentation" width="800" cellspacing="0" cellpadding="0" style="max-width: 800px; width: 100%; background-color: #FFFFFF;">
          
          <!-- NHS Blue Header -->
          <tr>
            <td style="background-color: #005EB8; padding: 25px 40px; text-align: left;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 600;">
                GP Notewell AI
              </h1>
              <p style="margin: 5px 0 0; color: #AED6F1; font-size: 14px;">
                Your AI-powered practice management platform
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 30px 40px 20px;">
              <p style="margin: 0; color: #212B32; font-size: 16px;">
                Hello <strong>${data.user_name}</strong>,
              </p>
              <p style="margin: 12px 0 0; color: #4C6272; font-size: 14px; line-height: 1.5;">
                Your account has been created for GP Notewell AI. Below you will find your login details and a summary of the features available to you.
              </p>
            </td>
          </tr>

          <!-- Login Details -->
          <tr>
            <td style="padding: 0 40px 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #F0F4F5; border-left: 3px solid #005EB8;">
                <tr>
                  <td style="padding: 20px 25px;">
                    <div style="color: #005EB8; font-size: 14px; font-weight: 600; margin-bottom: 15px; text-transform: uppercase;">
                      Your Login Details
                    </div>
                    
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <div style="color: #4C6272; font-size: 12px; margin-bottom: 3px;">Login URL</div>
                          <a href="https://gpnotewell.co.uk" style="color: #005EB8; font-size: 15px; font-weight: 600; text-decoration: underline;">
                            https://gpnotewell.co.uk
                          </a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <div style="color: #4C6272; font-size: 12px; margin-bottom: 3px;">Email Address</div>
                          <div style="color: #212B32; font-size: 15px;">${data.user_email}</div>
                        </td>
                      </tr>
                      ${data.password_reset_link ? `
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <div style="color: #4C6272; font-size: 12px; margin-bottom: 8px;">Set Your Password</div>
                          <a href="${data.password_reset_link}" 
                             style="display: inline-block; background: #005EB8; color: #FFFFFF; text-decoration: none; padding: 10px 20px; font-weight: 600; font-size: 13px; border-radius: 4px;">
                            Create Your Password
                          </a>
                          <div style="color: #768692; font-size: 11px; margin-top: 8px;">
                            This link expires in 24 hours. If it expires, use "Forgot Password" on the login page.
                          </div>
                        </td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <div style="color: #4C6272; font-size: 12px; margin-bottom: 3px;">Your Role</div>
                          <div style="color: #212B32; font-size: 15px;">${getRoleDisplayName(data.user_role)}</div>
                        </td>
                      </tr>
                      ${data.practice_name ? `
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <div style="color: #4C6272; font-size: 12px; margin-bottom: 3px;">Your Practice/Organisation</div>
                          <div style="color: #212B32; font-size: 15px;">${data.practice_name}</div>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Enabled Features Section -->
          <tr>
            <td style="padding: 0 40px 25px;">
              <div style="font-size: 16px; font-weight: 600; color: #212B32; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #005EB8;">
                Your Enabled Features
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                ${modulesHTML}
              </table>
            </td>
          </tr>

          ${data.module_access.complaints_manager_access ? `
          <!-- Complaints Manager Training Section -->
          <tr>
            <td style="padding: 0 40px 25px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #E3F2FD 0%, #F3E5F5 100%); border-left: 4px solid #7B1FA2;">
                <tr>
                  <td style="padding: 20px 25px;">
                    <div style="display: flex; align-items: center; margin-bottom: 12px;">
                      <span style="font-size: 24px; margin-right: 10px;">🎬</span>
                      <span style="color: #7B1FA2; font-size: 15px; font-weight: 600; text-transform: uppercase;">
                        Complaints Manager Training
                      </span>
                    </div>
                    <p style="margin: 0 0 15px; color: #4C6272; font-size: 14px; line-height: 1.5;">
                      Get started with a demonstration video showing you how to use the Complaints Manager effectively. Learn how to log, investigate, and resolve patient complaints with AI assistance.
                    </p>
                    <a href="https://www.loom.com/share/58d3d16963224dddac2ea8211bd2b90d" 
                       target="_blank"
                       style="display: inline-block; background: #7B1FA2; color: #FFFFFF; text-decoration: none; padding: 10px 20px; font-weight: 600; font-size: 13px; border-radius: 4px;">
                      ▶ Watch Training Video
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Login Button -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #F0F4F5;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <div style="color: #212B32; font-size: 14px; margin-bottom: 12px;">Ready to get started?</div>
                    <a href="https://gpnotewell.co.uk" style="display: inline-block; background: #005EB8; color: #FFFFFF; text-decoration: none; padding: 12px 30px; font-weight: 600; font-size: 14px;">
                      Login to GP Notewell AI
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #F0F4F5; padding: 20px 40px; border-top: 1px solid #D8DDE0;">
              <p style="margin: 0; color: #4C6272; font-size: 12px; text-align: center;">
                Need help? Contact your system administrator or email
                <a href="mailto:malcolm.railson@nhs.net" style="color: #005EB8; text-decoration: none;">malcolm.railson@nhs.net</a>
              </p>
              <p style="margin: 8px 0 0; color: #768692; font-size: 11px; text-align: center;">
                &copy; ${new Date().getFullYear()} GP Notewell AI. All rights reserved.
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
    if (!data.user_email || !data.user_name) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_email, user_name", success: false }),
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
      from: "\"Notewell AI\" <noreply@bluepcn.co.uk>",
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
