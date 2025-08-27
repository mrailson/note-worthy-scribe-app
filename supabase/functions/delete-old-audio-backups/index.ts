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

    // Get old audio backups
    const { data: oldBackups, error: selectError } = await supabase
      .from('meeting_audio_backups')
      .select('id, file_path')
      .lt('created_at', cutoffDate)

    if (selectError) {
      console.error('Error fetching old backups:', selectError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch old backups' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!oldBackups || oldBackups.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No audio backups older than 24 hours found',
          deleted_count: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${oldBackups.length} old audio backups to delete`)

    // Delete files from storage
    let deletedFiles = 0
    const filePaths = oldBackups.map(backup => backup.file_path)
    
    if (filePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('meeting-audio-backups')
        .remove(filePaths)

      if (storageError) {
        console.error('Error deleting files from storage:', storageError)
        // Continue with database deletion even if storage deletion fails
      } else {
        deletedFiles = filePaths.length
      }
    }

    // Delete records from database
    const { error: deleteError } = await supabase
      .from('meeting_audio_backups')
      .delete()
      .lt('created_at', cutoffDate)

    if (deleteError) {
      console.error('Error deleting backup records:', deleteError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete backup records' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Log the cleanup action
    await supabase
      .from('system_audit_log')
      .insert({
        table_name: 'meeting_audio_backups',
        operation: 'BULK_DELETE',
        user_id: user.id,
        user_email: user.email,
        new_values: {
          deleted_count: oldBackups.length,
          cutoff_date: cutoffDate,
          action: 'cleanup_old_audio_backups'
        }
      })

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Successfully deleted ${oldBackups.length} old audio backups`,
        deleted_count: oldBackups.length,
        deleted_files: deletedFiles
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