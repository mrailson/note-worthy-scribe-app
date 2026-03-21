import React, { useEffect, useRef } from 'react';
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
  const { stage, setStage, setRecordingDuration, attendees, agendaItems } = useMeetingSetup();
  const wasRecordingRef = useRef(false);

  // Sync recording state → stage
  useEffect(() => {
    if (isRecording && stage === 'setup') {
      setStage('recording');
    }
    
    // Detect recording stop: was recording, now not
    if (wasRecordingRef.current && !isRecording) {
      // Only show done screen if there was context set up
      const hasContext = attendees.length > 0 || agendaItems.length > 0;
      if (hasContext) {
        setStage('done');
      } else {
        setStage('setup');
      }
    }
    
    wasRecordingRef.current = isRecording;
  }, [isRecording, stage, setStage, attendees.length, agendaItems.length]);

  // Sync duration
  useEffect(() => {
    setRecordingDuration(duration);
  }, [duration, setRecordingDuration]);

  return null;
};
