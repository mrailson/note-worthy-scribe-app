import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VocabItem {
  id: string;
  name: string;
  tl_status?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching drug vocabulary...');

    // Get vocabulary from traffic lights table first
    const { data: tlData, error: tlError } = await supabase
      .from('icn_tl_norm')
      .select('drug_name, status_enum')
      .order('drug_name', { ascending: true });

    if (tlError) {
      console.error('Error fetching traffic light vocabulary:', tlError);
    }

    // Get additional drugs from ICB formulary
    const { data: formularyData, error: formularyError } = await supabase
      .from('icb_formulary')
      .select('drug_name, status')
      .order('drug_name', { ascending: true });

    if (formularyError) {
      console.error('Error fetching formulary vocabulary:', formularyError);
    }

    // Combine and deduplicate
    const vocabMap = new Map<string, VocabItem>();

    // Add traffic light drugs
    if (tlData) {
      tlData.forEach(item => {
        if (item.drug_name) {
          vocabMap.set(item.drug_name.toLowerCase(), {
            id: item.drug_name,
            name: item.drug_name,
            tl_status: item.status_enum
          });
        }
      });
    }

    // Add ICB formulary drugs (without overriding existing traffic light status)
    if (formularyData) {
      formularyData.forEach(item => {
        if (item.drug_name) {
          const key = item.drug_name.toLowerCase();
          if (!vocabMap.has(key)) {
            vocabMap.set(key, {
              id: item.drug_name,
              name: item.drug_name,
              tl_status: mapFormularyStatusToTrafficLight(item.status)
            });
          }
        }
      });
    }

    const vocabulary = Array.from(vocabMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log(`Vocabulary compiled: ${vocabulary.length} items`);

    return new Response(
      JSON.stringify({ items: vocabulary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in drug-vocabulary function:', error);
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