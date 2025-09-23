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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🤖 Background Transcript Cleaner starting...');
    
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get batch size from request or use default
    const { batchSize = 5 } = await req.json().catch(() => ({}));
    
    // Find uncleaned transcripts
    console.log(`🔍 Looking for uncleaned transcripts (batch size: ${batchSize})...`);
    
    const { data: uncleanedTranscripts, error: findError } = await supabase
      .rpc('find_uncleaned_transcripts', { batch_size: batchSize });
    
    if (findError) {
      throw new Error(`Failed to find uncleaned transcripts: ${findError.message}`);
    }
    
    if (!uncleanedTranscripts || uncleanedTranscripts.length === 0) {
      console.log('✅ No uncleaned transcripts found');
      
      // Update daily stats
      await supabase.rpc('update_transcript_cleaning_stats');
      
      return new Response(JSON.stringify({
        success: true,
        message: 'No uncleaned transcripts found',
        processedCount: 0,
        completedCount: 0,
        failedCount: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`📋 Found ${uncleanedTranscripts.length} transcripts to clean`);
    
    let processedCount = 0;
    let completedCount = 0;
    let failedCount = 0;
    
    // Process each transcript
    for (const transcript of uncleanedTranscripts) {
      const { meeting_id, transcript_text, word_count } = transcript;
      
      console.log(`🧹 Processing transcript for meeting ${meeting_id} (${word_count} words)`);
      
      const processingStartTime = new Date();
      
      try {
        // Create job record
        const { data: job, error: jobError } = await supabase
          .from('transcript_cleaning_jobs')
          .insert({
            meeting_id,
            original_transcript_length: transcript_text.length,
            word_count,
            processing_status: 'processing',
            processing_start_time: processingStartTime.toISOString()
          })
          .select()
          .single();
        
        if (jobError) {
          console.error(`❌ Failed to create job for meeting ${meeting_id}:`, jobError);
          failedCount++;
          continue;
        }
        
        // Clean the transcript using the same function as the UI
        console.log(`🔄 Calling gpt-clean-transcript for meeting ${meeting_id}...`);
        
        const { data: cleanResult, error: cleanError } = await supabase.functions.invoke('gpt-clean-transcript', {
          body: { 
            transcript: transcript_text,
            chunkSize: 1000 // Default chunk size
          }
        });
        
        const processingEndTime = new Date();
        const processingDuration = processingEndTime.getTime() - processingStartTime.getTime();
        
        if (cleanError || !cleanResult?.cleanedTranscript) {
          console.error(`❌ Failed to clean transcript for meeting ${meeting_id}:`, cleanError);
          
          // Update job as failed
          await supabase
            .from('transcript_cleaning_jobs')
            .update({
              processing_status: 'failed',
              processing_end_time: processingEndTime.toISOString(),
              processing_duration_ms: processingDuration,
              error_message: cleanError?.message || 'Unknown error during cleaning'
            })
            .eq('id', job.id);
          
          failedCount++;
          continue;
        }
        
        // Update the meeting with cleaned transcript
        const { error: updateError } = await supabase
          .from('meetings')
          .update({
            transcript: cleanResult.cleanedTranscript,
            updated_at: new Date().toISOString()
          })
          .eq('id', meeting_id);
        
        if (updateError) {
          console.error(`❌ Failed to update meeting ${meeting_id} with cleaned transcript:`, updateError);
          
          // Update job as failed
          await supabase
            .from('transcript_cleaning_jobs')
            .update({
              processing_status: 'failed',
              processing_end_time: processingEndTime.toISOString(),
              processing_duration_ms: processingDuration,
              error_message: `Failed to update meeting: ${updateError.message}`
            })
            .eq('id', job.id);
          
          failedCount++;
          continue;
        }
        
        // Update job as completed
        await supabase
          .from('transcript_cleaning_jobs')
          .update({
            processing_status: 'completed',
            cleaned_transcript_length: cleanResult.cleanedTranscript.length,
            total_chunks: cleanResult.chunks || 1,
            chunks_processed: cleanResult.chunks || 1,
            processing_end_time: processingEndTime.toISOString(),
            processing_duration_ms: processingDuration
          })
          .eq('id', job.id);
        
        console.log(`✅ Successfully cleaned transcript for meeting ${meeting_id} (${processingDuration}ms)`);
        completedCount++;
        
      } catch (error) {
        console.error(`❌ Error processing meeting ${meeting_id}:`, error);
        failedCount++;
      }
      
      processedCount++;
      
      // Add small delay between processing to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`📊 Background cleaning completed: ${processedCount} processed, ${completedCount} completed, ${failedCount} failed`);
    
    // Update daily statistics
    await supabase.rpc('update_transcript_cleaning_stats');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Background transcript cleaning completed',
      processedCount,
      completedCount,
      failedCount,
      transcripts: uncleanedTranscripts.map(t => ({
        meetingId: t.meeting_id,
        wordCount: t.word_count
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('❌ Background transcript cleaner error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});