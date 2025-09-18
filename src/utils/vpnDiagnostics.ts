/**
 * VPN and network diagnostics utilities for troubleshooting corporate VPN login issues
 */

import { supabase } from '@/integrations/supabase/client';

export interface NetworkDiagnostic {
  timestamp: Date;
  userAgent: string;
  ipAddress?: string;
  isVpnLikely: boolean;
  networkQuality: 'good' | 'poor' | 'timeout';
  latency?: number;
  errorType?: 'network' | 'auth' | 'timeout' | 'rate_limit' | 'unknown';
  errorDetails: any;
}

export interface VpnDetectionResult {
  isVpnLikely: boolean;
  indicators: string[];
  recommendations: string[];
}

/**
 * Detects if user is likely using a VPN based on various indicators
 */
export function detectVpnUsage(): VpnDetectionResult {
  const indicators: string[] = [];
  const recommendations: string[] = [];
  
  // Check user agent for corporate patterns
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Corporate') || userAgent.includes('Enterprise')) {
    indicators.push('Corporate user agent detected');
  }
  
  // Check for high-latency network (simplified check)
  const connection = (navigator as any).connection;
  if (connection) {
    if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      indicators.push('Slow network connection detected');
    }
    if (connection.rtt > 500) {
      indicators.push('High network latency detected');
    }
  }
  
  // Check timezone mismatches (common with VPNs)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timezone.includes('UTC') && !timezone.includes('London')) {
    indicators.push('UTC timezone detected (possible VPN)');
  }
  
  const isVpnLikely = indicators.length >= 1;
  
  if (isVpnLikely) {
    recommendations.push('Try disabling VPN temporarily to test login');
    recommendations.push('Contact IT support if VPN is mandatory');
    recommendations.push('Try using a different network connection');
    recommendations.push('Clear browser cache and cookies');
  }
  
  return {
    isVpnLikely,
    indicators,
    recommendations
  };
}

/**
 * Enhanced login diagnostics with VPN-specific error handling
 */
export async function diagnoseLoginIssue(
  email: string, 
  error: any, 
  attempt: number = 1
): Promise<NetworkDiagnostic> {
  const startTime = Date.now();
  const vpnDetection = detectVpnUsage();
  
  let errorType: NetworkDiagnostic['errorType'] = 'unknown';
  let networkQuality: NetworkDiagnostic['networkQuality'] = 'good';
  
  // Analyse the error to categorise it
  if (error) {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code || error.status;
    
    if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('connection')) {
      errorType = 'network';
      networkQuality = 'timeout';
    } else if (errorMessage.includes('rate') || errorMessage.includes('too many')) {
      errorType = 'rate_limit';
    } else if (errorMessage.includes('invalid') || errorMessage.includes('wrong') || errorMessage.includes('credentials')) {
      errorType = 'auth';
    } else if (errorCode >= 500) {
      errorType = 'network';
      networkQuality = 'poor';
    } else if (errorCode === 429) {
      errorType = 'rate_limit';
    }
  }
  
  const diagnostic: NetworkDiagnostic = {
    timestamp: new Date(),
    userAgent: navigator.userAgent,
    isVpnLikely: vpnDetection.isVpnLikely,
    networkQuality,
    latency: Date.now() - startTime,
    errorType,
    errorDetails: {
      message: error?.message,
      code: error?.code || error?.status,
      attempt,
      vpnIndicators: vpnDetection.indicators,
      recommendations: vpnDetection.recommendations
    }
  };
  
  // Log to backend for monitoring (non-blocking)
  try {
    await logVpnDiagnostic(email, diagnostic);
  } catch (logError) {
    console.warn('Failed to log VPN diagnostic:', logError);
  }
  
  return diagnostic;
}

/**
 * Logs VPN diagnostic data to backend for monitoring
 */
async function logVpnDiagnostic(email: string, diagnostic: NetworkDiagnostic): Promise<void> {
  try {
    await supabase.functions.invoke('log-security-event', {
      body: {
        eventType: 'VPN_LOGIN_DIAGNOSTIC',
        severity: diagnostic.errorType === 'network' ? 'medium' : 'low',
        eventDetails: {
          email,
          diagnostic,
          userAgent: diagnostic.userAgent,
          isVpnLikely: diagnostic.isVpnLikely,
          networkQuality: diagnostic.networkQuality,
          errorType: diagnostic.errorType,
          latency: diagnostic.latency
        }
      }
    });
  } catch (error) {
    console.warn('Failed to log VPN diagnostic to backend:', error);
  }
}

/**
 * Network connectivity test with timeout handling
 */
export async function testNetworkConnectivity(): Promise<{
  isConnected: boolean;
  latency: number;
  quality: 'excellent' | 'good' | 'poor' | 'failed';
}> {
  const startTime = Date.now();
  
  try {
    // Test connection to Supabase
    const { data, error } = await Promise.race([
      supabase.from('profiles').select('count').limit(1),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network test timeout')), 5000)
      )
    ]) as any;
    
    const latency = Date.now() - startTime;
    
    if (error && !error.message?.includes('permission')) {
      return { isConnected: false, latency, quality: 'failed' };
    }
    
    let quality: 'excellent' | 'good' | 'poor' | 'failed';
    if (latency < 200) quality = 'excellent';
    else if (latency < 500) quality = 'good';
    else quality = 'poor';
    
    return { isConnected: true, latency, quality };
  } catch (error) {
    const latency = Date.now() - startTime;
    return { isConnected: false, latency, quality: 'failed' };
  }
}

/**
 * Generates user-friendly error messages for VPN issues
 */
export function generateVpnFriendlyErrorMessage(
  diagnostic: NetworkDiagnostic, 
  originalError: any
): string {
  const { isVpnLikely, errorType, networkQuality } = diagnostic;
  
  if (errorType === 'rate_limit') {
    if (isVpnLikely) {
      return 'Login temporarily blocked due to multiple attempts. This commonly happens with corporate VPNs sharing IP addresses. Please wait 5 minutes before trying again, or try from a different network.';
    }
    return 'Too many login attempts. Please wait 5 minutes before trying again.';
  }
  
  if (errorType === 'network' || networkQuality === 'timeout') {
    if (isVpnLikely) {
      return 'Network connection issue detected. Corporate VPNs can sometimes interfere with login. Try: 1) Check your VPN connection, 2) Try a different server location, 3) Contact your IT support team.';
    }
    return 'Network connection problem. Please check your internet connection and try again.';
  }
  
  if (errorType === 'auth') {
    return originalError?.message || 'Invalid email or password. Please check your credentials and try again.';
  }
  
  // Generic VPN-aware message
  if (isVpnLikely) {
    return 'Login failed. If you\'re using a corporate VPN, this may be causing the issue. Try logging in from a different network or contact your IT support team.';
  }
  
  return originalError?.message || 'Login failed. Please try again.';
}