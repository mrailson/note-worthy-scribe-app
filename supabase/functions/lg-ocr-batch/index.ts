import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 10; // Process 10 images per batch

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const googleVisionKey = Deno.env.get('GOOGLE_VISION_API_KEY');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { patientId, batchNumber } = await req.json();
    
    if (!patientId || batchNumber === undefined) {
      throw new Error('Missing patientId or batchNumber');
    }

    console.log(`OCR Batch ${batchNumber} for patient: ${patientId}`);

    // Record OCR start time on first batch
    if (batchNumber === 0) {
      await supabase
        .from('lg_patients')
        .update({ ocr_started_at: new Date().toISOString() })
        .eq('id', patientId);
    }

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

    // List all raw images
    const { data: files, error: listError } = await supabase.storage
      .from('lg')
      .list(`${basePath}/raw`, { sortBy: { column: 'name', order: 'asc' } });

    if (listError || !files) {
      throw new Error(`Failed to list images: ${listError?.message}`);
    }

    // Calculate batch range
    const startIdx = batchNumber * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE, files.length);
    const batchFiles = files.slice(startIdx, endIdx);

    console.log(`Processing images ${startIdx + 1} to ${endIdx} of ${files.length}`);

    // OCR each image in this batch
    const ocrResults: string[] = [];

    for (let i = 0; i < batchFiles.length; i++) {
      const file = batchFiles[i];
      const globalIdx = startIdx + i;
      
      console.log(`OCR image ${globalIdx + 1}/${files.length}: ${file.name}`);

      const { data: imageData, error: downloadError } = await supabase.storage
        .from('lg')
        .download(`${basePath}/raw/${file.name}`);

      if (downloadError || !imageData) {
        console.error(`Failed to download ${file.name}:`, downloadError);
        ocrResults.push(`--- Page ${file.name} ---\n[Download failed]`);
        continue;
      }

      // Convert to base64 (chunked)
      const arrayBuffer = await imageData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let base64 = '';
      const chunkSize = 8192;
      for (let j = 0; j < uint8Array.length; j += chunkSize) {
        const chunk = uint8Array.subarray(j, Math.min(j + chunkSize, uint8Array.length));
        base64 += String.fromCharCode.apply(null, Array.from(chunk));
      }
      base64 = btoa(base64);

      // OCR with Google Vision
      if (googleVisionKey) {
        try {
          const ocrText = await performOCR(base64, googleVisionKey);
          ocrResults.push(`--- Page ${file.name} ---\n${ocrText || '[No text detected]'}`);
        } catch (ocrErr) {
          console.error(`OCR failed for ${file.name}:`, ocrErr);
          ocrResults.push(`--- Page ${file.name} ---\n[OCR failed]`);
        }
      } else {
        ocrResults.push(`--- Page ${file.name} ---\n[No OCR key configured]`);
      }
    }

    const batchOcrText = ocrResults.join('\n\n');

    // Save batch OCR text to DATABASE instead of storage
    console.log(`Saving batch ${batchNumber} OCR text (${batchOcrText.length} chars) to database...`);
    
    const { error: upsertError } = await supabase
      .from('lg_ocr_batches')
      .upsert({
        patient_id: patientId,
        batch_number: batchNumber,
        ocr_text: batchOcrText,
        pages_processed: batchFiles.length,
      }, { onConflict: 'patient_id,batch_number' });
    
    if (upsertError) {
      console.error('Failed to save OCR batch to database:', upsertError);
      throw new Error(`Failed to save OCR batch ${batchNumber}: ${JSON.stringify(upsertError)}`);
    }
    
    console.log(`Batch ${batchNumber} OCR saved to database successfully`);

    // Update patient record
    const totalBatches = Math.ceil(files.length / BATCH_SIZE);
    const completedBatches = batchNumber + 1;
    const isLastBatch = completedBatches >= totalBatches;

    await supabase
      .from('lg_patients')
      .update({
        ocr_batches_completed: completedBatches,
        processing_phase: isLastBatch ? 'summary' : 'ocr',
        ...(isLastBatch ? { ocr_completed_at: new Date().toISOString() } : {}),
      })
      .eq('id', patientId);

    console.log(`Batch ${batchNumber} complete. ${completedBatches}/${totalBatches} batches done.`);

    // If this is the last batch, merge all OCR texts from database and trigger summary phase
    if (isLastBatch) {
      console.log('Last batch complete. Merging OCR texts from database...');
      
      // Merge all OCR batch texts from database
      const { data: batches, error: fetchBatchesError } = await supabase
        .from('lg_ocr_batches')
        .select('batch_number, ocr_text')
        .eq('patient_id', patientId)
        .order('batch_number', { ascending: true });

      if (fetchBatchesError || !batches || batches.length === 0) {
        throw new Error(`Failed to fetch OCR batches from database: ${fetchBatchesError?.message}`);
      }

      const mergedOcrText = batches.map(b => b.ocr_text).join('\n\n');
      console.log(`Merged ${batches.length} batches. Total: ${mergedOcrText.length} characters`);
      
      // Save merged OCR text as JSON (which IS allowed by storage)
      const mergedPath = `${basePath}/work/ocr_merged.json`;
      const mergedJson = JSON.stringify({ ocr_text: mergedOcrText });
      
      console.log(`Uploading merged OCR JSON (${mergedJson.length} chars) to ${mergedPath}...`);
      
      const { error: uploadError } = await supabase.storage.from('lg').upload(mergedPath, 
        new Blob([mergedJson], { type: 'application/json' }), {
        contentType: 'application/json',
        upsert: true,
      });

      if (uploadError) {
        console.error('Failed to upload merged OCR JSON:', uploadError);
        // Don't throw - summary can still read from database
        console.log('Will proceed - summary can read from database as fallback');
      } else {
        console.log('Merged OCR JSON file uploaded successfully');
      }

      // Update patient with OCR URL
      await supabase
        .from('lg_patients')
        .update({
          ocr_text_url: `lg/${mergedPath}`,
        })
        .eq('id', patientId);

      // Trigger summary processing
      console.log('Triggering summary processing...');
      const { data: summaryData, error: summaryError } = await supabase.functions.invoke('lg-process-summary', {
        body: { patientId },
      });

      if (summaryError) {
        console.error('Failed to invoke lg-process-summary:', summaryError);
        // Update patient to indicate summary invoke failed - user can retry
        await supabase
          .from('lg_patients')
          .update({
            error_message: `Summary processing failed to start: ${summaryError.message}. Click "Retry Summary Generation" to try again.`,
          })
          .eq('id', patientId);
      } else {
        console.log('lg-process-summary invoked successfully:', summaryData);
      }
    } else {
      // Trigger next batch
      console.log(`Triggering next batch: ${completedBatches}`);
      await supabase.functions.invoke('lg-ocr-batch', {
        body: { patientId, batchNumber: completedBatches },
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        batchNumber, 
        completedBatches,
        totalBatches,
        isLastBatch,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('OCR Batch error:', error);
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'OCR batch failed' }),
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
