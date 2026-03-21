import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getPersistedSession,
  clearPersistedSession,
  isSessionStale,
  isHeartbeatRecent,
  clearAudioChunks,
  clearAllAudioChunks,
  type PersistedRecordingSession,
} from '@/utils/recordingSessionPersistence';

interface RecoveryState {
  /** The interrupted session, if any */
  recoveredSession: PersistedRecordingSession | null;
  /** True if the session is over 24 hours old */
  isStale: boolean;
  /** True if heartbeat is recent — probably a duplicate tab */
  isDuplicateTab: boolean;
  /** Dismiss the recovery banner and discard session data */
  discardSession: () => void;
  /** Mark recovery as consumed (after resume or save) */
  consumeRecovery: () => void;
}

/**
 * On mount, checks localStorage for an interrupted recording session.
 * Returns the session data and helper functions for the recovery UI.
 */
export function useRecordingRecovery(isRecording: boolean): RecoveryState {
  const [recoveredSession, setRecoveredSession] = useState<PersistedRecordingSession | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [isDuplicateTab, setIsDuplicateTab] = useState(false);
  const checkedRef = useRef(false);

  // Check on mount only (and not while recording)
  useEffect(() => {
    if (checkedRef.current || isRecording) return;
    checkedRef.current = true;

    const session = getPersistedSession();
    if (!session) return;

    if (session.status !== 'recording' && session.status !== 'paused') {
      // Session in an unexpected state — clean up silently
      clearPersistedSession();
      return;
    }

    if (isSessionStale(session)) {
      setRecoveredSession(session);
      setIsStale(true);
      return;
    }

    if (isHeartbeatRecent(session)) {
      setRecoveredSession(session);
      setIsDuplicateTab(true);
      return;
    }

    // Valid interrupted session
    setRecoveredSession(session);
  }, [isRecording]);

  const discardSession = useCallback(() => {
    const session = recoveredSession;
    clearPersistedSession();
    if (session) {
      clearAudioChunks(session.sessionId).catch(() => {});
    } else {
      clearAllAudioChunks().catch(() => {});
    }
    setRecoveredSession(null);
    setIsStale(false);
    setIsDuplicateTab(false);
  }, [recoveredSession]);

  const consumeRecovery = useCallback(() => {
    setRecoveredSession(null);
    setIsStale(false);
    setIsDuplicateTab(false);
    // Don't clear localStorage here — the recording flow will manage it
  }, []);

  return { recoveredSession, isStale, isDuplicateTab, discardSession, consumeRecovery };
}
