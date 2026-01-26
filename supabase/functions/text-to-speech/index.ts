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
      throw new Error('Google Translate API key not configured');
    }

    const { text, languageCode = 'en', voiceName } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    // Map short language codes to full Google TTS language codes
    const languageCodeMap: Record<string, string> = {
      'bn': 'bn-IN',   // Bengali
      'pa': 'pa-IN',   // Punjabi
      'gu': 'gu-IN',   // Gujarati
      'ta': 'ta-IN',   // Tamil
      'te': 'te-IN',   // Telugu
      'kn': 'kn-IN',   // Kannada
      'ml': 'ml-IN',   // Malayalam
      'mr': 'mr-IN',   // Marathi
      'sw': 'sw-KE',   // Swahili
      'ne': 'ne-NP',   // Nepali
      'si': 'si-LK',   // Sinhala
      'km': 'km-KH',   // Khmer
      'en': 'en-GB',   // English (British)
      'ar': 'ar-XA',   // Arabic
      'zh': 'cmn-CN',  // Chinese Mandarin
      'fr': 'fr-FR',   // French
      'de': 'de-DE',   // German
      'hi': 'hi-IN',   // Hindi
      'it': 'it-IT',   // Italian
      'es': 'es-ES',   // Spanish
      'pt': 'pt-PT',   // Portuguese
      'ru': 'ru-RU',   // Russian
      'ja': 'ja-JP',   // Japanese
      'ko': 'ko-KR',   // Korean
      'vi': 'vi-VN',   // Vietnamese
      'tr': 'tr-TR',   // Turkish
      'pl': 'pl-PL',   // Polish
      'nl': 'nl-NL',   // Dutch
      'el': 'el-GR',   // Greek
      'bg': 'bg-BG',   // Bulgarian
      'cs': 'cs-CZ',   // Czech
      'da': 'da-DK',   // Danish
      'fi': 'fi-FI',   // Finnish
      'hu': 'hu-HU',   // Hungarian
      'id': 'id-ID',   // Indonesian
      'ms': 'ms-MY',   // Malay
      'no': 'nb-NO',   // Norwegian
      'ro': 'ro-RO',   // Romanian
      'sk': 'sk-SK',   // Slovak
      'sv': 'sv-SE',   // Swedish
      'th': 'th-TH',   // Thai
      'uk': 'uk-UA',   // Ukrainian
      'he': 'he-IL',   // Hebrew
    };

    // Convert short code to full language code if needed
    const fullLanguageCode = languageCode.includes('-') 
      ? languageCode 
      : (languageCodeMap[languageCode] || `${languageCode}-${languageCode.toUpperCase()}`);

    console.log(`Google TTS: Converting ${languageCode} to ${fullLanguageCode}`);

    // Use Google Text-to-Speech API
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TRANSLATE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: fullLanguageCode,
            name: voiceName || undefined,
            ssmlGender: 'NEUTRAL'
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.0,
            pitch: 0.0,
            volumeGainDb: 0.0
          }
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Text-to-speech failed');
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({ 
        audioContent: data.audioContent,
        languageCode
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Text-to-speech error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});