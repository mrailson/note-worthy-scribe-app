import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Item = {
  drug_name: string;
  status: string;
  prior_approval_required: "No" | "Yes" | "IFR" | "Blueteq" | "N/A";
  notes_restrictions: string;
  therapeutic_area: string;      // BNF chapter shown by ICB page
  icb_region: string;            // "NHS Northamptonshire ICB"
  source_document: string;       // "ICB Traffic Light Drugs (Primary Care)"
  source_page: string;           // "Page X of 30"
  last_reviewed_date: string;    // YYYY-MM-DD
};

const ROOT = "https://www.icnorthamptonshire.org.uk/trafficlightdrugs";
const PAGES = 30; // The page shows "Page 1 of 30 ... Total results: 886"

const ascii = (s: string) =>
  s.replace(/[–—-‒−]/g, "-")
   .replace(/[""]/g, '"')
   .replace(/['']/g, "'")
   .replace(/®|™/g, "")
   .replace(/\u00a0/g, " ")
   .replace(/\s+/g, " ")
   .trim();

function mapStatus(rowTxt: string): string {
  const t = rowTxt.toLowerCase();
  // Order matters to catch specific tags first
  if (t.includes("double red")) return "Double Red";
  if (t.includes("amber 2")) return "Amber 2";
  if (t.includes("amber 1")) return "Amber 1";
  if (t.includes("specialist initiated")) return "Specialist Initiated";
  if (t.includes("specialist recommended")) return "Specialist Recommended";
  if (t.includes("red")) return "Red";
  if (t.includes("green")) return "Green";
  if (t.includes("grey")) return "Grey";
  return "Formulary";
}

function paFlag(status: string): Item["prior_approval_required"] {
  const s = status.toLowerCase();
  if (s.includes("double red")) return "Yes";       // PA/IFR gateway
  if (s.includes("blueteq")) return "Blueteq";      // if present in text
  if (s.includes("ifr")) return "IFR";              // if present in text
  return "No";
}

async function fetchPage(n: number): Promise<string> {
  const url = n === 1 ? ROOT : `${ROOT}/?pag_page=${n}`;
  console.log(`Fetching page ${n}: ${url}`);
  
  try {
    const r = await fetch(url, { 
      cache: "no-store",
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!r.ok) throw new Error(`Fetch failed ${r.status} on page ${n}`);
    return await r.text();
  } catch (error) {
    console.error(`Error fetching page ${n}:`, error);
    throw error;
  }
}

// Parse the HTML to extract drug information
function parsePage(html: string, pageNum: number): Item[] {
  const text = ascii(html);
  const items: Item[] = [];

  // Look for drug entries in the HTML
  // The pattern seems to be drug names followed by status information
  // We'll use a more robust approach to extract the data
  
  // Find all lines that contain drug information
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for patterns that indicate a drug entry
    // This is a heuristic approach based on common HTML structures
    if (line.includes('href=') && (line.includes('red') || line.includes('amber') || line.includes('green') || line.includes('grey'))) {
      try {
        // Extract drug name from link text or nearby text
        const drugNameMatch = line.match(/>(.*?)</);
        if (!drugNameMatch || !drugNameMatch[1]) continue;
        
        let drugName = ascii(drugNameMatch[1]).trim();
        if (!drugName || drugName.length < 2) continue;
        
        // Get the context around this line to find status and other info
        const context = lines.slice(Math.max(0, i-2), Math.min(lines.length, i+3)).join(' ');
        
        const status = mapStatus(context);
        const priorApproval = paFlag(context);
        
        // Extract BNF chapter if available (usually appears as numbers like "03 - Respiratory system")
        const bnfMatch = context.match(/(\d{2})\s*-\s*([^<>\n]*)/);
        const therapeuticArea = bnfMatch ? `${bnfMatch[1]} - ${bnfMatch[2].trim()}` : "";
        
        // Extract any additional notes
        const notesRegex = /[Nn]otes?[:\s]([^<>\n]{10,})/;
        const notesMatch = context.match(notesRegex);
        const notes = notesMatch ? notesMatch[1].trim() : "";
        
        const item: Item = {
          drug_name: drugName,
          status: status,
          prior_approval_required: priorApproval,
          notes_restrictions: notes,
          therapeutic_area: therapeuticArea,
          icb_region: "NHS Northamptonshire ICB",
          source_document: "ICB Traffic Light Drugs (Primary Care)",
          source_page: `Page ${pageNum} of ${PAGES}`,
          last_reviewed_date: new Date().toISOString().split('T')[0]
        };
        
        items.push(item);
        
      } catch (error) {
        console.warn(`Error parsing line ${i} on page ${pageNum}:`, error);
        continue;
      }
    }
  }
  
  console.log(`Parsed ${items.length} items from page ${pageNum}`);
  return items;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting ICB Traffic Light Drugs fetch...');
    
    const allItems: Item[] = [];
    
    // Fetch all pages
    for (let page = 1; page <= PAGES; page++) {
      try {
        const html = await fetchPage(page);
        const items = parsePage(html, page);
        allItems.push(...items);
        
        // Add a small delay to be respectful to the server
        if (page < PAGES) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`Failed to process page ${page}:`, error);
        // Continue with other pages even if one fails
        continue;
      }
    }
    
    console.log(`Successfully scraped ${allItems.length} total items from ${PAGES} pages`);
    
    // Remove duplicates based on drug name
    const uniqueItems = allItems.filter((item, index, self) => 
      index === self.findIndex(i => i.drug_name.toLowerCase() === item.drug_name.toLowerCase())
    );
    
    console.log(`After deduplication: ${uniqueItems.length} unique items`);
    
    // Format the response to match what the import function expects
    const response = {
      success: true,
      message: `Successfully fetched ${uniqueItems.length} traffic light drugs from ICB`,
      totalItems: uniqueItems.length,
      data: uniqueItems.map(item => ({
        drug_name: item.drug_name,
        traffic_light_status: item.status,
        notes: item.notes_restrictions,
        bnf_chapter: item.therapeutic_area,
        prior_approval_required: item.prior_approval_required === "Yes",
        source_document: item.source_document,
        icb_region: item.icb_region,
        last_reviewed: item.last_reviewed_date
      }))
    };
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error in fetch-icb-traffic-light-drugs function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});