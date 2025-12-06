/**
 * LG-GENERATE-PDF - Simplified Version
 * 
 * This edge function ONLY stitches pre-compressed JPEG images into a PDF.
 * All image compression is done client-side BEFORE upload.
 * 
 * NO jpeg-js, NO custom JPEG encoder, NO DCT/scaling/grayscale logic.
 * Just download JPEGs and embed them into pdf-lib.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const MAX_PDF_SIZE_MB = 5;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;
const PAGES_PER_PART = 50; // Split PDFs if they exceed this

interface PatientHeader {
  name: string;
  nhsNumber?: string;
  dob?: string;
}

interface GeneratePdfRequest {
  patientId: string;
  // Optional direct image paths (for new simplified flow)
  imagePaths?: string[];
  outputPath?: string;
  patientHeader?: PatientHeader;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('=== LG-GENERATE-PDF (Simplified) ===');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json() as GeneratePdfRequest;
    const { patientId, imagePaths: directImagePaths, outputPath: directOutputPath, patientHeader } = body;

    console.log('Patient ID:', patientId);

    // Fetch patient record if not using direct paths
    let practiceOds = '';
    let patientName = patientHeader?.name || '';
    let nhsNumber = patientHeader?.nhsNumber || '';
    let dob = patientHeader?.dob || '';
    let imagePaths: string[] = directImagePaths || [];
    let outputPath = directOutputPath || '';

    if (!directImagePaths || directImagePaths.length === 0) {
      // Fetch from database
      const { data: patient, error: patientError } = await supabase
        .from('lg_patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (patientError || !patient) {
        throw new Error(`Patient not found: ${patientError?.message || 'Unknown'}`);
      }

      practiceOds = patient.practice_ods;
      patientName = patient.ai_extracted_name || patient.patient_name || 'Unknown Patient';
      nhsNumber = patient.ai_extracted_nhs || patient.nhs_number || '';
      dob = patient.ai_extracted_dob || patient.dob || '';

      // Update status
      await supabase
        .from('lg_patients')
        .update({
          pdf_generation_status: 'generating',
          pdf_started_at: new Date().toISOString(),
        })
        .eq('id', patientId);

      // List raw images from storage
      const rawPath = `${practiceOds}/${patientId}/raw`;
      const { data: files, error: listError } = await supabase.storage
        .from('lg')
        .list(rawPath, { limit: 200, sortBy: { column: 'name', order: 'asc' } });

      if (listError) {
        throw new Error(`Failed to list images: ${listError.message}`);
      }

      imagePaths = (files || [])
        .filter(f => f.name.endsWith('.jpg') || f.name.endsWith('.jpeg'))
        .map(f => `${rawPath}/${f.name}`);

      outputPath = `${practiceOds}/${patientId}/final/lloyd-george.pdf`;
    }

    console.log(`Processing ${imagePaths.length} images`);

    if (imagePaths.length === 0) {
      throw new Error('No images found to process');
    }

    // Build header text for each page
    let headerText = '';
    if (patientName) {
      headerText = `Patient: ${patientName}`;
      if (nhsNumber) headerText += ` | NHS: ${nhsNumber}`;
      if (dob) headerText += ` | DOB: ${dob}`;
    }

    // Calculate if we need to split
    const needsSplit = imagePaths.length > PAGES_PER_PART;
    const parts = needsSplit 
      ? Math.ceil(imagePaths.length / PAGES_PER_PART)
      : 1;

    console.log(`Will generate ${parts} PDF part(s)`);

    const pdfPartUrls: string[] = [];
    let totalSizeBytes = 0;

    for (let partNum = 0; partNum < parts; partNum++) {
      const partStart = partNum * PAGES_PER_PART;
      const partEnd = Math.min(partStart + PAGES_PER_PART, imagePaths.length);
      const partImages = imagePaths.slice(partStart, partEnd);

      console.log(`Generating part ${partNum + 1}/${parts} (pages ${partStart + 1}-${partEnd})`);

      // Create PDF document
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      let successfulPages = 0;

      for (let i = 0; i < partImages.length; i++) {
        const imagePath = partImages[i];
        
        try {
          // Download the pre-compressed JPEG
          const { data: imageData, error: downloadError } = await supabase.storage
            .from('lg')
            .download(imagePath);

          if (downloadError || !imageData) {
            console.error(`Failed to download ${imagePath}:`, downloadError?.message);
            continue;
          }

          const imageBytes = new Uint8Array(await imageData.arrayBuffer());
          console.log(`Downloaded page ${partStart + i + 1}: ${(imageBytes.length / 1024).toFixed(1)} KB`);

          // Embed the JPEG directly (no re-encoding!)
          const jpgImage = await pdfDoc.embedJpg(imageBytes);
          const { width, height } = jpgImage;

          // Create page sized to the image
          const page = pdfDoc.addPage([width, height]);

          // Draw the image
          page.drawImage(jpgImage, {
            x: 0,
            y: 0,
            width,
            height,
          });

          // Add header text if provided
          if (headerText) {
            const fontSize = 10;
            const margin = 10;
            const textWidth = font.widthOfTextAtSize(headerText, fontSize);
            
            // Draw white background for header
            page.drawRectangle({
              x: 0,
              y: height - fontSize - margin * 2,
              width: textWidth + margin * 2,
              height: fontSize + margin * 2,
              color: rgb(1, 1, 1),
            });

            // Draw header text
            page.drawText(headerText, {
              x: margin,
              y: height - fontSize - margin,
              size: fontSize,
              font,
              color: rgb(0, 0, 0),
            });
          }

          successfulPages++;
        } catch (pageErr) {
          console.error(`Error processing page ${partStart + i + 1}:`, pageErr);
        }
      }

      console.log(`Part ${partNum + 1}: ${successfulPages}/${partImages.length} pages embedded`);

      // Save the PDF
      const pdfBytes = await pdfDoc.save();
      totalSizeBytes += pdfBytes.length;

      console.log(`Part ${partNum + 1} size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);

      // Determine output path for this part
      let partOutputPath = outputPath;
      if (parts > 1) {
        partOutputPath = outputPath.replace('.pdf', `_part${partNum + 1}of${parts}.pdf`);
      }

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('lg')
        .upload(partOutputPath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Failed to upload PDF part ${partNum + 1}: ${uploadError.message}`);
      }

      console.log(`Uploaded: ${partOutputPath}`);
      pdfPartUrls.push(partOutputPath);
    }

    // Update patient record if not using direct mode
    if (!directImagePaths) {
      const updateData: Record<string, unknown> = {
        pdf_generation_status: 'complete',
        pdf_completed_at: new Date().toISOString(),
        pdf_url: pdfPartUrls[0],
        pdf_final_size_mb: parseFloat((totalSizeBytes / 1024 / 1024).toFixed(2)),
        pdf_split: parts > 1,
        pdf_parts: parts,
        job_status: 'succeeded',
        processing_completed_at: new Date().toISOString(),
      };

      if (parts > 1) {
        updateData.pdf_part_urls = pdfPartUrls;
      }

      await supabase
        .from('lg_patients')
        .update(updateData)
        .eq('id', patientId);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`=== PDF Generation Complete in ${elapsed}s ===`);

    return new Response(JSON.stringify({
      success: true,
      outputPath: pdfPartUrls[0],
      pdfPartUrls,
      pageCount: imagePaths.length,
      parts,
      totalSizeMb: parseFloat((totalSizeBytes / 1024 / 1024).toFixed(2)),
      elapsedSeconds: parseFloat(elapsed),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('PDF Generation Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    // Try to update patient status
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
