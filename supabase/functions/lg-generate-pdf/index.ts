import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process images in small batches to avoid memory issues
const IMAGE_BATCH_SIZE = 5;

// SystmOne upload limit
const MAX_PDF_SIZE_MB = 5;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

// NEW: 60% scaling-based compression settings
interface CompressionSettings {
  scaleFactor: number;      // 0.6 = 60% of original dimensions
  jpegQuality: number;      // 0.70 = 70% quality
  grayscale: boolean;
  tier: 'Standard' | 'Aggressive';
}

function getCompressionSettings(pageCount: number, attempt: number = 0): CompressionSettings {
  if (pageCount <= 30) {
    // Standard compression for ≤30 pages
    const settings = {
      scaleFactor: 0.60 - (attempt * 0.05), // 0.60, 0.55, 0.50
      jpegQuality: 0.70 - (attempt * 0.05), // 0.70, 0.65, 0.60
      grayscale: attempt >= 2, // Only on 3rd attempt
      tier: 'Standard' as const,
    };
    // Enforce minimums for readability
    return {
      ...settings,
      scaleFactor: Math.max(settings.scaleFactor, 0.45),
      jpegQuality: Math.max(settings.jpegQuality, 0.55),
    };
  } else {
    // Aggressive compression for >30 pages
    const settings = {
      scaleFactor: 0.50 - (attempt * 0.05), // 0.50, 0.45, 0.40
      jpegQuality: 0.60 - (attempt * 0.05), // 0.60, 0.55, 0.50
      grayscale: true,
      tier: 'Aggressive' as const,
    };
    return {
      ...settings,
      scaleFactor: Math.max(settings.scaleFactor, 0.35),
      jpegQuality: Math.max(settings.jpegQuality, 0.45),
    };
  }
}

// Parse EXIF orientation from JPEG bytes
function parseExifOrientation(bytes: Uint8Array): number {
  // Default orientation (normal)
  if (bytes.length < 12) return 1;
  
  // Check for JPEG signature (0xFFD8)
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return 1;
  
  let offset = 2;
  while (offset < bytes.length - 4) {
    // Look for markers
    if (bytes[offset] !== 0xFF) {
      offset++;
      continue;
    }
    
    const marker = bytes[offset + 1];
    
    // APP1 marker (EXIF data)
    if (marker === 0xE1) {
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      
      // Check for "Exif" string
      if (bytes[offset + 4] === 0x45 && bytes[offset + 5] === 0x78 &&
          bytes[offset + 6] === 0x69 && bytes[offset + 7] === 0x66) {
        
        const tiffOffset = offset + 10;
        
        // Check byte order (II = little endian, MM = big endian)
        const isLittleEndian = bytes[tiffOffset] === 0x49;
        
        const readUint16 = (pos: number): number => {
          if (isLittleEndian) {
            return bytes[pos] | (bytes[pos + 1] << 8);
          }
          return (bytes[pos] << 8) | bytes[pos + 1];
        };
        
        // Read IFD0 offset
        const ifdOffset = tiffOffset + 8;
        const numEntries = readUint16(ifdOffset);
        
        // Search for orientation tag (0x0112)
        for (let i = 0; i < numEntries; i++) {
          const entryOffset = ifdOffset + 2 + (i * 12);
          const tag = readUint16(entryOffset);
          
          if (tag === 0x0112) {
            const orientation = readUint16(entryOffset + 8);
            console.log(`EXIF orientation detected: ${orientation}`);
            return orientation;
          }
        }
      }
      offset += 2 + length;
    } else if (marker === 0xD9 || marker === 0xDA) {
      // End of image or start of scan - stop searching
      break;
    } else if (marker >= 0xE0 && marker <= 0xEF) {
      // Skip other APP markers
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      offset += 2 + length;
    } else {
      offset++;
    }
  }
  
  return 1; // Default: normal orientation
}

