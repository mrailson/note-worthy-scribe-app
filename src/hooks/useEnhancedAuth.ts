/**
 * Enhanced authentication hook with VPN support and retry logic
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showShadcnToast } from '@/utils/toastWrapper';
import { 
  diagnoseLoginIssue, 
  generateVpnFriendlyErrorMessage, 
  testNetworkConnectivity,
  NetworkDiagnostic 
} from '@/utils/vpnDiagnostics';
import { validateAuthAttempt } from '@/utils/enhancedSecurityValidation';

interface EnhancedAuthResult {
  success: boolean;
  error?: any;
  diagnostic?: NetworkDiagnostic;
  needsRetry?: boolean;
  retryDelay?: number;
  userFriendlyMessage?: string;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export function useEnhancedAuth() {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);

  const defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2
  };

  /**
   * Calculates retry delay with exponential backoff
   */
  const calculateRetryDelay = (attempt: number, config: RetryConfig): number => {
    const delay = Math.min(
      config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
      config.maxDelay
    );
    
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  };

  /**
   * Enhanced sign in with VPN support and retry logic
   */
  const enhancedSignIn = useCallback(async (
    email: string,
    password: string,
    retryConfig: RetryConfig = defaultRetryConfig
  ): Promise<EnhancedAuthResult> => {
    setIsAuthenticating(true);
    let lastError: any = null;
    let lastDiagnostic: NetworkDiagnostic | undefined;

    // Pre-flight security validation
    const authValidation = validateAuthAttempt(
      email,
      undefined, // IP not available in browser
      navigator.userAgent
    );

    if (!authValidation.allowed) {
      setIsAuthenticating(false);
      return {
        success: false,
        error: new Error(authValidation.reason),
        userFriendlyMessage: authValidation.reason,
        needsRetry: false
      };
    }

    // Show VPN warning if detected
    if (authValidation.isVpnLikely) {
      showShadcnToast({
        title: "Corporate VPN Detected",
        description: "We've detected you may be using a corporate VPN. If login fails, try disconnecting temporarily or contact your IT support.",
        section: 'security'
      });
    }

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      setAttemptCount(attempt + 1);
      
      try {
        // Test network connectivity first for non-first attempts
        if (attempt > 0) {
          const networkTest = await testNetworkConnectivity();
          if (!networkTest.isConnected) {
            throw new Error(`Network connectivity issue detected (latency: ${networkTest.latency}ms)`);
          }
        }

        // Attempt login with timeout
        const loginPromise = supabase.auth.signInWithPassword({
          email,
          password,
        });

        // Add timeout for VPN users (longer timeout)
        const timeoutMs = authValidation.isVpnLikely ? 15000 : 10000;
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Login timeout')), timeoutMs)
        );

        const { data, error } = await Promise.race([loginPromise, timeoutPromise]) as any;

        if (error) {
          throw error;
        }

        // Success!
        setIsAuthenticating(false);
        setAttemptCount(0);
        
        return {
          success: true,
          diagnostic: await diagnoseLoginIssue(email, null, attempt + 1)
        };

      } catch (error: any) {
        lastError = error;
        lastDiagnostic = await diagnoseLoginIssue(email, error, attempt + 1);
        
        console.error(`Login attempt ${attempt + 1} failed:`, error);

        // Don't retry on credential errors
        if (error.message?.includes('Invalid login credentials') || 
            error.message?.includes('Email not confirmed')) {
          break;
        }

        // Don't retry on rate limit errors (already handled by validation)
        if (error.message?.includes('rate') || error.message?.includes('too many')) {
          break;
        }

        // Only retry on network/timeout errors
        const shouldRetry = (
          error.message?.includes('network') ||
          error.message?.includes('timeout') ||
          error.message?.includes('fetch') ||
          error.status >= 500
        ) && attempt < retryConfig.maxRetries;

        if (shouldRetry) {
          const retryDelay = calculateRetryDelay(attempt, retryConfig);
          
          showShadcnToast({
            title: "Connection Issue",
            description: `Login failed (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}). Retrying in ${Math.round(retryDelay / 1000)} seconds...`,
            section: 'security'
          });

          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // All attempts failed
    setIsAuthenticating(false);
    setAttemptCount(0);

    const userFriendlyMessage = lastDiagnostic 
      ? generateVpnFriendlyErrorMessage(lastDiagnostic, lastError)
      : lastError?.message || 'Login failed after multiple attempts';

    return {
      success: false,
      error: lastError,
      diagnostic: lastDiagnostic,
      needsRetry: false,
      userFriendlyMessage
    };
  }, []);

  /**
   * Network-aware password reset
   */
  const enhancedResetPassword = useCallback(async (email: string): Promise<EnhancedAuthResult> => {
    setIsAuthenticating(true);

    try {
      // Test network first
      const networkTest = await testNetworkConnectivity();
      if (!networkTest.isConnected) {
        throw new Error('Network connectivity issue. Please check your connection and try again.');
      }

      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });

      if (error) {
        throw error;
      }

      setIsAuthenticating(false);
      return { success: true };

    } catch (error: any) {
      setIsAuthenticating(false);
      const diagnostic = await diagnoseLoginIssue(email, error);
      
      return {
        success: false,
        error,
        diagnostic,
        userFriendlyMessage: generateVpnFriendlyErrorMessage(diagnostic, error)
      };
    }
  }, []);

  return {
    enhancedSignIn,
    enhancedResetPassword,
    isAuthenticating,
    attemptCount
  };
}