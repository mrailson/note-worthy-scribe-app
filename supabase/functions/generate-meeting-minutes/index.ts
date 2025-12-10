import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// V2 Amanda-compliant system prompt for NHS governance
const SYSTEM_PROMPT_V2 = `You are an expert NHS meeting secretary. You create professional, factual, and neutral minutes suitable for board and governance distribution.
Use British English and adhere strictly to NHS and UK healthcare documentation standards.

Additional Behavioural Rules:
- Never include jokes, humour, idioms, or personal remarks (e.g. "wolf ready to pounce").
- Filter out gossip, personal anecdotes, or informal exchanges — only retain professional, factual, or decision-relevant dialogue.
- Replace informal references (e.g. "Rich's mother-in-law") with the person's correct role or designation if known (e.g. "SPLW candidate"). If uncertain, use a neutral descriptor like "a candidate for the SPLW post".
- Where tone in a section may sound critical, rephrase diplomatically (e.g. "members discussed differing perspectives on autonomy" rather than "the federation was criticised").
- Maintain balance: represent differing views fairly, but without attributing emotional tone.
- Prioritise clarity, professionalism, and governance readability over verbatim fidelity.
- NEVER use placeholder text in square brackets like [Insert X].`;

// Professional-tone audit post-processing (v2)
function performProfessionalToneAudit(content: string): string {
  if (!content) return content;
  
  let audited = content;
  
  // Remove judgemental or sarcastic phrases
  const judgementalPatterns = [
    { pattern: /complained about/gi, replacement: 'raised concerns regarding' },
    { pattern: /was criticised/gi, replacement: 'received feedback on' },
    { pattern: /criticised the/gi, replacement: 'expressed concerns about the' },
    { pattern: /attacked the/gi, replacement: 'questioned the' },
    { pattern: /blamed\s+(\w+)\s+for/gi, replacement: 'attributed responsibility to $1 for' },
    { pattern: /failed to/gi, replacement: 'did not' },
    { pattern: /refused to/gi, replacement: 'declined to' },
    { pattern: /angrily stated/gi, replacement: 'stated firmly' },
    { pattern: /frustrated by/gi, replacement: 'noted challenges with' },
    { pattern: /annoyed at/gi, replacement: 'expressed concerns about' },
    { pattern: /demanded that/gi, replacement: 'requested that' },
    { pattern: /insisted on/gi, replacement: 'emphasised the need for' },
    { pattern: /members complained/gi, replacement: 'members raised concerns' },
    { pattern: /staff complained/gi, replacement: 'staff raised concerns' },
    { pattern: /the federation was criticised/gi, replacement: 'members discussed differing perspectives on federation governance' },
    { pattern: /wolf ready to pounce/gi, replacement: '' },
    { pattern: /like a wolf/gi, replacement: '' },
  ];
  
  for (const { pattern, replacement } of judgementalPatterns) {
    audited = audited.replace(pattern, replacement);
  }
  
  // Remove informal/personal remarks
  const informalPatterns = [
    /\b(lol|haha|lmao)\b/gi,
    /\(laughs\)/gi,
    /\(laughter\)/gi,
    /mother-in-law/gi,
    /father-in-law/gi,
    /my wife|my husband|my partner/gi,
  ];
  
  for (const pattern of informalPatterns) {
    audited = audited.replace(pattern, '');
  }
  
  // Clean up any double spaces or excessive punctuation
  audited = audited
    .replace(/\s{2,}/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
  
  return audited;
}

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

    const prompt = `You are a professional meeting secretary generating detailed, polished minutes from the transcript below.

Follow these STRICT RULES:

✅ Language and Format
- British English spelling, NHS style, and 24-hour time.
- British date format with ordinals (e.g. 22nd October 2025).
- Use "Location not specified" if no venue mentioned.
- Attendees section: always "TBC".
- Never use placeholders or square brackets.
- Omit any section with no data.

✅ Content Filtering and Tone Management
- Exclude informal banter, personal anecdotes, humour, off-topic remarks, or non-work-related comments.
- Preserve only substantive discussions, decisions, and actions relevant to NHS/PCN governance.
- When sensitive or critical issues are discussed (e.g. "PCN autonomy vs federation"), maintain factual accuracy but use measured, neutral phrasing — no subjective or emotive language.
- Ensure every paragraph could safely appear in a circulated Board pack.

✅ Output Structure

# MEETING DETAILS

- Meeting Title: ${meetingTitle || 'General Meeting'}
- Date: ${meetingDate || 'Date not recorded'}
- Time: ${roundedTime || 'Time not recorded'}
- Location: [explicitly stated or "Location not specified"]
- Attendees: TBC

# EXECUTIVE SUMMARY

2–3 concise paragraphs summarising the purpose, key discussions, and main decisions. Use neutral, professional tone.

# DISCUSSION SUMMARY

For each major topic:
- Background: brief context
- Key Points: bullet list of factual discussion items
- Outcome: concise summary of conclusion or next step

# DECISIONS & RESOLUTIONS

Numbered list of specific, factual decisions.

# ACTION ITEMS
| Action | Responsible Party | Deadline | Priority |
|--------|------------------|----------|----------|
...

Rules:
- Only include explicit responsibilities from transcript.
- "TBC" if not stated.

# FOLLOW-UP REQUIREMENTS

Bulleted list of follow-ups mentioned.

# OPEN ITEMS & RISKS

Bulleted list of unresolved or risk items.

# NEXT MEETING

Include only if mentioned explicitly.

Post-Processing Instruction:
After producing the draft minutes, perform a final "professional-tone audit":
- Remove any phrase that could appear judgemental, sarcastic, or overly critical.
- Soften phrasing around governance tension points using objective wording (e.g. "members raised concerns" instead of "members complained").

DO NOT include a "Meeting Transcript for Reference" section.

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
        model: 'gpt-5-2025-08-07',
        messages: [
          { 
            role: 'system', 
            content: SYSTEM_PROMPT_V2
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
      .replace(/Attendees:\s*\[Insert[^\]]*\]/gi, 'Attendees: TBC')
      .replace(/Apologies:\s*\[Insert[^\]]*\]/gi, '')
      .replace(/Owner:\s*\[Insert[^\]]*\]/gi, 'Owner: Team member')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
    
    // Apply professional-tone audit post-processing
    generatedMinutes = performProfessionalToneAudit(generatedMinutes);

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