// Compress image using 60% scaling approach with EXIF rotation correction
async function compressImage(
  imageBytes: Uint8Array,
  settings: CompressionSettings
): Promise<Uint8Array> {
  try {
    // Parse EXIF orientation before processing
    const orientation = parseExifOrientation(imageBytes);
    
    // Create blob from bytes
    const blob = new Blob([imageBytes], { type: 'image/jpeg' });
    const imageBitmap = await createImageBitmap(blob);
    
    // Determine if rotation swaps width/height
    const rotationSwapsDimensions = orientation >= 5 && orientation <= 8;
    
    // Calculate target dimensions (before rotation consideration)
    let targetWidth = Math.round(imageBitmap.width * settings.scaleFactor);
    let targetHeight = Math.round(imageBitmap.height * settings.scaleFactor);
    
    // If rotation swaps dimensions, swap the canvas size
    let canvasWidth = targetWidth;
    let canvasHeight = targetHeight;
    if (rotationSwapsDimensions) {
      canvasWidth = targetHeight;
      canvasHeight = targetWidth;
    }
    
    // Create canvas
    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.warn('Canvas context unavailable, returning original');
      return imageBytes;
    }
    
    // Apply transformation based on EXIF orientation
    // Orientation values:
    // 1: Normal (no transformation)
    // 2: Flip horizontal
    // 3: Rotate 180°
    // 4: Flip vertical
    // 5: Rotate 90° CW + flip horizontal
    // 6: Rotate 90° CW
    // 7: Rotate 90° CCW + flip horizontal
    // 8: Rotate 90° CCW (or 270° CW)
    
    switch (orientation) {
      case 2:
        ctx.scale(-1, 1);
        ctx.translate(-canvasWidth, 0);
        break;
      case 3:
        ctx.translate(canvasWidth, canvasHeight);
        ctx.rotate(Math.PI);
        break;
      case 4:
        ctx.scale(1, -1);
        ctx.translate(0, -canvasHeight);
        break;
      case 5:
        ctx.rotate(Math.PI / 2);
        ctx.scale(1, -1);
        break;
      case 6:
        ctx.rotate(Math.PI / 2);
        ctx.translate(0, -canvasWidth);
        break;
      case 7:
        ctx.rotate(-Math.PI / 2);
        ctx.scale(1, -1);
        ctx.translate(-canvasHeight, 0);
        break;
      case 8:
        ctx.rotate(-Math.PI / 2);
        ctx.translate(-canvasHeight, 0);
        break;
      default:
        // No transformation needed
        break;
    }
    
    // Draw image with scaling
    ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
    
    // Reset transform for grayscale processing
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // Apply grayscale if needed
    if (settings.grayscale) {
      const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);
    }
    
    // Export as JPEG with specified quality
    const compressedBlob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: settings.jpegQuality,
    });
    
    const arrayBuffer = await compressedBlob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
    
  } catch (err) {
    console.warn('Image compression failed, using original:', err);
    return imageBytes;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { patientId, isBackground = false, sendEmail = false } = await req.json();
    
    if (!patientId) {
      throw new Error('Missing patientId');
    }

    console.log(`PDF generation for patient: ${patientId} (background: ${isBackground}, sendEmail: ${sendEmail})`);

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
    let ocrText = '';

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

    // Load OCR text for page summaries
    try {
      const { data: ocrData } = await supabase.storage
        .from('lg')
        .download(`${basePath}/work/ocr_merged.txt`);
      if (ocrData) {
        ocrText = await ocrData.text();
      }
    } catch {}

    // List raw images
    const { data: files, error: listError } = await supabase.storage
      .from('lg')
      .list(`${basePath}/raw`, { sortBy: { column: 'name', order: 'asc' } });

    if (listError || !files || files.length === 0) {
      throw new Error(`No images found: ${listError?.message}`);
    }

    const pageCount = files.length;
    console.log(`Creating PDF with ${pageCount} images in batches of ${IMAGE_BATCH_SIZE}`);

    // Patient details - extract once before compression loop
    const patientName = patient.ai_extracted_name || patient.patient_name || 'Unknown Patient';
    const nhsNumber = patient.ai_extracted_nhs || patient.nhs_number || 'Unknown';
    const dob = patient.ai_extracted_dob || patient.dob || 'Unknown';
    const formattedNhs = formatNhsNumber(nhsNumber);
    const formattedDob = formatDateUK(dob);

    // Generate page summaries from OCR text (once)
    console.log('Generating page summaries...');
    const pageSummaries = await generatePageSummaries(ocrText, pageCount);

    // Determine compression settings based on page count
    let compressionAttempt = 0;
    let compressionSettings = getCompressionSettings(pageCount, compressionAttempt);
    let finalPdfBytes: Uint8Array | null = null;
    let pdfSizeMb = 0;
    let originalSizeMb = 0;

    // Retry loop for compression
    while (compressionAttempt < 3) {
      compressionSettings = getCompressionSettings(pageCount, compressionAttempt);
      console.log(`Compression attempt ${compressionAttempt + 1}: ${compressionSettings.tier}, Scale: ${(compressionSettings.scaleFactor * 100).toFixed(0)}%, Quality: ${(compressionSettings.jpegQuality * 100).toFixed(0)}%, Grayscale: ${compressionSettings.grayscale}`);

      // Create PDF document
      const pdfDoc = await PDFDocument.create();

      // PAGE 1: Clinical Summary (without medications - moved to page 2)
      console.log('Adding clinical summary page (Page 1)...');
      addClinicalSummaryPage(pdfDoc, patientName, nhsNumber, dob, files.length, summaryJson, snomedJson);

      // PAGE 2: Medications & Extra Detail
      console.log('Adding medications page (Page 2)...');
      addMedicationsPage(pdfDoc, patientName, formattedNhs, formattedDob, summaryJson);

      // PAGE 3: Index of Scanned Pages
      console.log('Adding index page (Page 3)...');
      addIndexPage(pdfDoc, files, patientName, formattedNhs, pageSummaries);

      // PAGES 4+: Scanned images with patient header bands
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
              page.drawText(`Page ${i + 4} - Image unavailable`, { x: 200, y: 400, size: 14 });
              continue;
            }

            const arrayBuffer = await imageData.arrayBuffer();
            let uint8Array = new Uint8Array(arrayBuffer);

            // Apply 60% scaling compression
            uint8Array = await compressImage(uint8Array, compressionSettings);

            // Determine image type and embed
            let image;
            const fileName = file.name.toLowerCase();
            
            if (fileName.endsWith('.png')) {
              try {
                image = await pdfDoc.embedPng(uint8Array);
              } catch {
                image = await pdfDoc.embedJpg(uint8Array);
              }
            } else {
              try {
                image = await pdfDoc.embedJpg(uint8Array);
              } catch {
                try {
                  image = await pdfDoc.embedPng(uint8Array);
                } catch (embedErr) {
                  console.error(`Failed to embed image ${file.name}:`, embedErr);
                  const page = pdfDoc.addPage([595, 842]);
                  page.drawText(`Page ${i + 4} - Image format error`, { x: 200, y: 400, size: 14 });
                  continue;
                }
              }
            }

            // Add page with patient header band
            const page = pdfDoc.addPage([595, 842]);
            const pageWidth = 595;
            const pageHeight = 842;
            const margin = 40;
            const headerHeight = 45;
            const footerHeight = 30;
            
            // Draw white header band at top
            page.drawRectangle({
              x: 0,
              y: pageHeight - headerHeight,
              width: pageWidth,
              height: headerHeight,
              color: rgb(1, 1, 1), // White
            });
            
            // Draw header text
            page.drawText(`Patient: ${sanitizeForPdf(patientName)}`, { 
              x: margin, 
              y: pageHeight - 18, 
              size: 10 
            });
            page.drawText(`NHS: ${formattedNhs}  |  DOB: ${formattedDob}`, { 
              x: margin, 
              y: pageHeight - 32, 
              size: 10 
            });
            
            // Draw light grey line under header
            page.drawRectangle({
              x: margin,
              y: pageHeight - headerHeight,
              width: pageWidth - (margin * 2),
              height: 0.5,
              color: rgb(0.8, 0.8, 0.8),
            });

            // Calculate available space for image (between header and footer)
            const availableWidth = pageWidth - (margin * 2);
            const availableHeight = pageHeight - headerHeight - footerHeight - (margin * 0.5);
            
            // Scale image to fit available space
            let scale = 1;
            if (image.width > availableWidth || image.height > availableHeight) {
              const widthRatio = availableWidth / image.width;
              const heightRatio = availableHeight / image.height;
              scale = Math.min(widthRatio, heightRatio);
            }
            
            const width = Math.round(image.width * scale);
            const height = Math.round(image.height * scale);

            // Center the image horizontally, position below header
            const x = (pageWidth - width) / 2;
            const y = pageHeight - headerHeight - margin * 0.5 - height;
            
            page.drawImage(image, { x, y, width, height });
            
            // Add page number at bottom
            const pdfPageNum = i + 4; // Account for 3 front matter pages
            page.drawText(`Page ${pdfPageNum} of ${files.length + 3}`, { 
              x: margin, 
              y: 15, 
              size: 9 
            });

          } catch (err) {
            console.error(`Error processing image ${file.name}:`, err);
            const page = pdfDoc.addPage([595, 842]);
            page.drawText(`Page ${i + 4} - Processing error`, { x: 200, y: 400, size: 14 });
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
      pdfSizeMb = pdfBytes.length / (1024 * 1024);
      
      // Track original size on first attempt
      if (compressionAttempt === 0) {
        originalSizeMb = pdfSizeMb;
      }
      
      console.log(`PDF size: ${pdfSizeMb.toFixed(2)} MB (attempt ${compressionAttempt + 1})`);
      
      // Check if size is acceptable
      if (pdfBytes.length <= MAX_PDF_SIZE_BYTES) {
        finalPdfBytes = pdfBytes;
        break;
      }
      
      // Size exceeds limit, try again with more aggressive compression
      compressionAttempt++;
      console.log(`PDF exceeds ${MAX_PDF_SIZE_MB}MB limit, retrying with more aggressive compression...`);
    }

    // If still too large after all attempts, use best effort result
    if (!finalPdfBytes) {
      console.warn(`PDF still exceeds ${MAX_PDF_SIZE_MB}MB after ${compressionAttempt} attempts. Using best effort result.`);
      // Re-generate with max compression for final attempt
      compressionSettings = getCompressionSettings(pageCount, 2);
      const pdfDoc = await PDFDocument.create();
      
      // Simplified re-generation with max compression
      addClinicalSummaryPage(pdfDoc, patientName, nhsNumber, dob, pageCount, summaryJson, snomedJson);
      addMedicationsPage(pdfDoc, patientName, formattedNhs, formattedDob, summaryJson);
      addIndexPage(pdfDoc, files, patientName, formattedNhs, pageSummaries);
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const { data: imageData } = await supabase.storage
            .from('lg')
            .download(`${basePath}/raw/${file.name}`);
          if (imageData) {
            const arrayBuffer = await imageData.arrayBuffer();
            let uint8Array = new Uint8Array(arrayBuffer);
            uint8Array = await compressImage(uint8Array, compressionSettings);
            const image = await pdfDoc.embedJpg(uint8Array).catch(() => pdfDoc.embedPng(uint8Array));
            
            const page = pdfDoc.addPage([595, 842]);
            const headerHeight = 45;
            
            // Draw header band
            page.drawRectangle({
              x: 0,
              y: 842 - headerHeight,
              width: 595,
              height: headerHeight,
              color: rgb(1, 1, 1),
            });
            page.drawText(`Patient: ${sanitizeForPdf(patientName)}`, { x: 40, y: 842 - 18, size: 10 });
            page.drawText(`NHS: ${formattedNhs}  |  DOB: ${formattedDob}`, { x: 40, y: 842 - 32, size: 10 });
            
            const availableHeight = 842 - headerHeight - 60;
            const scale = Math.min((595 - 80) / image.width, availableHeight / image.height, 1);
            const width = Math.round(image.width * scale);
            const height = Math.round(image.height * scale);
            page.drawImage(image, { x: (595 - width) / 2, y: 842 - headerHeight - 20 - height, width, height });
            page.drawText(`Page ${i + 4} of ${files.length + 3}`, { x: 40, y: 15, size: 9 });
          }
        } catch {}
      }
      
      finalPdfBytes = await pdfDoc.save();
      pdfSizeMb = finalPdfBytes.length / (1024 * 1024);
    }

    // Upload PDF
    const pdfBlob = new Blob([finalPdfBytes], { type: 'application/pdf' });
    await supabase.storage.from('lg').upload(`${basePath}/final/lloyd-george.pdf`, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true,
    });

    // Determine if split is needed (size still exceeds limit)
    const needsSplit = finalPdfBytes.length > MAX_PDF_SIZE_BYTES;

    // Update patient record with PDF completion time and compression info
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
        // Compression tracking
        pdf_final_size_mb: parseFloat(pdfSizeMb.toFixed(2)),
        original_size_mb: parseFloat(originalSizeMb.toFixed(2)),
        compression_tier: compressionSettings.tier,
        compression_attempts: compressionAttempt + 1,
        pdf_split: needsSplit,
        pdf_parts: needsSplit ? Math.ceil(pdfSizeMb / MAX_PDF_SIZE_MB) : 1,
      })
      .eq('id', patientId);

    console.log(`PDF generation complete for patient ${patientId}: ${pdfSizeMb.toFixed(2)}MB, ${compressionSettings.tier}, ${compressionAttempt + 1} attempt(s), Scale: ${(compressionSettings.scaleFactor * 100).toFixed(0)}%`);

    // Send email with PDF attachment now that PDF is ready
    if (sendEmail && !patient.email_sent_at && finalPdfBytes) {
      console.log('Sending email with PDF attachment...');
      await sendSummaryEmailWithPdf(supabase, patient, patientName, nhsNumber, dob, summaryJson, snomedJson, finalPdfBytes);
    }

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

