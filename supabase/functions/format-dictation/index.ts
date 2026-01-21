import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Bump this when diagnosing production issues so logs clearly show which code is running.
const FUNCTION_VERSION = "2026-01-21-1";

type TemplateType = 'free' | 'consultation' | 'referral' | 'patient-letter' | 'clinical-note' | 'sick-note';

const TEMPLATE_INSTRUCTIONS: Record<TemplateType, string> = {
  'free': `Clean, readable paragraphs only. NO headings unless already dictated.`,
  'consultation': `ONLY use headings if they were already dictated. If no headings were dictated, keep as narrative text. DO NOT invent SOAP or consultation sections.`,
  'referral': `ONLY format as a letter if the dictation clearly indicates this is a letter. Otherwise, keep as clinical narrative.`,
  'patient-letter': `ONLY format as a patient letter if the dictation clearly indicates this. Use clear, jargon-free language.`,
  'clinical-note': `ONLY use headings (HPC, O/E, Impression, Plan) if they were already dictated. Otherwise, keep as narrative text.`,
  'sick-note': `Format as a formal statement of fitness for work. Maintain official, certification-style language.`,
};

// ============================================================================
// PRODUCTION-GRADE NUMERIC VALUE TOKENISATION
// Ensures byte-for-byte preservation of all clinical measurements
// ============================================================================

type LockedMap = Record<string, string>;

// Helper boundary fragments for precise matching
const WORD_BOUNDARY = String.raw`(?:^|[\s(,;:])`;
const WORD_END = String.raw`(?=$|[\s).,;:!?])`;

// Token format: ⟦MEAS:TYPE:0001⟧ - Unicode characters unlikely in real dictation
function makeToken(kind: string, n: number): string {
  return `⟦MEAS:${kind}:${String(n).padStart(4, "0")}⟧`;
}

// ============================================================================
// REGEX PATTERNS - Run in strict order to prevent collisions
// ============================================================================

// 1) Blood pressure (numeric forms) — lock first
// Matches: "BP 178/92", "blood pressure 178/92", "178/92", "178 / 92", "178/92 mmHg"
const RX_BP = new RegExp(
  String.raw`${WORD_BOUNDARY}(?:(?:BP|B\.?P\.?|blood pressure)\s*(?:is|was|:)?\s*)?(\d{2,3}\s*\/\s*\d{2,3})(?:\s*(?:mmhg|mm\s*hg))?${WORD_END}`,
  "gi"
);

// 2) SpO2 / sats (numeric) — preserve percent sign if present
// Matches: "SpO2 96%", "sats 96", "oxygen saturations 96 percent", "O2 sat 96%"
const RX_SPO2 = new RegExp(
  String.raw`${WORD_BOUNDARY}(?:(?:SpO2|SpO₂|sats?|O2\s*sat(?:s)?|oxygen\s*saturation(?:s)?)\s*(?:is|was|:)?\s*)(\d{2,3})(?:\s*(%|percent))?${WORD_END}`,
  "gi"
);

// 3) Temperature (°C) — keep ° if present, keep C/c
// Matches: "temp 37.2", "temperature 37.2 C", "T 38°C"
const RX_TEMP = new RegExp(
  String.raw`${WORD_BOUNDARY}(?:(?:temp(?:erature)?|T)\s*(?:is|was|:)?\s*)(\d{2}(?:\.\d)?)\s*(?:°\s*)?(C|c|°C|°c)?${WORD_END}`,
  "g"
);

// 4) Heart rate / pulse (bpm) — keep bpm if present
// Matches: "HR 78", "heart rate 78 bpm", "pulse 78 regular"
const RX_HR = new RegExp(
  String.raw`${WORD_BOUNDARY}(?:(?:HR|heart rate|pulse)\s*(?:is|was|:)?\s*)(\d{2,3})(?:\s*(bpm))?${WORD_END}`,
  "gi"
);

// 5) Weight — kg, stone/lb (lock both styles)
// Matches: "weight 82 kg", "82kg", "12 stone 4", "12st 4lb"
const RX_WEIGHT_METRIC = new RegExp(
  String.raw`${WORD_BOUNDARY}(?:(?:weight)\s*(?:is|was|:)?\s*)?(\d{2,3}(?:\.\d)?)\s*(kg|kilograms?)${WORD_END}`,
  "gi"
);
const RX_WEIGHT_IMPERIAL = new RegExp(
  String.raw`${WORD_BOUNDARY}(?:(?:weight)\s*(?:is|was|:)?\s*)?(\d{1,2})\s*(?:st|stone)\s*(\d{1,2})?\s*(?:lb|lbs|pounds?)?${WORD_END}`,
  "gi"
);

