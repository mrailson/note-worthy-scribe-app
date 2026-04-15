import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PARALLEL_BATCH_SIZE = 4; // Process 4 segments concurrently

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { backupId } = await req.json();

    if (!backupId) {
      return new Response(
        JSON.stringify({ error: 'Backup ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: backup, error: backupError } = await supabase
      .from('meeting_audio_backups')
      .select('*')
      .eq('id', backupId)
      .single();

    if (backupError || !backup) {
      return new Response(
        JSON.stringify({ error: 'Backup not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pathParts = backup.file_path.split('/');
    const folderPath = pathParts.length >= 3
      ? pathParts.slice(0, 2).join('/')
      : pathParts.slice(0, -1).join('/');

    console.log(`Listing all segments in folder: ${folderPath}`);

    const { data: folderFiles, error: listError } = await supabase.storage
      .from('meeting-audio-backups')
      .list(folderPath, { limit: 100, sortBy: { column: 'name', order: 'asc' } });

    if (listError) {
      console.error('Error listing folder:', listError);
      return new Response(
        JSON.stringify({ error: 'Failed to list audio segments', details: listError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const audioFiles = (folderFiles || [])
      .filter(f => f.name && (
        f.name.endsWith('.webm') || f.name.endsWith('.m4a') ||
        f.name.endsWith('.mp3') || f.name.endsWith('.wav') ||
        f.name.endsWith('.ogg') || f.name.endsWith('.weba')
      ))
      .sort((a, b) => {
        const numA = parseInt(a.name.match(/(\d+)/)?.[1] || '0', 10);
        const numB = parseInt(b.name.match(/(\d+)/)?.[1] || '0', 10);
        return numA - numB;
      });

    console.log(`Found ${audioFiles.length} audio segment(s) to process in parallel batches of ${PARALLEL_BATCH_SIZE}`);

    if (audioFiles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No audio segments found in folder' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allTranscripts: { index: number; text: string; fileName: string }[] = [];
    const errors: { index: number; fileName: string; error: string }[] = [];

    // Process in parallel batches
    for (let batchStart = 0; batchStart < audioFiles.length; batchStart += PARALLEL_BATCH_SIZE) {
      const batch = audioFiles.slice(batchStart, batchStart + PARALLEL_BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(batchStart / PARALLEL_BATCH_SIZE) + 1}: segments ${batchStart}-${batchStart + batch.length - 1}`);

      const batchResults = await Promise.allSettled(
        batch.map(async (file, batchIdx) => {
          const i = batchStart + batchIdx;
          const filePath = `${folderPath}/${file.name}`;

          const { data: audioData, error: downloadError } = await supabase.storage
            .from('meeting-audio-backups')
            .download(filePath);

          if (downloadError || !audioData) {
            throw new Error(downloadError?.message || 'Download failed');
          }

          const ext = file.name.split('.').pop() || 'webm';
          const mimeMap: Record<string, string> = {
            webm: 'audio/webm', weba: 'audio/webm', m4a: 'audio/m4a',
            mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
          };

          const formData = new FormData();
          const blob = new Blob([await audioData.arrayBuffer()], { type: mimeMap[ext] || 'audio/webm' });
          formData.append('file', blob, `segment_${i}.${ext}`);
          formData.append('model', 'whisper-1');
          formData.append('language', 'en');
          formData.append('prompt', 'This is a UK healthcare practice meeting. Transcribe accurately including medical terminology, NHS references, and clinical terms.');

          const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openAIApiKey}` },
            body: formData,
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Whisper error ${response.status}: ${errorText.substring(0, 200)}`);
          }

          const result = await response.json();
          return { index: i, text: result.text?.trim() || '', fileName: file.name };
        })
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const i = batchStart + j;
        if (result.status === 'fulfilled' && result.value.text) {
          allTranscripts.push(result.value);
          console.log(`✅ Segment ${i} transcribed: ${result.value.text.length} chars`);
        } else {
          const errMsg = result.status === 'rejected' ? String(result.reason) : 'Empty transcript';
          console.error(`❌ Segment ${i} failed: ${errMsg}`);
          errors.push({ index: i, fileName: batch[j].name, error: errMsg });
        }
      }
    }

    if (allTranscripts.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No segments could be transcribed',
          segmentErrors: errors,
          totalSegments: audioFiles.length,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Combine all transcripts in order
    const combinedText = allTranscripts
      .sort((a, b) => a.index - b.index)
      .map(t => t.text)
      .join('\n\n');

    console.log(`Combined transcript: ${combinedText.length} chars from ${allTranscripts.length}/${audioFiles.length} segments`);

    // Update the meeting transcript
    await supabase
      .from('meeting_transcripts')
      .delete()
      .eq('meeting_id', backup.meeting_id);

    const { error: insertError } = await supabase
      .from('meeting_transcripts')
      .insert({
        meeting_id: backup.meeting_id,
        content: combinedText,
        speaker_name: 'Reprocessed Audio',
        timestamp_seconds: 0,
        confidence_score: 0.95,
      });

    if (insertError) {
      console.error('Failed to insert reprocessed transcript:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save transcript', details: insertError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Also update the meeting's whisper_transcript_text for note generation
    const wordCount = combinedText.split(/\s+/).filter(Boolean).length;
    await supabase
      .from('meetings')
      .update({ 
        word_count: wordCount,
        whisper_transcript_text: combinedText,
      })
      .eq('id', backup.meeting_id);

    // Mark backup as reprocessed
    await supabase
      .from('meeting_audio_backups')
      .update({
        is_reprocessed: true,
        reprocessed_at: new Date().toISOString(),
        word_count: wordCount,
        transcription_quality_score: allTranscripts.length === audioFiles.length ? 0.95 : 0.7,
      })
      .eq('id', backupId);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reprocessed ${allTranscripts.length}/${audioFiles.length} audio segments`,
        totalSegments: audioFiles.length,
        processedSegments: allTranscripts.length,
        failedSegments: errors.length,
        wordCount,
        transcriptLength: combinedText.length,
        segmentErrors: errors.length > 0 ? errors : undefined,
        segments: allTranscripts.map(t => ({
          index: t.index,
          fileName: t.fileName,
          preview: t.text.substring(0, 80) + (t.text.length > 80 ? '...' : ''),
          length: t.text.length,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in reprocess-audio-backup function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
