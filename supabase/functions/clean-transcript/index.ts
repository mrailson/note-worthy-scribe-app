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

    const systemPrompt = `You are an expert transcript cleaner and formatter. Your task is to take raw, unformatted speech-to-text transcripts and transform them into clean, readable, professional text. 

Your responsibilities:
1. Remove filler words (um, uh, er, you know, like, etc.)
2. Fix grammar and sentence structure
3. Add proper punctuation and capitalization
4. Correct obvious speech-to-text errors
5. Organize the content into coherent paragraphs
6. Maintain the original meaning and context
7. Make the text flow naturally as if it were written professionally
8. Remove repetitive phrases and false starts
9. Ensure proper formatting with clear paragraphs

Do NOT:
- Add content that wasn't spoken
- Change the essential meaning
- Add speaker labels or names
- Create bullet points unless the speaker clearly indicated them
- Make assumptions about who said what

Return only the cleaned transcript without any additional commentary.`;

    const userPrompt = `Please clean and format this raw transcript:

${rawTranscript}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
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
        max_tokens: 4000
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