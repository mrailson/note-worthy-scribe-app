import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 Edge function invoked - method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📡 Processing transcription request');
    
    // Check API keys
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    console.log('🔑 OpenAI API key available:', !!openaiApiKey);
    
    if (!openaiApiKey) {
      console.error('❌ No OpenAI API key found');
      return new Response(JSON.stringify({
        success: false,
        error: 'OpenAI API key not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse form data
    console.log('📥 Parsing form data...');
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      console.error('❌ No audio file in request');
      return new Response(JSON.stringify({
        success: false,
        error: 'No audio file provided'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🎵 Audio file received:', audioFile.size, 'bytes, type:', audioFile.type);

    // Create form data for OpenAI with ChatGPT's recommended settings
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile, 'audio.webm');
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('language', 'en');
    whisperFormData.append('temperature', '0.1'); // Low temperature for deterministic results
    whisperFormData.append('response_format', 'verbose_json'); // Get word timestamps and confidence
    
    // Anti-hallucination prompt
    const safetyPrompt = "Transcribe only clearly audible speech. If silence or background noise, return nothing.";
    whisperFormData.append('prompt', safetyPrompt);
    
    console.log('📤 Sending to OpenAI Whisper...');
    
    // Call OpenAI Whisper
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: whisperFormData,
    });

    console.log('📥 OpenAI response status:', whisperResponse.status);

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('❌ OpenAI error:', errorText);
      return new Response(JSON.stringify({
        success: false,
        error: `OpenAI error: ${whisperResponse.status}`,
        details: errorText
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const whisperResult = await whisperResponse.json();
    console.log('✅ Transcription successful:', whisperResult.text);

    // Extract quality metrics and word timestamps
    const segments = whisperResult.segments || [];
    let avgLogprob = 0;
    let noSpeechProb = 0;
    let words: any[] = [];

    if (segments.length > 0) {
      avgLogprob = segments.reduce((sum: number, seg: any) => sum + (seg.avg_logprob || 0), 0) / segments.length;
      noSpeechProb = segments.reduce((max: number, seg: any) => Math.max(max, seg.no_speech_prob ?? 0), 0);
      
      // Extract word-level timestamps
      words = segments.flatMap((seg: any) => seg.words || []).map((w: any) => ({
        word: w.word || w.text || '',
        start: w.start || 0,
        end: w.end || 0,
        confidence: 1 - (w.probability || 0)
      }));
    }

    // Filter out low-confidence transcriptions (ChatGPT's recommendation)
    let cleanText = whisperResult.text || '';
    if (noSpeechProb > 0.5 || avgLogprob < -1.0 || cleanText.length < 10) {
      console.log('🤫 Filtering low-confidence transcription:', { noSpeechProb, avgLogprob, textLength: cleanText.length });
      cleanText = '';
      words = [];
    }

    return new Response(JSON.stringify({
      success: true,
      transcript: cleanText,
      confidence: Math.max(0, 1 + avgLogprob), // Convert logprob to confidence score
      words: words,
      is_final: true,
      no_speech_prob: noSpeechProb,
      avg_logprob: avgLogprob
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Edge function error:', error);
    console.error('❌ Error stack:', error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});