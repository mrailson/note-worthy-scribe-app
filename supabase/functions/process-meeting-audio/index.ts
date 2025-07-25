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
    console.log('Processing meeting audio request...');
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

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

    // Step 2: Generate NHS-style summary via GPT
    console.log('Generating NHS summary...');
    const summaryPrompt = `You are a GP assistant creating SystmOne-ready notes from a meeting transcript.

Input transcript:
${transcript}

Please create:
1. A concise GP summary line (max 100 characters)
2. SOAP format notes
3. Use UK NHS GP shorthand where appropriate (e.g., 2/7 for "2 days", NKDA for "no known drug allergies")
4. Add relevant SNOMED codes where applicable
5. Include any action points or follow-up required

Format your response as:
SUMMARY: [brief summary line]

SOAP NOTES:
S: [Subjective - what was discussed]
O: [Objective - key findings or observations]
A: [Assessment - conclusions or diagnoses]
P: [Plan - actions, treatments, follow-up]

ACTION POINTS:
- [List any specific actions required]`;

    const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert NHS GP assistant specializing in creating clinical notes from meeting transcripts. Always use proper medical terminology and UK NHS standards.'
          },
          {
            role: 'user',
            content: summaryPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!summaryResponse.ok) {
      const errorText = await summaryResponse.text();
      console.error('OpenAI summary API error:', errorText);
      throw new Error(`OpenAI API error: ${summaryResponse.status} - ${errorText}`);
    }

    const summaryResult = await summaryResponse.json();
    const summary = summaryResult.choices[0].message.content;
    console.log('NHS summary generated successfully');

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