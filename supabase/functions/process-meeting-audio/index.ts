import "https://deno.land/x/xhr@0.1.1/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Completely rebuilt function to force fresh deployment
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log('🚀 Process Meeting Audio Function - Fresh Deployment Starting...');

serve(async (req) => {
  console.log(`📥 Incoming request: ${req.method} ${req.url}`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🎯 Starting audio processing...');
    
    // Get API key with detailed logging
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    console.log('🔑 Checking API key availability...');
    
    if (!OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY is missing from environment');
      console.log('Available env keys:', Object.keys(Deno.env.toObject()));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'OPENAI_API_KEY not configured in environment',
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    console.log(`✅ OPENAI_API_KEY found, length: ${OPENAI_API_KEY.length}`);

    // Parse the form data containing the audio file
    console.log('📄 Parsing form data...');
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      console.error('❌ No audio file in request');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No audio file provided',
          timestamp: new Date().toISOString()
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`📁 Audio file received: ${audioFile.name}, ${audioFile.size} bytes`);

    // Step 1: Send audio to Whisper API for transcription
    console.log('🎙️ Sending to OpenAI Whisper API...');
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile);
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('language', 'en');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: whisperFormData,
    });

    console.log(`📡 Whisper API response status: ${whisperResponse.status}`);

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('❌ Whisper API error:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Whisper API error: ${whisperResponse.status} - ${errorText}`,
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const whisperResult = await whisperResponse.json();
    const transcript = whisperResult.text;
    console.log(`✅ Transcription completed, length: ${transcript.length} characters`);

    // Generate a basic business meeting summary (optional - can be removed if just transcript is needed)
    console.log('📝 Generating meeting summary...');
    const summaryPrompt = `Please create a concise summary of this business meeting transcript:

${transcript}

Please provide:
1. A brief overview (2-3 sentences)
2. Key discussion points
3. Action items or decisions made
4. Next steps if mentioned

Keep it professional and business-focused.`;

    const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Using mini for cost efficiency on business summaries
        messages: [
          {
            role: 'system',
            content: 'You are a professional meeting assistant. Create clear, concise summaries of business meetings.'
          },
          {
            role: 'user',
            content: summaryPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    let summary = null;
    if (summaryResponse.ok) {
      const summaryResult = await summaryResponse.json();
      summary = summaryResult.choices[0].message.content;
      console.log('✅ Business meeting summary generated');
    } else {
      console.log('⚠️ Summary generation failed, returning transcript only');
    }

    // Return the results
    const response = {
      success: true,
      transcript: transcript,
      summary: summary,
      processingTime: Date.now(),
      audioSize: audioFile.size,
      transcriptLength: transcript.length
    };

    console.log('🎉 Processing completed successfully');
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Unexpected error in process-meeting-audio function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});