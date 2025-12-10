import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a professional NHS governance editor.
You review meeting minutes and polish the language so it is suitable for Board, ICB, Audit Committee, or formal organisational circulation.
You must ensure the content remains factual but the tone is neutral, diplomatic, and professionally worded at all times.

Do not remove decisions, actions, risks, data, or factual content.
Do not change meaning.
Only adjust language, tone, and phrasing.`;

const USER_PROMPT_TEMPLATE = `Review the meeting-minutes text below and rewrite it with full NHS governance-level professional tone, applying ALL rules:

1. Remove inappropriate personal identifiers
Replace any mention of family relations, anecdotes, or informal descriptors such as:
- "Rich's mother-in-law"
- "someone's wife", "my mate", "the lady from…"
→ Replace with neutral role descriptions, e.g.:
- "the previously identified SPLW candidate"
- "a member of staff"
- "a candidate for the role"

2. Remove or replace metaphors, idioms, jokes or figurative language
Identify and neutralise expressions like:
- "wolf ready to pounce"
- "catch 22"
- "nightmare"
- "clever and quick"
- "touthy-feely issues"
- "dance camp", "posh camp"
→ Replace with formal equivalents:
- "members expressed concern about…"
- "noted structural constraints…"
- "identified significant operational challenges…"

3. Replace colloquial or quoted expressions with professional equivalents
Remove direct quotes of casual or informal speech such as:
- "more money, less hours"
- "strictly sticking to templates"
- anything sounding conversational
→ Instead:
- "the individual expressed a preference for reduced hours and higher remuneration"
- "the approach was described as template-driven"

4. Reduce blunt, critical or adversarial language
Replace direct criticism with diplomatically phrased equivalents.
Examples:
- "PML is seeking money" → "Members discussed concerns about the alignment of PML services with PCN priorities."
- "disconnect between ICB ideas and reality" → "Members noted practical challenges in implementing some ICB proposals."
- "competency concerns" → "concerns were noted regarding progression through required training."
- "disunity as a reason for general practice to fail" → "concerns were raised about the importance of cohesion across practices."

5. Replace capability-judging statements with neutral descriptions
Examples:
- "does not address stress or anxiety" → "feedback indicated that broader patient support needs may not always be addressed."
- "failing a prescribing course" → "the individual has not yet completed the prescribing qualification."

6. Ensure ALL tone is governance-safe
Use phrases such as:
- "members discussed…"
- "the group noted…"
- "concerns were raised…"
- "it was agreed that…"
- "options were explored…"

Avoid phrases such as:
- "they felt"
- "they were frustrated"
- "they were annoyed"
- "they argued"
- "they said X was pointless"
- "X is a problem"

7. Preserve structure and factual content
Do NOT remove:
- agenda items
- decisions
- action items
- risks
- dates
- names of organisations
- financial figures
- estates/legal details
- workforce details
Your role is tone correction only.

8. Return the final polished document only
No commentary, no explanation.

---

Minutes to polish:

{{minutes_text}}

---

Return only the rewritten, tone-optimised meeting minutes.`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('🎯 tone-audit-optimiser invoked at:', new Date().toISOString());

  try {
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const { minutes_text } = await req.json();

    if (!minutes_text) {
      throw new Error('minutes_text is required');
    }

    console.log(`📊 Input length: ${minutes_text.length} characters`);

    // Build the user prompt with the minutes text
    const userPrompt = USER_PROMPT_TEMPLATE.replace('{{minutes_text}}', minutes_text);

    console.log('📤 Sending request to OpenAI GPT-5...');
    const apiStartTime = Date.now();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 4000
      }),
    });

    const apiEndTime = Date.now();
    console.log(`⚡ OpenAI response received in: ${apiEndTime - apiStartTime}ms`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI error:', response.status, errorData);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      if (response.status === 402) {
        throw new Error('Insufficient OpenAI credits.');
      }
      
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const polished_minutes = data.choices[0].message.content;

    console.log(`✅ Polished output length: ${polished_minutes.length} characters`);
    console.log(`⏱️ Total processing time: ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({ polished_minutes }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Error in tone-audit-optimiser:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
