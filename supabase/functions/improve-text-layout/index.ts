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
      throw new Error('OpenAI API key not found');
    }

    const { text, sourceLanguage, targetLanguage } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    console.log('Improving text layout for:', { sourceLanguage, targetLanguage, textLength: text.length });

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
- Add proper spacing and line breaks for better readability
- Format medical sections with clear headings and organization
- Use consistent formatting for dates, measurements, and medical values
- Improve paragraph structure and flow
- Add bullet points or numbering where appropriate for lists
- Ensure proper spacing around punctuation
- Format addresses, names, and medical data clearly
- Maintain all original medical information - do not change medical facts, numbers, or diagnoses
- Keep all patient information intact and properly formatted
- Organize sections like: Patient Info, Admission Reason, Diagnosis, Investigations, Treatment, Recommendations

IMPORTANT:
- Do NOT change any medical facts, diagnoses, medication names, or dosages
- Do NOT translate - only improve formatting and layout
- Do NOT add or remove medical information
- Focus on visual presentation and readability
- Preserve all numerical values and medical terminology exactly as provided`
          },
          {
            role: 'user',
            content: `Please improve the formatting and layout of this translated medical text (originally in ${sourceLanguage}, now in ${targetLanguage}):

${text}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
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