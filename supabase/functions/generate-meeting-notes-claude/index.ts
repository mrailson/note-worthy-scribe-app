import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

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

    const prompt = `Create comprehensive partnership meeting notes from the transcript. Extract EVERY specific detail mentioned.

CRITICAL EXTRACTION REQUIREMENTS:
- EVERY person mentioned by name with their roles, responsibilities, background
- EVERY location, site name, system name mentioned (spell exactly as heard)
- EVERY number, percentage, cost, timeframe, date mentioned  
- EVERY technical system, process, or procedure discussed
- EVERY specific quote or phrase mentioned (use quotation marks)
- EVERY training program, course, qualification, exam date
- EVERY past experience, trial, or example referenced
- EVERY concern, benefit, challenge, or solution discussed
- EVERY compliance issue, regulatory requirement mentioned
- EVERY alternative solution or option considered

LISTEN CAREFULLY FOR:
- Proper names of people, places, systems (transcription may have errors)
- Specific terminology like "just in time", "dispensing from totes", technical phrases
- Past experiences and their outcomes
- Training costs, funding sources, dates
- Patient access concerns and specific village names
- Compliance and regulatory issues (CQC, EPS, ODS codes)
- Financial implications, savings, costs

STRUCTURE WITH DETAILED SUBSECTIONS:
Use this exact format with comprehensive subsections:

Format exactly as:

${meetingTitle || 'Partnership Meeting'} Notes

Date: ${meetingDate || '[Meeting Date]'}
Attendees: ${meetingTime ? `Meeting held at ${meetingTime}` : 'Practice Partners and Key Staff'}

1. [MAIN TOPIC]

Proposal Overview
- [All specific details about what's being proposed]

Challenges Identified
Staff and Patient Impact:
- [Specific concerns, quotes, impact details]

Operational Concerns: 
- [Process issues, past experiences, staffing details]

Technology Limitations:
- [System names, technical barriers, compliance issues]

Potential Benefits
- [Specific benefits, financial implications, efficiencies]

Alternative Solutions Discussed
- [Each alternative with technical details, costs, pros/cons]

2. [NEXT MAJOR TOPIC]

Current System Issues
- [Specific problems identified]

Proposed "[System Name]" Model
Concept:
- [Detailed process description with technical terms]

Benefits:
- [Specific advantages]

Implementation Requirements:
- [People, systems, training, timelines, costs]

Concerns:
- [Specific risks and challenges]

3. ROLE ALLOCATIONS & RESPONSIBILITIES

Current Lead Responsibilities
Dispensary Operations:
- [Name]: [Specific responsibilities and expertise]

Clinical Specialties:
- [Specialty]: [Name] - [Specific responsibilities, background]

Training & Development:
- [Program]: [Details about people, timelines, status]

Administrative:
- [Role]: [Name and details]

Training Developments
[Person's Progress]:
- [Specific training details, courses, timelines]

Future Planning Considerations
- [Succession planning, upcoming changes]

4. KEY DECISIONS NEEDED
   [List specific decisions that need to be made based on discussion]
5. ACTION ITEMS

- [Specific actions with people/dates where mentioned]

6. NEXT STEPS

- [Specific next steps discussed]

Note: [Implementation guidance discussed]

REMEMBER: If the transcript mentions someone's name, a place, a system, a cost, a date, a process, or a concern - include it exactly. Don't paraphrase or summarize. Capture the specific language used.

Detail preference: ${detailInstructions}

Extract and organize all key discussion points, decisions, action items, and follow-up requirements from the transcript.

Transcript to analyze:
${transcript}`;

    console.log('Generating Claude meeting minutes for:', meetingTitle);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [
          { 
            role: 'user', 
            content: prompt 
          }
        ],
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Claude API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const generatedMinutes = data.content[0].text;

    console.log('Claude meeting minutes generated successfully');

    return new Response(JSON.stringify({ 
      success: true,
      meetingMinutes: generatedMinutes 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-meeting-notes-claude function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});