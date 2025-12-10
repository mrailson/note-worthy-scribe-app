import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are an NHS governance editor.
Your job is to transform meeting minutes into neutral, factual, diplomatic language suitable for Board, ICB, and partner organisation circulation.
You must keep all factual content but remove any language that is emotive, critical, informal, political, adversarial, or personally identifying.`;

const USER_PROMPT_TEMPLATE = `Rewrite the following meeting minutes into a fully governance-safe format, applying ALL rules:

---

🔹 1. Remove adversarial or politically sensitive language

Replace expressions such as:
- "playing both sides"
- "divorce from PML"
- "financial gain"
- "seeking relevance"
- "encroachment by NHFT"
- "control over general practice"
- "negative experiences with their administration"
with neutral, factual equivalents:
- "maintain constructive engagement"
- "transition away from the current arrangement"
- "concerns were raised about alignment with PCN priorities"
- "members noted potential implications"
- "operational challenges were highlighted"

---

🔹 2. Remove informal expressions, metaphors, or dramatic wording

Replace all metaphors such as:
- "wolf ready to pounce"
- "catch-22"
- "fast and position-filled"
- "frustration"
with:
- "members expressed concern…"
- "noted structural constraints…"
- "members emphasised the need for timely action"

---

🔹 3. Remove personal identifiers and replace with roles

Replace:
- "Rich's mother-in-law"
- references to individuals' private circumstances
with:
- "the previous SPLW candidate"

---

🔹 4. Recast capability concerns into formal governance language

Replace:
- "failed a prescribing course"
→ "has not yet completed the prescribing qualification"
- "holistic approach was questioned"
→ "feedback indicated opportunities to broaden the scope of practice"

---

🔹 5. Remove any informal quotes

Eliminate:
- "more money, less hours"
- "dance camp / posh camp"
- any casual repetition of verbal remarks
Rephrase as formal descriptive statements.

---

🔹 6. Ensure the final tone is:
- neutral
- factual
- diplomatic
- suitable for the ICB
- suitable for PML, NHFT, or any partner to read
- suitable for FOI disclosure

---

🔹 7. Preserve all structure & facts

Do NOT remove decisions, action items, dates, risks, services, financial figures, estates/legal details, or workforce context.

---

INPUT:

{{minutes_text}}

---

OUTPUT:

Return only the fully rewritten, governance-optimised minutes.`;

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
        max_completion_tokens: 16000
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
    console.log('📋 Response structure:', JSON.stringify(data, null, 2).slice(0, 500));
    
    // GPT-5 uses output_text, fallback to message.content for older models
    const polished_minutes = data.output_text || data.choices?.[0]?.message?.content || '';

    console.log(`✅ Polished output length: ${polished_minutes.length} characters`);
    console.log(`⏱️ Total processing time: ${Date.now() - startTime}ms`);
    console.log('📄 FULL OUTPUT START >>>');
    console.log(polished_minutes);
    console.log('<<< FULL OUTPUT END');

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
