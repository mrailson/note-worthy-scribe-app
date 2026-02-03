import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrafficLightDrug {
  name: string;
  status_enum: string;
  status_raw?: string;
  bnf_chapter?: string;
  detail_url?: string;
  notes?: string;
  prior_approval_url?: string;
}

// Map raw status text to standardised enum
function mapStatusToEnum(statusText: string): string {
  const lower = statusText.toLowerCase();
  
  if (lower.includes('double red') || lower.includes('double-red')) {
    return 'DOUBLE_RED';
  }
  if (lower.includes('red') && !lower.includes('double')) {
    return 'RED';
  }
  if (lower.includes('amber 2') || lower.includes('amber2') || lower.includes('amber-2')) {
    return 'AMBER_2';
  }
  if (lower.includes('amber 1') || lower.includes('amber1') || lower.includes('amber-1')) {
    return 'AMBER_1';
  }
  if (lower.includes('amber')) {
    return 'AMBER_1';
  }
  if (lower.includes('green')) {
    return 'GREEN';
  }
  if (lower.includes('specialist') || lower.includes('hospital only')) {
    return 'SPECIALIST_INITIATED';
  }
  
  return 'UNKNOWN';
}

// Parse drugs from HTML - look for table rows or list items with drug info
function parseDrugsFromHtml(html: string, letter: string): TrafficLightDrug[] {
  const drugs: TrafficLightDrug[] = [];
  
  // Look for drug entries in list items with traffic light links
  const listItemPattern = /<li[^>]*>[\s\S]*?<a[^>]*href="([^"]*trafficlightdrugs[^"]*)"[^>]*>([^<]+)<\/a>[\s\S]*?<\/li>/gi;
  let match;
  
  while ((match = listItemPattern.exec(html)) !== null) {
    const itemHtml = match[0];
    const drugUrl = match[1];
    const drugName = match[2]?.trim();
    
    // Look for status/colour indicators in the row
    const statusMatch = itemHtml.match(/(GREEN|RED|AMBER\s*[12]?|DOUBLE\s*RED)/i);
    const colourClassMatch = itemHtml.match(/class="[^"]*(?:traffic-light-|status-|colour-)(green|red|amber|double-red)[^"]*"/i) ||
                             itemHtml.match(/style="[^"]*background[^:]*:\s*#?(green|red|amber|ff0000|00ff00|ffa500)[^"]*"/i);
    
    if (drugName && drugName.length > 2) {
      // Skip navigation and generic items
      if (drugName.match(/^(BNF|Chapter|Section|Page|Home|Contact|Back|Print|Email|Site|Skip|Cookie|English|Search|Medical Test|Contrast)/i)) continue;
      if (drugName.match(/^[A-Z]$|^\d+$/)) continue;
      if (drugName.length > 200) continue; // Too long, probably not a drug name
      
      let status = 'UNKNOWN';
      let statusRaw: string | undefined;
      
      if (statusMatch) {
        status = mapStatusToEnum(statusMatch[1]);
        statusRaw = statusMatch[1];
      } else if (colourClassMatch) {
        const colourText = colourClassMatch[1].toLowerCase();
        if (colourText.includes('green')) {
          status = 'GREEN';
          statusRaw = 'green';
        } else if (colourText.includes('double')) {
          status = 'DOUBLE_RED';
          statusRaw = 'double red';
        } else if (colourText.includes('red')) {
          status = 'RED';
          statusRaw = 'red';
        } else if (colourText.includes('amber') || colourText.includes('orange')) {
          status = 'AMBER_1';
          statusRaw = 'amber';
        }
      }
      
      const exists = drugs.some(d => d.name.toLowerCase() === drugName.toLowerCase());
      if (!exists) {
        drugs.push({
          name: drugName,
          status_enum: status,
          status_raw: statusRaw,
          detail_url: drugUrl.startsWith('http') ? drugUrl : `https://www.icnorthamptonshire.org.uk${drugUrl}`,
        });
      }
    }
  }
  
  // Also try table rows
  const tableRowPattern = /<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?<a[^>]*href="([^"]*trafficlightdrugs[^"]*)"[^>]*>([^<]+)<\/a>[\s\S]*?<\/tr>/gi;
  
  while ((match = tableRowPattern.exec(html)) !== null) {
    const rowHtml = match[0];
    const drugUrl = match[1];
    const drugName = match[2]?.trim();
    
    const statusMatch = rowHtml.match(/(GREEN|RED|AMBER\s*[12]?|DOUBLE\s*RED)/i);
    const colourMatch = rowHtml.match(/class="[^"]*(?:traffic-light-|status-|colour-)(green|red|amber|double-red)[^"]*"/i);
    
    if (drugName && drugName.length > 2) {
      if (drugName.match(/^(BNF|Chapter|Section|Page|Home|Contact|Back|Print|Email|Site|Skip|Cookie)/i)) continue;
      if (drugName.match(/^[A-Z]$|^\d+$/)) continue;
      
      let status = 'UNKNOWN';
      let statusRaw: string | undefined;
      
      if (statusMatch) {
        status = mapStatusToEnum(statusMatch[1]);
        statusRaw = statusMatch[1];
      } else if (colourMatch) {
        status = mapStatusToEnum(colourMatch[1]);
        statusRaw = colourMatch[1];
      }
      
      const exists = drugs.some(d => d.name.toLowerCase() === drugName.toLowerCase());
      if (!exists) {
        drugs.push({
          name: drugName,
          status_enum: status,
          status_raw: statusRaw,
          detail_url: drugUrl.startsWith('http') ? drugUrl : `https://www.icnorthamptonshire.org.uk${drugUrl}`,
        });
      }
    }
  }
  
  return drugs;
}

