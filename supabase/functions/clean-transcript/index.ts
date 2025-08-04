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

    const systemPrompt = `You are an expert medical transcript cleaner and formatter. Your task is to take raw, duplicated, and poorly formatted medical consultation transcripts and transform them into clean, readable, professional clinical documentation.

Your responsibilities:
1. Remove ALL duplicate content while preserving the complete conversation
2. Maintain proper chronological order of the consultation
3. Fix grammar, punctuation, and sentence structure
4. Ensure all clinical information is preserved exactly once
5. Create natural dialogue flow between doctor and patient
6. Fix speech-to-text errors and merged words
7. Standardize medical terminology and formatting
8. Remove filler words and false starts

CRITICAL MEDICAL SAFETY REQUIREMENTS:
- NEVER remove or alter any clinical information (symptoms, medications, history, advice)
- NEVER change medical terminology or dosages
- NEVER omit safety-netting advice or emergency instructions
- PRESERVE all diagnostic information and management plans
- Maintain the original meaning of all medical content

DEDUPLICATION RULES:
- Remove repeated dialogue blocks completely
- If information appears multiple times, keep only the first occurrence in logical order
- Merge fragmented conversations into proper sequence
- Remove overlapping content from chunk boundaries
- Ensure each piece of information appears exactly once

OUTPUT FORMAT:
- Present as clean dialogue between doctor and patient
- Use proper punctuation and capitalization
- Maintain natural conversation flow
- No speaker labels needed, just clean dialogue
- Each statement on a new line for clarity

Return ONLY the cleaned transcript without any commentary or explanation.`;

    const userPrompt = `Please clean and deduplicate this medical consultation transcript, removing all duplicate content while preserving every piece of clinical information exactly once:

${rawTranscript}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
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
        temperature: 0.1, // Very low temperature for consistent, accurate cleaning
        max_tokens: 4096
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