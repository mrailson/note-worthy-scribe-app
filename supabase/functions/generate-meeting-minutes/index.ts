import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

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
    const { transcript, meetingTitle, meetingDate, meetingTime } = await req.json();

    if (!transcript) {
      throw new Error('Transcript is required');
    }

    const prompt = `Please analyze the following meeting transcript and create detailed meeting notes using the format below. Ensure the notes are thorough, clear, and well-structured, with as much detail as possible extracted from the transcript. Use a professional but accessible tone.

Meeting Minutes Format:

Meeting Minutes
Date: ${meetingDate || '[Insert date from transcript or placeholder]'}
Time: ${meetingTime || '[Insert time if mentioned or placeholder]'}
Location: [Insert location or note 'Not specified']

1️⃣ Attendees
List all participants mentioned in the transcript. Include full names and roles if possible.

2️⃣ Agenda
Summarize the agenda items discussed in the meeting. If no formal agenda is stated, infer logical agenda points based on the transcript flow.

3️⃣ Discussion Summary
Provide a detailed, topic-by-topic or agenda-based summary of the meeting. Use bullet points or short paragraphs. Include key arguments, concerns, decisions, and insights shared by participants.

4️⃣ Actions / Decisions
List all action items and decisions. For each, include:
• What the action or decision is
• Who is responsible
• Any mentioned deadlines or follow-ups

5️⃣ Next Meeting
If discussed, mention the date/time of the next meeting. If not, state "Not discussed."

Instructions:
• Prioritize clarity, accuracy, and detail.
• Do not invent content—only use what is available in the transcript.
• If any part is unclear or missing, indicate it respectfully.

Transcript to analyze:
${transcript}`;

    console.log('Generating meeting minutes for:', meetingTitle);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a professional meeting secretary who creates detailed, well-structured meeting minutes. Always follow the exact format provided and extract as much relevant information as possible from the transcript.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const generatedMinutes = data.choices[0].message.content;

    console.log('Meeting minutes generated successfully');

    return new Response(JSON.stringify({ 
      success: true,
      meetingMinutes: generatedMinutes 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-meeting-minutes function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});