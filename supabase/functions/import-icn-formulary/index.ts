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
  
  // Extract last published date more specifically
  let lastPublished = "";
  $("*").each((_, element) => {
    const text = $(element).text();
    if (text.includes("Last published")) {
      // Extract just the date part after "Last published"
      const match = text.match(/Last published[:\s]+([^\n\r]+)/i);
      if (match && match[1]) {
        lastPublished = norm(match[1]).split(/\s+/).slice(0, 4).join(" "); // Take first few words only
      }
    }
  });
  console.log('Last published:', lastPublished);
  
  const rows: FormularyItem[] = [];
  
  console.log('Starting to parse HTML content...');
  
  // Debug: log some basic info about the HTML structure
  console.log(`Found ${$("h3").length} h3 elements`);
  console.log(`Found ${$(".accordion-switch").length} accordion-switch elements`);
  console.log(`Found ${$(".accordion-content").length} accordion-content elements`);
  console.log(`Found ${$("strong").length} strong elements`);
  
  // Debug: log first few h3 elements and their content
  $("h3.accordion-switch").slice(0, 3).each((i, el) => {
    const title = norm($(el).text());
    console.log(`H3 ${i}: "${title}"`);
    const content = $(el).next("div.accordion-content");
    console.log(`- Has content div: ${content.length > 0}`);
    if (content.length > 0) {
      const strongTags = content.find("strong");
      console.log(`- Strong tags found: ${strongTags.length}`);
      strongTags.slice(0, 3).each((j, strong) => {
        console.log(`  - Strong ${j}: "${norm($(strong).text())}"`);
      });
    }
  });
  
  // Look for accordion sections with h3.accordion-switch and div.accordion-content
  $("h3.accordion-switch").each((_, h3Element) => {
    const $h3 = $(h3Element);
    const sectionTitle = norm($h3.text());
    
    if (!sectionTitle || sectionTitle.length < 3) {
      console.log(`Skipping empty section title`);
      return;
    }
    
    // Skip guidance sections
    if (/^guidance$/i.test(sectionTitle)) {
      console.log(`Skipping guidance section: ${sectionTitle}`);
      return;
    }
    
    console.log(`Processing section: ${sectionTitle}`);
    
    // Determine chapter - simplified
    let chapter = "Other";
    const sectionLower = sectionTitle.toLowerCase();
    
    if (sectionLower.includes("cardiac") || sectionLower.includes("diuretic") || 
        sectionLower.includes("beta") || sectionLower.includes("ace") || 
        sectionLower.includes("lipid") || sectionLower.includes("anticoagulant")) {
      chapter = "Cardiovascular system";
    } else if (sectionLower.includes("bronchodilator") || sectionLower.includes("asthma") ||
               sectionLower.includes("corticosteroid") || sectionLower.includes("inhaler")) {
      chapter = "Respiratory system";
    } else if (sectionLower.includes("antacid") || sectionLower.includes("gastro")) {
      chapter = "Gastro-intestinal system";
    }
    
    // Find the accordion content div that follows this h3
    let $content = $h3.next("div.accordion-content");
    if (!$content.length) {
      console.log(`No accordion-content found for section: ${sectionTitle}`);
      return;
    }
    
    console.log(`Found content div for: ${sectionTitle}`);
    
    let rank = 0;
    
    // SIMPLIFIED: Extract ANY strong tag text as potential drugs
    $content.find("strong").each((_, strongEl) => {
      const strongText = norm($(strongEl).text());
      if (!strongText || strongText.length < 3) return;
      
      // VERY BASIC filtering - only skip obvious non-drugs
      if (/^(guidance|note|short-acting|long-acting)$/i.test(strongText)) return;
      
      console.log(`Found potential drug: "${strongText}" in section: ${sectionTitle}`);
      
      rank++;
      
      rows.push({
        bnf_chapter_name: chapter,
        section: sectionTitle,
        item_name: strongText,
        preference_rank: rank,
        otc: false,
        notes: undefined,
        page_url: URL,
        last_published: lastPublished || undefined
      });
    });
    
    console.log(`Section "${sectionTitle}" yielded ${rank} items`);
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