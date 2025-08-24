import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { files } = await req.json()
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No files provided' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Processing ${files.length} files for prior approval data import`)

    let totalInserted = 0
    let totalUpdated = 0
    const results = []

    for (const fileData of files) {
      const { fileName, content } = fileData
      
      try {
        // Parse JSON content
        const jsonData = JSON.parse(content)
        console.log(`Processing file: ${fileName}`)
        
        if (!Array.isArray(jsonData)) {
          results.push({
            file: fileName,
            status: 'error',
            message: 'File content must be an array of objects'
          })
          continue
        }

        let fileInserted = 0
        let fileUpdated = 0

        // Process each item in the JSON array
        for (const item of jsonData) {
          // Validate required fields
          if (!item.drug_name) {
            console.warn(`Skipping item without drug_name in ${fileName}`)
            continue
          }

          // Insert or update prior approval criteria
          if (item.prior_approval_criteria && Array.isArray(item.prior_approval_criteria)) {
            for (const criteria of item.prior_approval_criteria) {
              const { data: existingData, error: checkError } = await supabase
                .from('prior_approval_criteria')
                .select('id')
                .eq('drug_name', item.drug_name)
                .eq('criteria_text', criteria.criteria_text || '')
                .single()

              if (existingData) {
                // Update existing record
                const { error: updateError } = await supabase
                  .from('prior_approval_criteria')
                  .update({
                    category: criteria.category,
                    application_route: criteria.application_route,
                    application_url: criteria.application_url,
                    evidence_required: criteria.evidence_required,
                    icb_version: criteria.icb_version || 'August 2025',
                    icb_pdf_url: criteria.icb_pdf_url,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', existingData.id)

                if (updateError) {
                  console.error(`Error updating criteria for ${item.drug_name}:`, updateError)
                } else {
                  fileUpdated++
                }
              } else {
                // Insert new record
                const { error: insertError } = await supabase
                  .from('prior_approval_criteria')
                  .insert({
                    drug_name: item.drug_name,
                    criteria_text: criteria.criteria_text || '',
                    category: criteria.category,
                    application_route: criteria.application_route,
                    application_url: criteria.application_url,
                    evidence_required: criteria.evidence_required,
                    icb_version: criteria.icb_version || 'August 2025',
                    icb_pdf_url: criteria.icb_pdf_url || 'https://www.icnorthamptonshire.org.uk/mo-prior-approval?media_item=22499&media_type=10#file-viewer'
                  })

                if (insertError) {
                  console.error(`Error inserting criteria for ${item.drug_name}:`, insertError)
                } else {
                  fileInserted++
                }
              }
            }
          }

          // Update or insert traffic light data if provided
          if (item.traffic_light_status) {
            const { data: existingTL, error: tlCheckError } = await supabase
              .from('icn_traffic_light_medicines')
              .select('id')
              .eq('drug_name', item.drug_name)
              .single()

            if (existingTL) {
              // Update existing traffic light record
              const { error: updateTLError } = await supabase
                .from('icn_traffic_light_medicines')
                .update({
                  status: item.traffic_light_status,
                  notes: item.notes,
                  bnf_chapter: item.bnf_chapter,
                  detail_url: item.detail_url,
                  status_tooltip: item.status_tooltip,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingTL.id)

              if (updateTLError) {
                console.error(`Error updating traffic light for ${item.drug_name}:`, updateTLError)
              }
            } else if (item.traffic_light_status !== 'UNKNOWN') {
              // Insert new traffic light record only if status is not UNKNOWN
              const { error: insertTLError } = await supabase
                .from('icn_traffic_light_medicines')
                .insert({
                  drug_name: item.drug_name,
                  status: item.traffic_light_status,
                  notes: item.notes,
                  bnf_chapter: item.bnf_chapter,
                  detail_url: item.detail_url,
                  status_tooltip: item.status_tooltip
                })

              if (insertTLError) {
                console.error(`Error inserting traffic light for ${item.drug_name}:`, insertTLError)
              }
            }
          }
        }

        totalInserted += fileInserted
        totalUpdated += fileUpdated

        results.push({
          file: fileName,
          status: 'success',
          inserted: fileInserted,
          updated: fileUpdated,
          processed: jsonData.length
        })

        console.log(`File ${fileName} processed: ${fileInserted} inserted, ${fileUpdated} updated`)

      } catch (parseError) {
        console.error(`Error processing file ${fileName}:`, parseError)
        results.push({
          file: fileName,
          status: 'error',
          message: `Failed to parse JSON: ${parseError.message}`
        })
      }
    }

    console.log(`Import complete: ${totalInserted} total inserted, ${totalUpdated} total updated`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Import completed successfully`,
        totalInserted,
        totalUpdated,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in import-prior-approval-data function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})