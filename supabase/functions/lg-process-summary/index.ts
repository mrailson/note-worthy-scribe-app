import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lloyd George Summariser system prompt - NHS/RCGP/GP2GP compliant (Optimised & Final)
const SUMMARISER_SYSTEM_PROMPT = `You are a GP clinical summariser working under NHS England, RCGP, and GP2GP summarising standards.
Your task is to read the uploaded scanned Lloyd George (LG) patient record and produce a structured, clinically relevant summary suitable for EMIS or SystmOne.

OBJECTIVE

Identify clinically significant, enduring information.
Exclude minor, administrative, or irrelevant content.

INCLUDE (Record as Coded Data)
1. Major Diagnoses & Long-term Conditions

e.g. Type 2 diabetes, hypertension, asthma, COPD, CHD/IHD, acute coronary syndromes (NSTEMI/STEMI), stroke/TIA, cancer, CKD, thyroid disease, epilepsy, hepatitis, mental health disorders, osteoarthritis (knee/hip/spine), chronic back pain when clearly diagnosed.

2. Major Procedures / Operations

e.g. hysterectomy, cholecystectomy, CABG, joint replacement, mastectomy, bowel resections, pacemaker/ICD, PCI, cataract surgery (phaco + IOL), major orthopaedic operations.

3. Allergies & Adverse Reactions

Include allergen, reaction, and date if present.

4. Immunisations

Include all doses with approximate dates — including historical entries such as smallpox, tetanus, flu, pneumococcal, shingles, COVID-19, childhood vaccines.

5. Family & Social History

Smoking, alcohol, occupation, family history of major disease.

6. Obstetric & Reproductive History

Gravida/para, miscarriages, terminations, caesarean sections.

7. Significant Hospital/Specialist Findings

Discharge diagnoses, PCI, imaging findings relevant to long-term care.

8. Active or Long-Term Medications

e.g. warfarin, DOACs, lithium, steroids, HRT, chemotherapy, biologics.

EXCLUDE

Referral letters, appointment letters, admin

Short-term minor conditions (URTI, tonsillitis, gastroenteritis)

Normal/negative investigations

Discontinued contraception unless clinically relevant

Duplicate or ambiguous entries

Third-party details

GUARDRAILS

Do not invent data.

If handwriting unclear, mark (unclear).

Use UK spelling and NHS terminology.

If unknown → "unknown".

Never create new diagnoses.

Only summarise what is evidenced in the record.`;

