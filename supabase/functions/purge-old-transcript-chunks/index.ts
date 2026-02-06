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

    console.log(`[purge-old-transcript-chunks] User ${user.email} initiated purge for chunks older than ${daysOld} days (cutoff: ${cutoffDate.toISOString()})`)
    console.log(`[purge-old-transcript-chunks] Dry run mode: ${dryRun}`)

    // Get count and summary of chunks to delete
    // Only delete chunks from meetings that have notes_generated = true (notes already created)
    const { data: chunksToDelete, error: fetchError } = await supabase
      .from('meeting_transcription_chunks')
      .select('id, meeting_id, user_id, created_at')
      .lt('created_at', cutoffDate.toISOString())

    if (fetchError) {
      console.error('[purge-old-transcript-chunks] Error fetching chunks:', fetchError)
      throw fetchError
    }

    if (!chunksToDelete || chunksToDelete.length === 0) {
      console.log(`[purge-old-transcript-chunks] No chunks older than ${daysOld} days found`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          deletedCount: 0,
          dryRun,
          message: `No transcript chunks older than ${daysOld} days found`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get unique meeting IDs to check which ones have notes generated
    const meetingIds = [...new Set(chunksToDelete.map(c => c.meeting_id).filter(Boolean))]
    
    // Check which meetings have notes already generated
    const { data: meetingsWithNotes } = await supabase
      .from('meetings')
      .select('id, notes_generation_status')
      .in('id', meetingIds)
      .eq('notes_generation_status', 'completed')

    const safeToDeleteMeetingIds = new Set(meetingsWithNotes?.map(m => m.id) || [])
    
    // Filter chunks to only include those from meetings with notes generated
    const safeChunksToDelete = chunksToDelete.filter(c => 
      c.meeting_id && safeToDeleteMeetingIds.has(c.meeting_id)
    )

    if (safeChunksToDelete.length === 0) {
      console.log(`[purge-old-transcript-chunks] No safe-to-delete chunks found (all meetings still need notes)`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          deletedCount: 0,
          dryRun,
          totalOldChunks: chunksToDelete.length,
          message: `Found ${chunksToDelete.length} old chunks, but none from meetings with generated notes`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Group by user for reporting
    const userCounts: Record<string, number> = {}
    safeChunksToDelete.forEach(chunk => {
      if (chunk.user_id) {
        userCounts[chunk.user_id] = (userCounts[chunk.user_id] || 0) + 1
      }
    })

    // Count affected meetings
    const affectedMeetings = new Set(safeChunksToDelete.map(c => c.meeting_id)).size

    console.log(`[purge-old-transcript-chunks] Found ${safeChunksToDelete.length} chunks to delete from ${affectedMeetings} meetings, ${Object.keys(userCounts).length} users`)

    if (dryRun) {
      console.log(`[purge-old-transcript-chunks] DRY RUN - Would delete ${safeChunksToDelete.length} chunks`)
      return new Response(
        JSON.stringify({ 
          success: true,
          dryRun: true,
          wouldDelete: safeChunksToDelete.length,
          affectedUsers: Object.keys(userCounts).length,
          affectedMeetings,
          totalOldChunks: chunksToDelete.length,
          message: `Would delete ${safeChunksToDelete.length} chunks from ${affectedMeetings} meetings (${Object.keys(userCounts).length} users)`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Actually delete in batches
    const chunkIds = safeChunksToDelete.map(c => c.id)
    const batchSize = 1000
    let deletedCount = 0

    for (let i = 0; i < chunkIds.length; i += batchSize) {
      const batch = chunkIds.slice(i, i + batchSize)
      const { error } = await supabase
        .from('meeting_transcription_chunks')
        .delete()
        .in('id', batch)

      if (error) {
        console.error(`[purge-old-transcript-chunks] Error deleting batch ${i / batchSize + 1}:`, error)
        throw error
      }
      deletedCount += batch.length
    }

    console.log(`[purge-old-transcript-chunks] Successfully deleted ${deletedCount} chunks`)

    // Log the cleanup in audit log
    const { error: auditError } = await supabase
      .from('system_audit_log')
      .insert({
        table_name: 'meeting_transcription_chunks',
        operation: 'BULK_PURGE',
        user_id: user.id,
        user_email: user.email,
        new_values: {
          deleted_count: deletedCount,
          days_old: daysOld,
          cutoff_date: cutoffDate.toISOString(),
          affected_users: Object.keys(userCounts).length,
          affected_meetings: affectedMeetings,
          action: 'purge_old_transcript_chunks'
        }
      })

    if (auditError) {
      console.warn('[purge-old-transcript-chunks] Failed to write audit log:', auditError)
      // Don't throw - the purge was successful
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        deletedCount,
        affectedUsers: Object.keys(userCounts).length,
        affectedMeetings,
        daysOld,
        cutoffDate: cutoffDate.toISOString(),
        message: `Successfully deleted ${deletedCount} old transcript chunks from ${affectedMeetings} meetings`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[purge-old-transcript-chunks] Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to purge old transcript chunks'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
