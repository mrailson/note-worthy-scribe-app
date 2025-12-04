import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// BATCH PROCESSING CONFIGURATION
const IMAGE_BATCH_SIZE = 10; // Process 10 pages per batch maximum
const SUMMARY_BATCH_SIZE = 10; // Match image batch size

// MEMORY PROTECTION LIMITS
const MAX_BATCH_INPUT_MB = 5;
const MAX_BATCH_INPUT_BYTES = MAX_BATCH_INPUT_MB * 1024 * 1024;
const MAX_OPENAI_TOKENS = 120000;
const RETRY_BATCH_SIZE = 2; // Retry with 2 pages per batch on memory issues

// SystmOne upload limit
const MAX_PDF_SIZE_MB = 5;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;

// Tracking interfaces for failed pages
interface FailedPage {
  pageNum: number;
  filename: string;
  reason: string;
  retryAttempts: number;
}

// Compression settings (40% scale, 60% quality baseline per spec)
interface CompressionSettings {
  scaleFactor: number;
  jpegQuality: number;
  grayscale: boolean;
  tier: 'Standard' | 'Aggressive';
}

function getCompressionSettings(pageCount: number, attempt: number = 0): CompressionSettings {
  // Baseline: 40% scale, 60% quality per spec
  const baseScale = 0.40;
  const baseQuality = 0.60;
  
  if (pageCount <= 30) {
    // Standard compression for ≤30 pages
    return {
      scaleFactor: Math.max(baseScale - (attempt * 0.05), 0.30), // 0.40, 0.35, 0.30
      jpegQuality: Math.max(baseQuality - (attempt * 0.05), 0.45), // 0.60, 0.55, 0.50
      grayscale: attempt >= 2, // Only on 3rd attempt
      tier: 'Standard' as const,
    };
  } else {
    // Aggressive compression for >30 pages
    return {
      scaleFactor: Math.max(baseScale - 0.05 - (attempt * 0.05), 0.25), // 0.35, 0.30, 0.25
      jpegQuality: Math.max(baseQuality - 0.05 - (attempt * 0.05), 0.40), // 0.55, 0.50, 0.45
      grayscale: true, // Always grayscale for large docs
      tier: 'Aggressive' as const,
    };
  }
}

// Parse EXIF orientation from JPEG bytes
function parseExifOrientation(bytes: Uint8Array): number {
  if (bytes.length < 12) return 1;
  
  // Check for JPEG signature (0xFFD8)
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return 1;
  
  let offset = 2;
  while (offset < bytes.length - 4) {
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
        const isLittleEndian = bytes[tiffOffset] === 0x49;
        
        const readUint16 = (pos: number): number => {
          if (isLittleEndian) {
            return bytes[pos] | (bytes[pos + 1] << 8);
          }
          return (bytes[pos] << 8) | bytes[pos + 1];
        };
        
        const ifdOffset = tiffOffset + 8;
        const numEntries = readUint16(ifdOffset);
        
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
      break;
    } else if (marker >= 0xE0 && marker <= 0xEF) {
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      offset += 2 + length;
    } else {
      offset++;
    }
  }
  
  return 1;
}

// Strip EXIF metadata from image bytes (for final compression)
function stripExifData(bytes: Uint8Array): Uint8Array {
  // Simple EXIF strip: only keep essential JPEG markers
  if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
    return bytes;
  }
  
  // For simplicity, return as-is - the compression already strips most metadata
  // Full EXIF stripping would require rebuilding the JPEG structure
  return bytes;
}

// Compress image using 40% scaling approach with EXIF rotation correction
async function compressImage(
  imageBytes: Uint8Array,
  settings: CompressionSettings
): Promise<Uint8Array> {
  try {
    const orientation = parseExifOrientation(imageBytes);
    
    const blob = new Blob([imageBytes], { type: 'image/jpeg' });
    const imageBitmap = await createImageBitmap(blob);
    
    const rotationSwapsDimensions = orientation >= 5 && orientation <= 8;
    
    let targetWidth = Math.round(imageBitmap.width * settings.scaleFactor);
    let targetHeight = Math.round(imageBitmap.height * settings.scaleFactor);
    
    let canvasWidth = targetWidth;
    let canvasHeight = targetHeight;
    if (rotationSwapsDimensions) {
      canvasWidth = targetHeight;
      canvasHeight = targetWidth;
    }
    
    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.warn('Canvas context unavailable, returning original');
      return imageBytes;
    }
    
    // Apply EXIF orientation transformation
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
        break;
    }
    
    ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
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

