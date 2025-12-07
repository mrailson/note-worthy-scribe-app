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

// Format NHS number with standard spacing (XXX XXX XXXX)
function formatNhsNumber(nhs: string): string {
  const cleaned = nhs.replace(/\s+/g, '').replace(/\D/g, '');
  if (cleaned.length !== 10) return nhs; // Return as-is if not valid 10-digit
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
}

// Format date to UK standard (DD/MM/YYYY)
function formatDateUK(dateStr: string): string {
  if (!dateStr) return '';
  
  // Try to parse various date formats
  let date: Date | null = null;
  
  // ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    date = new Date(dateStr);
  }
  // Already UK format: DD/MM/YYYY
  else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  // UK format without slashes: DDMMYYYY
  else if (/^\d{8}$/.test(dateStr)) {
    const day = dateStr.slice(0, 2);
    const month = dateStr.slice(2, 4);
    const year = dateStr.slice(4, 8);
    return `${day}/${month}/${year}`;
  }
  
  if (date && !isNaN(date.getTime())) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  return dateStr; // Return original if can't parse
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
    const nhsNumberRaw = patient.ai_extracted_nhs || patient.nhs_number || '';
    const dobRaw = patient.ai_extracted_dob || patient.dob || '';
    const basePath = `${practiceOds}/${patientId}`;
    
    // Format NHS number and DOB for display
    const nhsNumber = formatNhsNumber(nhsNumberRaw);
    const dob = formatDateUK(dobRaw);

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
    const { indexPageIndices, linkYPositions } = addIndexPage(pdfDoc, font, boldFont, {
      patientName,
      nhsNumber,
      pageSummaries,
      scanStartPage: frontMatterPages + 1,
    });
    
    // Store first index page for "back to index" links
    const firstIndexPageIndex = indexPageIndices[0];

    // ===== SCANNED IMAGES =====
    console.log('Adding scanned images...');
    const headerText = `Patient: ${patientName} | NHS: ${nhsNumber} | DOB: ${dob}`;
    const scannedPageIndices: number[] = []; // Track indices of scanned pages for linking
    
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

        const { width: imgWidth, height: imgHeight } = image;
        
        // Use A4 page size with margins for white border
        const pageWidth = 595;  // A4 width
        const pageHeight = 842; // A4 height
        const headerHeight = 55; // Increased for 2-line header (patient info + page summary)
        const margin = 30; // White border margin
        const footerHeight = 30;
        
        // Calculate available space for image
        const availableWidth = pageWidth - (margin * 2);
        const availableHeight = pageHeight - headerHeight - footerHeight - margin;
        
        // Scale image to fit within available space while maintaining aspect ratio
        const scaleX = availableWidth / imgWidth;
        const scaleY = availableHeight / imgHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down
        
        const scaledWidth = imgWidth * scale;
        const scaledHeight = imgHeight * scale;
        
        // Center the image horizontally
        const imageX = (pageWidth - scaledWidth) / 2;
        const imageY = footerHeight + ((availableHeight - scaledHeight) / 2);
        
        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        scannedPageIndices.push(pdfDoc.getPageCount() - 1);

        // Fill page with white background
        page.drawRectangle({
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
          color: rgb(1, 1, 1),
        });

        // Draw header text at top (line 1: patient info)
        const fontSize = 10;
        page.drawText(sanitizeForPdf(headerText), {
          x: margin,
          y: pageHeight - 20,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });

        // Draw page number on right of header
        const pageNumText = `Page ${frontMatterPages + i + 1}`;
        const pageNumWidth = font.widthOfTextAtSize(pageNumText, fontSize);
        page.drawText(pageNumText, {
          x: pageWidth - pageNumWidth - margin,
          y: pageHeight - 20,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
        
        // Draw page summary on second line of header
        const pageSummary = pageSummaries[i] || `Scanned page ${i + 1}`;
        const truncatedSummary = pageSummary.length > 80 ? pageSummary.substring(0, 77) + '...' : pageSummary;
        page.drawText(sanitizeForPdf(`Summary: ${truncatedSummary}`), {
          x: margin,
          y: pageHeight - 35,
          size: 9,
          font,
          color: rgb(0.3, 0.3, 0.3), // Grey color for summary
        });
        
        // Draw "Back to Index" link text at bottom left
        const backToIndexText = '[Back to Index]';
        page.drawText(backToIndexText, {
          x: margin,
          y: 15,
          size: 9,
          font,
          color: rgb(0, 0.35, 0.8), // Blue color for link
        });

        // Draw the image centered with white border
        page.drawImage(image, {
          x: imageX,
          y: imageY,
          width: scaledWidth,
          height: scaledHeight,
        });

      } catch (pageErr) {
        console.error(`Error processing page ${i + 1}:`, pageErr);
      }
    }

    console.log(`PDF complete with ${pdfDoc.getPageCount()} pages`);
    
    // ===== ADD HYPERLINK ANNOTATIONS =====
    console.log('Adding hyperlink annotations...');
    const pages = pdfDoc.getPages();
    
    // Add links from index entries to scanned pages
    for (const linkPos of linkYPositions) {
      const sourcePage = pages[linkPos.pageIndex];
      if (sourcePage && linkPos.targetPage < pages.length) {
        const targetPage = pages[linkPos.targetPage];
        if (targetPage) {
          // Create link annotation for the index entry
          sourcePage.node.set(
            pdfDoc.context.obj({ Type: 'Annots' }),
            pdfDoc.context.obj([
              ...(sourcePage.node.get(pdfDoc.context.obj({ Type: 'Annots' })) || []),
            ])
          );
          
          // Use page reference for internal link
          const linkAnnotation = pdfDoc.context.obj({
            Type: 'Annot',
            Subtype: 'Link',
            Rect: [50, linkPos.y - 5, 545, linkPos.y + 12], // Clickable area
            Border: [0, 0, 0], // No visible border
            Dest: [targetPage.ref, 'XYZ', null, null, null], // Internal destination
          });
          
          const existingAnnots = sourcePage.node.get(pdfDoc.context.obj('Annots'));
          if (existingAnnots) {
            existingAnnots.push(linkAnnotation);
          } else {
            sourcePage.node.set(pdfDoc.context.obj('Annots'), pdfDoc.context.obj([linkAnnotation]));
          }
        }
      }
    }
    
    // Add "Back to Index" links on scanned pages
    const indexPage = pages[firstIndexPageIndex];
    if (indexPage) {
      for (const scannedPageIdx of scannedPageIndices) {
        const scannedPage = pages[scannedPageIdx];
        if (scannedPage) {
          const backLinkAnnotation = pdfDoc.context.obj({
            Type: 'Annot',
            Subtype: 'Link',
            Rect: [30, 10, 120, 25], // Bottom left clickable area
            Border: [0, 0, 0],
            Dest: [indexPage.ref, 'XYZ', null, null, null],
          });
          
          const existingAnnots = scannedPage.node.get(pdfDoc.context.obj('Annots'));
          if (existingAnnots) {
            existingAnnots.push(backLinkAnnotation);
          } else {
            scannedPage.node.set(pdfDoc.context.obj('Annots'), pdfDoc.context.obj([backLinkAnnotation]));
          }
        }
      }
    }
    
    console.log(`Added ${linkYPositions.length} index links and ${scannedPageIndices.length} back-to-index links`);

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
        const { indexPageIndices: partIndexPages, linkYPositions: partLinkPositions } = addIndexPage(partDoc, partFont, partBoldFont, {
          patientName,
          nhsNumber,
          pageSummaries: pageSummaries.slice(partStart, partEnd),
          scanStartPage: partFrontMatter + 1,
          partInfo: `(Part ${partNum + 1}: Pages ${partStart + 1}-${partEnd} of ${totalScannedPages})`,
        });
        
        const partFirstIndexPage = partIndexPages[0];
        const partScannedPageIndices: number[] = [];

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

            const { width: imgWidth, height: imgHeight } = image;
            
            // Use A4 page size with margins for white border
            const pageWidth = 595;
            const pageHeight = 842;
            const headerH = 55; // Increased for 2-line header
            const margin = 30;
            const footerH = 30;
            
            const availWidth = pageWidth - (margin * 2);
            const availHeight = pageHeight - headerH - footerH - margin;
            
            const scaleX = availWidth / imgWidth;
            const scaleY = availHeight / imgHeight;
            const scale = Math.min(scaleX, scaleY, 1);
            
            const scaledW = imgWidth * scale;
            const scaledH = imgHeight * scale;
            const imgX = (pageWidth - scaledW) / 2;
            const imgY = footerH + ((availHeight - scaledH) / 2);
            
            const page = partDoc.addPage([pageWidth, pageHeight]);
            partScannedPageIndices.push(partDoc.getPageCount() - 1);

            page.drawRectangle({
              x: 0,
              y: 0,
              width: pageWidth,
              height: pageHeight,
              color: rgb(1, 1, 1),
            });

            // Line 1: Patient info
            page.drawText(sanitizeForPdf(headerText), {
              x: margin,
              y: pageHeight - 20,
              size: 10,
              font: partFont,
              color: rgb(0, 0, 0),
            });

            const pageNumText = `Page ${partFrontMatter + i + 1}`;
            const pageNumWidth = partFont.widthOfTextAtSize(pageNumText, 10);
            page.drawText(pageNumText, {
              x: pageWidth - pageNumWidth - margin,
              y: pageHeight - 20,
              size: 10,
              font: partFont,
              color: rgb(0, 0, 0),
            });
            
            // Line 2: Page summary
            const partPageSummary = pageSummaries[partStart + i] || `Scanned page ${partStart + i + 1}`;
            const truncPartSummary = partPageSummary.length > 80 ? partPageSummary.substring(0, 77) + '...' : partPageSummary;
            page.drawText(sanitizeForPdf(`Summary: ${truncPartSummary}`), {
              x: margin,
              y: pageHeight - 35,
              size: 9,
              font: partFont,
              color: rgb(0.3, 0.3, 0.3),
            });
            
            // Draw "Back to Index" link text
            page.drawText('[Back to Index]', {
              x: margin,
              y: 15,
              size: 9,
              font: partFont,
              color: rgb(0, 0.35, 0.8),
            });

            page.drawImage(image, { x: imgX, y: imgY, width: scaledW, height: scaledH });

          } catch (err) {
            console.error(`Part ${partNum + 1} page ${i + 1} error:`, err);
          }
        }
        
        // Add hyperlink annotations for this part
        const partPages = partDoc.getPages();
        
        // Add links from index entries to scanned pages
        for (const linkPos of partLinkPositions) {
          const sourcePage = partPages[linkPos.pageIndex];
          if (sourcePage && linkPos.targetPage < partPages.length) {
            const targetPage = partPages[linkPos.targetPage];
            if (targetPage) {
              const linkAnnotation = partDoc.context.obj({
                Type: 'Annot',
                Subtype: 'Link',
                Rect: [50, linkPos.y - 5, 545, linkPos.y + 12],
                Border: [0, 0, 0],
                Dest: [targetPage.ref, 'XYZ', null, null, null],
              });
              
              const existingAnnots = sourcePage.node.get(partDoc.context.obj('Annots'));
              if (existingAnnots) {
                existingAnnots.push(linkAnnotation);
              } else {
                sourcePage.node.set(partDoc.context.obj('Annots'), partDoc.context.obj([linkAnnotation]));
              }
            }
          }
        }
        
        // Add "Back to Index" links on scanned pages
        const partIndexPage = partPages[partFirstIndexPage];
        if (partIndexPage) {
          for (const scannedPageIdx of partScannedPageIndices) {
            const scannedPage = partPages[scannedPageIdx];
            if (scannedPage) {
              const backLinkAnnotation = partDoc.context.obj({
                Type: 'Annot',
                Subtype: 'Link',
                Rect: [30, 10, 120, 25],
                Border: [0, 0, 0],
                Dest: [partIndexPage.ref, 'XYZ', null, null, null],
              });
              
              const existingAnnots = scannedPage.node.get(partDoc.context.obj('Annots'));
              if (existingAnnots) {
                existingAnnots.push(backLinkAnnotation);
              } else {
                scannedPage.node.set(partDoc.context.obj('Annots'), partDoc.context.obj([backLinkAnnotation]));
              }
            }
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

    // Check if this patient is part of a batch and if all batch items are complete
    if (patient.batch_id) {
      console.log(`Checking batch completion for batch: ${patient.batch_id}`);
      
      // Count total in batch
      const { count: totalInBatch } = await supabase
        .from('lg_patients')
        .select('*', { count: 'exact', head: true })
        .eq('batch_id', patient.batch_id);
      
      // Count completed in batch
      const { count: completedInBatch } = await supabase
        .from('lg_patients')
        .select('*', { count: 'exact', head: true })
        .eq('batch_id', patient.batch_id)
        .in('job_status', ['succeeded', 'failed']);
      
      // Check if batch report already sent
      const { data: batchReportCheck } = await supabase
        .from('lg_patients')
        .select('batch_report_sent')
        .eq('batch_id', patient.batch_id)
        .eq('batch_report_sent', true)
        .limit(1);
      
      const reportAlreadySent = batchReportCheck && batchReportCheck.length > 0;
      
      console.log(`Batch status: ${completedInBatch}/${totalInBatch} complete, report sent: ${reportAlreadySent}`);
      
      if (totalInBatch && completedInBatch && totalInBatch === completedInBatch && !reportAlreadySent) {
        console.log('All batch items complete! Triggering batch report...');
        
        // Get user email from auth.users (email is not always in profiles)
        const { data: authUser } = await supabase.auth.admin.getUserById(patient.user_id);
        const userEmail = authUser?.user?.email;
        
        // Get user name from profiles if available
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', patient.user_id)
          .single();
        const userName = profileData?.full_name || userEmail?.split('@')[0] || 'LG Capture User';
        
        // Get practice name
        const { data: practiceData } = await supabase
          .from('gp_practices')
          .select('name')
          .eq('ods_code', patient.practice_ods)
          .single();
        
        try {
          await supabase.functions.invoke('lg-batch-report', {
            body: {
              batchId: patient.batch_id,
              userEmail: userEmail,
              userName: userName,
              practiceName: practiceData?.name || patient.practice_ods,
            },
          });
          console.log('Batch report triggered successfully');
        } catch (batchErr) {
          console.error('Failed to trigger batch report:', batchErr);
        }
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
      // Extract clinically meaningful summary, not just first line
      const summary = extractClinicalSummary(pageText);
      summaries.push(summary.substring(0, 55));
    }
  }
  
  // Fill remaining with generic summaries
  while (summaries.length < pageCount) {
    summaries.push(`Scanned page ${summaries.length + 1} of ${pageCount}`);
  }
  
  return summaries;
}

// Extract a clinically meaningful one-line summary from OCR page text
function extractClinicalSummary(pageText: string): string {
  const text = pageText.trim();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
  
  // Skip common headers/names that appear on every page
  const skipPatterns = [
    /^[A-Z][a-z]+ [A-Z][a-z]+$/,  // Just a name like "Sophie Clarke"
    /^NHS\s*(No[:\.]?)?/i,
    /^DOB[:\s]/i,
    /^Date[:\s]/i,
    /^Page\s+\d+/i,
    /^\d{3}\s*\d{3}\s*\d{4}$/,  // NHS number
    /^\d{2}[\/\-]\d{2}[\/\-]\d{2,4}$/,  // Date
    /^Patient:/i,
  ];
  
  // Look for clinically meaningful content patterns
  const clinicalPatterns = [
    { regex: /consultation note/i, label: 'Consultation note' },
    { regex: /letter|correspondence/i, label: 'Correspondence' },
    { regex: /discharge summary/i, label: 'Discharge summary' },
    { regex: /emergency department/i, label: 'Emergency department record' },
    { regex: /a\s*&\s*e|accident\s*(and|&)\s*emergency/i, label: 'A&E attendance' },
    { regex: /hospital/i, label: 'Hospital record' },
    { regex: /referral/i, label: 'Referral letter' },
    { regex: /blood test|pathology|results?/i, label: 'Test results' },
    { regex: /x-?ray|imaging|scan|mri|ct\s/i, label: 'Imaging report' },
    { regex: /prescription|medication|drug/i, label: 'Prescription/medication record' },
    { regex: /allerg(y|ies)/i, label: 'Allergy information' },
    { regex: /immunis(ation|ization)|vaccin/i, label: 'Immunisation record' },
    { regex: /active\s+problems?/i, label: 'Problem list / active conditions' },
    { regex: /current\s+medications?/i, label: 'Current medications list' },
    { regex: /smoking\s+status/i, label: 'Patient demographics card' },
    { regex: /asthma|diabetes|hypertension|copd|epilepsy/i, label: (m: string) => `${m.charAt(0).toUpperCase() + m.slice(1).toLowerCase()} management note` },
    { regex: /review\s+of|annual\s+review/i, label: 'Clinical review' },
    { regex: /c\/o[:\s]|complaint[:\s]/i, label: 'Consultation record' },
    { regex: /o\/e[:\s]|on\s+examination/i, label: 'Clinical examination' },
    { regex: /plan[:\s]/i, label: 'Management plan' },
  ];
  
  // Check full text for clinical patterns
  for (const pattern of clinicalPatterns) {
    const match = text.match(pattern.regex);
    if (match) {
      if (typeof pattern.label === 'function') {
        return pattern.label(match[0]);
      }
      return pattern.label;
    }
  }
  
  // Find first meaningful line that isn't just a name or header
  for (const line of lines) {
    const isSkippable = skipPatterns.some(p => p.test(line));
    if (!isSkippable && line.length > 8) {
      // Prefer lines with clinical keywords
      if (/diagnosis|asthma|medication|allergy|consultation|review|plan|findings/i.test(line)) {
        return line;
      }
    }
  }
  
  // Second pass: return first non-skippable line
  for (const line of lines) {
    const isSkippable = skipPatterns.some(p => p.test(line));
    if (!isSkippable && line.length > 10) {
      return line;
    }
  }
  
  // Fallback
  return 'Scanned document page';
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
  drawLine('MEDICATION HISTORY & ADDITIONAL INFORMATION', 16, true);
  y -= 8;
  drawLine(`Patient: ${patientName} | NHS: ${nhsNumber} | DOB: ${dob}`, 10);
  y -= 20;

  // Medications
  drawLine('MEDICATION HISTORY', 12, true);
  y -= 5;
  const medications = summaryJson?.medications || [];
  if (medications.length > 0) {
    for (const med of medications) {
      const text = `${med.drug || 'Unknown'} | ${med.dose || 'Dose not recorded'} | ${med.date || med.year || 'Not Known from LG'}`;
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

// Add index page with hyperlinks
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
): { indexPageIndices: number[]; linkYPositions: { pageIndex: number; y: number; targetPage: number }[] } {
  const { patientName, nhsNumber, pageSummaries, scanStartPage, partInfo } = opts;
  
  const indexPageIndices: number[] = [];
  const linkYPositions: { pageIndex: number; y: number; targetPage: number }[] = [];
  
  let page = pdfDoc.addPage([595, 842]);
  indexPageIndices.push(pdfDoc.getPageCount() - 1);
  let y = 790;
  const leftMargin = 50;
  const lineHeight = 18;

  const drawLine = (text: string, size = 10, isBold = false) => {
    const safeText = sanitizeForPdf(text);
    if (y < 60) {
      page = pdfDoc.addPage([595, 842]);
      indexPageIndices.push(pdfDoc.getPageCount() - 1);
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

  // Draw index entries and record positions for link annotations
  for (let i = 0; i < pageSummaries.length; i++) {
    const pdfPageNum = scanStartPage + i;
    const summary = pageSummaries[i] || `Scanned page ${i + 1}`;
    const truncatedSummary = summary.substring(0, 55);
    
    // Check if we need a new page
    if (y < 60) {
      page = pdfDoc.addPage([595, 842]);
      indexPageIndices.push(pdfDoc.getPageCount() - 1);
      y = 790;
    }
    
    const entryText = `Page ${String(pdfPageNum).padStart(3, ' ')}    ${truncatedSummary}`;
    page.drawText(sanitizeForPdf(entryText), { x: leftMargin, y, size: 10, font });
    
    // Store position for link annotation (to be added after all pages exist)
    linkYPositions.push({
      pageIndex: pdfDoc.getPageCount() - 1,
      y: y,
      targetPage: pdfPageNum - 1, // 0-indexed target page
    });
    
    y -= lineHeight;
  }

  y -= 20;
  drawLine('Click any entry above to jump to that page. Each page has a link back to this index.', 9);

  // Page number
  page.drawText('Page 3', { x: 545, y: 30, size: 9, font });
  
  return { indexPageIndices, linkYPositions };
}
