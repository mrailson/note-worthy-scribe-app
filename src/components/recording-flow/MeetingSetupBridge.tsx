import { useEffect } from 'react';
import { useMeetingSetup } from './MeetingSetupContext';

interface MeetingSetupBridgeProps {
  isRecording: boolean;
  duration: number;
  onOpenImportModal: (tab?: string) => void;
}

/**
 * Bridge component that syncs MeetingRecorder state with MeetingSetupContext.
 * Must be rendered inside both MeetingSetupProvider and MeetingRecorder.
 */
export const MeetingSetupBridge: React.FC<MeetingSetupBridgeProps> = ({
  isRecording,
  duration,
  onOpenImportModal,
}) => {
  const { stage, setStage, setRecordingDuration } = useMeetingSetup();

  // Sync recording state → stage
  useEffect(() => {
    if (isRecording && stage === 'setup') {
      setStage('recording');
    }
  }, [isRecording, stage, setStage]);

  // Sync duration
  useEffect(() => {
    setRecordingDuration(duration);
  }, [duration, setRecordingDuration]);

  return null;
};

// Re-export onOpenImportModal handler type for use in the status bar
export type OpenImportModalFn = (tab?: string) => void;
