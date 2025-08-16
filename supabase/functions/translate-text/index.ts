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
    
    // Check if we can access environment variables at all
    const allEnvKeys = Object.keys(Deno.env.toObject()).filter(key => key.includes('GOOGLE'));
    console.log('Available Google-related env keys:', allEnvKeys);
    
    const GOOGLE_TRANSLATE_API_KEY = Deno.env.get('GOOGLE_TRANSLATE_API_KEY');
    console.log('API Key status:', GOOGLE_TRANSLATE_API_KEY ? `Found (length: ${GOOGLE_TRANSLATE_API_KEY.length})` : 'Not found');
    
    if (!GOOGLE_TRANSLATE_API_KEY) {
      console.error('Google Translate API key not found in environment');
      console.log('All environment variables:', Object.keys(Deno.env.toObject()));
      return new Response(
        JSON.stringify({ 
          error: 'Google Translate API key not configured',
          debug: {
            availableEnvKeys: Object.keys(Deno.env.toObject()),
            googleKeys: allEnvKeys
          }
        }),
        {
          status: 400,
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
    const apiUrl = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`;
    console.log('API URL (without key):', apiUrl.replace(GOOGLE_TRANSLATE_API_KEY, '[REDACTED]'));
    
    const response = await fetch(apiUrl, {
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
        sourceLanguage: data.data.translations[0].detectedSourceLanguage || sourceLanguage,
        targetLanguage 
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