import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lloyd George Summariser system prompt - NHS/RCGP/GP2GP compliant
const SUMMARISER_SYSTEM_PROMPT = `You are a GP clinical summariser working under NHS England, RCGP, and GP2GP summarising standards.
Your task is to read the uploaded scanned Lloyd George (LG) patient record, extract relevant clinical information, and produce a structured, coded summary suitable for entry into EMIS Web or SystmOne.

OBJECTIVE: Identify and summarise clinically significant, enduring information that contributes to ongoing patient care and safety. Exclude redundant, administrative, or minor entries.

INCLUDE (Record as Coded Data):
1. Major Diagnoses & Chronic Conditions - diabetes, hypertension, asthma, COPD, CHD, stroke, cancer, CKD, thyroid disease, epilepsy, hepatitis, mental health disorders
2. Major Operations & Procedures - hysterectomy, cholecystectomy, CABG, joint replacements, mastectomy, bowel resection, pacemaker fitting
3. Allergies & Adverse Reactions - include allergen, reaction type, and year if known
4. Immunisations - all completed vaccinations with approximate dates
5. Family & Social History - family history of major disease, smoking status, alcohol use, occupation
6. Obstetric & Reproductive History - gravida/para status, miscarriages, terminations, caesarean sections
7. Significant Hospital/Specialist Findings - discharge diagnoses, positive investigation results
8. Active Medications or Past Long-Term Treatments - warfarin, lithium, steroids, HRT

EXCLUDE (Do NOT Record):
- Administrative or correspondence items (referrals, appointment letters, insurance reports)
- Minor self-limiting illnesses (URTI, tonsillitis, gastroenteritis)
- Normal or negative investigation results
- Discontinued contraception unless still relevant
- Duplicate or ambiguous entries (e.g. "?asthma 1983")
- Third-party information (partner or family member details)

Developer guardrails:
- No patient advice. No diagnosis creation. Summarise only what's present.
- If handwriting is unclear, flag with (unclear) where uncertain.
- Use UK spellings and NHS conventions.
- Never fabricate data; mark "unknown" if uncertain.`;

// SNOMED Concept Extractor - extracts clinical CONCEPTS (not codes) for database matching
const SNOMED_CONCEPT_PROMPT = `You are a clinical coder for UK primary care. Extract clinical CONCEPTS from the OCR text.
DO NOT generate SNOMED codes - just identify the clinical terms that need coding.

**CRITICAL - SOURCE_PAGE IS REQUIRED:**
The OCR text has page markers like "--- Page 001.jpg ---", "--- Page 002.jpg ---".
For EVERY item, you MUST include "source_page" by finding which page marker appears BEFORE the evidence text.
Convert page number to 0-indexed: 001.jpg → source_page:0, 002.jpg → source_page:1, 003.jpg → source_page:2

Return JSON with this EXACT structure (source_page is MANDATORY):

{
  "diagnoses": [{"term":"Type 2 diabetes mellitus","date":"2009","evidence":"PMH: T2DM dx ~2009","source_page":0}],
  "surgeries": [{"term":"Cataract surgery","date":"Jun 2019","evidence":"Phacoemulsification with IOL","source_page":1}],
  "allergies": [{"term":"Penicillin","date":"","evidence":"Known allergy","source_page":2}],
  "immunisations": [{"term":"COVID-19 vaccination","date":"Mar 2021","evidence":"Covid vaccine","source_page":2}]
}

**CRITICAL SURGERY IDENTIFICATION RULES:**
- "Phaco", "phacoemulsification", "IOL", "intraocular lens" = CATARACT SURGERY (eye surgery), NOT bowel surgery
- "Hemicolectomy" = bowel/colon surgery - only use if explicitly mentioned
- Read the context carefully: discharge summaries from ophthalmology/eye units are EYE surgeries
- If evidence mentions "lens", "cataract", "eye", "phaco" - it is cataract surgery
- DO NOT confuse different surgical specialties

RULES:
- term: UK clinical terminology - use the CORRECT procedure based on evidence context
- date: YYYY, MMM YYYY, or "Pre Oct 2020" format
- evidence: Short snippet from source
- source_page: REQUIRED integer (0, 1, 2, etc.) - only use null if absolutely cannot determine

ONLY extract: diagnoses, surgeries, allergies, immunisations.
DO NOT extract: social history, family history, medications.`;

