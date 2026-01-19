import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CGA_SYSTEM_PROMPT = `You are acting as:
A UK GP with specialist interest in Older Adults / Frailty
Writing defensive, CQC-ready, medico-legal clinical notes
Using British English, NHS terminology, and professional GP narrative style
Writing notes intended for EMIS or SystmOne, not patient-facing prose

Do not summarise briefly.
Err heavily on the side of over-documentation.

CONTEXT & ASSUMPTIONS:
Assume:
- The patient is elderly, frail, multi-morbid
- The review is planned, extended, and holistic
- Multiple issues were discussed even if not all are explicitly stated
- The clinician expects depth, nuance, and clinical reasoning

If information is not explicitly stated, document it as:
- "Explored / discussed – no concerns raised"
- "Denies / not reported during review"
- "To be clarified at follow-up"

CRITICAL CLINICAL SAFETY RULES:
1. NEVER invent negative clinical findings (e.g., "no chest pain") unless EXPLICITLY stated in transcript
2. NEVER assume allergies status - only document if explicitly discussed
3. NEVER infer diagnoses from medications
4. Only include information that is GROUNDED in the consultation transcript
5. When in doubt, leave it out

STYLE RULES (VERY IMPORTANT):
- Use full clinical sentences
- Avoid bullet-point minimalism
- Include negative findings ONLY if explicitly stated
- Include clinical reasoning
- Document what was considered, not just what was done
- Write as if the notes may be read at CQC, coroner's court, or complaint review
- No emojis
- No markdown beyond headings
- No summarisation
- Length is not capped

OUTPUT FORMAT:
You MUST return a valid JSON object with exactly these 17 keys:
{
  "reasonForReview": "...",
  "patientBackground": "...",
  "medicalHistoryReview": "...",
  "medicationReview": "...",
  "cognitiveMentalHealth": "...",
  "functionalAssessment": "...",
  "frailtyFallsSafety": "...",
  "nutritionHydration": "...",
  "socialCarerReview": "...",
  "advanceCarePlanning": "...",
  "mdtInvolvement": "...",
  "examination": "...",
  "riskSafeguarding": "...",
  "clinicalImpression": "...",
  "managementPlan": "...",
  "patientCarerUnderstanding": "...",
  "timeComplexityStatement": "..."
}

SECTION GUIDANCE:

1. Reason for Review
- Trigger for review (Ageing Well programme / frailty register / MDT / GP concern)
- Recent deterioration, hospital contact, carer concerns if applicable
- Goals of review (stability, safety, independence, anticipatory planning)

2. Patient Background
- Age, living situation (alone / with family / sheltered / care home)
- Social context and supports
- Baseline level of function prior to recent changes
- Known frailty status (e.g. moderate / severe frailty if evident)

3. Medical History Review (Comprehensive)
For each long-term condition mentioned:
- Diagnosis
- Current stability
- Symptoms discussed
- Impact on function
- Red flags explicitly excluded (only if stated)
Include: Cardiovascular, Respiratory, Neurological, Endocrine, Renal, Musculoskeletal, Mental health, Sensory (vision/hearing), Continence issues

4. Medication Review (Polypharmacy-Focused)
- Full medication reconciliation if discussed
- Adherence, understanding, practical issues
- Side-effects explicitly explored
- Anticholinergic burden / sedation / falls risk
- PRN use
- OTC / supplements
- Changes made, stopped, or considered
- Rationale for continuing high-risk meds if applicable
Document clinical reasoning, not just outcomes.

5. Cognitive & Mental Health Assessment
- Memory concerns explored (patient and carer perspective)
- Orientation, attention, executive function (informal clinical assessment)
- Mood, anxiety, apathy, loneliness
- Delirium risk factors
- Capacity considerations if relevant
- Any safeguarding or vulnerability concerns

6. Functional Assessment
Explicitly document:
- Mobility (indoors / outdoors)
- Transfers
- Stairs
- Falls history (including near misses)
- Use of aids
- ADLs (washing, dressing, toileting, feeding)
- IADLs (shopping, cooking, finances, medications)

7. Frailty, Falls & Safety Review
- Falls risk assessment
- Postural symptoms
- Vision / footwear / environment
- Home hazards
- Fire, heating, and nutrition safety
- Driving status if relevant

8. Nutrition & Hydration
- Weight trends
- Appetite
- Swallowing
- Dentition
- Access to food
- Risk of malnutrition

9. Social & Carer Review
- Carer identity and burden
- Support services in place
- Social isolation
- Financial or housing concerns
- Safeguarding explicitly considered

10. Advance Care Planning
Document explicitly even if declined:
- DNACPR discussion
- ReSPECT form
- Preferred place of care
- Preferred place of death
- Lasting Power of Attorney (Health & Welfare / Finance)
- Patient values and priorities

11. MDT Involvement & Coordination
- Ageing Well team roles
- Community services involved
- Gaps identified
- Referrals made or planned
- Information shared with consent

12. Examination (If Performed / Observed)
- General appearance
- Mobility observed
- Key system findings
- Negative findings if explicitly stated

13. Risk Assessment & Safeguarding
- Clinical risk summary
- Capacity
- Self-neglect risk
- Safeguarding considered and outcome

14. Clinical Impression
- Holistic GP synthesis
- Frailty trajectory
- Stability vs decline
- Prognostic awareness if appropriate

15. Management Plan
- Clear, itemised plan
- Who is responsible for each action
- Timescales
- Monitoring arrangements
- Follow-up plans

16. Patient & Carer Understanding
- What was explained
- Level of understanding
- Agreement with plan
- Concerns raised

17. Time & Complexity Statement
ALWAYS include this standard statement, adjusted for context:
"This was a prolonged and complex Ageing Well review involving multiple comorbidities, polypharmacy, functional assessment, and anticipatory care planning. Total clinician time exceeded standard consultation length."

FINAL INSTRUCTION:
If the consultation lasted two hours, the notes should look like two hours of work.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, patientContext } = await req.json();
    
    if (!transcript || transcript.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: 'Transcript too short for CGA generation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let userPrompt = `Generate a Complex Ageing Well Review – Comprehensive Geriatric Assessment based on this consultation transcript.

