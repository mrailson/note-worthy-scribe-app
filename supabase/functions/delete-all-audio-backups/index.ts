import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting deletion of all audio backups...')

    // Get all audio backups
    const { data: backups, error: fetchError } = await supabaseClient
      .from('meeting_audio_backups')
      .select('id, file_path')

    if (fetchError) {
      console.error('Error fetching audio backups:', fetchError)
      throw fetchError
    }

    console.log(`Found ${backups?.length || 0} audio backups to delete`)

    let deletedCount = 0
    let failedCount = 0

    // Delete each backup's file from storage and database record
    if (backups && backups.length > 0) {
      for (const backup of backups) {
        try {
          // Delete from storage
          if (backup.file_path) {
            const { error: storageError } = await supabaseClient.storage
              .from('meeting-audio-backups')
              .remove([backup.file_path])

            if (storageError) {
              console.error(`Failed to delete file ${backup.file_path}:`, storageError)
              failedCount++
              continue
            }
          }

          // Delete database record
          const { error: dbError } = await supabaseClient
            .from('meeting_audio_backups')
            .delete()
            .eq('id', backup.id)

          if (dbError) {
            console.error(`Failed to delete backup record ${backup.id}:`, dbError)
            failedCount++
          } else {
            deletedCount++
          }
        } catch (error) {
          console.error(`Error processing backup ${backup.id}:`, error)
          failedCount++
        }
      }
    }

    console.log(`Deleted ${deletedCount} audio backups, ${failedCount} failed`)

    return new Response(
      JSON.stringify({ 
        deleted_count: deletedCount,
        failed_count: failedCount,
        message: `Successfully deleted ${deletedCount} audio backup${deletedCount !== 1 ? 's' : ''}${failedCount > 0 ? `. Failed to delete ${failedCount}.` : ''}`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in delete-all-audio-backups function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        deleted_count: 0 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
