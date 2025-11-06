import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { complaint_reference, key_findings, actions_taken, improvements_made, additional_context } = await req.json()

    console.log('📝 Managing demo response for:', complaint_reference)

    // Check if demo response already exists
    const { data: existing, error: checkError } = await supabaseClient
      .from('complaint_demo_responses')
      .select('*')
      .eq('complaint_reference', complaint_reference)
      .maybeSingle()

    if (checkError) {
      console.error('❌ Error checking existing demo response:', checkError)
      throw checkError
    }

    let result

    if (existing) {
      // Update existing demo response
      console.log('🔄 Updating existing demo response')
      const { data, error } = await supabaseClient
        .from('complaint_demo_responses')
        .update({
          key_findings,
          actions_taken,
          improvements_made,
          additional_context
        })
        .eq('complaint_reference', complaint_reference)
        .select()
        .single()

      if (error) throw error
      result = data
    } else {
      // Insert new demo response
      console.log('➕ Creating new demo response')
      const { data, error } = await supabaseClient
        .from('complaint_demo_responses')
        .insert({
          complaint_reference,
          key_findings,
          actions_taken,
          improvements_made,
          additional_context
        })
        .select()
        .single()

      if (error) throw error
      result = data
    }

    console.log('✅ Demo response saved successfully')

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Error in manage-demo-responses function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
