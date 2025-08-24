import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DrugLookupResponse {
  drug: {
    name: string;
    searched_term?: string;
  };
  traffic_light: any;
  prior_approval: any[];
  formulary: {
    bnf_chapter?: string;
    section?: string;
    preferred: Array<{
      item_name: string;
      rank: number;
      notes?: string;
      otc?: boolean;
    }>;
    page_url: string;
    last_published?: string;
    found_exact_match: boolean;
  } | null;
  alternatives: Array<{
    name: string;
    notes?: string;
    status: string;
    detail_url?: string;
  }>;
}

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

    // Step 1: Normalize the name using the database function
    const { data: normalizedData, error: normError } = await supabase
      .rpc('icn_norm', { input_name: name });

    if (normError) {
      console.error('Error normalizing name:', normError);
      // Continue without normalization if function fails
      const normalizedName = name.toLowerCase().trim();
    }

    const normalizedName = normalizedData || name.toLowerCase().trim();
    console.log('Normalized name:', normalizedName);

    // Step 2: Search traffic lights table (icn_tl_norm)
    const { data: trafficLightData, error: tlError } = await supabase
      .from('icn_tl_norm')
      .select('*')
      .ilike('name_norm', `${normalizedName}%`)
      .order('drug_name', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (tlError) {
      console.error('Error fetching traffic light data:', tlError);
    }

    // Step 3: Search prior approval table (if we found a traffic light drug)
    let priorApprovalData: any[] = [];
    if (trafficLightData?.drug_name) {
      const firstWord = trafficLightData.drug_name.split(' ')[0];
      const { data: paData, error: paError } = await supabase
        .from('icn_prior_approval')
        .select('*')
        .ilike('drug_name', `%${firstWord}%`);

      if (paError) {
        console.error('Error fetching prior approval data:', paError);
      } else {
        priorApprovalData = paData || [];
      }
    }

    // Step 4: Search ICB formulary table
    let formularyData: any[] = [];
    
    // First, get direct matches from ICB formulary
    const { data: directMatches, error: directError } = await supabase
      .from('icb_formulary')
      .select('*')
      .ilike('drug_name', `%${name}%`)
      .order('drug_name', { ascending: true });

    if (directError) {
      console.error('Error fetching ICB formulary matches:', directError);
    } else {
      formularyData = directMatches || [];
    }

    // If no direct matches, try normalized search
    if (formularyData.length === 0) {
      const { data: normalizedMatches, error: normError } = await supabase
        .from('icb_formulary')
        .select('*')
        .ilike('drug_name', `%${normalizedName}%`)
        .order('drug_name', { ascending: true });

      if (!normError && normalizedMatches) {
        formularyData = normalizedMatches;
      }
    }

    // Step 5: Get alternatives from the same therapeutic area
    let alternativesData: any[] = [];
    if (formularyData && formularyData.length > 0) {
      const therapeuticAreas = [...new Set(formularyData.map(item => item.therapeutic_area))];
      
      for (const area of therapeuticAreas) {
        const { data: areaAlternatives, error: altError } = await supabase
          .from('icb_formulary')
          .select('*')
          .eq('therapeutic_area', area)
          .neq('drug_name', name)
          .order('drug_name', { ascending: true })
          .limit(5);
          
        if (altError) {
          console.error('Error fetching alternatives:', altError);
        } else if (areaAlternatives) {
          // Look up traffic light status for each alternative
          for (const alt of areaAlternatives) {
            const { data: altTlData } = await supabase
              .from('icn_tl_norm')
              .select('*')
              .ilike('drug_name', `${alt.drug_name}%`)
              .limit(1)
              .maybeSingle();
              
            alternativesData.push({
              name: alt.drug_name,
              notes: alt.notes_restrictions,
              status: altTlData?.status_enum || mapFormularyStatusToTrafficLight(alt.status),
              detail_url: altTlData?.detail_url
            });
          }
        }
      }
    }

    const response: DrugLookupResponse = {
      drug: { name: name, searched_term: normalizedName },
      traffic_light: trafficLightData,
      prior_approval: priorApprovalData,
      formulary: formularyData.length > 0 ? {
        bnf_chapter: "ICB Formulary",
        section: formularyData[0]?.therapeutic_area,
        preferred: formularyData.map((item, index) => ({
          item_name: item.drug_name,
          rank: index + 1,
          notes: item.notes_restrictions
        })),
        page_url: 'https://www.icnorthamptonshire.org.uk/mo-formulary',
        last_published: formularyData[0]?.last_reviewed_date,
        found_exact_match: true
      } : null,
      alternatives: alternativesData
    };

    console.log('Lookup complete:', {
      traffic_light_found: !!trafficLightData,
      prior_approval_count: priorApprovalData.length,
      formulary_count: formularyData.length
    });

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

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
    return 'RED';
  } else if (statusLower.includes('formulary')) {
    return 'GREEN'; // Assume formulary items are generally green
  } else {
    return 'UNKNOWN';
  }
}