// Patient details extraction prompt
const PATIENT_EXTRACTION_PROMPT = `You are extracting patient demographic details from scanned Lloyd George medical records. Extract ONLY what you can clearly see in the OCR text. Do not guess or invent information.

CRITICAL ANTI-HALLUCINATION RULES:
- If the OCR text is mostly gibberish, random characters, test patterns, or unreadable content, return null for ALL fields
- If you cannot find a name that is CLEARLY labeled as a patient name (e.g., "Patient Name:", "Name:", "Surname:", header field on a medical form), return null for patient_name
- If you only see a single mention of a name without clear context confirming it's THE PATIENT (not uploader, doctor, relative, witness), return null
- NEVER guess or extrapolate names from partial text fragments or random words
- A valid patient name should appear in a STRUCTURED format (form field, header, medical record cover) - NOT random text in document body
- If NHS number and DOB are BOTH null, patient_name confidence MUST be below 0.4 unless the name is absolutely unambiguous
- Do NOT extract names that look like uploader names, staff names, or signature names
- When in doubt, return null - it's better to show "Unknown" than to hallucinate a name

Return valid JSON with this exact structure:
{
  "patient_name": "Full name as written on the records (or null if not found)",
  "nhs_number": "10-digit NHS number, may have spaces (or null if not found)",
  "date_of_birth": "YYYY-MM-DD format (or null if not found)",
  "sex": "male" | "female" | "unknown",
  "confidence": 0.0 to 1.0 (how confident you are in the extracted data)
}

Rules:
- patient_name: Look for name fields clearly labeled on medical record forms. Must be in context of patient identification, NOT random text
- nhs_number: Look for a 10-digit number often labelled NHS No, NHS Number, etc. May have spaces like "123 456 7890"
- date_of_birth: Look for DOB, Date of Birth, D.O.B., or birth date fields in structured form areas
- sex: Look for M/F, Male/Female, Sex fields. Default to "unknown" if not clear
- confidence: Set based on how clearly the information was visible AND corroborated:
  - 0.9+ ONLY if name, NHS number, AND DOB are all clearly visible on a structured form
  - 0.7-0.8 if name is clear AND at least one of NHS/DOB is visible
  - 0.4-0.6 if name appears clear but no NHS number or DOB found
  - Below 0.4 if uncertain about any extraction

Return null for any field you cannot confidently identify from structured medical record fields.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openaiKey = Deno.env.get('OPENAI_API_KEY');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { patientId } = await req.json();
    
    if (!patientId) {
      throw new Error('Missing patientId');
    }

    console.log(`Summary processing for patient: ${patientId}`);

    // Get patient record
    const { data: patient, error: patientError } = await supabase
      .from('lg_patients')
      .select('*')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      throw new Error(`Patient not found: ${patientError?.message}`);
    }

    const basePath = `${patient.practice_ods}/${patientId}`;

    // Download merged OCR text - try JSON file first, then database fallback
    console.log('Loading OCR text...');
    let fullOcrText = '';
    
    // Try to download the merged JSON file first (new format)
    const jsonPath = `${basePath}/work/ocr_merged.json`;
    const { data: jsonData } = await supabase.storage
      .from('lg')
      .download(jsonPath);
    
    if (jsonData) {
      try {
        const parsed = JSON.parse(await jsonData.text());
        fullOcrText = parsed.ocr_text || '';
        console.log(`OCR merged JSON downloaded. Length: ${fullOcrText.length} characters`);
      } catch (parseErr) {
        console.error('Failed to parse OCR JSON:', parseErr);
      }
    }
    
    // Fallback: read directly from database
    if (!fullOcrText) {
      console.log('JSON file not found, reading OCR batches from database...');
      
      const { data: batches, error: batchesError } = await supabase
        .from('lg_ocr_batches')
        .select('batch_number, ocr_text')
        .eq('patient_id', patientId)
        .order('batch_number', { ascending: true });
      
      if (batchesError) {
        console.error('Failed to fetch OCR batches from database:', batchesError);
      } else if (batches && batches.length > 0) {
        fullOcrText = batches.map(b => b.ocr_text).join('\n\n');
        console.log(`Merged ${batches.length} batches from database. Total: ${fullOcrText.length} characters`);
        
        // Save as JSON for future use
        const mergedJson = JSON.stringify({ ocr_text: fullOcrText });
        await supabase.storage.from('lg').upload(jsonPath, 
          new Blob([mergedJson], { type: 'application/json' }), {
          contentType: 'application/json',
          upsert: true,
        });
        console.log('Merged OCR JSON saved for future use');
        
        // Update patient record with OCR URL
        await supabase
          .from('lg_patients')
          .update({ ocr_text_url: `lg/${jsonPath}` })
          .eq('id', patientId);
      } else {
        throw new Error('No OCR batches found in database - OCR may not have completed');
      }
    }
    
    if (!fullOcrText || fullOcrText.length < 50) {
      throw new Error('OCR text is empty or too short');
    }
    
    console.log(`OCR text ready. Length: ${fullOcrText.length} characters`);

    // Extract patient details
    console.log('Extracting patient details from OCR...');
    let extractedPatient: any = null;
    
    if (openaiKey && fullOcrText.length > 50) {
      try {
        extractedPatient = await callOpenAI(openaiKey, PATIENT_EXTRACTION_PROMPT, 
          `Extract patient details from this OCR text of Lloyd George records:\n\n${fullOcrText.substring(0, 30000)}`);
        console.log('Patient details extracted (raw):', extractedPatient);
        
        // ANTI-HALLUCINATION VALIDATION
        // If name exists but BOTH NHS number and DOB are null, this is suspicious
        if (extractedPatient.patient_name && 
            !extractedPatient.nhs_number && 
            !extractedPatient.date_of_birth) {
          console.log('SUSPICIOUS: Name extracted without NHS number or DOB - likely hallucination');
          // Force low confidence and null name
          extractedPatient.confidence = Math.min(extractedPatient.confidence || 0, 0.3);
          extractedPatient.patient_name = null;
        }
        
        // Additional validation: Only save name if confidence is reasonable AND corroborated
        const shouldSaveName = extractedPatient.patient_name && (
          // High confidence with corroboration
          (extractedPatient.confidence >= 0.7 && (extractedPatient.nhs_number || extractedPatient.date_of_birth)) ||
          // Very high confidence even without corroboration (rare)
          (extractedPatient.confidence >= 0.95)
        );
        
        if (!shouldSaveName && extractedPatient.patient_name) {
          console.log(`Rejecting name "${extractedPatient.patient_name}" - confidence ${extractedPatient.confidence} without corroboration`);
          extractedPatient.patient_name = null;
        }
        
        console.log('Patient details after validation:', extractedPatient);
        
        // Update patient record with extracted details
        const updateData: any = {
          ai_extracted_name: extractedPatient.patient_name || null,
          ai_extracted_nhs: extractedPatient.nhs_number?.replace(/\s/g, '') || null,
          ai_extracted_dob: extractedPatient.date_of_birth || null,
          ai_extracted_sex: extractedPatient.sex || 'unknown',
          ai_extraction_confidence: extractedPatient.confidence || 0,
          requires_verification: (extractedPatient.confidence || 0) < 0.8,
        };
        
        // Also populate the main fields if they're null AND validated
        if (!patient.patient_name && extractedPatient.patient_name) {
          updateData.patient_name = extractedPatient.patient_name;
        }
        if (!patient.nhs_number && extractedPatient.nhs_number) {
          updateData.nhs_number = extractedPatient.nhs_number.replace(/\s/g, '');
        }
        if (!patient.dob && extractedPatient.date_of_birth) {
          updateData.dob = extractedPatient.date_of_birth;
        }
        if (patient.sex === 'unknown' && extractedPatient.sex && extractedPatient.sex !== 'unknown') {
          updateData.sex = extractedPatient.sex;
        }
        
        await supabase
          .from('lg_patients')
          .update(updateData)
          .eq('id', patientId);
          
      } catch (extractErr) {
        console.error('Patient extraction failed:', extractErr);
      }
    }

    // Use extracted patient name or placeholder
    const patientName = extractedPatient?.patient_name || patient.patient_name || 'Unknown Patient';
    const nhsNumber = extractedPatient?.nhs_number || patient.nhs_number || 'Unknown';
    const dob = extractedPatient?.date_of_birth || patient.dob || 'Unknown';

    // Generate AI Summary
    console.log('Generating clinical summary...');
    let summaryJson: any = null;
    
    if (openaiKey && fullOcrText.length > 100) {
      const summaryPrompt = `Context:
Patient: ${patientName}, NHS ${nhsNumber}, DOB ${dob}
Practice ODS: ${patient.practice_ods}
Source: OCR text of scanned Lloyd George (unordered notes; may include handwritten OCR errors).

Task:
Return valid JSON matching this schema exactly:

{
  "summary_line": "Brief summary: PMH: T2DM dx ~2009, HTN 2012; NKDA; cholecystectomy 2018; ex-smoker 2015.",
  "diagnoses": [{"condition":"", "date_noted":"YYYY or YYYY-MM", "status":"active|resolved|unknown"}],
  "surgeries": [{"procedure":"", "date":"YYYY or unknown", "notes":""}],
  "allergies": [{"allergen":"", "reaction":"", "year":""}],
  "immunisations": [{"vaccine":"", "date":"YYYY-MM-DD or unknown"}],
  "family_history": [{"relation":"", "condition":""}],
  "social_history": {"smoking_status":"never|current|ex", "stopped_year":"", "alcohol":"none|moderate|heavy", "occupation":""},
  "reproductive_history": {"gravida":0, "para":0, "miscarriages":0, "notes":""},
  "hospital_findings": [{"condition":"", "date":"YYYY", "outcome":""}],
  "medications": [{"drug":"", "dose":"", "date":"YYYY or unknown"}],
  "alerts": [{"type":"safeguarding|high_risk_meds|third_party_info", "note":""}],
  "free_text_findings": "Short narrative (≤150 words) for anything important not mapped above.",
  "summary_metadata": "Summary completed ${new Date().toISOString().split('T')[0]} by Notewell AI"
}