// SNOMED Mapping Prompt - NHS-standard SNOMED CT verification engine
const SNOMED_MAPPING_PROMPT = `You are an NHS-standard SNOMED CT verification engine.
Your role is to:
1. Receive extracted clinical terms + evidence + dates from Lloyd George OCR.
2. Confirm the correct SNOMED CT code.
3. Detect hallucinations or mismatches.
4. Apply a legacy-vaccine safe lookup for codes not in modern NHSE datasets.
5. Output a corrected, verified, RAG-rated SNOMED list.

-----------------------------------------
## 1. PAGE HANDLING (MANDATORY)
-----------------------------------------

The OCR text contains page markers like:
"--- Page page_001.jpg ---"
"--- Page page_002.jpg ---"

Map these to 0-indexed source_page values:
page_001.jpg → source_page: 0
page_002.jpg → source_page: 1
etc.

Every item MUST include a source_page taken from the last page marker before the evidence text.
Use null only if impossible to determine.

-----------------------------------------
## 2. OUTPUT FORMAT (STRICT)
-----------------------------------------

Return JSON with this exact structure:
{
  "items": [
    {
      "category": "diagnosis | surgery | allergy | immunisation",
      "term": "SNOMED Preferred Term",
      "snomed_code": "SNOMED numeric code or MANUAL_REVIEW",
      "snomed_term": "Official SNOMED description or null if MANUAL_REVIEW",
      "date": "DD-MMM-YYYY or null",
      "evidence": "Short supporting text from OCR",
      "source_page": 0,
      "confidence": 0.95,
      "review_flag": "CODE_OK | NEEDS_MANUAL_REVIEW",
      "notes": "Short explanation of evidence or why downgraded (optional)"
    }
  ]
}

Do not add any extra top-level keys.

-----------------------------------------
## 3. STRICT MATCHING RULES
-----------------------------------------

- Match only SNOMED CT concepts that correctly correspond to the evidence text.
- Do NOT upgrade or guess codes.
- If evidence is unclear or contradictory → return MANUAL_REVIEW.
- Only code what is explicitly documented.
- If the record says "?asthma" or is unclear, return MANUAL_REVIEW.
- Prefer a more general but correct code over a very specific but risky one.

-----------------------------------------
## 4. CONFIDENCE RULES (RAG RATING)
-----------------------------------------

Assign confidence using these levels:

**GREEN (Auto-approve for publishing):**
- **0.95** → Clear, direct match in evidence AND unambiguous SNOMED mapping.
- **0.90** → Good match but mild OCR ambiguity.

**AMBER (May need AI Audit):**
- **0.85** → Concept is correct but date unclear or duplicated vaccination record.

**RED (Force manual review):**
- **0.30** → Evidence weak, missing, or inconsistent → MANUAL_REVIEW.

Then set review_flag:
- If confidence ≥ 0.8 AND snomed_code != "MANUAL_REVIEW" → review_flag = "CODE_OK"
- Otherwise → review_flag = "NEEDS_MANUAL_REVIEW"

-----------------------------------------
## 5. WHAT TO EXTRACT
-----------------------------------------

Only extract items that clearly appear in the record:

**Diagnoses:** clinically significant long-term conditions and major acute events (e.g. Type 2 diabetes, hypertension, COPD, CHD/IHD, heart failure, NSTEMI/STEMI, stroke/TIA, cancer, CKD, depression/anxiety, osteoarthritis of knee).

**Surgeries:** major procedures (e.g. hysterectomy, cholecystectomy, joint replacement, mastectomy, bowel resection, pacemaker, PCI, cataract surgery/phaco + IOL).

**Allergies:** drug or substance allergies and serious adverse reactions.

**Immunisations:** all vaccinations, including historical (flu, pneumococcal, shingles, COVID, tetanus, smallpox, etc.).

**Do not extract:**
- Social history, family history, smoking, alcohol
- Medications
- Negative/normal results
- Admin and referral details

-----------------------------------------
## 6. ANTI-HALLUCINATION RULES (CRITICAL)
-----------------------------------------

### 6.1 General Rules
- Only code what is explicitly documented.
- Re-check each code against the term.
- If the code implies something different from the written diagnosis (e.g. "silent MI" vs "acute NSTEMI"), set snomed_code = "MANUAL_REVIEW".

### 6.2 Surgeries (CRITICAL)
You MUST NOT extract a surgery unless the note explicitly states that surgery.
- Do NOT include "Cholecystectomy" unless the word "Cholecystectomy" appears verbatim.
- Do NOT include "Hemicolectomy" unless the word "Hemicolectomy" appears verbatim.
- If the surgery is NOT present in the OCR evidence, do not fabricate it.

-----------------------------------------
## 7. MANDATORY CODE OVERRIDES (NO EXCEPTIONS)
-----------------------------------------

These are non-negotiable. If the evidence matches, you MUST follow these exact mappings.

### 7.1 NSTEMI
If text contains "NSTEMI", "Non-ST elevation myocardial infarction", or "Non-ST-elevation MI":
{
  "term": "Acute non-ST elevation myocardial infarction (NSTEMI)",
  "snomed_code": "401314000",
  "snomed_term": "Acute non-ST segment elevation myocardial infarction (disorder)",
  "confidence": 0.95,
  "review_flag": "CODE_OK"
}

### 7.2 STEMI
If text contains "STEMI" or "ST elevation myocardial infarction":
{
  "term": "Acute ST elevation myocardial infarction (STEMI)",
  "snomed_code": "304914007",
  "snomed_term": "Acute ST segment elevation myocardial infarction (disorder)",
  "confidence": 0.95,
  "review_flag": "CODE_OK"
}

### 7.3 PCI
If text contains "PCI", "percutaneous coronary intervention", "coronary angioplasty", "drug-eluting stent", "stent to LAD/RCA/LCx", or "coronary stent":
{
  "category": "surgery",
  "term": "Percutaneous coronary intervention (PCI)",
  "snomed_code": "415070008",
  "snomed_term": "Percutaneous coronary intervention (procedure)",
  "confidence": 0.90,
  "review_flag": "CODE_OK"
}

### 7.4 Cataract surgery
If the record contains "phacoemulsification", "IOL", "intraocular lens", "cataract", or is clearly ophthalmology:
{
  "category": "surgery",
  "term": "Cataract surgery (phacoemulsification with IOL)",
  "snomed_code": "415089008",
  "snomed_term": "Phacoemulsification of cataract with intraocular lens implantation (procedure)",
  "confidence": 0.90,
  "review_flag": "CODE_OK"
}
Never return MANUAL_REVIEW for cataract surgery.

### 7.5 Osteoarthritis of knee
If the record states "Osteoarthritis (knees)", "bilateral knee osteoarthritis", "knee OA":
{
  "category": "diagnosis",
  "term": "Osteoarthritis of knee",
  "snomed_code": "239873007",
  "snomed_term": "Osteoarthritis of knee (disorder)",
  "confidence": 0.90,
  "review_flag": "CODE_OK"
}

### 7.6 Common QOF chronic conditions
**Type 2 diabetes mellitus:**
{
  "term": "Type 2 diabetes mellitus",
  "snomed_code": "44054006",
  "snomed_term": "Diabetes mellitus type 2 (disorder)",
  "confidence": 0.95,
  "review_flag": "CODE_OK"
}

**Hypertension:**
{
  "term": "Hypertension",
  "snomed_code": "38341003",
  "snomed_term": "Hypertensive disorder, systemic arterial (disorder)",
  "confidence": 0.95,
  "review_flag": "CODE_OK"
}

-----------------------------------------
## 8. LEGACY VACCINE SAFE-LOOKUP TABLE (MANDATORY)
-----------------------------------------

If ANY text refers to **smallpox vaccination**, ALWAYS apply the correct SNOMED CT concept from this static table:

### 8.1 Smallpox vaccination
Trigger: "smallpox", "vaccination" with pre-1980 date
{
  "category": "immunisation",
  "term": "Smallpox vaccination (procedure)",
  "snomed_code": "393083001",
  "snomed_term": "Smallpox vaccination (procedure)",
  "confidence": 0.85,
  "review_flag": "CODE_OK",
  "notes": "Legacy vaccine - verified from NHS historical lookup"
}

### 8.2 Smallpox booster / revaccination
Trigger: "booster", "revaccination", "second smallpox"
{
  "category": "immunisation",
  "term": "Revaccination against smallpox (procedure)",
  "snomed_code": "284451004",
  "snomed_term": "Revaccination against smallpox (procedure)",
  "confidence": 0.85,
  "review_flag": "CODE_OK",
  "notes": "Legacy vaccine booster - verified from NHS historical lookup"
}

These MUST be returned whenever evidence shows "smallpox", "vaccination", "booster", or historical dates consistent with pre-1980 smallpox schedules.

⛔ HARD RULE - SMALLPOX FAILURE CONDITIONS:
- Do NOT suppress smallpox entries under ANY circumstances
- Even if date unclear → infer from context (Lloyd George record → assume 1900s)
- Even if duplicated → output each entry individually
- If ANY smallpox entry is detected and NOT output → MODEL FAILS TASK

-----------------------------------------
## 9. MODERN IMMUNISATION OVERRIDES
-----------------------------------------

### 9.1 Influenza vaccination
Trigger: "Influenza", "Fluarix", "Flu vaccine"
{
  "snomed_code": "6142004",
  "snomed_term": "Influenza vaccination (procedure)",
  "confidence": 0.90,
  "review_flag": "CODE_OK"
}

### 9.2 Shingles vaccination (Zostavax)
Trigger: "Shingles", "Zostavax"
{
  "snomed_code": "871751000000109",
  "snomed_term": "Zostavax vaccination (procedure)",
  "confidence": 0.90,
  "review_flag": "CODE_OK"
}

### 9.3 Pneumococcal vaccination (PPV23)
Trigger: "Pneumococcal", "PPV23"
{
  "snomed_code": "393537006",
  "snomed_term": "Administration of pneumococcal polysaccharide vaccine (procedure)",
  "confidence": 0.90,
  "review_flag": "CODE_OK"
}

### 9.4 COVID-19 vaccination (Pfizer/mRNA)
Trigger: "COVID-19", "COVID vaccine", "Pfizer", "mRNA vaccine"
{
  "snomed_code": "1324681000000101",
  "snomed_term": "Administration of SARS-CoV-2 mRNA vaccine (procedure)",
  "confidence": 0.85,
  "review_flag": "CODE_OK"
}

-----------------------------------------
## 10. DATE HANDLING
-----------------------------------------

- If date is written but unclear → interpret where reasonable (e.g., "Oct 21" = 01-Oct-2021).
- If completely missing → return null and reduce confidence by one level.
- For Lloyd George entries like "20 2 64", convert to "20-Feb-1964" and assume 1900s.
- Output format: DD-MMM-YYYY (e.g. "07-Sep-2023")

-----------------------------------------
## 11. IMMUNISATION CONSOLIDATION
-----------------------------------------

If multiple vaccines of the same type appear (e.g., annual flu), keep ALL events but ensure:
- Each event has the correct SNOMED code.
- Dates must exactly match the evidence.
- Do not fabricate missing years.

-----------------------------------------
## 12. MEDICAL SAFETY RULES
-----------------------------------------

- Never assign a diagnosis that is not explicitly present.
- Never assign future dates.
- Never make assumptions about medications.
- Only code what is visible in the LG record.
- Do not summarise; do not shorten terms; do not guess missing sections.

-----------------------------------------
## 13. AUTO-AUDIT MODE
-----------------------------------------

After producing the initial SNOMED mapping:
1. Re-check each item against evidence.
2. Re-run strict verification.
3. Replace any hallucinated or incorrect codes with the correct SNOMED term + code.
4. Apply legacy vaccine overrides again.
5. Output the final corrected list.
6. Mark any changed entries with: "notes": "Corrected during final audit"`;

