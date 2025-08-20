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

    const prompt = `Create detailed partnership meeting notes from the transcript. Extract ALL specific details, names, locations, systems, and technical information mentioned.

CRITICAL REQUIREMENTS:

- Include EVERY specific detail from the transcript (names, places, systems, concerns, quotes)
- Capture ALL technical discussions about systems, processes, and challenges
- Include ALL people mentioned by name and their roles/responsibilities
- Extract ALL specific concerns, benefits, and implementation details discussed
- Do NOT summarize or generalize - include the actual details discussed

Format exactly as:

${meetingTitle || 'Partnership Meeting'} Notes

Date: ${meetingDate || '[Meeting Date]'}
Attendees: ${meetingTime ? `Meeting held at ${meetingTime}` : 'Practice Partners and Key Staff'}

1. [MAIN TOPIC IN ALL CAPS]

Proposal Overview

- [Specific details from transcript]
- [Include actual locations, systems, technical details mentioned]

Challenges Identified
[Subsection Name]:

- [Specific concerns raised with actual quotes where possible]
- [Include names of people, places, systems mentioned]

[Another Subsection Name]:

- [More specific details]
- [Technical limitations, compliance concerns, etc.]

Potential Benefits

- [Specific benefits discussed]
- [Financial implications mentioned]

Alternative Solutions Discussed

- [Specific alternatives with technical details]
- [System names, costs, implementation challenges]

2. [NEXT MAJOR TOPIC]

Current System Issues

- [Specific problems identified]

Proposed [System/Approach] Model
Concept:

- [Detailed explanation of what was proposed]
- [Specific timelines, processes, technical details]

Benefits:

- [Specific benefits discussed]

Implementation Requirements:

- [Specific people, systems, training mentioned]
- [Actual dates, events, requirements discussed]

Concerns:

- [Specific concerns raised]

3. ROLE ALLOCATIONS & RESPONSIBILITIES

Current Lead Responsibilities
[Specific Area]:

- [Person's name]: [Specific responsibilities and background mentioned]

[Continue for each area discussed with names and details]

Training & Development:

- [Specific training programs, people, timelines mentioned]
- [Include actual course names, dates, institutions]

[Continue with all subsections capturing specific details]

4. KEY DECISIONS NEEDED
   [List specific decisions that need to be made based on discussion]
5. ACTION ITEMS

- [Specific actions with people/dates where mentioned]

6. NEXT STEPS

- [Specific next steps discussed]

Note: [Implementation guidance discussed]

REMEMBER: Include EVERY specific detail, name, system, concern, and technical point discussed. Do not generalize or omit details.

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