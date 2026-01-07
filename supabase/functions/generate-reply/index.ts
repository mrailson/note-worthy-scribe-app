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

    // Build the prompt based on mode with CRITICAL MEDICAL SAFETY GUARDRAILS
let systemPrompt = `You are ReplyWell AI, a professional correspondence assistant for NHS GP practices, PCNs, and healthcare staff. Generate professional, appropriate responses to incoming correspondence.

🚨 CRITICAL MEDICAL SAFETY RESTRICTIONS - NEVER VIOLATE THESE:
1. NEVER fabricate, invent, or generate ANY medical information not explicitly provided in the input
2. NEVER create blood test results, lab values, ranges, or medical measurements
3. NEVER suggest diagnoses, medical conditions, or clinical assessments
4. NEVER recommend medications, dosages, or treatment plans
5. NEVER create appointment details, medical records, or clinical data
6. NEVER generate medical opinions, clinical evaluations, or health advice
7. ONLY reference information EXPLICITLY stated in the provided context
8. If medical information is needed but not provided, respond with: "This requires review of patient records" or similar

ALLOWED CONTENT ONLY:
- Administrative responses (appointments, contact info, general practice information)
- Acknowledgment of receipt
- Referral to appropriate staff member
- General practice policies and procedures
- Non-clinical correspondence

✍️ WRITING STYLE - CRITICAL EMAIL OPENING RULES:
NEVER start emails with any of these clichéd phrases:
- "I hope you are well" / "I hope this finds you well" / "I hope this email finds you well"
- "I trust this email finds you well" / "I trust you are well"
- "Thank you for your email" / "Thank you for contacting us" / "Thank you for reaching out"
- "Thank you for getting in touch" / "Many thanks for your email"
- "I am writing to..." / "I'm writing to..."
- "Further to your email..." / "With reference to your recent correspondence..."
- "Hope you're having a good day" / "Hope all is well"
- "Good morning/afternoon" as a standalone opener
- Any variation of the above

INSTEAD, start emails DIRECTLY with the substance:
- Jump straight to acknowledging the specific matter at hand
- Reference the actual topic from their correspondence
- Use context-specific openings that demonstrate you've read their message

VARY your opening style using approaches like:
- "We've received your request regarding [specific topic]..."
- "Following your query about [specific matter]..."
- "[Topic] - we can confirm that..."
- "Regarding your [appointment/request/query]..."
- "Your message about [topic] has been reviewed..."
- "In response to your enquiry about..."
- "Concerning your recent [request/question]..."
- Start with a direct answer or action taken

TONE: ${tone}
REPLY LENGTH: ${replyLength}/5 (1=very brief, 5=comprehensive)
MODE: ${mode}

Guidelines:
- Be professional and appropriate for NHS/healthcare context
- Follow NHS communication standards
- NEVER include placeholder contact information - only use real details provided
- Use appropriate administrative terminology (avoid clinical terms unless explicitly mentioned)
- Maintain patient confidentiality at all times
- Be clear and actionable for administrative matters only
- If uncertain about medical content, defer to clinical staff review`;

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