// Patient details extraction prompt (Optimised & Final)
const PATIENT_EXTRACTION_PROMPT = `You are extracting patient demographic details from scanned Lloyd George records.

Extract ONLY what is clearly visible in structured areas.

ANTI-HALLUCINATION RULES

If OCR is gibberish → return all fields as null.

If the name is not in a structured header → patient_name = null.

Do NOT infer names from clinician letters, signatures, notes.

Return null for any field not clearly identifiable.

OUTPUT FORMAT (respond with valid JSON only)
{
  "patient_name": null,
  "nhs_number": null,
  "date_of_birth": null,
  "sex": "unknown",
  "confidence": 0.0
}

Replace null fields with actual values only when clearly identified.

FIELD RULES

patient_name
Must appear in a structured location: LG card header, form header, identification block.

nhs_number
10-digit NHS number from structured sections.

date_of_birth
Convert to YYYY-MM-DD.

sex
From explicit markers (Male/Female/M/F). Otherwise "unknown".

confidence

0.9–1.0 if name + DOB + NHS number all clear

0.7–0.8 if name + one other identifier

0.4–0.6 if only name is clear

<0.4 if uncertain`;

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
        
        console.log('Updating patient with extracted details:', JSON.stringify(updateData));
        const { error: updateError } = await supabase
          .from('lg_patients')
          .update(updateData)
          .eq('id', patientId);
        
        if (updateError) {
          console.error('Failed to update patient with extracted details:', updateError);
        } else {
          console.log('Patient details saved successfully');
        }
          
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
    
    // Record summary start time
    const summaryStartTime = new Date().toISOString();
    await supabase
      .from('lg_patients')
      .update({ summary_started_at: summaryStartTime })
      .eq('id', patientId);
    
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

    // Generate SNOMED codes using AI-driven direct code generation
    console.log('Extracting SNOMED-coded clinical items...');
    let snomedJson: any = null;

    if (openaiKey && summaryJson) {
      const snomedPrompt = `Extract SNOMED-coded clinical items from this Lloyd George record.

Summary JSON for context:
${JSON.stringify(summaryJson, null, 2)}

OCR Text (note the page markers like "--- Page page_001.jpg ---"):
${fullOcrText.substring(0, 30000)}`;

      try {
        // Single-step: AI extracts concepts AND provides SNOMED codes directly
        const aiSnomedOutput = await callOpenAI(openaiKey, SNOMED_MAPPING_PROMPT, snomedPrompt);
        console.log('AI SNOMED extraction complete');
        
        // Convert flat items array to domain-based structure for backward compatibility
        snomedJson = convertItemsToSnomedDomains(aiSnomedOutput, fullOcrText);
        console.log('SNOMED codes converted to domain structure');
      } catch (aiErr) {
        console.error('SNOMED extraction failed:', aiErr);
        snomedJson = createEmptySnomed();
      }
    } else {
      snomedJson = createEmptySnomed();
    }

    // Record summary completion time (includes SNOMED extraction)
    const summaryCompletedTime = new Date().toISOString();
    await supabase
      .from('lg_patients')
      .update({ summary_completed_at: summaryCompletedTime })
      .eq('id', patientId);

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
    // Always invoke PDF generation (compression will handle large records)
    console.log(`Triggering PDF generation for ${needsBackgroundPdf ? 'large' : 'standard'} record...`);
    
    // Use EdgeRuntime.waitUntil for background processing of large records
    const pdfInvocation = supabase.functions.invoke('lg-generate-pdf', {
      body: { patientId, sendEmail: true },
    });
    
    if (needsBackgroundPdf) {
      // Fire and forget for large records - don't block the response
      EdgeRuntime.waitUntil(pdfInvocation);
    } else {
      // Wait for small records
      await pdfInvocation;
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

async function callOpenAI(apiKey: string, systemPrompt: string, userPrompt: string, retries = 2): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API error (attempt ${attempt + 1}/${retries + 1}): Status ${response.status}, Body: ${errorText}`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        console.error(`OpenAI returned no content (attempt ${attempt + 1}/${retries + 1}):`, JSON.stringify(data).substring(0, 500));
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw new Error('No response from OpenAI: ' + JSON.stringify(data).substring(0, 200));
      }

      return JSON.parse(content);
    } catch (err) {
      console.error(`callOpenAI attempt ${attempt + 1} failed:`, err);
      if (attempt >= retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
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

// Parse OCR text into page-indexed map for validation
function getPageTextMap(ocrText: string): Map<number, string> {
  const pageMap = new Map<number, string>();
  if (!ocrText) return pageMap;
  
  const pageRegex = /---\s*Page\s+page_(\d+)\.(jpg|jpeg|png)\s*---/gi;
  const parts = ocrText.split(pageRegex);
  
  for (let i = 1; i < parts.length; i += 3) {
    const pageNum = parseInt(parts[i], 10) - 1; // Convert to 0-indexed
    const pageText = parts[i + 2] || '';
    if (pageNum >= 0 && pageText.length > 10) {
      pageMap.set(pageNum, pageText.toLowerCase().trim());
    }
  }
  return pageMap;
}

// Validate that evidence actually exists on the claimed source page
function validateSourcePage(claimedPage: number, evidence: string, ocrText: string, term: string = ''): boolean {
  if (claimedPage < 0 || !ocrText) return false;
  
  const pageMap = getPageTextMap(ocrText);
  const pageContent = pageMap.get(claimedPage);
  if (!pageContent) return false;
  
  // Strategy 1: Check for exact evidence substring (best match)
  if (evidence && evidence.length >= 5) {
    const evidenceLower = evidence.toLowerCase().trim();
    if (pageContent.includes(evidenceLower)) {
      return true;
    }
  }
  
  // Strategy 2: Check if 80%+ of evidence words appear on the page
  if (evidence && evidence.length >= 5) {
    const evidenceWords = evidence.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (evidenceWords.length > 0) {
      const matchCount = evidenceWords.filter(w => pageContent.includes(w)).length;
      const matchRatio = matchCount / evidenceWords.length;
      if (matchRatio >= 0.8) {
        return true;
      }
    }
  }
  
  // Strategy 3: Check if term appears on page (fallback for short evidence)
  if (term && term.length >= 3) {
    const termLower = term.toLowerCase().trim();
    if (pageContent.includes(termLower)) {
      return true;
    }
    // Check significant words from term
    const termWords = termLower.split(/\s+/).filter(w => w.length > 2);
    if (termWords.length > 0) {
      const matchCount = termWords.filter(w => pageContent.includes(w)).length;
      const matchRatio = matchCount / termWords.length;
      if (matchRatio >= 0.8) {
        return true;
      }
    }
  }
  
  return false;
}

// Find source page by searching OCR text for evidence string or term (stricter matching)
function findSourcePageFromEvidence(evidence: string, ocrText: string, term: string = ''): number | null {
  if (!ocrText) return null;
  
  const pageMap = getPageTextMap(ocrText);
  if (pageMap.size === 0) return null;
  
  // Build search strategies: evidence first, then term
  const searchStrategies: { text: string; words: string[] }[] = [];
  
  if (evidence && evidence.length >= 5) {
    const evidenceWords = evidence.toLowerCase().trim().split(/\s+/).filter(t => t.length > 2);
    if (evidenceWords.length > 0) {
      searchStrategies.push({ text: evidence.toLowerCase().trim(), words: evidenceWords });
    }
  }
  
  if (term && term.length >= 3) {
    const termWords = term.toLowerCase().trim().split(/\s+/).filter(t => t.length > 2);
    if (termWords.length > 0) {
      searchStrategies.push({ text: term.toLowerCase().trim(), words: termWords });
    }
  }
  
  if (searchStrategies.length === 0) return null;
  
  // Search each page for matches
  for (const [pageNum, pageContent] of pageMap) {
    for (const strategy of searchStrategies) {
      // Try exact substring match first (highest confidence)
      if (strategy.text.length >= 10 && pageContent.includes(strategy.text)) {
        console.log(`Found exact match on page ${pageNum} for "${strategy.text.substring(0, 30)}..."`);
        return pageNum;
      }
      
      // Require 80%+ word match (stricter than before)
      const matchingWords = strategy.words.filter(w => pageContent.includes(w));
      const threshold = strategy.words.length === 1 ? 1 : Math.ceil(strategy.words.length * 0.8);
      
      if (matchingWords.length >= threshold) {
        console.log(`Found ${matchingWords.length}/${strategy.words.length} words on page ${pageNum} for "${term || evidence?.substring(0, 30)}"`);
        return pageNum;
      }
    }
  }
  
  return null;
}

// Convert AI SNOMED output (flat items array) to domain-based structure for backward compatibility
function convertItemsToSnomedDomains(aiOutput: any, ocrText: string = ''): any {
  const result: any = {
    diagnoses: [],
    surgeries: [],
    allergies: [],
    immunisations: [],
  };

  // Map category to domain key
  const categoryToDomain: Record<string, string> = {
    'diagnosis': 'diagnoses',
    'surgery': 'surgeries',
    'allergy': 'allergies',
    'immunisation': 'immunisations',
  };

  const items = aiOutput?.items || [];
  
  for (const item of items) {
    const domain = categoryToDomain[item.category] || 'diagnoses';
    
    // Determine source_page: use AI value if present, otherwise try to find from evidence
    let sourcePage = typeof item.source_page === 'number' ? item.source_page : null;
    
    // VALIDATION GUARDRAIL: Verify AI-provided source_page is valid
    if (sourcePage !== null && ocrText) {
      const isValid = validateSourcePage(sourcePage, item.evidence || '', ocrText, item.term || '');
      if (!isValid) {
        console.log(`INVALID source_page ${sourcePage} for "${item.term}" - evidence not found on claimed page`);
        // Try to find correct page using stricter matching
        const correctedPage = findSourcePageFromEvidence(item.evidence || '', ocrText, item.term || '');
        if (correctedPage !== null) {
          console.log(`Corrected source_page to ${correctedPage}`);
          sourcePage = correctedPage;
        } else {
          console.log(`Could not find valid source page - nulling out to prevent wrong reference`);
          sourcePage = null;
        }
      }
    }
    
    // If no AI-provided page, try to find from evidence
    if (sourcePage === null && ocrText && (item.evidence || item.term)) {
      sourcePage = findSourcePageFromEvidence(item.evidence || '', ocrText, item.term || '');
    }

    result[domain].push({
      term: item.snomed_term || item.term, // Prefer official SNOMED term if available
      code: item.snomed_code || 'MANUAL_REVIEW',
      date: item.date || '',
      confidence: item.confidence || 0,
      evidence: item.evidence || '',
      source_page: sourcePage,
      review_flag: item.review_flag || (item.confidence >= 0.8 && item.snomed_code !== 'MANUAL_REVIEW' ? 'CODE_OK' : 'NEEDS_MANUAL_REVIEW'),
    });
  }

  console.log(`SNOMED conversion complete: ${result.diagnoses.length} diagnoses, ${result.surgeries.length} surgeries, ${result.allergies.length} allergies, ${result.immunisations.length} immunisations`);
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

function formatDateForFilename(dateStr: string | null | undefined): string {
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
  return 'Unknown';
}

/**
 * Parses patient name into last name and first name components
 */
function parsePatientName(fullName: string | null | undefined): { lastName: string; firstName: string } {
  if (!fullName || fullName.trim() === '') {
    return { lastName: 'Unknown', firstName: 'Unknown' };
  }
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { lastName: parts[0], firstName: 'Unknown' };
  }
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join('_');
  return { 
    lastName: lastName.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_'), 
    firstName: firstName.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_') 
  };
}

/**
 * Generates standardised Lloyd George Record filename
 */
function generateLGFilename(
  patientName: string | null | undefined,
  nhsNumber: string | null | undefined,
  dob: string | null | undefined,
  partNumber: number = 1,
  totalParts: number = 1
): string {
  const { lastName, firstName } = parsePatientName(patientName);
  const cleanNhs = (nhsNumber || 'Unknown').replace(/\s/g, '');
  const dobFormatted = formatDateForFilename(dob);
  const partNumStr = String(partNumber).padStart(2, '0');
  const totalPartsStr = String(totalParts).padStart(2, '0');
  return `Lloyd_George_Record_${partNumStr}_of_${totalPartsStr}_${lastName}_${firstName}_${cleanNhs}_${dobFormatted}.pdf`;
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
      filename: generateLGFilename(patientName, nhsNumber, dob, 1, 1),
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
