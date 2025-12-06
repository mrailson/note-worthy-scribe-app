/**
 * LG-GENERATE-PDF - Full Version with Front Matter
 * 
 * This edge function generates complete Lloyd George PDFs with:
 * 1. Clinical Summary front page
 * 2. Medications & Additional Info page
 * 3. Index of Scanned Pages
 * 4. Scanned images with patient header bands
 * 
 * Images are pre-compressed client-side before upload.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const MAX_PDF_SIZE_MB = 4.8;
const PAGES_PER_PART = 50;

interface PatientHeader {
  name: string;
  nhsNumber?: string;
  dob?: string;
}

interface GeneratePdfRequest {
  patientId: string;
  imagePaths?: string[];
  outputPath?: string;
  patientHeader?: PatientHeader;
  sendEmail?: boolean;
  isBackground?: boolean;
}

// Sanitize text to remove characters not supported by WinAnsi encoding
function sanitizeForPdf(text: string): string {
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
    .replace(/[^\x00-\x7F]/g, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('=== LG-GENERATE-PDF (Full Version) ===');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json() as GeneratePdfRequest;
    const { patientId, imagePaths: directImagePaths, sendEmail = false } = body;

    console.log('Patient ID:', patientId);

    // Fetch patient record
    const { data: patient, error: patientError } = await supabase
      .from('lg_patients')
      .select('*')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      throw new Error(`Patient not found: ${patientError?.message || 'Unknown'}`);
    }

    const practiceOds = patient.practice_ods;
    const patientName = patient.ai_extracted_name || patient.patient_name || 'Unknown Patient';
    const nhsNumber = patient.ai_extracted_nhs || patient.nhs_number || '';
    const dob = patient.ai_extracted_dob || patient.dob || '';
    const basePath = `${practiceOds}/${patientId}`;

    // Update status
    await supabase
      .from('lg_patients')
      .update({
        pdf_generation_status: 'generating',
        pdf_started_at: new Date().toISOString(),
      })
      .eq('id', patientId);

    // Fetch summary and SNOMED JSON from storage
    let summaryJson: any = null;
    let snomedJson: any = null;

    try {
      const { data: summaryData } = await supabase.storage
        .from('lg')
        .download(`${basePath}/final/summary.json`);
      if (summaryData) {
        summaryJson = JSON.parse(await summaryData.text());
        console.log('Loaded summary JSON');
      }
    } catch (e) {
      console.log('No summary JSON found');
    }

    try {
      const { data: snomedData } = await supabase.storage
        .from('lg')
        .download(`${basePath}/final/snomed.json`);
      if (snomedData) {
        snomedJson = JSON.parse(await snomedData.text());
        console.log('Loaded SNOMED JSON');
      }
    } catch (e) {
      console.log('No SNOMED JSON found');
    }

    // Load OCR text for page summaries
    let ocrText = '';
    try {
      const { data: ocrData } = await supabase.storage
        .from('lg')
        .download(`${basePath}/work/ocr_merged.json`);
      if (ocrData) {
        const ocrJson = JSON.parse(await ocrData.text());
        ocrText = ocrJson.ocr_text || '';
        console.log(`Loaded OCR text: ${ocrText.length} chars`);
      }
    } catch (e) {
      // Try final location
      try {
        const { data: ocrData } = await supabase.storage
          .from('lg')
          .download(`${basePath}/final/ocr_merged.json`);
        if (ocrData) {
          const ocrJson = JSON.parse(await ocrData.text());
          ocrText = ocrJson.ocr_text || '';
        }
      } catch (e2) {
        console.log('No OCR text found');
      }
    }

    // List raw images from storage
    let imagePaths: string[] = directImagePaths || [];
    if (imagePaths.length === 0) {
      const rawPath = `${basePath}/raw`;
      const { data: files, error: listError } = await supabase.storage
        .from('lg')
        .list(rawPath, { limit: 200, sortBy: { column: 'name', order: 'asc' } });

      if (listError) {
        throw new Error(`Failed to list images: ${listError.message}`);
      }

      imagePaths = (files || [])
        .filter(f => f.name.endsWith('.jpg') || f.name.endsWith('.jpeg') || f.name.endsWith('.png'))
        .map(f => `${rawPath}/${f.name}`);
    }

    console.log(`Processing ${imagePaths.length} images`);

    if (imagePaths.length === 0) {
      throw new Error('No images found to process');
    }

    // Generate page summaries from OCR
    const pageSummaries = generatePageSummaries(ocrText, imagePaths.length);

    // Create the PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // ===== PAGE 1: CLINICAL SUMMARY =====
    console.log('Adding clinical summary front page...');
    addClinicalSummaryPage(pdfDoc, font, boldFont, {
      patientName,
      nhsNumber,
      dob,
      totalPages: imagePaths.length,
      summaryJson,
      snomedJson,
    });

    // ===== PAGE 2: MEDICATIONS & ADDITIONAL INFO =====
    console.log('Adding medications page...');
    addMedicationsPage(pdfDoc, font, boldFont, {
      patientName,
      nhsNumber,
      dob,
      summaryJson,
    });

    // ===== PAGE 3: INDEX OF SCANNED PAGES =====
    console.log('Adding index page...');
    const frontMatterPages = pdfDoc.getPageCount();
    addIndexPage(pdfDoc, font, boldFont, {
      patientName,
      nhsNumber,
      pageSummaries,
      scanStartPage: frontMatterPages + 1,
    });

    // ===== SCANNED IMAGES =====
    console.log('Adding scanned images...');
    const headerText = `Patient: ${patientName} | NHS: ${nhsNumber} | DOB: ${dob}`;
    
    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      
      try {
        const { data: imageData, error: downloadError } = await supabase.storage
          .from('lg')
          .download(imagePath);

        if (downloadError || !imageData) {
          console.error(`Failed to download ${imagePath}:`, downloadError?.message);
          continue;
        }

        const imageBytes = new Uint8Array(await imageData.arrayBuffer());
        console.log(`Downloaded page ${i + 1}: ${(imageBytes.length / 1024).toFixed(1)} KB`);

        // Embed the JPEG
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

        const { width, height } = image;
        
        // Add header band height
        const headerHeight = 30;
        const page = pdfDoc.addPage([width, height + headerHeight]);

        // Draw white header band at top
        page.drawRectangle({
          x: 0,
          y: height,
          width: width,
          height: headerHeight,
          color: rgb(1, 1, 1),
        });

        // Draw header text
        const fontSize = 10;
        page.drawText(sanitizeForPdf(headerText), {
          x: 10,
          y: height + 10,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });

        // Draw page number on right
        const pageNumText = `Page ${frontMatterPages + i + 1}`;
        const pageNumWidth = font.widthOfTextAtSize(pageNumText, fontSize);
        page.drawText(pageNumText, {
          x: width - pageNumWidth - 10,
          y: height + 10,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });

        // Draw the image below header
        page.drawImage(image, {
          x: 0,
          y: 0,
          width,
          height,
        });

      } catch (pageErr) {
        console.error(`Error processing page ${i + 1}:`, pageErr);
      }
    }

    console.log(`PDF complete with ${pdfDoc.getPageCount()} pages`);

    // Save and check size
    const pdfBytes = await pdfDoc.save();
    const pdfSizeMb = pdfBytes.length / 1024 / 1024;
    console.log(`PDF size: ${pdfSizeMb.toFixed(2)} MB`);

    // Check if we need to split
    const needsSplit = pdfSizeMb > MAX_PDF_SIZE_MB;
    let pdfPartUrls: string[] = [];

    if (needsSplit) {
      // Split into parts - each part gets front matter + subset of images
      const totalScannedPages = imagePaths.length;
      const imagesPerPart = Math.ceil(totalScannedPages / Math.ceil(pdfSizeMb / MAX_PDF_SIZE_MB));
      const numParts = Math.ceil(totalScannedPages / imagesPerPart);
      
      console.log(`Splitting into ${numParts} parts, ~${imagesPerPart} images each`);

      for (let partNum = 0; partNum < numParts; partNum++) {
        const partStart = partNum * imagesPerPart;
        const partEnd = Math.min(partStart + imagesPerPart, totalScannedPages);
        const partImages = imagePaths.slice(partStart, partEnd);

        console.log(`Creating part ${partNum + 1}/${numParts}: pages ${partStart + 1}-${partEnd}`);

        // Create part PDF with front matter
        const partDoc = await PDFDocument.create();
        const partFont = await partDoc.embedFont(StandardFonts.Helvetica);
        const partBoldFont = await partDoc.embedFont(StandardFonts.HelveticaBold);

        // Add front matter to each part
        addClinicalSummaryPage(partDoc, partFont, partBoldFont, {
          patientName,
          nhsNumber,
          dob,
          totalPages: totalScannedPages,
          summaryJson,
          snomedJson,
          partInfo: `PART ${partNum + 1} of ${numParts}`,
        });

        addMedicationsPage(partDoc, partFont, partBoldFont, {
          patientName,
          nhsNumber,
          dob,
          summaryJson,
        });

        const partFrontMatter = partDoc.getPageCount();
        addIndexPage(partDoc, partFont, partBoldFont, {
          patientName,
          nhsNumber,
          pageSummaries: pageSummaries.slice(partStart, partEnd),
          scanStartPage: partFrontMatter + 1,
          partInfo: `(Part ${partNum + 1}: Pages ${partStart + 1}-${partEnd} of ${totalScannedPages})`,
        });

        // Add images for this part
        for (let i = 0; i < partImages.length; i++) {
          const imagePath = partImages[i];
          
          try {
            const { data: imageData } = await supabase.storage
              .from('lg')
              .download(imagePath);

            if (!imageData) continue;

            const imageBytes = new Uint8Array(await imageData.arrayBuffer());
            
            let image;
            try {
              image = await partDoc.embedJpg(imageBytes);
            } catch {
              try {
                image = await partDoc.embedPng(imageBytes);
              } catch {
                continue;
              }
            }

            const { width, height } = image;
            const headerHeight = 30;
            const page = partDoc.addPage([width, height + headerHeight]);

            page.drawRectangle({
              x: 0,
              y: height,
              width: width,
              height: headerHeight,
              color: rgb(1, 1, 1),
            });

            page.drawText(sanitizeForPdf(headerText), {
              x: 10,
              y: height + 10,
              size: 10,
              font: partFont,
              color: rgb(0, 0, 0),
            });

            const pageNumText = `Page ${partFrontMatter + i + 1}`;
            const pageNumWidth = partFont.widthOfTextAtSize(pageNumText, 10);
            page.drawText(pageNumText, {
              x: width - pageNumWidth - 10,
              y: height + 10,
              size: 10,
              font: partFont,
              color: rgb(0, 0, 0),
            });

            page.drawImage(image, { x: 0, y: 0, width, height });

          } catch (err) {
            console.error(`Part ${partNum + 1} page ${i + 1} error:`, err);
          }
        }

        // Save and upload part
        const partBytes = await partDoc.save();
        const partPath = `${basePath}/final/lloyd-george_part${partNum + 1}of${numParts}.pdf`;
        
        const { error: uploadError } = await supabase.storage
          .from('lg')
          .upload(partPath, partBytes, { contentType: 'application/pdf', upsert: true });

        if (uploadError) {
          console.error(`Failed to upload part ${partNum + 1}:`, uploadError.message);
        } else {
          pdfPartUrls.push(partPath);
          console.log(`Uploaded part ${partNum + 1}: ${(partBytes.length / 1024 / 1024).toFixed(2)} MB`);
        }
      }
    } else {
      // Single PDF - upload directly
      const outputPath = `${basePath}/final/lloyd-george.pdf`;
      
      const { error: uploadError } = await supabase.storage
        .from('lg')
        .upload(outputPath, pdfBytes, { contentType: 'application/pdf', upsert: true });

      if (uploadError) {
        throw new Error(`Failed to upload PDF: ${uploadError.message}`);
      }

      pdfPartUrls = [outputPath];
      console.log(`Uploaded: ${outputPath}`);
    }

    // Update patient record
    const updateData: Record<string, unknown> = {
      pdf_generation_status: 'complete',
      pdf_completed_at: new Date().toISOString(),
      pdf_url: pdfPartUrls[0],
      pdf_final_size_mb: parseFloat(pdfSizeMb.toFixed(2)),
      pdf_split: needsSplit,
      pdf_parts: pdfPartUrls.length,
      job_status: 'succeeded',
      processing_completed_at: new Date().toISOString(),
    };

    if (needsSplit) {
      updateData.pdf_part_urls = pdfPartUrls;
    }

    await supabase
      .from('lg_patients')
      .update(updateData)
      .eq('id', patientId);

    // Send email if requested
    if (sendEmail) {
      try {
        await supabase.functions.invoke('send-email-resend', {
          body: {
            patientId,
            type: 'lg-complete',
          },
        });
        console.log('Email notification sent');
      } catch (emailErr) {
        console.error('Failed to send email:', emailErr);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== PDF Generation Complete in ${elapsed}s ===`);

    return new Response(JSON.stringify({
      success: true,
      outputPath: pdfPartUrls[0],
      pdfPartUrls,
      pageCount: imagePaths.length,
      parts: pdfPartUrls.length,
      totalSizeMb: parseFloat(pdfSizeMb.toFixed(2)),
      elapsedSeconds: parseFloat(elapsed),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('PDF Generation Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    try {
      const body = await req.clone().json();
      if (body.patientId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        await supabase
          .from('lg_patients')
          .update({
            pdf_generation_status: 'failed',
            error_message: `PDF generation failed: ${errorMessage}`,
          })
          .eq('id', body.patientId);
      }
    } catch (updateErr) {
      console.error('Failed to update error status:', updateErr);
    }

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Generate page summaries from OCR text
function generatePageSummaries(ocrText: string, pageCount: number): string[] {
  const summaries: string[] = [];
  
  // Parse OCR text to extract per-page content
  const pageMarkers = ocrText.split(/---\s*Page\s+page_\d+\.jpg\s*---/i);
  
  for (let i = 0; i < pageCount; i++) {
    const pageText = pageMarkers[i + 1] || ''; // +1 because first split is before first marker
    
    if (pageText.trim().length < 20) {
      summaries.push('Mostly blank page');
    } else {
      // Extract first meaningful line as summary
      const lines = pageText.trim().split('\n').filter(l => l.trim().length > 5);
      const firstLine = lines[0] || 'Scanned document page';
      summaries.push(firstLine.substring(0, 55));
    }
  }
  
  // Fill remaining with generic summaries
  while (summaries.length < pageCount) {
    summaries.push(`Scanned page ${summaries.length + 1} of ${pageCount}`);
  }
  
  return summaries;
}

// Add clinical summary page
function addClinicalSummaryPage(
  pdfDoc: PDFDocument,
  font: any,
  boldFont: any,
  opts: {
    patientName: string;
    nhsNumber: string;
    dob: string;
    totalPages: number;
    summaryJson: any;
    snomedJson: any;
    partInfo?: string;
  }
) {
  const { patientName, nhsNumber, dob, totalPages, summaryJson, snomedJson, partInfo } = opts;
  
  let page = pdfDoc.addPage([595, 842]); // A4
  let y = 790;
  const leftMargin = 50;
  const lineHeight = 16;
  const pageMarginBottom = 60;

  const drawLine = (text: string, size = 10, isBold = false, indent = 0) => {
    const safeText = sanitizeForPdf(text);
    if (y < pageMarginBottom) {
      page = pdfDoc.addPage([595, 842]);
      y = 790;
    }
    page.drawText(safeText, { 
      x: leftMargin + indent, 
      y, 
      size, 
      font: isBold ? boldFont : font 
    });
    y -= lineHeight;
  };

  const addSpace = (lines = 1) => {
    y -= lineHeight * lines;
    if (y < pageMarginBottom) {
      page = pdfDoc.addPage([595, 842]);
      y = 790;
    }
  };

  // Header
  drawLine('LLOYD GEORGE RECORD - CLINICAL SUMMARY', 16, true);
  if (partInfo) {
    drawLine(partInfo, 12, true);
  }
  addSpace(0.5);

  // Patient details
  drawLine(`Patient: ${patientName}`, 12, true);
  drawLine(`NHS Number: ${nhsNumber}`, 12);
  drawLine(`Date of Birth: ${dob}`, 12);
  drawLine(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 10);
  drawLine(`Total Scanned Pages: ${totalPages}`, 10);
  addSpace(1);

  // Clinical Summary
  if (summaryJson?.summary_line) {
    drawLine('CLINICAL SUMMARY', 12, true);
    addSpace(0.3);
    const words = summaryJson.summary_line.split(' ');
    let line = '';
    for (const word of words) {
      if ((line + ' ' + word).length > 75) {
        drawLine(line.trim(), 10, false, 10);
        line = word;
      } else {
        line += ' ' + word;
      }
    }
    if (line.trim()) drawLine(line.trim(), 10, false, 10);
    addSpace(1);
  }

  // SNOMED sections
  const sections = [
    { key: 'diagnoses', title: 'DIAGNOSES' },
    { key: 'surgeries', title: 'MAJOR SURGERIES' },
    { key: 'allergies', title: 'ALLERGIES' },
    { key: 'immunisations', title: 'IMMUNISATIONS' },
  ];

  for (const section of sections) {
    const items = snomedJson?.[section.key] || [];
    if (items.length > 0) {
      drawLine(section.title, 12, true);
      addSpace(0.3);
      for (const item of items) {
        const code = item.code || 'UNKNOWN';
        const term = item.term || 'Unknown term';
        const confidence = item.confidence ? `${Math.round(item.confidence * 100)}%` : '';
        drawLine(`${term} [SNOMED: ${code}] ${confidence}`, 10, false, 15);
      }
      addSpace(0.5);
    }
  }

  // Footer
  addSpace(1);
  drawLine('This summary was generated by AI from scanned Lloyd George records.', 9);
  drawLine('All clinical information should be verified before use.', 9);
}

// Add medications page
function addMedicationsPage(
  pdfDoc: PDFDocument,
  font: any,
  boldFont: any,
  opts: {
    patientName: string;
    nhsNumber: string;
    dob: string;
    summaryJson: any;
  }
) {
  const { patientName, nhsNumber, dob, summaryJson } = opts;
  
  let page = pdfDoc.addPage([595, 842]);
  let y = 790;
  const leftMargin = 50;
  const lineHeight = 16;

  const drawLine = (text: string, size = 10, isBold = false, indent = 0) => {
    const safeText = sanitizeForPdf(text);
    if (y < 60) {
      page = pdfDoc.addPage([595, 842]);
      y = 790;
    }
    page.drawText(safeText, { 
      x: leftMargin + indent, 
      y, 
      size, 
      font: isBold ? boldFont : font 
    });
    y -= lineHeight;
  };

  // Header
  drawLine('MEDICATIONS & ADDITIONAL INFORMATION', 16, true);
  y -= 8;
  drawLine(`Patient: ${patientName} | NHS: ${nhsNumber} | DOB: ${dob}`, 10);
  y -= 20;

  // Medications
  drawLine('CURRENT MEDICATIONS', 12, true);
  y -= 5;
  const medications = summaryJson?.medications || [];
  if (medications.length > 0) {
    for (const med of medications) {
      const text = `${med.drug || ''} ${med.dose || ''} (${med.status || 'unknown'})`;
      drawLine(text, 10, false, 15);
    }
  } else {
    drawLine('No medications recorded', 10, false, 15);
  }
  y -= 15;

  // Social History
  if (summaryJson?.social_history) {
    const sh = summaryJson.social_history;
    if (sh.smoking_status !== 'unknown' || sh.alcohol !== 'unknown') {
      drawLine('SOCIAL HISTORY', 12, true);
      y -= 5;
      if (sh.smoking_status && sh.smoking_status !== 'unknown') {
        const smokingText = sh.smoking_status === 'ex'
          ? `Ex-smoker${sh.stopped_year ? ` (stopped ${sh.stopped_year})` : ''}`
          : sh.smoking_status;
        drawLine(`Smoking: ${smokingText}`, 10, false, 15);
      }
      if (sh.alcohol && sh.alcohol !== 'unknown') {
        drawLine(`Alcohol: ${sh.alcohol}`, 10, false, 15);
      }
      if (sh.occupation) {
        drawLine(`Occupation: ${sh.occupation}`, 10, false, 15);
      }
      y -= 15;
    }
  }

  // Risk factors
  const riskFactors = summaryJson?.risk_factors || [];
  if (riskFactors.length > 0) {
    drawLine('RISK FACTORS', 12, true);
    y -= 5;
    for (const rf of riskFactors) {
      drawLine(`- ${rf}`, 10, false, 15);
    }
    y -= 15;
  }

  // Family history
  const familyHistory = summaryJson?.family_history || [];
  if (familyHistory.length > 0) {
    drawLine('FAMILY HISTORY', 12, true);
    y -= 5;
    for (const fh of familyHistory) {
      drawLine(`- ${fh}`, 10, false, 15);
    }
  }

  // Page number
  page.drawText('Page 2', { x: 545, y: 30, size: 9, font });
}

// Add index page
function addIndexPage(
  pdfDoc: PDFDocument,
  font: any,
  boldFont: any,
  opts: {
    patientName: string;
    nhsNumber: string;
    pageSummaries: string[];
    scanStartPage: number;
    partInfo?: string;
  }
) {
  const { patientName, nhsNumber, pageSummaries, scanStartPage, partInfo } = opts;
  
  let page = pdfDoc.addPage([595, 842]);
  let y = 790;
  const leftMargin = 50;
  const lineHeight = 18;

  const drawLine = (text: string, size = 10, isBold = false) => {
    const safeText = sanitizeForPdf(text);
    if (y < 60) {
      page = pdfDoc.addPage([595, 842]);
      y = 790;
    }
    page.drawText(safeText, { x: leftMargin, y, size, font: isBold ? boldFont : font });
    y -= lineHeight;
  };

  drawLine('INDEX OF SCANNED PAGES', 16, true);
  if (partInfo) {
    drawLine(partInfo, 10);
  }
  y -= 10;
  drawLine(`Patient: ${patientName}   NHS: ${nhsNumber}`, 10);
  y -= 20;

  drawLine('Page No.    Description', 11, true);
  drawLine('--------    -----------', 10);
  y -= 5;

  for (let i = 0; i < pageSummaries.length; i++) {
    const pdfPageNum = scanStartPage + i;
    const summary = pageSummaries[i] || `Scanned page ${i + 1}`;
    const truncatedSummary = summary.substring(0, 55);
    drawLine(`Page ${String(pdfPageNum).padStart(3, ' ')}    ${truncatedSummary}`, 10);
  }

  y -= 20;
  drawLine('Click any "Page X" entry above to jump directly to that page.', 9);

  // Page number
  page.drawText('Page 3', { x: 545, y: 30, size: 9, font });
}
