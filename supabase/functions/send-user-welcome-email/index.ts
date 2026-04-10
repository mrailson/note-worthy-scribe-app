import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  survey_manager_access?: boolean;
  policy_service_access?: boolean;
}

interface WelcomeEmailRequest {
  user_email: string;
  user_name: string;
  password_reset_link?: string;
  user_password?: string;
  user_role: string;
  practice_name?: string;
  module_access: ModuleAccess;
  test_mode?: boolean;
  test_email?: string;
}

const moduleInfo: Record<string, { label: string; description: string }> = {
  ai4gp_access: { label: 'Ask AI', description: 'AI-powered practice support and clinical guidance' },
  meeting_notes_access: { label: 'Meeting Notes', description: 'Meeting recording and note-taking features' },
  survey_manager_access: { label: 'Survey Manager', description: 'Create and manage patient and staff surveys' },
  policy_service_access: { label: 'Policy Service', description: 'Generate and manage CQC-compliant practice policies' },
  complaints_manager_access: { label: 'Complaints Manager', description: 'Log, investigate, and resolve patient complaints with AI' },
  shared_drive_access: { label: 'Shared Drive', description: 'Shared file storage and collaboration' },
  translation_service_access: { label: 'Translation Service', description: 'Multilingual patient communication tool' },
  gp_scribe_access: { label: 'GP Scribe', description: 'AI-powered consultation transcription and note generation' },
  bp_service_access: { label: 'BP Average Service', description: 'Calculate and analyse blood pressure readings' },
  cqc_compliance_access: { label: 'CQC Compliance', description: 'CQC compliance monitoring and assessment tools' },
  cso_governance_access: { label: 'CSO Governance', description: 'Clinical Safety Officer reports and documentation' },
  enhanced_access: { label: 'Enhanced Access', description: 'Extended hours appointment booking and patient services' },
  fridge_monitoring_access: { label: 'Fridge Monitoring', description: 'Practice fridge temperature monitoring and alerts' },
  lg_capture_access: { label: 'LG Capture', description: 'Lloyd George record scanning and digitisation' },
  mic_test_service_access: { label: 'Mic Test Service', description: 'Microphone testing and audio configuration' },
  api_testing_service_access: { label: 'API Testing Service', description: 'AI model comparison and API testing tools' },
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
    'icb_user': 'ICB User',
  };
  return roleNames[role] || role;
};