// 6) Height — cm / m / feet-inches
// Matches: "height 175 cm", "1.75 m", "5'10", "5 ft 10"
const RX_HEIGHT_CM = new RegExp(
  String.raw`${WORD_BOUNDARY}(?:(?:height)\s*(?:is|was|:)?\s*)?(\d{2,3})\s*(cm|centimet(?:er|re)s?)${WORD_END}`,
  "gi"
);
const RX_HEIGHT_M = new RegExp(
  String.raw`${WORD_BOUNDARY}(?:(?:height)\s*(?:is|was|:)?\s*)?(\d\.\d{1,2})\s*(m|met(?:er|re)s?)${WORD_END}`,
  "gi"
);
const RX_HEIGHT_IMPERIAL = new RegExp(
  String.raw`${WORD_BOUNDARY}(?:(?:height)\s*(?:is|was|:)?\s*)?(\d)\s*(?:ft|feet|')\s*(\d{1,2})\s*(?:in|inches|")?${WORD_END}`,
  "gi"
);

// 7) BMI — include kg/m² variants
// Matches: "BMI 26.8", "BMI 26.8 kg/m2", "BMI: 26"
const RX_BMI = new RegExp(
  String.raw`${WORD_BOUNDARY}(?:(?:BMI)\s*(?:is|was|:)?\s*)(\d{2}(?:\.\d)?)\s*(?:kg\s*\/\s*m\s*(?:2|²))?${WORD_END}`,
  "gi"
);

// 8) Glucose (capillary / blood glucose) — mmol/L
// Matches: "BM 8.4", "blood glucose 8.4 mmol/L", "CBG 12.1"
const RX_GLUCOSE = new RegExp(
  String.raw`${WORD_BOUNDARY}(?:(?:BM|CBG|blood glucose|capillary glucose)\s*(?:is|was|:)?\s*)(\d{1,2}(?:\.\d)?)\s*(?:mmol\/l|mmol\s*\/\s*l)?${WORD_END}`,
  "gi"
);

// 9) HbA1c — mmol/mol
// Matches: "HbA1c 48", "HbA1c 48 mmol/mol"
const RX_HBA1C = new RegExp(
  String.raw`${WORD_BOUNDARY}(?:HbA1c\s*(?:is|was|:)?\s*)(\d{2,3})\s*(?:mmol\/mol)?${WORD_END}`,
  "gi"
);

// 10) eGFR
// Matches: "eGFR 68", "eGFR >90"
const RX_EGFR = new RegExp(
  String.raw`${WORD_BOUNDARY}(?:eGFR\s*(?:is|was|:)?\s*)([>]?\d{2,3})${WORD_END}`,
  "gi"
);

// 11) Peak flow / PEFR
// Matches: "peak flow 450", "PEFR 450"
const RX_PEFR = new RegExp(
  String.raw`${WORD_BOUNDARY}(?:(?:peak\s*flow|pefr)\s*(?:is|was|:)?\s*)(\d{2,3})${WORD_END}`,
  "gi"
);

// 12) Respiratory rate
// Matches: "RR 16", "resp rate 16"
const RX_RR = new RegExp(
  String.raw`${WORD_BOUNDARY}(?:(?:rr|resp(?:iratory)?\s*rate)\s*(?:is|was|:)?\s*)(\d{1,2})${WORD_END}`,
  "gi"
);

// 13) Dates — UK style (18th January 2026 / 18 Jan 2026 / 18/01/2026)
const RX_DATE_WORDY = new RegExp(
  String.raw`${WORD_BOUNDARY}(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+\d{2,4})?)${WORD_END}`,
  "gi"
);
const RX_DATE_NUMERIC = new RegExp(
  String.raw`${WORD_BOUNDARY}(\d{1,2}\/\d{1,2}\/\d{2,4})${WORD_END}`,
  "g"
);

// 14) Times — 24h and 12h
// Matches: "14:30", "2:30pm", "2 pm"
const RX_TIME = new RegExp(
  String.raw`${WORD_BOUNDARY}(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))${WORD_END}`,
  "gi"
);

// 15) Durations — shorthand and spelled out
// Matches: "2/7", "3/52", "for 2 weeks"
const RX_DURATION_SHORTHAND = new RegExp(
  String.raw`${WORD_BOUNDARY}(\d{1,2}\s*\/\s*(?:7|52|12))${WORD_END}`,
  "g"
);
const RX_DURATION_NUM = new RegExp(
  String.raw`${WORD_BOUNDARY}(\d{1,3})\s*(days?|weeks?|months?|years?)${WORD_END}`,
  "gi"
);

