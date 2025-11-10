import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { complaintId, reportData, complaint } = await req.json();

    if (!complaintId || !reportData || !complaint) {
      return new Response(JSON.stringify({ error: 'Missing required data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate Word document content
    const wordDocContent = generateWordDoc(reportData, complaint);
    
    // Generate HTML email
    const htmlEmail = generateHTMLEmail(reportData, complaint);

    // Get EmailJS credentials
    const serviceId = Deno.env.get('EMAILJS_SERVICE_ID');
    const templateId = Deno.env.get('EMAILJS_TEMPLATE_ID');
    const publicKey = Deno.env.get('EMAILJS_PUBLIC_KEY');
    const privateKey = Deno.env.get('EMAILJS_PRIVATE_KEY');

    if (!serviceId || !templateId || !publicKey || !privateKey) {
      throw new Error('EmailJS credentials not configured');
    }

    // Prepare attachment - properly encode UTF-8 to base64
    const encoder = new TextEncoder();
    const data = encoder.encode(wordDocContent);
    // Convert Uint8Array to base64 in chunks to avoid call stack issues
    let binary = '';
    const len = data.length;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(data[i]);
    }
    const attachmentBase64 = btoa(binary);
    
    // Send email via EmailJS REST API
    const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: {
          to_email: 'malcolm.railson@nhs.net',
          to_name: 'GP Partners',
          subject: `Complaint Review Report - ${complaint.reference_number}`,
          message_html: htmlEmail,
          complaint_reference: complaint.reference_number,
          report_attachment: attachmentBase64,
          attachment_name: `Complaint_Report_${complaint.reference_number}_${new Date().toISOString().split('T')[0]}.txt`,
        },
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('EmailJS error:', errorText);
      throw new Error(`EmailJS returned ${emailResponse.status}: ${errorText}`);
    }

    console.log('Email sent successfully via EmailJS');

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in email-complaint-report:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to send email report'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function generateHTMLEmail(reportData: any, complaint: any): string {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not yet completed';
    return new Date(dateStr).toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      'on-time': 'background: #10b981; color: white;',
      'late': 'background: #f59e0b; color: white;',
      'pending': 'background: #6b7280; color: white;'
    };
    return `<span style="padding: 4px 12px; border-radius: 4px; font-size: 12px; ${colors[status as keyof typeof colors] || colors.pending}">${status}</span>`;
  };

  const receivedDate = complaint.received_at || complaint.created_at;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complaint Review Report</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; border-radius: 8px; margin-bottom: 30px; text-align: center;">
    <h1 style="margin: 0 0 10px 0; font-size: 32px;">Complaint Review Report</h1>
    <p style="margin: 5px 0; font-size: 18px; opacity: 0.9;">Reference: <strong>${complaint.reference_number}</strong></p>
    <p style="margin: 5px 0; font-size: 14px; opacity: 0.8;">Received: ${formatDate(receivedDate)}</p>
    <p style="margin: 5px 0; font-size: 14px; opacity: 0.8;">Category: ${complaint.category}</p>
    <p style="margin: 15px 0 0 0; font-size: 12px; opacity: 0.7; font-style: italic;">Generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
  </div>

  <!-- Complaint Overview -->
  <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="color: #667eea; margin-top: 0; border-left: 4px solid #667eea; padding-left: 15px;">Complaint Overview</h2>
    <p style="white-space: pre-wrap; line-height: 1.8;">${reportData.complaintOverview}</p>
  </div>

  <!-- Timeline & Compliance -->
  <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="color: #667eea; margin-top: 0; border-left: 4px solid #667eea; padding-left: 15px;">Timeline & Compliance</h2>
    
    <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Milestone</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Date</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Days</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Acknowledgement</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${formatDate(reportData.timelineCompliance.acknowledged.date)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${reportData.timelineCompliance.acknowledged.daysFromReceived}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${getStatusBadge(reportData.timelineCompliance.acknowledged.status)}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Outcome Letter</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${formatDate(reportData.timelineCompliance.outcome.date)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${reportData.timelineCompliance.outcome.daysFromReceived}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${getStatusBadge(reportData.timelineCompliance.outcome.status)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Key Learnings -->
  <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="color: #667eea; margin-top: 0; border-left: 4px solid #667eea; padding-left: 15px;">Key Learnings Identified</h2>
    ${reportData.keyLearnings.map((learning: any, index: number) => `
      <div style="margin-bottom: 20px; padding: 15px; background: #f9fafb; border-radius: 6px; border-left: 3px solid #667eea;">
        <p style="margin: 0 0 8px 0; font-weight: 600;">${index + 1}. ${learning.learning}</p>
        <p style="margin: 0; font-size: 14px; color: #6b7280;">
          Category: <strong>${learning.category}</strong> | 
          Impact: <span style="padding: 2px 8px; background: ${learning.impact === 'high' ? '#fee2e2' : learning.impact === 'medium' ? '#fef3c7' : '#dbeafe'}; color: ${learning.impact === 'high' ? '#991b1b' : learning.impact === 'medium' ? '#92400e' : '#1e40af'}; border-radius: 3px; font-size: 12px;">${learning.impact}</span>
        </p>
      </div>
    `).join('')}
  </div>

  <!-- Practice Strengths -->
  <div style="background: #ecfdf5; padding: 25px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #10b981;">
    <h2 style="color: #059669; margin-top: 0; display: flex; align-items: center;">
      <span style="margin-right: 10px;">✓</span> What the Practice Did Well
    </h2>
    <ul style="margin: 10px 0; padding-left: 25px;">
      ${reportData.practiceStrengths.map((strength: string) => `
        <li style="margin-bottom: 12px; line-height: 1.6;">${strength}</li>
      `).join('')}
    </ul>
  </div>

  <!-- Improvement Suggestions -->
  <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="color: #667eea; margin-top: 0; border-left: 4px solid #667eea; padding-left: 15px;">Supportive Quality Improvement Suggestions</h2>
    <p style="font-size: 14px; color: #6b7280; margin-bottom: 20px; font-style: italic;">These suggestions are provided to support continuous improvement, not as criticism</p>
    ${reportData.improvementSuggestions.map((suggestion: any, index: number) => `
      <div style="margin-bottom: 25px; padding: 15px; background: #fef9f3; border-radius: 6px; border-left: 3px solid #f59e0b;">
        <div style="display: flex; align-items: start; margin-bottom: 8px;">
          <span style="padding: 2px 8px; background: ${suggestion.priority === 'high' ? '#fee2e2' : suggestion.priority === 'medium' ? '#fef3c7' : '#dbeafe'}; color: ${suggestion.priority === 'high' ? '#991b1b' : suggestion.priority === 'medium' ? '#92400e' : '#1e40af'}; border-radius: 3px; font-size: 12px; margin-right: 10px; flex-shrink: 0;">${suggestion.priority}</span>
          <p style="margin: 0; font-weight: 600; flex: 1;">${index + 1}. ${suggestion.suggestion}</p>
        </div>
        <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">${suggestion.rationale}</p>
      </div>
    `).join('')}
  </div>

  <!-- Outcome Rationale -->
  <div style="background: white; padding: 25px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h2 style="color: #667eea; margin-top: 0; border-left: 4px solid #667eea; padding-left: 15px;">Outcome Decision Rationale</h2>
    <p style="white-space: pre-wrap; line-height: 1.8;">${reportData.outcomeRationale}</p>
  </div>

  <!-- Footer -->
  <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; margin-top: 30px;">
    <p style="margin: 5px 0;">This report is advisory and requires human review</p>
    <p style="margin: 5px 0;">NHS Complaints Management System</p>
  </div>

</body>
</html>
  `;
}

function generateWordDoc(reportData: any, complaint: any): string {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not yet completed';
    return new Date(dateStr).toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const receivedDate = complaint.received_at || complaint.created_at;

  let content = `COMPLAINT REVIEW REPORT
======================

Reference: ${complaint.reference_number}
Category: ${complaint.category}
Received: ${formatDate(receivedDate)}
Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}

This report is advisory and requires human review

---

COMPLAINT OVERVIEW
==================

${reportData.complaintOverview}

---

TIMELINE & COMPLIANCE
=====================

Acknowledgement:
  Date: ${formatDate(reportData.timelineCompliance.acknowledged.date)}
  Days from Receipt: ${reportData.timelineCompliance.acknowledged.daysFromReceived}
  Status: ${reportData.timelineCompliance.acknowledged.status}

Outcome Letter:
  Date: ${formatDate(reportData.timelineCompliance.outcome.date)}
  Days from Receipt: ${reportData.timelineCompliance.outcome.daysFromReceived}
  Status: ${reportData.timelineCompliance.outcome.status}

---

KEY LEARNINGS IDENTIFIED
========================

${reportData.keyLearnings.map((learning: any, index: number) => `
${index + 1}. ${learning.learning}
   Category: ${learning.category} | Impact: ${learning.impact}
`).join('\n')}

---

WHAT THE PRACTICE DID WELL
===========================

${reportData.practiceStrengths.map((strength: string) => `✓ ${strength}`).join('\n')}

---

SUPPORTIVE QUALITY IMPROVEMENT SUGGESTIONS
===========================================

These suggestions are provided to support continuous improvement, not as criticism.

${reportData.improvementSuggestions.map((suggestion: any, index: number) => `
${index + 1}. ${suggestion.suggestion} [${suggestion.priority} priority]
   ${suggestion.rationale}
`).join('\n')}

---

OUTCOME DECISION RATIONALE
===========================

${reportData.outcomeRationale}

---

NHS Complaints Management System
`;

  return content;
}
