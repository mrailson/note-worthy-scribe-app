import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

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
    const GOOGLE_TRANSLATE_API_KEY = Deno.env.get('GOOGLE_TRANSLATE_API_KEY');
    
    if (!GOOGLE_TRANSLATE_API_KEY) {
      console.error('Google Translate API key not found');
      return new Response(
        JSON.stringify({ error: 'Google Translate API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { text, targetLanguage, sourceLanguage = 'en' } = await req.json();
    console.log('Translation request:', { text: text?.substring(0, 50), targetLanguage, sourceLanguage });

    if (!text || !targetLanguage) {
      return new Response(
        JSON.stringify({ error: 'Text and target language are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Use Google Translate API v2 with neural machine translation
    console.log('Calling Google Translate API...');
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          source: sourceLanguage,
          target: targetLanguage,
          format: 'text',
          model: 'nmt' // Neural Machine Translation
        }),
      }
    );

    console.log('Google Translate API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Translate API error:', errorText);
      return new Response(
        JSON.stringify({ error: `Translation API error: ${errorText}` }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();
    console.log('Translation successful');
    const translatedText = data.data.translations[0].translatedText;

    return new Response(
      JSON.stringify({ 
        translatedText,
        sourceLanguage: data.data.translations[0].detectedSourceLanguage || sourceLanguage,
        targetLanguage 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Translation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});