import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Claude Sonnet 4.6 — reduce step. Merges per-chunk summaries into final minutes.
// Project policy (memory): claude-sonnet-4-6 must be used directly.
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('CLAUDE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are an expert NHS meeting secretary. You produce professional, factual, neutral minutes suitable for board and governance distribution.
British English. NHS / UK healthcare documentation standards.

Behavioural rules:
- Never include jokes, humour, idioms, or personal remarks.
- Filter out gossip, personal anecdotes, informal exchanges — retain professional, factual, decision-relevant dialogue only.
- Replace informal references with the person's correct role/designation if known; otherwise neutral descriptors.
- Where tone may sound critical, rephrase diplomatically.
- Maintain balance: represent differing views fairly without emotional tone.

Decision taxonomy (mandatory):
- Use prefixes RESOLVED, AGREED, NOTED explicitly in **bold** at the start of each decision line.
  - RESOLVED — explicit voting language present
  - AGREED — clear consensus
  - NOTED — informational acknowledgement

Merging instructions:
- Mirror the single-shot meeting notes structure exactly. Start immediately with "# MEETING DETAILS" — no title, preamble, or text before it.
- Under "# MEETING DETAILS", write separate label-only lines: "Date: <human date>" and "Time: <human time>". Use the supplied meeting date/time from the request; if either value is unavailable, keep the label and leave the value blank. Add "Location:" only when the source summaries contain an explicit location.
- Then emit "# EXECUTIVE SUMMARY" as one concise paragraph, followed by "# ATTENDEES" when attendee details are available, then "# DISCUSSION SUMMARY".
- Under "# DISCUSSION SUMMARY", the first line must be exactly "**Meeting Purpose:** [one sentence]". The second content block must be a literal sub-heading line that says exactly "Key Points" with no #, no bold, and on its own line. Then list numbered topics as "1. **[Topic Heading]**" each on its own line, followed by a blank line, followed by a body paragraph.
- Put decisions and actions under appropriate top-level headings within this structure. Use "# DECISIONS REGISTER" for decisions and "# ACTION ITEMS" for actions. Action items must be a markdown table with exactly these column headers in this order: Action | Owner | Deadline | Priority. Never use "Responsible Party" or "Due date" as column names. If owner or deadline is unknown, write "TBC".
- Emit "# OPEN ITEMS & RISKS" as plain bullet lines describing items deferred, outstanding questions, and strategic considerations in the same wording style as the single-shot prompt. Do not include Status: tags. Do NOT use markdown pipe tables for risks or issues. If any input summaries contain table-shaped risks/issues, convert them into bullets.
- Finish with "# NEXT MEETING".
- Deduplicate, resolve contradictions, preserve unique details.
- If a chunk arrived as an "[unsummarised excerpt …]" placeholder, integrate its substantive content where possible and silently drop the placeholder marker from the final output (do NOT mention it).
- Before responding, verify every top-level section starts with a # markdown heading on its own line. If any section uses bold (**) instead of #, rewrite it as a # heading.
- Markdown output, no preambles.`;

function performProfessionalToneAudit(content: string): string {
  if (!content) return content;
  let audited = content;
  const judgementalPatterns: Array<[RegExp, string]> = [
    [/complained about/gi, 'raised concerns regarding'],
    [/was criticised/gi, 'received feedback on'],
    [/criticised the/gi, 'expressed concerns about the'],
    [/attacked the/gi, 'questioned the'],
    [/blamed\s+(\w+)\s+for/gi, 'attributed responsibility to $1 for'],
    [/failed to/gi, 'did not'],
    [/refused to/gi, 'declined to'],
    [/angrily stated/gi, 'stated firmly'],
    [/frustrated by/gi, 'noted challenges with'],
    [/annoyed at/gi, 'expressed concerns about'],
    [/demanded that/gi, 'requested that'],
    [/insisted on/gi, 'emphasised the need for'],
    [/members complained/gi, 'members raised concerns'],
    [/staff complained/gi, 'staff raised concerns'],
    [/the federation was criticised/gi, 'members discussed differing perspectives on federation governance'],
    [/wolf ready to pounce/gi, ''],
    [/like a wolf/gi, ''],
  ];
  for (const [pattern, replacement] of judgementalPatterns) audited = audited.replace(pattern, replacement);
  const informalPatterns = [/\b(lol|haha|lmao)\b/gi, /\(laughs\)/gi, /\(laughter\)/gi, /mother-in-law/gi, /father-in-law/gi, /my wife|my husband|my partner/gi];
  for (const p of informalPatterns) audited = audited.replace(p, '');
  // Drop any leaked excerpt-placeholder markers if Claude didn't already strip them
  audited = audited.replace(/_\[unsummarised excerpt[^\]]*\]_\s*/gi, '');
  return audited.replace(/\s{2,}/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!anthropicApiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
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

    const userPrompt = `Meeting: ${meetingTitle || 'Meeting'}
Date: ${meetingDate || ''}  Time: ${meetingTime || ''}
Detail level: ${detailLevel}

Merge the following partial summaries into polished final minutes following all rules above.

${joined}`;

    // 90s wall-clock — well within edge function budget; reduce step is text-only
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);

    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic merge error:', response.status, errText);
      return new Response(JSON.stringify({ error: 'Anthropic error', status: response.status, details: errText.slice(0, 500) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    let meetingMinutes = (data.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n');

    meetingMinutes = performProfessionalToneAudit(meetingMinutes);

    return new Response(JSON.stringify({ meetingMinutes, model: 'claude-sonnet-4-6', chunksMerged: summaries.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.error('merge-meeting-minutes timed out after 90s');
      return new Response(JSON.stringify({ error: 'Merge step timed out' }), {
        status: 504,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.error('merge-meeting-minutes error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
