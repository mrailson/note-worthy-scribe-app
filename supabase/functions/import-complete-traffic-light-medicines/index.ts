import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Medicine {
  name: string
  bnf_chapter: string
  status_enum: string
  status_raw: string
  detail_url: string
  testid: string
}

async function fetchPageMedicines(pageNum: number): Promise<Medicine[]> {
  const url = `https://www.icnorthamptonshire.org.uk/trafficlightdrugs/?pag_page=${pageNum}`
  
  console.log(`Fetching page ${pageNum}: ${url}`)
  
  try {
    const response = await fetch(url)
    const html = await response.text()
    
    const medicines: Medicine[] = []
    
    // Parse the HTML more carefully - look for table data with medicine info
    // Find the main table and extract rows
    const tableMatch = html.match(/<table[^>]*>(.*?)<\/table>/s)
    if (!tableMatch) {
      console.log(`No table found on page ${pageNum}`)
      return []
    }
    
    const tableContent = tableMatch[1]
    const rows = tableContent.split(/<\/?tr[^>]*>/i).filter(row => row.trim() && row.includes('testid'))
    
    for (const row of rows) {
      try {
        // Extract medicine data more carefully
        const testidMatch = row.match(/testid=(\d+)/)
        const nameMatch = row.match(/<a[^>]*testid=\d+[^>]*>([^<]+)<\/a>/i)
        
        // Look for BNF chapter in table cells
        const cellMatches = row.match(/<td[^>]*>([^<]*)<\/td>/gi)
        
        if (testidMatch && nameMatch && cellMatches && cellMatches.length >= 4) {
          const testid = testidMatch[1]
          const name = nameMatch[1].trim()
          
          // Extract data from table cells
          const bnfCell = cellMatches[1] ? cellMatches[1].replace(/<[^>]*>/g, '').trim() : ''
          const statusCell = cellMatches[3] ? cellMatches[3].replace(/<[^>]*>/g, '').trim() : ''
          
          if (bnfCell && statusCell) {
            // Map status to enum values
            let statusEnum = 'UNKNOWN'
            const statusLower = statusCell.toLowerCase()
            
            if (statusLower.includes('double red')) {
              statusEnum = 'DOUBLE_RED'
            } else if (statusLower.includes('red')) {
              statusEnum = 'RED'
            } else if (statusLower.includes('specialist initiated')) {
              statusEnum = 'SPECIALIST_INITIATED'
            } else if (statusLower.includes('specialist recommended')) {
              statusEnum = 'SPECIALIST_RECOMMENDED'
            } else if (statusLower.includes('grey')) {
              statusEnum = 'GREY'
            } else if (statusLower.includes('amber')) {
              statusEnum = 'SPECIALIST_INITIATED' // Treat amber as specialist initiated
            }
            
            medicines.push({
              name: name,
              bnf_chapter: bnfCell,
              status_enum: statusEnum,
              status_raw: statusCell,
              detail_url: `https://www.icnorthamptonshire.org.uk/trafficlightdrugs/?testid=${testid}`,
              testid: testid
            })
          }
        }
      } catch (rowError) {
        console.log(`Error processing row on page ${pageNum}:`, rowError)
        continue
      }
    }
    
    console.log(`Page ${pageNum}: Found ${medicines.length} medicines`)
    return medicines
    
  } catch (error) {
    console.error(`Error fetching page ${pageNum}:`, error)
    return []
  }
}

async function importAllMedicines() {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
  
  console.log('Starting comprehensive medicine import...')
  
  // Clear existing data
  const { error: deleteError } = await supabase
    .from('traffic_light_medicines')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all
    
  if (deleteError) {
    console.error('Error clearing existing medicines:', deleteError)
  } else {
    console.log('Cleared existing medicines')
  }
  
  const allMedicines: Medicine[] = []
  
  // Fetch all 30 pages
  for (let page = 1; page <= 30; page++) {
    const pageMedicines = await fetchPageMedicines(page)
    allMedicines.push(...pageMedicines)
    
    // Add small delay to be respectful to the server
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  
  console.log(`Total medicines collected: ${allMedicines.length}`)
  
  // Remove duplicates based on testid
  const uniqueMedicines = allMedicines.filter((medicine, index, self) => 
    index === self.findIndex(m => m.testid === medicine.testid)
  )
  
  console.log(`Unique medicines after deduplication: ${uniqueMedicines.length}`)
  
  // Insert in batches of 100
  const batchSize = 100
  let totalInserted = 0
  
  for (let i = 0; i < uniqueMedicines.length; i += batchSize) {
    const batch = uniqueMedicines.slice(i, i + batchSize)
    
    const { data, error } = await supabase
      .from('traffic_light_medicines')
      .insert(batch.map(medicine => ({
        name: medicine.name,
        bnf_chapter: medicine.bnf_chapter,
        status_enum: medicine.status_enum,
        status_raw: medicine.status_raw,
        detail_url: medicine.detail_url,
        notes: `Imported from Northamptonshire ICB (testid: ${medicine.testid})`
      })))
    
    if (error) {
      console.error(`Error inserting batch ${Math.floor(i/batchSize) + 1}:`, error)
    } else {
      totalInserted += batch.length
      console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}: ${batch.length} medicines (Total: ${totalInserted})`)
    }
  }
  
  console.log(`Import complete! Total medicines imported: ${totalInserted}`)
  return { success: true, imported: totalInserted, total_collected: uniqueMedicines.length }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting traffic light medicines import...')
    
    // Start the import as a background task
    const importPromise = importAllMedicines()
    
    // Use waitUntil to ensure the function stays alive until import completes
    if (typeof EdgeRuntime !== 'undefined') {
      EdgeRuntime.waitUntil(importPromise)
    }
    
    // Return immediate response
    return new Response(
      JSON.stringify({ 
        message: 'Import started for all 30 pages (~886 medicines)', 
        status: 'processing' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
    
  } catch (error) {
    console.error('Error starting import:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})