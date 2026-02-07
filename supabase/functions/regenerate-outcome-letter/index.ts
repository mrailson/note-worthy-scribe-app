import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { complaintId, currentLetter, instructions, complaintDescription, referenceNumber, useFormalLabels } = await req.json();
    
    if (!complaintId || !currentLetter || !instructions) {
      throw new Error('Missing required parameters');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Call Lovable AI to regenerate the outcome letter
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert NHS complaints manager helping to revise outcome letters.
Your task is to take the existing outcome letter and modify it based on the user's instructions whilst maintaining professional NHS standards and tone.

The letter must comply with NHS Complaints Regulations, PHSO principles, CQC standards, and NoteWell AI governance rules.

CRITICAL REQUIREMENTS TO PREVENT FABRICATION:
- NEVER add events, incidents, or details that are not explicitly mentioned in the original complaint or current letter
- NEVER infer, assume, or fabricate reasons, causes, or explanations for events
- NEVER add medical emergencies, staffing issues, or other contextual details unless they are explicitly stated in the source materials
- If asked to explain something, only reference facts already present in the complaint description or current letter
- If information is not available, do not make it up - state that it was not available in the provided materials
- Base ALL content strictly on the provided complaint description and current letter text

OUTCOME WORDING RULES:
- Preserve the outcome label style used in the current letter. If the letter uses formal labels (Upheld / Partially upheld / Not upheld), keep them. If it uses plain patient-centred language without labels, maintain that style.
- Never use the word "Rejected" — use "Not upheld" instead.

MANDATORY LETTER STRUCTURE:
The letter must follow this order: Header → Opening Acknowledgement → Summary of Investigation → Outcome Statement → Learning & Improvements → Individual Resolution (if appropriate) → Escalation Rights → Professional Closing.

ESCALATION RIGHTS (MANDATORY):
- Always preserve the PHSO escalation paragraph. If it is missing from the current letter, add it.
- Use this wording: "If you remain dissatisfied with this response, you may refer your complaint to the Parliamentary and Health Service Ombudsman, an independent body. This should normally be done within 12 months of this response. Further information is available at www.ombudsman.org.uk or by calling 0345 015 4033. This letter constitutes our final response under the NHS complaints procedure."

INDIVIDUAL RESOLUTION (SAFE PHRASING):
- Do not promise preferential or guaranteed clinical access
- Use safe phrasing such as "We have asked the clinical team to review…" or "Where appropriate, further steps will be considered…"

STANDARD REQUIREMENTS:
- Maintain the formal NHS letter format
- Keep all essential complaint information (reference numbers, dates, patient details)
- Preserve the factual findings unless specifically asked to change them
- Ensure the tone is professional, empathetic, and appropriate for NHS correspondence
- Follow NHS complaint handling best practices
- Keep the letter structure (header, body, conclusion, signature)
- Only modify the parts that the user's instructions request
- Always remain respectful, calm, and patient-centred. Never sound dismissive, defensive, or adversarial.
- If required information is missing, state that it was not available in the provided materials rather than inventing details.

OUTPUT RULES:
- British English (spellings and grammar)
- No bullet points in the final letter
- No internal system references
- No AI disclaimers
- No decorative formatting or emojis

SIGNATURE AND FORMATTING RULES:
- Ensure the revised letter contains exactly ONE signature block ending with "Yours sincerely". Remove any duplicate signature sections, repeated practice details, or trailing address blocks.
- Do NOT include the practice address in the signature block — it should only appear ONCE in the letter header.
- Do not include "*Letterhead/Logo Here*" or similar placeholder text.

Return ONLY the revised letter content without any preamble or explanation.`
          },
          {
            role: 'user',
            content: `Here is the current outcome letter:

${currentLetter}

Complaint reference: ${referenceNumber}
Original complaint: ${complaintDescription}

Use formal outcome labels in patient letters: ${useFormalLabels === true ? 'YES' : useFormalLabels === 'YES' ? 'YES' : currentLetter.match(/Outcome:\s*(Upheld|Partially upheld|Not upheld)/i) ? 'YES' : 'NO'}

Please revise this letter according to these instructions:
${instructions}

Return only the revised letter content.`
          }
        ],
        max_completion_tokens: 4000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limits exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable AI workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const regeneratedLetter = data.choices?.[0]?.message?.content
      ?.replace(/```[\s\S]*?$/g, '') // Remove markdown code blocks at the end
      .replace(/```/g, '') // Remove any stray backticks
      .trim();

    if (!regeneratedLetter) {
      throw new Error('No content generated by AI');
    }

    return new Response(
      JSON.stringify({ regeneratedLetter }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in regenerate-outcome-letter:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
