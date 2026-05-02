import React, { useState } from 'react';
import { useMeetingSetup } from './MeetingSetupContext';
import { StageIndicator } from './StageIndicator';
import { PreMeetingSetup } from './PreMeetingSetup';
import { LiveContextStatusBar } from './LiveContextStatusBar';
import { RecordingCompleteScreen } from './RecordingCompleteScreen';
import { TabDropdown } from './TabDropdown';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileIdleState } from './mobile/MobileIdleState';
import { MobileRecordingState } from './mobile/MobileRecordingState';
import { DesktopRecordingSettings, SettingsTriggerButton } from './DesktopRecordingSettings';
import { detectDevice } from '@/utils/DeviceDetection';

interface RecordingFlowOverlayProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onOpenImportModal: (tab?: string, editGroupId?: string) => void;
  formatDuration: (seconds: number) => string;
  wordCount?: number;
  transcriptText?: string;
  recentFinals?: string[];
  currentPartial?: string;
  assemblyFullTranscript?: string;
  deepgramText?: string;
  whisperChunkText?: string;
  whisperChunkNum?: number;
  
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  hasNewMeetings?: boolean;
  meetingCount?: number;
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
  recentFinals = [],
  currentPartial = '',
  assemblyFullTranscript = '',
  deepgramText = '',
  whisperChunkText = '',
  whisperChunkNum = 0,
  
  activeTab = 'recorder',
  onTabChange,
  hasNewMeetings,
  meetingCount,
  children,
}) => {
  const { stage, resetSetup } = useMeetingSetup();
  const isMobile = useIsMobile();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const device = detectDevice();
  const showSettingsCog = device.isChromium && device.isDesktop;

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
          recentFinals={recentFinals}
          currentPartial={currentPartial}
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
            meetingCount={meetingCount}
          />
          <div className="flex-1" />
          <StageIndicator />
          {showSettingsCog && stage === 'setup' && (
            <SettingsTriggerButton onClick={() => setSettingsOpen(true)} />
          )}
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
            recentFinals={recentFinals}
            currentPartial={currentPartial}
            assemblyFullTranscript={assemblyFullTranscript}
            deepgramText={deepgramText}
            whisperChunkText={whisperChunkText}
            whisperChunkNum={whisperChunkNum}
            
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

      {showSettingsCog && (
        <DesktopRecordingSettings
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      )}
    </>
  );
};
