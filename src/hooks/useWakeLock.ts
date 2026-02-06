import { useState, useRef, useCallback, useEffect } from 'react';

interface UseWakeLockReturn {
  /** Whether the wake lock is currently held */
  isLocked: boolean;
  /** Whether Wake Lock API is supported */
  isSupported: boolean;
  /** Request a wake lock to prevent screen dimming */
  requestLock: () => Promise<boolean>;
  /** Release the wake lock */
  releaseLock: () => Promise<void>;
  /** Any error from the last operation */
  error: string | null;
}

/**
 * Hook to manage the Screen Wake Lock API.
 * Prevents the device screen from dimming/locking during recording.
 * Automatically re-acquires the lock when the page becomes visible again.
 */
export function useWakeLock(): UseWakeLockReturn {
  const [isLocked, setIsLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const wantedRef = useRef(false); // Whether user wants the lock active

  const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  const requestLock = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.log('🔒 Wake Lock API not supported on this device');
      setError('Wake Lock not supported');
      return false;
    }

    wantedRef.current = true;

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsLocked(true);
      setError(null);
      console.log('🔒 Wake Lock acquired - screen will stay on');

      // Listen for release (e.g., tab switch, low battery)
      wakeLockRef.current.addEventListener('release', () => {
        console.log('🔓 Wake Lock released by system');
        setIsLocked(false);
        wakeLockRef.current = null;
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to acquire wake lock';
      console.warn('⚠️ Wake Lock request failed:', message);
      setError(message);
      setIsLocked(false);
      return false;
    }
  }, [isSupported]);

  const releaseLock = useCallback(async () => {
    wantedRef.current = false;

    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        console.log('🔓 Wake Lock manually released');
      } catch (err) {
        console.warn('⚠️ Wake Lock release error:', err);
      }
      wakeLockRef.current = null;
    }

    setIsLocked(false);
    setError(null);
  }, []);

  // Re-acquire wake lock when page becomes visible again
  // (The lock is automatically released when tab is backgrounded)
  useEffect(() => {
    if (!isSupported) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && wantedRef.current && !wakeLockRef.current) {
        console.log('🔒 Page visible again - re-acquiring Wake Lock');
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          setIsLocked(true);

          wakeLockRef.current.addEventListener('release', () => {
            setIsLocked(false);
            wakeLockRef.current = null;
          });
        } catch (err) {
          console.warn('⚠️ Failed to re-acquire Wake Lock:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wantedRef.current = false;
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);

  return {
    isLocked,
    isSupported,
    requestLock,
    releaseLock,
    error
  };
}
