import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MedicineRow {
  name: string;
  bnf_chapter: string | null;
  status_raw: string;
  status_enum: "DOUBLE_RED"|"RED"|"SPECIALIST_INITIATED"|"SPECIALIST_RECOMMENDED"|"AMBER_1"|"AMBER_2"|"GREEN"|"GREY"|"UNKNOWN";
  detail_url: string;
  last_modified: string | null;
}

async function scrapeIndexPage(html: string, baseUrl: string): Promise<MedicineRow[]> {
  const medicines: MedicineRow[] = [];
  
  try {
    // Find all medicine links using the pattern from the comprehensive scraper
    const linkRegex = /<a[^>]*href="([^"]*\/trafficlightdrugs\/\?testid=[^"]*)"[^>]*>([^<]+)<\/a>/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const name = match[2].trim();
      
      if (!name) continue;
      
      // Find the surrounding context to extract BNF chapter and status
      const linkStart = match.index;
      const contextStart = Math.max(0, linkStart - 300);
      const contextEnd = Math.min(html.length, linkStart + match[0].length + 300);
      const context = html.substring(contextStart, contextEnd);
      
      // Extract text content and clean it up
      const textContent = context
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Parse the pattern: "Name  NN - Chapter Status"
      const nameIndex = textContent.indexOf(name);
      if (nameIndex === -1) continue;
      
      const afterName = textContent.substring(nameIndex + name.length).trim();
      
      // Match BNF chapter and status using comprehensive pattern
      const match2 = afterName.match(/^([0-9]{2}\s*-\s*[^]+?)\s+(.+?)$/);
      const bnfChapter = match2?.[1]?.trim() ?? null;
      const statusRaw = match2?.[2]?.trim() ?? "Unknown";
      
      medicines.push({
        name: name,
        bnf_chapter: bnfChapter,
        status_raw: statusRaw,
        status_enum: toStatusEnum(statusRaw),
        detail_url: new URL(href, baseUrl).toString(),
        last_modified: null
      });
    }
    
  } catch (error) {
    console.error('Error parsing page HTML:', error);
  }
  
  return medicines;
}

function toStatusEnum(statusText: string): MedicineRow["status_enum"] {
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

async function hydrateDetails(medicines: MedicineRow[]): Promise<void> {
  console.log(`Hydrating details for ${medicines.length} medicines...`);
  
  for (let i = 0; i < medicines.length; i++) {
    const med = medicines[i];
    
    try {
      const response = await fetch(med.detail_url);
      if (!response.ok) continue;
      
      const html = await response.text();
      
      // Extract "Record last modified" information
      const lastModRegex = /Record last modified[:\s]*([^<\n\r]+)/i;
      const match = html.match(lastModRegex);
      if (match) {
        med.last_modified = match[1].trim();
      }
      
      // Sometimes detail page has clearer status information
      const detailText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
      const statusMatch = detailText.match(/(double red|red|specialist initiated|specialist recommended|amber ?[12]|green|grey)/i);
      if (statusMatch) {
        const betterStatus = statusMatch[0];
        med.status_enum = toStatusEnum(betterStatus);
        med.status_raw = betterStatus;
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`Error fetching details for ${med.name}:`, error);
      continue;
    }
  }
}

function parseISODate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  
  try {
    // Clean up the date string
    const cleaned = dateStr.replace(/[^\d\/\-\.\s]/g, '').trim();
    if (!cleaned) return null;
    
    const date = new Date(cleaned);
    if (isNaN(date.getTime())) return null;
    
    return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
  } catch {
    return null;
  }
}

async function importAllMedicines() {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const allMedicines: MedicineRow[] = [];
  const BASE_URL = 'https://www.icnorthamptonshire.org.uk/trafficlightdrugs';
  
  console.log('Starting comprehensive import of all 30 pages...');
  
  // Scrape all 30 pages following the comprehensive approach
  for (let page = 1; page <= 30; page++) {
    console.log(`Scraping page ${page}/30...`);
    
    const url = page === 1 ? BASE_URL : `${BASE_URL}/?pag_page=${page}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch page ${page}: ${response.status}`);
        continue;
      }
      
      const html = await response.text();
      const medicines = await scrapeIndexPage(html, BASE_URL);
      console.log(`Found ${medicines.length} medicines on page ${page}`);
      
      allMedicines.push(...medicines);
      
      // Small delay to be respectful to the server
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Error scraping page ${page}:`, error);
      continue;
    }
  }
  
  console.log(`Total medicines found: ${allMedicines.length}`);
  
  // Hydrate with details from individual pages (sample first 50 to get last_modified dates)
  console.log('Hydrating with detail page information...');
  await hydrateDetails(allMedicines.slice(0, 50));
  
  // Remove duplicates based on name (case-insensitive)
  const seen = new Set<string>();
  const uniqueMedicines = allMedicines.filter(med => {
    const key = med.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  console.log(`Unique medicines after deduplication: ${uniqueMedicines.length}`);
  
  // Clear existing data
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting comprehensive traffic light medicines import...');
    
    const result = await importAllMedicines();

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
    
  } catch (error) {
    console.error('Import failed:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
})