// PAGE 1: Clinical Summary (diagnoses, surgeries, allergies, immunisations - NO medications)
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
  drawLine(`Date of Birth: ${formatDateUK(dob)}`, 11);
  drawLine(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 10);
  drawLine(`Total Scanned Pages: ${pageCount}`, 10);
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

  // SNOMED sections (condensed for front page) - Problem codes only, NO medications
  const sectionLabels: Record<string, string> = {
    'diagnoses': 'DIAGNOSES',
    'surgeries': 'MAJOR SURGERIES',
    'allergies': 'ALLERGIES',
    'immunisations': 'IMMUNISATIONS',
  };
  const sections = ['diagnoses', 'surgeries', 'allergies', 'immunisations'];
  for (const key of sections) {
    const items = snomedJson?.[key] || [];
    if (items.length > 0) {
      drawLine(sectionLabels[key] || key.toUpperCase(), 11);
      for (const item of items.slice(0, 5)) { // Limit to 5 items per section
        drawLine(`- ${item.term || 'Unknown'} [${item.code || 'UNKNOWN'}]`, 9, 10);
      }
      if (items.length > 5) {
        drawLine(`... and ${items.length - 5} more`, 8, 10);
      }
      addSpace(0.3);
    }
  }
  
  // Add page number
  currentPage.drawText('Page 1', { x: leftMargin, y: 20, size: 9 });
}

