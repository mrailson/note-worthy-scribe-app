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

    // Get additional drugs from formulary
    const { data: formularyData, error: formularyError } = await supabase
      .from('icn_formulary')
      .select('item_name')
      .order('item_name', { ascending: true });

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

    // Add formulary drugs (without overriding existing traffic light status)
    if (formularyData) {
      formularyData.forEach(item => {
        if (item.item_name) {
          const key = item.item_name.toLowerCase();
          if (!vocabMap.has(key)) {
            vocabMap.set(key, {
              id: item.item_name,
              name: item.item_name
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