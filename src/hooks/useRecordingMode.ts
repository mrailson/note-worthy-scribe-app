// useRecordingMode.ts
// Persisted online/offline preference + live network state for the mobile recorder.
//
// Behaviour (confirmed with product):
// - First-ever load (no localStorage entry) → preference = "offline" (safe default)
// - If localStorage shows the user previously chose "online" → preference = "online"
// - Auto-fallback when offline does NOT mutate the stored preference
// - When the network returns, the effective mode automatically restores

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "notewell.recordingMode.preference";

export const RECORDING_MODES = {
  ONLINE: "online",
  OFFLINE: "offline",
} as const;

export type RecordingMode = (typeof RECORDING_MODES)[keyof typeof RECORDING_MODES];

interface UseRecordingModeReturn {
  /** What's actually active right now (preference + network reality). */
  mode: RecordingMode;
  /** What the user explicitly chose (persists across sessions). */
  userPreference: RecordingMode;
  /** Raw navigator.onLine state. */
  isOnline: boolean;
  /** True when effective mode is offline because the network dropped, not because the user chose it. */
  isAutoFallback: boolean;
  /** Set the user preference (and persist it). */
  setMode: (mode: RecordingMode) => void;
  /** Toggle between online and offline preference. */
  toggleMode: () => void;
  MODES: typeof RECORDING_MODES;
}

function readStoredPreference(): RecordingMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    // First-ever load → offline default. Only "online" promotes to online.
    if (stored === RECORDING_MODES.ONLINE) return RECORDING_MODES.ONLINE;
    return RECORDING_MODES.OFFLINE;
  } catch {
    return RECORDING_MODES.OFFLINE;
  }
}

export function useRecordingMode(): UseRecordingModeReturn {
  const [userPreference, setUserPreference] = useState<RecordingMode>(readStoredPreference);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  // Tracks whether we're currently in offline because of a network drop
  // vs because the user explicitly chose offline.
  const autoFallbackRef = useRef<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      autoFallbackRef.current = false;
    };
    const handleOffline = () => {
      setIsOnline(false);
      // Only mark as auto-fallback if the user *wanted* online.
      if (userPreference === RECORDING_MODES.ONLINE) {
        autoFallbackRef.current = true;
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [userPreference]);

  // Effective mode = preference unless the network forces us offline.
  const effectiveMode: RecordingMode =
    userPreference === RECORDING_MODES.OFFLINE || !isOnline
      ? RECORDING_MODES.OFFLINE
      : RECORDING_MODES.ONLINE;

  // Recompute autoFallback from current state every render (defensive — handles
  // initial mount where the user starts already-offline with an online preference).
  const isAutoFallback =
    userPreference === RECORDING_MODES.ONLINE && !isOnline;

  const setMode = useCallback((next: RecordingMode) => {
    if (next !== RECORDING_MODES.ONLINE && next !== RECORDING_MODES.OFFLINE) return;
    setUserPreference(next);
    autoFallbackRef.current = false;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable — ignore */
    }
  }, []);

  const toggleMode = useCallback(() => {
    setUserPreference((prev) => {
      const next =
        prev === RECORDING_MODES.ONLINE ? RECORDING_MODES.OFFLINE : RECORDING_MODES.ONLINE;
      autoFallbackRef.current = false;
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* storage unavailable — ignore */
      }
      return next;
    });
  }, []);

  return {
    mode: effectiveMode,
    userPreference,
    isOnline,
    isAutoFallback,
    setMode,
    toggleMode,
    MODES: RECORDING_MODES,
  };
}
