import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Add this function to handle large transcripts
function handleLargeTranscript(transcript, meetingTitle, meetingDate, meetingTime, styleChoice) {
  if (transcript.length > 25000) {
    // Implement chunking strategy
    return processInChunks(transcript, meetingTitle, meetingDate, meetingTime, styleChoice);
  } else {
    // Use standard single API call
    return processSingle(transcript, meetingTitle, meetingDate, meetingTime, styleChoice);
  }
}

function processInChunks(transcript, meetingTitle, meetingDate, meetingTime, styleChoice) {
  const words = transcript.split(' ');
  const chunkSize = 20000; // Words per chunk
  const overlap = 2000; // Word overlap between chunks
  const chunks = [];
  
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    chunks.push(chunk);
  }
  
  return { chunks, strategy: 'chunked' };
}

function processSingle(transcript, meetingTitle, meetingDate, meetingTime, styleChoice) {
  return { transcript, strategy: 'single' };
}

async function consolidateChunkResults(chunkResults, meetingTitle, meetingDate, meetingTime, styleChoice) {
  const consolidationPrompt = `Consolidate these meeting minute chunks into a single comprehensive document. Ensure no duplication of action items or decisions, and maintain chronological flow.

CONSOLIDATION REQUIREMENTS:
- Merge all agenda items in chronological order
- Consolidate all action items (remove duplicates)
- Consolidate all decisions (note if any were modified later)
- Maintain all specific details, names, dates, and quotes
- Create unified executive summary
- Create consolidated action items section
- Create consolidated decisions section
- Only include "Chair:" line if a chairperson is explicitly identified
- Only include "Secretary:" or "Minute Taker:" line if someone is explicitly identified in that role
- Only include "Meeting Duration:" or "Duration:" if the meeting length can be determined
- Do NOT include placeholder text like "[Not identified in transcript]" or "[Ongoing - transcript appears to be mid-meeting excerpt]"
- If these roles/information are not identifiable, simply omit the lines entirely

CHUNK RESULTS TO CONSOLIDATE:
${chunkResults.join('\n\n--- CHUNK SEPARATOR ---\n\n')}

Please create a single, comprehensive meeting minutes document following Style ${styleChoice} format.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        { 
          role: 'user', 
          content: consolidationPrompt 
        }
      ]
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Claude API error during consolidation: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function processChunk(transcript, meetingTitle, meetingDate, meetingTime, styleChoice) {
  console.log('🎯 Processing chunk with updated rules - NO PLACEHOLDERS for Chair/Secretary/Duration');
  
  const meetingNotesPrompt = `Create comprehensive meeting notes from the transcript. This is a LONG MEETING (potentially 3+ hours, 30,000+ words) - ensure ALL agenda items and discussions are captured.

CRITICAL PLACEHOLDER REMOVAL:
- NEVER include "Chair: [Not identified in transcript]" 
- NEVER include "Secretary: [Not identified in transcript]"
- NEVER include "Meeting Duration: [Ongoing - transcript appears to be mid-meeting excerpt]"
- NEVER include "Duration: [Meeting length if determinable]"
- If Chair/Secretary/Duration cannot be determined from transcript, OMIT the lines completely
- Do NOT add any placeholder text in brackets like [Not identified] or [To be confirmed]

LANGUAGE AND SPELLING REQUIREMENTS:
- Use British English spelling throughout: organised, realise, colour, centre, recognised, specialise, summarise, prioritise, behaviour, analyse, programme
- Use British terminology: whilst (not while), amongst (not among), programme (not program), fulfil (not fulfill), learnt (not learned)
- Use British date format: 31st August 2025 (not August 31, 2025) - include ordinal indicators (1st, 2nd, 3rd, etc.)
- Use 24-hour time format where appropriate: 14:30 rather than 2:30 PM
- Follow NHS/UK business conventions for dates, times, and formal language
- Use £ symbol positioning following UK conventions

LARGE MEETING HANDLING:
- Process the ENTIRE transcript systematically from start to finish
- Identify ALL distinct agenda items and topic changes
- Group related discussions that may be scattered throughout the meeting
- Capture decisions made at different points in the meeting
- Note when topics are revisited or decisions are modified
- Include timing indicators if mentioned ("after lunch", "at the start", etc.)

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
- ALL decisions made throughout the meeting (even if later modified)
- ALL action items assigned to specific people
- ALL follow-up meetings or deadlines mentioned

CONDITIONAL FIELD REQUIREMENTS:
- Only include "Chair:" line if a chairperson is explicitly identified in the transcript
- Only include "Secretary:" or "Minute Taker:" line if someone is explicitly identified in that role
- Only include "Meeting Duration:" or "Duration:" if the meeting length can be determined from the transcript
- Do NOT include placeholder text like "[Not identified in transcript]" or "[Ongoing - transcript appears to be mid-meeting excerpt]"
- If these roles/information are not identifiable, simply omit the lines entirely

LONG MEETING STRUCTURE REQUIREMENTS:
- Create as many main sections as needed (could be 10-15+ for long meetings)
- Use clear topic transitions to show agenda progression
- Group sub-discussions under appropriate main topics
- Include "Meeting Flow" section if topics are revisited multiple times
- Consolidate action items from throughout the entire meeting
- Note any agenda items deferred or postponed

=== STYLE 1 (DEFAULT): PROFESSIONAL BUSINESS FORMAT ===

${meetingTitle || 'PARTNERSHIP MEETING'} MINUTES

Meeting Details:
Date: ${meetingDate || '[Date if mentioned, otherwise "Not specified"]'}
Time: ${meetingTime || '[Start-end time if mentioned, note duration]'}
Location: [Location/Sites discussed]
Attendees: [List ALL participants mentioned throughout meeting]

EXECUTIVE SUMMARY
[3-5 bullet points summarizing key outcomes and major decisions from entire meeting]

MEETING FLOW OVERVIEW
[Brief timeline of main topics covered - useful for long meetings]
• [Time/sequence]: [Major topic]
• [Next sequence]: [Next major topic]
[Continue for all major agenda items]

AGENDA ITEMS DISCUSSED

1. [FIRST MAIN TOPIC]
   
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
   
   1.6 Decisions Made
       • [Specific decisions reached for this topic]
   
   1.7 Actions Arising
       • [Specific actions assigned with responsible parties]

2. [SECOND MAIN TOPIC]
[Continue same detailed structure for each major topic]

[Continue for ALL agenda items - could be 10-15+ sections for long meetings]

CONSOLIDATED DECISIONS SUMMARY
[All decisions made throughout the meeting, organized by priority]
Priority 1 (Immediate): [Critical decisions from entire meeting]
Priority 2 (Short-term): [Medium priority decisions]
Priority 3 (Long-term): [Strategic planning decisions]

CONSOLIDATED ACTION ITEMS
[ALL action items from throughout the meeting]
[Responsible Party] - [Specific action with deadline]
• [Detailed description]
• Target completion: [Date/timeline]
• Source: [Which agenda item this came from]

TOPICS DEFERRED OR REVISITED
[Items that were postponed or discussed multiple times]
• [Topic]: [Status and reason for deferral]

NEXT STEPS AND TIMELINE
Immediate (Next 2 weeks): [All immediate actions from entire meeting]
Short-term (1-3 months): [All medium-term actions]
Long-term (3+ months): [All strategic initiatives]

RISKS AND CONSIDERATIONS
[Consolidated risks from all discussions]

FOLLOW-UP MEETINGS SCHEDULED
[Any specific meetings or deadlines mentioned]

=== STYLE 2: ORIGINAL INFORMAL FORMAT ===

${meetingTitle || 'Partnership Meeting'} Notes

Date: ${meetingDate || '[Meeting Date]'}
Attendees: [ALL participants mentioned throughout meeting]

MEETING OVERVIEW
[Brief summary of main topics covered throughout the long meeting]

1. [FIRST MAIN TOPIC IN ALL CAPS]

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

2. [SECOND MAIN TOPIC IN ALL CAPS]

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

[Continue for ALL major topics discussed - expand to 10-15+ sections as needed]

CONSOLIDATED DECISIONS FROM ENTIRE MEETING
[All decisions made throughout the meeting]

CONSOLIDATED ACTION ITEMS FROM ENTIRE MEETING
[All actions assigned throughout the meeting with sources]

DEFERRED ITEMS
[Topics postponed or requiring follow-up]

=== STYLE 3: NHS FORMAL MINUTES FORMAT ===

${meetingTitle || '[PRACTICE NAME] PARTNERSHIP MEETING'}

MINUTES OF MEETING

Meeting: Partnership Meeting
Date: ${meetingDate || '[Date]'}
Time: ${meetingTime || '[Start time] - [End time]'}
Venue: [Location]
Present: [List ALL attendees mentioned throughout meeting with titles/roles]
In Attendance: [Additional attendees]
Apologies: [If mentioned]

ITEM 1: [FIRST AGENDA ITEM TITLE]

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

1.6 Decisions Made:
    a) [Specific decision with rationale]
    b) [Next decision]

