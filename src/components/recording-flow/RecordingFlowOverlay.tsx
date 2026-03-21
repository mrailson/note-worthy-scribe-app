import React from 'react';
import { useMeetingSetup } from './MeetingSetupContext';
import { StageIndicator } from './StageIndicator';
import { PreMeetingSetup } from './PreMeetingSetup';
import { LiveContextStatusBar } from './LiveContextStatusBar';
import { RecordingCompleteScreen } from './RecordingCompleteScreen';
import { TabDropdown } from './TabDropdown';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileIdleState } from './mobile/MobileIdleState';
import { MobileRecordingState } from './mobile/MobileRecordingState';

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

  // On mobile, render the full redesigned mobile UI
  if (isMobile) {
    // Idle state
    if (stage === 'setup' && !isRecording) {
      return <MobileIdleState onStartRecording={onStartRecording} />;
    }

    // Recording state
    if (stage === 'recording' || isRecording) {
      return (
        <MobileRecordingState
          onStopRecording={onStopRecording}
          wordCount={wordCount ?? 0}
          transcriptText={transcriptText ?? ''}
        />
      );
    }

    // Done state — reuse existing
    if (stage === 'done' && !isRecording) {
      return (
        <RecordingCompleteScreen
          formatDuration={formatDuration}
          onStartNewMeeting={handleStartNewMeeting}
        />
      );
    }
  }

  // ── Desktop layout (unchanged) ──
  const showMergedHeader = !(stage === 'recording' || isRecording);

  return (
    <>
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

      {stage === 'setup' && !isRecording && (
        <PreMeetingSetup onStartRecording={onStartRecording} onOpenImportModal={onOpenImportModal} />
      )}

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

      {stage === 'done' && !isRecording && (
        <RecordingCompleteScreen
          formatDuration={formatDuration}
          onStartNewMeeting={handleStartNewMeeting}
        />
      )}
    </>
  );
};
