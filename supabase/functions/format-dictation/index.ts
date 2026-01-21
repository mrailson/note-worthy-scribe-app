import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type TemplateType = 'free' | 'consultation' | 'referral' | 'patient-letter' | 'clinical-note' | 'sick-note';

const TEMPLATE_INSTRUCTIONS: Record<TemplateType, string> = {
  'free': `Clean, readable paragraphs only. NO headings unless already dictated.`,
  'consultation': `ONLY use headings if they were already dictated. If no headings were dictated, keep as narrative text. DO NOT invent SOAP or consultation sections.`,
  'referral': `ONLY format as a letter if the dictation clearly indicates this is a letter. Otherwise, keep as clinical narrative.`,
  'patient-letter': `ONLY format as a patient letter if the dictation clearly indicates this. Use clear, jargon-free language.`,
  'clinical-note': `ONLY use headings (HPC, O/E, Impression, Plan) if they were already dictated. Otherwise, keep as narrative text.`,
  'sick-note': `Format as a formal statement of fitness for work. Maintain official, certification-style language.`,
};

// ═══════════════════════════════════════════════════════════════════
// NUMERICAL VALUE PROTECTION LAYER
// Tokenises clinical values BEFORE LLM processing to guarantee immutability
// ═══════════════════════════════════════════════════════════════════

interface TokenisationResult {
  protectedText: string;
  tokenMap: Map<string, string>;
}

