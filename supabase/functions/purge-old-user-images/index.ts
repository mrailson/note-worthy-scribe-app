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

    // Parse request body for days threshold (default 7)
    let daysOld = 7
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

    console.log(`[purge-old-user-images] User ${user.email} initiated purge for images older than ${daysOld} days (cutoff: ${cutoffDate.toISOString()})`)
    console.log(`[purge-old-user-images] Dry run mode: ${dryRun}`)

    // First get count and summary of images to delete (excluding favourites)
    const { data: imagesToDelete, error: fetchError } = await supabase
      .from('user_generated_images')
      .select('id, title, user_id, created_at, image_url')
      .eq('is_favourite', false)
      .lt('created_at', cutoffDate.toISOString())

    if (fetchError) {
      console.error('[purge-old-user-images] Error fetching images:', fetchError)
      throw fetchError
    }

    if (!imagesToDelete || imagesToDelete.length === 0) {
      console.log(`[purge-old-user-images] No non-favourite images older than ${daysOld} days found`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          deletedCount: 0,
          dryRun,
          message: `No non-favourite images older than ${daysOld} days found`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Group by user for reporting
    const userCounts: Record<string, number> = {}
    imagesToDelete.forEach(img => {
      userCounts[img.user_id] = (userCounts[img.user_id] || 0) + 1
    })

    console.log(`[purge-old-user-images] Found ${imagesToDelete.length} images to delete from ${Object.keys(userCounts).length} users`)

    if (dryRun) {
      console.log(`[purge-old-user-images] DRY RUN - Would delete ${imagesToDelete.length} images`)
      return new Response(
        JSON.stringify({ 
          success: true,
          dryRun: true,
          wouldDelete: imagesToDelete.length,
          affectedUsers: Object.keys(userCounts).length,
          userBreakdown: userCounts,
          oldestImage: imagesToDelete[imagesToDelete.length - 1]?.created_at,
          newestImage: imagesToDelete[0]?.created_at,
          message: `Would delete ${imagesToDelete.length} images from ${Object.keys(userCounts).length} users`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Actually delete
    const imageIds = imagesToDelete.map(img => img.id)
    const { error } = await supabase
      .from('user_generated_images')
      .delete()
      .in('id', imageIds)

    if (error) {
      console.error('[purge-old-user-images] Error deleting images:', error)
      throw error
    }

    console.log(`[purge-old-user-images] Successfully deleted ${imagesToDelete.length} images`)

    // Log the cleanup in audit log
    const { error: auditError } = await supabase
      .from('system_audit_log')
      .insert({
        table_name: 'user_generated_images',
        operation: 'BULK_PURGE',
        user_id: user.id,
        user_email: user.email,
        new_values: {
          deleted_count: imagesToDelete.length,
          days_old: daysOld,
          cutoff_date: cutoffDate.toISOString(),
          affected_users: Object.keys(userCounts).length,
          action: 'purge_old_user_images'
        }
      })

    if (auditError) {
      console.warn('[purge-old-user-images] Failed to write audit log:', auditError)
      // Don't throw - the purge was successful
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        deletedCount: imagesToDelete.length,
        affectedUsers: Object.keys(userCounts).length,
        userBreakdown: userCounts,
        daysOld,
        cutoffDate: cutoffDate.toISOString(),
        message: `Successfully deleted ${imagesToDelete.length} old images from ${Object.keys(userCounts).length} users`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[purge-old-user-images] Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to purge old user images'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
