import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { meetingId } = await req.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    console.log('🔄 Recovering transcript for meeting:', meetingId)

    // Get the meeting and its transcript
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, user_id, title')
      .eq('id', meetingId)
      .single()

    if (meetingError) throw meetingError

    // Get existing transcript
    const { data: transcript, error: transcriptError } = await supabase
      .from('meeting_transcripts')
      .select('content')
      .eq('meeting_id', meetingId)
      .single()

    if (transcriptError) throw transcriptError

    // Check if chunks already exist
    const { data: existingChunks, error: chunksError } = await supabase
      .from('meeting_transcription_chunks')
      .select('id')
      .eq('meeting_id', meetingId)

    if (chunksError) throw chunksError

    let chunksCreated = 0

    // Only create chunks if none exist
    if (!existingChunks || existingChunks.length === 0) {
      console.log('📦 Creating transcript chunks from existing data')
      
      // Split transcript into reasonable chunks (about 2000 chars each)
      const chunkSize = 2000
      const text = transcript.content || ''
      const chunks: string[] = []
      
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize))
      }

      // Insert chunks
      const sessionId = crypto.randomUUID()
      const chunkInserts = chunks.map((chunk, index) => ({
        meeting_id: meetingId,
        user_id: meeting.user_id,
        session_id: sessionId,
        chunk_number: index + 1,
        transcription_text: chunk
      }))

      const { error: insertError } = await supabase
        .from('meeting_transcription_chunks')
        .insert(chunkInserts)

      if (insertError) throw insertError

      chunksCreated = chunks.length
    }

    console.log('✅ Recovery complete')

    return new Response(JSON.stringify({
      success: true,
      meeting: meeting.title,
      chunksCreated,
      transcriptLength: transcript.content?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('❌ Recovery error:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})