function protectNumericalValues(text: string): TokenisationResult {
  const tokenMap = new Map<string, string>();
  let protectedText = text;
  let tokenCounter = {
    BP: 0,
    HR: 0,
    SPO2: 0,
    TEMP: 0,
    MEAS: 0,
    DATE: 0,
    DUR: 0,
    MED: 0,
  };

  // We'll collect all matches first, then replace in reverse order
  interface Match {
    fullMatch: string;
    value: string;
    type: keyof typeof tokenCounter;
    index: number;
  }
  
  const allMatches: Match[] = [];

  // Blood pressure: "178/92", "178 over 92", "BP 178/92"
  const bpRegex = /\b(\d{2,3})\s*(?:\/|over)\s*(\d{2,3})\b/gi;
  let match;
  while ((match = bpRegex.exec(text)) !== null) {
    allMatches.push({
      fullMatch: match[0],
      value: `${match[1]}/${match[2]}`,
      type: 'BP',
      index: match.index
    });
  }

  // Heart rate/Pulse with context: "pulse 78", "HR 78", "heart rate 78"
  const hrRegex = /\b(?:pulse|hr|heart\s*rate)\s*(?:is|was|of|at|:)?\s*(\d{2,3})\s*(?:bpm|beats?\s*per\s*min(?:ute)?)?/gi;
  while ((match = hrRegex.exec(text)) !== null) {
    allMatches.push({
      fullMatch: match[0],
      value: match[1],
      type: 'HR',
      index: match.index
    });
  }

  // Oxygen saturation: "sats 96", "SpO2 96%", "oxygen 96"
  const spo2Regex = /\b(?:sats?|spo2|oxygen\s*sats?|o2\s*sats?)\s*(?:is|was|of|at|:)?\s*(\d{2,3})\s*%?/gi;
  while ((match = spo2Regex.exec(text)) !== null) {
    allMatches.push({
      fullMatch: match[0],
      value: match[1],
      type: 'SPO2',
      index: match.index
    });
  }

  // Temperature: "temp 37.2", "temperature 37.2°C"
  const tempRegex = /\b(?:temp(?:erature)?)\s*(?:is|was|of|at|:)?\s*(\d{2}(?:\.\d{1,2})?)\s*(?:°?C|degrees?|celsius)?/gi;
  while ((match = tempRegex.exec(text)) !== null) {
    allMatches.push({
      fullMatch: match[0],
      value: match[1],
      type: 'TEMP',
      index: match.index
    });
  }

  // Temperature with unit but no prefix: "37.2°C", "37.2 degrees"
  const tempUnitRegex = /\b(\d{2}(?:\.\d{1,2})?)\s*(?:°C|degrees?\s*(?:celsius)?)/gi;
  while ((match = tempUnitRegex.exec(text)) !== null) {
    // Avoid duplicates
    const alreadyMatched = allMatches.some(m => 
      m.type === 'TEMP' && Math.abs(m.index - match!.index) < 5
    );
    if (!alreadyMatched) {
      allMatches.push({
        fullMatch: match[0],
        value: match[1],
        type: 'TEMP',
        index: match.index
      });
    }
  }

  // Weight: "82 kg", "weight 82 kg"
  const weightRegex = /\b(?:weight\s*(?:is|was|of|at|:)?\s*)?(\d{2,3}(?:\.\d{1,2})?)\s*kg\b/gi;
  while ((match = weightRegex.exec(text)) !== null) {
    allMatches.push({
      fullMatch: match[0],
      value: `${match[1]} kg`,
      type: 'MEAS',
      index: match.index
    });
  }

  // Height: "175 cm", "height 175 cm"
  const heightRegex = /\b(?:height\s*(?:is|was|of|at|:)?\s*)?(\d{2,3}(?:\.\d{1,2})?)\s*cm\b/gi;
  while ((match = heightRegex.exec(text)) !== null) {
    allMatches.push({
      fullMatch: match[0],
      value: `${match[1]} cm`,
      type: 'MEAS',
      index: match.index
    });
  }

  // BMI: "BMI 26.8"
  const bmiRegex = /\bBMI\s*(?:is|was|of|at|:)?\s*(\d{1,2}(?:\.\d{1,2})?)/gi;
  while ((match = bmiRegex.exec(text)) !== null) {
    allMatches.push({
      fullMatch: match[0],
      value: `BMI ${match[1]}`,
      type: 'MEAS',
      index: match.index
    });
  }

  // Blood glucose: "8.4 mmol/L", "glucose 8.4"
  const glucoseRegex = /\b(?:(?:blood\s+)?glucose\s*(?:is|was|of|at|:)?\s*)?(\d{1,2}(?:\.\d{1,2})?)\s*mmol\/L\b/gi;
  while ((match = glucoseRegex.exec(text)) !== null) {
    allMatches.push({
      fullMatch: match[0],
      value: `${match[1]} mmol/L`,
      type: 'MEAS',
      index: match.index
    });
  }

  // HbA1c: "HbA1c 48"
  const hba1cRegex = /\bHbA1c\s*(?:is|was|of|at|:)?\s*(\d{2,3})\s*(?:mmol\/mol)?/gi;
  while ((match = hba1cRegex.exec(text)) !== null) {
    allMatches.push({
      fullMatch: match[0],
      value: `HbA1c ${match[1]}`,
      type: 'MEAS',
      index: match.index
    });
  }

  // eGFR: "eGFR 68", "eGFR >90"
  const egfrRegex = /\beGFR\s*(?:is|was|of|at|:)?\s*([>]?\d{2,3})/gi;
  while ((match = egfrRegex.exec(text)) !== null) {
    allMatches.push({
      fullMatch: match[0],
      value: `eGFR ${match[1]}`,
      type: 'MEAS',
      index: match.index
    });
  }

  // Peak flow: "peak flow 450", "PEFR 450"
  const pefrRegex = /\b(?:peak\s*flow|pefr)\s*(?:is|was|of|at|:)?\s*(\d{2,3})/gi;
  while ((match = pefrRegex.exec(text)) !== null) {
    allMatches.push({
      fullMatch: match[0],
      value: match[1],
      type: 'MEAS',
      index: match.index
    });
  }

  // Respiratory rate: "RR 16", "resp rate 16"
  const rrRegex = /\b(?:rr|resp(?:iratory)?\s*rate)\s*(?:is|was|of|at|:)?\s*(\d{1,2})/gi;
  while ((match = rrRegex.exec(text)) !== null) {
    allMatches.push({
      fullMatch: match[0],
      value: match[1],
      type: 'MEAS',
      index: match.index
    });
  }

  // UK dates: "18th January 2026", "18 January 2026"
  const dateRegex = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi;
  while ((match = dateRegex.exec(text)) !== null) {
    allMatches.push({
      fullMatch: match[0],
      value: match[0],
      type: 'DATE',
      index: match.index
    });
  }

  // Numeric dates: "18/01/2026", "18-01-2026"
  const numericDateRegex = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g;
  while ((match = numericDateRegex.exec(text)) !== null) {
    allMatches.push({
      fullMatch: match[0],
      value: match[0],
      type: 'DATE',
      index: match.index
    });
  }

  // Durations: "2 weeks", "3 days", "6 months"
  const durRegex = /\b(\d+)\s*(days?|weeks?|months?|years?)\b/gi;
  while ((match = durRegex.exec(text)) !== null) {
    allMatches.push({
      fullMatch: match[0],
      value: match[0],
      type: 'DUR',
      index: match.index
    });
  }

  // Medication doses: "500mg", "10ml", "2.5mg", "100 micrograms"
  const medDoseRegex = /\b(\d+(?:\.\d+)?)\s*(mg|mcg|micrograms?|ml|g|units?|iu)\b/gi;
  while ((match = medDoseRegex.exec(text)) !== null) {
    allMatches.push({
      fullMatch: match[0],
      value: match[0],
      type: 'MED',
      index: match.index
    });
  }

  // Tablet counts: "1 tablet", "2 tablets"
  const tabletRegex = /\b(\d+)\s*(tablets?|capsules?|puffs?|drops?|sachets?)\b/gi;
  while ((match = tabletRegex.exec(text)) !== null) {
    allMatches.push({
      fullMatch: match[0],
      value: match[0],
      type: 'MED',
      index: match.index
    });
  }

  // Sort by index descending (to replace from end to start, preserving indices)
  allMatches.sort((a, b) => b.index - a.index);

  // Remove overlapping matches (keep the one that appears first in original order)
  const processedRanges: Array<{start: number, end: number}> = [];
  const uniqueMatches = allMatches.filter(m => {
    const start = m.index;
    const end = m.index + m.fullMatch.length;
    
    const overlaps = processedRanges.some(range => 
      (start >= range.start && start < range.end) ||
      (end > range.start && end <= range.end) ||
      (start <= range.start && end >= range.end)
    );
    
    if (!overlaps) {
      processedRanges.push({ start, end });
      return true;
    }
    return false;
  });

  // Apply replacements (already sorted by descending index)
  for (const m of uniqueMatches) {
    tokenCounter[m.type]++;
    const token = `{{${m.type}_${tokenCounter[m.type]}}}`;
    tokenMap.set(token, m.value);
    
    protectedText = 
      protectedText.substring(0, m.index) + 
      token + 
      protectedText.substring(m.index + m.fullMatch.length);
  }

  console.log(`🔒 Protected ${tokenMap.size} numerical values`);
  if (tokenMap.size > 0) {
    console.log(`📋 Token map:`, Object.fromEntries(tokenMap));
  }

  return { protectedText, tokenMap };
}