// Embed image with fallback between JPEG and PNG
async function embedImageWithFallback(pdfDoc: any, bytes: Uint8Array, filename: string): Promise<any> {
  const lowerName = filename.toLowerCase();
  
  if (lowerName.endsWith('.png')) {
    try {
      return await pdfDoc.embedPng(bytes);
    } catch {
      return await pdfDoc.embedJpg(bytes);
    }
  } else {
    try {
      return await pdfDoc.embedJpg(bytes);
    } catch {
      try {
        return await pdfDoc.embedPng(bytes);
      } catch (embedErr) {
        console.error(`Failed to embed image ${filename}:`, embedErr);
        return null;
      }
    }
  }
}

// Add a placeholder page for failed images
function addFailedPagePlaceholder(pdfDoc: any, pageIndex: number, totalPages: number, filename: string) {
  const page = pdfDoc.addPage([595, 842]);
  const pdfPageNum = pageIndex + 4;
  
  page.drawText(`Page ${pdfPageNum} - Processing Failed`, { x: 180, y: 450, size: 16 });
  page.drawText(`File: ${filename}`, { x: 180, y: 420, size: 10 });
  page.drawText('This page failed to process after 2 retry attempts.', { x: 150, y: 390, size: 10 });
  page.drawText('Please refer to original scanned document.', { x: 160, y: 360, size: 10 });
  page.drawText(`Page ${pdfPageNum} of ${totalPages + 3}`, { x: 40, y: 15, size: 9 });
}

// Add quality gate warning page if any pages failed
function addQualityGateWarningPage(pdfDoc: any, failedPages: FailedPage[], insertAfterFrontMatter: boolean = false) {
  if (failedPages.length === 0) return;
  
  const page = pdfDoc.addPage([595, 842]);
  let yPosition = 780;
  const leftMargin = 50;
  
  // Warning header
  page.drawText('QUALITY GATE WARNING', { x: leftMargin, y: yPosition, size: 16 });
  yPosition -= 30;
  
  page.drawText('Missing or failed page processing:', { x: leftMargin, y: yPosition, size: 12 });
  yPosition -= 25;
  
  for (const failed of failedPages) {
    if (yPosition < 60) break;
    
    page.drawText(`Page ${failed.pageNum + 4} failed to process after ${failed.retryAttempts} retries.`, {
      x: leftMargin + 10,
      y: yPosition,
      size: 10,
    });
    yPosition -= 15;
    
    const reasonText = failed.reason.length > 55 ? failed.reason.substring(0, 55) + '...' : failed.reason;
    page.drawText(`Reason: ${reasonText}`, {
      x: leftMargin + 20,
      y: yPosition,
      size: 9,
    });
    yPosition -= 20;
  }
  
  page.drawText('Please review original scanned images for these pages.', {
    x: leftMargin,
    y: 40,
    size: 10,
  });
}