1.7 Actions Arising:
    a) [Responsible person] to [specific action] by [date]
    b) [Next action with details]

ITEM 2: [SECOND AGENDA ITEM TITLE]
[Continue same formal structure]

[Continue for ALL agenda items discussed - could be 15-20+ items for long meetings]

CONSOLIDATED DECISIONS MADE:
Decision 1: [Specific decision with rationale and agenda item source]
Decision 2: [Next decision]
[Continue for all decisions throughout meeting]

CONSOLIDATED ACTIONS ARISING:
Action 1: [Responsible person] - [Specific action] - [Deadline] - [Source agenda item]
Action 2: [Next action with details]
[Continue for all actions from entire meeting]

ITEMS DEFERRED:
[Any items postponed with reasons]

ITEMS FOR NEXT MEETING:
[Carry forward items and new agenda items]

NEXT MEETING:
Date: [If specified]
Time: [If specified]
Venue: [If specified]

Meeting closed at: [Time if mentioned]

=== HANDLING VERY LARGE OUTPUTS ===

IF OUTPUT APPROACHES TOKEN LIMIT:
1. Prioritize: Executive Summary, Key Decisions, Action Items
2. Use more concise bullet points while maintaining specificity
3. Consider two-pass approach: outline first, then details
4. Focus on actionable items and critical decisions
5. Maintain all names, dates, and specific commitments

