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

    const { audio, temperature, language, condition_on_previous_text } = await req.json();
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
    
    // ChatGPT recommended parameters - use passed values or defaults
    formData.append('language', language || 'en');  // UK accents + noisy rooms benefit from explicit language
    formData.append('temperature', String(temperature ?? 0.0)); // Deterministic by default
    
    // ChatGPT recommended: condition_on_previous_text = false to prevent error snowballs
    if (condition_on_previous_text === false) {
      // Note: OpenAI API doesn't have condition_on_previous_text parameter exposed
      // But we can use an empty/neutral prompt to achieve similar effect
      formData.append('prompt', '');
    } else {
      // Add domain-specific prompt but keep it short and stable as ChatGPT recommends
      formData.append('prompt', 'Professional meeting recording in English.');
    }
    
    // Request verbose response to get quality metrics (avg_logprob, no_speech_prob)
    formData.append('response_format', 'verbose_json');

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
    console.log('✅ Transcription successful:', result.text);

    // Extract quality metrics for ChatGPT recommended guardrails
    const segments = result.segments || [];
    let avg_logprob = 0;
    let no_speech_prob = 0;
    
    if (segments.length > 0) {
      // Calculate average log probability across all segments
      avg_logprob = segments.reduce((sum: number, seg: any) => sum + (seg.avg_logprob || 0), 0) / segments.length;
      // Get no_speech_prob from the response (if available)
      no_speech_prob = result.no_speech_prob || 0;
    }

    // Remove the prompt text that sometimes appears in transcription results
    let cleanText = result.text || '';
    cleanText = cleanText.replace(/Professional meeting recording in English\.?\s*/gi, '');
    // Remove common hallucinated phrases from silence
    cleanText = cleanText.replace(/Thank you for watching\.?\s*/gi, '');
    cleanText = cleanText.replace(/Thanks for watching\.?\s*/gi, '');
    cleanText = cleanText.replace(/Please use headphones or earphones\.?\s*/gi, '');
    cleanText = cleanText.trim();
    
    return new Response(JSON.stringify({ 
      text: cleanText,
      avg_logprob: avg_logprob,
      no_speech_prob: no_speech_prob,
      segments: segments.map((seg: any) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text,
        avg_logprob: seg.avg_logprob
      }))
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