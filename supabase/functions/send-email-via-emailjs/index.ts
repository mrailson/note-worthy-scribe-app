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
  bcc_email?: string;
  word_attachment?: {
    content: string;
    filename: string;
    type: string;
  };
  transcript_attachment?: {
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
      : emailData.template_type === 'feedback'
      ? "template_feedback"  // Practice manager feedback template
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
        login_url: `https://gnotewell.co.uk/`,
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

    // Function to strip duplicate meeting details blocks from content
    function stripDuplicateBlocks(content: string): string {
      if (!content) return content;
      
      let cleaned = content;
      
      // Remove markdown-style duplicate blocks
      cleaned = cleaned
        // Remove standalone "MEETING NOTES" heading (markdown)
        .replace(/^#\s*MEETING\s*NOTES\s*$/gim, '')
        // Remove standalone "MEETING DETAILS" heading (markdown)
        .replace(/^#{1,2}\s*MEETING\s*DETAILS\s*$/gim, '')
        // Remove "Meeting Title:" lines
        .replace(/^\*?\*?Meeting\s*Title:\*?\*?.*$/gim, '')
        // Remove "Date:" lines
        .replace(/^\*?\*?Date:\*?\*?.*$/gim, '')
        // Remove "Time:" lines
        .replace(/^\*?\*?Time:\*?\*?.*$/gim, '');
      
      // Remove HTML-style duplicate blocks
      cleaned = cleaned
        // Remove "MEETING NOTES" heading (HTML)
        .replace(/<h[1-6][^>]*>\s*MEETING\s*NOTES\s*<\/h[1-6]>/gi, '')
        // Remove "MEETING DETAILS" heading (HTML)
        .replace(/<h[1-6][^>]*>\s*MEETING\s*DETAILS\s*<\/h[1-6]>/gi, '')
        // Remove "Meeting Title:" paragraphs
        .replace(/<p[^>]*>\s*<strong>\s*Meeting\s*Title:\s*<\/strong>.*?<\/p>/gi, '')
        // Remove "Date:" paragraphs
        .replace(/<p[^>]*>\s*<strong>\s*Date:\s*<\/strong>.*?<\/p>/gi, '')
        // Remove "Time:" paragraphs
        .replace(/<p[^>]*>\s*<strong>\s*Time:\s*<\/strong>.*?<\/p>/gi, '');
      
      // Clean up excessive whitespace left behind
      cleaned = cleaned
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\s+|\s+$/g, '')
        .trim();
      
      return cleaned;
    }

    // Function to parse meeting content into structured data
    function parseMeetingContent(content: string, subject: string) {
      const lines = content.split('\n').map(line => line.trim()).filter(line => line);
      
      // Extract basic info
      const title = subject.replace(/^AI Generated:\s*/i, '').trim();
      let date = '', time = '', location = '', attendees = '';
      let agenda: string[] = [];
      let discussion_points: Array<{heading: string, items: string[]}> = [];
      let risks: Array<{title: string, risk: string, mitigation: string}> = [];
      let next_steps: string[] = [];
      let adjourned_time = '', prepared_by = '';

      let currentSection = '';
      let currentDiscussionPoint: {heading: string, items: string[]} | null = null;
      let currentRisk: {title: string, risk: string, mitigation: string} | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lowerLine = line.toLowerCase();

        // Extract metadata
        if (lowerLine.startsWith('date:')) {
          date = line.replace(/^date:\s*/i, '').replace(/\*\*/g, '');
        } else if (lowerLine.startsWith('time:')) {
          time = line.replace(/^time:\s*/i, '').replace(/\*\*/g, '');
        } else if (lowerLine.startsWith('location:')) {
          location = line.replace(/^location:\s*/i, '').replace(/\*\*/g, '');
        } else if (lowerLine.startsWith('attendees:')) {
          attendees = line.replace(/^attendees:\s*/i, '').replace(/\*\*/g, '');
          // Collect multi-line attendees
          let j = i + 1;
          while (j < lines.length && lines[j].match(/^[-•]\s*/) && !lines[j].match(/^(agenda|discussion|risks|actions)/i)) {
            attendees += '; ' + lines[j].replace(/^[-•]\s*/, '');
            j++;
          }
          i = j - 1;
        }

        // Section headers
        if (lowerLine.match(/^agenda:?$/)) {
          currentSection = 'agenda';
        } else if (lowerLine.match(/^discussion\s*points?:?$/)) {
          currentSection = 'discussion';
        } else if (lowerLine.match(/^risks?\s*(\/|&)?\s*issues?\s*log:?$/) || lowerLine.match(/^risks?\s*(\/|&)?\s*mitigations?:?$/)) {
          currentSection = 'risks';
        } else if (lowerLine.match(/^(actions?|next\s*steps?):?$/)) {
          currentSection = 'actions';
        } else if (lowerLine.match(/^meeting\s*adjourned:?$/)) {
          adjourned_time = lines[i + 1]?.replace(/^.*:\s*/, '') || '';
        } else if (lowerLine.match(/^prepared\s*by:?$/)) {
          prepared_by = lines[i + 1]?.replace(/^.*:\s*/, '') || '';
        }

        // Content processing
        if (currentSection === 'agenda' && line.match(/^\d+\.\s/) && !lowerLine.match(/^discussion|^risks|^actions/)) {
          agenda.push(line.replace(/^\d+\.\s*/, ''));
        } else if (currentSection === 'discussion') {
          if (line.match(/^\d+\.\s*\*\*.*\*\*:?$/) || line.match(/^\*\*.*\*\*:?$/)) {
            // New discussion point
            if (currentDiscussionPoint) {
              discussion_points.push(currentDiscussionPoint);
            }
            currentDiscussionPoint = {
              heading: line.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '').replace(/:$/, ''),
              items: []
            };
          } else if (currentDiscussionPoint && (line.match(/^[-•]\s/) || line.match(/^[a-zA-Z]/))) {
            currentDiscussionPoint.items.push(line.replace(/^[-•]\s*/, ''));
          }
        } else if (currentSection === 'risks') {
          if (line.match(/^\d+\.\s*\*\*.*\*\*:?$/)) {
            // New risk
            if (currentRisk) {
              risks.push(currentRisk);
            }
            currentRisk = {
              title: line.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '').replace(/:$/, ''),
              risk: '',
              mitigation: ''
            };
          } else if (currentRisk) {
            if (lowerLine.startsWith('mitigation:')) {
              currentRisk.mitigation = line.replace(/^mitigation:\s*/i, '').replace(/\*\*/g, '');
            } else if (!currentRisk.risk && line.length > 0) {
              currentRisk.risk = line.replace(/\*\*/g, '');
            }
          }
        } else if (currentSection === 'actions' && (line.match(/^[-•]\s/) || line.match(/^\d+\.\s/))) {
          next_steps.push(line.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, ''));
        }
      }

      // Add final items
      if (currentDiscussionPoint) discussion_points.push(currentDiscussionPoint);
      if (currentRisk) risks.push(currentRisk);

      return {
        title: title || 'Meeting Notes',
        date: date || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        time: time || '',
        location: location || '',
        attendees: attendees || '',
        agenda,
        discussion_points,
        risks,
        next_steps,
        adjourned_time: adjourned_time || '',
        prepared_by: prepared_by || ''
      };
    }

    // Professional HTML email template with table-based bullets (Outlook-safe)
    function generateProfessionalEmailHTML(data: any): string {
      return `<!doctype html>
<html lang="en">
  <head>
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <meta name="viewport" content="width=device-width">
    <meta charset="utf-8">
    <title>${data.title}</title>
  </head>
  <body style="margin:0; padding:0; background:#f5f8ff;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0f6ff;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="680" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(11,31,53,.07);">
            <!-- Header -->
            <tr>
              <td style="background:#eaf2ff;padding:18px 24px;font-family:Segoe UI,Roboto,Arial,sans-serif;line-height:1.35;">
                <div style="font-size:18px;font-weight:700;color:#0b2545">${data.title}</div>
                ${data.date ? `<div style="font-size:13px;color:#335;margin-top:6px">Date: <strong>${data.date}</strong></div>` : ''}
              </td>
            </tr>

            ${data.time || data.location || data.attendees ? `<!-- Meta -->
            <tr>
              <td style="padding:18px 24px 8px;font-family:Segoe UI,Roboto,Arial,sans-serif;color:#0b2545;font-size:14px;line-height:1.45">
                ${data.time ? `⏰ <strong>Time:</strong> ${data.time}<br>` : ''}
                ${data.location ? `📍 <strong>Location:</strong> ${data.location}<br>` : ''}
                ${data.attendees ? `👥 <strong>Attendees:</strong> ${data.attendees}` : ''}
              </td>
            </tr>` : ''}

            ${data.agenda.length > 0 || data.discussion_points.length > 0 ? `<tr><td style="padding:0 24px"><hr style="border:none;border-top:1px solid #e6eefc;margin:8px 0 12px"></td></tr>` : ''}

            ${data.agenda.length > 0 ? `<!-- Agenda (table bullets) -->
            <tr>
              <td style="padding:0 24px 6px;font-family:Segoe UI,Roboto,Arial,sans-serif;">
                <div style="font-size:15px;font-weight:700;color:#0b2545;margin:0 0 6px">Agenda</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size:14px;color:#1a2a44;">
                  ${data.agenda.map((item: string, index: number) => `<tr>
                    <td width="18" valign="top" style="font-weight:700;padding:0 8px 4px 0">${index + 1}.</td>
                    <td valign="top" style="line-height:1.4;padding:0 0 4px 0">${item}</td>
                  </tr>`).join('')}
                </table>
              </td>
            </tr>` : ''}

            ${data.discussion_points.length > 0 ? `<!-- Discussion Points -->
            <tr>
              <td style="padding:6px 24px 0;font-family:Segoe UI,Roboto,Arial,sans-serif;">
                <div style="font-size:15px;font-weight:700;color:#0b2545;margin:0 0 6px">Discussion Points</div>
                ${data.discussion_points.map((point: any) => `
                <div style="font-size:14px;font-weight:700;color:#0b2545;margin:8px 0 4px">${point.heading}</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size:14px;color:#1a2a44;">
                  ${point.items.map((item: string) => `<tr>
                    <td width="16" valign="top" style="font-size:16px;line-height:1;padding:0 6px 4px 0">•</td>
                    <td valign="top" style="line-height:1.4;padding:0 0 4px 0">${item}</td>
                  </tr>`).join('')}
                </table>`).join('')}
              </td>
            </tr>` : ''}

            ${data.risks.length > 0 ? `<!-- Risks & Mitigations -->
            <tr>
              <td style="padding:10px 24px 0;font-family:Segoe UI,Roboto,Arial,sans-serif;">
                <div style="font-size:15px;font-weight:700;color:#0b2545;margin:0 0 6px">Risks &amp; Mitigations</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e6eefc;border-radius:8px;font-size:14px;color:#1a2a44;">
                  <tr><td style="padding:12px 16px">
                    ${data.risks.map((risk: any, index: number) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px 0">
                      <tr>
                        <td width="18" valign="top" style="font-weight:700;padding:0 8px 0 0">${index + 1}.</td>
                        <td valign="top" style="line-height:1.4">
                          <strong>${risk.title}:</strong> ${risk.risk}<br>
                          ${risk.mitigation ? `<em>Mitigation:</em> ${risk.mitigation}` : ''}
                        </td>
                      </tr>
                    </table>`).join('')}
                  </td></tr>
                </table>
              </td>
            </tr>` : ''}

            ${data.next_steps.length > 0 ? `<!-- Next Steps -->
            <tr>
              <td style="padding:10px 24px 2px;font-family:Segoe UI,Roboto,Arial,sans-serif;">
                <div style="font-size:15px;font-weight:700;color:#0b2545;margin:0 0 6px">Next Steps</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size:14px;color:#1a2a44;">
                  ${data.next_steps.map((step: string) => `<tr>
                    <td width="16" valign="top" style="font-size:16px;line-height:1;padding:0 6px 4px 0">•</td>
                    <td valign="top" style="line-height:1.4;padding:0 0 4px 0">${step}</td>
                  </tr>`).join('')}
                </table>
              </td>
            </tr>` : ''}

            ${data.adjourned_time || data.prepared_by ? `<!-- Footer -->
            <tr>
              <td style="padding:8px 24px 20px;font-family:Segoe UI,Roboto,Arial,sans-serif;color:#4a5a7a;font-size:12px;">
                <hr style="border:none;border-top:1px solid #e6eefc;margin:10px 0 12px">
                <div style="line-height:1.35">
                  ${data.adjourned_time ? `<strong>Meeting adjourned:</strong> ${data.adjourned_time}<br>` : ''}
                  ${data.prepared_by ? `<strong>Prepared by:</strong> ${data.prepared_by}` : ''}
                </div>
              </td>
            </tr>` : ''}

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
    }

    // Prepare the EmailJS API request
    const emailjsUrl = "https://api.emailjs.com/api/v1.0/email/send";
    
    // If there's a Word attachment, we need to include it in the template params
    const templateParams = { ...enhancedEmailData };
    
    // Professional HTML email template for AI-generated content
    if (emailData.template_type === 'ai_generated_content') {
      const rawMessage = emailData.message || '';
      
      // Check if it's already HTML content (from LG Capture or similar)
      const isAlreadyHTML = rawMessage.includes('<div') || rawMessage.includes('<table') || rawMessage.includes('<h1');
      
      if (isAlreadyHTML) {
        // Pass through HTML as-is for pre-formatted content like LG summaries
        templateParams.html_message = rawMessage;
        templateParams.message = rawMessage;
        console.log("ai_generated_content using pre-formatted HTML, length:", rawMessage.length);
      } else {
        // Parse and format meeting notes style content
        const cleanedContent = stripDuplicateBlocks(rawMessage);
        const parsedContent = parseMeetingContent(cleanedContent, emailData.subject || '');
        templateParams.html_message = generateProfessionalEmailHTML(parsedContent);
        
        // Strip markdown formatting from message for plain text fallback
        const cleanMessage = cleanedContent
          .replace(/^#{1,6}\s+/gm, '') // Remove markdown headers
          .replace(/\*\*\*(.*?)\*\*\*/g, '$1') // Remove bold+italic
          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
          .replace(/\*(.*?)\*/g, '$1') // Remove italic
          .replace(/`(.*?)`/g, '$1'); // Remove inline code
        
        templateParams.message = cleanMessage;
        console.log("ai_generated_content cleaned snippet:", cleanMessage.substring(0, 200));
      }
    }
    
    // Clean meeting_minutes emails too
    if (emailData.template_type === 'meeting_minutes' && templateParams.message) {
      const cleanedMessage = stripDuplicateBlocks(String(templateParams.message));
      templateParams.message = cleanedMessage;
      console.log("meeting_minutes cleaned snippet:", cleanedMessage.substring(0, 200));
    }
    
    // Universal cleanup: remove markdown heading hashes from any message (plain text or HTML)
    if ((templateParams as any).message) {
      let msg = String((templateParams as any).message);
      // Remove markdown headers at line starts
      msg = msg.replace(/^#{1,6}\s+/gm, '');
      // Remove stray hashes inside HTML heading tags like <h2># Title</h2>
      msg = msg.replace(/(<h[1-6][^>]*>)\s*#+\s*/gi, '$1');
      // Also handle cases where hashes appear right after a tag close or new line
      msg = msg.replace(/(^|>|\n|\r)\s*#+\s+/g, '$1');
      (templateParams as any).message = msg;
    }
    
    // NHS/Outlook compatibility: Simplify HTML for NHS email addresses
    const isNHSEmail = emailData.to_email?.toLowerCase().includes('nhs.net') || 
                       emailData.to_email?.toLowerCase().includes('nhs.uk');
    
    if (isNHSEmail && (templateParams as any).message) {
      console.log("NHS email detected - simplifying HTML for Outlook compatibility");
      
      let simplifiedMessage = String((templateParams as any).message);
      
      // Strip complex inline styles BUT preserve table-related styles for borders
      simplifiedMessage = simplifiedMessage
        // Remove class attributes
        .replace(/class="[^"]*"/gi, '')
        // Remove style attributes EXCEPT on table, th, td elements (preserve borders)
        .replace(/(<(?!table|th|td)[^>]+)style="[^"]*"/gi, '$1')
        // Keep basic structure but remove divs
        .replace(/<div[^>]*>/gi, '<p>')
        .replace(/<\/div>/gi, '</p>')
        // Remove empty paragraphs
        .replace(/<p>\s*<\/p>/gi, '')
        // Ensure proper spacing
        .replace(/<\/p>\s*<p>/gi, '</p>\n\n<p>');
      
      (templateParams as any).message = simplifiedMessage;
      
      // Add plain text version for better deliverability
      (templateParams as any).message_text = simplifiedMessage
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log("HTML simplified for NHS email system");
    }
    
    // EmailJS requires attachments in data URL format
    if (emailData.word_attachment) {
      console.log("Processing word attachment:", {
        has_content: !!emailData.word_attachment.content,
        has_filename: !!emailData.word_attachment.filename,
        has_type: !!emailData.word_attachment.type,
        content_length: emailData.word_attachment.content?.length
      });
      
      templateParams.word_filename = emailData.word_attachment.filename;
      // Format as data URL for EmailJS Variable Attachment
      templateParams.word_attachment = `data:${emailData.word_attachment.type};base64,${emailData.word_attachment.content}`;
      
      console.log("Word attachment formatted:", {
        filename: templateParams.word_filename,
        data_url_prefix: templateParams.word_attachment?.substring(0, 100)
      });
    }
    
    if (emailData.transcript_attachment) {
      const dataUrl = `data:${emailData.transcript_attachment.type};base64,${emailData.transcript_attachment.content}`;
      templateParams.transcript_filename = emailData.transcript_attachment.filename;
      // Format as data URL for EmailJS Variable Attachment
      templateParams.transcript_attachment = dataUrl;

      // Provide common alternative variable names to match EmailJS template configs
      templateParams.txt_filename = emailData.transcript_attachment.filename;
      templateParams.txt_attachment = dataUrl;
      templateParams.attachment_2_filename = emailData.transcript_attachment.filename;
      templateParams.attachment_2 = dataUrl;

      console.log("Transcript attachment prepared:", {
        filename: templateParams.transcript_filename,
        data_url_prefix: dataUrl.substring(0, 100)
      });
    }
    
    // Helper function to calculate payload size
    const getPayloadSize = (data: any) => {
      return new TextEncoder().encode(JSON.stringify(data)).length;
    };

    // Helper function to truncate content to fit size limits
    const truncateContent = (content: string, maxBytes: number) => {
      if (new TextEncoder().encode(content).length <= maxBytes) {
        return content;
      }
      
      const truncatedSuffix = '<div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;"><p style="margin: 0; color: #856404; font-size: 14px;"><strong>Note:</strong> Email content has been shortened to meet email size limits. Complete meeting minutes are available in the attached Word document.</p></div>';
      let left = 0;
      let right = content.length;
      let result = "";
      
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const truncated = content.substring(0, mid) + (mid < content.length ? truncatedSuffix : "");
        
        if (new TextEncoder().encode(truncated).length <= maxBytes) {
          result = truncated;
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }
      
      return result;
    };

    // Truncate subject if too long (max 200 chars)
    if (templateParams.subject && templateParams.subject.length > 200) {
      templateParams.subject = templateParams.subject.substring(0, 197) + "...";
    }

    // Check initial payload size and truncate content if needed (EmailJS limit is 50KB)
    let testPayload = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: templateParams
    };
    
    const maxSize = 50000; // EmailJS maximum is 50KB - use it all
    let currentSize = getPayloadSize(testPayload);
    
    console.log(`Payload size: ${currentSize} bytes (EmailJS limit: 50KB)`);
    
    if (currentSize > maxSize) {
      console.log(`Payload exceeds limit (${currentSize} > ${maxSize}), truncating...`);
      
      // Priority order for truncation: message > html_message > attachment content
      if (templateParams.message) {
        const testWithoutMessage = {...testPayload, template_params: {...templateParams, message: "", html_message: ""}};
        const availableForMessage = maxSize - getPayloadSize(testWithoutMessage);
        // Use 80% of available space to leave buffer
        templateParams.message = truncateContent(templateParams.message, Math.floor(availableForMessage * 0.8));
        
        // Update html_message if it exists
        if (templateParams.html_message) {
          const htmlContent = templateParams.message
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>')
            .replace(/<p><\/p>/g, '')
            .replace(/<p><br>/g, '<p>');
          
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
      }
      
      // Re-check and truncate attachment if still too large
      testPayload.template_params = templateParams;
      currentSize = getPayloadSize(testPayload);
      if (currentSize > maxSize && templateParams.word_attachment) {
        console.log("Still over limit after message truncation, removing Word attachment...");
        delete templateParams.word_attachment;
        delete templateParams.word_filename;
        templateParams.message = (templateParams.message || '') + '<div style="margin-top: 20px; padding: 15px; background-color: #fff3cd;"><p style="margin: 0; color: #856404;"><strong>Note:</strong> Email was too large to include Word attachment. Content is in the email body.</p></div>';
      }
      
      const finalSize = getPayloadSize(testPayload);
      console.log(`Adjusted payload size: ${finalSize} bytes ${finalSize > maxSize ? '⚠️ STILL TOO LARGE' : '✓ Within limit'}`);
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
      bcc_email: emailData.bcc_email,
      template_type: emailData.template_type || 'meeting',
      user_name: emailData.user_name,
      temporary_password: emailData.temporary_password,
      meeting_title: emailData.meeting_title,
      subject: emailData.subject,
      has_attachment: !!emailData.word_attachment,
      attachment_filename: emailData.word_attachment?.filename,
      has_transcript_attachment: !!emailData.transcript_attachment,
      transcript_filename: emailData.transcript_attachment?.filename,
      template_params_has_word_attachment: !!templateParams.word_attachment,
      template_params_word_filename: templateParams.word_filename,
      template_params_has_transcript_attachment: !!templateParams.transcript_attachment || !!templateParams.txt_attachment || !!templateParams.attachment_2,
      template_params_transcript_filename: templateParams.transcript_filename || templateParams.txt_filename || templateParams.attachment_2_filename
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