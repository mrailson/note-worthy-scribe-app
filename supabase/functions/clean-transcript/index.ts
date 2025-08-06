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

    const { rawTranscript, meetingTitle } = await req.json();

    if (!rawTranscript) {
      throw new Error('Missing required field: rawTranscript');
    }

    console.log('Cleaning transcript for:', meetingTitle || 'Meeting');
    console.log('🔍 Input transcript length:', rawTranscript.length);
    console.log('🔍 Input transcript ending:', rawTranscript.slice(-200));

    const systemPrompt = `You are a conservative transcript cleaner. Your ONLY job is to fix obvious technical errors from speech-to-text while preserving exactly what was spoken.

STRICT RULES - YOU MUST FOLLOW THESE:
1. Fix word spacing issues ONLY (e.g., "howcan" → "how can", "goodmorning" → "good morning")
2. Remove clear filler words (um, uh, er) but keep all meaningful content
3. Fix obvious capitalization and basic punctuation
4. Correct spacing around punctuation marks
5. DO NOT interpret, expand, or add ANY context to numbers, sequences, or partial words
6. DO NOT turn number sequences into phone numbers, addresses, or any other format
7. DO NOT add words that weren't clearly spoken
8. DO NOT change the meaning or add professional context

CRITICAL EXAMPLES OF WHAT NOT TO DO:
- If someone says "4 5 6 7 8 9" → DO NOT turn it into "Please give us a call at 1-800-566-7898"
- If someone says numbers → Keep them as numbers, don't make them into phone numbers
- If someone says partial words → Keep them partial, don't complete them

WHAT YOU SHOULD DO:
- "howcan I help" → "how can I help"
- "um, testing 1 2 3" → "testing 1 2 3"
- "call me at um 555 1234" → "call me at 555 1234"

Be extremely conservative. When in doubt, leave the text as-is rather than risk changing the meaning.

Return only the minimally cleaned transcript with no additional commentary.`;

    const userPrompt = `Please clean and format this raw transcript:

${rawTranscript}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Use latest GPT-4 model for best results
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent formatting
        max_tokens: 16384 // Maximum output tokens
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const cleanedTranscript = data.choices[0].message.content;

    console.log('Successfully cleaned transcript');
    console.log('🔍 Output transcript length:', cleanedTranscript.length);
    console.log('🔍 Output transcript ending:', cleanedTranscript.slice(-200));

    return new Response(JSON.stringify({ 
      cleanedTranscript,
      originalLength: rawTranscript.length,
      cleanedLength: cleanedTranscript.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in clean-transcript function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});