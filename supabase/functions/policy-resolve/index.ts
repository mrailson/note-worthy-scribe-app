import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const name = url.searchParams.get('name');

    if (!id && !name) {
      throw new Error('Either id or name parameter is required');
    }

    let query = supabase
      .from('icn_policy_unified')
      .select('*');

    if (id) {
      query = query.eq('tl_id', id);
    } else if (name) {
      // Search by name with prefix matching for better UX
      query = query.ilike('tl_name', `${name}%`);
    }

    const { data: unifiedData, error: unifiedError } = await query.limit(10);

    if (unifiedError) {
      console.error('Unified query error:', unifiedError);
      throw unifiedError;
    }

    // If no results from unified view and searching by name, try fuzzy search
    let fuzzyData = [];
    if (name && (!unifiedData || unifiedData.length === 0)) {
      const { data: fuzzyResults, error: fuzzyError } = await supabase
        .from('icn_policy_unified_fuzzy')
        .select('*')
        .ilike('tl_name', `%${name}%`)
        .gte('sim', 0.4)
        .order('sim', { ascending: false })
        .limit(5);

      if (!fuzzyError) {
        fuzzyData = fuzzyResults || [];
      }
    }

    // Combine results and format response
    const allResults = [...(unifiedData || []), ...fuzzyData];
    
    if (allResults.length === 0) {
      return new Response(JSON.stringify({
        error: 'No matching medicines found',
        drug: null,
        prior_approval: null
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Take the first/best match
    const result = allResults[0];
    
    // Format response according to specification
    const response = {
      drug: {
        name: result.tl_name,
        tl_status: result.tl_status_enum,
        bnf_chapter: result.bnf_chapter,
        tl_url: result.tl_detail_url,
        last_modified: result.tl_last_modified,
        notes: result.tl_notes
      },
      prior_approval: result.pa_id ? {
        status: result.pa_status_enum,
        route: result.pa_route,
        criteria: result.criteria_excerpt ? 
          result.criteria_excerpt.split('\n').filter(line => line.trim()).slice(0, 4) : 
          [],
        link: result.pa_source_url,
        notes: result.pa_notes
      } : null,
      can_gp_initiate: getGPInitiateAnswer(result.tl_status_enum, result.pa_status_enum),
      fuzzy_match: 'sim' in result ? result.sim : null
    };

    console.log('Policy resolution successful:', {
      query: { id, name },
      found: result.tl_name,
      has_pa: !!result.pa_id
    });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Policy resolution error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to resolve policy' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getGPInitiateAnswer(tlStatus: string, paStatus?: string): string {
  switch (tlStatus) {
    case 'DOUBLE_RED':
      return paStatus ? 'No - PA/IFR/Blueteq required' : 'No';
    case 'RED':
      return paStatus ? 'No - Usually Blueteq required' : 'No';
    case 'SPECIALIST_INITIATED':
      return 'Only if specialist has started';
    case 'SPECIALIST_RECOMMENDED':
      return 'Yes - Specialist recommended';
    case 'AMBER_1':
    case 'AMBER_2':
      return 'Yes - Check local formulary';
    case 'GREEN':
      return 'Yes';
    case 'GREY':
    case 'UNKNOWN':
    default:
      return 'Check ICB site / Medicines Optimisation';
  }
}