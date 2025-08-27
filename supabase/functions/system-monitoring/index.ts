import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MonitoringAlert {
  id: string;
  alert_type: 'table_size' | 'search_history' | 'audit_logs' | 'file_storage';
  severity: 'warning' | 'critical';
  message: string;
  current_value: number;
  threshold_value: number;
  details: Record<string, any>;
  created_at: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const alerts: MonitoringAlert[] = [];
    const timestamp = new Date().toISOString();

    // Check 1: Tables exceeding 10MB
    console.log('🔍 Checking table sizes...');
    try {
      const { data: tableSizes, error: tableSizeError } = await supabaseClient
        .rpc('get_database_table_sizes');
      
      if (!tableSizeError && tableSizes) {
        const largeTables = tableSizes.filter((table: any) => table.size_bytes > 10 * 1024 * 1024); // 10MB
        
        largeTables.forEach((table: any) => {
          alerts.push({
            id: `table_${table.table_name}_${Date.now()}`,
            alert_type: 'table_size',
            severity: table.size_bytes > 50 * 1024 * 1024 ? 'critical' : 'warning', // 50MB = critical
            message: `Table ${table.table_name} has exceeded size threshold`,
            current_value: table.size_bytes,
            threshold_value: 10 * 1024 * 1024,
            details: {
              table_name: table.table_name,
              size_pretty: table.size_pretty,
              row_count: table.row_count
            },
            created_at: timestamp
          });
        });
      }
    } catch (err) {
      console.error('Table size check failed:', err);
    }

    // Check 2: Search history growing >100MB
    console.log('🔍 Checking search history size...');
    try {
      const { data: searchSize, error: searchError } = await supabaseClient
        .rpc('get_large_files_stats');
      
      if (!searchError && searchSize && searchSize.length > 0) {
        const totalFileSize = searchSize[0].total_large_files_size;
        const threshold = 100 * 1024 * 1024; // 100MB
        
        if (totalFileSize > threshold) {
          alerts.push({
            id: `file_storage_${Date.now()}`,
            alert_type: 'file_storage',
            severity: totalFileSize > 500 * 1024 * 1024 ? 'critical' : 'warning', // 500MB = critical
            message: `File storage has exceeded threshold`,
            current_value: totalFileSize,
            threshold_value: threshold,
            details: {
              total_files: searchSize[0].total_large_files,
              files_over_1mb: searchSize[0].files_over_1mb,
              size_pretty: searchSize[0].total_large_files_size_pretty
            },
            created_at: timestamp
          });
        }
      }

      // Also check AI search table specifically
      const { data: aiSearchData, error: aiSearchError } = await supabaseClient
        .from('ai_4_pm_searches')
        .select('*', { count: 'exact' });
      
      if (!aiSearchError && aiSearchData) {
        // Estimate size based on count (rough estimation)
        const estimatedSize = aiSearchData.length * 2048; // Rough estimate per record
        const threshold = 100 * 1024 * 1024; // 100MB
        
        if (estimatedSize > threshold) {
          alerts.push({
            id: `search_history_${Date.now()}`,
            alert_type: 'search_history',
            severity: estimatedSize > 200 * 1024 * 1024 ? 'critical' : 'warning', // 200MB = critical
            message: `AI search history has grown beyond threshold`,
            current_value: estimatedSize,
            threshold_value: threshold,
            details: {
              record_count: aiSearchData.length,
              estimated_size_mb: Math.round(estimatedSize / (1024 * 1024))
            },
            created_at: timestamp
          });
        }
      }
    } catch (err) {
      console.error('Search history check failed:', err);
    }

    // Check 3: Audit logs exceeding 1000 entries/week
    console.log('🔍 Checking audit log volume...');
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const { data: auditLogs, error: auditError } = await supabaseClient
        .from('system_audit_log')
        .select('*', { count: 'exact' })
        .gte('timestamp', oneWeekAgo.toISOString());
      
      if (!auditError && auditLogs) {
        const weeklyCount = auditLogs.length;
        const threshold = 1000;
        
        if (weeklyCount > threshold) {
          alerts.push({
            id: `audit_logs_${Date.now()}`,
            alert_type: 'audit_logs',
            severity: weeklyCount > 2000 ? 'critical' : 'warning', // 2000 = critical
            message: `Audit log volume has exceeded weekly threshold`,
            current_value: weeklyCount,
            threshold_value: threshold,
            details: {
              entries_this_week: weeklyCount,
              daily_average: Math.round(weeklyCount / 7)
            },
            created_at: timestamp
          });
        }
      }
    } catch (err) {
      console.error('Audit log check failed:', err);
    }

    // Store alerts in the database
    if (alerts.length > 0) {
      console.log(`📊 Generated ${alerts.length} monitoring alerts`);
      
      // Store in a monitoring_alerts table
      const { error: insertError } = await supabaseClient
        .from('monitoring_alerts')
        .insert(alerts);
      
      if (insertError) {
        console.error('Failed to store monitoring alerts:', insertError);
      } else {
        console.log('✅ Successfully stored monitoring alerts');
      }
    } else {
      console.log('✅ No monitoring alerts generated - all systems normal');
    }

    // Return monitoring summary
    const summary = {
      timestamp: timestamp,
      alerts_generated: alerts.length,
      alerts: alerts,
      system_status: alerts.length === 0 ? 'healthy' : 
                    alerts.some(a => a.severity === 'critical') ? 'critical' : 'warning'
    };

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('System monitoring error:', error);
    return new Response(JSON.stringify({ 
      error: 'System monitoring failed', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})