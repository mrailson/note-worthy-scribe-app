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

Content Filtering Rules:
- Exclude informal banter, personal anecdotes, humour, off-topic remarks, or non-work-related comments.
- Preserve only substantive discussions, decisions, and actions relevant to NHS/PCN governance.
- When sensitive or critical issues are discussed (e.g. "PCN autonomy vs federation"), maintain factual accuracy but use measured, neutral phrasing — no subjective or emotive language.
- Ensure every paragraph could safely appear in a circulated Board pack.

Output Format:
- Keep headings consistent: Attendees, Agenda, Key Points, Decisions, Actions, Risks/Issues, Next Steps.
- Preserve unique details. Avoid repeating context that may appear in other chunks.
- Use bullet points. Keep action items in "[Owner] – Action – Due date (if mentioned)" format.
- British English throughout.`;

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

    const { text, meetingTitle, chunkIndex = 0, totalChunks = 1, detailLevel = 'standard' } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing text' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const user = `Meeting: ${meetingTitle || 'Meeting'}\nChunk ${chunkIndex + 1} of ${totalChunks}. Detail level: ${detailLevel}.

IMPORTANT: Filter out any informal banter, personal anecdotes, humour, or off-topic remarks. Only include substantive, governance-relevant content.

Transcript chunk:
"""
${text}
"""`;

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
    const summary = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ chunkIndex, totalChunks, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('summarize-transcript-chunk error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
