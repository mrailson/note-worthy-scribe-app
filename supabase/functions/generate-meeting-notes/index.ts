// supabase/functions/generate-meeting-notes/index.ts
// Key changes: accepts a `length` parameter and selects the appropriate system prompt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── CORS ─────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─── TYPES ────────────────────────────────────────────────────────────────────

type NotesLength = "brief" | "standard" | "detailed" | "comprehensive";
type NotesFormat =
  | "standard"
  | "nhs_formal"
  | "clinical_notes"
  | "action_focused"
  | "educational_cpd"
  | "ageing_well";

interface RequestBody {
  transcript: string;
  format: NotesFormat;
  length: NotesLength;
  meetingTitle: string;
  attendees?: string[];
  date?: string;
}

// ─── LENGTH PROMPTS ───────────────────────────────────────────────────────────
// Each tier has: a page budget, structural rules, and a detail instruction.

const LENGTH_PROMPTS: Record<NotesLength, string> = {

  brief: `
NOTES LENGTH: BRIEF (target ~400–600 words, one page only)

Rules:
- Output a single Executive Summary paragraph (3–5 sentences max).
- List up to 5 agreed actions in a numbered list. Each action: one sentence, owner in brackets, deadline if stated.
- One "Key Points" section: bullet list, max 6 bullets, each ≤15 words.
- No extended discussion narrative. No attendee list. No background context.
- If content would exceed one page, cut less critical items — never expand.
- Heading structure: Executive Summary → Key Points → Agreed Actions only.
`.trim(),

  standard: `
NOTES LENGTH: STANDARD (target ~800–1,200 words, 2–3 pages)

Rules:
- Executive Summary: 1 concise paragraph.
- Discussion Summary: narrative prose covering main topics, 3–5 paragraphs.
- Agreed Actions: numbered list with owner and deadline for each.
- Implications section: brief (3–5 bullet points).
- Include attendees list if names are clear from transcript.
- Heading structure: Executive Summary → Discussion Summary → Agreed Actions → Implications.
`.trim(),

  detailed: `
NOTES LENGTH: DETAILED (target ~1,600–2,200 words, 4–5 pages)

Rules:
- Executive Summary: 2 paragraphs.
- Discussion Summary: full narrative, one sub-section per agenda topic.
- Agreed Actions: numbered, each with: action, owner, deadline, and any relevant dependencies.
- Evidence / Data Referenced: bullet list of any data, reports or evidence cited.
- Risks and Issues: any raised concerns or risks, with proposed mitigations.
- Next Steps: distinct section with timeline.
- Include full attendee list with roles if available.
- Heading structure: Executive Summary → Attendance → Discussion → Evidence Referenced → Agreed Actions → Risks and Issues → Next Steps.
`.trim(),

  comprehensive: `
NOTES LENGTH: COMPREHENSIVE / FULL GOVERNANCE RECORD (no word limit — capture everything)

Rules:
- This output will be used as an NHS governance-grade record. Completeness takes priority over brevity.
- Executive Summary: 3–4 paragraphs covering purpose, key decisions, and strategic context.
- Full Attendance: names, roles, and organisations for all identified participants.
- Background / Context: relevant programme or clinical context (draw from transcript).
- Verbatim-style Discussion: detailed narrative for each agenda item. Capture individual contributions where attributable. Quote key statements in italics when clinically or governance-significant.
- Evidence and Data: full list of referenced datasets, reports, guidelines, or policies with source if named.
- Decisions Made: separate section, numbered, each with rationale.
- Agreed Actions: full action log — action, owner, deadline, priority (High/Medium/Low), and status (Agreed/Pending).
- Risks, Issues and Escalations: capture all raised concerns with owner and proposed resolution.
- Safeguarding / Clinical Safety flags: highlight any patient safety or safeguarding points if present.
- Next Steps and Review: timeline with named leads.
- Appendix notes: any acronyms or technical terms used, briefly defined.
- This output should also be formatted as a Word (DOCX) document using NHS meeting note conventions: organisation header, meeting title, date, version number (v1.0 DRAFT), classification (OFFICIAL).
`.trim(),

};

// ─── FORMAT PROMPTS (your existing ones, summarised for completeness) ─────────

const FORMAT_PROMPTS: Record<NotesFormat, string> = {
  standard:
    "Use a full structured format with Context, Discussion, Agreed Actions and Implications sections.",
  nhs_formal:
    "Use shorter formal key points suitable for board packs and ICB circulation. Clinical and governance language throughout.",
  clinical_notes:
    "Use SOAP format (Subjective, Objective, Assessment, Plan). Suitable for MDT and clinical governance meetings.",
  action_focused:
    "Lead with decisions and actions. Minimal narrative. Suitable for busy executives.",
  educational_cpd:
    "Include learning objectives, key takeaways, and a CPD portfolio statement at the end.",
  ageing_well:
    "Use comprehensive frailty review structure. Include History, Assessment, and Plan suitable for EMIS/SystmOne entry.",
};

// ─── SYSTEM PROMPT BUILDER ────────────────────────────────────────────────────

function buildSystemPrompt(format: NotesFormat, length: NotesLength): string {
  return `
You are Notewell AI, a clinical note-taking assistant for NHS primary care.
You produce high-quality meeting notes from transcripts. You write in clear, professional NHS English.

FORMAT INSTRUCTION:
${FORMAT_PROMPTS[format]}

${LENGTH_PROMPTS[length]}

GENERAL RULES:
- Use sentence case for all headings.
- Never invent information not present in the transcript.
- If the transcript is ambiguous, note it as "[unclear from transcript]".
- Dates and times should be in UK format (DD/MM/YYYY, 24-hour clock).
- Acronyms: expand on first use (e.g. SDA — Same Day Access).
- Do not include patient identifiable information unless it appears verbatim in the transcript and is clinically necessary.
`.trim();
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    console.log('EDGE FUNCTION RECEIVED:', JSON.stringify(body));
    const {
      transcript,
      format = "standard",
      length = "standard",
      meetingTitle,
      attendees = [],
      date,
    } = body;

    if (!transcript || transcript.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Empty transcript — nothing to process." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = buildSystemPrompt(format, length);

    const MAX_TOKENS_MAP: Record<NotesLength, number> = {
      brief: 1024,
      standard: 2048,
      detailed: 4096,
      comprehensive: 8192,
    };
    const maxTokens = MAX_TOKENS_MAP[length] || 2048;
    console.log('EDGE FUNCTION CONFIG:', JSON.stringify({
      format,
      length,
      max_tokens: maxTokens,
      lengthPrompt: LENGTH_PROMPTS[length],
      promptPreview: systemPrompt.substring(systemPrompt.indexOf('NOTES LENGTH'), systemPrompt.indexOf('GENERAL RULES')).trim(),
      meetingTitle,
      transcriptLength: transcript?.length,
    }));

    const userMessage = `
Meeting title: ${meetingTitle ?? "Untitled meeting"}
Date: ${date ?? "Not specified"}
${attendees.length > 0 ? `Attendees: ${attendees.join(", ")}` : ""}

TRANSCRIPT:
${transcript}

Generate meeting notes now according to the format and length instructions.
`.trim();

    // Call Claude via Anthropic API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(
        JSON.stringify({ error: "Claude API error", detail: err }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const notes = data.content?.[0]?.text ?? "";

    return new Response(
      JSON.stringify({
        notes,
        length,
        format,
        wordCount: notes.split(/\s+/).length,
        generateDocx: length === "comprehensive",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-meeting-notes error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
