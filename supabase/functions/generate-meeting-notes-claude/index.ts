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
Check the decisions register. For every item marked RESOLVED, verify that the transcript contains explicit voting language (moved, seconded, carried, aye). For every item marked AGREED, verify that the transcript shows a positive signal — someone stating a conclusion AND others explicitly endorsing it or the chair confirming the position. For every item marked NOTED, verify the information was actually presented in the transcript. Flag any decision that cannot be traced to specific transcript content. Flag any item categorised as RESOLVED or AGREED that should be NOTED.

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

Set overall to "fail" if ANY category fails. Score is your estimate of overall note quality from 0 to 100.`;

// ─── Notewell AI Governance-Grade System Prompt ───────────────────────────
const NOTEWELL_SYSTEM_PROMPT = `You are Notewell AI, an MHRA Class I registered medical device for NHS primary care. You generate governance-grade meeting minutes from transcribed audio recordings of NHS meetings.

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
}): string {
  const contextLines = [
    `- Organisation: ${params.organisationName || 'Not specified'}`,
    `- Meeting type: ${params.meetingType || 'General Meeting'}`,
    `- Recording date: ${params.meetingDate}`,
    params.meetingDuration ? `- Recording duration: ${params.meetingDuration}` : null,
    params.speakerCount ? `- Number of speakers detected: ${params.speakerCount}` : null,
    params.practiceContext ? `- Practice/PCN context: ${params.practiceContext}` : null,
  ].filter(Boolean).join('\n');

  return `## MEETING CONTEXT (auto-populated by Notewell)

${contextLines}

## OUTPUT FORMAT

Use the following structure. Every section is mandatory. If a section has no content, write "None identified" — do not omit the section.

---

**[MEETING TITLE — derive from the primary topic of discussion, or use: ${params.meetingTitle || 'General Meeting'}]**

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

Then produce numbered sections for EVERY distinct topic cluster discussed. Aim for 8–15 sections in a typical meeting. Each section should:
- Have a clear descriptive heading
- Open with what was discussed
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

Categorise every decision using one of these three labels:

- **RESOLVED** — A formal vote took place (moved, seconded, carried/defeated). Use ONLY when the transcript contains explicit voting language.
- **AGREED** — A clear consensus was reached. The test: (1) someone stated a specific course of action or conclusion, AND (2) either others explicitly endorsed it, or the chair summarised it as the position and discussion moved on without objection. Informal agreement counts.
- **NOTED** — A matter was presented, discussed, or reported on, but no specific action or position was agreed by the group. Also use when an officer is informing the committee of a decision already taken elsewhere rather than seeking the committee's agreement.

If in doubt between AGREED and NOTED, use NOTED. Never infer agreement from the absence of disagreement alone — there must be a positive signal.

Format each entry as:
- **[RESOLVED/AGREED/NOTED]** [What was decided/noted — one line, specific, with rationale if stated]
- If a decision was conditional (e.g., "subject to rate confirmation"), note the condition

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

| Action | Owner | Deadline |
|--------|-------|----------|
| [Specific action] | [Named person or TBC] | [Date or TBC] |

Extract EVERY action committed to in the transcript, including informal ones ("I'll do that by Tuesday", "Amanda, can you check..."). If no owner was named, write "TBC". If no deadline was stated, write "TBC".

---

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
  return transcript.length > 500000;
}

function chunkTranscript(transcript: string): string[] {
  const words = transcript.split(' ');
  const chunkSize = 100000;
  const overlap = 5000;
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
      };

      if (shouldChunk(processedTranscript)) {
        const chunks = chunkTranscript(processedTranscript);
        console.log(`📦 Large transcript — processing ${chunks.length} chunks`);

        const chunkResults: string[] = [];
        for (let i = 0; i < chunks.length; i++) {
          console.log(`Processing chunk ${i + 1}/${chunks.length}`);
          const chunkPrompt = buildUserPrompt({ ...promptParams, transcript: chunks[i] });

          const result = isClaudeModel
            ? await callClaude(effectiveModelOverride, NOTEWELL_SYSTEM_PROMPT, chunkPrompt)
            : await callGemini(NOTEWELL_SYSTEM_PROMPT, chunkPrompt);
          chunkResults.push(result);
        }

        // Consolidate chunks
        const consolidationPrompt = `Consolidate these meeting minute chunks into a single comprehensive document following the same output format. Merge duplicate topics, unify the action log, and deduplicate decisions. In the DECISIONS REGISTER, label every entry as **[RESOLVED]**, **[AGREED]**, or **[NOTED]**. Maintain ALL specific details, names, dates, figures. Use British English throughout.\n\nCHUNK RESULTS:\n${chunkResults.join('\n\n--- CHUNK SEPARATOR ---\n\n')}`;
        
        meetingMinutes = isClaudeModel
          ? await callClaude(effectiveModelOverride, NOTEWELL_SYSTEM_PROMPT, consolidationPrompt)
          : await callGemini(NOTEWELL_SYSTEM_PROMPT, consolidationPrompt);
      } else {
        const userPrompt = buildUserPrompt(promptParams);
        const apiStart = Date.now();

        meetingMinutes = isClaudeModel
          ? await callClaude(effectiveModelOverride, NOTEWELL_SYSTEM_PROMPT, userPrompt)
          : await callGemini(NOTEWELL_SYSTEM_PROMPT, userPrompt);

        console.log(`⚡ API response: ${Date.now() - apiStart}ms`);
      }
    }

    // Post-processing
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
      } catch (metaErr) {
        console.warn('⚠️ Could not save baseline metadata:', metaErr);
      }
    }

    // ── 7-Category QC Audit (inline, non-blocking) ────────────────────
    let qcResult: any = null;
    const finalMinutes = meetingMinutes;

    try {
      console.log('🔍 Running 7-category QC audit via Claude Haiku 4.5...');

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
          max_tokens: 2000,
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
      const qcText = qcData.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');

      // Strip markdown code fences if present
      const cleanedQcText = qcText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

      const parsed = JSON.parse(cleanedQcText);
      qcResult = {
        status: parsed.overall === 'pass' ? 'passed' : 'failed',
        score: parsed.score,
        failed_count: parsed.failed_count,
        categories: parsed.categories,
        summary: parsed.summary,
        model_used: 'claude-haiku-4-5',
        ran_at: new Date().toISOString(),
      };

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

    // ── Persist QC results to generation_metadata ─────────────────────
    if (supabaseUrl && serviceKey && meetingId) {
      try {
        const sb = createClient(supabaseUrl, serviceKey);
        const { data: existingRow } = await sb
          .from('meeting_summaries')
          .select('generation_metadata')
          .eq('meeting_id', meetingId)
          .maybeSingle();

        const existingMeta = (existingRow?.generation_metadata as any) || {};
        await sb.from('meeting_summaries')
          .update({
            generation_metadata: {
              ...existingMeta,
              model: modelLabel,
              transcript_source: existingMeta.transcript_source || 'auto',
              note_style: existingMeta.note_style || 'standard',
              qc: qcResult,
            }
          })
          .eq('meeting_id', meetingId);
        console.log('💾 QC results persisted to generation_metadata');
      } catch (persistErr) {
        console.warn('⚠️ Could not persist QC results:', persistErr);
      }
    }

    const totalTime = Date.now() - functionStartTime;
    console.log(`✅ Full pipeline complete in ${totalTime}ms (generation: ${genTime}ms, QC: ${totalTime - genTime}ms)`);

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
