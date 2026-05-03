import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Database, 
  FileText, 
  HardDrive,
  RefreshCw,
  Clock,
  XCircle,
  Eye,
  EyeOff
} from 'lucide-react';

interface MonitoringAlert {
  id: string;
  alert_type: 'table_size' | 'search_history' | 'audit_logs' | 'file_storage';
  severity: 'warning' | 'critical';
  message: string;
  current_value: number;
  threshold_value: number;
  details: Record<string, any>;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

interface MonitoringDashboard {
  total_active_alerts: number;
  critical_alerts: number;
  warning_alerts: number;
  last_check: string;
  system_status: string;
  recent_alerts: MonitoringAlert[];
}

export const SystemMonitoringDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<MonitoringDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningManualCheck, setRunningManualCheck] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [allAlerts, setAllAlerts] = useState<MonitoringAlert[]>([]);

  // Fetch monitoring dashboard data
  const fetchDashboard = async () => {
    try {
      const { data, error } = await supabase.rpc('get_monitoring_dashboard');
      if (error) throw error;
      
      if (data && data.length > 0) {
        const dashboardData = data[0];
        setDashboard({
          total_active_alerts: dashboardData.total_active_alerts,
          critical_alerts: dashboardData.critical_alerts,
          warning_alerts: dashboardData.warning_alerts,
          last_check: dashboardData.last_check,
          system_status: dashboardData.system_status,
          recent_alerts: typeof dashboardData.recent_alerts === 'string' 
            ? JSON.parse(dashboardData.recent_alerts || '[]')
            : (dashboardData.recent_alerts || []) as unknown as MonitoringAlert[]
        });
      }
    } catch (error) {
      console.error('Error fetching monitoring dashboard:', error);
      toast.error('Failed to fetch monitoring data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch all alerts (including resolved ones)
  const fetchAllAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('monitoring_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setAllAlerts((data || []) as MonitoringAlert[]);
    } catch (error) {
      console.error('Error fetching all alerts:', error);
    }
  };

  // Run manual monitoring check
  const runManualCheck = async () => {
    setRunningManualCheck(true);
    try {
      const { data, error } = await supabase.functions.invoke('system-monitoring');
      if (error) throw error;
      
      toast.success(`Manual check completed. ${data?.alerts_generated || 0} alerts generated.`);
      await fetchDashboard();
      await fetchAllAlerts();
    } catch (error) {
      console.error('Error running manual check:', error);
      toast.error('Failed to run manual monitoring check');
    } finally {
      setRunningManualCheck(false);
    }
  };

  // Resolve an alert
  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('monitoring_alerts')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: (await supabase.auth.getUser()).data.user?.id || null
        })
        .eq('id', alertId);
      
      if (error) throw error;
      
      toast.success('Alert resolved');
      await fetchDashboard();
      await fetchAllAlerts();
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast.error('Failed to resolve alert');
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'default';
      case 'warning': return 'secondary';
      case 'critical': return 'destructive';
      default: return 'outline';
    }
  };

  // Get alert type icon
  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'table_size': return <Database className="h-4 w-4" />;
      case 'search_history': return <FileText className="h-4 w-4" />;
      case 'audit_logs': return <Activity className="h-4 w-4" />;
      case 'file_storage': return <HardDrive className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchAllAlerts();

    // Set up real-time subscription for new alerts
    const channel = supabase
      .channel('monitoring-alerts-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'monitoring_alerts'
      }, (payload) => {
        console.log('Monitoring alert change:', payload);
        fetchDashboard();
        fetchAllAlerts();
      })
      .subscribe();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboard();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse">Loading monitoring dashboard...</div>
      </div>
    );
  }

  const alertsToShow = showResolved ? allAlerts : allAlerts.filter(alert => !alert.resolved_at);

  return (
    <div className="space-y-6">
      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="default">
                ALL SYSTEMS NORMAL
              </Badge>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.total_active_alerts || 0}</div>
            <p className="text-xs text-muted-foreground">Active alerts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{dashboard?.critical_alerts || 0}</div>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Check</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {dashboard?.last_check ? new Date(dashboard.last_check).toLocaleString() : 'Never'}
            </div>
            <p className="text-xs text-muted-foreground">Automated monitoring</p>
          </CardContent>
        </Card>
      </div>

      {/* Manual Check Button */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Manual System Check
          </CardTitle>
          <CardDescription>
            Run an immediate system monitoring check, or launch the end-to-end Pipeline Test for the meeting notes &amp; email path.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            onClick={runManualCheck}
            disabled={runningManualCheck}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${runningManualCheck ? 'animate-spin' : ''}`} />
            {runningManualCheck ? 'Running Check...' : 'Run Manual Check'}
          </Button>
          <Button variant="outline" asChild className="gap-2">
            <a href="/admin/pipeline-test">
              <Activity className="h-4 w-4" />
              Open Pipeline Test
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Monitoring Thresholds Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Monitoring Thresholds
          </CardTitle>
          <CardDescription>
            Current system monitoring thresholds and what triggers alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span className="font-medium">Database Tables:</span>
                <span className="text-sm text-muted-foreground">10MB warning, 50MB critical</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="font-medium">Search History:</span>
                <span className="text-sm text-muted-foreground">100MB warning, 200MB critical</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span className="font-medium">Audit Logs:</span>
                <span className="text-sm text-muted-foreground">1000/week warning, 2000/week critical</span>
              </div>
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                <span className="font-medium">File Storage:</span>
                <span className="text-sm text-muted-foreground">100MB warning, 500MB critical</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Alerts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                System Alerts
              </CardTitle>
              <CardDescription>
                Real-time monitoring alerts and system notifications
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResolved(!showResolved)}
              className="gap-2"
            >
              {showResolved ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showResolved ? 'Hide Resolved' : 'Show All'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {alertsToShow.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-600 mb-2">All Systems Normal</h3>
              <p className="text-muted-foreground">No active alerts detected. System is running smoothly.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Current Value</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertsToShow.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getAlertIcon(alert.alert_type)}
                        <span className="capitalize">{alert.alert_type.replace('_', ' ')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <span className="truncate" title={alert.message}>
                        {alert.message}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {formatFileSize(alert.current_value)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm text-muted-foreground">
                        {formatFileSize(alert.threshold_value)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {new Date(alert.created_at).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      {alert.resolved_at ? (
                        <Badge variant="outline" className="text-green-600">
                          Resolved
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-orange-600">
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!alert.resolved_at && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resolveAlert(alert.id)}
                          className="gap-1"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* System Health Tips */}
      {dashboard && dashboard.total_active_alerts > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>System Performance Tips:</strong> Consider implementing data cleanup policies, 
            archiving old records, or increasing storage capacity to maintain optimal performance.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};