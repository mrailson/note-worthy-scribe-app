import { useEffect, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRecording } from '@/contexts/RecordingContext';

/**
 * Blocks navigation away from the current route while a recording is active.
 * Uses history.pushState interception since react-router-dom v6 useBlocker
 * requires a data router. Falls back to popstate (back button) blocking.
 */
export const useNavigationBlocker = () => {
  const { isRecording } = useRecording();
  const [showBlockerDialog, setShowBlockerDialog] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Only block when recording and on the home page
  const shouldBlock = isRecording && location.pathname === '/';

  // Intercept back/forward browser buttons
  useEffect(() => {
    if (!shouldBlock) return;

    const handlePopState = (e: PopStateEvent) => {
      // Push the current state back to prevent leaving
      window.history.pushState(null, '', '/');
      setShowBlockerDialog(true);
      setPendingPath(null); // Back button — we don't know destination
    };

    // Push an extra state so popstate fires before actually leaving
    window.history.pushState(null, '', '/');
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [shouldBlock]);

  /**
   * Wraps navigate() calls — use this in Header/nav instead of raw navigate().
   * If recording is active and we're on /, shows the blocker dialog.
   */
  const guardedNavigate = useCallback(
    (path: string) => {
      if (shouldBlock && path !== '/') {
        setPendingPath(path);
        setShowBlockerDialog(true);
        return false; // blocked
      }
      navigate(path);
      return true;
    },
    [shouldBlock, navigate]
  );

  const confirmLeave = useCallback(() => {
    setShowBlockerDialog(false);
    if (pendingPath) {
      navigate(pendingPath);
    }
    setPendingPath(null);
  }, [pendingPath, navigate]);

  const cancelLeave = useCallback(() => {
    setShowBlockerDialog(false);
    setPendingPath(null);
  }, []);

  return {
    showBlockerDialog,
    confirmLeave,
    cancelLeave,
    guardedNavigate,
    isBlocking: shouldBlock,
  };
};
