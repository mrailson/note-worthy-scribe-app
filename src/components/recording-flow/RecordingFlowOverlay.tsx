import React from 'react';
import { useMeetingSetup } from './MeetingSetupContext';
import { StageIndicator } from './StageIndicator';
import { PreMeetingSetup } from './PreMeetingSetup';
import { LiveContextStatusBar } from './LiveContextStatusBar';
import { RecordingCompleteScreen } from './RecordingCompleteScreen';

interface RecordingFlowOverlayProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onOpenImportModal: (tab?: string) => void;
  formatDuration: (seconds: number) => string;
  children: React.ReactNode; // existing recorder controls
}

/**
 * Renders the 3-stage recording flow UI (Setup → Recording → Complete)
 * on top of / instead of the existing recorder controls.
 */
export const RecordingFlowOverlay: React.FC<RecordingFlowOverlayProps> = ({
  isRecording,
  onStartRecording,
  onStopRecording,
  onOpenImportModal,
  formatDuration,
  children,
}) => {
  const { stage, setStage, resetSetup } = useMeetingSetup();

  const handleStartNewMeeting = () => {
    resetSetup();
  };

  return (
    <>
      {/* Stage Indicator — always visible */}
      <StageIndicator />

      {/* Stage 1: Pre-Meeting Setup (not recording, setup stage) */}
      {stage === 'setup' && !isRecording && (
        <PreMeetingSetup onStartRecording={onStartRecording} onOpenImportModal={onOpenImportModal} />
      )}

      {/* Stage 2: Recording — show live status bar + existing controls */}
      {(stage === 'recording' || isRecording) && (
        <>
          <LiveContextStatusBar
            onEditContext={onOpenImportModal}
            onStopRecording={onStopRecording}
            formatDuration={formatDuration}
          />
          {/* Existing recorder controls below the status bar */}
          {children}
        </>
      )}

      {/* Stage 3: Recording Complete */}
      {stage === 'done' && !isRecording && (
        <RecordingCompleteScreen
          formatDuration={formatDuration}
          onStartNewMeeting={handleStartNewMeeting}
        />
      )}
    </>
  );
};
