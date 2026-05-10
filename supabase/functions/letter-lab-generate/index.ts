import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Letter Lab — experimental letter generator.
// Fully parallel to the live generate-complaint-acknowledgement /
// generate-complaint-outcome-letter functions. Does NOT write to the DB —
// the client decides whether to save as draft or as a version.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Mode = "generate" | "regenerate" | "simplify" | "rewrite-section";

interface ReqBody {
  draftId: string;
  mode: Mode;
  sectionText?: string;
}

// ---------- Reading metrics (mirror of client implementation) ----------
function stripHtml(s: string): string {
  if (!s) return "";
  if (!s.includes("<")) return s;
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const cleaned = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/u, "").replace(/^y/, "");
  const groups = cleaned.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}
function computeMetrics(text: string) {
  const plain = stripHtml(text).trim();
  if (!plain) return { flesch: 0, fkGrade: 0, readingAge: 0 };
  const sentenceMatches = plain.match(/[^.!?]+[.!?]+/g);
  const sentences = sentenceMatches ? sentenceMatches.length : 1;
  const wordTokens = plain.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  const words = wordTokens.length || 1;
  const syllables = wordTokens.reduce((a, w) => a + countSyllables(w), 0);
  const flesch = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
  const fkGrade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
  return {
    flesch: Math.round(flesch * 10) / 10,
    fkGrade: Math.round(fkGrade * 10) / 10,
    readingAge: Math.round(Math.max(0, fkGrade + 5) * 10) / 10,
  };
}

// ---------- Compliance checklist (mirror of client) ----------
const has = (t: string, ...needles: (string | RegExp)[]) =>
  needles.some((n) =>
    typeof n === "string" ? t.toLowerCase().includes(n.toLowerCase()) : n.test(t),
  );

function complianceFor(letterType: string, text: string) {
  const t = stripHtml(text);
  if (letterType === "outcome") {
    return [
      { label: "Explains how the complaint was considered", present: has(t, "investigated", "reviewed", "considered") },
      { label: "States the findings", present: has(t, "findings", "conclude", "we found") },
      { label: "Includes apology where appropriate", present: has(t, "apologise", "apologize", "sorry", "regret") },
      { label: "Describes remedial action / learning", present: has(t, "action", "learning", "changes", "improve") },
      { label: "Includes PHSO escalation right with contact details", present: has(t, "ombudsman") && (has(t, "0345 015 4033") || has(t, "ombudsman.org.uk")) },
      { label: "Mentions 12-month PHSO time limit", present: has(t, "12 months", "twelve months") },
      { label: "Mentions advocacy support", present: has(t, "advocacy") },
    ];
  }
  return [
    { label: "Confirms receipt of the complaint", present: has(t, "received", "acknowledge", "thank you for") },
    { label: "Names a contact person or role", present: has(t, "practice manager", "complaints lead", "complaints manager") || /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(t) },
    { label: "States the practice's complaints procedure", present: has(t, "complaints procedure", "complaints policy") },
    { label: "Offers to discuss the complaint", present: has(t, "discuss", "meeting", "speak with", "speak to") },
    { label: "Mentions the timeframe for response", present: has(t, "working days", "weeks", "by ") || /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(t) },
    { label: "Mentions PHSO escalation right", present: has(t, "ombudsman", "phso", "parliamentary and health service") },
    { label: "Mentions advocacy support", present: has(t, "advocacy", "independent advocate") },
  ];
}

// ---------- Prompt builders ----------
const TONE_BLOCKS: Record<string, string> = {
  formal: "TONE: Professional, neutral, NHS-standard. Courteous but factual. No casual phrasing.",
  empathetic: "TONE: Warm and patient-first. Acknowledge distress and inconvenience explicitly. Use plain, human language whilst staying professional.",
  firm: "TONE: Clear and direct. Where the patient's complaint is unfounded or where boundaries must be set, say so respectfully but unambiguously. Avoid hedging.",
};

const LENGTH_TARGETS: Record<string, number> = {
  concise: 150,
  standard: 300,
  detailed: 500,
};

