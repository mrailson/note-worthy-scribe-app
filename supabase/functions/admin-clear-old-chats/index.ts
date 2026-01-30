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

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)

    if (!user) {
      throw new Error('User not authenticated')
    }

    // Check if user has admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      throw new Error('Unauthorized: Admin access required')
    }

    const { userId, daysOld = 7 } = await req.json()

    if (!userId) {
      throw new Error('User ID is required')
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    // First get count of chats to delete
    const { data: chatsToDelete, error: fetchError } = await supabase
      .from('ai_4_pm_searches')
      .select('id, title')
      .eq('user_id', userId)
      .eq('is_protected', false)
      .lt('created_at', cutoffDate.toISOString())

    if (fetchError) throw fetchError

    if (!chatsToDelete || chatsToDelete.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          deletedCount: 0,
          message: 'No unprotected chats older than specified days'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const chatIds = chatsToDelete.map(c => c.id)
    const { error } = await supabase
      .from('ai_4_pm_searches')
      .delete()
      .in('id', chatIds)

    if (error) throw error

    return new Response(
      JSON.stringify({ 
        success: true,
        deletedCount: chatsToDelete.length,
        message: `Deleted ${chatsToDelete.length} old chats`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Admin clear old chats error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to clear old chats'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
