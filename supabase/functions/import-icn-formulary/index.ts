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

async function importFormularyData(supabase: any) {
  const URL = "https://www.icnorthamptonshire.org.uk/mo-formulary";
  
  console.log('=== STARTING ICN FORMULARY IMPORT ===');
  console.log('Fetching formulary data from:', URL);
  
  try {
    // Fetch the page with user agent to avoid blocking
    const response = await fetch(URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FormularyBot/1.0)'
      }
    });
    
    console.log('Fetch response status:', response.status);
    console.log('Fetch response ok:', response.ok);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log('HTML length received:', html.length);
    console.log('HTML preview (first 200 chars):', html.substring(0, 200));
    
    const $ = cheerio.load(html);
    console.log('Cheerio loaded successfully');
    
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
    
    console.log('=== HTML STRUCTURE ANALYSIS ===');
    console.log(`Total HTML elements: ${$("*").length}`);
    console.log(`Found ${$("h3").length} h3 elements`);
    console.log(`Found ${$(".accordion-switch").length} accordion-switch elements`);
    console.log(`Found ${$(".accordion-content").length} accordion-content elements`);
    console.log(`Found ${$("strong").length} strong elements`);
    
    // Debug: Show ALL h3 elements to see what's actually there
    console.log('=== ALL H3 ELEMENTS ===');
    $("h3").each((i, el) => {
      const text = norm($(el).text());
      const hasAccordionClass = $(el).hasClass("accordion-switch");
      console.log(`H3 ${i}: "${text}" (has accordion-switch: ${hasAccordionClass})`);
    });
    
    // Debug: Show a sample of strong elements
    console.log('=== SAMPLE STRONG ELEMENTS ===');
    $("strong").slice(0, 10).each((i, el) => {
      const text = norm($(el).text());
      console.log(`Strong ${i}: "${text}"`);
    });
    
    console.log('=== STARTING SECTION PROCESSING ===');
    
    // SIMPLIFIED APPROACH: Just extract ANY strong tags from the entire page
    console.log('=== EXTRACTING ALL STRONG TAGS ===');
    let totalStrong = 0;
    
    $("strong").each((i, strongEl) => {
      const strongText = norm($(strongEl).text());
      totalStrong++;
      
      if (strongText && strongText.length >= 3) {
        // Filter out obvious non-drug content
        const isExcluded = /^(guidance|note|current|last published|copyright|powered by|login|contact|privacy|accessibility|available products|notes|combined oral contraceptive|contraceptive|emergency|erectile dysfunction|anaemias|vitamin deficiency|non-steroidal|guidance|antacids|antispasmodics|urinary|contraception)$/i.test(strongText) ||
          strongText.includes('®') && strongText.length < 10 && !/mg|mcg|tablet|capsule|liquid|cream|gel|patch/i.test(strongText) ||
          /^(over the counter|otc products|available|preferred|formulary|choices|bold)$/i.test(strongText);
        
        if (!isExcluded) {
          // Look for drug-like characteristics
          const isDrugLike = /mg|mcg|microgram|tablet|capsule|liquid|cream|gel|patch|injection|inhaler/i.test(strongText) ||
            /^\w+\s+\d+/i.test(strongText) || // Word followed by number
            strongText.includes('®') ||
            /acid|ine|ol|one|ide|ate|cin|lin|fen|ben|pam|zol/i.test(strongText.toLowerCase()); // Common drug endings
          
          if (isDrugLike || strongText.length >= 5) {
            console.log(`Adding drug: "${strongText}"`);
            
            rows.push({
              bnf_chapter_name: "Other",
              section: "General", 
              item_name: strongText,
              preference_rank: rows.length + 1,
              otc: false,
              notes: undefined,
              page_url: URL,
              last_published: lastPublished || undefined
            });
          }
        }
      }
      
      // Only log first 20 to avoid spam
      if (i < 20) {
        console.log(`Strong ${i}: "${strongText}" - excluded: ${isExcluded}, drug-like: ${isDrugLike}`);
      }
    });
    
    console.log(`Total strong tags found: ${totalStrong}`);
    console.log(`Items added to rows: ${rows.length}`);
    
    console.log('=== EXTRACTION COMPLETE ===');
    console.log(`Extracted ${rows.length} formulary items`);
    
    // DIAGNOSTIC: Return HTML info even if no items found
    if (rows.length === 0) {
      return {
        success: false,
        message: 'No formulary data extracted - DIAGNOSTIC INFO',
        html_length: html.length,
        html_preview: html.substring(0, 500),
        total_h3_elements: $("h3").length,
        total_strong_elements: $("strong").length,
        accordion_switches: $(".accordion-switch").length,
        accordion_content: $(".accordion-content").length,
        items_found: 0,
        items_inserted: 0,
        final_count: 0
      };
    }
    
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
    
  } catch (error) {
    console.error('Error in importFormularyData:', error);
    throw error;
  }
}

// Main serve function
serve(async (req) => {
  console.log('=== ICN FORMULARY IMPORT REQUEST RECEIVED ===');
  
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