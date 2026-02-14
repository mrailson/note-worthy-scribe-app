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
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    let userId: string | null = null
    let userEmail: string | null = null

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error } = await supabaseClient.auth.getUser(token)
      
      if (user && !error) {
        userId = user.id
        userEmail = user.email || null
      }
    }

    // Parse request body
    const { 
      eventType, 
      severity = 'medium', 
      eventDetails = {},
      ipAddress = null,
      userAgent = null
    } = await req.json()

    // Validate required fields
    if (!eventType) {
      return new Response(
        JSON.stringify({ error: 'eventType is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get IP address from request if not provided
    const rawIP = ipAddress || req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    // x-forwarded-for can contain multiple comma-separated IPs; use only the first one
    const clientIP = rawIP.split(',')[0].trim()
    
    // Get user agent if not provided
    const clientUserAgent = userAgent || req.headers.get('user-agent') || 'unknown'

    // Log the security event using the database function
    const { data: logResult, error: logError } = await supabaseClient.rpc('log_security_event', {
      p_event_type: eventType,
      p_severity: severity,
      p_user_id: userId,
      p_user_email: userEmail,
      p_ip_address: clientIP,
      p_user_agent: clientUserAgent,
      p_event_details: eventDetails
    })

    if (logError) {
      console.error('Database logging error:', logError)
      return new Response(
        JSON.stringify({ error: 'Failed to log security event', details: logError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Also log to console for immediate monitoring
    console.log(`[SECURITY EVENT] ${eventType} - ${severity}`, {
      userId,
      userEmail,
      eventDetails,
      timestamp: new Date().toISOString(),
      logId: logResult
    })

    // Check for high severity events and potentially send alerts
    if (severity === 'high' || severity === 'critical') {
      console.warn(`[HIGH SEVERITY SECURITY EVENT] ${eventType}`, {
        userId,
        userEmail,
        eventDetails,
        requiresAttention: true
      })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        logId: logResult,
        message: 'Security event logged successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Security logging error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})