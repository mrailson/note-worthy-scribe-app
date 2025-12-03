import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process images in small batches to avoid memory issues
const IMAGE_BATCH_SIZE = 5;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { patientId, isBackground = false } = await req.json();
    
    if (!patientId) {
      throw new Error('Missing patientId');
    }

    console.log(`PDF generation for patient: ${patientId} (background: ${isBackground})`);

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

    // Update status with PDF start time
    const pdfStartTime = new Date().toISOString();
    await supabase
      .from('lg_patients')
      .update({ 
        pdf_generation_status: 'generating',
        pdf_started_at: pdfStartTime,
      })
      .eq('id', patientId);

    // Load summary and SNOMED data
    let summaryJson: any = {};
    let snomedJson: any = {};

    try {
      const { data: summaryData } = await supabase.storage
        .from('lg')
        .download(`${basePath}/final/summary.json`);
      if (summaryData) {
        summaryJson = JSON.parse(await summaryData.text());
      }
    } catch {}

    try {
      const { data: snomedData } = await supabase.storage
        .from('lg')
        .download(`${basePath}/final/snomed.json`);
      if (snomedData) {
        snomedJson = JSON.parse(await snomedData.text());
      }
    } catch {}

    // List raw images
    const { data: files, error: listError } = await supabase.storage
      .from('lg')
      .list(`${basePath}/raw`, { sortBy: { column: 'name', order: 'asc' } });

    if (listError || !files || files.length === 0) {
      throw new Error(`No images found: ${listError?.message}`);
    }

    console.log(`Creating PDF with ${files.length} images in batches of ${IMAGE_BATCH_SIZE}`);

    // Create PDF document
    const pdfDoc = await PDFDocument.create();

    // Patient details
    const patientName = patient.ai_extracted_name || patient.patient_name || 'Unknown Patient';
    const nhsNumber = patient.ai_extracted_nhs || patient.nhs_number || 'Unknown';
    const dob = patient.ai_extracted_dob || patient.dob || 'Unknown';

    // Add clinical summary front page
    console.log('Adding clinical summary page...');
    addClinicalSummaryPage(pdfDoc, patientName, nhsNumber, dob, files.length, summaryJson, snomedJson);

    // Add index page
    console.log('Adding index page...');
    addIndexPage(pdfDoc, files);

    // Process images in batches
    for (let batchStart = 0; batchStart < files.length; batchStart += IMAGE_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + IMAGE_BATCH_SIZE, files.length);
      console.log(`Processing image batch ${batchStart + 1}-${batchEnd} of ${files.length}`);

      for (let i = batchStart; i < batchEnd; i++) {
        const file = files[i];
        
        try {
          const { data: imageData, error: downloadError } = await supabase.storage
            .from('lg')
            .download(`${basePath}/raw/${file.name}`);

          if (downloadError || !imageData) {
            console.error(`Failed to download ${file.name}:`, downloadError);
            // Add placeholder page
            const page = pdfDoc.addPage([595, 842]);
            page.drawText(`Page ${i + 1} - Image unavailable`, { x: 200, y: 400, size: 14 });
            continue;
          }

          const arrayBuffer = await imageData.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Determine image type and embed
          let image;
          const fileName = file.name.toLowerCase();
          
          if (fileName.endsWith('.png')) {
            image = await pdfDoc.embedPng(uint8Array);
          } else {
            // Default to JPEG
            try {
              image = await pdfDoc.embedJpg(uint8Array);
            } catch {
              // Try PNG if JPEG fails
              try {
                image = await pdfDoc.embedPng(uint8Array);
              } catch (embedErr) {
                console.error(`Failed to embed image ${file.name}:`, embedErr);
                const page = pdfDoc.addPage([595, 842]);
                page.drawText(`Page ${i + 1} - Image format error`, { x: 200, y: 400, size: 14 });
                continue;
              }
            }
          }

          // Scale down aggressively to reduce memory
          const maxDim = 400;
          let scale = 0.25;
          
          const scaledWidth = image.width * scale;
          const scaledHeight = image.height * scale;
          
          if (scaledWidth > maxDim || scaledHeight > maxDim) {
            const widthRatio = maxDim / image.width;
            const heightRatio = maxDim / image.height;
            scale = Math.min(widthRatio, heightRatio);
          }
          
          const width = Math.round(image.width * scale);
          const height = Math.round(image.height * scale);

          // Add page with image
          const page = pdfDoc.addPage([595, 842]);
          
          // Center the image
          const x = (595 - width) / 2;
          const y = (842 - height) / 2;
          
          page.drawImage(image, { x, y, width, height });
          
          // Add page number
          page.drawText(`Page ${i + 1} of ${files.length}`, { x: 50, y: 20, size: 10 });

        } catch (err) {
          console.error(`Error processing image ${file.name}:`, err);
          const page = pdfDoc.addPage([595, 842]);
          page.drawText(`Page ${i + 1} - Processing error`, { x: 200, y: 400, size: 14 });
        }
      }

      // Small delay between batches to allow GC
      if (batchEnd < files.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Save PDF
    console.log('Saving PDF...');
    const pdfBytes = await pdfDoc.save();

    // Upload PDF
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    await supabase.storage.from('lg').upload(`${basePath}/final/lloyd-george.pdf`, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true,
    });

    // Update patient record with PDF completion time
    const pdfCompletedTime = new Date().toISOString();
    await supabase
      .from('lg_patients')
      .update({
        job_status: 'succeeded',
        processing_phase: 'complete',
        processing_completed_at: pdfCompletedTime,
        pdf_url: `lg/${basePath}/final/lloyd-george.pdf`,
        pdf_generation_status: 'complete',
        pdf_completed_at: pdfCompletedTime,
      })
      .eq('id', patientId);

    console.log(`PDF generation complete for patient ${patientId}`);

    return new Response(
      JSON.stringify({ success: true, patientId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('PDF generation error:', error);
    
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.patientId) {
        await supabase
          .from('lg_patients')
          .update({
            pdf_generation_status: 'failed',
            error_message: `PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          })
          .eq('id', body.patientId);
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'PDF generation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function sanitizeForPdf(text: string): string {
  return text
    .replace(/═/g, '=')
    .replace(/─/g, '-')
    .replace(/│/g, '|')
    .replace(/[┌┐└┘├┤┬┴┼]/g, '+')
    .replace(/•/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/…/g, '...')
    .replace(/\*/g, '-')
    .replace(/[^\x00-\x7F]/g, '');
}

function addClinicalSummaryPage(
  pdfDoc: any,
  patientName: string,
  nhsNumber: string,
  dob: string,
  pageCount: number,
  summaryJson: any,
  snomedJson: any
) {
  let currentPage = pdfDoc.addPage([595, 842]);
  let yPosition = 790;
  const leftMargin = 50;
  const lineHeight = 14;
  const pageMarginBottom = 60;

  const drawLine = (text: string, size = 10, indent = 0) => {
    const safeText = sanitizeForPdf(text).substring(0, 80);
    if (yPosition < pageMarginBottom) {
      currentPage = pdfDoc.addPage([595, 842]);
      yPosition = 790;
    }
    currentPage.drawText(safeText, { x: leftMargin + indent, y: yPosition, size });
    yPosition -= lineHeight;
  };

  const addSpace = (lines = 1) => {
    yPosition -= lineHeight * lines;
    if (yPosition < pageMarginBottom) {
      currentPage = pdfDoc.addPage([595, 842]);
      yPosition = 790;
    }
  };

  drawLine('LLOYD GEORGE RECORD - CLINICAL SUMMARY', 14);
  addSpace(0.5);

  drawLine(`Patient: ${patientName}`, 11);
  drawLine(`NHS Number: ${nhsNumber}`, 11);
  drawLine(`Date of Birth: ${dob}`, 11);
  drawLine(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 10);
  drawLine(`Total Pages: ${pageCount}`, 10);
  addSpace(1);

  if (summaryJson?.summary_line) {
    drawLine('CLINICAL SUMMARY', 11);
    addSpace(0.3);
    const words = summaryJson.summary_line.split(' ');
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).length > 70) {
        drawLine(line.trim(), 9, 10);
        line = word;
      } else {
        line += ' ' + word;
      }
    }
    if (line.trim()) drawLine(line.trim(), 9, 10);
    addSpace(0.5);
  }

  // SNOMED sections (condensed for front page)
  const sections = ['problems', 'allergies', 'procedures', 'immunisations', 'risk_factors'];
  for (const key of sections) {
    const items = snomedJson?.[key] || [];
    if (items.length > 0) {
      drawLine(key.toUpperCase().replace('_', ' '), 11);
      for (const item of items.slice(0, 5)) { // Limit to 5 items per section
        drawLine(`- ${item.term || 'Unknown'} [${item.code || 'UNKNOWN'}]`, 9, 10);
      }
      if (items.length > 5) {
        drawLine(`... and ${items.length - 5} more`, 8, 10);
      }
      addSpace(0.3);
    }
  }
}

function addIndexPage(pdfDoc: any, files: any[]) {
  let currentPage = pdfDoc.addPage([595, 842]);
  let yPosition = 790;
  const leftMargin = 50;
  const lineHeight = 14;
  const pageMarginBottom = 60;

  currentPage.drawText('PAGE INDEX', { x: leftMargin, y: yPosition, size: 14 });
  yPosition -= lineHeight * 2;

  for (let i = 0; i < files.length; i++) {
    if (yPosition < pageMarginBottom) {
      currentPage = pdfDoc.addPage([595, 842]);
      yPosition = 790;
    }
    const pageNum = i + 3; // Account for summary + index pages
    currentPage.drawText(`Page ${i + 1}: ${files[i].name} (PDF page ${pageNum})`, {
      x: leftMargin,
      y: yPosition,
      size: 9,
    });
    yPosition -= lineHeight;
  }
}
