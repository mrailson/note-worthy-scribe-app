import React from 'react';
import { useMeetingSetup } from './MeetingSetupContext';
import { StageIndicator } from './StageIndicator';
import { PreMeetingSetup } from './PreMeetingSetup';
import { LiveContextStatusBar } from './LiveContextStatusBar';
import { RecordingCompleteScreen } from './RecordingCompleteScreen';
import { TabDropdown } from './TabDropdown';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();

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

      {/* Stage 1: Pre-Meeting Setup — skip on mobile, go straight to recording */}
      {stage === 'setup' && !isRecording && !isMobile && (
        <PreMeetingSetup onStartRecording={onStartRecording} onOpenImportModal={onOpenImportModal} />
      )}
      {stage === 'setup' && !isRecording && isMobile && (
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-sm text-muted-foreground text-center">
            Tap to start recording. You can add attendees and agenda later.
          </p>
          <button
            onClick={onStartRecording}
            className="w-20 h-20 rounded-full bg-destructive flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <div className="w-8 h-8 rounded-full bg-destructive-foreground" />
          </button>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Start Recording</span>
        </div>
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
