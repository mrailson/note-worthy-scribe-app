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
    console.log('📡 Deepgram HTTP transcription request received');
    console.log('🔍 Request method:', req.method);
    console.log('🔍 Request headers:', Object.fromEntries(req.headers.entries()));
    
    // Check for OpenAI API key first, fallback to Deepgram
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');
    
    console.log('🔑 OpenAI API key present:', !!openaiApiKey);
    console.log('🔑 Deepgram API key present:', !!deepgramApiKey);
    
    if (!openaiApiKey && !deepgramApiKey) {
      console.error('❌ No API keys available');
      throw new Error('Neither OPENAI_API_KEY nor DEEPGRAM_API_KEY is set');
    }

    // Get audio data from request
    console.log('📥 Parsing form data...');
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      console.error('❌ No audio file in form data');
      console.log('📋 Form data keys:', Array.from(formData.keys()));
      throw new Error('No audio file provided');
    }

    console.log('🎵 Processing audio file:', audioFile.size, 'bytes', 'type:', audioFile.type);

    // Try OpenAI Whisper first if available (better for chunks)
    if (openaiApiKey) {
      console.log('🤖 Using OpenAI Whisper for transcription');
      
      try {
        const whisperFormData = new FormData();
        whisperFormData.append('file', audioFile, 'audio.webm');
        whisperFormData.append('model', 'whisper-1');
        
        console.log('📤 Sending request to OpenAI Whisper...');
        const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: whisperFormData,
        });

        console.log('📥 OpenAI Whisper response status:', whisperResponse.status);

        if (!whisperResponse.ok) {
          const errorText = await whisperResponse.text();
          console.error('❌ OpenAI Whisper error:', whisperResponse.status, errorText);
          throw new Error(`OpenAI Whisper error: ${whisperResponse.status} - ${errorText}`);
        }

        const whisperResult = await whisperResponse.json();
        console.log('✅ OpenAI Whisper transcription result:', whisperResult);

        return new Response(JSON.stringify({
          success: true,
          transcript: whisperResult.text || '',
          confidence: 1.0, // OpenAI doesn't provide confidence
          words: [],
          is_final: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (whisperError) {
        console.error('❌ OpenAI Whisper failed, falling back to Deepgram:', whisperError);
        // Fall through to Deepgram
      }
    }

    // Fallback to Deepgram
    if (deepgramApiKey) {
      console.log('🎯 Using Deepgram for transcription');
      try {
        const deepgramResponse = await fetch(
          'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&diarize=false',
          {
            method: 'POST',
            headers: {
              'Authorization': `Token ${deepgramApiKey}`,
              'Content-Type': audioFile.type || 'audio/webm',
            },
            body: audioFile,
          }
        );

        console.log('📥 Deepgram response status:', deepgramResponse.status);

        if (!deepgramResponse.ok) {
          const errorText = await deepgramResponse.text();
          console.error('❌ Deepgram API error:', deepgramResponse.status, errorText);
          throw new Error(`Deepgram API error: ${deepgramResponse.status} - ${errorText}`);
        }

        const result = await deepgramResponse.json();
        console.log('✅ Deepgram transcription result received');

        // Extract transcript from Deepgram response
        const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
        const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
        const words = result.results?.channels?.[0]?.alternatives?.[0]?.words || [];

        return new Response(JSON.stringify({
          success: true,
          transcript,
          confidence,
          words,
          is_final: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (deepgramError) {
        console.error('❌ Deepgram also failed:', deepgramError);
        throw deepgramError;
      }
    }

    throw new Error('No working transcription service available');

  } catch (error) {
    console.error('❌ Transcription error:', error);
    console.error('❌ Error stack:', error.stack);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});