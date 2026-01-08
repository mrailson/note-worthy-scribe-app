import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ElevenLabs multilingual voice mapping
const VOICE_MAP: Record<string, string> = {
  // Default voices by language for best results
  'en': 'onwK4e9ZLuTAKqWW03F9', // Daniel - British male
  'pl': 'XrExE9yKIg1WjnnlVkGX', // Matilda
  'ro': 'FGY2WhTYpPnrIDTdsKH5', // Laura
  'ar': 'nPczCjzI2devNBz1zQrb', // Brian
  'hi': 'XrExE9yKIg1WjnnlVkGX', // Matilda
  'ur': 'nPczCjzI2devNBz1zQrb', // Brian
  'pa': 'XrExE9yKIg1WjnnlVkGX', // Matilda
  'bn': 'XrExE9yKIg1WjnnlVkGX', // Matilda
  'es': 'FGY2WhTYpPnrIDTdsKH5', // Laura
  'pt': 'Xb7hH8MSUJpSbSDYk0k2', // Alice
  'fr': 'IKne3meq5aSn9XLyUdCD', // Charlie
  'de': 'JBFqnCBsd6RMkjVDRZzb', // George
  'it': 'FGY2WhTYpPnrIDTdsKH5', // Laura
  'zh': 'cgSgspJ2msm6clMCkdW9', // Jessica
  'ja': 'cgSgspJ2msm6clMCkdW9', // Jessica
  'ko': 'cgSgspJ2msm6clMCkdW9', // Jessica
  'vi': 'cgSgspJ2msm6clMCkdW9', // Jessica
  'tr': 'nPczCjzI2devNBz1zQrb', // Brian
  'fa': 'nPczCjzI2devNBz1zQrb', // Brian
  'ru': 'XrExE9yKIg1WjnnlVkGX', // Matilda
  'uk': 'XrExE9yKIg1WjnnlVkGX', // Matilda
  'so': 'nPczCjzI2devNBz1zQrb', // Brian
  'sw': 'nPczCjzI2devNBz1zQrb', // Brian
  'tl': 'cgSgspJ2msm6clMCkdW9', // Jessica
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    const { text, languageCode, voiceId: requestedVoiceId } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    // Language-specific filler patterns for server-side cleanup
    const languageFillers: Record<string, RegExp> = {
      en: /\b(um|uh|er|erm|ah|like,?\s|you know,?\s)\b/gi,
      pl: /\b(no|znaczy|wiesz|tego|jakby|um|uh|er)\b/gi,
      ro: /\b(deci|adică|păi|știi|um|uh|er)\b/gi,
      ar: /(يعني|شو|هيك|آآ|إيه|um|uh|er)/gi,
      hi: /(मतलब|वो|अच्छा|हाँ|um|uh|er)/gi,
      ur: /(یعنی|وہ|اچھا|ہاں|um|uh|er)/gi,
      es: /\b(pues|o sea|bueno|este|eh|um|uh|er)\b/gi,
      pt: /\b(tipo|né|então|bem|um|uh|er)\b/gi,
      fr: /\b(euh|ben|donc|quoi|um|uh|er)\b/gi,
      de: /\b(also|ähm|halt|um|uh|er)\b/gi,
      it: /\b(allora|cioè|praticamente|um|uh|er)\b/gi,
      zh: /(那个|就是|然后|嗯|这个)/gi,
      ru: /\b(ну|вот|как бы|это|um|uh|er)\b/gi,
      tr: /\b(şey|yani|işte|hani|um|uh|er)\b/gi,
    };

    // Server-side text cleanup as safety net for natural TTS
    const fillerPattern = languageFillers[languageCode] || languageFillers['en'];
    const cleanedText = text
      .replace(fillerPattern, '')
      .replace(/\.{2,}/g, ',')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // Determine the best voice for the language
    const voiceId = requestedVoiceId || VOICE_MAP[languageCode] || VOICE_MAP['en'];

    console.log(`Generating TTS for language: ${languageCode}, voice: ${voiceId}, text length: ${cleanedText.length}`);

    // Call ElevenLabs TTS API with multilingual model
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: cleanedText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.65,        // Increased for more consistent delivery
            similarity_boost: 0.75,
            style: 0.4,             // Slightly higher for natural expression
            use_speaker_boost: true,
            speed: 1.0,             // Explicit speed control
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    // Get audio as ArrayBuffer
    const audioBuffer = await response.arrayBuffer();
    
    // Encode to base64 using Deno's encoding library (safe for large buffers)
    const base64Audio = base64Encode(audioBuffer);

    console.log(`TTS generated successfully, audio size: ${audioBuffer.byteLength} bytes`);

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        voiceId,
        languageCode 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('TTS Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