REMEMBER: Only include clinically significant, enduring information. Exclude minor illnesses, admin items, normal results.
If something is not present, return an empty array or "". Never change keys. Dates can be approximate (year/month).

OCR Text:
${fullOcrText.substring(0, 50000)}`;

      try {
        summaryJson = await callOpenAI(openaiKey, SUMMARISER_SYSTEM_PROMPT, summaryPrompt);
        console.log('Summary generated successfully');
      } catch (aiErr) {
        console.error('Summary generation failed:', aiErr);
        summaryJson = createEmptySummary();
      }
    } else {
      summaryJson = createEmptySummary();
    }

    // Generate SNOMED codes using VALIDATED database matching
    console.log('Extracting clinical concepts for SNOMED matching...');
    let snomedJson: any = null;

    if (openaiKey && summaryJson) {
      const conceptPrompt = `Using the clinical summary and OCR text, identify clinical CONCEPTS that need SNOMED coding.

IMPORTANT: Extract dates where available from the OCR text. Look for dates near each clinical term.
- Format dates as DD-MMM-YYYY (e.g., "15-Mar-2018") or just the year (e.g., "2009") if only year is known
- If no date can be found for an item, leave date as empty string ""
- Search the OCR text carefully for dates mentioned near diagnoses, procedures, etc.

