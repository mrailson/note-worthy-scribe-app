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
    console.log('Processing meeting audio request with updated API key...');
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY environment variable is not set');
      throw new Error('OPENAI_API_KEY not configured');
    }
    
    console.log('✅ OPENAI_API_KEY is configured, proceeding with transcription');

    // Parse the form data containing the audio file
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      throw new Error('No audio file provided');
    }

    console.log('Audio file received:', audioFile.name, audioFile.size, 'bytes');

    // Step 1: Send audio to Whisper API for transcription
    console.log('Sending to Whisper API...');
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

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('Whisper API error:', errorText);
      throw new Error(`Whisper API error: ${whisperResponse.status} - ${errorText}`);
    }

    const whisperResult = await whisperResponse.json();
    const transcript = whisperResult.text;
    console.log('Transcription completed, length:', transcript.length);

    // Generate a basic business meeting summary (optional - can be removed if just transcript is needed)
    console.log('Generating meeting summary...');
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

    if (!summaryResponse.ok) {
      const errorText = await summaryResponse.text();
      console.error('OpenAI summary API error:', errorText);
      // If summary fails, just return transcript
      console.log('Summary generation failed, returning transcript only');
      const response = {
        success: true,
        transcript: transcript,
        summary: null,
        processingTime: Date.now(),
        audioSize: audioFile.size,
        transcriptLength: transcript.length
      };
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const summaryResult = await summaryResponse.json();
    const summary = summaryResult.choices[0].message.content;
    console.log('Business meeting summary generated successfully');

    // Return the results
    const response = {
      success: true,
      transcript: transcript,
      summary: summary,
      processingTime: Date.now(),
      audioSize: audioFile.size,
      transcriptLength: transcript.length
    };

    console.log('Processing completed successfully');
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-meeting-audio function:', error);
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