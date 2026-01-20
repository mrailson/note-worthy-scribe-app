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

If a change would alter meaning → do not make it.

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage }
        ],
        temperature: 0.1,
        max_tokens: 4000,
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
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
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
