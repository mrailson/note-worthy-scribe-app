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
    console.log('=== TRANSLATE-TEXT FUNCTION START ===');
    
    // Try multiple ways to access the API key
    let GOOGLE_TRANSLATE_API_KEY = Deno.env.get('GOOGLE_TRANSLATE_API_KEY');
    
    // Also try these alternative names that might be used
    if (!GOOGLE_TRANSLATE_API_KEY) {
      GOOGLE_TRANSLATE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    }
    if (!GOOGLE_TRANSLATE_API_KEY) {
      GOOGLE_TRANSLATE_API_KEY = Deno.env.get('TRANSLATE_API_KEY');
    }
    
    // Check if we can access environment variables at all
    const allEnvKeys = Object.keys(Deno.env.toObject());
    console.log('All available env keys:', allEnvKeys);
    console.log('Google-related keys:', allEnvKeys.filter(key => key.toLowerCase().includes('google')));
    console.log('Translate-related keys:', allEnvKeys.filter(key => key.toLowerCase().includes('translate')));
    
    console.log('API Key status:', GOOGLE_TRANSLATE_API_KEY ? `Found (length: ${GOOGLE_TRANSLATE_API_KEY.length})` : 'Not found');
    
    if (!GOOGLE_TRANSLATE_API_KEY) {
      console.error('Google Translate API key not found in environment');
      return new Response(
        JSON.stringify({ 
          error: 'Google Translate API key not configured. Please add GOOGLE_TRANSLATE_API_KEY secret.',
          debug: {
            availableEnvKeys: allEnvKeys,
            googleKeys: allEnvKeys.filter(key => key.toLowerCase().includes('google')),
            translateKeys: allEnvKeys.filter(key => key.toLowerCase().includes('translate'))
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { text, targetLanguage, sourceLanguage } = await req.json();
    const normalisedSourceLanguage =
      sourceLanguage && sourceLanguage !== 'auto' ? sourceLanguage : undefined;

    console.log('Translation request:', {
      text: text?.substring(0, 50),
      targetLanguage,
      sourceLanguage: normalisedSourceLanguage ?? '(auto)',
    });

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
    const apiUrl = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`;
    console.log('API URL (without key):', apiUrl.replace(GOOGLE_TRANSLATE_API_KEY, '[REDACTED]'));

    const requestBody: Record<string, unknown> = {
      q: text,
      target: targetLanguage,
      format: 'text',
      model: 'nmt', // Neural Machine Translation
    };

    // If source language is not provided, Google will auto-detect.
    if (normalisedSourceLanguage) {
      requestBody.source = normalisedSourceLanguage;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Google Translate API response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Translate API error response:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: `Translation API error: ${errorText}`,
          status: response.status,
          debug: {
            responseStatus: response.status,
            responseHeaders: Object.fromEntries(response.headers.entries())
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();
    console.log('Translation successful, response keys:', Object.keys(data));
    const translatedText = data.data.translations[0].translatedText;

    return new Response(
      JSON.stringify({
        translatedText,
        sourceLanguage: data.data.translations[0].detectedSourceLanguage || normalisedSourceLanguage || 'unknown',
        targetLanguage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Translation error caught:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Unknown translation error',
        debug: {
          errorName: error?.name,
          errorStack: error?.stack?.split('\n').slice(0, 3).join('\n')
        }
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});