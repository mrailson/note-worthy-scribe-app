/**
 * Hook for managing VPN-related alerts and notifications
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface VpnAlert {
  id: string;
  type: 'high_failure_rate' | 'network_issues' | 'rate_limit_exceeded' | 'suspicious_activity';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  metadata?: any;
}

interface VpnAlertConfig {
  failureRateThreshold: number; // percentage
  checkIntervalMs: number;
  alertCooldownMs: number;
  enableToastNotifications: boolean;
}

export function useVpnAlerts(config: Partial<VpnAlertConfig> = {}) {
  const [alerts, setAlerts] = useState<VpnAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const { toast } = useToast();

  const defaultConfig: VpnAlertConfig = {
    failureRateThreshold: 70, // Alert if VPN failure rate > 70%
    checkIntervalMs: 60000, // Check every minute
    alertCooldownMs: 300000, // 5 minute cooldown between similar alerts
    enableToastNotifications: true,
    ...config
  };

  /**
   * Checks for VPN-related issues and generates alerts
   */
  const checkVpnHealth = useCallback(async () => {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      // Fetch recent VPN diagnostics
      const { data: recentEvents, error } = await supabase
        .from('security_events')
        .select('*')
        .eq('event_type', 'VPN_LOGIN_DIAGNOSTIC')
        .gte('created_at', fiveMinutesAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching VPN events:', error);
        return;
      }

      const vpnEvents = recentEvents?.filter(event => {
        const eventDetails = event.event_details as any;
        return eventDetails?.diagnostic?.isVpnLikely;
      }) || [];

      const failedVpnEvents = vpnEvents.filter(event => {
        const eventDetails = event.event_details as any;
        return eventDetails?.diagnostic?.errorType !== null;
      });

      // Check failure rate
      if (vpnEvents.length >= 5) { // Only alert if we have enough data
        const failureRate = (failedVpnEvents.length / vpnEvents.length) * 100;
        
        if (failureRate > defaultConfig.failureRateThreshold) {
          const alertId = `high_failure_rate_${Math.floor(now.getTime() / defaultConfig.alertCooldownMs)}`;
          
          // Check if we've already alerted for this time window
          const existingAlert = alerts.find(alert => alert.id === alertId);
          
          if (!existingAlert) {
            const newAlert: VpnAlert = {
              id: alertId,
              type: 'high_failure_rate',
              message: `High VPN login failure rate detected: ${failureRate.toFixed(1)}% (${failedVpnEvents.length}/${vpnEvents.length} failed)`,
              severity: failureRate > 90 ? 'critical' : 'high',
              timestamp: now,
              metadata: {
                failureRate,
                totalAttempts: vpnEvents.length,
                failedAttempts: failedVpnEvents.length,
                timeWindow: '5 minutes'
              }
            };

            setAlerts(prev => [newAlert, ...prev.slice(0, 49)]); // Keep last 50 alerts

            if (defaultConfig.enableToastNotifications) {
              toast({
                title: "VPN Alert",
                description: newAlert.message,
                variant: newAlert.severity === 'critical' ? "destructive" : "default"
              });
            }

            // Log the alert to the backend
            await supabase.functions.invoke('log-security-event', {
              body: {
                eventType: 'VPN_ALERT_GENERATED',
                severity: newAlert.severity,
                eventDetails: {
                  alertType: newAlert.type,
                  message: newAlert.message,
                  metadata: newAlert.metadata
                }
              }
            });
          }
        }
      }

      // Check for network quality issues
      const poorNetworkEvents = recentEvents?.filter(event => {
        const eventDetails = event.event_details as any;
        return eventDetails?.diagnostic?.networkQuality === 'poor' ||
               eventDetails?.diagnostic?.networkQuality === 'failed';
      }) || [];

      if (poorNetworkEvents.length >= 3) {
        const alertId = `network_issues_${Math.floor(now.getTime() / defaultConfig.alertCooldownMs)}`;
        
        if (!alerts.find(alert => alert.id === alertId)) {
          const newAlert: VpnAlert = {
            id: alertId,
            type: 'network_issues',
            message: `Multiple network quality issues detected: ${poorNetworkEvents.length} poor/failed connections in last 5 minutes`,
            severity: 'medium',
            timestamp: now,
            metadata: {
              poorNetworkCount: poorNetworkEvents.length,
              timeWindow: '5 minutes'
            }
          };

          setAlerts(prev => [newAlert, ...prev.slice(0, 49)]);

          if (defaultConfig.enableToastNotifications) {
            toast({
              title: "Network Quality Alert",
              description: newAlert.message,
              variant: "default"
            });
          }
        }
      }

      setLastCheck(now);
    } catch (error) {
      console.error('Error checking VPN health:', error);
    }
  }, [alerts, defaultConfig, toast]);

  /**
   * Starts monitoring for VPN issues
   */
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;

    setIsMonitoring(true);
    
    // Initial check
    checkVpnHealth();
    
    // Set up interval
    const interval = setInterval(checkVpnHealth, defaultConfig.checkIntervalMs);
    
    return () => {
      clearInterval(interval);
      setIsMonitoring(false);
    };
  }, [isMonitoring, checkVpnHealth, defaultConfig.checkIntervalMs]);

  /**
   * Stops monitoring
   */
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);

  /**
   * Clears all alerts
   */
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  /**
   * Dismisses a specific alert
   */
  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  /**
   * Gets alerts by severity
   */
  const getAlertsBySeverity = useCallback((severity: VpnAlert['severity']) => {
    return alerts.filter(alert => alert.severity === severity);
  }, [alerts]);

  // Auto-start monitoring on mount if enabled
  useEffect(() => {
    if (defaultConfig.checkIntervalMs > 0) {
      const cleanup = startMonitoring();
      return cleanup;
    }
  }, [startMonitoring, defaultConfig.checkIntervalMs]);

  return {
    alerts,
    isMonitoring,
    lastCheck,
    startMonitoring,
    stopMonitoring,
    clearAlerts,
    dismissAlert,
    getAlertsBySeverity,
    checkVpnHealth
  };
}