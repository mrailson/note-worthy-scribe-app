import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          error: 'No authorization header provided',
          sessions: [],
          totalCount: 0,
          hasMore: false
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract token from Bearer header
    const token = authHeader.replace('Bearer ', '')
    
    // Create admin client to verify JWT and get user
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)
    
    // Get user from JWT
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed',
          sessions: [],
          totalCount: 0,
          hasMore: false
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authenticated:', user.id)
    
    // Create client with service role for database queries (we'll filter by user_id manually)
    const supabase = supabaseAdmin

    // Parse request body or use URL params
    const body = req.method === 'POST' ? await req.json() : {}
    const url = new URL(req.url)
    
    const limit = parseInt(body.limit || url.searchParams.get('limit') || '50')
    const offset = parseInt(body.offset || url.searchParams.get('offset') || '0')
    const flaggedOnly = body.flagged || url.searchParams.get('flagged') === 'true'
    const protectedOnly = body.protected || url.searchParams.get('protected') === 'true'
    const language = body.language || url.searchParams.get('language')
    const search = body.search || url.searchParams.get('search')

    let query = supabase
      .from('translation_sessions')
      .select(`
        id,
        session_title,
        session_start,
        session_end,
        patient_language,
        total_translations,
        session_metadata,
        created_at,
        updated_at,
        is_flagged,
        is_protected,
        is_active
      `)
      .eq('user_id', user.id) // Filter by authenticated user
      .order('created_at', { ascending: false })

    // Apply filters
    if (flaggedOnly) {
      query = query.eq('is_flagged', true)
    }

    if (protectedOnly) {
      query = query.eq('is_protected', true)
    }

    if (language && language !== 'all') {
      query = query.eq('patient_language', language)
    }

    if (search) {
      query = query.ilike('session_title', `%${search}%`)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: sessions, error } = await query

    if (error) throw error

    // Get total count for pagination
    let countQuery = supabase
      .from('translation_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id) // Filter by authenticated user

    if (flaggedOnly) {
      countQuery = countQuery.eq('is_flagged', true)
    }

    if (protectedOnly) {
      countQuery = countQuery.eq('is_protected', true)
    }

    if (language && language !== 'all') {
      countQuery = countQuery.eq('patient_language', language)
    }

    if (search) {
      countQuery = countQuery.ilike('session_title', `%${search}%`)
    }

    const { count } = await countQuery

    return new Response(
      JSON.stringify({ 
        sessions: sessions || [],
        totalCount: count || 0,
        hasMore: (offset + limit) < (count || 0)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Load translation sessions error:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to load translation sessions',
        sessions: [],
        totalCount: 0,
        hasMore: false,
        debug: {
          errorType: error.name,
          errorMessage: error.message
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})