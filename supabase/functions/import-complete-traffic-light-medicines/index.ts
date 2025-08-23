import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

// Global progress tracking
let importProgress = {
  isRunning: false,
  currentPage: 0,
  totalPages: 30,
  foundMedicines: 0,
  importedMedicines: 0,
  status: 'idle' as 'idle' | 'scraping' | 'importing' | 'complete' | 'error',
  message: '',
  startTime: null as number | null
};

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

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  // Handle progress requests
  if (action === 'progress') {
    return new Response(JSON.stringify(importProgress), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if import is already running
    if (importProgress.isRunning) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Import already in progress',
        progress: importProgress
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Starting complete traffic light medicines import...');
    
    // Start background import
    const backgroundImport = async () => {
      try {
        const result = await importAllMedicines(supabase);
        importProgress.status = 'complete';
        importProgress.message = result.message;
        importProgress.isRunning = false;
      } catch (error) {
        importProgress.status = 'error';
        importProgress.message = error.message || 'Import failed';
        importProgress.isRunning = false;
      }
    };

    // Use background task
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(backgroundImport());
    } else {
      // Fallback for local development
      backgroundImport();
    }
    
    // Return immediate response
    return new Response(JSON.stringify({
      success: true,
      message: 'Import started in background. Use ?action=progress to check status.',
      progress: importProgress
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Import failed:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
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
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch page ${page}: ${response.status}`);
  }
  
  const html = await response.text();
  const $ = cheerio.load(html);
  const medicines: Medicine[] = [];

  $("a").each((_, a) => {
    const name = $(a).text().trim();
    const href = $(a).attr("href") || "";
    if (!href.includes("/trafficlightdrugs/?testid=")) return;

    // The line text looks like: "<name>  NN - Chapter <status>"
    const line = $(a).parent().text().replace(/\s+/g, " ").trim();
    const after = line.replace(name, "").trim(); // "03 - Respiratory system double red"
    const match = after.match(/^([0-9]{2}\s*-\s*[^]+?)\s+(.+?)$/);
    const bnf = match?.[1]?.trim() ?? null;
    const statusRaw = match?.[2]?.trim() ?? "Unknown";

    medicines.push({
      name,
      bnf_chapter: bnf,
      status_raw: statusRaw,
      status_enum: toStatusEnum(statusRaw),
      detail_url: new URL(href, BASE_URL).toString(),
      last_modified: null,
    });
  });

  return medicines;
}

async function importAllMedicines(supabase: any) {
  console.log('Starting scrape of all 30 pages...');
  
  // Initialize progress
  importProgress.isRunning = true;
  importProgress.currentPage = 0;
  importProgress.foundMedicines = 0;
  importProgress.importedMedicines = 0;
  importProgress.status = 'scraping';
  importProgress.message = 'Starting scrape...';
  importProgress.startTime = Date.now();
  
  const allMedicines: Medicine[] = [];
  
  // Scrape all 30 pages
  for (let page = 1; page <= 30; page++) {
    importProgress.currentPage = page;
    importProgress.message = `Scraping page ${page}/30...`;
    
    try {
      const medicines = await scrapePage(page);
      allMedicines.push(...medicines);
      importProgress.foundMedicines = allMedicines.length;
      console.log(`Page ${page}: Found ${medicines.length} medicines (total: ${allMedicines.length})`);
      
      // Small delay between pages
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error scraping page ${page}:`, error);
      continue;
    }
  }
  
  console.log(`Total medicines found: ${allMedicines.length}`);
  
  // Remove duplicates based on name (case-insensitive)
  const seen = new Set<string>();
  const uniqueMedicines = allMedicines.filter(med => {
    const key = med.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  console.log(`Unique medicines after deduplication: ${uniqueMedicines.length}`);
  
  // Update progress
  importProgress.status = 'importing';
  importProgress.message = 'Clearing existing data...';
  
  console.log('Clearing existing data...');
  const { error: deleteError } = await supabase
    .from('traffic_light_medicines')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
    
  if (deleteError) {
    console.error('Error clearing existing data:', deleteError);
  }
  
  // Insert new data in batches
  const batchSize = 100;
  let insertedCount = 0;
  
  for (let i = 0; i < uniqueMedicines.length; i += batchSize) {
    const batch = uniqueMedicines.slice(i, i + batchSize);
    
    importProgress.message = `Importing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(uniqueMedicines.length/batchSize)}...`;
    
    const { error: insertError } = await supabase
      .from('traffic_light_medicines')
      .insert(batch.map(med => ({
        name: med.name,
        status_enum: med.status_enum,
        bnf_chapter: med.bnf_chapter,
        detail_url: med.detail_url,
        notes: med.last_modified ? `Last modified: ${med.last_modified}` : null,
        status_raw: med.status_raw
      })));
      
    if (insertError) {
      console.error('Error inserting batch:', insertError);
    } else {
      insertedCount += batch.length;
      importProgress.importedMedicines = insertedCount;
      console.log(`Inserted batch: ${insertedCount}/${uniqueMedicines.length}`);
    }
  }

  return {
    success: true,
    message: `Successfully imported ${insertedCount} medicines from all 30 pages`,
    total_found: allMedicines.length,
    unique_count: uniqueMedicines.length,
    imported_count: insertedCount
  };
}