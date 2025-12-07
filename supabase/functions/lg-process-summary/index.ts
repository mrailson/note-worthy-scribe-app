import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lloyd George Summariser system prompt - NHS/RCGP/GP2GP compliant (Enhanced v2)
const SUMMARISER_SYSTEM_PROMPT = `You are a GP clinical summariser working under NHS England, RCGP, and GP2GP summarising standards.
Your task is to read the uploaded scanned Lloyd George (LG) patient record and produce a structured, clinically relevant summary suitable for EMIS or SystmOne.

OBJECTIVE

Identify clinically significant, enduring information.
Exclude minor, administrative, or irrelevant content.

INCLUDE (Record as Coded Data)
1. Major Diagnoses & Long-term Conditions

e.g. Type 2 diabetes, hypertension, asthma, COPD, CHD/IHD, acute coronary syndromes (NSTEMI/STEMI), stroke/TIA, cancer, CKD, thyroid disease, epilepsy, hepatitis, mental health disorders, osteoarthritis (knee/hip/spine), chronic back pain when clearly diagnosed.

2. SECONDARY CONDITIONS FROM PROBLEM LISTS (NEW - MANDATORY)

Extract ALL conditions from any problem list in the record, not just headline diagnoses:
- Include conditions like glaucoma, sleep apnoea, hearing loss, tinnitus, cataracts, macular degeneration
- If a medication clearly indicates a condition AND there is corroborating evidence, include it (e.g., Latanoprost drops → glaucoma if eye clinic letters present; CPAP → sleep apnoea if sleep study mentioned)
- Do NOT assume a condition exists solely from medication - require additional evidence

3. Major Procedures / Operations

e.g. hysterectomy, cholecystectomy, CABG, joint replacement, mastectomy, bowel resections, pacemaker/ICD, PCI, cataract surgery (phaco + IOL), major orthopaedic operations.

4. Allergies & Adverse Reactions

Include allergen, reaction, and date if present.

5. Immunisations

Include all doses with approximate dates — including historical entries such as smallpox, tetanus, flu, pneumococcal, shingles, COVID-19, childhood vaccines.

6. Family & Social History

Smoking, alcohol, occupation, family history of major disease.

7. LIFESTYLE DATA EXTRACTION (NEW - MANDATORY)

ALWAYS extract smoking status if present - this is critical clinical data:
- "current smoker" / "ex-smoker" / "never smoked" / "unknown"
- If ex-smoker, include year stopped if documented (e.g., "stopped 2015")
- Include pack-years if documented
- Extract alcohol status: "none" / "social" / "moderate" / "heavy" / "unknown"
- Extract occupation if documented

8. Obstetric & Reproductive History

Gravida/para, miscarriages, terminations, caesarean sections.

9. Significant Hospital/Specialist Findings

Discharge diagnoses, PCI, imaging findings relevant to long-term care.

10. Active or Long-Term Medications

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

Only summarise what is evidenced in the record.

GUARDRAILS - CURRENT STATUS LANGUAGE (CRITICAL)

These are HISTORICAL RECORDS ONLY. You have NO information about the patient's current state.

NEVER use language that implies knowledge of current patient status:
- DO NOT say "currently stable", "well-controlled", "currently managed", "currently on", "presently"
- DO NOT say "continues to", "remains on", "is being treated with", "is maintained on"
- DO NOT make any statements about current condition, current treatment, or current status
- DO NOT say "stable on medication", "controlled with", "managed with"

CORRECT examples:
- "Type 2 diabetes diagnosed 2019, treated with Metformin 1g BD at time of LG record"
- "Hypertension - earliest LG mention 2015"
- "On Atorvastatin 40mg as per LG record dated 2020"

INCORRECT examples (NEVER USE):
- "Type 2 diabetes currently stable on Metformin" ← WRONG
- "Hypertension well-controlled" ← WRONG
- "Currently managed with..." ← WRONG

DIAGNOSIS DATE EXTRACTION (CRITICAL)

For each diagnosis, extract the EARLIEST mention date found in the Lloyd George record:
- Use year only (e.g., "2019") if full date is not known
- Earlier dates take precedence over later dates (2019 wins over 01/06/2024)
- If a condition appears multiple times, use the EARLIEST date
- If no date can be determined, use "Not Known from LG"
- Label dates conceptually as "earliest known date in LG"`;

