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

interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  meetingId?: string;
  userId?: string;
  metadata: any;
  createdAt: string;
}

// Real-time monitoring for transcript data loss
async function monitorTranscriptIntegrity() {
  console.log('🔍 MONITOR: Starting transcript integrity scan...');
  
  const alerts: Alert[] = [];
  
  // Check for meetings with word count but no transcript (last 24 hours)
  const { data: suspiciousMeetings, error } = await supabase
    .from('meetings')
    .select(`
      id, user_id, word_count, title, created_at,
      meeting_transcription_chunks!inner(count)
    `)
    .gt('word_count', 0)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .not('meeting_transcription_chunks', 'is', null);

  if (error) {
    console.error('Error checking suspicious meetings:', error);
  } else if (suspiciousMeetings) {
    for (const meeting of suspiciousMeetings) {
      // Check if chunks actually contain text
      const { data: chunks } = await supabase
        .from('meeting_transcription_chunks')
        .select('transcription_text')
        .eq('meeting_id', meeting.id);

      const hasEmptyChunks = chunks && chunks.length > 0 && 
        chunks.every(chunk => !chunk.transcription_text || chunk.transcription_text.trim() === '');
      
      const hasNoChunks = !chunks || chunks.length === 0;

      if (hasEmptyChunks || hasNoChunks) {
        alerts.push({
          id: `transcript-loss-${meeting.id}`,
          type: 'transcript_data_loss',
          severity: 'critical',
          title: 'Critical: Transcript Data Loss Detected',
          description: `Meeting "${meeting.title}" has ${meeting.word_count} word count but ${hasNoChunks ? 'no transcript chunks' : 'empty transcript chunks'}. This is the exact bug we're trying to prevent!`,
          meetingId: meeting.id,
          userId: meeting.user_id,
          metadata: {
            wordCount: meeting.word_count,
            chunkCount: chunks?.length || 0,
            hasEmptyChunks,
            hasNoChunks,
            createdAt: meeting.created_at
          },
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  // Check for meetings without audio backups
  const { data: meetingsWithoutBackups } = await supabase
    .from('meetings')
    .select(`
      id, user_id, title, created_at,
      meeting_audio_backups!left(id)
    `)
    .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()) // Last 6 hours
    .is('meeting_audio_backups.id', null)
    .gt('word_count', 100); // Only alert for substantial meetings

  if (meetingsWithoutBackups && meetingsWithoutBackups.length > 0) {
    for (const meeting of meetingsWithoutBackups) {
      alerts.push({
        id: `missing-backup-${meeting.id}`,
        type: 'missing_audio_backup',
        severity: 'medium',
        title: 'Missing Audio Backup',
        description: `Meeting "${meeting.title}" has no audio backup for recovery purposes`,
        meetingId: meeting.id,
        userId: meeting.user_id,
        metadata: {
          createdAt: meeting.created_at
        },
        createdAt: new Date().toISOString()
      });
    }
  }

  // Check for processing failures (edge functions that failed)
  const { data: recentFailures } = await supabase
    .from('system_audit_log')
    .select('*')
    .eq('operation', 'ATOMIC_SAVE_FAILED')
    .gte('timestamp', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()); // Last 2 hours

  if (recentFailures && recentFailures.length > 0) {
    alerts.push({
      id: `processing-failures-${Date.now()}`,
      type: 'processing_failures',
      severity: 'high',
      title: 'Transcript Processing Failures',
      description: `${recentFailures.length} atomic save failures detected in the last 2 hours`,
      metadata: {
        failureCount: recentFailures.length,
        failures: recentFailures.map(f => ({
          meetingId: f.record_id,
          userId: f.user_id,
          error: f.new_values?.error,
          timestamp: f.timestamp
        }))
      },
      createdAt: new Date().toISOString()
    });
  }

  console.log(`🚨 MONITOR: Found ${alerts.length} alerts`);
  
  // Store alerts for review
  if (alerts.length > 0) {
    for (const alert of alerts) {
      await supabase
        .from('system_monitoring_alerts')
        .upsert({
          alert_id: alert.id,
          alert_type: alert.type,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          meeting_id: alert.meetingId,
          user_id: alert.userId,
          metadata: alert.metadata,
          status: 'active',
          created_at: alert.createdAt
        }, {
          onConflict: 'alert_id'
        });
    }
  }

  return alerts;
}

// Generate summary report
async function generateMonitoringReport() {
  const alerts = await monitorTranscriptIntegrity();
  
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const highAlerts = alerts.filter(a => a.severity === 'high');
  const mediumAlerts = alerts.filter(a => a.severity === 'medium');
  
  // Get system health metrics
  const { data: healthMetrics } = await supabase.rpc('get_database_table_sizes');
  
  const report = {
    timestamp: new Date().toISOString(),
    status: criticalAlerts.length > 0 ? 'critical' : 
            highAlerts.length > 0 ? 'degraded' : 
            mediumAlerts.length > 0 ? 'warning' : 'healthy',
    summary: {
      totalAlerts: alerts.length,
      critical: criticalAlerts.length,
      high: highAlerts.length,
      medium: mediumAlerts.length,
      low: alerts.filter(a => a.severity === 'low').length
    },
    alerts: alerts,
    systemHealth: {
      databaseSize: healthMetrics,
      uptime: 'Available', // Could be calculated
      lastCheck: new Date().toISOString()
    }
  };

  // Log the monitoring report
  await supabase
    .from('system_audit_log')
    .insert({
      table_name: 'monitoring',
      operation: 'HEALTH_CHECK',
      new_values: {
        status: report.status,
        alertCount: alerts.length,
        criticalIssues: criticalAlerts.map(a => a.description)
      }
    });

  console.log(`📊 REPORT: System status: ${report.status} (${alerts.length} alerts)`);
  
  return report;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();
    
    console.log(`📨 MONITORING: ${action} request received`);

    switch (action) {
      case 'check_integrity':
        const alerts = await monitorTranscriptIntegrity();
        return new Response(JSON.stringify({ alerts }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'health_report':
        const report = await generateMonitoringReport();
        return new Response(JSON.stringify(report), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'alert_dashboard':
        // Get recent alerts for dashboard
        const { data: recentAlerts } = await supabase
          .from('system_monitoring_alerts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        return new Response(JSON.stringify({ alerts: recentAlerts || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('❌ MONITORING ERROR:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});