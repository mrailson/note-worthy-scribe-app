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

    const { audio, previousTranscript, meetingType } = await req.json();
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
    
    // Skip empty or tiny chunks (50KB minimum to prevent hallucinations)
    if (audioArray.length < 50000) {
      console.warn('⚠️ Skipping small/silent audio chunk:', audioArray.length, 'bytes');
      return new Response(JSON.stringify({ text: '' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Create blob and form data
    const audioBlob = new Blob([audioArray], { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Force English
    formData.append('temperature', '0'); // No creativity, just accurate transcription
    
    // Context-aware initial prompt to guide Whisper
    const contextPrompt = meetingType === 'consultation' 
      ? 'This is a GP consultation transcription between doctor and patient discussing medical symptoms and treatments.'
      : previousTranscript ? `Previous context: ${previousTranscript.slice(-200)}` // Last 200 chars for context
      : 'This is a medical meeting transcription.';
    
    formData.append('prompt', contextPrompt);

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

    // Clean up transcription result
    let cleanText = result.text || '';
    
    // Remove common hallucinations and repetitive phrases
    const hallucinations = [
      /^Silence\.?\s*/gi,
      /\bSilence\.\s*/gi,
      /Thank you for watching\.?\s*/gi,
      /Thanks for watching\.?\s*/gi,
      /Please subscribe\.?\s*/gi,
      /Like and subscribe\.?\s*/gi,
      /Professional English meeting\.?\s*/gi,
      /This meeting is being recorded\.?\s*/gi,
      /\b(?:Subtitles|Caption(?:s)?)\s+by\.?\s*/gi,
      /\b(?:Music|Background music)\b\.?\s*/gi,
    ];
    
    // Apply all hallucination filters
    hallucinations.forEach(pattern => {
      cleanText = cleanText.replace(pattern, '');
    });
    
    // Remove excessive repetition (same word/phrase 3+ times)
    cleanText = cleanText.replace(/\b(\w+(?:\s+\w+)*)\s+\1\s+\1(?:\s+\1)*\b/gi, '$1');
    
    cleanText = cleanText.trim();
    
    return new Response(JSON.stringify({ 
      text: cleanText 
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