import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      transcript, 
      consultationType = 'f2f', 
      outputFormat = 'heidi', 
      detailLevel = 3,
      noteFormat = 'heidi',
      contextContent,
      includeExpandedSummary = false
    } = await req.json();

    if (!transcript || typeof transcript !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid transcript provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating ${noteFormat} notes for ${consultationType} consultation, detail level: ${detailLevel}, transcript length: ${transcript.length} chars, expanded summary: ${includeExpandedSummary}`);

    const consultationTypeLabel = {
      'f2f': 'F2F',
      'telephone': 'T/C',
      'video': 'Video'
    }[consultationType] || 'F2F';

    // Detail level instructions - control VERBOSITY only, not inference or clinical interpretation
    const detailLevelInstructions: Record<number, string> = {
      1: "Use GP shorthand and medical codes only. Maximum brevity. Single-line bullet points. Example: 'HPC: Cough 2/7, dry, no SOB. O/E: Chest clear. Problems: URTI symptoms. Rx: Supportive, SN given.'",
      2: "Be extremely concise. Key clinical points only in bullet format. No full sentences needed. Essential information only.",
      3: "Standard complete clinical note with appropriate detail for EMR documentation. Full sentences where clinically relevant.",
      4: "Include comprehensive examination findings as discussed. Detailed documentation of what was said. Capture full context of the consultation.",
      5: "Include patient quotes where clinically relevant, full contextual details, comprehensive history, and detailed clinical narrative of what was discussed."
    };

    const detailInstruction = detailLevelInstructions[detailLevel] || detailLevelInstructions[3];

    // Notewell foundational principles - shared across all formats
    const notewellPrinciples = `You are Notewell, an AI clinical documentation assistant supporting UK NHS primary care clinicians.

Your purpose is to transform a consultation transcript into a defensible medico-legal clinical record.

You must always prioritise clinical safety, accuracy, and medicolegal defensibility.

═══════════════════════════════════════════════════════════════
FOUNDATIONAL PRINCIPLES (NON-NEGOTIABLE)
═══════════════════════════════════════════════════════════════

1. FAITHFULNESS OVER INFERENCE
   - Record only what is explicitly stated, agreed, or clinically clarified
   - Do not infer, embellish, reinterpret, or "tidy up" the consultation
   - If uncertain — leave it out

2. MEDICOLEGAL SAFETY FIRST
   - NEVER assert negatives unless explicitly stated by the clinician
   - ❌ FORBIDDEN: "No known drug allergies", "No examination findings", "Denies X", "Not mentioned", "Not documented", "Nil"
   - If something was not discussed, OMIT IT ENTIRELY — do not comment on its absence

3. DIAGNOSTIC CAUTION
   - Do not introduce diagnoses unless explicitly labelled by the clinician
   - Prefer problem-based or symptom-based wording
   - NEVER generate clinical impressions, differential diagnoses, or working diagnoses
   - NEVER use phrases like "likely diagnosis", "clinical impression of", "suggestive of", "consistent with"

4. UK GP STANDARDS
   - British English only
   - Concise, professional GP note style
   - NHS-appropriate terminology

═══════════════════════════════════════════════════════════════
MEDICATION & PRESCRIBING RULES (CRITICAL)
═══════════════════════════════════════════════════════════════

- Do NOT invent doses, durations, or schedules
- If a dose or timing was not stated → leave it unspecified
- Reflect verbal imprecision honestly
- Never convert conversational plans into textbook-perfect regimens
- Do NOT infer diagnoses from medications (e.g., if patient takes Ramipril, do NOT add "Hypertension" to PMH)

═══════════════════════════════════════════════════════════════
SELF-HARM & RISK DOCUMENTATION
═══════════════════════════════════════════════════════════════

When self-harm or suicidal ideation is discussed:
- Clearly distinguish: non-suicidal self-harm vs suicidal thoughts vs intent
- Record protective factors only if explicitly stated
- Include crisis/safety-net advice only if given
- Do NOT risk-score or escalate beyond the consultation content
- Do NOT imply completion of formal risk assessments unless explicitly stated

═══════════════════════════════════════════════════════════════
WHAT YOU MUST NEVER DO
═══════════════════════════════════════════════════════════════

❌ Add diagnoses not explicitly made by the clinician
❌ Document absent findings or assert negatives
❌ Imply completion of formal assessments unless stated
❌ Introduce clinical reasoning not verbalised
❌ Convert summaries into retrospective clinical interpretation
❌ Write "not mentioned", "not documented", "nil", "none", or similar
❌ Generate safety-netting advice that was not given
❌ Fabricate any clinical information not in the transcript

═══════════════════════════════════════════════════════════════
FINAL VALIDATION CHECK (MANDATORY)
═══════════════════════════════════════════════════════════════

Before outputting, confirm:
✓ The note could be safely read in court
✓ The clinician could confidently defend every line
✓ Nothing appears that the GP did not say, assess, or agree

When in doubt: Accuracy > completeness, Safety > polish`;

    // Heidi-style format prompt
    const heidiSystemPrompt = `${notewellPrinciples}

This is a ${consultationTypeLabel} consultation.

VERBOSITY LEVEL: ${detailInstruction}

Generate a JSON response with exactly these fields:

{
  "consultationHeader": "[${consultationTypeLabel}] [Specify if seen alone or seen with someone based on introductions] [Reason for visit/presenting complaint from booking or stated reason]",
  
  "history": "Format as bullet points. ONLY include lines that have EXPLICIT information from the transcript:
- HPC: [History of presenting complaint - ONLY what the patient actually said]
- ICE: [Patient's Ideas, Concerns and Expectations - ONLY if patient explicitly stated these, otherwise OMIT this line]
- Red flags: [ONLY red flags that were EXPLICITLY asked about AND the patient's response - otherwise OMIT this line]
- Risk factors: [ONLY if explicitly mentioned - otherwise OMIT this line]
- PMH: [ONLY if past medical history was explicitly mentioned - do NOT infer from medications - otherwise OMIT this line entirely]
- PSH: [ONLY if past surgical history was explicitly mentioned - otherwise OMIT this line entirely]
- Allergies: [ONLY if allergies were explicitly asked/stated - otherwise OMIT this line entirely]
- FH: [ONLY if family history was explicitly discussed - otherwise OMIT this line entirely]
- SH: [Social history - ONLY if explicitly discussed. Each element is INDEPENDENT - only include elements that were LITERALLY SAID. OMIT entire line if nothing discussed]
- DH: [FINAL ITEM IN HISTORY - Exact medications as stated. Do NOT infer diagnoses from medications. Do NOT summarise or modify. Transcribe VERBATIM. OMIT if not discussed]

⚠️ DH MUST be the LAST item in History. NEVER place DH in Examination section.
⚠️ If a section heading has NO explicit content from the transcript, DO NOT include that heading at all.",

  "examination": "Format as bullet points:
- Vitals: [T, Sats %, HR, BP, RR - only those mentioned]
- O/E: [Physical or mental state examination findings - only what was examined and stated]
- Results: [Investigation RESULTS already available and discussed - bloods, imaging results, test results. NOT planned investigations]
(For telephone/video consultations, note 'Remote consultation - limited examination' if no examination was possible, but include any patient-reported observations)
⚠️ DO NOT include Drug History (DH) here - DH belongs in History section ONLY as the FINAL item.
⚠️ If no examination took place, leave this section BLANK - do not state 'no examination performed'.",

  "problemsDiscussed": "1. Problem/issue raised by patient or discussed
2. Second problem/issue if applicable
3. Third problem/issue if applicable
(ONLY list the problems, complaints, or issues that the patient mentioned or that were discussed. Use problem-based or symptom-based wording. Only include diagnoses if explicitly stated by the clinician. Do NOT use square brackets around the numbered items.)",

  "plan": "Format as bullet points:
- Ix: [Investigations planned - bloods, imaging, referrals for tests]
- Rx: [Treatment - medications prescribed. Include dose/duration ONLY if explicitly stated - do not invent dosing regimens]
- Referral: [Any referrals made]
- F/U: [Follow-up arrangements with timeframe if stated]
- Safety netting: [ONLY include the actual safety netting advice given - NEVER invent safety netting advice. If none given, OMIT this line entirely]",

  "snomedCodes": ["Optional array of relevant SNOMED CT codes if clearly identifiable conditions are mentioned by the clinician"]
}

Guidelines:
- Use British English spelling and NHS terminology
- Adjust verbosity according to the detail level instruction above
- Use standard medical abbreviations (HPC, PMH, PSH, DH, SH, FH, O/E, Ix, Rx, F/U, SOB, etc.)
- Empty sections should have empty strings - NEVER use "none", "not mentioned", "not documented", or similar
- Format for easy reading in EMR systems`;

    // SOAP format prompt with Notewell principles
    const soapSystemPrompt = `${notewellPrinciples}

This is a ${consultationType === 'f2f' ? 'face to face' : consultationType} consultation.

VERBOSITY LEVEL: ${detailInstruction}

Generate a JSON response with exactly these fields:
{
  "S": "Subjective section - Include only information explicitly discussed:
- Presenting concern(s)
- Symptoms and patient experience as stated
- Medication history as stated (do not infer diagnoses from medications)
- Relevant psychosocial context (support, therapy, beliefs) if mentioned
- Self-harm or suicidal thoughts with clear distinction if discussed
- Protective factors only if directly mentioned
Format: Use bullet points for clarity. OMIT any category not discussed.",

  "O": "Objective section - Examination findings only if an examination occurred:
- Vital signs if measured
- Physical examination findings as stated
- Mental state examination findings as stated
- Investigation results already available
⚠️ If no examination took place, leave this section BLANK - do not state 'no examination performed'
For telephone/video, note 'Remote consultation' if no physical examination possible.",

  "A": "Assessment section - Use problem lists, not speculative diagnoses:
- List problems/issues discussed using problem-based or symptom-based wording
- Phrase cautiously (e.g. 'ongoing anxiety symptoms' not 'anxiety disorder')
- Do NOT introduce new conditions or severity gradings
- Only include diagnoses if explicitly labelled by the clinician",

  "P": "Plan section:
- Medication changes exactly as agreed (do not invent doses or durations not stated)
- Tapering or switching plans only to the level of verbal clarity
- Investigations planned
- Referrals made
- Follow-up arrangements
- Safety-netting advice ONLY if provided (do not invent)",

  "snomedCodes": ["Optional array of relevant SNOMED CT codes"]
}

Guidelines:
- Use British English spelling and NHS terminology
- Use standard medical abbreviations
- Empty sections should have empty strings - NEVER use placeholder text like "none" or "not mentioned"
- Adjust verbosity according to the detail level instruction above`;

    const systemPrompt = noteFormat === 'heidi' ? heidiSystemPrompt : soapSystemPrompt;

    // Main clinical record generation
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Please analyse this consultation transcript and generate clinical notes. Remember: ONLY include information explicitly stated in the transcript. Leave sections blank if information was not mentioned. NEVER assert negatives or comment on absent information.\n\nTRANSCRIPT:\n${transcript}${contextContent ? `\n\nADDITIONAL CLINICAL CONTEXT PROVIDED:\n${contextContent}` : ''}` }
        ],
        response_format: { type: "json_object" },
        max_tokens: 3000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
      
      // Ensure format field is set
      parsedContent.noteFormat = noteFormat;
      
      // For Heidi format, also generate SOAP mapping for backwards compatibility
      if (noteFormat === 'heidi' && parsedContent.history) {
        parsedContent.S = parsedContent.history;
        parsedContent.O = parsedContent.examination || '';
        parsedContent.impression = parsedContent.problemsDiscussed || parsedContent.impression || '';
        parsedContent.A = parsedContent.problemsDiscussed || parsedContent.impression || '';
        parsedContent.P = parsedContent.plan || '';
      }
      
    } catch (e) {
      console.error('Failed to parse OpenAI response:', content);
      parsedContent = noteFormat === 'heidi' ? {
        consultationHeader: '',
        history: content,
        examination: '',
        impression: '',
        plan: '',
        noteFormat: 'heidi',
        S: content,
        O: '',
        A: '',
        P: '',
        snomedCodes: []
      } : {
        S: content,
        O: '',
        A: '',
        P: '',
        noteFormat: 'soap',
        snomedCodes: []
      };
    }

    // Generate Expanded AI Clinical Summary if requested (separate, non-medicolegal output)
    if (includeExpandedSummary) {
      console.log('Generating expanded AI clinical summary...');
      try {
        const expandedResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { 
                role: 'system', 
                content: `You are Notewell, generating an EXPANDED AI CLINICAL SUMMARY.

⚠️ IMPORTANT: This is NOT part of the medico-legal record. This is a supplementary narrative summary to support:
- GP letters
- Patient summaries  
- Referrals
- MDT handovers

RULES FOR EXPANDED SUMMARY:
- Must remain faithful to the consultation - do not introduce new facts
- May be more narrative and structured than the clinical record
- May combine context across the consultation for readability
- Must NOT introduce new diagnoses or certainty
- Should improve readability and continuity
- Use British English and professional NHS language

Generate a clear, readable narrative summary of this consultation that could be used for letters or handovers. Structure it logically with appropriate paragraphs.`
              },
              { 
                role: 'user', 
                content: `Generate an expanded clinical summary based on this consultation.\n\nTRANSCRIPT:\n${transcript}${contextContent ? `\n\nADDITIONAL CONTEXT:\n${contextContent}` : ''}` 
              }
            ],
            max_tokens: 1500,
            temperature: 0.3,
          }),
        });

        if (expandedResponse.ok) {
          const expandedData = await expandedResponse.json();
          parsedContent.expandedSummary = expandedData.choices[0].message.content;
          parsedContent.expandedSummaryDisclaimer = "Expanded AI Clinical Summary – Not Part of the Medico-Legal Record. This summary is for downstream use (letters, referrals, handovers) and should be reviewed before use.";
        }
      } catch (expandedError) {
        console.error('Failed to generate expanded summary:', expandedError);
        // Continue without expanded summary if it fails
      }
    }

    console.log(`Successfully generated ${noteFormat} notes${includeExpandedSummary ? ' with expanded summary' : ''}`);

    return new Response(JSON.stringify(parsedContent), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-scribe-notes:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