// SNOMED Mapping Prompt - NHS-compliant GP Clinical Summariser
const SNOMED_MAPPING_PROMPT = `You are an NHS-compliant GP Clinical Summariser.
Your task is to extract only clinically significant information from Lloyd George scanned records and convert it into a structured SNOMED-coded summary, following NHS England GP2GP, RCGP summarisation standards, and NHS Digital best practice.

You must follow ALL rules below without exception.

=========================================
🔵 1. GENERAL RULES
=========================================

Do NOT hallucinate.
Every item you output MUST appear explicitly in the scanned text.

Do NOT infer dates, diagnoses, or medications.
If the date is unclear, set "date": "UNKNOWN" and lower the confidence.

Use ONLY SNOMED CT UK Edition terms and codes.

If data appears conflicting, choose the version with highest clarity and mark lower confidence.

Never include administrative, trivial, or irrelevant content.

=========================================
🔵 2. PAGE HANDLING (MANDATORY)
=========================================

The OCR text contains page markers like:
"--- Page page_001.jpg ---"
"--- Page page_002.jpg ---"

Map these to 0-indexed source_page values:
page_001.jpg → source_page: 0
page_002.jpg → source_page: 1
etc.

Every item MUST include a source_page taken from the last page marker before the evidence text.
Use null only if impossible to determine.

=========================================
🔵 3. WHAT YOU MUST EXTRACT (Allowed Items Only)
=========================================

You may summarise ONLY the following six categories:

A. Active & Significant Diagnoses (Problem List)

Include only long-term or clinically important diagnoses documented in the record:
- Chronic diseases (diabetes, hypertension, COPD, asthma, hypothyroidism, depression, obesity, etc.)
- Significant past diagnoses (MI, stroke, cancer – include remission if stated)

Each diagnosis must include:
- SNOMED code
- SNOMED term
- First evidenced date (or "UNKNOWN")
- Confidence score (0–100 as decimal 0.0-1.0)

B. Past Significant Procedures / Major Surgery

Only include procedures with long-term relevance (e.g., cataract surgery, PCI/stent, cholecystectomy, joint replacement).

C. Allergies / Adverse Reactions

Code all drug, vaccine, or material allergies.
If record states NKDA or No Known Allergies, code that explicitly.

D. Immunisation History

Extract all historically relevant immunisations (flu, COVID, pneumococcal, tetanus, shingles, childhood vaccines).
Each must include:
- SNOMED code
- Date
- Vaccine type/brand where available

E. Long-Term Medication History

Include only long-term or repeat medications.
Exclude short-term acute prescriptions (e.g., antibiotics, short steroids).

F. Smoking Status (if explicitly documented)

Use correct SNOMED codes (e.g., Never smoked, Ex-smoker, Current smoker).

=========================================
🔵 4. WHAT YOU MUST NOT EXTRACT (Forbidden Items)
=========================================

The following must not appear in any output:
- Minor self-limiting conditions (URTI, gastroenteritis, sprains)
- Routine check-ups or general symptoms without diagnosis
- Administrative notes (e.g., "letter sent", "seen in clinic", "review arranged")
- Vital signs unless they support a new diagnosis
- Investigations unless they confirm a diagnosis

=========================================
🔵 5. OUTPUT FORMAT (STRICT)
=========================================

Return JSON with this exact structure:
{
  "items": [
    {
      "category": "diagnosis | surgery | allergy | immunisation | medication",
      "term": "SNOMED Preferred Term",
      "snomed_code": "SNOMED numeric code or MANUAL_REVIEW",
      "snomed_term": "Official SNOMED description or null if MANUAL_REVIEW",
      "date": "DD-MMM-YYYY or UNKNOWN or null",
      "evidence": "Short supporting text from OCR",
      "source_page": 0,
      "confidence": 0.95,
      "review_flag": "CODE_OK | NEEDS_MANUAL_REVIEW",
      "notes": "Short explanation of evidence or why downgraded (optional)"
    }
  ],
  "social_history": {
    "smoking_status": {
      "term": "",
      "snomed_code": "",
      "source_page": null,
      "confidence": 0
    }
  }
}

Do not add any extra top-level keys.

=========================================
🔵 6. SNOMED VERIFICATION REQUIREMENTS
=========================================

For every extracted item:
- Look up and provide the exact SNOMED CT code.
- Verify that the SNOMED term precisely describes the condition/procedure/immunisation.
- If unsure, set "confidence": 0.40 and mark "review_flag": "NEEDS_MANUAL_REVIEW".
- If two codes could apply, choose the broader parent code unless a specific code is explicitly supported by text.
- If the scanned content does not support the SNOMED code → do not output it.

=========================================
🔵 7. CONFIDENCE SCORING RULES
=========================================

90–100% (0.90-1.00)
Text explicitly states diagnosis/immunisation/medication with date
SNOMED code is clear and unambiguous
→ review_flag = "CODE_OK"

70–89% (0.70-0.89)
Text clearly states an item but date unclear
→ review_flag = "CODE_OK"

40–69% (0.40-0.69)
Partially unclear or inconsistent evidence
Needs human verification
→ review_flag = "NEEDS_MANUAL_REVIEW"

<40% (0.00-0.39)
Evidence weak, missing, or inconsistent
→ review_flag = "NEEDS_MANUAL_REVIEW"
Only include if clearly clinically important

=========================================
⚠️ 8. CRITICAL: EARLIEST DATE RULE
=========================================

**THIS IS THE MOST IMPORTANT RULE FOR DIAGNOSES.**

Before assigning ANY date to a diagnosis, you MUST:

1. **SEARCH THE ENTIRE OCR** for ALL mentions of that condition across ALL pages.
2. **LIST ALL DATES** where the condition appears (even as "Type 2 Diabetes - stable" or similar).
3. **SELECT THE EARLIEST DATE** from your list. Earlier years ALWAYS win (2019 beats 2023).
4. **Set source_page to the page with the EARLIEST date**, not the most recent page.

**CONCRETE EXAMPLE:**
- Page 4 (dated 01-Mar-2024): "Active Problems: Type 2 Diabetes" 
- Page 10 (dated 06-Feb-2023): "Exacerbation of Type 2 Diabetes"
- Page 13 (dated 15-Jun-2019): "Type 2 Diabetes - stable"

→ **CORRECT OUTPUT**: date = "15-Jun-2019", source_page = 13
→ **WRONG OUTPUT**: date = "06-Feb-2023" (this is NOT the earliest!)

**FAILURE TO FOLLOW THIS RULE = INCORRECT CLINICAL DATA**

The goal is to capture when the condition was FIRST documented, not when it was last mentioned.

=========================================
🔵 9. ANTI-HALLUCINATION RULES (CRITICAL)
=========================================

### 9.1 General Rules
- Only code what is explicitly documented.
- Re-check each code against the term.
- If the code implies something different from the written diagnosis, set snomed_code = "MANUAL_REVIEW".

### 9.2 Surgeries (CRITICAL)
You MUST NOT extract a surgery unless the note explicitly states that surgery.
- Do NOT include "Cholecystectomy" unless the word "Cholecystectomy" appears verbatim.
- Do NOT include "Hemicolectomy" unless the word "Hemicolectomy" appears verbatim.
- If the surgery is NOT present in the OCR evidence, do not fabricate it.

### 9.3 Diagnoses (CRITICAL)
- Do NOT infer diagnoses from medication names.
- If you see "Metformin" but no explicit "diabetes" diagnosis, do NOT add diabetes.
- If you see "Obesity" explicitly stated, include it. If not stated, do NOT add it.

=========================================
🔵 10. MANDATORY CODE OVERRIDES (NO EXCEPTIONS)
=========================================

These are non-negotiable. If the evidence matches, you MUST follow these exact mappings.

### 10.1 NSTEMI
If text contains "NSTEMI", "Non-ST elevation myocardial infarction", or "Non-ST-elevation MI":
{
  "term": "Acute non-ST elevation myocardial infarction (NSTEMI)",
  "snomed_code": "401314000",
  "snomed_term": "Acute non-ST segment elevation myocardial infarction (disorder)",
  "confidence": 0.95,
  "review_flag": "CODE_OK"
}

### 10.2 STEMI
If text contains "STEMI" or "ST elevation myocardial infarction":
{
  "term": "Acute ST elevation myocardial infarction (STEMI)",
  "snomed_code": "304914007",
  "snomed_term": "Acute ST segment elevation myocardial infarction (disorder)",
  "confidence": 0.95,
  "review_flag": "CODE_OK"
}

### 10.3 PCI
If text contains "PCI", "percutaneous coronary intervention", "coronary angioplasty", "drug-eluting stent", "stent to LAD/RCA/LCx", or "coronary stent":
{
  "category": "surgery",
  "term": "Percutaneous coronary intervention (PCI)",
  "snomed_code": "415070008",
  "snomed_term": "Percutaneous coronary intervention (procedure)",
  "confidence": 0.90,
  "review_flag": "CODE_OK"
}

### 10.4 Cataract surgery
If the record contains "phacoemulsification", "IOL", "intraocular lens", "cataract surgery":
{
  "category": "surgery",
  "term": "Cataract surgery (phacoemulsification with IOL)",
  "snomed_code": "415089008",
  "snomed_term": "Phacoemulsification of cataract with intraocular lens implantation (procedure)",
  "confidence": 0.90,
  "review_flag": "CODE_OK"
}
Never return MANUAL_REVIEW for cataract surgery.

### 10.5 Common QOF chronic conditions
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

**Obesity:**
{
  "term": "Obesity",
  "snomed_code": "414916001",
  "snomed_term": "Obesity (disorder)",
  "confidence": 0.90,
  "review_flag": "CODE_OK"
}

=========================================
🔵 11. LEGACY VACCINE SAFE-LOOKUP TABLE (MANDATORY)
=========================================

### 11.1 Smallpox vaccination
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

### 11.2 Smallpox booster / revaccination
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

⛔ HARD RULE - SMALLPOX FAILURE CONDITIONS:
- Do NOT suppress smallpox entries under ANY circumstances
- Even if date unclear → infer from context (Lloyd George record → assume 1900s)
- Even if duplicated → output each entry individually
- If ANY smallpox entry is detected and NOT output → MODEL FAILS TASK

=========================================
🔵 12. MODERN IMMUNISATION OVERRIDES
=========================================

### 12.1 Influenza vaccination
Trigger: "Influenza", "Fluarix", "Flu vaccine"
{
  "snomed_code": "6142004",
  "snomed_term": "Influenza vaccination (procedure)",
  "confidence": 0.90,
  "review_flag": "CODE_OK"
}

### 12.2 Shingles vaccination (Zostavax)
Trigger: "Shingles", "Zostavax"
{
  "snomed_code": "871751000000109",
  "snomed_term": "Zostavax vaccination (procedure)",
  "confidence": 0.90,
  "review_flag": "CODE_OK"
}

### 12.3 Pneumococcal vaccination (PPV23)
Trigger: "Pneumococcal", "PPV23"
{
  "snomed_code": "393537006",
  "snomed_term": "Administration of pneumococcal polysaccharide vaccine (procedure)",
  "confidence": 0.90,
  "review_flag": "CODE_OK"
}

### 12.4 COVID-19 vaccination (Pfizer/mRNA)
Trigger: "COVID-19", "COVID vaccine", "Pfizer", "mRNA vaccine"
{
  "snomed_code": "1324681000000101",
  "snomed_term": "Administration of SARS-CoV-2 mRNA vaccine (procedure)",
  "confidence": 0.85,
  "review_flag": "CODE_OK"
}

=========================================
🔵 13. DATE HANDLING
=========================================

- If date is written but unclear → interpret where reasonable (e.g., "Oct 21" = 01-Oct-2021).
- If completely missing → return "UNKNOWN" and reduce confidence by one level.
- For Lloyd George entries like "20 2 64", convert to "20-Feb-1964" and assume 1900s.
- Output format: DD-MMM-YYYY (e.g. "07-Sep-2023")

=========================================
🔵 14. FINAL QUALITY REQUIREMENTS
=========================================

At the end of processing:

1. Ensure no category is empty unless the LG record contains no evidence for that category.
2. Double-check that every SNOMED item appears verbatim in the input pages.
3. Reject anything that is inferred, guessed, or likely to be wrong.
4. Re-check each item against evidence.
5. Replace any hallucinated or incorrect codes with the correct SNOMED term + code.
6. Apply legacy vaccine overrides again.
7. Mark any changed entries with: "notes": "Corrected during final audit"`;

