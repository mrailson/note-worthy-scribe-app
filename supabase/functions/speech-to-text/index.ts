import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    console.log('🎙️ Speech-to-text request received');
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { audio } = await req.json();
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('📤 Converting base64 audio to blob...');
    
    // Convert base64 to binary
    const binaryAudio = atob(audio);
    const audioArray = new Uint8Array(binaryAudio.length);
    for (let i = 0; i < binaryAudio.length; i++) {
      audioArray[i] = binaryAudio.charCodeAt(i);
    }
    
    // Create blob and form data
    const audioBlob = new Blob([audioArray], { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    // Force English language to reduce hallucinations
    formData.append('language', 'en');
    // Add prompt to encourage English-only output and reduce hallucinations
    formData.append('prompt', 'This is a professional meeting or consultation recording in English. Please transcribe only clear English speech and ignore background noise, music, or unclear audio.');
    // Set temperature to 0 for more consistent output
    formData.append('temperature', '0');

    console.log('📡 Sending to OpenAI Whisper...');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI error:', errorText);
      throw new Error(`OpenAI error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Raw transcription:', result.text);
    
    // Filter out non-English text and common hallucinations
    let filteredText = result.text || '';
    
    // Remove common hallucination patterns
    const hallucinations = [
      /ご視聴ありがとうございました/g,
      /ごちそうさまでした/g,
      /Bon Appetit!/g,
      /私のビデオを見てくれてありがとう/g,
      /If you like this video, please subscribe to my channel/g,
      /ღ'ᴗ'ღ/g,
      // Remove any text with Japanese, Chinese, Korean, or Arabic characters
      /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/g,
      // Remove emoji and special unicode characters
      /[\u2600-\u26FF\u2700-\u27BF\u1F600-\u1F64F\u1F300-\u1F5FF\u1F680-\u1F6FF\u1F1E0-\u1F1FF]/g,
      // Remove common YouTube/social media phrases
      /please subscribe/gi,
      /like and subscribe/gi,
      /thanks for watching/gi,
      /see you next time/gi
    ];
    
    hallucinations.forEach(pattern => {
      filteredText = filteredText.replace(pattern, '').trim();
    });
    
    // Remove extra whitespace and clean up
    filteredText = filteredText.replace(/\s+/g, ' ').trim();
    
    // Only return text if it contains English letters and meaningful content
    const hasEnglishContent = /[a-zA-Z]/.test(filteredText);
    const finalText = hasEnglishContent && filteredText.length > 0 ? filteredText : '';
    
    console.log('✅ Filtered transcription:', finalText);

    return new Response(JSON.stringify({ 
      text: finalText 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Speech-to-text error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});