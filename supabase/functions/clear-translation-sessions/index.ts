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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)

    if (!user) {
      throw new Error('User not authenticated')
    }

    // Delete all non-protected sessions for this user
    const { data: deletedSessions, error } = await supabase
      .from('translation_sessions')
      .delete()
      .eq('user_id', user.id)
      .eq('is_protected', false)
      .select('id, session_title')

    if (error) throw error

    const deletedCount = deletedSessions?.length || 0

    return new Response(
      JSON.stringify({ 
        success: true,
        deletedCount,
        message: `Successfully cleared ${deletedCount} session(s). Protected sessions were preserved.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Clear translation sessions error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to clear translation sessions'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})