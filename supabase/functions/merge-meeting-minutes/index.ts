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

Merging Instructions:
- Structure with these sections (single H1 per doc): # Meeting Title, Date/Time, Attendees, Agenda, Key Points, Decisions, Actions, Risks/Issues, Next Steps.
- Keep concise, deduplicate, and resolve contradictions.
- British English. Markdown output. Do not include non-deterministic preambles.
- Filter out any informal banter, personal anecdotes, humour, or off-topic remarks.
- Ensure every paragraph could safely appear in a circulated Board pack.

CRITICAL - Return to Work & HR Matters:
- If ANY discussion of phased returns, return to work arrangements, reduced hours, modified duties, or wellbeing matters appears in the transcript:
  - Create a dedicated "# RETURN TO WORK & WELLBEING" or "# STAFFING & HR MATTERS" section in the body
  - Include ALL specific details: duration of phased return, shift patterns, start dates, excluded shift types
  - Do NOT relegate these details solely to Action Items - expand them fully in the discussion narrative
  - Example: "A phased return to work over 2 weeks was discussed, with morning shifts only and no late duties"
- These topics must appear BOTH in the discussion narrative AND as action items where applicable.`;

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { summaries, meetingTitle, meetingDate, meetingTime, detailLevel = 'standard' } = await req.json();

    if (!Array.isArray(summaries) || summaries.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing summaries[]' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const joined = summaries.map((s, i) => `--- Chunk ${i + 1} ---\n${s}`).join("\n\n");

    const user = `Detail level: ${detailLevel}. Date: ${meetingDate || ''}. Time: ${meetingTime || ''}.

Merge the following partial summaries into polished final minutes.

IMPORTANT Content Filtering and Tone Management:
- Exclude informal banter, personal anecdotes, humour, off-topic remarks, or non-work-related comments.
- Preserve only substantive discussions, decisions, and actions relevant to NHS/PCN governance.
- When sensitive or critical issues are discussed (e.g. "PCN autonomy vs federation"), maintain factual accuracy but use measured, neutral phrasing — no subjective or emotive language.
- Ensure every paragraph could safely appear in a circulated Board pack.

Post-Processing Instruction:
After producing the draft minutes, perform a final "professional-tone audit":
- Remove any phrase that could appear judgemental, sarcastic, or overly critical.
- Soften phrasing around governance tension points using objective wording (e.g. "members raised concerns" instead of "members complained").

${joined}`;

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_V2 },
          { role: 'user', content: user }
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('OpenAI error:', errText);
      return new Response(JSON.stringify({ error: 'OpenAI error', details: errText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await aiRes.json();
    let meetingMinutes = data.choices?.[0]?.message?.content || '';
    
    // Apply professional-tone audit post-processing
    meetingMinutes = performProfessionalToneAudit(meetingMinutes);

    return new Response(JSON.stringify({ meetingMinutes }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('merge-meeting-minutes error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
