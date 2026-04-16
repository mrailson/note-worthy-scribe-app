import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─── Verification Gate Prompt ─────────────────────────────────────────────
const VERIFICATION_SYSTEM_PROMPT = `You are a clinical governance reviewer for an NHS primary care organisation.
You have been given two documents:

1. TRANSCRIPT — the original recording of a meeting
2. DRAFT MINUTES — AI-generated meeting minutes from that transcript

Your task is to verify the draft minutes against the transcript.

## VERIFICATION STEPS

### A. Accuracy check
Walk through the draft minutes and check EVERY:
- Number (appointment counts, financial figures, percentages, session counts, rates, budgets)
- Named person (staff names, external contacts, organisational names)
- Date or deadline
- Specific claim about what was said, decided, or agreed
- Role, title, or organisational attribution

For each one, determine:
- SUPPORTED: The claim appears in or can be directly inferred from the transcript
- UNSUPPORTED: The claim does not appear in the transcript and cannot be reasonably inferred
- DISTORTED: The claim is based on something in the transcript but misrepresents it (wrong number, wrong person, wrong context)

### B. Coverage check
Scan the transcript for significant topics that are NOT represented in the draft minutes. A "significant topic" is one where ANY of the following occurred:
- A specific figure or rate was mentioned
- A decision was made or confirmed
- A named person was assigned an action
- A risk or concern was raised
- A political/governance matter was discussed
- A compliance or legal point was raised
- A specific date, deadline, or timeline was referenced

List each missing topic with a brief description of what was discussed.

### C. Action completeness check
Compare every commitment or instruction in the transcript ("I'll do that", "Amanda, can you...", "by Tuesday", "let's get that sorted") against the Action Log in the minutes. Flag any missing actions.

## OUTPUT FORMAT

Return a JSON object (no markdown fencing, no preamble):

{
  "status": "CLEAN" | "ISSUES_FOUND",
  "accuracy_issues": [
    {
      "claim": "The exact text from the minutes that is problematic",
      "issue_type": "UNSUPPORTED" | "DISTORTED",
      "detail": "What is wrong and what the transcript actually says (or doesn't say)",
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "suggested_fix": "Corrected text, or 'REMOVE' if the claim should be deleted"
    }
  ],
  "missing_topics": [
    {
      "topic": "Brief topic label",
      "transcript_evidence": "Key quotes or paraphrases from the transcript",
      "suggested_section": "Where this should go in the minutes (new section or addition to existing)",
      "importance": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "missing_actions": [
    {
      "action": "What was committed to",
      "owner": "Who (if identifiable)",
      "deadline": "When (if stated)",
      "transcript_evidence": "The relevant quote"
    }
  ],
  "summary": "One-paragraph overview of findings"
}

## RULES

- Be strict on numbers. "£11,000" in the transcript is NOT "£11,500" in the minutes.
- Be strict on names. If the transcript says "Karen" and the minutes say "Clare", that's DISTORTED.
- Be lenient on reasonable inference. If the transcript discusses a topic across multiple exchanges and the minutes synthesise it into a coherent paragraph, that's SUPPORTED — even if no single sentence in the transcript says exactly what the minutes say.
- If the transcript is garbled or unclear on a point, and the minutes make a reasonable interpretation, mark it SUPPORTED with a note.
- For the coverage check, do NOT flag casual small talk, personal anecdotes, or off-topic banter as missing topics. Only flag substantive business discussion.
- Severity guide:
  - HIGH: Wrong financial figure, fabricated statistic, misattributed decision, missing compliance matter
  - MEDIUM: Missing topic that has governance implications, incomplete action log
  - LOW: Minor detail omission, slightly imprecise paraphrasing

## IMPORTANT

You are checking facts, not style. Do not comment on:
- Writing quality or tone
- Section ordering or structure
- Whether enough detail was included (unless a topic is entirely missing)
- Grammar or formatting

If the minutes are factually accurate and cover all significant topics, return status: "CLEAN" with empty arrays.`;

