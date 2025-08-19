import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  // Meeting summary email fields
  to_email?: string;
  all_emails?: string;
  meeting_title?: string;
  meeting_date?: string;
  duration?: string;
  practice_name?: string;
  meeting_notes?: string;
  include_transcript?: string;
  transcript?: string;
  from_name?: string;
  reply_to?: string;
  // AI-generated content email fields
  subject?: string;
  message?: string;
  cc_email?: string;
  word_attachment?: {
    content: string;
    filename: string;
    type: string;
  };
  
  // Welcome email fields
  user_name?: string;
  user_email?: string;
  temporary_password?: string;
  user_role?: string;
  template_type?: string;
  login_url?: string;
  support_email?: string;
  
  // Module access fields
  meeting_notes_access?: boolean;
  gp_scribe_access?: boolean;
  complaints_manager_access?: boolean;
  complaints_admin_access?: boolean;
  replywell_access?: boolean;
  ai_4_pm_access?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const emailData: EmailRequest = await req.json();
    
    console.log("Received email data:", JSON.stringify(emailData, null, 2));

    // Validate required fields
    if (!emailData.to_email && !emailData.all_emails) {
      console.error("Missing recipient email");
      return new Response(JSON.stringify({ 
        error: "Missing recipient email address",
        success: false 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get EmailJS credentials from Supabase secrets
    const serviceId = Deno.env.get("EMAILJS_SERVICE_ID");
    const templateId = emailData.template_type === 'welcome' 
      ? "template_00jzuhg"  // Welcome email template
      : emailData.template_type === 'ai_generated_content'
      ? "template_n236grs"  // Generic content template (reusing the meeting template)
      : Deno.env.get("EMAILJS_TEMPLATE_ID"); // Default meeting template
    const publicKey = Deno.env.get("EMAILJS_PUBLIC_KEY");
    const privateKey = Deno.env.get("EMAILJS_PRIVATE_KEY");

    console.log("Using EmailJS config:", { serviceId, templateId: templateId ? "present" : "missing", publicKey: publicKey ? "present" : "missing" });

    if (!serviceId || !templateId || !publicKey) {
      console.error("Missing EmailJS credentials:", { serviceId: !!serviceId, templateId: !!templateId, publicKey: !!publicKey });
      throw new Error("EmailJS credentials not configured");
    }

    // Enhance the email data for welcome emails
    let enhancedEmailData = { ...emailData };
    
    if (emailData.template_type === 'welcome') {
      // Generate feature access list based on user permissions
      const accessibleFeatures = [];
      const featureDescriptions = {
        meeting_notes_access: "📝 **Meeting Notes & Transcription** - Record and transcribe meetings with AI-powered summaries",
        gp_scribe_access: "🩺 **GP Scribe** - AI-powered consultation notes with SNOMED codes and structured documentation",
        complaints_manager_access: "📋 **Complaints Manager** - Handle patient complaints with automated workflows and tracking",
        complaints_admin_access: "⚙️ **Complaints Administration** - Advanced complaint management with full admin controls",
        replywell_access: "✉️ **ReplyWell AI** - AI-assisted email responses for patient communications",
        ai_4_pm_access: "🤖 **AI4PM Assistant** - AI-powered practice management guidance and support"
      };

      // Add enabled features to the list
      Object.entries(featureDescriptions).forEach(([key, description]) => {
        if (emailData[key as keyof EmailRequest]) {
          accessibleFeatures.push(description);
        }
      });

      const features_list = accessibleFeatures.length > 0 
        ? accessibleFeatures.join('\n\n') 
        : "📝 **Meeting Notes & Transcription** - Your basic access includes meeting recording and transcription features";

      enhancedEmailData = {
        ...emailData,
        login_url: `https://notewell.dialai.co.uk/`,
        support_email: "support@gp-tools.nhs.uk",
        app_name: "GP Tools Suite",
        features_list,
        total_features: accessibleFeatures.length || 1,
        role_description: getRoleDescription(emailData.user_role || 'gp'),
        getting_started_tips: getGettingStartedTips(emailData.user_role || 'gp')
      };
    }

    function getRoleDescription(role: string): string {
      const descriptions = {
        'gp': 'As a GP, you have access to clinical documentation tools and patient communication features.',
        'practice_manager': 'As a Practice Manager, you can oversee practice operations and manage staff accounts.',
        'pcn_manager': 'As a PCN Manager, you can coordinate across multiple practices in your network.',
        'system_admin': 'As a System Administrator, you have full access to all platform features and user management.',
        'complaints_manager': 'As a Complaints Manager, you specialize in handling patient feedback and complaint resolution.'
      };
      return descriptions[role] || 'Welcome to the GP Tools Suite platform.';
    }

    function getGettingStartedTips(role: string): string {
      const tips = {
        'gp': '• Start with a test consultation recording\n• Explore the GP Scribe templates\n• Set up your practice signature',
        'practice_manager': '• Configure practice details and branding\n• Add team members and assign roles\n• Review meeting templates and settings',
        'pcn_manager': '• Review practices under your management\n• Set up cross-practice meeting templates\n• Coordinate with practice managers',
        'system_admin': '• Review the System Administration dashboard\n• Configure security settings\n• Monitor audit logs and user activity',
        'complaints_manager': '• Set up complaint response templates\n• Review complaint workflow settings\n• Configure notification preferences'
      };
      return tips[role] || '• Log in and explore your dashboard\n• Complete your profile setup\n• Contact support if you need assistance';
    }

    // Prepare the EmailJS API request
    const emailjsUrl = "https://api.emailjs.com/api/v1.0/email/send";
    
    // If there's a Word attachment, we need to include it in the template params
    const templateParams = { ...enhancedEmailData };
    
    // For AI-generated content, ensure proper HTML formatting
    if (emailData.template_type === 'ai_generated_content' && emailData.message) {
      // Create properly structured HTML email content while preserving original spacing
      const htmlContent = emailData.message
        .replace(/\n\n/g, '</p><p>') // Convert double line breaks to paragraph breaks
        .replace(/\n/g, '<br>') // Convert single line breaks to <br>
        .replace(/^/, '<p>') // Add opening paragraph tag
        .replace(/$/, '</p>') // Add closing paragraph tag
        .replace(/<p><\/p>/g, '') // Remove empty paragraphs
        .replace(/<p><br>/g, '<p>'); // Clean up paragraph starts
      
      templateParams.message = htmlContent;
      templateParams.html_message = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                    font-size: 14px; 
                    line-height: 1.4; 
                    color: #333333; 
                    max-width: 600px;">
          ${htmlContent}
        </div>
      `;
    }
    
    if (emailData.word_attachment) {
      templateParams.attachment_name = emailData.word_attachment.filename;
      templateParams.attachment_content = emailData.word_attachment.content;
      templateParams.attachment_type = emailData.word_attachment.type;
    }
    
    const payload = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: templateParams
    };

    console.log("Sending email via EmailJS:", { 
      service_id: serviceId, 
      template_id: templateId,
      to_email: emailData.to_email,
      cc_email: emailData.cc_email,
      template_type: emailData.template_type || 'meeting',
      user_name: emailData.user_name,
      temporary_password: emailData.temporary_password,
      meeting_title: emailData.meeting_title,
      subject: emailData.subject,
      has_attachment: !!emailData.word_attachment,
      attachment_filename: emailData.word_attachment?.filename
    });

    // Send email via EmailJS API
    const emailjsResponse = await fetch(emailjsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!emailjsResponse.ok) {
      const errorText = await emailjsResponse.text();
      console.error("EmailJS API error:", errorText);
      throw new Error(`EmailJS API error: ${emailjsResponse.status} - ${errorText}`);
    }

    const result = await emailjsResponse.text();
    console.log("EmailJS response:", result);

    // BCC functionality removed for security reasons

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Email sent successfully via EmailJS",
      emailjs_response: result
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-email-via-emailjs function:", error);
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