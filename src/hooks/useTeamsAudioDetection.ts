import { useState, useEffect, useRef, useCallback } from 'react';

interface UseTeamsAudioDetectionProps {
  meetingType: 'face-to-face' | 'teams';
  audioSourceMode: 'microphone' | 'microphone_and_system' | 'system_only';
  isRecording: boolean;
  duration: number; // in seconds
  wordCount: number;
  actualChunksPerMinute: number;
  healthStatus: 'healthy' | 'warning' | 'critical' | 'inactive';
}

interface UseTeamsAudioDetectionReturn {
  shouldShowHint: boolean;
  dismissHint: () => void;
  acknowledgeWorking: () => void;
}

const GRACE_PERIOD_SECONDS = 90;
const MIN_WORDS_THRESHOLD = 50;
const MIN_CHUNKS_PER_MINUTE = 3;
const SUFFICIENT_WORDS_THRESHOLD = 100;

export const useTeamsAudioDetection = ({
  meetingType,
  audioSourceMode,
  isRecording,
  duration,
  wordCount,
  actualChunksPerMinute,
  healthStatus
}: UseTeamsAudioDetectionProps): UseTeamsAudioDetectionReturn => {
  const [hintDismissed, setHintDismissed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const previousModeRef = useRef(audioSourceMode);
  
  // Reset state when recording starts
  useEffect(() => {
    if (isRecording) {
      // Check if user switched to system audio mode - auto-dismiss
      if (audioSourceMode !== 'microphone' && previousModeRef.current === 'microphone') {
        setHintDismissed(true);
      }
      previousModeRef.current = audioSourceMode;
    } else {
      // Reset on recording stop for next session
      setHintDismissed(false);
      setAcknowledged(false);
    }
  }, [isRecording, audioSourceMode]);

  // Auto-hide if sufficient activity detected
  useEffect(() => {
    if (wordCount >= SUFFICIENT_WORDS_THRESHOLD && !acknowledged) {
      // Good activity detected - don't need to show hint
      setHintDismissed(true);
    }
  }, [wordCount, acknowledged]);

  const dismissHint = useCallback(() => {
    setHintDismissed(true);
  }, []);

  const acknowledgeWorking = useCallback(() => {
    setAcknowledged(true);
    setHintDismissed(true);
    // Store in session storage so we don't bother them again this session
    try {
      sessionStorage.setItem('teams_audio_acknowledged', 'true');
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Check session storage for previous acknowledgement
  useEffect(() => {
    try {
      const previouslyAcknowledged = sessionStorage.getItem('teams_audio_acknowledged');
      if (previouslyAcknowledged === 'true') {
        setAcknowledged(true);
        setHintDismissed(true);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Determine if we should show the hint
  const shouldShowHint = (() => {
    // Already dismissed or acknowledged - don't show
    if (hintDismissed || acknowledged) return false;
    
    // Only for Teams meetings
    if (meetingType !== 'teams') return false;
    
    // Only when using microphone-only mode
    if (audioSourceMode !== 'microphone') return false;
    
    // Only while recording
    if (!isRecording) return false;
    
    // Wait for grace period
    if (duration < GRACE_PERIOD_SECONDS) return false;
    
    // Check for warning signs
    const lowWordCount = wordCount < MIN_WORDS_THRESHOLD;
    const lowChunksPerMinute = actualChunksPerMinute < MIN_CHUNKS_PER_MINUTE;
    const healthWarning = healthStatus === 'warning' || healthStatus === 'critical';
    
    // Show hint if any warning sign is present
    return lowWordCount || lowChunksPerMinute || healthWarning;
  })();

  return {
    shouldShowHint,
    dismissHint,
    acknowledgeWorking
  };
};
