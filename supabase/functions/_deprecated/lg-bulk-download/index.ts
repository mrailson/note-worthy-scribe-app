import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to convert Uint8Array to base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { patientIds } = await req.json();
    
    if (!patientIds || !Array.isArray(patientIds) || patientIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No patient IDs provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Creating bulk download for ${patientIds.length} patients`);

    // Fetch patient records
    const { data: patients, error: fetchError } = await supabase
      .from('lg_patients')
      .select('*')
      .in('id', patientIds)
      .eq('user_id', user.id);

    if (fetchError) {
      console.error('Error fetching patients:', fetchError);
      throw fetchError;
    }

    if (!patients || patients.length === 0) {
      return new Response(JSON.stringify({ error: 'No patients found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create ZIP file
    const zip = new JSZip();
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '_');

    for (const patient of patients) {
      const nhsClean = patient.nhs_number?.replace(/\s/g, '') || 'unknown';
      const dobFormatted = patient.dob 
        ? new Date(patient.dob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '_')
        : 'unknown_dob';
      
      const folderName = `${nhsClean}_${dobFormatted}`;
      const folder = zip.folder(folderName);

      if (!folder) continue;

      // Download PDF(s)
      if (patient.pdf_split && patient.pdf_part_urls && Array.isArray(patient.pdf_part_urls)) {
        // Multiple PDF parts
        for (let i = 0; i < patient.pdf_part_urls.length; i++) {
          const pdfPath = patient.pdf_part_urls[i];
          try {
            const { data: pdfData, error: pdfError } = await supabase.storage
              .from('lg')
              .download(pdfPath);
            
            if (!pdfError && pdfData) {
              const arrayBuffer = await pdfData.arrayBuffer();
              folder.file(`Lloyd_George_Part_${i + 1}.pdf`, arrayBuffer);
              console.log(`Added PDF part ${i + 1} for ${nhsClean}`);
            }
          } catch (err) {
            console.error(`Error downloading PDF part ${i + 1} for ${nhsClean}:`, err);
          }
        }
      } else if (patient.pdf_url) {
        // Single PDF
        try {
          const { data: pdfData, error: pdfError } = await supabase.storage
            .from('lg')
            .download(patient.pdf_url);
          
          if (!pdfError && pdfData) {
            const arrayBuffer = await pdfData.arrayBuffer();
            folder.file('Lloyd_George.pdf', arrayBuffer);
            console.log(`Added PDF for ${nhsClean}`);
          }
        } catch (err) {
          console.error(`Error downloading PDF for ${nhsClean}:`, err);
        }
      }

      // Only PDFs are included in bulk download - CSV/JSON available from Results page
    }

    // Generate ZIP as base64
    const zipContent = await zip.generateAsync({ type: 'uint8array' });
    const zipBase64 = uint8ArrayToBase64(zipContent);
    const zipFileName = `LG_Export_${dateStr}.zip`;

    console.log(`ZIP created: ${zipFileName}, size: ${zipContent.length} bytes`);

    // Update downloaded_at for all patients
    const now = new Date().toISOString();
    await supabase
      .from('lg_patients')
      .update({ 
        downloaded_at: now,
        publish_status: 'downloaded'
      })
      .in('id', patientIds)
      .eq('user_id', user.id);

    console.log(`Bulk download created successfully: ${zipFileName}`);

    // Return ZIP as base64 data
    return new Response(JSON.stringify({ 
      success: true,
      zipData: zipBase64,
      fileName: zipFileName,
      patientCount: patients.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Bulk download error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to create bulk download' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
