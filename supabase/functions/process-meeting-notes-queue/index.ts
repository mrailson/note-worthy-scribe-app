import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QueueItem {
  id: string;
  meeting_id: string;
  status: string;
  detail_level: string;
  note_type: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting meeting notes queue processing...");

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get pending queue items (limit to 10 at a time)
    const { data: queueItems, error: queueError } = await supabase
      .from('meeting_notes_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('retry_count', 3) // Don't retry more than 3 times
      .order('created_at', { ascending: true })
      .limit(10);

    if (queueError) {
      console.error('Error fetching queue items:', queueError);
      return new Response(JSON.stringify({ error: queueError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('No pending items in queue');
      return new Response(JSON.stringify({ 
        message: 'No pending items in queue',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${queueItems.length} pending items to process`);

    const results = [];

    // Process each queue item
    for (const item of queueItems as QueueItem[]) {
      try {
        console.log(`Processing meeting ${item.meeting_id}...`);

        // Update status to processing
        await supabase
          .from('meeting_notes_queue')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', item.id);

        // Get meeting details for multi-type generation
        const { data: meeting, error: meetingError } = await supabase
          .from('meetings')
          .select('title, created_at')
          .eq('id', item.meeting_id)
          .single();

        if (meetingError) {
          throw new Error(`Failed to fetch meeting: ${meetingError.message}`);
        }

        // Get transcript
        const { data: transcriptData, error: transcriptError } = await supabase
          .rpc('get_meeting_full_transcript', { p_meeting_id: item.meeting_id });

        if (transcriptError || !transcriptData?.[0]?.transcript) {
          throw new Error(`Failed to fetch transcript: ${transcriptError?.message || 'No transcript found'}`);
        }

        // Single note generation - check note type for appropriate function
        let functionResult, functionError;
          
          if (item.note_type === 'detailed') {
            // Call detailed minutes generation function for detailed notes
            const { data, error } = await supabase.functions.invoke(
              'generate-meeting-minutes-detailed',
              {
                body: { 
                  meetingId: item.meeting_id
                }
              }
            );
            functionResult = data;
            functionError = error;
            
            // Save the detailed notes to meeting_notes_multi table
            if (!error && data?.meetingMinutes) {
              await supabase
                .from('meeting_notes_multi')
                .upsert({
                  meeting_id: item.meeting_id,
                  note_type: 'detailed',
                  content: data.meetingMinutes,
                  model_used: 'gpt-4.1-2025-04-14',
                  token_count: data.meetingMinutes.length,
                  generated_at: new Date().toISOString()
                });
            }
          } else {
            // Standard/legacy note generation
            const { data, error } = await supabase.functions.invoke(
              'auto-generate-meeting-notes',
              {
                body: { 
                  meetingId: item.meeting_id,
                  forceRegenerate: false
                }
              }
            );
            functionResult = data;
            functionError = error;
          }

        if (functionError) {
          console.error(`Error calling auto-generate function for meeting ${item.meeting_id}:`, functionError);
          
          // Update queue item with error
          await supabase
            .from('meeting_notes_queue')
            .update({
              status: 'failed',
              retry_count: item.retry_count + 1,
              error_message: functionError.message,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);

          results.push({
            meeting_id: item.meeting_id,
            status: 'failed',
            error: functionError.message
          });
        } else {
          console.log(`Successfully processed meeting ${item.meeting_id}`);
          
          // Update queue item as completed
          await supabase
            .from('meeting_notes_queue')
            .update({
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);

          results.push({
            meeting_id: item.meeting_id,
            status: 'completed',
            result: functionResult
          });
        }

      } catch (error) {
        console.error(`Unexpected error processing meeting ${item.meeting_id}:`, error);
        
        // Update queue item with error
        await supabase
          .from('meeting_notes_queue')
          .update({
            status: 'failed',
            retry_count: item.retry_count + 1,
            error_message: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        results.push({
          meeting_id: item.meeting_id,
          status: 'failed',
          error: error.message
        });
      }
    }

    console.log('Queue processing completed');

    return new Response(JSON.stringify({
      message: 'Queue processing completed',
      processed: results.length,
      results: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in queue processor:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);