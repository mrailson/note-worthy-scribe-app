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

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const fileData = files[fileIndex]
      const { fileName, content } = fileData
      
      const actualFileName = fileName || `File_${fileIndex + 1}.json`
      
      try {
        // Parse JSON content
        const jsonData = JSON.parse(content)
        console.log(`Processing file: ${actualFileName}, type: ${typeof jsonData}, isArray: ${Array.isArray(jsonData)}`)
        
        if (!Array.isArray(jsonData)) {
          console.log(`File ${actualFileName} content preview:`, JSON.stringify(jsonData).substring(0, 200))
          results.push({
            file: actualFileName,
            status: 'error',
            message: 'File content must be an array of objects'
          })
          continue
        }

        let fileInserted = 0
        let fileUpdated = 0

        console.log(`File ${actualFileName} contains ${jsonData.length} items`)

        // Process each item in the JSON array
        for (const item of jsonData) {
          console.log(`Processing item:`, Object.keys(item))
          
          // Try different possible field names for drug name
          const drugName = item.drug_name || item.name || item.medicine_name || item.drug || item.medication

          if (!drugName) {
            console.warn(`Skipping item without drug name in ${actualFileName}. Available fields:`, Object.keys(item))
            continue
          }

          console.log(`Processing drug: ${drugName}`)

          // Insert or update prior approval criteria
          if (item.prior_approval_criteria && Array.isArray(item.prior_approval_criteria)) {
            for (const criteria of item.prior_approval_criteria) {
              const { data: existingData, error: checkError } = await supabase
                .from('prior_approval_criteria')
                .select('id')
                .eq('drug_name_norm', drugName.toLowerCase().replace(/[^a-z0-9]/g, ''))
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
                    last_scraped: new Date().toISOString()
                  })
                  .eq('id', existingData.id)

                if (updateError) {
                  console.error(`Error updating criteria for ${drugName}:`, updateError)
                } else {
                  fileUpdated++
                  console.log(`Updated criteria for ${drugName}`)
                }
              } else {
                // Insert new record
                const { error: insertError } = await supabase
                  .from('prior_approval_criteria')
                  .insert({
                    drug_name_norm: drugName.toLowerCase().replace(/[^a-z0-9]/g, ''),
                    criteria_text: criteria.criteria_text || '',
                    category: criteria.category,
                    application_route: criteria.application_route,
                    application_url: criteria.application_url,
                    evidence_required: criteria.evidence_required,
                    icb_version: criteria.icb_version || 'August 2025',
                    icb_pdf_url: criteria.icb_pdf_url || 'https://www.icnorthamptonshire.org.uk/mo-prior-approval?media_item=22499&media_type=10#file-viewer'
                  })

                if (insertError) {
                  console.error(`Error inserting criteria for ${drugName}:`, insertError)
                } else {
                  fileInserted++
                  console.log(`Inserted criteria for ${drugName}`)
                }
              }
            }
          }

          // Helper function to map status values to enum values
          const mapStatusToEnum = (status) => {
            if (!status) return null;
            const statusStr = status.toString().toLowerCase().trim();
            
            switch (statusStr) {
              case 'double red':
              case 'double_red':
                return 'DOUBLE_RED';
              case 'red':
                return 'RED';
              case 'specialist initiated':
              case 'specialist_initiated':
                return 'SPECIALIST_INITIATED';
              case 'specialist recommended':
              case 'specialist_recommended':
                return 'SPECIALIST_RECOMMENDED';
              case 'amber 1':
              case 'amber_1':
              case 'amber1':
                return 'AMBER_1';
              case 'amber 2':
              case 'amber_2':
              case 'amber2':
                return 'AMBER_2';
              case 'green':
                return 'GREEN';
              case 'grey':
              case 'gray':
                return 'GREY';
              case 'unknown':
                return 'UNKNOWN';
              default:
                console.warn(`Unknown status value: ${status}, defaulting to UNKNOWN`);
                return 'UNKNOWN';
            }
          };

          // Update or insert traffic light data if provided
          const rawTrafficLightStatus = item.traffic_light_status || item.status || item.traffic_light
          const trafficLightStatus = mapStatusToEnum(rawTrafficLightStatus)
          if (trafficLightStatus) {
            const { data: existingTL, error: tlCheckError } = await supabase
              .from('traffic_light_medicines')
              .select('id')
              .eq('name', drugName)
              .single()

            if (existingTL) {
              // Update existing traffic light record
              const { error: updateTLError } = await supabase
                .from('traffic_light_medicines')
                .update({
                  status_enum: trafficLightStatus,
                  status_raw: rawTrafficLightStatus,
                  notes: item.notes,
                  bnf_chapter: item.bnf_chapter,
                  detail_url: item.detail_url,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingTL.id)

              if (updateTLError) {
                console.error(`Error updating traffic light for ${drugName}:`, updateTLError)
              } else {
                console.log(`Updated traffic light for ${drugName}`)
              }
            } else if (trafficLightStatus !== 'UNKNOWN') {
              // Insert new traffic light record only if status is not UNKNOWN
              const { error: insertTLError } = await supabase
                .from('traffic_light_medicines')
                .insert({
                  name: drugName,
                  status_enum: trafficLightStatus,
                  status_raw: rawTrafficLightStatus,
                  notes: item.notes,
                  bnf_chapter: item.bnf_chapter,
                  detail_url: item.detail_url
                })

              if (insertTLError) {
                console.error(`Error inserting traffic light for ${drugName}:`, insertTLError)
              } else {
                console.log(`Inserted traffic light for ${drugName}`)
              }
            }
          }
        }

        totalInserted += fileInserted
        totalUpdated += fileUpdated

        results.push({
          file: actualFileName,
          status: 'success',
          inserted: fileInserted,
          updated: fileUpdated,
          processed: jsonData.length
        })

        console.log(`File ${actualFileName} processed: ${fileInserted} inserted, ${fileUpdated} updated`)

      } catch (parseError) {
        console.error(`Error processing file ${actualFileName}:`, parseError)
        results.push({
          file: actualFileName,
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