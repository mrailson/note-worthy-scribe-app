import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client',
};

serve(async (req) => {
  console.log('📨 SPEECH-TO-TEXT: Request received:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ SPEECH-TO-TEXT: Handling CORS preflight');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔑 SPEECH-TO-TEXT: Getting OpenAI API key...');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      console.error('❌ SPEECH-TO-TEXT: OpenAI API key not found');
      throw new Error('OpenAI API key not configured');
    }

    console.log('📥 SPEECH-TO-TEXT: Parsing request body...');
    const { audio } = await req.json();
    
    if (!audio) {
      console.error('❌ SPEECH-TO-TEXT: No audio data provided');
      throw new Error('No audio data provided');
    }

    console.log('📊 SPEECH-TO-TEXT: Audio data received, size:', audio.length, 'characters');

    // Convert base64 to binary
    console.log('🔄 SPEECH-TO-TEXT: Converting base64 to audio file...');
    const binaryString = atob(audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log('📦 SPEECH-TO-TEXT: Created audio buffer, size:', bytes.length, 'bytes');

    // Create form data for OpenAI API
    const formData = new FormData();
    const audioBlob = new Blob([bytes], { type: 'audio/webm' });
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    formData.append('response_format', 'verbose_json');
    // Anti-hallucination parameters
    formData.append('temperature', '0');
    formData.append('no_speech_threshold', '0.6');
    formData.append('condition_on_previous_text', 'false');
    formData.append('prompt', ''); // Empty prompt reduces hallucinations

    console.log('📡 SPEECH-TO-TEXT: Sending request to OpenAI Whisper API...');
    
    // Retry logic for OpenAI API with exponential backoff
    let response;
    let lastError;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 SPEECH-TO-TEXT: Attempt ${attempt}/${maxRetries}`);
        
        response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: formData,
          // Add timeout
          signal: AbortSignal.timeout(60000), // 60 second timeout
        });

        console.log('📨 SPEECH-TO-TEXT: OpenAI response status:', response.status);

        if (response.ok) {
          break; // Success, exit retry loop
        }
        
        const errorText = await response.text();
        console.error(`❌ SPEECH-TO-TEXT: OpenAI API error (attempt ${attempt}):`, response.status, errorText);
        
        // Don't retry on client errors (4xx), only server errors (5xx) and network issues
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`OpenAI API client error: ${response.status} - ${errorText}`);
        }
        
        lastError = new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        
        // Exponential backoff: wait 1s, 2s, 4s between retries
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`⏳ SPEECH-TO-TEXT: Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        console.error(`❌ SPEECH-TO-TEXT: Network error (attempt ${attempt}):`, error);
        lastError = error;
        
        // Don't retry on timeout or abort errors immediately
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          break;
        }
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`⏳ SPEECH-TO-TEXT: Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (!response || !response.ok) {
      console.error('❌ SPEECH-TO-TEXT: All retry attempts failed');
      throw lastError || new Error('Failed to connect to OpenAI API after all retries');
    }

    const result = await response.json();
    console.log('✅ SPEECH-TO-TEXT: Transcription successful, text length:', result.text?.length || 0);
    console.log('📝 SPEECH-TO-TEXT: Transcript preview:', result.text?.slice(0, 100) + '...');

    // Calculate real confidence from segments
    let confidence = 0.5; // Default fallback
    let avg_logprob = -0.3;
    let no_speech_prob = 0.3;
    
    if (result.segments && result.segments.length > 0) {
      avg_logprob = result.segments.reduce((sum: number, seg: any) => 
        sum + (seg.avg_logprob || -2), 0) / result.segments.length;
      no_speech_prob = result.segments.reduce((sum: number, seg: any) => 
        sum + (seg.no_speech_prob || 0.5), 0) / result.segments.length;
      
      // Convert log probability and no-speech probability to confidence score
      confidence = Math.max(0, Math.min(1, 
        (avg_logprob + 1) / 1 * (1 - no_speech_prob)
      ));
    }

    console.log('📊 SPEECH-TO-TEXT: Calculated confidence:', confidence);

    return new Response(
      JSON.stringify({ 
        text: result.text || '',
        confidence: confidence, // Real confidence from Whisper segments
        avg_logprob: avg_logprob,
        no_speech_prob: no_speech_prob,
        duration: result.duration,
        language: result.language,
        segments: result.segments || []
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('❌ SPEECH-TO-TEXT: Error processing request:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to transcribe audio',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );
  }
});