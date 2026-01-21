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
      console.error('OpenAI API key not found');
      throw new Error('OpenAI API key not found');
    }

    const { text, sourceLanguage, targetLanguage } = await req.json();

    if (!text) {
      console.error('Text parameter is required');
      throw new Error('Text is required');
    }

    console.log('Improving text layout for:', { 
      sourceLanguage: sourceLanguage || 'unknown', 
      targetLanguage: targetLanguage || 'unknown', 
      textLength: text.length 
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional medical document formatter. Your task is to improve the layout, formatting, and readability of translated medical text while preserving all medical information and accuracy.

FORMATTING GUIDELINES:
- Use clean, professional formatting WITHOUT markdown symbols (no #, *, -, etc.)
- Add appropriate line breaks and spacing for better readability
- Format medical sections with clear section breaks using capital letters or simple dividers
- Use consistent formatting for dates, measurements, and medical values
- Improve paragraph structure and flow
- Use simple bullet points (•) or numbering (1., 2., 3.) only where absolutely necessary
- Ensure proper spacing around punctuation (single spaces, not multiple)
- Format addresses, names, and medical data clearly with proper line breaks
- Maintain all original medical information - do not change medical facts, numbers, or diagnoses
- Keep all patient information intact and properly formatted
- Organize content logically with clear section separation
- Use simple blank lines (not excessive spacing) to separate sections
- Format as clean, readable text suitable for medical professionals

CRITICAL RULES:
- NO markdown formatting symbols (###, **, --, etc.)
- NO excessive spacing or multiple blank lines
- NO bullet points unless absolutely essential for lists
- Focus on clean, professional medical document appearance
- Do NOT change any medical facts, diagnoses, medication names, or dosages
- Do NOT translate - only improve formatting and layout
- Do NOT add or remove medical information
- Keep numerical values and medical terminology exactly as provided`
          },
          {
            role: 'user',
            content: `Please improve the formatting and layout of this translated medical text (originally in ${sourceLanguage || 'unknown'}, now in ${targetLanguage || 'unknown'}):

${text}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`OpenAI API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid OpenAI response structure:', data);
      throw new Error('Invalid response from OpenAI API');
    }

    const improvedText = data.choices[0].message.content;

    console.log('Text improvement completed successfully');

    return new Response(JSON.stringify({ improvedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in improve-text-layout function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});