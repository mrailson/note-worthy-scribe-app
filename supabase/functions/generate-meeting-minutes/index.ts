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

CRITICAL RULES - ABSOLUTELY NO PLACEHOLDERS:
- Use British English spellings throughout (organised, realise, colour, centre)
- Use British date formats with ordinals (1st August 2025, 22nd October 2025)
- Use 24-hour time format (e.g., 14:30, not 2:30 PM)
- ONLY include information actually present in the transcript
- NEVER make up or fabricate information
- NEVER EVER use square brackets like [Insert X] or [Insert Name] or any similar placeholder
- NEVER use phrases like "Not specified", "TBC", "To be confirmed"
- If information is not in the transcript, either OMIT that field entirely or use descriptive text like "Practice team members" or "Team discussed"
- If a section has no relevant information, OMIT that entire section completely

FORMATTING RULES:
Write the meeting minutes in the following structure. Replace instructional text with actual content from the transcript:

# MEETING DETAILS

**Meeting Title:** ${meetingTitle || 'General Meeting'}
**Date:** ${meetingDate || 'Date not recorded'}
**Time:** ${roundedTime || 'Time not recorded'}
**Location:** Location not specified

INSTRUCTION FOR LOCATION: If a specific location is mentioned in the transcript (e.g., "Board Room", "via Microsoft Teams"), write it. Otherwise write "Location not specified".

---

# EXECUTIVE SUMMARY

INSTRUCTION: Write 2-3 comprehensive paragraphs summarising the overall meeting. Include main purpose, key decisions, important outcomes, and next steps. Only use information from the transcript. If there's very little content, write 1 concise paragraph.

---

# ATTENDEES

Practice team members

INSTRUCTION FOR ATTENDEES: If specific names are mentioned in the transcript, list them here (e.g., "Dr Sarah Johnson, Practice Manager David Smith, Nurse Jane Williams"). If NO names are mentioned, write "Practice team members". Never write anything in square brackets.

---

# DISCUSSION SUMMARY

## Background
INSTRUCTION: Explain what led to this meeting and what prior situations are being addressed. Use only transcript content.

## Key Points
INSTRUCTION: List main discussion items as bullet points. Each bullet should be a complete sentence about topics discussed, points raised, concerns mentioned, or data shared.

## Outcome
INSTRUCTION: Summarise conclusions reached and how discussions resolved. Use only transcript content.

---

# DECISIONS & RESOLUTIONS

INSTRUCTION: List specific decisions as numbered items (1., 2., 3., etc.). Each should be a clear statement of what was decided or resolved. If NO decisions were made in the meeting, OMIT this entire DECISIONS & RESOLUTIONS section completely.

---

# ACTION ITEMS

INSTRUCTION: Create a markdown table with columns: Action | Responsible Party | Deadline | Priority

CRITICAL: For Responsible Party column: 
- ONLY use names or roles EXPLICITLY mentioned in the transcript as responsible for that specific action
- NEVER infer, assume, or make up who should be responsible
- If not explicitly stated, write "TBC" (To Be Confirmed)

For Deadline column: Use actual dates mentioned (e.g., "22nd October 2025") or write "TBC" if no deadline stated.

For Priority column: Write "High", "Medium", or "Low" based on urgency mentioned in transcript.

If NO action items were discussed, OMIT this entire ACTION ITEMS section completely.

Example format:
| Action | Responsible Party | Deadline | Priority |
|--------|------------------|----------|----------|
| Investigate telephony system messaging | IT Lead | 29th October 2025 | High |
| Arrange staff training session | TBC | TBC | Medium |

---

# FOLLOW-UP REQUIREMENTS

INSTRUCTION: List specific follow-up tasks or monitoring requirements as bullet points. Use only items mentioned in transcript. If NOTHING about follow-up was mentioned, OMIT this entire section completely.

---

# OPEN ITEMS & RISKS

INSTRUCTION: List unresolved issues, outstanding questions, risks, or items needing further discussion as bullet points. Use only items from transcript. If NOTHING was mentioned, OMIT this entire section completely.

---

# NEXT MEETING

INSTRUCTION: Only include this section if a next meeting was explicitly scheduled or discussed. Include date, time, location, and agenda items if mentioned. If NO next meeting was mentioned, OMIT this entire section completely.

---

DO NOT include a "Meeting Transcript for Reference" section at the end.

Detail preference: ${detailInstructions}

IMPORTANT REMINDER: Never use square brackets, never write "[Insert anything]", never use placeholder text. Write real content from the transcript or omit the section entirely.

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
        model: 'gpt-5-2025-08-07',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert meeting secretary for NHS and UK healthcare organisations. You create comprehensive, professional meeting minutes following British conventions. You are meticulous about only including factual information from transcripts, never fabricating details. You understand medical/healthcare terminology and NHS organisational structures. CRITICAL: Never use placeholder text like [Insert X] or square brackets in your output. Write actual content from the transcript or use phrases like "Practice team members" or "Location not specified" when specific details are not available. Follow the exact format provided, using proper markdown formatting including tables for action items.' 
          },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 4096
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    let generatedMinutes = data.choices[0].message.content;
    
    // Sanitize output to remove any [Insert X] placeholders
    generatedMinutes = generatedMinutes
      .replace(/\[Insert[^\]]*\]/gi, '')
      .replace(/Location:\s*\[Insert[^\]]*\]/gi, 'Location: Location not specified')
      .replace(/Attendees:\s*\[Insert[^\]]*\]/gi, 'Attendees: Practice team members')
      .replace(/Apologies:\s*\[Insert[^\]]*\]/gi, '')
      .replace(/Owner:\s*\[Insert[^\]]*\]/gi, 'Owner: Team member')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

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