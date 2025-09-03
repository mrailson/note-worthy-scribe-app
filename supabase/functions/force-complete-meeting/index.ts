import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    // Parse request body
    const { meetingId, userId } = await req.json();

    if (!meetingId || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing meetingId or userId' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔧 Force completing meeting ${meetingId} for user ${userId}`);

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First verify the meeting exists and belongs to the user
    const { data: meeting, error: fetchError } = await supabase
      .from('meetings')
      .select('id, status, user_id')
      .eq('id', meetingId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('❌ Meeting fetch error:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: `Meeting not found: ${fetchError.message}` }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!meeting) {
      return new Response(
        JSON.stringify({ success: false, error: 'Meeting not found or access denied' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found meeting: ${meeting.id}, current status: ${meeting.status}`);

    // Force update the meeting status using service role
    const { data: updatedMeeting, error: updateError } = await supabase
      .from('meetings')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString(),
        end_time: new Date().toISOString()
      })
      .eq('id', meetingId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Meeting update error:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: `Update failed: ${updateError.message}` }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Meeting successfully completed:', updatedMeeting);

    return new Response(
      JSON.stringify({ 
        success: true, 
        meeting: updatedMeeting,
        message: 'Meeting status forcefully updated to completed'
      }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Critical error in force-complete-meeting:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});