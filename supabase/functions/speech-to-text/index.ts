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
    
    // ChatGPT recommended parameters - enhanced for better accuracy
    formData.append('language', language || 'en');  // UK accents + noisy rooms benefit from explicit language
    formData.append('temperature', String(temperature ?? 0.1)); // Slightly higher for natural speech variation
    
    // Request word timestamps for advanced overlap detection
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');
    
    // Silence-safe prompt to reduce boilerplate hallucinations
    const safetyPrompt = "Transcribe only clearly audible speech. If silence or background noise, return nothing. Never output: 'This is a recording of the meeting recording in English.'";
    // ChatGPT recommended: condition_on_previous_text = false to prevent error snowballs
    if (condition_on_previous_text === false) {
      // OpenAI API lacks this flag; using neutral prompt to minimize carryover
      formData.append('prompt', safetyPrompt);
    } else {
      // Keep prompt short and stable
      formData.append('prompt', safetyPrompt);
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
      // Estimate no_speech probability from segments (use max as conservative indicator)
      no_speech_prob = segments.reduce((max: number, seg: any) => Math.max(max, seg.no_speech_prob ?? 0), 0);
    } else {
      avg_logprob = 0;
      no_speech_prob = 1; // No segments -> likely silence
    }

    // Server-side filtering for known silence hallucinations and boilerplate
    const bannedRegex = /(this\s+is\s+(a\s+)?(video\s+)?recording\s+of\s+the\s+meeting\s+recording\s+in\s+english\.?)/gi;
    let cleanText = (result.text || '').replace(bannedRegex, ' ');
    cleanText = cleanText
      .replace(/Thank you for watching\.\?\s*/gi, ' ')
      .replace(/Thanks for watching\.\?\s*/gi, ' ')
      .replace(/Please use headphones or earphones\.\?\s*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Silence guard: if content is very short and metrics indicate silence or low confidence, drop it
    const likelySilence = (no_speech_prob > 0.5 || avg_logprob < -0.8);
    if (!cleanText || cleanText.length < 10) {
      if (likelySilence) {
        console.log('🤫 Dropping low-confidence text due to silence/hallucination indicators');
        cleanText = '';
      }
    }
    
    // Extract word-level timestamps for advanced processing
    const words = segments.flatMap((seg: any) => seg.words || []).map((w: any) => ({
      word: w.word || w.text || '',
      start: w.start || 0,
      end: w.end || 0,
      confidence: 1 - Math.abs(w.probability || 0)
    }));

    return new Response(JSON.stringify({ 
      text: cleanText,
      avg_logprob: avg_logprob,
      no_speech_prob: no_speech_prob,
      words: words, // Include word timestamps for overlap detection
      segments: segments.map((seg: any) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text,
        avg_logprob: seg.avg_logprob,
        words: seg.words || []
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