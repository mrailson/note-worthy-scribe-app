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
  
  // The site uses accordion structure: h3.accordion-switch + div.accordion-content
  // Find chapter headings (placement sections) and their content
  $(".placement-row").each((_, placement) => {
    const $placement = $(placement);
    
    // Try to find chapter name from the placement or nearby headings
    let chapter = "";
    
    // Look for h2 or h1 that might indicate the chapter
    const $prevH2 = $placement.prevAll().find("h2").first();
    const $prevH1 = $placement.prevAll().find("h1").first(); 
    
    if ($prevH2.length) {
      chapter = norm($prevH2.text());
    } else if ($prevH1.length) {
      chapter = norm($prevH1.text());
    } else {
      // Fallback: look for specific keywords to identify chapters
      const placementText = norm($placement.text().toLowerCase());
      if (placementText.includes("cardiovascular") || placementText.includes("cardiac")) {
        chapter = "Cardiovascular system";
      } else if (placementText.includes("respiratory") || placementText.includes("asthma") || placementText.includes("copd")) {
        chapter = "Respiratory system";
      } else if (placementText.includes("gastro") || placementText.includes("antacid")) {
        chapter = "Gastro-intestinal system";
      } else if (placementText.includes("central nervous") || placementText.includes("hypnotic") || placementText.includes("anxiolytic")) {
        chapter = "Central nervous system";
      } else if (placementText.includes("infection")) {
        chapter = "Infections";
      } else if (placementText.includes("endocrine") || placementText.includes("diabetes")) {
        chapter = "Endocrine system";
      } else {
        chapter = "Other";
      }
    }
    
    // Process accordion sections within this placement
    $placement.find("h3.accordion-switch").each((_, h3) => {
      const $h3 = $(h3);
      const section = norm($h3.text());
      if (!section) return;
      
      // Find the corresponding accordion content
      const $content = $h3.next(".accordion-content");
      if (!$content.length) return;
      
      let rank = 0;
      
      // Extract drug names from various formats
      // 1. Look for <strong> tags (most common pattern)
      $content.find("strong").each((_, strong) => {
        const drugText = norm($(strong).text());
        if (!drugText || drugText.length < 3) return;
        
        // Skip obvious non-drug text
        if (/^(guidance|note|prescribe|licensed|available|low carbon|high carbon|very high|shelf life)$/i.test(drugText)) return;
        if (/^(single|dry powder|pressurised|triple therapy|combination|short|long|acting)$/i.test(drugText)) return;
        
        rank++;
        
        // Clean up drug names
        const cleanDrug = drugText
          .replace(/®/g, '')
          .replace(/\s+(tablet|capsule|injection|cream|ointment|spray|inhaler|dpi|pmdi)s?$/i, '')
          .replace(/\s+m\/r$/i, '')
          .replace(/\s+\d+(\.\d+)?\s*(mg|microgram|g).*$/i, '')
          .trim();
          
        if (cleanDrug.length < 2) return;
        
        // Get surrounding context for notes
        const parentText = norm($(strong).parent().text());
        let notes = "";
        
        // Extract notes that follow the drug name
        const drugIndex = parentText.toLowerCase().indexOf(drugText.toLowerCase());
        if (drugIndex >= 0) {
          const afterDrug = parentText.substring(drugIndex + drugText.length).trim();
          if (afterDrug.length > 0 && afterDrug.length < 200) {
            notes = afterDrug.replace(/^[\s\-–—]+/, '').substring(0, 200);
          }
        }
        
        rows.push({
          bnf_chapter_name: chapter,
          section,
          item_name: cleanDrug,
          preference_rank: rank,
          otc: /OTC|over the counter/i.test(parentText),
          notes: notes || undefined,
          page_url: URL,
          last_published: lastPublished || undefined
        });
      });
      
      // 2. Look for list items if no strong tags found useful content
      if (rank === 0) {
        $content.find("li").each((_, li) => {
          const liText = norm($(li).text());
          if (!liText || liText.length < 3) return;
          
          rank++;
          
          // Split off notes
          const [item, ...rest] = liText.split(/\s*[-–—]\s*/);
          const notes = rest.join(' - ');
          
          const cleanItem = item
            .replace(/®/g, '')
            .replace(/\s+\d+(\.\d+)?\s*(mg|microgram|g).*$/i, '')
            .trim();
            
          if (cleanItem.length < 2) return;
          
          rows.push({
            bnf_chapter_name: chapter,
            section,
            item_name: cleanItem,
            preference_rank: rank,
            otc: /OTC|over the counter/i.test(liText),
            notes: notes || undefined,
            page_url: URL,
            last_published: lastPublished || undefined
          });
        });
      }
    });
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