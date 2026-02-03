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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header required')
    }
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)

    if (!user) {
      throw new Error('User not authenticated')
    }

    // Check if user has system_admin role in user_roles table
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)

    const isSystemAdmin = userRoles?.some(r => r.role === 'system_admin')
    if (!isSystemAdmin) {
      throw new Error('Unauthorized: System admin access required')
    }

    // Parse request body for days threshold (default 30)
    let daysOld = 30
    let dryRun = false
    try {
      const body = await req.json()
      if (body.daysOld && typeof body.daysOld === 'number' && body.daysOld > 0) {
        daysOld = body.daysOld
      }
      if (body.dryRun === true) {
        dryRun = true
      }
    } catch {
      // No body or invalid JSON, use defaults
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    console.log(`[purge-old-ai-chats] User ${user.email} initiated purge for chats older than ${daysOld} days (cutoff: ${cutoffDate.toISOString()})`)
    console.log(`[purge-old-ai-chats] Dry run mode: ${dryRun}`)

    // First get count and summary of chats to delete
    const { data: chatsToDelete, error: fetchError } = await supabase
      .from('ai_4_pm_searches')
      .select('id, title, user_id, created_at')
      .eq('is_protected', false)
      .lt('created_at', cutoffDate.toISOString())

    if (fetchError) {
      console.error('[purge-old-ai-chats] Error fetching chats:', fetchError)
      throw fetchError
    }

    if (!chatsToDelete || chatsToDelete.length === 0) {
      console.log(`[purge-old-ai-chats] No unprotected chats older than ${daysOld} days found`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          deletedCount: 0,
          dryRun,
          message: `No unprotected chats older than ${daysOld} days found`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Group by user for reporting
    const userCounts: Record<string, number> = {}
    chatsToDelete.forEach(chat => {
      userCounts[chat.user_id] = (userCounts[chat.user_id] || 0) + 1
    })

    console.log(`[purge-old-ai-chats] Found ${chatsToDelete.length} chats to delete from ${Object.keys(userCounts).length} users`)

    if (dryRun) {
      console.log(`[purge-old-ai-chats] DRY RUN - Would delete ${chatsToDelete.length} chats`)
      return new Response(
        JSON.stringify({ 
          success: true,
          dryRun: true,
          wouldDelete: chatsToDelete.length,
          affectedUsers: Object.keys(userCounts).length,
          userBreakdown: userCounts,
          oldestChat: chatsToDelete[chatsToDelete.length - 1]?.created_at,
          newestChat: chatsToDelete[0]?.created_at,
          message: `Would delete ${chatsToDelete.length} chats from ${Object.keys(userCounts).length} users`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Actually delete
    const chatIds = chatsToDelete.map(c => c.id)
    const { error } = await supabase
      .from('ai_4_pm_searches')
      .delete()
      .in('id', chatIds)

    if (error) {
      console.error('[purge-old-ai-chats] Error deleting chats:', error)
      throw error
    }

    console.log(`[purge-old-ai-chats] Successfully deleted ${chatsToDelete.length} chats`)

    // Log the cleanup in audit log
    const { error: auditError } = await supabase
      .from('system_audit_log')
      .insert({
        table_name: 'ai_4_pm_searches',
        operation: 'BULK_PURGE',
        user_id: user.id,
        user_email: user.email,
        new_values: {
          deleted_count: chatsToDelete.length,
          days_old: daysOld,
          cutoff_date: cutoffDate.toISOString(),
          affected_users: Object.keys(userCounts).length,
          action: 'purge_old_ai_chats'
        }
      })

    if (auditError) {
      console.warn('[purge-old-ai-chats] Failed to write audit log:', auditError)
      // Don't throw - the purge was successful
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        deletedCount: chatsToDelete.length,
        affectedUsers: Object.keys(userCounts).length,
        userBreakdown: userCounts,
        daysOld,
        cutoffDate: cutoffDate.toISOString(),
        message: `Successfully deleted ${chatsToDelete.length} old AI chats from ${Object.keys(userCounts).length} users`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[purge-old-ai-chats] Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to purge old AI chats'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
