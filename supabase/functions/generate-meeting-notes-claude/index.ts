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
    
    // Determine style based on detailLevel
    let styleChoice = 1; // Default to Professional Business
    if (level === 'informal' || level === 'original') {
      styleChoice = 2; // Original Informal
    } else if (level === 'nhs' || level === 'formal') {
      styleChoice = 3; // NHS Formal
    }

    const meetingNotesPrompt = `Create comprehensive meeting notes from the transcript. Extract EVERY specific detail mentioned.

STYLE OPTIONS:
Style 1 (Default - Professional Business): Modern business format with executive structure
Style 2 (Original - Informal): Clear, direct format without formal business structure  
Style 3 (NHS Formal): Traditional NHS committee minutes format

[Use Style ${styleChoice}]

CRITICAL EXTRACTION REQUIREMENTS (ALL STYLES):
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

=== STYLE 1 (DEFAULT): PROFESSIONAL BUSINESS FORMAT ===

${meetingTitle || 'PARTNERSHIP MEETING'} MINUTES

Meeting Details:
Date: ${meetingDate || '[Date if mentioned, otherwise "Not specified"]'}
Time: ${meetingTime || '[Time if mentioned]'}
Location: [Location/Sites discussed]
Attendees: [List key participants mentioned]
Chair: [If identified]
Secretary: [If identified]

EXECUTIVE SUMMARY
[2-3 bullet points summarizing key outcomes and decisions]

AGENDA ITEMS DISCUSSED

1. [MAIN TOPIC]
   
   1.1 Current Situation
       • [Specific details about current state]
       • [Key challenges and constraints]
   
   1.2 Proposal Overview
       • [What is being proposed with specific details]
       • [Scope and implications]
   
   1.3 Analysis of Challenges
       Staff and Operational Impact:
       • [Specific concerns, quotes, impact details]
       
       Technical and System Constraints:
       • [System names, technical barriers, compliance issues]
       
       Financial and Business Implications:
       • [Cost implications, potential savings, business risks]
   
   1.4 Identified Benefits
       • [Specific advantages and efficiencies]
   
   1.5 Alternative Solutions Considered
       • [Each alternative with technical details, costs, pros/cons]

[Continue with sections 2, 3, etc.]

DECISIONS REQUIRED
Priority 1 (Immediate): [Critical decisions]
Priority 2 (Short-term): [Medium priority decisions]
Priority 3 (Long-term): [Strategic planning decisions]

ACTION ITEMS
[Responsible Party] - [Specific action with deadline]
• [Detailed description]
• Target completion: [Date/timeline]

NEXT STEPS AND TIMELINE
Immediate (Next 2 weeks): [Immediate actions]
Short-term (1-3 months): [Medium-term actions]
Long-term (3+ months): [Strategic initiatives]

RISKS AND CONSIDERATIONS
[Risk categories with specific mitigation plans]

=== STYLE 2: ORIGINAL INFORMAL FORMAT ===

${meetingTitle || 'Partnership Meeting'} Notes

Date: ${meetingDate || '[Meeting Date]'}
Attendees: Practice Partners and Key Staff

1. [MAIN TOPIC IN ALL CAPS]

Proposal Overview
- [Specific details from transcript]

Challenges Identified
Staff and Patient Impact:
- [Specific concerns raised with actual quotes where possible]

Operational Concerns:
- [More specific details]

Technology Limitations:
- [Technical limitations, compliance concerns, etc.]

Potential Benefits
- [Specific benefits discussed]

Alternative Solutions Discussed
- [Specific alternatives with technical details]

2. [NEXT MAJOR TOPIC]

Current System Issues
- [Specific problems identified]

Proposed "[System/Approach]" Model
Concept:
- [Detailed explanation of what was proposed]

Benefits:
- [Specific benefits discussed]

Implementation Requirements:
- [Specific people, systems, training mentioned]

Concerns:
- [Specific concerns raised]

3. ROLE ALLOCATIONS & RESPONSIBILITIES

Current Lead Responsibilities
[Specific Area]:
- [Person's name]: [Specific responsibilities and background mentioned]

4. KEY DECISIONS NEEDED
[List specific decisions that need to be made]

5. ACTION ITEMS
- [Specific actions with people/dates where mentioned]

6. NEXT STEPS
- [Specific next steps discussed]

Note: [Implementation guidance discussed]

=== STYLE 3: NHS FORMAL MINUTES FORMAT ===

${meetingTitle || '[PRACTICE NAME] PARTNERSHIP MEETING'}

MINUTES OF MEETING

Meeting: Partnership Meeting
Date: ${meetingDate || '[Date]'}
Time: ${meetingTime || '[Time]'}
Venue: [Location]
Present: [List of attendees with titles/roles]
In Attendance: [Additional attendees]
Apologies: [If mentioned]
Chair: [Name]
Minute Taker: [Name]

ITEM 1: [AGENDA ITEM TITLE]

1.1 [Name] presented the current position regarding [topic]. The key points highlighted were:
    a) [Specific point with details]
    b) [Next point with specifics]
    c) [Continue with all details mentioned]

1.2 Discussion ensued regarding [specific aspects]. The following concerns were raised:
    a) [Specific concern with who raised it if mentioned]
    b) [Next concern with details]

1.3 [Name] outlined the proposed approach which would involve:
    a) [Specific proposal elements]
    b) [Implementation details]
    c) [Resource requirements]

1.4 The meeting noted the following benefits:
    a) [Specific benefit]
    b) [Next benefit with details]

1.5 Alternative options considered included:
    a) [Option 1 with pros/cons]
    b) [Option 2 with analysis]

ACTION: [Responsible person] to [specific action] by [date]

ITEM 2: [NEXT AGENDA ITEM]

[Continue same formal structure]

DECISIONS MADE:
Decision 1: [Specific decision with rationale]
Decision 2: [Next decision]

ACTIONS ARISING:
Action 1: [Responsible person] - [Specific action] - [Deadline]
Action 2: [Next action with details]

ITEMS FOR NEXT MEETING:
- [Carry forward items]
- [New agenda items]

NEXT MEETING:
Date: [If specified]
Time: [If specified]
Venue: [If specified]

Chair: [Signature line]
Date: [Date line]

Meeting closed at: [Time if mentioned]

=== END OF STYLE OPTIONS ===

REMEMBER: Regardless of style chosen, capture ALL specific details, names, technical information, quotes, and operational details exactly as mentioned in the transcript.

Transcript: ${transcript}`;

    console.log('Generating Claude meeting minutes for:', meetingTitle);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [
          { 
            role: 'user', 
            content: meetingNotesPrompt 
          }
        ]
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