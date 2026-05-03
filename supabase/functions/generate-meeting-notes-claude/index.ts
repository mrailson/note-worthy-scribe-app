console.log('FUNCTION ENTRY: generate-meeting-notes-claude invoked at', new Date().toISOString());
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

// --- Domain dictionary ASR correction ---
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface DictEntry { wrong_term: string; correct_term: string; }

async function loadDomainDictionary(): Promise<DictEntry[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return [];
  const sb = createClient(supabaseUrl, serviceKey);
  const { data, error } = await sb.from('domain_dictionary').select('wrong_term, correct_term');
  if (error) { console.warn('⚠️ Could not load domain dictionary:', error.message); return []; }
  return (data ?? []) as DictEntry[];
}

function applyDomainCorrections(text: string, entries: DictEntry[]): { text: string; count: number } {
  if (!text || entries.length === 0) return { text, count: 0 };
  let result = text;
  let count = 0;
  const sorted = [...entries].sort((a, b) => b.wrong_term.length - a.wrong_term.length);
  for (const e of sorted) {
    const re = new RegExp(`\\b${escapeRe(e.wrong_term)}\\b`, 'gi');
    const before = result;
    result = result.replace(re, e.correct_term);
    if (result !== before) count++;
  }
  return { text: result, count };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─── QC Auditor System Prompt (shared by main flow and qcOnly mode) ───
const QC_SYSTEM_PROMPT = `You are a meeting notes quality auditor for an NHS governance platform. You receive a source transcript and AI-generated meeting notes. Your job is to check for specific categories of error by comparing the notes against the transcript.

Check each category and return your findings as JSON.

CATEGORIES:

1. FABRICATED_DECISIONS
Check the decisions register. For every item marked RESOLVED, verify that the transcript contains explicit voting language (moved AND seconded AND carried/aye/unanimous) — if not, it should be downgraded to AGREED or NOTED. For every item marked AGREED, verify that the transcript shows a positive signal — someone stating a conclusion AND others explicitly endorsing it or the chair confirming the position without objection. For every item marked NOTED, verify the information was actually presented in the transcript. Flag any decision that cannot be traced to specific transcript content. Flag any item categorised as RESOLVED or AGREED that should be NOTED. Flag any label other than RESOLVED, AGREED, or NOTED (e.g. ACCEPTED, APPROVED, DECIDED, CONFIRMED).

2. FABRICATED_ACTIONS
Check each action item. Verify that every action is traceable to something actually said in the transcript. Flag any action where the task, owner, or deadline does not appear in the source. Flag actions that convert conditional statements (e.g. "if we identify a need to do so") into unconditional commitments. Flag any action with a named owner where the transcript does not explicitly assign that person.

3. MISSING_SPEAKERS
Check whether speakers who are named in the transcript have been anonymised to "a member", "members", or "it was noted" in the notes. If a person is named in the transcript and their specific contribution appears in the notes, they should be named in the notes. List each instance where attribution was lost.

4. CURRENCY_DETECTION
If the transcript references New Zealand-specific entities (New Zealand, Waipa, Waikato, RMA, Te Waka, NZ alert levels, council/district council in NZ context), monetary values should use $ or NZD. If the transcript references NHS, PCN, ICB, or UK-specific entities, monetary values should use £ or GBP. Flag any currency mismatch between the detected context and the values used in the notes.

5. ATTENDEE_GAPS
Compare speaker names that appear in the transcript against the attendee list in the notes. Flag any person who speaks or is directly addressed by name in the transcript but is not listed as an attendee. Do not flag people who are merely referenced or mentioned in passing without being present.

6. PROMPT_LEAK
Check for any text in the notes that appears to be internal system instructions, template markers, or formatting directives. Examples include: "FORMAT NOTE", "NOTE TYPE", "Do NOT use", "Follow the NOTE TYPE format", "SKILL.md", or any text that reads as instructions to an AI rather than meeting content. Flag if found.

7. TONE_ESCALATION
Identify up to 3 instances where the notes use significantly more formal or corporate language than what was actually said in the transcript. For each instance, provide the approximate transcript wording and the notes wording side by side so the difference is clear.

Respond ONLY with a valid JSON object. No markdown backticks, no preamble, no explanation outside the JSON:

{
  "overall": "pass" or "fail",
  "score": <number 0-100>,
  "failed_count": <number of categories that failed>,
  "categories": {
    "fabricated_decisions": {"status": "pass" or "fail", "findings": "..."},
    "fabricated_actions": {"status": "pass" or "fail", "findings": "..."},
    "missing_speakers": {"status": "pass" or "fail", "findings": "..."},
    "currency_detection": {"status": "pass" or "fail", "findings": "..."},
    "attendee_gaps": {"status": "pass" or "fail", "findings": "..."},
    "prompt_leak": {"status": "pass" or "fail", "findings": "..."},
    "tone_escalation": {"status": "pass" or "fail", "findings": "..."}
  },
  "summary": "One sentence overall assessment"
}

Set overall to "fail" if ANY category fails. But calibrate your score to reflect actual severity, not the count of failed categories.

SCORING RULES:

Your score should reflect the overall quality of the notes as a governance record. Use this framework:

90-100: Minor issues only (e.g. one speaker referred to by title instead of name, slight tone formalisation). The notes are governance-ready.
75-89: Notable issues that a reviewer should check but the notes are usable (e.g. one currency error, one action with unclear ownership, attendee list missing 1-2 people).
50-74: Significant issues that require correction before filing (e.g. fabricated decisions, multiple wrong attributions, attendee list completely empty).
Below 50: Critical failures — fabricated content, systematic errors, or notes that misrepresent what happened.

IMPORTANT CALIBRATION RULES:
- Do NOT penalise the same root cause across multiple categories. If the attendee list is TBC because the transcript has no speaker labels, that is ONE problem (Attendee Completeness), not four problems (also failing Speaker Attribution, Action Traceability, and Decision Accuracy). Score it as a data quality limitation, not a cascade of failures.
- Do NOT fail Decision Accuracy if decisions are correctly categorised. If you confirm RESOLVED items have voting language and NOTED items are information received, that is a PASS even if you have minor observations about clarity.
- Do NOT fail Currency Detection if the notes are internally consistent in the correct currency. Only fail if the wrong currency is used (e.g. £ in a NZ context) or if the same value appears in two different currencies within the notes.
- Tone fidelity: meeting notes are EXPECTED to be more formal than speech. Only fail if the notes materially misrepresent what was said or add meaning that wasn't present. Converting informal speech to professional minutes language is correct behaviour, not a failure.
- Speaker Attribution: if speakers are named in the attendee list AND named in the decisions register, do not fail just because the discussion summary uses "the Chair" instead of the name. Using titles in the body text is standard minutes practice.

Before setting your score, ask yourself: "Would a professional minute-taker consider these notes acceptable for filing?" If yes, your score should be 75+. If they'd file them with minor corrections, score 80-90. If they'd file them as-is, score 90+.`;

// ─── Notewell AI Governance-Grade System Prompt ───────────────────────────
const NON_MEETING_REFUSAL_BLOCK = `BEFORE generating any meeting notes, evaluate whether the transcript actually represents a meeting. A meeting transcript should contain: multiple speakers OR a single speaker presenting structured information, discussion of topics with some substance, and content that lasts long enough to have meaningful structure. If the transcript instead appears to be: entertainment content (game shows, music, interviews, podcasts), casual conversation without business purpose, a test recording, background noise, or content too short to contain meaningful discussion (under roughly 300 words of substantive content), you MUST NOT generate meeting notes. Instead, respond with EXACTLY this JSON object and nothing else:

{ "is_meeting": false, "detected_content_type": "<your best guess: 'entertainment', 'casual_conversation', 'test_recording', 'too_short', 'unclear'>", "explanation": "<one sentence explaining what the content appears to be>" }

Do NOT invent a meeting title, attendees, decisions, or action items if the transcript does not support them. Hallucinating a meeting from non-meeting content is a critical failure. When in doubt, return is_meeting: false and let a human review.

`;

const NOTEWELL_SYSTEM_PROMPT = NON_MEETING_REFUSAL_BLOCK + `You are Notewell AI, an MHRA Class I registered medical device for NHS primary care. You generate governance-grade meeting minutes from transcribed audio recordings of NHS meetings.

## YOUR TASK

You will receive a meeting transcript. Produce structured, comprehensive meeting minutes in the format specified below. The transcript may be noisy, repetitive, fragmented, or contain crosstalk — this is normal for real meetings. Your job is to extract every substantive topic, decision, figure, risk, and action from the chaos.

## CRITICAL RULES

### Accuracy is non-negotiable
- ONLY use information that appears in the transcript. Never invent, estimate, or round figures.
- If a specific number is stated (e.g., "5,188 appointments", "£305,000", "130 per thousand"), reproduce it exactly.
- If a name is mentioned, use it. If a name is unclear, write [Name — unclear from recording].
- If something is discussed but the detail is ambiguous, say what was discussed and note the ambiguity. Do not fill gaps with plausible-sounding fabrications.
- Never generate statistics, benchmarks, targets, or financial figures that are not explicitly spoken in the transcript.

### Exhaustive topic extraction
- A typical NHS operational meeting covers 15–40 distinct topics. You must capture ALL of them, not just the 5–8 biggest themes.
- Scan the entire transcript before writing. Topics discussed briefly or in passing still need to be recorded if they involve a decision, action, risk, figure, or named individual.
- Pay special attention to:
  - Financial figures: budgets, rates, caps, on-costs, percentages, claim values, overhead allocations
  - Staffing detail: names, roles, session counts, start dates, contract types (locum/permanent/fixed-term), daily rates
  - Governance and political context: who said what about whom, power dynamics between organisations (e.g., practice vs SNO/PML vs ICB), public statements later contradicted, strategic positioning
  - Compliance matters: IR35, CEST, redundancy liability, employment law, data sharing, recording consent
  - Risks expressed as concerns: "my biggest worry is...", "what happens if...", "the problem is..."
  - Technical/operational detail: system names (GPAD, TPP, System Connect, Surgery Connect, Power BI), data quality issues, reporting limitations, workarounds being developed
  - Estates/facilities: room availability, equipment, phone systems, access permissions
  - Forward references: "on Tuesday", "by June", "in three months" — these often indicate deadlines or dependencies

### Capture nuance and reasoning
- When someone explains WHY a decision was made or WHY a policy exists, include the reasoning — not just the decision.
- When concerns are raised about another organisation's behaviour, capture the substance factually.
- When a workaround or creative solution is described, capture both the problem and the solution.

### Do not sanitise the meeting
- NHS meetings involve frank, sometimes blunt discussion about organisational politics, staffing concerns, and financial pressures. The minutes should reflect what was discussed, not a diplomatically smoothed version.
- If attendees expressed frustration, concern, or disagreement, the minutes should note this (e.g., "Concerns were expressed regarding...", "Members noted tension between...").
- If recruitment occurred without proper consultation, or if an organisation's behaviour was questioned, this should appear in the minutes as a governance matter.

## TONE AND STYLE

- Write in formal third person ("The group discussed...", "It was noted that...", "Members agreed...")
- Use NHS terminology correctly (GPAD, DPC, SDA, LTC, GMS, LES, SNO, PCN, ICB, BMA)
- Use British English throughout, with British date format (e.g., 22nd March 2026) and 24-hour time.
- Be precise with financial language (on-costs, maximum reclaimable, buyback, overhead allocation)
- Do not use hedging language unless the transcript itself was hedging — if someone said "we will do X", write "It was confirmed that X would be done"
- Keep paragraphs tight — 3–5 sentences per topic section. Density over length.

## WHAT NOT TO DO

- Do not summarise the transcript — extract structured intelligence from it
- Do not group multiple topics into one vague section like "General Discussion"
- Do not omit a topic because it was discussed briefly
- Do not omit a topic because it involves organisational politics
- Do not invent attendee names if they are not clearly identifiable
- Do not generate placeholder text or template content (no [Insert X])
- Do not add commentary or recommendations — report what was said
- Do not include a "Meeting Transcript for Reference" section`;

// ─── Build the user prompt with meeting context and output format ──────
function buildUserPrompt(params: {
  transcript: string;
  meetingTitle: string;
  meetingDate: string;
  meetingTime: string;
  meetingDuration?: string;
  speakerCount?: number;
  organisationName?: string;
  meetingType?: string;
  practiceContext?: string;
  expectedAttendees?: string[];
  lengthInstruction?: string;
  sectionInstruction?: string;
}): string {
  const contextLines = [
    `- Organisation: ${params.organisationName || 'Not specified'}`,
    `- Meeting type: ${params.meetingType || 'General Meeting'}`,
    `- Recording date: ${params.meetingDate}`,
    params.meetingDuration ? `- Recording duration: ${params.meetingDuration}` : null,
    params.speakerCount ? `- Number of speakers detected: ${params.speakerCount}` : null,
    params.practiceContext ? `- Practice/PCN context: ${params.practiceContext}` : null,
  ].filter(Boolean).join('\n');

  // Build expected attendees section if provided
  let attendeesSection = '';
  if (params.expectedAttendees && params.expectedAttendees.length > 0) {
    const attendeeList = params.expectedAttendees.map(a => `- ${a}`).join('\n');
    attendeesSection = `\n\n## EXPECTED ATTENDEES (provided before the meeting)\n\nThe following people are expected to be in this meeting:\n${attendeeList}\n\nWhere the transcript uses speaker labels (e.g. [Speaker 1], [Speaker 2], [Speaker A], [Speaker B]), use context clues to map speakers to these names. For example, if a speaker discusses topics related to their known role, map them accordingly. List all identified speakers in the Attendees section. If a speaker cannot be confidently mapped to a name, list them as "Unidentified Speaker (N)". Never leave the attendee list as TBC if speaker labels are present in the transcript.`;
  }

  return `## MEETING CONTEXT (auto-populated by Notewell)

${contextLines}
${attendeesSection}
## OUTPUT FORMAT

Use the following structure. Every section is mandatory. If a section has no content, write "None identified" — do not omit the section.

---

**MEETING DETAILS**

| Field | Value |
|-------|-------|
| Date | ${params.meetingDate || '[Extract from transcript]'} |
| Time | ${params.meetingTime || 'Not recorded'} |
| Location | [Extract from transcript or "Location not specified"] |

**ATTENDEES**

- [Name] ([Role/Organisation]) — for each person identifiable from the transcript
- If names are unclear, use [Attendee — role if identifiable]

**DISCUSSION SUMMARY**

> **Meeting Purpose:** [One sentence summarising the overall purpose]

Then produce numbered sections for EVERY distinct topic cluster discussed. Aim for 8–15 sections in a typical meeting.

FORMAT EACH SECTION EXACTLY AS:

### N. Topic heading on its own line

Body paragraph starts here after a blank line. Body text MUST NEVER appear on the same line as the heading. Use a markdown ### heading.

Each section should:
- Have a clear descriptive heading on its own line, with no body text on that line
- Start the body paragraph on a new line after a blank line
- Include ALL specific figures, names, dates, session counts, and rates mentioned
- Include the reasoning behind decisions where stated
- Note who raised points where identifiable
- Note any disagreement, concern, or unresolved tension

Topic clusters to watch for (not exhaustive):
- Data/reporting and baselining
- Triage and uncaptured activity
- Long-term condition data and external system limitations
- Workforce: each staff member should get specific detail (name, role, sessions, start date, rate, contract type)
- Budget and resource mix options
- Estates and room capacity
- Financial claims process (buyback mechanism, Part A/Part B, evidence requirements)
- Redundancy and employment liability
- Funding model (LES vs GMS, Part B sensitivity)
- IR35/CEST compliance
- Contract terms and scope of duties
- Organisational governance (SNO/PML relationship, management fees, overhead allocation)
- Neighbourhood incorporation or structural change
- Cash flow and unspent funds
- Sustainability and pilot cliff-edge risk
- Recruitment governance (who authorises, who recruits, consultation requirements)
- Clinical safety and results monitoring (hub doctor, dashboards)
- Induction and onboarding
- Patient-facing innovation (ICB expectations, hard-to-reach patients)

**DECISIONS REGISTER**

DECISIONS REGISTER RULES (apply these exactly):

1. **RESOLVED** — Use ONLY when the transcript contains explicit voting language:
   - "moved" AND "seconded" AND ("carried" OR "aye" OR "agreed" OR "unanimous")
   - Always name the mover and seconder: "(Moved by [name], seconded by [name]; carried)"
   - If you cannot identify who moved or seconded, write "(moved and seconded; carried)"
   - If there is no voting language, do NOT use RESOLVED — use AGREED or NOTED instead

2. **AGREED** — Use when there is a clear positive consensus WITHOUT a formal vote:
   - Someone proposes something AND others explicitly endorse it ("yes", "agreed", "happy with that", "let's do that")
   - The Chair confirms a course of action and no one objects
   - Do NOT use AGREED for information that was merely presented or discussed

3. **NOTED** — Use for everything else:
   - Information was presented to the group
   - A topic was discussed but no position was taken
   - A report or update was received
   - If in doubt between AGREED and NOTED, use NOTED

These three categories are the ONLY permitted labels. Never use "ACCEPTED", "APPROVED", "DECIDED", "CONFIRMED" or any other label.

Every item in the decisions register MUST start with one of: "RESOLVED —", "AGREED —", or "NOTED —"

Format each entry as a single plain line — NO bullet marker, NO bold, NO markdown emphasis, NO colon after the label, exactly one em-dash:
\`LABEL — what was decided/noted (one line, specific, with rationale if stated)\`
Never write "**AGREED**", "AGREED:", "- **[AGREED]**", or wrap the label in brackets.
- If a decision was conditional (e.g., "subject to rate confirmation"), note the condition.

**OPEN ITEMS & RISKS**

- Each risk or unresolved item as a bullet point
- Distinguish between:
  - Operational risks (data quality, system limitations)
  - Financial risks (unspent funds, overhead transparency, redundancy exposure)
  - Compliance risks (IR35, retrospective liability, contract gaps)
  - Strategic risks (pilot sustainability, patient expectation management, organisational dependency)
  - Governance risks (recruitment without consultation, management fee opacity)
- If a risk was raised but no mitigation was identified, say so explicitly
- If a risk has retrospective implications (e.g., existing arrangements that may already be non-compliant), flag this

**NEXT MEETING**

[Date, time, and any agenda items referenced for that meeting]

**ACTION ITEMS**

| Action | Owner | Deadline | Priority |
|--------|-------|----------|----------|
| [Specific action] | [Named person or TBC] | [Date or TBC] | High/Medium/Low |

Extract EVERY action committed to in the transcript, including informal ones ("I'll do that by Tuesday", "Amanda, can you check..."). If no owner was named, write "TBC". If no deadline was stated, write "TBC". Use Priority "High" for urgent or time-critical items, "Medium" by default, "Low" for nice-to-have items.

Always emit the columns in this exact order: Action, Owner, Deadline, Priority. Never reorder them. Never rename "Owner" to "Responsible Party" or any other label.

---
${params.lengthInstruction || ''}
${params.sectionInstruction || ''}
## TRANSCRIPT

${params.transcript}`;
}

// ─── Post-processing ──────────────────────────────────────────────────────

function sanitizeMeetingMinutes(content: string): string {
  return content
    .replace(/\[Insert[^\]]*\]/gi, '')
    .replace(/Location:\s*\[Insert[^\]]*\]/gi, 'Location: Location not specified')
    .replace(/Attendees:\s*\[Insert[^\]]*\]/gi, 'Attendees: TBC')
    .replace(/Apologies:\s*\[Insert[^\]]*\]/gi, '')
    .replace(/Owner:\s*\[Insert[^\]]*\]/gi, 'Owner: TBC')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