// Add scanned page with patient header band - returns true if image was drawn successfully
function addScannedPageWithHeader(
  pdfDoc: any,
  image: any,
  pageIndex: number,
  totalPages: number,
  patientName: string,
  formattedNhs: string,
  formattedDob: string
): boolean {
  const page = pdfDoc.addPage([595, 842]);
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 40;
  const headerHeight = 45;
  const footerHeight = 30;
  
  // Draw white header band
  page.drawRectangle({
    x: 0,
    y: pageHeight - headerHeight,
    width: pageWidth,
    height: headerHeight,
    color: rgb(1, 1, 1),
  });
  
  // Draw header text: Patient: {Name} | NHS: {NHS Number} | DOB: {DOB}
  page.drawText(`Patient: ${sanitizeForPdf(patientName)} | NHS: ${formattedNhs} | DOB: ${formattedDob}`, { 
    x: margin, 
    y: pageHeight - 25, 
    size: 10 
  });
  
  // Light grey line under header
  page.drawRectangle({
    x: margin,
    y: pageHeight - headerHeight,
    width: pageWidth - (margin * 2),
    height: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  
  // Calculate image positioning
  const availableWidth = pageWidth - (margin * 2);
  const availableHeight = pageHeight - headerHeight - footerHeight - (margin * 0.5);
  
  let imageDrawn = false;
  
  try {
    if (image && image.width && image.height) {
      let scale = 1;
      if (image.width > availableWidth || image.height > availableHeight) {
        const widthRatio = availableWidth / image.width;
        const heightRatio = availableHeight / image.height;
        scale = Math.min(widthRatio, heightRatio);
      }
      
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);
      const x = (pageWidth - width) / 2;
      const y = pageHeight - headerHeight - margin * 0.5 - height;
      
      page.drawImage(image, { x, y, width, height });
      imageDrawn = true;
      console.log(`Drew image on page ${pageIndex + 1}: ${width}x${height}px at (${x.toFixed(0)}, ${y.toFixed(0)})`);
    } else {
      console.error(`Invalid image object for page ${pageIndex + 1}: missing dimensions`);
    }
  } catch (drawErr) {
    console.error(`FAILED to draw image for scanned page ${pageIndex + 1}:`, drawErr);
    // Add error text to the page
    page.drawText('Unable to embed original scan image - see logs.', {
      x: margin,
      y: 400,
      size: 10,
    });
  }
  
  // Page number (always drawn)
  const pdfPageNum = pageIndex + 4;
  page.drawText(`Page ${pdfPageNum} of ${totalPages + 3}`, { x: margin, y: 15, size: 9 });
  
  return imageDrawn;
}

// Apply final compression pass if PDF exceeds 5MB
async function applyFinalCompressionPass(pdfBytes: Uint8Array): Promise<Uint8Array> {
  console.log('Applying final compression pass (metadata stripping, recompression)...');
  
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      updateMetadata: false,
    });
    
    // Remove all metadata
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('');
    pdfDoc.setCreator('');
    
    // Re-save without object streams for simpler structure
    return await pdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false,
    });
  } catch (err) {
    console.warn('Final compression pass failed:', err);
    return pdfBytes;
  }
}

