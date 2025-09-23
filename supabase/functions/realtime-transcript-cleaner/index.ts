import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChunkCleaningRequest {
  chunkIds?: string[];
  batchSize?: number;
  priorityMeetingId?: string;
  isScheduledRun?: boolean;
}

interface ChunkData {
  chunk_id: string;
  meeting_id: string;
  transcription_text: string;
  word_count: number;
  chunk_number: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 Realtime Transcript Cleaner starting...');
  
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

    // Parse request body
    const requestBody: ChunkCleaningRequest = await req.json().catch(() => ({}));
    const { 
      chunkIds, 
      batchSize = 5, 
      priorityMeetingId, 
      isScheduledRun = false 
    } = requestBody;

    console.log(`🔍 Looking for chunks needing realtime cleaning (batch size: ${batchSize})...`);

    let chunksToProcess: ChunkData[];

    if (chunkIds && chunkIds.length > 0) {
      // Process specific chunks
      console.log(`🎯 Processing specific chunks: ${chunkIds.join(', ')}`);
      const { data, error } = await supabase
        .from('meeting_transcription_chunks')
        .select('id, meeting_id, transcription_text, word_count, chunk_number')
        .in('id', chunkIds);
      
      if (error) throw error;
      
      chunksToProcess = (data || []).map(chunk => ({
        chunk_id: chunk.id,
        meeting_id: chunk.meeting_id,
        transcription_text: chunk.transcription_text,
        word_count: chunk.word_count,
        chunk_number: chunk.chunk_number
      }));
    } else {
      // Find chunks needing cleaning using database function
      const { data, error } = await supabase.rpc('find_chunks_needing_realtime_cleaning', {
        batch_size: batchSize
      });

      if (error) {
        console.error('❌ Failed to find chunks needing cleaning:', error);
        throw new Error(`Failed to find chunks: ${error.message}`);
      }

      chunksToProcess = data || [];
    }

    console.log(`📋 Found ${chunksToProcess.length} chunks to process`);

    if (chunksToProcess.length === 0) {
      console.log('✅ No chunks found needing realtime cleaning');
      
      // Update statistics
      await supabase.rpc('update_chunk_cleaning_stats', {
        p_chunks_processed: 0,
        p_is_realtime: true,
        p_processing_time_ms: 0,
        p_failed_count: 0
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'No chunks found needing cleaning',
        processed: 0,
        failed: 0,
        chunkIds: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const processedChunks = [];
    const failedChunks = [];
    const totalStartTime = Date.now();

    // Process each chunk
    for (const chunk of chunksToProcess) {
      const chunkStartTime = Date.now();
      
      try {
        console.log(`🧹 Cleaning chunk ${chunk.chunk_id} (${chunk.word_count} words)...`);

        // Create cleaning job record
        const { data: jobData, error: jobError } = await supabase
          .from('transcript_cleaning_jobs')
          .insert({
            chunk_id: chunk.chunk_id,
            meeting_id: chunk.meeting_id,
            processing_status: 'processing',
            is_realtime_cleaning: true,
            word_count: chunk.word_count,
            started_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (jobError) {
          console.error(`❌ Failed to create cleaning job for chunk ${chunk.chunk_id}:`, jobError);
          continue;
        }

        // Update chunk status to processing
        await supabase
          .from('meeting_transcription_chunks')
          .update({ 
            cleaning_status: 'processing'
          })
          .eq('id', chunk.chunk_id);

        // Clean the transcript using OpenAI
        const cleanedText = await cleanTranscriptChunk(chunk.transcription_text, openAIApiKey);
        
        const chunkEndTime = Date.now();
        const processingDuration = chunkEndTime - chunkStartTime;

        // Update chunk with cleaned text
        const { error: updateError } = await supabase
          .from('meeting_transcription_chunks')
          .update({
            cleaned_text: cleanedText,
            cleaning_status: 'completed',
            cleaned_at: new Date().toISOString(),
            cleaning_duration_ms: processingDuration
          })
          .eq('id', chunk.chunk_id);

        if (updateError) {
          throw updateError;
        }

        // Update cleaning job as completed
        await supabase
          .from('transcript_cleaning_jobs')
          .update({
            processing_status: 'completed',
            completed_at: new Date().toISOString(),
            processing_duration_ms: processingDuration
          })
          .eq('id', jobData.id);

        processedChunks.push({
          chunkId: chunk.chunk_id,
          meetingId: chunk.meeting_id,
          originalLength: chunk.transcription_text.length,
          cleanedLength: cleanedText.length,
          processingDuration
        });

        console.log(`✅ Chunk ${chunk.chunk_id} cleaned successfully (${processingDuration}ms)`);

      } catch (error) {
        const chunkEndTime = Date.now();
        const processingDuration = chunkEndTime - chunkStartTime;
        
        console.error(`❌ Failed to clean chunk ${chunk.chunk_id}:`, error);

        // Update chunk as failed
        await supabase
          .from('meeting_transcription_chunks')
          .update({
            cleaning_status: 'failed'
          })
          .eq('id', chunk.chunk_id);

        // Update cleaning job as failed
        const { data: jobData } = await supabase
          .from('transcript_cleaning_jobs')
          .select('id')
          .eq('chunk_id', chunk.chunk_id)
          .eq('is_realtime_cleaning', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (jobData) {
          await supabase
            .from('transcript_cleaning_jobs')
            .update({
              processing_status: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error',
              completed_at: new Date().toISOString(),
              processing_duration_ms: processingDuration
            })
            .eq('id', jobData.id);
        }

        failedChunks.push({
          chunkId: chunk.chunk_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const totalProcessingTime = Date.now() - totalStartTime;

    // Update statistics
    await supabase.rpc('update_chunk_cleaning_stats', {
      p_chunks_processed: processedChunks.length,
      p_is_realtime: true,
      p_processing_time_ms: totalProcessingTime,
      p_failed_count: failedChunks.length
    });

    console.log(`🎉 Realtime cleaning completed: ${processedChunks.length} processed, ${failedChunks.length} failed in ${totalProcessingTime}ms`);

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${processedChunks.length} chunks successfully`,
      processed: processedChunks.length,
      failed: failedChunks.length,
      totalProcessingTime,
      processedChunks,
      failedChunks
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Realtime transcript cleaner error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function cleanTranscriptChunk(text: string, apiKey: string): Promise<string> {
  console.log(`🧠 Calling OpenAI to clean chunk (${text.length} characters)...`);
  
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
          content: `You are an expert transcript cleaner. Your job is to clean and improve transcribed text while preserving the original meaning and important details.

CLEANING TASKS:
1. Fix obvious speech-to-text errors and typos
2. Remove filler words (um, uh, like when excessive)
3. Fix punctuation and capitalization
4. Resolve unclear or garbled words using context
5. Maintain speaker intent and meaning
6. Keep medical terminology accurate if present
7. Preserve all numbers, dates, and proper nouns

PRESERVATION RULES:
- Keep all factual information intact
- Maintain the speaker's tone and style
- Don't add information that wasn't implied
- Keep technical terms and jargon appropriate to context
- Preserve natural speech patterns where they add meaning

Return ONLY the cleaned text, no explanations.`
        },
        {
          role: 'user',
          content: `Clean this transcript chunk:\n\n${text}`
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
  
  if (!result.choices?.[0]?.message?.content) {
    throw new Error('Invalid OpenAI response format');
  }

  const cleanedText = result.choices[0].message.content.trim();
  console.log(`✨ Chunk cleaned: ${text.length} → ${cleanedText.length} characters`);
  
  return cleanedText;
}