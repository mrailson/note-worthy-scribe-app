import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId } = await req.json();
    
    if (!meetingId) {
      throw new Error('Meeting ID is required');
    }

    console.log('🔄 Rebuilding audio for meeting:', meetingId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all audio chunks for this meeting from storage
    console.log('📂 Fetching audio chunks from storage...');
    const { data: files, error: listError } = await supabase.storage
      .from('meeting-audio-chunks')
      .list(`${meetingId}`, { limit: 1000 });

    if (listError) {
      console.error('❌ Error listing audio chunks:', listError);
      throw listError;
    }

    if (!files || files.length === 0) {
      throw new Error('No audio chunks found for this meeting');
    }

    console.log(`📁 Found ${files.length} audio chunks`);

    // Sort chunks by name (chunk-0.webm, chunk-1.webm, etc.)
    const sortedFiles = files
      .filter(file => file.name.startsWith('chunk-') && file.name.endsWith('.webm'))
      .sort((a, b) => {
        const aNum = parseInt(a.name.match(/chunk-(\d+)\.webm/)?.[1] || '0');
        const bNum = parseInt(b.name.match(/chunk-(\d+)\.webm/)?.[1] || '0');
        return aNum - bNum;
      });

    console.log(`🔢 Sorted ${sortedFiles.length} valid chunks`);

    // Process each chunk and combine transcripts
    const transcriptParts: string[] = [];
    let totalProcessed = 0;

    for (const file of sortedFiles) {
      try {
        console.log(`🎵 Processing chunk: ${file.name}`);
        
        // Download the audio chunk
        const { data: audioData, error: downloadError } = await supabase.storage
          .from('meeting-audio-chunks')
          .download(`${meetingId}/${file.name}`);

        if (downloadError) {
          console.error(`❌ Error downloading ${file.name}:`, downloadError);
          continue;
        }

        // Convert to base64 for OpenAI API
        const arrayBuffer = await audioData.arrayBuffer();
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        // Send to OpenAI Whisper for transcription
        const openaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'whisper-1',
            audio: base64Audio,
            response_format: 'text'
          }),
        });

        if (!openaiResponse.ok) {
          console.error(`❌ OpenAI API error for ${file.name}:`, await openaiResponse.text());
          continue;
        }

        const transcriptText = await openaiResponse.text();
        
        if (transcriptText.trim()) {
          transcriptParts.push(transcriptText.trim());
          console.log(`✅ Transcribed ${file.name}: ${transcriptText.substring(0, 50)}...`);
        }

        totalProcessed++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (chunkError) {
        console.error(`❌ Error processing chunk ${file.name}:`, chunkError);
        continue;
      }
    }

    // Combine all transcript parts
    const finalTranscript = transcriptParts.join(' ').trim();
    
    if (!finalTranscript) {
      throw new Error('No transcript could be generated from audio chunks');
    }

    console.log(`✅ Successfully processed ${totalProcessed} chunks, transcript length: ${finalTranscript.length}`);

    // Save the rebuilt transcript
    const { error: saveError } = await supabase
      .from('meeting_transcripts')
      .upsert({
        meeting_id: meetingId,
        content: finalTranscript,
        timestamp_seconds: 0,
        created_at: new Date().toISOString()
      });

    if (saveError) {
      console.error('❌ Error saving rebuilt transcript:', saveError);
      throw saveError;
    }

    // Update meeting with rebuilt transcript
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        transcript: finalTranscript,
        updated_at: new Date().toISOString()
      })
      .eq('id', meetingId);

    if (updateError) {
      console.warn('⚠️ Could not update meeting transcript:', updateError);
    }

    return new Response(JSON.stringify({
      success: true,
      transcript: finalTranscript,
      chunksProcessed: totalProcessed,
      totalChunks: sortedFiles.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error rebuilding meeting audio:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});