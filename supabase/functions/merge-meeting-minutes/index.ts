import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Claude Sonnet 4.6 — reduce step. Merges per-chunk summaries into final minutes.
// Project policy (memory): claude-sonnet-4-6 must be used directly.
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('CLAUDE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are an expert NHS meeting secretary producing professional, factual, neutral minutes for board and governance distribution. British English. NHS / UK healthcare documentation standards.

CASE AND EMPHASIS RULES (critical — violations break downstream rendering):
- Write all prose in normal sentence case. NEVER write whole paragraphs, sentences, or multi-word phrases in ALL UPPERCASE.
- Uppercase is permitted ONLY for: section heading words (e.g. "MEETING DETAILS"), the three decision-prefix keywords (RESOLVED, AGREED, NOTED), and proper nouns / abbreviations as they appear in source (NHS, ICB, GP, KGH, NHFT, OPIT, etc.).
- Use markdown bold (**) sparingly and precisely. Bold ONLY:
  • The labels "Meeting Purpose:" and the column headers in the action items table.
  Do NOT bold whole sentences or paragraphs.
- Decision lines in the DECISIONS REGISTER are plain lines (no bullet, no bold, no colon after the label) — see the DECISIONS REGISTER section for the exact format.
- Never put a bold open marker (\`**\`) immediately adjacent to a bold close marker (\`**\`) of the previous run. Always have at least a non-asterisk character between them.

LINE BREAK RULES (critical):
- Every numbered key point in the Discussion Summary starts on its own line, preceded and followed by a blank line.
- Every bullet starts on its own line.
- Every section heading is on its own line with a blank line before and after.
- Never run two paragraphs together on the same line.

BEHAVIOURAL RULES:
- Filter out banter, jokes, humour, idioms, gossip, personal anecdotes, informal exchanges. Retain only professional, factual, decision-relevant content.
- Replace informal references with the person's role/designation if known; otherwise use neutral descriptors.
- Where source tone may sound critical, rephrase diplomatically.
- Represent differing views fairly, without emotional tone.

DECISION TAXONOMY:
- RESOLVED — explicit voting language present in source
- AGREED — clear consensus expressed
- NOTED — informational acknowledgement only

REQUIRED OUTPUT STRUCTURE (mirror this exactly — no preamble, no title, no text before the first heading):

# MEETING DETAILS

Date: <human date from request, or blank if unavailable>
Time: <human time from request, or blank if unavailable>
Location: <only include this line if source summaries explicitly contain a location>

# EXECUTIVE SUMMARY

<one concise paragraph in sentence case, 2-4 sentences>

# ATTENDEES

<bullet list of attendees, one per line, only include this section if attendee details are present in the source summaries>

# DISCUSSION SUMMARY

**Meeting Purpose:** <one sentence describing the overall purpose>

Key Points

1. **<Topic Heading>**

<one paragraph in sentence case describing this topic, 2-4 sentences>

2. **<Topic Heading>**

<one paragraph in sentence case>

<continue numbered topics — each with a blank line before and after>

# DECISIONS REGISTER

NOTED — <decision text in sentence case>
AGREED — <decision text in sentence case>
RESOLVED — <decision text in sentence case>

(Each decision is a single plain line. NO bullet marker, NO bold, NO markdown emphasis, NO colon after the label. Use exactly one em-dash between the LABEL and the decision text. Never write "**AGREED**", "AGREED:", or "- **[AGREED]**".)

# OPEN ITEMS & RISKS

- <plain bullet describing risk or open item, in sentence case, no bold prefix, no Status tag>
- <plain bullet>

# ACTION ITEMS

| Action | Owner | Deadline |
| --- | --- | --- |
| <action description> | <name or TBC> | <date or TBC> |

(use exactly these three column headers in this order — never "Responsible Party", "Due date", "By when", or "Priority". Priority is intentionally omitted because automated priority assignment was found to be unreliable.)

# NEXT MEETING

<date and time if known, or "To be determined">
<bullet list of confirmed agenda items if any>

MERGING INSTRUCTIONS:
- ATTENDEES — REQUIRED EXTRACTION: Read every chunk summary and extract ANY person referenced: by name, by role ("Chair", "ICB lead", "GP partner"), or by descriptor ("the funder representative"). Compile these into the # ATTENDEES section as a bullet list, even if no chunk has an explicit "Attendees:" label. The phrase "Attendee details were not provided" is FORBIDDEN — never emit it. If absolutely no people are mentioned in any chunk, omit the # ATTENDEES section entirely rather than emitting a placeholder.
- CONTENT PRESERVATION (critical — failure here makes minutes worthless):
  • Each chunk represents a different portion of the meeting. EVERY substantive agenda item / topic discussed in ANY chunk MUST appear as its own numbered key point in the Discussion Summary. Do NOT collapse, summarise-down, or drop topics to keep the list short.
  • If chunk summaries reference 7 distinct agenda items (e.g. finance, workforce, QOF, digital rollout, estates, governance, patient survey), the Discussion Summary must contain 7 numbered key points — one per topic — even if that means a longer document.
  • Phrases like "two further positive variances not fully captured", "additional items were discussed", or "other matters were noted" are FORBIDDEN. If a chunk mentions a topic, name it and summarise it. Never emit a placeholder that hides content.
  • EVERY decision (RESOLVED / AGREED / NOTED) appearing in ANY chunk MUST appear in the Decisions Register verbatim. Do not deduplicate decisions on different topics. Do not pick "the most important" — list them all.
  • EVERY action item (with owner) appearing in ANY chunk MUST appear as a row in the Action Items table. Do not summarise actions away.
- Deduplicate ONLY where two chunks describe the SAME event/decision/action (e.g. an item discussed across the chunk boundary). Resolve contradictions in favour of the more specific or later mention.
- Preserve all unique names, numbers, dates, and decisions verbatim.
- If a chunk arrived as an "[unsummarised excerpt …]" placeholder, integrate its substantive content where possible and silently drop the placeholder marker.
- Output is markdown only. No preambles, no closing remarks, no metadata.

SELF-VERIFICATION (apply before returning your response):
1. Scan every paragraph. If any paragraph contains more than 5 consecutive words in ALL CAPS that are not proper nouns or abbreviations, rewrite that paragraph in sentence case.
2. Scan for any occurrence of "****" (four or more consecutive asterisks). If found, fix the malformed bold markers around it.
3. Confirm every "# " heading is on its own line with a blank line before and after.
4. Confirm "**Meeting Purpose:**" appears as the first line under "# DISCUSSION SUMMARY".
5. Confirm every numbered key point (1., 2., etc.) is on its own line.
6. Confirm the action items section is a markdown pipe table with exactly the three columns Action | Owner | Deadline in that order. Do NOT add a Priority column.
7. COVERAGE CHECK: count distinct topics mentioned across all input chunks. The Discussion Summary numbered key points must equal or exceed that count. If short, regenerate adding the missing topics.
8. COVERAGE CHECK: count distinct decisions (RESOLVED / AGREED / NOTED items) across all input chunks. The Decisions Register must contain at least that many entries. If short, regenerate adding the missing decisions.
9. Search your draft for forbidden hedging phrases ("not fully captured", "additional items", "further variances not", "other matters"). If any are present, replace them by writing out the actual content from the chunks.
10. If any check fails, regenerate that section before returning.`;

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

function normaliseMergeOutput(content: string): string {
  console.log('[normaliseMergeOutput] Running on content of length:', content?.length || 0);
  if (!content) return content;
  let out = content;

  // 1. (Rule F) Aggressive stray-asterisk stripper. Run twice — once at the
  // top to clean LLM input, once at the bottom to clean any new stray
  // asterisks introduced by heading-conversion or paragraph-splitting rules.
  const stripStrayAsterisks = (text: string): string => {
    let s = text;
    // Bold-close immediately followed by bold-open (no whitespace)
    s = s.replace(/\*{2}\*{2}/g, '');
    // Bold-close, whitespace, bold-open
    s = s.replace(/\*{2}\s+\*{2}/g, ' ');
    // 3+ consecutive asterisks anywhere
    s = s.replace(/\*{3,}/g, '');
    // Empty bold pairs "** **" or "****"
    s = s.replace(/\*{2}\s*\*{2}/g, '');
    return s;
  };
  out = stripStrayAsterisks(out);

  const KNOWN_SECTIONS = [
    'MEETING DETAILS',
    'EXECUTIVE SUMMARY',
    'ATTENDEES',
    'DISCUSSION SUMMARY',
    'DECISIONS REGISTER',
    'OPEN ITEMS & RISKS',
    'OPEN ITEMS AND RISKS',
    'ACTION ITEMS',
    'NEXT MEETING',
  ];

  const SECTION_NAMES_REGEX_GROUP = '(?:MEETING DETAILS|EXECUTIVE SUMMARY|ATTENDEES|DISCUSSION SUMMARY|DECISIONS REGISTER|OPEN ITEMS\\s*(?:&|AND)\\s*RISKS|ACTION ITEMS|NEXT MEETING)';

  // 1b (NEW Rule A). Unwrap "**SECTION_NAME [substantial content...]**" — bold-wrapped
  // block where the bold opens with a known section name and contains far more than
  // just the heading. Split into "# SECTION_NAME\n\n[rest]" and strip the bold wrapper.
  const wrappedSectionRe = new RegExp(
    `\\*{1,2}\\s*(${SECTION_NAMES_REGEX_GROUP})\\s+([\\s\\S]+?)\\*{1,2}`,
    'gi'
  );
  out = out.replace(wrappedSectionRe, (_match, section, body) => {
    const cleanSection = section.replace(/\s+/g, ' ').trim().toUpperCase();
    return `\n\n# ${cleanSection}\n\n${body.trim()}\n\n`;
  });

  // 2. Convert "**SECTION**" lines to "# SECTION"
  for (const section of KNOWN_SECTIONS) {
    const escaped = section.replace(/[&]/g, '\\$&');
    const re = new RegExp(`^\\*{1,2}\\s*${escaped}\\s*\\*{1,2}\\s*$`, 'gim');
    out = out.replace(re, `# ${section}`);
  }

  // 3. Split heading + dash/colon + remainder on same line
  for (const section of KNOWN_SECTIONS) {
    const escaped = section.replace(/[&]/g, '\\$&');
    const re = new RegExp(
      `^(#{1,6}\\s*|\\*{1,2}\\s*)${escaped}(\\*{1,2}\\s*)?\\s*[-:—–]\\s+(.+)$`,
      'gim'
    );
    out = out.replace(re, `# ${section}\n\n$3`);
  }

  // 4. Force paragraph break before inline "# KNOWN_SECTION"
  for (const section of KNOWN_SECTIONS) {
    const escaped = section.replace(/[&]/g, '\\$&');
    const re = new RegExp(`(\\S)\\s+#\\s+${escaped}\\b`, 'g');
    out = out.replace(re, `$1\n\n# ${section}`);
  }

  // 5. (NEW Rule B) Convert all-caps prose paragraphs to sentence case — paragraph-level.
  const ACRONYM_WHITELIST = new Set([
    'NHS', 'ICB', 'GP', 'GPS', 'OPIT', 'OPIP', 'KGH', 'NHFT', 'UHN', 'UHL',
    'TBC', 'TDA', 'EDI', 'CMO', 'PCN', 'ARD', 'COPD', 'NARP', 'CYPMHND',
    'BST', 'GMT', 'WNC', 'LMS', 'QOF', 'CQC', 'UEC', 'LES', 'VAC-IMS',
    'BESOL', 'WORKWELL', 'INNOVATE',
    'RESOLVED', 'AGREED', 'NOTED',
    'AND', 'OR', 'OF', 'TO', 'THE', 'A', 'AN', 'IN', 'ON', 'AT', 'IS', 'AS',
    'BY', 'BE', 'IT', 'WAS', 'WERE', 'HAS', 'HAVE', 'WILL', 'FOR', 'WITH',
    'I', 'II', 'III', 'IV', 'V',
  ]);

  const lowercaseAllCapsParagraph = (text: string): string => {
    if (/^\s*#/.test(text) || /^\s*\|/.test(text)) return text;
    const alphaWords = text.split(/\s+/).filter(w => /[a-zA-Z]/.test(w));
    if (alphaWords.length < 8) return text;
    const upperCount = alphaWords.filter(w => {
      const clean = w.replace(/[^a-zA-Z]/g, '');
      return clean.length > 0 && clean === clean.toUpperCase();
    }).length;
    if (upperCount / alphaWords.length < 0.7) return text;

    let lowered = text.toLowerCase();
    for (const acronym of ACRONYM_WHITELIST) {
      const re = new RegExp(`\\b${acronym.toLowerCase()}\\b`, 'g');
      lowered = lowered.replace(re, acronym);
    }
    lowered = lowered.replace(/^(\s*)([a-z])/, (_m, prefix, letter) => prefix + letter.toUpperCase());
    lowered = lowered.replace(/([.?!]\s+)([a-z])/g, (_m, prefix, letter) => prefix + letter.toUpperCase());
    lowered = lowered.replace(/(\b\d+\.\s+)([a-z])/g, (_m, prefix, letter) => prefix + letter.toUpperCase());
    return lowered;
  };

  out = out.split(/\n\n+/).map(lowercaseAllCapsParagraph).join('\n\n');

  // 5a. (NEW Rule D) Force a paragraph break before "Key Points" when mid-text
  out = out.replace(/(\S)\s+(Key Points)\s+/g, '$1\n\n$2\n\n');

  // Insert paragraph breaks before numbered list items (1. through 99.)
  // when they appear mid-paragraph rather than at the start of a line.
  // We break unconditionally if the numbered item is followed by a capital
  // letter and a sequence of letters (heading-like), since this strongly
  // indicates a topic label rather than a date or arbitrary number.
  out = out.replace(
    /([^\n])\s+(\d{1,2}\.\s+\*{0,2}[A-Z][a-zA-Z]{2,})/g,
    '$1\n\n$2'
  );

  // 5b. (NEW Rule C) Split "# SECTION_NAME - content" / ":" / "—" / "–" / "|" same-line patterns.
  const sectionWithTrailingContent = new RegExp(
    `^(#\\s+${SECTION_NAMES_REGEX_GROUP})\\s*[-:—–|]\\s*(.+)$`,
    'gim'
  );
  out = out.replace(sectionWithTrailingContent, (_match, heading, body) => {
    return `${heading}\n\n${body.trim()}`;
  });

  // 5c. (NEW Rule E) Specific catch for "# NEXT MEETING\n\nTo be determined - <content>"
  out = out.replace(
    /(#\s+NEXT\s+MEETING\s*\n+\s*To be determined)\s*[-:—–]\s*(.+)/gi,
    '$1\n\n$2'
  );

  // 6. Ensure each known section heading has blank line before and after
  for (const section of KNOWN_SECTIONS) {
    const escaped = section.replace(/[&]/g, '\\$&');
    const re = new RegExp(`(?:\\n)?\\n?(#\\s+${escaped})\\s*\\n?(?:\\n)?`, 'g');
    out = out.replace(re, `\n\n$1\n\n`);
  }

  // Final asterisk sweep — catch any stray markers introduced by the
  // heading-conversion or paragraph-splitting rules above.
  out = stripStrayAsterisks(out);

  // 7. Collapse 3+ consecutive newlines to exactly 2
  out = out.replace(/\n{3,}/g, '\n\n');

  // FINAL PASS — split numbered list items that are still running inline.
  // This runs after all other rules and uses the simplest possible regex:
  // any sequence of "[period or other sentence-ender][space(s)][1-2 digits][period][space]"
  // gets a paragraph break inserted before the digits.
  let splitCount = 0;
  out = out.replace(
    /([.!?\)\]\"])(\s+)(\d{1,2}\.\s+)/g,
    (_match, ender, _space, numberAndDot) => {
      splitCount++;
      return `${ender}\n\n${numberAndDot}`;
    }
  );
  console.log(`[normaliseMergeOutput] Final-pass numbered-item split inserted ${splitCount} paragraph breaks`);

  // Also handle the case where a numbered item follows a closing bold marker
  // (e.g. "...programme** 3. **Next heading**") which the above regex misses
  // because ** is not in the sentence-ender character class.
  let boldSplitCount = 0;
  out = out.replace(
    /(\*\*)(\s+)(\d{1,2}\.\s+)/g,
    (_match, ender, _space, numberAndDot) => {
      boldSplitCount++;
      return `${ender}\n\n${numberAndDot}`;
    }
  );
  console.log(`[normaliseMergeOutput] Final-pass post-bold split inserted ${boldSplitCount} paragraph breaks`);

  // FINAL PASS — fix malformed action items table.
  // The LLM sometimes emits the column header as plain text (no leading "|"),
  // then bolds the first action row, then puts the separator after that row.
  // Reconstruct the table into proper markdown form: |Header|\n|---|\n|row|\n|row|...
  out = out.replace(
    /(#\s+ACTION\s+ITEMS\s*\n+)([\s\S]+?)(?=\n#\s+|\n*$)/i,
    (_match, heading, body) => {
      const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      // Find a malformed header line — content matching "Action | Owner | Deadline"
      // without a leading "|", possibly with a trailing "|"
      const headerLineIdx = lines.findIndex(l =>
        /^Action\s*\|\s*Owner\s*\|\s*Deadline\s*\|?\s*$/i.test(l)
      );

      // Find data rows — lines that start with "|" and aren't separator rows
      const dataRows = lines.filter(l =>
        l.startsWith('|') && !/^\|[-:\s|]+\|?\s*$/.test(l)
      );

      // If no malformed pattern found, return body unchanged
      if (headerLineIdx === -1 || dataRows.length === 0) {
        return `${heading}${body}`;
      }

      // Strip ** markers from cell contents in the first row (which got incorrectly bolded)
      // and from any other rows
      const cleanedRows = dataRows.map(row => {
        // Split on |, strip ** from each cell, rejoin
        const cells = row.split('|').map(c => c.replace(/\*\*/g, '').trim());
        // Reconstruct with leading and trailing |
        const nonEmptyCells = cells.filter((c, i) => i > 0 && i < cells.length - 1);
        return `| ${nonEmptyCells.join(' | ')} |`;
      });

      // Reconstruct the table properly
      const rebuilt = [
        '| Action | Owner | Deadline |',
        '| --- | --- | --- |',
        ...cleanedRows
      ].join('\n');

      console.log(`[normaliseMergeOutput] Action items table reconstructed: ${cleanedRows.length} rows`);
      return `${heading}${rebuilt}\n`;
    }
  );

  // Final newline-collapse so the new breaks don't double up
  out = out.replace(/\n{3,}/g, '\n\n');

  // FINAL PASS — ensure blank line between consecutive bullets in Discussion Summary.
  // Sonnet emits Key Points bullets as "- bullet1\n- bullet2\n- bullet3" with no
  // blank line between them, which renders as a tight list with no visual gap.
  // Insert a blank line between consecutive bullet items so they get readable spacing.
  // We only do this within the DISCUSSION SUMMARY section to avoid affecting other lists.
  let spacingCount = 0;
  out = out.replace(
    /(# DISCUSSION SUMMARY[\s\S]*?)(?=# DECISIONS REGISTER|# OPEN ITEMS|$)/i,
    (discussionSection) => {
      return discussionSection.replace(
        /(\n-\s+[^\n]+)\n(-\s+)/g,
        (_match, firstBullet, nextBulletStart) => {
          spacingCount++;
          return `${firstBullet}\n\n${nextBulletStart}`;
        }
      );
    }
  );
  console.log(`[normaliseMergeOutput] Discussion Summary bullet spacing inserted ${spacingCount} blank lines`);

  return out.trim();
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

    const { summaries, meetingTitle, meetingDate, meetingTime, detailLevel = 'standard', modelOverride } = await req.json();
    const modelToUse = modelOverride || 'claude-sonnet-4-6';
    const isOpus47 = typeof modelToUse === 'string' && modelToUse.startsWith('claude-opus-4-7');

    if (!Array.isArray(summaries) || summaries.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing summaries[]' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const joined = summaries.map((s, i) => `--- Chunk ${i + 1} ---\n${s}`).join("\n\n");

    // Date guard — prepended so it appears BEFORE the system prompt's structural rules.
    // Prevents year-hallucination when transcript uses bare/relative dates ("1st May").
    const meetingYearMatch = (meetingDate || '').match(/\b(20\d{2})\b/);
    const meetingYear = meetingYearMatch ? meetingYearMatch[1] : '';
    const dateGuard = meetingYear
      ? `═══ CRITICAL DATE HANDLING — APPLY THROUGHOUT ═══
Meeting date: ${meetingDate} (year = ${meetingYear}).
Resolve all relative or bare dates (e.g. "1st May", "next month", "Friday") against this
meeting date, NOT against your training cutoff. NEVER write a year earlier than ${meetingYear}
unless the source EXPLICITLY uses that earlier year. When a date is mentioned without a year,
assume ${meetingYear}.
═══════════════════════════════════════════════════
\n\n`
      : '';

    const userPrompt = `${dateGuard}Meeting: ${meetingTitle || 'Meeting'}
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
          model: modelToUse,
          max_tokens: 12000,
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
    meetingMinutes = normaliseMergeOutput(meetingMinutes);

    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;

    return new Response(JSON.stringify({
      meetingMinutes,
      model: modelToUse,
      chunksMerged: summaries.length,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens, model: modelToUse },
    }), {
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
