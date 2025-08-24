import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface FormularyItem {
  drug_name: string;
  status: string;
  prior_approval_required: string;
  notes_restrictions: string;
  therapeutic_area: string;
  icb_region: string;
  source_document: string;
  source_page: string;
  last_reviewed_date: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log('ICB Formulary Seed Import - Request received:', req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { formulary_data } = await req.json();
    console.log('Processing formulary data:', formulary_data?.length, 'items');

    if (!formulary_data || !Array.isArray(formulary_data)) {
      throw new Error('Invalid formulary data format. Expected an array of formulary items.');
    }

    // Transform the data to match our database schema
    const transformedData = formulary_data.map((item: FormularyItem) => {
      // Convert prior_approval_required string to boolean
      const priorApprovalRequired = item.prior_approval_required.toLowerCase() === 'yes';
      
      // Parse the date
      let lastReviewedDate = null;
      if (item.last_reviewed_date) {
        lastReviewedDate = new Date(item.last_reviewed_date).toISOString().split('T')[0];
      }

      return {
        drug_name: item.drug_name,
        status: item.status,
        prior_approval_required: priorApprovalRequired,
        notes_restrictions: item.notes_restrictions,
        therapeutic_area: item.therapeutic_area,
        icb_region: item.icb_region,
        source_document: item.source_document,
        source_page: item.source_page || null,
        last_reviewed_date: lastReviewedDate,
      };
    });

    console.log('Transformed data sample:', transformedData[0]);

    // Insert or upsert the formulary data
    const { data, error } = await supabaseClient
      .from('icb_formulary')
      .upsert(transformedData, {
        onConflict: 'drug_name,icb_region',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log('Successfully imported', data?.length || 0, 'formulary items');

    // Also update the drug vocabulary for search functionality
    console.log('Updating drug vocabulary for search...');
    
    const vocabularyItems = transformedData.map(item => ({
      name: item.drug_name,
      tl_status: mapStatusToTrafficLight(item.status)
    }));

    // Insert into drug vocabulary (assuming there's a table for this)
    // This might need to be adjusted based on your existing vocabulary system
    try {
      const { error: vocabError } = await supabaseClient
        .from('icn_tl_norm')
        .upsert(
          vocabularyItems.map(item => ({
            drug_name: item.name,
            name_norm: item.name.toLowerCase().replace(/[^a-z0-9\s]/g, ''),
            status_enum: item.tl_status,
            last_modified: new Date().toISOString()
          })),
          { onConflict: 'drug_name' }
        );

      if (vocabError) {
        console.warn('Warning: Could not update vocabulary:', vocabError);
      }
    } catch (vocabErr) {
      console.warn('Warning: Vocabulary update failed:', vocabErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported_count: data?.length || 0,
        message: `Successfully imported ${data?.length || 0} ICB formulary items`,
        data: data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Import error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// Helper function to map formulary status to traffic light status
function mapStatusToTrafficLight(status: string): string {
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes('green')) {
    return 'GREEN';
  } else if (statusLower.includes('amber')) {
    if (statusLower.includes('2')) {
      return 'AMBER_2';
    } else {
      return 'AMBER_1';
    }
  } else if (statusLower.includes('red')) {
    return 'RED';
  } else if (statusLower.includes('formulary')) {
    return 'GREEN'; // Assume formulary items are generally green
  } else {
    return 'UNKNOWN';
  }
}