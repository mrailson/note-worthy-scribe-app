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

  // Round time to nearest 15-minute interval
  function roundToNearest15Minutes(timeString: string): string {
    if (!timeString) return '';
    
    try {
      // Parse time (assumes format like "14:23" or "06:47")
      const [hours, minutes] = timeString.split(':').map(Number);
      
      // Round minutes to nearest 15
      const roundedMinutes = Math.round(minutes / 15) * 15;
      
      // Handle overflow (e.g., 59 minutes rounds to 60)
      let finalHours = hours;
      let finalMinutes = roundedMinutes;
      
      if (finalMinutes === 60) {
        finalHours = (hours + 1) % 24;
        finalMinutes = 0;
      }
      
      // Format as HH:MM
      return `${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
    } catch (error) {
      console.error('Error rounding time:', error);
      return timeString; // Return original if parsing fails
    }
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

    const roundedTime = roundToNearest15Minutes(meetingTime || '');

    const prompt = `You are a professional meeting secretary creating detailed meeting minutes using British English conventions. Analyse the transcript and generate comprehensive, structured meeting minutes.

CRITICAL RULES:
- Use British English spellings throughout (organised, realise, colour, centre)
- Use British date formats with ordinals (1st August 2025, 22nd October 2025)
- Use 24-hour time format
- ONLY include information actually present in the transcript
- NEVER make up or fabricate information
- If a section has no relevant information, OMIT that entire section
- Do NOT use placeholder text like "Not specified", "TBC", or "[Insert X]"

FORMAT REQUIREMENTS:

# MEETING DETAILS

**Meeting Title:** ${meetingTitle || 'General Meeting'}
**Date:** ${meetingDate || 'Date not recorded'}
**Time:** ${roundedTime || 'Time not recorded'}
**Location:** [Extract from transcript if explicitly mentioned, otherwise write "Location not specified"]

---

# EXECUTIVE SUMMARY

[Write 2-3 comprehensive paragraphs summarising the overall meeting. Include:
- Main purpose and context of the meeting
- Key decisions made
- Most important outcomes
- Overall sentiment and next steps
Only include information from the transcript. If insufficient information, write 1 concise paragraph.]

---

# ATTENDEES

[Extract specific names if mentioned in transcript. If NO specific names are mentioned, use "Practice team members" - do NOT use "Not specified" or "TBC" or any placeholder text.]

---

# DISCUSSION SUMMARY

## Background
[Set the context and background for the discussions. What led to this meeting? What prior situations or issues are being addressed?]

## Key Points
[List main discussion items as clear bullet points:
- Each major topic discussed
- Important points raised
- Concerns or issues mentioned
- Data, numbers, or specific details shared
- Different perspectives or opinions expressed]

## Outcome
[Summarise the conclusions reached, consensus achieved, or how discussions resolved]

---

# DECISIONS & RESOLUTIONS

[List as numbered items (1., 2., 3., etc.):
1. Each specific decision made
2. Resolutions agreed upon
3. Approvals given
4. Changes agreed to be implemented

If NO decisions were made, OMIT this entire section.]

---

# ACTION ITEMS

[Format as a proper markdown table. If there are action items, create table like this:

| Action | Responsible Party | Deadline | Priority |
|--------|------------------|----------|----------|
| Specific task description | Person or team name | Specific date or "To be determined" | High/Medium/Low |
| Another task | Another person | Date | Priority |

Rules for Action Items:
- Extract from transcript only
- Use actual names/roles mentioned
- Include actual deadlines if stated
- Assign priority based on urgency indicated (High/Medium/Low)
- If NO action items discussed, OMIT this entire section.]

---

# FOLLOW-UP REQUIREMENTS

[Only include this section if there are specific follow-up tasks, monitoring requirements, or check-ins mentioned. List as bullet points.

If NOTHING mentioned about follow-up, OMIT this entire section.]

---

# OPEN ITEMS & RISKS

[Only include this section if transcript mentions:
- Unresolved issues
- Outstanding questions
- Identified risks or concerns
- Items requiring further discussion
List as bullet points.

If NOTHING mentioned, OMIT this entire section.]

---

# NEXT MEETING

[Only include this section if a next meeting is explicitly scheduled or discussed.
Include: Date, time, location, agenda items if mentioned.

If NO next meeting mentioned, OMIT this entire section.]

---

Detail preference: ${detailInstructions}

Transcript to analyse:
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
            content: 'You are an expert meeting secretary for NHS and UK healthcare organisations. You create comprehensive, professional meeting minutes following British conventions. You are meticulous about only including factual information from transcripts, never fabricating details. You understand medical/healthcare terminology and NHS organisational structures. Follow the exact format provided, using proper markdown formatting including tables for action items.' 
          },
          { role: 'user', content: prompt }
        ],
        /* temperature removed for model compatibility */
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