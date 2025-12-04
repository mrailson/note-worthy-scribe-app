import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

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
const SNOMED_CONCEPT_PROMPT = `You are a clinical coder for UK primary care. Extract clinical CONCEPTS from the summary.
DO NOT generate SNOMED codes - just identify the clinical terms that need coding.

The OCR text contains page markers like "--- Page page_001.jpg ---" before each page's content.
You MUST identify which page each clinical term was found on by looking at the nearest page marker BEFORE the evidence text.

Return JSON with clinical terms to be coded:

{
  "diagnoses": [{"term":"clinical condition name","date":"","evidence":"text from source","source_page":1}],
  "surgeries": [{"term":"procedure name","date":"","evidence":"","source_page":2}],
  "allergies": [{"term":"allergen or drug name","date":"","evidence":"","source_page":null}],
  "immunisations": [{"term":"vaccine name","date":"","evidence":"","source_page":3}]
}

RULES:
- Use standard UK clinical terminology (e.g., "Type 2 diabetes mellitus", "Hypertension", "Asthma")
- Be specific: "Chronic obstructive pulmonary disease" not just "lung disease"
- Include dates where mentioned (YYYY, MMM YYYY, or "Pre Oct 2020" format)
- Evidence should be a short snippet from the source text
- source_page: Extract the page number from the "--- Page page_XXX.jpg ---" marker that appears BEFORE the evidence text. If page_001.jpg, source_page=1. If page_012.jpg, source_page=12. Use null if cannot determine.

ONLY extract:
1. Major diagnoses and chronic conditions
2. Major surgical procedures (appendectomy, cholecystectomy, hip replacement, etc.)
3. Allergies and adverse drug reactions
4. Immunisations/vaccinations

DO NOT extract:
- Minor self-limiting illnesses
- Social history
- Family history
- Medications`;

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
  const googleVisionKey = Deno.env.get('GOOGLE_VISION_API_KEY');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { patientId } = await req.json();
    
    if (!patientId) {
      throw new Error('Missing patientId');
    }

    console.log(`Processing patient: ${patientId}`);

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

    // =====================================================
    // CHECK FOR RESUMABLE STATE: If OCR is complete but summary failed, resume from summary
    // =====================================================
    if (patient.processing_phase === 'summary' && 
        patient.ocr_batches_completed > 0 && 
        patient.ocr_batches_completed >= patient.ocr_batches_total) {
      console.log(`Resuming from summary phase for patient: ${patientId}`);
      
      // Reset status for retry
      await supabase
        .from('lg_patients')
        .update({ 
          job_status: 'processing',
          error_message: null,
        })
        .eq('id', patientId);
      
      // Directly invoke summary processing
      await supabase.functions.invoke('lg-process-summary', {
        body: { patientId },
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          patientId, 
          mode: 'resumed-summary',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // List raw images to determine processing path
    const { data: files, error: listError } = await supabase.storage
      .from('lg')
      .list(`${basePath}/raw`, { sortBy: { column: 'name', order: 'asc' } });

    if (listError || !files || files.length === 0) {
      throw new Error(`No images found: ${listError?.message}`);
    }

    const imageCount = files.length;
    const BATCH_THRESHOLD = 15; // Switch to batched processing above this (lowered for memory safety)
    const BATCH_SIZE = 10;

    // Update status to processing with OCR start time
    const ocrStartTime = new Date().toISOString();
    await supabase
      .from('lg_patients')
      .update({ 
        job_status: 'processing',
        processing_started_at: ocrStartTime,
        processing_phase: imageCount > BATCH_THRESHOLD ? 'ocr' : 'processing',
        ocr_batches_total: imageCount > BATCH_THRESHOLD ? Math.ceil(imageCount / BATCH_SIZE) : 0,
        ocr_batches_completed: 0,
        ocr_started_at: ocrStartTime,
      })
      .eq('id', patientId);

    // Log processing started
    await logAudit(supabase, patientId, 'processing_started', patient.uploader_name, {
      images_count: imageCount,
      processing_mode: imageCount > BATCH_THRESHOLD ? 'batched' : 'single-pass',
    });

    // =====================================================
    // BRANCHING: Use batched processing for large records
    // =====================================================
    if (imageCount > BATCH_THRESHOLD) {
      console.log(`Large record (${imageCount} pages) - using batched OCR processing`);
      
      // Trigger first OCR batch (fire-and-forget chain)
      await supabase.functions.invoke('lg-ocr-batch', {
        body: { patientId, batchNumber: 0 },
      });

      // Return immediately - batched processing continues in background
      return new Response(
        JSON.stringify({ 
          success: true, 
          patientId, 
          mode: 'batched',
          totalBatches: Math.ceil(imageCount / BATCH_SIZE),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // FAST PATH: Single-pass processing for ≤25 pages
    // =====================================================
    console.log(`Small record (${imageCount} pages) - using single-pass processing`);
    console.log(`Processing ${files.length} images with OCR...`);
    const ocrResults: string[] = [];
    const imageDataUrls: string[] = [];

    for (const file of files) {
      const { data: imageData, error: downloadError } = await supabase.storage
        .from('lg')
        .download(`${basePath}/raw/${file.name}`);

      if (downloadError || !imageData) {
        console.error(`Failed to download ${file.name}:`, downloadError);
        continue;
      }

      // Convert to base64 (chunked to avoid stack overflow)
      const arrayBuffer = await imageData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let base64 = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        base64 += String.fromCharCode.apply(null, Array.from(chunk));
      }
      base64 = btoa(base64);
      imageDataUrls.push(`data:image/jpeg;base64,${base64}`);

      // OCR with Google Vision
      if (googleVisionKey) {
        try {
          const ocrText = await performOCR(base64, googleVisionKey);
          if (ocrText) {
            ocrResults.push(`--- Page ${file.name} ---\n${ocrText}`);
          }
        } catch (ocrErr) {
          console.error(`OCR failed for ${file.name}:`, ocrErr);
        }
      }
    }

    const fullOcrText = ocrResults.join('\n\n');
    console.log(`OCR complete. Total characters: ${fullOcrText.length}`);

    // Record OCR completion time
    const ocrCompletedTime = new Date().toISOString();
    await supabase
      .from('lg_patients')
      .update({ ocr_completed_at: ocrCompletedTime })
      .eq('id', patientId);

    // Step 3: Extract patient details from OCR text (NEW!)
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

    // Step 4: Generate AI Summary
    console.log('Generating clinical summary...');
    let summaryJson: any = null;
    
    // Use extracted patient name or placeholder
    const patientName = extractedPatient?.patient_name || patient.patient_name || 'Unknown Patient';
    const nhsNumber = extractedPatient?.nhs_number || patient.nhs_number || 'Unknown';
    const dob = extractedPatient?.date_of_birth || patient.dob || 'Unknown';
    
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
  "medications": [{"drug":"", "dose":"", "status":"current|stopped|unknown"}],
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

    // Step 5: Generate SNOMED codes using VALIDATED database matching
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

Summary JSON:
${JSON.stringify(summaryJson, null, 2)}

OCR Text (search for dates here):
${fullOcrText.substring(0, 12000)}`;

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

    // Step 6: Generate CSV from SNOMED
    const snomedCsv = generateSnomedCsv(snomedJson, patientId, nhsNumber);

    // Step 7: Generate AI page summaries for index
    console.log('Generating AI page summaries for PDF index...');
    const pageSummaries = await generatePageSummaries(fullOcrText, imageDataUrls.length, openaiKey);
    console.log(`Generated ${pageSummaries.length} page summaries`);

    // Step 8: Create simple PDF (base64 images concatenated - POC) with SNOMED summary page
    const pdfStartTime = new Date().toISOString();
    await supabase
      .from('lg_patients')
      .update({ pdf_started_at: pdfStartTime })
      .eq('id', patientId);

    const pdfContent = await createSimplePdf(imageDataUrls, fullOcrText, summaryJson, snomedJson, patientName, nhsNumber, dob, pageSummaries);

    // Step 8: Upload all outputs
    console.log('Uploading outputs...');
    
    const finalPath = `${basePath}/final`;

    // Upload PDF
    const pdfBlob = new Blob([pdfContent], { type: 'application/pdf' });
    await supabase.storage.from('lg').upload(`${finalPath}/lloyd-george.pdf`, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true,
    });

    const pdfCompletedTime = new Date().toISOString();

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

    // Step 9: Update patient record with URLs and timing
    await supabase
      .from('lg_patients')
      .update({
        job_status: 'succeeded',
        processing_completed_at: new Date().toISOString(),
        pdf_url: `lg/${finalPath}/lloyd-george.pdf`,
        summary_json_url: `lg/${finalPath}/summary.json`,
        snomed_json_url: `lg/${finalPath}/snomed.json`,
        snomed_csv_url: `lg/${finalPath}/snomed.csv`,
        pdf_completed_at: pdfCompletedTime,
      })
      .eq('id', patientId);

    await logAudit(supabase, patientId, 'processing_completed', patient.uploader_name, {
      ocr_chars: fullOcrText.length,
      summary_generated: !!summaryJson,
      snomed_extracted: !!snomedJson,
      patient_extracted: !!extractedPatient,
    });

    console.log(`Processing complete for patient ${patientId}`);

    // Step 10: Auto-send email with summary
    console.log('Sending automatic email notification...');
    try {
      // Get user email from profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', patient.user_id)
        .single();

      // Get user email from auth if not in profile
      let userEmail = profile?.email;
      let userName = profile?.full_name || 'User';
      
      if (!userEmail) {
        const { data: { user: authUser } } = await supabase.auth.admin.getUserById(patient.user_id);
        userEmail = authUser?.email;
        if (!userName || userName === 'User') {
          userName = userEmail?.split('@')[0] || 'User';
        }
      }

      if (userEmail) {
        // Build email HTML
        const emailHtml = buildSummaryEmailHtml(
          patientName,
          nhsNumber,
          dob,
          patient.practice_ods,
          patient.images_count || 0,
          summaryJson,
          snomedJson
        );

        // Fetch PDF for attachment
        let pdfBase64: string | null = null;
        const pdfPath = `${basePath}/final/lloyd-george.pdf`;
        try {
          const { data: pdfData } = await supabase.storage
            .from('lg')
            .download(pdfPath);
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

        // Fetch CSV for attachment
        let csvBase64: string | null = null;
        const csvPath = `${basePath}/final/snomed.csv`;
        try {
          const { data: csvData } = await supabase.storage
            .from('lg')
            .download(csvPath);
          if (csvData) {
            const csvText = await csvData.text();
            csvBase64 = btoa(csvText);
            console.log(`CSV attachment ready, size: ${csvBase64.length} chars`);
          }
        } catch (csvErr) {
          console.error('Could not fetch CSV for attachment:', csvErr);
        }

        // Build attachments array
        const attachments: any[] = [];
        if (pdfBase64) {
          attachments.push({
            filename: `LG_${nhsNumber.replace(/\s/g, '')}_${formatDobForFilename(dob)}.pdf`,
            content: pdfBase64,
            type: 'application/pdf',
          });
        }
        if (csvBase64) {
          attachments.push({
            filename: `LG_${nhsNumber.replace(/\s/g, '')}_${formatDobForFilename(dob)}_SNOMED.csv`,
            content: csvBase64,
            type: 'text/csv',
          });
        }

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
          await supabase
            .from('lg_patients')
            .update({ email_error: `Email error: ${emailError.message}` })
            .eq('id', patientId);
        } else {
          // Update email_sent_at
          await supabase
            .from('lg_patients')
            .update({ email_sent_at: new Date().toISOString() })
            .eq('id', patientId);
          
          console.log(`Email sent successfully to ${userEmail}`);
          await logAudit(supabase, patientId, 'email_sent', patient.uploader_name, {
            recipient: userEmail,
            has_pdf_attachment: false,
          });
        }
      } else {
        console.log('No user email found, skipping auto-email');
      }
    } catch (emailErr) {
      console.error('Auto-email error:', emailErr);
      await supabase
        .from('lg_patients')
        .update({ email_error: `Email error: ${emailErr instanceof Error ? emailErr.message : 'Unknown'}` })
        .eq('id', patientId);
    }

    return new Response(
      JSON.stringify({ success: true, patientId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Processing error:', error);
    
    // Try to update patient status to failed
    try {
      const { patientId } = await req.json().catch(() => ({}));
      if (patientId) {
        await supabase
          .from('lg_patients')
          .update({
            job_status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', patientId);
      }
    } catch (updateErr) {
      console.error('Failed to update error status:', updateErr);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function performOCR(base64Image: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: base64Image },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        }],
      }),
    }
  );

  const data = await response.json();
  return data.responses?.[0]?.fullTextAnnotation?.text || '';
}

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

// Parse OCR text into per-page segments
function parseOcrByPage(ocrText: string): Map<number, string> {
  const pageMap = new Map<number, string>();
  if (!ocrText) return pageMap;

  // Split by page markers like "--- Page page_001.jpg ---"
  const pageRegex = /---\s*Page\s+page_(\d+)\.(jpg|jpeg|png)\s*---/gi;
  const parts = ocrText.split(pageRegex);
  
  // Parse alternating: [text before first marker, page num, ext, text, page num, ext, text, ...]
  for (let i = 1; i < parts.length; i += 3) {
    const pageNum = parseInt(parts[i], 10);
    const pageText = parts[i + 2] || '';
    if (pageNum > 0) {
      pageMap.set(pageNum, pageText.trim());
    }
  }
  
  return pageMap;
}

// Generate one-line summaries for each page using OpenAI
async function generatePageSummaries(ocrText: string, pageCount: number, openaiKey: string | undefined): Promise<string[]> {
  const summaries: string[] = [];
  const pageMap = parseOcrByPage(ocrText);
  
  if (!openaiKey || pageMap.size === 0) {
    // Fallback to generic summaries
    for (let i = 0; i < pageCount; i++) {
      summaries.push(`Scanned page ${i + 1} of ${pageCount}`);
    }
    return summaries;
  }

  // Build a prompt with all page texts for batch processing
  const pageTexts: { pageNum: number; text: string }[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const text = pageMap.get(i) || '';
    pageTexts.push({ pageNum: i, text: text.substring(0, 500) }); // Limit text per page
  }

  try {
    const prompt = `You are summarizing pages from a Lloyd George medical record scan. 
For each page below, provide a brief one-line summary (max 60 characters) describing the main content.
If the page appears blank or has minimal text, say "Mostly blank page" or similar.
Focus on clinical relevance: document types (e.g., "GP referral letter", "Blood test results"), dates, or key findings.

${pageTexts.map(p => `PAGE ${p.pageNum}:\n${p.text || '[No text detected]'}`).join('\n\n---\n\n')}

Respond with a JSON array of strings, one summary per page in order. Example:
["Continuation card - immunisation records", "GP referral letter dated 15/03/2020", "Blood test results - FBC normal"]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map((s: any) => String(s || '').substring(0, 60));
      }
    }
  } catch (err) {
    console.error('Failed to generate page summaries:', err);
  }

  // Fallback to generic summaries
  for (let i = 0; i < pageCount; i++) {
    summaries.push(`Scanned page ${i + 1} of ${pageCount}`);
  }
  return summaries;
}

async function createSimplePdf(
  imageDataUrls: string[],
  ocrText: string,
  summaryJson: any,
  snomedJson: any,
  patientName: string,
  nhsNumber: string,
  dob: string,
  pageSummaries: string[] = []
): Promise<Uint8Array> {
  // Create PDF with clinical summary FIRST, then index, then images
  const pdfDoc = await PDFDocument.create();
  
  console.log(`Creating PDF with ${imageDataUrls.length} images`);
  
  // Sanitize text to remove characters not supported by WinAnsi encoding
  const sanitizeForPdf = (text: string): string => {
    return text
      .replace(/═/g, '=')
      .replace(/─/g, '-')
      .replace(/│/g, '|')
      .replace(/┌/g, '+')
      .replace(/┐/g, '+')
      .replace(/└/g, '+')
      .replace(/┘/g, '+')
      .replace(/├/g, '+')
      .replace(/┤/g, '+')
      .replace(/┬/g, '+')
      .replace(/┴/g, '+')
      .replace(/┼/g, '+')
      .replace(/•/g, '-')
      .replace(/–/g, '-')
      .replace(/—/g, '-')
      .replace(/'/g, "'")
      .replace(/'/g, "'")
      .replace(/"/g, '"')
      .replace(/"/g, '"')
      .replace(/…/g, '...')
      .replace(/\*/g, '-')
      .replace(/[^\x00-\x7F]/g, ''); // Remove any other non-ASCII characters
  };
  
  // ===== PAGE 1: CLINICAL SUMMARY (FRONT PAGE) =====
  console.log('Adding clinical summary front page...');
  try {
    let currentPage = pdfDoc.addPage([595, 842]); // A4 size
    let yPosition = 790;
    const leftMargin = 50;
    const lineHeight = 16;
    const pageMarginBottom = 60;
    
    // Helper to check if we need a new page and draw text
    const drawLine = (text: string, size = 10, indent = 0) => {
      const safeText = sanitizeForPdf(text);
      if (yPosition < pageMarginBottom) {
        currentPage = pdfDoc.addPage([595, 842]);
        yPosition = 790;
      }
      currentPage.drawText(safeText, { x: leftMargin + indent, y: yPosition, size });
      yPosition -= lineHeight;
    };
    
    // Add spacing
    const addSpace = (lines = 1) => {
      yPosition -= lineHeight * lines;
      if (yPosition < pageMarginBottom) {
        currentPage = pdfDoc.addPage([595, 842]);
        yPosition = 790;
      }
    };
    
    // Header
    drawLine('LLOYD GEORGE RECORD - CLINICAL SUMMARY', 16);
    addSpace(0.5);
    
    // Patient details box
    drawLine(`Patient: ${patientName}`, 12);
    drawLine(`NHS Number: ${nhsNumber}`, 12);
    drawLine(`Date of Birth: ${dob}`, 12);
    drawLine(`Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, 10);
    drawLine(`Total Scanned Pages: ${imageDataUrls.length}`, 10);
    addSpace(1);
    
    // Clinical Summary
    if (summaryJson?.summary_line) {
      drawLine('CLINICAL SUMMARY', 12);
      addSpace(0.3);
      const summaryWords = summaryJson.summary_line.split(' ');
      let currentLine = '';
      for (const word of summaryWords) {
        if ((currentLine + ' ' + word).length > 75) {
          drawLine(currentLine.trim(), 10, 10);
          currentLine = word;
        } else {
          currentLine += ' ' + word;
        }
      }
      if (currentLine.trim()) drawLine(currentLine.trim(), 10, 10);
      addSpace(1);
    }
    
    // SNOMED Codes sections - Problem codes only
    const snomedSections = [
      { key: 'diagnoses', title: 'DIAGNOSES' },
      { key: 'surgeries', title: 'MAJOR SURGERIES' },
      { key: 'allergies', title: 'ALLERGIES' },
      { key: 'immunisations', title: 'IMMUNISATIONS' },
    ];
    
    for (const section of snomedSections) {
      const items = snomedJson?.[section.key] || [];
      if (items.length > 0) {
        drawLine(section.title, 12);
        addSpace(0.3);
        for (const item of items) {
          const code = item.code || 'UNKNOWN';
          const term = item.term || 'Unknown term';
          const confidence = item.confidence ? `${Math.round(item.confidence * 100)}%` : '';
          drawLine(`${term} [SNOMED: ${code}] ${confidence}`, 10, 15);
          if (item.evidence) {
            const evidenceText = `Evidence: "${item.evidence.substring(0, 60)}${item.evidence.length > 60 ? '...' : ''}"`;
            drawLine(evidenceText, 9, 25);
          }
        }
        addSpace(0.5);
      }
    }
    
    // Additional clinical sections from summary (not SNOMED coded)
    const clinicalSections = [
      { key: 'medications', title: 'MEDICATIONS' },
      { key: 'diagnoses', title: 'DIAGNOSES (DETAILED)' },
    ];
    
    for (const section of clinicalSections) {
      const items = summaryJson?.[section.key] || [];
      if (items.length > 0 && section.key === 'medications') {
        drawLine(section.title, 12);
        addSpace(0.3);
        for (const item of items) {
          let text = '';
          if (section.key === 'medications') {
            text = `${item.drug || ''} ${item.dose || ''} (${item.status || 'unknown'})`;
          } else {
            text = `${item.condition || ''} (${item.date_noted || 'unknown'}) - ${item.status || 'unknown'}`;
          }
          drawLine(text, 10, 15);
        }
        addSpace(0.5);
      }
    }
    
    // Social History
    if (summaryJson?.social_history && (summaryJson.social_history.smoking_status !== 'unknown' || summaryJson.social_history.alcohol !== 'unknown')) {
      drawLine('SOCIAL HISTORY', 12);
      addSpace(0.3);
      if (summaryJson.social_history.smoking_status && summaryJson.social_history.smoking_status !== 'unknown') {
        const smokingText = summaryJson.social_history.smoking_status === 'ex' 
          ? `Ex-smoker${summaryJson.social_history.stopped_year ? ` (stopped ${summaryJson.social_history.stopped_year})` : ''}`
          : summaryJson.social_history.smoking_status;
        drawLine(`Smoking: ${smokingText}`, 10, 15);
      }
      if (summaryJson.social_history.alcohol && summaryJson.social_history.alcohol !== 'unknown') {
        drawLine(`Alcohol: ${summaryJson.social_history.alcohol}`, 10, 15);
      }
      if (summaryJson.social_history.occupation) {
        drawLine(`Occupation: ${summaryJson.social_history.occupation}`, 10, 15);
      }
      addSpace(0.5);
    }
    
    // Footer
    addSpace(1);
    drawLine('This summary was generated by AI from scanned Lloyd George records.', 9);
    drawLine('All clinical information should be verified before use.', 9);
    
  } catch (summaryErr) {
    console.error('Error adding summary page to PDF:', summaryErr);
  }
  
  // ===== PAGE 2: INDEX OF SCANNED PAGES =====
  console.log('Adding page index...');
  try {
    // Calculate where scanned pages will start (after summary pages)
    const summaryPageCount = pdfDoc.getPageCount();
    const scanStartPage = summaryPageCount + 2; // +1 for index page, +1 for 1-based numbering
    
    let indexPage = pdfDoc.addPage([595, 842]);
    let yPos = 790;
    const leftMargin = 50;
    const lineHeight = 18;
    
    const drawIndexLine = (text: string, size = 10) => {
      const safeText = sanitizeForPdf(text);
      if (yPos < 60) {
        indexPage = pdfDoc.addPage([595, 842]);
        yPos = 790;
      }
      indexPage.drawText(safeText, { x: leftMargin, y: yPos, size });
      yPos -= lineHeight;
    };
    
    drawIndexLine('INDEX OF SCANNED PAGES', 16);
    yPos -= 10;
    drawIndexLine(`Patient: ${patientName} | NHS: ${nhsNumber}`, 10);
    yPos -= 20;
    
    drawIndexLine('Page No.    Description', 11);
    drawIndexLine('--------    -----------', 10);
    yPos -= 5;
    
    // List each scanned page with its PDF page number and AI summary
    for (let i = 0; i < imageDataUrls.length; i++) {
      const pdfPageNum = scanStartPage + i;
      const summary = pageSummaries[i] || `Scanned page ${i + 1} of ${imageDataUrls.length}`;
      const truncatedSummary = sanitizeForPdf(summary).substring(0, 55);
      const pageLabel = `Page ${String(pdfPageNum).padStart(3, ' ')}    ${truncatedSummary}`;
      drawIndexLine(pageLabel, 10);
    }
    
    yPos -= 20;
    drawIndexLine('Use PDF viewer bookmarks or page navigation to jump to specific pages.', 9);
    
  } catch (indexErr) {
    console.error('Error adding index page:', indexErr);
  }
  
  // ===== SCANNED IMAGES =====
  console.log('Adding scanned images...');
  for (let i = 0; i < imageDataUrls.length; i++) {
    const dataUrl = imageDataUrls[i];
    try {
      console.log(`Processing image ${i + 1}/${imageDataUrls.length}`);
      
      // Extract base64 data from data URL
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      // Try to embed as JPEG first, then PNG
      let image;
      try {
        image = await pdfDoc.embedJpg(imageBytes);
      } catch {
        try {
          image = await pdfDoc.embedPng(imageBytes);
        } catch (embedErr) {
          console.error(`Failed to embed image ${i + 1}:`, embedErr);
          continue;
        }
      }
      
      // Scale down aggressively to reduce memory usage
      // Cap at max 400px dimension to keep PDF size manageable
      const maxDim = 400;
      let scale = 0.25; // Start at 25%
      
      // If still too large, scale further
      const scaledWidth = image.width * scale;
      const scaledHeight = image.height * scale;
      
      if (scaledWidth > maxDim || scaledHeight > maxDim) {
        const widthRatio = maxDim / image.width;
        const heightRatio = maxDim / image.height;
        scale = Math.min(widthRatio, heightRatio);
      }
      
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);
      
      console.log(`Image ${i + 1}: original ${image.width}x${image.height}, scaled to ${width}x${height}`);
      
      // Create page with scaled image dimensions
      const page = pdfDoc.addPage([width, height]);
      
      // Draw image on page
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: width,
        height: height,
      });
      
      console.log(`Added scanned page ${i + 1} to PDF`);
    } catch (err) {
      console.error(`Error processing image ${i + 1} for PDF:`, err);
    }
  }
  
  console.log(`PDF complete with ${pdfDoc.getPageCount()} pages`);
  
  // If no images were added, ensure we have at least the summary
  if (pdfDoc.getPageCount() === 0) {
    const page = pdfDoc.addPage([595, 842]);
    page.drawText('No images could be embedded in this PDF.', {
      x: 50,
      y: 700,
      size: 14,
    });
    page.drawText(`OCR extracted ${ocrText.length} characters.`, {
      x: 50,
      y: 680,
      size: 12,
    });
  }
  
  return await pdfDoc.save();
}

async function logAudit(
  supabase: any,
  patientId: string,
  event: string,
  actor: string,
  meta: Record<string, any>
) {
  const id = generateULID();
  
  await supabase.from('lg_audit_logs').insert({
    id,
    patient_id: patientId,
    event,
    actor,
    meta: {
      ...meta,
      timestamp: new Date().toISOString(),
    },
  });
}

// Simple ULID generator for Deno
function generateULID(): string {
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const time = Date.now();
  let timeStr = '';
  let t = time;
  
  for (let i = 10; i > 0; i--) {
    timeStr = ENCODING[t % 32] + timeStr;
    t = Math.floor(t / 32);
  }
  
  let randomStr = '';
  for (let i = 0; i < 16; i++) {
    randomStr += ENCODING[Math.floor(Math.random() * 32)];
  }
  
  return timeStr + randomStr;
}

// Format date to UK format DD-MM-YYYY
function formatUKDate(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === 'Unknown') return dateStr || 'Unknown';
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }
  } catch {
    // Return original if parsing fails
  }
  return dateStr;
}

// Format NHS number with spaces (123 456 7890)
function formatNhsNumber(nhs: string | null | undefined): string {
  if (!nhs) return 'Unknown';
  const cleaned = nhs.replace(/\s/g, '');
  if (cleaned.length !== 10) return nhs;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
}

// Format DOB for display (DD-MMM-YYYY)
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

// Format DOB for filename (DD_MMM_YYYY)
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

// Build HTML email for LG summary
function buildSummaryEmailHtml(
  patientName: string,
  nhsNumber: string,
  dob: string,
  practiceOds: string,
  imagesCount: number,
  summaryJson: any,
  snomedJson: any
): string {
  const safeString = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    return String(v);
  };

  const formatListItem = (item: unknown): string => {
    if (typeof item === 'string') return item;
    if (item === null || item === undefined) return '';
    if (typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      if (obj.name) return String(obj.name);
      if (obj.term) return String(obj.term);
      if (obj.description) return String(obj.description);
      const entries = Object.entries(obj).filter(([_, v]) => v != null);
      if (entries.length > 0) return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
    }
    return String(item);
  };

  // Calculate low confidence SNOMED items - problem codes only
  const snomedEntries: any[] = [];
  if (snomedJson) {
    for (const domain of ['diagnoses', 'surgeries', 'allergies', 'immunisations']) {
      const items = snomedJson[domain] || [];
      snomedEntries.push(...items.map((item: any) => ({ ...item, domain })));
    }
  }
  const lowConfidenceCount = snomedEntries.filter(s => typeof s.confidence === 'number' && s.confidence < 0.6).length;

  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #005EB8; border-bottom: 2px solid #005EB8; padding-bottom: 10px;">Lloyd George Record Summary</h1>
      
      <h2 style="color: #333;">Patient Details</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Name</td><td style="padding: 8px; border: 1px solid #ddd;">${patientName}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">NHS Number</td><td style="padding: 8px; border: 1px solid #ddd;">${formatNhsNumber(nhsNumber)}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">DOB</td><td style="padding: 8px; border: 1px solid #ddd;">${formatUKDate(dob)}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Practice ODS</td><td style="padding: 8px; border: 1px solid #ddd;">${practiceOds}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Pages Scanned</td><td style="padding: 8px; border: 1px solid #ddd;">${imagesCount}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Items Requiring Review</td><td style="padding: 8px; border: 1px solid #ddd; ${lowConfidenceCount > 0 ? 'color: #DA291C; font-weight: bold;' : ''}">${lowConfidenceCount}</td></tr>
      </table>
  `;

  if (summaryJson?.summary_line) {
    html += `<h2 style="color: #333;">Clinical Summary</h2><p>${summaryJson.summary_line}</p>`;
  }

  if (summaryJson?.diagnoses?.length) {
    html += `<h3 style="color: #333;">Diagnoses</h3><ul>${summaryJson.diagnoses.map((d: any) => `<li><strong>${d.condition || 'Unknown'}</strong> - ${d.date_noted || 'Unknown'} (${d.status || 'unknown'})</li>`).join('')}</ul>`;
  }

  if (summaryJson?.surgeries?.length) {
    html += `<h3 style="color: #333;">Major Surgeries</h3><ul>${summaryJson.surgeries.map((s: any) => `<li><strong>${s.procedure || 'Unknown'}</strong> - ${s.date || 'Unknown'}${s.notes ? ` (${s.notes})` : ''}</li>`).join('')}</ul>`;
  }

  if (summaryJson?.allergies?.length) {
    html += `<h3 style="color: #DA291C;">⚠️ Allergies</h3><ul>${summaryJson.allergies.map((a: any) => `<li><strong>${a.allergen || 'Unknown'}</strong>: ${a.reaction || 'Unknown'}${a.year ? ` (${a.year})` : ''}</li>`).join('')}</ul>`;
  }

  if (summaryJson?.immunisations?.length) {
    html += `<h3 style="color: #333;">Immunisations</h3><ul>${summaryJson.immunisations.map((i: any) => `<li><strong>${i.vaccine || 'Unknown'}</strong> - ${i.date || 'Unknown'}</li>`).join('')}</ul>`;
  }

  if (summaryJson?.medications?.length) {
    html += `<h3 style="color: #333;">Medications</h3><ul>${summaryJson.medications.map((m: any) => `<li><strong>${m.drug || 'Unknown'}</strong> ${m.dose || ''} (${m.status || 'unknown'})</li>`).join('')}</ul>`;
  }

  if (summaryJson?.family_history?.length) {
    html += `<h3 style="color: #333;">Family History</h3><ul>${summaryJson.family_history.map((f: any) => `<li><strong>${f.relation || 'Unknown'}</strong>: ${f.condition || 'Unknown'}</li>`).join('')}</ul>`;
  }

  // Social History
  if (summaryJson?.social_history && (summaryJson.social_history.smoking_status !== 'unknown' || summaryJson.social_history.alcohol !== 'unknown' || summaryJson.social_history.occupation)) {
    html += `<h3 style="color: #333;">Social History</h3><ul>`;
    if (summaryJson.social_history.smoking_status && summaryJson.social_history.smoking_status !== 'unknown') {
      const smokingText = summaryJson.social_history.smoking_status === 'ex' 
        ? `Ex-smoker${summaryJson.social_history.stopped_year ? ` (stopped ${summaryJson.social_history.stopped_year})` : ''}`
        : summaryJson.social_history.smoking_status;
      html += `<li><strong>Smoking</strong>: ${smokingText}</li>`;
    }
    if (summaryJson.social_history.alcohol && summaryJson.social_history.alcohol !== 'unknown') {
      html += `<li><strong>Alcohol</strong>: ${summaryJson.social_history.alcohol}</li>`;
    }
    if (summaryJson.social_history.occupation) {
      html += `<li><strong>Occupation</strong>: ${summaryJson.social_history.occupation}</li>`;
    }
    html += `</ul>`;
  }

  if (summaryJson?.free_text_findings) {
    html += `<h3 style="color: #333;">Additional Findings</h3><p>${summaryJson.free_text_findings}</p>`;
  }

  // SNOMED summary - problem codes only
  if (snomedEntries.length > 0) {
    html += `<h2 style="color: #333;">SNOMED CT Codes (Problem Codes - ${snomedEntries.length} identified)</h2>`;
    html += `<p style="color: #666; font-size: 11px; margin-bottom: 10px;">Codes suitable for GP system import. Social history, family history, and medications are not SNOMED coded.</p>`;
    
    const domainLabels: Record<string, string> = {
      'diagnoses': 'Diagnoses',
      'surgeries': 'Major Surgeries',
      'allergies': 'Allergies',
      'immunisations': 'Immunisations',
    };
    const domains = ['diagnoses', 'surgeries', 'allergies', 'immunisations'].filter(d => 
      snomedEntries.some(s => s.domain === d)
    );
    for (const domain of domains) {
      const domainEntries = snomedEntries.filter(s => s.domain === domain);
      html += `<h3 style="color: #005EB8;">${domainLabels[domain] || domain}</h3>`;
      html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px;">
        <tr style="background: #005EB8; color: white;">
          <th style="padding: 6px; text-align: left;">Term</th>
          <th style="padding: 6px; text-align: left;">Code</th>
          <th style="padding: 6px; text-align: center;">Date</th>
          <th style="padding: 6px; text-align: center;">Source</th>
          <th style="padding: 6px; text-align: center;">Confidence</th>
        </tr>`;
      
      for (const entry of domainEntries) {
        const confPercent = Math.round((typeof entry.confidence === 'number' ? entry.confidence : 0) * 100);
        const confColor = confPercent >= 60 ? '#007F3B' : '#DA291C';
        const dateDisplay = entry.date || 'NK';
        const dateStyle = dateDisplay === 'NK' ? 'color: #666; font-style: italic;' : '';
        // Source page: add 2 for summary + index pages in PDF
        const sourceDisplay = typeof entry.source_page === 'number' ? `Pg ${entry.source_page + 2}` : '—';
        html += `<tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 6px;">${safeString(entry.term)}</td>
          <td style="padding: 6px; font-family: monospace;">${safeString(entry.code)}</td>
          <td style="padding: 6px; text-align: center; ${dateStyle}">${dateDisplay}</td>
          <td style="padding: 6px; text-align: center; color: #666;">${sourceDisplay}</td>
          <td style="padding: 6px; text-align: center; color: ${confColor}; font-weight: bold;">${confPercent}%</td>
        </tr>`;
      }
      html += `</table>`;
    }
  }

  html += `
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
      <p style="color: #666; font-size: 12px; text-align: center;">
        Full summarising report attached with PDF of scanned files. Due to NHS email size restrictions, if over 100 pages of scans, the PDF is available at <a href="https://gpnotewell.co.uk" style="color: #005EB8;">https://gpnotewell.co.uk</a><br><br>
        Generated by Notewell AI Lloyd George Capture Service<br>
        ${new Date().toLocaleString('en-GB')}
      </p>
    </div>
  `;

  return html;
}