// PAGE 2: Medications & Extra Detail
function addMedicationsPage(
  pdfDoc: any,
  patientName: string,
  nhsNumber: string,
  dob: string,
  summaryJson: any
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

  drawLine('MEDICATIONS & ADDITIONAL INFORMATION', 14);
  addSpace(0.5);

  // Patient info header
  drawLine(`Patient: ${patientName}  |  NHS: ${nhsNumber}  |  DOB: ${dob}`, 9);
  addSpace(1);

  // MEDICATIONS section
  const medications = summaryJson?.medications || [];
  if (medications.length > 0) {
    drawLine('CURRENT MEDICATIONS', 11);
    addSpace(0.3);
    for (const med of medications) {
      const medLine = `${med.drug || 'Unknown'}${med.dose ? ' - ' + med.dose : ''}${med.date ? ' (' + med.date + ')' : ''}`;
      drawLine(`- ${medLine}`, 9, 10);
    }
    addSpace(0.5);
  } else {
    drawLine('CURRENT MEDICATIONS', 11);
    addSpace(0.3);
    drawLine('No medications recorded', 9, 10);
    addSpace(0.5);
  }

  // RISK FACTORS
  const riskFactors = summaryJson?.risk_factors || [];
  if (riskFactors.length > 0) {
    drawLine('RISK FACTORS', 11);
    addSpace(0.3);
    for (const rf of riskFactors) {
      drawLine(`- ${rf.factor || 'Unknown'}${rf.details ? ': ' + rf.details : ''}`, 9, 10);
    }
    addSpace(0.5);
  }

  // SOCIAL HISTORY
  const social = summaryJson?.social_history;
  if (social && (social.smoking_status !== 'unknown' || social.alcohol !== 'unknown' || social.occupation)) {
    drawLine('SOCIAL HISTORY', 11);
    addSpace(0.3);
    if (social.smoking_status && social.smoking_status !== 'unknown') {
      const smokingText = social.smoking_status === 'ex' 
        ? `Ex-smoker${social.stopped_year ? ' (stopped ' + social.stopped_year + ')' : ''}`
        : social.smoking_status;
      drawLine(`- Smoking: ${smokingText}`, 9, 10);
    }
    if (social.alcohol && social.alcohol !== 'unknown') {
      drawLine(`- Alcohol: ${social.alcohol}`, 9, 10);
    }
    if (social.occupation) {
      drawLine(`- Occupation: ${social.occupation}`, 9, 10);
    }
    addSpace(0.5);
  }

  // FAMILY HISTORY
  const familyHistory = summaryJson?.family_history || [];
  if (familyHistory.length > 0) {
    drawLine('FAMILY HISTORY', 11);
    addSpace(0.3);
    for (const fh of familyHistory) {
      drawLine(`- ${fh.relation || 'Unknown'}: ${fh.condition || 'Unknown'}`, 9, 10);
    }
    addSpace(0.5);
  }

  // REPRODUCTIVE HISTORY
  const repro = summaryJson?.reproductive_history;
  if (repro && (repro.gravida > 0 || repro.notes)) {
    drawLine('REPRODUCTIVE HISTORY', 11);
    addSpace(0.3);
    if (repro.gravida > 0 || repro.para > 0) {
      drawLine(`- G${repro.gravida} P${repro.para}${repro.miscarriages > 0 ? ' + ' + repro.miscarriages + ' miscarriage(s)' : ''}`, 9, 10);
    }
    if (repro.notes) {
      drawLine(`- ${repro.notes}`, 9, 10);
    }
    addSpace(0.5);
  }

  // HOSPITAL FINDINGS
  const hospitalFindings = summaryJson?.hospital_findings || [];
  if (hospitalFindings.length > 0) {
    drawLine('SIGNIFICANT HOSPITAL FINDINGS', 11);
    addSpace(0.3);
    for (const hf of hospitalFindings) {
      drawLine(`- ${hf.condition || 'Unknown'} - ${formatDateUK(hf.date)}${hf.outcome ? ': ' + hf.outcome : ''}`, 9, 10);
    }
    addSpace(0.5);
  }

  // ALERTS
  const alerts = summaryJson?.alerts || [];
  if (alerts.length > 0) {
    drawLine('ALERTS', 11);
    addSpace(0.3);
    for (const alert of alerts) {
      drawLine(`! ${alert.type || 'Alert'}: ${alert.note || 'Unknown'}`, 9, 10);
    }
    addSpace(0.5);
  }

  // FREE TEXT FINDINGS
  if (summaryJson?.free_text_findings) {
    drawLine('ADDITIONAL FINDINGS', 11);
    addSpace(0.3);
    const words = summaryJson.free_text_findings.split(' ');
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
  }

  // Add page number
  currentPage.drawText('Page 2', { x: leftMargin, y: 20, size: 9 });
}