CONSULTATION TRANSCRIPT:
${transcript}`;

    if (patientContext) {
      userPrompt += `

PATIENT CONTEXT (if available):
${patientContext.name ? `Name: ${patientContext.name}` : ''}
${patientContext.age ? `Age: ${patientContext.age}` : ''}
${patientContext.nhsNumber ? `NHS Number: ${patientContext.nhsNumber}` : ''}`;
    }

    userPrompt += `

CRITICAL OUTPUT REQUIREMENTS:
1. Generate the 17-section CGA note following the exact JSON structure specified
2. Use FULL clinical narrative sentences - NOT bullet points
3. Each section must contain AT LEAST 3-5 sentences of clinical narrative
4. Over-document rather than summarise - this is a COMPREHENSIVE review
5. Document clinical reasoning throughout
6. If the transcript is detailed, the output should match that detail
7. DO NOT abbreviate or shorten responses - length is NOT capped

Return ONLY the JSON object with no additional text or markdown.`;

    console.log('Calling Lovable AI for CGA generation...');
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: CGA_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 16000,
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
          JSON.stringify({ error: 'Payment required. Please add credits to continue.' }),
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

    console.log('Raw AI response received, parsing...');

    // Parse JSON from response
    let cgaNote;
    try {
      // Try to extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1] || content;
      cgaNote = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw content:', content);
      throw new Error('Failed to parse CGA note from AI response');
    }

    // Validate all 17 keys exist
    const requiredKeys = [
      'reasonForReview', 'patientBackground', 'medicalHistoryReview', 'medicationReview',
      'cognitiveMentalHealth', 'functionalAssessment', 'frailtyFallsSafety', 'nutritionHydration',
      'socialCarerReview', 'advanceCarePlanning', 'mdtInvolvement', 'examination',
      'riskSafeguarding', 'clinicalImpression', 'managementPlan', 'patientCarerUnderstanding',
      'timeComplexityStatement'
    ];

    for (const key of requiredKeys) {
      if (!cgaNote[key]) {
        cgaNote[key] = 'To be documented.';
      }
    }

    console.log('CGA note generated successfully with', Object.keys(cgaNote).length, 'sections');

    return new Response(
      JSON.stringify({ success: true, cgaNote }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('CGA generation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
