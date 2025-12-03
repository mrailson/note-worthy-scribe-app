import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lloyd George Summariser system prompt
const SUMMARISER_SYSTEM_PROMPT = `You are a UK GP records summariser working to NHS standards. Read a digitised Lloyd George record and produce a concise, structured summary suitable for import into EMIS or SystmOne. Prioritise clarity, chronology, and safety. Use UK spellings and NHS conventions. Do not invent facts. If uncertain, say "unknown".

Developer guardrails:
- No patient advice. No diagnosis creation. Summarise only what's present.
- Keep personal third-party identifiers out of the summary (note "3rd-party info redaction required" if present).`;

// SNOMED Extractor system prompt  
const SNOMED_SYSTEM_PROMPT = `You are a clinical coder for UK primary care. Map the summary JSON and source OCR to SNOMED CT codes suitable for GP systems. Prefer high-level, safe, unambiguous concepts. If you cannot confidently code, output code: "UNKNOWN" and term: "Unknown concept".

Constraints:
- Use UK SNOMED CT where possible; return preferred terms.
- No medication product coding in this POC (skip or mark UNKNOWN).
- Confidence 0–1.0. Provide a short evidence snippet.`;

// Patient details extraction prompt
const PATIENT_EXTRACTION_PROMPT = `You are extracting patient demographic details from scanned Lloyd George medical records. Extract ONLY what you can clearly see in the OCR text. Do not guess or invent information.

Return valid JSON with this exact structure:
{
  "patient_name": "Full name as written on the records (or null if not found)",
  "nhs_number": "10-digit NHS number, may have spaces (or null if not found)",
  "date_of_birth": "YYYY-MM-DD format (or null if not found)",
  "sex": "male" | "female" | "unknown",
  "confidence": 0.0 to 1.0 (how confident you are in the extracted data)
}

Rules:
- patient_name: Look for name fields, headers with patient name, or repeated mentions of a name
- nhs_number: Look for a 10-digit number often labelled NHS No, NHS Number, etc. May have spaces like "123 456 7890"
- date_of_birth: Look for DOB, Date of Birth, D.O.B., or birth date fields
- sex: Look for M/F, Male/Female, Sex fields. Default to "unknown" if not clear
- confidence: Set based on how clearly the information was visible (0.9+ if very clear, 0.5-0.8 if partially visible, below 0.5 if uncertain)

Only extract what is clearly visible. Return null for any field you cannot confidently identify.`;

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

    // Download merged OCR text with retry (storage propagation can take a moment)
    console.log('Downloading merged OCR text...');
    const ocrPath = `${basePath}/work/ocr_merged.txt`;
    let ocrData: Blob | null = null;
    let ocrError: any = null;
    
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = await supabase.storage
        .from('lg')
        .download(ocrPath);
      
      ocrData = result.data;
      ocrError = result.error;
      
      if (ocrData) {
        console.log(`OCR file downloaded on attempt ${attempt + 1}`);
        break;
      }
      
      console.log(`OCR file not found, retrying in 2s (attempt ${attempt + 1}/5)...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (ocrError || !ocrData) {
      throw new Error(`Failed to download OCR text after 5 attempts: ${JSON.stringify(ocrError)}`);
    }

    const fullOcrText = await ocrData.text();
    console.log(`OCR text loaded. Length: ${fullOcrText.length} characters`);

    // Extract patient details
    console.log('Extracting patient details from OCR...');
    let extractedPatient: any = null;
    
    if (openaiKey && fullOcrText.length > 50) {
      try {
        extractedPatient = await callOpenAI(openaiKey, PATIENT_EXTRACTION_PROMPT, 
          `Extract patient details from this OCR text of Lloyd George records:\n\n${fullOcrText.substring(0, 30000)}`);
        console.log('Patient details extracted:', extractedPatient);
        
        // Update patient record with extracted details
        const updateData: any = {
          ai_extracted_name: extractedPatient.patient_name || null,
          ai_extracted_nhs: extractedPatient.nhs_number?.replace(/\s/g, '') || null,
          ai_extracted_dob: extractedPatient.date_of_birth || null,
          ai_extracted_sex: extractedPatient.sex || 'unknown',
          ai_extraction_confidence: extractedPatient.confidence || 0,
          requires_verification: (extractedPatient.confidence || 0) < 0.8,
        };
        
        // Also populate the main fields if they're null
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
  "summary_line": "e.g., PMH: T2DM dx ~2009, HTN 2012; NKDA; past cholecystectomy 2018; smoker ex 2015.",
  "allergies": [{"substance":"", "reaction":"", "certainty":"confirmed|suspected", "source":"LG"}],
  "significant_past_history": [{"condition":"", "first_noted":"YYYY or YYYY-MM", "status":"active|resolved|unknown"}],
  "medications": [{"name":"", "dose":"", "route":"", "frequency":"", "start_date":"YYYY-MM or unknown", "status":"current|stopped|unknown"}],
  "immunisations": [{"vaccine":"", "date":"YYYY-MM-DD or unknown"}],
  "procedures": [{"name":"", "date":"YYYY or unknown"}],
  "family_history": [{"relation":"", "condition":"", "notes":""}],
  "risk_factors": [{"type":"smoking|alcohol|bmi|blood_pressure|other", "value":"", "date":"YYYY-MM or unknown"}],
  "alerts": [{"type":"safeguarding|high_risk_meds|third_party_info|other", "note":""}],
  "free_text_findings": "Short narrative (≤150 words) capturing anything important not mapped above."
}

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

    // Generate SNOMED codes
    console.log('Extracting SNOMED codes...');
    let snomedJson: any = null;

    if (openaiKey && summaryJson) {
      const snomedPrompt = `Using the summary.json and the source OCR, return JSON with:

{
  "problems": [{"term":"","code":"","from":"summary|ocr","confidence":0.0,"evidence":"text snippet"}],
  "allergies": [{"term":"","code":"","from":"","confidence":0.0,"evidence":""}],
  "procedures": [{"term":"","code":"","from":"","confidence":0.0,"evidence":""}],
  "immunisations": [{"term":"","code":"","from":"","confidence":0.0,"evidence":""}],
  "risk_factors": [{"term":"","code":"","from":"","confidence":0.0,"evidence":""}]
}

Summary JSON:
${JSON.stringify(summaryJson, null, 2)}

OCR Text (first 10000 chars):
${fullOcrText.substring(0, 10000)}`;

      try {
        snomedJson = await callOpenAI(openaiKey, SNOMED_SYSTEM_PROMPT, snomedPrompt);
        console.log('SNOMED codes extracted');
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

    // Send email immediately (don't wait for PDF for large records)
    console.log('Sending email notification...');
    await sendSummaryEmail(supabase, patient, patientName, nhsNumber, dob, summaryJson, snomedJson, needsBackgroundPdf);

    if (needsBackgroundPdf) {
      // Queue background PDF generation
      console.log('Queuing background PDF generation for large record...');
      // The cron job or manual trigger will pick this up
    } else {
      // Trigger immediate PDF generation for small records
      console.log('Triggering immediate PDF generation...');
      await supabase.functions.invoke('lg-generate-pdf', {
        body: { patientId },
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
    allergies: [],
    significant_past_history: [],
    medications: [],
    immunisations: [],
    procedures: [],
    family_history: [],
    risk_factors: [],
    alerts: [],
    free_text_findings: 'OCR text was insufficient for clinical summary generation.',
  };
}

function createEmptySnomed() {
  return {
    problems: [],
    allergies: [],
    procedures: [],
    immunisations: [],
    risk_factors: [],
  };
}

function generateSnomedCsv(snomed: any, patientId: string, nhsNumber: string): string {
  const rows: string[] = ['domain,term,code,confidence,evidence,source,patient_ulid,nhs_number'];
  
  const domains = ['problems', 'allergies', 'procedures', 'immunisations', 'risk_factors'];
  
  for (const domain of domains) {
    const items = snomed[domain] || [];
    for (const item of items) {
      const row = [
        domain,
        `"${(item.term || '').replace(/"/g, '""')}"`,
        item.code || 'UNKNOWN',
        item.confidence || 0,
        `"${(item.evidence || '').replace(/"/g, '""')}"`,
        item.from || 'ocr',
        patientId,
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

    // Send via send-email-via-emailjs edge function (handles private key properly)
    const { error: emailError } = await supabase.functions.invoke('send-email-via-emailjs', {
      body: {
        to_email: userEmail,
        subject: `Lloyd George Record Summary - ${patientName} (NHS: ${formatNhsNumber(nhsNumber)})`,
        message: emailHtml,
        template_type: 'ai_generated_content',
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
