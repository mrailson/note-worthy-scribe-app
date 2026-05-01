import React, { useState, useEffect, useRef, useCallback } from "react";
import { safeSetItem } from "@/utils/localStorageManager";
import { useNavigate, useLocation } from "react-router-dom";
import { format, startOfDay, addMinutes } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import { showToast } from "@/utils/toastWrapper";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StopRecordingConfirmDialog } from "@/components/StopRecordingConfirmDialog";
import { useRecordingProtection } from "@/hooks/useRecordingProtection";
import { Mic, MicOff, Play, Square, Clock, Users, Wifi, WifiOff, FileText, Settings, History, Search, Trash2, CheckSquare, SquareIcon, Monitor, Volume2, Waves, Video, Headphones, Eye, EyeOff, RotateCcw, MonitorSpeaker, RefreshCw, Sparkles, Pause, Calendar, Edit, Save, Merge, Upload, ClipboardList, Check, Folder, Loader2, MoreVertical, ChevronDown, CheckCircle, Timer, Type, ChevronLeft, ChevronRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MeetingSettings } from "@/components/MeetingSettings";
import { MeetingHistoryList } from "@/components/MeetingHistoryList";
import { MeetingHistoryViewSelector, HistoryViewMode } from "@/components/meeting-history/MeetingHistoryViewSelector";
import { CompactMeetingList } from "@/components/meeting-history/CompactMeetingList";
import { MeetingGridView } from "@/components/meeting-history/MeetingGridView";
import { MeetingTableView } from "@/components/meeting-history/MeetingTableView";
import { MeetingTimelineView } from "@/components/meeting-history/MeetingTimelineView";
import { isNewMeeting } from "@/components/meeting-history/NewMeetingBadge";
import { FullPageNotesModal } from "@/components/FullPageNotesModal";
import { SafeModeNotesModal } from "@/components/SafeModeNotesModal";
import { useRecording } from "@/contexts/RecordingContext";
import { detectDevice } from "@/utils/DeviceDetection";
import { WhisperHallucinationTestSuite } from "@/components/WhisperHallucinationTestSuite";
import { MicInputRecordingTester } from "@/components/MicInputRecordingTester";
import { SharedMeetingsManager } from "@/components/SharedMeetingsManager";
import { LiveTranscript } from "@/components/LiveTranscript";
import { RealtimeTranscriptCard } from "@/components/RealtimeTranscriptCard";
import { DashboardLauncher } from "@/components/meeting-dashboard/DashboardLauncher";
import { RealtimeMeetingDashboard } from "@/components/meeting-dashboard/RealtimeMeetingDashboard";
import { ChunkSaveStatus } from "@/components/ChunkSaveStatus";
import { MeetingImporter } from "@/components/meeting-dashboard/MeetingImporter";
import { RecordingContextDialog, MeetingContext } from "@/components/meeting/RecordingContextDialog";
import { PostMeetingActionsModal } from "@/components/PostMeetingActionsModal";
import { MeetingCoachModal } from "@/components/meeting-coach/MeetingCoachModal";
import { MeetingFoldersManager } from "@/components/meeting-folders/MeetingFoldersManager";
import { CorrectionManager } from "@/components/CorrectionManager";
import { useMeetingFolders } from "@/hooks/useMeetingFolders";
import { TabAudioGuidanceDialog } from "@/components/meeting/TabAudioGuidanceDialog";
import { AudioCaptureStatusIndicator } from "@/components/meeting/AudioCaptureStatusIndicator";
import { QuickAudioSourceSwitcher, AudioSourceMode as QuickAudioSourceMode } from "@/components/meeting/QuickAudioSourceSwitcher";
import { SmartphoneRecordingHub } from "@/components/meeting/SmartphoneRecordingHub";
import { MeetingMicrophoneSettings } from "@/components/meeting/MeetingMicrophoneSettings";
import { TeamsTranscriptImportModal } from "@/components/meeting/TeamsTranscriptImportModal";
import { LiveImportModal } from "@/components/meeting/import/LiveImportModal";
import { MeetingSetupProvider, useMeetingSetup } from "@/components/recording-flow/MeetingSetupContext";
import { StageIndicator } from "@/components/recording-flow/StageIndicator";
import { PreMeetingSetup } from "@/components/recording-flow/PreMeetingSetup";
import { LiveContextStatusBar } from "@/components/recording-flow/LiveContextStatusBar";
import { RecordingCompleteScreen } from "@/components/recording-flow/RecordingCompleteScreen";
import { MeetingSetupBridge } from "@/components/recording-flow/MeetingSetupBridge";
import { RecordingFlowOverlay } from "@/components/recording-flow/RecordingFlowOverlay";
import { TabDropdown } from "@/components/recording-flow/TabDropdown";
import { useTranscriptionWatchdog } from "@/hooks/useTranscriptionWatchdog";
import { TranscriptionHealthIndicator } from "@/components/meeting/TranscriptionHealthIndicator";
import { useTeamsAudioDetection } from "@/hooks/useTeamsAudioDetection";
import { TeamsAudioHint } from "@/components/meeting/TeamsAudioHint";
import { useAssemblyRealtimePreview, PreviewStatus } from "@/hooks/useAssemblyRealtimePreview";
import { useDeepgramRealtimePreview } from "@/hooks/useDeepgramRealtimePreview";
import { useGladiaRealtimePreview } from "@/hooks/useGladiaRealtimePreview";
import { MeetingPausedBanner } from "@/components/meeting/MeetingPausedBanner";
import { TranscriptDisplay } from "@/components/scribe/TranscriptDisplay";
import { useMeetingKillSignal } from "@/hooks/useMeetingKillSignal";

import { useMeetingPreferences } from "@/hooks/useMeetingPreferences";
import { useRecordingHealthMonitor } from "@/hooks/useRecordingHealthMonitor";
import { useBackupRecorder } from "@/hooks/useBackupRecorder";
import { BackupIndicator } from "@/components/offline/BackupIndicator";
import { BackupRecoveryPrompt } from "@/components/offline/BackupRecoveryPrompt";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRecordingRecovery } from "@/hooks/useRecordingRecovery";
import { RecordingRecoveryBanner } from "@/components/recording-flow/RecordingRecoveryBanner";
import {
  persistRecordingSession,
  clearPersistedSession,
  startHeartbeat,
  stopHeartbeat,
  saveAudioChunk,
  clearAudioChunks,
  type PersistedRecordingSession,
} from "@/utils/recordingSessionPersistence";

import { NotewellAIAnimation } from "@/components/NotewellAIAnimation";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { BrowserSpeechTranscriber, TranscriptData as BrowserTranscriptData } from '@/utils/BrowserSpeechTranscriber';
import { iPhoneWhisperTranscriber, TranscriptData as iPhoneTranscriptData } from '@/utils/iPhoneWhisperTranscriber';
import { SimpleIOSTranscriber, IOSTranscriberStats } from '@/utils/SimpleIOSTranscriber';
import { DesktopWhisperTranscriber, TranscriptData as DesktopTranscriptData } from '@/utils/DesktopWhisperTranscriber';
import { IncrementalTranscriptHandler, IncrementalTranscriptData, ProcessTranscriptResult } from '@/utils/IncrementalTranscriptHandler';
import { StereoAudioCapture } from '@/utils/StereoAudioCapture';
import { transcriptCleaner, RemovedSegment } from '@/utils/TranscriptCleaner';
import { cleanLargeTranscript } from '@/utils/CleanTranscriptOrchestrator';
import { mergeLive } from '@/utils/liveMerge';
import { mergeByTimestamps, segmentsToPlainText, type Segment } from '@/lib/segmentMerge';
import { useMeetingData } from "@/hooks/useMeetingData";
// Client-side trimming/transcoding removed — server-side preprocessing via transcode-audio
// Import retained for backward compatibility (functions are now pass-throughs)
// import { trimSilence } from '@/utils/audioSilenceTrimmer';
// import { transcodeToWhisperFormat, shouldTranscode } from '@/utils/audioTranscoder';
import { buildAssemblyAudioStream, cleanupAssemblyAudioStream } from '@/utils/buildAssemblyAudioStream';
import type { BuildAssemblyAudioStreamResult } from '@/utils/buildAssemblyAudioStream';
import { resolveMeetingModel, modelOverrideField } from '@/utils/resolveMeetingModel';

interface TranscriptData {
  text: string;
  speaker: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
  chunkNumber?: number;
  chunkLength?: number;
  dbSaveStatus?: 'saving' | 'saved' | 'failed' | 'retrying';
  dbSaveTimestamp?: string;
  retryCount?: number;
  start_ms?: number;  // Monotonic start time in milliseconds relative to recording start
  end_ms?: number;    // Monotonic end time in milliseconds relative to recording start
}

interface ChunkSaveStatus {
  id: string;
  chunkNumber: number;
  text: string;
  chunkLength: number;
  saveStatus: 'saving' | 'saved' | 'failed' | 'retrying';
  saveTimestamp?: string;
  retryCount: number;
  confidence: number;
  startTime?: number; // in seconds
  endTime?: number; // in seconds
  wasMerged?: boolean; // True if merger actually processed this chunk
  mergeRejectionReason?: string; // Reason why chunk wasn't merged into transcript
  originalFileSize?: number; // Original file size in bytes before transcoding
  transcodedFileSize?: number; // Transcoded file size in bytes
  fileType?: string; // Audio file type (e.g., 'audio/webm', 'audio/wav')
}

interface MeetingRecorderProps {
  onTranscriptUpdate: (transcript: string) => void;
  onDurationUpdate: (duration: string) => void;
  onWordCountUpdate: (count: number) => void;
  autoStart?: boolean;
  initialSettings?: {
    title: string;
    description: string;
    meetingType: string;
    practiceId?: string;
    transcriberService?: 'whisper' | 'deepgram';
    transcriberThresholds?: {
      whisper: number;
      deepgram: number;
    };
  };
  // Continuation props for "Continue Recording" functionality
  continueMeetingId?: string | null;
  existingTranscript?: string;
  existingDuration?: number;
  forceRecorderTab?: boolean;
  onContinuationComplete?: () => void;
}

/** Wrapper that connects LiveImportModal to MeetingSetupContext */
const LiveImportModalWithContext: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
  editGroupId?: string | null;
}> = (props) => {
  const { setAttendees } = useMeetingSetup();
  return (
    <LiveImportModal
      {...props}
      onAttendeesChanged={(updated) => {
        setAttendees(updated);
      }}
    />
  );
};

