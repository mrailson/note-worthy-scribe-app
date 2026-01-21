import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ToneOption = 'friendly' | 'concise' | 'add-availability' | 'formal';

const TONE_INSTRUCTIONS: Record<ToneOption, string> = {
  'friendly': `Make the letter more warm and personable while maintaining professionalism:
- Add appropriate courtesies ("Thank you for seeing...")
- Use slightly warmer language
- Maintain all clinical facts exactly as written
- Do not add any new clinical information`,

  'concise': `Make the letter more concise and to the point:
- Remove unnecessary pleasantries
- Use bullet points where appropriate
- Keep all essential clinical information
- Aim for brevity without losing clarity`,

  'add-availability': `Add a professional closing line about clinician availability:
- Add: "Please do not hesitate to contact me if you require any further information or wish to discuss this patient."
- Or similar professional variant
- Keep all other content unchanged`,

  'formal': `Make the letter more formal and structured:
- Use formal medical language
- Ensure proper paragraph structure
- Use formal salutations
- Maintain all clinical facts exactly`,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { letterContent, toneOption, customInstruction } = await req.json();

    if (!letterContent) {
      return new Response(
        JSON.stringify({ error: 'Letter content required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!toneOption && !customInstruction) {
      return new Response(
        JSON.stringify({ error: 'Tone option or custom instruction required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const toneInstruction = toneOption 
      ? TONE_INSTRUCTIONS[toneOption as ToneOption] 
      : customInstruction;

    const systemPrompt = `You are a medical letter tone editor. Your ONLY job is to adjust the TONE and STYLE of letters.

CRITICAL SAFETY RULES:
1. NEVER add new clinical facts, findings, or diagnoses
2. NEVER change the meaning of clinical statements
3. NEVER remove safety-critical information
4. ONLY modify: word choice, sentence structure, paragraphing, politeness level
5. If the instruction asks you to add clinical content, REFUSE and explain why

After rewriting, you MUST verify that:
- All symptoms mentioned in original are in rewrite
- All investigations mentioned in original are in rewrite
- All risk factors mentioned in original are in rewrite
- No new clinical facts were added

Return a JSON object with:
{
  "rewrittenContent": "the rewritten letter",
  "changesApplied": ["list of tone changes made"],
  "clinicalFactsPreserved": true/false,
  "warning": "any warning if clinical content was at risk"
}`;

    const userContent = `ORIGINAL LETTER:
${letterContent}

REQUESTED TONE CHANGE:
${toneInstruction}

Rewrite the letter applying ONLY the tone change. Preserve all clinical facts exactly.`;

    console.log('Rewriting referral with tone option:', toneOption || 'custom');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    console.log('Tone rewrite complete, clinical facts preserved:', result.clinicalFactsPreserved);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in rewrite-referral-tone:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
