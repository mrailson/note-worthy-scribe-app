import React from 'react';
import { useMeetingSetup } from './MeetingSetupContext';
import { StageIndicator } from './StageIndicator';
import { PreMeetingSetup } from './PreMeetingSetup';
import { LiveContextStatusBar } from './LiveContextStatusBar';
import { RecordingCompleteScreen } from './RecordingCompleteScreen';
import { Mic, FileText, History, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface RecordingFlowOverlayProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onOpenImportModal: (tab?: string) => void;
  formatDuration: (seconds: number) => string;
  wordCount?: number;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  hasNewMeetings?: boolean;
  children: React.ReactNode;
}

const TAB_CONFIG = [
  { value: 'recorder', label: 'Meeting Recorder', shortLabel: 'Recorder', icon: Mic },
  { value: 'transcript', label: 'Meeting Transcript', shortLabel: 'Transcript', icon: FileText },
  { value: 'history', label: 'My Meeting History', shortLabel: 'History', icon: History },
];

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
  activeTab = 'recorder',
  onTabChange,
  hasNewMeetings,
  children,
}) => {
  const { stage, resetSetup } = useMeetingSetup();

  const handleStartNewMeeting = () => {
    resetSetup();
  };

  const currentTabConfig = TAB_CONFIG.find(t => t.value === activeTab) || TAB_CONFIG[0];
  const CurrentIcon = currentTabConfig.icon;

  // During recording, hide the merged header (status bar replaces it)
  const showMergedHeader = !(stage === 'recording' || isRecording);

  return (
    <>
      {/* Merged header row: Tab dropdown | Title | Stage indicator */}
      {showMergedHeader && (
        <div className="flex items-center gap-3 py-2 px-1 mb-3">
          {/* Left: Tab dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors cursor-pointer flex-shrink-0">
                <CurrentIcon className="h-3.5 w-3.5 text-primary" />
                <span className="text-[12px] font-bold text-primary hidden sm:inline">{currentTabConfig.label}</span>
                <span className="text-[12px] font-bold text-primary sm:hidden">{currentTabConfig.shortLabel}</span>
                <ChevronDown className="h-3 w-3 text-primary/60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {TAB_CONFIG.map(tab => {
                const Icon = tab.icon;
                return (
                  <DropdownMenuItem
                    key={tab.value}
                    onClick={() => onTabChange?.(tab.value)}
                    className={activeTab === tab.value ? 'bg-primary/10 text-primary font-bold' : ''}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {tab.label}
                    {tab.value === 'history' && hasNewMeetings && (
                      <Badge className="bg-green-600 hover:bg-green-600 text-white text-[10px] px-1.5 py-0 h-4 ml-auto">
                        New
                      </Badge>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Centre: Title */}
          <h2 className="flex-1 text-[15px] font-extrabold text-foreground tracking-tight truncate">
            {STAGE_TITLES[stage] || 'Prepare Your Meeting'}
          </h2>

          {/* Right: Stage indicator dots */}
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
