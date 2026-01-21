import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `SYSTEM / ROLE

You are a UK NHS GP performing a final clinical polish of an already-generated consultation note for TPP SystmOne.

This is a tightening pass only, not a rewrite.

INPUT

You will receive a completed GP consultation summary with sections:
History / Examination / Assessment / Plan

The content is clinically correct.

🔒 NON-NEGOTIABLE CONSTRAINTS

You MUST NOT:
- Add new clinical facts
- Remove any clinical meaning
- Introduce new diagnoses or medications
- Change section headings
- Change the order of sections
- Add disclaimers or commentary
- Rephrase into conversational language
- If applying the language filter would require adding or guessing clinical details, do not apply that specific change

If a change would alter meaning → do not make it.

🔄 PLACEHOLDER AUTO-FIX RULE

If any section value is exactly (or effectively) a placeholder such as:
- Not discussed
- N/A
- None
- No data
- Not recorded

Then apply the following replacements WITHOUT adding new facts:

A) EXAMINATION placeholder → Replace with:
   O/E: Not examined today.

B) INTERVENTION placeholder → Replace with:
   No immediate intervention recorded.

C) PLAN placeholder → Replace with:
   Plan: No follow-up actions recorded.
   (Only if entire plan section is empty/placeholder. If any plan content exists, do nothing.)

D) HISTORY placeholder → Replace with:
   HPC: History not recorded.

Rule: Never remove the heading. Keep the heading and swap only the placeholder content.

🏥 TPP SYSTMONE LANGUAGE FILTER

Perform a final pass to ensure the note reads like a UK GP SystmOne entry.

Replace teaching/AI phrasing with GP phrasing:
- "Red flags:" → Remove label, incorporate as plain negative statements within existing bullet
  Example: "Red flags: No chest pain at rest…" → "No chest pain at rest…"
- "Risk factors:" → "RF:"
- "Social history:" → "SH:"
- "Drug history:" → "DH:"
- "Consider X" (when action is implied) → "Ix: X to assess…" (only if note indicates intention)
- "Patient states that…" → Use direct clinical shorthand

Do NOT use these words/labels (remove or rewrite):
- "teaching", "red flags", "differential", "AI", "scribe", "transcript", "hallucination"

Preferred SystmOne shorthand:
- Use: HPC: O/E: Imp: A: P:
- Use ± for uncertainty (e.g., "OA hip ± trochanteric bursitis")
- Use yrs, mths, wks for durations
- Bullet style: 1 idea per bullet, no long paragraphs

🔀 BEST-OF-BOTH MERGE RULE (SILENT)

If duplicated or overlapping phrasing exists:
- Prefer the clearer, more GP-shorthand wording
- Remove repetition
- Keep the most clinically precise phrasing
- Do not invent missing details.

🎯 SECTION-SPECIFIC TIGHTENING RULES

HISTORY
- Split long bullets where clinically sensible
- Compress into problem-focused GP shorthand
- Remove narrative phrasing (e.g. "feels something is not quite right" → "ongoing symptoms")
- Preserve:
  - Duration
  - Functional impact
  - Key investigations
  - Relevant PMH only if management-relevant
- Target: 2–3 concise bullets

EXAMINATION
- Retain only positive findings
- Prefer specific MSK terms where already implied (e.g. "limited ROM" → "reduced IR/ER" only if supported)
- Do not infer normal findings

ASSESSMENT
- Order problems by clinical priority
- Use cautious diagnostic phrasing (e.g. "±")
- Avoid repetition of history content

PLAN
- Maintain existing actions
- Clarify sequencing using: Ix / Ref / F/U / Safety-net
- Assign ownership where already implied
- Do not add timeframes unless explicit

🧪 QUALITY GATE (MANDATORY)

Before outputting, silently confirm:
- A partner GP could continue care safely from this note
- The record would stand up in a CQC inspection
- The note reads as GP-authored, not AI-generated

If yes → output the tightened version.

📤 OUTPUT FORMAT

You MUST respond with valid JSON only, no markdown, no extra text:
{
  "history": "tightened history content",
  "examination": "tightened examination content",
  "assessment": "tightened assessment content",
  "plan": "tightened plan content",
  "qualityGate": {
    "partnerSafe": true/false,
    "cqcReady": true/false,
    "gpAuthored": true/false
  }
}`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { history, examination, assessment, plan } = await req.json();

    if (!history && !examination && !assessment && !plan) {
      return new Response(
        JSON.stringify({ error: 'At least one section must be provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userMessage = `Please tighten the following consultation note sections for TPP SystmOne:

HISTORY:
${history || 'Not provided'}

EXAMINATION:
${examination || 'Not provided'}

ASSESSMENT:
${assessment || 'Not provided'}

PLAN:
${plan || 'Not provided'}`;

    console.log('Tightening consultation note for SystmOne...');

    // Retry logic for transient failures
    const MAX_RETRIES = 2;
    let lastError: Error | null = null;
    let content: string | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt}/${MAX_RETRIES}...`);
          // Brief delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            // Using Gemini for faster response times
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userMessage }
            ],
            max_tokens: 1500,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('AI gateway error:', response.status, errorText);
          
          if (response.status === 429) {
            return new Response(
              JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          if (response.status === 402) {
            return new Response(
              JSON.stringify({ error: 'Payment required. Please add funds to continue.' }),
              { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          throw new Error(`AI gateway error: ${response.status}`);
        }

        const aiResponse = await response.json();
        content = aiResponse.choices?.[0]?.message?.content;

        if (!content || content.trim() === '') {
          console.warn(`Attempt ${attempt + 1}: Empty AI response received`);
          lastError = new Error('Empty AI response');
          continue; // Try again
        }

        // Success - break out of retry loop
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(`Attempt ${attempt + 1} failed:`, lastError.message);
        
        // Don't retry on rate limits or payment errors
        if (lastError.message.includes('429') || lastError.message.includes('402')) {
          throw lastError;
        }
      }
    }

    if (!content) {
      console.error('All retry attempts failed:', lastError?.message);
      // Return original content as fallback instead of throwing
      return new Response(
        JSON.stringify({
          history: history || '',
          examination: examination || '',
          assessment: assessment || '',
          plan: plan || '',
          qualityGate: {
            partnerSafe: false,
            cqcReady: false,
            gpAuthored: false
          },
          error: 'AI service temporarily unavailable, returning original content'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Raw AI response:', content);

    // Clean up the response - remove markdown code blocks if present
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.slice(7);
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.slice(3);
    }
    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.slice(0, -3);
    }
    cleanedContent = cleanedContent.trim();

    // Parse the JSON response
    let result;
    try {
      result = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Return original content if parsing fails
      return new Response(
        JSON.stringify({
          history: history || '',
          examination: examination || '',
          assessment: assessment || '',
          plan: plan || '',
          qualityGate: {
            partnerSafe: false,
            cqcReady: false,
            gpAuthored: false
          },
          error: 'Failed to parse AI response, returning original content'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully tightened notes:', {
      historyLength: result.history?.length || 0,
      examinationLength: result.examination?.length || 0,
      assessmentLength: result.assessment?.length || 0,
      planLength: result.plan?.length || 0,
      qualityGate: result.qualityGate
    });

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in tighten-systmone-notes:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
