import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DrugLookupResponse {
  drug: string;
  traffic_light: {
    status: string;
    detail_url?: string;
    bnf_chapter?: string;
    notes?: string;
    status_tooltip?: string;
  } | null;
  prior_approval: {
    required: boolean;
    pdf_url?: string;
    page_ref?: string;
    criteria: Array<{
      id: string;
      criteria_text: string;
      category?: string;
      application_route?: string;
      application_url?: string;
      evidence_required?: string;
      icb_version?: string;
      icb_pdf_url?: string;
    }>;
  };
  formulary: Array<{
    name: string;
    status: string;
    therapeutic_area?: string;
    source_document?: string;
    source_page?: string;
    last_reviewed?: string;
    detail_url?: string;
    bnf_chapter?: string;
  }>;
  alternatives: Array<{
    name: string;
    status: string;
    therapeutic_area?: string;
  }>;
}

// Traffic Light Status Tooltips (Northamptonshire definitions)
const STATUS_TOOLTIPS = {
  'DOUBLE_RED': 'Not routinely prescribed in primary care. Requires prior approval/IFR as specified by ICN.',
  'RED': 'Specialist initiation/supply only; usually not in primary care.',
  'AMBER_1': 'Shared care or specialist recommendation—check local guidance.',
  'AMBER_2': 'Shared care or specialist recommendation—check local guidance.',
  'SPECIALIST_INITIATED': 'Specialist initiation required.',
  'SPECIALIST_RECOMMENDED': 'Specialist recommendation advised.',
  'GREEN': 'Suitable for primary care prescribing within formulary.',
  'UNKNOWN': 'Status not classified. Check ICB guidance.'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name } = await req.json();
    
    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Drug name parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Looking up drug:', name);

    // Step 1: Normalize the name
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    console.log('Normalized name:', normalizedName);

    // Step 2: Fetch traffic light data
    console.log('Fetching traffic light data...');
    const { data: trafficLightData, error: tlError } = await supabase
      .from('icn_tl_norm')
      .select('*')
      .eq('name_norm', normalizedName)
      .maybeSingle();

    if (tlError && tlError.code !== 'PGRST116') {
      console.error('Traffic light query error:', tlError);
    }

    // Step 3: Fetch ICB formulary data
    console.log('Fetching ICB formulary data...');
    const { data: formularyData, error: formularyError } = await supabase
      .from('icb_formulary')
      .select('*')
      .eq('name_norm', normalizedName);

    if (formularyError && formularyError.code !== 'PGRST116') {
      console.error('Formulary query error:', formularyError);
    }

    // If no match by name_norm, try drug_name
    let formularyFallback = null;
    if (!formularyData || formularyData.length === 0) {
      console.log('Trying drug_name formulary search...');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('icb_formulary')
        .select('*')
        .ilike('drug_name', `%${name}%`);
      
      if (!fallbackError) {
        formularyFallback = fallbackData;
      }
    }

    const formulary = formularyData || formularyFallback || [];

    // Step 4: Fetch prior approval criteria
    console.log('Fetching prior approval criteria...');
    const { data: priorApprovalCriteria, error: criteriaError } = await supabase
      .from('prior_approval_criteria')
      .select('*')
      .eq('drug_name_norm', normalizedName);

    if (criteriaError && criteriaError.code !== 'PGRST116') {
      console.error('Prior approval criteria query error:', criteriaError);
    }

    // Step 5: Fetch alternatives from the same therapeutic area
    console.log('Fetching alternatives...');
    const { data: alternatives, error: altError } = await supabase
      .from('icb_formulary')
      .select('drug_name, status, therapeutic_area, name, formulary_status')
      .eq('therapeutic_area', formulary?.[0]?.therapeutic_area || 'Unknown')
      .neq('name_norm', normalizedName)
      .limit(5);

    if (altError) {
      console.error('Alternatives query error:', altError);
    }

    // Construct response
    const response: DrugLookupResponse = {
      drug: name,
      traffic_light: trafficLightData ? {
        status: trafficLightData.status_enum,
        status_enum: trafficLightData.status_enum,
        status_raw: trafficLightData.status_raw || trafficLightData.status_enum,
        detail_url: trafficLightData.detail_url,
        bnf_chapter: trafficLightData.bnf_chapter,
        notes: trafficLightData.notes,
        status_tooltip: STATUS_TOOLTIPS[trafficLightData.status_enum as keyof typeof STATUS_TOOLTIPS] || STATUS_TOOLTIPS['UNKNOWN']
      } : null,
      prior_approval: {
        required: formulary?.[0]?.prior_approval_required || false,
        pdf_url: formulary?.[0]?.prior_approval_pdf_url || null,
        page_ref: formulary?.[0]?.prior_approval_page_ref || null,
        criteria: priorApprovalCriteria || []
      },
      formulary: formulary ? formulary.map(item => ({
        name: item.name || item.drug_name,
        status: item.formulary_status || mapFormularyStatusToTrafficLight(item.status),
        therapeutic_area: item.therapeutic_area,
        source_document: item.source_document,
        source_page: item.source_page,
        last_reviewed: item.last_reviewed || item.last_reviewed_date,
        detail_url: item.detail_url,
        bnf_chapter: item.bnf_chapter
      })) : [],
      alternatives: alternatives ? alternatives.map(alt => ({
        name: alt.name || alt.drug_name,
        status: alt.formulary_status || mapFormularyStatusToTrafficLight(alt.status),
        therapeutic_area: alt.therapeutic_area
      })) : []
    };

    console.log('Lookup complete:', {
      traffic_light_found: !!trafficLightData,
      prior_approval_found: !!formulary,
      formulary_count: formulary?.length || 0,
      criteria_count: priorApprovalCriteria?.length || 0
    });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in comprehensive-drug-lookup function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper function to map formulary status to traffic light status
function mapFormularyStatusToTrafficLight(status: string): string {
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
    if (statusLower.includes('double')) {
      return 'DOUBLE_RED';
    }
    return 'RED';
  } else if (statusLower.includes('specialist')) {
    if (statusLower.includes('initiat')) {
      return 'SPECIALIST_INITIATED';
    }
    return 'SPECIALIST_RECOMMENDED';
  } else {
    return 'UNKNOWN';
  }
}