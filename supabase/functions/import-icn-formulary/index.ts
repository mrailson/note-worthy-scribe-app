import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FormularyItem {
  bnf_chapter_code: string | null;
  bnf_chapter_name: string;
  section: string;
  item_name: string;
  preference_rank: number | null;
  is_preferred: boolean;
  otc: boolean;
  notes: string | null;
  page_url: string;
  last_published: string | null;
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
  console.log('Fetching formulary page...');
  
  const url = 'https://www.icnorthamptonshire.org.uk/mo-formulary';
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch formulary: ${response.status} ${response.statusText}`);
  }
  
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('Parsing formulary data...');
  
  const items: FormularyItem[] = [];
  let lastPublished: string | null = null;
  
  // Extract "Last published" date
  $('p, div, span').each((_, element) => {
    const text = $(element).text();
    const dateMatch = text.match(/Last published[:\s]*(\d{1,2}\s+\w+\s+\d{4}(?:\s+\d{1,2}:\d{2})?)/i);
    if (dateMatch) {
      lastPublished = dateMatch[1];
      console.log('Found last published date:', lastPublished);
    }
  });
  
  // Parse the formulary structure
  let currentChapter = '';
  let currentSection = '';
  let currentChapterCode: string | null = null;
  
  // Look for main content sections
  $('h2, h3, h4, ul, ol').each((_, element) => {
    const $el = $(element);
    const tagName = element.tagName.toLowerCase();
    const text = $el.text().trim();
    
    if (tagName === 'h2') {
      // This is likely a BNF chapter
      currentChapter = text;
      currentSection = '';
      
      // Try to extract BNF chapter code (e.g., "01 - Gastro-intestinal system")
      const chapterMatch = text.match(/^(\d+)\s*[-–]\s*(.+)$/);
      if (chapterMatch) {
        currentChapterCode = chapterMatch[1];
        currentChapter = chapterMatch[2].trim();
      } else {
        currentChapterCode = null;
      }
      
      console.log(`Found chapter: ${currentChapter} (code: ${currentChapterCode})`);
    } else if (tagName === 'h3' || tagName === 'h4') {
      // This is likely a section within a chapter
      currentSection = text;
      console.log(`Found section: ${currentSection}`);
    } else if ((tagName === 'ul' || tagName === 'ol') && currentChapter && currentSection) {
      // Parse list items as formulary entries
      let rank = 1;
      
      $el.find('li').each((_, li) => {
        const $li = $(li);
        const itemText = $li.text().trim();
        
        if (!itemText || itemText.length < 3) return;
        
        // Skip if this looks like a sub-list or note
        if (itemText.toLowerCase().startsWith('note:') || 
            itemText.toLowerCase().startsWith('see also:')) {
          return;
        }
        
        // Parse the item
        let itemName = itemText;
        let notes: string | null = null;
        let otc = false;
        let isPreferred = true;
        let currentRank = rank;
        
        // Check for OTC marker
        if (itemText.toLowerCase().includes('otc') || itemText.toLowerCase().includes('over the counter')) {
          otc = true;
        }
        
        // Check for special markers that indicate non-preferred status
        if (itemText.toLowerCase().includes('only if') || 
            itemText.toLowerCase().includes('second line') ||
            itemText.toLowerCase().includes('alternative')) {
          isPreferred = false;
          currentRank = 2;
        }
        
        // Extract notes (typically in parentheses or after certain markers)
        const noteMatch = itemText.match(/(.+?)[\s]*[\(]([^)]+)[\)]/);
        if (noteMatch) {
          itemName = noteMatch[1].trim();
          notes = noteMatch[2];
        }
        
        // Clean up item name
        itemName = itemName
          .replace(/\s*\([^)]*\)\s*/g, '') // Remove parenthetical content already extracted
          .replace(/\s*–\s*.+$/, '') // Remove everything after em-dash
          .replace(/\s*-\s*.+$/, '') // Remove everything after regular dash if it looks like a note
          .trim();
        
        if (itemName && itemName.length > 2) {
          items.push({
            bnf_chapter_code: currentChapterCode,
            bnf_chapter_name: currentChapter,
            section: currentSection,
            item_name: itemName,
            preference_rank: isPreferred ? currentRank : null,
            is_preferred: isPreferred,
            otc: otc,
            notes: notes,
            page_url: url,
            last_published: lastPublished
          });
          
          console.log(`Added item: ${itemName} (rank: ${currentRank}, preferred: ${isPreferred})`);
        }
        
        rank++;
      });
    }
  });
  
  console.log(`Parsed ${items.length} formulary items`);
  
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