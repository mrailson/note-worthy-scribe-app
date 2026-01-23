const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AdminTemplateType = 'free' | 'meeting-minutes' | 'complaint-response' | 'staff-letter' | 'hr-record' | 'significant-event' | 'policy-draft' | 'briefing-note';

const TEMPLATE_INSTRUCTIONS: Record<AdminTemplateType, string> = {
  'free': `Clean, readable paragraphs. NO headings unless already dictated.`,
  
  'meeting-minutes': `Format as professional meeting minutes with:
- Clear sections: Discussion, Decisions, Actions
- Action items as bullet points with owner names in brackets if mentioned
- Keep factual and concise
- Use British date format (DD Month YYYY)
- Remove filler words and informal language`,

  'complaint-response': `Format as a professional complaint response:
- Formal, empathetic tone suitable for NHS correspondence
- Clear paragraph structure
- Acknowledge the concern, explain findings, state resolution
- Professional sign-off ready for signature
- Keep defensive language but remain compassionate`,

  'staff-letter': `Format as a professional staff/stakeholder letter:
- Formal business letter structure
- Clear, professional language
- Proper salutation and sign-off
- British English throughout`,

  'hr-record': `Format as an HR documentation record:
- Factual, objective language
- Bullet points for key facts
- Dates and times clearly stated (British format)
- Neutral, non-judgemental tone throughout
- Clear separation of facts vs opinions/assessments`,

  'significant-event': `Format as a Significant Event Analysis (SEA):
- Structured sections: What happened, Contributing factors, Learning points, Actions
- Objective, non-blaming, learning-focused language
- Clear action items with responsibilities
- PSIRF/SEA-compliant structure`,

  'policy-draft': `Format as a practice policy/SOP document:
- Numbered sections and subsections
- Clear headings
- Professional governance language
- Version control placeholders
- Review date placeholders`,

  'briefing-note': `Format as a concise briefing note:
- Bullet points for key facts
- Executive summary style
- Clear action section
- Short, scannable paragraphs`,
};

function buildSystemPrompt(templateInstruction: string): string {
  return `You are a UK GP practice administration dictation formatter.

Your role is NOT to summarise, reinterpret, or add content.

Your role is ONLY to lightly clean, correct, and format dictated text so it reads clearly and professionally while preserving the original meaning exactly.

This output must be suitable for official NHS/GP practice documentation.

────────────────────────────────
CORE SAFETY RULES (CRITICAL)
────────────────────────────────

1. DO NOT add, infer, summarise, omit, or reinterpret any information.
2. DO NOT introduce conclusions or recommendations that were not explicitly dictated.
3. If something is ambiguous, KEEP it ambiguous.
4. If something sounds incomplete, LEAVE it incomplete.
5. Preserve uncertainty exactly as spoken (e.g. "possibly", "may be", "unclear").
6. Do not strengthen or soften statements.

This is a transcription tidy-up, NOT a content enhancer.

────────────────────────────────
LANGUAGE & STYLE
────────────────────────────────

• Use British English throughout (organised, centre, behaviour, colour).
• Maintain a professional administrative tone.
• Do not over-formalise conversational dictation.
• Use British date format: 21 January 2026 (not January 21, 2026).

────────────────────────────────
TEXT CLEAN-UP RULES
────────────────────────────────

• Remove filler words ONLY where clearly non-substantive:
  ("um", "uh", "you know", "sort of", "kind of", "basically")
• Fix obvious speech-to-text errors ONLY when meaning is clear.
• Fix repeated words ("the the", "and and").
• Improve punctuation and capitalisation.
• Add paragraph breaks at natural pauses or topic changes.
• Preserve original sentence order unless absolutely required for clarity.

────────────────────────────────
TEMPLATE-SPECIFIC INSTRUCTIONS
────────────────────────────────

${templateInstruction}

────────────────────────────────
OUTPUT
────────────────────────────────

Return ONLY the cleaned and formatted text with no preamble, explanation, or commentary.
Do not wrap in quotes or markdown code blocks.
Preserve the speaker's intent exactly.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, templateType = 'free' } = await req.json();

    if (!content || typeof content !== 'string' || content.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: 'Content is required and must be at least 5 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const template = templateType as AdminTemplateType;
    const templateInstruction = TEMPLATE_INSTRUCTIONS[template] || TEMPLATE_INSTRUCTIONS['free'];
    const systemPrompt = buildSystemPrompt(templateInstruction);

    // Use Lovable AI Gateway with Gemini for speed
    const gatewayUrl = Deno.env.get('AI_GATEWAY_URL') || 'https://ai-gateway.lovable.dev/v1/chat/completions';
    const gatewayApiKey = Deno.env.get('AI_GATEWAY_API_KEY');

    let formattedContent: string;

    if (gatewayApiKey) {
      console.log('📝 Using Lovable AI Gateway for admin dictation formatting');
      
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${gatewayApiKey}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: content.trim() }
          ],
          temperature: 0.3,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gateway error:', errorText);
        throw new Error(`AI Gateway request failed: ${response.status}`);
      }

      const result = await response.json();
      formattedContent = result.choices?.[0]?.message?.content?.trim() || content;
    } else {
      // Fallback to OpenAI
      const openaiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiKey) {
        throw new Error('No AI service configured');
      }

      console.log('📝 Falling back to OpenAI for admin dictation formatting');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: content.trim() }
          ],
          temperature: 0.3,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI error:', errorText);
        throw new Error(`OpenAI request failed: ${response.status}`);
      }

      const result = await response.json();
      formattedContent = result.choices?.[0]?.message?.content?.trim() || content;
    }

    console.log(`✅ Admin dictation formatted successfully (${template} template)`);

    return new Response(
      JSON.stringify({ 
        formattedContent,
        templateType: template,
        originalLength: content.length,
        formattedLength: formattedContent.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Admin dictation formatting error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to format dictation' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
