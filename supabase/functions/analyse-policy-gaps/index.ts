import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const systemPrompt = `You are an expert NHS policy analyst specialising in GP practice policy compliance. Your task is to analyse existing practice policies and identify genuine, material issues only.

## SEVERITY FILTER — WHAT TO FLAG AND WHAT TO IGNORE

Only report issues in these three categories:

1. CLINICAL / LEGAL RISK
   Flag if: incorrect clinical intervals or thresholds, superseded legislation cited as current, missing mandatory legal rights (e.g. right to erasure), missing statutory duties (e.g. safeguarding referral obligations).
   Do NOT flag: case law that remains good law even if old, minor wording preferences, references that are technically superseded but still valid.

2. CQC INSPECTION RISK
   Flag if: a missing section that a CQC inspector would specifically look for evidence of (e.g. audit trail process, training levels, complaints procedure). Only flag if the gap is material — a missing heading is not the same as missing content.
   Do NOT flag: absence of nice-to-have sections, vendor neutrality preferences, stylistic observations.

3. PATIENT SAFETY / OPERATIONAL RISK
   Flag if: a process gap that could directly lead to patient harm or a significant operational failure (e.g. no failsafe process, no escalation pathway for abnormal results).
   Do NOT flag: theoretical risks, minor process improvements, observations about best practice that are not required.

NEVER FLAG:
- Single word mentions of outdated technology (e.g. "fax" in a list)
- Case law that remains binding even if older
- DSPT or guidance version numbers that are correct for the current cycle
- Vendor-specific system names (SystmOne, EMIS) in single-system practices
- Style or formatting observations
- Anything that would be fixed at the next annual review rather than now
- Issues already covered adequately elsewhere in the document

## SCORING
- Maximum 8 issues per review
- Each issue must state: what is missing/wrong, why it matters (CQC/legal/patient safety), and the specific section where it should be addressed
- Do not report an issue unless you are confident it is a genuine gap
- STRICT DEDUPLICATION: Each issue must appear exactly once across the entire output (gaps, outdated_references, missing_sections combined). Before returning, compare all items — if two refer to the same underlying issue (even worded differently), keep only the one under the most appropriate category and discard the other. Never list the same gap under both "gaps" and "missing_sections".

## ANALYSIS TASKS

1. POLICY TYPE DETECTION:
   - Identify the type of policy from the content
   - Match to standard NHS GP practice policy categories

2. GAP ANALYSIS:
   - Compare against current CQC requirements
   - Check for compliance with latest NHS England guidance
   - Apply the severity filter above — only report material gaps

3. OUTDATED REFERENCES:
   - Flag references to superseded legislation ONLY where the superseded version is materially different
   - Do NOT flag version numbers that remain current

4. MISSING SECTIONS:
   - Check for standard policy sections (Purpose, Scope, Responsibilities, etc.)
   - Only flag if a CQC inspector would specifically look for the missing section

5. REVIEW DATE EXTRACTION:
   - Extract the last review date if present
   - Note if the policy appears overdue for review

You must respond in valid JSON format with the following structure:
{
  "policy_type": "string - the identified policy type",
  "gaps": ["array of identified compliance gaps - max 8, each stating what/why/where"],
  "outdated_references": ["array of genuinely outdated references"],
  "missing_sections": ["array of materially missing sections only"],
  "last_review_date": "string or null - extracted review date",
  "summary": "brief summary of the analysis",
  "priority_actions": ["top 3 actions recommended"]
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { extracted_text, action, audience } = body;

    if (!extracted_text) {
      throw new Error('extracted_text is required');
    }

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Pass full document — Gemini Flash supports 1M token context
    const maxLength = 200000;
    const documentText = extracted_text.length > maxLength
      ? extracted_text.substring(0, maxLength) + '\n\n[Content truncated due to length]'
      : extracted_text;

    // ─── QUICK GUIDE ACTION ───
    if (action === 'quick-guide') {
      // Build audience-specific instructions
      let audienceInstruction = '';
      switch (audience) {
        case 'non-clinical':
          audienceInstruction = `This guide is specifically for NON-CLINICAL staff (receptionists, administrators, practice managers, secretaries).
Focus ONLY on administrative duties, front-desk processes, data handling, patient communication, and operational tasks.
Do NOT include clinical procedures, prescribing, clinical decision-making, or clinical examination processes.
Frame all responsibilities from an administrative perspective.`;
          break;
        case 'clinical':
          audienceInstruction = `This guide is specifically for CLINICAL staff (GPs, nurses, healthcare assistants, pharmacists, paramedics).
Focus ONLY on clinical responsibilities, patient assessment, treatment pathways, prescribing, referrals, and clinical documentation.
Do NOT include administrative tasks like appointment booking, filing, or front-desk operations.
Frame all responsibilities from a clinical perspective.`;
          break;
        case 'patient':
          audienceInstruction = `PATIENT INFORMATION LEAFLET MODE`;
          break;
        default: // 'all-staff'
          audienceInstruction = `This guide is for ALL STAFF — both clinical and non-clinical.
Include responsibilities for clinicians (GPs, nurses, HCAs) AND administrative staff (receptionists, managers, secretaries).
Clearly separate clinical vs administrative responsibilities where relevant.`;
          break;
      }

      const audienceLabel = audience === 'non-clinical' ? 'Non-Clinical Staff' : audience === 'clinical' ? 'Clinical Staff' : audience === 'patient' ? 'Patient' : 'All Staff';

      let quickGuideSystem: string;
      let quickGuideUserPrompt: string;

      if (audience === 'patient') {
        quickGuideSystem = `You are generating a patient information leaflet for a UK NHS GP practice.

Use the full policy provided as the source document.

