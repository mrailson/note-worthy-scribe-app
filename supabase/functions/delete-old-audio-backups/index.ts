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

    // Calculate cutoff date (24 hours ago)
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    let totalDeletedBackups = 0
    let totalDeletedChunks = 0
    let totalDeletedFiles = 0

    // ========================================
    // 1. Delete old meeting_audio_backups
    // ========================================
    const { data: oldBackups, error: selectError } = await supabase
      .from('meeting_audio_backups')
      .select('id, file_path')
      .lt('created_at', cutoffDate)

    if (selectError) {
      console.error('Error fetching old backups:', selectError)
    } else if (oldBackups && oldBackups.length > 0) {
      console.log(`Found ${oldBackups.length} old audio backups to delete`)

      // Delete files from storage
      const backupFilePaths = oldBackups.map(backup => backup.file_path).filter(Boolean)
      
      if (backupFilePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('meeting-audio-backups')
          .remove(backupFilePaths)

        if (storageError) {
          console.error('Error deleting backup files from storage:', storageError)
        } else {
          totalDeletedFiles += backupFilePaths.length
        }
      }

      // Delete records from database
      const { error: deleteError } = await supabase
        .from('meeting_audio_backups')
        .delete()
        .lt('created_at', cutoffDate)

      if (deleteError) {
        console.error('Error deleting backup records:', deleteError)
      } else {
        totalDeletedBackups = oldBackups.length
      }
    }

    // ========================================
    // 2. Delete old audio_chunks
    // ========================================
    const { data: oldChunks, error: chunksSelectError } = await supabase
      .from('audio_chunks')
      .select('id, audio_blob_path, meeting_id')
      .lt('created_at', cutoffDate)

    if (chunksSelectError) {
      console.error('Error fetching old audio chunks:', chunksSelectError)
    } else if (oldChunks && oldChunks.length > 0) {
      console.log(`Found ${oldChunks.length} old audio chunks to delete`)

      // Delete files from storage (meeting-audio-chunks bucket)
      const chunkFilePaths = oldChunks
        .map(chunk => chunk.audio_blob_path)
        .filter(Boolean)
      
      if (chunkFilePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('meeting-audio-chunks')
          .remove(chunkFilePaths)

        if (storageError) {
          console.error('Error deleting chunk files from storage:', storageError)
        } else {
          totalDeletedFiles += chunkFilePaths.length
          console.log(`Deleted ${chunkFilePaths.length} chunk files from storage`)
        }
      }

      // Delete records from database
      const { error: deleteError } = await supabase
        .from('audio_chunks')
        .delete()
        .lt('created_at', cutoffDate)

      if (deleteError) {
        console.error('Error deleting chunk records:', deleteError)
      } else {
        totalDeletedChunks = oldChunks.length
      }
    }

    // Log the cleanup action
    await supabase
      .from('system_audit_log')
      .insert({
        table_name: 'audio_cleanup',
        operation: 'BULK_DELETE',
        user_id: user.id,
        user_email: user.email,
        new_values: {
          deleted_backups: totalDeletedBackups,
          deleted_chunks: totalDeletedChunks,
          deleted_files: totalDeletedFiles,
          cutoff_date: cutoffDate,
          action: 'cleanup_old_audio_files'
        }
      })

    const totalDeleted = totalDeletedBackups + totalDeletedChunks

    if (totalDeleted === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No audio files older than 24 hours found',
          deleted_count: 0,
          deleted_backups: 0,
          deleted_chunks: 0,
          deleted_files: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Successfully deleted ${totalDeletedBackups} backups and ${totalDeletedChunks} chunks`,
        deleted_count: totalDeleted,
        deleted_backups: totalDeletedBackups,
        deleted_chunks: totalDeletedChunks,
        deleted_files: totalDeletedFiles
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in delete-old-audio-backups function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})