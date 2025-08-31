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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check if user is authenticated and is system admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get user from auth header
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user is system admin
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'system_admin')
      .single()

    if (roleError || !userRole) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. System admin role required.' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Calculate cutoff time (5 hours ago)
    const cutoffTime = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()

    console.log(`🔍 Looking for empty meetings older than ${cutoffTime}`)

    // Find meetings older than 5 hours with zero word count
    // Check meetings table for empty transcript fields AND no related transcript data
    const { data: emptyMeetings, error: selectError } = await supabase
      .from('meetings')
      .select(`
        id, 
        title, 
        created_at,
        whisper_transcript_text,
        assembly_transcript_text,
        meeting_transcripts!inner(content),
        transcription_chunks!inner(transcript_text)
      `)
      .lt('created_at', cutoffTime)
      .or('whisper_transcript_text.is.null,whisper_transcript_text.eq.,assembly_transcript_text.is.null,assembly_transcript_text.eq.')

    if (selectError) {
      console.error('Error fetching meetings:', selectError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch meetings for cleanup' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Filter meetings that truly have zero word count across ALL sources
    const meetingsToDelete = []
    
    if (emptyMeetings && emptyMeetings.length > 0) {
      for (const meeting of emptyMeetings) {
        const hasWhisperText = meeting.whisper_transcript_text && meeting.whisper_transcript_text.trim().length > 0
        const hasAssemblyText = meeting.assembly_transcript_text && meeting.assembly_transcript_text.trim().length > 0
        
        // Check if there are any meeting_transcripts with content
        const { data: transcripts, error: transcriptError } = await supabase
          .from('meeting_transcripts')
          .select('content')
          .eq('meeting_id', meeting.id)
          .not('content', 'is', null)
          .neq('content', '')

        if (transcriptError) {
          console.warn(`Error checking transcripts for meeting ${meeting.id}:`, transcriptError)
          continue
        }

        const hasTranscriptContent = transcripts && transcripts.length > 0 && 
          transcripts.some(t => t.content && t.content.trim().length > 0)

        // Check if there are any transcription_chunks with content
        const { data: chunks, error: chunkError } = await supabase
          .from('transcription_chunks')
          .select('transcript_text')
          .eq('meeting_id', meeting.id)
          .not('transcript_text', 'is', null)
          .neq('transcript_text', '')

        if (chunkError) {
          console.warn(`Error checking chunks for meeting ${meeting.id}:`, chunkError)
          continue
        }

        const hasChunkContent = chunks && chunks.length > 0 && 
          chunks.some(c => c.transcript_text && c.transcript_text.trim().length > 0)

        // Only delete if ALL transcript sources are empty
        if (!hasWhisperText && !hasAssemblyText && !hasTranscriptContent && !hasChunkContent) {
          meetingsToDelete.push(meeting)
        }
      }
    }

    if (meetingsToDelete.length === 0) {
      console.log('✅ No empty meetings found for cleanup')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No empty meetings older than 5 hours found',
          deleted_count: 0,
          details: {
            cutoff_time: cutoffTime,
            total_checked: emptyMeetings?.length || 0
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🗑️ Found ${meetingsToDelete.length} empty meetings to delete`)

    let deletedCount = 0
    const deletedMeetingIds = []
    const deleteErrors = []

    // Delete each meeting and its related records
    for (const meeting of meetingsToDelete) {
      try {
        // Delete related records first (cascading cleanup)
        console.log(`Cleaning up meeting ${meeting.id}: ${meeting.title}`)

        // Delete meeting transcripts
        await supabase
          .from('meeting_transcripts')
          .delete()
          .eq('meeting_id', meeting.id)

        // Delete transcription chunks  
        await supabase
          .from('transcription_chunks')
          .delete()
          .eq('meeting_id', meeting.id)

        // Delete meeting documents
        await supabase
          .from('meeting_documents')
          .delete()
          .eq('meeting_id', meeting.id)

        // Delete meeting shares
        await supabase
          .from('meeting_shares')
          .delete()
          .eq('meeting_id', meeting.id)

        // Delete audio chunks
        await supabase
          .from('audio_chunks')
          .delete()
          .eq('meeting_id', meeting.id)

        // Delete meeting audio backups
        await supabase
          .from('meeting_audio_backups')
          .delete()
          .eq('meeting_id', meeting.id)

        // Finally delete the meeting itself
        const { error: deleteError } = await supabase
          .from('meetings')
          .delete()
          .eq('id', meeting.id)

        if (deleteError) {
          console.error(`Error deleting meeting ${meeting.id}:`, deleteError)
          deleteErrors.push({
            meeting_id: meeting.id,
            title: meeting.title,
            error: deleteError.message
          })
        } else {
          deletedCount++
          deletedMeetingIds.push(meeting.id)
          console.log(`✅ Deleted empty meeting: ${meeting.title} (${meeting.id})`)
        }

      } catch (error) {
        console.error(`Error processing meeting ${meeting.id}:`, error)
        deleteErrors.push({
          meeting_id: meeting.id,
          title: meeting.title,
          error: error.message
        })
      }
    }

    // Log the cleanup action
    await supabase
      .from('system_audit_log')
      .insert({
        table_name: 'meetings',
        operation: 'BULK_DELETE',
        user_id: user.id,
        user_email: user.email,
        new_values: {
          deleted_count: deletedCount,
          cutoff_time: cutoffTime,
          action: 'cleanup_empty_meetings',
          deleted_meeting_ids: deletedMeetingIds,
          errors: deleteErrors.length > 0 ? deleteErrors : undefined
        }
      })

    const responseData = {
      success: true,
      message: `Successfully cleaned up ${deletedCount} empty meetings`,
      deleted_count: deletedCount,
      total_candidates: meetingsToDelete.length,
      cutoff_time: cutoffTime,
      deleted_meeting_ids: deletedMeetingIds
    }

    if (deleteErrors.length > 0) {
      responseData.errors = deleteErrors
      responseData.message += ` (${deleteErrors.length} errors occurred)`
    }

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in cleanup-empty-meetings function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})