Return JSON listing the clinical terms with dates found:

{
  "diagnoses": [{"term":"condition name","date":"2009","evidence":"source text showing where found"}],
  "surgeries": [{"term":"procedure name","date":"15-Mar-2018","evidence":""}],
  "allergies": [{"term":"allergen/drug","date":"","evidence":""}],
  "immunisations": [{"term":"vaccine name","date":"1965","evidence":""}]
}

DATE RULES:
- If exact date known: "Mar 2019" or "2019"
- If mentioned in dated document: "Pre Oct 2020"
- If no date: ""

Summary JSON:
${JSON.stringify(summaryJson, null, 2)}

OCR Text (first 10000 chars):
${fullOcrText.substring(0, 10000)}`;

      try {
        // Step 1: Extract concepts (not codes)
        const conceptsJson = await callOpenAI(openaiKey, SNOMED_CONCEPT_PROMPT, conceptPrompt);
        console.log('Clinical concepts extracted');
        
        // Step 2: Match concepts against validated SNOMED database
        snomedJson = await matchConceptsToSnomed(supabase, conceptsJson);
        console.log('SNOMED codes matched from database');
      } catch (aiErr) {
        console.error('SNOMED extraction failed:', aiErr);
        snomedJson = createEmptySnomed();
      }
    } else {
      snomedJson = createEmptySnomed();
    }

    // Generate CSV from SNOMED
    const snomedCsv = generateSnomedCsv(snomedJson, patientId, nhsNumber);

    // Upload summary outputs
    console.log('Uploading summary outputs...');
    const finalPath = `${basePath}/final`;

    // Upload summary JSON
    const summaryBlob = new Blob([JSON.stringify(summaryJson, null, 2)], { type: 'application/json' });
    await supabase.storage.from('lg').upload(`${finalPath}/summary.json`, summaryBlob, {
      contentType: 'application/json',
      upsert: true,
    });

    // Upload SNOMED JSON
    const snomedBlob = new Blob([JSON.stringify(snomedJson, null, 2)], { type: 'application/json' });
    await supabase.storage.from('lg').upload(`${finalPath}/snomed.json`, snomedBlob, {
      contentType: 'application/json',
      upsert: true,
    });

    // Upload SNOMED CSV
    const csvBlob = new Blob([snomedCsv], { type: 'text/csv' });
    await supabase.storage.from('lg').upload(`${finalPath}/snomed.csv`, csvBlob, {
      contentType: 'text/csv',
      upsert: true,
    });

    // Determine if we need background PDF generation (>25 pages)
    const imageCount = patient.images_count || 0;
    const needsBackgroundPdf = imageCount > 25;

    // Update patient status
    await supabase
      .from('lg_patients')
      .update({
        job_status: needsBackgroundPdf ? 'succeeded' : 'processing', // Mark as succeeded if PDF is deferred
        processing_phase: needsBackgroundPdf ? 'complete' : 'pdf',
        pdf_generation_status: needsBackgroundPdf ? 'queued' : 'generating',
        summary_json_url: `lg/${finalPath}/summary.json`,
        snomed_json_url: `lg/${finalPath}/snomed.json`,
        snomed_csv_url: `lg/${finalPath}/snomed.csv`,
      })
      .eq('id', patientId);

    // Trigger PDF generation - email will be sent AFTER PDF is ready
    if (needsBackgroundPdf) {
      // Queue background PDF generation - email will be sent when PDF completes
      console.log('Queuing background PDF generation for large record...');
      // The cron job or manual trigger will pick this up and send email after
    } else {
      // Trigger immediate PDF generation with email flag
      console.log('Triggering immediate PDF generation (will send email after)...');
      await supabase.functions.invoke('lg-generate-pdf', {
        body: { patientId, sendEmail: true },
      });
    }

    console.log(`Summary processing complete for patient ${patientId}`);

    return new Response(
      JSON.stringify({ success: true, patientId, needsBackgroundPdf }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Summary processing error:', error);
    
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.patientId) {
        await supabase
          .from('lg_patients')
          .update({
            job_status: 'failed',
            error_message: error instanceof Error ? error.message : 'Summary processing failed',
          })
          .eq('id', body.patientId);
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Summary processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function callOpenAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  return JSON.parse(content);
}

function createEmptySummary() {
  return {
    summary_line: '',
    diagnoses: [],
    surgeries: [],
    allergies: [],
    immunisations: [],
    family_history: [],
    social_history: { smoking_status: 'unknown', alcohol: 'unknown', occupation: '' },
    reproductive_history: { gravida: 0, para: 0, miscarriages: 0, notes: '' },
    hospital_findings: [],
    medications: [],
    alerts: [],
    free_text_findings: 'OCR text was insufficient for clinical summary generation.',
    summary_metadata: '',
  };
}

// Match clinical concepts to validated SNOMED codes from database
async function matchConceptsToSnomed(supabase: any, conceptsJson: any): Promise<any> {
  const result: any = {
    diagnoses: [],
    surgeries: [],
    allergies: [],
    immunisations: [],
  };

  // Helper to find best matching SNOMED code for a term
  async function findBestMatch(term: string, domain: string): Promise<{ code: string; description: string; confidence: number } | null> {
    if (!term || term.length < 2) return null;

    // Normalize the search term
    const searchTerm = term.toLowerCase().trim();
    
    // Map domain to cluster patterns
    const domainPatterns: Record<string, string[]> = {
      diagnoses: ['diagnosis', 'disease', 'codes', 'disorder'],
      surgeries: ['Surgical', 'procedure'],
      allergies: ['Allergy'],
      immunisations: ['Immunisation', 'vaccination'],
    };

    // Try exact match first
    const { data: exactMatch } = await supabase
      .from('snomed_codes')
      .select('snomed_code, code_description')
      .ilike('code_description', searchTerm)
      .limit(1);

    if (exactMatch && exactMatch.length > 0) {
      return {
        code: exactMatch[0].snomed_code,
        description: exactMatch[0].code_description,
        confidence: 0.95,
      };
    }

    // Try fuzzy match with domain filtering
    const patterns = domainPatterns[domain] || [];
    let clusterFilter = patterns.length > 0 
      ? patterns.map(p => `cluster_description.ilike.%${p}%`).join(',')
      : '';

    // Search using text similarity
    const { data: fuzzyMatches } = await supabase
      .from('snomed_codes')
      .select('snomed_code, code_description, cluster_description')
      .or(`code_description.ilike.%${searchTerm}%,code_description.ilike.%${searchTerm.split(' ')[0]}%`)
      .limit(10);

    if (fuzzyMatches && fuzzyMatches.length > 0) {
      // Score matches by similarity
      let bestMatch = null;
      let bestScore = 0;

      for (const match of fuzzyMatches) {
        const desc = match.code_description.toLowerCase();
        let score = 0;

        // Exact substring match
        if (desc.includes(searchTerm)) {
          score = 0.85;
        }
        // First word match
        else if (desc.includes(searchTerm.split(' ')[0])) {
          score = 0.7;
        }
        // Partial match
        else {
          const words = searchTerm.split(' ');
          const matchedWords = words.filter(w => desc.includes(w)).length;
          score = 0.5 + (matchedWords / words.length) * 0.3;
        }

        // Boost score if domain matches
        const clusterLower = match.cluster_description.toLowerCase();
        if (patterns.some(p => clusterLower.includes(p.toLowerCase()))) {
          score += 0.1;
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = match;
        }
      }

      if (bestMatch && bestScore >= 0.5) {
        return {
          code: bestMatch.snomed_code,
          description: bestMatch.code_description,
          confidence: Math.min(bestScore, 0.95),
        };
      }
    }

    return null;
  }

  // Process each domain
  const domains = ['diagnoses', 'surgeries', 'allergies', 'immunisations'] as const;

  for (const domain of domains) {
    const concepts = conceptsJson[domain] || [];
    
    for (const concept of concepts) {
      const term = concept.term;
      const match = await findBestMatch(term, domain);

      if (match) {
        result[domain].push({
          term: match.description, // Use the official SNOMED description
          code: match.code,
          date: concept.date || '',
          confidence: match.confidence,
          evidence: concept.evidence || '',
          source_page: concept.source_page ?? null,
        });
      } else {
        // No match found - flag for manual review
        result[domain].push({
          term: term,
          code: 'MANUAL_REVIEW',
          date: concept.date || '',
          confidence: 0.3,
          evidence: concept.evidence || '',
          source_page: concept.source_page ?? null,
        });
      }
    }
  }

  console.log(`SNOMED matching complete: ${result.diagnoses.length} diagnoses, ${result.surgeries.length} surgeries, ${result.allergies.length} allergies, ${result.immunisations.length} immunisations`);
  return result;
}

function createEmptySnomed() {
  return {
    diagnoses: [],
    surgeries: [],
    allergies: [],
    immunisations: [],
  };
}

function generateSnomedCsv(snomed: any, patientId: string, nhsNumber: string): string {
  const rows: string[] = ['domain,term,code,date,source,confidence,evidence,nhs_number'];
  
  const domains = ['diagnoses', 'surgeries', 'allergies', 'immunisations'];
  
  for (const domain of domains) {
    const items = snomed[domain] || [];
    for (const item of items) {
      // Source page: add 2 for summary + index pages in PDF
      const sourcePage = typeof item.source_page === 'number' ? `Pg ${item.source_page + 2}` : '';
      const row = [
        domain,
        `"${(item.term || '').replace(/"/g, '""')}"`,
        item.code || 'UNKNOWN',
        item.date || 'NK',
        sourcePage,
        (item.confidence || 0).toFixed(2),
        `"${(item.evidence || '').replace(/"/g, '""')}"`,
        (nhsNumber || '').replace(/\s/g, ''),
      ].join(',');
      rows.push(row);
    }
  }
  
  return rows.join('\n');
}