// 16) Medication doses - preserve exact format
// Matches: "500mg", "10 ml", "2.5mg", "100 units", "100 micrograms"
const RX_MED_DOSE = new RegExp(
  String.raw`${WORD_BOUNDARY}(\d+(?:\.\d+)?)\s*(mg|mcg|µg|micrograms?|ml|g|units?|iu)${WORD_END}`,
  "gi"
);

// 17) Tablet/capsule counts
// Matches: "1 tablet", "2 tablets", "2 puffs"
const RX_TABLET_COUNT = new RegExp(
  String.raw`${WORD_BOUNDARY}(\d+)\s*(tablets?|capsules?|puffs?|drops?|sachets?)${WORD_END}`,
  "gi"
);

// ============================================================================
// TOKENISATION FUNCTIONS
// ============================================================================

function lockWithRegex(
  input: string,
  rx: RegExp,
  kind: string,
  counterRef: { n: number },
  locked: LockedMap
): string {
  return input.replace(rx, (match) => {
    // CRITICAL: Preserve exact matched text - byte-for-byte identical
    const token = makeToken(kind, ++counterRef.n);
    locked[token] = match;
    return token;
  });
}

/**
 * Lock all clinical measurements with protected tokens.
 * Patterns run in strict order to prevent collisions.
 */
function lockAllMeasurements(text: string): { protectedText: string; locked: LockedMap } {
  const locked: LockedMap = {};
  const counterRef = { n: 0 };

  // Order matters - prevents collisions (e.g., BP fractions vs dates)
  let out = text;

  // 1. Blood pressure first (fraction format)
  out = lockWithRegex(out, RX_BP, "BP", counterRef, locked);

  // 2-4. Vital signs
  out = lockWithRegex(out, RX_SPO2, "SPO2", counterRef, locked);
  out = lockWithRegex(out, RX_TEMP, "TEMP", counterRef, locked);
  out = lockWithRegex(out, RX_HR, "HR", counterRef, locked);

  // 5. Weight (metric and imperial)
  out = lockWithRegex(out, RX_WEIGHT_METRIC, "WT", counterRef, locked);
  out = lockWithRegex(out, RX_WEIGHT_IMPERIAL, "WT", counterRef, locked);

  // 6. Height (all formats)
  out = lockWithRegex(out, RX_HEIGHT_CM, "HT", counterRef, locked);
  out = lockWithRegex(out, RX_HEIGHT_M, "HT", counterRef, locked);
  out = lockWithRegex(out, RX_HEIGHT_IMPERIAL, "HT", counterRef, locked);

  // 7-12. Derived values and labs
  out = lockWithRegex(out, RX_BMI, "BMI", counterRef, locked);
  out = lockWithRegex(out, RX_GLUCOSE, "GLU", counterRef, locked);
  out = lockWithRegex(out, RX_HBA1C, "HBA1C", counterRef, locked);
  out = lockWithRegex(out, RX_EGFR, "EGFR", counterRef, locked);
  out = lockWithRegex(out, RX_PEFR, "PEFR", counterRef, locked);
  out = lockWithRegex(out, RX_RR, "RR", counterRef, locked);

  // 13. Dates (wordy before numeric to catch longer matches first)
  out = lockWithRegex(out, RX_DATE_WORDY, "DATE", counterRef, locked);
  out = lockWithRegex(out, RX_DATE_NUMERIC, "DATE", counterRef, locked);

  // 14. Times
  out = lockWithRegex(out, RX_TIME, "TIME", counterRef, locked);

  // 15. Durations (shorthand before spelled to prevent /7 consuming)
  out = lockWithRegex(out, RX_DURATION_SHORTHAND, "DUR", counterRef, locked);
  out = lockWithRegex(out, RX_DURATION_NUM, "DUR", counterRef, locked);

  // 16-17. Medication doses and counts
  out = lockWithRegex(out, RX_MED_DOSE, "MED", counterRef, locked);
  out = lockWithRegex(out, RX_TABLET_COUNT, "MED", counterRef, locked);

  console.log(`🔒 Locked ${Object.keys(locked).length} clinical values`);
  if (Object.keys(locked).length > 0) {
    console.log(`📋 Token map:`, JSON.stringify(locked, null, 2));
  }

  return { protectedText: out, locked };
}