TRANSCRIPT CHUNKING GUIDANCE:
- If transcript >25,000 words, consider processing in chronological chunks
- Maintain 2000-word overlap between chunks for context
- Process agenda items completely within chunks where possible
- Consolidate results ensuring no duplication of action items or decisions

=== END OF STYLE OPTIONS ===

TRANSCRIPT HANDLING NOTES:
- Process the ENTIRE transcript systematically from start to finish
- If transcript exceeds processing limits, maintain context across sections
- Ensure all sections are captured even if processing in multiple parts
- Work chronologically to maintain meeting flow and decision progression

REMEMBER: For long meetings, systematically work through the ENTIRE transcript. Don't summarize - capture ALL specific details, decisions, and actions from the full meeting duration. Regardless of style chosen, capture ALL specific details, names, technical information, quotes, and operational details exactly as mentioned in the transcript.

Transcript: ${transcript}`;

  console.log('Processing chunk for meeting:', meetingTitle);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
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
  return data.content[0].text;
}

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

    // Handle large transcripts with chunking strategy
    const processingResult = handleLargeTranscript(transcript, meetingTitle, meetingDate, meetingTime, styleChoice);
    
    let meetingMinutes;
    
    if (processingResult.strategy === 'chunked') {
      console.log(`Processing large transcript with ${processingResult.chunks.length} chunks`);
      
      // Process chunks and consolidate results
      const chunkResults = [];
      
      for (let i = 0; i < processingResult.chunks.length; i++) {
        console.log(`Processing chunk ${i + 1}/${processingResult.chunks.length}`);
        const chunkMinutes = await processChunk(processingResult.chunks[i], meetingTitle, meetingDate, meetingTime, styleChoice);
        chunkResults.push(chunkMinutes);
      }
      
      console.log('Consolidating chunk results');
      // Consolidate chunk results
      meetingMinutes = await consolidateChunkResults(chunkResults, meetingTitle, meetingDate, meetingTime, styleChoice);
    } else {
      // Standard single processing
      meetingMinutes = await processChunk(transcript, meetingTitle, meetingDate, meetingTime, styleChoice);
    }

    console.log('Claude meeting minutes generated successfully');
    console.log('Generated minutes preview:', meetingMinutes.substring(0, 500));

    return new Response(JSON.stringify({ 
      success: true,
      meetingMinutes: meetingMinutes 
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