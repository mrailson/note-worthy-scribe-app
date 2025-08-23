import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FormularyItem {
  bnf_chapter_name?: string;
  section?: string;
  item_name: string;
  preference_rank?: number;
  otc: boolean;
  notes?: string;
  page_url: string;
  last_published?: string;
}

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

    console.log('Starting ICN Formulary import...');
    
    const result = await importFormularyData(supabase);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Import failed:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function importFormularyData(supabase: any) {
  const URL = "https://www.icnorthamptonshire.org.uk/mo-formulary";
  
  console.log('Fetching formulary data from:', URL);
  
  // Fetch the page with user agent to avoid blocking
  const response = await fetch(URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FormularyBot/1.0)'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }
  
  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Helper function to normalize text
  const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim();
  
  // Extract last published date - look for "Last published" text
  const lastPublished = norm($("*:contains('Last published')").next().text()) || "";
  console.log('Last published:', lastPublished);
  
  const rows: FormularyItem[] = [];
  
  // Walk H2 (chapters) → H3 (sections) → list items (ordered preference)
  $("h2").each((_, h2) => {
    const chapter = norm($(h2).text());
    if (!chapter) return;
    
    let $n = $(h2).next();
    
    while ($n.length && !/^h2$/i.test($n[0].name)) {
      if (/^h3$/i.test($n[0].name)) {
        const section = norm($n.text());
        if (!section) {
          $n = $n.next();
          continue;
        }
        
        // Look ahead for <ol> or <ul> blocks that list preferred items
        let $l = $n.next();
        let rank = 0;
        
        while ($l.length && !/^h3|h2$/i.test($l[0].name)) {
          if (/^ol|ul$/i.test($l[0].name)) {
            $l.children("li").each((_, li) => {
              rank++;
              const liText = norm($(li).text());
              if (!liText) return;
              
              // Split off " – " notes if present
              const [item, ...rest] = liText.split(" – ");
              const notes = rest.join(" – ");
              
              rows.push({
                bnf_chapter_name: chapter,
                section,
                item_name: item,
                preference_rank: rank, // order = preference
                otc: /OTC|over the counter/i.test(liText),
                notes: notes || undefined,
                page_url: URL,
                last_published: lastPublished || undefined
              });
            });
          }
          $l = $l.next();
        }
      }
      $n = $n.next();
    }
  });
  
  console.log(`Extracted ${rows.length} formulary items`);
  
  // Deduplicate: keep first occurrence of each item
  const key = (r: FormularyItem) => 
    `${r.bnf_chapter_name}::${r.section}::${r.item_name}`.toLowerCase();
  const seen = new Set<string>();
  const items = rows.filter(r => {
    const k = key(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  
  console.log(`After deduplication: ${items.length} items`);
  
  if (items.length === 0) {
    return {
      success: false,
      message: 'No formulary data extracted from the page',
      items_found: 0,
      items_inserted: 0,
      final_count: 0
    };
  }
  
  // Clear existing data
  console.log('Clearing existing formulary data...');
  const { error: deleteError } = await supabase
    .from('icn_formulary')
    .delete()
    .neq('id', 0); // Delete all records
    
  if (deleteError) {
    console.error('Error clearing existing data:', deleteError);
    throw new Error(`Failed to clear existing data: ${deleteError.message}`);
  }
  
  // Insert new data in batches
  console.log('Inserting new formulary data...');
  const batchSize = 100;
  let insertedCount = 0;
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    const { error: insertError } = await supabase
      .from('icn_formulary')
      .insert(batch);
      
    if (insertError) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError);
      throw new Error(`Failed to insert batch: ${insertError.message}`);
    }
    
    insertedCount += batch.length;
    console.log(`Inserted batch ${i / batchSize + 1}: ${batch.length} items (total: ${insertedCount})`);
  }
  
  console.log(`Import completed! Inserted ${insertedCount} formulary items`);
  
  // Get final count
  const { count: finalCount } = await supabase
    .from('icn_formulary')
    .select('*', { count: 'exact', head: true });

  return {
    success: true,
    message: `Successfully imported ${finalCount || insertedCount} formulary items`,
    items_found: items.length,
    items_inserted: insertedCount,
    final_count: finalCount,
    last_published: lastPublished
  };
}