// Patient details extraction prompt (Enhanced with Previous Names & NHS Validation)
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
  "previous_names": [],
  "nhs_number": null,
  "date_of_birth": null,
  "sex": "unknown",
  "confidence": 0.0,
  "identity_issues": []
}

Replace null fields with actual values only when clearly identified.

PREVIOUS NAMES EXTRACTION (MANDATORY)

Look for and extract ALL previous names found in the Lloyd George records:
- Maiden names: Look for "née", "born", maiden name annotations, or different surnames on older documents
- Previous married names: Look for name changes, marriage certificates, or different surnames across time periods
- Any name variants that appear on the LG cards

For each previous name found, add an object to previous_names array:
{
  "name": "Full previous name",
  "type": "maiden" | "married" | "previous",
  "evidence": "Where found, e.g. 'LG card dated 1970' or 'marriage certificate'"
}

IDENTITY VERIFICATION (CRITICAL SAFETY CHECK)

Scan ALL pages and verify that ALL documents belong to the SAME patient:
- Check that NHS numbers are consistent across all pages
- Check that DOBs are consistent across all pages
- Check that names (accounting for previous names) are consistent

If you find ANY inconsistencies, add to identity_issues array:
{
  "type": "nhs_mismatch" | "dob_mismatch" | "name_mismatch" | "third_party_document",
  "description": "Clear description of the issue",
  "page_reference": "Which page(s) have the issue"
}

