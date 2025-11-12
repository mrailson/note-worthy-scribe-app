import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
      serviceType
    } = await req.json();

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
      }
    };

    const config = serviceConfig[serviceType as keyof typeof serviceConfig] || serviceConfig['gp-genie'];
    const serviceColor = config.color;
    const serviceBgColor = config.bgColor;
    const serviceLightBgColor = config.lightBgColor;

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
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${serviceName} Conversation Transcript</title>
      </head>
      <body style="font-family: 'Fira Sans', 'Segoe UI', Arial, sans-serif; background-color: #F9FAFB; padding: 20px; margin: 0;">
        <div style="max-width: 650px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, ${serviceColor} 0%, ${serviceColor}dd 100%); color: white; padding: 32px 24px; text-align: center;">
            <h1 style="margin: 0 0 12px 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">${serviceName.toUpperCase()}</h1>
            <h2 style="margin: 0; font-size: 18px; font-weight: 400; opacity: 0.95;">CONVERSATION TRANSCRIPT</h2>
            <div style="margin-top: 16px; padding: 8px 20px; background-color: rgba(255,255,255,0.2); border-radius: 20px; display: inline-block;">
              <span style="font-size: 14px; font-weight: 500;">Voice Assistant Session</span>
            </div>
          </div>

          <!-- Metadata -->
          <div style="padding: 24px; background-color: ${serviceBgColor}; border-bottom: 2px solid ${serviceColor};">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 12px; font-weight: 600; color: #374151; background-color: white; border-radius: 6px 0 0 0;">Service:</td>
                <td style="padding: 10px 12px; color: #1F2937; background-color: white; border-radius: 0 6px 0 0;">${serviceName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; font-weight: 600; color: #374151; background-color: rgba(255,255,255,0.6);">Start Time:</td>
                <td style="padding: 10px 12px; color: #1F2937; background-color: rgba(255,255,255,0.6);">${formatTime(conversationBuffer[0].timestamp)}</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; font-weight: 600; color: #374151; background-color: white;">End Time:</td>
                <td style="padding: 10px 12px; color: #1F2937; background-color: white;">${formatTime(conversationBuffer[conversationBuffer.length - 1].timestamp)}</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; font-weight: 600; color: #374151; background-color: rgba(255,255,255,0.6);">Duration:</td>
                <td style="padding: 10px 12px; color: #1F2937; background-color: rgba(255,255,255,0.6);">${durationMins} minute${durationMins !== 1 ? 's' : ''}</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; font-weight: 600; color: #374151; background-color: white; border-radius: 0 0 0 6px;">Total Exchanges:</td>
                <td style="padding: 10px 12px; color: #1F2937; background-color: white; border-radius: 0 0 6px 0;">${messageCount}</td>
              </tr>
            </table>
          </div>

          <!-- Conversation -->
          <div style="padding: 32px 24px;">
            <h2 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 20px 0; padding-bottom: 12px; border-bottom: 3px solid ${serviceColor};">
              CONVERSATION HISTORY
            </h2>
            ${conversationHtml}
          </div>

          <!-- Footer -->
          <div style="background-color: #F3F4F6; padding: 24px; text-align: center; font-size: 12px; color: #6B7280; border-top: 1px solid #E5E7EB;">
            <p style="margin: 0 0 8px 0; font-size: 13px;">Generated by <strong style="color: ${serviceColor};">Notewell AI</strong></p>
            <p style="margin: 0 0 8px 0;">This transcript is for your records only</p>
            <p style="margin: 0; font-style: italic; color: #9CA3AF;">Confidential - Do Not Forward</p>
            <p style="margin: 12px 0 0 0; font-size: 11px; color: #9CA3AF;">Conversation ID: ${conversationId}</p>
          </div>

        </div>
      </body>
      </html>
    `;

    // Prepare plain text version
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

    // Send via EmailJS
    console.log(`[Transcript Email] Sending to ${userEmail} via EmailJS...`);
    
    const emailPayload = {
      service_id: Deno.env.get('EMAILJS_SERVICE_ID'),
      template_id: Deno.env.get('EMAILJS_GENERIC_TEMPLATE_ID'),
      user_id: Deno.env.get('EMAILJS_PUBLIC_KEY'),
      accessToken: Deno.env.get('EMAILJS_PRIVATE_KEY'),
      template_params: {
        to_email: userEmail,
        from_name: 'Notewell AI',
        subject: `${serviceName} Conversation Transcript - ${formatTime(conversationBuffer[0].timestamp).split(' on ')[1]}`,
        html_content: emailHtml,
        message: plainText
      }
    };

    console.log('[Transcript Email] EmailJS payload:', {
      service_id: emailPayload.service_id ? 'SET' : 'MISSING',
      template_id: emailPayload.template_id ? 'SET' : 'MISSING',
      user_id: emailPayload.user_id ? 'SET' : 'MISSING',
      accessToken: emailPayload.accessToken ? 'SET' : 'MISSING',
      to_email: userEmail
    });
    
    const emailJsResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailPayload)
    });

    if (!emailJsResponse.ok) {
      const errorText = await emailJsResponse.text();
      console.error('[Transcript Email] EmailJS error:', emailJsResponse.status, errorText);
      throw new Error(`EmailJS error: ${emailJsResponse.status} - ${errorText}`);
    }

    console.log('[Transcript Email] ✅ Email sent successfully');

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
