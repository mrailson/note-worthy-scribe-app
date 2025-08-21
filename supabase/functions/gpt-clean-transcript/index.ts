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

    console.log('🧹 GPT cleaning transcript, length:', transcript.length);

    const instructions = `You are a transcript cleaner. Your job is to remove duplicated or near-duplicated sentences caused by Whisper joins.

Rules:
- Keep only one version of repeated sentences or fragments (e.g. 'We've seen a small increase again this month...' should appear once).
- Merge semantically similar lines (e.g. 'urgent items to activate' and 'urgent items to add to the agenda' → keep only the clearer version).
- Drop short stray fragments like 'No?' that don't add value.
- Preserve meaning and flow of the meeting.
- Do not paraphrase, only remove duplicates/fragments.
- Keep chronological order.

Input transcript:
${transcript}

Cleaned transcript:`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          {
            role: 'system',
            content: 'You are a transcript cleaner. Your job is to remove duplicated or near-duplicated sentences caused by Whisper joins.'
          },
          {
            role: 'user',
            content: instructions
          }
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

    console.log('✅ GPT cleaning completed, output length:', cleanedTranscript.length);

    return new Response(JSON.stringify({ 
      cleanedTranscript,
      originalLength: transcript.length,
      cleanedLength: cleanedTranscript.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in gpt-clean-transcript function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});