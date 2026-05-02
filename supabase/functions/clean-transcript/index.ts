import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Sonnet-only policy (May 2026): switched from OpenAI gpt-4o.
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('CLAUDE_API_KEY');

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

    const systemPrompt = `You are a professional transcript cleaner for meeting transcriptions. Your job is to clean and format transcripts while preserving the original meaning and content.

CLEANING TASKS YOU MUST PERFORM:
1. Remove obvious duplications and repetitive phrases
2. Remove overlapping speech and hallucinated content that doesn't make sense
3. Fix grammar, punctuation, and apostrophes (its vs it's, your vs you're, etc.)
4. Fix capitalization and sentence structure
5. Remove excessive filler words (um, uh, er, ah) but keep occasional ones for natural flow
6. Fix word spacing issues (e.g., "howcan" → "how can", "goodmorning" → "good morning")
7. Create clear speaker sections when multiple speakers are identified
8. Add proper paragraph breaks for better readability
9. Standardize formatting for numbers, dates, and times
10. Remove technical artifacts like "[Music]", "[Background noise]", repetitive phrases

FORMATTING REQUIREMENTS:
- Use proper paragraphs with line breaks between topics or speakers
- Capitalize proper nouns, names, and sentence beginnings
- Use correct punctuation: periods, commas, question marks, exclamation points
- Format contractions properly (don't, won't, it's, etc.)
- When multiple speakers are detected, separate them with clear sections
- Remove obvious repetitions like "This meeting is being recorded" appearing multiple times

WHAT TO PRESERVE:
- The actual content and meaning of what was said
- Technical terms and medical terminology
- Numbers, dates, and specific details mentioned
- Natural speech patterns (don't make it overly formal)
- All substantive content

EXAMPLE OF WHAT TO DO:
Input: "um so we need to we need to discuss the budget um the budget for next quarter next quarter and also also the staffing levels staffing levels This meeting is being recorded This meeting is being recorded"
Output: "So we need to discuss the budget for next quarter and also the staffing levels."

Return a clean, well-formatted transcript with proper paragraphs and spacing.`;

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