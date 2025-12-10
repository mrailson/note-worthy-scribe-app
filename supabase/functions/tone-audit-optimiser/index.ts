import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a professional NHS governance editor. Your role is to review already-written meeting minutes and polish the tone so it reads like a formal board-level document. You must not remove factual content or decisions, only adjust tone and phrasing for professionalism.`;

const USER_PROMPT_TEMPLATE = `Review the following meeting-minutes text and make tone and language adjustments to ensure it is suitable for NHS Board or ICB circulation.

Apply these rules:
1) Neutralise emotional or informal language (e.g., metaphors like "wolf ready to pounce", idioms, jokes) → replace with objective phrasing (e.g., "members expressed concern", "noted operational constraints").
2) Recast personal references (e.g., "Rich's mother-in-law") → replace with neutral roles (e.g., "the SPLW candidate").
3) Diplomatic phrasing: replace strong criticism with governance-safe terms ("criticised" → "raised concerns", "angry" → "expressed concern").
4) Professional lexical preference: prefer "members discussed/noted/agreed" over conversational wording.
5) Consistency: keep headings, tense, numbering; never delete decisions, actions, or risks; do not change data, dates, or facts.
6) Final check: output must be objective, factual, and suitable for a formal Board pack.

---

Minutes to polish:

{{minutes_text}}

---

Return only the polished document text, no preface or commentary.`;

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
        temperature: 0.2,
        max_completion_tokens: 3000
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