Your task is to translate the policy into clear, reassuring, patient-friendly language so that patients understand:

• what the policy means
• how it affects their care
• what their rights are
• what they can expect from the practice

The leaflet must NOT include internal governance details, staff training frameworks, legislation lists, or internal procedures unless they are directly relevant to patient understanding.

The leaflet must be written in plain English suitable for the general public.

The tone must be:
• clear
• reassuring
• respectful
• easy to understand
• NHS appropriate

Avoid technical or clinical jargon wherever possible.

Structure the leaflet using the following sections:

1. Title
Use the format: "[Policy Name] – Information for Patients"

2. Why This Policy Exists
Explain in 2–3 sentences why the practice has this policy and how it helps provide safe, respectful, or effective care.

3. What This Means for You
Explain clearly how this policy may affect the patient when they visit the practice or receive care. Use bullet points.

4. What You Can Expect from Our Practice
Explain what the practice will do to follow the policy. Use reassuring language such as:
• "Our team will..."
• "We will always..."
• "We aim to..."

5. Your Rights as a Patient
Clearly explain the patient's rights related to this policy. Examples may include:
• asking questions
• requesting support
• declining certain options
• raising concerns
Use bullet points.

6. If You Have Questions or Concerns
Explain how a patient can raise questions or concerns about the issue covered by the policy.
Encourage speaking to reception staff, a clinician, or the practice manager.

7. Accessibility Statement
Include a short statement confirming the practice will make reasonable adjustments for patients with additional needs, disabilities, or language requirements.

Formatting requirements:
• Maximum length: one page
• Use clear headings
• Use short paragraphs
• Use bullet points where helpful
• Avoid technical terminology
• Write for a general public audience
• British English throughout

The leaflet must be easy for patients to read in under two minutes.

The leaflet should be suitable for:
• the practice website
• waiting room posters
• printed patient information leaflets`;

        quickGuideUserPrompt = `Generate a patient information leaflet for the following policy document:

---POLICY DOCUMENT START---
${documentText}
---POLICY DOCUMENT END---`;

      } else {
        quickGuideSystem = `You are generating a one-page NHS staff quick guide for a GP practice policy.

TARGET AUDIENCE: ${audienceLabel}
${audienceInstruction}

Use the full policy provided as the source document.

Your task is NOT to summarise the entire policy but to extract the key operational requirements that the target audience must follow.

The quick guide must be concise, clear, and suitable for busy staff.

Structure the guide using the following sections:

1. Purpose (1–2 sentences)

2. When This Policy Applies
List the situations when the policy is relevant to ${audienceLabel.toLowerCase()}.

3. Key Staff Responsibilities
List responsibilities relevant to the target audience only.

4. Step-by-Step Process
Provide a numbered workflow (maximum 7 steps) describing how ${audienceLabel.toLowerCase()} should follow the policy in practice.

5. Documentation Requirements
Explain what must be recorded and where (e.g., SystmOne, incident log).

6. If Something Goes Wrong
Explain what staff should do if concerns, incidents, or risks arise.

7. Quick Reminders
Provide 4–6 short bullet points highlighting the most important rules for ${audienceLabel.toLowerCase()}.

Formatting requirements:
• Use clear headings
• Use bullet points
• Avoid long paragraphs
• Maximum length: one page
• Use plain NHS-appropriate language

This guide should be readable in under two minutes.`;

        quickGuideUserPrompt = `Generate a quick guide for the following policy document:

---POLICY DOCUMENT START---
${documentText}
---POLICY DOCUMENT END---`;
      }

      console.log('Generating quick guide, text length:', extracted_text.length);

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          max_tokens: 4096,
          messages: [
            { role: 'system', content: quickGuideSystem },
            { role: 'user', content: quickGuideUserPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI Gateway error:', response.status, errorText);
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const responseText = await response.text();
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('AI returned an empty response');
      }

      const data = JSON.parse(responseText);
      const quickGuide = data.choices?.[0]?.message?.content || '';

      console.log('Quick guide generated, length:', quickGuide.length);

      return new Response(JSON.stringify({ success: true, quick_guide: quickGuide }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── DEFAULT: GAP ANALYSIS ───
    const userPrompt = `Analyse the following practice policy document IN FULL and provide a comprehensive gap analysis. You MUST read and consider every section of the document — do not skip or skim any part.

---POLICY DOCUMENT START---
${documentText}
---POLICY DOCUMENT END---

Today's date is ${new Date().toLocaleDateString('en-GB')}.

Please analyse this policy against current NHS England and CQC requirements and provide your analysis in the specified JSON format.`;

    console.log('Analysing policy gaps, text length:', extracted_text.length);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        max_tokens: 8192,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required, please add funds to your workspace.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const responseText = await response.text();
    if (!responseText || responseText.trim().length === 0) {
      throw new Error('AI returned an empty response');
    }

    const data = JSON.parse(responseText);
    const aiContent = data.choices?.[0]?.message?.content || '';

    // Parse JSON from AI response
    let analysis;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      analysis = {
        policy_type: 'Unknown',
        gaps: ['Unable to fully analyse - please review manually'],
        outdated_references: [],
        missing_sections: [],
        last_review_date: null,
        summary: 'Analysis could not be completed automatically',
        priority_actions: ['Manual review recommended'],
      };
    }

    console.log('Policy analysis complete:', analysis.policy_type);

    return new Response(JSON.stringify({
      success: true,
      policy_type: analysis.policy_type,
      gaps: analysis.gaps || [],
      outdated_references: analysis.outdated_references || [],
      missing_sections: analysis.missing_sections || [],
      last_review_date: analysis.last_review_date,
      summary: analysis.summary,
      priority_actions: analysis.priority_actions || [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('analyse-policy-gaps error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