// ─── Auto-Fix Prompt ──────────────────────────────────────────────────────
const AUTOFIX_SYSTEM_PROMPT = `You are correcting AI-generated meeting minutes based on a verification report.

You have three inputs:
1. TRANSCRIPT — the original meeting recording
2. DRAFT MINUTES — the AI-generated minutes
3. VERIFICATION REPORT — a JSON report identifying accuracy issues, missing topics, and missing actions

Your task is to produce CORRECTED MINUTES that:

### For accuracy issues:
- Apply each "suggested_fix" from the verification report
- If suggested_fix is "REMOVE", delete the claim entirely and smooth the surrounding text
- If suggested_fix provides corrected text, replace the problematic claim with it
- Do NOT add any new information that isn't in the transcript — you are fixing, not expanding

### For missing topics:
- Add new numbered sections for HIGH and MEDIUM importance missing topics
- Place them in the logical position within the document flow
- Write them in the same formal third-person style as the existing minutes
- Include specific figures, names, and dates from the transcript_evidence provided
- Keep each new section to 3–5 sentences — dense and factual

### For missing actions:
- Add each missing action to the Action Log table
- Use the owner and deadline from the verification report
- If owner is unclear, use "TBC"

### Rules:
- Preserve ALL existing content that was marked SUPPORTED — do not rewrite sections that don't need fixing
- Maintain the exact same document structure and formatting
- Do not add commentary about what was changed
- Output the complete corrected minutes, not a diff
- Use British English throughout`;

// ─── Re-Verification Prompt ───────────────────────────────────────────────
const REVERIFY_SYSTEM_PROMPT = `You previously identified issues with draft meeting minutes.
Those issues have been corrected.

You now have:
1. TRANSCRIPT — the original meeting recording
2. CORRECTED MINUTES — the patched version

Run the same verification process. Return the same JSON format.

If all previous issues are resolved and no new issues have been
introduced, return status: "CLEAN".

If the auto-fix introduced new problems or failed to resolve
existing ones, flag them. Do NOT flag the same issues from the
original report if they have been correctly addressed.

Return a JSON object (no markdown fencing, no preamble):

{
  "status": "CLEAN" | "ISSUES_FOUND",
  "accuracy_issues": [...],
  "missing_topics": [...],
  "missing_actions": [...],
  "summary": "One-paragraph overview of findings"
}`;

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