function sanitiseActionOwners(notes: string, transcript: string): string {
  if (!notes || !transcript) return notes;
  
  let sanitisedCount = 0;
  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  const hasExplicitAssignment = (text: string, name: string): boolean => {
    if (!text || !name) return false;
    const escaped = escapeRegExp(name);
    const nameWord = `\\b${escaped}\\b`;
    const patterns = [
      new RegExp(`${nameWord}\\s+(?:to|will|must|is to|agreed to|shall)\\s+\\w+`, 'i'),
      new RegExp(`(?:owner|responsible|lead|assigned)\\s*[:\\-]\\s*${nameWord}`, 'i'),
      new RegExp(`${nameWord}.*(?:responsible|owner|lead)`, 'i'),
      new RegExp(`assign(?:ed)?\\s+to\\s+${nameWord}`, 'i')
    ];
    const firstName = name.split(/\s+/)[0];
    if (firstName && firstName !== name) {
      const firstNameWord = `\\b${escapeRegExp(firstName)}\\b`;
      const firstNamePatterns = [
        new RegExp(`${firstNameWord}\\s+(?:to|will|must|is to|agreed to|shall)\\s+\\w+`, 'i'),
        new RegExp(`(?:owner|responsible|lead|assigned)\\s*[:\\-]\\s*${firstNameWord}`, 'i'),
        new RegExp(`assign(?:ed)?\\s+to\\s+${firstNameWord}`, 'i')
      ];
      if (firstNamePatterns.some(p => p.test(text))) return true;
    }
    return patterns.some(p => p.test(text));
  };
  
  try {
    const actionHeaderMatch = notes.match(/(?:^|\n)(?:#{1,6}\s*|\d+\.\s*|\*\*\s*)ACTION (?:ITEMS|LOG)\b[\s\S]*/i);
    if (!actionHeaderMatch) return notes;
    
    const afterHeader = actionHeaderMatch[0];
    const headerIdx = notes.indexOf(afterHeader);
    const tableMatch = afterHeader.match(/\n\|.*\|\n\|[-:\s|]+\|\n([\s\S]*?)(?:\n(?:#{1,6}\s|\d+\.\s|\*\*|$))/);
    if (!tableMatch) return notes;
    
    const tableHeader = afterHeader.substring(0, tableMatch.index! + tableMatch[0].indexOf('\n', tableMatch[0].indexOf('\n') + 1));
    const headerCells = tableHeader.split('\n')[0].split('|').map(c => c.trim()).filter(Boolean);
    const ownerColumnIdx = headerCells.findIndex(h => /responsible|owner|lead|assignee/i.test(h));
    if (ownerColumnIdx === -1) return notes;
    
    const tableRows = tableMatch[1].split('\n').map(r => r.trim()).filter(r => r.startsWith('|') && r.length > 2);
    const rebuiltRows = tableRows.map(row => {
      const cells = row.split('|').map(c => c.trim());
      if (cells.length > ownerColumnIdx + 1) {
        const responsible = cells[ownerColumnIdx + 1];
        if (responsible && responsible.toUpperCase() !== 'TBC' && responsible.trim() !== '') {
          if (!hasExplicitAssignment(transcript, responsible)) {
            cells[ownerColumnIdx + 1] = 'TBC';
            sanitisedCount++;
          }
        }
      }
      return cells.join(' | ');
    });
    
    const beforeTable = notes.substring(0, headerIdx + (tableMatch.index || 0));
    const tableStart = afterHeader.substring(0, tableMatch.index! + tableMatch[0].indexOf(tableMatch[1]));
    const afterTable = afterHeader.substring((tableMatch.index || 0) + tableMatch[0].length);
    const reconstructed = beforeTable + tableStart + rebuiltRows.join('\n') + '\n' + afterTable;
    
    if (sanitisedCount > 0) {
      console.log(`✅ Sanitiser: set ${sanitisedCount} owner(s) to TBC`);
    }
    return reconstructed;
  } catch (error) {
    console.warn('⚠️ Error sanitising action owners:', error);
    return notes;
  }
}

// ─── Chunking for very large transcripts ──────────────────────────────────

function shouldChunk(transcript: string): boolean {
  // Very long meetings (roughly >90 minutes / >10k words) are too slow and
  // unreliable as a single model call. Route them through map/reduce earlier
  // so notes save before the edge function reaches its wall-clock limit.
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
  return transcript.length > 50000 || wordCount > 10000;
}

function chunkTranscript(transcript: string): string[] {
  const words = transcript.split(/\s+/).filter(Boolean);
  const chunkSize = 4500;
  const overlap = 300;
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return chunks;
}

async function callGemini(systemPrompt: string, userPrompt: string, maxTokens = 8192): Promise<string> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: maxTokens,
      temperature: 0.15,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    if (response.status === 402) throw new Error('Insufficient Lovable AI credits. Please contact support.');
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`AI service error: ${errorData.error?.message || response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callClaude(model: string, systemPrompt: string, userPrompt: string, maxTokens = 8192): Promise<string> {
  if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      temperature: 0.15,
      messages: [{ role: 'user', content: userPrompt }]
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Claude API error:', response.status, errText);
    throw new Error(`Anthropic API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.content
    .filter((block: any) => block.type === 'text')
    .map((block: any) => block.text)
    .join('\n');
}

// ─── Main handler ─────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const functionStartTime = Date.now();
  console.log('🚀 Function invoked at:', new Date().toISOString());

  try {
    const {
      transcript,
      meetingTitle,
      meetingDate,
      meetingTime,
      detailLevel,
      customPrompt,
      modelOverride,
      meetingDuration,
      speakerCount,
      organisationName,
      meetingType,
      practiceContext,
      meetingId: reqMeetingId,
      qcOnly,
      existingNotes,
      expectedAttendees: reqExpectedAttendees,
      skipQc = false,
      forceGenerate = false,
    } = await req.json();

    // ── QC-only mode: skip note generation, just run QC ──────────────
    if (qcOnly && existingNotes && transcript) {
      console.log('🔍 QC-only mode — running audit on existing notes');
      let qcResult: any = null;
      try {
        if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY not configured');

        const qcController = new AbortController();
        const qcTimeout = setTimeout(() => qcController.abort(), 30000);

        const qcResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2000,
            system: QC_SYSTEM_PROMPT,
            temperature: 0.1,
            messages: [{ role: 'user', content: `SOURCE TRANSCRIPT:\n${transcript}\n\nGENERATED MEETING NOTES:\n${existingNotes}` }],
          }),
          signal: qcController.signal,
        });
        clearTimeout(qcTimeout);

        if (!qcResponse.ok) throw new Error(`Anthropic QC API error: ${qcResponse.status}`);
        const qcData = await qcResponse.json();
        const qcText = qcData.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
        const cleanedText = qcText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
        const parsed = JSON.parse(cleanedText);
        qcResult = {
          status: parsed.overall === 'pass' ? 'passed' : 'failed',
          score: parsed.score,
          failed_count: parsed.failed_count,
          categories: parsed.categories,
          summary: parsed.summary,
          model_used: 'claude-haiku-4-5',
          ran_at: new Date().toISOString(),
        };
      } catch (e: any) {
        qcResult = { status: 'error', error_message: e.message, model_used: 'claude-haiku-4-5', ran_at: new Date().toISOString() };
      }

      // Persist to DB
      if (reqMeetingId) {
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL');
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
          if (supabaseUrl && serviceKey) {
            const sb = createClient(supabaseUrl, serviceKey);
            const { data: row } = await sb.from('meeting_summaries').select('generation_metadata').eq('meeting_id', reqMeetingId).maybeSingle();
            const meta = (row?.generation_metadata as any) || {};
            await sb.from('meeting_summaries').update({ generation_metadata: { ...meta, qc: qcResult } }).eq('meeting_id', reqMeetingId);
          }
        } catch { /* non-blocking */ }
      }

      return new Response(JSON.stringify({ success: true, qc: qcResult }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const effectiveModelOverride = !modelOverride || modelOverride === 'gemini-3-flash'
      ? 'claude-sonnet-4-6'
      : modelOverride;

    console.log('🔍 Request details:', {
      hasTranscript: !!transcript,
      hasCustomPrompt: !!customPrompt,
      transcriptLength: transcript?.length,
      modelOverride: effectiveModelOverride,
    });

    if (!transcript) throw new Error('Transcript is required');

    // ── Short-transcript guard: prevent hallucination on minimal content ──
    const transcriptWordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
    console.log(`📏 Transcript word count: ${transcriptWordCount}`);

    // ─── PIPELINE GUARD (300 words / 180s) ──────────────────────────────
    // Bypass with forceGenerate: true. Looks up duration from the meetings
    // table when a meetingId is provided.
    let guardDurationSeconds: number | null = null;
    if (reqMeetingId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (supabaseUrl && serviceKey) {
          const sb = createClient(supabaseUrl, serviceKey);
          const { data: dRow } = await sb.from('meetings').select('duration_minutes').eq('id', reqMeetingId).maybeSingle();
          if (dRow?.duration_minutes != null) {
            guardDurationSeconds = Math.round(Number(dRow.duration_minutes) * 60);
          }
        }
      } catch (_e) { /* non-blocking */ }
    }

    const MIN_TRANSCRIPT_WORDS = 300;
    const MIN_DURATION_SECONDS = 180;
    if (!forceGenerate) {
      const transcriptTooShort = transcriptWordCount < MIN_TRANSCRIPT_WORDS;
      const durationTooShort = guardDurationSeconds != null && guardDurationSeconds < MIN_DURATION_SECONDS;
      if (transcriptTooShort || durationTooShort) {
        const skipReason: 'transcript_too_short' | 'duration_too_short' | 'both_too_short' =
          transcriptTooShort && durationTooShort ? 'both_too_short'
            : transcriptTooShort ? 'transcript_too_short'
            : 'duration_too_short';
        console.log(`⛔ Pipeline guard: insufficient content (${skipReason}) — words=${transcriptWordCount}, duration=${guardDurationSeconds}s`);

        const friendlyMessage = `# Recording too short for meeting notes\n\nThis recording is too short to generate meeting notes (${guardDurationSeconds ?? '—'} seconds, ${transcriptWordCount} words). Meeting notes work best on recordings over 3 minutes with substantive discussion.\n\nIf this recording is genuinely a meeting, please use the **Override and generate anyway** button on the meeting card, or contact support.\n\n---\n\n*Notewell AI declined to generate notes to avoid hallucinating content from a recording that does not appear to be a meeting.*`;

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (supabaseUrl && serviceKey && reqMeetingId) {
          const sb = createClient(supabaseUrl, serviceKey);
          try {
            await sb.from('meeting_summaries').upsert({
              meeting_id: reqMeetingId,
              summary: friendlyMessage,
              generation_metadata: { status: 'insufficient_content', reason: skipReason, transcript_word_count: transcriptWordCount, duration_seconds: guardDurationSeconds, guard: 'pipeline' },
              ai_generated: false,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'meeting_id' });
            await sb.from('meetings').update({
              notes_style_3: friendlyMessage,
              notes_generation_status: 'insufficient_content',
              word_count: transcriptWordCount,
              updated_at: new Date().toISOString(),
            }).eq('id', reqMeetingId);
            await sb.from('meeting_generation_log').insert({
              meeting_id: reqMeetingId,
              primary_model: 'none',
              actual_model_used: 'none',
              fallback_count: 0,
              generation_ms: 0,
              skip_reason: skipReason,
              detected_content_type: skipReason,
              transcript_word_count: transcriptWordCount,
              duration_seconds: guardDurationSeconds,
              transcript_snippet: transcript.slice(0, 200),
            });
          } catch (e) {
            console.warn('⚠️ Failed to persist insufficient-content state:', e);
          }
        }

        return new Response(JSON.stringify({
          status: 'insufficient_content',
          reason: skipReason,
          transcript_word_count: transcriptWordCount,
          duration_seconds: guardDurationSeconds,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else {
      console.log('⚠️ forceGenerate=true — bypassing pipeline guard');
    }

    if (transcriptWordCount < 100) {
      console.log('⚠️ Ultra-short transcript (<100 words) — bypassing LLM to prevent hallucination');
      const minimalNotes = `# Meeting Notes — ${meetingTitle || 'Untitled Meeting'}\n\n**Date:** ${meetingDate || 'Not recorded'}  \n**Time:** ${meetingTime || 'Not recorded'}\n\n---\n\n## Recording Summary\n\nThis recording captured minimal content (approximately ${transcriptWordCount} words). The transcript is too short for substantive meeting notes to be generated reliably.\n\nNo agenda items, decisions, or action items were identified from this recording.\n\n---\n\n*Generated by Notewell AI — MHRA Class I registered medical device. These minutes are based solely on the content of the provided transcript. No information has been inferred, estimated, or supplemented beyond what was explicitly recorded.*`;

      // Save minimal notes to DB
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && serviceKey && reqMeetingId) {
        const sb = createClient(supabaseUrl, serviceKey);
        await sb.from('meeting_summaries').upsert({
          meeting_id: reqMeetingId,
          summary: minimalNotes,
          generation_metadata: { model: 'skipped', transcript_source: 'auto', note_style: 'minimal', reason: 'transcript_too_short', word_count: transcriptWordCount },
          ai_generated: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'meeting_id' });
        await sb.from('meetings').update({
          notes_style_3: minimalNotes,
          notes_generation_status: 'completed',
          word_count: transcriptWordCount,
          updated_at: new Date().toISOString(),
        }).eq('id', reqMeetingId);
        console.log('💾 Minimal notes saved (short transcript guard)');
      }

      return new Response(JSON.stringify({
        generatedNotes: minimalNotes,
        meetingMinutes: minimalNotes,
        model: 'skipped',
        shortTranscript: true,
        wordCount: transcriptWordCount,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Apply domain dictionary ASR corrections
    const dictEntries = await loadDomainDictionary();
    const { text: processedTranscript, count: correctionCount } = applyDomainCorrections(transcript, dictEntries);
    if (correctionCount > 0) {
      console.log(`📖 Domain dictionary: applied ${correctionCount} ASR correction(s)`);
    }

    const isClaudeModel = effectiveModelOverride.startsWith('claude-');
    const modelLabel = isClaudeModel ? effectiveModelOverride : 'claude-sonnet-4-6';
    console.log(`🧠 Using model: ${modelLabel}`);

    let meetingMinutes: string;

    // ── Custom prompt path (legacy — uses old prompt verbatim) ──────────
    if (customPrompt) {
      console.log('🎨 Using custom prompt');
      const apiStart = Date.now();

      if (isClaudeModel) {
        meetingMinutes = await callClaude(effectiveModelOverride, NOTEWELL_SYSTEM_PROMPT, customPrompt);
      } else {
        meetingMinutes = await callGemini(NOTEWELL_SYSTEM_PROMPT, customPrompt);
      }

      console.log(`⚡ Custom prompt API call: ${Date.now() - apiStart}ms`);
    }
    // ── Standard generation path ────────────────────────────────────────
    else {
      // Fetch expected attendees and notes_config from DB if not provided in request
      let expectedAttendees: string[] = reqExpectedAttendees || [];
      let notesConfig: { length?: string; sections?: Record<string, boolean> } | null = null;

      if (reqMeetingId) {
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL');
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
          if (supabaseUrl && serviceKey) {
            const sb = createClient(supabaseUrl, serviceKey);
            const { data: mtg } = await sb.from('meetings').select('expected_attendees, notes_config').eq('id', reqMeetingId).maybeSingle();
            if (mtg?.expected_attendees && Array.isArray(mtg.expected_attendees) && mtg.expected_attendees.length > 0 && expectedAttendees.length === 0) {
              expectedAttendees = mtg.expected_attendees;
              console.log(`👥 Loaded ${expectedAttendees.length} expected attendees from meeting record`);
            }
            if (mtg?.notes_config && typeof mtg.notes_config === 'object') {
              notesConfig = mtg.notes_config as any;
              console.log(`📋 Loaded notes_config: length=${notesConfig?.length}, sections=${JSON.stringify(notesConfig?.sections)}`);
            }
          }
        } catch (e) {
          console.warn('⚠️ Could not fetch meeting config:', e);
        }
      }

      // Build notes length instruction
      let lengthInstruction = '';
      const notesLength = notesConfig?.length || 'standard';
      if (notesLength === 'concise') {
        lengthInstruction = '\n\n[INTERNAL — do not include this header in the output] Length target: Generate concise notes of approximately 800 words. Include only decisions, key actions, and critical outcomes. Omit detailed discussion context.\n';
      } else if (notesLength === 'detailed') {
        lengthInstruction = '\n\n[INTERNAL — do not include this header in the output] Length target: Generate detailed meeting notes of approximately 2,500 words. Include full discussion context, speaker attribution where identifiable, and nuanced positions taken by participants.\n';
      } else {
        lengthInstruction = '\n\n[INTERNAL — do not include this header in the output] Length target: Generate standard meeting notes of approximately 1,500 words. Include discussion context for each agenda item with balanced detail.\n';
      }

      // Build section filter instruction
      let sectionInstruction = '';
      if (notesConfig?.sections) {
        const sectionLabels: Record<string, string> = {
          exec_summary: 'Executive Summary (Discussion Summary overview paragraph)',
          key_points: 'Key Discussion Points (numbered topic summaries)',
          decisions: 'Decisions Register (RESOLVED / AGREED / NOTED)',
          actions: 'Action Log (owner, deadline, status)',
          open_items: 'Open Items & Risks',
          attendees: 'Attendees (names and roles)',
          next_meeting: 'Next Meeting',
          full_transcript: 'Appendix: Full Transcript',
        };
        const enabledSections = Object.entries(notesConfig.sections)
          .filter(([_, enabled]) => enabled)
          .map(([key]) => sectionLabels[key])
          .filter(Boolean);

        if (enabledSections.length > 0 && enabledSections.length < Object.keys(sectionLabels).length) {
          sectionInstruction = `\n\n## SECTIONS TO INCLUDE\nInclude ONLY the following sections in the output (skip any not listed):\n${enabledSections.map(s => `- ${s}`).join('\n')}\n\nDo NOT include sections that are not in the list above, even if the discussion content would support them.\n`;
        }
      }

      // ── Short-transcript prompt modifier (100-300 words) ──
      let effectiveSystemPrompt = NOTEWELL_SYSTEM_PROMPT;
      let effectiveMaxTokens: number | undefined = undefined;
      if (transcriptWordCount < 300) {
        console.log('⚠️ Short transcript (100-300 words) — injecting strict anti-hallucination preamble');
        const shortPreamble = `\n\n## ⚠️ SHORT TRANSCRIPT WARNING\nThis transcript contains only ~${transcriptWordCount} words. You MUST:\n- Report ONLY what is explicitly stated in the transcript\n- Use "None identified" for ALL sections where the transcript provides no information\n- Do NOT extrapolate, infer, or generate plausible content\n- Do NOT use examples from this system prompt as filler\n- Keep the output proportional to the input — a short transcript means short notes\n- If fewer than 3 agenda items are identifiable, list only those present\n`;
        effectiveSystemPrompt = shortPreamble + NOTEWELL_SYSTEM_PROMPT;
        effectiveMaxTokens = 2000;
      }

      const promptParams = {
        transcript: processedTranscript,
        meetingTitle: meetingTitle || 'General Meeting',
        meetingDate: meetingDate || 'Date not recorded',
        meetingTime: meetingTime || 'Time not recorded',
        meetingDuration,
        speakerCount,
        organisationName,
        meetingType,
        practiceContext,
        expectedAttendees,
        lengthInstruction,
        sectionInstruction,
      };

      if (shouldChunk(processedTranscript)) {
        const chunks = chunkTranscript(processedTranscript);
        console.log(`📦 Large transcript — processing ${chunks.length} chunks`);

        const chunkResults: string[] = [];
        for (let i = 0; i < chunks.length; i++) {
          console.log(`Processing chunk ${i + 1}/${chunks.length}`);
          const chunkPrompt = buildUserPrompt({ ...promptParams, transcript: chunks[i] });

          const result = isClaudeModel
            ? await callClaude(effectiveModelOverride, effectiveSystemPrompt, chunkPrompt, 2500)
            : await callGemini(effectiveSystemPrompt, chunkPrompt, 2500);
          chunkResults.push(result);
        }

        // Consolidate chunks
        const consolidationPrompt = `Consolidate these meeting minute chunks into a single comprehensive document following the same output format. Merge duplicate topics, unify the action log, and deduplicate decisions. In the DECISIONS REGISTER, label every entry as **[RESOLVED]**, **[AGREED]**, or **[NOTED]**. Maintain ALL specific details, names, dates, figures. Use British English throughout.\n\nCHUNK RESULTS:\n${chunkResults.join('\n\n--- CHUNK SEPARATOR ---\n\n')}`;
        
        meetingMinutes = isClaudeModel
          ? await callClaude(effectiveModelOverride, effectiveSystemPrompt, consolidationPrompt, 8000)
          : await callGemini(effectiveSystemPrompt, consolidationPrompt, 8000);
      } else {
        const userPrompt = buildUserPrompt(promptParams);
        const apiStart = Date.now();

        meetingMinutes = isClaudeModel
          ? await callClaude(effectiveModelOverride, effectiveSystemPrompt, userPrompt)
          : await callGemini(effectiveSystemPrompt, userPrompt);

        console.log(`⚡ API response: ${Date.now() - apiStart}ms`);
      }
    }

    // ─── LLM REFUSAL DETECTION ────────────────────────────────────────────
    // Detect strict-JSON refusal { "is_meeting": false, ... } from the model.
    if (!forceGenerate) {
      try {
        const trimmed = (meetingMinutes || '').trim();
        const jsonCandidate = trimmed.startsWith('```')
          ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
          : trimmed;
        if (jsonCandidate.startsWith('{') && jsonCandidate.includes('"is_meeting"')) {
          const parsed = JSON.parse(jsonCandidate);
          if (parsed && parsed.is_meeting === false) {
            const detectedType: string = typeof parsed.detected_content_type === 'string' ? parsed.detected_content_type : 'unclear';
            const explanation: string = typeof parsed.explanation === 'string' ? parsed.explanation : 'Content does not appear to be a meeting.';
            console.log(`⛔ LLM refusal: detected_content_type=${detectedType} — ${explanation}`);

            const friendlyMessage = `# This recording does not appear to be a meeting\n\nNotewell AI evaluated the transcript and concluded the content type is **${detectedType}**.\n\n> ${explanation}\n\nNo meeting notes have been generated to avoid hallucinating content. If this recording is genuinely a meeting, please use the **Override and generate anyway** button on the meeting card, or contact support.\n\n---\n\n*Recording details: ${guardDurationSeconds ?? '—'} seconds, ${transcriptWordCount} words.*`;

            const supabaseUrl2 = Deno.env.get('SUPABASE_URL');
            const serviceKey2 = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
            if (supabaseUrl2 && serviceKey2 && reqMeetingId) {
              const sb = createClient(supabaseUrl2, serviceKey2);
              try {
                await sb.from('meeting_summaries').upsert({
                  meeting_id: reqMeetingId,
                  summary: friendlyMessage,
                  generation_metadata: { status: 'insufficient_content', reason: 'llm_refused_non_meeting', detected_content_type: detectedType, explanation, transcript_word_count: transcriptWordCount, duration_seconds: guardDurationSeconds, guard: 'llm', model: modelLabel },
                  ai_generated: false,
                  updated_at: new Date().toISOString(),
                }, { onConflict: 'meeting_id' });
                await sb.from('meetings').update({
                  notes_style_3: friendlyMessage,
                  notes_generation_status: 'insufficient_content',
                  word_count: transcriptWordCount,
                  updated_at: new Date().toISOString(),
                }).eq('id', reqMeetingId);
                await sb.from('meeting_generation_log').insert({
                  meeting_id: reqMeetingId,
                  primary_model: modelLabel,
                  actual_model_used: modelLabel,
                  fallback_count: 0,
                  generation_ms: Date.now() - functionStartTime,
                  skip_reason: 'llm_refused_non_meeting',
                  detected_content_type: detectedType,
                  transcript_word_count: transcriptWordCount,
                  duration_seconds: guardDurationSeconds,
                  transcript_snippet: (transcript || '').slice(0, 200),
                });
              } catch (e) {
                console.warn('⚠️ Failed to persist LLM refusal:', e);
              }
            }

            return new Response(JSON.stringify({
              status: 'insufficient_content',
              reason: 'llm_refused_non_meeting',
              detected_content_type: detectedType,
              explanation,
              transcript_word_count: transcriptWordCount,
              duration_seconds: guardDurationSeconds,
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }
      } catch (_e) { /* not JSON — proceed */ }
    }

    // Post-processing
    // Repair malformed "## Heading | col | col |" lines emitted by the AI by splitting
    // the heading from the table header onto separate lines. Without this, the markdown
    // parser sees "## Actions" as the first column name and column-mapping fails.
    meetingMinutes = meetingMinutes.replace(
      /^(#{1,6}\s+[A-Za-z][A-Za-z0-9\s&]*?)\s+(\|\s*[A-Za-z].*\|)\s*$/gm,
      '$1\n\n$2'
    );

    meetingMinutes = sanitizeMeetingMinutes(meetingMinutes);
    meetingMinutes = sanitiseActionOwners(meetingMinutes, processedTranscript);

    const genTime = Date.now() - functionStartTime;
    console.log(`✅ Meeting minutes generated (${modelLabel}) in ${genTime}ms`);
    console.log('📝 Preview:', meetingMinutes.substring(0, 500));

    // ── Save notes to DB immediately (so they're available even if QC fails) ──
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const meetingId: string | null = reqMeetingId || null;

    // Save generation_metadata baseline (upsert to ensure row exists for QC step)
    if (supabaseUrl && serviceKey && meetingId) {
      try {
        const sb = createClient(supabaseUrl, serviceKey);

        // 1. Upsert into meeting_summaries (authoritative notes store)
        await sb.from('meeting_summaries')
          .upsert({
            meeting_id: meetingId,
            summary: meetingMinutes,
            generation_metadata: {
              model: modelLabel,
              transcript_source: 'auto',
              note_style: 'standard',
            },
            ai_generated: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'meeting_id' });
        console.log('💾 Baseline generation_metadata saved (upsert)');

        // 2. Mirror notes into meetings table so ALL downstream consumers see them
        //    (notes_style_3, notes_generation_status, word_count)
        const wordCount = meetingMinutes.split(/\s+/).filter(Boolean).length;
        const { error: meetingUpdateErr } = await sb.from('meetings')
          .update({
            notes_style_3: meetingMinutes,
            notes_generation_status: 'completed',
            word_count: wordCount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', meetingId);

        if (meetingUpdateErr) {
          console.warn('⚠️ Could not mirror notes to meetings table:', meetingUpdateErr);
          // Fail-soft: at least try to set status to completed
          await sb.from('meetings')
            .update({ notes_generation_status: 'completed' })
            .eq('id', meetingId);
        } else {
          console.log('💾 Notes mirrored to meetings.notes_style_3 + status=completed');
        }

        await sb.from('meeting_notes_queue')
          .update({
            status: 'completed',
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq('meeting_id', meetingId)
          .in('status', ['pending', 'processing']);
      } catch (metaErr) {
        console.warn('⚠️ Could not save baseline metadata:', metaErr);
      }
    }

    // ── 7-Category QC Audit (inline, non-blocking) ────────────────────
    let qcResult: any = null;
    const finalMinutes = meetingMinutes;
    const qcStartTime = Date.now();

    if (skipQc) {
      console.log('⏭️ QC audit skipped (disabled by user setting)');
      qcResult = { status: 'skipped', reason: 'disabled_by_user', ran_at: new Date().toISOString() };
    } else {
    try {
      console.log(`[QC] Starting quality audit at ${new Date(qcStartTime).toISOString()}`);

      if (!anthropicApiKey) {
        throw new Error('ANTHROPIC_API_KEY not configured — skipping QC');
      }

      // Use shared QC_SYSTEM_PROMPT constant defined at top of file

      const qcUserPrompt = `SOURCE TRANSCRIPT:\n${processedTranscript}\n\nGENERATED MEETING NOTES:\n${meetingMinutes}`;

      // 30-second timeout via AbortController
      const qcController = new AbortController();
      const qcTimeout = setTimeout(() => qcController.abort(), 30000);

      const qcResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          system: QC_SYSTEM_PROMPT,
          temperature: 0.1,
          messages: [{ role: 'user', content: qcUserPrompt }],
        }),
        signal: qcController.signal,
      });

      clearTimeout(qcTimeout);

      if (!qcResponse.ok) {
        const errText = await qcResponse.text();
        throw new Error(`Anthropic QC API error: ${qcResponse.status} - ${errText}`);
      }

      const qcData = await qcResponse.json();

      // Check if response was truncated
      if (qcData.stop_reason === 'max_tokens') {
        console.warn('⚠️ QC response was truncated (max_tokens reached)');
      }

      const qcText = qcData.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');

      // Strip markdown code fences if present
      let cleanedQcText = qcText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

      // Attempt to repair truncated JSON by closing open braces/brackets
      let parsed: any;
      try {
        parsed = JSON.parse(cleanedQcText);
      } catch (_parseErr) {
        console.warn('⚠️ QC JSON parse failed, attempting repair…');
        // Count unmatched braces/brackets and close them
        let opens = 0, openBrackets = 0;
        let inString = false, escaped = false;
        for (const ch of cleanedQcText) {
          if (escaped) { escaped = false; continue; }
          if (ch === '\\') { escaped = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === '{') opens++;
          else if (ch === '}') opens--;
          else if (ch === '[') openBrackets++;
          else if (ch === ']') openBrackets--;
        }
        // If we were inside a string, close it
        if (inString) cleanedQcText += '"';
        // Close any open brackets/braces
        cleanedQcText += ']'.repeat(Math.max(0, openBrackets));
        cleanedQcText += '}'.repeat(Math.max(0, opens));
        parsed = JSON.parse(cleanedQcText);
        console.log('✅ QC JSON repaired successfully');
      }
      qcResult = {
        status: parsed.overall === 'pass' ? 'passed' : 'failed',
        score: parsed.score,
        failed_count: parsed.failed_count,
        categories: parsed.categories,
        summary: parsed.summary,
        model_used: 'claude-haiku-4-5',
        ran_at: new Date().toISOString(),
      };

      const qcEndTime = Date.now();
      const qcDurationMs = qcEndTime - qcStartTime;
      const qcDurationSec = (qcDurationMs / 1000).toFixed(1);
      console.log(`[QC] Audit complete in ${qcDurationSec}s`);
      qcResult.duration_seconds = parseFloat(qcDurationSec);

      console.log(`✅ QC audit complete: ${qcResult.status} (score: ${qcResult.score}, failed: ${qcResult.failed_count})`);

    } catch (qcError: any) {
      console.warn('⚠️ QC audit failed (non-blocking):', qcError.message);
      qcResult = {
        status: 'error',
        error_message: qcError.message || 'Unknown QC error',
        model_used: 'claude-haiku-4-5',
        ran_at: new Date().toISOString(),
      };
    }
    } // end if (!skipQc)

    // ── Persist QC results + timing to generation_metadata ──
    const qcEndFinal = Date.now();
    const qcDurationSecFinal = ((qcEndFinal - qcStartTime) / 1000).toFixed(1);
    const noteGenDurationSec = ((qcStartTime - functionStartTime) / 1000).toFixed(1);
    const totalDurationSec = ((qcEndFinal - functionStartTime) / 1000).toFixed(1);
    console.log(`[PIPELINE] Notes: ${noteGenDurationSec}s | QC: ${qcDurationSecFinal}s | Total: ${totalDurationSec}s`);

    const timingData = {
      notes_generation_seconds: parseFloat(noteGenDurationSec),
      qc_audit_seconds: parseFloat(qcDurationSecFinal),
      total_pipeline_seconds: parseFloat(totalDurationSec),
    };

    if (supabaseUrl && serviceKey && meetingId) {
      try {
        const sb = createClient(supabaseUrl, serviceKey);
        const { data: existingRow } = await sb
          .from('meeting_summaries')
          .select('generation_metadata')
          .eq('meeting_id', meetingId)
          .maybeSingle();

        const existingMeta = (existingRow?.generation_metadata as any) || {};
        const updatedMeta = {
          ...existingMeta,
          model: modelLabel,
          transcript_source: existingMeta.transcript_source || 'auto',
          note_style: existingMeta.note_style || 'standard',
          qc: qcResult,
          timing: timingData,
        };

        const { error: qcPersistError } = await sb.from('meeting_summaries')
          .update({
            generation_metadata: updatedMeta,
            updated_at: new Date().toISOString(),
          })
          .eq('meeting_id', meetingId);

        if (qcPersistError) {
          throw qcPersistError;
        }

        console.log('💾 QC + timing persisted to generation_metadata; summary left unchanged');
        console.log('METADATA WRITTEN:', JSON.stringify(updatedMeta));
      } catch (persistErr) {
        console.warn('⚠️ Could not persist QC results:', persistErr);
      }
    }

    // ── Auto-send email with Word doc attachment (server-side, non-blocking) ──
    if (meetingId && supabaseUrl && serviceKey) {
      try {
        const sb = createClient(supabaseUrl, serviceKey);
        // Look up the user's email from the meeting's user_id
        const { data: meetingRow } = await sb
          .from('meetings')
          .select('user_id')
          .eq('id', meetingId)
          .maybeSingle();

        if (meetingRow?.user_id) {
          const { data: userData } = await sb.auth.admin.getUserById(meetingRow.user_id);
          const userEmail = userData?.user?.email;

          if (userEmail) {
            console.log(`📧 Triggering email to ${userEmail} for meeting ${meetingId}`);
            const { error: emailErr } = await sb.functions.invoke('send-meeting-email-resend', {
              body: { meetingId, recipientEmail: userEmail },
            });
            if (emailErr) {
              console.warn('⚠️ Email send failed (notes still saved):', emailErr.message || emailErr);
            } else {
              console.log('✅ Meeting notes email sent successfully');
            }
          } else {
            console.warn('⚠️ No email found for user — skipping email send');
          }
        }
      } catch (emailError: any) {
        console.warn('⚠️ Email trigger failed (non-blocking):', emailError.message || emailError);
      }
    }

    const totalTime = Date.now() - functionStartTime;
    console.log(`✅ Full pipeline complete in ${totalTime}ms`);

    return new Response(JSON.stringify({
      success: true,
      meetingMinutes: finalMinutes,
      generatedNotes: finalMinutes,
      modelUsed: modelLabel,
      processingTimeMs: totalTime,
      qc: qcResult,
      // Legacy quality gate fields for backwards compatibility
      qualityGate: qcResult ? {
        status: qcResult.status === 'passed' ? 'CLEAN' : qcResult.status === 'failed' ? 'REVIEW_RECOMMENDED' : 'ERROR',
        accuracyIssueCount: qcResult.failed_count || 0,
        missingTopicCount: 0,
        missingActionCount: 0,
        highSeverityCount: qcResult.failed_count || 0,
        pipelineSteps: [],
        totalTimeMs: totalTime - genTime,
        summary: qcResult.summary || null,
      } : null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-meeting-notes-claude:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