// PAGE 3: Index of Scanned Pages
function addIndexPage(pdfDoc: any, files: any[], patientName: string, nhsNumber: string, pageSummaries: string[]) {
  let currentPage = pdfDoc.addPage([595, 842]);
  let yPosition = 790;
  const leftMargin = 50;
  const lineHeight = 14;
  const pageMarginBottom = 60;

  // Title
  currentPage.drawText('INDEX OF SCANNED PAGES', { x: leftMargin, y: yPosition, size: 14 });
  yPosition -= lineHeight * 1.5;

  // Patient info line
  currentPage.drawText(`Patient: ${sanitizeForPdf(patientName)} | NHS: ${nhsNumber}`, { 
    x: leftMargin, y: yPosition, size: 10 
  });
  yPosition -= lineHeight * 1.5;

  // Table header
  currentPage.drawText('Page No.', { x: leftMargin, y: yPosition, size: 10 });
  currentPage.drawText('Description', { x: leftMargin + 70, y: yPosition, size: 10 });
  yPosition -= lineHeight * 0.5;
  
  // Divider line
  currentPage.drawText('--------', { x: leftMargin, y: yPosition, size: 10 });
  currentPage.drawText('-----------------------------------------------------------', { x: leftMargin + 70, y: yPosition, size: 10 });
  yPosition -= lineHeight;

  // Page entries - scanned pages now start at Page 4
  for (let i = 0; i < files.length; i++) {
    if (yPosition < pageMarginBottom) {
      currentPage = pdfDoc.addPage([595, 842]);
      yPosition = 790;
    }
    const pdfPageNum = i + 4; // Account for summary + medications + index pages (3 front matter pages)
    const summary = pageSummaries[i] || `Scanned page ${i + 1} of ${files.length}`;
    const truncatedSummary = sanitizeForPdf(summary).substring(0, 60);
    
    currentPage.drawText(`Page ${pdfPageNum}`, { x: leftMargin, y: yPosition, size: 9 });
    currentPage.drawText(truncatedSummary, { x: leftMargin + 70, y: yPosition, size: 9 });
    yPosition -= lineHeight;
  }

  // Footer note
  yPosition -= lineHeight;
  if (yPosition < pageMarginBottom) {
    currentPage = pdfDoc.addPage([595, 842]);
    yPosition = 790;
  }
  currentPage.drawText('Use PDF viewer bookmarks or page navigation to jump to specific pages.', {
    x: leftMargin, y: yPosition, size: 8
  });
  
  // Add page number
  currentPage.drawText('Page 3', { x: leftMargin, y: 20, size: 9 });
}

