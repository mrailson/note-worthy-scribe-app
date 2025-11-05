import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🤖 Enhanced Background Transcript Cleaner starting...');
  
  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { batchSize = 10, scheduledRun = false, mode = 'hybrid' } = await req.json().catch(() => ({}));

    console.log(`🔍 Enhanced cleaning mode: ${mode} (batch size: ${batchSize})...`);

    // Phase 1: Handle failed realtime chunks (Priority 1)
    const failedChunks = await handleFailedRealtimeChunks(supabase, openAIApiKey);
    
    // Phase 2: Process uncleaned full transcripts (Priority 2)  
    const fullTranscripts = await handleUncleanedFullTranscripts(supabase, openAIApiKey, batchSize);

    // Phase 3: Consolidate cleaned chunks into full meeting transcripts
    const consolidatedMeetings = await consolidateCleanedChunks(supabase, batchSize);

    const totalProcessed = failedChunks.processed + fullTranscripts.processed;
    const totalFailed = failedChunks.failed + fullTranscripts.failed;

    // Update daily statistics
    await supabase.rpc('update_transcript_cleaning_stats');
    await supabase.rpc('update_chunk_cleaning_stats', {
      p_chunks_processed: failedChunks.processed,
      p_is_realtime: false,
      p_processing_time_ms: failedChunks.totalTime || 0,
      p_failed_count: failedChunks.failed
    });

    console.log(`🎉 Enhanced background cleaning completed:`, {
      failedChunks: failedChunks.processed,
      fullTranscripts: fullTranscripts.processed,
      consolidated: consolidatedMeetings.consolidated,
      totalFailed
    });

    return new Response(JSON.stringify({
      success: true,
      message: `Enhanced cleaning completed`,
      failedChunksProcessed: failedChunks.processed,
      fullTranscriptsProcessed: fullTranscripts.processed,
      consolidatedMeetings: consolidatedMeetings.consolidated,
      totalProcessed,
      totalFailed,
      details: {
        failedChunks: failedChunks.results,
        fullTranscripts: fullTranscripts.results,
        consolidations: consolidatedMeetings.results
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Enhanced background transcript cleaner error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Handle failed realtime chunks (Priority 1)
async function handleFailedRealtimeChunks(supabase: any, apiKey: string) {
  console.log('🔧 Phase 1: Processing failed realtime chunks...');
  
  const { data: failedChunks, error } = await supabase
    .from('meeting_transcription_chunks')
    .select('id, meeting_id, transcription_text, word_count, chunk_number')
    .eq('cleaning_status', 'failed')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !failedChunks?.length) {
    console.log(`✅ No failed chunks found to retry`);
    return { processed: 0, failed: 0, results: [] };
  }

  console.log(`🔄 Found ${failedChunks.length} failed chunks to retry`);
  
  const results = [];
  let processed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (const chunk of failedChunks) {
    try {
      console.log(`🧹 Retrying chunk ${chunk.id}...`);
      
      // Update status to processing
      await supabase
        .from('meeting_transcription_chunks')
        .update({ cleaning_status: 'processing' })
        .eq('id', chunk.id);

      // Clean the chunk
      const cleanedText = await cleanTranscriptChunk(chunk.transcription_text, apiKey);
      
      // Update with cleaned text
      await supabase
        .from('meeting_transcription_chunks')
        .update({
          cleaned_text: cleanedText,
          cleaning_status: 'completed',
          cleaned_at: new Date().toISOString()
        })
        .eq('id', chunk.id);

      results.push({ chunkId: chunk.id, status: 'completed' });
      processed++;
      
    } catch (error) {
      console.error(`❌ Failed to retry chunk ${chunk.id}:`, error);
      
      await supabase
        .from('meeting_transcription_chunks')
        .update({ cleaning_status: 'failed' })
        .eq('id', chunk.id);
      
      results.push({ chunkId: chunk.id, status: 'failed', error: error.message });
      failed++;
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`✅ Phase 1 completed: ${processed} retried, ${failed} failed`);
  
  return { processed, failed, totalTime, results };
}

// Handle uncleaned full transcripts (Priority 2)
async function handleUncleanedFullTranscripts(supabase: any, apiKey: string, batchSize: number) {
  console.log('📄 Phase 2: Processing uncleaned full transcripts...');
  
  // Find meetings with transcripts but no chunk-level cleaning
  const { data: uncleanedMeetings, error } = await supabase.rpc('find_uncleaned_transcripts', {
    batch_size: batchSize
  });

  if (error || !uncleanedMeetings?.length) {
    console.log(`✅ No uncleaned full transcripts found`);
    return { processed: 0, failed: 0, results: [] };
  }

  console.log(`📋 Found ${uncleanedMeetings.length} uncleaned full transcripts`);

  const results = [];
  let processed = 0;
  let failed = 0;

  for (const meeting of uncleanedMeetings) {
    try {
      console.log(`🧹 Cleaning full transcript for meeting ${meeting.meeting_id}...`);
      
      const startTime = Date.now();
      
      // Create cleaning job
      const { data: jobData, error: jobError } = await supabase
        .from('transcript_cleaning_jobs')
        .insert({
          meeting_id: meeting.meeting_id,
          processing_status: 'processing',
          is_realtime_cleaning: false,
          word_count: meeting.word_count,
          started_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (jobError) throw jobError;

      // Clean using existing GPT function
      const { data: cleanedData, error: cleanError } = await supabase.functions.invoke('gpt-clean-transcript', {
        body: { 
          transcript: meeting.transcript_text,
          chunkSize: 2000 
        }
      });

      if (cleanError || !cleanedData?.cleanedTranscript) {
        throw new Error(`Cleaning failed: ${cleanError?.message || 'No cleaned transcript'}`);
      }

      // Update meeting
      await supabase
        .from('meetings')
        .update({
          transcript: cleanedData.cleanedTranscript,
          updated_at: new Date().toISOString()
        })
        .eq('id', meeting.meeting_id);

      const processingDuration = Date.now() - startTime;

      // Complete job
      await supabase
        .from('transcript_cleaning_jobs')
        .update({
          processing_status: 'completed',
          completed_at: new Date().toISOString(),
          processing_duration_ms: processingDuration
        })
        .eq('id', jobData.id);

      results.push({ 
        meetingId: meeting.meeting_id, 
        status: 'completed',
        processingDuration 
      });
      processed++;
      
    } catch (error) {
      console.error(`❌ Failed to clean meeting ${meeting.meeting_id}:`, error);
      
      results.push({ 
        meetingId: meeting.meeting_id, 
        status: 'failed', 
        error: error.message 
      });
      failed++;
    }
  }

  console.log(`✅ Phase 2 completed: ${processed} processed, ${failed} failed`);
  return { processed, failed, results };
}

// Consolidate cleaned chunks into full meeting transcripts
async function consolidateCleanedChunks(supabase: any, batchSize: number) {
  console.log('🔄 Phase 3: Consolidating chunks (including pending) into full transcripts...');
  
  // Find meetings with any transcription chunks (pending or completed)
  const { data: meetingsToConsolidate, error } = await supabase
    .from('meetings')
    .select(`
      id,
      transcript,
      updated_at,
      meeting_transcription_chunks!inner (
        id,
        cleaned_text,
        chunk_number,
        cleaning_status,
        transcription_text
      )
    `)
    .in('meeting_transcription_chunks.cleaning_status', ['completed', 'pending'])
    .limit(batchSize);

  if (error || !meetingsToConsolidate?.length) {
    console.log(`✅ No meetings found needing consolidation`);
    return { consolidated: 0, results: [] };
  }

  console.log(`🔄 Found ${meetingsToConsolidate.length} meetings to consolidate`);

  const results = [];
  let consolidated = 0;

  for (const meeting of meetingsToConsolidate) {
    try {
      // Get all chunks for this meeting (completed or pending)
      const { data: chunks, error: chunkError } = await supabase
        .from('meeting_transcription_chunks')
        .select('cleaned_text, chunk_number, cleaning_status, transcription_text, word_count')
        .eq('meeting_id', meeting.id)
        .in('cleaning_status', ['completed', 'pending'])
        .order('chunk_number');

      if (chunkError || !chunks?.length) continue;

      // Combine chunks: use cleaned_text if available, otherwise parse raw transcription
      const consolidatedTranscript = chunks
        .map(chunk => {
          // Prefer cleaned text if available and status is completed
          if (chunk.cleaned_text && chunk.cleaning_status === 'completed') {
            return chunk.cleaned_text;
          }
          
          // Fallback to raw transcription_text for pending chunks
          try {
            const parsed = JSON.parse(chunk.transcription_text);
            if (Array.isArray(parsed)) {
              return parsed.map(seg => seg.text || '').join(' ');
            }
            return chunk.transcription_text;
          } catch {
            return chunk.transcription_text;
          }
        })
        .join(' ')
        .trim();

      if (!consolidatedTranscript) continue;

      const totalWords = chunks.reduce((sum, chunk) => sum + (chunk.word_count || 0), 0);

      // Update meeting with consolidated transcript
      await supabase
        .from('meetings')
        .update({
          transcript: consolidatedTranscript,
          updated_at: new Date().toISOString()
        })
        .eq('id', meeting.id);

      results.push({
        meetingId: meeting.id,
        chunksConsolidated: chunks.length,
        transcriptLength: consolidatedTranscript.length,
        totalWords,
        cleanedChunks: chunks.filter(c => c.cleaning_status === 'completed').length,
        pendingChunks: chunks.filter(c => c.cleaning_status === 'pending').length
      });
      
      consolidated++;
      console.log(`✅ Consolidated ${chunks.length} chunks (${chunks.filter(c => c.cleaning_status === 'completed').length} cleaned, ${chunks.filter(c => c.cleaning_status === 'pending').length} pending) for meeting ${meeting.id}`);
      
    } catch (error) {
      console.error(`❌ Failed to consolidate meeting ${meeting.id}:`, error);
      results.push({
        meetingId: meeting.id,
        status: 'failed',
        error: error.message
      });
    }
  }

  console.log(`✅ Phase 3 completed: ${consolidated} meetings consolidated`);
  return { consolidated, results };
}

async function cleanTranscriptChunk(text: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert transcript cleaner. Clean and improve transcribed text while preserving original meaning.

TASKS: Fix speech-to-text errors, remove excessive filler words, fix punctuation/capitalization, resolve unclear words using context, keep medical terminology accurate.

PRESERVE: All factual information, speaker's tone, technical terms, numbers/dates/proper nouns.

Return ONLY the cleaned text.`
        },
        {
          role: 'user',
          content: `Clean this transcript:\n\n${text}`
        }
      ],
      max_tokens: Math.min(Math.ceil(text.length * 1.5), 4000),
      temperature: 0.3
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.choices[0].message.content.trim();
}