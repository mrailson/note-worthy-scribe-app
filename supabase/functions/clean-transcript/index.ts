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

    const systemPrompt = `You are an expert transcript cleaner and formatter. Your task is to take raw, unformatted speech-to-text transcripts and transform them into clean, readable, professional text. 

Your responsibilities:
1. Fix word spacing issues (e.g., "howcan I helpyou" → "how can I help you", "goodmorning" → "good morning")
2. Remove filler words (um, uh, er, you know, like, etc.)
3. Fix grammar and sentence structure
4. Add proper punctuation and capitalization
5. Correct obvious speech-to-text errors
6. Organize the content into coherent paragraphs
7. Maintain the original meaning and context
8. Make the text flow naturally as if it were written professionally
9. Remove repetitive phrases and false starts
10. Ensure proper formatting with clear paragraphs
11. Fix merged words and missing spaces between words
12. Correct spacing around punctuation marks

CRITICAL: Pay special attention to words that have been incorrectly joined together by speech-to-text. Common examples:
- "howcan" → "how can"
- "goodmorning" → "good morning" 
- "thankyou" → "thank you"
- "helpyou" → "help you"
- "seeyou" → "see you"
- "howare" → "how are"
- "whatcan" → "what can"

Do NOT:
- Add content that wasn't spoken
- Change the essential meaning
- Add speaker labels or names
- Create bullet points unless the speaker clearly indicated them
- Make assumptions about who said what
- Remove or truncate any part of the conversation
- Cut off the transcript early

CRITICAL: You MUST preserve the ENTIRE conversation. Do not truncate, shorten, or cut off any part of the transcript. Return the complete cleaned version of the entire input.

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