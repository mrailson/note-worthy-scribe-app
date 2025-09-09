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
    const { translatedText } = await req.json();

    console.log("Improving layout for translated text:", translatedText?.substring(0, 100));

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
            content: 'You are an expert document formatter. Format the medical/document text with proper HTML structure, headings, sections, and professional styling. Make it readable and well-organized. Use semantic HTML tags like <h1>, <h2>, <p>, <ul>, <li>, <strong>, <em>, etc. Add proper spacing and organization. Preserve all medical information accurately.'
          },
          { 
            role: 'user', 
            content: `Please format this translated document text with proper HTML structure and professional medical document styling:\n\n${translatedText}` 
          }
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const formattedHtml = data.choices[0].message.content;

    console.log("Layout improvement completed successfully");

    return new Response(JSON.stringify({ formattedHtml }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in improve-translation-layout function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});