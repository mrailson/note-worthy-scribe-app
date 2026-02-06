import { useState, useEffect, useRef, useCallback } from 'react';
import { showToast } from '@/utils/toastWrapper';

interface VisibilityProtectionConfig {
  /** Whether protection is active (should be true when recording) */
  isActive: boolean;
  /** Callback when tab becomes hidden */
  onHidden?: () => void;
  /** Callback when tab becomes visible again */
  onVisible?: (hiddenDurationMs: number) => void;
  /** Duration threshold in ms to show warning (default: 30000 = 30 seconds) */
  warningThresholdMs?: number;
  /** Callback to flush transcript data before OS may kill the process */
  onFlushBeforeHide?: () => void;
}

interface VisibilityProtectionState {
  /** Whether the tab is currently hidden */
  isHidden: boolean;
  /** Total time hidden during this session in ms */
  totalHiddenTime: number;
  /** Number of times the tab was hidden */
  hiddenCount: number;
  /** Last time the tab was hidden */
  lastHiddenTime: Date | null;
  /** Whether a visibility warning is active */
  hasActiveWarning: boolean;
}

export function useVisibilityProtection(config: VisibilityProtectionConfig) {
  const {
    isActive,
    onHidden,
    onVisible,
    warningThresholdMs = 30000,
    onFlushBeforeHide
  } = config;

  const [state, setState] = useState<VisibilityProtectionState>({
    isHidden: false,
    totalHiddenTime: 0,
    hiddenCount: 0,
    lastHiddenTime: null,
    hasActiveWarning: false
  });

  const hiddenStartRef = useRef<number | null>(null);
  const totalHiddenRef = useRef<number>(0);
  const hiddenCountRef = useRef<number>(0);
  const warningToastIdRef = useRef<string | null>(null);

  // Handle visibility change
  useEffect(() => {
    if (!isActive) return;

    const handleVisibilityChange = () => {
      const isHidden = document.visibilityState === 'hidden';
      const now = Date.now();

      if (isHidden) {
        // Tab became hidden
        hiddenStartRef.current = now;
        hiddenCountRef.current += 1;

        console.log(`👁️ Tab hidden (count: ${hiddenCountRef.current})`);
        
        // Flush any buffered transcript data before OS may kill process
        // This is critical on mobile where backgrounded tabs can be terminated
        if (onFlushBeforeHide) {
          console.log('💾 Flushing transcript data before hide...');
          try {
            onFlushBeforeHide();
          } catch (e) {
            console.warn('⚠️ Flush before hide failed:', e);
          }
        }
        
        // Log only - no toast per user request
        warningToastIdRef.current = `visibility-warning-${now}`;

        setState(prev => ({
          ...prev,
          isHidden: true,
          hiddenCount: hiddenCountRef.current,
          lastHiddenTime: new Date(),
          hasActiveWarning: true
        }));

        onHidden?.();

      } else {
        // Tab became visible again
        const hiddenDuration = hiddenStartRef.current ? now - hiddenStartRef.current : 0;
        hiddenStartRef.current = null;
        totalHiddenRef.current += hiddenDuration;

        console.log(`👁️ Tab visible again after ${Math.round(hiddenDuration / 1000)}s`);

        // Dismiss warning toast
        if (warningToastIdRef.current) {
          // Toast will auto-dismiss since we're back
          warningToastIdRef.current = null;
        }

        setState(prev => ({
          ...prev,
          isHidden: false,
          totalHiddenTime: totalHiddenRef.current,
          hasActiveWarning: false
        }));

        // Log only - no toast per user request
        if (hiddenDuration >= warningThresholdMs) {
          console.log(`⚠️ Tab was in background for ${Math.round(hiddenDuration / 1000)} seconds`);
        }

        onVisible?.(hiddenDuration);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also handle page hide for mobile browsers
    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Page is going into bfcache
        console.log('👁️ Page entering bfcache');
      }
    };

    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [isActive, onHidden, onVisible, warningThresholdMs, onFlushBeforeHide]);

  // Request notification permission for background alerts
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }, []);

  // Send a notification when tab is hidden
  const sendBackgroundNotification = useCallback((title: string, body: string) => {
    if (Notification.permission === 'granted' && document.visibilityState === 'hidden') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'recording-alert',
        requireInteraction: true
      });
    }
  }, []);

  // Reset state
  const reset = useCallback(() => {
    hiddenStartRef.current = null;
    totalHiddenRef.current = 0;
    hiddenCountRef.current = 0;
    
    setState({
      isHidden: false,
      totalHiddenTime: 0,
      hiddenCount: 0,
      lastHiddenTime: null,
      hasActiveWarning: false
    });
  }, []);

  return {
    ...state,
    requestNotificationPermission,
    sendBackgroundNotification,
    reset
  };
}