function mandatoryRules(letterType: string): string {
  if (letterType === "outcome") {
    return [
      "MANDATORY CONTENT (outcome letter):",
      "- Explain how the complaint was investigated/considered.",
      "- State the findings clearly.",
      "- Apologise where appropriate (use 'I am sorry' / 'I apologise').",
      "- Describe remedial action and learning the practice will take.",
      "- Include PHSO escalation: Parliamentary and Health Service Ombudsman, telephone 0345 015 4033, web www.ombudsman.org.uk.",
      "- State the 12-month PHSO time limit explicitly.",
      "- Mention free, independent advocacy support.",
    ].join("\n");
  }
  return [
    "MANDATORY CONTENT (acknowledgement letter):",
    "- Confirm receipt of the complaint and thank the complainant.",
    "- Name the contact person or role handling it (e.g. Practice Manager).",
    "- Reference the practice's complaints procedure.",
    "- Offer to discuss the complaint in person or by telephone.",
    "- State the timeframe for the substantive response (working days).",
    "- Mention the right to escalate to the Parliamentary and Health Service Ombudsman (PHSO).",
    "- Mention free, independent advocacy support.",
  ].join("\n");
}

function buildSystemPrompt(opts: {
  letterType: string;
  tone: string;
  length: string;
  mode: Mode;
  practiceName: string | null;
  hasLetterhead: boolean;
}): string {
  const target = LENGTH_TARGETS[opts.length] ?? 300;
  const toneBlock = TONE_BLOCKS[opts.tone] ?? TONE_BLOCKS.formal;
  const modeBlock = ({
    generate: "MODE: Write the full letter from scratch using the supplied complaint context.",
    regenerate: "MODE: Regenerate the letter using the new tone/length/signatory settings. Preserve the user's recipient and signature blocks if obvious from the existing draft; rewrite the body.",
    simplify: "MODE: Rewrite the supplied EXISTING LETTER to a UK reading age of 11 or below. Use short sentences (≤15 words), common words, and active voice. Preserve every mandatory content item — do not drop PHSO details, advocacy mention, or timeframes.",
    "rewrite-section": "MODE: Rewrite ONLY the supplied SECTION TEXT. Return just the rewritten section with no surrounding letter scaffolding.",
  } as Record<Mode, string>)[opts.mode];

  return [
    "You are an NHS GP practice complaints letter writer.",
    "Write in British English. Use plain English aimed at UK reading age 9–11.",
    `Target length: approximately ${target} words for the body (excluding address blocks and signature).`,
    toneBlock,
    modeBlock,
    mandatoryRules(opts.letterType),
    "STRICT RULES:",
    "- Never invent patient details, dates, clinical facts, staff names or events that are not in the supplied complaint record.",
    "- Never use placeholder text such as [insert name] or [TBC] — only use values from the supplied data. If a value is missing, write around it gracefully.",
    "- Use the practice name and signatory exactly as supplied.",
    `- ${opts.hasLetterhead ? "An official letterhead will be rendered above the letter on the page — do NOT add a practice address block at the top of the body. Start directly with the date, recipient and salutation." : "No letterhead is configured for this practice — include the practice name and address at the top of the body."}`,
    "OUTPUT FORMAT: Return the letter body only as Markdown. Do not wrap it in code fences. Do not include any commentary before or after.",
  ].join("\n\n");
}