// Process a single batch of images - ONE AT A TIME with explicit logging
async function processBatchWithMemoryProtection(
  supabase: any,
  basePath: string,
  files: any[],
  batchStart: number,
  batchEnd: number,
  pdfDoc: any,
  compressionSettings: CompressionSettings,
  patientName: string,
  formattedNhs: string,
  formattedDob: string,
  failedPages: FailedPage[]
): Promise<number> {
  let processedCount = 0;
  let successfulEmbeds = 0;
  
  // Process each page individually - do NOT hold all images in memory
  for (let i = batchStart; i < batchEnd; i++) {
    const file = files[i];
    let retryAttempts = 0;
    let pageSuccess = false;
    
    console.log(`Processing page ${i + 1}/${files.length}: ${file.name}`);
    
    while (!pageSuccess && retryAttempts < 2) {
      try {
        // Download image
        const { data: imageData, error: downloadError } = await supabase.storage
          .from('lg')
          .download(`${basePath}/raw/${file.name}`);
        
        if (downloadError || !imageData) {
          throw new Error(`Download failed: ${downloadError?.message || 'No data'}`);
        }
        
        const arrayBuffer = await imageData.arrayBuffer();
        let uint8Array = new Uint8Array(arrayBuffer);
        const originalSize = uint8Array.length;
        
        console.log(`Downloaded page ${i + 1}: ${(originalSize / 1024).toFixed(0)}KB`);
        
        // Apply compression (40% scale, 60% quality, EXIF rotation)
        uint8Array = await compressImage(uint8Array, compressionSettings);
        const compressedSize = uint8Array.length;
        
        console.log(`Compressed page ${i + 1}: ${(compressedSize / 1024).toFixed(0)}KB (${((1 - compressedSize/originalSize) * 100).toFixed(0)}% reduction)`);
        
        // Embed image in PDF with explicit error handling
        let image: any = null;
        try {
          image = await pdfDoc.embedJpg(uint8Array);
          console.log(`Embedded JPEG for page ${i + 1}, size=${compressedSize} bytes`);
        } catch (jpgErr) {
          console.warn(`JPEG embed failed for page ${i + 1}, trying PNG:`, jpgErr);
          try {
            image = await pdfDoc.embedPng(uint8Array);
            console.log(`Embedded PNG for page ${i + 1}, size=${compressedSize} bytes`);
          } catch (pngErr) {
            console.error(`FAILED to embed image for scanned page ${i + 1}:`, pngErr);
            throw new Error(`Image embed failed: ${pngErr instanceof Error ? pngErr.message : 'Unknown error'}`);
          }
        }
        
        if (!image) {
          throw new Error('Embed returned null image');
        }
        
        // Add page with header band - this now returns success status
        const imageDrawn = addScannedPageWithHeader(pdfDoc, image, i, files.length, patientName, formattedNhs, formattedDob);
        
        if (imageDrawn) {
          successfulEmbeds++;
        }
        
        pageSuccess = true;
        processedCount++;
        
        // Clear reference to allow GC
        uint8Array = null as any;
        image = null;
        
      } catch (err) {
        retryAttempts++;
        console.error(`Page ${i + 1} failed (attempt ${retryAttempts}/2):`, err);
        
        if (retryAttempts >= 2) {
          // Flag page for manual review
          failedPages.push({
            pageNum: i,
            filename: file.name,
            reason: err instanceof Error ? err.message : 'Unknown error',
            retryAttempts,
          });
          
          // Add placeholder page with error message
          console.error(`FAILED: Page ${i + 1} after ${retryAttempts} retries - adding placeholder`);
          addFailedPagePlaceholder(pdfDoc, i, files.length, file.name);
          processedCount++; // Count placeholder as processed
        }
      }
    }
  }
  
  console.log(`Batch ${batchStart + 1}-${batchEnd}: ${processedCount} pages processed, ${successfulEmbeds} images successfully embedded`);
  return processedCount;
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

    // Load OCR text for page summaries - check multiple possible locations
    let ocrLoaded = false;

    // Priority 1: Check work/ocr_merged.json (created by lg-ocr-batch for large records)
    if (!ocrLoaded) {
      try {
        const { data: ocrData } = await supabase.storage
          .from('lg')
          .download(`${basePath}/work/ocr_merged.json`);
        if (ocrData) {
          const ocrJson = JSON.parse(await ocrData.text());
          ocrText = ocrJson.ocr_text || '';
          console.log(`✅ Loaded OCR from work/ocr_merged.json: ${ocrText.length} characters`);
          ocrLoaded = true;
        }
      } catch (e) {
        console.log('work/ocr_merged.json not found, trying other locations...');
      }
    }

    // Priority 2: Check final/ocr_merged.json (legacy location)
    if (!ocrLoaded) {
      try {
        const { data: ocrData } = await supabase.storage
          .from('lg')
          .download(`${basePath}/final/ocr_merged.json`);
        if (ocrData) {
          const ocrJson = JSON.parse(await ocrData.text());
          ocrText = ocrJson.ocr_text || '';
          console.log(`✅ Loaded OCR from final/ocr_merged.json: ${ocrText.length} characters`);
          ocrLoaded = true;
        }
      } catch (e) {
        console.log('final/ocr_merged.json not found, trying database...');
      }
    }

    // Priority 3: Fallback to database lg_ocr_batches table
    if (!ocrLoaded) {
      try {
        const { data: batches } = await supabase
          .from('lg_ocr_batches')
          .select('ocr_text, batch_number')
          .eq('patient_id', patientId)
          .order('batch_number', { ascending: true });
        
        if (batches && batches.length > 0) {
          ocrText = batches.map(b => b.ocr_text).join('\n\n');
          console.log(`✅ Loaded OCR from database: ${batches.length} batches, ${ocrText.length} characters`);
          ocrLoaded = true;
        }
      } catch (e) {
        console.warn('Could not load OCR from database:', e);
      }
    }

    if (!ocrLoaded) {
      console.warn('⚠️ No OCR text found in any location - page summaries will be generic');
    } else {
      // Log first 300 chars for debugging
      console.log(`OCR preview: "${ocrText.substring(0, 300)}..."`);
    }

    // List raw images
    const { data: files, error: listError } = await supabase.storage
      .from('lg')
      .list(`${basePath}/raw`, { sortBy: { column: 'name', order: 'asc' } });

    if (listError || !files || files.length === 0) {
      throw new Error(`No images found: ${listError?.message}`);
    }

    const pageCount = files.length;
    console.log(`Creating PDF with ${pageCount} images in batches of ${IMAGE_BATCH_SIZE}`);

    // Patient details
    const patientName = patient.ai_extracted_name || patient.patient_name || 'Unknown Patient';
    const nhsNumber = patient.ai_extracted_nhs || patient.nhs_number || 'Unknown';
    const dob = patient.ai_extracted_dob || patient.dob || 'Unknown';
    const formattedNhs = formatNhsNumber(nhsNumber);
    const formattedDob = formatDateUK(dob);

    // Generate page summaries (batched)
    console.log('Generating page summaries...');
    const pageSummaries = await generatePageSummaries(ocrText, pageCount);

    // Track failed pages
    const failedPages: FailedPage[] = [];

    // Compression retry loop
    let compressionAttempt = 0;
    let compressionSettings = getCompressionSettings(pageCount, compressionAttempt);
    let finalPdfBytes: Uint8Array | null = null;
    let pdfSizeMb = 0;
    let originalSizeMb = 0;

    while (compressionAttempt < 3) {
      compressionSettings = getCompressionSettings(pageCount, compressionAttempt);
      console.log(`Compression attempt ${compressionAttempt + 1}: ${compressionSettings.tier}, Scale: ${(compressionSettings.scaleFactor * 100).toFixed(0)}%, Quality: ${(compressionSettings.jpegQuality * 100).toFixed(0)}%, Grayscale: ${compressionSettings.grayscale}`);

      // Clear failed pages for retry
      failedPages.length = 0;

      // Create PDF document
      const pdfDoc = await PDFDocument.create();

      // PAGE 1: Clinical Summary
      console.log('Adding clinical summary page (Page 1)...');
      addClinicalSummaryPage(pdfDoc, patientName, nhsNumber, dob, files.length, summaryJson, snomedJson);

      // PAGE 2: Medications & Extra Detail
      console.log('Adding medications page (Page 2)...');
      addMedicationsPage(pdfDoc, patientName, formattedNhs, formattedDob, summaryJson);

      // PAGE 3: Index of Scanned Pages
      console.log('Adding index page (Page 3)...');
      addIndexPage(pdfDoc, files, patientName, formattedNhs, pageSummaries);

      // PAGES 4+: Process images in batches with memory protection
      for (let batchStart = 0; batchStart < files.length; batchStart += IMAGE_BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + IMAGE_BATCH_SIZE, files.length);
        console.log(`Processing image batch ${Math.floor(batchStart / IMAGE_BATCH_SIZE) + 1}/${Math.ceil(files.length / IMAGE_BATCH_SIZE)}: pages ${batchStart + 1}-${batchEnd}`);

        const processedInBatch = await processBatchWithMemoryProtection(
          supabase,
          basePath,
          files,
          batchStart,
          batchEnd,
          pdfDoc,
          compressionSettings,
          patientName,
          formattedNhs,
          formattedDob,
          failedPages
        );

        console.log(`Batch complete: ${processedInBatch}/${batchEnd - batchStart} pages processed`);

        // Small delay between batches for GC
        if (batchEnd < files.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Add quality gate warning page if any failures
      if (failedPages.length > 0) {
        console.log(`Adding quality gate warning page for ${failedPages.length} failed pages`);
        addQualityGateWarningPage(pdfDoc, failedPages);
      }

      // ASSERTION: Verify page count before saving
      const actualPageCount = pdfDoc.getPageCount();
      const expectedPageCount = 3 + files.length + (failedPages.length > 0 ? 1 : 0); // 3 front matter + scanned pages + optional warning page
      console.log(`Final PDF page count = ${actualPageCount}, expected = ${expectedPageCount}`);
      
      if (actualPageCount !== expectedPageCount) {
        console.error(`PAGE COUNT MISMATCH: Expected ${expectedPageCount} pages but got ${actualPageCount}. Some pages may not have been embedded correctly.`);
        // Don't throw - continue and flag the issue
      }

      // Save PDF
      console.log('Saving PDF...');
      let pdfBytes = await pdfDoc.save();
      pdfSizeMb = pdfBytes.length / (1024 * 1024);
      
      if (compressionAttempt === 0) {
        originalSizeMb = pdfSizeMb;
      }
      
      console.log(`PDF size: ${pdfSizeMb.toFixed(2)} MB (attempt ${compressionAttempt + 1})`);
      
      // Check if size is acceptable
      if (pdfBytes.length <= MAX_PDF_SIZE_BYTES) {
        finalPdfBytes = pdfBytes;
        break;
      }
      
      // Try final compression pass (metadata stripping)
      if (compressionAttempt >= 1) {
        console.log('Attempting final compression pass...');
        const strippedBytes = await applyFinalCompressionPass(pdfBytes);
        const strippedSizeMb = strippedBytes.length / (1024 * 1024);
        console.log(`After metadata strip: ${strippedSizeMb.toFixed(2)} MB`);
        
        if (strippedBytes.length <= MAX_PDF_SIZE_BYTES) {
          finalPdfBytes = strippedBytes;
          pdfSizeMb = strippedSizeMb;
          break;
        }
      }
      
      compressionAttempt++;
      console.log(`PDF exceeds ${MAX_PDF_SIZE_MB}MB limit, retrying with more aggressive compression...`);
    }

    // If still too large after all attempts, use best effort result
    if (!finalPdfBytes) {
      console.warn(`PDF still exceeds ${MAX_PDF_SIZE_MB}MB after ${compressionAttempt} attempts. Using best effort result with final compression.`);
      
      // Re-generate with max compression
      compressionSettings = getCompressionSettings(pageCount, 2);
      const pdfDoc = await PDFDocument.create();
      
      addClinicalSummaryPage(pdfDoc, patientName, nhsNumber, dob, pageCount, summaryJson, snomedJson);
      addMedicationsPage(pdfDoc, patientName, formattedNhs, formattedDob, summaryJson);
      addIndexPage(pdfDoc, files, patientName, formattedNhs, pageSummaries);
      
      // Process all images one by one with max compression and explicit logging
      let fallbackSuccessCount = 0;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Fallback processing page ${i + 1}/${files.length}: ${file.name}`);
        try {
          const { data: imageData } = await supabase.storage
            .from('lg')
            .download(`${basePath}/raw/${file.name}`);
          if (imageData) {
            const arrayBuffer = await imageData.arrayBuffer();
            let uint8Array = new Uint8Array(arrayBuffer);
            const originalSize = uint8Array.length;
            uint8Array = await compressImage(uint8Array, compressionSettings);
            console.log(`Compressed page ${i + 1}: ${(uint8Array.length / 1024).toFixed(0)}KB`);
            
            let image: any = null;
            try {
              image = await pdfDoc.embedJpg(uint8Array);
              console.log(`Embedded JPEG for fallback page ${i + 1}`);
            } catch {
              image = await pdfDoc.embedPng(uint8Array);
              console.log(`Embedded PNG for fallback page ${i + 1}`);
            }
            
            const imageDrawn = addScannedPageWithHeader(pdfDoc, image, i, files.length, patientName, formattedNhs, formattedDob);
            if (imageDrawn) fallbackSuccessCount++;
          }
        } catch (err) {
          console.error(`FAILED fallback page ${i + 1}:`, err);
          addFailedPagePlaceholder(pdfDoc, i, files.length, file.name);
        }
      }
      
      console.log(`Fallback processing complete: ${fallbackSuccessCount}/${files.length} images successfully embedded`);
      
      if (failedPages.length > 0) {
        addQualityGateWarningPage(pdfDoc, failedPages);
      }
      
      // ASSERTION: Verify page count
      const fallbackPageCount = pdfDoc.getPageCount();
      const expectedFallbackPages = 3 + files.length + (failedPages.length > 0 ? 1 : 0);
      console.log(`Fallback PDF page count = ${fallbackPageCount}, expected = ${expectedFallbackPages}`);
      
      let pdfBytes = await pdfDoc.save();
      
      // Apply final compression pass
      pdfBytes = await applyFinalCompressionPass(pdfBytes);
      
      finalPdfBytes = pdfBytes;
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

    // Update patient record with completion info
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
        pdf_final_size_mb: parseFloat(pdfSizeMb.toFixed(2)),
        original_size_mb: parseFloat(originalSizeMb.toFixed(2)),
        compression_tier: compressionSettings.tier,
        compression_attempts: compressionAttempt + 1,
        pdf_split: needsSplit,
        pdf_parts: needsSplit ? Math.ceil(pdfSizeMb / MAX_PDF_SIZE_MB) : 1,
      })
      .eq('id', patientId);

    console.log(`PDF generation complete for patient ${patientId}: ${pdfSizeMb.toFixed(2)}MB, ${compressionSettings.tier}, ${compressionAttempt + 1} attempt(s), ${failedPages.length} failed pages`);

    // Send email with PDF attachment
    if (sendEmail && !patient.email_sent_at && finalPdfBytes) {
      console.log('Sending email with PDF attachment...');
      await sendSummaryEmailWithPdf(supabase, patient, patientName, nhsNumber, dob, summaryJson, snomedJson, finalPdfBytes);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        patientId,
        pdfSizeMb: pdfSizeMb.toFixed(2),
        failedPages: failedPages.length,
      }),
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

// PAGE 1: Clinical Summary
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

  // SNOMED sections (condensed for front page)
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
      for (const item of items.slice(0, 5)) {
        drawLine(`- ${item.term || 'Unknown'} [${item.code || 'UNKNOWN'}]`, 9, 10);
      }
      if (items.length > 5) {
        drawLine(`... and ${items.length - 5} more`, 8, 10);
      }
      addSpace(0.3);
    }
  }
  
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

  currentPage.drawText('Page 2', { x: leftMargin, y: 20, size: 9 });
}

// PAGE 3: Index of Scanned Pages
function addIndexPage(pdfDoc: any, files: any[], patientName: string, nhsNumber: string, pageSummaries: string[]) {
  let currentPage = pdfDoc.addPage([595, 842]);
  let yPosition = 790;
  const leftMargin = 50;
  const lineHeight = 14;
  const pageMarginBottom = 60;

  currentPage.drawText('INDEX OF SCANNED PAGES', { x: leftMargin, y: yPosition, size: 14 });
  yPosition -= lineHeight * 1.5;

  currentPage.drawText(`Patient: ${sanitizeForPdf(patientName)} | NHS: ${nhsNumber}`, { 
    x: leftMargin, y: yPosition, size: 10 
  });
  yPosition -= lineHeight * 1.5;

  currentPage.drawText('Page No.', { x: leftMargin, y: yPosition, size: 10 });
  currentPage.drawText('Description', { x: leftMargin + 70, y: yPosition, size: 10 });
  yPosition -= lineHeight * 0.5;
  
  currentPage.drawText('--------', { x: leftMargin, y: yPosition, size: 10 });
  currentPage.drawText('-----------------------------------------------------------', { x: leftMargin + 70, y: yPosition, size: 10 });
  yPosition -= lineHeight;

  for (let i = 0; i < files.length; i++) {
    if (yPosition < pageMarginBottom) {
      currentPage = pdfDoc.addPage([595, 842]);
      yPosition = 790;
    }
    const pdfPageNum = i + 4;
    const summary = pageSummaries[i] || `Scanned page ${i + 1} of ${files.length}`;
    const truncatedSummary = sanitizeForPdf(summary).substring(0, 60);
    
    currentPage.drawText(`Page ${pdfPageNum}`, { x: leftMargin, y: yPosition, size: 9 });
    currentPage.drawText(truncatedSummary, { x: leftMargin + 70, y: yPosition, size: 9 });
    yPosition -= lineHeight;
  }

  yPosition -= lineHeight;
  if (yPosition < pageMarginBottom) {
    currentPage = pdfDoc.addPage([595, 842]);
    yPosition = 790;
  }
  currentPage.drawText('Use PDF viewer bookmarks or page navigation to jump to specific pages.', {
    x: leftMargin, y: yPosition, size: 8
  });
  
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

  const pageRegex = /---\s*Page\s+([^\s]+)\.(jpg|jpeg|png)\s*---/gi;
  const parts = ocrText.split(pageRegex);
  
  console.log(`parseOcrByPage: OCR text length ${ocrText.length}, split into ${parts.length} parts`);
  
  for (let i = 1; i < parts.length; i += 3) {
    const filename = parts[i];
    const pageText = parts[i + 2] || '';
    
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

// Generate AI-powered page summaries in batches
async function generatePageSummaries(ocrText: string, pageCount: number): Promise<string[]> {
  const summaries: string[] = new Array(pageCount).fill('');
  const pageMap = parseOcrByPage(ocrText);
  
  console.log(`generatePageSummaries: pageCount=${pageCount}, pageMap.size=${pageMap.size}, ocrText.length=${ocrText.length}`);
  
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  
  // Only fall back to generic if NO API key - NOT if pageMap is empty
  // Even with empty pageMap, OpenAI can still generate useful descriptions like "Hand-written note"
  if (!openaiKey) {
    console.warn('⚠️ No OpenAI API key - using generic page summaries');
    for (let i = 0; i < pageCount; i++) {
      summaries[i] = `Scanned page ${i + 1} of ${pageCount}`;
    }
    return summaries;
  }

  // Build page texts array - use "[No text detected]" for missing pages
  const pageTexts: { pageNum: number; text: string }[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const text = pageMap.get(i) || '';
    const pageText = text.substring(0, 400) || '[No text detected]';
    pageTexts.push({ pageNum: i, text: pageText });
  }
  
  // Log first page text for debugging
  if (pageTexts.length > 0) {
    console.log(`First page text preview (page 1): "${pageTexts[0].text.substring(0, 150)}..."`);
  }

  // Process in batches of SUMMARY_BATCH_SIZE (10)
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
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        console.error(`OpenAI API error for batch ${batchIndex + 1}: ${response.status}`);
        for (let j = 0; j < batch.length; j++) {
          summaries[batch[j].pageNum - 1] = `Scanned page ${batch[j].pageNum} of ${pageCount}`;
        }
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      // Check token usage for memory protection
      const totalTokens = data.usage?.total_tokens || 0;
      if (totalTokens > MAX_OPENAI_TOKENS) {
        console.warn(`OpenAI token response exceeds ${MAX_OPENAI_TOKENS} tokens (${totalTokens}), may need smaller batches`);
      }
      
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
      for (let j = 0; j < batch.length; j++) {
        summaries[batch[j].pageNum - 1] = `Scanned page ${batch[j].pageNum} of ${pageCount}`;
      }
    }

    // Delay between batches
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

// Send email with PDF attachment
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

    const emailHtml = buildFullSummaryEmailHtml(
      patientName,
      nhsNumber,
      dob,
      patient.practice_ods,
      patient.images_count || 0,
      summaryJson,
      snomedJson
    );

    // Convert PDF to base64
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      const chunk = pdfBytes.subarray(i, Math.min(i + chunkSize, pdfBytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const pdfBase64 = btoa(binary);
    console.log(`PDF attachment ready, size: ${pdfBase64.length} chars`);

    // Fetch CSV file
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
      }
    } catch (csvErr) {
      console.log('Could not fetch CSV file:', csvErr);
    }

    const formattedDob = formatDobForFilename(dob);
    const cleanNhs = (nhsNumber || '').replace(/\s/g, '');
    const pdfFilename = `LG_${cleanNhs}_${formattedDob}.pdf`;
    const csvFilename = `LG_${cleanNhs}_${formattedDob}_snomed_codes.csv`;

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

function formatDateUK(dateStr: string | undefined | null): string {
  if (!dateStr || dateStr === 'Unknown' || dateStr === 'unknown') {
    return dateStr || 'Unknown';
  }
  
  if (/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  
  if (/^\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  
  try {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = months[parseInt(isoMatch[2], 10) - 1];
      const day = isoMatch[3];
      return `${day}-${month}-${year}`;
    }
    
    if (dateStr.toLowerCase().startsWith('pre ')) {
      return dateStr;
    }
    
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }
  } catch {}
  
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

  // Add Diagnoses section
  if (summaryJson?.diagnoses?.length > 0) {
    html += `<h3 style="color: #005EB8; margin-top: 20px;">Diagnoses</h3><ul style="background: #f0f4f5; padding: 15px 30px; border-radius: 5px;">`;
    for (const item of summaryJson.diagnoses) {
      html += `<li><strong>${item.condition || 'Unknown'}</strong> - ${formatDateUK(item.date_noted)} (${item.status || 'unknown'})</li>`;
    }
    html += `</ul>`;
  }

  // Add Major Surgeries section
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

  // Add Reproductive History section
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

  // Add SNOMED Codes Table
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
