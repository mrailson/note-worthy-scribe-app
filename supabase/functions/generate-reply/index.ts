import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { 
      emailText, 
      contextNotes, 
      responseGuidance, 
      tone, 
      replyLength, 
      mode, 
      draftText 
    } = await req.json();

    if (!emailText) {
      throw new Error('Email text is required');
    }

    // Build the prompt based on mode
    let systemPrompt = `You are ReplyWell AI, a professional correspondence assistant for NHS GP practices, PCNs, and healthcare staff. Generate professional, appropriate responses to incoming correspondence.

TONE: ${tone}
REPLY LENGTH: ${replyLength}/5 (1=very brief, 5=comprehensive)
MODE: ${mode}

Guidelines:
- Be professional and appropriate for NHS/healthcare context
- Follow NHS communication standards
- Include relevant contact information placeholders
- Use appropriate medical/administrative terminology
- Maintain patient confidentiality
- Be clear and actionable`;

    let userPrompt;
    if (mode === 'improve' && draftText) {
      userPrompt = `Improve this draft response:

ORIGINAL EMAIL:
${emailText}

DRAFT TO IMPROVE:
${draftText}

CONTEXT: ${contextNotes || 'No additional context provided'}
GUIDANCE: ${responseGuidance || 'No specific guidance provided'}

Please improve the draft while maintaining the core message.`;
    } else {
      userPrompt = `Generate a reply to this email:

ORIGINAL EMAIL:
${emailText}

CONTEXT: ${contextNotes || 'No additional context provided'}
GUIDANCE: ${responseGuidance || 'No specific guidance provided'}

Generate an appropriate response.`;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: replyLength * 200, // Scale tokens with reply length
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    const generatedReply = data.choices[0].message.content;

    return new Response(JSON.stringify({ 
      generatedReply,
      usage: data.usage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-reply function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to generate reply' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});