const generateEmailHTML = (data: WelcomeEmailRequest): string => {
  const practiceName = data.practice_name || 'your practice';
  const roleDisplay = getRoleDisplayName(data.user_role);
  const isPracticeManager = data.user_role === 'practice_manager';

  // Build enabled modules list
  const enabledModules: Array<{ label: string; description: string }> = [];
  for (const [key, enabled] of Object.entries(data.module_access)) {
    if (enabled && moduleInfo[key]) {
      enabledModules.push(moduleInfo[key]);
    }
  }

  const modulesHTML = enabledModules.length > 0
    ? enabledModules.map(m => `
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#212B32;line-height:1.5;">
            <span style="color:#00703C;font-size:16px;vertical-align:middle;">&#10003;</span>&nbsp;&nbsp;
            <strong>${m.label}</strong> &mdash; ${m.description}
          </td>
        </tr>`).join('')
    : `<tr><td style="padding:10px;background:#FFF9C4;border-left:3px solid #FFB300;color:#7A4A00;font-size:14px;">No modules have been enabled yet. Please contact your administrator.</td></tr>`;

  // Practice Manager section
  const pmSection = isPracticeManager ? `
          <!-- Managing Your Practice Users -->
          <tr>
            <td style="padding:0 40px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:2px solid #003087;">
                <tr>
                  <td style="padding:20px 0 0;">
                    <h2 style="margin:0 0 12px;font-size:18px;color:#003087;">Managing Your Practice Users</h2>
                    <p style="margin:0 0 15px;font-size:14px;color:#4C6272;line-height:1.6;">
                      As the assigned Practice Manager for <strong>${practiceName}</strong>, you can add and manage users within your own practice:
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0f4f5;border-radius:6px;">
                      <tr>
                        <td style="padding:18px 22px;">
                          <ol style="margin:0;padding:0 0 0 20px;color:#212B32;font-size:14px;line-height:2;">
                            <li>Log in at <a href="https://gpnotewell.co.uk" style="color:#0072CE;text-decoration:underline;">gpnotewell.co.uk</a></li>
                            <li>Click your name (top right) &rarr; <strong>My Team/User Management</strong></li>
                            <li>Click <strong>Add User</strong> and enter their NHS email address and full name</li>
                            <li>A password will be auto-generated &mdash; share it with them or they can use the Magic Link to log in</li>
                            <li>Select their role and toggle the modules they need</li>
                            <li>Click <strong>Create User</strong></li>
                          </ol>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:15px 0 0;font-size:13px;color:#4C6272;line-height:1.5;">
                      You are responsible for maintaining your practice&rsquo;s user list &mdash; including removing access promptly when staff leave or change role.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Notewell AI</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#E8EDEE;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#E8EDEE;">
    <tr>
      <td align="center" style="padding:30px 15px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header Banner -->
          <tr>
            <td style="background-color:#003087;padding:28px 40px;text-align:left;">
              <h1 style="margin:0;color:#FFFFFF;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
                Notewell AI
              </h1>
              <p style="margin:8px 0 0;color:#8BB8E8;font-size:14px;font-weight:400;">
                Welcome to Notewell AI &mdash; ${practiceName}
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:30px 40px 20px;">
              <p style="margin:0;color:#212B32;font-size:16px;">
                Hi <strong>${data.user_name}</strong>,
              </p>
              <p style="margin:14px 0 0;color:#4C6272;font-size:14px;line-height:1.6;">
                Welcome to Notewell AI &mdash; your practice&rsquo;s intelligent programme assistant, powered by AI and grounded in NHS guidance. Your account has been created and is ready to use.
              </p>
            </td>
          </tr>

          <!-- Login Details Card -->
          <tr>
            <td style="padding:0 40px 25px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0f4f5;border:2px solid #003087;border-radius:8px;">
                <tr>
                  <td style="background:#003087;padding:12px 22px;">
                    <span style="color:#FFFFFF;font-size:15px;font-weight:600;">&#128274;&nbsp; Your Login Details</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:22px 22px 18px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-bottom:14px;">
                          <div style="color:#4C6272;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Login URL</div>
                          <a href="https://gpnotewell.co.uk" style="color:#0072CE;font-size:15px;font-weight:600;text-decoration:underline;">https://gpnotewell.co.uk</a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:14px;">
                          <div style="color:#4C6272;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Username</div>
                          <div style="color:#212B32;font-size:15px;">${data.user_email}</div>
                        </td>
                      </tr>
                      ${data.user_password ? `
                      <tr>
                        <td style="padding-bottom:14px;">
                          <div style="color:#4C6272;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Password</div>
                          <div style="color:#212B32;font-size:16px;font-family:'Courier New',Courier,monospace;background:#FFFFFF;border:1px solid #D8DDE0;padding:10px 14px;border-radius:4px;letter-spacing:1px;font-weight:600;">
                            ${data.user_password}
                          </div>
                        </td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding-bottom:14px;">
                          <div style="color:#4C6272;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Practice</div>
                          <div style="color:#212B32;font-size:15px;">${practiceName}</div>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <div style="color:#4C6272;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Role</div>
                          <div style="color:#212B32;font-size:15px;">${roleDisplay}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Password note -->
          <tr>
            <td style="padding:0 40px 20px;">
              <p style="margin:0;font-size:13px;color:#4C6272;line-height:1.5;">
                Your password was auto-generated and is yours to keep. If you&rsquo;d ever like to change it, you can do so anytime by clicking your name (top right) &rarr; <strong>My Profile</strong> &rarr; <strong>Password</strong> tab.
              </p>
            </td>
          </tr>

          <!-- Magic Link info box -->
          <tr>
            <td style="padding:0 40px 25px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f9fa;border:1px solid #D8DDE0;border-radius:6px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:14px;color:#003087;font-weight:600;">
                      &#128279; Forgotten your password?
                    </p>
                    <p style="margin:0;font-size:13px;color:#4C6272;line-height:1.5;">
                      No problem. On the login page, click &lsquo;<strong>Magic Link</strong>&rsquo; and enter your email address. We&rsquo;ll send you a secure one-time link that logs you straight into Notewell as your account &mdash; no password needed. The link expires after use for security.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #D8DDE0;margin:0;"></td></tr>

          <!-- Activated Services -->
          <tr>
            <td style="padding:25px 40px 25px;">
              <h2 style="margin:0 0 10px;font-size:18px;color:#003087;">Activated Services</h2>
              <p style="margin:0 0 15px;font-size:14px;color:#4C6272;line-height:1.5;">
                The following modules have been enabled for your account:
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                ${modulesHTML}
              </table>
              <p style="margin:15px 0 0;font-size:12px;color:#768692;">
                If you need additional modules activated, please contact your administrator.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #D8DDE0;margin:0;"></td></tr>

          ${pmSection}

          <!-- Getting Started -->
          <tr>
            <td style="padding:25px 40px 25px;">
              <h2 style="margin:0 0 10px;font-size:18px;color:#003087;">Getting Started</h2>
              <p style="margin:0 0 15px;font-size:14px;color:#4C6272;">Here are a few things to try first:</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:10px 14px;background:#f0f4f5;border-radius:4px;margin-bottom:6px;">
                    <span style="font-size:18px;vertical-align:middle;">&#128172;</span>&nbsp;&nbsp;
                    <strong style="color:#212B32;font-size:14px;">Ask AI</strong>
                    <span style="color:#4C6272;font-size:13px;"> &mdash; type any question in the Ask AI box on the home screen</span>
                  </td>
                </tr>
                <tr><td style="height:6px;"></td></tr>
                <tr>
                  <td style="padding:10px 14px;background:#f0f4f5;border-radius:4px;">
                    <span style="font-size:18px;vertical-align:middle;">&#128196;</span>&nbsp;&nbsp;
                    <strong style="color:#212B32;font-size:14px;">Document Studio</strong>
                    <span style="color:#4C6272;font-size:13px;"> &mdash; generate practice documents, policies, and templates</span>
                  </td>
                </tr>
                <tr><td style="height:6px;"></td></tr>
                <tr>
                  <td style="padding:10px 14px;background:#f0f4f5;border-radius:4px;">
                    <span style="font-size:18px;vertical-align:middle;">&#127908;</span>&nbsp;&nbsp;
                    <strong style="color:#212B32;font-size:14px;">Meeting Notes</strong>
                    <span style="color:#4C6272;font-size:13px;"> &mdash; record and transcribe your next practice meeting</span>
                  </td>
                </tr>
                <tr><td style="height:6px;"></td></tr>
                <tr>
                  <td style="padding:10px 14px;background:#f0f4f5;border-radius:4px;">
                    <span style="font-size:18px;vertical-align:middle;">&#127760;</span>&nbsp;&nbsp;
                    <strong style="color:#212B32;font-size:14px;">Translation Service</strong>
                    <span style="color:#4C6272;font-size:13px;"> &mdash; try the live translate tool with a colleague</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #D8DDE0;margin:0;"></td></tr>

          <!-- Support -->
          <tr>
            <td style="padding:25px 40px 25px;">
              <h2 style="margin:0 0 12px;font-size:18px;color:#003087;">Support</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#212B32;">
                    &#127909; <strong>Training Videos</strong> &mdash; available via your name menu &rarr; Training Videos
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#212B32;">
                    &#128214; <strong>User Guide &amp; Help</strong> &mdash; available from the left-hand menu
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#212B32;">
                    &#128231; <strong>Support</strong> &mdash; <a href="mailto:malcolm.railson@nhs.net" style="color:#0072CE;text-decoration:none;">malcolm.railson@nhs.net</a> / 07740 812180
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Data & Security -->
          <tr>
            <td style="padding:0 40px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0f4f5;border-radius:6px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:12px;color:#4C6272;line-height:1.5;">
                      <strong style="color:#003087;">Data &amp; Security</strong><br>
                      Notewell AI is an MHRA-registered Class I medical device with clinical safety sign-off (DCB0129/DCB0160) and ICB DDaT board approval. All data is processed in accordance with UK GDPR. For any data protection queries, please contact your practice&rsquo;s Data Protection Officer.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Pilot & Community Spirit -->
          <tr>
            <td style="padding:20px 40px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FFF8E1;border-left:4px solid #ED8B00;border-radius:0 6px 6px 0;">
                <tr>
                  <td style="padding:20px 22px;">
                    <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#003087;">
                      &#128640; A pioneering journey from analogue to digital
                    </p>
                    <p style="margin:0 0 12px;font-size:13px;color:#4C6272;line-height:1.6;">
                      Notewell AI is an unfunded tool developed on a best-efforts basis to support NHS primary care&rsquo;s transition from analogue to digital. There is no dedicated support team or engineering department behind it &mdash; it is built, maintained, and improved by me alongside my day job because I believe in what it can do for practices and patients.
                    </p>
                    <p style="margin:0 0 12px;font-size:13px;color:#4C6272;line-height:1.6;">
                      As a pilot platform, Notewell AI should not be relied upon for critical or business-essential functions. Features may change, improve, or occasionally break as I develop. I ask that you approach it in the spirit in which it&rsquo;s offered &mdash; as a pioneering step forward, not a finished product.
                    </p>
                    <p style="margin:0;font-size:13px;color:#4C6272;line-height:1.6;">
                      By using Notewell AI, you&rsquo;re part of a small group of practices helping to shape what digital primary care could look like. Your patience, feedback, and willingness to try something new is what makes this possible. Thank you for being part of the journey.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Feedback -->
          <tr>
            <td style="padding:20px 40px 25px;">
              <p style="margin:0;font-size:13px;color:#4C6272;line-height:1.5;font-style:italic;">
                We&rsquo;re continuously improving Notewell AI based on your feedback. If you have suggestions, spot issues, or want to request a feature, I&rsquo;d love to hear from you.
              </p>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="padding:0 40px 25px;">
              <p style="margin:0;font-size:14px;color:#212B32;line-height:1.6;">
                Kind regards,<br>
                <strong>Malcolm Railson</strong><br>
                <span style="color:#4C6272;font-size:13px;">Digital &amp; Transformation Lead, NRES</span><br>
                <span style="color:#4C6272;font-size:13px;">
                  <a href="mailto:malcolm.railson@nhs.net" style="color:#0072CE;text-decoration:none;">malcolm.railson@nhs.net</a> | 07740 812180
                </span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f0f4f5;padding:18px 40px;border-top:1px solid #D8DDE0;">
              <p style="margin:0;color:#768692;font-size:11px;text-align:center;line-height:1.5;">
                &copy; ${new Date().getFullYear()} Notewell AI | <a href="https://gpnotewell.co.uk" style="color:#0072CE;text-decoration:none;">gpnotewell.co.uk</a>
              </p>
              <p style="margin:8px 0 0;color:#999;font-size:10px;text-align:center;line-height:1.4;">
                This email was sent because an account was created for you on Notewell AI.<br>
                If you believe this was sent in error, please contact your practice administrator.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const handler = async (req: Request): Promise<Response> => {
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

    if (!data.user_email || !data.user_name) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_email, user_name", success: false }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const recipientEmail = data.test_mode && data.test_email ? data.test_email : data.user_email;
    console.log("Sending to:", recipientEmail);

    const htmlContent = generateEmailHTML(data);

    const subject = data.test_mode
      ? `[TEST] Welcome to Notewell AI — Account Created for ${data.user_name}`
      : `Welcome to Notewell AI — Your Account Details`;

    const { data: emailResult, error } = await resend.emails.send({
      from: '"Notewell AI" <noreply@bluepcn.co.uk>',
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
      JSON.stringify({ success: true, message: "Welcome email sent", id: emailResult?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-user-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error", success: false }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