export const MeetingRecorder = ({ 
  onTranscriptUpdate, 
  onDurationUpdate, 
  onWordCountUpdate,
  autoStart = false,
  initialSettings,
  continueMeetingId,
  existingTranscript,
  existingDuration = 0,
  forceRecorderTab = false,
  onContinuationComplete
}: MeetingRecorderProps) => {
  const [isRecording, setIsRecordingRaw] = useState(false);
  const { isResourceOperationSafe, setRecordingState } = useRecording();

  // Wrap setIsRecording to also update the global RecordingContext
  const setIsRecording = useCallback((value: boolean) => {
    setIsRecordingRaw(value);
    setRecordingState(value);
  }, [setRecordingState]);
  const isIOS = detectDevice().isIOS;
  const isMobile = useIsMobile();
  
  // Backup recorder integration
  const { isBackupActive, segmentCount, startBackup, stopBackup, pauseBackup, resumeBackup } = useBackupRecorder();
  const [backupEnabled, setBackupEnabled] = useState(true);
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);
  const [isStoppingRecording, setIsStoppingRecording] = useState(false);
  const [isFinalisingMeeting, setIsFinalisingMeeting] = useState(false);
  const [stopRecordingStep, setStopRecordingStep] = useState<string>('');
  const [duration, setDuration] = useState(0);
  
  // Post-meeting actions modal state
  const [showPostMeetingActions, setShowPostMeetingActions] = useState(false);
  const [lastCompletedMeetingId, setLastCompletedMeetingId] = useState<string | null>(null);
  const [lastCompletedMeetingTitle, setLastCompletedMeetingTitle] = useState<string>('');
  const [lastCompletedMeetingDuration, setLastCompletedMeetingDuration] = useState<string>('');
  const [transcript, setTranscript] = useState("");
  const [realtimeTranscripts, setRealtimeTranscripts] = useState<TranscriptData[]>([]);
  const [chunkCounter, setChunkCounter] = useState(0);
  const [removedSegments, setRemovedSegments] = useState<RemovedSegment[]>([]);
  const [chunkSaveStatuses, setChunkSaveStatuses] = useState<ChunkSaveStatus[]>([]);
  const [stopUIStatus, setStopUIStatus] = useState<string>('');
  
  // CRITICAL: Synchronous chunk counter ref to ensure correct numbering
  // React setState is async, so using state alone results in all chunks being numbered 0
  // This ref is incremented synchronously and always has the correct current value
  const chunkCounterRef = useRef(0);
  
  // Synchronous guard to prevent duplicate stop flows
  const stopInProgressRef = useRef(false);
  
  // Generation counter: incremented on every stop to fence stale transcript callbacks
  const recordingGenerationRef = useRef(0);
  
  // Update removed segments periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setRemovedSegments(transcriptCleaner.getRemovedSegments());
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  // Start/stop backup when toggle changes mid-recording
  useEffect(() => {
    if (isRecording && backupEnabled && !isBackupActive) {
      const backupStream = assemblyAudioMixerRef.current?.mixedStream 
        || micAudioStreamRef.current
        || desktopTranscriberRef.current?.getStream()
        || simpleIOSTranscriberRef.current?.getStream();
      if (backupStream) {
        startBackup(backupStream).then(() => {
          console.log('[MeetingRecorder] Backup recorder started mid-recording');
        }).catch(err => {
          console.warn('[MeetingRecorder] Failed to start backup mid-recording:', err);
        });
      }
    }
  }, [backupEnabled, isRecording, isBackupActive, startBackup]);

  // Auto-start recording ref (effect added after user declaration)
  const autoStartTriggeredRef = useRef(false);
  
   // Lock to prevent double-starts from rapid clicks
  const isStartingRecordingRef = useRef(false);

  // Ref to track post-meeting modal state (prevents stale closures)
  const showPostMeetingActionsRef = useRef(false);

  useEffect(() => {
    showPostMeetingActionsRef.current = showPostMeetingActions;
  }, [showPostMeetingActions]);

  // Word count calculation moved after assemblyPreview declaration (line ~533)

  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const [speakerCount, setSpeakerCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  
  // Meeting type state (persisted) - controls audio source defaults
  const [meetingType, setMeetingType] = useState<'face-to-face' | 'teams'>(() => {
    try {
      const saved = localStorage.getItem('meeting_type_preference');
      return (saved as 'face-to-face' | 'teams') || 'face-to-face';
    } catch {
      return 'face-to-face';
    }
  });
  const [meetingLocation, setMeetingLocation] = useState<string>('');
  const [userPractices, setUserPractices] = useState<Array<{id: string, practice_name: string}>>([]);
  
  // Microphone device selection and audio source mode
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('meeting_recorder_microphone_id');
    } catch {
      return null;
    }
  });
  
  // Audio source mode - ALWAYS default to microphone only for reliability
  // Users can switch to other modes after starting if needed
  const [audioSourceMode, setAudioSourceMode] = useState<'microphone' | 'microphone_and_system' | 'system_only'>('microphone');
  
  // Early word count progress display (first 20 seconds)
  const [showEarlyWordCount, setShowEarlyWordCount] = useState(false);
  const [earlyWordCountValue, setEarlyWordCountValue] = useState(0);
  const earlyWordCountTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync duration to parent via effect (avoids setState-during-render warning)
  useEffect(() => {
    if (duration === 0) return;
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    onDurationUpdate(timeString);

    // Display word count at 5, 10, 15, 20 seconds
    if (duration <= 20 && [5, 10, 15, 20].includes(duration)) {
      setEarlyWordCountValue(wordCount);
      setShowEarlyWordCount(true);

      if (earlyWordCountTimeoutRef.current) {
        clearTimeout(earlyWordCountTimeoutRef.current);
      }
      earlyWordCountTimeoutRef.current = setTimeout(() => {
        setShowEarlyWordCount(false);
      }, 2000);
    }
  }, [duration, onDurationUpdate, wordCount]);

  // Recording protection hook - after variable declarations
  const {
    showConfirmDialog,
    setShowConfirmDialog,
    handleStopWithConfirmation,
    handleDoubleClickProtection,
    confirmStopRecording,
    doubleClickProtection,
    isPreparingToStop,
  } = useRecordingProtection({
    isRecording,
    recordingDuration: duration,
    wordCount,
    onStopRecording: () => {
      console.log('🔥🔥🔥 STOP BUTTON CLICKED!');
      stopRecording();
    },
  });

  // Debug: wrap stop interactions to show UI steps
  const onMicButtonClick = () => {
    try {
      if (isRecording) {
        setStopUIStatus('Stop click detected — awaiting second click…');
        handleDoubleClickProtection();
      } else {
        setStopUIStatus('Start click detected — starting recording…');
        startRecording();
      }
    } catch (e) {
      console.error('Stop/Start click error', e);
      setStopUIStatus('Error handling mic button click');
    }
  };

  const handleConfirmDialogOpenChangeWrapped = (open: boolean) => {
    setStopUIStatus(open ? 'Confirmation opened' : 'Confirmation closed');
    setShowConfirmDialog(open);
  };

  const confirmStopRecordingWrapped = () => {
    setStopUIStatus('Confirmed — stopping…');
    confirmStopRecording();
  };

  const [showLastPhrase, setShowLastPhrase] = useState(false);
  const [lastPhrase, setLastPhrase] = useState("");
  const [startTime, setStartTime] = useState<string>("");
  const [liveSummary, setLiveSummary] = useState<string>("");
  const [testTranscripts, setTestTranscripts] = useState<string[]>([]);
  
  // No-op function to replace removed debug logging
  const addDebugLog = (_message: string) => {
    // Debug logging removed - function kept to avoid build errors
  };
  
  const [tickerText, setTickerText] = useState<string>("");
  const [showTicker, setShowTicker] = useState(false);
  const [tickerEnabled, setTickerEnabled] = useState(false);

  // Force reset live transcript to OFF when recording starts
  useEffect(() => {
    if (isRecording && tickerEnabled) {
      console.log('🔄 Recording started - forcing live transcript OFF');
      setTickerEnabled(false);
    }
  }, [isRecording]);

  // Debug logging for tickerEnabled changes
  useEffect(() => {
    console.log('🎯 tickerEnabled changed to:', tickerEnabled);
  }, [tickerEnabled]);
  
  // Transcript snippet state
  const [transcriptSnippet, setTranscriptSnippet] = useState<string>("");
  const [showTranscriptSnippet, setShowTranscriptSnippet] = useState(false);
  const [firstTranscriptionReceived, setFirstTranscriptionReceived] = useState(false);
  const transcriptSnippetIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Recording mode state - defaults to mic-only, synced from persisted preferences
  const meetingPrefs = useMeetingPreferences();
  const [recordingMode, setRecordingMode] = useState<'mic-only' | 'mic-and-system'>('mic-only');

  // Sync recording mode from persisted preferences on load
  useEffect(() => {
    if (!meetingPrefs.loading) {
      const mode = meetingPrefs.prefs.audio_mode === 'mic_system' ? 'mic-and-system' : 'mic-only';
      setRecordingMode(mode);
    }
  }, [meetingPrefs.loading, meetingPrefs.prefs.audio_mode]);
  
  
  // Pause/Mute state
  const [isPaused, setIsPaused] = useState(false);
  
  // Auto-clean state
  const [isAutoCleaningTranscript, setIsAutoCleaningTranscript] = useState(false);
  
  const [lastAutoCleanTime, setLastAutoCleanTime] = useState<Date | null>(null);
  
  
  // Meeting history state
  const [meetings, setMeetings] = useState<any[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [totalTranscriptWords, setTotalTranscriptWords] = useState<number>(0);
  
  // Pagination state for meeting history
  const [currentPage, setCurrentPage] = useState(1);
  const meetingsPerPage = 10;
  
  // Layout view mode for meeting history (persisted)
  const [layoutViewMode, setLayoutViewMode] = useState<HistoryViewMode>(() => {
    try {
      const saved = localStorage.getItem('recorderMeetingHistoryLayoutMode');
      return (saved as HistoryViewMode) || 'list';
    } catch {
      return 'list';
    }
  });
  
  // Persist layout view mode changes
  useEffect(() => {
    try {
      localStorage.setItem('recorderMeetingHistoryLayoutMode', layoutViewMode);
    } catch {
      // Ignore localStorage errors
    }
  }, [layoutViewMode]);
  
  // SafeModeNotesModal state for new view components
  const [safeModeModalOpen, setSafeModeModalOpen] = useState(false);
  const [safeModeSelectedMeeting, setSafeModeSelectedMeeting] = useState<any | null>(null);
  const [safeModeNotes, setSafeModeNotes] = useState('');
  const safeModeModalOpenRef = useRef(false);
  
  // Handler for opening SafeModeNotesModal from new view components
  const handleSafeModeNotesClick = useCallback(async (meetingId: string) => {
    if (!isResourceOperationSafe()) {
      showToast.error("Cannot view notes while recording is active.", { section: 'meeting_manager' });
      return;
    }
    
    // Find meeting in current list first
    const meeting = meetings.find(m => m.id === meetingId);
    if (meeting) {
      console.log('🛡️ Opening Safe Mode notes for:', meeting.title);
      setSafeModeNotes(meeting.meeting_summary || meeting.notes_style_3 || '');
      setSafeModeSelectedMeeting(meeting);
      safeModeModalOpenRef.current = true;
      setSafeModeModalOpen(true);
      return;
    }
    
    // If not in list, fetch from database
    try {
      const { data: meetingData, error } = await supabase
        .from('meetings')
        .select('id, title, start_time, end_time, created_at, duration_minutes, notes_style_3')
        .eq('id', meetingId)
        .maybeSingle();
      
      if (error) throw error;
      if (!meetingData) {
        showToast.error("Meeting not found", { section: 'meeting_manager' });
        return;
      }
      
      // Also fetch summary if notes_style_3 is empty
      let notes = meetingData.notes_style_3 || '';
      if (!notes) {
        const { data: summaryData } = await supabase
          .from('meeting_summaries')
          .select('summary')
          .eq('meeting_id', meetingId)
          .maybeSingle();
        notes = summaryData?.summary || '';
      }
      
      setSafeModeNotes(notes);
      setSafeModeSelectedMeeting(meetingData);
      safeModeModalOpenRef.current = true;
      setSafeModeModalOpen(true);
    } catch (error: any) {
      console.error('Error fetching meeting for SafeModeNotesModal:', error);
      showToast.error("Failed to load meeting notes", { section: 'meeting_manager' });
    }
  }, [meetings, isResourceOperationSafe]);

  // Signal to Meeting History that a new meeting was saved
  const signalMeetingHistoryRefresh = () => {
    localStorage.setItem('meetingHistoryRefresh', Date.now().toString());
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'meetingHistoryRefresh',
      newValue: Date.now().toString()
    }));
  };
  
  // Search and multi-select state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMeetings, setSelectedMeetings] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeletingEmpty, setIsDeletingEmpty] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [showDeleteEmptyDialog, setShowDeleteEmptyDialog] = useState(false);
  const [deleteAllConfirmChecked, setDeleteAllConfirmChecked] = useState(false);
  const [deleteAllHoldProgress, setDeleteAllHoldProgress] = useState(0);
  const deleteAllHoldRef = useRef<NodeJS.Timeout | null>(null);
  const [voiceDetected, setVoiceDetected] = useState(false);
  const voiceDetectedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Meeting editing state
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  
  // Modal states for viewing notes and transcripts
  const [fullPageModalOpen, setFullPageModalOpen] = useState(false);
  const [modalMeeting, setModalMeeting] = useState<any>(null);
  const [modalNotes, setModalNotes] = useState("");
  const [transcriptModalOpen, setTranscriptModalOpen] = useState(false);
  const [currentMeetingForTranscript, setCurrentMeetingForTranscript] = useState<any>(null);
  
  // Dashboard state
  const [dashboardOpen, setDashboardOpen] = useState(false);
  
  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [teamsImportOpen, setTeamsImportOpen] = useState(false);
  const [audioImportOpen, setAudioImportOpen] = useState(false);
  const [audioImportDefaultTab, setAudioImportDefaultTab] = useState<string | undefined>();
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  
  // Recording context state
  const [showContextDialog, setShowContextDialog] = useState(false);
  const [meetingContext, setMeetingContext] = useState<MeetingContext | undefined>();
  const [hasContext, setHasContext] = useState(false);
  
  // Meeting Coach state
  const [coachModalOpen, setCoachModalOpen] = useState(false);
  
  // Folder management state
  const [foldersDialogOpen, setFoldersDialogOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const { folders } = useMeetingFolders();
  
  // Audio capture guidance state
  const [showTabAudioGuidance, setShowTabAudioGuidance] = useState(false);
  const [pendingRecordingStart, setPendingRecordingStart] = useState(false);
  
  // Audio capture status monitoring
  const [micCaptured, setMicCaptured] = useState(false);
  const [systemAudioCaptured, setSystemAudioCaptured] = useState(false);
  const [audioActivity, setAudioActivity] = useState(false);
  
  // AssemblyAI input mode tracking (explicit feedback for users)
  const [assemblyInputMode, setAssemblyInputMode] = useState<'mic-only' | 'mic-and-system' | 'inactive'>('inactive');
  
  // Audio source switching state
  const [isSwitchingAudioSource, setIsSwitchingAudioSource] = useState(false);
  
  // Controlled tabs state for programmatic switching
  const [activeTab, setActiveTab] = useState<string>("recorder");

  // ─── Recording session recovery ────────────────────────────────────
  const {
    recoveredSession,
    isStale: isRecoveredStale,
    isDuplicateTab: isRecoveredDuplicate,
    discardSession: discardRecoveredSession,
    consumeRecovery,
  } = useRecordingRecovery(isRecording);

  // ─── beforeunload warning ──────────────────────────────────────────
  useEffect(() => {
    if (!isRecording) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Recording in progress — are you sure you want to leave?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isRecording]);

  // Auto-switch to recorder tab when recording starts
  useEffect(() => {
    if (isRecording && activeTab !== 'recorder') {
      setActiveTab('recorder');
    }
  }, [isRecording]);

  // Continuation state
  const [isContinuationMode, setIsContinuationMode] = useState(false);
  const [continuationMeetingTitle, setContinuationMeetingTitle] = useState<string>('');

  // ─── Persist recording context to localStorage on every relevant change ───
  // This enables crash recovery by saving attendees, agenda, and session info.
  // Uses MeetingSetupBridge data via the context ref pattern.
  const meetingSetupContextRef = useRef<{
    attendees: any[];
    agendaItems: any[];
    activeGroup: any;
    meetingType: string | null;
    meetingTitle: string | null;
  } | null>(null);

  // This effect runs when recording state or key context values change
  useEffect(() => {
    if (!isRecording) {
      return;
    }
    const currentMeetingId = sessionStorage.getItem('currentMeetingId');
    if (!currentMeetingId) return;

    const ctx = meetingSetupContextRef.current;
    const session: PersistedRecordingSession = {
      sessionId: currentMeetingId,
      startedAt: recordingStartTimeRef.current?.toISOString() || new Date().toISOString(),
      attendees: (ctx?.attendees || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        initials: a.initials || '',
        role: a.role || '',
        org: a.org || '',
        status: a.status || 'present',
        contact_id: a.contact_id,
      })),
      agendaItems: (ctx?.agendaItems || []).map((a: any) => ({ id: a.id, text: a.text })),
      groupId: ctx?.activeGroup?.id || null,
      groupName: ctx?.activeGroup?.name || null,
      meetingFormat: ctx?.meetingType || null,
      meetingTitle: ctx?.meetingTitle || null,
      status: isPaused ? 'paused' : 'recording',
      lastHeartbeat: new Date().toISOString(),
    };
    persistRecordingSession(session);
  }, [isRecording, isPaused]);

  // Stop heartbeat when recording ends
  useEffect(() => {
    if (!isRecording) {
      stopHeartbeat();
    }
  }, [isRecording]);
  
  // Transcription watchdog for detecting stalled transcription
  // iPhone chunking runs on ~25s windows, so iOS needs much longer thresholds to avoid false alarms.
  const watchdog = useTranscriptionWatchdog({
    isActive: isRecording,
    warningThresholdMs: isIOS ? 180000 : 150000, // 3 min iOS, 2.5 min desktop — allows 90s chunk + API latency
    criticalThresholdMs: isIOS ? 300000 : 240000, // 5 min iOS, 4 min desktop — genuine failure only
    onStallDetected: (stalledDurationMs) => {
      console.error(`🚨 Transcription stall detected after ${Math.round(stalledDurationMs / 1000)}s`);
      // Log diagnostic info
      console.log('📊 Stall diagnostics:', {
        isRecordingRef: isRecordingRef.current,
        chunkSaveStatusesCount: chunkSaveStatuses.length,
        transcriptLength: transcript.length,
        wordCount
      });
    },
    onStallRecovered: () => {
      console.log('✅ Transcription recovered from stall');
    }
  });
  
  // Teams audio detection - gentle hint for users who might be missing other participants
  const teamsAudioDetection = useTeamsAudioDetection({
    meetingType,
    audioSourceMode,
    isRecording,
    duration,
    wordCount,
    actualChunksPerMinute: watchdog.actualChunksPerMinute,
    healthStatus: watchdog.healthStatus
  });
  
  // Meeting settings - use from useMeetingData hook
  const {
    meetingSettings,
    setMeetingSettings: updateMeetingSettings
  } = useMeetingData();

  // Timestamp toggle state
  const [showTimestamps, setShowTimestamps] = useState(true);

  const handleTimestampsToggle = (show: boolean) => {
    setShowTimestamps(show);
  };

  // Transcript view mode for switching between Batch (Whisper), Live (Assembly AI), and Deepgram
  // Default to 'live' (AssemblyAI) during recording for real-time feedback
  const [transcriptViewMode, setTranscriptViewMode] = useState<'batch' | 'live' | 'deepgram'>('live');

  // AssemblyAI real-time preview hook (runs alongside Whisper)
  const assemblyPreview = useAssemblyRealtimePreview();
  const meetingKeytermsRef = useRef<string[]>([]);

  // Build keyterms from meeting context for AssemblyAI recognition
  const buildMeetingKeyterms = useCallback((): string[] => {
    const NHS_BASE = [
      'NHS', 'ICB', 'PCN', 'CQC', 'KPMG', 'NHSE', 'NICE', 'BMA',
      'indemnity', 'reinsurance', 'deductible', 'safeguarding',
    ];
    const ctx = meetingSetupContextRef.current;
    const attendeeNames = (ctx?.attendees || [])
      .map((a: any) => a?.name?.trim())
      .filter(Boolean);
    const agendaTerms = (ctx?.agendaItems || [])
      .map((a: any) => a?.text?.trim())
      .filter(Boolean)
      .flatMap((t: string) => {
        // Extract key phrases from agenda items (split on common delimiters)
        const parts = t.split(/[,;–—/]/).map(p => p.trim()).filter(p => p.length > 1 && p.length <= 50);
        return parts.length > 0 ? parts : [t.substring(0, 50)];
      });
    return [...NHS_BASE, ...attendeeNames, ...agendaTerms]
      .filter(t => t.length > 0 && t.length <= 50)
      .slice(0, 100);
  }, []);

  // Deepgram real-time preview hook (runs alongside Whisper and AssemblyAI)
  const deepgramPreview = useDeepgramRealtimePreview();

  // Gladia real-time preview hook (runs alongside other engines)
  const gladiaPreview = useGladiaRealtimePreview();

  const countWords = useCallback((text: string) => {
    const t = (text ?? '').trim();
    if (!t) return 0;
    return t.split(/\s+/).filter(w => w.length > 0).length;
  }, []);

  // Calculate word count from the best available transcript.
  // AssemblyAI is preferred for live feedback, but if it fails (e.g. system-audio issues)
  // we must still preserve the meeting based on the Whisper or Deepgram transcript.
  useEffect(() => {
    const assemblyWords = countWords(assemblyPreview.fullTranscript);
    const whisperWords = countWords(transcript);
    const deepgramWords = countWords(deepgramPreview.fullTranscript);
    const gladiaWords = countWords(gladiaPreview.fullTranscript);
    const effectiveWords = Math.max(assemblyWords, whisperWords, deepgramWords, gladiaWords);

    setWordCount(effectiveWords);
    onWordCountUpdate(effectiveWords);
  }, [assemblyPreview.fullTranscript, transcript, deepgramPreview.fullTranscript, gladiaPreview.fullTranscript, onWordCountUpdate, countWords]);

  // ============= WHISPER COST PROTECTION =============
  // Maximum recording duration (4 hours) to prevent runaway billing
  const MAX_RECORDING_DURATION_SECONDS = 4 * 60 * 60; // 4 hours
  // Warning thresholds at 1h, 2h, 3h
  const DURATION_WARNINGS = [3600, 7200, 10800]; // seconds
  const shownDurationWarningsRef = useRef<Set<number>>(new Set());

  // Get current meeting ID from sessionStorage for kill signal
  const currentMeetingIdFromStorage = sessionStorage.getItem('currentMeetingId');

  // Server-side kill signal listener
  useMeetingKillSignal(
    currentMeetingIdFromStorage,
    isRecording,
    useCallback(() => {
      console.log('🛑 Server kill signal received - stopping recording');
      stopRecording();
    }, [])
  );

  // Calculate last chunk timestamp from chunkSaveStatuses
  const lastChunkTimestamp = React.useMemo(() => {
    const savedChunks = chunkSaveStatuses.filter(c => c.saveStatus === 'saved' && c.saveTimestamp);
    if (savedChunks.length === 0) return null;
    const lastSaved = savedChunks[savedChunks.length - 1];
    return lastSaved.saveTimestamp ? new Date(lastSaved.saveTimestamp).getTime() : null;
  }, [chunkSaveStatuses]);

  // Recording health monitor callbacks - use refs to avoid dependency on stopRecording which is defined later
  const stopRecordingRef = useRef<((options?: { serverTriggered?: boolean }) => void) | null>(null);
  
  const handleServerClosureDetected = useCallback(() => {
    console.log('🛑 Health monitor detected server closure - stopping recording');
    stopRecordingRef.current?.({ serverTriggered: true });
  }, []);

  // Mic stream ref - declared early for health monitor access
  const micAudioStreamRef = useRef<MediaStream | null>(null);

  const handleRecordingStalled = useCallback(() => {
    console.log('⚠️ Health monitor detected stall - transcription may have stopped');
  }, []);

  const handleTracksDied = useCallback(() => {
    console.error('🔴 Health monitor: mic tracks died — recording likely broken');
    // Don't auto-stop — let the user decide, but warn them clearly
  }, []);

  // Recording health monitor - detects stalls, server-side closures, and dead mic tracks
  const { serverStatus, isStalled } = useRecordingHealthMonitor({
    meetingId: currentMeetingIdFromStorage,
    isRecording,
    lastChunkTimestamp,
    onServerClosureDetected: handleServerClosureDetected,
    onRecordingStalled: handleRecordingStalled,
    micStreamRef: micAudioStreamRef,
    onTracksDied: handleTracksDied
  });

  // Duration warning and hard limit effect
  useEffect(() => {
    if (!isRecording) {
      // Reset warnings when not recording
      shownDurationWarningsRef.current.clear();
      return;
    }

    // Show warnings at milestones
    DURATION_WARNINGS.forEach(threshold => {
      if (duration >= threshold && !shownDurationWarningsRef.current.has(threshold)) {
        shownDurationWarningsRef.current.add(threshold);
        const hours = threshold / 3600;
        showToast.warning(`Recording has been running for ${hours} hour${hours > 1 ? 's' : ''}`, { 
          section: 'meeting_manager',
          duration: 10000 
        });
        console.log(`⏰ Duration warning: ${hours} hour(s) reached`);
      }
    });

    // Hard stop at 4 hours
    if (duration >= MAX_RECORDING_DURATION_SECONDS) {
      console.warn('⚠️ Maximum recording duration (4 hours) reached - auto-stopping');
      showToast.error('Recording auto-stopped after 4 hours maximum duration', { 
        section: 'meeting_manager',
        duration: 15000 
      });
      stopRecording();
    }
  }, [duration, isRecording]);

  // Reset meeting function
  const resetMeeting = async () => {
    // Stop any ongoing recordings first
    if (isRecording) {
      await stopRecording();
    }
    
    setIsRecording(false);
    isRecordingRef.current = false;
    recordingStartTimeRef.current = null; // Reset recording start time
    lastChunkEndTime.current = null; // Reset chunk timing
    setDuration(0);
    setTranscript("");
    setRealtimeTranscripts([]);
    setChunkCounter(0);
    chunkCounterRef.current = 0; // CRITICAL: Reset ref alongside state
    setChunkSaveStatuses([]); // Clear previous meeting's chunk data
    setBrowserSpeechPreviewText(''); // Reset browser speech preview
    setRemovedSegments([]); // Clear removed segments from previous meeting
    setConnectionStatus("Disconnected");
    setSpeakerCount(0);
    setWordCount(0);
    setLastPhrase("");
    setStartTime("");
    setLiveSummary("");
    setTickerText("");
    setShowTicker(false);
    setTranscriptSnippet("");
    setShowTranscriptSnippet(false);
    
    // Reset recording mode to default (mic-only) for next meeting
    setRecordingMode('mic-only');
    setMicCaptured(false);
    setSystemAudioCaptured(false);
    setAssemblyInputMode('inactive');
    
    // Clear AssemblyAI live transcript state
    assemblyPreview.clearTranscript();
    
    // Clear Deepgram live transcript state
    deepgramPreview.clearTranscript();

    // Clear Gladia live transcript state
    gladiaPreview.clearTranscript();
    
    setSelectedMeetings([]);
    setIsSelectMode(false);
    setDeleteConfirmation("");
    
    // Clear early word count display
    if (earlyWordCountTimeoutRef.current) {
      clearTimeout(earlyWordCountTimeoutRef.current);
      earlyWordCountTimeoutRef.current = null;
    }
    setShowEarlyWordCount(false);
    setEarlyWordCountValue(0);
    
    // Reset meeting type and location - default to face-to-face
    setMeetingType('face-to-face');
    setMeetingLocation('');
    
    updateMeetingSettings({
      title: "General Meeting",
      description: "",
      meetingType: "general",
      practiceId: "",
      meetingFormat: "teams",
      transcriberService: "whisper",
      transcriberThresholds: {
        whisper: 0.30,
        deepgram: 0.80
      },
      meetingStyle: "standard", 
      attendees: "",
      agenda: "",
      date: "",
      startTime: "",
      format: "",
      location: ""
    });
    
    // Clear parent component state
    onTranscriptUpdate("");
    onDurationUpdate("00:00");
    onWordCountUpdate(0);
    
    // Stop all transcribers
    if (browserTranscriberRef.current) {
      browserTranscriberRef.current.stopTranscription();
      browserTranscriberRef.current = null;
    }
    
    if (iPhoneTranscriberRef.current) {
      iPhoneTranscriberRef.current.stopTranscription();
      iPhoneTranscriberRef.current = null;
    }
    
    if (simpleIOSTranscriberRef.current) {
      await simpleIOSTranscriberRef.current.stop();
      simpleIOSTranscriberRef.current = null;
    }
    
    if (desktopTranscriberRef.current) {
      await desktopTranscriberRef.current.stopTranscription();
      desktopTranscriberRef.current = null;
    }
    
    // Cleanup AssemblyAI audio mixer
    cleanupAssemblyAudioStream(assemblyAudioMixerRef.current);
    assemblyAudioMixerRef.current = null;
    
    // Clear recording audio if playing
    if (recordingAudioRef.current) {
      recordingAudioRef.current.pause();
      recordingAudioRef.current.currentTime = 0;
    }
    if (micAudioRef.current) {
      micAudioRef.current.pause();
      micAudioRef.current.currentTime = 0;
    }
    if (systemAudioRef.current) {
      systemAudioRef.current.pause();
      systemAudioRef.current.currentTime = 0;
    }
    setRecordingAudioUrl(null);
    setMicAudioUrl(null);
    setSystemAudioUrl(null);
    setRecordingBlob(null);
    setMicBlob(null);
    setSystemBlob(null);
    
    // Clear transcript snippet interval
    if (transcriptSnippetIntervalRef.current) {
      clearInterval(transcriptSnippetIntervalRef.current);
      transcriptSnippetIntervalRef.current = null;
    }
    
    // Clear auto-clean interval
    if (autoCleanIntervalRef.current) {
      clearInterval(autoCleanIntervalRef.current);
      autoCleanIntervalRef.current = null;
    }
    
    // Clear live notes interval
    if (liveNotesIntervalRef.current) {
      clearInterval(liveNotesIntervalRef.current);
      liveNotesIntervalRef.current = null;
    }
    
    // Clear heartbeat interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
    // Clear chunk start timeout
    if (chunkStartTimeoutRef.current) {
      clearTimeout(chunkStartTimeoutRef.current);
      chunkStartTimeoutRef.current = null;
    }
    
    // Clear first live notes timeout
    if (firstLiveNotesTimeoutRef.current) {
      clearTimeout(firstLiveNotesTimeoutRef.current);
      firstLiveNotesTimeoutRef.current = null;
    }
    
    console.log('🔄 Meeting reset completed');
    
    // Page refresh removed to keep UI responsive after stop
  };
  
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // State for auto-opening SafeModeNotesModal when navigated from PostMeetingActionsModal
  const [autoOpenSafeModeForMeetingId, setAutoOpenSafeModeForMeetingId] = useState<string | null>(null);
  const [showCorrections, setShowCorrections] = useState(false);
  
  // Handle navigation state for opening SafeModeNotesModal
  useEffect(() => {
    const state = location.state as { 
      openSafeModeModal?: boolean; 
      safeModeModalMeetingId?: string;
      switchToHistoryTab?: boolean;
    } | null;
    
    if (state?.openSafeModeModal && state?.safeModeModalMeetingId) {
      console.log('🛡️ Navigation state detected - switching to History tab and opening SafeModeNotesModal');
      
      // Switch to history tab
      if (state.switchToHistoryTab) {
        setActiveTab('history');
      }
      
      // Set the meeting ID to auto-open
      setAutoOpenSafeModeForMeetingId(state.safeModeModalMeetingId);
      
      // Clear the navigation state to prevent re-opening on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const latestCompleteTranscriptRef = useRef<string>('');
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const autoCleanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const liveNotesIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chunkStartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const firstLiveNotesTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const browserAudioStreamRef = useRef<MediaStream | null>(null);
  // micAudioStreamRef declared earlier (line ~686) for health monitor access
  const transcriptHandler = useRef<IncrementalTranscriptHandler | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const recordingStartTimeRef = useRef<Date | null>(null);
  const recordingStartMonotonicRef = useRef<number | null>(null);
  
  // AssemblyAI audio mixer ref (for proper system audio capture like Whisper)
  const assemblyAudioMixerRef = useRef<BuildAssemblyAudioStreamResult | null>(null);
  
  // Fetch user practices and set default location
  useEffect(() => {
    const fetchUserPractices = async () => {
      if (!user?.id) return;
      
      try {
        const { data: practiceIds } = await supabase.rpc('get_user_practice_ids', {
          p_user_id: user.id
        });
        
        if (practiceIds && practiceIds.length > 0) {
          const { data: practices } = await supabase
            .from('gp_practices')
            .select('id, name')
            .in('id', practiceIds);
          
          if (practices) {
            setUserPractices(practices.map(p => ({ id: p.id, practice_name: p.name })));
            // Set default location to first practice if face-to-face is selected
            if (meetingType === 'face-to-face' && !meetingLocation) {
              setMeetingLocation(practices[0].name);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching practices:', error);
      }
    };
    
    fetchUserPractices();
  }, [user?.id]);

  // Auto-start recording when autoStart prop is true (for Quick Record)
  useEffect(() => {
    if (autoStart && !isRecording && !autoStartTriggeredRef.current && user) {
      autoStartTriggeredRef.current = true;
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        console.log('🚀 Auto-starting recording from Quick Record...');
        startRecording();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoStart, isRecording, user]);

  // Track if continuation toast has been shown to prevent loops
  const continuationToastShownRef = useRef<string | null>(null);

  // Handle continuation mode setup
  useEffect(() => {
    if (forceRecorderTab && continueMeetingId) {
      // Only show toast once per meeting ID
      if (continuationToastShownRef.current === continueMeetingId) {
        return;
      }
      
      console.log('🔄 Setting up continuation mode for meeting:', continueMeetingId);
      
      // Switch to recorder tab
      setActiveTab("recorder");
      
      // Set continuation mode
      setIsContinuationMode(true);
      setContinuationMeetingTitle(initialSettings?.title || 'Previous Meeting');
      
      // Set session storage for meeting ID so startRecording knows to continue
      sessionStorage.setItem('continuationMeetingId', continueMeetingId);
      
      // If there's existing duration, store it for combining later
      if (existingDuration > 0) {
        sessionStorage.setItem('continuationDuration', existingDuration.toString());
      }
      
      // Mark toast as shown for this meeting
      continuationToastShownRef.current = continueMeetingId;
      
      showToast.info(`Ready to continue "${initialSettings?.title || 'meeting'}". Press record to add more.`, { 
        section: 'meeting_manager',
        duration: 5000 
      });
    }
  }, [forceRecorderTab, continueMeetingId, initialSettings?.title, existingDuration]);

  useEffect(() => {
    if (meetingType === 'face-to-face' && userPractices.length > 0 && !meetingLocation) {
      setMeetingLocation(userPractices[0].practice_name);
    } else if (meetingType !== 'face-to-face') {
      setMeetingLocation('');
    }
  }, [meetingType, userPractices]);

  // Update meeting settings when type/location changes
  useEffect(() => {
    updateMeetingSettings(prev => ({
      ...prev,
      meetingFormat: meetingType,
      location: meetingType === 'face-to-face' ? meetingLocation : ''
    }));
  }, [meetingType, meetingLocation]);
  // Progressive pre-summaries ingestion state
  const ingestedKeysRef = useRef<Set<string>>(new Set());
  // Audio backup recording refs
  const audioBackupRecorder = useRef<MediaRecorder | null>(null);
  const audioBackupChunks = useRef<Blob[]>([]);
  const audioBackupStream = useRef<MediaStream | null>(null);
  
  // Recording playback refs
  const [recordingAudioUrl, setRecordingAudioUrl] = useState<string | null>(null);
  const [micAudioUrl, setMicAudioUrl] = useState<string | null>(null);
  const [systemAudioUrl, setSystemAudioUrl] = useState<string | null>(null);
  const [showRecordingPlayer, setShowRecordingPlayer] = useState(false); // Only show player on request for iPhone
  
  // Store actual blobs for saving to database
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [micBlob, setMicBlob] = useState<Blob | null>(null);
  const [systemBlob, setSystemBlob] = useState<Blob | null>(null);
  
  const recordingAudioRef = useRef<HTMLAudioElement | null>(null);
  const micAudioRef = useRef<HTMLAudioElement | null>(null);
  const systemAudioRef = useRef<HTMLAudioElement | null>(null);

  // Audio segment recording refs
  const audioSegmentRecorder = useRef<MediaRecorder | null>(null);
  const audioSegmentChunks = useRef<Blob[]>([]);
  const segmentIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSegmentNumber = useRef<number>(1);
  const segmentStartTime = useRef<Date>(new Date());
  
  // 5-second chunking with 2-second overlap refs
  const chunkRecorders = useRef<Map<number, MediaRecorder>>(new Map());
  const chunkData = useRef<Map<number, Blob[]>>(new Map());
  const chunkIntervals = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const chunkStartTimes = useRef<Map<number, Date>>(new Map());
  const lastChunkEndTime = useRef<number | null>(null); // Track last chunk's end time in seconds
  
  // Stereo audio capture ref
  const stereoAudioCapture = useRef(new StereoAudioCapture());
  const stereoRecorder = useRef<MediaRecorder | null>(null);
  const stereoChunks = useRef<Blob[]>([]);

  // Function to round time to nearest 15 minutes
  const roundToNearest15Minutes = (date: Date): Date => {
    const minutes = date.getMinutes();
    const roundedMinutes = Math.round(minutes / 15) * 15;
    const roundedDate = new Date(date);
    roundedDate.setMinutes(roundedMinutes, 0, 0); // Set seconds and milliseconds to 0
    
    // If rounding went to next hour, adjust
    if (roundedMinutes === 60) {
      roundedDate.setHours(roundedDate.getHours() + 1);
      roundedDate.setMinutes(0);
    }
    
    return roundedDate;
  };

  // Function to generate meeting timestamp with current date and rounded time
  const generateMeetingTimestamp = (): string => {
    const now = new Date();
    const roundedTime = roundToNearest15Minutes(now);
    return roundedTime.toISOString();
  };


  // Audio backup functions
  const startAudioBackup = async () => {
    try {
      console.log('🎯 Starting audio backup recording...');
      
      // ChatGPT recommended audio settings for backup recording 
      audioBackupStream.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,        // 48kHz - Chrome native standard
          channelCount: 1,
          echoCancellation: false,  // Disabled to avoid artifacts
          noiseSuppression: false,  // Disabled to avoid artifacts
          autoGainControl: false    // Disabled to avoid artifacts
        }
      });

      audioBackupChunks.current = [];
      audioBackupRecorder.current = new MediaRecorder(audioBackupStream.current, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000 // 16kbps mono - ~7MB/hour, stays under Whisper 25MB limit
      });

      audioBackupRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioBackupChunks.current.push(event.data);
          // Persist to IndexedDB for crash recovery
          const sid = sessionStorage.getItem('currentMeetingId');
          if (sid) {
            saveAudioChunk(sid, event.data).catch(() => {});
          }
        }
      };

      audioBackupRecorder.current.start(1000); // Collect data every second
      console.log('✅ Audio backup recording started');
      
    } catch (error) {
      console.error('❌ Failed to start audio backup:', error);
    }
  };

  const stopAudioBackup = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!audioBackupRecorder.current || audioBackupRecorder.current.state === 'inactive') {
        resolve(null);
        return;
      }

      audioBackupRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioBackupChunks.current, { type: 'audio/webm' });
        console.log('✅ Audio backup recording stopped, size:', audioBlob.size);
        
        // Clean up
        if (audioBackupStream.current) {
          audioBackupStream.current.getTracks().forEach(track => track.stop());
          audioBackupStream.current = null;
        }
        
        resolve(audioBlob);
      };

      audioBackupRecorder.current.stop();
    });
  };

  // Auto transcript cleaning function
  const performAutoTranscriptClean = async () => {
    if (isAutoCleaningTranscript || !transcript || !meetingSettings.title) {
      return;
    }

    const wordCount = transcript.trim().split(/\s+/).length;
    if (wordCount < 200) {
      console.log('📋 Auto-clean skipped - transcript too short (<200 words)');
      return;
    }

    console.log('🧹 Starting auto Deep Clean of transcript...');
    setIsAutoCleaningTranscript(true);
    setLastAutoCleanTime(new Date());

    try {
      showToast.info('Auto cleaning transcript...', { section: 'meeting_manager', id: 'auto-clean', duration: Infinity });
      
      const cleanedTranscript = await cleanLargeTranscript(
        transcript,
        meetingSettings.title,
        (done, total) => {
          if (total > 1) {
            showToast.info(`Auto cleaning transcript... ${done}/${total} chunks`, { section: 'meeting_manager', id: 'auto-clean', duration: Infinity });
          }
        }
      );

      if (cleanedTranscript && cleanedTranscript !== transcript) {
        setTranscript(cleanedTranscript);
        onTranscriptUpdate(cleanedTranscript);
        
        // Word count is calculated from chunks
        
        showToast.success('Transcript auto-cleaned successfully', { section: 'meeting_manager', id: 'auto-clean' });
        console.log('✅ Auto Deep Clean completed');
      } else {
        showToast.dismiss('auto-clean');
        console.log('📋 Auto Deep Clean - no changes needed');
      }
    } catch (error) {
      console.error('❌ Auto Deep Clean failed:', error);
      showToast.error('Auto clean failed - continuing with original transcript', { section: 'meeting_manager', id: 'auto-clean' });
    } finally {
      setIsAutoCleaningTranscript(false);
    }
  };

  // Live notes generation function
  const generateLiveNotes = async () => {
    if (!transcript || !meetingSettings.title) {
      console.log('📝 Live notes generation skipped - missing requirements');
      return;
    }

    const currentMeetingId = sessionStorage.getItem('currentMeetingId');
    const currentSessionId = sessionStorage.getItem('currentSessionId');
    
    if (!currentMeetingId || !currentSessionId) {
      console.log('📝 Live notes generation skipped - no meeting/session ID');
      return;
    }

    const wordCount = transcript.trim().split(/\s+/).length;
    if (wordCount < 500) {
      console.log('📝 Live notes generation skipped - transcript too short (<500 words)');
      return;
    }

    console.log('📝 Generating live meeting notes...');
    
    try {
      const { data, error } = await supabase.functions.invoke('live-meeting-notes-generator', {
        body: {
          meetingId: currentMeetingId,
          userId: user?.id,
          sessionId: currentSessionId,
          forceGenerate: false
        }
      });

      if (error) {
        console.error('❌ Live notes generation failed:', error);
        return;
      }

      if (data?.success) {
        console.log(`✅ Live Notes generated: Version ${data.version} (${data.wordCount} words processed)`);
        showToast.success(`Live notes updated - Version ${data.version}`, { section: 'meeting_manager', duration: 3000 });
      } else {
        console.log('📝 Live notes generation skipped:', data?.message);
      }
    } catch (error) {
      console.error('❌ Live notes generation failed:', error);
      // Don't show error toast as this is background process
    }
  };

  // Calculate expected word count based on duration (5000 words per hour)
  const calculateExpectedWordCount = (durationSeconds: number): number => {
    const hours = durationSeconds / 3600;
    return Math.floor(hours * 5000);
  };

  // Check if audio backup is needed based on word count vs duration
  const shouldCreateAudioBackup = (wordCount: number, durationSeconds: number): boolean => {
    const expectedWords = calculateExpectedWordCount(durationSeconds);
    const wordCountRatio = wordCount / expectedWords;
    const needsBackup = wordCountRatio < 0.7; // If word count is less than 70% of expected
    
    console.log(`📊 Word count analysis:`, {
      actualWords: wordCount,
      expectedWords,
      ratio: wordCountRatio,
      needsBackup
    });
    
    return needsBackup && durationSeconds > 300; // Only for meetings longer than 5 minutes
  };

  // Upload audio backup to Supabase storage
  const uploadAudioBackup = async (audioBlob: Blob, meetingId: string, duration: number, wordCount: number, expectedWords: number): Promise<string | null> => {
    try {
      console.log('📤 Uploading audio backup...');
      
      const fileName = `${user?.id}/${meetingId}_backup.webm`;
      
      const { data, error } = await supabase.storage
        .from('meeting-audio-backups')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (error) {
        throw error;
      }

      // Calculate quality score based on word count vs expected
      const qualityScore = Math.min(wordCount / expectedWords, 1.0);
      
      // Store backup metadata
      const { error: metadataError } = await supabase
        .from('meeting_audio_backups')
        .insert({
          meeting_id: meetingId,
          user_id: user?.id,
          file_path: data.path,
          file_size: audioBlob.size,
          duration_seconds: duration,
          transcription_quality_score: qualityScore,
          word_count: wordCount,
          expected_word_count: expectedWords,
          backup_reason: qualityScore < 0.7 ? 'low_word_count' : 'quality_check'
        });

      if (metadataError) {
        console.error('❌ Failed to store backup metadata:', metadataError);
      }

      console.log('✅ Audio backup uploaded successfully:', data.path);
      return data.path;
      
    } catch (error) {
      console.error('❌ Failed to upload audio backup:', error);
      return null;
    }
  };

  // 5-second chunking with 2-second overlap functions
  const startOverlappingChunks = async (meetingId: string) => {
    try {
      console.log('🎵 Starting 5-second overlapping chunks with Profile 1 settings...');
      
      // ChatGPT recommended: standardize to 48kHz end-to-end  
      const profile1Constraints: MediaStreamConstraints = {
        audio: {
          sampleRate: 48000,        // 48kHz - Chrome native, avoid resampling artifacts
          channelCount: 1,
          echoCancellation: false,  // Disabled - can create artifacts in meetings
          noiseSuppression: false,  // Disabled - can create artifacts in meetings
          autoGainControl: false    // Disabled - can create artifacts in meetings
        }
      };

      console.log('🎵 Profile 1 audio constraints:', profile1Constraints);
      
      // Get SEPARATE microphone stream for overlapping chunks (not shared with preview)
      const chunksStream = await navigator.mediaDevices.getUserMedia(profile1Constraints);
      
      // Add audio level monitoring with ChatGPT recommended sample rate
      const audioContext = new AudioContext({ sampleRate: 48000 });
      const source = audioContext.createMediaStreamSource(chunksStream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let silentCounters = 0;
      
      const checkAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        console.log(`🎵 Audio level: ${average.toFixed(2)}`);
        
        // Voice detection for UI indicator
        if (average > 10) {
          setVoiceDetected(true);
          if (voiceDetectedTimeoutRef.current) {
            clearTimeout(voiceDetectedTimeoutRef.current);
          }
          voiceDetectedTimeoutRef.current = setTimeout(() => {
            setVoiceDetected(false);
          }, 500);
        }
        
        if (average < 5) { // Very low threshold
          silentCounters++;
          console.log(`⚠️ Low audio detected (${silentCounters}/3)`);
          
          if (silentCounters >= 3) {
            console.log('🔄 Audio stream appears silent, this might indicate a browser audio issue');
            showToast.warning("Low audio detected - check microphone settings or browser permissions", { section: 'meeting_manager' });
          }
        } else {
          silentCounters = 0; // Reset counter on good audio
        }
      };
      
      // Monitor audio levels every second
      const levelInterval = setInterval(checkAudioLevel, 1000);
      
      console.log('🎵 Successfully got INDEPENDENT audio stream for chunks:', {
        tracks: chunksStream.getAudioTracks().length,
        trackSettings: chunksStream.getAudioTracks()[0]?.getSettings(),
        audioContext: audioContext.state
      });

      let chunkId = 0;
      let isFirstChunk = true; // Track first chunk for fast processing
      
        const startNewChunk = () => {
          const currentChunkId = chunkId++;
          const chunks: Blob[] = [];
          chunkData.current.set(currentChunkId, chunks);
          // Ensure we have a stable absolute recording start time before any chunk timing math
          if (!recordingStartTimeRef.current) {
            recordingStartTimeRef.current = new Date();
          }
          if (recordingStartMonotonicRef.current == null) {
            recordingStartMonotonicRef.current = performance.now();
          }
          
          // Use last chunk's end time as this chunk's start time for continuous timeline
          if (lastChunkEndTime.current !== null) {
            // Calculate the wall clock time that corresponds to the last chunk's end time
            const lastEndWallClock = new Date(
              recordingStartTimeRef.current.getTime() + (lastChunkEndTime.current * 1000)
            );
            chunkStartTimes.current.set(currentChunkId, lastEndWallClock);
            console.log(`⏱️ Using previous chunk end time as start: ${lastChunkEndTime.current}s`);
          } else {
            // First chunk - use current time
            chunkStartTimes.current.set(currentChunkId, new Date());
          }

          // Create new recorder for this chunk using the SAME stream
        const recorder = new MediaRecorder(chunksStream, {
          mimeType: 'audio/webm;codecs=opus'
        });

        console.log(`🎵 Created recorder for chunk ${currentChunkId} using shared chunks stream`);

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        recorder.onstop = async () => {
          await processChunk(meetingId, currentChunkId);
        };

        chunkRecorders.current.set(currentChunkId, recorder);
        recorder.start(); // Use default timeslice for more stable recording

        console.log(`🎵 Started chunk ${currentChunkId}`);

        // Use 90s chunk duration from config (Option A)
        // First chunk can be shorter (30s) for quick feedback, subsequent use full 90s
        const chunkDuration = isFirstChunk ? 30000 : 90000;
        
        if (isFirstChunk) {
          console.log('⚡ First chunk: Processing after 30s for quick feedback');
          isFirstChunk = false;
        }

        const stopTimeout = setTimeout(() => {
          if (chunkRecorders.current.has(currentChunkId)) {
            const recorder = chunkRecorders.current.get(currentChunkId);
            if (recorder && recorder.state === 'recording') {
              recorder.stop();
              chunkRecorders.current.delete(currentChunkId);
            }
          }
        }, chunkDuration);

        chunkIntervals.current.set(currentChunkId, stopTimeout);
      };

      // Start first chunk immediately
      startNewChunk();

      // Start second chunk after 30s (first chunk duration), then use 87s intervals (90s - 3s overlap)
      chunkStartTimeoutRef.current = setTimeout(() => {
        if (isRecording && isRecordingRef.current && chunksStream?.active) {
          console.log('🔄 Starting second chunk at 30s mark');
          startNewChunk();
          
          // Regular 87s interval for subsequent chunks (90s chunk - 3s overlap)
          const chunkInterval = setInterval(() => {
            if (isRecording && isRecordingRef.current && chunksStream && chunksStream.active) {
              console.log(`🔄 Starting new chunk ${chunkId + 1} - system is active`);
              
              startNewChunk();
              
              // Force UI update to show transcription is active
              showToast.info(`Recording chunk ${chunkId + 1}`, { section: 'meeting_manager',
                description: `Continuous transcription active`,
                duration: 1500
              });
            } else {
              console.log(`🛑 Stopping chunk interval - recording state:`, {
                isRecording,
                isRecordingRef: isRecordingRef.current,
                streamActive: chunksStream?.active
              });
              
              clearInterval(chunkInterval);
              
              // Clean up audio monitoring
              if (levelInterval) {
                clearInterval(levelInterval);
              }
              // Clean up the chunks stream when recording stops
              if (chunksStream) {
                chunksStream.getTracks().forEach(track => track.stop());
              }
              // Clean up audio context
              if (audioContext && audioContext.state !== 'closed') {
                audioContext.close();
              }
            }
          }, 87000); // 87s = 90s chunk - 3s overlap
          
          segmentIntervalRef.current = chunkInterval;
        }
      }, 30000); // First interval fires at 30s to match first chunk

      // Add a heartbeat to show recording is active every 5 seconds
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      heartbeatIntervalRef.current = setInterval(() => {
        if (isRecording && isRecordingRef.current) {
          // Get current transcript length for user feedback
          const currentLength = transcript.length;
          const currentWords = wordCount;
          
          console.log(`💓 Heartbeat: ${currentWords} words, ${currentLength} chars transcribed`);
        } else {
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
          }
        }
      }, 5000); // Every 5 seconds for frequent feedback

      console.log('✅ Overlapping chunk recording started with fast first chunk (10s)');
      
    } catch (error) {
      console.error('❌ Failed to start overlapping chunk recording:', error);
    }
  };

  const processChunk = async (meetingId: string, chunkId: number) => {
    try {
      const chunks = chunkData.current.get(chunkId);
      const startTime = chunkStartTimes.current.get(chunkId);
      
      if (!chunks || chunks.length === 0 || !startTime) {
        console.log(`⚠️ No data for chunk ${chunkId}`);
        
        return;
      }

      console.log(`🎵 Processing chunk ${chunkId} (${chunks.length} audio chunks, total size: ${chunks.reduce((sum, chunk) => sum + chunk.size, 0)} bytes)...`);
      
      // Add chunk to status tracking immediately with timestamps
      // CRITICAL: Use synchronous ref for correct chunk numbering (setState is async)
      chunkCounterRef.current += 1;
      const currentChunkNumber = chunkCounterRef.current;
      setChunkCounter(currentChunkNumber); // Update state for UI display
      
      const uniqueChunkId = `chunk_${Date.now()}_${currentChunkNumber}`;
      
      // Calculate chunk timing relative to recording start
      const recordingStart = recordingStartTimeRef.current;
      
      if (!recordingStart) {
        console.error('❌ CRITICAL: Recording start time not set when processing chunk!', {
          chunkId,
          startTime: startTime.toISOString(),
          recordingStartTimeRefExists: !!recordingStartTimeRef.current
        });
        // Fallback: Use first chunk as recording start
        recordingStartTimeRef.current = startTime;
      }
      
      // FIXED: Calculate chunk start time based on when the chunk ACTUALLY started recording,
      // not when we're processing it. Use the stored startTime (from chunkStartTimes.current)
      // which was captured at the moment recording began for this chunk.
      const wallClockStartSeconds = recordingStartTimeRef.current
        ? (startTime.getTime() - recordingStartTimeRef.current.getTime()) / 1000 
        : 0;
      
      // Use wall clock timing since startTime is already the actual chunk start moment
      // The previous monotonic calculation was wrong - it used performance.now() at PROCESSING time
      // not at RECORDING START time, causing first chunk to show as starting at ~30s instead of 0s
      const chunkStartSeconds = Math.max(0, wallClockStartSeconds);
      
      console.log(`⏱️ Chunk ${chunkId} START time:`, {
        recordingStartSet: !!recordingStartTimeRef.current,
        recordingStart: recordingStartTimeRef.current?.toISOString(),
        chunkStart: startTime.toISOString(),
        chunkStartSeconds,
        calculationValid: chunkStartSeconds >= 0,
        timingMode: 'wallclock-fixed'
      });
      
      const chunkProcessTime = new Date();
      
      // Create blob from chunks early so we can capture metadata immediately
      let chunkBlob = new Blob(chunks, { type: 'audio/webm' });
      const originalSize = chunkBlob.size;
      
      const newChunkStatus: ChunkSaveStatus = {
        id: uniqueChunkId,
        chunkNumber: currentChunkNumber,
        text: "",
        chunkLength: 0,
        saveStatus: 'saving',
        retryCount: 0,
        confidence: 0,
        startTime: chunkStartSeconds,
        endTime: chunkStartSeconds, // Will be updated when chunk completes
        originalFileSize: originalSize,
        fileType: chunkBlob.type || 'audio/webm'
      };
      
      setChunkSaveStatuses(prev => [...prev, newChunkStatus]);
      
      // Calculate chunk end time based on when recording STOPPED for this chunk.
      // First chunk (chunkId 0) is 30s, subsequent chunks are 90s
      const chunkDurationSeconds = (chunkId === 0) ? 30 : 90;
      const endTime = new Date(startTime.getTime() + (chunkDurationSeconds * 1000));
      
      // Client-side trimming and transcoding removed — audio is uploaded in native
      // browser format (WebM/Opus or M4A/AAC). Server-side preprocessing via
      // transcode-audio edge function handles resampling, highpass filter, and
      // loudness normalisation before forwarding to ASR providers.
      console.log(`📤 Chunk ${chunkId}: uploading native format (${chunkBlob.type}), ${(chunkBlob.size / 1024).toFixed(1)}KB`);
      
      // Add timeout for the transcription request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.log(`⏰ Chunk ${chunkId} transcription timed out after 30 seconds`);
        addDebugLog(`⏰ Chunk ${chunkId}: timeout`);
        
        // Update status to failed
        setChunkSaveStatuses(prev => prev.map(chunk => 
          chunk.id === uniqueChunkId 
            ? { ...chunk, saveStatus: 'failed' as const }
            : chunk
        ));
      }, 30000); // 30 second timeout

      try {
        // Send to transcription service with timeout
        const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/functions/v1/speech-to-text', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            audio: await convertBlobToBase64(chunkBlob)
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Transcription failed for chunk ${chunkId}:`, response.status, errorText);
          
          // Update status to failed
          setChunkSaveStatuses(prev => prev.map(chunk => 
            chunk.id === uniqueChunkId 
              ? { ...chunk, saveStatus: 'failed' as const, text: 'Transcription failed' }
              : chunk
          ));
          
          return;
        }

        const data = await response.json();

        // Track cumulative Whisper calls for cost monitoring
        const whisperCallCount = parseInt(sessionStorage.getItem('whisper_call_count') || '0') + 1;
        const whisperTotalDuration = parseFloat(sessionStorage.getItem('whisper_total_duration') || '0') + (data.duration || 0);
        const whisperEstCost = (whisperTotalDuration / 60) * 0.006;
        sessionStorage.setItem('whisper_call_count', String(whisperCallCount));
        sessionStorage.setItem('whisper_total_duration', String(whisperTotalDuration));
        console.log(`💰 WHISPER_MEETING_TRACKER: call #${whisperCallCount}, chunk_duration=${(data.duration || 0).toFixed(1)}s, cumulative_duration=${whisperTotalDuration.toFixed(1)}s, est_total_cost=$${whisperEstCost.toFixed(4)}`);

        // Process transcription result
        const transcriptionText = data.text || '';
        const confidence = data.confidence || 0;
        const segments = data.segments || [];
        
        console.log(`✅ Chunk ${chunkId} transcribed:`, {
          text: transcriptionText.substring(0, 50) + '...',
          confidence,
          duration: Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
        });

        // Update chunk status with transcription data and end time
        const recordingStart = recordingStartTimeRef.current;
        
        if (!recordingStart) {
          console.error('❌ CRITICAL: Recording start time not set when updating chunk end time!', {
            chunkId,
            endTime: endTime.toISOString()
          });
        }
        
        // FIXED: Calculate end time using wall clock only, since endTime is now correctly
        // calculated as startTime + chunkDuration (not processing time)
        const wallClockEndSeconds = recordingStart 
          ? (endTime.getTime() - recordingStart.getTime()) / 1000 
          : 0;
        const chunkEndSeconds = Math.max(0, wallClockEndSeconds);
        
        // Store this chunk's end time for the next chunk to use as its start time
        lastChunkEndTime.current = chunkEndSeconds;
          
        console.log(`⏱️ Chunk ${chunkId} END timing:`, {
          chunkStartSeconds: chunkStartSeconds,
          chunkEndSeconds: chunkEndSeconds,
          duration: chunkEndSeconds - chunkStartSeconds,
          recordingStartSet: !!recordingStart,
          recordingStart: recordingStart?.toISOString(),
          chunkEnd: endTime.toISOString(),
          timingMode: 'wallclock-fixed',
          savedForNextChunk: lastChunkEndTime.current
        });
        
        setChunkSaveStatuses(prev => prev.map(chunk => 
          chunk.id === uniqueChunkId 
            ? { 
                ...chunk, 
                text: transcriptionText, 
                chunkLength: transcriptionText.length,
                confidence: confidence,
                endTime: chunkEndSeconds
              }
            : chunk
        ));

        // Add to transcript with timestamp and overlap handling
        if (transcriptionText.trim() && transcriptionText.length > 3) {
          addDebugLog(`📝 Chunk ${chunkId}: "${transcriptionText.substring(0, 30)}..." (${Math.round(confidence * 100)}%)`);
          
          const chunkTimestamp = new Date(startTime.getTime()).toLocaleTimeString();
          setChunkCounter(prev => prev + 1);

          // Save raw chunk to database with proper error handling
          if (meetingId) {
            console.log('🔍 Saving raw chunk to database...');
            
            try {
              const { error } = await supabase
                .from('raw_transcript_chunks')
                .insert({
                  meeting_id: meetingId,
                  chunk_id: currentChunkNumber,
                  text: transcriptionText,
                  timestamp: chunkTimestamp,
                  confidence: confidence
                });

              if (error) {
                console.error('❌ Error saving raw chunk:', error.message, error.details, error.hint, error.code);
                console.error('❌ Full error object:', JSON.stringify(error, null, 2));
                
                // Update status to failed and increment retry count
                setChunkSaveStatuses(prev => prev.map(chunk => 
                  chunk.id === uniqueChunkId 
                    ? { 
                        ...chunk, 
                        saveStatus: 'failed' as const,
                        retryCount: chunk.retryCount + 1
                      }
                    : chunk
                ));

                // Attempt retry if under limit
                if (newChunkStatus.retryCount < 3) {
                  setTimeout(async () => {
                    setChunkSaveStatuses(prev => prev.map(chunk => 
                      chunk.id === uniqueChunkId 
                        ? { ...chunk, saveStatus: 'retrying' as const }
                        : chunk
                    ));
                    
                    try {
                      const { error: retryError } = await supabase
                        .from('raw_transcript_chunks')
                        .insert({
                          meeting_id: meetingId,
                          chunk_id: currentChunkNumber,
                          text: transcriptionText,
                          timestamp: chunkTimestamp,
                          confidence: confidence
                        });

                      if (retryError) {
                        setChunkSaveStatuses(prev => prev.map(chunk => 
                          chunk.id === uniqueChunkId 
                            ? { 
                                ...chunk, 
                                saveStatus: 'failed' as const,
                                retryCount: chunk.retryCount + 1
                              }
                            : chunk
                        ));
                      } else {
                        setChunkSaveStatuses(prev => prev.map(chunk => 
                          chunk.id === uniqueChunkId 
                            ? { 
                                ...chunk, 
                                saveStatus: 'saved' as const,
                                saveTimestamp: new Date().toISOString()
                              }
                            : chunk
                        ));
                        console.log('🔍 Raw chunk saved successfully on retry');
                      }
                    } catch (retryError) {
                      console.error('Retry failed:', retryError);
                      setChunkSaveStatuses(prev => prev.map(chunk => 
                        chunk.id === uniqueChunkId 
                          ? { ...chunk, saveStatus: 'failed' as const }
                          : chunk
                      ));
                    }
                  }, 2000 * newChunkStatus.retryCount); // Exponential backoff
                }
              } else {
                console.log('🔍 Raw chunk saved successfully');
                
                // Calculate file sizes for UI display
                const transcodedSize = chunkBlob.size;
                
                // Update status to saved with timestamp and file sizes
                setChunkSaveStatuses(prev => prev.map(chunk => 
                  chunk.id === uniqueChunkId 
                    ? { 
                        ...chunk, 
                        saveStatus: 'saved' as const,
                        saveTimestamp: new Date().toISOString(),
                        originalFileSize: originalSize,
                        transcodedFileSize: transcodedSize,
                        fileType: chunkBlob.type || 'audio/webm'
                      }
                    : chunk
                ));
                
                // Save audio chunk metadata with file sizes for analytics
                const compressionRatio = originalSize > 0 ? parseFloat((1 - transcodedSize / originalSize).toFixed(2)) : 0;
                
                const { error: audioChunkError } = await supabase
                  .from('audio_chunks')
                  .insert({
                    meeting_id: meetingId,
                    chunk_number: currentChunkNumber,
                    start_time: startTime.toISOString(),
                    end_time: endTime.toISOString(),
                    processing_status: 'completed',
                    chunk_duration_ms: (chunkId === 0) ? 30000 : 90000,
                    file_size: transcodedSize,
                    original_file_size: originalSize,
                    transcoded_file_size: transcodedSize,
                    compression_ratio: compressionRatio
                  });
                
                if (audioChunkError) {
                  console.warn('⚠️ Failed to save audio chunk metadata:', audioChunkError.message);
                } else {
                  console.log(`📊 Chunk ${currentChunkNumber} metadata saved: ${(originalSize/1024).toFixed(1)}KB → ${(transcodedSize/1024).toFixed(1)}KB (${(compressionRatio*100).toFixed(0)}% reduction)`);
                }
              }
            } catch (saveError) {
              console.error('Database save error:', saveError);
              setChunkSaveStatuses(prev => prev.map(chunk => 
                chunk.id === uniqueChunkId 
                  ? { ...chunk, saveStatus: 'failed' as const }
                  : chunk
              ));
            }
          }

          // Update the main transcript with simple append (NO deduplication during recording)
          setTranscript(prev => {
            const newTranscript = prev.trim() + (prev.trim() ? ' ' : '') + transcriptionText.trim();
            console.log(`✅ Chunk ${chunkId} appended to transcript (+${transcriptionText.length} chars)`);
            onTranscriptUpdate(newTranscript);
            return newTranscript;
          });

          // Assembly AI backup transcription is handled by real-time client

          // Word count is now calculated from chunks via useEffect

          // Create transcript data for live display
          const transcriptData: TranscriptData = {
            text: transcriptionText,
            speaker: `Speaker ${speakerCount + 1}`,
            confidence: confidence,
            timestamp: new Date().toISOString(),
            isFinal: true
          };

          // Update realtime transcripts with forced re-render
          setRealtimeTranscripts(prev => {
            const updated = [...prev.slice(-19), transcriptData]; // Keep last 20
            console.log(`🔄 Real-time transcripts updated: ${updated.length} items`);
            return updated;
          });

          // Show user feedback for EVERY chunk to ensure visibility
          showToast.success(`New transcription`, { section: 'meeting_manager',
            description: `"${transcriptionText.substring(0, 50)}${transcriptionText.length > 50 ? '...' : ''}"`,
            duration: 2000
          });
          
          // Notify watchdog that a chunk was successfully processed
          watchdog.reportChunkProcessed();
          
          console.log(`✅ Chunk ${chunkId} processed and UI updated successfully`);
        } else {
          console.log(`⏭️ Chunk ${chunkId} was silent or unclear`);
          addDebugLog(`⏭️ Chunk ${chunkId}: silent/unclear`);
          // Not a technical stall; reset stall timer without incrementing chunk count
          watchdog.reportChunkFiltered();
        }

      } catch (transcriptionError) {
        clearTimeout(timeoutId);
        if (transcriptionError.name === 'AbortError') {
          console.log(`⏰ Chunk ${chunkId} transcription was aborted due to timeout`);
          addDebugLog(`⏰ Chunk ${chunkId}: aborted`);
        } else {
          console.error(`❌ Transcription error for chunk ${chunkId}:`, transcriptionError);
          addDebugLog(`❌ Chunk ${chunkId}: ${transcriptionError.message}`);
        }
      }

      // Clean up chunk data
      chunkData.current.delete(chunkId);
      chunkStartTimes.current.delete(chunkId);

    } catch (error) {
      console.error(`💥 Error processing chunk ${chunkId}:`, error);
      addDebugLog(`💥 Chunk ${chunkId}: processing error`);
    }
  };

  // Helper function to convert blob to base64
  const convertBlobToBase64 = async (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const stopOverlappingChunks = async () => {
    try {
      console.log('🛑 Stopping overlapping chunk recording...');
      
      // Clear the main interval
      if (segmentIntervalRef.current) {
        clearInterval(segmentIntervalRef.current);
        segmentIntervalRef.current = null;
      }

      // Stop all active recorders
      for (const [chunkId, recorder] of chunkRecorders.current.entries()) {
        if (recorder && recorder.state === 'recording') {
          recorder.stop();
        }
      }

      // Clear all timeouts
      for (const [chunkId, timeout] of chunkIntervals.current.entries()) {
        clearTimeout(timeout);
      }

      // Clean up maps
      chunkRecorders.current.clear();
      chunkIntervals.current.clear();
      
      console.log('✅ Overlapping chunk recording stopped');
      
    } catch (error) {
      console.error('❌ Failed to stop overlapping chunk recording:', error);
    }
  };

  // Audio segment recording functions (legacy - keeping for compatibility)
  const startAudioSegmentRecording = async (meetingId: string) => {
    try {
      console.log('🎵 Starting audio segment recording...');
      
      // Get microphone stream for segment recording using Profile 1 settings
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      audioSegmentChunks.current = [];
      audioSegmentRecorder.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      audioSegmentRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioSegmentChunks.current.push(event.data);
        }
      };

      audioSegmentRecorder.current.start(1000); // Collect data every second
      segmentStartTime.current = new Date();
      currentSegmentNumber.current = 1;
      
      // Set up 10-minute interval to save segments
      segmentIntervalRef.current = setInterval(() => {
        saveCurrentSegment(meetingId);
      }, 10 * 60 * 1000); // 10 minutes

      console.log('✅ Audio segment recording started');
      
    } catch (error) {
      console.error('❌ Failed to start audio segment recording:', error);
    }
  };

  const saveCurrentSegment = async (meetingId: string) => {
    try {
      if (!audioSegmentRecorder.current || audioSegmentChunks.current.length === 0) {
        return;
      }

      console.log(`🎵 Saving audio segment ${currentSegmentNumber.current}...`);
      
      // Create blob from current chunks
      const segmentBlob = new Blob(audioSegmentChunks.current, { type: 'audio/webm' });
      const segmentEndTime = new Date();
      
      // Upload segment to storage
      const fileName = `${user?.id}/${meetingId}_segment_${currentSegmentNumber.current}.webm`;
      
      const { data: storageData, error: storageError } = await supabase.storage
        .from('meeting-audio-segments')
        .upload(fileName, segmentBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (storageError) {
        throw storageError;
      }

      // Save segment metadata to database
      const { error: dbError } = await supabase
        .from('meeting_audio_segments' as any)
        .insert({
          meeting_id: meetingId,
          segment_number: currentSegmentNumber.current,
          start_time: segmentStartTime.current.toISOString(),
          end_time: segmentEndTime.toISOString(),
          file_path: storageData.path,
          file_size: segmentBlob.size,
          duration_seconds: Math.floor((segmentEndTime.getTime() - segmentStartTime.current.getTime()) / 1000)
        } as any);

      if (dbError) {
        throw dbError;
      }

      console.log(`✅ Audio segment ${currentSegmentNumber.current} saved successfully`);
      
      // Reset for next segment
      audioSegmentChunks.current = [];
      currentSegmentNumber.current++;
      segmentStartTime.current = new Date();
      
    } catch (error) {
      console.error('❌ Failed to save audio segment:', error);
    }
  };

  const stopAudioSegmentRecording = async (meetingId: string) => {
    try {
      console.log('🛑 Stopping audio segment recording...');
      
      // Clear interval
      if (segmentIntervalRef.current) {
        clearInterval(segmentIntervalRef.current);
        segmentIntervalRef.current = null;
      }

      // Save final partial segment if there's any data
      if (audioSegmentChunks.current.length > 0) {
        await saveCurrentSegment(meetingId);
      }

      // Stop recorder
      if (audioSegmentRecorder.current && audioSegmentRecorder.current.state !== 'inactive') {
        audioSegmentRecorder.current.stop();
        audioSegmentRecorder.current.stream?.getTracks().forEach(track => track.stop());
      }

      audioSegmentRecorder.current = null;
      audioSegmentChunks.current = [];
      
      console.log('✅ Audio segment recording stopped');
      
    } catch (error) {
      console.error('❌ Failed to stop audio segment recording:', error);
    }
  };
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Browser compatibility check
  const checkBrowserSupport = () => {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    // Enhanced iOS detection: iPad Pro reports as "MacIntel" but has touch points
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const hasDisplayMedia = navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia;
    const hasUserMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
    
    return {
      isSupported: hasDisplayMedia && hasUserMedia && hasMediaRecorder,
      isRecommendedBrowser: isChrome || isEdge || isFirefox,
      browserName: isChrome ? 'Chrome' : isEdge ? 'Edge' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : 'Unknown',
      isSafari,
      isIOS,
      isMobile
    };
  };
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const browserTranscriberRef = useRef<BrowserSpeechTranscriber | null>(null);
  const iPhoneTranscriberRef = useRef<iPhoneWhisperTranscriber | null>(null);
  const simpleIOSTranscriberRef = useRef<SimpleIOSTranscriber | null>(null);
  const desktopTranscriberRef = useRef<DesktopWhisperTranscriber | null>(null);
  const [iosTranscriberStats, setIosTranscriberStats] = useState<IOSTranscriberStats | null>(null);
  const [browserSpeechPreviewText, setBrowserSpeechPreviewText] = useState('');
  const screenStreamRef = useRef<MediaStream | null>(null);
  const enhancedAudioCaptureRef = useRef<any>(null);
  const liveTranscriptRef = useRef<{ getCurrentTranscript: () => string } | null>(null);

  // Auto-save meeting data to localStorage
  const autoSaveMeeting = () => {
    if (isRecording && transcript && duration > 5) {
      const meetingData = {
        title: meetingSettings.title || 'General Meeting',
        duration: formatDuration(duration),
        wordCount: wordCount,
        transcript: transcript,
        speakerCount: speakerCount,
        startTime: startTime,
        startedBy: user?.email || 'Unknown User',
        timestamp: Date.now()
      };
      safeSetItem('unsaved_meeting', JSON.stringify(meetingData));
      console.log('Auto-saved meeting data to localStorage');
    }
  };

  // Check for unsaved meeting on component mount
  useEffect(() => {
    const checkUnsavedMeeting = () => {
      const unsavedMeeting = localStorage.getItem('unsaved_meeting');
      if (unsavedMeeting) {
        const meetingData = JSON.parse(unsavedMeeting);
        const age = Date.now() - meetingData.timestamp;
        
        // If unsaved meeting is less than 1 hour old, offer recovery
        if (age < 3600000) {
          const shouldRecover = window.confirm(
            `Found an unsaved meeting recording from ${new Date(meetingData.timestamp).toLocaleString()}. Would you like to recover it?`
          );
          
          if (shouldRecover) {
            navigate('/meeting-summary', { state: meetingData });
            localStorage.removeItem('unsaved_meeting');
          } else {
            localStorage.removeItem('unsaved_meeting');
          }
        } else {
          // Remove old unsaved meetings
          localStorage.removeItem('unsaved_meeting');
        }
      }
    };

    checkUnsavedMeeting();
  }, [navigate]);

  // Wake lock management for recording
  const wakeLockRef = useRef<any>(null);
  
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('🔒 Wake lock activated to prevent device sleep during recording');
      }
    } catch (error) {
      console.warn('⚠️ Wake lock not supported or failed:', error);
    }
  };

  const releaseWakeLock = () => {
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('🔓 Wake lock released');
      }
    } catch (error) {
      console.warn('⚠️ Error releasing wake lock:', error);
    }
  };

  // Handle visibility changes to maintain wake lock and check transcription health during recording
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRecording) {
        requestWakeLock();
        
        // Check if transcription may have stalled while tab was in background
        const possibleStall = watchdog.checkOnVisibilityRestore();
        if (possibleStall) {
          console.warn('🐕 Tab restored - checking transcription health after background period');
          // The watchdog will show appropriate warnings via its internal state
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRecording, watchdog]);

  // Auto-save every 15 seconds for drafts, 30 seconds while recording
  useEffect(() => {
    if (isRecording) {
      autoSaveRef.current = setInterval(autoSaveMeeting, 30000);
      requestWakeLock();
    } else {
      // Auto-save drafts every 15 seconds when not recording
      autoSaveRef.current = setInterval(() => {
        try {
          const draft = transcript;
          if (draft?.length > 50) {
            safeSetItem('meetingTranscriptDraft', draft);
            safeSetItem('meetingDraftTimestamp', Date.now().toString());
          }
        } catch (error) {
          console.warn('Draft save failed:', error);
        }
      }, 15000);
    }

    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
      }
      if (!isRecording) {
        releaseWakeLock();
      }
    };
  }, [isRecording, transcript, duration, wordCount, speakerCount, startTime, meetingSettings.title]);

  // Clean unload handler - stop recording without prompts
  useEffect(() => {
    const handleUnload = () => {
      try {
        // Stop the recorder fast
        if (browserTranscriberRef.current) {
          browserTranscriberRef.current.stopTranscription();
        }
        if (iPhoneTranscriberRef.current) {
          iPhoneTranscriberRef.current.stopTranscription();
        }
        if (simpleIOSTranscriberRef.current) {
          simpleIOSTranscriberRef.current.stop();
        }
        if (desktopTranscriberRef.current) {
          desktopTranscriberRef.current.stopTranscription();
        }
        
        // Send last buffered text to server (best-effort)
        const currentSessionId = sessionStorage.getItem('currentSessionId');
        if (transcript && currentSessionId) {
          navigator.sendBeacon(
            '/api/transcripts/flush',
            new Blob([JSON.stringify({ 
              sessionId: currentSessionId, 
              transcript: transcript,
              timestamp: new Date().toISOString()
            })], { type: 'application/json' })
          );
        }
        
        releaseWakeLock();
      } catch (error) {
        console.warn('Unload cleanup failed:', error);
      }
    };

    window.addEventListener('unload', handleUnload);
    return () => window.removeEventListener('unload', handleUnload);
  }, [transcript]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Merge unmerged chunks into the main transcript
  const handleMergeUnmergedChunks = () => {
    if (!transcriptHandler.current) {
      console.warn('❌ Transcript handler not initialized');
      showToast.error('Cannot merge chunks - transcript handler not ready', { section: 'meeting_manager' });
      return;
    }

    // Helper function to check if chunk is in transcript (same logic as ChunkSaveStatus)
    const isChunkInTranscript = (chunkText: string): boolean => {
      if (!chunkText || !transcript) return false;
      
      const normalise = (s: string) => s
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      const tNorm = normalise(transcript);
      const words = chunkText.trim().split(/\s+/);
      const coreText = words.length > 1 ? words.slice(0, -1).join(' ') : words.join(' ');
      const cNorm = normalise(coreText);
      if (!cNorm) return false;

      if (tNorm.includes(cNorm)) return true;
      
      if (words.length >= 5) {
        for (let i = 0; i <= words.length - 5; i++) {
          const gram = normalise(words.slice(i, i + 5).join(' '));
          if (gram && tNorm.includes(gram)) return true;
        }
      }

      const cTokens = cNorm.split(' ').filter(w => w.length >= 3);
      if (cTokens.length === 0) return false;
      const matched = cTokens.filter(w => tNorm.includes(w)).length;
      return (matched / cTokens.length) >= 0.7;
    };
    // Find chunks that are not merged
    const unmergedChunks = chunkSaveStatuses.filter(chunk => 
      chunk.text && 
      chunk.text.trim().length > 0 && 
      !isChunkInTranscript(chunk.text)
    );

    if (unmergedChunks.length === 0) {
      showToast.info('All chunks are already merged into the transcript', { section: 'meeting_manager' });
      return;
    }

    console.log(`🔗 Merging ${unmergedChunks.length} unmerged chunks into transcript`);

    // Sort chunks by start time
    const sortedChunks = [...unmergedChunks].sort((a, b) => {
      const timeA = a.startTime ?? 0;
      const timeB = b.startTime ?? 0;
      return timeA - timeB;
    });

    // Add each unmerged chunk to the transcript handler
    let mergedCount = 0;
    sortedChunks.forEach(chunk => {
      const incrementalData: IncrementalTranscriptData = {
        text: chunk.text,
        is_final: true,
        confidence: chunk.confidence,
        timestamp: new Date().toISOString(),
        speaker: 'merged_chunk',
        segment_id: `merged_${chunk.id}`
      };

      if (transcriptHandler.current) {
        transcriptHandler.current.processTranscript(incrementalData);
        mergedCount++;
      }
    });

    if (mergedCount > 0) {
      showToast.success(`✅ Merged ${mergedCount} chunk${mergedCount !== 1 ? 's' : ''} into transcript`, { section: 'meeting_manager' });
      console.log(`✅ Successfully merged ${mergedCount} chunks`);
    }
  };

  // Initialize transcript handler
  useEffect(() => {
    transcriptHandler.current = new IncrementalTranscriptHandler(
      (fullTranscript: string) => {
        // Update main transcript state
        setTranscript(fullTranscript);
        onTranscriptUpdate(fullTranscript);
        latestCompleteTranscriptRef.current = fullTranscript;
        
        // Word count is calculated from chunks
        
        // Extract last phrase (max 6 words)
        const words = fullTranscript.split(' ').filter(word => word.length > 0);
        const lastSixWords = words.slice(-6).join(' ');
        setLastPhrase(lastSixWords);
        
        console.log('📝 Transcript updated:', fullTranscript.length, 'chars');
      },
      (interimText: string) => {
        // Handle interim updates for ticker
        if (interimText.trim() && tickerEnabled) {
          const truncatedText = interimText.length > 100 
            ? interimText.substring(0, 100) + "..." 
            : interimText;
          
          setTickerText(truncatedText);
          setShowTicker(true);
          
          // Auto-hide ticker after 3 seconds
          setTimeout(() => {
            setShowTicker(false);
          }, 3000);
        }
      }
    );
  }, [onTranscriptUpdate, onWordCountUpdate, tickerEnabled]);

  const handleTranscript = (transcriptData: TranscriptData) => {
    // Convert to incremental transcript format
    const incrementalData: IncrementalTranscriptData = {
      text: transcriptData.text,
      is_final: transcriptData.isFinal,
      confidence: transcriptData.confidence,
      timestamp: transcriptData.timestamp,
      speaker: transcriptData.speaker,
      segment_id: `${transcriptData.speaker}_${transcriptData.timestamp}_${Date.now()}`,
      // Pass timing data for accurate timestamp-based merging
      start_ms: transcriptData.start_ms,
      end_ms: transcriptData.end_ms,
    };

    // Process through incremental handler and capture merge result
    if (transcriptHandler.current) {
      const result = transcriptHandler.current.processTranscript(incrementalData);
      
      // Update chunk status with merge result if this was a final chunk
      if (transcriptData.isFinal && transcriptData.chunkNumber !== undefined) {
        setChunkSaveStatuses(prevStatuses => 
          prevStatuses.map(status => 
            status.chunkNumber === transcriptData.chunkNumber
              ? { 
                  ...status, 
                  wasMerged: result.wasProcessed,
                  mergeRejectionReason: result.reason 
                }
              : status
          )
        );
        console.log(`📊 Chunk #${transcriptData.chunkNumber} merge result: wasProcessed=${result.wasProcessed}, reason=${result.reason || 'none'}`);
      }
    }

    // Progressive pre-summaries: ingest transcript chunks for long sessions
    if (transcriptData.isFinal) {
      const shouldIngest = duration >= 1200 || wordCount >= 4000; // 20 min or ~4000 words
      const text = (transcriptData.text || '').trim();
      if (shouldIngest && text.length >= 120) {
        const key = text.toLowerCase().slice(0, 160);
        if (!ingestedKeysRef.current.has(key)) {
          ingestedKeysRef.current.add(key);

          let sessionId = sessionStorage.getItem('currentSessionId') || '';
          if (!sessionId && desktopTranscriberRef.current) {
            try {
              sessionId = desktopTranscriberRef.current.getSessionId();
            } catch {}
          }
          const meetingId = sessionId || null; // Use session as temp meeting link

          if (sessionId) {
            void supabase.functions.invoke('ingest-transcript-chunk', {
              body: {
                sessionId,
                meetingId,
                text,
                detailLevel: 'standard',
              }
            }).then(({ data, error }) => {
              if (error) {
                console.warn('ingest-transcript-chunk error:', error);
              } else {
                console.log('✅ Ingested summary chunk', data?.chunkIndex);
              }
            }).catch((e) => console.warn('ingest-transcript-chunk failed:', e));
          }
        }
      }
    }

    // Update transcripts array for display
    setRealtimeTranscripts(prev => {
      // Only keep recent transcripts for display (last 50 segments)
      const maxSegments = 50;
      const filtered = prev.filter(t => 
        !(t.speaker === transcriptData.speaker && !t.isFinal)
      );
      
      const newTranscripts = [...filtered, transcriptData];
      
      // Keep only the most recent segments
      const trimmed = newTranscripts.slice(-maxSegments);
      
      // Calculate speaker count
      const speakers = new Set(trimmed.map(t => t.speaker));
      setSpeakerCount(speakers.size);
      
      console.log('🔍 Adding transcript:', transcriptData.isFinal ? 'FINAL' : 'interim', `(${transcriptData.text.length} chars)`);
      
      return trimmed;
    });
  };
  const handleBrowserTranscript = (data: BrowserTranscriptData) => {
    // Skip empty transcripts
    if (!data.text || !data.text.trim()) return;
    
    // Generation guard: skip if a stop has occurred since this callback was created
    const capturedGeneration = recordingGenerationRef.current;
    if (!isRecordingRef.current) {
      console.log(`🛑 handleBrowserTranscript: recording stopped (generation ${capturedGeneration}), skipping`);
      return;
    }
    
    const trimmedText = data.text.trim();
    
    // --- Deduplication gate ---
    // Normalise text for comparison: lowercase, strip punctuation, collapse whitespace
    const normalise = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    const normNew = normalise(trimmedText);
    const newTokens = normNew.split(' ').filter(w => w.length >= 3);
    
    // Check recent chunks (last 10) for near-duplicate text (Jaccard >= 0.80)
    const isDuplicate = (() => {
      if (newTokens.length < 3) return false; // Too short to compare meaningfully
      const recentChunks = chunkSaveStatuses.slice(-10);
      for (const existing of recentChunks) {
        if (!existing.text || existing.text.trim().length === 0) continue;
        const normExisting = normalise(existing.text);
        const existingTokens = normExisting.split(' ').filter(w => w.length >= 3);
        if (existingTokens.length < 3) continue;
        
        // Jaccard similarity on significant words
        const setA = new Set(newTokens);
        const setB = new Set(existingTokens);
        let intersection = 0;
        for (const w of setA) { if (setB.has(w)) intersection++; }
        const union = new Set([...setA, ...setB]).size;
        const jaccard = union > 0 ? intersection / union : 0;
        
        if (jaccard >= 0.80) {
          console.log(`🚫 Duplicate chunk blocked (Jaccard ${(jaccard * 100).toFixed(0)}% with chunk #${existing.chunkNumber}): "${trimmedText.substring(0, 50)}..."`);
          return true;
        }
      }
      return false;
    })();
    
    if (isDuplicate) return;

    // Accumulate for live preview Browser Speech panel
    setBrowserSpeechPreviewText(prev => prev + (prev ? ' ' : '') + trimmedText);

    // Add chunk status tracking for iPhone/mobile transcription with timestamps
    // CRITICAL: Use synchronous ref for correct chunk numbering (setState is async)
    chunkCounterRef.current += 1;
    const currentChunkNumber = chunkCounterRef.current;
    setChunkCounter(currentChunkNumber); // Update state for UI display
    
    console.log(`📊 Chunk counter: ${currentChunkNumber} (ref: ${chunkCounterRef.current})`);
    
    const chunkLength = trimmedText.length;
    const uniqueChunkId = `chunk_${Date.now()}_${currentChunkNumber}`;
    const approxNowSeconds = recordingStartMonotonicRef.current != null
      ? (performance.now() - recordingStartMonotonicRef.current) / 1000
      : duration;
    const chunkStartSeconds = approxNowSeconds;
    
    const newChunkStatus: ChunkSaveStatus = {
      id: uniqueChunkId,
      chunkNumber: currentChunkNumber,
      text: trimmedText,
      chunkLength: chunkLength,
      saveStatus: 'saving',
      retryCount: 0,
      confidence: data.confidence || 0.9,
      startTime: lastChunkEndTime.current || Math.max(0, chunkStartSeconds - 2), // Use previous end or approximate
      endTime: chunkStartSeconds, // End time is when chunk arrives
      originalFileSize: (data as any).audioSizeBytes || 0,
      fileType: (data as any).mimeType || 'audio/webm'
    };
    
    // Update last chunk end time for iPhone chunks
    lastChunkEndTime.current = chunkStartSeconds;
    
    setChunkSaveStatuses(prev => [...prev, newChunkStatus]);
    
    // CRITICAL FIX: Actually persist iOS chunks to database (was previously simulated)
    // This enables consolidation to work and meeting transcript to be saved
    const persistIOSChunk = async () => {
      // Generation guard: if a stop has occurred since this chunk was captured, skip
      if (capturedGeneration !== recordingGenerationRef.current) {
        console.log(`🛑 Stale iOS chunk (generation ${capturedGeneration} vs ${recordingGenerationRef.current}), skipping DB persist`);
        return;
      }
      
      const currentMeetingId = sessionStorage.getItem('currentMeetingId');
      const currentSessionId = sessionStorage.getItem('currentSessionId');
      
      if (!currentMeetingId) {
        console.warn('⚠️ iOS chunk: No meetingId yet — marking as FAILED (not faking saved)');
        // SAFETY NET: Queue this chunk text into sessionStorage so the stop sequence can recover it
        try {
          const existing = sessionStorage.getItem('orphanedIOSChunks') || '';
          sessionStorage.setItem('orphanedIOSChunks', (existing + ' ' + data.text.trim()).trim());
        } catch { /* ignore storage errors */ }
        // Honestly mark as failed so the UI doesn't lie
        setChunkSaveStatuses(prev => prev.map(chunk => 
          chunk.id === uniqueChunkId 
            ? { ...chunk, saveStatus: 'failed' as const }
            : chunk
        ));
        return;
      }
      
      try {
        console.log(`📱 iOS chunk #${currentChunkNumber}: Saving to meeting_transcription_chunks...`);
        
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) {
          console.error('📱 iOS chunk: No authenticated user');
          return;
        }
        
        const { error } = await supabase
          .from('meeting_transcription_chunks')
          .insert({
            meeting_id: currentMeetingId,
            user_id: currentUser.id,
            chunk_number: currentChunkNumber,
            transcription_text: data.text.trim(),
            confidence: data.confidence || 0.9,
            is_final: true,
            transcriber_type: 'ios-simple',
            start_time: newChunkStatus.startTime || 0,
            end_time: newChunkStatus.endTime || approxNowSeconds,
            session_id: currentSessionId || currentMeetingId
          });
        
        if (error) {
          console.error(`📱 iOS chunk #${currentChunkNumber}: DB save failed:`, error.message);
          setChunkSaveStatuses(prev => prev.map(chunk => 
            chunk.id === uniqueChunkId 
              ? { ...chunk, saveStatus: 'failed' as const }
              : chunk
          ));
        } else {
          console.log(`📱 iOS chunk #${currentChunkNumber}: Saved successfully`);
          setChunkSaveStatuses(prev => prev.map(chunk => 
            chunk.id === uniqueChunkId 
              ? { ...chunk, saveStatus: 'saved' as const, saveTimestamp: new Date().toISOString() }
              : chunk
          ));
        }
      } catch (err) {
        console.error(`📱 iOS chunk #${currentChunkNumber}: DB save exception:`, err);
        setChunkSaveStatuses(prev => prev.map(chunk => 
          chunk.id === uniqueChunkId 
            ? { ...chunk, saveStatus: 'failed' as const }
            : chunk
        ));
      }
    };
    
    // Only persist via this path for iOS chunks
    // Desktop chunks are persisted by DesktopWhisperTranscriber internally
    if ((data as any).source === 'ios-simple') {
      persistIOSChunk();
    }
    
    // CRITICAL FIX: Force isFinal=true for iOS chunks so they're merged correctly
    // Calculate monotonic timestamps in milliseconds for accurate merge timing
    const startMs = Math.round((newChunkStatus.startTime || 0) * 1000);
    const endMs = Math.round((newChunkStatus.endTime || approxNowSeconds) * 1000);
    
    const transcriptData: TranscriptData = {
      text: data.text.trim(),
      speaker: data.speaker || 'Speaker',
      confidence: data.confidence || 0.9,
      timestamp: new Date().toISOString(),
      isFinal: true, // CRITICAL FIX: Always true for iOS chunks so they're merged
      chunkNumber: currentChunkNumber,
      chunkLength: chunkLength,
      dbSaveStatus: 'saving',
      start_ms: startMs,
      end_ms: endMs,
    };
    
    
    setTestTranscripts(prev => [...prev.slice(-9), data.text]);
    
    // Notify watchdog that a chunk was successfully processed
    watchdog.reportChunkProcessed();
    
    handleTranscript(transcriptData);
  };

  const handleTranscriptionError = (error: string) => {
    console.error("Transcription Error:", error);
    setConnectionStatus("Error");
    addDebugLog(`❌ Error: ${error}`);
  };


  const handleStatusChange = (status: string) => {
    // Use a more robust approach to avoid state updates during render
    queueMicrotask(() => {
      setConnectionStatus(status);
      addDebugLog(`🔄 Status: ${status}`);
      
      // Surface Android interruption/recovery events as toast notifications
      const lowerStatus = status.toLowerCase();
      if (lowerStatus.includes('call detected') || lowerStatus.includes('microphone interrupted')) {
        showToast.warning(status, { section: 'meeting_manager' });
      } else if (lowerStatus.includes('microphone recovered') || lowerStatus.includes('recovered after interruption')) {
        showToast.success(status, { section: 'meeting_manager' });
      } else if (lowerStatus.includes('microphone lost') || lowerStatus.includes('tap to retry')) {
        showToast.error(status, { section: 'meeting_manager' });
      }
    });
  };

  const handleLiveSummary = (summary: string) => {
    setLiveSummary(summary);
    addDebugLog(`📄 Summary generated (${summary.length} chars)`);
    showToast.success("Live summary updated!", { section: 'meeting_manager' });
  };


  const processAudioChunk = async (audioBlob: Blob) => {
    if (audioBlob.size === 0) return;
    
    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to base64 in chunks to prevent memory issues
      let binary = '';
      const chunkSize = 0x8000; // 32KB chunks
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Audio = btoa(binary);

      // Send to speech-to-text edge function with optimized settings
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio }
      });

      if (error) {
        console.error('Transcription error:', error);
        return;
      }

      if (data?.text && data.text.trim() && !data.filtered) {
        const transcriptData: TranscriptData = {
          text: data.text.trim(),
          speaker: `Speaker ${speakerCount + 1}`,
          confidence: data.confidence || 0.8,
          timestamp: new Date().toISOString(),
          isFinal: true
        };
        
        handleTranscript(transcriptData);
      }
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  };

  // Whisper transcription (original logic)
  const startWhisperTranscription = async (meetingId: string) => {
    const browserSupport = checkBrowserSupport();
    
    if (browserSupport.isIOS) {
      console.log('📱 iOS detected - using SimpleIOSTranscriber exclusively');
      // Ensure desktop transcriber is not running (defensive cleanup)
      if (desktopTranscriberRef.current) {
        console.warn('⚠️ Stopping orphaned desktop transcriber');
        desktopTranscriberRef.current.stopTranscription();
        desktopTranscriberRef.current = null;
      }
      await startIPhoneWhisperTranscription(meetingId);
    } else {
      console.log('🖥️ Desktop detected - using DesktopWhisperTranscriber');
      // Ensure iOS transcriber is not running (defensive cleanup)
      if (simpleIOSTranscriberRef.current) {
        console.warn('⚠️ Stopping orphaned iOS transcriber');
        simpleIOSTranscriberRef.current.stop();
        simpleIOSTranscriberRef.current = null;
      }
      await startDesktopWhisperTranscription(meetingId);
    }
  };

  // iPhone-optimized transcription using Simple iOS Transcriber
  const startIPhoneWhisperTranscription = async (meetingId: string) => {
    try {
      console.log('📱 Creating Simple iOS transcriber instance...');
      addDebugLog('📱 Starting Simple iOS transcription (serial queue)...');
      
      simpleIOSTranscriberRef.current = new SimpleIOSTranscriber(
        {
          onTranscription: (text: string, isFinal: boolean, confidence: number) => {
            if (!text || !text.trim()) return;
            
            // Use handleBrowserTranscript as single source of truth
            // It already handles: chunkSaveStatuses, watchdog.reportChunkProcessed(), audio activity
            const transcriptData = {
              text: text.trim(),
              speaker: 'Speaker',
              confidence,
              timestamp: new Date().toISOString(),
              isFinal,
              is_final: isFinal,
              source: 'ios-simple' as const
            };
            handleBrowserTranscript(transcriptData);
          },
          onError: (error: string) => {
            console.error('📱 SimpleIOS error:', error);
            handleTranscriptionError(error);
          },
          onStatusChange: (status: string) => {
            console.log('📱 SimpleIOS status:', status);
            handleStatusChange(status);
          },
          onStatsUpdate: (stats: IOSTranscriberStats) => {
            setIosTranscriberStats(stats);
            // Keep watchdog happy when we're receiving blobs
            if (stats.capturedBlobs > 0) {
              setAudioActivity(true);
            }
          }
        },
        meetingId,
        selectedMicrophoneId
      );

      console.log('📱 Starting Simple iOS transcription...');
      await simpleIOSTranscriberRef.current.start();
      console.log('✅ Simple iOS transcription started successfully');
      addDebugLog('✅ Simple iOS transcription started (serial queue mode)');
      
      // AUDIO HEALTH GATE: Check after 10s that track and recorder are alive
      // Note: iOS rotation strategy means capturedBlobs will be 0 at 10s (first blob arrives at ~90s rotation)
      setTimeout(() => {
        const stats = simpleIOSTranscriberRef.current?.getStats?.();
        if (simpleIOSTranscriberRef.current && stats && stats.isRecording &&
            (stats.trackState !== 'live' || stats.recorderState !== 'recording')) {
          console.error(`🚨 iOS AUDIO HEALTH CHECK FAILED: track=${stats.trackState}, recorder=${stats.recorderState}`);
          addDebugLog(`🚨 Audio health check failed — track: ${stats.trackState}, recorder: ${stats.recorderState}`);
          showToast.error('No audio detected — please check microphone permissions and try again', {
            section: 'meeting_manager', duration: 10000
          });
        }
      }, 10000);
    } catch (error) {
      console.error('❌ Simple iOS transcription error:', error);
      addDebugLog(`❌ Failed to start iOS transcription: ${error}`);
      throw error;
    }
  };

  // Desktop Whisper transcription for better accuracy
  const startDesktopWhisperTranscription = async (meetingId: string, externalStream?: MediaStream | null) => {
    addDebugLog('🖥️ Starting Desktop Whisper transcription...');
    if (externalStream) {
      console.log('🔊 Using external mixed stream for Whisper (mic + system audio unified)');
    }
    
    const transcriber = new DesktopWhisperTranscriber(
      handleBrowserTranscript,
      handleTranscriptionError,
      handleStatusChange,
      meetingSettings, // Pass meeting settings for confidence gating
      meetingId,
      (hasActivity: boolean) => setAudioActivity(hasActivity), // Callback for audio activity
      (metadata: any) => {
        watchdog.reportChunkProcessed();
        if (metadata?.audioSizeBytes) {
          setChunkSaveStatuses(prev => {
            const updated = [...prev];
            for (let i = updated.length - 1; i >= 0; i--) {
              if (!updated[i].originalFileSize) {
                updated[i] = { ...updated[i], originalFileSize: metadata.audioSizeBytes, fileType: metadata.mimeType || 'audio/webm' };
                break;
              }
            }
            return updated;
          });
        }
      },
      () => watchdog.reportChunkFiltered(), // Callback when chunk is filtered (not stalled, just low quality)
      selectedMicrophoneId, // Pass selected microphone device
      externalStream || null // Pass external stream for unified mic+system audio
    );

    // Connect silence auto-stop callback (90 min inactivity protection)
    transcriber.onSilenceAutoStop = () => {
      console.warn('⚠️ 90 minutes of inactivity detected - auto-stopping recording');
      showToast.warning('Recording stopped due to 90 minutes of inactivity', { 
        section: 'meeting_manager',
        duration: 10000 
      });
      stopRecording();
    };

    await transcriber.startTranscription();
    desktopTranscriberRef.current = transcriber;
    
    addDebugLog('✅ Microphone speech recognition started successfully');
    console.log('Recording started with microphone speech recognition');
  };

  // Smart transcription method that chooses the best option for the device
  const startMicrophoneTranscription = async (meetingId: string) => {
    // Check user's transcription service preference
    const selectedService = meetingSettings.transcriberService || 'whisper';
    
    console.log(`🎙️ Starting transcription with service: ${selectedService}`);
    addDebugLog(`🎙️ Starting transcription with service: ${selectedService}`);
    
    // Use Whisper as primary service
    await startWhisperTranscription(meetingId);
  };

  // Hot-swap audio source during active recording
  const switchAudioSourceLive = async (newMode: QuickAudioSourceMode): Promise<void> => {
    if (!isRecording || !isRecordingRef.current) {
      console.log('⚠️ Cannot switch audio source - not recording');
      return;
    }

    const currentMeetingId = sessionStorage.getItem('currentMeetingId');
    if (!currentMeetingId) {
      console.error('❌ Cannot switch audio source - no meeting ID');
      showToast.error('Cannot switch audio source', { section: 'meeting_manager' });
      return;
    }

    console.log(`🔄 Switching audio source from ${audioSourceMode} to ${newMode}`);
    setIsSwitchingAudioSource(true);
    
    try {
      // Show user feedback
      showToast.info(`Switching to ${newMode === 'microphone' ? 'Microphone Only' : 'Mic + System Audio'}...`, { 
        section: 'meeting_manager',
        id: 'audio-switch',
        duration: 3000
      });

      // Step 1: Stop current transcription streams (but keep recording state active)
      console.log('🛑 Stopping current audio streams...');
      
      // Stop desktop transcriber
      if (desktopTranscriberRef.current) {
        await desktopTranscriberRef.current.stopTranscription();
        desktopTranscriberRef.current = null;
      }
      
      // Stop simple iOS transcriber
      if (simpleIOSTranscriberRef.current) {
        await simpleIOSTranscriberRef.current.stop();
        simpleIOSTranscriberRef.current = null;
      }
      
      // Stop browser transcriber
      if (browserTranscriberRef.current) {
        browserTranscriberRef.current.stopTranscription();
        browserTranscriberRef.current = null;
      }
      
      // Stop microphone stream
      if (micAudioStreamRef.current) {
        micAudioStreamRef.current.getTracks().forEach(track => track.stop());
        micAudioStreamRef.current = null;
      }
      
      // Stop screen stream
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }

      // Reset capture states
      setMicCaptured(false);
      setSystemAudioCaptured(false);

      // Step 2: Update mode state
      setAudioSourceMode(newMode);
      localStorage.setItem('meeting_recorder_audio_source', newMode);
      
      if (newMode === 'microphone') {
        setRecordingMode('mic-only');
      } else {
        setRecordingMode('mic-and-system');
      }

      // Small delay to let cleanup complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 3: Start new audio streams based on mode
      console.log(`🎤 Starting new audio streams for mode: ${newMode}`);
      
      if (newMode === 'microphone') {
        // Mic only mode
        setMicCaptured(true);
        await startMicrophoneTranscription(currentMeetingId);
      } else if (newMode === 'microphone_and_system') {
        // Mic + System mode - check if Chrome/Edge for parallel streams
        const isChromiumBased = /Chrome|Edg/.test(navigator.userAgent) && !/Firefox/.test(navigator.userAgent);
        
        if (isChromiumBased) {
          try {
            // Unified pipeline: single mixed stream for all engines
            const screenStream = await acquireScreenShareStream();
            
            // Clean up previous mixer if any
            cleanupAssemblyAudioStream(assemblyAudioMixerRef.current);
            assemblyAudioMixerRef.current = null;
            
            const mixerResult = await buildAssemblyAudioStream(screenStream, {
              micConstraints: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
              onSystemAudioLost: () => {
                setSystemAudioCaptured(false);
                setAssemblyInputMode('mic-only');
                showToast.warning('System audio sharing stopped. Microphone recording continues.', {
                  section: 'meeting_manager', duration: 8000
                });
              }
            });
            assemblyAudioMixerRef.current = mixerResult;
            
            await startDesktopWhisperTranscription(currentMeetingId, mixerResult.mixedStream);
            setMicCaptured(true);
            setSystemAudioCaptured(mixerResult.hasSystemAudio);
            setAssemblyInputMode(mixerResult.hasSystemAudio ? 'mic-and-system' : 'mic-only');
            
            // Restart Assembly/Deepgram with new mixed stream
            try { await assemblyPreview.startPreview(mixerResult.mixedStream, { keyterms: meetingKeytermsRef.current }); } catch (e) { console.warn('⚠️ AssemblyAI restart failed:', e); }
            try { await deepgramPreview.startPreview(currentMeetingId, mixerResult.mixedStream); } catch (e) { console.warn('⚠️ Deepgram restart failed:', e); }
          } catch (systemError: any) {
            console.error('❌ System audio capture failed:', systemError);
            showToast.warning('System audio not captured - using microphone only', { section: 'meeting_manager' });
            setMicCaptured(true);
            await startMicrophoneTranscription(currentMeetingId);
          }
        } else {
          // Non-Chromium: use stereo recording
          await startStereoRecording();
          setMicCaptured(true);
          setSystemAudioCaptured(true);
        }
      }

      showToast.success(`Switched to ${newMode === 'microphone' ? 'Microphone Only' : 'Mic + System Audio'}`, { 
        section: 'meeting_manager',
        id: 'audio-switch'
      });
      
      console.log('✅ Audio source switch completed successfully');
      
    } catch (error: any) {
      console.error('❌ Audio source switch failed:', error);
      showToast.error(`Audio switch failed: ${error.message}`, { section: 'meeting_manager', id: 'audio-switch' });
      
      // Attempt recovery - try to restart mic transcription at minimum
      try {
        setMicCaptured(true);
        await startMicrophoneTranscription(currentMeetingId);
        showToast.info('Recovered with microphone only', { section: 'meeting_manager' });
      } catch (recoveryError) {
        console.error('❌ Recovery failed:', recoveryError);
      }
    } finally {
      setIsSwitchingAudioSource(false);
    }
  };
  
  // Handler for switching to system audio from the TeamsAudioHint
  // Placed after switchAudioSourceLive declaration to avoid hoisting issues
  const handleSwitchToSystemAudioFromHint = useCallback(() => {
    switchAudioSourceLive('microphone_and_system');
    teamsAudioDetection.dismissHint();
  }, [teamsAudioDetection]);

  // Acquire screen share stream (audio only) without starting the legacy sidecar pipeline
  const acquireScreenShareStream = async (): Promise<MediaStream> => {
    showToast.info(
      'To capture system audio, select a Chrome Tab (not Entire Screen) and tick "Share tab audio".',
      { section: 'meeting_manager', duration: 8000, id: 'screen-share-guide' }
    );
    
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      } as DisplayMediaStreamOptions);
      
      // Disable video tracks instead of stopping them — stopping kills Chrome's capture session
      // They will be properly stopped during recording cleanup via screenStreamRef
      stream.getVideoTracks().forEach(track => {
        track.enabled = false;
      });
      
      const audioTracks = stream.getAudioTracks();
      console.log('🖥️ Screen share audio tracks:', audioTracks.length,
        audioTracks.map(t => ({ label: t.label, readyState: t.readyState })));
      
      if (audioTracks.length === 0) {
        showToast.error(
          'No system audio captured. Please select a Chrome Tab and check "Share tab audio".',
          { section: 'meeting_manager', duration: 10000, id: 'no-audio-tracks' }
        );
        throw new Error('NO_AUDIO_TRACKS');
      }
      
      screenStreamRef.current = stream;
      return stream;
    } catch (error: any) {
      if (error.message === 'NO_AUDIO_TRACKS') throw new Error('NO_TAB_AUDIO_SELECTED');
      if (error.name === 'NotAllowedError' || error.name === 'AbortError') throw new Error('SCREEN_SHARE_CANCELLED');
      throw new Error('SCREEN_SHARE_FAILED');
    }
  };

  const startComputerAudioTranscription = async (meetingId: string) => {
    addDebugLog('💻 Starting computer audio capture via screen share...');
    
    // Pre-flight toast to guide the user BEFORE the picker opens
    showToast.info(
      'To capture system audio, select a Chrome Tab (not Entire Screen) and tick "Share tab audio".',
      { section: 'meeting_manager', duration: 8000, id: 'screen-share-guide' }
    );
    
    try {
      // Try screen sharing with audio first
      let stream: MediaStream;
      
      try {
        addDebugLog('🖥️ Requesting screen share with audio...');
        // Chrome requires video: true for getDisplayMedia to work with audio
        // Simple audio: true is more compatible than constraints object (Chrome 124+ fix)
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true, // Required for Chrome to show the picker
          audio: true  // Simple boolean is more compatible than constraints object
        } as DisplayMediaStreamOptions);
        
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        
        // Detailed logging for diagnosis
        console.log('🖥️ getDisplayMedia returned:', {
          videoTracks: videoTracks.length,
          audioTracks: audioTracks.length,
          videoTrackLabels: videoTracks.map(t => t.label),
          audioTrackLabels: audioTracks.map(t => t.label),
          audioTrackDetails: audioTracks.map(t => ({
            id: t.id,
            label: t.label,
            enabled: t.enabled,
            muted: (t as any).muted,
            readyState: t.readyState,
            settings: t.getSettings?.()
          }))
        });
        
        // Disable video tracks instead of stopping them — stopping kills Chrome's capture session
        // They will be properly stopped during recording cleanup via screenStreamRef
        videoTracks.forEach(track => {
          track.enabled = false;
        });
        console.log('🎬 Video tracks disabled (keeping capture session alive, audio-only mode)');
        
        addDebugLog('✅ Screen audio access granted');
        screenStreamRef.current = stream;
        
        // Check if we actually got audio tracks
        if (audioTracks.length === 0) {
          console.error('❌ No audio tracks in screen share - user likely selected "Entire Screen" or did not check "Share tab audio"');
          addDebugLog('❌ No audio tracks - try sharing a Chrome Tab with "Share tab audio" checked');
          
          // Show a clear, actionable toast explaining what went wrong
          showToast.error(
            'No system audio captured. Please select a Chrome Tab (not "Entire Screen") and check "Share tab audio".',
            { section: 'meeting_manager', duration: 10000, id: 'no-audio-tracks' }
          );
          
          throw new Error('NO_AUDIO_TRACKS');
        }
        
        addDebugLog(`🔊 System audio tracks: ${audioTracks.length} (${audioTracks.map(t => t.label).join(', ')})`);
        setSystemAudioCaptured(true);
        
      } catch (screenError: any) {
        addDebugLog(`❌ Screen share failed: ${screenError.message}`);
        console.error('Screen share error:', screenError);
        
        // Check if error is due to no audio tracks
        if (screenError.message === 'NO_AUDIO_TRACKS') {
          throw new Error('NO_TAB_AUDIO_SELECTED');
        }
        
        // User cancelled or permission denied
        if (screenError.name === 'NotAllowedError' || screenError.name === 'AbortError') {
          throw new Error('SCREEN_SHARE_CANCELLED');
        }
        
        // Show clear error instead of silent fallback to mic
        throw new Error('SCREEN_SHARE_FAILED');
      }

      // At this point we have a display stream with at least one audio track.
      // Use custom audio processing that actually reads from the stream and
      // sends audio to our speech-to-text function instead of the browser
      // microphone-only SpeechRecognition API.
      await startCustomAudioProcessing(stream);
      
      addDebugLog('✅ Computer audio transcription (custom processing) started successfully');
      console.log('Recording started with computer audio transcription (custom processing)');
      
    } catch (error) {
      addDebugLog(`❌ Computer audio setup failed: ${error.message}`);
      
      if (error.name === 'NotAllowedError') {
        throw new Error('Permission denied. Please allow screen sharing or microphone access to capture Teams/YouTube audio.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No audio devices found. Please check your system audio settings.');
      } else {
        throw new Error(`Computer audio setup failed: ${error.message}. Try using microphone mode instead.`);
      }
    }
  };

  // Custom audio processing for better speaker audio capture
  const startCustomAudioProcessing = async (stream: MediaStream) => {
    addDebugLog('🔧 Starting custom audio processing...');
    
    // Log incoming stream details
    const incomingAudioTracks = stream.getAudioTracks();
    console.log('🔧 startCustomAudioProcessing: incoming stream:', {
      audioTracks: incomingAudioTracks.length,
      trackDetails: incomingAudioTracks.map(t => ({
        id: t.id,
        label: t.label,
        enabled: t.enabled,
        readyState: t.readyState
      }))
    });
    
    try {
      // Create audio context for processing
      const audioContext = new AudioContext({ sampleRate: 24000 });
      console.log(`🔧 AudioContext created at ${audioContext.sampleRate}Hz, state: ${audioContext.state}`);
      const source = audioContext.createMediaStreamSource(stream);
      
      // Create analyser node for activity detection
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Create a gain node to amplify speaker audio
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 2.0; // Moderate amplification for speaker audio

      // Create a derived MediaStream for AssemblyAI that taps the *same* system-audio
      // processing pipeline. This avoids creating a second MediaStreamSource from the
      // original display-capture stream (which can go silent in Chromium when used twice).
      const assemblyTapDestination = audioContext.createMediaStreamDestination();
      try {
        // Prefer mono output to reduce edge-case channel issues.
        (assemblyTapDestination as any).channelCount = 1;
        (assemblyTapDestination as any).channelCountMode = 'explicit';
      } catch {
        // ignore
      }
      
      // Create a processor for chunked audio processing
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      let audioBuffer: Float32Array[] = [];
      let bufferDuration = 0;
      const targetDuration = 15; // Process every 15 seconds (matches microphone path)
      let systemAudioChunkNumber = 0;
      let overlapBuffer: Float32Array | null = null; // Store last 250ms for overlap
      
      processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // Check for audio activity
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const normalized = (dataArray[i] - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / bufferLength);
        setAudioActivity(rms > 0.01); // Threshold for detecting audio
        
        // Store audio data
        audioBuffer.push(new Float32Array(inputData));
        bufferDuration += inputBuffer.duration;
        
        // Process when we have enough audio
        if (bufferDuration >= targetDuration) {
          systemAudioChunkNumber++;
          
          // Prepend overlap from previous chunk if it exists
          let bufferToProcess = audioBuffer;
          if (overlapBuffer) {
            bufferToProcess = [overlapBuffer, ...audioBuffer];
            addDebugLog(`🔗 Added 250ms overlap to chunk #${systemAudioChunkNumber}`);
          }
          
          processAudioBuffer(bufferToProcess, audioContext.sampleRate, systemAudioChunkNumber);
          
          // Save last 250ms for next chunk (250ms = 0.25s * sampleRate samples)
          const overlapSamples = Math.floor(0.25 * audioContext.sampleRate);
          const totalSamples = audioBuffer.reduce((acc, chunk) => acc + chunk.length, 0);
          
          if (totalSamples >= overlapSamples) {
            // Extract last 250ms from current buffer
            overlapBuffer = new Float32Array(overlapSamples);
            let samplesNeeded = overlapSamples;
            let sourceIndex = audioBuffer.length - 1;
            let destOffset = overlapSamples;
            
            while (samplesNeeded > 0 && sourceIndex >= 0) {
              const sourceChunk = audioBuffer[sourceIndex];
              const copyLength = Math.min(samplesNeeded, sourceChunk.length);
              const copyStart = sourceChunk.length - copyLength;
              destOffset -= copyLength;
              overlapBuffer.set(sourceChunk.slice(copyStart), destOffset);
              samplesNeeded -= copyLength;
              sourceIndex--;
            }
          }
          
          audioBuffer = [];
          bufferDuration = 0;
        }
      };
      
      // Connect the audio pipeline
      source.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(processor);

      // Tap system audio for AssemblyAI (from the same processed signal)
      gainNode.connect(assemblyTapDestination);
      processor.connect(audioContext.destination);
      
      // Store references for cleanup
      audioContextRef.current = audioContext;

      // Expose the tapped stream for the AssemblyAI mixer to use (instead of the raw screen stream)
      enhancedAudioCaptureRef.current = {
        assemblyStream: assemblyTapDestination.stream,
        stopCapture: () => {
          try {
            assemblyTapDestination.stream.getTracks().forEach(t => t.stop());
          } catch {
            // ignore
          }
        }
      };

      console.log('🎧 System audio tap created for AssemblyAI', {
        tracks: assemblyTapDestination.stream.getAudioTracks().length,
      });
      
      addDebugLog('✅ Custom audio processing pipeline established');
      
    } catch (error) {
      addDebugLog(`❌ Custom audio processing failed: ${error.message}`);
      throw error;
    }
  };

  // Process audio buffer and send to speech-to-text API
  const processAudioBuffer = async (audioBuffer: Float32Array[], sampleRate: number, chunkNumber: number) => {
    try {
      // Combine all audio chunks
      const totalLength = audioBuffer.reduce((acc, chunk) => acc + chunk.length, 0);
      const combinedBuffer = new Float32Array(totalLength);
      
      let offset = 0;
      for (const chunk of audioBuffer) {
        combinedBuffer.set(chunk, offset);
        offset += chunk.length;
      }
      
      // Check if audio has sufficient volume (speaker audio detection)
      const rms = Math.sqrt(combinedBuffer.reduce((acc, val) => acc + val * val, 0) / combinedBuffer.length);
      const volumeThreshold = 0.00001; // Ultra-low threshold (10x more sensitive)
      
      if (rms < volumeThreshold) {
        console.warn(`⚠️ CHUNK FILTERED: System audio chunk #${chunkNumber} too quiet (RMS: ${rms.toFixed(6)})`);
        addDebugLog(`⚠️ Chunk #${chunkNumber} FILTERED - too quiet (RMS: ${rms.toFixed(6)}) - below threshold ${volumeThreshold}`);
        return;
      }
      
      addDebugLog(`🔊 Processing system audio chunk #${chunkNumber} (RMS: ${rms.toFixed(4)})`);
      
      // Convert to WAV format
      const wavBuffer = encodeWAV(combinedBuffer, sampleRate);
      const base64Audio = arrayBufferToBase64(wavBuffer);
      
      // Send to speech-to-text edge function using Supabase client (handles auth + URL)
      const { data: result, error } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio }
      });

      if (error) {
        addDebugLog(`❌ Speech-to-text invoke error: ${error.message || 'Unknown error'}`);
        console.error('Speech-to-text invoke error:', error);
        return;
      }

      if (result?.text && result.text.trim()) {
        addDebugLog(`🎙️ System Audio Chunk #${chunkNumber}: "${result.text.substring(0, 50)}..."`);
        
        // Create transcript data with chunk info
        const transcriptData: TranscriptData = {
          text: result.text,
          speaker: 'System Audio',
          isFinal: true,
          confidence: result.confidence || 0.85, // Use actual confidence from API
          timestamp: new Date().toISOString(),
          chunkNumber: chunkNumber
        };
        
        // Process through transcript handler for display
        handleTranscript(transcriptData);
        
        // Update word count tracking by adding proper ChunkSaveStatus object
        const chunkTime = Date.now();
        const wavSize = wavBuffer.byteLength;
        setChunkSaveStatuses(prev => [...prev, {
          id: `system-audio-${chunkNumber}-${chunkTime}`,
          chunkNumber: chunkNumber,
          text: result.text,
          chunkLength: result.text.length,
          saveStatus: 'saved',
          saveTimestamp: new Date().toISOString(),
          retryCount: 0,
          confidence: result.confidence || 0.85,
          startTime: (chunkTime - 90000) / 1000, // 90 seconds ago in seconds
          endTime: chunkTime / 1000, // now in seconds
          originalFileSize: wavSize,
          transcodedFileSize: wavSize,
          fileType: 'audio/wav'
        }]);
        
        // Also save as a database chunk 
        const currentMeetingId = sessionStorage.getItem('currentMeetingId');
        if (currentMeetingId) {
          const chunkStartTime = new Date();
          const wavSize = wavBuffer.byteLength;
          
          await supabase
            .from('audio_chunks')
            .insert({
              meeting_id: currentMeetingId,
              chunk_number: chunkNumber,
              start_time: chunkStartTime.toISOString(),
              end_time: new Date(chunkStartTime.getTime() + 90000).toISOString(), // 90 seconds
              processing_status: 'completed',
              chunk_duration_ms: 90000,
              file_size: wavSize,
              original_file_size: wavSize, // System audio is processed directly as WAV
              transcoded_file_size: wavSize,
              compression_ratio: 0 // No compression for system audio path
            });
          
          addDebugLog(`💾 Saved system audio chunk #${chunkNumber} to database (${(wavSize/1024).toFixed(1)}KB)`);
        }
      }
      
    } catch (error) {
      addDebugLog(`❌ Audio processing error: ${error.message}`);
      console.error('System audio processing error:', error);
    }
  };

  // Encode Float32Array to WAV format
  const encodeWAV = (samples: Float32Array, sampleRate: number): ArrayBuffer => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    
    // Convert samples to 16-bit PCM
    const offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    }
    
    return buffer;
  };

  // Convert ArrayBuffer to Base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const startTestMode = async () => {
    addDebugLog('🎤 Starting advanced dual audio capture (system + microphone)...');
    
    try {
      // Check browser support first
      console.log('Browser check:', {
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetDisplayMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
        hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        userAgent: navigator.userAgent
      });

      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Your browser does not support screen capture. Please use Chrome, Edge, or Firefox.');
      }

      // Step 1: Try getting display media with different approaches
      addDebugLog('📺 Requesting screen capture with audio...');
      let displayStream;
      
      try {
        // Chrome requires video: true for getDisplayMedia - audio-only doesn't work
        // Simple audio: true is more compatible than constraints object (Chrome 124+ fix)
        console.log('Attempting screen capture with audio (video+audio approach)...');
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        } as DisplayMediaStreamOptions);
        
        console.log('🖥️ getDisplayMedia returned:', {
          videoTracks: displayStream.getVideoTracks().length,
          audioTracks: displayStream.getAudioTracks().length,
          audioTrackLabels: displayStream.getAudioTracks().map(t => t.label),
        });
        
        // Stop video tracks immediately - we only need audio
        const videoTracks = displayStream.getVideoTracks();
        videoTracks.forEach(track => {
          track.stop();
          displayStream.removeTrack(track);
        });
        addDebugLog('✅ Screen capture successful, video tracks stopped');
      } catch (error) {
        console.log('Screen capture failed:', error.message);
        throw new Error(`Screen capture not supported: ${error.message}`);
      }

      // Check if we got audio tracks
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks found in screen capture. Please ensure you share a tab/window with audio.');
      }
      
      console.log('Display stream audio tracks:', audioTracks.length);
      addDebugLog(`📺 Got ${audioTracks.length} audio track(s) from screen capture`);
      // Step 2: Get microphone audio with simpler constraints
      addDebugLog('🎤 Requesting microphone access...');
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true // Use simple constraints for better compatibility
      });
      
      const micAudioTracks = micStream.getAudioTracks();
      console.log('Microphone audio tracks:', micAudioTracks.length);
      addDebugLog(`🎤 Got ${micAudioTracks.length} microphone track(s)`);

      // Step 3: Combine both streams and add audio level monitoring
      addDebugLog('🔀 Combining audio streams...');
      const combinedStream = new MediaStream([
        ...displayStream.getAudioTracks(),
        ...micStream.getAudioTracks()
      ]);
      
      console.log('Combined stream tracks:', combinedStream.getTracks().length);
      addDebugLog(`🔀 Combined stream has ${combinedStream.getTracks().length} total tracks`);
      
      // Add audio level monitoring to check if we're getting audio
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(combinedStream);
      source.connect(analyser);
      
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Monitor audio levels
      const monitorAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        
        if (average > 5) { // If there's some audio activity
          console.log(`Audio level detected: ${average.toFixed(1)}`);
          addDebugLog(`🔊 Audio activity: ${average.toFixed(1)}`);
        }
      };
      
      // Check audio levels every 2 seconds
      const audioMonitor = setInterval(monitorAudio, 2000);
      
      // Store cleanup function
      const originalCleanup = () => {
        clearInterval(audioMonitor);
        audioContext.close();
        displayStream.getTracks().forEach(track => {
          track.stop();
          addDebugLog(`🔇 Stopped display track: ${track.kind}`);
        });
        micStream.getTracks().forEach(track => {
          track.stop();
          addDebugLog(`🔇 Stopped mic track: ${track.kind}`);
        });
        combinedStream.getTracks().forEach(track => {
          track.stop();
        });
      };
      
      // Debug: Check if tracks are active and have audio
      combinedStream.getTracks().forEach((track, index) => {
        console.log(`Track ${index}:`, {
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted,
          label: track.label
        });
        addDebugLog(`🎵 Track ${index}: ${track.kind} - ${track.readyState} - ${track.enabled ? 'enabled' : 'disabled'}`);
      });

      // Step 4: Set up MediaRecorder with audio-only MIME type
      const browserSupport = checkBrowserSupport();
      let mimeType = 'audio/webm;codecs=opus';
      let bitrate = 128000;
      
      // iOS/Safari optimization - prefer formats that work better on mobile
      if (browserSupport.isIOS || browserSupport.isSafari) {
        // iOS Safari prefers mp4 format
        const iosFormats = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/aac'];
        for (const format of iosFormats) {
          if (MediaRecorder.isTypeSupported(format)) {
            mimeType = format;
            addDebugLog(`📱 iOS optimized format: ${format}`);
            break;
          }
        }
      } else {
        // Standard desktop browser formats — audio-only MIME, opus preferred
        const standardFormats = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
        for (const format of standardFormats) {
          if (MediaRecorder.isTypeSupported(format)) {
            mimeType = format;
            break;
          }
        }
      }
      
      // Fallback to default if nothing is supported
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';
        bitrate = undefined;
        addDebugLog('⚠️ Using browser default audio format');
      }
      
      console.log('Using MediaRecorder with:', { mimeType, bitrate });
      
      const mediaRecorderOptions: any = {};
      if (mimeType) mediaRecorderOptions.mimeType = mimeType;
      if (bitrate) mediaRecorderOptions.audioBitsPerSecond = bitrate;
      
      const mediaRecorder = new MediaRecorder(combinedStream, mediaRecorderOptions);
      addDebugLog(`📹 MediaRecorder created with ${mimeType || 'default'} format`);
      
      const audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        console.log('MediaRecorder data available:', {
          dataSize: event.data.size,
          type: event.data.type,
          timestamp: new Date().toISOString()
        });
        
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          addDebugLog(`📦 Audio chunk captured: ${(event.data.size / 1024).toFixed(1)}KB`);
          // Persist to IndexedDB for crash recovery
          const sid = sessionStorage.getItem('currentMeetingId');
          if (sid) {
            saveAudioChunk(sid, event.data).catch(() => {});
          }
        } else {
          addDebugLog(`⚠️ Empty audio chunk received`);
        }
      };

      mediaRecorder.onstop = async () => {
        addDebugLog('🔄 Processing recorded audio...');
        
        try {
          // Create the final audio blob
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          addDebugLog(`📁 Final audio file: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB`);

          // Upload to Supabase Edge Function for processing
          addDebugLog('☁️ Uploading to backend for transcription...');
          const formData = new FormData();
          formData.append('audio', audioBlob, 'meeting.webm');

          const { data, error } = await supabase.functions.invoke('process-meeting-audio', {
            body: formData,
          });

          if (error) {
            throw new Error(`Backend error: ${error.message}`);
          }

          if (data.success) {
            addDebugLog('✅ Processing completed successfully!');
            
            // Display the transcript
            handleBrowserTranscript({
              text: data.transcript,
              is_final: true,
              confidence: 0.95,
              speaker: 'Meeting Audio'
            });

            // Show meeting summary if available
            if (data.summary) {
              console.log('Meeting Summary:', data.summary);
              addDebugLog('📋 Meeting summary generated - check console for details');
            }
            
          } else {
            throw new Error(data.error || 'Processing failed');
          }

        } catch (uploadError) {
          addDebugLog(`❌ Upload/Processing failed: ${uploadError.message}`);
          showToast.error(`Processing failed: ${uploadError.message}`, { section: 'meeting_manager' });
        }
      };

      mediaRecorder.onerror = (event) => {
        addDebugLog(`❌ MediaRecorder error: ${event}`);
      };

      // Start recording with more frequent data collection and debugging
      console.log('Starting MediaRecorder...');
      addDebugLog('🎯 Starting MediaRecorder with 5-second intervals');
      
      // Check if the stream is actually active before starting
      const activeTracks = combinedStream.getTracks().filter(track => track.readyState === 'live');
      console.log(`Active tracks before recording: ${activeTracks.length}`);
      addDebugLog(`🟢 ${activeTracks.length} active tracks ready for recording`);
      
      if (activeTracks.length === 0) {
        throw new Error('No active audio tracks available for recording');
      }
      
      mediaRecorder.start(5000); // Capture data every 5 seconds for more responsive feedback
      addDebugLog('🎯 Advanced dual audio recording started');

      // Store references for cleanup
      micAudioStreamRef.current = combinedStream;
      mediaRecorderRef.current = mediaRecorder;
      
      // Store cleanup function
      (mediaRecorder as any).cleanup = originalCleanup;

    } catch (error) {
      console.error('Dual audio capture error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      addDebugLog(`❌ Advanced dual audio capture failed: ${error.message}`);
      
      // Try fallback to microphone-only mode
      if (error.name === 'NotSupportedError' || error.message.includes('not supported')) {
        addDebugLog('🔄 Attempting fallback to microphone-only recording...');
        showToast.info('Dual audio not supported. Falling back to microphone-only recording.', { section: 'meeting_manager' });
        
        try {
          // Fallback to simple microphone recording
          const fallbackMeetingId = sessionStorage.getItem('currentMeetingId') || crypto.randomUUID();
          await startMicrophoneTranscription(fallbackMeetingId);
          return; // Success with fallback
        } catch (fallbackError) {
          addDebugLog(`❌ Microphone fallback also failed: ${fallbackError.message}`);
          error = fallbackError; // Use the fallback error for final error handling
        }
      }
      
      // Provide specific, helpful error messages
      if (error.name === 'NotAllowedError') {
        showToast.error('Permission denied. Please allow screen sharing and microphone access when prompted.', { section: 'meeting_manager' });
        addDebugLog('💡 Tip: Click the address bar and enable camera/microphone permissions for this site');
      } else if (error.name === 'NotFoundError') {
        showToast.error('No audio source found. Please ensure your microphone is connected and working.', { section: 'meeting_manager' });
      } else if (error.name === 'NotSupportedError') {
        showToast.error('Screen audio capture not supported in this browser. Please try Chrome or Edge, or use microphone-only mode.', { section: 'meeting_manager' });
        addDebugLog('💡 Tip: Try using the regular "Microphone Only" recording mode instead');
      } else if (error.name === 'AbortError') {
        showToast.error('Recording was cancelled. Please try again and select a window/tab to share.', { section: 'meeting_manager' });
      } else if (error.message.includes('audio')) {
        showToast.error('Audio capture failed. Please check your audio settings and try again.', { section: 'meeting_manager' });
      } else if (error.message.includes('browser')) {
        showToast.error(error.message, { section: 'meeting_manager' });
      } else {
        showToast.error(`Recording failed: ${error.message}`, { section: 'meeting_manager' });
      }
      
      // Reset recording state
      setIsRecording(false);
      isRecordingRef.current = false;
      recordingStartTimeRef.current = null; // Reset recording start time
      lastChunkEndTime.current = null; // Reset chunk timing
      setConnectionStatus('Error');
      
      throw error;
    }
  };

  const processRecordedAudio = async (base64Audio: string) => {
    try {
      addDebugLog('🤖 Sending audio to transcription service...');
      
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio }
      });

      if (error) throw error;

      addDebugLog('✅ Transcription received');
      handleBrowserTranscript({
        text: data.text,
        is_final: true,
        confidence: 0.95,
        speaker: 'Speaker'
      });

    } catch (error) {
      addDebugLog(`❌ Transcription failed: ${error.message}`);
    }
  };

  const startTestRecording = async () => {
    try {
      addDebugLog('🚀 Starting test recording with microphone...');
      console.log('Starting test recording with microphone...');
      
      // Clear previous debug logs and test transcripts
    setTestTranscripts([]);
      
      // Always use microphone transcription
      const testMeetingId = sessionStorage.getItem('currentMeetingId') || crypto.randomUUID();
      await startMicrophoneTranscription(testMeetingId);
      
    setIsRecording(true);
    isRecordingRef.current = true;
      setRealtimeTranscripts([]);
      setSpeakerCount(1);
      setStartTime(generateMeetingTimestamp());
      setConnectionStatus("Connected");
      
      addDebugLog('✅ Test recording started successfully');
      
      // Start duration timer
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      const successMessage = 'Test recording started with microphone!';
      showToast.success(successMessage, { section: 'meeting_manager' });
    } catch (error: any) {
      console.error('Failed to start test recording:', error);
      addDebugLog(`❌ Failed to start test: ${error.message}`);
      showToast.error(error.message || 'Failed to start test recording', { section: 'meeting_manager' });
      setIsRecording(false);
      isRecordingRef.current = false;
      recordingStartTimeRef.current = null; // Reset recording start time
      lastChunkEndTime.current = null; // Reset chunk timing
      setConnectionStatus("Error");
    }
  };

  const stopTestRecording = async () => {
    try {
      addDebugLog('🛑 Stopping test recording...');
      
      // Stop MediaRecorder if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        
        // Clean up streams if cleanup function exists
        if ((mediaRecorderRef.current as any).cleanup) {
          (mediaRecorderRef.current as any).cleanup();
        }
      }
      
      // Stop other streams
      if (micAudioStreamRef.current) {
        micAudioStreamRef.current.getTracks().forEach(track => track.stop());
        micAudioStreamRef.current = null;
      }
      
      if (browserTranscriberRef.current) {
        browserTranscriberRef.current.stopTranscription();
      }
      
      if (iPhoneTranscriberRef.current) {
        iPhoneTranscriberRef.current.stopTranscription();
      }
      
      if (simpleIOSTranscriberRef.current) {
        simpleIOSTranscriberRef.current.stop();
      }
      
      if (desktopTranscriberRef.current) {
        desktopTranscriberRef.current.stopTranscription();
      }
      
      // Clear timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      setIsRecording(false);
      isRecordingRef.current = false;
      recordingStartTimeRef.current = null; // Reset recording start time
      lastChunkEndTime.current = null; // Reset chunk timing
      setConnectionStatus("Disconnected");
      addDebugLog('✅ Test recording stopped');
      showToast.success('Test recording stopped successfully', { section: 'meeting_manager' });
      
    } catch (error: any) {
      console.error('Failed to stop test recording:', error);
      addDebugLog(`❌ Failed to stop test: ${error.message}`);
      showToast.error('Failed to stop test recording', { section: 'meeting_manager' });
    }
  };

  // Start transcript snippet monitoring - now uses useEffect to react to transcript changes
  const startTranscriptSnippetMonitoring = () => {
    // Just set a flag - the actual update happens in the useEffect below
    setShowTranscriptSnippet(true);
  };

  // React to AssemblyAI transcript changes for the Live Speech display
  useEffect(() => {
    if (!isRecording) return;
    
    const liveText = assemblyPreview.fullTranscript || '';
    const words = liveText.split(' ').filter(w => w.trim().length > 0);
    const recentWords = words.slice(-50);
    const snippet = recentWords.join(' ');
    
    if (snippet.trim().length > 0) {
      setTranscriptSnippet(snippet);
      setShowTranscriptSnippet(true);
      console.log('📝 Live transcript snippet (AssemblyAI):', snippet);
    }
  }, [assemblyPreview.fullTranscript, isRecording]);

  const startStereoRecording = async () => {
    try {
      console.log('🎧 Starting stereo recording (Left=Mic, Right=System)...');
      
      // Start stereo capture
      const stereoStream = await stereoAudioCapture.current.startCapture();
      
      // Initialize stereo recorder
      stereoChunks.current = [];
      stereoRecorder.current = new MediaRecorder(stereoStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      stereoRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          stereoChunks.current.push(event.data);
        }
      };

      stereoRecorder.current.start(1000); // Collect data every second
      console.log('✅ Stereo recording started');
      addDebugLog('✅ Stereo recording started (Left=Mic, Right=System)');
      
    } catch (error) {
      console.error('❌ Failed to start stereo recording:', error);
      addDebugLog(`❌ Stereo recording failed: ${error.message}`);
      // Fallback to regular audio backup
      await startAudioBackup();
    }
  };

  const stopStereoRecording = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!stereoRecorder.current || stereoRecorder.current.state === 'inactive') {
        resolve(null);
        return;
      }

      stereoRecorder.current.onstop = () => {
        const stereoBlob = new Blob(stereoChunks.current, { type: 'audio/webm' });
        console.log('✅ Stereo recording stopped, size:', stereoBlob.size);
        
        // Clean up stereo capture
        if (stereoAudioCapture.current.isCapturing()) {
          stereoAudioCapture.current.stopCapture();
        }
        
        resolve(stereoBlob);
      };

      stereoRecorder.current.stop();
    });
  };

  // Create channel-specific audio from stereo recording
  const createChannelSpecificAudio = async (stereoBlob: Blob) => {
    try {
      const audioContext = new AudioContext();
      const arrayBuffer = await stereoBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      console.log('🎵 Audio analysis:', {
        numberOfChannels: audioBuffer.numberOfChannels,
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        length: audioBuffer.length
      });
      
      if (audioBuffer.numberOfChannels >= 2) {
        // Create mono buffers for each channel
        const micBuffer = audioContext.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);
        const systemBuffer = audioContext.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);
        
        // Copy left channel (mic) to micBuffer
        micBuffer.copyToChannel(audioBuffer.getChannelData(0), 0);
        
        // Copy right channel (system) to systemBuffer  
        systemBuffer.copyToChannel(audioBuffer.getChannelData(1), 0);
        
        // Convert buffers back to blobs
        const micAudioBlob = await audioBufferToBlob(micBuffer);
        const systemAudioBlob = await audioBufferToBlob(systemBuffer);
        
        // Store blobs for later use
        setMicBlob(micAudioBlob);
        setSystemBlob(systemAudioBlob);
        
        // Create URLs for playback
        setMicAudioUrl(URL.createObjectURL(micAudioBlob));
        setSystemAudioUrl(URL.createObjectURL(systemAudioBlob));
        
        console.log('✅ Created separate channel audio files', {
          micBlobSize: micAudioBlob.size,
          systemBlobSize: systemAudioBlob.size
        });
      } else {
        console.warn('⚠️ Audio only has one channel, creating duplicate for testing');
        
        // For mono audio, create two copies so user can test both channels
        // This helps with troubleshooting even when system audio isn't captured
        const monoBuffer = audioContext.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);
        monoBuffer.copyToChannel(audioBuffer.getChannelData(0), 0);
        
        const micAudioBlob = await audioBufferToBlob(monoBuffer);
        const systemAudioBlob = await audioBufferToBlob(monoBuffer); // Same content for testing
        
        setMicBlob(micAudioBlob);
        setSystemBlob(systemAudioBlob); // Now both are populated
        
        const micUrl = URL.createObjectURL(micAudioBlob);
        const systemUrl = URL.createObjectURL(systemAudioBlob);
        setMicAudioUrl(micUrl);
        setSystemAudioUrl(systemUrl);
        
        console.log('✅ Created duplicate channel audio files for testing', {
          originalChannels: audioBuffer.numberOfChannels,
          micBlobSize: micAudioBlob.size,
          systemBlobSize: systemAudioBlob.size
        });
      }
      
      audioContext.close();
    } catch (error) {
      console.error('❌ Failed to create channel-specific audio:', error);
    }
  };

  // Helper function to convert AudioBuffer to Blob
  const audioBufferToBlob = async (audioBuffer: AudioBuffer): Promise<Blob> => {
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();
    
    const renderedBuffer = await offlineContext.startRendering();
    
    // Convert to WAV format
    const wavArrayBuffer = audioBufferToWav(renderedBuffer);
    return new Blob([wavArrayBuffer], { type: 'audio/wav' });
  };

  // Convert AudioBuffer to WAV format
  const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return arrayBuffer;
  };

  const startRecording = async () => {
    // Prevent starting while post-meeting modal is active
    if (showPostMeetingActionsRef.current) {
      console.log('⚠️ Cannot start recording while post-meeting modal is active');
      return;
    }

    // Block start while a previous stop operation is still finalising
    if (stopInProgressRef.current) {
      console.log('⚠️ Stop still in progress, cannot start new recording yet');
      showToast.warning('Please wait — previous recording is still saving...', {
        section: 'meeting_manager',
        duration: 3000,
      });
      return;
    }

    // Prevent double-starts from rapid clicks
    if (isStartingRecordingRef.current || isRecording) {
      console.log('⚠️ Recording already starting or active, ignoring duplicate start request');
      return;
    }
    
    isStartingRecordingRef.current = true;
    
    try {
      console.log('Starting recording...');
      
      // Check if mic-and-system mode in Chrome/Edge - show guidance first
      const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
      const isEdge = /Edg/.test(navigator.userAgent);
      const needsScreenShare = isChrome || isEdge;
      
      if (recordingMode === 'mic-and-system' && needsScreenShare && !pendingRecordingStart) {
        // Show guidance dialog first
        setShowTabAudioGuidance(true);
        setPendingRecordingStart(true);
        return; // Exit early - will resume after user confirms
      }
      
      // Clear the pending flag if we got here
      setPendingRecordingStart(false);
      
      // Clear transcript handler
      if (transcriptHandler.current) {
        transcriptHandler.current.clear();
      }

      // Create meeting record FIRST to get real meeting ID (or use continuation ID)
      let realMeetingId: string;
      let startingChunkNumber = 0;
      const continuationId = sessionStorage.getItem('continuationMeetingId');
      
      try {
        if (!user?.id) {
          throw new Error('User not authenticated - cannot create meeting');
        }

        if (continuationId) {
          // CONTINUATION MODE: Use existing meeting ID
          console.log('🔄 Continuation mode - using existing meeting:', continuationId);
          realMeetingId = continuationId;
          
          // Update meeting status to recording
          const { error: updateError } = await supabase
            .from('meetings')
            .update({ 
              status: 'recording',
              updated_at: new Date().toISOString()
            })
            .eq('id', continuationId);
          
          if (updateError) {
            console.error('❌ Failed to update meeting status:', updateError);
            throw updateError;
          }
          
          // Get existing chunk count for proper numbering
          const { count, error: countError } = await supabase
            .from('meeting_transcription_chunks')
            .select('*', { count: 'exact', head: true })
            .eq('meeting_id', continuationId);
          
          if (!countError && count) {
            startingChunkNumber = count;
            console.log(`📊 Starting chunk numbering at: ${startingChunkNumber}`);
          }
          
          // Add session marker to transcript
          const sessionMarker = `\n\n--- Session ${Math.floor(startingChunkNumber / 10) + 2} started at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} ---\n\n`;
          
          // Insert a marker chunk to indicate new session
          await supabase
            .from('meeting_transcription_chunks')
            .insert({
              meeting_id: continuationId,
              session_id: continuationId, // Use meeting ID as session ID for continuation
              user_id: user.id,
              chunk_number: startingChunkNumber,
              transcription_text: JSON.stringify([{ text: sessionMarker.trim(), speaker: 'System', start: 0, end: 0 }]),
              word_count: 0,
              cleaning_status: 'completed',
              cleaned_text: sessionMarker.trim()
            });
          
          startingChunkNumber += 1;
          
          // Clear continuation ID from session storage
          sessionStorage.removeItem('continuationMeetingId');
          
          console.log(`✅ Continuing meeting record: ${realMeetingId}`);
        } else {
          // NORMAL MODE: Create new meeting
          // Prefer attendees from the new MeetingSetupContext (full names + roles)
          // Fall back to old meetingSettings string for backwards compatibility
          const ctx = meetingSetupContextRef.current;
          const contextAttendees = (ctx?.attendees || [])
            .filter((a: any) => a?.status === 'present' || !a?.status)
            .map((a: any) => {
              // Build "Name (Role)" or "Name (Organisation)" format for expected_attendees
              const name = a?.name?.trim();
              if (!name) return '';
              const role = a?.role?.trim();
              const org = a?.org?.trim();
              if (role && org) return `${name} (${role}, ${org})`;
              if (role) return `${name} (${role})`;
              if (org) return `${name} (${org})`;
              return name;
            })
            .filter(Boolean);

          const legacyAttendeesList = meetingSettings.attendees
            ? meetingSettings.attendees.split(/[,\n]/).map((a: string) => a.trim()).filter(Boolean)
            : [];

          const attendeesList = contextAttendees.length > 0 ? contextAttendees : legacyAttendeesList;

          // Use context title/format if available from new PreMeetingSetup
          const contextTitle = ctx?.meetingTitle?.trim();
          const contextFormat = ctx?.meetingType;

          const meetingData = {
            title: contextTitle || meetingSettings.title || 'General Meeting',
            duration_minutes: 0, // Will be updated when stopped
            meeting_type: 'general',
            start_time: generateMeetingTimestamp(),
            status: 'recording' as const,
            user_id: user.id,
            practice_id: meetingSettings.practiceId || null,
            meeting_format: contextFormat || meetingSettings.format || 'teams',
            expected_attendees: attendeesList.length > 0 ? attendeesList : null,
            notes_config: meetingPrefs.getNotesConfig(),
          };

          const { data: savedMeeting, error: saveError } = await supabase
            .from('meetings')
            .insert(meetingData)
            .select()
            .single();

          if (saveError) {
            console.error('❌ Failed to create meeting record:', saveError);
            throw saveError;
          }

          realMeetingId = savedMeeting.id;
          console.log(`✅ Created meeting record: ${realMeetingId}`);

          // Attach device info in background (non-blocking)
          import('@/utils/meetingDeviceCapture').then(({ attachDeviceInfoToMeeting }) => {
            attachDeviceInfoToMeeting(realMeetingId);
          });
        }
        
        // CRITICAL: Set recording start time IMMEDIATELY after meeting creation
        // This must happen BEFORE any chunk recording starts
        recordingStartTimeRef.current = new Date();
        recordingStartMonotonicRef.current = performance.now();
        console.log(`⏱️ Recording start time set: ${recordingStartTimeRef.current.toISOString()}`);
        
        // Store both session ID and meeting ID as the same value
        sessionStorage.setItem('currentSessionId', realMeetingId);
        sessionStorage.setItem('currentMeetingId', realMeetingId);
        sessionStorage.setItem('recordingStartedAt', recordingStartTimeRef.current!.toISOString());
        
        // Set starting chunk counter for continuation mode
        // CRITICAL: Set both ref (synchronous) and state (UI display)
        chunkCounterRef.current = startingChunkNumber;
        setChunkCounter(startingChunkNumber);
      } catch (error) {
        console.error('❌ Failed to create/continue meeting:', error);
        throw error;
      }
      
      // Check recording mode and browser (recalculate in case user changed settings)
      const isChromeCheck = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
      const isEdgeCheck = /Edg/.test(navigator.userAgent);
      const useScreenShare = isChromeCheck || isEdgeCheck;
      
      // Reset audio capture status
      setMicCaptured(false);
      setSystemAudioCaptured(false);
      
      if (recordingMode === 'mic-only') {
        // Microphone only mode
        addDebugLog('🎙️ Starting microphone-only recording...');
        await startMicrophoneTranscription(realMeetingId);
        setMicCaptured(true);
      } else if (recordingMode === 'mic-and-system') {
        // Microphone + System audio mode
        if (useScreenShare) {
          // Chrome/Edge: Unified pipeline — single mixed stream for all engines
          const browserName = isChromeCheck ? 'Chrome' : 'Edge';
          addDebugLog(`🖥️ ${browserName} - unified mic+system pipeline...`);
          
          // Step 1: Acquire screen share (audio only)
          const screenStream = await acquireScreenShareStream();
          
          // Step 2: Build mixed stream via Web Audio mixer (mic + system)
          const mixerResult = await buildAssemblyAudioStream(screenStream, {
            micConstraints: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            onSystemAudioLost: () => {
              console.log('🔇 System audio track ended — falling back to mic-only');
              setSystemAudioCaptured(false);
              setAssemblyInputMode('mic-only');
              showToast.warning('System audio sharing stopped. Microphone recording continues.', {
                section: 'meeting_manager', duration: 8000
              });
            },
            onSystemAudioSilent: () => {
              showToast.warning('System audio appears silent — check the shared tab has audio playing.', {
                section: 'meeting_manager', duration: 8000
              });
            }
          });
          assemblyAudioMixerRef.current = mixerResult;
          
          // Step 3: Start Whisper with the same mixed stream (90s WebM chunks, full quality pipeline)
          await startDesktopWhisperTranscription(realMeetingId, mixerResult.mixedStream);
          
          setMicCaptured(true);
          setSystemAudioCaptured(mixerResult.hasSystemAudio);
          if (mixerResult.hasSystemAudio) {
            setAssemblyInputMode('mic-and-system');
          } else {
            setAssemblyInputMode('mic-only');
          }
        } else {
          // Other browsers: Use stereo recording
          addDebugLog('🎧 Starting stereo recording (mic + system audio)...');
          console.warn('💰 WHISPER_DOUBLE_PATH: Non-Chrome stereo mode — BOTH startStereoRecording() AND startMicrophoneTranscription() will call Whisper. This may double transcription costs.');
          await startStereoRecording();
          await startMicrophoneTranscription(realMeetingId);
          setMicCaptured(true);
          setSystemAudioCaptured(true);
        }
      }
      
      // Reset Whisper cost tracking for new meeting
      sessionStorage.setItem('whisper_call_count', '0');
      sessionStorage.setItem('whisper_total_duration', '0');
      console.log('💰 WHISPER_MEETING_TRACKER: reset for new meeting');

      setIsRecording(true);
      isRecordingRef.current = true;
      // Recording start time already set earlier - don't reset it here
      
      // Session persistence is handled by MeetingSetupBridge effect
      startHeartbeat();
      consumeRecovery(); // Dismiss any recovery banner now that we're recording
      startHeartbeat();
      
      // Backup recorder is started later, after audio streams are fully initialised
      setRealtimeTranscripts([]);
      setChunkSaveStatuses([]);
      setSpeakerCount(1);
      setStartTime(generateMeetingTimestamp());
      setConnectionStatus("Connected");

      // Start overlapping chunk recording for system audio (only if not microphone-only and not using screen share)
      if (recordingMode === 'mic-and-system' && !useScreenShare) {
        await startOverlappingChunks(realMeetingId);
      }
      
      addDebugLog('✅ Recording started successfully');
      
      // Start AssemblyAI real-time transcription alongside Whisper
      try {
        console.log('🎤 Starting AssemblyAI real-time preview...');
        
        // If mixer was already created (unified mic+system Chromium path), reuse it.
        // Otherwise build one now (mic-only or non-Chromium paths).
        if (!assemblyAudioMixerRef.current) {
          // Check if we actually have live system audio tracks to mix
          const systemStreamForAssembly = screenStreamRef.current;
          const hasLiveSystemAudio = systemStreamForAssembly && 
            systemStreamForAssembly.getAudioTracks().some(t => t.readyState === 'live');
          
          if (hasLiveSystemAudio) {
            // MIC + SYSTEM PATH: Build mixer to combine both streams
            const mixerResult = await buildAssemblyAudioStream(
              systemStreamForAssembly,
              { 
                existingMicStream: micAudioStreamRef.current,
                micConstraints: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
              }
            );
            
            assemblyAudioMixerRef.current = mixerResult;
            
            if (mixerResult.hasSystemAudio) {
              setSystemAudioCaptured(true);
              setAssemblyInputMode('mic-and-system');
              addDebugLog('✅ AssemblyAI: Mic + System audio');
            } else {
              // Mixer failed to capture system audio despite live tracks
              setAssemblyInputMode('mic-only');
              addDebugLog('⚠️ AssemblyAI: Mic only (mixer could not capture system audio)');
            }
          } else {
            // MIC-ONLY PATH: Skip mixer entirely — let AssemblyRealtimeClient
            // capture mic directly (same pattern as working Dictate feature)
            setAssemblyInputMode('mic-only');
            
            if (recordingMode === 'mic-and-system') {
              const reasonMessage = !systemStreamForAssembly 
                ? 'No screen share active'
                : 'System audio track ended or is muted';
              addDebugLog(`⚠️ AssemblyAI: Mic only — direct capture (${reasonMessage})`);
              showToast.warning(`Live transcript using microphone only. ${reasonMessage}`, {
                section: 'meeting_manager', duration: 6000
              });
            } else {
              addDebugLog('ℹ️ AssemblyAI: Mic only — direct capture (no mixer needed)');
            }
          }
        } else {
          console.log('🎤 Reusing existing audio mixer for AssemblyAI (unified pipeline)');
        }
        
        // Build keyterms from attendees + agenda for better recognition
        const meetingKeyterms = buildMeetingKeyterms();
        meetingKeytermsRef.current = meetingKeyterms;
        
        // Start preview with the mixed stream and keyterms
        // Pass mixed stream if available, otherwise undefined (direct mic capture like Dictate)
        await assemblyPreview.startPreview(assemblyAudioMixerRef.current?.mixedStream || undefined, { keyterms: meetingKeyterms });
        console.log('✅ AssemblyAI real-time preview started');
      } catch (assemblyError) {
        console.warn('⚠️ AssemblyAI preview failed to start (Whisper will continue):', assemblyError);
        setAssemblyInputMode('inactive');
        cleanupAssemblyAudioStream(assemblyAudioMixerRef.current);
        assemblyAudioMixerRef.current = null;
      }
      
      // Start Deepgram real-time transcription alongside Whisper and AssemblyAI
      try {
        console.log('🎤 Starting Deepgram real-time preview...');
        
        // Deepgram uses its own audio capture from mic - pass meetingId for DB storage
        await deepgramPreview.startPreview(realMeetingId, assemblyAudioMixerRef.current?.mixedStream);
        console.log('✅ Deepgram real-time preview started');
        addDebugLog('✅ Deepgram: Recording started');
      } catch (deepgramError) {
        console.warn('⚠️ Deepgram preview failed to start (other transcriptions will continue):', deepgramError);
        // Don't fail the recording - Whisper and AssemblyAI can continue
      }

      // Start Gladia real-time preview
      try {
        console.log('🎤 Starting Gladia real-time preview...');
        await gladiaPreview.startPreview(realMeetingId, assemblyAudioMixerRef.current?.mixedStream);
        console.log('✅ Gladia real-time preview started');
        addDebugLog('✅ Gladia: Recording started');
      } catch (gladiaError) {
        console.warn('⚠️ Gladia preview failed to start (other transcriptions will continue):', gladiaError);
      }
      
      if (backupEnabled && !isBackupActive) {
        try {
          const backupStream = assemblyAudioMixerRef.current?.mixedStream 
            || micAudioStreamRef.current
            || desktopTranscriberRef.current?.getStream()
            || simpleIOSTranscriberRef.current?.getStream();
          if (backupStream) {
            await startBackup(backupStream);
            console.log('[MeetingRecorder] ✅ Backup recorder started (post-mixer)');
          } else {
            console.warn('[MeetingRecorder] ⚠️ No audio stream available for backup recorder');
          }
        } catch (backupErr) {
          console.warn('[MeetingRecorder] Backup recorder failed to start:', backupErr);
        }
      }

      // Start duration timer
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      // Start transcript snippet monitoring
      startTranscriptSnippetMonitoring();
      
      // Start auto-clean interval (10 minutes)
      if (autoCleanIntervalRef.current) {
        clearInterval(autoCleanIntervalRef.current);
      }
      autoCleanIntervalRef.current = setInterval(() => {
        performAutoTranscriptClean();
      }, 10 * 60 * 1000); // 10 minutes
      console.log('🧹 Auto Deep Clean scheduled every 10 minutes');
      
      // Start live notes generation interval (15 minutes)
      if (liveNotesIntervalRef.current) {
        clearInterval(liveNotesIntervalRef.current);
      }
      liveNotesIntervalRef.current = setInterval(() => {
        generateLiveNotes();
      }, 15 * 60 * 1000); // 15 minutes
      console.log('📝 Live Notes generation scheduled every 15 minutes');
      
      // First live notes generation after 5 minutes to ensure meeting is saved
      if (firstLiveNotesTimeoutRef.current) {
        clearTimeout(firstLiveNotesTimeoutRef.current);
      }
      firstLiveNotesTimeoutRef.current = setTimeout(() => {
        console.log('📝 Triggering first live notes generation...');
        generateLiveNotes();
      }, 5 * 60 * 1000); // 5 minutes

      // Toast notification removed per user request
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      addDebugLog(`❌ Failed to start: ${error.message}`);
      
      // Provide specific error messages
      const isChromeError = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
      const isEdgeError = /Edg/.test(navigator.userAgent);
      const browserName = isChromeError ? 'Chrome' : isEdgeError ? 'Edge' : 'your browser';
      
      let errorMessage = error.message || 'Failed to start recording';
      
      if (error.message === 'NO_TAB_AUDIO_SELECTED') {
        errorMessage = `No meeting audio detected. You selected a Window or Screen instead of a Chrome Tab. Please restart and select a Chrome Tab with "Also share tab audio" ticked.`;
      } else if (error.message === 'SCREEN_SHARE_CANCELLED') {
        errorMessage = `Screen sharing cancelled. To record meeting audio, you must share a browser tab.`;
      } else if (error.message === 'SCREEN_SHARE_FAILED') {
        errorMessage = `Failed to access screen sharing. Please ensure you're using ${browserName} and select a browser tab with audio.`;
      } else if (recordingMode === 'mic-and-system') {
        errorMessage = `Failed to capture meeting audio in ${browserName}. Please ensure you select a Chrome Tab (not Window) and tick "Also share tab audio".`;
      }
      
      showToast.error(errorMessage, { section: 'meeting_manager', duration: 8000 });
      
      setIsRecording(false);
      isRecordingRef.current = false;
      recordingStartTimeRef.current = null;
      lastChunkEndTime.current = null;
      setConnectionStatus("Error");
      setMicCaptured(false);
      setSystemAudioCaptured(false);
    } finally {
      // Always reset the starting lock to allow future attempts
      isStartingRecordingRef.current = false;
    }
  };

  const stopRecording = async (options?: { serverTriggered?: boolean }) => {
    const isServerTriggered = options?.serverTriggered ?? false;
    
    // CRITICAL: Capture duration at the START before any async operations or state resets
    // This prevents race conditions where duration is reset to 0 before validation
    let capturedDuration = duration;
    
    // Diagnostic: capture call stack so we can trace what triggered the stop
    console.log('STOP_RECORDING_CALLED', {
      source: new Error().stack?.split('\n')[2]?.trim(),
      duration: capturedDuration,
      isServerTriggered
    });
    console.log('📊 Captured duration at stop start:', capturedDuration, 'isServerTriggered:', isServerTriggered);
    
    // Guard: prevent multiple simultaneous stop operations (state can lag)
    if (stopInProgressRef.current) {
      console.log('⚠️ Stop already in progress (ref), ignoring duplicate call');
      return;
    }
    stopInProgressRef.current = true;
    
    // CROSSOVER PREVENTION: Increment generation counter immediately (before any async work)
    // This causes all in-flight transcript callbacks to detect staleness and drop
    recordingGenerationRef.current++;
    console.log(`🔒 Recording generation incremented to ${recordingGenerationRef.current} -- stale callbacks will be dropped`);
    
    // CROSSOVER PREVENTION: Capture transcript text BEFORE clearing buffers
    // so word-count validation uses the real values
    const capturedAssemblyTranscript = assemblyPreview.fullTranscript || '';
    const capturedDeepgramTranscript = deepgramPreview.fullTranscript || '';
    const capturedGladiaTranscript = gladiaPreview.fullTranscript || '';
    
    // Now clear real-time transcript buffers so they don't bleed into the next meeting
    assemblyPreview.clearTranscript();
    deepgramPreview.clearTranscript();
    gladiaPreview.clearTranscript();
    
    // CROSSOVER PREVENTION: Capture and then remove sessionStorage meeting ID synchronously
    // Late-arriving callbacks can no longer read a stale meeting ID
    const capturedMeetingId = sessionStorage.getItem('currentMeetingId');
    sessionStorage.removeItem('currentMeetingId');
    console.log(`🔒 Captured meetingId ${capturedMeetingId} and cleared sessionStorage`);
    
    if (!isStoppingRecording) setIsStoppingRecording(true);
    setIsFinalisingMeeting(true);
    setStopRecordingStep('Stopping recording...');
    
    // Check word count before processing.
    // Use the best available transcript so meetings aren't discarded if AssemblyAI is down.
    const assemblyWords = countWords(capturedAssemblyTranscript);
    const whisperWords = countWords(transcript);
    const deepgramWords = countWords(capturedDeepgramTranscript);
    const gladiaWords = countWords(capturedGladiaTranscript);
    let effectiveWords = Math.max(assemblyWords, whisperWords, deepgramWords, gladiaWords);
    console.log('📊 Meeting word count (client):', { effective: effectiveWords, assembly: assemblyWords, whisper: whisperWords, deepgram: deepgramWords, gladia: gladiaWords, serverTriggered: isServerTriggered });
    
    // CRITICAL: If client state shows low word count OR server triggered the stop,
    // query the database for actual word count AND duration - client state may be stale/empty
    const currentMeetingIdForCheck = capturedMeetingId;
    if ((effectiveWords < 100 || isServerTriggered || capturedDuration < 5) && currentMeetingIdForCheck) {
      try {
        console.log('🔍 Checking database for actual word count and duration...');
        
        // Get chunks for word count
        const { data: chunks, error: chunksError } = await supabase
          .from('meeting_transcription_chunks')
          .select('transcription_text')
          .eq('meeting_id', currentMeetingIdForCheck);
        
        if (!chunksError && chunks && chunks.length > 0) {
          const dbWordCount = chunks.reduce((total, chunk) => {
            return total + countWords(chunk.transcription_text || '');
          }, 0);
          console.log('📊 Database word count:', dbWordCount, 'vs client:', effectiveWords);
          effectiveWords = Math.max(effectiveWords, dbWordCount);
        }
        
        // Get meeting start_time to calculate actual duration if client duration is suspect
        if (capturedDuration < 5 || isServerTriggered) {
          const { data: meeting, error: meetingError } = await supabase
            .from('meetings')
            .select('start_time, created_at')
            .eq('id', currentMeetingIdForCheck)
            .maybeSingle();
          
          if (!meetingError && meeting) {
            const startTime = meeting.start_time || meeting.created_at;
            if (startTime) {
              const startDate = new Date(startTime);
              const nowDate = new Date();
              const dbDurationSeconds = Math.floor((nowDate.getTime() - startDate.getTime()) / 1000);
              console.log('📊 Database duration:', dbDurationSeconds, 'vs client:', capturedDuration);
              capturedDuration = Math.max(capturedDuration, dbDurationSeconds);
            }
          }
        }
      } catch (err) {
        console.error('Failed to check database word count/duration:', err);
      }
    }
    
    if (effectiveWords < 100) {
      console.log('📊 Skipping processing animation - meeting too short (<100 words)');
      
      // Just stop recording without the processing modal
      
      // Stop duration timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Stop auto-clean interval
      if (autoCleanIntervalRef.current) {
        clearInterval(autoCleanIntervalRef.current);
        autoCleanIntervalRef.current = null;
      }
      
      // Stop live notes interval
      if (liveNotesIntervalRef.current) {
        clearInterval(liveNotesIntervalRef.current);
        liveNotesIntervalRef.current = null;
      }
      
      // Stop heartbeat interval
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      
      // Stop chunk start timeout
      if (chunkStartTimeoutRef.current) {
        clearTimeout(chunkStartTimeoutRef.current);
        chunkStartTimeoutRef.current = null;
      }
      
      // Stop first live notes timeout
      if (firstLiveNotesTimeoutRef.current) {
        clearTimeout(firstLiveNotesTimeoutRef.current);
        firstLiveNotesTimeoutRef.current = null;
      }
      
      // Stop all transcribers asynchronously to avoid UI freeze
      try {
        if (browserTranscriberRef.current) {
          browserTranscriberRef.current.stopTranscription();
          browserTranscriberRef.current = null;
        }
      } catch (e) {
        console.error('Browser transcriber stop error', e);
      }
      
      try {
        if (iPhoneTranscriberRef.current) {
          iPhoneTranscriberRef.current.stopTranscription();
          iPhoneTranscriberRef.current = null;
        }
        if (simpleIOSTranscriberRef.current) {
          await simpleIOSTranscriberRef.current.stop();
          simpleIOSTranscriberRef.current = null;
        }
      } catch (e) {
        console.error('iPhone transcriber stop error', e);
      }
      
      if (desktopTranscriberRef.current) {
        const t = desktopTranscriberRef.current;
        desktopTranscriberRef.current = null;
        // Run heavy stop in background (don't block UI)
        setTimeout(() => {
          t.stopTranscription().catch(err => console.error('Desktop transcriber stop error', err));
        }, 0);
      }
      
      // Stop AssemblyAI real-time preview
      assemblyPreview.stopPreview();
      
      // Stop Deepgram real-time preview
      deepgramPreview.stopPreview();

      // Stop Gladia real-time preview
      gladiaPreview.stopPreview();
      
      // Cleanup AssemblyAI audio mixer
      cleanupAssemblyAudioStream(assemblyAudioMixerRef.current);
      assemblyAudioMixerRef.current = null;
      
      setStopRecordingStep('Releasing audio…');
      
      // Stop microphone stream
      if (micAudioStreamRef.current) {
        micAudioStreamRef.current.getTracks().forEach(track => track.stop());
        micAudioStreamRef.current = null;
      }
      
      // Stop screen stream
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      
      // Stop enhanced audio capture
      if (enhancedAudioCaptureRef.current) {
        enhancedAudioCaptureRef.current.stopCapture();
        enhancedAudioCaptureRef.current = null;
      }
      
      // Stop audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      // Stop overlapping chunks and stereo recording in background
      setTimeout(() => {
        stopOverlappingChunks().catch(e => console.error('stopOverlappingChunks error', e));
        stopStereoRecording().catch(e => console.error('stopStereoRecording error', e));
      }, 0);
      
      // Stop backup recorder (short meeting = no successful transcript)
      if (isBackupActive) {
        try {
          await stopBackup(false, user?.id, capturedMeetingId || undefined);
          console.log('[MeetingRecorder] Backup flushed for short meeting');
        } catch (err) {
          console.warn('[MeetingRecorder] Backup stop error:', err);
        }
      }
      
      setIsRecording(false);
      isRecordingRef.current = false;
      recordingStartTimeRef.current = null; // Reset recording start time
      lastChunkEndTime.current = null; // Reset chunk timing
      setConnectionStatus("Disconnected");
      
      // Clear unsaved meeting data but keep session IDs until meeting is saved
      localStorage.removeItem('unsaved_meeting');
      clearPersistedSession();
      stopHeartbeat();
      // Clear IndexedDB audio chunks on normal stop
      const stoppedMeetingId = sessionStorage.getItem('currentMeetingId');
      if (stoppedMeetingId) {
        clearAudioChunks(stoppedMeetingId).catch(() => {});
      }
      
      // Delete orphaned meeting record from database for short recordings
      const meetingIdToDelete = capturedMeetingId;
      if (meetingIdToDelete) {
        console.log(`🗑️ Deleting short meeting record: ${meetingIdToDelete}`);
        
        // Delete related records first (in parallel for speed)
        const deletePromises = [
          supabase.from('meeting_transcription_chunks').delete().eq('meeting_id', meetingIdToDelete),
          supabase.from('meeting_transcripts').delete().eq('meeting_id', meetingIdToDelete),
          supabase.from('transcription_chunks').delete().eq('meeting_id', meetingIdToDelete),
          supabase.from('audio_chunks').delete().eq('meeting_id', meetingIdToDelete),
        ];
        
        await Promise.all(deletePromises).catch(err => 
          console.error('Error deleting related meeting records:', err)
        );
        
        // Delete the meeting itself
        const { error: deleteError } = await supabase.from('meetings').delete().eq('id', meetingIdToDelete);
        
        if (deleteError) {
          console.error('Failed to delete short meeting:', deleteError);
        } else {
          console.log('✅ Successfully deleted short meeting record');
        }
        
        // Clear session storage
        sessionStorage.removeItem('currentMeetingId');
        sessionStorage.removeItem('currentSessionId');
      }
      
      // Reset the meeting synchronously for short recordings to prevent race conditions
      // when user starts a new meeting immediately after stopping a short one
      setStopRecordingStep('Complete!');
      try {
        await resetMeeting();
      } finally {
        setIsStoppingRecording(false);
        stopInProgressRef.current = false;
      }
      
      // Show toast for short meeting (deduped)
      const backupMsg = isBackupActive || segmentCount > 0
        ? ' Your audio was backed up — use Recovery Tool to retrieve it.'
        : '';
      showToast.info(`Meeting was too short to save (minimum 100 words).${backupMsg}`, {
        section: 'meeting_manager',
        id: 'short_meeting_notice',
        duration: backupMsg ? 7000 : 4000,
      });
      
      return;
    }
    
    // Toast notifications removed - user finds them distracting
    // const savingToastId = showToast.info("Saving meeting...", { section: 'meeting_manager', duration: Infinity });
    
    // Wait 3 seconds to capture final audio chunks
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setStopRecordingStep('Stopping audio streams...');
    
    // NOW stop the transcribers after the processing delay
    
    // Stop browser transcriber and wait for final processing
    if (browserTranscriberRef.current) {
      browserTranscriberRef.current.stopTranscription();
       // Give browser speech recognition time to process final audio segments
       await new Promise(resolve => setTimeout(resolve, 200));
      browserTranscriberRef.current = null;
    }
    
    // Stop iPhone transcriber and wait for final processing  
    if (iPhoneTranscriberRef.current) {
      iPhoneTranscriberRef.current.stopTranscription();
       // Give iPhone transcriber time to process final audio segments
       await new Promise(resolve => setTimeout(resolve, 200));
      iPhoneTranscriberRef.current = null;
    }
    
    // Stop Simple iOS transcriber and wait for final processing
    if (simpleIOSTranscriberRef.current) {
      await simpleIOSTranscriberRef.current.stop();
      simpleIOSTranscriberRef.current = null;
    }
    
    // Stop desktop transcriber and wait for final processing
    if (desktopTranscriberRef.current) {
      await desktopTranscriberRef.current.stopTranscription();
       // Give extra time for final transcription to be processed and combined
       await new Promise(resolve => setTimeout(resolve, 200));
      desktopTranscriberRef.current = null;
    }
    
    // Stop AssemblyAI real-time preview
    assemblyPreview.stopPreview();
    setAssemblyInputMode('inactive');
    
    // Stop Deepgram real-time preview
    deepgramPreview.stopPreview();

    // Stop Gladia real-time preview
    gladiaPreview.stopPreview();
    
    // Cleanup AssemblyAI audio mixer
    cleanupAssemblyAudioStream(assemblyAudioMixerRef.current);
    assemblyAudioMixerRef.current = null;
    
    console.log('🚨 STOP RECORDING FUNCTION CALLED');
    
    setIsStoppingRecording(true);
    
    // Stop duration timer
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Stop auto-clean interval
    if (autoCleanIntervalRef.current) {
      clearInterval(autoCleanIntervalRef.current);
      autoCleanIntervalRef.current = null;
    }
    
    // Stop live notes interval
    if (liveNotesIntervalRef.current) {
      clearInterval(liveNotesIntervalRef.current);
      liveNotesIntervalRef.current = null;
    }
    
    // Stop transcript snippet monitoring
    if (transcriptSnippetIntervalRef.current) {
      clearInterval(transcriptSnippetIntervalRef.current);
      transcriptSnippetIntervalRef.current = null;
    }
    
    // Stop heartbeat interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
    // Stop chunk start timeout
    if (chunkStartTimeoutRef.current) {
      clearTimeout(chunkStartTimeoutRef.current);
      chunkStartTimeoutRef.current = null;
    }
    
    // Stop first live notes timeout
    if (firstLiveNotesTimeoutRef.current) {
      clearTimeout(firstLiveNotesTimeoutRef.current);
      firstLiveNotesTimeoutRef.current = null;
    }
    
    // Stop microphone stream
    if (micAudioStreamRef.current) {
      micAudioStreamRef.current.getTracks().forEach(track => track.stop());
      micAudioStreamRef.current = null;
    }
    
    // Stop screen stream (computer audio)
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    // Stop enhanced audio capture
    if (enhancedAudioCaptureRef.current) {
      enhancedAudioCaptureRef.current.stopCapture();
      enhancedAudioCaptureRef.current = null;
    }
    
    // Stop audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Helper to wrap promises with a timeout to prevent UI from getting stuck
    const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => {
          console.warn(`⚠️ Operation timed out after ${timeoutMs}ms, continuing with fallback`);
          resolve(fallback);
        }, timeoutMs))
      ]);
    };
    
    // Stop overlapping chunk recording (with 10s timeout)
    await withTimeout(stopOverlappingChunks(), 10000, undefined);
    
    // Stop stereo recording (with 15s timeout for long recordings)
    const stereoBlob = await withTimeout(stopStereoRecording(), 15000, null);
    
    // Create audio URL for playback from the recorded stereo audio
    if (stereoBlob && stereoBlob.size > 0) {
      const audioUrl = URL.createObjectURL(stereoBlob);
      setRecordingAudioUrl(audioUrl);
      setRecordingBlob(stereoBlob); // Store the actual blob
      
      // Create separate URLs for each channel and wait for completion
      // Channel splitting disabled to prevent main-thread blocking
      
      console.log('✅ Stereo recording audio ready for playback:', {
        size: stereoBlob.size,
        url: audioUrl,
        channels: 'Left=Mic, Right=System'
      });
    } else {
      console.warn('⚠️ No stereo recording available - no audio will be saved');
      setRecordingAudioUrl(null);
      setRecordingBlob(null);
    }
    
      // Stop backup recorder — transcript is considered successful if we got past the short-meeting gate
      if (isBackupActive) {
        const currentMeetingIdForBackup = capturedMeetingId || undefined;
        stopBackup(true, user?.id, currentMeetingIdForBackup).catch(err =>
          console.warn('[MeetingRecorder] Backup stop error:', err)
        );
      }
      
      setIsRecording(false);
      isRecordingRef.current = false;
      recordingStartTimeRef.current = null; // Reset recording start time
      lastChunkEndTime.current = null; // Reset chunk timing
    setConnectionStatus("Disconnected");
    
    // Clear unsaved meeting data when stopping normally
    localStorage.removeItem('unsaved_meeting');
    clearPersistedSession();
    stopHeartbeat();
    // Clear IndexedDB audio chunks on normal stop
    const stoppedMeetingId2 = sessionStorage.getItem('currentMeetingId');
    if (stoppedMeetingId2) {
      clearAudioChunks(stoppedMeetingId2).catch(() => {});
    }
    
    console.log('Recording stopped');
    
    // Use capturedDuration (set at start of function) to avoid race conditions with state resets
    console.log('🚨 VALIDATION CHECKS - CapturedDuration:', capturedDuration, 'StateDuration:', duration, 'WordCount:', wordCount);
    
    // Relaxed validation - only require 5 seconds and any transcript content
    // Use capturedDuration which was set at the start and potentially augmented from DB
    if (capturedDuration < 5) {
      console.log('🚨 VALIDATION FAILED - Duration too short:', capturedDuration);
      showToast.error('Recording too short. Minimum 5 seconds required.', { section: 'meeting_manager' });
      setIsStoppingRecording(false);
      stopInProgressRef.current = false;
      return;
    }

    // For iPhone compatibility - accept any transcript content
    if (!transcript && wordCount < 5) {
      console.log('🚨 VALIDATION FAILED - No transcript content:', { transcript: transcript?.length, wordCount });
      showToast.error('No transcript content detected.', { section: 'meeting_manager' });
      setIsStoppingRecording(false);
      stopInProgressRef.current = false;
      return;
    }
    
    console.log('🚨 VALIDATION PASSED - proceeding to save... capturedDuration:', capturedDuration);
    
    // Check if audio backup is needed based on word count vs capturedDuration
    const needsAudioBackup = shouldCreateAudioBackup(wordCount, capturedDuration);
    console.log(`📊 Audio backup needed: ${needsAudioBackup}`);

    // STOP all real-time processing immediately to prevent interference
    setRealtimeTranscripts([]); // Clear any pending real-time transcripts

    console.log('🔍 Consolidating chunks from database...');
    
    // Get the current meeting ID for chunk consolidation
    const currentMeetingId = capturedMeetingId;
    
    // Wait 2 seconds for in-flight chunks to save
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Query all chunks from database for reliable consolidation
    const { data: allChunks, error: chunksError } = currentMeetingId ? await supabase
      .from('meeting_transcription_chunks')
      .select('transcription_text, chunk_number, word_count, cleaned_text, cleaning_status')
      .eq('meeting_id', currentMeetingId)
      .order('chunk_number') : { data: null, error: null };

    let finalTranscript = '';
    let totalChunkWords = 0;

    if (chunksError) {
      console.error('❌ Error fetching chunks:', chunksError);
      // Fallback to in-memory transcript
      finalTranscript = (transcript || '').trim();
    } else if (allChunks && allChunks.length > 0) {
      console.log(`📊 Found ${allChunks.length} chunks in database`);
      
      // Use cleaned text if available, otherwise use raw transcription
      finalTranscript = allChunks
        .map(chunk => {
          // Count words from chunk
          totalChunkWords += chunk.word_count || 0;
          
          // Use cleaned text if available and status is completed
          if (chunk.cleaned_text && chunk.cleaning_status === 'completed') {
            return chunk.cleaned_text;
          }
          
          // Otherwise parse raw transcription_text
          try {
            const parsed = JSON.parse(chunk.transcription_text);
            if (Array.isArray(parsed)) {
              return parsed.map(seg => seg.text || '').join(' ');
            }
            return chunk.transcription_text;
          } catch {
            return chunk.transcription_text;
          }
        })
        .join(' ')
        .trim();
      
      console.log(`✅ Consolidated transcript: ${finalTranscript.length} chars, ${totalChunkWords} words from chunks`);
    } else {
      console.log('⚠️ No chunks found in DB — attempting emergency recovery from in-memory sources');
      
      // EMERGENCY SAFETY NET: Try all available in-memory transcript sources
      const inMemoryTranscript = (transcript || '').trim();
      const assemblyTranscript = (capturedAssemblyTranscript || '').trim();
      const deepgramTranscript = (capturedDeepgramTranscript || '').trim();
      const orphanedChunks = (sessionStorage.getItem('orphanedIOSChunks') || '').trim();
      
      // Pick the longest available transcript as the emergency fallback
      const candidates = [
        { source: 'whisper-memory', text: inMemoryTranscript },
        { source: 'assemblyai-preview', text: assemblyTranscript },
        { source: 'deepgram-preview', text: deepgramTranscript },
        { source: 'gladia-preview', text: (capturedGladiaTranscript || '').trim() },
        { source: 'orphaned-ios-chunks', text: orphanedChunks },
      ].filter(c => c.text.length > 0);
      
      if (candidates.length > 0) {
        const best = candidates.reduce((a, b) => a.text.length >= b.text.length ? a : b);
        finalTranscript = best.text;
        console.log(`🚨 EMERGENCY RECOVERY: Using ${best.source} (${finalTranscript.length} chars, ${countWords(finalTranscript)} words)`);
        
        // Persist this emergency transcript to the DB so it's not lost
        if (currentMeetingId && finalTranscript.length > 0) {
          try {
            const { data: { user: emergencyUser } } = await supabase.auth.getUser();
            if (emergencyUser) {
              await supabase.from('meeting_transcription_chunks').insert({
                meeting_id: currentMeetingId,
                user_id: emergencyUser.id,
                chunk_number: 0,
                transcription_text: finalTranscript,
                confidence: 0.7,
                is_final: true,
                transcriber_type: `emergency-${best.source}`,
                start_time: 0,
                end_time: 0,
                session_id: currentMeetingId
              });
              console.log('✅ Emergency transcript saved to DB');
            }
          } catch (emergencyErr) {
            console.error('❌ Failed to save emergency transcript:', emergencyErr);
          }
        }
      } else {
        console.error('🚨 TOTAL DATA LOSS: No transcript available from any source');
        finalTranscript = '';
      }
      
      // Clean up orphaned chunks
      sessionStorage.removeItem('orphanedIOSChunks');
    }
    
    // Inject meeting metadata silently into transcript for AI processing
    const meetingTypeLabel = meetingType === 'teams' ? 'MS Teams' : 
                             meetingType === 'face-to-face' ? 'Face to Face' : 'Hybrid';
    const metadataPrefix = `[MEETING METADATA]
Meeting Type: ${meetingTypeLabel}
${meetingType === 'face-to-face' && meetingLocation ? `Location: ${meetingLocation}` : ''}
[END METADATA]

`;
    
    // Clean the final transcript and prepend metadata
    let currentTranscript = (metadataPrefix + finalTranscript)
      .replace(/Thank you for watching\.?\s*/gi, '')
      .replace(/Thanks for watching\.?\s*/gi, '')
      .trim();
    
    // Transcript is already plain text from state - no heavy processing needed
    
    console.log('🔍 DEBUG: After cleaning - currentTranscript length:', currentTranscript.length, 'chars');
    
    console.log('🔍 DEBUG: Final transcript to use for summary:');
    console.log('🔍 DEBUG: Length:', currentTranscript.length, 'characters');
    console.log('🔍 DEBUG: First 200 chars:', currentTranscript.substring(0, 200));
    console.log('🔍 DEBUG: Last 200 chars:', currentTranscript.slice(-200));
    
    // Skip channel-specific processing to keep UI responsive
    const currentRecordingBlob = recordingBlob || stereoBlob;
    const currentMicBlob = undefined;
    const currentSystemBlob = undefined;
    
    console.log('🎵 Audio blobs status for upload:', {
      recordingBlob: currentRecordingBlob?.size || 'null',
      micBlob: currentMicBlob?.size || 'null', 
      systemBlob: currentSystemBlob?.size || 'null',
      stereoBlob: stereoBlob?.size || 'null'
    });

    // Prepare meeting data with default title based on date/time and word count
    const currentDate = new Date();
    
    // Helper function to add ordinal suffix to day
    const getOrdinalSuffix = (day: number) => {
      if (day >= 11 && day <= 13) return 'th';
      switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    
    const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
    const day = currentDate.getDate();
    const dayWithSuffix = `${day}${getOrdinalSuffix(day)}`;
    const month = currentDate.toLocaleDateString('en-US', { month: 'long' });
    const year = currentDate.getFullYear();
    const time = currentDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    }).toLowerCase();
    
    const defaultTitle = `Meeting - ${dayOfWeek}, ${dayWithSuffix} ${month} ${year} (${time})`;
    
    // Fetch and prepend meeting context from database if available
    let transcriptWithContext = currentTranscript;
    // currentMeetingId already retrieved above for chunk consolidation
    if (currentMeetingId) {
      try {
        const { data: meetingData } = await supabase
          .from('meetings')
          .select('meeting_context')
          .eq('id', currentMeetingId)
          .single();
        
        const contextData = meetingData?.meeting_context as MeetingContext | null;
        
        if (contextData) {
          let contextPrefix = '=== MEETING CONTEXT ===\n\n';
          if (contextData.attendees) {
            contextPrefix += `ATTENDEES:\n${contextData.attendees}\n\n`;
          }
          if (contextData.agenda) {
            contextPrefix += `AGENDA:\n${contextData.agenda}\n\n`;
          }
          if (contextData.additional_notes) {
            contextPrefix += `ADDITIONAL NOTES:\n${contextData.additional_notes}\n\n`;
          }
          if (contextData.uploaded_files && contextData.uploaded_files.length > 0) {
            contextPrefix += 'UPLOADED DOCUMENTS:\n';
            contextData.uploaded_files.forEach(file => {
              contextPrefix += `\n--- ${file.name} ---\n${file.content}\n`;
            });
            contextPrefix += '\n';
          }
          contextPrefix += '=== TRANSCRIPT ===\n\n';
          transcriptWithContext = contextPrefix + currentTranscript;
          console.log('✅ Meeting context prepended to transcript');
        }
      } catch (error) {
        console.error('Error fetching meeting context:', error);
      }
    }
    
    const meetingData = {
      title: meetingSettings?.title?.trim() || initialSettings?.title?.trim() || defaultTitle,
      duration: formatDuration(duration),
      wordCount: wordCount,
      transcript: transcriptWithContext,
      liveTranscriptText: liveTranscriptRef.current?.getCurrentTranscript() || undefined, // Add live transcript from the meeting
      speakerCount: speakerCount,
      startTime: startTime,
      startedBy: user?.email || 'Unknown User',
      practiceId: meetingSettings?.practiceId || initialSettings?.practiceId,
      needsAudioBackup: needsAudioBackup,
      stereoBlob: stereoBlob,
      mixedAudioBlob: currentRecordingBlob,
      leftAudioBlob: currentMicBlob,
      rightAudioBlob: currentSystemBlob,
      meetingFormat: 'meetingFormat' in meetingSettings ? meetingSettings.meetingFormat : 'teams'
    };

    console.log('🚨 SAVING MEETING TO DATABASE FIRST...');
    console.log('🚨 About to save meeting:', meetingData.title);
    
    setStopRecordingStep('Saving transcript...');
    
    console.log('🚨 SAVING MEETING TO DATABASE...');
    
    try {
      
      console.log('🚨 ATTEMPTING DATABASE SAVE...');
    console.log('🚨 Auth user:', user);
    console.log('🚨 User ID:', user?.id);
    console.log('🚨 User email:', user?.email);
    console.log('🚨 User metadata:', user?.user_metadata);
    
    // Check if user is authenticated
    if (!user?.id) {
      throw new Error('User not authenticated - cannot save meeting');
    }
    
    console.log('🚨 Meeting data to save:', {
      title: meetingData.title,
      duration_minutes: Math.ceil(duration / 60),
      meeting_type: 'general',
      start_time: meetingData.startTime,
      status: 'completed',
      user_id: user?.id,
      practice_id: meetingData.practiceId,
      meeting_format: meetingData.meetingFormat
    });

      // 1. Update existing meeting record with final data
      setStopRecordingStep('Updating database...');
      
      const meetingId = capturedMeetingId;
      if (!meetingId) {
        throw new Error('No meeting ID captured at stop start');
      }

      // Check if this was a continuation - combine durations
      const existingDurationStr = sessionStorage.getItem('continuationDuration');
      const existingDurationMins = existingDurationStr ? parseInt(existingDurationStr, 10) : 0;
      const newDurationMins = Math.ceil(duration / 60);
      const totalDurationMins = existingDurationMins + newDurationMins;
      
      console.log(`📊 Duration calculation: existing=${existingDurationMins}m + new=${newDurationMins}m = total=${totalDurationMins}m`);
      
      // Clear continuation state
      sessionStorage.removeItem('continuationDuration');
      setIsContinuationMode(false);
      setContinuationMeetingTitle('');

      const { data: savedMeeting, error: saveError } = await supabase
        .from('meetings')
        .update({
          title: meetingData.title,
          duration_minutes: totalDurationMins,
          status: 'completed'
        })
        .eq('id', meetingId)
        .select()
        .single();

      console.log('🚨 DATABASE UPDATE RESULT:');
      console.log('🚨 SaveError:', saveError);
      console.log('🚨 SavedMeeting:', savedMeeting);

      // Log final Whisper cost for this meeting
      const finalCallCount = sessionStorage.getItem('whisper_call_count') || '0';
      const finalDuration = sessionStorage.getItem('whisper_total_duration') || '0';
      const finalCost = (parseFloat(finalDuration) / 60) * 0.006;
      console.log(`💰 WHISPER_MEETING_FINAL: meeting=${meetingId}, total_whisper_calls=${finalCallCount}, total_audio_duration=${parseFloat(finalDuration).toFixed(1)}s (${(parseFloat(finalDuration) / 60).toFixed(1)} min), estimated_whisper_cost=$${finalCost.toFixed(4)}`);

      // Safety Net 1: Consolidate transcript chunks before generating notes
      setStopRecordingStep('Consolidating transcript chunks...');
      try {
        console.log('🔄 Safety Net 1: Consolidating transcript chunks for meeting:', meetingId);
        
        // CRITICAL: Capture the live transcript BEFORE consolidation can overwrite it
        // This is what the user actually saw during the recording
        const liveTranscriptFromRef = liveTranscriptRef.current?.getCurrentTranscript() || '';
        const inMemoryTranscript = transcript || '';
        
        // Use the longer/better one as our "live" source
        const liveTranscriptToPreserve = liveTranscriptFromRef.length > inMemoryTranscript.length 
          ? liveTranscriptFromRef 
          : inMemoryTranscript;
        
        console.log('📝 Live transcript lengths:', {
          fromRef: liveTranscriptFromRef.length,
          inMemory: inMemoryTranscript.length,
          preserved: liveTranscriptToPreserve.length
        });
        
        // Get chunk count first
        const { count: chunkCount, error: countError } = await supabase
          .from('meeting_transcription_chunks')
          .select('*', { count: 'exact', head: true })
          .eq('meeting_id', meetingId);
        
        if (countError) {
          console.error('Error counting chunks:', countError);
        }
        
        // Always call consolidation, passing the live transcript as a fallback/comparison
        // The edge function will now compare and choose the best source
        console.log(`📊 Calling consolidation with ${chunkCount || 0} chunks and live transcript`);
        
        const { data: consolidationData, error: consolidationError } = await supabase.functions.invoke('consolidate-meeting-chunks', {
          body: { 
            meetingId,
            liveTranscript: liveTranscriptToPreserve 
          }
        });
        
        if (consolidationError) {
          console.error('❌ Consolidation failed:', consolidationError);
          
          // If consolidation fails, save the live transcript directly
          if (liveTranscriptToPreserve.length > 50) {
            console.log('🔄 Fallback: Saving live transcript directly');
            await supabase
              .from('meetings')
              .update({
                live_transcript_text: liveTranscriptToPreserve,
                word_count: liveTranscriptToPreserve.split(/\s+/).filter(w => w.length > 0).length,
                primary_transcript_source: 'browser_live_fallback'
              })
              .eq('id', meetingId);
          }
        } else {
          console.log('✅ Consolidation result:', consolidationData);
        }
        
        // Also trigger batch (Whisper) transcript consolidation for SafeNotes Batch tab
        try {
          console.log('📝 Triggering batch transcript consolidation for Whisper chunks...');
          const { data: batchResult, error: batchError } = await supabase.functions.invoke('consolidate-single-meeting-transcript', {
            body: { meetingId }
          });
          
          if (batchError) {
            console.warn('⚠️ Batch transcript consolidation failed:', batchError);
          } else {
            console.log('✅ Batch transcript consolidation result:', batchResult);
          }
        } catch (batchConsolidateError) {
          console.warn('⚠️ Batch transcript consolidation exception:', batchConsolidateError);
        }
        
        // Save AssemblyAI transcript to assembly_transcript_text for SafeNote modal
        const assemblyTranscript = capturedAssemblyTranscript;
        if (assemblyTranscript && assemblyTranscript.trim().length > 0) {
          console.log('📝 Saving AssemblyAI transcript:', assemblyTranscript.length, 'chars');
          await supabase
            .from('meetings')
            .update({
              assembly_transcript_text: assemblyTranscript.trim()
            })
            .eq('id', meetingId);
        }
      } catch (error) {
        console.error('❌ Exception during chunk consolidation:', error);
      }
      
      // Format duration for display (MM:SS format)
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      const formattedDuration = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      // Post-meeting modal will be shown inside backgroundProcessing() after resetMeeting()
      console.log('⏳ Post-meeting modal will appear after background processing completes');
      
      // Check if auto-generation was triggered
      console.log('🤖 Checking if auto-generation was triggered for meeting:', meetingId);
      
      // Give the trigger a moment to process
      setTimeout(async () => {
        try {
          const { data: queueCheck, error: queueError } = await supabase
            .from('meeting_notes_queue')
            .select('note_type, status, batch_id')
            .eq('meeting_id', meetingId);
          
          if (queueError) {
            console.error('❌ Error checking queue:', queueError);
          } else if (queueCheck && queueCheck.length > 0) {
            console.log('✅ Auto-generation triggered! Queued note types:', queueCheck);
          } else {
            console.log('⚠️ No queue entries found - auto-generation may not have triggered');
            console.log('🔍 Possible reasons: No transcript content, trigger disabled, or error in trigger function');
          }
        } catch (checkError) {
          console.error('❌ Error checking auto-generation status:', checkError);
        }
      }, 2500);
      
      

      if (saveError) {
        console.error('🚨 DATABASE UPDATE FAILED:', saveError);
        throw saveError;
      }

      console.log('🚨 MEETING UPDATED IN DATABASE:', savedMeeting.id);

      // 2. Save transcript with post-save validation
      if (meetingData.transcript) {
        const { error: transcriptError } = await supabase
          .from('meeting_transcripts')
          .insert({
            meeting_id: savedMeeting.id,
            speaker_name: 'Meeting Recording',
            content: meetingData.transcript,
            timestamp_seconds: 0,
            confidence_score: 1.0
          });
          
        if (transcriptError) {
          console.error('❌ Transcript save error:', transcriptError);
          showToast.error('Failed to save transcript - retrying...', { section: 'meeting_manager' });
          
          // Retry once after brief delay
          await new Promise(resolve => setTimeout(resolve, 2000));
          const { error: retryError } = await supabase
            .from('meeting_transcripts')
            .insert({
              meeting_id: savedMeeting.id,
              speaker_name: 'Meeting Recording',
              content: meetingData.transcript,
              timestamp_seconds: 0,
              confidence_score: 1.0
            });
            
          if (retryError) {
            console.error('❌ Transcript save retry failed:', retryError);
            showToast.error('Transcript save failed - check Meeting History', { section: 'meeting_manager' });
          } else {
            console.log('✅ Transcript saved on retry');
            showToast.success('Transcript saved successfully', { section: 'meeting_manager' });
          }
        } else {
          console.log('✅ Transcript saved successfully');
          
          // POST-SAVE VALIDATION: Verify saved transcript
          setTimeout(async () => {
            const { data: savedTranscript, error: validateError } = await supabase
              .from('meeting_transcripts')
              .select('content')
              .eq('meeting_id', savedMeeting.id)
              .single();
              
            if (validateError || !savedTranscript) {
              console.error('❌ Post-save validation failed:', validateError);
              showToast.error('Transcript validation failed - may need manual check', { section: 'meeting_manager' });
            } else {
              const savedLength = savedTranscript.content.length;
              const originalLength = meetingData.transcript.length;
              const lengthRatio = savedLength / originalLength;
              
              if (lengthRatio < 0.95 || lengthRatio > 1.05) {
                console.warn(`⚠️ Saved transcript length mismatch: ${savedLength} vs ${originalLength}`);
                showToast.warning('Transcript may be incomplete - check Meeting History', { section: 'meeting_manager' });
              } else {
                console.log(`✅ Validation passed: ${savedLength} chars saved correctly`);
              }
            }
          }, 1000);
        }
      }

      // Toast notifications removed - user finds them distracting
      // showToast.dismiss(savingToastId);
      // const formattedTitle = meetingData.title || `Meeting - ${new Date().toLocaleDateString()}`;
      // showToast.success(`Meeting saved: ${formattedTitle}`, { section: 'meeting_manager' });

      // Start background processing immediately (don't block UI)
      console.log('🤖 Starting background processing (notes generation, cleanup)...');
      
      // Background processing - this runs asynchronously without blocking the UI
      const backgroundProcessing = async () => {
        try {
          // Update meeting status to queued
          console.log('🔍 Background: Updating meeting status to queued...');
          await supabase
            .from('meetings')
            .update({ notes_generation_status: 'queued' })
            .eq('id', savedMeeting.id);

          // Add to notes generation queue
          console.log('🔍 Background: Adding to notes generation queue...');
          await supabase
            .from('meeting_notes_queue')
            .insert({
              meeting_id: savedMeeting.id,
              status: 'pending',
              detail_level: 'standard',
              priority: 1
            });

          // Trigger background generation (fire and forget)
          setStopRecordingStep('Generating notes...');
          
          // Load user's preferred note type
          let preferredNoteType = 'standard';
          try {
            const { data: noteTypePref } = await supabase
              .from('user_settings')
              .select('setting_value')
              .eq('user_id', user.id)
              .eq('setting_key', 'preferred_note_type')
              .maybeSingle();
            
            if (noteTypePref?.setting_value) {
              preferredNoteType = typeof noteTypePref.setting_value === 'string'
                ? noteTypePref.setting_value
                : (noteTypePref.setting_value as any)?.noteType || 'standard';
              console.log('📝 Using user preferred note type for generation:', preferredNoteType);
            }
          } catch (err) {
            console.warn('Failed to load note type preference, using standard:', err);
          }

          const modelOverride = resolveMeetingModel();
          console.log('🧠 Using model for initial generation:', modelOverride ?? '(server default: Gemini 3.1 Pro)');
          const skipQc = localStorage.getItem('meeting-qc-enabled') !== 'true';
          
          // Fire-and-forget: do NOT await the edge function — long meetings (60min+)
          // can take 2-3 minutes to generate notes, exceeding the browser fetch timeout.
          // The function runs server-side regardless of client connection.
          supabase.functions
            .invoke('auto-generate-meeting-notes', {
              body: { 
                meetingId: savedMeeting.id,
                forceRegenerate: false,
                ...modelOverrideField(),
                skipQc,
              }
            })
            .then(result => {
              if (result.error) {
                console.error('❌ Background notes generation failed:', result.error);
              } else {
                console.log('🎉 Background notes generation completed (via auto-generate-meeting-notes pipeline)');
              }
            })
            .catch(err => {
              // Client timeout is expected for long meetings — the edge function
              // continues running server-side. This is NOT a real failure.
              console.warn('⚠️ Notes generation request timed out client-side (expected for long meetings):', err?.message);
            });
          
          console.log('🚀 Notes generation triggered (fire-and-forget) for meeting:', savedMeeting.id);
          
          // Safety net: if notes haven't started generating after 3 minutes,
          // retry the edge function call once. This catches cases where the
          // initial fire-and-forget request was dropped entirely.
          setTimeout(async () => {
            try {
              const { data: check } = await supabase
                .from('meetings')
                .select('notes_generation_status')
                .eq('id', savedMeeting.id)
                .single();
              
              if (check?.notes_generation_status === 'not_started' || check?.notes_generation_status === 'queued') {
                console.warn('🔄 Safety net: notes still not generating after 3min, retrying...');
                supabase.functions
                  .invoke('auto-generate-meeting-notes', {
                    body: { meetingId: savedMeeting.id, forceRegenerate: false, ...modelOverrideField(), skipQc }
                  })
                  .catch(() => console.warn('Safety net retry also timed out client-side'));
              }
            } catch (e) {
              console.warn('Safety net check failed:', e);
            }
          }, 180_000); // 3 minutes

          // Clean up session storage
          sessionStorage.removeItem('currentSessionId');
          sessionStorage.removeItem('currentMeetingId');
          console.log('✅ Background: Session storage cleaned');

          // Signal to Meeting History
          signalMeetingHistoryRefresh();
          
          console.log('✅ Background processing completed');
          
          // Format duration for display (MM:SS format)
          const minutes = Math.floor(duration / 60);
          const seconds = duration % 60;
          const formattedDuration = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          
          setStopRecordingStep('Complete!');
          await resetMeeting();
          
          // Show post-meeting modal AFTER resetMeeting so there's no gap
          setLastCompletedMeetingId(savedMeeting.id);
          setLastCompletedMeetingTitle(savedMeeting.title);
          setLastCompletedMeetingDuration(formattedDuration);
          setShowPostMeetingActions(true);
          
          // Keep the "Complete!" overlay up briefly so the post-meeting modal
          // has time to mount before the underlying (reset) recording UI is exposed.
          setTimeout(() => {
            setIsStoppingRecording(false);
            stopInProgressRef.current = false;
          }, 300);
          
          console.log('✅ Recording state reset & post-meeting modal shown');
        } catch (error) {
          console.error('⚠️ Background processing error:', error);
          setStopRecordingStep('Complete!');
          
          await resetMeeting();
          
          // Still show post-meeting modal even if background processing partially failed
          const minutes = Math.floor(duration / 60);
          const seconds = duration % 60;
          const fmt = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          setLastCompletedMeetingId(savedMeeting.id);
          setLastCompletedMeetingTitle(savedMeeting.title);
          setLastCompletedMeetingDuration(fmt);
          setShowPostMeetingActions(true);
          
          // Keep the "Complete!" overlay up briefly so the post-meeting modal
          // has time to mount before the underlying (reset) recording UI is exposed.
          setTimeout(() => {
            setIsStoppingRecording(false);
            stopInProgressRef.current = false;
          }, 300);
          
          console.log('✅ Recording state reset & post-meeting modal shown (after bg error)');
        }
      };

      // Start background processing without awaiting
      backgroundProcessing();

    } catch (error) {
      console.error('❌ Error while saving/finishing recording:', error);
      showToast.error('Something went wrong finishing the recording. We have safely stopped it.', { section: 'meeting_manager' });

      // SAFETY NET: If the meeting was saved but processing failed,
      // still try to fire the edge function so notes generate server-side.
      // The queue processor cron will also pick this up, but this is faster.
      if (capturedMeetingId) {
        try {
          console.log('🔄 Safety net: attempting edge function call for saved meeting:', capturedMeetingId);
          supabase.functions
            .invoke('auto-generate-meeting-notes', {
              body: {
                meetingId: capturedMeetingId,
                forceRegenerate: false,
                ...modelOverrideField(),
                skipQc: true,
              }
            })
            .catch(err => console.warn('Safety net edge function call failed (cron will retry):', err?.message));
        } catch (safetyErr) {
          console.warn('Safety net failed (cron will retry):', safetyErr);
        }
      }

      try {
        await resetMeeting();
      } finally {
        setStopRecordingStep('');
        setIsStoppingRecording(false);
        stopInProgressRef.current = false;
      }
    }
  };

  // Keep stopRecordingRef in sync with stopRecording for health monitor callback
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  });

  // Optional: Background notification when AI notes complete
  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to meeting status updates for background notifications
    const channel = supabase
      .channel('meeting-notes-completion')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meetings',
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          console.log('📡 Background AI update received:', payload);
          
          if (payload.new.notes_generation_status === 'completed') {
            console.log('✅ AI notes completed in background');
          } else if (payload.new.notes_generation_status === 'error') {
            console.log('❌ AI processing failed in background');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'Connected':
      case 'Transcription active':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'Ready for immediate transcription...':
        return <div className="relative">
          <Mic className="h-4 w-4 text-green-500" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>;
      case 'Processing first speech...':
        return <Waves className="h-4 w-4 text-blue-500 animate-bounce" />;
      case 'First transcription complete - continuing...':
        return <CheckSquare className="h-4 w-4 text-green-500" />;
      case 'Connecting...':
        return <Wifi className="h-4 w-4 text-yellow-500 animate-pulse" />;
      case 'Error':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        if (connectionStatus.includes('EARLY MODE')) {
          return <div className="relative">
            <Mic className="h-4 w-4 text-blue-500" />
            <div className="absolute -top-1 -right-1 text-xs">⚡</div>
          </div>;
        }
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'Connected':
      case 'Transcription active':
        return 'default';
      case 'Ready for immediate transcription...':
      case 'Processing first speech...':
      case 'First transcription complete - continuing...':
        return 'default';
      case 'Connecting...':
        return 'secondary';
      case 'Error':
        return 'destructive';
      default:
        if (connectionStatus.includes('EARLY MODE')) {
          return 'outline';
        }
        return 'secondary';
    }
  };

  // Load meeting history
  const loadMeetingHistory = async () => {
    if (!user) return;
    
    setLoadingHistory(true);
    try {
      // Query meetings directly - RLS policies ensure proper access control
      const { data: meetingsData, error } = await supabase
        .from('meetings')
        .select(`
          id,
          title,
          description,
          meeting_type,
          start_time,
          end_time,
          duration_minutes,
          status,
          created_at,
          location,
          format,
          meeting_format,
          meeting_location,
          mixed_audio_url,
          left_audio_url,
          right_audio_url,
          recording_created_at,
          notes_style_3,
          folder_id,
          word_count,
          meeting_overviews (
            overview,
            audio_overview_url,
            audio_overview_text,
            audio_overview_duration
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Batch lightweight counts to avoid heavy per-meeting queries
      const meetingIds = (meetingsData || []).map(m => m.id);

      const [transcriptCounts, summaryExists, documentCounts] = await Promise.all([
        // Transcript chunk counts — skip heavy row fetch, use 0 as default
        Promise.resolve({} as Record<string, number>),

        // Summary existence per meeting
        supabase
          .from('meeting_summaries')
          .select('meeting_id')
          .in('meeting_id', meetingIds)
          .then(({ data }) => {
            const exists: Record<string, boolean> = {};
            data?.forEach((row: any) => {
              exists[row.meeting_id] = true;
            });
            return exists;
          }),

        // Document counts per meeting
        supabase
          .from('meeting_documents')
          .select('meeting_id', { count: 'exact' })
          .in('meeting_id', meetingIds)
          .then(({ data }) => {
            const counts: Record<string, number> = {};
            data?.forEach((row: any) => {
              counts[row.meeting_id] = (counts[row.meeting_id] || 0) + 1;
            });
            return counts;
          })
      ]);

      // Use word_count from already-fetched meetings instead of a separate query
      const totalWords = (meetingsData || []).reduce(
        (sum: number, m: any) => sum + (m.word_count || 0), 0
      );
      setTotalTranscriptWords(totalWords);

      // Build enriched objects without fetching heavy transcript contents
      const meetingsWithCounts = (meetingsData || []).map((meeting: any) => ({
        ...meeting,
        transcript_count: transcriptCounts[meeting.id] || 0,
        summary_exists: !!summaryExists[meeting.id],
        meeting_summary: meeting.notes_style_3 || null,
        overview: meeting.meeting_overviews?.overview || null,
        audio_overview_url: meeting.meeting_overviews?.audio_overview_url || null,
        audio_overview_text: meeting.meeting_overviews?.audio_overview_text || null,
        audio_overview_duration: meeting.meeting_overviews?.audio_overview_duration || null,
        word_count: meeting.word_count || 0,
        document_count: documentCounts[meeting.id] || 0,
        documents: [],
        access_type: 'owner',
        access_level: 'full',
        shared_by: null,
        shared_at: null,
        share_message: null,
        share_id: null
      }));

      setMeetings(meetingsWithCounts);
    } catch (error) {
      console.error('Error loading meeting history:', error);
      showToast.error('Failed to load meeting history', { section: 'meeting_manager' });
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load history when user changes or component mounts
  useEffect(() => {
    if (user) {
      loadMeetingHistory();
    }
  }, [user]);

  // Real-time updates for new meetings — debounced to prevent query cascades
  const lastRefreshRef = useRef(0);
  const DEBOUNCE_MS = 3000;

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('meeting-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meetings',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔄 New meeting inserted (debounced refresh)...', payload);
          const now = Date.now();
          if (now - lastRefreshRef.current < DEBOUNCE_MS) return;
          lastRefreshRef.current = now;
          loadMeetingHistory();
          showToast.success('Meeting history updated automatically', { section: 'meeting_manager' });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meetings',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // For updates, patch local state directly instead of full reload
          console.log('🔄 Meeting updated, patching local state...', payload);
          setMeetings(prev => prev.map(m =>
            m.id === (payload.new as any).id
              ? { ...m, ...(payload.new as any) }
              : m
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Filter meetings based on search query and folder
  useEffect(() => {
    let filtered = meetings;
    
    // Apply folder filter
    if (selectedFolderId) {
      filtered = filtered.filter(meeting => meeting.folder_id === selectedFolderId);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(meeting =>
        meeting.title.toLowerCase().includes(query) ||
        meeting.description?.toLowerCase().includes(query) ||
        meeting.meeting_type.toLowerCase().includes(query)
      );
    }
    
    setFilteredMeetings(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [meetings, searchQuery, selectedFolderId]);

  // Meeting history handlers
  const handleEditMeeting = (meetingId: string) => {
    navigate(`/meeting-summary`, { state: { id: meetingId } });
  };

  const handleViewSummary = (meetingId: string) => {
    handleViewMeetingSummary(meetingId);
  };

  const handleViewTranscript = (meetingId: string) => {
    // Block operation during recording to prevent interference
    if (!isResourceOperationSafe()) {
      showToast.error("Cannot view transcript while recording is active. This prevents audio interference.", { section: 'meeting_manager' });
      return;
    }
    
    try {
      const meeting = meetings.find(m => m.id === meetingId);
      if (meeting) {
        setCurrentMeetingForTranscript(meeting);
        setTranscriptModalOpen(true);
      }
    } catch (error: any) {
      console.error("Error viewing transcript:", error.message);
      showToast.error("Failed to load transcript", { section: 'meeting_manager' });
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      // First, get and delete any associated documents from storage
      const { data: documents } = await supabase
        .from('meeting_documents')
        .select('file_path')
        .eq('meeting_id', meetingId);

      if (documents && documents.length > 0) {
        // Delete files from storage
        const filePaths = documents.map(doc => doc.file_path);
        const { error: storageError } = await supabase.storage
          .from('meeting-documents')
          .remove(filePaths);

        if (storageError) {
          console.warn('Some files could not be deleted from storage:', storageError);
        }

        // Delete document records from database
        await supabase
          .from('meeting_documents')
          .delete()
          .eq('meeting_id', meetingId);
      }

      // Delete transcripts
      await supabase
        .from('meeting_transcripts')
        .delete()
        .eq('meeting_id', meetingId);

      // Delete summaries
      await supabase
        .from('meeting_summaries')
        .delete()
        .eq('meeting_id', meetingId);

      // Delete meeting overviews
      await supabase
        .from('meeting_overviews')
        .delete()
        .eq('meeting_id', meetingId);

      // Delete meeting
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId);

      if (error) throw error;

      loadMeetingHistory(); // Reload the list
    } catch (error) {
      console.error('Error deleting meeting:', error);
    }
  };

  // Multi-select handlers
  const handleSelectMeeting = (meetingId: string, checked: boolean) => {
    if (checked) {
      setSelectedMeetings(prev => [...prev, meetingId]);
    } else {
      setSelectedMeetings(prev => prev.filter(id => id !== meetingId));
    }
  };

  const handleSelectAll = () => {
    if (selectedMeetings.length === filteredMeetings.length) {
      setSelectedMeetings([]);
    } else {
      setSelectedMeetings(filteredMeetings.map(m => m.id));
    }
  };

  const handleMergeMeetings = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('merge-meetings', {
        body: { meetingIds: selectedMeetings }
      });

      if (error) throw error;
      
      // Navigate to the merged meeting's notes
      navigate(`/meeting-summary/${data.meeting.id}`);
      
      setSelectedMeetings([]);
      setIsSelectMode(false);
      loadMeetingHistory();
    } catch (error: any) {
      console.error("Error merging meetings:", error.message);
    }
  };

  const handleDeleteSelected = async () => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .in('id', selectedMeetings)
        .eq('user_id', user?.id);

      if (error) throw error;
      
      setSelectedMeetings([]);
      setIsSelectMode(false);
      loadMeetingHistory();
    } catch (error: any) {
      console.error("Error deleting selected meetings:", error.message);
    }
  };

  const handleDeleteAll = async () => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('user_id', user?.id);

      if (error) throw error;
      
      setDeleteConfirmation("");
      setSelectedMeetings([]);
      setIsSelectMode(false);
      loadMeetingHistory();
    } catch (error: any) {
      console.error("Error deleting all meetings:", error.message);
    }
  };

  const handleClearEmptyMeetings = async () => {
    if (!user?.id) return;
    setIsDeletingEmpty(true);
    try {
      // Use database function to find and delete truly empty meetings
      const { data, error } = await supabase.rpc('cleanup_truly_empty_meetings', {
        p_user_id: user.id,
        p_min_age_minutes: 30,
        p_max_word_threshold: 0
      });
      if (error) throw error;
      const count = data?.[0]?.deleted_count || 0;
      if (count > 0) showToast.success(`Cleared ${count} truly empty meeting${count > 1 ? 's' : ''}`);
      else showToast.info('No empty meetings to clear');
      loadMeetingHistory();
    } catch (error: any) {
      console.error("Error clearing empty meetings:", error.message);
      showToast.error('Failed to clear empty meetings');
    } finally {
      setIsDeletingEmpty(false);
    }
  };

  const handleDeleteEmptyMeetings = async () => {
    if (!user?.id) return;
    setIsDeletingEmpty(true);
    setShowDeleteEmptyDialog(false);
    try {
      // Use database function to find and delete meetings with less than 100 actual words
      const { data, error } = await supabase.rpc('cleanup_truly_empty_meetings', {
        p_user_id: user.id,
        p_min_age_minutes: 30,
        p_max_word_threshold: 100
      });
      if (error) throw error;
      const count = data?.[0]?.deleted_count || 0;
      if (count > 0) showToast.success(`Deleted ${count} meeting${count > 1 ? 's' : ''} with less than 100 words`);
      else showToast.info('No meetings with less than 100 words found');
      loadMeetingHistory();
    } catch (error: any) {
      console.error("Error deleting empty meetings:", error.message);
      showToast.error('Failed to delete empty meetings');
    } finally {
      setIsDeletingEmpty(false);
    }
  };

  // Save meeting title function
  const handleSaveTitle = async (meetingId: string) => {
    if (!editingTitle.trim() || editingTitle.length > 100) {
      return;
    }

    setIsSavingTitle(true);
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ title: editingTitle.trim() })
        .eq('id', meetingId)
        .eq('user_id', user?.id);

      if (error) throw error;

      // Update local state
      setMeetings(prev => prev.map(meeting => 
        meeting.id === meetingId 
          ? { ...meeting, title: editingTitle.trim() }
          : meeting
      ));
      
      setEditingMeetingId(null);
      setEditingTitle("");
    } catch (error: any) {
      console.error("Error updating meeting title:", error.message);
    } finally {
      setIsSavingTitle(false);
    }
  };

  // Start editing meeting title
  const handleStartEdit = (meetingId: string, currentTitle: string) => {
    setEditingMeetingId(meetingId);
    setEditingTitle(currentTitle);
  };

  // Cancel editing meeting title
  const handleCancelEdit = () => {
    setEditingMeetingId(null);
    setEditingTitle("");
  };

  // Handle viewing meeting summary - OPTIMISED: Open modal immediately, load data in background
  const handleViewMeetingSummary = async (meetingId: string) => {
    console.log('🔍 handleViewMeetingSummary called with meetingId:', meetingId);
    
    // Block operation during recording to prevent interference
    if (!isResourceOperationSafe()) {
      showToast.error("Cannot view notes while recording is active. This prevents audio interference.", { section: 'meeting_manager' });
      return;
    }
    
    // OPTIMISATION: Open modal IMMEDIATELY with minimal data to show loading state
    // This prevents the 40-second wait before modal appears
    setModalMeeting({ 
      id: meetingId, 
      title: 'Loading...', 
      start_time: new Date().toISOString(),
      created_at: new Date().toISOString(),
      _isLoading: true 
    });
    setModalNotes('');
    setFullPageModalOpen(true);
    console.log('📝 Modal opened immediately with loading state');
    
    try {
      // Fetch meeting details and summary in PARALLEL with minimal columns
      console.log('🔍 Fetching meeting data for:', meetingId, 'user:', user?.id);
      
      const [meetingResult, summaryResult] = await Promise.all([
        supabase
          .from('meetings')
          .select('id, title, start_time, end_time, created_at, duration_minutes, notes_style_2, notes_style_3, notes_style_4, notes_style_5')
          .eq('id', meetingId)
          .eq('user_id', user?.id)
          .maybeSingle(), // Changed from .single() to avoid throwing on no match
        supabase
          .from('meeting_summaries')
          .select('summary')
          .eq('meeting_id', meetingId)
          .maybeSingle()
      ]);

      console.log('🔍 Meeting query result:', { 
        data: meetingResult.data ? 'exists' : 'null', 
        error: meetingResult.error?.message || 'none' 
      });
      console.log('🔍 Summary query result:', { 
        data: summaryResult.data ? 'exists' : 'null', 
        error: summaryResult.error?.message || 'none' 
      });

      if (meetingResult.error) {
        console.error('❌ Meeting query error:', meetingResult.error);
        throw meetingResult.error;
      }
      
      if (!meetingResult.data) {
        console.error('❌ Meeting not found for ID:', meetingId);
        showToast.error("Meeting not found", { section: 'meeting_manager' });
        setFullPageModalOpen(false);
        return;
      }
      
      console.log('🔍 Meeting data fetched:', meetingResult.data?.title);
      console.log('🔍 Summary data fetched:', summaryResult.data?.summary ? 'Summary exists' : 'No summary');
      
      // Update modal with actual data
      setModalMeeting(meetingResult.data);
      setModalNotes(meetingResult.data.notes_style_3 || summaryResult.data?.summary || '');
      
    } catch (error: any) {
      console.error("❌ Error Loading Meeting:", error.message, error);
      showToast.error("Failed to load meeting notes: " + (error.message || 'Unknown error'), { section: 'meeting_manager' });
      setFullPageModalOpen(false);
    }
  };

  // Pause/Unpause recording functionality
  const pauseRecording = () => {
    try {
      console.log('Pausing recording...');
      setIsPaused(true);
      
      // Pause transcription services
      if (browserTranscriberRef.current) {
        browserTranscriberRef.current.stopTranscription();
      }
      if (iPhoneTranscriberRef.current) {
        iPhoneTranscriberRef.current.stopTranscription();
      }
      if (simpleIOSTranscriberRef.current) {
        simpleIOSTranscriberRef.current.stop();
      }
      if (desktopTranscriberRef.current) {
        desktopTranscriberRef.current.stopTranscription();
      }
      
      // Stop AssemblyAI live transcription
      assemblyPreview.stopPreview();
      
      // Mute audio streams but keep them alive
      if (micAudioStreamRef.current) {
        micAudioStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
      
      // Pause backup recorder
      pauseBackup();
      
      addDebugLog('⏸️ Recording paused - audio muted and all transcription stopped');
      showToast.success("Recording paused", { section: 'meeting_manager' });
    } catch (error) {
      console.error('Error pausing recording:', error);
      showToast.error("Failed to pause recording", { section: 'meeting_manager' });
    }
  };

  const unpauseRecording = async () => {
    try {
      console.log('Unpausing recording...');
      setIsPaused(false);
      
      // Resume backup recorder
      resumeBackup();
      
      // Unmute audio streams
      if (micAudioStreamRef.current) {
        micAudioStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
      }
      
      // Resume transcription based on current mode
      if (recordingMode === 'mic-only') {
        const resumeMeetingId = sessionStorage.getItem('currentMeetingId') || crypto.randomUUID();
        await startMicrophoneTranscription(resumeMeetingId);
      } else if (recordingMode === 'mic-and-system') {
        const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
        const isEdge = /Edg/.test(navigator.userAgent);
        const resumeMeetingId = sessionStorage.getItem('currentMeetingId') || crypto.randomUUID();
        if (isChrome || isEdge) {
          await startComputerAudioTranscription(resumeMeetingId);
        } else {
          await startMicrophoneTranscription(resumeMeetingId);
        }
      }
      
      // Restart AssemblyAI live transcription (preserve existing transcript)
      // IMPORTANT: Prefer the mixed stream so system audio remains included.
      try {
        const resumeAssemblyStream =
          assemblyAudioMixerRef.current?.mixedStream || micAudioStreamRef.current || undefined;

        await assemblyPreview.startPreview(resumeAssemblyStream, { preserveTranscript: true, keyterms: meetingKeytermsRef.current });
        console.log('✅ AssemblyAI preview resumed after unpause (transcript preserved)');
      } catch (assemblyError) {
        console.warn('⚠️ AssemblyAI preview failed to restart:', assemblyError);
      }
      
      addDebugLog('▶️ Recording resumed - audio unmuted and all transcription restarted');
      showToast.success("Recording resumed", { section: 'meeting_manager' });
    } catch (error) {
      console.error('Error unpausing recording:', error);
      showToast.error("Failed to resume recording", { section: 'meeting_manager' });
    }
  };

  // Settings handlers
  const handleSettingsChange = (newSettings: any) => {
    updateMeetingSettings(newSettings);
  };

              
  return (
    <MeetingSetupProvider>
    <MeetingSetupBridge isRecording={isRecording} duration={duration} onOpenImportModal={(tab, editGroupId) => { setAudioImportDefaultTab(tab || undefined); setEditGroupId(editGroupId || null); setAudioImportOpen(true); }} contextRef={meetingSetupContextRef} />
    <TooltipProvider delayDuration={300}>
    <div className="space-y-6">
      {/* Recording Recovery Banner */}
      {recoveredSession && !isRecording && (
        <RecordingRecoveryBanner
          session={recoveredSession}
          isStale={isRecoveredStale}
          isDuplicateTab={isRecoveredDuplicate}
          onResume={() => {
            // Restore context into MeetingSetupContext and start recording
            // For now, just discard and let user start fresh
            // Full resume with audio continuation is a follow-up item
            consumeRecovery();
            showToast.info('Session context restored. Press Start Recording to continue.', { section: 'meeting_manager', duration: 4000 });
          }}
          onSave={() => {
            // Save what we have — submit the existing meeting for transcription
            // The meeting already exists in the database from the interrupted session
            showToast.info('The interrupted session was already saved to your meeting history.', { section: 'meeting_manager', duration: 5000 });
            discardRecoveredSession();
          }}
          onDiscard={() => {
            discardRecoveredSession();
            showToast.info('Previous session discarded.', { section: 'meeting_manager', duration: 2000 });
          }}
        />
      )}
      {/* Continuation Mode Banner */}
      {isContinuationMode && !isRecording && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Play className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-primary">
                  Continuing: {continuationMeetingTitle}
                </p>
                <p className="text-xs text-muted-foreground">
                  Press record to add more content to this meeting
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsContinuationMode(false);
                  setContinuationMeetingTitle('');
                  sessionStorage.removeItem('continuationMeetingId');
                  sessionStorage.removeItem('continuationDuration');
                  onContinuationComplete?.();
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Tabbed Interface — tab bar replaced by dropdown in RecordingFlowOverlay */}
      <Tabs value={activeTab} onValueChange={(tab) => {
        setActiveTab(tab);
      }} className="w-full">
        {/* Meeting Recorder Tab - ONLY recording controls */}
        <TabsContent value="recorder" className={isRecording ? "space-y-3 mt-1" : "space-y-3 mt-1"}>
          <RecordingFlowOverlay
            isRecording={isRecording}
            onStartRecording={startRecording}
            onStopRecording={handleStopWithConfirmation}
            onOpenImportModal={(tab, editGroupId) => { setAudioImportDefaultTab(tab || undefined); setEditGroupId(editGroupId || null); setAudioImportOpen(true); }}
            formatDuration={formatDuration}
            wordCount={wordCount}
            transcriptText={assemblyPreview.fullTranscript || deepgramPreview.fullTranscript || transcript}
            recentFinals={assemblyPreview.recentFinals}
            currentPartial={assemblyPreview.currentPartial}
            assemblyFullTranscript={assemblyPreview.fullTranscript}
            deepgramText={deepgramPreview.fullTranscript ? deepgramPreview.fullTranscript.trim().split(/\s+/).slice(-30).join(' ') : ''}
            whisperChunkText={transcript ? transcript.trim().split(/\s+/).slice(-50).join(' ') : ''}
            whisperChunkNum={chunkCounter}
            gladiaText={gladiaPreview.fullTranscript ? gladiaPreview.fullTranscript.trim().split(/\s+/).slice(-30).join(' ') : ''}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            hasNewMeetings={meetings.some(m => isNewMeeting(m.created_at))}
            meetingCount={meetings.length}
          >
          <div className="space-y-4">

            {/* Compact Recording Controls */}
            <Card className="shadow-lg">
              <CardContent className="pt-4 pb-4">
                {/* Microphone Settings, Import Audio & Smartphone Icons - hide during recording (available via Edit Context) */}
                <div className={`flex justify-end gap-1 mb-2 ${isRecording ? 'hidden' : ''}`}>
                  <MeetingMicrophoneSettings 
                    onDeviceChange={setSelectedMicrophoneId}
                    onAudioSourceChange={setAudioSourceMode}
                    currentAudioSource={audioSourceMode}
                  />
                  <SmartphoneRecordingHub />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAudioImportOpen(true)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-xs">
                      <p className="font-medium">Import Content</p>
                      <p className="text-xs text-muted-foreground">Import attendees, action items, or agenda via screenshot, paste, or file</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-center space-y-4">
                   {!isRecording ? (
                       <div className="space-y-4">
                        <div className="flex flex-col items-center gap-4">
                          <div className="flex items-center justify-center gap-4">
                            <Button
                             onClick={startRecording}
                             size="lg"
                             disabled={showPostMeetingActions}
                             className={`bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 px-8 py-4 text-base font-semibold rounded-lg ${showPostMeetingActions ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}`}
                           >
                             <Mic className="h-5 w-5 mr-2" />
                             Start Recording
                            </Button>
                          </div>
                          
                          
                          {/* Recovery prompt */}
                          {showRecoveryPrompt && (
                            <BackupRecoveryPrompt
                              onProcessNow={() => {
                                setShowRecoveryPrompt(false);
                                showToast.info('Backup processing started', { section: 'meeting_manager' });
                              }}
                              onKeepForLater={() => setShowRecoveryPrompt(false)}
                            />
                          )}
                        </div>
                     </div>
                   ) : (
                       <div className="space-y-3">
                        {/* Prominent Paused Banner */}
                        {isPaused && (
                          <MeetingPausedBanner onResume={unpauseRecording} />
                        )}
                        
                       <div className={`flex items-center justify-between gap-3 text-primary ${isPaused ? '' : 'animate-pulse'} bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20`}>
                         <div className="flex items-center gap-3">
                           <div className={`w-3 h-3 ${isPaused ? 'bg-amber-500' : 'bg-red-500'} rounded-full ${isPaused ? '' : 'animate-pulse'}`}></div>
                           <span className="text-base font-semibold">
                             {isPaused ? "Recording paused..." : "Recording in progress..."}
                           </span>
                            
                            {/* Backup Indicator */}
                            <span className="hidden sm:inline"><BackupIndicator isActive={isBackupActive} segmentCount={segmentCount} /></span>
                            
                             {/* Audio Activity Indicator - Hidden on iOS */}
                              {!isPaused && audioActivity && !isIOS && (
                                <div className="hidden sm:flex items-center gap-[2px] h-5">
                                  {Array.from({ length: 16 }).map((_, i) => (
                                    <div
                                      key={i}
                                      className="w-[2px] rounded-full bg-green-500"
                                      style={{
                                        animation: `nw-desktop-wave ${0.4 + Math.random() * 0.5}s ease-in-out infinite alternate`,
                                        animationDelay: `${i * 0.05}s`,
                                        opacity: 0.35 + Math.random() * 0.45,
                                      }}
                                    />
                                  ))}
                                </div>
                              )}
                         </div>
                        <div className="flex items-center gap-2">
                          {/* Pause/Unpause Button */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                onClick={isPaused ? unpauseRecording : pauseRecording}
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                              >
                                {isPaused ? (
                                  <Play className="h-4 w-4" />
                                ) : (
                                  <Pause className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{isPaused ? "Resume Recording" : "Pause Recording"}</p>
                            </TooltipContent>
                          </Tooltip>
                           
                         </div>
                        </div>
                      
                       {/* Audio Capture Status Indicator + Quick Source Switcher - Hidden on mobile */}
                       <div className="hidden sm:flex items-center gap-3 flex-wrap">
                         <AudioCaptureStatusIndicator
                           micCaptured={micCaptured}
                           systemAudioCaptured={systemAudioCaptured}
                           recordingMode={recordingMode}
                           isRecording={isRecording}
                           audioActivity={audioActivity}
                           healthStatus={watchdog.healthStatus}
                           timeSinceLastChunk={watchdog.timeSinceLastChunk}
                           totalChunks={watchdog.totalChunks}
                           actualChunksPerMinute={watchdog.actualChunksPerMinute}
                           assemblyInputMode={assemblyInputMode}
                         />
                         
                         {/* Quick Audio Source Switcher - visible during recording */}
                         <QuickAudioSourceSwitcher
                           currentMode={audioSourceMode}
                           onModeChange={switchAudioSourceLive}
                           isRecording={isRecording}
                           isSwitching={isSwitchingAudioSource}
                           micCaptured={micCaptured}
                           systemAudioCaptured={systemAudioCaptured}
                         />
                       </div>
                       
                       {/* Teams Audio Hint - shows when mic-only might be missing other participants */}
                       <TeamsAudioHint
                         visible={teamsAudioDetection.shouldShowHint}
                         onSwitchToSystemAudio={handleSwitchToSystemAudioFromHint}
                         onDismiss={teamsAudioDetection.dismissHint}
                         onAcknowledgeWorking={teamsAudioDetection.acknowledgeWorking}
                       />
                       
                        {/* Ticker tape for live transcription - Hidden on Edge */}
                      {!/Edg/.test(navigator.userAgent) && (
                        <div className={`transition-all duration-500 ${tickerEnabled ? (showTicker ? 'opacity-100 animate-fade-in' : 'hidden') : 'hidden'}`}>
                          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <Waves className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
                              <div className="flex-1 overflow-hidden">
                                <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">Live Speech:</div>
                                <div className="text-sm text-blue-600 dark:text-blue-400 truncate">
                                  {tickerText || "Listening..."}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Transcript snippet display - Hidden on Edge */}
                      {!/Edg/.test(navigator.userAgent) && (
                        <div className={`transition-all duration-500 ${showTranscriptSnippet && tickerEnabled ? 'opacity-100 animate-fade-in' : tickerEnabled ? 'opacity-100' : 'hidden'}`}>
                          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                              <div className="flex-1 overflow-hidden">
                                <div className="text-sm text-green-700 dark:text-green-300 font-medium">Live Speech</div>
                                <div key={transcriptSnippet?.slice(-30) || 'empty'} className="text-xs text-green-600 dark:text-green-400 animate-fade-in transition-all duration-300 italic">
                                  {transcriptSnippet ? `"${transcriptSnippet.split(' ').slice(-50).join(' ')}"` : <span className="text-green-500/70 not-italic">No speech detected yet...</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                         <Button
                          onClick={handleStopWithConfirmation}
                          variant={isStoppingRecording ? "secondary" : "destructive"}
                          size="lg"
                          disabled={isPreparingToStop || isStoppingRecording}
                          className={`shadow-lg transition-all duration-200 px-8 py-4 text-base font-semibold rounded-lg disabled:cursor-not-allowed ${
                            isStoppingRecording 
                              ? 'bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-500 text-amber-700 dark:text-amber-300 animate-pulse' 
                              : 'hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:transform-none'
                          }`}
                        >
                          {isStoppingRecording ? (
                            <>
                              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                              <span className="flex flex-col items-start">
                                <span>Finalising Meeting...</span>
                                {stopRecordingStep && (
                                  <span className="text-xs opacity-80 font-normal">{stopRecordingStep}</span>
                                )}
                              </span>
                            </>
                          ) : (
                            <>
                              <Square className="h-5 w-5 mr-2" />
                              {isPreparingToStop ? "Finishing meeting recording...please wait" : isPaused ? "Meeting Paused" : "Stop Recording"}
                            </>
                          )}
                        </Button>
                       </div>
                    )}
                    
                    
                      {/* Recording Audio Player - Show after recording stops */}
                      {recordingAudioUrl && !isRecording && !isStoppingRecording && (
                        <>
                          {/* On iPhone, show a button to reveal the player instead of auto-showing */}
                          {isIOS && !showRecordingPlayer ? (
                            <div className="mt-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowRecordingPlayer(true)}
                                className="w-full flex items-center justify-center gap-2"
                              >
                                <Headphones className="h-4 w-4" />
                                Show Recording Playback
                              </Button>
                            </div>
                          ) : (
                            <div className="mt-4 space-y-3">
                              {/* Close button for iPhone */}
                              {isIOS && (
                                <div className="flex justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowRecordingPlayer(false)}
                                    className="text-muted-foreground"
                                  >
                                    Hide Player
                                  </Button>
                                </div>
                              )}
                              {/* Mixed Stereo Playback */}
                              <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-full bg-accent/20">
                                      <Headphones className="h-4 w-4 text-accent" />
                                    </div>
                                    <span className="text-sm font-medium">Mixed Recording (Left + Right Channels):</span>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      if (recordingAudioRef.current) {
                                        if (recordingAudioRef.current.paused) {
                                          recordingAudioRef.current.play();
                                        } else {
                                          recordingAudioRef.current.pause();
                                        }
                                      }
                                    }}
                                    className="flex items-center gap-2"
                                  >
                                    <Play className="h-3 w-3" />
                                    Play Mixed
                                  </Button>
                                </div>
                                <audio
                                  ref={recordingAudioRef}
                                  src={recordingAudioUrl}
                                  controls
                                  className="w-full h-10"
                                  preload="metadata"
                                />
                              </div>

                              {/* Left Channel (Microphone) Playback */}
                              {micAudioUrl && (
                                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/50">
                                        <Mic className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                      </div>
                                      <span className="text-sm font-medium">Left Channel Recording (Microphone):</span>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        if (micAudioRef.current) {
                                          if (micAudioRef.current.paused) {
                                            micAudioRef.current.play();
                                          } else {
                                            micAudioRef.current.pause();
                                          }
                                        }
                                      }}
                                      className="flex items-center gap-2"
                                    >
                                      <Play className="h-3 w-3" />
                                      Play Left
                                    </Button>
                                  </div>
                                  <audio
                                    ref={micAudioRef}
                                    src={micAudioUrl}
                                    controls
                                    className="w-full h-10"
                                    preload="metadata"
                                  />
                                </div>
                              )}

                              {/* Right Channel (System Audio) Playback */}
                              {systemAudioUrl && (
                                <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="p-1.5 rounded-full bg-green-100 dark:bg-green-900/50">
                                        <Monitor className="h-4 w-4 text-green-600 dark:text-green-400" />
                                      </div>
                                      <span className="text-sm font-medium">Right Channel Recording (System Audio):</span>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        if (systemAudioRef.current) {
                                          if (systemAudioRef.current.paused) {
                                            systemAudioRef.current.play();
                                          } else {
                                            systemAudioRef.current.pause();
                                          }
                                        }
                                      }}
                                      className="flex items-center gap-2"
                                    >
                                      <Play className="h-3 w-3" />
                                      Play Right
                                    </Button>
                                  </div>
                                  <audio
                                    ref={systemAudioRef}
                                    src={systemAudioUrl}
                                    controls
                                    className="w-full h-10"
                                    preload="metadata"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                 </div>

                {/* Compact Mic Control */}
                <div className="text-center py-4 mt-4 border-t border-border/50">
                  <div className="max-w-sm mx-auto">
                     <button
                       type="button"
                       onClick={onMicButtonClick}
                       disabled={isStoppingRecording || showPostMeetingActions}
                       className={`p-2 rounded-full w-12 h-12 mx-auto mb-2 flex items-center justify-center transition-all duration-200 ${
                         isStoppingRecording
                           ? 'bg-muted cursor-not-allowed opacity-50'
                           : doubleClickProtection 
                             ? 'bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-400 animate-pulse hover:bg-amber-200 dark:hover:bg-amber-900/50 cursor-pointer' 
                             : isRecording 
                               ? 'bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 cursor-pointer' 
                               : 'bg-primary/5 hover:bg-primary/10 cursor-pointer'
                       }`}
                       aria-label={isStoppingRecording ? 'Stopping recording...' : isRecording ? (doubleClickProtection ? 'Click again to stop recording' : 'Double-click to stop recording') : 'Start recording'}
                       title={isStoppingRecording ? 'Stopping recording...' : isRecording ? (doubleClickProtection ? 'Click again to stop recording' : 'Double-click to stop recording') : 'Start recording'}
                     >
                        {isStoppingRecording ? (
                          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                        ) : (
                          <Mic className={`h-6 w-6 ${
                            doubleClickProtection 
                              ? 'text-amber-600 dark:text-amber-400' 
                              : isRecording 
                                ? 'text-red-500' 
                                : 'text-primary/60'
                          }`} />
                        )}
                     </button>
                     {isStoppingRecording ? (
                       <>
                         <h4 className="text-base font-medium mb-1 text-muted-foreground">Stopping...</h4>
                         <p className="text-xs text-muted-foreground">
                           Please wait while the recording is saved
                         </p>
                         {stopRecordingStep && (
                           <div className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 animate-pulse">
                             {stopRecordingStep}
                           </div>
                         )}
                       </>
                     ) : !isRecording ? (
                       <>
                         <h4 className="text-base font-medium mb-1">Ready to Record</h4>
                         <p className="text-xs text-muted-foreground">
                           Allow Microphone Access if Requested
                         </p>
                       </>
                     ) : (
                       <>
                          <h4 className={`text-base font-medium mb-1 ${
                            doubleClickProtection 
                              ? 'text-amber-600 dark:text-amber-400' 
                              : 'text-red-600'
                          }`}>
                            {doubleClickProtection ? 'Click again to stop...' : 'Recording...'}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Your meeting audio is being captured
                          </p>
                         {stopUIStatus && (
                           <div className="mt-2 text-xs font-medium text-purple-600 dark:text-purple-400">
                             {stopUIStatus}
                           </div>
                         )}
                         {stopRecordingStep && (
                           <div className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 animate-pulse">
                             {stopRecordingStep}
                           </div>
                         )}
                       </>
                     )}
                    {/* Live Summary Display */}
                    {liveSummary && (
                      <Card className="mt-4 bg-gradient-to-br from-accent/20 to-accent/10 border-accent/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Waves className="h-4 w-4" />
                            Live Summary
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {liveSummary}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>


              </CardContent>
            </Card>
          </div>
          

          {/* Meeting Controls - Bottom Center - Hidden on iPhone */}
          {!isIOS && !isRecording && (
            <div className="flex justify-center items-center gap-3 pt-4">
              <Button 
                onClick={resetMeeting}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-2" />
                Reset Meeting
              </Button>
            </div>
          )}
          </RecordingFlowOverlay>
        </TabsContent>


        <TabsContent value="transcript" className="space-y-2 mt-2">
          <div className="flex items-center gap-3 py-2 px-1 mb-2">
            <TabDropdown activeTab={activeTab} onTabChange={setActiveTab} hasNewMeetings={meetings.some(m => isNewMeeting(m.created_at))} meetingCount={meetings.length} />
            <h2 className="flex-1 text-[15px] font-extrabold text-foreground tracking-tight">Meeting Transcript</h2>
          </div>
          {/* Transcript Source Switcher */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground">View:</span>
            <div className="flex rounded-lg border bg-muted p-1">
              <Button
                variant={transcriptViewMode === 'batch' ? 'default' : 'ghost'}
                size="sm"
                className="text-xs h-7"
                onClick={() => setTranscriptViewMode('batch')}
              >
                Batch (Whisper)
              </Button>
              <Button
                variant={transcriptViewMode === 'live' ? 'default' : 'ghost'}
                size="sm"
                className="text-xs h-7"
                onClick={() => setTranscriptViewMode('live')}
              >
                Live (Assembly AI)
                {assemblyPreview.isActive && (
                  <span className="ml-1.5 relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                )}
              </Button>
              <Button
                variant={transcriptViewMode === 'deepgram' ? 'default' : 'ghost'}
                size="sm"
                className="text-xs h-7"
                onClick={() => setTranscriptViewMode('deepgram')}
              >
                Deepgram
                {deepgramPreview.isActive && (
                  <span className="ml-1.5 relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Batch (Whisper) Transcript View */}
          {transcriptViewMode === 'batch' && (
            <RealtimeTranscriptCard
              transcriptText={transcript || (isRecording ? "Listening for speech..." : "")}
              isRecording={isRecording}
              wordCount={wordCount}
              confidence={realtimeTranscripts.length > 0 ? realtimeTranscripts[realtimeTranscripts.length - 1]?.confidence : undefined}
              className="border-accent/30"
            />
          )}

          {/* Live (Assembly AI) Transcript View */}
          {transcriptViewMode === 'live' && (
            <Card className="border-accent/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Waves className="h-4 w-4" />
                    Live Transcript (Assembly AI)
                    {assemblyPreview.isActive && (
                      <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700 text-xs">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                        </span>
                        Live
                      </Badge>
                    )}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {assemblyPreview.fullTranscript.split(/\s+/).filter(w => w.length > 0).length} words
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea 
                  className="h-[300px]"
                  ref={(ref) => {
                    // Auto-scroll to bottom when new content arrives
                    if (ref && assemblyPreview.isActive) {
                      const scrollContainer = ref.querySelector('[data-radix-scroll-area-viewport]');
                      if (scrollContainer) {
                        scrollContainer.scrollTop = scrollContainer.scrollHeight;
                      }
                    }
                  }}
                >
                  {assemblyPreview.error ? (
                    <p className="text-sm text-destructive p-4">{assemblyPreview.error}</p>
                  ) : assemblyPreview.fullTranscript ? (
                    <TranscriptDisplay 
                      transcript={assemblyPreview.fullTranscript}
                      isLoading={false}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground italic p-6 text-center">
                      {isRecording ? "Listening for speech..." : "No live transcript available"}
                    </p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Deepgram Transcript View */}
          {transcriptViewMode === 'deepgram' && (
            <Card className="border-blue-500/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Waves className="h-4 w-4 text-blue-500" />
                    Live Transcript (Deepgram Nova-3)
                    {deepgramPreview.isActive && (
                      <Badge variant="default" className="gap-1 bg-blue-600 hover:bg-blue-700 text-xs">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                        </span>
                        Live
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {deepgramPreview.fullTranscript.split(/\s+/).filter(w => w.length > 0).length} words
                    </span>
                    <span className="text-xs text-blue-500">
                      {deepgramPreview.chunkCount} chunks saved
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea 
                  className="h-[300px]"
                  ref={(ref) => {
                    // Auto-scroll to bottom when new content arrives
                    if (ref && deepgramPreview.isActive) {
                      const scrollContainer = ref.querySelector('[data-radix-scroll-area-viewport]');
                      if (scrollContainer) {
                        scrollContainer.scrollTop = scrollContainer.scrollHeight;
                      }
                    }
                  }}
                >
                  {deepgramPreview.error ? (
                    <p className="text-sm text-destructive p-4">{deepgramPreview.error}</p>
                  ) : deepgramPreview.fullTranscript ? (
                    <TranscriptDisplay 
                      transcript={deepgramPreview.fullTranscript}
                      isLoading={false}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground italic p-6 text-center">
                      {isRecording ? "Listening for speech..." : "No Deepgram transcript available"}
                    </p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          )}
          
          {/* Live Transcript with Enhanced Two-Section Layout */}
          <LiveTranscript
            ref={liveTranscriptRef}
            transcript={realtimeTranscripts.length > 0 ? realtimeTranscripts[realtimeTranscripts.length - 1]?.text || "" : ""}
            confidence={realtimeTranscripts.length > 0 ? realtimeTranscripts[realtimeTranscripts.length - 1]?.confidence : undefined}
            showTimestamps={showTimestamps}
            onTimestampsToggle={handleTimestampsToggle}
            attendees={""}
            meetingSettings={{
              practiceId: (meetingSettings as any)?.practiceId || "",
              meetingFormat: (meetingSettings as any)?.meetingFormat || "teams",
              transcriberService: (meetingSettings as any)?.transcriberService || "whisper",
              transcriberThresholds: (meetingSettings as any)?.transcriberThresholds || { whisper: 0.30, deepgram: 0.30 }
            }}
            onMeetingSettingsChange={(settings) => {
              updateMeetingSettings(prev => ({
                ...prev,
                practiceId: settings.practiceId,
                meetingFormat: settings.meetingFormat,
                transcriberService: settings.transcriberService || prev.transcriberService,
                transcriberThresholds: settings.transcriberThresholds || prev.transcriberThresholds
              }));
            }}
            onChunkRejected={(chunkText, reason, chunkNumber) => {
              // Update chunk save status with rejection reason
              if (chunkNumber !== undefined) {
                setChunkSaveStatuses(prevStatuses => 
                  prevStatuses.map(status => 
                    status.chunkNumber === chunkNumber
                      ? { ...status, mergeRejectionReason: reason }
                      : status
                  )
                );
                console.warn(`⚠️ Chunk #${chunkNumber} rejected during merge: ${reason}`);
              }
            }}
          />

          {/* Audio Chunking Live Overview - Show real-time chunk confirmations */}
          <ChunkSaveStatus
            chunks={chunkSaveStatuses} 
            isRecording={isRecording}
            mainTranscript={transcript}
            onMergeUnmergedChunks={handleMergeUnmergedChunks}
          />
        </TabsContent>


        {/* Temporarily hidden - Meeting Settings Tab */}
        {/* <TabsContent value="settings" className="space-y-4 mt-6">
          <MeetingSettings
            onSettingsChange={handleSettingsChange}
            onTranscriptImported={(importedTranscript) => {
              // Handle imported transcript by setting it as the current transcript
              setTranscript(importedTranscript.content);
              setWordCount(importedTranscript.wordCount);
              
              // Update meeting data with imported content
              const currentMeetingData = {
                transcript: importedTranscript.content,
                title: meetingSettings.title || "General Meeting"
              };
              
              // Update the transcript in the UI
              onTranscriptUpdate(importedTranscript.content);
              
              // Enable generate button by setting duration to 1 second
              setDuration(1);
              onDurationUpdate("00:01");
              
              console.log('📄 Transcript imported successfully:', importedTranscript.wordCount, 'words');
            }}
            initialSettings={meetingSettings}
          />
        </TabsContent> */}

        {/* Meeting History Tab */}
        <TabsContent value="history" className="space-y-4 mt-2">
          <div className="flex items-center gap-3 py-2 px-1 mb-2">
            <TabDropdown activeTab={activeTab} onTabChange={setActiveTab} hasNewMeetings={meetings.some(m => isNewMeeting(m.created_at))} meetingCount={meetings.length} />
            <p className="text-[13px] text-muted-foreground ml-3">
              <span className="font-medium text-foreground">
                {meetings.filter(m => 
                  new Date(m.created_at || m.start_time).getMonth() === new Date().getMonth() &&
                  new Date(m.created_at || m.start_time).getFullYear() === new Date().getFullYear()
                ).length}
              </span>
              {' '}this month
              <span className="mx-1.5">·</span>
              <span className="font-medium text-foreground">
                {(() => {
                  const totalMinutes = meetings.reduce((acc, m) => {
                    if (m.duration_minutes && m.duration_minutes > 0) return acc + m.duration_minutes;
                    if (m.start_time && m.end_time) {
                      const diff = (new Date(m.end_time).getTime() - new Date(m.start_time).getTime()) / (1000 * 60);
                      return acc + (diff > 0 ? diff : 0);
                    }
                    return acc;
                  }, 0);
                  const hours = Math.floor(totalMinutes / 60);
                  const mins = Math.round(totalMinutes % 60);
                  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                })()}
              </span>
              {' '}recorded
              <span className="mx-1.5">·</span>
              <span className="font-medium text-foreground">
                {(() => {
                  if (totalTranscriptWords >= 1000000) return `${(totalTranscriptWords / 1000000).toFixed(1)}M`;
                  if (totalTranscriptWords >= 1000) return `${(totalTranscriptWords / 1000).toFixed(1)}k`;
                  return totalTranscriptWords.toString();
                })()}
              </span>
              {' '}words
            </p>
          </div>

          {/* Search and Filter Controls */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search meetings by title, description, or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {folders.length > 0 && (
                <Select
                  value={selectedFolderId || "all"}
                  onValueChange={(value) => setSelectedFolderId(value === "all" ? null : value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All folders" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All folders</SelectItem>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        <div className="flex items-center gap-2">
                          <Folder className="h-3 w-3" style={{ color: folder.colour }} />
                          {folder.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedFolderId && filteredMeetings.length > 0 && (
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {filteredMeetings.length} meeting{filteredMeetings.length > 1 ? 's' : ''}
                </span>
              )}
              <MeetingHistoryViewSelector
                viewMode={layoutViewMode}
                onViewModeChange={setLayoutViewMode}
              />
            </div>

            {/* Multi-select and Delete Controls */}
            {meetings.length > 0 && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsSelectMode(!isSelectMode);
                      setSelectedMeetings([]);
                    }}
                    className="touch-manipulation min-h-[44px]"
                  >
                    {isSelectMode ? (
                      <>
                        <SquareIcon className="h-4 w-4 mr-2" />
                        Cancel Selection
                      </>
                    ) : (
                      <>
                        <CheckSquare className="h-4 w-4 mr-2" />
                        Select Multiple
                      </>
                    )}
                  </Button>
                  
                  {isSelectMode && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAll}
                        className="touch-manipulation min-h-[44px] text-xs sm:text-sm"
                      >
                        {selectedMeetings.length === filteredMeetings.length ? 'Deselect All' : 'Select All'}
                      </Button>
                      
                      {selectedMeetings.length > 0 && (
                        <span className="text-sm text-muted-foreground">
                          {selectedMeetings.length} selected
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  
                  {isSelectMode && selectedMeetings.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          className="touch-manipulation min-h-[44px] text-xs sm:text-sm"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Selected ({selectedMeetings.length})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="mx-4 max-w-md">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Selected Meetings</AlertDialogTitle>
                          <AlertDialogDescription className="text-sm">
                            This action will permanently delete {selectedMeetings.length} meeting{selectedMeetings.length > 1 ? 's' : ''}, their transcripts, and summaries. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                          <AlertDialogCancel className="touch-manipulation min-h-[44px]">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleDeleteSelected}
                            className="bg-destructive hover:bg-destructive/90 touch-manipulation min-h-[44px]"
                          >
                            Delete Selected
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}

                  {meetings.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isDeletingEmpty} className="touch-manipulation min-h-[44px] text-xs sm:text-sm">
                          {isDeletingEmpty ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <MoreVertical className="h-4 w-4 mr-2" />}
                          Quick Actions
                          <ChevronDown className="h-4 w-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={loadMeetingHistory} disabled={loadingHistory}>
                          <RefreshCw className={`h-4 w-4 mr-2 ${loadingHistory ? 'animate-spin' : ''}`} />Refresh Page
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFoldersDialogOpen(true)}>
                          <Folder className="h-4 w-4 mr-2" />Manage Folders
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTeamsImportOpen(true)}>
                          <Video className="h-4 w-4 mr-2" />Load Teams Transcript
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAudioImportOpen(true)}>
                          <Upload className="h-4 w-4 mr-2" />Import Audio Recording(s)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                          <Sparkles className="h-4 w-4 mr-2" />Demonstration Meeting
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowDeleteEmptyDialog(true)} disabled={isDeletingEmpty}>
                          <Trash2 className="h-4 w-4 mr-2" />Delete Empty (&lt;100 words)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowDeleteAllDialog(true)} className="text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />Delete All My Meetings
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <AlertDialog open={showDeleteEmptyDialog} onOpenChange={setShowDeleteEmptyDialog}>
                    <AlertDialogContent className="mx-4 max-w-md">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Empty Meetings</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete all meetings with less than 100 words.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                        <AlertDialogCancel className="touch-manipulation min-h-[44px]">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteEmptyMeetings} className="bg-destructive hover:bg-destructive/90 touch-manipulation min-h-[44px]">Delete Empty</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <AlertDialog open={showDeleteAllDialog} onOpenChange={(open) => {
                    setShowDeleteAllDialog(open);
                    if (!open) {
                      setDeleteAllConfirmChecked(false);
                      setDeleteAllHoldProgress(0);
                    }
                  }}>
                    <AlertDialogContent className="mx-4 max-w-md">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive flex items-center gap-2">
                          <Trash2 className="h-5 w-5" />
                          Delete All My Meetings
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm space-y-3">
                          <p>This will <strong>permanently delete all {meetings.length} meeting{meetings.length > 1 ? 's' : ''}</strong>, including their transcripts, notes, and summaries.</p>
                          <p className="text-destructive font-medium">⚠️ This action cannot be undone. Deleted meetings are not retrievable.</p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="flex items-start space-x-3 py-4 border-t border-b">
                        <Checkbox 
                          id="delete-all-confirm" 
                          checked={deleteAllConfirmChecked}
                          onCheckedChange={(checked) => setDeleteAllConfirmChecked(checked === true)}
                          className="mt-0.5"
                        />
                        <label 
                          htmlFor="delete-all-confirm" 
                          className="text-sm cursor-pointer select-none leading-relaxed"
                        >
                          I understand that all {meetings.length} meetings will be permanently deleted and cannot be recovered.
                        </label>
                      </div>
                      <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                        <AlertDialogCancel className="touch-manipulation min-h-[44px]">Cancel</AlertDialogCancel>
                        <Button
                          variant="destructive"
                          disabled={!deleteAllConfirmChecked}
                          className="touch-manipulation min-h-[44px] relative overflow-hidden"
                          onMouseDown={() => {
                            if (!deleteAllConfirmChecked) return;
                            let progress = 0;
                            const interval = setInterval(() => {
                              progress += 2;
                              setDeleteAllHoldProgress(progress);
                              if (progress >= 100) {
                                clearInterval(interval);
                                deleteAllHoldRef.current = null;
                                handleDeleteAll();
                                setShowDeleteAllDialog(false);
                                setDeleteAllConfirmChecked(false);
                                setDeleteAllHoldProgress(0);
                              }
                            }, 20);
                            deleteAllHoldRef.current = interval;
                          }}
                          onMouseUp={() => {
                            if (deleteAllHoldRef.current) {
                              clearInterval(deleteAllHoldRef.current);
                              deleteAllHoldRef.current = null;
                              setDeleteAllHoldProgress(0);
                            }
                          }}
                          onMouseLeave={() => {
                            if (deleteAllHoldRef.current) {
                              clearInterval(deleteAllHoldRef.current);
                              deleteAllHoldRef.current = null;
                              setDeleteAllHoldProgress(0);
                            }
                          }}
                          onTouchStart={() => {
                            if (!deleteAllConfirmChecked) return;
                            let progress = 0;
                            const interval = setInterval(() => {
                              progress += 2;
                              setDeleteAllHoldProgress(progress);
                              if (progress >= 100) {
                                clearInterval(interval);
                                deleteAllHoldRef.current = null;
                                handleDeleteAll();
                                setShowDeleteAllDialog(false);
                                setDeleteAllConfirmChecked(false);
                                setDeleteAllHoldProgress(0);
                              }
                            }, 20);
                            deleteAllHoldRef.current = interval;
                          }}
                          onTouchEnd={() => {
                            if (deleteAllHoldRef.current) {
                              clearInterval(deleteAllHoldRef.current);
                              deleteAllHoldRef.current = null;
                              setDeleteAllHoldProgress(0);
                            }
                          }}
                        >
                          <div 
                            className="absolute inset-0 bg-red-900/50 transition-all duration-75 ease-linear"
                            style={{ width: `${deleteAllHoldProgress}%` }}
                          />
                          <span className="relative z-10">
                            {deleteAllHoldProgress > 0 ? `Hold... ${Math.round(deleteAllHoldProgress)}%` : 'Hold to Delete All My Meetings'}
                          </span>
                        </Button>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}
          </div>

          {/* Meetings List - Conditional rendering based on view mode */}
          {(() => {
            // Calculate paginated meetings
            const totalPages = Math.ceil(filteredMeetings.length / meetingsPerPage);
            const startIndex = (currentPage - 1) * meetingsPerPage;
            const paginatedMeetings = filteredMeetings.slice(startIndex, startIndex + meetingsPerPage);
            
            return (
              <>
                {layoutViewMode === 'compact' ? (
                  <CompactMeetingList
                    meetings={paginatedMeetings}
                    isSelectMode={isSelectMode}
                    selectedMeetings={selectedMeetings}
                    onSelectMeeting={(meetingId, isSelected) => {
                      if (isSelected) {
                        setSelectedMeetings(prev => [...prev, meetingId]);
                      } else {
                        setSelectedMeetings(prev => prev.filter(id => id !== meetingId));
                      }
                    }}
                    onViewNotes={handleSafeModeNotesClick}
                    onDelete={handleDeleteMeeting}
                    loading={loadingHistory}
                  />
                ) : layoutViewMode === 'grid' ? (
                  <MeetingGridView
                    meetings={paginatedMeetings}
                    isSelectMode={isSelectMode}
                    selectedMeetings={selectedMeetings}
                    onSelectMeeting={(meetingId, isSelected) => {
                      if (isSelected) {
                        setSelectedMeetings(prev => [...prev, meetingId]);
                      } else {
                        setSelectedMeetings(prev => prev.filter(id => id !== meetingId));
                      }
                    }}
                    onViewNotes={handleSafeModeNotesClick}
                    onDelete={handleDeleteMeeting}
                    loading={loadingHistory}
                  />
                ) : layoutViewMode === 'table' ? (
                  <MeetingTableView
                    meetings={paginatedMeetings}
                    isSelectMode={isSelectMode}
                    selectedMeetings={selectedMeetings}
                    onSelectMeeting={(meetingId, isSelected) => {
                      if (isSelected) {
                        setSelectedMeetings(prev => [...prev, meetingId]);
                      } else {
                        setSelectedMeetings(prev => prev.filter(id => id !== meetingId));
                      }
                    }}
                    onSelectAll={() => {
                      if (selectedMeetings.length === filteredMeetings.length) {
                        setSelectedMeetings([]);
                      } else {
                        setSelectedMeetings(filteredMeetings.map(m => m.id));
                      }
                    }}
                    onViewNotes={handleSafeModeNotesClick}
                    onDelete={handleDeleteMeeting}
                    loading={loadingHistory}
                  />
                ) : layoutViewMode === 'timeline' ? (
                  <MeetingTimelineView
                    meetings={paginatedMeetings}
                    isSelectMode={isSelectMode}
                    selectedMeetings={selectedMeetings}
                    onSelectMeeting={(meetingId, isSelected) => {
                      if (isSelected) {
                        setSelectedMeetings(prev => [...prev, meetingId]);
                      } else {
                        setSelectedMeetings(prev => prev.filter(id => id !== meetingId));
                      }
                    }}
                    onViewNotes={handleSafeModeNotesClick}
                    onDelete={handleDeleteMeeting}
                    loading={loadingHistory}
                  />
                ) : (
                  <MeetingHistoryList 
                    meetings={paginatedMeetings}
                    onEdit={(meetingId) => navigate(`/meeting-summary`, { state: { id: meetingId } })}
                    onViewSummary={handleViewSummary}
                    onViewTranscript={handleViewTranscript}
                    onDelete={handleDeleteMeeting}
                    onRefresh={loadMeetingHistory}
                    loading={loadingHistory}
                    isSelectMode={isSelectMode}
                    selectedMeetings={selectedMeetings}
                    onSelectMeeting={(meetingId, isSelected) => {
                      if (isSelected) {
                        setSelectedMeetings(prev => [...prev, meetingId]);
                      } else {
                        setSelectedMeetings(prev => prev.filter(id => id !== meetingId));
                      }
                    }}
                    onMeetingUpdate={(meetingId, updatedTitle) => {
                      setMeetings(prev => prev.map(meeting =>
                        meeting.id === meetingId 
                          ? { ...meeting, title: updatedTitle }
                          : meeting
                      ));
                    }}
                    showRecordingPlayback={false}
                    autoOpenSafeModeForMeetingId={autoOpenSafeModeForMeetingId}
                    onAutoOpenSafeModeProcessed={() => setAutoOpenSafeModeForMeetingId(null)}
                    onOpenCorrectionManager={() => setShowCorrections(true)}
                  />
                )}
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <Button
                          key={page}
                          variant={page === currentPage ? "default" : "outline"}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground ml-2">
                      {startIndex + 1}-{Math.min(startIndex + meetingsPerPage, filteredMeetings.length)} of {filteredMeetings.length}
                    </span>
                  </div>
                )}
              </>
            );
          })()}
        </TabsContent>

      </Tabs>
      
      
      {/* Stop Recording Confirmation Dialog */}
      <StopRecordingConfirmDialog
        isOpen={showConfirmDialog}
        onOpenChange={handleConfirmDialogOpenChangeWrapped}
        onConfirm={confirmStopRecordingWrapped}
        recordingDuration={duration}
        wordCount={wordCount}
      />


          {/* Full Page Notes Modal - now available on all devices including iPhone */}
          {fullPageModalOpen && modalMeeting && (
            modalMeeting._isLoading ? (
              <Dialog
                open={fullPageModalOpen}
                onOpenChange={(open) => {
                  if (!open) {
                    setFullPageModalOpen(false);
                    setModalMeeting(null);
                    setModalNotes('');
                  }
                }}
              >
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Loading meeting notes</DialogTitle>
                    <DialogDescription>Fetching your latest notes…</DialogDescription>
                  </DialogHeader>
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              <FullPageNotesModal
                isOpen={fullPageModalOpen}
                onClose={() => {
                  setFullPageModalOpen(false);
                  setModalMeeting(null);
                  setModalNotes('');
                }}
                meeting={modalMeeting}
                notes={modalNotes}
                onNotesChange={setModalNotes}
              />
            )
          )}
      
      {/* SafeModeNotesModal for new view components */}
      <SafeModeNotesModal
        isOpen={safeModeModalOpen}
        onClose={() => {
          safeModeModalOpenRef.current = false;
          setSafeModeModalOpen(false);
          setSafeModeSelectedMeeting(null);
          setSafeModeNotes('');
        }}
        meeting={safeModeSelectedMeeting}
        notes={safeModeNotes}
      />

      {/* Transcript Modal */}
      {transcriptModalOpen && currentMeetingForTranscript && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-lg max-w-4xl w-full max-h-[80vh] overflow-hidden border border-border">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-xl font-bold text-foreground">{currentMeetingForTranscript.title}</h2>
                <p className="text-sm text-muted-foreground">Meeting Transcript</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTranscriptModalOpen(false);
                  setCurrentMeetingForTranscript(null);
                }}
                className="h-8 w-8 p-0"
              >
                ✕
              </Button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <p className="text-sm text-muted-foreground mb-4">
                Transcript functionality is not fully implemented in this tab. Please use the standalone Meeting History page for full transcript features.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Meeting Dashboard */}
      <RealtimeMeetingDashboard
        isOpen={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
        isRecording={isRecording}
        meetingData={{
          transcript,
          duration,
          wordCount,
          connectionStatus
        }}
      />
      
      {/* Import Meeting Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[1120px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Import Meeting Content
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Create a meeting from existing content and automatically generate notes
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <MeetingImporter
              onMeetingCreated={(meetingId) => {
                setImportDialogOpen(false);
                showToast.success('Meeting imported successfully!', { section: 'meeting_manager' });
                loadMeetingHistory();
                
                // Optionally open the newly created meeting
                setTimeout(() => {
                  const meeting = meetings.find(m => m.id === meetingId);
                  if (meeting) {
                    handleViewMeetingSummary(meeting);
                  }
                }, 1000);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Recording Context Dialog */}
      {isRecording && (
        <RecordingContextDialog
          open={showContextDialog}
          onOpenChange={setShowContextDialog}
          meetingId={sessionStorage.getItem('currentMeetingId') || ''}
          existingContext={meetingContext}
          onContextSaved={() => {
            setHasContext(true);
            const currentMeetingId = sessionStorage.getItem('currentMeetingId');
            if (currentMeetingId) {
              // Fetch the updated context
              supabase
                .from('meetings')
                .select('meeting_context')
                .eq('id', currentMeetingId)
                .single()
                .then(({ data }) => {
                  if (data?.meeting_context) {
                    setMeetingContext(data.meeting_context as MeetingContext);
                  }
                });
            }
          }}
        />
      )}
      
      {/* Meeting Coach Modal */}
      <MeetingCoachModal
        isOpen={coachModalOpen}
        onClose={() => setCoachModalOpen(false)}
        isRecording={isRecording}
        recordingDuration={duration}
        getLiveTranscript={() => liveTranscriptRef.current?.getCurrentTranscript() || ''}
        meetingContext={{
          title: meetingSettings?.title,
          type: meetingSettings?.meetingStyle,
          participants: meetingSettings?.attendees?.split(',').map(a => a.trim())
        }}
      />
      
      {/* Post-Meeting Actions Modal */}
      <PostMeetingActionsModal
        isOpen={showPostMeetingActions}
        onOpenChange={setShowPostMeetingActions}
        meetingId={lastCompletedMeetingId || ''}
        meetingTitle={lastCompletedMeetingTitle}
        meetingDuration={lastCompletedMeetingDuration}
        onStartNewMeeting={() => {
          setShowPostMeetingActions(false);
          setLastCompletedMeetingId(null);
          setLastCompletedMeetingTitle('');
          setLastCompletedMeetingDuration('');
          // User is now ready to record again - recording state is already reset
        }}
      />
      
      {/* Meeting Folders Manager */}
      <MeetingFoldersManager
        open={foldersDialogOpen}
        onOpenChange={setFoldersDialogOpen}
      />
      
      {/* Tab Audio Guidance Dialog */}
      <TabAudioGuidanceDialog
        open={showTabAudioGuidance}
        onOpenChange={setShowTabAudioGuidance}
        onConfirm={() => {
          setShowTabAudioGuidance(false);
          // Resume recording start after user confirms
          startRecording();
        }}
        onCancel={() => {
          setShowTabAudioGuidance(false);
          setPendingRecordingStart(false);
        }}
      />
      
      {/* Teams Transcript Import Modal */}
      <TeamsTranscriptImportModal
        open={teamsImportOpen}
        onOpenChange={setTeamsImportOpen}
      />
      
      {/* Live Import Modal */}
      <LiveImportModalWithContext
        open={audioImportOpen}
        onOpenChange={(open) => { setAudioImportOpen(open); if (!open) setEditGroupId(null); }}
        defaultTab={audioImportDefaultTab}
        editGroupId={editGroupId}
      />
      
      {/* Deepgram transcription removed - backup transcription service disabled */}

      {/* Name & Term Corrections Modal */}
      {showCorrections && (
        <CorrectionManager 
          onClose={() => setShowCorrections(false)}
          onCorrectionApplied={() => {}}
          onCorrectionsChanged={() => {
            loadMeetingHistory();
          }}
        />
      )}
    </div>
    </TooltipProvider>
    </MeetingSetupProvider>
  );
};