// Scrape a single letter and return results
async function scrapeLetter(letter: string, apiKey: string): Promise<TrafficLightDrug[]> {
  const url = `https://www.icnorthamptonshire.org.uk/trafficlightdrugs/?letter=${letter}`;
  
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['html'],
        onlyMainContent: false,
        waitFor: 2000,
      }),
    });

    if (!response.ok) {
      console.warn(`Failed to scrape letter ${letter}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const html = data.data?.html || '';
    
    return parseDrugsFromHtml(html, letter);
  } catch (err) {
    console.error(`Error scraping letter ${letter}:`, err);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    if (!FIRECRAWL_API_KEY) {
      throw new Error('FIRECRAWL_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { dryRun = false, letter = null, batch = null } = await req.json().catch(() => ({}));

    console.log('Starting ICB Traffic Light scrape...', { dryRun, letter, batch });

    // Determine which letters to scrape
    let letters: string[];
    if (letter) {
      letters = [letter.toUpperCase()];
    } else if (batch) {
      // Process in batches: 1 = A-F, 2 = G-L, 3 = M-R, 4 = S-Z
      const batches: Record<number, string[]> = {
        1: ['A', 'B', 'C', 'D', 'E', 'F'],
        2: ['G', 'H', 'I', 'J', 'K', 'L'],
        3: ['M', 'N', 'O', 'P', 'Q', 'R'],
        4: ['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
      };
      letters = batches[batch] || [];
    } else {
      // Default: all letters
      letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    }

    const allDrugs: TrafficLightDrug[] = [];
    const rawMarkdowns: Record<string, string> = {};
    
    // Scrape each letter page with rate limiting
    for (const l of letters) {
      console.log(`Scraping letter ${l}...`);
      
      const drugsFromPage = await scrapeLetter(l, FIRECRAWL_API_KEY);
      console.log(`Letter ${l}: found ${drugsFromPage.length} drugs`);
      
      allDrugs.push(...drugsFromPage);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`Total drugs found: ${allDrugs.length}`);

    // Deduplicate by name
    const uniqueDrugs = allDrugs.filter((drug, index, self) => 
      index === self.findIndex(d => d.name.toLowerCase() === drug.name.toLowerCase())
    );

    console.log(`Unique drugs after dedup: ${uniqueDrugs.length}`);

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          drugsFound: uniqueDrugs.length,
          sampleDrugs: uniqueDrugs.slice(0, 50),
          lettersScraped: letters.length,
          letters: letters,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the database
    if (uniqueDrugs.length > 0) {
      // If scraping a specific batch, don't clear - just upsert
      if (!batch && !letter) {
        // Full scrape - clear existing data first
        const { error: deleteError } = await supabase
          .from('traffic_light_medicines')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (deleteError) {
          console.error('Error clearing table:', deleteError);
        }
      }

      // Insert/upsert in batches
      const batchSize = 50;
      let inserted = 0;
      
      for (let i = 0; i < uniqueDrugs.length; i += batchSize) {
        const drugBatch = uniqueDrugs.slice(i, i + batchSize).map(drug => ({
          name: drug.name,
          status_enum: drug.status_enum,
          status_raw: drug.status_raw,
          bnf_chapter: drug.bnf_chapter,
          detail_url: drug.detail_url,
          notes: drug.notes,
          prior_approval_url: drug.prior_approval_url,
        }));

        const { error: insertError } = await supabase
          .from('traffic_light_medicines')
          .upsert(drugBatch, { onConflict: 'name' });

        if (insertError) {
          console.error('Error inserting batch:', insertError);
          // Try individual inserts
          for (const drug of drugBatch) {
            const { error } = await supabase
              .from('traffic_light_medicines')
              .upsert(drug, { onConflict: 'name' });
            if (!error) inserted++;
          }
        } else {
          inserted += drugBatch.length;
        }
      }

      console.log(`Inserted/updated ${inserted} drugs into database`);

      return new Response(
        JSON.stringify({
          success: true,
          drugsFound: uniqueDrugs.length,
          drugsInserted: inserted,
          lettersProcessed: letters,
          message: `Successfully updated traffic light medicines database with ${inserted} entries from letters ${letters.join(', ')}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        drugsFound: 0,
        lettersProcessed: letters,
        message: 'No drugs found during scrape - manual review required',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scrape error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