function markdownToHtml(md: string): string {
  if (!md) return "";
  const escaped = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as ReqBody;
    if (!body?.draftId || !body?.mode) {
      return new Response(JSON.stringify({ error: "draftId and mode are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ---- auth ----
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabase.auth.getUser(token);
      userId = data.user?.id ?? null;
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthenticated request" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authed client so RLS applies for the caller-context check
    const supabaseAuthed = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader! } } },
    );

    // ---- load draft (RLS-checked) ----
    const { data: draft, error: draftErr } = await supabaseAuthed
      .from("complaint_letter_lab_drafts")
      .select("*")
      .eq("id", body.draftId)
      .maybeSingle();
    if (draftErr || !draft) {
      return new Response(JSON.stringify({ error: "Draft not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- load complaint (and gate access via RLS) ----
    const { data: complaint, error: complaintErr } = await supabaseAuthed
      .from("complaints")
      .select("*")
      .eq("id", draft.complaint_id)
      .maybeSingle();
    if (complaintErr || !complaint) {
      return new Response(JSON.stringify({ error: "Complaint access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- load supporting context (service role) ----
    const [
      { data: parties },
      { data: findings },
      { data: signatures },
      { data: practice },
      { data: practiceDetailsRow },
    ] = await Promise.all([
      supabase
        .from("complaint_involved_parties")
        .select("*")
        .eq("complaint_id", complaint.id),
      draft.letter_type === "outcome"
        ? supabase
            .from("complaint_investigation_findings")
            .select("*")
            .eq("complaint_id", complaint.id)
        : Promise.resolve({ data: [] as unknown[] }),
      (draft.signatory_ids && draft.signatory_ids.length > 0
        ? supabase
            .from("complaint_signatures")
            .select("*")
            .in("id", draft.signatory_ids as string[])
        : Promise.resolve({ data: [] as unknown[] })) as Promise<{ data: unknown[] }>,
      complaint.practice_id
        ? supabase
            .from("gp_practices")
            .select("name, address, postcode, ods_code, phone, email")
            .eq("id", complaint.practice_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      complaint.practice_id
        ? supabase
            .from("practice_details")
            .select("practice_name, address, phone, email, website")
            .eq("user_id", complaint.created_by)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // ---- letterhead presence (mirrors getActiveLetterhead) ----
    let hasLetterhead = false;
    if (complaint.practice_id) {
      const { data: lh } = await supabase
        .from("practice_letterheads")
        .select("id")
        .eq("practice_id", complaint.practice_id)
        .eq("active", true)
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      hasLetterhead = !!lh?.id;
    }

    const practiceName =
      (practice as any)?.name ?? (practiceDetailsRow as any)?.practice_name ?? null;

    // ---- build the user message (context payload) ----
    const contextPayload = {
      letterType: draft.letter_type,
      tone: draft.tone,
      length: draft.length,
      letterDate: draft.letter_date,
      responseDueDate: draft.response_due_date,
      referenceNumber: draft.reference_number,
      practice: {
        name: practiceName,
        address: (practice as any)?.address ?? (practiceDetailsRow as any)?.address ?? null,
        phone: (practice as any)?.phone ?? (practiceDetailsRow as any)?.phone ?? null,
        email: (practice as any)?.email ?? (practiceDetailsRow as any)?.email ?? null,
        website: (practiceDetailsRow as any)?.website ?? null,
        hasLetterhead,
      },
      complaint: {
        reference: complaint.reference_number,
        title: complaint.complaint_title,
        description: complaint.complaint_description,
        patientName: complaint.patient_name,
        patientAddress: complaint.patient_address,
        onBehalf: complaint.complaint_on_behalf,
        receivedAt: complaint.submitted_at ?? complaint.created_at,
        status: complaint.status,
      },
      involvedParties: parties ?? [],
      findings: findings ?? [],
      signatories: (signatures as any[] | null) ?? [],
      existingDraftBody: draft.body_markdown ?? "",
      sectionText: body.sectionText ?? null,
    };

    const systemPrompt = buildSystemPrompt({
      letterType: draft.letter_type,
      tone: draft.tone,
      length: draft.length,
      mode: body.mode,
      practiceName,
      hasLetterhead,
    });

    const userMessage = [
      "Here is the full context for the letter as JSON.",
      body.mode === "simplify"
        ? "Use the value of `existingDraftBody` as the letter to simplify."
        : body.mode === "rewrite-section"
          ? "Rewrite ONLY `sectionText` in line with the rules. Return just the rewritten passage."
          : body.mode === "regenerate"
            ? "Regenerate the letter using the supplied tone/length and the existing draft as a reference for any user-edited address/signature blocks."
            : "Write a new letter from scratch.",
      "```json",
      JSON.stringify(contextPayload, null, 2),
      "```",
    ].join("\n\n");

    // ---- call Anthropic ----
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("[letter-lab-generate] Anthropic error:", anthropicRes.status, errText);
      return new Response(
        JSON.stringify({ error: "AI generation failed", details: errText.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const anthropicJson = await anthropicRes.json();
    const bodyMarkdown: string = (anthropicJson?.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    const bodyHtml = markdownToHtml(bodyMarkdown);
    const metrics = computeMetrics(bodyMarkdown);
    const complianceItems = complianceFor(draft.letter_type, bodyMarkdown);

    const warnings: string[] = [];
    if (!hasLetterhead) warnings.push("Letterhead missing for this practice — include practice address in the body.");
    if (metrics.readingAge > 14) warnings.push(`Reading age is ${metrics.readingAge} — above NHS plain English target.`);
    const missing = complianceItems.filter((c) => !c.present).map((c) => c.label);
    if (missing.length) warnings.push(`Missing mandatory content: ${missing.join("; ")}`);

    return new Response(
      JSON.stringify({
        bodyMarkdown,
        bodyHtml,
        readingAge: metrics.readingAge,
        fleschKincaidGrade: metrics.fkGrade,
        complianceItems,
        warnings,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[letter-lab-generate] fatal:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
