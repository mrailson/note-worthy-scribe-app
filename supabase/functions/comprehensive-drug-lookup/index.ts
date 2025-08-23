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
      .rpc('icn_norm', name);

    if (normError) {
      console.error('Error normalizing name:', normError);
      return new Response(
        JSON.stringify({ error: 'Failed to normalize drug name' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedName = normalizedData;
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

    // Step 4: Search formulary table
    let formularyData: any[] = [];
    
    // First, get direct matches
    const { data: directMatches, error: directError } = await supabase
      .from('icn_formulary')
      .select('*')
      .ilike('name_norm', `${normalizedName}%`)
      .order('preference_rank', { ascending: true, nullsFirst: false })
      .order('item_name', { ascending: true });

    if (directError) {
      console.error('Error fetching direct formulary matches:', directError);
    }

    // If we have direct matches, also get items from the same section
    if (directMatches && directMatches.length > 0) {
      const sections = [...new Set(directMatches.map(item => item.section))];
      
      const { data: sectionMatches, error: sectionError } = await supabase
        .from('icn_formulary')
        .select('*')
        .in('section', sections)
        .order('preference_rank', { ascending: true, nullsFirst: false })
        .order('item_name', { ascending: true });

      if (sectionError) {
        console.error('Error fetching section formulary matches:', sectionError);
      } else {
        // Combine and deduplicate
        const allMatches = [...(directMatches || []), ...(sectionMatches || [])];
        const uniqueMatches = allMatches.filter((item, index, self) => 
          index === self.findIndex(t => t.id === item.id)
        );
        formularyData = uniqueMatches;
      }
    } else {
      formularyData = directMatches || [];
    }

    // Step 5: Get alternatives from the same formulary section
    let alternativesData: any[] = [];
    if (formularyData && formularyData.length > 0) {
      const sections = [...new Set(formularyData.map(item => item.section))];
      
      for (const section of sections) {
        const { data: sectionAlternatives, error: altError } = await supabase
          .from('icn_formulary')
          .select('*')
          .eq('section', section)
          .neq('name_norm', normalizedName)
          .order('preference_rank', { ascending: true, nullsFirst: false })
          .limit(5);
          
        if (altError) {
          console.error('Error fetching alternatives:', altError);
        } else if (sectionAlternatives) {
          // Look up traffic light status for each alternative
          for (const alt of sectionAlternatives) {
            const { data: altTlData } = await supabase
              .from('icn_tl_norm')
              .select('*')
              .ilike('name_norm', `${alt.name_norm}%`)
              .limit(1)
              .maybeSingle();
              
            alternativesData.push({
              name: alt.item_name,
              notes: alt.notes,
              status: altTlData?.tl_status_enum || 'UNKNOWN',
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
        bnf_chapter: formularyData[0]?.bnf_chapter,
        section: formularyData[0]?.section,
        preferred: formularyData.map(item => ({
          item_name: item.item_name,
          rank: item.preference_rank || 999,
          notes: item.notes,
          otc: item.otc
        })),
        page_url: formularyData[0]?.page_url || 'https://www.icnorthamptonshire.org.uk/mo-formulary',
        last_published: formularyData[0]?.last_published,
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