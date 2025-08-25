import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { transcript } = await req.json();
    if (!transcript) {
      throw new Error('Missing required field: transcript');
    }

    console.log('🧹 Strict GPT Deep Clean transcript, length:', transcript.length);

    const instructions = `
You are a strict transcript cleaner for NHS GP meetings.  

Your ONLY job is to:
- Remove duplicate or near-duplicate sentences caused by Whisper/Deepgram joins.
- Remove stray fragments (e.g. "No?" or clipped starts like "...").
- Preserve chronological order and meaning exactly as spoken.
- Do NOT paraphrase, shorten, or reword. Only delete duplicates/fragments.
- Correct NHS-specific terms consistently (case-sensitive):
  * "ARRS", never AR or ARS
  * "PCN DES" (not PCMDS/PCMDA/etc.)
  * "SystmOne" (not System 1 or system one)
  * "Docman" (not DocMan or document workflow)
  * "CQC compliance" (not compliant/compliant.)
  * "QOF" (not QOF performance/preferences)
- Do not add explanations, summaries, or stylistic rewrites.
- Output clean meeting text only.

Input transcript:
${transcript}

Cleaned transcript:
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a transcript cleaner. Delete duplicates/fragments only, no paraphrasing.' },
          { role: 'user', content: instructions }
        ],
        max_completion_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const cleanedTranscript = data.choices[0].message.content;

    console.log('✅ Strict GPT cleaning completed, output length:', cleanedTranscript.length);

    return new Response(JSON.stringify({ 
      cleanedTranscript,
      originalLength: transcript.length,
      cleanedLength: cleanedTranscript.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in gpt-clean-transcript function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});