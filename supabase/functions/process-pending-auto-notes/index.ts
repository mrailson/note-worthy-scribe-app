import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🤖 Processing pending auto-notes...');
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all pending auto-notes
    const { data: pendingNotes, error: fetchError } = await supabase
      .from('meeting_auto_notes')
      .select('*')
      .eq('status', 'pending')
      .limit(5); // Process max 5 at a time to avoid timeouts

    if (fetchError) {
      console.error('Error fetching pending notes:', fetchError);
      throw fetchError;
    }

    console.log(`📝 Found ${pendingNotes?.length || 0} pending auto-notes to process`);

    let processed = 0;
    let errors = 0;

    if (pendingNotes && pendingNotes.length > 0) {
      for (const autoNote of pendingNotes) {
        try {
          console.log(`🔄 Processing auto-notes for meeting: ${autoNote.meeting_id}`);
          
          // Mark as processing
          await supabase
            .from('meeting_auto_notes')
            .update({ 
              status: 'processing',
              updated_at: new Date().toISOString()
            })
            .eq('id', autoNote.id);

          // Call the auto-generate function
          const { data: generateResult, error: generateError } = await supabase.functions
            .invoke('auto-generate-meeting-notes', {
              body: { meetingId: autoNote.meeting_id }
            });

          if (generateError) {
            console.error(`❌ Error generating notes for meeting ${autoNote.meeting_id}:`, generateError);
            
            // Mark as failed
            await supabase
              .from('meeting_auto_notes')
              .update({ 
                status: 'failed',
                error_message: generateError.message || 'Unknown error',
                updated_at: new Date().toISOString()
              })
              .eq('id', autoNote.id);
            
            errors++;
            continue;
          }

          console.log(`✅ Successfully generated notes for meeting ${autoNote.meeting_id}`);
          
          // Mark as completed
          await supabase
            .from('meeting_auto_notes')
            .update({ 
              status: 'completed',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', autoNote.id);

          processed++;

        } catch (error) {
          console.error(`💥 Unexpected error processing meeting ${autoNote.meeting_id}:`, error);
          
          // Mark as failed
          await supabase
            .from('meeting_auto_notes')
            .update({ 
              status: 'failed',
              error_message: error.message || 'Unexpected error',
              updated_at: new Date().toISOString()
            })
            .eq('id', autoNote.id);
          
          errors++;
        }
      }
    }

    const result = {
      success: true,
      processed,
      errors,
      total: pendingNotes?.length || 0,
      message: `Processed ${processed} meetings, ${errors} errors`
    };

    console.log('📊 Processing complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Error in process-pending-auto-notes:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      processed: 0,
      errors: 1 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});