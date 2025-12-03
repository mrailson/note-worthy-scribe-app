import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

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

    // Update status to processing
    await supabase
      .from('lg_patients')
      .update({ 
        job_status: 'processing',
        processing_started_at: new Date().toISOString(),
      })
      .eq('id', patientId);

    // Log processing started
    await logAudit(supabase, patientId, 'processing_started', patient.uploader_name, {
      images_count: patient.images_count,
    });

    const basePath = `${patient.practice_ods}/${patientId}`;

    // Step 1: List and download raw images
    console.log('Fetching raw images...');
    const { data: files, error: listError } = await supabase.storage
      .from('lg')
      .list(`${basePath}/raw`, { sortBy: { column: 'name', order: 'asc' } });

    if (listError || !files || files.length === 0) {
      throw new Error(`No images found: ${listError?.message}`);
    }

    // Step 2: OCR each image and collect text
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

    // Step 3: Extract patient details from OCR text (NEW!)
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

    // Step 5: Generate SNOMED codes
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

    // Step 6: Generate CSV from SNOMED
    const snomedCsv = generateSnomedCsv(snomedJson, patientId, nhsNumber);

    // Step 7: Create simple PDF (base64 images concatenated - POC) with SNOMED summary page
    const pdfContent = await createSimplePdf(imageDataUrls, fullOcrText, summaryJson, snomedJson, patientName, nhsNumber, dob);

    // Step 8: Upload all outputs
    console.log('Uploading outputs...');
    
    const finalPath = `${basePath}/final`;

    // Upload PDF
    const pdfBlob = new Blob([pdfContent], { type: 'application/pdf' });
    await supabase.storage.from('lg').upload(`${finalPath}/lloyd-george.pdf`, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true,
    });

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

    // Step 9: Update patient record with URLs
    await supabase
      .from('lg_patients')
      .update({
        job_status: 'succeeded',
        processing_completed_at: new Date().toISOString(),
        pdf_url: `lg/${finalPath}/lloyd-george.pdf`,
        summary_json_url: `lg/${finalPath}/summary.json`,
        snomed_json_url: `lg/${finalPath}/snomed.json`,
        snomed_csv_url: `lg/${finalPath}/snomed.csv`,
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

        // Send via EmailJS edge function
        const emailResponse = await fetch(
          `${supabaseUrl}/functions/v1/send-email-via-emailjs`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              to_email: userEmail,
              to_name: userName,
              subject: `Lloyd George Record Summary - ${patientName} (NHS: ${nhsNumber})`,
              message: emailHtml,
              template_type: 'ai_generated_content',
            }),
          }
        );

        if (emailResponse.ok) {
          // Update email_sent_at
          await supabase
            .from('lg_patients')
            .update({ email_sent_at: new Date().toISOString() })
            .eq('id', patientId);
          
          console.log(`Email sent successfully to ${userEmail}`);
          await logAudit(supabase, patientId, 'email_sent', patient.uploader_name, {
            recipient: userEmail,
          });
        } else {
          const errorText = await emailResponse.text();
          console.error('Email sending failed:', errorText);
          await supabase
            .from('lg_patients')
            .update({ email_error: `Failed to send: ${errorText.substring(0, 200)}` })
            .eq('id', patientId);
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

async function createSimplePdf(
  imageDataUrls: string[], 
  ocrText: string,
  summaryJson: any,
  snomedJson: any,
  patientName: string,
  nhsNumber: string,
  dob: string
): Promise<Uint8Array> {
  // Create PDF with embedded images using pdf-lib
  const pdfDoc = await PDFDocument.create();
  
  console.log(`Creating PDF with ${imageDataUrls.length} images`);
  
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
      
      // Scale to 50% of original size
      const scale = 0.5;
      const width = image.width * scale;
      const height = image.height * scale;
      
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
      
      console.log(`Added page ${i + 1} to PDF`);
    } catch (err) {
      console.error(`Error processing image ${i + 1} for PDF:`, err);
    }
  }
  
  console.log(`PDF complete with ${pdfDoc.getPageCount()} pages`);
  
  // If no images were added, create a placeholder page
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
  
  // Add SNOMED Summary page at the end (searchable text)
  console.log('Adding SNOMED summary page...');
  
  try {
    let currentPage = pdfDoc.addPage([595, 842]); // A4 size
    let yPosition = 790;
    const leftMargin = 50;
    const lineHeight = 16;
    const pageMarginBottom = 60;
    
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
    
    // Helper to check if we need a new page and draw text
    const drawLine = (text: string, size = 10, indent = 0) => {
      const safeText = sanitizeForPdf(text);
      if (yPosition < pageMarginBottom) {
        // Add new page
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
    drawLine('LLOYD GEORGE RECORD - CLINICAL SUMMARY & SNOMED CODES', 14);
    addSpace(0.5);
    
    // Patient details box
    drawLine(`Patient: ${patientName}`, 11);
    drawLine(`NHS Number: ${nhsNumber}`, 11);
    drawLine(`Date of Birth: ${dob}`, 11);
    drawLine(`Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, 10);
    addSpace(1);
    
    // Clinical Summary
    if (summaryJson?.summary_line) {
      drawLine('CLINICAL SUMMARY', 12);
      addSpace(0.3);
      // Wrap long text
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
    
    // SNOMED Codes sections
    const snomedSections = [
      { key: 'problems', title: 'PROBLEMS / CONDITIONS' },
      { key: 'allergies', title: 'ALLERGIES' },
      { key: 'procedures', title: 'PROCEDURES' },
      { key: 'immunisations', title: 'IMMUNISATIONS' },
      { key: 'risk_factors', title: 'RISK FACTORS' },
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
    
    // Additional clinical sections from summary
    const clinicalSections = [
      { key: 'medications', title: 'MEDICATIONS' },
      { key: 'significant_past_history', title: 'SIGNIFICANT PAST HISTORY' },
    ];
    
    for (const section of clinicalSections) {
      const items = summaryJson?.[section.key] || [];
      if (items.length > 0) {
        drawLine(section.title, 12);
        addSpace(0.3);
        for (const item of items) {
          let text = '';
          if (section.key === 'medications') {
            text = `${item.name || ''} ${item.dose || ''} ${item.frequency || ''} (${item.status || 'unknown'})`;
          } else if (section.key === 'significant_past_history') {
            text = `${item.condition || ''} (${item.first_noted || 'unknown'}) - ${item.status || 'unknown'}`;
          } else {
            text = JSON.stringify(item);
          }
          drawLine(text, 10, 15);
        }
        addSpace(0.5);
      }
    }
    
    // Footer
    addSpace(1);
    drawLine('This summary was generated by AI from scanned Lloyd George records.', 9);
    drawLine('All clinical information should be verified before use.', 9);
  } catch (summaryErr) {
    console.error('Error adding summary page to PDF, skipping:', summaryErr);
    // PDF will still be valid without the summary page
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

  // Calculate low confidence SNOMED items
  const snomedEntries: any[] = [];
  if (snomedJson) {
    for (const domain of ['problems', 'allergies', 'procedures', 'immunisations', 'risk_factors']) {
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

  if (summaryJson?.allergies?.length) {
    html += `<h3 style="color: #DA291C;">⚠️ Allergies</h3><ul>${summaryJson.allergies.map((a: any) => `<li>${formatListItem(a)}</li>`).join('')}</ul>`;
  }

  if (summaryJson?.medications?.length) {
    html += `<h3 style="color: #333;">Medications</h3><ul>${summaryJson.medications.map((m: any) => `<li>${formatListItem(m)}</li>`).join('')}</ul>`;
  }

  if (summaryJson?.significant_past_history?.length) {
    html += `<h3 style="color: #333;">Significant Past History</h3><ul>${summaryJson.significant_past_history.map((h: any) => `<li>${formatListItem(h)}</li>`).join('')}</ul>`;
  }

  if (summaryJson?.procedures?.length) {
    html += `<h3 style="color: #333;">Procedures</h3><ul>${summaryJson.procedures.map((p: any) => `<li>${formatListItem(p)}</li>`).join('')}</ul>`;
  }

  if (summaryJson?.immunisations?.length) {
    html += `<h3 style="color: #333;">Immunisations</h3><ul>${summaryJson.immunisations.map((i: any) => `<li>${formatListItem(i)}</li>`).join('')}</ul>`;
  }

  if (summaryJson?.free_text_findings) {
    html += `<h3 style="color: #333;">Additional Findings</h3><p>${summaryJson.free_text_findings}</p>`;
  }

  // SNOMED summary
  if (snomedEntries.length > 0) {
    html += `<h2 style="color: #333;">SNOMED CT Codes (${snomedEntries.length} identified)</h2>`;
    
    const domains = [...new Set(snomedEntries.map(s => s.domain))];
    for (const domain of domains) {
      const domainEntries = snomedEntries.filter(s => s.domain === domain);
      html += `<h3 style="color: #005EB8;">${domain.charAt(0).toUpperCase() + domain.slice(1)}</h3>`;
      html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px;">
        <tr style="background: #005EB8; color: white;">
          <th style="padding: 6px; text-align: left;">Term</th>
          <th style="padding: 6px; text-align: left;">Code</th>
          <th style="padding: 6px; text-align: center;">Confidence</th>
        </tr>`;
      
      for (const entry of domainEntries) {
        const confPercent = Math.round((typeof entry.confidence === 'number' ? entry.confidence : 0) * 100);
        const confColor = confPercent >= 60 ? '#007F3B' : '#DA291C';
        html += `<tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 6px;">${safeString(entry.term)}</td>
          <td style="padding: 6px; font-family: monospace;">${safeString(entry.code)}</td>
          <td style="padding: 6px; text-align: center; color: ${confColor}; font-weight: bold;">${confPercent}%</td>
        </tr>`;
      }
      html += `</table>`;
    }
  }

  html += `
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
      <p style="color: #666; font-size: 12px; text-align: center;">
        Generated by Notewell AI Lloyd George Capture Service<br>
        ${new Date().toLocaleString('en-GB')}
      </p>
    </div>
  `;

  return html;
}
