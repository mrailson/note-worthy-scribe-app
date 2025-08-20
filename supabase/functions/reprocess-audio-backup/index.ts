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

    const { backupId } = await req.json()

    if (!backupId) {
      return new Response(
        JSON.stringify({ error: 'Backup ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get backup metadata
    const { data: backup, error: backupError } = await supabase
      .from('meeting_audio_backups')
      .select('*')
      .eq('id', backupId)
      .single()

    if (backupError || !backup) {
      return new Response(
        JSON.stringify({ error: 'Backup not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Download audio file from storage
    const { data: audioFile, error: downloadError } = await supabase.storage
      .from('meeting-audio-backups')
      .download(backup.file_path)

    if (downloadError || !audioFile) {
      return new Response(
        JSON.stringify({ error: 'Failed to download audio file' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Convert audio to base64
    const arrayBuffer = await audioFile.arrayBuffer()
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    // Send to speech-to-text function for reprocessing
    const { data: transcription, error: transcriptionError } = await supabase.functions.invoke('speech-to-text', {
      body: { audio: base64Audio }
    })

    if (transcriptionError) {
      return new Response(
        JSON.stringify({ error: 'Transcription failed', details: transcriptionError }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Update the meeting transcript in meeting_transcripts table
    // First, delete existing transcript entries for this meeting
    const { error: deleteError } = await supabase
      .from('meeting_transcripts')
      .delete()
      .eq('meeting_id', backup.meeting_id)

    if (deleteError) {
      console.error('Failed to delete existing transcript:', deleteError)
    }

    // Insert the new transcript
    const { error: insertError } = await supabase
      .from('meeting_transcripts')
      .insert({
        meeting_id: backup.meeting_id,
        content: transcription.text,
        speaker_name: 'Reprocessed Audio',
        timestamp_seconds: 0,
        confidence_score: 1.0
      })

    if (insertError) {
      console.error('Failed to insert reprocessed transcript:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to save transcript', details: insertError }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Mark backup as reprocessed
    const { error: markError } = await supabase
      .from('meeting_audio_backups')
      .update({
        is_reprocessed: true,
        reprocessed_at: new Date().toISOString(),
        // Note: reprocessed_by would need to be passed from the request
      })
      .eq('id', backupId)

    if (markError) {
      console.error('Failed to mark backup as reprocessed:', markError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        transcription: transcription.text,
        message: 'Audio reprocessed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in reprocess-audio-backup function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})