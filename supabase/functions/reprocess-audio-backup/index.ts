import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0'

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { backupId } = await req.json()

    if (!backupId) {
      return new Response(
        JSON.stringify({ error: 'Backup ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Derive the meeting folder from the file_path
    // Format: userId/meetingId/backup-segment-0.webm
    const pathParts = backup.file_path.split('/');
    const folderPath = pathParts.length >= 3
      ? pathParts.slice(0, 2).join('/')
      : pathParts.slice(0, -1).join('/');

    console.log(`Listing all segments in folder: ${folderPath}`);

    // List ALL segment files in the meeting folder
    const { data: folderFiles, error: listError } = await supabase.storage
      .from('meeting-audio-backups')
      .list(folderPath, { limit: 100, sortBy: { column: 'name', order: 'asc' } });

    if (listError) {
      console.error('Error listing folder:', listError);
      return new Response(
        JSON.stringify({ error: 'Failed to list audio segments', details: listError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Filter to audio files only and sort by segment number
    const audioFiles = (folderFiles || [])
      .filter(f => f.name && (
        f.name.endsWith('.webm') || f.name.endsWith('.m4a') ||
        f.name.endsWith('.mp3') || f.name.endsWith('.wav') ||
        f.name.endsWith('.ogg') || f.name.endsWith('.weba')
      ))
      .sort((a, b) => {
        // Extract segment number: backup-segment-0.webm → 0
        const numA = parseInt(a.name.match(/(\d+)/)?.[1] || '0', 10);
        const numB = parseInt(b.name.match(/(\d+)/)?.[1] || '0', 10);
        return numA - numB;
      });

    console.log(`Found ${audioFiles.length} audio segment(s) to process`);

    if (audioFiles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No audio segments found in folder' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process each segment sequentially through Whisper
    const allTranscripts: { index: number; text: string; fileName: string }[] = [];
    const errors: { index: number; fileName: string; error: string }[] = [];

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      const filePath = `${folderPath}/${file.name}`;
      console.log(`Processing segment ${i + 1}/${audioFiles.length}: ${file.name}`);

      try {
        // Download segment
        const { data: audioData, error: downloadError } = await supabase.storage
          .from('meeting-audio-backups')
          .download(filePath);

        if (downloadError || !audioData) {
          console.error(`Failed to download ${file.name}:`, downloadError);
          errors.push({ index: i, fileName: file.name, error: downloadError?.message || 'Download failed' });
          continue;
        }

        // Determine mime type from extension
        const ext = file.name.split('.').pop() || 'webm';
        const mimeMap: Record<string, string> = {
          webm: 'audio/webm', weba: 'audio/webm', m4a: 'audio/m4a',
          mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
        };
        const mimeType = mimeMap[ext] || 'audio/webm';

        // Send directly to Whisper as FormData (no base64 conversion)
        const formData = new FormData();
        const blob = new Blob([await audioData.arrayBuffer()], { type: mimeType });
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
          console.error(`Whisper failed for segment ${i}:`, errorText);

          // If file is too large for Whisper (>25MB), try splitting via the chunks function
          if (response.status === 413 || errorText.includes('too large')) {
            console.log(`Segment ${i} too large, attempting chunked processing...`);
            const chunkedResult = await processLargeSegment(supabase, filePath, backup.meeting_id, backup.user_id);
            if (chunkedResult) {
              allTranscripts.push({ index: i, text: chunkedResult, fileName: file.name });
              continue;
            }
          }

          errors.push({ index: i, fileName: file.name, error: `Whisper error: ${response.status}` });
          continue;
        }

        const result = await response.json();
        if (result.text && result.text.trim()) {
          allTranscripts.push({ index: i, text: result.text.trim(), fileName: file.name });
          console.log(`Segment ${i} transcribed: ${result.text.length} chars`);
        }

        // Rate limiting between segments
        if (i < audioFiles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (segError) {
        console.error(`Error processing segment ${i}:`, segError);
        errors.push({ index: i, fileName: file.name, error: String(segError) });
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
      )
    }

    // Combine all transcripts in order
    const combinedText = allTranscripts
      .sort((a, b) => a.index - b.index)
      .map(t => t.text)
      .join('\n\n');

    console.log(`Combined transcript: ${combinedText.length} chars from ${allTranscripts.length} segments`);

    // Update the meeting transcript
    const { error: deleteError } = await supabase
      .from('meeting_transcripts')
      .delete()
      .eq('meeting_id', backup.meeting_id);

    if (deleteError) {
      console.error('Failed to delete existing transcript:', deleteError);
    }

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
      )
    }

    // Update the meeting word count
    const wordCount = combinedText.split(/\s+/).filter(Boolean).length;
    await supabase
      .from('meetings')
      .update({ word_count: wordCount })
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
    )

  } catch (error) {
    console.error('Error in reprocess-audio-backup function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Handle segments larger than 25MB by splitting into 5MB byte-level chunks
async function processLargeSegment(
  supabase: any,
  filePath: string,
  meetingId: string,
  userId: string
): Promise<string | null> {
  try {
    const { data: audioData, error } = await supabase.storage
      .from('meeting-audio-backups')
      .download(filePath);

    if (error || !audioData) return null;

    const buffer = await audioData.arrayBuffer();
    const chunkSize = 5 * 1024 * 1024; // 5MB
    const chunks: ArrayBuffer[] = [];

    for (let i = 0; i < buffer.byteLength; i += chunkSize) {
      chunks.push(buffer.slice(i, i + chunkSize));
    }

    console.log(`Large segment split into ${chunks.length} chunks`);

    const texts: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const formData = new FormData();
      const blob = new Blob([chunks[i]], { type: 'audio/webm' });
      formData.append('file', blob, `chunk_${i}.webm`);
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');
      formData.append('prompt', 'UK healthcare practice meeting transcription.');

      const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
        body: formData,
      });

      if (resp.ok) {
        const r = await resp.json();
        if (r.text?.trim()) texts.push(r.text.trim());
      }

      if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 500));
    }

    return texts.length > 0 ? texts.join(' ') : null;
  } catch (e) {
    console.error('Large segment processing failed:', e);
    return null;
  }
}