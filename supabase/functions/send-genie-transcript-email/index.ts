import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, Packer } from "npm:docx@8.5.0";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversationMessage {
  user: string;
  agent: string;
  timestamp: string;
  userTimestamp?: string;
  agentTimestamp?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      userEmail,
      serviceName,
      conversationBuffer,
      conversationId,
      serviceType,
      userContext = {}
    } = await req.json();

    // Extract user details — falls back gracefully if not provided
    const userDisplayName: string = userContext.displayName || userContext.userName || 'Colleague';
    const userRole: string        = userContext.role        || '';
    const userPractice: string    = userContext.practiceName || '';
    const userOds: string         = userContext.practiceOdsCode || '';

    console.log(`[Transcript Email] Processing for ${serviceName}, ${conversationBuffer?.length || 0} messages`);

    // Validate inputs
    if (!userEmail || !conversationBuffer || conversationBuffer.length === 0) {
      console.log('[Transcript Email] Invalid request - missing email or empty buffer');
      return new Response(
        JSON.stringify({ error: 'Invalid request: missing email or conversation data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format timestamp in British format: HH:mm on DD/MM/YYYY
    const formatTime = (isoString: string): string => {
      const date = new Date(isoString);
      const time = date.toLocaleString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const dateStr = date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      return `${time} on ${dateStr}`;
    };

    // Format time only (HH:mm)
    const formatTimeOnly = (isoString: string): string => {
      const date = new Date(isoString);
      return date.toLocaleString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    };

    // Calculate duration
    const startTime = new Date(conversationBuffer[0].timestamp);
    const endTime = new Date(conversationBuffer[conversationBuffer.length - 1].timestamp);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMins = Math.round(durationMs / 60000);

    // Service-specific branding
    const serviceConfig = {
      'gp-genie': {
        color: '#005EB8',
        bgColor: '#E0F2FE',
        lightBgColor: '#EFF6FF',
        name: 'GP Genie'
      },
      'pm-genie': {
        color: '#10B981',
        bgColor: '#D1FAE5',
        lightBgColor: '#ECFDF5',
        name: 'PM Genie'
      },
      'patient-line': {
        color: '#8B5CF6',
        bgColor: '#EDE9FE',
        lightBgColor: '#F5F3FF',
        name: 'Oak Lane Patient Line'
      },
      'nres-agent': {
        color: '#005EB8',
        bgColor: '#EDF4FF',
        lightBgColor: '#F0F6FF',
        name: 'NRES Voice Agent'
      },
      'enn-agent': {
        color: '#7C3AED',
        bgColor: '#EDE9FE',
        lightBgColor: '#F5F3FF',
        name: 'ENN Voice Agent'
      },
      'nres-gp-agent': {
        color: '#4338CA',
        bgColor: '#EEF2FF',
        lightBgColor: '#F5F3FF',
        name: 'NRES GP Voice Agent'
      },
      'nres-pm-agent': {
        color: '#0F766E',
        bgColor: '#CCFBF1',
        lightBgColor: '#F0FDFA',
        name: 'NRES Practice Manager Voice Agent'
      },
      'nres-patient-agent': {
        color: '#6D28D9',
        bgColor: '#EDE9FE',
        lightBgColor: '#F5F3FF',
        name: 'NRES Patient Voice Agent'
      },
      'nres-translate-agent': {
        color: '#047857',
        bgColor: '#D1FAE5',
        lightBgColor: '#ECFDF5',
        name: 'NRES Translation Voice Agent'
      }
    };

    const config = serviceConfig[serviceType as keyof typeof serviceConfig] || serviceConfig['gp-genie'];
    const serviceColor = config.color;
    const serviceBgColor = config.bgColor;
    const serviceLightBgColor = config.lightBgColor;

    // Generate a brief AI summary of the conversation using Claude
    let aiSummary = '';
    try {
      const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY');
      if (ANTHROPIC_KEY && messageCount > 0) {
        const transcriptText = conversationBuffer
          .map((m: ConversationMessage) => {
            const lines: string[] = [];
            if (m.user)  lines.push(`User: ${m.user}`);
            if (m.agent) lines.push(`Agent: ${m.agent}`);
            return lines.join('\n');
          })
          .join('\n');

        const summaryResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 200,
            messages: [{
              role: 'user',
              content: `Summarise this voice conversation in 2-3 warm, plain-English sentences. Focus on what topics were covered and any key points or outcomes. Do not use bullet points. Address the summary to the user directly (e.g. "You asked about..." or "The conversation covered...").\n\nTranscript:\n${transcriptText}`
            }]
          }),
        });
        if (summaryResp.ok) {
          const summaryData = await summaryResp.json();
          aiSummary = summaryData?.content?.[0]?.text?.trim() || '';
        }
      }
    } catch (summaryErr) {
      console.warn('[Transcript Email] AI summary failed (non-fatal):', summaryErr);
    }

    // Build conversation HTML
    let conversationHtml = '';
    conversationBuffer.forEach((msg: ConversationMessage) => {
      if (msg.user) {
        const time = msg.userTimestamp ? formatTimeOnly(msg.userTimestamp) : '';
        conversationHtml += `
          <div style="margin-bottom: 16px; padding: 12px; background-color: ${serviceLightBgColor}; border-radius: 8px; border-left: 3px solid ${serviceColor};">
            <div style="font-weight: 600; color: #1E40AF; margin-bottom: 4px; font-size: 13px;">[${time}] You:</div>
            <div style="color: #1F2937; line-height: 1.5;">${msg.user}</div>
          </div>
        `;
      }
      if (msg.agent) {
        const time = msg.agentTimestamp ? formatTimeOnly(msg.agentTimestamp) : '';
        conversationHtml += `
          <div style="margin-bottom: 16px; padding: 12px; background-color: #F3F4F6; border-radius: 8px; border-left: 3px solid #9CA3AF;">
            <div style="font-weight: 600; color: ${serviceColor}; margin-bottom: 4px; font-size: 13px;">[${time}] ${serviceName}:</div>
            <div style="color: #1F2937; line-height: 1.5;">${msg.agent}</div>
          </div>
        `;
      }
    });

    // Count user messages
    const messageCount = conversationBuffer.filter((m: ConversationMessage) => m.user && m.user.trim()).length;

    // Build full email HTML
    const sessionDate = formatTime(conversationBuffer[0].timestamp).split(' on ')[1] || '';
    const sessionTime = formatTimeOnly(conversationBuffer[0].timestamp);
    const greetingName = userDisplayName.split(' ')[0] || 'there';  // first name only

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${serviceName} — Session Summary</title>
      </head>
      <body style="margin:0;padding:0;background:#F3F4F6;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:28px 0;">
          <tr><td align="center">
          <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

            <!-- NHS blue header -->
            <tr><td style="background:linear-gradient(135deg,#003087 0%,#005EB8 100%);padding:32px 32px 24px;text-align:center;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.65);text-transform:uppercase;">Notewell AI · ${serviceName}</p>
              <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Session Summary</h1>
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.75);">${sessionDate}</p>
            </td></tr>

            <!-- Personal greeting -->
            <tr><td style="padding:28px 32px 0;">
              <p style="margin:0 0 10px;font-size:16px;font-weight:600;color:#111827;">Hi ${greetingName},</p>
              <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#374151;">
                Thank you for using the <strong>${serviceName}</strong> today. Below you'll find a brief summary of your session and the full transcript for your records. If you have any questions about the service, please contact your neighbourhood manager.
              </p>
            </td></tr>

            ${aiSummary ? `
            <!-- AI summary -->
            <tr><td style="padding:0 32px 0;">
              <div style="background:#EFF6FF;border-left:4px solid #005EB8;border-radius:0 8px 8px 0;padding:14px 18px;margin:0 0 4px;">
                <p style="margin:0 0 5px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#005EB8;">Session Summary</p>
                <p style="margin:0;font-size:14px;line-height:1.65;color:#1E3A5F;">${aiSummary}</p>
              </div>
            </td></tr>` : ''}

            <!-- Session details card -->
            <tr><td style="padding:20px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;font-size:13px;">
                ${userDisplayName && userDisplayName !== 'Colleague' ? `
                <tr style="background:#F9FAFB;">
                  <td style="padding:10px 14px;font-weight:600;color:#6B7280;width:35%;">Name</td>
                  <td style="padding:10px 14px;color:#111827;">${userDisplayName}${userRole ? ` &mdash; ${userRole}` : ''}</td>
                </tr>` : ''}
                ${userPractice ? `
                <tr>
                  <td style="padding:10px 14px;font-weight:600;color:#6B7280;border-top:1px solid #F3F4F6;">Organisation</td>
                  <td style="padding:10px 14px;color:#111827;border-top:1px solid #F3F4F6;">${userPractice}${userOds ? ` (${userOds})` : ''}</td>
                </tr>` : ''}
                <tr style="background:#F9FAFB;">
                  <td style="padding:10px 14px;font-weight:600;color:#6B7280;border-top:1px solid #F3F4F6;">Date &amp; Time</td>
                  <td style="padding:10px 14px;color:#111827;border-top:1px solid #F3F4F6;">${sessionTime} &nbsp;·&nbsp; ${sessionDate}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;font-weight:600;color:#6B7280;border-top:1px solid #F3F4F6;">Duration</td>
                  <td style="padding:10px 14px;color:#111827;border-top:1px solid #F3F4F6;">${durationMins} minute${durationMins !== 1 ? 's' : ''} &nbsp;·&nbsp; ${messageCount} exchange${messageCount !== 1 ? 's' : ''}</td>
                </tr>
                <tr style="background:#F9FAFB;">
                  <td style="padding:10px 14px;font-weight:600;color:#6B7280;border-top:1px solid #F3F4F6;">Service</td>
                  <td style="padding:10px 14px;color:#111827;border-top:1px solid #F3F4F6;">${serviceName}</td>
                </tr>
              </table>
            </td></tr>

            <!-- Transcript -->
            <tr><td style="padding:24px 32px 0;">
              <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#111827;border-bottom:2px solid #E5E7EB;padding-bottom:8px;">Full Conversation Transcript</p>
              ${conversationHtml || '<p style="color:#9CA3AF;font-style:italic;font-size:13px;">No conversation content was captured for this session.</p>'}
            </td></tr>

            <!-- Sign-off -->
            <tr><td style="padding:24px 32px 0;">
              <p style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#374151;">
                We hope the session was helpful. This transcript is for your records only — please do not forward it externally.
              </p>
              <p style="margin:0;font-size:14px;color:#374151;">
                Kind regards,<br>
                <strong style="color:#003087;">Notewell AI</strong> · ${serviceName}
              </p>
            </td></tr>

            <!-- Footer -->
            <tr><td style="padding:24px 32px 28px;margin-top:24px;">
              <div style="border-top:1px solid #E5E7EB;padding-top:18px;text-align:center;">
                <p style="margin:0 0 4px;font-size:11px;color:#9CA3AF;">Generated by <strong>Notewell AI</strong> · DCB0129/DCB0160 · MHRA Class I · ICO ZB226324</p>
                <p style="margin:0 0 4px;font-size:11px;color:#9CA3AF;">This transcript is confidential and for your records only. Always apply professional judgement.</p>
                ${conversationId ? `<p style="margin:0;font-size:10px;color:#D1D5DB;">Session ID: ${conversationId}</p>` : ''}
              </div>
            </td></tr>

          </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    // Generate Word document
    console.log('[Transcript Email] Generating Word document...');
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Notewell AI',
                bold: true,
                size: 32,
                color: '005EB8',
                font: 'Calibri'
              })
            ]
          }),
          
          // Service name
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: `${serviceName} - Conversation Transcript`,
                bold: true,
                size: 28,
                color: '2563EB',
                font: 'Calibri'
              })
            ]
          }),

          // Metadata table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' }
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Start Time:', bold: true, font: 'Calibri', size: 22 })] })],
                    width: { size: 30, type: WidthType.PERCENTAGE }
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: formatTime(conversationBuffer[0].timestamp), font: 'Calibri', size: 22 })] })],
                    width: { size: 70, type: WidthType.PERCENTAGE }
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'End Time:', bold: true, font: 'Calibri', size: 22 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatTime(conversationBuffer[conversationBuffer.length - 1].timestamp), font: 'Calibri', size: 22 })] })] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Duration:', bold: true, font: 'Calibri', size: 22 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${durationMins} minutes`, font: 'Calibri', size: 22 })] })] })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Messages:', bold: true, font: 'Calibri', size: 22 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${messageCount} user messages`, font: 'Calibri', size: 22 })] })] })
                ]
              })
            ]
          }),

          new Paragraph({ text: '', spacing: { after: 400 } }),

          // Conversation History heading
          new Paragraph({
            spacing: { before: 240, after: 200 },
            children: [
              new TextRun({
                text: 'Conversation History',
                bold: true,
                size: 24,
                color: '2563EB',
                font: 'Calibri'
              })
            ]
          }),

          // Conversation messages
          ...conversationBuffer.flatMap((msg: ConversationMessage) => {
            const messages: any[] = [];
            
            if (msg.user) {
              const time = msg.userTimestamp ? formatTimeOnly(msg.userTimestamp) : '';
              messages.push(
                new Paragraph({
                  spacing: { before: 200, after: 100 },
                  children: [
                    new TextRun({
                      text: `[${time}] You:`,
                      bold: true,
                      color: '2563EB',
                      size: 22,
                      font: 'Calibri'
                    })
                  ]
                }),
                new Paragraph({
                  spacing: { after: 120 },
                  indent: { left: 360 },
                  children: [
                    new TextRun({
                      text: msg.user,
                      size: 22,
                      color: '374151',
                      font: 'Calibri'
                    })
                  ]
                })
              );
            }
            
            if (msg.agent) {
              const time = msg.agentTimestamp ? formatTimeOnly(msg.agentTimestamp) : '';
              messages.push(
                new Paragraph({
                  spacing: { before: 200, after: 100 },
                  children: [
                    new TextRun({
                      text: `[${time}] ${serviceName}:`,
                      bold: true,
                      color: '10B981',
                      size: 22,
                      font: 'Calibri'
                    })
                  ]
                }),
                new Paragraph({
                  spacing: { after: 120 },
                  indent: { left: 360 },
                  children: [
                    new TextRun({
                      text: msg.agent,
                      size: 22,
                      color: '374151',
                      font: 'Calibri'
                    })
                  ]
                })
              );
            }
            
            return messages;
          }),

          new Paragraph({ text: '', spacing: { before: 400, after: 200 } }),

          // DISCLAIMER
          new Paragraph({
            spacing: { before: 400, after: 200 },
            children: [
              new TextRun({
                text: 'IMPORTANT DISCLAIMER',
                bold: true,
                size: 24,
                color: 'DC2626',
                font: 'Calibri'
              })
            ]
          }),

          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: '⚠️ NOT AN APPROVED NHS CLINICAL TOOL',
                bold: true,
                size: 22,
                color: 'DC2626',
                font: 'Calibri'
              })
            ]
          }),

          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'This tool is provided by Notewell AI for concept testing and demonstration purposes only. It is NOT approved, endorsed, or validated for use within NHS clinical settings for patient diagnosis, treatment, or clinical decision-making.',
                size: 20,
                color: '374151',
                font: 'Calibri'
              })
            ]
          }),

          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({ text: '• ', bold: true, size: 20, font: 'Calibri' }),
              new TextRun({ text: 'Non-Clinical Use Only: ', bold: true, size: 20, font: 'Calibri' }),
              new TextRun({ text: 'This service must NOT be used for patient diagnosis, treatment planning, prescribing, or any clinical decision-making.', size: 20, color: '374151', font: 'Calibri' })
            ]
          }),

          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({ text: '• ', bold: true, size: 20, font: 'Calibri' }),
              new TextRun({ text: 'No Regulatory Approval: ', bold: true, size: 20, font: 'Calibri' }),
              new TextRun({ text: 'This system has not received MHRA approval, CE marking, or any regulatory clearance as a medical device.', size: 20, color: '374151', font: 'Calibri' })
            ]
          }),

          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({ text: '• ', bold: true, size: 20, font: 'Calibri' }),
              new TextRun({ text: 'Data Protection Notice: ', bold: true, size: 20, font: 'Calibri' }),
              new TextRun({ text: 'Do NOT input identifiable patient information. This system is not approved for processing NHS patient data.', size: 20, color: '374151', font: 'Calibri' })
            ]
          }),

          new Paragraph({
            spacing: { before: 200, after: 120 },
            children: [
              new TextRun({
                text: 'By using this service, you acknowledge these limitations. If you require clinical-grade tools, please use only NHS-approved and clinically validated systems.',
                bold: true,
                size: 20,
                color: 'DC2626',
                font: 'Calibri'
              })
            ]
          }),

          new Paragraph({ text: '', spacing: { before: 400 } }),

          // Footer
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400 },
            children: [
              new TextRun({
                text: 'Generated by Notewell AI',
                size: 18,
                color: '6B7280',
                italics: true,
                font: 'Calibri'
              })
            ]
          }),
          
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Document created: ${formatTime(new Date().toISOString())}`,
                size: 18,
                color: '6B7280',
                italics: true,
                font: 'Calibri'
              })
            ]
          })
        ]
      }]
    });

    // Generate buffer
    const docBuffer = await Packer.toBuffer(doc);
    const docBase64 = btoa(String.fromCharCode(...new Uint8Array(docBuffer)));
    
    console.log('[Transcript Email] Word document generated, size:', docBuffer.byteLength, 'bytes');

    // Prepare plain text version for fallback
    const plainText = `
${serviceName.toUpperCase()} CONVERSATION TRANSCRIPT
${'='.repeat(60)}

Service: ${serviceName}
Start Time: ${formatTime(conversationBuffer[0].timestamp)}
End Time: ${formatTime(conversationBuffer[conversationBuffer.length - 1].timestamp)}
Duration: ${durationMins} minute${durationMins !== 1 ? 's' : ''}
Total Exchanges: ${messageCount}

CONVERSATION HISTORY
${'-'.repeat(60)}

${conversationBuffer.map((msg: ConversationMessage) => {
  let text = '';
  if (msg.user) {
    const time = msg.userTimestamp ? formatTimeOnly(msg.userTimestamp) : '';
    text += `[${time}] You:\n${msg.user}\n\n`;
  }
  if (msg.agent) {
    const time = msg.agentTimestamp ? formatTimeOnly(msg.agentTimestamp) : '';
    text += `[${time}] ${serviceName}:\n${msg.agent}\n\n`;
  }
  return text;
}).join('')}

${'='.repeat(60)}
Generated by Notewell AI
This transcript is for your records only
Confidential - Do Not Forward
Conversation ID: ${conversationId}
    `.trim();

    // Send via Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const sessionDateStr = formatTime(conversationBuffer[0].timestamp).split(' on ')[1] || new Date().toLocaleDateString('en-GB');
    const emailSubject = `${serviceName} — Your Session Summary for ${sessionDateStr}${userPractice ? ' · ' + userPractice : ''}`;
    console.log(`[Transcript Email] Sending to ${userEmail} via Resend...`);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Notewell AI <noreply@bluepcn.co.uk>',
        to: [userEmail],
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('[Transcript Email] Resend error:', resendResponse.status, errorText);
      throw new Error(`Resend error: ${resendResponse.status} - ${errorText}`);
    }

    console.log('[Transcript Email] ✅ Email sent successfully via Resend');

    return new Response(
      JSON.stringify({ 
        success: true,
        messageCount: messageCount,
        duration: durationMins
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Transcript Email] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
