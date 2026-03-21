import React from 'react';
import { useMeetingSetup } from './MeetingSetupContext';
import { StageIndicator } from './StageIndicator';
import { PreMeetingSetup } from './PreMeetingSetup';
import { LiveContextStatusBar } from './LiveContextStatusBar';
import { RecordingCompleteScreen } from './RecordingCompleteScreen';
import { TabDropdown } from './TabDropdown';

interface RecordingFlowOverlayProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onOpenImportModal: (tab?: string) => void;
  formatDuration: (seconds: number) => string;
  wordCount?: number;
  transcriptText?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  hasNewMeetings?: boolean;
  children: React.ReactNode;
}

const STAGE_TITLES: Record<string, string> = {
  setup: 'Prepare Your Meeting',
  recording: 'Recording in Progress',
  done: 'Recording Complete',
};

export const RecordingFlowOverlay: React.FC<RecordingFlowOverlayProps> = ({
  isRecording,
  onStartRecording,
  onStopRecording,
  onOpenImportModal,
  formatDuration,
  wordCount,
  transcriptText,
  activeTab = 'recorder',
  onTabChange,
  hasNewMeetings,
  children,
}) => {
  const { stage, resetSetup } = useMeetingSetup();

  const handleStartNewMeeting = () => {
    resetSetup();
  };

  // During recording, hide the merged header (status bar replaces it)
  const showMergedHeader = !(stage === 'recording' || isRecording);

  return (
    <>
      {/* Merged header row: Tab dropdown | Title | Stage indicator */}
      {showMergedHeader && (
        <div className="flex items-center gap-3 py-2 px-1 mb-2">
          <TabDropdown
            activeTab={activeTab}
            onTabChange={onTabChange || (() => {})}
            hasNewMeetings={hasNewMeetings}
          />
          <h2 className="flex-1 text-[15px] font-extrabold text-foreground tracking-tight truncate">
            {STAGE_TITLES[stage] || 'Prepare Your Meeting'}
          </h2>
          <StageIndicator />
        </div>
      )}

      {/* Stage 1: Pre-Meeting Setup */}
      {stage === 'setup' && !isRecording && (
        <PreMeetingSetup onStartRecording={onStartRecording} onOpenImportModal={onOpenImportModal} />
      )}

      {/* Stage 2: Recording */}
      {(stage === 'recording' || isRecording) && (
        <>
          <LiveContextStatusBar
            onEditContext={onOpenImportModal}
            onStopRecording={onStopRecording}
            formatDuration={formatDuration}
            wordCount={wordCount}
            transcriptText={transcriptText}
          />
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
