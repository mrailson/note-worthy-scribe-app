import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { text, fromLang, toLang, targetLanguage, detectLanguage } = requestBody;
    
    // Support both parameter formats for backward compatibility
    const sourceLanguage = fromLang || (detectLanguage ? 'auto' : null);
    const targetLang = toLang || targetLanguage;
    
    if (!text || !targetLang) {
      throw new Error('Missing required parameters: text and target language');
    }

    console.log(`Translating "${text}" from ${sourceLanguage} to ${targetLang}`);

    const GOOGLE_TRANSLATE_API_KEY = Deno.env.get('GOOGLE_TRANSLATE_API_KEY');
    
    if (!GOOGLE_TRANSLATE_API_KEY) {
      console.log('No Google Translate API key found, using MyMemory as fallback');
      
      // Fallback to MyMemory API - only works with explicit language pairs
      if (!sourceLanguage || sourceLanguage === 'auto') {
        throw new Error('Language detection not supported with MyMemory fallback. Please specify source language.');
      }
      
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLanguage}|${targetLang}`
      );
      
      const data = await response.json();
      
      if (data.responseStatus === 200) {
        return new Response(
          JSON.stringify({ 
            translatedText: data.responseData.translatedText,
            detectedLanguage: sourceLanguage,
            confidence: 85 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        throw new Error(`MyMemory API error: ${data.responseDetails || 'Unknown error'}`);
      }
    }

    // Use Google Translate API if key is available
    const translateRequestBody = {
      q: text,
      target: targetLang,
      format: 'text'
    };
    
    // Only include source if not auto-detecting
    if (sourceLanguage && sourceLanguage !== 'auto') {
      translateRequestBody.source = sourceLanguage;
    }
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(translateRequestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Google Translate API error:', errorData);
      throw new Error(`Google Translate API error: ${response.status}`);
    }

    const data = await response.json();
    const translatedText = data.data.translations[0].translatedText;
    const detectedLanguage = data.data.translations[0].detectedSourceLanguage || sourceLanguage;

    console.log(`Translation successful: "${translatedText}"`);

    return new Response(
      JSON.stringify({ 
        translatedText,
        detectedLanguage,
        confidence: 95 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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