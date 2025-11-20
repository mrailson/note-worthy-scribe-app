import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { assessmentId, registrationId } = await req.json()

    if (!assessmentId || !registrationId) {
      throw new Error('Missing required parameters')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify assessment exists and was passed
    const { data: assessment, error: assessmentError } = await supabaseClient
      .from('cso_assessments')
      .select('*')
      .eq('id', assessmentId)
      .eq('registration_id', registrationId)
      .single()

    if (assessmentError || !assessment) {
      throw new Error('Assessment not found')
    }

    if (!assessment.passed) {
      throw new Error('Assessment must be passed to generate certificate')
    }

    // Check if certificate already exists
    const { data: existing } = await supabaseClient
      .from('cso_certificates')
      .select('*')
      .eq('assessment_id', assessmentId)
      .single()

    if (existing) {
      return new Response(
        JSON.stringify({ certificate: existing }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate certificate number
    const year = new Date().getFullYear()
    
    // Get the max certificate number for this year
    const { data: maxCert } = await supabaseClient
      .from('cso_certificates')
      .select('certificate_number')
      .like('certificate_number', `CSO-${year}-%`)
      .order('certificate_number', { ascending: false })
      .limit(1)
      .single()

    let nextNumber = 1
    if (maxCert && maxCert.certificate_number) {
      const parts = maxCert.certificate_number.split('-')
      if (parts.length === 3) {
        nextNumber = parseInt(parts[2]) + 1
      }
    }

    const certificateNumber = `CSO-${year}-${nextNumber.toString().padStart(5, '0')}`

    // Create certificate record
    const { data: certificate, error: certError } = await supabaseClient
      .from('cso_certificates')
      .insert({
        registration_id: registrationId,
        assessment_id: assessmentId,
        certificate_number: certificateNumber,
        issued_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single()

    if (certError) {
      throw certError
    }

    console.log('Certificate generated:', certificateNumber)

    return new Response(
      JSON.stringify({ certificate }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