function formatNhsNumber(nhs: string): string {
  const digits = nhs.replace(/\D/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return nhs;
}

// Parse OCR text into per-page segments
function parseOcrByPage(ocrText: string): Map<number, string> {
  const pageMap = new Map<number, string>();
  if (!ocrText) return pageMap;

  // Match any filename pattern: page_001.jpg, image_001.jpg, 001.jpg, etc.
  // Capture the filename part before extension
  const pageRegex = /---\s*Page\s+([^\s]+)\.(jpg|jpeg|png)\s*---/gi;
  const parts = ocrText.split(pageRegex);
  
  console.log(`parseOcrByPage: OCR text length ${ocrText.length}, split into ${parts.length} parts`);
  
  // Parse alternating: [text before first marker, filename, ext, text, filename, ext, text, ...]
  for (let i = 1; i < parts.length; i += 3) {
    const filename = parts[i];
    const pageText = parts[i + 2] || '';
    
    // Extract page number from filename (e.g., "page_001" -> 1, "image_005" -> 5)
    const numMatch = filename.match(/(\d+)/);
    const pageNum = numMatch ? parseInt(numMatch[1], 10) : Math.floor(i / 3) + 1;
    
    if (pageNum > 0) {
      pageMap.set(pageNum, pageText.trim());
      console.log(`parseOcrByPage: Mapped page ${pageNum} from filename "${filename}" (${pageText.length} chars)`);
    }
  }
  
  console.log(`parseOcrByPage: Final pageMap has ${pageMap.size} entries`);
  return pageMap;
}

// Generate one-line summaries for each page using OpenAI with batching for large documents
const SUMMARY_BATCH_SIZE = 15; // Process 15 pages at a time for large documents

async function generatePageSummaries(ocrText: string, pageCount: number): Promise<string[]> {
  const summaries: string[] = new Array(pageCount).fill('');
  const pageMap = parseOcrByPage(ocrText);
  
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey || pageMap.size === 0) {
    // Fallback to generic summaries
    for (let i = 0; i < pageCount; i++) {
      summaries[i] = `Scanned page ${i + 1} of ${pageCount}`;
    }
    return summaries;
  }

  // Build page texts array
  const pageTexts: { pageNum: number; text: string }[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const text = pageMap.get(i) || '';
    pageTexts.push({ pageNum: i, text: text.substring(0, 400) }); // Limit text per page
  }

  // Process in batches for large documents
  const batches: { pageNum: number; text: string }[][] = [];
  for (let i = 0; i < pageTexts.length; i += SUMMARY_BATCH_SIZE) {
    batches.push(pageTexts.slice(i, i + SUMMARY_BATCH_SIZE));
  }

  console.log(`Generating page summaries in ${batches.length} batch(es) for ${pageCount} pages`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const startPage = batch[0].pageNum;
    const endPage = batch[batch.length - 1].pageNum;
    
    console.log(`Processing summary batch ${batchIndex + 1}/${batches.length}: pages ${startPage}-${endPage}`);

    try {
      const prompt = `You are summarizing pages from a Lloyd George medical record scan. 
For each page below, provide a brief one-line summary (max 60 characters) describing the main content.
If the page appears blank or has minimal text, say "Mostly blank page" or similar.
Focus on clinical relevance: document types (e.g., "GP referral letter", "Blood test results"), dates, or key findings.

${batch.map(p => `PAGE ${p.pageNum}:\n${p.text || '[No text detected]'}`).join('\n\n---\n\n')}

Respond with a JSON array of ${batch.length} strings, one summary per page in order. Example:
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
          max_tokens: 1500, // Enough for ~15 summaries
        }),
      });

      if (!response.ok) {
        console.error(`OpenAI API error for batch ${batchIndex + 1}: ${response.status}`);
        // Fill this batch with generic summaries
        for (let j = 0; j < batch.length; j++) {
          summaries[batch[j].pageNum - 1] = `Scanned page ${batch[j].pageNum} of ${pageCount}`;
        }
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      // Extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            for (let j = 0; j < Math.min(parsed.length, batch.length); j++) {
              const summary = String(parsed[j] || '').substring(0, 60);
              summaries[batch[j].pageNum - 1] = summary || `Scanned page ${batch[j].pageNum}`;
            }
            console.log(`Batch ${batchIndex + 1} completed: ${parsed.length} summaries`);
          }
        } catch (parseErr) {
          console.error(`JSON parse error for batch ${batchIndex + 1}:`, parseErr);
          // Fill with generic summaries
          for (let j = 0; j < batch.length; j++) {
            summaries[batch[j].pageNum - 1] = `Scanned page ${batch[j].pageNum} of ${pageCount}`;
          }
        }
      } else {
        console.warn(`No JSON array found in batch ${batchIndex + 1} response`);
        for (let j = 0; j < batch.length; j++) {
          summaries[batch[j].pageNum - 1] = `Scanned page ${batch[j].pageNum} of ${pageCount}`;
        }
      }
    } catch (err) {
      console.error(`Failed to generate summaries for batch ${batchIndex + 1}:`, err);
      // Fill this batch with generic summaries
      for (let j = 0; j < batch.length; j++) {
        summaries[batch[j].pageNum - 1] = `Scanned page ${batch[j].pageNum} of ${pageCount}`;
      }
    }

    // Small delay between batches to avoid rate limiting
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Fill any remaining empty summaries
  for (let i = 0; i < summaries.length; i++) {
    if (!summaries[i]) {
      summaries[i] = `Scanned page ${i + 1} of ${pageCount}`;
    }
  }

  console.log(`Page summaries complete: ${summaries.filter(s => !s.startsWith('Scanned page')).length}/${pageCount} AI-generated`);
  return summaries;
}

// Send email with PDF attachment and full clinical summary
async function sendSummaryEmailWithPdf(
  supabase: any,
  patient: any,
  patientName: string,
  nhsNumber: string,
  dob: string,
  summaryJson: any,
  snomedJson: any,
  pdfBytes: Uint8Array
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

    // Build email HTML with full clinical summary
    const emailHtml = buildFullSummaryEmailHtml(
      patientName,
      nhsNumber,
      dob,
      patient.practice_ods,
      patient.images_count || 0,
      summaryJson,
      snomedJson
    );

    // Convert PDF to base64 for attachment
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      const chunk = pdfBytes.subarray(i, Math.min(i + chunkSize, pdfBytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const pdfBase64 = btoa(binary);
    console.log(`PDF attachment ready, size: ${pdfBase64.length} chars`);

    // Fetch CSV file for attachment
    let csvBase64: string | null = null;
    const basePath = `${patient.practice_ods}/${patient.id}`;
    const csvPath = `${basePath}/final/snomed.csv`;
    console.log(`Attempting to fetch CSV from: ${csvPath}`);
    try {
      const { data: csvFile, error: csvError } = await supabase.storage
        .from('lg')
        .download(csvPath);
      if (csvError) {
        console.log(`CSV fetch error: ${csvError.message}`);
      } else if (csvFile) {
        const csvText = await csvFile.text();
        csvBase64 = btoa(csvText);
        console.log(`CSV attachment ready, size: ${csvBase64.length} chars`);
      } else {
        console.log('CSV file returned null without error');
      }
    } catch (csvErr) {
      console.log('Could not fetch CSV file:', csvErr);
    }

    // Build filename
    const formattedDob = formatDobForFilename(dob);
    const cleanNhs = (nhsNumber || '').replace(/\s/g, '');
    const pdfFilename = `LG_${cleanNhs}_${formattedDob}.pdf`;
    const csvFilename = `LG_${cleanNhs}_${formattedDob}_snomed_codes.csv`;

    // Build attachments array
    const attachments: Array<{ filename: string; content: string; type: string }> = [
      {
        filename: pdfFilename,
        content: pdfBase64,
        type: 'application/pdf',
      }
    ];
    
    if (csvBase64) {
      attachments.push({
        filename: csvFilename,
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
        attachments: attachments,
      },
    });

    if (emailError) {
      console.error('Email send error:', emailError);
    } else {
      await supabase
        .from('lg_patients')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', patient.id);
      console.log(`Email with PDF sent to ${userEmail}`);
    }
  } catch (err) {
    console.error('Email sending error:', err);
  }
}

function formatDobForFilename(dateStr: string): string {
  try {
    if (dateStr) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = String(date.getDate()).padStart(2, '0');
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        return `${day}_${month}_${year}`;
      }
    }
  } catch {}
  return dateStr || 'Unknown';
}

function formatDobDisplay(dateStr: string): string {
  return formatDateUK(dateStr);
}

// Universal date formatter for DD-MMM-YYYY format
function formatDateUK(dateStr: string | undefined | null): string {
  if (!dateStr || dateStr === 'Unknown' || dateStr === 'unknown') {
    return dateStr || 'Unknown';
  }
  
  // If already in correct format (DD-MMM-YYYY), return as-is
  if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  
  // If year only (e.g., "2018"), return as-is
  if (/^\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Try to parse various date formats
  try {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Handle YYYY-MM-DD format
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = months[parseInt(isoMatch[2], 10) - 1];
      const day = isoMatch[3];
      return `${day}-${month}-${year}`;
    }
    
    // Handle Pre YYYY format or similar
    if (dateStr.toLowerCase().startsWith('pre ')) {
      return dateStr;
    }
    
    // Try Date parsing as fallback
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }
  } catch {}
  
  // Return original if can't parse
  return dateStr;
}

function buildFullSummaryEmailHtml(
  patientName: string,
  nhsNumber: string,
  dob: string,
  practiceOds: string,
  imageCount: number,
  summaryJson: any,
  snomedJson: any
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
          <td style="padding: 12px; border: 1px solid #ddd;">${formatDobDisplay(dob)}</td>
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
  `;

  // Add Diagnoses section (formerly significant_past_history)
  if (summaryJson?.diagnoses?.length > 0) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Diagnoses</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
    for (const item of summaryJson.diagnoses) {
      html += `<li><strong>${item.condition || 'Unknown'}</strong> - ${formatDateUK(item.date_noted)} (${item.status || 'unknown'})</li>`;
    }
    html += `</ul>`;
  }

  // Add Major Surgeries section (formerly procedures)
  if (summaryJson?.surgeries?.length > 0) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Major Surgeries</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
    for (const surg of summaryJson.surgeries) {
      html += `<li><strong>${surg.procedure || 'Unknown'}</strong> - ${formatDateUK(surg.date)} ${surg.notes ? `(${surg.notes})` : ''}</li>`;
    }
    html += `</ul>`;
  }

  // Add Allergies section
  if (summaryJson?.allergies?.length > 0) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Allergies</h3><ul style="background: #fff5f5; padding: 15px 30px; border-radius: 5px; border-left: 4px solid #DA291C;">`;
    for (const allergy of summaryJson.allergies) {
      html += `<li><strong>${allergy.allergen || 'Unknown'}</strong>: ${allergy.reaction || 'Unknown reaction'} ${allergy.year ? `(${allergy.year})` : ''}</li>`;
    }
    html += `</ul>`;
  }

  // Add Immunisations section
  if (summaryJson?.immunisations?.length > 0) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Immunisations</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
    for (const imm of summaryJson.immunisations) {
      html += `<li><strong>${imm.vaccine || 'Unknown'}</strong> - ${formatDateUK(imm.date)}</li>`;
    }
    html += `</ul>`;
  }

  // Add Family History section
  if (summaryJson?.family_history?.length > 0) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Family History</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
    for (const fh of summaryJson.family_history) {
      html += `<li><strong>${fh.relation || 'Unknown'}</strong>: ${fh.condition || 'Unknown'}</li>`;
    }
    html += `</ul>`;
  }

  // Add Social History section
  if (summaryJson?.social_history && (summaryJson.social_history.smoking_status !== 'unknown' || summaryJson.social_history.alcohol !== 'unknown' || summaryJson.social_history.occupation)) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Social History</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
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

  // Add Reproductive History section (if relevant)
  if (summaryJson?.reproductive_history && (summaryJson.reproductive_history.gravida > 0 || summaryJson.reproductive_history.notes)) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Reproductive History</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
    if (summaryJson.reproductive_history.gravida > 0 || summaryJson.reproductive_history.para > 0) {
      html += `<li>G${summaryJson.reproductive_history.gravida} P${summaryJson.reproductive_history.para}${summaryJson.reproductive_history.miscarriages > 0 ? ` + ${summaryJson.reproductive_history.miscarriages} miscarriage(s)` : ''}</li>`;
    }
    if (summaryJson.reproductive_history.notes) {
      html += `<li>${summaryJson.reproductive_history.notes}</li>`;
    }
    html += `</ul>`;
  }

  // Add Hospital Findings section
  if (summaryJson?.hospital_findings?.length > 0) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Significant Hospital Findings</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
    for (const hf of summaryJson.hospital_findings) {
      html += `<li><strong>${hf.condition || 'Unknown'}</strong> - ${formatDateUK(hf.date)}${hf.outcome ? `: ${hf.outcome}` : ''}</li>`;
    }
    html += `</ul>`;
  }

  // Add Medications section
  if (summaryJson?.medications?.length > 0) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Medications</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
    for (const med of summaryJson.medications) {
      html += `<li><strong>${med.drug || 'Unknown'}</strong> ${med.dose || ''}${med.date ? ` - ${med.date}` : ''}</li>`;
    }
    html += `</ul>`;
  }

  // Add Alerts section
  if (summaryJson?.alerts?.length > 0) {
    html += `<h3 style="color: #DA291C; margin-top: 20px;">⚠️ Alerts</h3><ul style="background: #fff0f0; padding: 15px 30px; border-radius: 5px; border-left: 4px solid #DA291C;">`;
    for (const alert of summaryJson.alerts) {
      html += `<li><strong>${alert.type || 'Alert'}</strong>: ${alert.note || 'Unknown'}</li>`;
    }
    html += `</ul>`;
  }

  // Add Free Text Findings
  if (summaryJson?.free_text_findings) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Additional Findings</h3>`;
    html += `<p style="background: #f0f4f5; padding: 15px; border-radius: 5px;">${summaryJson.free_text_findings}</p>`;
  }

  // Add SNOMED Codes Table - Problem codes only
  html += `<h2 style="color: #005EB8; margin-top: 30px;">SNOMED CT Codes (Problem Codes)</h2>`;
  html += `<p style="color: #666; font-size: 12px; margin-bottom: 15px;">Codes suitable for import into GP systems (EMIS/SystmOne). Social history, family history, and medications are not coded.</p>`;
  html += `<div style="background: #fff8e6; border-left: 4px solid #FFB81C; padding: 12px; margin-bottom: 15px; font-size: 12px;">
    <strong style="color: #ED8B00;">⚠️ Important:</strong> Where 'NK' (Not Known) is shown for dates, check the scanned Lloyd George records before coding. <strong>Do NOT use today's date for historical diagnoses.</strong>
  </div>`;
  
  const snomedSectionLabels: Record<string, string> = {
    'diagnoses': 'Diagnoses',
    'surgeries': 'Major Surgeries',
    'allergies': 'Allergies',
    'immunisations': 'Immunisations',
  };
  const snomedSections = ['diagnoses', 'surgeries', 'allergies', 'immunisations'];
  for (const section of snomedSections) {
    const items = snomedJson?.[section] || [];
    if (items.length > 0) {
      html += `<h4 style="color: #003087; margin-top: 15px;">${snomedSectionLabels[section] || section}</h4>`;
      html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px;">`;
      html += `<tr style="background: #005EB8; color: white;"><th style="padding: 8px; text-align: left;">Term</th><th style="padding: 8px; text-align: left;">SNOMED Code</th><th style="padding: 8px; text-align: center;">Date</th><th style="padding: 8px; text-align: center;">Confidence</th></tr>`;
      for (const item of items) {
        const confPercent = Math.round((item.confidence || 0) * 100);
        const confColor = confPercent >= 80 ? '#007F3B' : '#DA291C';
        const dateDisplay = item.date && item.date.trim() ? item.date : '<span style="color: #999; font-style: italic;">NK</span>';
        html += `<tr style="border-bottom: 1px solid #ddd;">`;
        html += `<td style="padding: 8px;">${item.term || 'Unknown'}</td>`;
        html += `<td style="padding: 8px; font-family: monospace;">${item.code || 'UNKNOWN'}</td>`;
        html += `<td style="padding: 8px; text-align: center;">${dateDisplay}</td>`;
        html += `<td style="padding: 8px; text-align: center; color: ${confColor}; font-weight: bold;">${confPercent}%</td>`;
        html += `</tr>`;
      }
      html += `</table>`;
    }
  }

  html += `
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
      <p style="color: #666; font-size: 12px;">
        Generated by LG Capture - Notewell AI<br>
        Practice ODS: ${practiceOds || 'Unknown'}<br>
        ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  `;

  return html;
}
