/**
 * VPN Monitoring Dashboard Component
 * Displays VPN-related login statistics and alerts for administrators
 */

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle,
  Users,
  Network,
  Clock,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface VpnStats {
  totalLogins: number;
  vpnLogins: number;
  failedVpnLogins: number;
  successRate: number;
  topErrorTypes: Array<{ type: string; count: number }>;
  recentAlerts: Array<{
    id: string;
    timestamp: Date;
    severity: string;
    message: string;
    userEmail?: string;
  }>;
  networkQualityStats: {
    excellent: number;
    good: number;
    poor: number;
    failed: number;
  };
}

export function VpnMonitoringDashboard() {
  const [stats, setStats] = useState<VpnStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchVpnStats = async () => {
    try {
      setLoading(true);
      
      // Fetch VPN-related security events from the last 24 hours
      const { data: securityEvents, error } = await supabase
        .from('security_events')
        .select('*')
        .eq('event_type', 'VPN_LOGIN_DIAGNOSTIC')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching VPN stats:', error);
        return;
      }

      // Process the data to calculate stats
      const totalEvents = securityEvents?.length || 0;
      const vpnEvents = securityEvents?.filter(event => {
        const eventDetails = event.event_details as any;
        return eventDetails?.diagnostic?.isVpnLikely;
      }) || [];
      
      const failedVpnEvents = vpnEvents.filter(event => {
        const eventDetails = event.event_details as any;
        return eventDetails?.diagnostic?.errorType !== null;
      });

      const successRate = vpnEvents.length > 0 
        ? ((vpnEvents.length - failedVpnEvents.length) / vpnEvents.length) * 100 
        : 100;

      // Count error types
      const errorTypeCounts: Record<string, number> = {};
      failedVpnEvents.forEach(event => {
        const eventDetails = event.event_details as any;
        const errorType = eventDetails?.diagnostic?.errorType || 'unknown';
        errorTypeCounts[errorType] = (errorTypeCounts[errorType] || 0) + 1;
      });

      const topErrorTypes = Object.entries(errorTypeCounts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Network quality stats
      const networkQualityStats = {
        excellent: 0,
        good: 0,
        poor: 0,
        failed: 0
      };

      securityEvents?.forEach(event => {
        const eventDetails = event.event_details as any;
        const quality = eventDetails?.diagnostic?.networkQuality;
        if (quality && quality in networkQualityStats) {
          networkQualityStats[quality as keyof typeof networkQualityStats]++;
        }
      });

      // Recent alerts (high severity events)
      const recentAlerts = securityEvents
        ?.filter(event => event.severity === 'high' || event.severity === 'critical')
        .slice(0, 10)
        .map(event => {
          const eventDetails = event.event_details as any;
          return {
            id: event.id,
            timestamp: new Date(event.created_at),
            severity: event.severity,
            message: eventDetails?.message || 'VPN-related login issue',
            userEmail: event.user_email
          };
        }) || [];

      setStats({
        totalLogins: totalEvents,
        vpnLogins: vpnEvents.length,
        failedVpnLogins: failedVpnEvents.length,
        successRate,
        topErrorTypes,
        recentAlerts,
        networkQualityStats
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching VPN statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVpnStats();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchVpnStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Loading VPN monitoring data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          VPN Login Monitoring
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Disable' : 'Enable'} Auto-refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchVpnStats}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Last updated: {lastUpdated.toLocaleString()}
        {autoRefresh && ' (Auto-refreshing every 30 seconds)'}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Logins (24h)</p>
                <p className="text-2xl font-bold">{stats?.totalLogins || 0}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">VPN Logins</p>
                <p className="text-2xl font-bold">{stats?.vpnLogins || 0}</p>
              </div>
              <Network className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed VPN Logins</p>
                <p className="text-2xl font-bold text-red-600">{stats?.failedVpnLogins || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className={`text-2xl font-bold ${getSuccessRateColor(stats?.successRate || 0)}`}>
                  {stats?.successRate?.toFixed(1) || '0.0'}%
                </p>
              </div>
              {(stats?.successRate || 0) >= 95 ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Network Quality Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Network Quality Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {stats?.networkQualityStats.excellent || 0}
              </div>
              <div className="text-sm text-muted-foreground">Excellent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats?.networkQualityStats.good || 0}
              </div>
              <div className="text-sm text-muted-foreground">Good</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {stats?.networkQualityStats.poor || 0}
              </div>
              <div className="text-sm text-muted-foreground">Poor</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {stats?.networkQualityStats.failed || 0}
              </div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Error Types */}
      {stats?.topErrorTypes && stats.topErrorTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Error Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topErrorTypes.map((error, index) => (
                <div key={error.type} className="flex items-center justify-between p-2 rounded">
                  <span className="text-sm font-medium capitalize">
                    {error.type.replace('_', ' ')}
                  </span>
                  <Badge variant="secondary">{error.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Alerts */}
      {stats?.recentAlerts && stats.recentAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentAlerts.map((alert) => (
                <Alert key={alert.id} variant="default">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            variant="secondary" 
                            className={getSeverityColor(alert.severity)}
                          >
                            {alert.severity}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {alert.timestamp.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm">{alert.message}</p>
                        {alert.userEmail && (
                          <p className="text-xs text-muted-foreground mt-1">
                            User: {alert.userEmail}
                          </p>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(!stats?.recentAlerts || stats.recentAlerts.length === 0) && (
        <Card>
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">All Clear!</h3>
            <p className="text-muted-foreground">
              No recent high-priority VPN-related alerts in the last 24 hours.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}