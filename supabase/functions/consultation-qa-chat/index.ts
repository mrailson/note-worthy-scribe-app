import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, conversationHistory, consultationContext } = await req.json();

    if (!question) {
      return new Response(
        JSON.stringify({ error: 'Question is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get today's date formatted for UK
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Build context from consultation data
    const contextParts: string[] = [];
    
    if (consultationContext?.consultationType) {
      contextParts.push(`**Consultation Type:** ${consultationContext.consultationType}`);
    }
    
    if (consultationContext?.soapNote) {
      const soap = consultationContext.soapNote;
      contextParts.push('\n**SOAP Notes:**');
      if (soap.subjective) contextParts.push(`- **Subjective:** ${soap.subjective}`);
      if (soap.objective) contextParts.push(`- **Objective:** ${soap.objective}`);
      if (soap.assessment) contextParts.push(`- **Assessment:** ${soap.assessment}`);
      if (soap.plan) contextParts.push(`- **Plan:** ${soap.plan}`);
    }
    
    if (consultationContext?.transcript) {
      contextParts.push(`\n**Transcript:**\n${consultationContext.transcript}`);
    }

    const context = contextParts.join('\n');

    // Build professional signature block from practice context
    let signatureBlock = '';
    const clinicianName = consultationContext?.clinicianName || '';
    const letterSignature = consultationContext?.letterSignature || '';
    const practiceName = consultationContext?.practiceName || '';
    const practiceAddress = consultationContext?.practiceAddress || '';
    const practicePhone = consultationContext?.practicePhone || '';
    const practiceEmail = consultationContext?.practiceEmail || '';

    if (clinicianName || letterSignature || practiceName) {
      const signatureParts: string[] = [];
      
      // Clinician details
      if (letterSignature) {
        signatureParts.push(letterSignature);
      } else if (clinicianName) {
        signatureParts.push(`**${clinicianName}**`);
      }
      
      // Practice details - formatted professionally
      if (practiceName) {
        signatureParts.push('');
        signatureParts.push(`**${practiceName}**`);
      }
      if (practiceAddress) {
        signatureParts.push(practiceAddress);
      }
      if (practicePhone) {
        signatureParts.push(`Tel: ${practicePhone}`);
      }
      if (practiceEmail) {
        signatureParts.push(`Email: ${practiceEmail}`);
      }
      
      signatureBlock = signatureParts.join('\n');
    }

    const signatureInstruction = signatureBlock 
      ? `

**CRITICAL - Letter Date and Signature:**
- Today's date is: ${formattedDate}
- ALWAYS use today's date (${formattedDate}) for any letters or correspondence - never use any other date
- When drafting letters, end with this exact signature block:

Yours sincerely,

${signatureBlock}

Ensure proper line spacing between the sign-off and signature details.`
      : `

**CRITICAL - Letter Date:**
- Today's date is: ${formattedDate}
- ALWAYS use today's date (${formattedDate}) for any letters or correspondence - never use any other date`;

    const systemPrompt = `You are a clinical AI assistant helping UK NHS GPs review their consultations. You have access to the consultation transcript and SOAP notes.

**Guidelines:**
- Use British English spelling and terminology
- Reference NHS and NICE guidelines where relevant
- Be concise but thorough
- Format responses using Markdown for clarity
- When suggesting referrals, use appropriate NHS pathways
- Include relevant clinical reasoning
- If asked about investigations, consider cost-effectiveness and availability in primary care
- For safety netting, include specific red flag symptoms and timeframes
${signatureInstruction}

**Consultation Context:**
${context}

Respond helpfully and professionally to the clinician's questions about this consultation.`;

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add the current question
    messages.push({ role: 'user', content: question });

    console.log('Calling Lovable AI for consultation Q&A');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || 'I apologise, I could not generate a response.';

    console.log('Successfully generated consultation Q&A response');

    return new Response(
      JSON.stringify({ answer }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in consultation-qa-chat:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
