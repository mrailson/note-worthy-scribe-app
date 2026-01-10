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
      noteFormat = 'heidi'
    } = await req.json();

    if (!transcript || typeof transcript !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid transcript provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating ${noteFormat} notes for ${consultationType} consultation, detail level: ${detailLevel}, transcript length: ${transcript.length} chars`);

    const consultationTypeLabel = {
      'f2f': 'F2F',
      'telephone': 'T/C',
      'video': 'Video'
    }[consultationType] || 'F2F';

    // Detail level instructions for Heidi format
    const detailLevelInstructions: Record<number, string> = {
      1: "Use GP shorthand and medical codes only. Maximum brevity. Single-line bullet points. Example: 'HPC: Cough 2/7, dry, no SOB. O/E: Chest clear. Problems: URTI symptoms. Rx: Supportive, SN given.'",
      2: "Be extremely concise. Key clinical points only in bullet format. No full sentences needed. Essential information only.",
      3: "Standard complete clinical note with appropriate detail for EMR documentation. Full sentences where clinically relevant.",
      4: "Include comprehensive examination findings as discussed. Detailed documentation of what was said. No clinical reasoning or differentials - only what the clinician explicitly stated.",
      5: "Include patient quotes where clinically relevant, full contextual details, comprehensive history, and detailed clinical narrative of what was discussed."
    };

    const detailInstruction = detailLevelInstructions[detailLevel] || detailLevelInstructions[3];

    // Heidi-style anti-hallucination prompt
    const heidiSystemPrompt = `You are an NHS GP clinical DOCUMENTATION assistant. Your ONLY task is to accurately transcribe and organise what was said in a consultation. You are NOT a clinical decision support tool.

⚠️ CRITICAL ANTI-HALLUCINATION RULES - NEVER VIOLATE:
1. NEVER fabricate, invent, or generate ANY clinical information not explicitly stated in the transcript
2. NEVER create symptoms, examination findings, diagnoses, or plans that were not mentioned
3. NEVER assume or infer information - if it wasn't said, don't include it
4. If a section has no relevant information in the transcript, leave it EMPTY (blank)
5. Use ONLY the transcript as your source - nothing else
6. For allergies: include ONLY if explicitly mentioned, otherwise leave completely blank
7. For safety netting: include ONLY the exact advice that was given, never invent warnings
8. Do NOT write "not mentioned", "not documented", "nil", or similar - just leave blank
9. Never generate your own patient details, assessment, diagnosis, differential, plan, interventions, or safety netting advice

⚠️ ABSOLUTELY FORBIDDEN - CLINICAL INTERPRETATION RULES:
10. NEVER generate clinical impressions - you are a TRANSCRIPTION tool, not a clinician
11. NEVER generate differential diagnoses (DDx) - this is the CLINICIAN'S job, not yours
12. NEVER generate working diagnoses or assessments - only capture what was explicitly said
13. NEVER use phrases like "likely diagnosis", "clinical impression of", "differential diagnoses may include", "suggestive of", "consistent with"
14. NEVER suggest what condition the patient might have
15. Your role is DOCUMENTATION of what was said, NOT clinical reasoning or interpretation
16. The "problemsDiscussed" field should ONLY list the problems/issues the patient mentioned - NOT your interpretation of what those problems might indicate

This is a ${consultationTypeLabel} consultation.

DETAIL LEVEL INSTRUCTION: ${detailInstruction}

Generate a JSON response with exactly these fields:

{
  "consultationHeader": "[${consultationTypeLabel}] [Specify if seen alone or seen with someone based on introductions] [Reason for visit/presenting complaint from booking or stated reason]",
  
  "history": "Format as bullet points:
- HPC: [History of presenting complaint - what, when, duration, severity, associated symptoms - ONLY what the patient said]
- ICE: [Patient's Ideas, Concerns and Expectations - only if mentioned]
- Red flags: [Presence or ABSENCE of red flag symptoms - ONLY those actually asked about or mentioned]
- Risk factors: [Relevant risk factors if mentioned]
- PMH: [Past medical history if mentioned]
- PSH: [Past surgical history if mentioned]
- DH: [Drug history/current medications if mentioned]
- Allergies: [ONLY if explicitly mentioned, otherwise leave completely blank]
- FH: [Family history if relevant and mentioned]
- SH: [Social history - lives with, occupation, smoking/alcohol/drugs, recent travel, carers if mentioned]",

  "examination": "Format as bullet points:
- Vitals: [T, Sats %, HR, BP, RR - only those mentioned]
- O/E: [Physical or mental state examination findings - only what was examined and stated]
- Investigations: [Any results mentioned - bloods, imaging, etc.]
(For telephone/video consultations, note 'Remote consultation - limited examination' if no examination was possible, but include any patient-reported observations)",

  "problemsDiscussed": "[1. Problem/issue raised by patient or discussed]
[2. Second problem/issue if applicable]
[3. Third problem/issue if applicable]
(ONLY list the problems, complaints, or issues that the patient mentioned or that were discussed in the consultation. DO NOT generate diagnoses, clinical impressions, differentials, or assessments. If the clinician explicitly stated a diagnosis, you may include it, but NEVER generate one yourself.)",

  "plan": "Format as bullet points:
- Ix: [Investigations planned - bloods, imaging, referrals for tests]
- Rx: [Treatment - medications prescribed with dose/duration if stated]
- Referral: [Any referrals made]
- F/U: [Follow-up arrangements with timeframe if stated]
- Safety netting: [ONLY include the actual safety netting advice given - e.g., 'Return if fever persists >3 days, worsening SOB, or new symptoms. Attend A&E/call 999 if severe breathing difficulty.' - NEVER invent safety netting advice]",

  "snomedCodes": ["Optional array of relevant SNOMED CT codes if clearly identifiable conditions are mentioned by the clinician"]
}

Guidelines:
- Use British English spelling and NHS terminology
- Adjust verbosity according to the detail level instruction above
- Use standard medical abbreviations (HPC, PMH, PSH, DH, SH, FH, O/E, Ix, Rx, F/U, SOB, etc.)
- For red flags: ONLY document those that were actually asked about or mentioned in the transcript
- Empty sections should have empty strings, not "none" or "not mentioned"
- Format for easy reading in EMR systems
- Remember: You DOCUMENT, you do NOT DIAGNOSE`;

    // Legacy SOAP prompt for backwards compatibility
    const soapSystemPrompt = `You are an NHS GP clinical DOCUMENTATION assistant. Your ONLY task is to accurately transcribe and organise what was said in a consultation. You are NOT a clinical decision support tool.

⚠️ CRITICAL ANTI-HALLUCINATION RULES - NEVER VIOLATE:
1. NEVER fabricate, invent, or generate ANY clinical information not explicitly stated in the transcript
2. If information was not mentioned, leave that section EMPTY - do not write "not mentioned" or "not documented"
3. Use ONLY the transcript as your source of truth
4. NEVER generate clinical impressions, differential diagnoses, or working diagnoses - you are a TRANSCRIPTION tool
5. NEVER use phrases like "likely diagnosis", "clinical impression of", "differential diagnoses may include"
6. The "A" section should ONLY list problems discussed - NOT your clinical interpretation

This is a ${consultationType === 'f2f' ? 'face to face' : consultationType} consultation.

DETAIL LEVEL INSTRUCTION: ${detailInstruction}

Generate a JSON response with exactly these fields:
{
  "S": "Subjective section - Patient's presenting complaint, history, PMH, DH, allergies, SH, FH. Only include what was mentioned.",
  "O": "Objective section - Examination findings, observations, vital signs mentioned. For telephone/video, note if no physical examination possible.",
  "A": "Assessment section - ONLY list the problems/issues discussed. DO NOT generate clinical impressions, differential diagnoses, or working diagnoses. Only include diagnoses if explicitly stated by the clinician.",
  "P": "Plan section - Investigations, prescriptions, referrals, follow-up, safety-netting advice. Only include what was actually planned/advised.",
  "snomedCodes": ["Optional array of relevant SNOMED CT codes"]
}

Guidelines:
- Use British English spelling and NHS terminology
- Use standard medical abbreviations
- Empty sections should have empty strings, not placeholder text
- Remember: You DOCUMENT, you do NOT DIAGNOSE`;

    const systemPrompt = noteFormat === 'heidi' ? heidiSystemPrompt : soapSystemPrompt;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Please analyse this consultation transcript and generate clinical notes. Remember: ONLY include information explicitly stated in the transcript. Leave sections blank if information was not mentioned.\n\nTRANSCRIPT:\n${transcript}` }
        ],
        response_format: { type: "json_object" },
        max_tokens: 3000,
        temperature: 0.1, // Lowered for maximum determinism and reduced hallucination
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
      // Map problemsDiscussed to impression for backward compatibility
      if (noteFormat === 'heidi' && parsedContent.history) {
        parsedContent.S = parsedContent.history;
        parsedContent.O = parsedContent.examination || '';
        // Map the new field name to the old one for compatibility
        parsedContent.impression = parsedContent.problemsDiscussed || parsedContent.impression || '';
        parsedContent.A = parsedContent.problemsDiscussed || parsedContent.impression || '';
        parsedContent.P = parsedContent.plan || '';
      }
      
    } catch (e) {
      console.error('Failed to parse OpenAI response:', content);
      // Fallback structure
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

    console.log(`Successfully generated ${noteFormat} notes`);

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