function formatNhsNumber(nhs: string | null | undefined): string {
  if (!nhs) return 'Unknown';
  const digits = nhs.replace(/\s/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return nhs;
}

function formatDobDisplay(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === 'Unknown') return 'Unknown';
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = String(date.getDate()).padStart(2, '0');
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }
  } catch {}
  return dateStr || 'Unknown';
}

function formatDobForFilename(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === 'Unknown') return 'Unknown';
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = String(date.getDate()).padStart(2, '0');
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day}_${month}_${year}`;
    }
  } catch {}
  return dateStr || 'Unknown';
}

async function sendSummaryEmail(
  supabase: any,
  patient: any,
  patientName: string,
  nhsNumber: string,
  dob: string,
  summaryJson: any,
  snomedJson: any,
  isPdfDeferred: boolean
) {
  try {
    // Get user email
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', patient.user_id)
      .single();

    let userEmail = profile?.email;
    
    if (!userEmail) {
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(patient.user_id);
      userEmail = authUser?.email;
    }

    if (!userEmail) {
      console.log('No user email found, skipping email');
      return;
    }

    // Build email HTML
    const pdfNote = isPdfDeferred 
      ? `<p style="color: #ed8936; font-style: italic;">Note: The full PDF is being generated in the background due to the large number of pages. You will receive a notification when it is ready.</p>`
      : '';

    const emailHtml = buildSummaryEmailHtml(
      patientName,
      nhsNumber,
      dob,
      patient.practice_ods,
      patient.images_count || 0,
      summaryJson,
      snomedJson,
      pdfNote
    );

    // Fetch PDF for attachment if available
    let pdfBase64: string | null = null;
    const basePath = `${patient.practice_ods}/${patient.id}`;
    if (!isPdfDeferred) {
      try {
        const { data: pdfData } = await supabase.storage
          .from('lg')
          .download(`${basePath}/final/lloyd-george.pdf`);
        if (pdfData) {
          const arrayBuffer = await pdfData.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          pdfBase64 = btoa(binary);
          console.log(`PDF attachment ready, size: ${pdfBase64.length} chars`);
        }
      } catch (pdfErr) {
        console.error('Could not fetch PDF for attachment:', pdfErr);
      }
    }

    // Build attachments array
    const attachments = pdfBase64 ? [{
      filename: `LG_${(nhsNumber || '').replace(/\s/g, '')}_${formatDobForFilename(dob)}.pdf`,
      content: pdfBase64,
      type: 'application/pdf',
    }] : [];

    // Send via Resend edge function
    const { error: emailError } = await supabase.functions.invoke('send-email-resend', {
      body: {
        to_email: userEmail,
        subject: `Lloyd George Record Summary - ${patientName} (DOB: ${formatDobDisplay(dob)}) (NHS: ${formatNhsNumber(nhsNumber)})`,
        html_content: emailHtml,
        attachments: attachments.length > 0 ? attachments : undefined,
      },
    });

    if (emailError) {
      console.error('Email send error:', emailError);
    } else {
      await supabase
        .from('lg_patients')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', patient.id);
      console.log(`Email sent to ${userEmail}`);
    }
  } catch (err) {
    console.error('Email sending error:', err);
  }
}

function buildSummaryEmailHtml(
  patientName: string,
  nhsNumber: string,
  dob: string,
  practiceOds: string,
  imageCount: number,
  summaryJson: any,
  snomedJson: any,
  additionalNote: string = ''
): string {
  const formatNhs = (nhs: string) => {
    const digits = nhs?.replace(/\s/g, '') || '';
    if (digits.length === 10) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    return nhs || 'Unknown';
  };

  const snomedItemsNeedingReview = Object.values(snomedJson || {})
    .flat()
    .filter((item: any) => item && item.confidence !== undefined && item.confidence < 0.6).length;

  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #005EB8; border-bottom: 3px solid #005EB8; padding-bottom: 10px;">
        Lloyd George Record Summary
      </h1>
      
      ${additionalNote}
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #f5f5f5;">
          <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Patient Name</td>
          <td style="padding: 12px; border: 1px solid #ddd;">${patientName || 'Unknown'}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">NHS Number</td>
          <td style="padding: 12px; border: 1px solid #ddd;">${formatNhs(nhsNumber)}</td>
        </tr>
        <tr style="background: #f5f5f5;">
          <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Date of Birth</td>
          <td style="padding: 12px; border: 1px solid #ddd;">${dob || 'Unknown'}</td>
        </tr>
        <tr>
          <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">Pages Scanned</td>
          <td style="padding: 12px; border: 1px solid #ddd;">${imageCount}</td>
        </tr>
        <tr style="background: #f5f5f5;">
          <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">SNOMED Items for Review</td>
          <td style="padding: 12px; border: 1px solid #ddd;">${snomedItemsNeedingReview} items with confidence &lt;60%</td>
        </tr>
      </table>
      
      <h2 style="color: #005EB8; margin-top: 30px;">Clinical Summary</h2>
      <p style="background: #f0f4f5; padding: 15px; border-radius: 5px;">${summaryJson?.summary_line || 'No summary available'}</p>
    </div>
  `;

  return html;
}
