/**
 * Admin dashboard component that integrates VPN monitoring and alerts
 */

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VpnMonitoringDashboard } from './VpnMonitoringDashboard';
import { useVpnAlerts } from '@/hooks/useVpnAlerts';
import { 
  Shield, 
  Bell, 
  Settings, 
  AlertTriangle,
  CheckCircle,
  X
} from 'lucide-react';

export function AdminVpnDashboard() {
  const [activeTab, setActiveTab] = useState('monitoring');
  
  const {
    alerts,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    clearAlerts,
    dismissAlert,
    getAlertsBySeverity
  } = useVpnAlerts({
    failureRateThreshold: 75,
    enableToastNotifications: true
  });

  const criticalAlerts = getAlertsBySeverity('critical');
  const highAlerts = getAlertsBySeverity('high');
  const totalActiveAlerts = criticalAlerts.length + highAlerts.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          VPN & Network Security Dashboard
        </h1>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-muted-foreground">
              {isMonitoring ? 'Monitoring Active' : 'Monitoring Stopped'}
            </span>
          </div>
          
          {totalActiveAlerts > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <Bell className="h-3 w-3" />
              {totalActiveAlerts} Alert{totalActiveAlerts !== 1 ? 's' : ''}
            </Badge>
          )}
          
          <Button
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
            variant={isMonitoring ? "outline" : "default"}
            size="sm"
          >
            {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="monitoring">
            Network Monitoring
          </TabsTrigger>
          <TabsTrigger value="alerts" className="relative">
            Active Alerts
            {totalActiveAlerts > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center"
              >
                {totalActiveAlerts}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings">
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monitoring" className="space-y-6">
          <VpnMonitoringDashboard />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Active Alerts</h2>
            {alerts.length > 0 && (
              <Button
                onClick={clearAlerts}
                variant="outline"
                size="sm"
              >
                Clear All
              </Button>
            )}
          </div>

          {alerts.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Active Alerts</h3>
                <p className="text-muted-foreground">
                  All VPN and network systems are operating normally.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <Card key={alert.id} className="relative">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4" />
                          <Badge 
                            variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}
                          >
                            {alert.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="outline">
                            {alert.type.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {alert.timestamp.toLocaleString()}
                          </span>
                        </div>
                        
                        <p className="font-medium mb-2">{alert.message}</p>
                        
                        {alert.metadata && (
                          <div className="text-sm text-muted-foreground">
                            {alert.type === 'high_failure_rate' && (
                              <div>
                                Failure Rate: {alert.metadata.failureRate?.toFixed(1)}% 
                                ({alert.metadata.failedAttempts}/{alert.metadata.totalAttempts} failed)
                              </div>
                            )}
                            {alert.type === 'network_issues' && (
                              <div>
                                Poor Network Events: {alert.metadata.poorNetworkCount}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <Button
                        onClick={() => dismissAlert(alert.id)}
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Monitoring Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Alert Thresholds</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• VPN Failure Rate: &gt;75%</li>
                    <li>• Network Quality: 3+ poor connections/5min</li>
                    <li>• Rate Limiting: Corporate IP detection</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Monitoring Settings</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Check Interval: Every 60 seconds</li>
                    <li>• Alert Cooldown: 5 minutes</li>
                    <li>• Data Retention: 24 hours</li>
                  </ul>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Corporate VPN Support</h4>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>Enhanced rate limiting for corporate networks:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Personal networks: 5 attempts per 5 minutes</li>
                    <li>Corporate VPNs: 15 attempts per 5 minutes</li>
                    <li>Network timeout: 15 seconds for VPN users</li>
                    <li>Automatic retry with exponential backoff</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}