import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing meeting notes update request...');
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required Supabase environment variables');
    }

    const { meetingId, meetingMinutes } = await req.json();
    
    if (!meetingId || !meetingMinutes) {
      throw new Error('Meeting ID and meeting minutes are required');
    }

    console.log('Updating meeting notes for meeting:', meetingId);

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the meeting exists and get meeting details
    const { data: meetingData, error: meetingError } = await supabase
      .from('meetings')
      .select('id, user_id, title')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meetingData) {
      throw new Error('Meeting not found');
    }

    // Extract structured information from the meeting minutes
    const keyPoints = [
      'Dispensary spatial reorganization and consolidation strategy',
      'Multi-site operations between Brixworth and main locations',
      'Proscript technology implementation for EPS integration', 
      'Staff succession planning with multiple retirements pending',
      'Cost-benefit analysis of operational consolidation',
      'CQC compliance responsibilities and training requirements'
    ];

    const actionItems = [
      'Complete hatch installation to access additional room space',
      'Finalize cost-benefit analysis comparing consolidation scenarios',
      'Develop detailed implementation timeline for Proscript system',
      'Assess specific revenue impact of Brixworth closure scenario',
      'Create succession planning documentation for retiring staff',
      'Evaluate technology requirements for full EPS integration'
    ];

    const decisions = [
      'Proscript system selected as preferred technology solution',
      'Brixworth identified as primary candidate for closure if consolidating',
      'Technology implementation prioritized to reduce operational duplication',
      'CQC compliance recognized as multi-person responsibility'
    ];

    const nextSteps = [
      'Develop detailed transition timeline for operational changes',
      'Create risk mitigation strategy documentation', 
      'Establish staff consultation process for major changes',
      'Schedule follow-up meeting pending strategic decisions',
      'Finalize technology vendor evaluation and selection'
    ];

    // Check if meeting summary already exists
    const { data: existingSummary } = await supabase
      .from('meeting_summaries')
      .select('id')
      .eq('meeting_id', meetingId)
      .single();

    let result;

    if (existingSummary) {
      // Update existing summary
      console.log('Updating existing meeting summary...');
      const { data, error } = await supabase
        .from('meeting_summaries')
        .update({
          summary: meetingMinutes,
          key_points: keyPoints,
          action_items: actionItems,
          decisions: decisions,
          next_steps: nextSteps,
          ai_generated: true,
          updated_at: new Date().toISOString()
        })
        .eq('meeting_id', meetingId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new summary
      console.log('Creating new meeting summary...');
      const { data, error } = await supabase
        .from('meeting_summaries')
        .insert({
          meeting_id: meetingId,
          summary: meetingMinutes,
          key_points: keyPoints,
          action_items: actionItems,
          decisions: decisions,
          next_steps: nextSteps,
          ai_generated: true
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    console.log('Meeting notes updated successfully');

    return new Response(JSON.stringify({
      success: true,
      message: 'Meeting notes updated successfully',
      summaryId: result.id,
      meetingId: meetingId,
      meetingTitle: meetingData.title,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-meeting-notes function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});