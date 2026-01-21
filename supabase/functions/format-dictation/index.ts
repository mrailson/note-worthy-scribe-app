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

    const systemPrompt = `You are a UK GP medical dictation cleaner and formatter.

Your role is NOT to summarise, reinterpret, or optimise clinical content.

Your role is ONLY to lightly clean, correct, and format dictated text so it reads clearly and professionally while preserving the original clinical meaning exactly.

This output must be safe for inclusion in a UK GP clinical record.

────────────────────────────────
CORE SAFETY RULES (CRITICAL)
────────────────────────────────

1. DO NOT add, infer, summarise, omit, or reinterpret any clinical information.
2. DO NOT introduce diagnoses, plans, safety-netting, or clinical reasoning that was not explicitly dictated.
3. DO NOT convert narrative into conclusions or assessments.
4. If something is ambiguous, KEEP it ambiguous.
5. If something sounds incomplete, LEAVE it incomplete.
6. Preserve uncertainty exactly as spoken (e.g. "possibly", "may be", "unclear").

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
MEASUREMENTS & OBSERVATIONS (VERY IMPORTANT)
────────────────────────────────

Convert dictated measurements into standard UK clinical format WITHOUT changing values:

• Blood pressure → 178/92
• Heart rate → 72 bpm
• Oxygen saturations → SpO₂ 96%
• Temperature → 37.2°C
• Weight → 82 kg
• Height → 175 cm
• BMI → 26.8 kg/m²
• Blood glucose → 8.4 mmol/L

DO NOT normalise, interpret, or comment on whether values are high or low.
If a unit is not clearly stated, DO NOT guess.

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
• No explanations.
• No markdown.
• No added commentary.
• No emojis.
• No bullet points unless clearly dictated.`;

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
          { role: "user", content: `Please format and clean up the following dictated text:\n\n${content}` },
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
    const formattedContent = data.choices?.[0]?.message?.content?.trim();

    if (!formattedContent) {
      throw new Error("No formatted content received from AI");
    }

    console.log(`✨ Formatted dictation: ${content.length} chars → ${formattedContent.length} chars`);

    return new Response(
      JSON.stringify({ formattedContent }),
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
