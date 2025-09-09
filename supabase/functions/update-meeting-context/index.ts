import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      meetingId, 
      agenda, 
      attendees, 
      meetingLocation, 
      meetingFormat,
      additionalContext,
      additionalTranscript,
      regenerateNotes = false
    } = await req.json();

    if (!meetingId) {
      return new Response(
        JSON.stringify({ error: 'Meeting ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Updating meeting context for:', meetingId);

    // Update meeting details
    const updateData: any = {};
    
    if (agenda !== undefined) updateData.agenda = agenda;
    if (attendees !== undefined) updateData.attendees = attendees;
    if (meetingLocation !== undefined) updateData.meeting_location = meetingLocation;
    if (meetingFormat !== undefined) updateData.meeting_format = meetingFormat;
    
    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();
      
      const { error: updateError } = await supabaseClient
        .from('meetings')
        .update(updateData)
        .eq('id', meetingId);

      if (updateError) {
        console.error('Error updating meeting:', updateError);
        throw updateError;
      }
    }

    // Save additional context if provided
    if (additionalContext?.trim()) {
      // Store context directly in meetings table
      const { error: contextError } = await supabaseClient
        .from('meetings')
        .update({
          additional_context: additionalContext.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', meetingId);
      
      if (contextError) {
        console.error('Error saving additional context:', contextError);
      }
    }

    // Save additional transcript if provided
    if (additionalTranscript?.trim()) {
        const { error: transcriptError } = await supabaseClient
          .from('meeting_transcripts')
          .insert({
            meeting_id: meetingId,
            content: additionalTranscript.trim(),
            created_at: new Date().toISOString()
          });
      
      if (transcriptError) {
        console.error('Error saving additional transcript:', transcriptError);
      }
    }

    // Optionally trigger notes regeneration
    if (regenerateNotes) {
      const { error: regenError } = await supabaseClient
        .from('meetings')
        .update({
          notes_generation_status: 'queued',
          updated_at: new Date().toISOString()
        })
        .eq('id', meetingId);

      if (regenError) {
        console.error('Error queuing notes regeneration:', regenError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Meeting context updated successfully',
        updatedFields: Object.keys(updateData)
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in update-meeting-context function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});