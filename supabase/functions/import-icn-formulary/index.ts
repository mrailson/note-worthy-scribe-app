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
  
  console.log('Starting to parse HTML content...');
  
  // Debug: log some basic info about the HTML structure
  console.log(`Found ${$("h3").length} h3 elements`);
  console.log(`Found ${$(".accordion-switch").length} accordion-switch elements`);
  console.log(`Found ${$(".accordion-content").length} accordion-content elements`);
  console.log(`Found ${$("strong").length} strong elements`);
  
  // Look for all h3 headers that contain drug/formulary information
  $("h3").each((_, h3Element) => {
    const $h3 = $(h3Element);
    const sectionTitle = norm($h3.text());
    
    if (!sectionTitle || sectionTitle.length < 3) return;
    
    // Skip non-drug sections
    if (/^(guidance|current|last published)$/i.test(sectionTitle)) return;
    
    console.log(`Processing section: ${sectionTitle}`);
    
    // Determine chapter based on context or section title
    let chapter = "Other";
    const sectionLower = sectionTitle.toLowerCase();
    
    if (sectionLower.includes("cardiac") || sectionLower.includes("diuretic") || 
        sectionLower.includes("beta") || sectionLower.includes("ace") || 
        sectionLower.includes("calcium") || sectionLower.includes("anticoagulant") ||
        sectionLower.includes("lipid") || sectionLower.includes("statin")) {
      chapter = "Cardiovascular system";
    } else if (sectionLower.includes("bronchodilator") || sectionLower.includes("inhaler") ||
               sectionLower.includes("asthma") || sectionLower.includes("copd") ||
               sectionLower.includes("corticosteroid") || sectionLower.includes("steroid")) {
      chapter = "Respiratory system";
    } else if (sectionLower.includes("antacid") || sectionLower.includes("ppi") ||
               sectionLower.includes("laxative") || sectionLower.includes("gastro")) {
      chapter = "Gastro-intestinal system";
    } else if (sectionLower.includes("hypnotic") || sectionLower.includes("anxiolytic") ||
               sectionLower.includes("antidepress") || sectionLower.includes("anticonvulsant")) {
      chapter = "Central nervous system";
    } else if (sectionLower.includes("antibiotic") || sectionLower.includes("antiviral") ||
               sectionLower.includes("antifungal")) {
      chapter = "Infections";
    }
    
    // Find the next sibling content (could be div.accordion-content or just the next element)
    let $content = $h3.next();
    if ($content.hasClass("accordion-content")) {
      // Standard accordion structure
    } else {
      // Look for content in the same parent or nearby elements
      $content = $h3.parent().find("p, div").first();
      if (!$content.length) {
        $content = $h3.nextAll("p, div").first();
      }
    }
    
    if (!$content.length) return;
    
    let rank = 0;
    
    // Extract drugs from strong tags
    $content.find("strong").each((_, strongEl) => {
      const strongText = norm($(strongEl).text());
      if (!strongText || strongText.length < 2) return;
      
      // Skip section headers and non-drug text
      if (/^(guidance|note|prescribe|licensed|available|carbon footprint|shelf life)$/i.test(strongText)) return;
      if (/^(single|dry|powder|pressurised|triple|therapy|combination|short|long|acting)$/i.test(strongText)) return;
      if (/^(modified|release|tablet|capsule|injection|cream|ointment|spray)$/i.test(strongText)) return;
      
      rank++;
      
      // Clean the drug name
      let cleanDrug = strongText
        .replace(/®/g, '')
        .replace(/\s+(tablet|capsule|injection|cream|ointment|spray|inhaler|dpi|pmdi|oral|solution)s?$/i, '')
        .replace(/\s+(m\/r|mr|xl|la|sr)$/i, '')
        .replace(/\s+\d+(\.\d+)?\s*(mg|microgram|mcg|g|ml|%)\b.*$/i, '')
        .replace(/\s+once\s+daily$/i, '')
        .replace(/\s+twice\s+daily$/i, '')
        .trim();
        
      if (cleanDrug.length < 2) return;
      
      // Get surrounding context for notes
      const parentEl = $(strongEl).parent();
      const parentText = norm(parentEl.text());
      let notes = "";
      
      // Extract notes that follow the drug name
      const drugIndex = parentText.toLowerCase().indexOf(strongText.toLowerCase());
      if (drugIndex >= 0) {
        const afterDrug = parentText.substring(drugIndex + strongText.length).trim();
        if (afterDrug.length > 0 && afterDrug.length < 300) {
          notes = afterDrug.replace(/^[\s\-–—]+/, '').substring(0, 200);
        }
      }
      
      console.log(`Found drug: ${cleanDrug} in section: ${sectionTitle}`);
      
      rows.push({
        bnf_chapter_name: chapter,
        section: sectionTitle,
        item_name: cleanDrug,
        preference_rank: rank,
        otc: /OTC|over the counter/i.test(parentText),
        notes: notes || undefined,
        page_url: URL,
        last_published: lastPublished || undefined
      });
    });
    
    // Also check for drugs in paragraph text (not in strong tags)
    $content.find("p").each((_, p) => {
      const pText = norm($(p).text());
      if (!pText || pText.length < 10) return;
      
      // Look for drug names that might not be in strong tags
      // This is a basic implementation - could be improved
      const lines = pText.split(/[.\n]/);
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.length > 3 && trimmed.length < 50) {
          // Basic drug name pattern matching
          if (/^[A-Z][a-z]+(\s+[A-Z]*[a-z]*)*$/i.test(trimmed) && 
              !/^(the|and|or|but|for|with|from|this|that|when|where|how|why)$/i.test(trimmed)) {
            
            rank++;
            rows.push({
              bnf_chapter_name: chapter,
              section: sectionTitle,
              item_name: trimmed,
              preference_rank: rank,
              otc: /OTC|over the counter/i.test(pText),
              notes: undefined,
              page_url: URL,
              last_published: lastPublished || undefined
            });
          }
        }
      });
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