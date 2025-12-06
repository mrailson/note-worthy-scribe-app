import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { patientId } = await req.json();

    if (!patientId) {
      return new Response(JSON.stringify({ error: 'Missing patientId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Starting PDF compression for patient: ${patientId}`);

    // Get patient record
    const { data: patient, error: patientError } = await supabase
      .from('lg_patients')
      .select('*')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      return new Response(JSON.stringify({ error: 'Patient not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const basePath = `${patient.practice_ods}/${patient.id}`;
    const originalPdfPath = `${basePath}/final/lloyd-george.pdf`;

    // Download original PDF
    console.log(`Downloading original PDF from: ${originalPdfPath}`);
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from('lg')
      .download(originalPdfPath);

    if (downloadError || !pdfData) {
      console.error('Failed to download PDF:', downloadError);
      return new Response(JSON.stringify({ error: 'Failed to download original PDF' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const originalSize = pdfData.size;
    const originalSizeMb = originalSize / 1024 / 1024;
    console.log(`Original PDF size: ${originalSizeMb.toFixed(2)} MB`);

    // For now, pdf-lib in edge functions has memory limits that prevent
    // true image re-compression. The current PDF is already optimized
    // during generation with 35% scale and 55% JPEG quality.
    
    // Check if PDF is already small enough
    if (originalSizeMb <= 5) {
      console.log('PDF is already under 5MB - no compression needed');
      
      return new Response(JSON.stringify({
        success: true,
        originalSizeMb: originalSizeMb,
        compressedSizeMb: originalSizeMb,
        compressionRatio: 0,
        message: 'PDF is already under 5MB. Current compression during generation uses 35% scale and 55% JPEG quality which is optimal for edge function processing.',
        alreadyOptimized: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For PDFs over 5MB, we need to inform the user about limitations
    // True image re-compression requires external services or desktop tools
    console.log('PDF exceeds 5MB - edge function compression has memory limits');
    
    return new Response(JSON.stringify({
      success: false,
      originalSizeMb: originalSizeMb,
      error: 'compression_limit',
      message: `PDF is ${originalSizeMb.toFixed(2)}MB. Edge function memory limits prevent re-compression of large PDFs. For documents over 5MB, consider using desktop tools like Adobe Acrobat, or the PDF was auto-split during generation to ensure each part is under 5MB for SystmOne.`,
      suggestion: 'Check if split PDF parts exist - they are automatically generated under 5MB each for clinical system uploads.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Compression error:', error);
    return new Response(JSON.stringify({ 
      error: 'Compression failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
