import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚨 EMERGENCY SCAN: Starting transcript data loss detection...');
    
    // Use the emergency detection function we created
    const { data: scanResults, error: scanError } = await supabase
      .rpc('emergency_detect_transcript_data_loss');

    if (scanError) {
      throw new Error(`Scan failed: ${scanError.message}`);
    }

    console.log(`📊 SCAN COMPLETE: Found ${scanResults.length} meetings to analyze`);

    // Categorize results
    const criticalIssues = scanResults.filter((r: any) => r.severity === 'CRITICAL');
    const healthyMeetings = scanResults.filter((r: any) => r.severity === 'OK');

    console.log(`🔴 CRITICAL ISSUES: ${criticalIssues.length}`);
    console.log(`✅ HEALTHY MEETINGS: ${healthyMeetings.length}`);

    // Log each critical issue
    for (const issue of criticalIssues) {
      console.log(`🚨 CRITICAL: Meeting "${issue.meeting_title}" (${issue.meeting_id})`);
      console.log(`   - Word Count: ${issue.word_count}`);
      console.log(`   - Chunks: ${issue.chunk_count}`);
      console.log(`   - Created: ${new Date(issue.created_at).toLocaleString()}`);
    }

    const report = {
      timestamp: new Date().toISOString(),
      totalMeetingsScanned: scanResults.length,
      criticalIssues: criticalIssues.length,
      healthyMeetings: healthyMeetings.length,
      status: criticalIssues.length > 0 ? 'CRITICAL_ISSUES_FOUND' : 'ALL_HEALTHY',
      criticalMeetings: criticalIssues.map((meeting: any) => ({
        meetingId: meeting.meeting_id,
        title: meeting.meeting_title,
        wordCount: meeting.word_count,
        chunkCount: meeting.chunk_count,
        createdAt: meeting.created_at,
        userId: meeting.user_id,
        bugType: 'transcript_data_loss'
      })),
      summary: {
        message: criticalIssues.length > 0 
          ? `EMERGENCY: Found ${criticalIssues.length} meetings with transcript data loss bug!`
          : 'All meetings have healthy transcript data.',
        recommendations: criticalIssues.length > 0 
          ? [
              'Check for audio backups to recover lost transcripts',
              'Verify the new integrity system is working for future meetings',
              'Consider reprocessing audio for affected meetings'
            ]
          : [
              'System is working correctly',
              'Continue monitoring for future issues'
            ]
      }
    };

    // Store the scan results
    if (criticalIssues.length > 0) {
      await supabase
        .from('system_audit_log')
        .insert({
          table_name: 'emergency_scan',
          operation: 'CRITICAL_ISSUES_DETECTED',
          new_values: {
            criticalMeetingsCount: criticalIssues.length,
            affectedMeetingIds: criticalIssues.map((m: any) => m.meeting_id),
            scanTimestamp: report.timestamp,
            status: 'emergency'
          }
        });
    }

    console.log('✅ SCAN REPORT GENERATED');
    
    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ EMERGENCY SCAN FAILED:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      status: 'SCAN_FAILED'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});