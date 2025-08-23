import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Medicine {
  name: string;
  bnf_chapter: string | null;
  status_raw: string;
  status_enum: "DOUBLE_RED"|"RED"|"SPECIALIST_INITIATED"|"SPECIALIST_RECOMMENDED"|"AMBER_1"|"AMBER_2"|"GREEN"|"GREY"|"UNKNOWN";
  detail_url: string;
  last_modified: string | null;
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

    console.log('Starting traffic light medicines import...');
    
    const result = await importAllMedicines(supabase);
    
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

function toStatusEnum(statusText: string): Medicine["status_enum"] {
  const normalized = statusText.toLowerCase().replace(/[–—]/g, '-').trim();
  
  if (normalized.includes("double red")) return "DOUBLE_RED";
  if (/\bred\b/.test(normalized)) return "RED";
  if (normalized.includes("specialist initiated")) return "SPECIALIST_INITIATED";
  if (normalized.includes("specialist recommended")) return "SPECIALIST_RECOMMENDED";
  if (normalized.includes("amber 2")) return "AMBER_2";
  if (normalized.includes("amber 1")) return "AMBER_1";
  if (normalized.includes("green")) return "GREEN";
  if (normalized.includes("grey")) return "GREY";
  
  return "UNKNOWN";
}

async function scrapePage(page: number): Promise<Medicine[]> {
  const BASE_URL = 'https://www.icnorthamptonshire.org.uk/trafficlightdrugs';
  const url = page === 1 ? BASE_URL : `${BASE_URL}/?pag_page=${page}`;
  
  console.log(`Fetching page ${page}: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch page ${page}: ${response.status} ${response.statusText}`);
  }
  
  const html = await response.text();
  const $ = cheerio.load(html);
  const medicines: Medicine[] = [];

  $("a").each((_, a) => {
    const name = $(a).text().trim();
    const href = $(a).attr("href") || "";
    
    if (!href.includes("testid=")) return;
    if (!name || name.length < 2) return; // Skip empty or very short names

    // Find the table row containing this link
    const $row = $(a).closest('tr');
    if ($row.length === 0) return;
    
    // Get all table cells in this row
    const $cells = $row.find('td');
    if ($cells.length < 4) return; // Need at least 4 columns
    
    // Parse BNF chapter from second column
    const bnfText = $cells.eq(1).text().trim();
    const bnf = bnfText || null;
    
    // Parse status from the fourth column (status column)
    const $statusCell = $cells.eq(3);
    const statusRaw = $statusCell.text().trim();
    
    medicines.push({
      name,
      bnf_chapter: bnf,
      status_raw: statusRaw,
      status_enum: toStatusEnum(statusRaw),
      detail_url: new URL(href, BASE_URL).toString(),
      last_modified: null,
    });
  });

  console.log(`Page ${page} scraped: ${medicines.length} medicines found`);
  return medicines;
}

async function importAllMedicines(supabase: any) {
  console.log('Starting import process...');
  
  const allMedicines: Medicine[] = [];
  const maxPages = 30;
  
  // Clear existing data first
  console.log('Clearing existing data...');
  const { error: deleteError } = await supabase
    .from('traffic_light_medicines')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
    
  if (deleteError) {
    console.error('Error clearing existing data:', deleteError);
    throw new Error(`Failed to clear existing data: ${deleteError.message}`);
  }
  
  // Scrape pages in small batches to avoid timeouts
  for (let page = 1; page <= maxPages; page++) {
    try {
      console.log(`Processing page ${page}/${maxPages}...`);
      const medicines = await scrapePage(page);
      allMedicines.push(...medicines);
      
      // Insert this page's medicines immediately to show progress
      if (medicines.length > 0) {
        const { error: insertError } = await supabase
          .from('traffic_light_medicines')
          .insert(medicines.map(med => ({
            name: med.name,
            status_enum: med.status_enum,
            bnf_chapter: med.bnf_chapter,
            detail_url: med.detail_url,
            notes: med.last_modified ? `Last modified: ${med.last_modified}` : null,
            status_raw: med.status_raw
          })));
          
        if (insertError) {
          console.error(`Error inserting page ${page}:`, insertError);
        } else {
          console.log(`✅ Page ${page}: Inserted ${medicines.length} medicines (total so far: ${allMedicines.length})`);
        }
      }
      
      // Small delay between pages to be respectful
      if (page < maxPages) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
    } catch (error) {
      console.error(`❌ Error processing page ${page}:`, error);
      // Continue with next page instead of failing completely
      continue;
    }
  }
  
  console.log(`Import completed! Total medicines processed: ${allMedicines.length}`);
  
  // Remove duplicates if any exist
  const { error: dedupError } = await supabase.rpc('deduplicate_medicines');
  if (dedupError) {
    console.warn('Deduplication warning:', dedupError);
  }
  
  // Get final count
  const { count: finalCount } = await supabase
    .from('traffic_light_medicines')
    .select('*', { count: 'exact', head: true });

  return {
    success: true,
    message: `Successfully imported ${finalCount || allMedicines.length} medicines from ${maxPages} pages`,
    total_found: allMedicines.length,
    final_count: finalCount,
    pages_processed: maxPages
  };
}