function restoreNumericalValues(text: string, tokenMap: Map<string, string>): string {
  let result = text;
  const restoredTokens: string[] = [];
  const missingTokens: string[] = [];

  for (const [token, value] of tokenMap) {
    const escapedToken = token.replace(/[{}]/g, '\\$&');
    if (result.match(new RegExp(escapedToken))) {
      result = result.replace(new RegExp(escapedToken, 'g'), value);
      restoredTokens.push(token);
    } else {
      missingTokens.push(token);
    }
  }

  if (restoredTokens.length > 0) {
    console.log(`✅ Restored ${restoredTokens.length} numerical values`);
  }
  
  if (missingTokens.length > 0) {
    console.warn(`⚠️ LLM removed ${missingTokens.length} tokens: ${missingTokens.join(', ')}`);
    const missingValues = missingTokens.map(t => tokenMap.get(t)).filter(Boolean);
    if (missingValues.length > 0) {
      console.warn(`⚠️ Missing values that need manual review: ${missingValues.join(', ')}`);
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, templateType } = await req.json();

    if (!content || typeof content !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const template = (templateType as TemplateType) || 'free';
    const templateInstruction = TEMPLATE_INSTRUCTIONS[template] || TEMPLATE_INSTRUCTIONS.free;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("📝 Received dictation for formatting:", content.substring(0, 100) + "...");

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: PROTECT NUMERICAL VALUES
    // ═══════════════════════════════════════════════════════════════
    const { protectedText, tokenMap } = protectNumericalValues(content);
    
    console.log("🔐 Protected text preview:", protectedText.substring(0, 200) + "...");

    const systemPrompt = `You are a UK GP medical dictation cleaner and formatter.

Your role is NOT to summarise, reinterpret, or optimise clinical content.

Your role is ONLY to lightly clean, correct, and format dictated text so it reads clearly and professionally while preserving the original clinical meaning exactly.

This output must be safe for inclusion in a UK GP clinical record.

────────────────────────────────
PROTECTED VALUE TOKENS (CRITICAL)
────────────────────────────────

The text contains tokens like {{BP_1}}, {{HR_1}}, {{TEMP_1}}, {{MED_1}}, etc.
These represent PROTECTED clinical values that have been tokenised for safety.

ABSOLUTE REQUIREMENT: DO NOT modify, remove, reformat, or reinterpret these tokens.
- Keep them exactly as written in the text
- Do not add spaces inside the braces
- Do not change the token names or numbers
- Do not merge or split tokens
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
• Preserve ALL {{TOKEN}} placeholders exactly as they appear.
• No explanations.
• No markdown.
• No added commentary.
• No emojis.
• No bullet points unless clearly dictated.`;

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: SEND TO LLM FOR FORMATTING
    // ═══════════════════════════════════════════════════════════════
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Please format and clean up this dictated clinical note. Remember to preserve all {{TOKEN}} placeholders exactly as written:\n\n${protectedText}` },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const formattedWithTokens = data.choices?.[0]?.message?.content?.trim();

    if (!formattedWithTokens) {
      throw new Error("No formatted content received from AI");
    }

    console.log("📄 LLM response (with tokens):", formattedWithTokens.substring(0, 200) + "...");

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: RESTORE NUMERICAL VALUES
    // ═══════════════════════════════════════════════════════════════
    const formattedContent = restoreNumericalValues(formattedWithTokens, tokenMap);

    console.log(`✨ Formatted dictation: ${content.length} chars → ${formattedContent.length} chars`);
    console.log(`🔢 Protected ${tokenMap.size} numerical values`);

    return new Response(
      JSON.stringify({ 
        formattedContent,
        protectedValuesCount: tokenMap.size 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Format dictation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to format dictation' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