/**
 * Restore all protected tokens with their original exact values.
 * Byte-for-byte identical reinsertion.
 */
function unlockAllMeasurements(text: string, locked: LockedMap): string {
  return text.replace(/⟦MEAS:[A-Z0-9]+:\d{4}⟧/g, (token) => locked[token] ?? token);
}

/**
 * Count tokens in text for validation.
 */
function countTokens(s: string): number {
  const m = s.match(/⟦MEAS:[A-Z0-9]+:\d{4}⟧/g);
  return m ? m.length : 0;
}

/**
 * Minimal cleanup fallback when LLM processing fails or loses tokens.
 * Only applies basic punctuation fixes without risking value changes.
 */
function minimalCleanup(text: string): string {
  return text
    // Basic sentence capitalisation
    .replace(/(^|[.!?]\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase())
    // Ensure ending punctuation
    .replace(/([a-zA-Z])$/, "$1.")
    .trim();
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

function buildSystemPrompt(templateInstruction: string): string {
  return `You are a UK GP medical dictation cleaner and formatter.

Your role is NOT to summarise, reinterpret, or optimise clinical content.

Your role is ONLY to lightly clean, correct, and format dictated text so it reads clearly and professionally while preserving the original clinical meaning exactly.

This output must be safe for inclusion in a UK GP clinical record.

────────────────────────────────
PROTECTED VALUE TOKENS (CRITICAL)
────────────────────────────────

The text contains tokens like ⟦MEAS:BP:0001⟧, ⟦MEAS:HR:0002⟧, ⟦MEAS:TEMP:0003⟧, etc.
These are protected clinical value placeholders.

ABSOLUTE REQUIREMENT: DO NOT modify, remove, reformat, or reinterpret these tokens.
- Keep them exactly as written in the text
- Do not change the token names or numbers
- Do not merge or split tokens
- Do not move them to different positions
- They will be replaced with exact values after processing

────────────────────────────────
CORE SAFETY RULES (CRITICAL)
────────────────────────────────

1. DO NOT add, infer, summarise, omit, or reinterpret any clinical information.
2. DO NOT introduce diagnoses, plans, safety-netting, or clinical reasoning that was not explicitly dictated.
3. DO NOT convert narrative into conclusions or assessments.
4. If something is ambiguous, KEEP it ambiguous.
5. If something sounds incomplete, LEAVE it incomplete.
6. Preserve uncertainty exactly as spoken (e.g. "possibly", "may be", "unclear").
7. Do not strengthen or soften clinical judgement.
8. Preserve the clinician's original level of certainty exactly as spoken.

This is a transcription tidy-up, NOT a clinical optimiser.

────────────────────────────────
LANGUAGE & STYLE
────────────────────────────────

• Use British English throughout (organised, centre, oedema, anaemia).
• Maintain a professional GP tone suitable for EMIS or SystmOne.
• Do not over-formalise conversational dictation.
• Do not rewrite into a referral or letter unless explicitly instructed by the template.

────────────────────────────────
TEXT CLEAN-UP RULES
────────────────────────────────

• Remove filler words ONLY where clearly non-clinical:
  ("um", "uh", "you know", "sort of", "kind of", "basically")
• Fix obvious speech-to-text errors ONLY when meaning is clear.
• Fix repeated words ("the the", "and and").
• Improve punctuation and capitalisation.
• Add paragraph breaks at natural pauses or topic changes.
• Preserve original sentence order unless absolutely required for clarity.

────────────────────────────────
STRUCTURE
────────────────────────────────

• Do not collapse examination findings into interpretation.
• Preserve examination, impression, and plan content as dictated.

────────────────────────────────
MEDICAL ABBREVIATIONS
────────────────────────────────

• Use standard UK abbreviations where appropriate:
  BP, HR, SpO₂, BMI, ECG, CXR, SOB, T2DM, HTN
• Do NOT expand abbreviations unless they were spoken in full.

────────────────────────────────
DATES & TIMES
────────────────────────────────

• Use UK date format: 18th January 2026
• Preserve relative dates as spoken (e.g. "two weeks ago")

────────────────────────────────
TEMPLATE BEHAVIOUR
────────────────────────────────

${templateInstruction}

────────────────────────────────
OUTPUT RULES
────────────────────────────────

• Return ONLY the cleaned and formatted text.
• Preserve ALL ⟦MEAS:...⟧ tokens exactly as they appear.
• No explanations.
• No markdown.
• No added commentary.
• No emojis.
• No bullet points unless clearly dictated.`;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, templateType } = await req.json();

    if (!content || typeof content !== "string") {
      return new Response(
        JSON.stringify({ error: "Content is required and must be a string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const template = (templateType as TemplateType) || "free";
    const templateInstruction = TEMPLATE_INSTRUCTIONS[template] || TEMPLATE_INSTRUCTIONS.free;

    console.log(`🧩 format-dictation version: ${FUNCTION_VERSION}`);

    console.log("📝 Processing dictation, length:", content.length);
    console.log("📋 Template type:", template);

    // Step 1: Lock all clinical measurements with protected tokens
    const { protectedText, locked } = lockAllMeasurements(content);
    const tokenCountBefore = countTokens(protectedText);

    console.log(`🔐 Protected text ready, ${tokenCountBefore} tokens locked`);

    // Choose provider:
    // - Prefer Lovable AI Gateway when available (most of the app uses this).
    // - Fall back to direct OpenAI only if gateway key is missing.
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    let endpoint: string;
    let authKey: string;
    let model: string;

    if (lovableKey) {
      endpoint = "https://ai.gateway.lovable.dev/v1/chat/completions";
      authKey = lovableKey;
      model = "google/gemini-3-flash-preview";
      console.log("🔑 Using Lovable AI Gateway (Gemini 3 Flash) for dictation formatting");
    } else if (openaiKey) {
      endpoint = "https://api.openai.com/v1/chat/completions";
      authKey = openaiKey;
      model = "gpt-4o-mini";
      console.log("🔑 Using OpenAI direct API for dictation formatting");
    } else {
      console.error("No AI API key configured (LOVABLE_API_KEY or OPENAI_API_KEY)");
      return new Response(
        JSON.stringify({ error: "No AI API key configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Defensive normalisation: if any legacy model IDs slip through on the gateway, map to a supported default.
    const isGateway = endpoint.includes("ai.gateway.lovable.dev");
    if (isGateway && (model === "gpt-4o-mini" || model === "openai/gpt-4o-mini")) {
      console.log(`↩️ Remapping legacy model '${model}' to 'google/gemini-3-flash-preview' for gateway compatibility`);
      model = "google/gemini-3-flash-preview";
    }
    console.log(`🧭 Provider: ${isGateway ? "lovable-gateway" : "openai-direct"} | model: ${model}`);

    // Build system prompt
    const systemPrompt = buildSystemPrompt(templateInstruction);

    // Step 2: Send protected text to LLM for formatting
    console.log("🤖 Sending to LLM for formatting...");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${authKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Please format and clean up the following dictated consultation notes:\n\n${protectedText}` },
        ],
        // NOTE: Some models (notably GPT-5 variants via compatible gateways) reject non-default temperature.
        // Omitting `temperature` keeps broad compatibility.
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to format dictation", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const formattedWithTokens = data.choices?.[0]?.message?.content?.trim();

    if (!formattedWithTokens) {
      console.error("No content in OpenAI response");
      return new Response(
        JSON.stringify({ error: "No formatted content returned" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Validate token preservation (fail-closed safety)
    const tokenCountAfter = countTokens(formattedWithTokens);

    if (tokenCountBefore !== tokenCountAfter) {
      console.error(`❌ TOKEN LOSS DETECTED: ${tokenCountBefore} → ${tokenCountAfter}`);
      console.error("LLM removed or corrupted protected tokens. Failing closed.");
      
      // Find which tokens were lost
      const tokensInOriginal = protectedText.match(/⟦MEAS:[A-Z0-9]+:\d{4}⟧/g) || [];
      const tokensInResult = formattedWithTokens.match(/⟦MEAS:[A-Z0-9]+:\d{4}⟧/g) || [];
      const lostTokens = tokensInOriginal.filter(t => !tokensInResult.includes(t));
      console.error("Lost tokens:", lostTokens);

      // Fail closed: return original with minimal cleanup
      const safeOutput = minimalCleanup(unlockAllMeasurements(protectedText, locked));
      
      return new Response(
        JSON.stringify({ 
          formattedContent: safeOutput,
          warning: "LLM processing failed validation. Returned minimally cleaned original.",
          tokensLost: lostTokens.length
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Token validation passed: ${tokenCountAfter} tokens preserved`);

    // Step 4: Restore original values (byte-for-byte identical)
    const finalContent = unlockAllMeasurements(formattedWithTokens, locked);

    console.log("✨ Dictation formatted successfully");

    return new Response(
      JSON.stringify({ formattedContent: finalContent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in format-dictation function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
