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
    const { transcript, meetingTitle, meetingDate, meetingTime, detailLevel } = await req.json();

    if (!transcript) {
      throw new Error('Transcript is required');
    }

    const level = (detailLevel || 'standard').toString().toLowerCase();
    const detailInstructions = level === 'super' 
      ? 'Maximise detail and specificity. Extract granular points, sub-bullets, explicit attributions when available, and comprehensive context grounded ONLY in the transcript.'
      : level === 'more'
      ? 'Be more detailed than standard. Expand points with accurate specifics from the transcript, include additional sub-bullets and clearer structure.'
      : 'Use the standard level of detail: concise yet complete, avoiding unnecessary verbosity.';

    const prompt = `Please analyze the following meeting transcript and create professional meeting minutes. The transcript includes timestamps in [HH:MM] format which indicate when each section was spoken. Use these timestamps to provide a chronological overview of the meeting. Do NOT use placeholder text - only include information that is actually present in the transcript.

Format the output as follows:

# Meeting Minutes

**Date:** ${meetingDate || 'Not specified'}
**Time:** ${meetingTime ? meetingTime.replace(/:\d{2}$/, '').replace(/:\d{2}:/, ':').split(':').map((part, index) => {
  if (index === 1) {
    const minutes = parseInt(part);
    const roundedMinutes = Math.round(minutes / 15) * 15;
    return roundedMinutes === 60 ? '00' : roundedMinutes.toString().padStart(2, '0');
  }
  return part;
}).join(':') : 'Not specified'}
**Meeting:** ${meetingTitle || 'General Meeting'}
**Location:** [Extract from transcript if mentioned, otherwise write "Not specified"]

## 1️⃣ Attendees
List all participants mentioned by name in the transcript. If no specific names are mentioned, write "Participants identified by voice/role" and list any roles mentioned (e.g., "Practice Manager", "GP", "Receptionist").

## 2️⃣ Meeting Agenda & Topics Discussed
Summarize the main topics and agenda items that were actually discussed in the meeting based on the transcript content. Where possible, reference the time periods when different topics were discussed.

## 3️⃣ Key Discussion Points
Provide a detailed summary of the main discussions organized by topic. For each major topic, include:
- Important points raised by participants
- Concerns or issues discussed
- Ideas and suggestions shared
- Any relevant background information mentioned

Example format:
**Opening Discussion**
- Topic details...

**Budget Review**
- Budget-related discussion points...

## 4️⃣ Decisions Made
List all decisions that were made during the meeting. For each decision, include:
- What was decided
- Approximate time when the decision was made (rounded to nearest 15-minute block)
- The reasoning behind the decision (if discussed)
- Who was involved in making the decision

## 5️⃣ Action Items
List all action items and tasks assigned during the meeting:
- **Task:** [Description of the action item]
- **Assigned to:** [Person or role responsible]
- **Discussed at:** [Time period when assigned, rounded to nearest 15-minute block]
- **Deadline:** [If mentioned, otherwise "To be determined"]

## 6️⃣ Next Steps
Summarize what will happen next, including:
- Follow-up meetings planned
- Next review dates
- Any ongoing tasks or projects mentioned

**Important Instructions:**
- Use the timestamps to provide chronological context
- Round all times to the nearest 15-minute block (e.g., 09:07 becomes 09:00, 09:23 becomes 09:30)
- Only include information that is actually present in the transcript
- Do not add placeholder text or make assumptions
- If a section has no relevant information from the transcript, write "Not discussed in this meeting"
- Use clear, professional language
- Organize information logically
- Extract specific details, names, dates, and numbers when mentioned

Detail preference: ${detailInstructions}

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
        model: 'o4-mini-2025-04-16',
        messages: [
          { 
            role: 'system', 
            content: 'You are a professional meeting secretary who creates detailed, well-structured meeting minutes. Always follow the exact format provided and extract as much relevant information as possible from the transcript.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
        // Removed max tokens to ensure compatibility with current model

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