NHS NUMBER VALIDATION

The NHS number MUST be exactly 10 digits. Common OCR errors to watch for:
- Extra digits at the start or end (e.g., "1" prepended)
- Missing digits
- Letters mistaken for numbers (O for 0, I for 1)

If you find multiple NHS number candidates, extract the one that is:
1. Exactly 10 digits
2. Appears most consistently across documents
3. Located in an official header/identification section

FIELD RULES

patient_name
Must appear in a structured location: LG card header, form header, identification block.

nhs_number
10-digit NHS number from structured sections. MUST be exactly 10 digits.

date_of_birth
Convert to YYYY-MM-DD.

sex
From explicit markers (Male/Female/M/F). Otherwise "unknown".

confidence

0.9–1.0 if name + DOB + NHS number all clear AND no identity issues

0.7–0.8 if name + one other identifier AND no identity issues

0.4–0.6 if only name is clear OR if identity issues found

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
        
        // NHS NUMBER VALIDATION using Mod 11 checksum
        let nhsNumberValidated = false;
        if (extractedPatient.nhs_number) {
          const cleanedNhs = extractedPatient.nhs_number.replace(/[\s-]/g, '');
          
          // Check length
          if (cleanedNhs.length === 10 && /^\d{10}$/.test(cleanedNhs)) {
            // Modulus 11 checksum validation
            const weights = [10, 9, 8, 7, 6, 5, 4, 3, 2];
            let sum = 0;
            for (let i = 0; i < 9; i++) {
              sum += parseInt(cleanedNhs[i], 10) * weights[i];
            }
            const remainder = sum % 11;
            const checkDigit = 11 - remainder;
            const expectedCheckDigit = checkDigit === 11 ? 0 : checkDigit;
            const actualCheckDigit = parseInt(cleanedNhs[9], 10);
            
            if (checkDigit === 10) {
              console.log('NHS number checksum validation: invalid (check digit would be 10)');
              nhsNumberValidated = false;
            } else if (expectedCheckDigit === actualCheckDigit) {
              console.log('NHS number checksum validation: PASSED');
              nhsNumberValidated = true;
            } else {
              console.log(`NHS number checksum validation: FAILED (expected ${expectedCheckDigit}, got ${actualCheckDigit})`);
              nhsNumberValidated = false;
            }
          } else {
            console.log(`NHS number length validation: FAILED (got ${cleanedNhs.length} digits, expected 10)`);
            nhsNumberValidated = false;
            
            // Try to fix common OCR errors
            if (cleanedNhs.length === 11 && cleanedNhs.startsWith('1')) {
              // Extra "1" at the start - common OCR error
              const corrected = cleanedNhs.substring(1);
              console.log(`Attempting correction: removing leading 1 -> ${corrected}`);
              extractedPatient.nhs_number = corrected;
              // Re-validate after correction
              const weights = [10, 9, 8, 7, 6, 5, 4, 3, 2];
              let sum = 0;
              for (let i = 0; i < 9; i++) {
                sum += parseInt(corrected[i], 10) * weights[i];
              }
              const remainder = sum % 11;
              const checkDigit = 11 - remainder;
              const expectedCheckDigit = checkDigit === 11 ? 0 : checkDigit;
              const actualCheckDigit = parseInt(corrected[9], 10);
              if (checkDigit !== 10 && expectedCheckDigit === actualCheckDigit) {
                console.log('Corrected NHS number checksum validation: PASSED');
                nhsNumberValidated = true;
              }
            }
          }
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
        
        // Determine identity verification status
        const identityIssues = extractedPatient.identity_issues || [];
        let identityVerificationStatus = 'verified';
        if (identityIssues.length > 0) {
          const hasCritical = identityIssues.some((i: any) => 
            i.type === 'nhs_mismatch' || i.type === 'third_party_document'
          );
          identityVerificationStatus = hasCritical ? 'conflict' : 'warning';
        } else if (!nhsNumberValidated && extractedPatient.nhs_number) {
          identityVerificationStatus = 'warning';
        } else if (!extractedPatient.nhs_number && !extractedPatient.date_of_birth) {
          identityVerificationStatus = 'pending';
        }
        
        console.log('Patient details after validation:', extractedPatient);
        console.log('Identity verification status:', identityVerificationStatus);
        
        // Update patient record with extracted details
        const updateData: any = {
          ai_extracted_name: extractedPatient.patient_name || null,
          ai_extracted_nhs: extractedPatient.nhs_number?.replace(/\s/g, '') || null,
          ai_extracted_dob: extractedPatient.date_of_birth || null,
          ai_extracted_sex: (extractedPatient.sex || 'unknown').toLowerCase(),
          ai_extraction_confidence: extractedPatient.confidence || 0,
          requires_verification: (extractedPatient.confidence || 0) < 0.8 || !nhsNumberValidated || identityIssues.length > 0,
          // New fields
          previous_names: extractedPatient.previous_names || [],
          identity_verification_status: identityVerificationStatus,
          identity_verification_issues: identityIssues,
          nhs_number_validated: nhsNumberValidated,
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
          // Normalise sex to lowercase to match database check constraint
          updateData.sex = extractedPatient.sex.toLowerCase();
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
Return valid JSON matching this schema exactly. This is a FORMAT EXAMPLE ONLY - do NOT copy values from this example:

{
  "summary_line": "",
  "diagnoses": [],
  "surgeries": [],
  "allergies": [],
  "immunisations": [],
  "immunisation_summary": "",
  "family_history": [],
  "social_history": {"smoking_status":"unknown", "stopped_year":"", "pack_years":"", "alcohol":"unknown", "occupation":""},
  "reproductive_history": {"gravida":0, "para":0, "miscarriages":0, "notes":""},
  "hospital_findings": [],
  "medications": [{"drug": "Drug Name", "dose": "Dose e.g. 1g BD", "most_recent_date": "DD/MM/YYYY or year or Not Known from LG"}],
  "alerts": [],
  "free_text_findings": "",
  "verification_flags": {"all_active_problems_coded": false, "allergies_verified": false, "medications_verified": false},
  "summary_metadata": "Summary completed ${new Date().toISOString().split('T')[0]} by Notewell AI"
}

MEDICATION EXTRACTION (MANDATORY):
- Extract ALL medications that appear VERBATIM in the OCR text
- Include drug name, dose if present, and date/year if recorded
- Look for "Current Medications", medication lists, prescription records
- Common medications to look for: Metformin, Gliclazide, Lisinopril, Sertraline, Omeprazole, Atorvastatin, Ramipril, Amlodipine, etc.

CRITICAL ANTI-HALLUCINATION RULES:
1. ONLY extract information that is EXPLICITLY WRITTEN in the OCR text below.
2. If a field has NO clear evidence in the OCR, return an empty array [] or empty string "".
3. DO NOT infer diagnoses from medications UNLESS there is corroborating evidence (e.g., clinic letter, problem list entry).
4. DO NOT copy from the schema example above - it is a FORMAT example only showing structure.
5. When in doubt, LEAVE IT OUT.
6. For medications: only include if the drug name appears VERBATIM in the OCR text.
7. For surgeries: only include if the procedure name appears VERBATIM in the OCR text.
8. Never fill in "typical" patterns - each patient record is unique.
9. If OCR text is sparse or unclear, return mostly empty arrays - this is expected and correct behaviour.

SECONDARY CONDITIONS EXTRACTION:
10. Extract ALL conditions from any problem list in the record, not just major headline diagnoses.
11. Include conditions like glaucoma, sleep apnoea, hearing loss when explicitly documented.

SMOKING STATUS (MANDATORY):
12. ALWAYS extract smoking status if present - this is critical clinical data.
13. Set social_history.smoking_status to: "current smoker", "ex-smoker", "never smoked", or "unknown".
14. If ex-smoker, set stopped_year to the year they stopped (e.g., "2015").
15. Include pack_years if documented.

IMMUNISATION SUMMARY:
16. After extracting individual immunisations, create a one-line immunisation_summary.
17. Example: "Fully vaccinated incl. flu 2023, COVID booster 2023, pneumococcal 2022"
18. If minimal immunisation data, leave as empty string.

VERIFICATION FLAGS:
19. Set all_active_problems_coded to true if you are confident all problem list items are captured.
20. Set allergies_verified to true if allergy status is explicitly documented (including NKDA).
21. Set medications_verified to true if medication list appears complete and current.

OCR Text:
${fullOcrText.substring(0, 50000)}`;

      try {
        summaryJson = await callOpenAI(openaiKey, SUMMARISER_SYSTEM_PROMPT, summaryPrompt);
        console.log('Summary generated successfully');
        
        // Post-process: correct medication dates to use MOST RECENT date from OCR
        summaryJson = correctMostRecentMedicationDates(summaryJson, fullOcrText, dob !== 'Unknown' ? dob : undefined);
        console.log('Medication dates corrected to most recent');
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

    if (openaiKey && fullOcrText.length > 100) {
      const snomedPrompt = `Extract SNOMED-coded clinical items ONLY from the OCR text below.

CRITICAL PRE-PROCESSING STEP (DO THIS FIRST):
Before extracting any diagnoses, you MUST scan the ENTIRE OCR text and create a mental list of ALL dates where each condition appears.
For example, if you see "Type 2 Diabetes" mentioned on multiple pages with dates 2024, 2023, 2022, 2019 - the output date MUST be 2019 (the earliest).

MANDATORY WORKFLOW:
1. First pass: Scan ALL pages and list ALL conditions with ALL their dates
2. For each condition, identify the EARLIEST date across all pages  
3. Only then create the JSON output with that earliest date

CRITICAL: Do NOT assume or infer any clinical information not explicitly present in the text.
Extract ONLY what is VERBATIM in the OCR - if a diagnosis, surgery, or immunisation is not written, do not include it.

OCR Text (note the page markers like "--- Page page_001.jpg ---"):
${fullOcrText.substring(0, 50000)}`;

      try {
        // Single-step: AI extracts concepts AND provides SNOMED codes directly
        const aiSnomedOutput = await callOpenAI(openaiKey, SNOMED_MAPPING_PROMPT, snomedPrompt);
        console.log('AI SNOMED extraction complete');
        
        // Convert flat items array to domain-based structure for backward compatibility
        // Pass patient DOB to EXCLUDE from diagnosis date search (prevents DOB being used as diagnosis date)
        snomedJson = convertItemsToSnomedDomains(aiSnomedOutput, fullOcrText, dob !== 'Unknown' ? dob : undefined);
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
function convertItemsToSnomedDomains(aiOutput: any, ocrText: string = '', patientDob?: string): any {
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
  
  // POST-PROCESSING: Correct dates to use earliest found in OCR, EXCLUDING patient DOB
  const correctedResult = correctEarliestDates(result, ocrText, patientDob);
  
  return correctedResult;
}

/**
 * Parse a date string and return a Date object, or null if invalid
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === 'NK' || dateStr === 'UNKNOWN' || dateStr === '') return null;
  
  // Try various date formats
  const formats = [
    // DD/MM/YYYY or DD-MM-YYYY
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
    // DD/MM/YY or DD-MM-YY
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/,
    // DD-MMM-YYYY (e.g., 15-Jun-2019)
    /^(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{4})$/,
    // YYYY-MM-DD
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
    // Just year: YYYY
    /^(\d{4})$/,
  ];
  
  const monthNames: Record<string, number> = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
  };
  
  // DD/MM/YYYY or DD-MM-YYYY
  let match = dateStr.match(formats[0]);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  
  // DD/MM/YY
  match = dateStr.match(formats[1]);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    let year = parseInt(match[3], 10);
    year = year < 50 ? 2000 + year : 1900 + year;
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  
  // DD-MMM-YYYY
  match = dateStr.match(formats[2]);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthStr = match[2].toLowerCase();
    const month = monthNames[monthStr];
    const year = parseInt(match[3], 10);
    if (month !== undefined) {
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
  }
  
  // YYYY-MM-DD
  match = dateStr.match(formats[3]);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  
  // Just year
  match = dateStr.match(formats[4]);
  if (match) {
    const year = parseInt(match[1], 10);
    const d = new Date(year, 0, 1); // January 1st of that year
    if (!isNaN(d.getTime())) return d;
  }
  
  // Try native Date parsing as last resort
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  
  return null;
}

/**
 * Extract all dates from text that appear near a diagnosis term
 */
function findAllDatesForTerm(term: string, ocrText: string): { date: string; pageNum: number }[] {
  const results: { date: string; pageNum: number }[] = [];
  if (!term || !ocrText) return results;
  
  // Build search variations for the term - be aggressive with variations
  const termLower = term.toLowerCase();
  const searchTerms = new Set<string>();
  
  // Add base term
  searchTerms.add(termLower);
  
  // Remove common suffixes
  searchTerms.add(termLower.replace(' (disorder)', '').trim());
  searchTerms.add(termLower.replace('(disorder)', '').trim());
  searchTerms.add(termLower.replace(' mellitus', '').trim());
  
  // Diabetes specific variations
  if (termLower.includes('diabetes')) {
    searchTerms.add('diabetes');
    searchTerms.add('type 2 diabetes');
    searchTerms.add('type2 diabetes');
    searchTerms.add('t2 diabetes');
    searchTerms.add('t2dm');
    searchTerms.add('dm2');
    searchTerms.add('dm type 2');
    searchTerms.add('diabetic');
  }
  
  // More variations
  searchTerms.add(termLower.replace('type 2 ', 't2 '));
  searchTerms.add(termLower.replace('type 2 ', ''));
  
  // Filter to valid terms (>3 chars)
  const validSearchTerms = Array.from(searchTerms).filter(t => t.length > 3);
  
  console.log(`Date search terms for "${term}": ${validSearchTerms.join(', ')}`);
  
  // Date extraction patterns - comprehensive
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g,  // DD/MM/YYYY or DD-MM-YYYY
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})(?!\d)/g,  // DD/MM/YY
    /(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{4})/g,  // DD-MMM-YYYY
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g,  // YYYY-MM-DD
  ];
  
  // Try multiple page splitting strategies
  // Strategy 1: --- Page page_X.jpg --- format
  let pageRegex = /---\s*Page\s+page_(\d+)\.(jpg|jpeg|png)\s*---/gi;
  let parts = ocrText.split(pageRegex);
  
  // Strategy 2: If that didn't work, try page_X.jpg marker alone
  if (parts.length <= 1) {
    pageRegex = /page_(\d+)\.(jpg|jpeg|png)/gi;
    parts = [];
    let lastIndex = 0;
    let match;
    while ((match = pageRegex.exec(ocrText)) !== null) {
      if (lastIndex > 0) {
        const pageNum = parseInt(parts[parts.length - 2], 10);
        parts.push(ocrText.substring(lastIndex, match.index)); // page text
      }
      parts.push('marker'); // placeholder
      parts.push(match[1]); // page number
      parts.push(match[2]); // extension
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex > 0 && lastIndex < ocrText.length) {
      parts.push(ocrText.substring(lastIndex));
    }
  }
  
  console.log(`Found ${Math.floor(parts.length / 3)} pages in OCR text`);
  
  // If still no pages found, search entire text without page tracking
  if (parts.length <= 1) {
    console.log('No page markers found, searching entire OCR text');
    const textLower = ocrText.toLowerCase();
    const hasTerm = validSearchTerms.some(t => textLower.includes(t));
    
    if (hasTerm) {
      for (const pattern of datePatterns) {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(textLower)) !== null) {
          const dateStr = match[0];
          if (!results.some(r => r.date === dateStr)) {
            results.push({ date: dateStr, pageNum: 1 });
          }
        }
      }
    }
    return results;
  }
  
  // Process each page from split results
  for (let i = 1; i < parts.length; i += 3) {
    const pageNumStr = parts[i];
    const pageNum = parseInt(pageNumStr, 10);
    if (isNaN(pageNum)) continue;
    
    const pageText = (parts[i + 2] || '').toLowerCase();
    
    // Check if this page mentions the diagnosis
    const hasTerm = validSearchTerms.some(t => pageText.includes(t));
    if (!hasTerm) continue;
    
    console.log(`Page ${pageNum} contains diagnosis term`);
    
    // Find all dates on this page
    for (const pattern of datePatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(pageText)) !== null) {
        const dateStr = match[0];
        // Don't add duplicates
        if (!results.some(r => r.date === dateStr && r.pageNum === pageNum)) {
          results.push({ date: dateStr, pageNum });
          console.log(`Found date "${dateStr}" on page ${pageNum}`);
        }
      }
    }
  }
  
  return results;
}

/**
 * Find the earliest date from a list of date strings, optionally excluding patient DOB
 */
function findEarliestDate(dates: { date: string; pageNum: number }[], excludeDob?: Date | null): { date: string; pageNum: number } | null {
  if (dates.length === 0) return null;
  
  let earliest: { date: string; pageNum: number; parsed: Date } | null = null;
  
  for (const d of dates) {
    const parsed = parseDate(d.date);
    if (parsed) {
      // CRITICAL: Skip dates that match the patient's DOB (within 1 day tolerance)
      if (excludeDob && Math.abs(parsed.getTime() - excludeDob.getTime()) < 86400000) {
        console.log(`SKIPPING date "${d.date}" - matches patient DOB`);
        continue;
      }
      
      if (!earliest || parsed < earliest.parsed) {
        earliest = { date: d.date, pageNum: d.pageNum, parsed };
      }
    }
  }
  
  if (earliest) {
    return { date: earliest.date, pageNum: earliest.pageNum };
  }
  return null;
}

/**
 * Format a date string to DD-MMM-YYYY format
 */
function formatToStandardDate(dateStr: string): string {
  const parsed = parseDate(dateStr);
  if (!parsed) return dateStr;
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = months[parsed.getMonth()];
  const year = parsed.getFullYear();
  
  return `${day}-${month}-${year}`;
}

/**
 * Post-process SNOMED output to correct dates to the earliest found in OCR
 * @param patientDob - Patient date of birth to EXCLUDE from diagnosis date search
 */
function correctEarliestDates(snomedOutput: any, ocrText: string, patientDob?: string): any {
  if (!snomedOutput || !ocrText) return snomedOutput;
  
  // Parse patient DOB for exclusion - this is CRITICAL to prevent DOB being used as diagnosis date
  const patientDobParsed = patientDob ? parseDate(patientDob) : null;
  if (patientDobParsed) {
    console.log(`Patient DOB parsed for exclusion: ${patientDob} → ${patientDobParsed.toISOString()}`);
  }
  
  // Only process diagnoses (most likely to have multiple date mentions)
  const diagnoses = snomedOutput.diagnoses || [];
  
  for (const item of diagnoses) {
    const term = item.term || '';
    if (!term) continue;
    
    // Find all dates for this diagnosis in the OCR
    const allDates = findAllDatesForTerm(term, ocrText);
    console.log(`Searching for earliest date for "${term}": found ${allDates.length} date candidates`);
    
    if (allDates.length === 0) continue;
    
    // Find the earliest date, EXCLUDING patient DOB
    const earliest = findEarliestDate(allDates, patientDobParsed);
    if (!earliest) continue;
    
    // Parse AI's current date
    const aiDate = parseDate(item.date);
    const earliestParsed = parseDate(earliest.date);
    
    if (earliestParsed && aiDate) {
      if (earliestParsed < aiDate) {
        console.log(`CORRECTING date for "${term}": ${item.date} → ${earliest.date} (page ${earliest.pageNum})`);
        item.date = formatToStandardDate(earliest.date);
        // Update source page to the page with earliest date
        item.source_page = earliest.pageNum - 1; // 0-indexed
        item.date_corrected = true;
      }
    } else if (earliestParsed && !aiDate) {
      // AI had no date, but we found one
      console.log(`ADDING date for "${term}": ${earliest.date} (page ${earliest.pageNum})`);
      item.date = formatToStandardDate(earliest.date);
      item.source_page = earliest.pageNum - 1;
      item.date_corrected = true;
    }
  }
  
  return snomedOutput;
}

/**
 * Find all dates from text that appear near a medication drug name
 */
function findAllDatesForMedication(drugName: string, ocrText: string): { date: string; pageNum: number }[] {
  const results: { date: string; pageNum: number }[] = [];
  if (!drugName || !ocrText) return results;
  
  // Build search variations for the drug name
  const drugLower = drugName.toLowerCase().trim();
  const searchTerms = new Set<string>();
  
  // Add base drug name
  searchTerms.add(drugLower);
  
  // Add common variations (remove common suffixes)
  searchTerms.add(drugLower.replace(/\s+(tablets?|capsules?|mg|mcg|ml|bd|od|tds|qds|prn)$/i, '').trim());
  
  // Filter to valid terms (>3 chars)
  const validSearchTerms = Array.from(searchTerms).filter(t => t.length > 3);
  
  console.log(`Medication date search terms for "${drugName}": ${validSearchTerms.join(', ')}`);
  
  // Date extraction patterns - comprehensive
  const datePatterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g,  // DD/MM/YYYY or DD-MM-YYYY
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})(?!\d)/g,  // DD/MM/YY
    /(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{4})/g,  // DD-MMM-YYYY
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/g,  // YYYY-MM-DD
  ];
  
  // Split by page markers
  const pageRegex = /---\s*Page\s+page_(\d+)\.(jpg|jpeg|png)\s*---/gi;
  const parts = ocrText.split(pageRegex);
  
  // If no pages found, search entire text
  if (parts.length <= 1) {
    const textLower = ocrText.toLowerCase();
    const hasDrug = validSearchTerms.some(t => textLower.includes(t));
    
    if (hasDrug) {
      for (const pattern of datePatterns) {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(textLower)) !== null) {
          const dateStr = match[0];
          if (!results.some(r => r.date === dateStr)) {
            results.push({ date: dateStr, pageNum: 1 });
          }
        }
      }
    }
    return results;
  }
  
  // Process each page from split results
  for (let i = 1; i < parts.length; i += 3) {
    const pageNumStr = parts[i];
    const pageNum = parseInt(pageNumStr, 10);
    if (isNaN(pageNum)) continue;
    
    const pageText = (parts[i + 2] || '').toLowerCase();
    
    // Check if this page mentions the medication
    const hasDrug = validSearchTerms.some(t => pageText.includes(t));
    if (!hasDrug) continue;
    
    // Find all dates on this page
    for (const pattern of datePatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(pageText)) !== null) {
        const dateStr = match[0];
        if (!results.some(r => r.date === dateStr && r.pageNum === pageNum)) {
          results.push({ date: dateStr, pageNum });
        }
      }
    }
  }
  
  return results;
}

/**
 * Find the LATEST (most recent) date from a list of date strings, excluding patient DOB
 */
function findLatestDate(dates: { date: string; pageNum: number }[], excludeDob?: Date | null): { date: string; pageNum: number } | null {
  if (dates.length === 0) return null;
  
  let latest: { date: string; pageNum: number; parsed: Date } | null = null;
  
  for (const d of dates) {
    const parsed = parseDate(d.date);
    if (parsed) {
      // Skip dates that match the patient's DOB (within 1 day tolerance)
      if (excludeDob && Math.abs(parsed.getTime() - excludeDob.getTime()) < 86400000) {
        continue;
      }
      
      // Skip unrealistic future dates
      const now = new Date();
      if (parsed > now) continue;
      
      if (!latest || parsed > latest.parsed) {
        latest = { date: d.date, pageNum: d.pageNum, parsed };
      }
    }
  }
  
  if (latest) {
    return { date: latest.date, pageNum: latest.pageNum };
  }
  return null;
}

/**
 * Post-process summary to correct medication dates to the MOST RECENT found in OCR
 */
function correctMostRecentMedicationDates(summaryJson: any, ocrText: string, patientDob?: string): any {
  if (!summaryJson || !ocrText || !summaryJson.medications) return summaryJson;
  
  const patientDobParsed = patientDob ? parseDate(patientDob) : null;
  if (patientDobParsed) {
    console.log(`Patient DOB parsed for medication date exclusion: ${patientDob}`);
  }
  
  const medications = summaryJson.medications || [];
  
  for (const med of medications) {
    const drug = med.drug || '';
    if (!drug || drug.toLowerCase() === 'unknown') continue;
    
    // Find all dates for this medication in the OCR
    const allDates = findAllDatesForMedication(drug, ocrText);
    console.log(`Searching for most recent date for medication "${drug}": found ${allDates.length} date candidates`);
    
    if (allDates.length === 0) continue;
    
    // Find the LATEST (most recent) date, excluding patient DOB
    const latest = findLatestDate(allDates, patientDobParsed);
    if (!latest) continue;
    
    // Parse AI's current date
    const currentDate = med.most_recent_date || med.date;
    const aiDate = parseDate(currentDate);
    const latestParsed = parseDate(latest.date);
    
    if (latestParsed && aiDate) {
      // Only update if we found a more recent date
      if (latestParsed > aiDate) {
        console.log(`CORRECTING medication date for "${drug}": ${currentDate} → ${latest.date}`);
        med.most_recent_date = formatToStandardDate(latest.date);
        med.date_corrected = true;
      }
    } else if (latestParsed && !aiDate) {
      // AI had no date, but we found one
      console.log(`ADDING medication date for "${drug}": ${latest.date}`);
      med.most_recent_date = formatToStandardDate(latest.date);
      med.date_corrected = true;
    }
  }
  
  return summaryJson;
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
  return `Lloyd_George_${partNumStr}_of_${totalPartsStr}_${lastName}_${firstName}_${cleanNhs}_${dobFormatted}.pdf`;
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
