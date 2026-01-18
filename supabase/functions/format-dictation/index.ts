import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type TemplateType = 'free' | 'consultation' | 'referral' | 'patient-letter' | 'clinical-note' | 'sick-note';

const TEMPLATE_INSTRUCTIONS: Record<TemplateType, string> = {
  'free': `Format as clean, well-structured paragraphs. Add paragraph breaks at logical points.`,
  'consultation': `Format as a structured consultation summary with clear sections. Use headings like "History of Presenting Complaint:", "On Examination:", "Impression:", "Plan:" if not already present.`,
  'referral': `Format as a professional referral letter. Ensure it begins with "Dear Colleague," and ends with an appropriate sign-off. Structure with clear paragraphs covering: reason for referral, relevant history, examination findings, and what you're requesting.`,
  'patient-letter': `Format as a friendly but professional letter to the patient. Use clear, jargon-free language. Explain medical terms where used. Structure with logical paragraphs.`,
  'clinical-note': `Format as a structured clinical note using SOAP-style sections: HPC (History of Presenting Complaint), O/E (On Examination), Impression, Plan. Use clear headings and bullet points where appropriate.`,
  'sick-note': `Format as a formal statement of fitness for work. Maintain official, certification-style language. Include the assessment of fitness and any recommendations.`,
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

    const systemPrompt = `You are a medical document formatter for UK GP practices. Your task is to clean up and format dictated medical text.

## Core Rules:
1. PRESERVE ALL CLINICAL INFORMATION - never remove or change medical facts, diagnoses, medications, or dosages
2. Use British English spelling throughout (e.g., "organised", "colour", "centre", "behaviour", "paediatric", "anaemia", "oedema")
3. Remove filler words and verbal tics (e.g., "um", "uh", "like", "you know", "sort of", "kind of", "basically")
4. Fix repeated words (e.g., "the the" → "the", "and and" → "and")
5. Correct obvious speech-to-text errors while maintaining meaning
6. Add appropriate punctuation and capitalisation
7. Create logical paragraph breaks
8. Standardise medical abbreviations (BP, HR, SpO2, BMI, etc.)
9. Format measurements correctly (e.g., "125/74" for blood pressure, "72 bpm" for heart rate)
10. Use proper date formats (e.g., "18th January 2026")

## Template-Specific Instructions:
${templateInstruction}

## Output:
Return ONLY the formatted text. Do not include any explanations, comments, or markdown formatting. Just the clean, formatted medical text.`;

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
