import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TranscriptChunk {
  meeting_id: string
  session_id: string
  chunk_number: number
  transcription_text: string
  user_id: string
  created_at: string
}

interface OrphanedChunkGroup {
  meeting_id: string
  session_id: string
  user_id: string
  chunk_count: number
  earliest_chunk: string
  latest_chunk: string
  total_length: number
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔍 Checking for orphaned transcript chunks...')

    // Step 1: Find orphaned chunks (chunks without corresponding meetings)
    const { data: orphanedChunks, error: orphanedError } = await supabase
      .from('meeting_transcription_chunks')
      .select(`
        meeting_id,
        session_id,
        chunk_number,
        transcription_text,
        user_id,
        created_at
      `)
      .not('meeting_id', 'in', `(SELECT id FROM meetings)`)

    if (orphanedError) {
      throw new Error(`Failed to fetch orphaned chunks: ${orphanedError.message}`)
    }

    if (!orphanedChunks || orphanedChunks.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No orphaned chunks found',
          orphaned_chunks: 0,
          fixed_meetings: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Found ${orphanedChunks.length} orphaned chunks`)

    // Step 2: Group orphaned chunks by meeting_id and session_id
    const orphanedGroups = new Map<string, OrphanedChunkGroup>()
    
    for (const chunk of orphanedChunks as TranscriptChunk[]) {
      const key = `${chunk.meeting_id}-${chunk.session_id}`
      const existing = orphanedGroups.get(key)
      
      if (!existing) {
        orphanedGroups.set(key, {
          meeting_id: chunk.meeting_id,
          session_id: chunk.session_id,
          user_id: chunk.user_id,
          chunk_count: 1,
          earliest_chunk: chunk.created_at,
          latest_chunk: chunk.created_at,
          total_length: chunk.transcription_text.length
        })
      } else {
        existing.chunk_count++
        existing.total_length += chunk.transcription_text.length
        if (chunk.created_at < existing.earliest_chunk) {
          existing.earliest_chunk = chunk.created_at
        }
        if (chunk.created_at > existing.latest_chunk) {
          existing.latest_chunk = chunk.created_at
        }
      }
    }

    console.log(`📋 Found ${orphanedGroups.size} orphaned meeting groups`)

    // Step 3: Create placeholder meetings for orphaned chunks
    const fixedMeetings = []
    
    for (const [key, group] of orphanedGroups) {
      console.log(`🔧 Creating placeholder meeting for ${group.meeting_id}`)
      
      // Create a meeting record for the orphaned chunks
      const meetingTitle = `Recovered Meeting - ${new Date(group.earliest_chunk).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`

      const { data: newMeeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          id: group.meeting_id,
          title: meetingTitle,
          user_id: group.user_id,
          created_at: group.earliest_chunk,
          status: 'completed',
          duration: Math.round((new Date(group.latest_chunk).getTime() - new Date(group.earliest_chunk).getTime()) / 1000 / 60), // duration in minutes
          word_count: Math.round(group.total_length / 5) // rough estimate
        })
        .select()
        .single()

      if (meetingError) {
        console.error(`❌ Failed to create meeting ${group.meeting_id}:`, meetingError.message)
        continue
      }

      // Get full transcript for this meeting now that it exists
      const { data: transcriptData, error: transcriptError } = await supabase
        .rpc('get_meeting_full_transcript', { p_meeting_id: group.meeting_id })

      let fullTranscript = ''
      if (!transcriptError && transcriptData && transcriptData.length > 0) {
        fullTranscript = transcriptData[0].transcript
      }

      fixedMeetings.push({
        meeting_id: group.meeting_id,
        title: meetingTitle,
        chunk_count: group.chunk_count,
        total_length: group.total_length,
        transcript_preview: fullTranscript.substring(0, 200) + (fullTranscript.length > 200 ? '...' : ''),
        created_at: group.earliest_chunk
      })

      console.log(`✅ Successfully created meeting ${group.meeting_id} with ${group.chunk_count} chunks`)
    }

    const response = {
      success: true,
      message: `Fixed ${fixedMeetings.length} orphaned meetings`,
      orphaned_chunks: orphanedChunks.length,
      orphaned_groups: orphanedGroups.size,
      fixed_meetings: fixedMeetings,
      timestamp: new Date().toISOString()
    }

    console.log('🎉 Orphaned chunks fix completed:', response)

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error fixing orphaned chunks:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})