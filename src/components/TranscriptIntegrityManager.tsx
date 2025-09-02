import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Database,
  FileAudio,
  Activity,
  AlertCircle
} from 'lucide-react';

interface MonitoringAlert {
  id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  meeting_id?: string;
  user_id?: string;
  metadata: any;
  created_at: string;
  status: string;
}

interface HealthReport {
  timestamp: string;
  status: 'healthy' | 'warning' | 'degraded' | 'critical';
  summary: {
    totalAlerts: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  alerts: MonitoringAlert[];
}

const TranscriptIntegrityManager: React.FC = () => {
  const { toast } = useToast();
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'degraded': return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'critical': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default: return <Activity className="h-5 w-5" />;
    }
  };

  const runHealthCheck = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('monitoring-alerts', {
        body: { action: 'health_report' }
      });

      if (error) throw error;

      setHealthReport(data);
      
      if (data.summary.critical > 0) {
        toast({
          title: "Critical Issues Found",
          description: `${data.summary.critical} critical transcript integrity issues detected!`,
          variant: "destructive",
        });
      } else if (data.summary.high > 0) {
        toast({
          title: "High Priority Issues",
          description: `${data.summary.high} high priority issues found`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "System Healthy",
          description: "No critical transcript integrity issues found",
        });
      }

    } catch (error) {
      console.error('Health check failed:', error);
      toast({
        title: "Health Check Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentAlerts = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('monitoring-alerts', {
        body: { action: 'alert_dashboard' }
      });

      if (error) throw error;

      setAlerts(data.alerts);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  };

  const startRealTimeMonitoring = async () => {
    setIsMonitoring(true);
    
    try {
      // Run initial check
      await runHealthCheck();
      await loadRecentAlerts();
      
      // Set up periodic monitoring (every 5 minutes)
      const interval = setInterval(async () => {
        try {
          const { data } = await supabase.functions.invoke('monitoring-alerts', {
            body: { action: 'check_integrity' }
          });
          
          if (data.alerts && data.alerts.length > 0) {
            const criticalAlerts = data.alerts.filter((a: any) => a.severity === 'critical');
            if (criticalAlerts.length > 0) {
              toast({
                title: "🚨 Critical Issue Detected",
                description: `New transcript data loss detected in ${criticalAlerts.length} meetings!`,
                variant: "destructive",
              });
            }
          }
          
          await loadRecentAlerts();
        } catch (error) {
          console.error('Monitoring check failed:', error);
        }
      }, 5 * 60 * 1000); // 5 minutes

      // Store interval for cleanup
      (window as any).monitoringInterval = interval;
      
      toast({
        title: "Monitoring Started",
        description: "Real-time transcript integrity monitoring is now active",
      });

    } catch (error) {
      console.error('Failed to start monitoring:', error);
      setIsMonitoring(false);
      toast({
        title: "Monitoring Failed",
        description: "Could not start real-time monitoring",
        variant: "destructive",
      });
    }
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    if ((window as any).monitoringInterval) {
      clearInterval((window as any).monitoringInterval);
      (window as any).monitoringInterval = null;
    }
    toast({
      title: "Monitoring Stopped",
      description: "Real-time monitoring has been disabled",
    });
  };

  useEffect(() => {
    // Load initial data
    loadRecentAlerts();
    
    // Cleanup on unmount
    return () => {
      if ((window as any).monitoringInterval) {
        clearInterval((window as any).monitoringInterval);
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Transcript Data Integrity System
          </CardTitle>
          <CardDescription>
            Prevents and monitors transcript data loss incidents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {healthReport && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(healthReport.status)}
                <div>
                  <div className="font-medium">System Status: {healthReport.status.toUpperCase()}</div>
                  <div className="text-sm text-muted-foreground">
                    {healthReport.summary.totalAlerts > 0 
                      ? `${healthReport.summary.totalAlerts} active alerts`
                      : 'All systems operational'
                    }
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Last Check</div>
                <div className="text-sm">{new Date(healthReport.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={runHealthCheck}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Run Health Check
            </Button>
            
            {!isMonitoring ? (
              <Button 
                onClick={startRealTimeMonitoring}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Activity className="h-4 w-4" />
                Start Real-Time Monitoring
              </Button>
            ) : (
              <Button 
                onClick={stopMonitoring}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Activity className="h-4 w-4 text-green-500" />
                Stop Monitoring
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alert Summary */}
      {healthReport && healthReport.summary.totalAlerts > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Alert Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{healthReport.summary.critical}</div>
                <div className="text-sm text-muted-foreground">Critical</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{healthReport.summary.high}</div>
                <div className="text-sm text-muted-foreground">High</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{healthReport.summary.medium}</div>
                <div className="text-sm text-muted-foreground">Medium</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{healthReport.summary.low}</div>
                <div className="text-sm text-muted-foreground">Low</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
          <CardDescription>
            Latest transcript integrity alerts and issues
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                No alerts found - system is operating normally
              </div>
            ) : (
              alerts.slice(0, 10).map((alert) => (
                <Alert key={alert.id} variant={alert.severity === 'critical' || alert.severity === 'high' ? 'destructive' : 'default'}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="flex items-center justify-between">
                    <span>{alert.title}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={getSeverityColor(alert.severity)}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(alert.created_at).toLocaleString()}
                      </span>
                    </div>
                  </AlertTitle>
                  <AlertDescription>
                    {alert.description}
                    {alert.meeting_id && (
                      <div className="mt-2 text-xs">
                        Meeting ID: {alert.meeting_id}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Protection Features */}
      <Card>
        <CardHeader>
          <CardTitle>Protection Features Active</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Database className="h-5 w-5 text-blue-500" />
              <div>
                <div className="font-medium">Atomic Transactions</div>
                <div className="text-sm text-muted-foreground">Prevents partial saves</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <FileAudio className="h-5 w-5 text-green-500" />
              <div>
                <div className="font-medium">Audio Backups</div>
                <div className="text-sm text-muted-foreground">Recovery capability</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Shield className="h-5 w-5 text-purple-500" />
              <div>
                <div className="font-medium">Real-time Validation</div>
                <div className="text-sm text-muted-foreground">Immediate verification</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TranscriptIntegrityManager;