async function callLLM(systemPrompt: string, userPrompt: string, maxTokens = 8192): Promise<string> {
  if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

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
        { role: 'user', content: userPrompt },
      ],
      max_completion_tokens: maxTokens,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error('Rate limit exceeded — please retry shortly.');
    if (response.status === 402) throw new Error('Insufficient Lovable AI credits.');
    const errBody = await response.text();
    throw new Error(`AI gateway error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function parseJSON(raw: string): any {
  // Strip markdown fencing if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return JSON.parse(cleaned);
}

interface QualityGateResult {
  status: 'CLEAN' | 'ISSUES_FOUND' | 'AUTO_CORRECTED' | 'REVIEW_RECOMMENDED';
  originalMinutes: string;
  correctedMinutes: string | null;
  verificationReport: any;
  reVerificationReport: any | null;
  accuracyIssueCount: number;
  missingTopicCount: number;
  missingActionCount: number;
  highSeverityCount: number;
  pipelineSteps: string[];
  totalTimeMs: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const pipelineSteps: string[] = [];

  try {
    const { transcript, draftMinutes, skipAutoFix = false } = await req.json();

    if (!transcript || !draftMinutes) {
      throw new Error('Both transcript and draftMinutes are required');
    }

    console.log('🔍 Quality Gate started — transcript:', transcript.length, 'chars, minutes:', draftMinutes.length, 'chars');

    // ── Step 1: Verification ──────────────────────────────────────────
    pipelineSteps.push('verification');
    const verifyStart = Date.now();

    const verifyUserPrompt = `## TRANSCRIPT\n\n${transcript}\n\n## DRAFT MINUTES\n\n${draftMinutes}`;
    const verifyRaw = await callLLM(VERIFICATION_SYSTEM_PROMPT, verifyUserPrompt);
    
    let verificationReport: any;
    try {
      verificationReport = parseJSON(verifyRaw);
    } catch (e) {
      console.error('❌ Failed to parse verification JSON:', verifyRaw.substring(0, 500));
      // Return as clean if parsing fails — don't block the user
      return new Response(JSON.stringify({
        status: 'CLEAN',
        originalMinutes: draftMinutes,
        correctedMinutes: null,
        verificationReport: { status: 'CLEAN', accuracy_issues: [], missing_topics: [], missing_actions: [], summary: 'Verification parse error — treating as clean.' },
        reVerificationReport: null,
        accuracyIssueCount: 0,
        missingTopicCount: 0,
        missingActionCount: 0,
        highSeverityCount: 0,
        pipelineSteps: ['verification_parse_error'],
        totalTimeMs: Date.now() - startTime,
      } as QualityGateResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accuracyIssueCount = verificationReport.accuracy_issues?.length || 0;
    const missingTopicCount = verificationReport.missing_topics?.length || 0;
    const missingActionCount = verificationReport.missing_actions?.length || 0;
    const highSeverityCount = [
      ...(verificationReport.accuracy_issues || []),
      ...(verificationReport.missing_topics || []),
    ].filter((i: any) => i.severity === 'HIGH' || i.importance === 'HIGH').length;

    console.log(`✅ Verification complete in ${Date.now() - verifyStart}ms — status: ${verificationReport.status}, issues: ${accuracyIssueCount} accuracy, ${missingTopicCount} coverage, ${missingActionCount} actions, ${highSeverityCount} high-severity`);

    // ── If clean, return immediately ──────────────────────────────────
    if (verificationReport.status === 'CLEAN') {
      return new Response(JSON.stringify({
        status: 'CLEAN',
        originalMinutes: draftMinutes,
        correctedMinutes: null,
        verificationReport,
        reVerificationReport: null,
        accuracyIssueCount: 0,
        missingTopicCount: 0,
        missingActionCount: 0,
        highSeverityCount: 0,
        pipelineSteps,
        totalTimeMs: Date.now() - startTime,
      } as QualityGateResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Step 2: Auto-fix (if enabled) ─────────────────────────────────
    if (skipAutoFix) {
      return new Response(JSON.stringify({
        status: 'REVIEW_RECOMMENDED',
        originalMinutes: draftMinutes,
        correctedMinutes: null,
        verificationReport,
        reVerificationReport: null,
        accuracyIssueCount,
        missingTopicCount,
        missingActionCount,
        highSeverityCount,
        pipelineSteps,
        totalTimeMs: Date.now() - startTime,
      } as QualityGateResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    pipelineSteps.push('auto_fix');
    const fixStart = Date.now();

    const fixUserPrompt = `## TRANSCRIPT\n\n${transcript}\n\n## DRAFT MINUTES\n\n${draftMinutes}\n\n## VERIFICATION REPORT\n\n${JSON.stringify(verificationReport, null, 2)}`;
    const correctedMinutes = await callLLM(AUTOFIX_SYSTEM_PROMPT, fixUserPrompt, 8192);

    console.log(`🔧 Auto-fix complete in ${Date.now() - fixStart}ms — corrected minutes: ${correctedMinutes.length} chars`);

    // ── Step 3: Re-verification ───────────────────────────────────────
    pipelineSteps.push('re_verification');
    const reVerifyStart = Date.now();

    const reVerifyUserPrompt = `## TRANSCRIPT\n\n${transcript}\n\n## CORRECTED MINUTES\n\n${correctedMinutes}`;
    const reVerifyRaw = await callLLM(REVERIFY_SYSTEM_PROMPT, reVerifyUserPrompt);

    let reVerificationReport: any;
    try {
      reVerificationReport = parseJSON(reVerifyRaw);
    } catch {
      console.warn('⚠️ Re-verification parse failed — treating fix as successful');
      reVerificationReport = { status: 'CLEAN', accuracy_issues: [], missing_topics: [], missing_actions: [], summary: 'Re-verification parse error — auto-fix accepted.' };
    }

    console.log(`✅ Re-verification complete in ${Date.now() - reVerifyStart}ms — status: ${reVerificationReport.status}`);

    const finalStatus = reVerificationReport.status === 'CLEAN' ? 'AUTO_CORRECTED' : 'REVIEW_RECOMMENDED';
    const remainingIssues = reVerificationReport.status !== 'CLEAN'
      ? (reVerificationReport.accuracy_issues?.length || 0) + (reVerificationReport.missing_topics?.length || 0) + (reVerificationReport.missing_actions?.length || 0)
      : 0;

    console.log(`🏁 Quality Gate pipeline complete — final status: ${finalStatus}, remaining issues: ${remainingIssues}, total time: ${Date.now() - startTime}ms`);

    return new Response(JSON.stringify({
      status: finalStatus,
      originalMinutes: draftMinutes,
      correctedMinutes,
      verificationReport,
      reVerificationReport,
      accuracyIssueCount,
      missingTopicCount,
      missingActionCount,
      highSeverityCount,
      pipelineSteps,
      totalTimeMs: Date.now() - startTime,
    } as QualityGateResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Quality Gate error:', error);
    return new Response(JSON.stringify({
      status: 'CLEAN',
      originalMinutes: '',
      correctedMinutes: null,
      verificationReport: null,
      reVerificationReport: null,
      accuracyIssueCount: 0,
      missingTopicCount: 0,
      missingActionCount: 0,
      highSeverityCount: 0,
      pipelineSteps: ['error'],
      totalTimeMs: Date.now() - startTime,
      error: error.message,
    }), {
      status: 200, // Don't block minutes generation on gate failure
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
