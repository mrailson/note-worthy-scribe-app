import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  Calendar, 
  FileText, 
  Eye,
  Trash2, 
  Play,
  MessageSquare,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  Edit,
  FileTextIcon,
  Copy,
  Volume2,
  Download,
  Paperclip,
  Upload,
  Headphones,
  Mic,
  Monitor,
  Share2,
  ChevronDown,
  ExternalLink,
  MapPin,
  RefreshCw,
  Bot,
  Mail,
  Users,
  MoreVertical,
  FileDown,
  Video,
  MonitorSpeaker,
  Drama,
  Folder,
  BookOpen,
  HeartPulse,
  ChevronRight,
  Sparkles,
  Zap,
  Brain
} from "lucide-react";
import AgeingWellDemoModal from "@/components/AgeingWellDemoModal";
import { ShareMeetingDialog } from "@/components/ShareMeetingDialog";
import { SharedMeetingBadge } from "@/components/SharedMeetingBadge";
import { EditMeetingMetadataDialog, type EditableMeeting } from "@/components/meeting/EditMeetingMetadataDialog";
import { formatUkTime, getUkTimezoneLabel, formatUkDateLong, isSuspectStartTime } from "@/utils/meetingTimeFormat";
import { BackupBadge } from "@/components/offline/BackupBadge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, isToday } from "date-fns";
import { MeetingDetailsTabs } from "@/components/meeting-details/MeetingDetailsTabs";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { SimpleFileUpload } from "@/components/SimpleFileUpload";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { detectDevice } from "@/utils/DeviceDetection";
import { useRecording } from "@/contexts/RecordingContext";
import { RecordingWarningBanner } from "@/components/RecordingWarningBanner";
import { MobileNotesSheet } from "@/components/MobileNotesSheet";
import { FullPageNotesModal } from "@/components/FullPageNotesModal";
import { SafeModeNotesModal } from "@/components/SafeModeNotesModal";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMultiTypeNotes } from "@/hooks/useMultiTypeNotes";
import { EmailMeetingMinutesModal } from "@/components/EmailMeetingMinutesModal";
import { LiveImportModal } from "@/components/meeting/import/LiveImportModal";
import { useAuth } from '@/contexts/AuthContext';
import { AttendeeRoleBadge } from './meeting-history/AttendeeRoleBadge';
import { NewMeetingBadge } from './meeting-history/NewMeetingBadge';
import { useMeetingExport } from '@/hooks/useMeetingExport';
import { toast } from 'sonner';
import { useApplyMeetingCorrections } from '@/hooks/useApplyMeetingCorrections';
import { MeetingCorrectionsBadge } from '@/components/meeting-history/MeetingCorrectionsBadge';
import { TranscriptRepairButton } from '@/components/admin/TranscriptRepairButton';
import { useVoicePreference } from '@/hooks/useVoicePreference';
import { useMeetingFolders } from '@/hooks/useMeetingFolders';
import { FolderBadge } from '@/components/meeting-folders/FolderBadge';
import { FolderAssignmentSheet } from '@/components/meeting-folders/FolderAssignmentSheet';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RecordingErrorCard } from "@/components/recording/RecordingErrorCard";
import { PatientBanner } from "@/components/PatientBanner";
import { getDemoPatientForMeeting } from "@/data/demoPatients";
import { DemoMeetingCard } from "@/components/meeting-history/DemoMeetingCard";
import { resolveMeetingModel, modelOverrideField } from "@/utils/resolveMeetingModel";


interface Meeting {
  id: string;
  title: string;
  description: string | null;
  meeting_type: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  status: string;
  created_at: string;
  transcript_count?: number;
  summary_exists?: boolean;
  meeting_summary?: string;
  overview?: string | null;
  audio_overview_url?: string | null;
  audio_overview_text?: string | null;
  audio_overview_duration?: number | null;
  transcript?: string | null;
  audio_backup_path?: string | null;
  audio_backup_created_at?: string | null;
  requires_audio_backup?: boolean;
  word_count?: number;
  document_count?: number;
  mixed_audio_url?: string | null;
  left_audio_url?: string | null;
  right_audio_url?: string | null;
  recording_created_at?: string | null;
  notes_generation_status?: string;
  import_source?: string;
  import_source_display?: string;
  meeting_config?: any;
  meeting_format?: string;
  meeting_location?: string;
  folder_id?: string | null;
  // Sharing fields
  access_type?: 'owner' | 'shared';
  access_level?: 'view' | 'download';
  shared_by?: string;
  shared_at?: string;
  share_message?: string;
  share_id?: string;
  documents?: Array<{
    file_name: string;
    file_size: number | null;
    uploaded_at: string;
    file_type: string | null;
  }>;
}

interface AudioUrls {
  mixedAudioSignedUrl: string | null;
  leftAudioSignedUrl: string | null;
  rightAudioSignedUrl: string | null;
}

interface MeetingHistoryListProps {
  meetings: Meeting[];
  onEdit: (meetingId: string) => void;
  onViewSummary: (meetingId: string) => void;
  onViewTranscript: (meetingId: string) => void;
  onDelete: (meetingId: string) => void;
  loading: boolean;
  // Multi-select props
  isSelectMode?: boolean;
  selectedMeetings?: string[];
  onSelectMeeting?: (meetingId: string, checked: boolean) => void;
  // Callback for when a meeting title is updated
  onMeetingUpdate?: (meetingId: string, updatedTitle: string) => void;
  // Callback for when documents are uploaded
  onDocumentsUploaded?: (meetingId: string, uploadedFiles: Array<{file_name: string, file_size: number, uploaded_at: string, file_type: string}>) => void;
  // Recording playback visibility
  showRecordingPlayback?: boolean;
  // Callback for when data needs to be refreshed
  onRefresh?: () => void;
  // Callback for when a folder is assigned
  onFolderAssigned?: (meetingId: string, folderId: string | null) => void;
  // Auto-open SafeModeNotesModal for a specific meeting ID (from navigation state)
  autoOpenSafeModeForMeetingId?: string | null;
  // Callback when auto-open has been processed
  onAutoOpenSafeModeProcessed?: () => void;
  // Callback for opening the correction manager
  onOpenCorrectionManager?: () => void;
}

// PIN required to confirm premium-model regenerations on the client.
// Server-side enforcement lives in the auto-generate-meeting-notes edge function.
const PREMIUM_REGEN_PIN = '1045';

const promptForPremiumPin = (modelLabel: string, costNote: string): boolean => {
  const userPin = window.prompt(
    `Regenerate this meeting using ${modelLabel}?\n\n` +
    `${costNote}\n\n` +
    `Enter the 4-digit PIN to confirm:`
  );
  if (userPin === null) return false; // user cancelled
  if (userPin !== PREMIUM_REGEN_PIN) {
    toast.error('Incorrect PIN. Premium regeneration cancelled.');
    return false;
  }
  return true;
};

export const MeetingHistoryList = ({ 
  meetings, 
  onEdit, 
  onViewSummary,
  onViewTranscript,
  onDelete, 
  loading,
  isSelectMode = false,
  selectedMeetings = [],
  onSelectMeeting,
  onMeetingUpdate,
  onDocumentsUploaded,
  showRecordingPlayback = true,
  onRefresh,
  onFolderAssigned,
  autoOpenSafeModeForMeetingId,
  onAutoOpenSafeModeProcessed,
  onOpenCorrectionManager
}: MeetingHistoryListProps) => {
  const navigate = useNavigate();
  const { isRecording, isResourceOperationSafe, setRecordingState } = useRecording();
  const { user, isSystemAdmin } = useAuth();
  const { voiceConfig } = useVoicePreference();
  const { folders, assignMeetingToFolder } = useMeetingFolders();
  const { applyText, getCorrectionsForText, updateMeeting, updatingMeetings, hasCorrections } = useApplyMeetingCorrections();
  const userFullNameLower = useMemo(() => (user?.user_metadata?.full_name || user?.user_metadata?.name || '').toLowerCase(), [user?.user_metadata?.full_name, user?.user_metadata?.name]);
  const isIOS = detectDevice().isIOS;

  
  // Local state for meetings - initialize with prop value, sync on changes
  const [localMeetings, setLocalMeetings] = useState<Meeting[]>(meetings);
  const [meetingAttendees, setMeetingAttendees] = useState<Record<string, any[]>>({});
  const [expandedAttendees, setExpandedAttendees] = useState<Record<string, boolean>>({});
  const [userPractices, setUserPractices] = useState<Array<{id: string, practice_name: string}>>([]);
  const [customLocations, setCustomLocations] = useState<string[]>([]);
  const [locationInputOpen, setLocationInputOpen] = useState<Record<string, boolean>>({});
  const [locationInputValues, setLocationInputValues] = useState<Record<string, string>>({});
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});
  const [ageingWellMeeting, setAgeingWellMeeting] = useState<Meeting | null>(null);
  const [folderSheetOpen, setFolderSheetOpen] = useState(false);
  const [selectedMeetingForFolder, setSelectedMeetingForFolder] = useState<Meeting | null>(null);
  const [retranscribingMeetings, setRetranscribingMeetings] = useState<Record<string, boolean>>({});
  const [editMetadataMeeting, setEditMetadataMeeting] = useState<EditableMeeting | null>(null);
  
  // Sync localMeetings with meetings prop - database is source of truth
  useEffect(() => {
    // Always sync from database - don't skip
    setLocalMeetings(meetings);
  }, [meetings]);

  // Fetch user practices and custom locations
  useEffect(() => {
    const fetchPracticesAndLocations = async () => {
      if (!user?.id) return;
      
      try {
        // Fetch user's practices
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
          }
        }
        
        // Fetch custom locations from user's meetings
        const { data: locations } = await supabase
          .from('meetings')
          .select('meeting_location')
          .eq('user_id', user.id)
          .eq('meeting_format', 'face-to-face')
          .not('meeting_location', 'is', null)
          .limit(20);
        
        if (locations) {
          const uniqueLocations = [...new Set(locations.map(l => l.meeting_location).filter(Boolean))];
          setCustomLocations(uniqueLocations as string[]);
        }
      } catch (error) {
        console.error('Error fetching practices and locations:', error);
      }
    };
    
    fetchPracticesAndLocations();
  }, [user?.id]);

  // Fetch attendees for visible meetings only (do not overwrite localMeetings here)
  useEffect(() => {
    // Fetch attendees only for currently visible meetings (current page)
    const fetchAttendeesForVisibleMeetings = async () => {
      const meetingIds = meetings.map(m => m.id);
      
      if (meetingIds.length === 0) return;

      try {
        const { data: attendeeLinks, error } = await supabase
          .from('meeting_attendees')
          .select(`
            meeting_id,
            meeting_role,
            attendee_id,
            attendees:attendee_id (
              id,
              name,
              title,
              email,
              organization,
              organization_type,
              role,
              user_id
            )
          `)
          .in('meeting_id', meetingIds);

        if (error) {
          console.error('❌ Error fetching attendees:', error);
          return;
        }

        if (attendeeLinks) {
          const attendeesMap: Record<string, any[]> = {};
          attendeeLinks.forEach((link: any) => {
            if (!attendeesMap[link.meeting_id]) {
              attendeesMap[link.meeting_id] = [];
            }
            if (link.attendees) {
              attendeesMap[link.meeting_id].push({
                ...link.attendees,
                meeting_role: link.meeting_role || 'attendee'
              });
            }
          });
          
          // Sort attendees by role priority (chair > key_participant > you > others)
          Object.keys(attendeesMap).forEach(meetingId => {
            attendeesMap[meetingId].sort((a, b) => {
              const isCurrentUserAttendee = (att: any) => {
                const emailMatch = att.email?.toLowerCase() === user?.email?.toLowerCase();
                const nameMatch = userFullNameLower ? att.name?.toLowerCase() === userFullNameLower : true;
                return emailMatch && nameMatch;
              };

              const getRolePriority = (att: any) => {
                if (att.meeting_role === 'chair') return 0;
                if (att.meeting_role === 'key_participant') return 1;
                if (isCurrentUserAttendee(att)) return 2;
                return 3;
              };
              
              return getRolePriority(a) - getRolePriority(b);
            });
          });
          
          setMeetingAttendees(prev => ({
            ...prev,
            ...attendeesMap
          }));
        }
      } catch (error) {
        console.error('Error fetching attendees:', error);
      }
    };

    fetchAttendeesForVisibleMeetings();
  }, [meetings, user?.id, user?.email]);

  // Word counts now come from meeting.word_count (populated by parent) — no separate fetch needed

  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const meetingFoldersById = useMemo(() => {
    const folderMap = new Map<string, (typeof folders)[number]>();
    folders.forEach((folder) => {
      folderMap.set(folder.id, folder);
    });
    return folderMap;
  }, [folders]);

  const meetingFolderBadges = useMemo(() => {
    const badgeMap = new Map<string, (typeof folders)[number] | null>();
    localMeetings.forEach((meeting) => {
      if (!meeting.folder_id) {
        badgeMap.set(meeting.id, null);
        return;
      }

      badgeMap.set(meeting.id, meetingFoldersById.get(meeting.folder_id) ?? null);
    });
    return badgeMap;
  }, [localMeetings, meetingFoldersById]);

  // Real-time subscription for automatic refresh when meetings are updated
  // MEMORY FIX: Keep subscription stable even if parent recreates onRefresh
  useEffect(() => {
    if (!user?.id) return;

    console.log('🔄 Setting up real-time subscription for meeting updates');

    const pendingTimeouts: NodeJS.Timeout[] = [];
    let lastRefreshTime = 0;
    const DEBOUNCE_MS = 5000;

    const debouncedRefresh = () => {
      const refreshHandler = onRefreshRef.current;
      if (!refreshHandler) return;

      const now = Date.now();
      if (now - lastRefreshTime < DEBOUNCE_MS) {
        return;
      }
      if (safeModeModalOpenRef.current) {
        return;
      }
      lastRefreshTime = now;
      refreshHandler();
    };

    const channel = supabase
      .channel(`meeting-updates-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_notes_multi'
        },
        () => {
          const timeoutId = setTimeout(debouncedRefresh, 1000);
          pendingTimeouts.push(timeoutId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_overviews'
        },
        () => {
          const timeoutId = setTimeout(debouncedRefresh, 1000);
          pendingTimeouts.push(timeoutId);
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 Cleaning up real-time subscription and timeouts');
      pendingTimeouts.forEach(id => clearTimeout(id));
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
  
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedMeetingForUpload, setSelectedMeetingForUpload] = useState<Meeting | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  
  // Mobile notes sheet state
  const [mobileNotesOpen, setMobileNotesOpen] = useState(false);
  const [selectedMeetingForNotes, setSelectedMeetingForNotes] = useState<Meeting | null>(null);
  const [desktopNotesOpen, setDesktopNotesOpen] = useState(false);
  const [meetingNotes, setMeetingNotes] = useState("");
  const [initialTabForModal, setInitialTabForModal] = useState<'notes' | 'transcript'>('notes');
  
  // Safe Mode modal state
  const [safeModeModalOpen, setSafeModeModalOpen] = useState(false);
  const [safeModeSelectedMeeting, setSafeModeSelectedMeeting] = useState<Meeting | null>(null);
  const [safeModeNotes, setSafeModeNotes] = useState("");
  const isMobile = useIsMobile();
  
  // Ref to track modal open state for real-time subscription (must be declared after state)
  // Ref to track modal open state for real-time subscription - updated synchronously
  const safeModeModalOpenRef = useRef(false);
  
  // Cleanup ref on unmount to prevent stale state
  useEffect(() => {
    return () => {
      safeModeModalOpenRef.current = false;
    };
  }, []);
  
  // Handle auto-opening SafeModeNotesModal when navigated from PostMeetingActionsModal
  useEffect(() => {
    if (!autoOpenSafeModeForMeetingId || meetings.length === 0) return;
    
    console.log('🛡️ Processing auto-open for SafeModeNotesModal, meeting ID:', autoOpenSafeModeForMeetingId);
    
    // Find the meeting in our list or fetch it
    const targetMeeting = meetings.find(m => m.id === autoOpenSafeModeForMeetingId);
    
    if (targetMeeting) {
      console.log('🛡️ Found meeting in list, opening SafeModeNotesModal:', targetMeeting.title);
      // Open the SafeModeNotesModal
      setSafeModeNotes(targetMeeting.meeting_summary || '');
      setSafeModeSelectedMeeting(targetMeeting);
      safeModeModalOpenRef.current = true;
      setSafeModeModalOpen(true);
      
      // Notify parent that we've processed the auto-open
      if (onAutoOpenSafeModeProcessed) {
        onAutoOpenSafeModeProcessed();
      }
    } else {
      // Meeting not in current list, fetch it from database with summary
      const fetchAndOpenMeeting = async () => {
        try {
          const { data: meeting, error } = await supabase
            .from('meetings')
            .select('*')
            .eq('id', autoOpenSafeModeForMeetingId)
            .maybeSingle();
          
          if (error) {
            console.error('❌ Error fetching meeting for SafeModeNotesModal:', error);
            return;
          }
          
          if (meeting) {
            console.log('🛡️ Fetched meeting from DB, opening SafeModeNotesModal:', meeting.title);
            
            // Also fetch the summary from meeting_summaries table
            const { data: summaryData } = await supabase
              .from('meeting_summaries')
              .select('summary')
              .eq('meeting_id', autoOpenSafeModeForMeetingId)
              .maybeSingle();
            
            const meetingWithSummary: Meeting = {
              ...meeting,
              meeting_summary: summaryData?.summary || meeting.overview || ''
            };
            
            setSafeModeNotes(meetingWithSummary.meeting_summary || '');
            setSafeModeSelectedMeeting(meetingWithSummary);
            safeModeModalOpenRef.current = true;
            setSafeModeModalOpen(true);
          }
          
          // Notify parent that we've processed the auto-open
          if (onAutoOpenSafeModeProcessed) {
            onAutoOpenSafeModeProcessed();
          }
        } catch (err) {
          console.error('❌ Error in fetchAndOpenMeeting:', err);
          if (onAutoOpenSafeModeProcessed) {
            onAutoOpenSafeModeProcessed();
          }
        }
      };
      
      fetchAndOpenMeeting();
    }
  }, [autoOpenSafeModeForMeetingId, meetings, onAutoOpenSafeModeProcessed]);

  // Add state for signed URLs
  const [audioUrls, setAudioUrls] = useState<Record<string, AudioUrls>>({});
  const [docListRefresh, setDocListRefresh] = useState<Record<string, number>>({});
  
  // Add state for collapsible audio sections
  const [collapsedAudioSections, setCollapsedAudioSections] = useState<Record<string, boolean>>({});
  
  // Word counts now come from meeting.word_count prop — no local state needed
  
  // Add state for confirmation dialog
  const [confirmProcessDialog, setConfirmProcessDialog] = useState<{
    open: boolean;
    meeting: Meeting | null;
    lastRun: string | null;
    selectedTypes: {
      standard: boolean;
      overview: boolean;
      executive: boolean;
      limerick: boolean;
    };
  }>({ 
    open: false, 
    meeting: null, 
    lastRun: null,
    selectedTypes: {
      standard: true,
      overview: true,
      executive: false,
      limerick: false
    }
  });
  
  // Add state for processing - Sequential processing (Standard → Overview → Executive → Limerick)
  const [processingMeetings, setProcessingMeetings] = useState<Record<string, {
    isProcessing: boolean;
    currentStage: 'standard' | 'overview' | 'executive' | 'limerick' | 'complete';
    stages: {
      'standard': 'pending' | 'processing' | 'success' | 'failed';
      'overview': 'pending' | 'processing' | 'success' | 'failed';
      'executive': 'pending' | 'processing' | 'success' | 'failed';
      'limerick': 'pending' | 'processing' | 'success' | 'failed';
    };
    error?: string;
    completedCount?: number;
    totalCount?: number;
    startedAt?: number;
    durationMinutes?: number | null;
  }>>({});

  // Watchdog + status-rotation thresholds scale with meeting length so we don't
  // alarm users on long meetings where 130s is normal.
  const getWatchdogThresholdMs = (meetingDurationMinutes?: number | null): number => {
    if (!meetingDurationMinutes || meetingDurationMinutes <= 0) return 150_000;
    if (meetingDurationMinutes <= 80) return 150_000;
    if (meetingDurationMinutes <= 120) return 180_000;
    return 240_000;
  };
  const getStatusRotationMs = (meetingDurationMinutes?: number | null): number => {
    if (!meetingDurationMinutes || meetingDurationMinutes <= 0) return 20_000;
    if (meetingDurationMinutes <= 80) return 20_000;
    if (meetingDurationMinutes <= 120) return 30_000;
    return 45_000;
  };

  // Tick state forces re-render every 5s while any meeting is generating, so the
  // rotating "Analysing transcript..." → "Extracting key points..." → "Identifying actions..."
  // status text updates without polling logic in every consumer.
  const [progressTick, setProgressTick] = useState(0);
  const longGenWarnedRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const anyProcessing = Object.values(processingMeetings).some(p => p?.isProcessing);
    if (!anyProcessing) return;
    const id = setInterval(() => {
      setProgressTick(t => t + 1);
      // Watchdog: warn the user once when a generation passes its scaled threshold.
      const now = Date.now();
      Object.entries(processingMeetings).forEach(([mid, p]) => {
        const threshold = getWatchdogThresholdMs(p?.durationMinutes);
        if (p?.isProcessing && p.currentStage === 'standard' && p.startedAt &&
            (now - p.startedAt) > threshold && !longGenWarnedRef.current[mid]) {
          longGenWarnedRef.current[mid] = true;
          toast.info('Taking longer than usual — this can happen with longer meetings. Hang tight.', { duration: 8000 });
        }
        if (!p?.isProcessing) {
          delete longGenWarnedRef.current[mid];
        }
      });
    }, 5000);
    return () => clearInterval(id);
  }, [processingMeetings]);


  // Multi-type notes hooks for each meeting
  const [multiTypeHooks, setMultiTypeHooks] = useState<Record<string, any>>({});

  // Add deduplication state for preventing duplicate modal opens
  const [lastActionTime, setLastActionTime] = useState<Record<string, number>>({});

  // Email modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedMeetingForEmail, setSelectedMeetingForEmail] = useState<Meeting | null>(null);

  // Attendee modal state
  const [attendeeModalOpen, setAttendeeModalOpen] = useState(false);
  const [selectedMeetingForAttendees, setSelectedMeetingForAttendees] = useState<Meeting | null>(null);

  // Status recovery state
  const [recoveringMeetings, setRecoveringMeetings] = useState<Set<string>>(new Set());

  // Initialize meeting export hook
  const { generateWordDocument, generatePDF } = useMeetingExport(null, { outputLevel: 1 } as any);

  // Auto-recover stuck meetings after 2 minutes - run once on mount only
  // MEMORY FIX: Use ref to prevent re-running on every localMeetings change
  const hasRunAutoRecoveryRef = useRef(false);
  useEffect(() => {
    if (hasRunAutoRecoveryRef.current || localMeetings.length === 0) return;
    hasRunAutoRecoveryRef.current = true;
    
    const stuckMeetings = localMeetings.filter(m => 
      m.status === 'recording' && isStuckMeeting(m) && !recoveringMeetings.has(m.id)
    );
    
    stuckMeetings.forEach(meeting => {
      const startTime = new Date(meeting.start_time).getTime();
      const now = Date.now();
      const minutesRecording = (now - startTime) / (1000 * 60);
      
      // Auto-recover if stuck for more than 2 minutes
      if (minutesRecording > 2) {
        console.log('🔧 Auto-recovering stuck meeting:', meeting.id, meeting.title);
        recoverStuckMeeting(meeting.id);
      }
    });
  }, [localMeetings.length]);

  // Function to recover stuck meetings
  const recoverStuckMeeting = async (meetingId: string) => {
    setRecoveringMeetings(prev => new Set(prev).add(meetingId));
    
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ 
          status: 'completed',
          end_time: new Date().toISOString()
        })
        .eq('id', meetingId);
      
      if (error) throw error;
      
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error recovering meeting:', error);
    } finally {
      setRecoveringMeetings(prev => {
        const updated = new Set(prev);
        updated.delete(meetingId);
        return updated;
      });
    }
  };

  // Check if meeting is stuck (in recording status for >1 minute)
  const isStuckMeeting = (meeting: Meeting) => {
    if (meeting.status !== 'recording') return false;
    const startTime = new Date(meeting.start_time).getTime();
    const now = Date.now();
    const minutesRecording = (now - startTime) / (1000 * 60);
    return minutesRecording > 1;
  };

  // Compute word count from available text if not provided by backend
  const computeWordCount = (m: Meeting) => {
    const source = [m.transcript, m.meeting_summary, m.overview, m.audio_overview_text]
      .find((s) => typeof s === 'string' && (s as string).trim().length > 0) as string | undefined;
    if (!source) return 0;
    return source.trim().split(/\s+/).filter(w => w.length > 0).length;
  };

  // Function to generate signed URLs for audio files
  const generateSignedUrls = async (meetingId: string, meeting: Meeting) => {
    if (audioUrls[meetingId]) return; // Already generated

    const urls: AudioUrls = {
      mixedAudioSignedUrl: null,
      leftAudioSignedUrl: null,
      rightAudioSignedUrl: null
    };

    try {
      if (meeting.mixed_audio_url) {
        const { data } = await supabase.storage
          .from('meeting-audio-segments')
          .createSignedUrl(meeting.mixed_audio_url, 3600); // 1 hour expiry
        urls.mixedAudioSignedUrl = data?.signedUrl || null;
      }

      if (meeting.left_audio_url) {
        const { data } = await supabase.storage
          .from('meeting-audio-segments')
          .createSignedUrl(meeting.left_audio_url, 3600);
        urls.leftAudioSignedUrl = data?.signedUrl || null;
      }

      if (meeting.right_audio_url) {
        const { data } = await supabase.storage
          .from('meeting-audio-segments')
          .createSignedUrl(meeting.right_audio_url, 3600);
        urls.rightAudioSignedUrl = data?.signedUrl || null;
      }

      setAudioUrls(prev => ({ ...prev, [meetingId]: urls }));
    } catch (error) {
      console.error('Error generating signed URLs:', error);
    }
  };

  // Handle viewing notes - mobile vs desktop
  // OPTIMISED: Open modal immediately, fetch fresh notes in background
  const handleViewNotes = (meeting: Meeting) => {
    console.log('🔍 HandleViewNotes called for:', meeting.title, 'id:', meeting.id, 'isMobile:', isMobile);
    
    // Use cached notes immediately (no blocking)
    const cachedNotes = meeting.meeting_summary || '';
    setMeetingNotes(cachedNotes);
    setSelectedMeetingForNotes(meeting);
    
    // Open full-featured modal for all devices (FullPageNotesModal handles mobile responsiveness)
    console.log('🖥️ Opening notes modal (all devices)');
    setDesktopNotesOpen(true);
    
    // Fetch fresh notes in background (non-blocking) - only if we need to update
    supabase
      .from('meeting_summaries')
      .select('summary')
      .eq('meeting_id', meeting.id)
      .maybeSingle()
      .then(({ data: summaryData, error }) => {
        if (error) {
          console.error('Background notes fetch error:', error);
          return;
        }
        // Only update if we got fresh data different from cached
        const freshNotes = summaryData?.summary || '';
        if (freshNotes && freshNotes !== cachedNotes) {
          console.log('📝 Updated notes from background fetch');
          setMeetingNotes(freshNotes);
        }
      });
  };

  // Deduplicated version to prevent both touch and click events from triggering
  const handleViewNotesWithDeduplication = (meeting: Meeting, eventType: 'touch' | 'click') => {
    const now = Date.now();
    const actionKey = `${meeting.id}_viewNotes`;
    const lastTime = lastActionTime[actionKey] || 0;
    
    // If less than 500ms has passed since last action, ignore this event
    if (now - lastTime < 500) {
      console.log('🚫 Duplicate event prevented for:', meeting.title, 'eventType:', eventType);
      return;
    }
    
    // Update last action time
    setLastActionTime(prev => ({ ...prev, [actionKey]: now }));
    
    // Call the actual handler
    handleViewNotes(meeting);
  };

  // Handle Safe Mode notes viewing - lightweight modal
  const handleSafeModeNotesClick = (meeting: Meeting) => {
    console.log('🛡️ Opening Safe Mode notes for:', meeting.title);
    setSafeModeNotes(meeting.meeting_summary || '');
    setSafeModeSelectedMeeting(meeting);
    // Set ref synchronously BEFORE state update to ensure real-time subscription sees it immediately
    safeModeModalOpenRef.current = true;
    setSafeModeModalOpen(true);
  };

  // Handle inline title editing
  const handleStartEdit = (meetingId: string, currentTitle: string) => {
    setEditingMeetingId(meetingId);
    setEditingTitle(currentTitle);
  };

  const handleSaveTitle = async (meetingId: string) => {
    if (!editingTitle.trim()) {
      return;
    }

    try {
      const { error } = await supabase
        .from('meetings')
        .update({ title: editingTitle.trim() })
        .eq('id', meetingId);

      if (error) throw error;

      setEditingMeetingId(null);
      setEditingTitle("");
      
      // Notify parent component to update the meeting title locally
      if (onMeetingUpdate) {
        onMeetingUpdate(meetingId, editingTitle.trim());
      }
    } catch (error) {
      console.error('Error updating meeting title:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingMeetingId(null);
    setEditingTitle("");
  };

  // Document download function
  const downloadDocument = async (meetingId: string, fileName: string) => {
    try {
      // Get the document path from the database
      const { data: docData, error: docError } = await supabase
        .from('meeting_documents')
        .select('file_path')
        .eq('meeting_id', meetingId)
        .eq('file_name', fileName)
        .maybeSingle();

      if (docError) throw docError;
      if (!docData) {
        return;
      }

      const { data, error } = await supabase.storage
        .from('meeting-documents')
        .download(docData.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading document:', error.message);
    }
  };

  // Delete document function
  const deleteDocument = async (meetingId: string, fileName: string) => {
    try {
      // Get the document file path
      const { data: docData, error: docError } = await supabase
        .from('meeting_documents')
        .select('file_path, id')
        .eq('meeting_id', meetingId)
        .eq('file_name', fileName)
        .maybeSingle();
      
      if (docError) throw docError;
      if (!docData) {
        return;
      }
      
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('meeting-documents')
        .remove([docData.file_path]);
      
      if (storageError) throw storageError;
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('meeting_documents')
        .delete()
        .eq('id', docData.id);
      
      if (dbError) throw dbError;
      
      // Trigger a refresh of the meeting data
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      console.error('Error deleting document:', error.message);
    }
  };

  // Open document function (same as download but opens in new tab)
  const openDocument = async (meetingId: string, fileName: string) => {
    try {
      // Get the document path from the database
      const { data: docData, error: docError } = await supabase
        .from('meeting_documents')
        .select('file_path')
        .eq('meeting_id', meetingId)
        .eq('file_name', fileName)
        .maybeSingle();

      if (docError) throw docError;
      if (!docData) {
        return;
      }

      const { data, error } = await supabase.storage
        .from('meeting-documents')
        .download(docData.file_path);

      if (error) throw error;

      // Create blob URL and open in new tab
      const url = URL.createObjectURL(data);
      window.open(url, '_blank');
      
      // Clean up the URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error: any) {
      console.error('Error opening document:', error.message);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, meetingId: string) => {
    if (e.key === 'Enter') {
      handleSaveTitle(meetingId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // Handle audio backup download
  const handleAudioBackup = async (meeting: Meeting) => {
    if (!meeting.audio_backup_path) {
      return;
    }

    try {
      console.log('📥 Downloading audio backup:', meeting.audio_backup_path);
      
      const { data, error } = await supabase.storage
        .from('meeting-audio-backups')
        .download(meeting.audio_backup_path);

      if (error) {
        throw error;
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${meeting.title}_audio_backup.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading audio backup:', error);
    }
  };

  // Handle file upload
  const handleFileUpload = (files: File[]) => {
    setSelectedFiles(files);
  };

  const handleUploadClick = (meeting: Meeting) => {
    console.log('🔵 Upload button clicked for meeting:', meeting.id, meeting.title);
    setSelectedMeetingForUpload(meeting);
    setSelectedFiles([]);
    setUploadDialogOpen(true);
  };

  // Handle email minutes click — sends directly using the same pipeline
  // as the automatic post-meeting email (no modal step).
  const handleEmailMinutesClick = async (meeting: Meeting) => {
    console.log('📧 Email button clicked for meeting:', meeting.id, meeting.title);

    const toastId = toast.loading('Sending meeting notes…');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user?.email) {
        toast.error('Unable to send — no email address on your account', { id: toastId });
        return;
      }

      // Try to derive a friendly sender name from profile
      let senderName: string | undefined;
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .maybeSingle();
        senderName = profile?.full_name || undefined;
      } catch {
        // non-fatal — helper will fall back
      }

      const { sendMeetingNotesEmail } = await import('@/utils/sendMeetingNotesEmail');
      const result = await sendMeetingNotesEmail({
        meetingId: meeting.id,
        recipientEmail: user.email,
        senderName,
      });

      if (typeof result === 'object' && result?.attachmentFailed) {
        toast.warning(`Email sent to ${user.email}, but Word attachment failed to generate. Try Regenerate Notes first then re-email.`, { id: toastId, duration: 8000 });
      } else {
        toast.success(`Meeting notes emailed to ${user.email}`, { id: toastId });
      }
    } catch (error: any) {
      console.error('📧 Error sending meeting notes email:', error);
      toast.error(error?.message || 'Failed to send meeting notes email', { id: toastId });
    }
  };

  // Handle attendees click
  const handleAttendeesClick = (meeting: Meeting) => {
    setSelectedMeetingForAttendees(meeting);
    setAttendeeModalOpen(true);
  };



  const handleDownloadWord = async (meeting: Meeting) => {
    try {
      console.log('📄 Downloading Word document for meeting:', meeting.id, meeting.title);
      
      // Fetch the latest meeting notes/summary from multiple sources (prioritize Minutes - Standard)
      const { data: notesFields, error: notesFieldsError } = await supabase
        .from('meetings')
        .select('notes_style_3, notes_style_2, notes_style_4, notes_style_5, start_time, meeting_location, meeting_format')
        .eq('id', meeting.id)
        .maybeSingle();

      const { data: summaryData } = await supabase
        .from('meeting_summaries')
        .select('summary')
        .eq('meeting_id', meeting.id)
        .maybeSingle();
      
      // Fetch action items for this meeting - only Open and In Progress (exclude Completed)
      const { data: actionItemsData } = await supabase
        .from('meeting_action_items')
        .select('*')
        .eq('meeting_id', meeting.id)
        .not('status', 'in', '("Completed","completed")')
        .order('sort_order', { ascending: true });
      
      // Fetch attendees for this meeting
      const { data: meetingAttendees } = await supabase
        .from('meeting_attendees')
        .select(`
          attendee_id,
          attendees:attendee_id (
            name
          )
        `)
        .eq('meeting_id', meeting.id);

      // Priority order: Minutes - Standard (notes_style_3) > other notes > summary
      let notes = '';
      const standardFromMeeting = (notesFields as any)?.notes_style_3 || '';
      
      if (standardFromMeeting) {
        notes = standardFromMeeting;
      } else if (summaryData?.summary) {
        notes = summaryData.summary;
      } else if (meeting.meeting_summary) {
        notes = meeting.meeting_summary;
      } else {
        toast.error('No meeting notes available to download');
        return;
      }

      // Strip out transcript section before generating Word doc
      notes = notes.replace(/\n*MEETING TRANSCRIPT FOR REFERENCE:[\s\S]*$/i, '');
      notes = notes.replace(/\n*Transcript:[\s\S]*$/i, '');
      notes = notes.replace(/\n*Full Transcript:[\s\S]*$/i, '');
      notes = notes.replace(/\n*##?\s*TRANSCRIPT[\s\S]*$/i, '');
      notes = notes.replace(/\n*##?\s*Meeting Transcript[\s\S]*$/i, '');

      // Import the professional Word generator
      const { generateProfessionalWordFromContent } = await import('@/utils/generateProfessionalMeetingDocx');
      
      // Get meeting date and time
      const startTime = (notesFields as any)?.start_time || meeting.start_time || meeting.created_at;
      const meetingDate = startTime ? new Date(startTime) : new Date();
      const formattedDate = meetingDate.toLocaleDateString('en-GB', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
      const formattedTime = meetingDate.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }) + ' GMT';
      
      // Get venue (physical location)
      const venue = (notesFields as any)?.meeting_location || (meeting as any).meeting_location || undefined;

      // Get attendees names
      const attendeeNames = meetingAttendees
        ?.map((ma: any) => ma.attendees?.name)
        .filter(Boolean)
        .join(', ') || undefined;

      // Get meeting format (Teams/Hybrid/Face to face)
      const meetingFormatRaw = (notesFields as any)?.meeting_format || (meeting as any).meeting_format || undefined;
      const formatLabel = (() => {
        if (!meetingFormatRaw) return undefined;
        const raw = String(meetingFormatRaw).toLowerCase();
        if (raw.includes('hybrid')) return 'Hybrid';
        if (raw.includes('face') || raw.includes('f2f')) return 'Face to face';
        if (raw.includes('teams') || raw.includes('online') || raw.includes('virtual')) return 'Teams';
        if (raw.includes('phone')) return 'Phone';
        return String(meetingFormatRaw)
          .split(/[-_]/g)
          .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
          .join(' ');
      })();

      const location = formatLabel || (venue ? 'Face to face' : undefined);
      const includeVenue = !!venue && (location === 'Face to face' || location === 'Hybrid');

      // Build parsed details
      const parsedDetails = {
        title: meeting.title,
        date: formattedDate,
        time: formattedTime,
        location,
        venue: includeVenue ? venue : undefined,
        attendees: attendeeNames,
      };
      
      // Convert action items to expected format
      const parsedActionItems = (actionItemsData || []).map((item: any) => {
        const statusLabel: 'Completed' | 'In Progress' | 'Open' =
          item.status === 'Completed' || item.status === 'completed'
            ? 'Completed'
            : item.status === 'In Progress' || item.status === 'in_progress'
              ? 'In Progress'
              : 'Open';

        return {
          action: item.action_text || 'Action not specified',
          owner: item.assignee_name || 'Unassigned',
          deadline: item.due_date || 'TBC',
          priority: item.priority || 'medium',
          status: statusLabel,
          isCompleted: statusLabel === 'Completed',
        };
      });

      // Fetch the model that produced these notes so the Word footer carries
      // a provenance stamp on every download (including re-downloads of older
      // notes). Best-effort — a missing/null value falls back to "unknown"
      // inside the docx generator.
      let notesModelUsed: string | null = null;
      try {
        const { data: modelRow } = await supabase
          .from('meetings')
          .select('notes_model_used')
          .eq('id', meeting.id)
          .maybeSingle();
        notesModelUsed = (modelRow as any)?.notes_model_used ?? null;

        // Fallback: if the meetings column is NULL (older runs / consolidated
        // path before the model-stamp wiring), read the most recent log row.
        if (!notesModelUsed) {
          const { data: logRow } = await supabase
            .from('meeting_generation_log')
            .select('actual_model_used')
            .eq('meeting_id', meeting.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          notesModelUsed = (logRow as any)?.actual_model_used ?? null;
        }
      } catch (modelErr) {
        console.warn('⚠️ Could not load notes_model_used for footer:', modelErr);
      }

      await generateProfessionalWordFromContent(
        notes,
        meeting.title,
        parsedDetails,
        parsedActionItems,
        undefined, // visibleSections
        undefined, // logoUrl
        undefined, // logoScale
        undefined, // footerOn
        undefined, // meetingDetailsOn
        undefined, // attendeesOn
        undefined, // priorityColumnOn
        notesModelUsed,
      );
      toast.success('Word document downloaded successfully');
    } catch (error: unknown) {
      console.error('Error downloading Word document:', error);
      const message = error instanceof Error ? error.message : '';
      toast.error(message ? `Failed to download Word document: ${message}` : 'Failed to download Word document');
    }
  };

  // Handle download meeting notes as PDF
  const handleDownloadPDF = async (meeting: Meeting) => {
    try {
      console.log('📄 Downloading PDF for meeting:', meeting.id, meeting.title);
      
      // Fetch the latest meeting notes/summary from multiple sources (prioritize Minutes - Standard)
      const { data: notesFields, error: notesFieldsError } = await supabase
        .from('meetings')
        .select('notes_style_3, notes_style_2, notes_style_4, notes_style_5')
        .eq('id', meeting.id)
        .maybeSingle();

      const { data: summaryData } = await supabase
        .from('meeting_summaries')
        .select('summary')
        .eq('meeting_id', meeting.id)
        .maybeSingle();

      // Priority order: Minutes - Standard (notes_style_3) > other notes > summary
      let notes = '';
      const standardFromMeeting = (notesFields as any)?.notes_style_3 || '';
      
      if (standardFromMeeting) {
        notes = standardFromMeeting;
      } else if (summaryData?.summary) {
        notes = summaryData.summary;
      } else if (meeting.meeting_summary) {
        notes = meeting.meeting_summary;
      } else {
        toast.error('No meeting notes available to download');
        return;
      }

      // Strip out transcript section before generating PDF
      notes = notes.replace(/\n*MEETING TRANSCRIPT FOR REFERENCE:[\s\S]*$/i, '');
      notes = notes.replace(/\n*Transcript:[\s\S]*$/i, '');
      notes = notes.replace(/\n*Full Transcript:[\s\S]*$/i, '');
      notes = notes.replace(/\n*##?\s*TRANSCRIPT[\s\S]*$/i, '');
      notes = notes.replace(/\n*##?\s*Meeting Transcript[\s\S]*$/i, '');

      generatePDF(notes, meeting.title);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    }
  };

  const uploadDocuments = async () => {
    if (!selectedFiles.length || !selectedMeetingForUpload) return;

    setUploading(true);
    try {
      console.log('🔄 Starting upload for meeting:', selectedMeetingForUpload.id);
      
      // Check for duplicate file names in this meeting
      const existingFileNames = selectedMeetingForUpload.documents?.map(doc => doc.file_name) || [];
      const duplicateFiles = selectedFiles.filter(file => 
        existingFileNames.includes(file.name)
      );

      if (duplicateFiles.length > 0) {
        const duplicateNames = duplicateFiles.map(file => file.name).join(', ');
        console.error(`Duplicate files: ${duplicateNames}`);
        setUploading(false);
        return;
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('❌ Authentication error:', authError);
        throw new Error('Not authenticated');
      }
      
      console.log('✅ User authenticated:', user.id);

      for (const file of selectedFiles) {
        // Upload file to Supabase storage with user-based path for RLS
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `${user.id}/meetings/${selectedMeetingForUpload.id}/${fileName}`;
        
        console.log('📁 Uploading to path:', filePath);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('meeting-documents')
          .upload(filePath, file);

        if (uploadError) {
          console.error('❌ Storage upload error:', uploadError);
          throw uploadError;
        }

        console.log('✅ File uploaded successfully:', uploadData.path);

        // Save document metadata to database
        const { error: insertError } = await supabase
          .from('meeting_documents')
          .insert({
            meeting_id: selectedMeetingForUpload.id,
            file_name: file.name,
            file_path: uploadData.path,
            file_type: file.type,
            file_size: file.size,
            description: null,
            uploaded_by: user.id,
          });

        if (insertError) {
          console.error('❌ Database insert error:', insertError);
          throw insertError;
        }

        console.log('✅ Database record created for:', file.name);
      }

      console.log('🎉 All files uploaded successfully');
      
      // Update the document count and documents array locally
      if (onDocumentsUploaded) {
        const newDocuments = selectedFiles.map(file => ({
          file_name: file.name,
          file_size: file.size,
          uploaded_at: new Date().toISOString(),
          file_type: file.type
        }));
        onDocumentsUploaded(selectedMeetingForUpload.id, newDocuments);
      }
      
      // Force document list to refresh in card view
      setDocListRefresh(prev => ({ ...prev, [selectedMeetingForUpload.id]: (prev[selectedMeetingForUpload.id] || 0) + 1 }));
      
      setSelectedFiles([]);
      setUploadDialogOpen(false);
      setSelectedMeetingForUpload(null);
    } catch (error: any) {
      console.error('💥 Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  // Helper function to poll for note completion
  const pollForNoteCompletion = async (
    meetingId: string,
    noteType: string,
    table: 'meetings' | 'meeting_notes_multi' | 'meeting_overviews' | 'meeting_summaries'
  ): Promise<void> => {
    const maxAttempts = 40; // 2 minutes max
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      let exists = false;
      
      if (table === 'meetings') {
        const { data } = await supabase
          .from('meetings')
          .select(noteType)
          .eq('id', meetingId)
          .single();
        exists = data && data[noteType] && data[noteType].length > 0;
      } else if (table === 'meeting_notes_multi') {
        const { data } = await supabase
          .from('meeting_notes_multi')
          .select('id')
          .eq('meeting_id', meetingId)
          .eq('note_type', noteType)
          .single();
        exists = !!data;
      } else if (table === 'meeting_overviews') {
        const { data } = await supabase
          .from('meeting_overviews')
          .select('id')
          .eq('meeting_id', meetingId)
          .single();
        exists = !!data;
      } else if (table === 'meeting_summaries') {
        const { data } = await supabase
          .from('meeting_summaries')
          .select('summary')
          .eq('meeting_id', meetingId)
          .single();
        exists = data && data.summary && data.summary.length > 0;
      }
      
      if (exists) return;
      attempts++;
    }
    
    throw new Error(`Timeout waiting for ${noteType} to complete`);
  };

  // Handle continue meeting - navigate to recorder with existing meeting data
  const handleContinueMeeting = async (meeting: Meeting) => {
    if (!isResourceOperationSafe()) {
      toast.error("Cannot continue meeting while another recording is active.");
      return;
    }

    try {
      // Fetch existing transcript
      const { data: transcriptData } = await supabase.rpc('get_meeting_full_transcript', { 
        p_meeting_id: meeting.id 
      });
      const existingTranscript = transcriptData?.[0]?.transcript || '';

      // Fetch attendees for this meeting
      const { data: attendeeLinks } = await supabase
        .from('meeting_attendees')
        .select(`
          meeting_id,
          meeting_role,
          attendee_id,
          attendees:attendee_id (
            id,
            name,
            title,
            email,
            organization
          )
        `)
        .eq('meeting_id', meeting.id);

      const attendees = attendeeLinks?.map((link: any) => link.attendees?.name).filter(Boolean).join(', ') || '';

      // Navigate to recorder with continuation data
      navigate('/', {
        state: {
          continueMeeting: true,
          meetingData: {
            id: meeting.id,
            title: meeting.title,
            description: meeting.description,
            meeting_type: meeting.meeting_type,
            meeting_format: meeting.meeting_format || 'teams',
            meeting_location: meeting.meeting_location,
            folder_id: meeting.folder_id,
            existingTranscript,
            existingDuration: meeting.duration_minutes || 0,
            attendees,
            start_time: meeting.start_time
          }
        }
      });

      toast.success(`Continuing "${meeting.title}". New transcript will be appended.`);
    } catch (error) {
      console.error('Error preparing meeting continuation:', error);
      toast.error('Failed to prepare meeting continuation');
    }
  };

  // Handle process button click - auto-regenerate Standard, Overview, and Style Gallery
  // modelOverride is a free-form string identifier. Accepted values:
  //   undefined / 'default'  → server-side default (Gemini 3.1 Pro with auto-fallback chain)
  //   'gemini-3-flash'       → fast, lower quality, ~25s
  //   'sonnet-4.6'           → Claude Sonnet 4.6 alternative perspective
  //   'gemini-2.5-flash'     → premium long-context (PIN-gated)
  // Future premium options can be added without changing this signature.
  type RegenerateModel = 'default' | 'gemini-3-flash' | 'sonnet-4.6' | 'gemini-2.5-flash' | 'gpt-5.2';
  const handleProcessClick = async (meeting: Meeting, modelOverride?: RegenerateModel | string) => {
    const meetingId = meeting.id;
    const isDefault = !modelOverride || modelOverride === 'default';

    // Friendly label for in-progress toast
    const modelLabel =
      modelOverride === 'gemini-3-flash' ? 'Gemini 3 Flash' :
      modelOverride === 'sonnet-4.6' ? 'Claude Sonnet 4.6' :
      modelOverride === 'gemini-2.5-flash' ? 'Gemini 2.5 Flash' :
      modelOverride === 'gpt-5.2' ? 'OpenAI GPT-5.2' :
      modelOverride;

    // Show toast notification
    toast.info(
      isDefault
        ? 'Regenerating with Gemini 3.1 Pro — this may take 60-120 seconds...'
        : `Regenerating with ${modelLabel}...`,
      { duration: 3000 }
    );

    // Automatically regenerate Overview first, then Standard Minutes
    try {
      await handleFullProcessing(meeting, {
        standard: true,
        overview: true,
        executive: false,
        limerick: false
      }, isDefault ? undefined : modelOverride);
    } catch (regenErr: any) {
      // Distinguish silent-drop (in-progress lock) from real failures so the
      // user always gets a clear signal instead of a misleading success toast.
      const msg = regenErr?.message || '';
      if (msg === 'regenerate-already-in-progress') {
        // Toast already shown by handleFullProcessing — just bail without success.
        return;
      }
      console.error('❌ Regenerate failed:', regenErr);
      // If the edge function already produced a structured "<model> failed after N attempts: <reason>"
      // message, surface it as-is rather than double-prefixing.
      const alreadyStructured = /failed after \d+ attempt/i.test(msg);
      const toastMsg = alreadyStructured
        ? `${msg} — check the browser console for details.`
        : `Regenerate with ${modelLabel} failed: ${msg || 'unknown error'} — check the browser console for details.`;
      toast.error(toastMsg, { duration: 8000 });
      return;
    }

    // Success toast — only reached when handleFullProcessing actually completed.
    if (modelOverride === 'gemini-3-flash') {
      toast.success('⚡ Regenerated with Gemini 3 Flash');
    } else if (modelOverride === 'sonnet-4.6') {
      toast.success('✨ Regenerated with Claude Sonnet 4.6');
    } else if (modelOverride === 'gemini-2.5-flash') {
      toast.success('✨ Regenerated with Gemini 2.5 Flash');
    } else if (modelOverride === 'gpt-5.2') {
      toast.success('🧠 Regenerated with OpenAI GPT-5.2');
    } else {
      toast.success('✓ Notes regenerated');
    }

    // Generate audio overview at the end
    try {
      const { data: transcriptData } = await supabase.rpc('get_meeting_full_transcript', { 
        p_meeting_id: meetingId 
      });
      const transcript = transcriptData?.[0]?.transcript;
      
      if (transcript && transcript.length >= 50) {
        // Generate audio overview
        console.log('🔊 Regenerating Audio Overview...');
        const audioBody = {
          meetingId,
          voiceProvider: voiceConfig.provider,
          voiceId: voiceConfig.voiceId
        };
        
        const { error: audioError } = await supabase.functions.invoke('generate-audio-overview', {
          body: audioBody
        });
        
        if (audioError) {
          console.error('Audio generation error:', audioError);
          toast.error('Failed to generate audio overview');
        } else {
          console.log('✅ Audio overview generated successfully');
        }
        
        // Force a refresh to show all updates
        if (onRefresh) {
          onRefresh();
        }
      }
    } catch (err) {
      console.error('Error triggering regeneration:', err);
    }
  };

  // Handle full processing pipeline - Sequential processing
  const handleFullProcessing = async (
    meeting: Meeting,
    selectedTypes: { standard: boolean; overview: boolean; executive: boolean; limerick: boolean },
    modelOverride?: string
  ) => {
    const meetingId = meeting.id;
    
    if (processingMeetings[meetingId]?.isProcessing) {
      // Surface the dropped click so the user knows their second/third click
      // was a no-op rather than silently appearing to succeed.
      toast.warning('A regeneration is already in progress for this meeting — wait for it to finish before triggering another.', { duration: 6000 });
      // Throw so handleProcessClick's downstream success toast does not fire.
      throw new Error('regenerate-already-in-progress');
    }

    // Build list of selected types in order - Overview first, then Standard, then others
    const typesToProcess: Array<'standard' | 'overview' | 'executive' | 'limerick'> = [];
    if (selectedTypes.overview) typesToProcess.push('overview');
    if (selectedTypes.standard) typesToProcess.push('standard');
    if (selectedTypes.executive) typesToProcess.push('executive');
    if (selectedTypes.limerick) typesToProcess.push('limerick');
    
    if (typesToProcess.length === 0) {
      return;
    }

    // Initialize processing state with selected stages
    const initialStages: any = {
      'standard': selectedTypes.standard ? 'pending' : 'skipped',
      'overview': selectedTypes.overview ? 'pending' : 'skipped',
      'executive': selectedTypes.executive ? 'pending' : 'skipped',
      'limerick': selectedTypes.limerick ? 'pending' : 'skipped'
    };
    
    // Set first selected type to processing
    if (typesToProcess.length > 0) {
      initialStages[typesToProcess[0]] = 'processing';
    }
    
    setProcessingMeetings(prev => ({
      ...prev,
      [meetingId]: {
        isProcessing: true,
        currentStage: typesToProcess[0],
        stages: initialStages,
        completedCount: 0,
        totalCount: typesToProcess.length,
        startedAt: Date.now(),
        durationMinutes: meeting.duration_minutes ?? null,
      }
    }));

    try {
      // Get transcript once for all generations
      const { data: transcriptData } = await supabase.rpc('get_meeting_full_transcript', { 
        p_meeting_id: meetingId 
      });
      const transcript = transcriptData?.[0]?.transcript;
      
      if (!transcript || transcript.trim().length === 0) {
        throw new Error('No transcript available for processing');
      }

      let completedCount = 0;
      
      // Process each selected type sequentially
      for (let i = 0; i < typesToProcess.length; i++) {
        const currentType = typesToProcess[i];
        const nextType = typesToProcess[i + 1];
        
        if (currentType === 'standard') {
          
          try {
            // Resolution lives in src/utils/resolveMeetingModel.ts (single source of truth).
            const effectiveModel = resolveMeetingModel(modelOverride);
            const isPremium = effectiveModel === 'gemini-2.5-flash';
            console.log('🚀 Invoking auto-generate-meeting-notes for meeting:', meetingId, 'with model:', effectiveModel || '(server default: Gemini 3.1 Pro)');
            const { data, error: standardError } = await supabase.functions.invoke(
              'auto-generate-meeting-notes',
              { body: {
                  meetingId,
                  forceRegenerate: true,
                  ...modelOverrideField(modelOverride),
                  skipQc: localStorage.getItem('meeting-qc-enabled') !== 'true',
                  ...(isPremium ? { premiumPin: PREMIUM_REGEN_PIN } : {}),
                } }
            );

            console.log('📥 Response from auto-generate-meeting-notes:', { data, error: standardError });
            
            if (standardError) {
              console.error('❌ Edge function error:', standardError);
              throw new Error(`Standard notes failed: ${standardError.message || JSON.stringify(standardError)}`);
            }

            if (data?.skipped) {
              throw new Error(data?.message || 'Standard notes generation was skipped');
            }

            if (data?.status === 'insufficient_content') {
              throw new Error(data?.explanation || data?.reason || 'The selected model declined to generate meeting notes for this transcript');
            }

            if (effectiveModel && data?.actualModelUsed && data.actualModelUsed !== effectiveModel) {
              throw new Error(`Requested ${effectiveModel}, but the edge function returned ${data.actualModelUsed}`);
            }

            // Surface fallback if the primary model failed and a different one produced the notes.
            if (data?.fallbackCount && data.fallbackCount > 0 && data?.actualModelUsed) {
              const fallbackLabels: Record<string, string> = {
                'gemini-3-flash': 'Gemini 3 Flash',
                'gemini-2.5-pro': 'Gemini 2.5 Pro',
                'gpt-5': 'OpenAI GPT-5',
                'claude-sonnet-4-6': 'Claude Sonnet 4.6',
              };
              const label = fallbackLabels[data.actualModelUsed] || data.actualModelUsed;
              toast.warning(`⚡ Generated with ${label} — primary model was unavailable`, { duration: 6000 });
            }

            console.log('⏳ Polling for note completion...');
            // Poll for completion in meeting_summaries table (not meetings.notes_style_3)
            await pollForNoteCompletion(meetingId, 'summary', 'meeting_summaries');
            localStorage.setItem(`meeting-llm-used-${meetingId}`, data?.actualModelUsed || data?.modelUsed || effectiveModel || 'gemini-3.1-pro');
            completedCount++;

            // Safety net: ensure meeting title was generated
            try {
              const { ensureMeetingTitle } = await import('@/utils/manualTriggerNotes');
              await ensureMeetingTitle(meetingId);
            } catch (titleErr) {
              console.warn('Title safety net failed (non-fatal):', titleErr);
            }
          } catch (err: any) {
            console.error('💥 Standard notes generation error:', err);
            throw new Error(`Standard notes failed: ${err.message || 'Network error - edge function may have timed out'}`);
          }
          
          setProcessingMeetings(prev => ({
            ...prev,
            [meetingId]: {
              ...prev[meetingId],
              currentStage: nextType || 'complete',
              stages: { 
                ...prev[meetingId].stages, 
                'standard': 'success',
                ...(nextType ? { [nextType]: 'processing' } : {})
              },
              completedCount
            }
          }));
        }
        
        if (currentType === 'overview') {
          const { error: overviewError } = await supabase.functions.invoke(
            'generate-meeting-overview',
            { 
              body: { 
                meetingId,
                transcript,
                meetingTitle: meeting.title
              } 
            }
          );
          
          if (overviewError) throw new Error(`Overview failed: ${overviewError.message}`);
          await pollForNoteCompletion(meetingId, 'overview', 'meeting_overviews');
          completedCount++;
          
          setProcessingMeetings(prev => ({
            ...prev,
            [meetingId]: {
              ...prev[meetingId],
              currentStage: nextType || 'complete',
              stages: { 
                ...prev[meetingId].stages, 
                'overview': 'success',
                ...(nextType ? { [nextType]: 'processing' } : {})
              },
              completedCount
            }
          }));
        }
        
        if (currentType === 'executive') {
          const { error: execError } = await supabase.functions.invoke(
            'generate-multi-type-notes',
            { 
              body: { 
                meetingId,
                transcript,
                meetingTitle: meeting.title,
                meetingDate: format(new Date(meeting.created_at), "d MMMM yyyy"),
                meetingTime: format(new Date(meeting.created_at), "HH:mm")
              } 
            }
          );
          
          if (execError) throw new Error(`Executive notes failed: ${execError.message}`);
          await pollForNoteCompletion(meetingId, 'executive', 'meeting_notes_multi');
          completedCount++;
          
          setProcessingMeetings(prev => ({
            ...prev,
            [meetingId]: {
              ...prev[meetingId],
              currentStage: nextType || 'complete',
              stages: { 
                ...prev[meetingId].stages, 
                'executive': 'success',
                ...(nextType ? { [nextType]: 'processing' } : {})
              },
              completedCount
            }
          }));
        }
        
        if (currentType === 'limerick') {
          // Limerick is generated by multi-type-notes, just poll for it
          await pollForNoteCompletion(meetingId, 'limerick', 'meeting_notes_multi');
          completedCount++;
          
          setProcessingMeetings(prev => ({
            ...prev,
            [meetingId]: {
              ...prev[meetingId],
              currentStage: 'complete',
              stages: { 
                ...prev[meetingId].stages, 
                'limerick': 'success'
              },
              completedCount
            }
          }));
        }
      }
      
      
      // Mark all as complete
      const finalStages: any = {
        'standard': selectedTypes.standard ? 'success' : 'skipped',
        'overview': selectedTypes.overview ? 'success' : 'skipped',
        'executive': selectedTypes.executive ? 'success' : 'skipped',
        'limerick': selectedTypes.limerick ? 'success' : 'skipped'
      };
      
      setProcessingMeetings(prev => ({
        ...prev,
        [meetingId]: {
          ...prev[meetingId],
          currentStage: 'complete',
          stages: finalStages,
          completedCount: typesToProcess.length,
          isProcessing: false
        }
      }));
      
      if (onRefresh) {
        onRefresh();
      }
      
      setTimeout(() => {
        setProcessingMeetings(prev => ({
          ...prev,
          [meetingId]: {
            ...prev[meetingId],
            isProcessing: false
          }
        }));
      }, 2000);

    } catch (error: any) {
      console.error('Processing error:', error);
      
      // Mark current stage as failed
      setProcessingMeetings(prev => {
        const current = prev[meetingId];
        if (!current) return prev;
        
        return {
          ...prev,
          [meetingId]: {
            ...current,
            isProcessing: false,
            stages: {
              ...current.stages,
              [current.currentStage]: 'failed'
            },
            error: error.message
          }
        };
      });
      
      const stageNames = {
        'standard': 'Standard Notes',
        'overview': 'Meeting Overview',
        'executive': 'Executive Notes',
        'limerick': 'Limerick Notes'
      };
      
      const currentStage = processingMeetings[meetingId]?.currentStage;
      const stageName = currentStage ? stageNames[currentStage] || currentStage : 'unknown stage';
      
      console.error(`Processing failed at ${stageName}: ${error.message}`);
      
      // Clear error state after delay
      setTimeout(() => {
        setProcessingMeetings(prev => {
          const newState = { ...prev };
          delete newState[meetingId];
          return newState;
        });
      }, 8000);
    }
  };
  
  // Helper functions for processing button display
  const getProcessingButtonText = (processing: any) => {
    if (!processing) return 'Regenerate Notes';
    if (processing.currentStage === 'complete') return 'Complete!';

    if (processing.error || Object.values(processing.stages || {}).includes('failed')) {
      return 'Failed';
    }

    // For the long single-shot 'standard' stage (Gemini 3.1 Pro can take 60-120s),
    // rotate status text so users see progress, not a static spinner. No fake percentages.
    // referenced via progressTick to force re-render.
    void progressTick;
    if (processing.currentStage === 'standard' && processing.startedAt) {
      const elapsedMs = Date.now() - processing.startedAt;
      const rotationMs = getStatusRotationMs(processing.durationMinutes);
      const watchdogMs = getWatchdogThresholdMs(processing.durationMinutes);
      if (elapsedMs > watchdogMs) return 'Taking longer than usual — hang tight';
      if (elapsedMs > rotationMs * 3) return 'Finalising notes...';
      if (elapsedMs > rotationMs * 2) return 'Identifying actions & decisions...';
      if (elapsedMs > rotationMs * 1) return 'Extracting key discussion points...';
      return 'Analysing transcript...';
    }

    const stageLabels = {
      'standard': 'Standard...',
      'overview': 'Overview...',
      'executive': 'Executive...',
      'limerick': 'Limerick...'
    };

    return stageLabels[processing.currentStage] || 'Processing...';
  };

  const getProcessingButtonIcon = (processing: any) => {
    if (!processing) return FileText;
    
    if (processing.error || Object.values(processing.stages || {}).includes('failed')) {
      return AlertCircle;
    }
    
    if (processing.currentStage === 'complete') return CheckCircle2;
    
    // Show different icons for each stage
    const stageIcons: Record<string, any> = {
      'standard': FileText,
      'overview': Eye,
      'executive': Bot,
      'limerick': RefreshCw
    };
    
    return stageIcons[processing.currentStage] || RefreshCw;
  };

  const getProcessingButtonColor = (processing: any) => {
    if (!processing) return 'text-muted-foreground hover:text-primary';
    
    if (processing.error || Object.values(processing.stages || {}).includes('failed')) {
      return 'text-destructive hover:text-destructive/80';
    }
    
    if (processing.completedCount === 4 || processing.currentStage === 'complete') {
      return 'text-green-600 hover:text-green-700';
    }
    
    if (processing.isProcessing) {
      return 'text-blue-600 hover:text-blue-700';
    }
    
    return 'text-muted-foreground hover:text-primary';
  };

  const getProcessingTooltip = (processing: any) => {
    if (!processing) return "Generate Standard → Overview → Executive → Limerick notes";
    
    if (processing.error) {
      const stageNames = {
        'standard': 'Standard Notes',
        'overview': 'Meeting Overview',
        'executive': 'Executive Notes',
        'limerick': 'Limerick Notes'
      };
      const stageName = stageNames[processing.currentStage] || processing.currentStage;
      return `Failed at ${stageName}: ${processing.error}`;
    }
    
    if (processing.completedCount === 4) {
      return "All processing complete: Standard, Overview, Executive & Limerick notes generated";
    }
    
    if (processing.isProcessing) {
      const stageDescriptions = {
        'standard': 'Generating standard meeting minutes',
        'overview': 'Generating meeting overview',
        'executive': 'Generating executive minutes',
        'limerick': 'Generating limerick-style notes'
      };
      const progress = `${processing.completedCount}/4`;
      const current = stageDescriptions[processing.currentStage] || 'Processing';
      
      return `${current} (${progress})`;
    }
    
    return "Deep clean transcript, then generate Standard → Brief → Limerick → Executive notes";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in-progress':
        return <Play className="h-4 w-4 text-blue-500" />;
      case 'scheduled':
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Drama className="h-6 w-6 text-blue-500" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={5}>
              <p>Demo meeting - contains no real or confidential data</p>
            </TooltipContent>
          </Tooltip>
        );
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'completed': { variant: 'default' as const, label: 'Completed' },
      'in-progress': { variant: 'secondary' as const, label: 'In Progress' },
      'scheduled': { variant: 'outline' as const, label: 'Scheduled' },
      'cancelled': { variant: 'destructive' as const, label: 'Cancelled' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['scheduled'];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getMeetingTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'general': 'General Meeting',
      'patient-consultation': 'Patient Meeting',
      'team-meeting': 'Team Meeting',
      'clinical-review': 'Clinical Review',
      'training': 'Training Session',
      'pcn-meeting': 'PCN Meeting',
      'icb-meeting': 'ICB Meeting',
      'neighbourhood-meeting': 'Neighbourhood Meeting',
      'federation': 'Federation',
      'locality': 'Locality',
      'lmc': 'LMC',
      'gp-partners': 'GP Partners Meeting',
    };
    return types[type] || type.charAt(0).toUpperCase() + type.slice(1);
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'No duration';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatWordCount = (wordCount: number | null) => {
    if (!wordCount) return null;
    if (wordCount >= 1000) {
      return `${(wordCount / 1000).toFixed(1)}k words`;
    }
    return `${wordCount} words`;
  };

  const generateOverview = async (meeting: Meeting): Promise<string> => {
    // Priority 1: Use stored overview if available
    if (meeting.overview && meeting.overview.trim()) {
      return meeting.overview;
    }
    
    // Priority 2: Generate AI overview from meeting summary or transcript
    if (meeting.meeting_summary?.trim() || meeting.transcript?.trim()) {
      try {
        const { data, error } = await supabase.functions.invoke('generate-meeting-overview', {
          body: {
            meetingTitle: meeting.title,
            meetingNotes: meeting.meeting_summary,
            transcript: meeting.transcript
          }
        });
        
        if (error) throw error;
        if (data?.overview) {
          return data.overview;
        }
      } catch (error) {
        console.error('Error generating AI overview:', error);
        // Fall through to manual extraction
      }
    }
    
    // Priority 3: Manual extraction from meeting summary (fallback)
    if (meeting.meeting_summary && meeting.meeting_summary.trim()) {
      const summary = meeting.meeting_summary;
      const cleanedSummary = summary
        .replace(/\*\*/g, '')
        .replace(/##/g, '')
        .replace(/\d+️⃣/g, '')
        .split('\n')
        .filter(line => line.trim() && !line.includes('Meeting Minutes') && !line.includes('Date:') && !line.includes('Time:'))
        .slice(0, 2)
        .join(' ')
        .substring(0, 200);
      
      if (cleanedSummary) {
        return cleanedSummary + (cleanedSummary.length === 200 ? '...' : '');
      }
    }
    
    // Priority 4: Use description as agenda/purpose
    if (meeting.description && meeting.description.trim()) {
      const words = meeting.description.split(' ').slice(0, 20);
      return words.join(' ') + (words.length === 20 ? '...' : '');
    }
    
    // Priority 5: Basic meeting info fallback
    return `${getMeetingTypeLabel(meeting.meeting_type)} scheduled for ${format(new Date(meeting.start_time), 'MMM d, yyyy')}${meeting.duration_minutes ? ` (${formatDuration(meeting.duration_minutes)})` : ''}`;
  };

  // Render loading skeleton
  const renderLoadingSkeleton = () => (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader>
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-3 bg-muted rounded"></div>
              <div className="h-3 bg-muted rounded w-2/3"></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // Render empty state
  const renderEmptyState = () => (
    <Card className="text-center py-12">
      <CardContent>
        <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No meetings found</h3>
        <p className="text-muted-foreground mb-4">
          Start by creating your first meeting or adjust your search criteria.
        </p>
        <Button onClick={() => navigate('/')}>Create First Meeting</Button>
      </CardContent>
    </Card>
  );

  return (
    <TooltipProvider>
      <div className="space-y-4">
      {/* Conditional content based on loading/empty state */}
      {loading ? (
        renderLoadingSkeleton()
      ) : localMeetings.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
      {localMeetings.map((meeting) => {
        // Demo-only redesigned card for meetings in the Demonstrations folder
        const _folder = meetingFolderBadges.get(meeting.id);
        const _demoPatient = getDemoPatientForMeeting({
          title: meeting.title,
          folder: _folder?.name,
        });
        if (_demoPatient) {
          return (
            <DemoMeetingCard
              key={meeting.id}
              meeting={meeting}
              patient={_demoPatient}
              folderName={_folder?.name}
              onViewNotes={() => {
                if (!isResourceOperationSafe()) {
                  alert("Cannot view notes while recording is active.");
                  return;
                }
                handleSafeModeNotesClick(meeting);
              }}
              onAgeingWell={() => setAgeingWellMeeting(meeting)}
              onDownloadWord={() => handleDownloadWord(meeting)}
              onManageAttendees={() => handleAttendeesClick(meeting)}
              onDelete={() => onDelete(meeting.id)}
              onEditTitle={() => handleStartEdit(meeting.id, meeting.title)}
            />
          );
        }
        return (
        <Card key={meeting.id} className="hover:shadow-medium transition-shadow">
          <CardHeader className="pb-3">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {isSelectMode && onSelectMeeting && (
                    <Checkbox
                      checked={selectedMeetings.includes(meeting.id)}
                      onCheckedChange={(checked) => onSelectMeeting(meeting.id, checked as boolean)}
                      className="mt-1"
                    />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(meeting.status)}
                      {editingMeetingId === meeting.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => handleKeyPress(e, meeting.id)}
                            onBlur={() => handleSaveTitle(meeting.id)}
                            className="text-base sm:text-lg font-semibold h-auto py-1"
                            autoFocus
                          />
                          <button
                            onClick={() => handleCancelEdit()}
                            className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                            title="Cancel edit"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <h3 className="font-semibold text-base sm:text-lg truncate pr-2">{applyText(meeting.title)}</h3>
                          <NewMeetingBadge createdAt={meeting.created_at} />
                          {isSuspectStartTime(meeting.start_time) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditMetadataMeeting({
                                  id: meeting.id,
                                  title: meeting.title,
                                  start_time: meeting.start_time,
                                  meeting_format: meeting.meeting_format ?? null,
                                  meeting_location: (meeting as any).meeting_location ?? null,
                                });
                              }}
                              className="flex items-center gap-1 text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded border border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200 transition-colors"
                              title="Stored start time looks like a scheduled value — click to verify"
                            >
                              <AlertCircle className="h-3 w-3" />
                              Verify time
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(meeting.id, meeting.title);
                            }}
                            className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors p-1 rounded"
                            title="Edit meeting name"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditMetadataMeeting({
                                id: meeting.id,
                                title: meeting.title,
                                start_time: meeting.start_time,
                                meeting_format: meeting.meeting_format ?? null,
                                meeting_location: (meeting as any).meeting_location ?? null,
                              });
                            }}
                            className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors p-1 rounded"
                            title="Edit meeting details (date, time, format)"
                          >
                            <Calendar className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{formatUkDateLong(meeting.start_time)}</span>
                      <span>•</span>
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{formatUkTime(meeting.start_time)} {getUkTimezoneLabel(meeting.start_time)}</span>

                      {/* Duration */}
                      {meeting.duration_minutes && (
                        <>
                          <span>•</span>
                          <span className="truncate">{meeting.duration_minutes < 60 ? `${meeting.duration_minutes}m` : `${Math.floor(meeting.duration_minutes / 60)}h ${meeting.duration_minutes % 60}m`}</span>
                        </>
                      )}
                      
                      {/* Word Count */}
                      <>
                        <span>•</span>
                        <FileText className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">
                          {(() => {
                            const wc = (meeting.word_count && meeting.word_count > 0)
                              ? meeting.word_count
                              : computeWordCount(meeting);
                            const display = wc >= 1000 ? `${(wc / 1000).toFixed(1)}K words` : `${wc} words`;
                            return (
                              <>
                                {display}
                                {meeting.status === 'recording' && (
                                  <span className="text-green-600 font-medium"> (Recording Now)</span>
                                )}
                                {isStuckMeeting(meeting) && (
                                  <Badge variant="outline" className="ml-2 text-orange-600 border-orange-400">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Recovery in progress
                                  </Badge>
                                )}
                              </>
                            );
                          })()}
                        </span>
                      </>
                      
                      {/* Meeting Type - Editable */}
                      <>
                        <span>•</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-1 hover:bg-accent/50 rounded px-1 py-0.5 transition-colors">
                              {meeting.meeting_format === 'face-to-face' && (
                                <Users className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                              )}
                              {meeting.meeting_format === 'hybrid' && (
                                <MonitorSpeaker className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                              )}
                              {(!meeting.meeting_format || meeting.meeting_format === 'teams') && (
                                <Video className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-background z-50">
                            <DropdownMenuItem 
                              onClick={async () => {
                                try {
                                  const { error } = await supabase
                                    .from('meetings')
                                    .update({ meeting_format: 'teams', meeting_location: null })
                                    .eq('id', meeting.id);
                                  if (error) throw error;
                                  
                                  // Update local state
                                  setLocalMeetings(prev => prev.map(m => 
                                    m.id === meeting.id 
                                      ? { ...m, meeting_format: 'teams', meeting_location: null }
                                      : m
                                  ));
                                  toast.success('Meeting type updated to MS Teams');
                                  if (onRefresh) onRefresh();
                                } catch (error) {
                                  console.error('Error updating meeting type:', error);
                                  toast.error('Failed to update meeting type');
                                }
                              }}
                            >
                              <Video className="h-4 w-4 mr-2" />
                              MS Teams
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={async () => {
                                try {
                                  const { error } = await supabase
                                    .from('meetings')
                                    .update({ meeting_format: 'face-to-face' })
                                    .eq('id', meeting.id);
                                  if (error) throw error;
                                  
                                  // Update local state
                                  setLocalMeetings(prev => prev.map(m => 
                                    m.id === meeting.id 
                                      ? { ...m, meeting_format: 'face-to-face' }
                                      : m
                                  ));
                                  toast.success('Meeting type updated to Face to Face');
                                  if (onRefresh) onRefresh();
                                } catch (error) {
                                  console.error('Error updating meeting type:', error);
                                  toast.error('Failed to update meeting type');
                                }
                              }}
                            >
                              <Users className="h-4 w-4 mr-2" />
                              Face to Face
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={async () => {
                                try {
                                  const { error } = await supabase
                                    .from('meetings')
                                    .update({ meeting_format: 'hybrid', meeting_location: null })
                                    .eq('id', meeting.id);
                                  if (error) throw error;
                                  
                                  // Update local state
                                  setLocalMeetings(prev => prev.map(m => 
                                    m.id === meeting.id 
                                      ? { ...m, meeting_format: 'hybrid', meeting_location: null }
                                      : m
                                  ));
                                  toast.success('Meeting type updated to Hybrid');
                                  if (onRefresh) onRefresh();
                                } catch (error) {
                                  console.error('Error updating meeting type:', error);
                                  toast.error('Failed to update meeting type');
                                }
                              }}
                            >
                              <MonitorSpeaker className="h-4 w-4 mr-2" />
                              Hybrid
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                      
                      {/* Location - editable for face-to-face meetings */}
                      {meeting.meeting_format === 'face-to-face' && (
                        <>
                          <span>•</span>
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <DropdownMenu 
                            open={locationInputOpen[meeting.id]} 
                            onOpenChange={(open) => setLocationInputOpen(prev => ({ ...prev, [meeting.id]: open }))}
                          >
                            <DropdownMenuTrigger asChild>
                              <button className="flex items-center gap-1 hover:bg-accent/50 rounded px-1 py-0.5 transition-colors text-xs">
                                <span className="truncate max-w-[120px]">
                                  {meeting.meeting_location || 'Set location'}
                                </span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-background z-50 w-64">
                              <div className="p-2 space-y-1">
                                <Input
                                  placeholder="Type or select location..."
                                  value={locationInputValues[meeting.id] ?? meeting.meeting_location ?? ''}
                                  onChange={(e) => {
                                    const newLocation = e.target.value;
                                    // Update local input value immediately for smooth typing
                                    setLocationInputValues(prev => ({ ...prev, [meeting.id]: newLocation }));
                                    
                                    // Update local meetings state immediately for visual feedback
                                    setLocalMeetings(prev => prev.map(m => 
                                      m.id === meeting.id 
                                        ? { ...m, meeting_location: newLocation }
                                        : m
                                    ));
                                  }}
                                  onBlur={async () => {
                                    // Save to database when user finishes typing
                                    const newLocation = locationInputValues[meeting.id] ?? meeting.meeting_location ?? '';
                                    try {
                                      const { error } = await supabase
                                        .from('meetings')
                                        .update({ meeting_location: newLocation })
                                        .eq('id', meeting.id);
                                      if (error) throw error;
                                    } catch (error) {
                                      console.error('Error updating location:', error);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                  className="h-8 text-xs"
                                />
                                <div className="text-xs text-muted-foreground px-2 py-1 font-medium">Practice Locations</div>
                                {userPractices.map((practice) => (
                                  <DropdownMenuItem
                                    key={practice.id}
                                    onClick={async () => {
                                      try {
                                        const { error } = await supabase
                                          .from('meetings')
                                          .update({ meeting_location: practice.practice_name })
                                          .eq('id', meeting.id);
                                        if (error) throw error;
                                        
                                        setLocalMeetings(prev => prev.map(m => 
                                          m.id === meeting.id 
                                            ? { ...m, meeting_location: practice.practice_name }
                                            : m
                                        ));
                                        setLocationInputOpen(prev => ({ ...prev, [meeting.id]: false }));
                                      } catch (error) {
                                        console.error('Error updating location:', error);
                                      }
                                    }}
                                  >
                                    {practice.practice_name}
                                  </DropdownMenuItem>
                                ))}
                                {customLocations.length > 0 && (
                                  <>
                                    <div className="text-xs text-muted-foreground px-2 py-1 font-medium border-t mt-1 pt-2">Recent Locations</div>
                                    {customLocations.filter(loc => !userPractices.some(p => p.practice_name === loc)).slice(0, 5).map((location, idx) => (
                                      <DropdownMenuItem
                                        key={idx}
                                        onClick={async () => {
                                          try {
                                            const { error } = await supabase
                                              .from('meetings')
                                              .update({ meeting_location: location })
                                              .eq('id', meeting.id);
                                            if (error) throw error;
                                            
                                            setLocalMeetings(prev => prev.map(m => 
                                              m.id === meeting.id 
                                                ? { ...m, meeting_location: location }
                                                : m
                                            ));
                                            setLocationInputOpen(prev => ({ ...prev, [meeting.id]: false }));
                                          } catch (error) {
                                            console.error('Error updating location:', error);
                                          }
                                        }}
                                      >
                                        {location}
                                      </DropdownMenuItem>
                                    ))}
                                  </>
                                )}
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                      
                      {meeting.import_source && (
                        <Badge variant="outline" className="text-xs">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          {meeting.import_source_display || meeting.import_source.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                      )}
                      
                      {/* Re-transcribe indicator kept inline as small badge for context */}
                      {meeting.import_source?.startsWith('mobile_') && (!meeting.word_count || meeting.word_count === 0) && (
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400">
                          <AlertCircle className="h-2.5 w-2.5 mr-1" />
                          Needs reprocessing
                        </Badge>
                      )}
                      
                      {meeting.meeting_config && Object.keys(meeting.meeting_config).length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <MapPin className="h-3 w-3 mr-1" />
                          Configured
                        </Badge>
                      )}
                      
                      {meeting.folder_id ? (() => {
                        const folder = meetingFolderBadges.get(meeting.id);

                        if (!folder) {
                          return (
                            <Badge variant="outline" className="text-xs">
                              <Folder className="h-3 w-3 mr-1" />
                              In folder
                            </Badge>
                          );
                        }

                        return (
                          <FolderBadge
                            folderName={folder.name}
                            folderColour={folder.colour}
                          />
                        );
                      })() : null}
                    </div>

                    {/* Recording Error Card for failed/stuck recordings */}
                    {(meeting.import_source?.startsWith('mobile_') || ((!meeting.word_count || meeting.word_count === 0) && ['processing', 'recording'].includes(meeting.status))) && (!meeting.word_count || meeting.word_count === 0) && (
                      <RecordingErrorCard
                        meetingId={meeting.id}
                        meetingTitle={meeting.title}
                        wordCount={meeting.word_count ?? null}
                        durationMinutes={meeting.duration_minutes}
                        importSource={meeting.import_source}
                        onReprocessComplete={(meetingId) => {
                          if (onRefresh) onRefresh();
                        }}
                      />
                    )}

                    {/* Display Attendees */}
                    {meetingAttendees[meeting.id] && meetingAttendees[meeting.id].length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Attendees:
                        </span>
                        {(expandedAttendees[meeting.id] 
                          ? meetingAttendees[meeting.id] 
                          : meetingAttendees[meeting.id].slice(0, 5)
                        ).map((attendee: any, idx: number) => {
                          const emailMatch = attendee.email?.toLowerCase() === user?.email?.toLowerCase();
                          const nameMatch = userFullNameLower ? attendee.name?.toLowerCase() === userFullNameLower : true;
                          const isUserAttendee = emailMatch && nameMatch;
                          
                          return (
                            <AttendeeRoleBadge
                              key={attendee.id ?? idx}
                              attendee={attendee}
                              meetingId={meeting.id}
                              meetingRole={attendee.meeting_role}
                              isCurrentUser={isUserAttendee}
                              onRoleChange={() => {
                              // Refetch attendees after role change
                              const fetchAttendees = async () => {
                                const { data } = await supabase
                                  .from('meeting_attendees')
                                  .select(`
                                    meeting_id,
                                    meeting_role,
                                    attendee_id,
                                    attendees:attendee_id (
                                      id,
                                      name,
                                      title,
                                      email,
                                      organization,
                                      organization_type,
                                      role,
                                      user_id
                                    )
                                  `)
                                  .eq('meeting_id', meeting.id);

                                if (data) {
                                  const attendees = data
                                    .map((link: any) => link.attendees ? {
                                      ...link.attendees,
                                      meeting_role: link.meeting_role || 'attendee'
                                    } : null)
                                    .filter(Boolean);
                                  
                                  // Sort attendees
                                  attendees.sort((a: any, b: any) => {
                                    const isCurrentUserAttendee = (att: any) => {
                                      const emailMatch = att.email?.toLowerCase() === user?.email?.toLowerCase();
                                      const nameMatch = userFullNameLower ? att.name?.toLowerCase() === userFullNameLower : true;
                                      return emailMatch && nameMatch;
                                    };

                                    const getRolePriority = (att: any) => {
                                      if (att.meeting_role === 'chair') return 0;
                                      if (att.meeting_role === 'key_participant') return 1;
                                      if (isCurrentUserAttendee(att)) return 2;
                                      return 3;
                                    };
                                    
                                    return getRolePriority(a) - getRolePriority(b);
                                  });
                                  
                                  setMeetingAttendees(prev => ({
                                    ...prev,
                                    [meeting.id]: attendees
                                  }));
                                }
                              };
                              fetchAttendees();
                            }}
                          />
                        );
                        })}
                        {meetingAttendees[meeting.id].length > 5 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => setExpandedAttendees(prev => ({
                              ...prev,
                              [meeting.id]: !prev[meeting.id]
                            }))}
                          >
                            {expandedAttendees[meeting.id] 
                              ? 'Show less' 
                              : `+${meetingAttendees[meeting.id].length - 5} more`
                            }
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Name & Term Corrections Badge */}
              {hasCorrections && (() => {
                const corrections = getCorrectionsForText(meeting.title, meeting.overview);
                if (corrections.length === 0) return null;
                return (
                  <div className="mb-2">
                    <MeetingCorrectionsBadge
                      corrections={corrections}
                      isUpdating={updatingMeetings[meeting.id]}
                      onUpdateMeeting={() => {
                        updateMeeting(meeting.id, meeting.title, meeting.overview || null, (updates) => {
                          setLocalMeetings(prev => prev.map(m =>
                            m.id === meeting.id
                              ? { ...m, ...(updates.title ? { title: updates.title } : {}), ...(updates.overview ? { overview: updates.overview } : {}) }
                              : m
                          ));

                          if (updates.title && updates.title !== meeting.title) {
                            onMeetingUpdate?.(meeting.id, updates.title);
                          }

                          onRefresh?.();
                        });
                      }}
                    />
                  </div>
                );
              })()}

              {/* Demo Patient Banner — only for meetings in Demonstrations folder */}
              {(() => {
                const folder = meetingFolderBadges.get(meeting.id);
                const demoPatient = getDemoPatientForMeeting({
                  title: meeting.title,
                  folder: folder?.name,
                });
                return demoPatient ? <PatientBanner patient={demoPatient} /> : null;
              })()}

              {/* Action Buttons - Mobile Optimized - All inline */}
              <div className="flex flex-wrap gap-2">
                
                {/* Show recording warning if operation blocked */}
                {!isResourceOperationSafe() && (
                  <RecordingWarningBanner 
                    operation="Viewing meeting notes"
                    className="mb-2 w-full"
                  />
                )}
                

                {/* View Notes button */}
                <Button
                  variant="default"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (!isResourceOperationSafe()) {
                      alert("Cannot view notes while recording is active.");
                      return;
                    }
                    
                    console.log('📱 Click event - opening notes modal for meeting:', meeting.id);
                    try {
                      // Open the main notes modal directly
                      handleSafeModeNotesClick(meeting);
                    } catch (error) {
                      console.error('❌ Error:', error);
                      alert('Error opening notes: ' + error.message);
                    }
                  }}
                  className="flex items-center justify-center gap-2 flex-1 sm:flex-none touch-manipulation min-h-[44px]"
                >
                  <FileText className="h-4 w-4" />
                  <span>View Meeting Notes</span>
                </Button>

                {/* Audio Backup Button - Only show if audio backup exists */}
                {meeting.audio_backup_path && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAudioBackup(meeting)}
                    className="flex items-center justify-center gap-2 flex-1 sm:flex-none touch-manipulation min-h-[44px] text-blue-600 hover:text-blue-700"
                  >
                    <Volume2 className="h-4 w-4" />
                    <span>Audio Backup</span>
                  </Button>
                )}

                {/* Manage Attendees Button - Always visible */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAttendeesClick(meeting)}
                  className="flex items-center justify-center gap-2 flex-1 sm:flex-none touch-manipulation min-h-[44px] text-purple-600 hover:text-purple-700"
                >
                  <Users className="h-4 w-4" />
                  <span className={isMobile ? 'hidden sm:inline' : ''}>Manage Attendees</span>
                  {isMobile && <span className="sm:hidden">Attendees</span>}
                </Button>

                {/* Quick Word Download Button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadWord(meeting)}
                        className="flex items-center justify-center gap-2 flex-1 sm:flex-none touch-manipulation min-h-[44px] text-blue-600 hover:text-blue-700"
                      >
                        <FileDown className="h-4 w-4" />
                        <span className={isMobile ? 'hidden sm:inline' : ''}>Word</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Download Meeting Notes (Word)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Ageing Well Demo Button - contextual */}
                {(meeting.title?.toLowerCase().includes("ageing well") ||
                  meeting.title?.toLowerCase().includes("agewell")) && (
                  <Button
                    size="sm"
                    onClick={() => setAgeingWellMeeting(meeting)}
                    className="flex items-center justify-center gap-2 flex-1 sm:flex-none touch-manipulation min-h-[44px] text-white font-medium border-0 transition-all hover:-translate-y-px hover:shadow-md"
                    style={{
                      background: "linear-gradient(135deg, #2E7D4F 0%, #1E8449 100%)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "linear-gradient(135deg, #266a43 0%, #186e3d 100%)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        "linear-gradient(135deg, #2E7D4F 0%, #1E8449 100%)";
                    }}
                  >
                    <HeartPulse className="h-4 w-4" />
                    <span className={isMobile ? "hidden sm:inline" : ""}>Ageing Well</span>
                    <ChevronRight className="h-4 w-4 opacity-80" />
                  </Button>
                )}

                {/* Actions Dropdown Menu */}
                <AlertDialog>
                  <DropdownMenu 
                    open={openDropdowns[meeting.id] || false}
                    onOpenChange={(open) => setOpenDropdowns(prev => ({ ...prev, [meeting.id]: open }))}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center justify-center gap-2 flex-1 sm:flex-none touch-manipulation min-h-[44px]"
                      >
                        <MoreVertical className="h-4 w-4" />
                        <span>Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      align="end" 
                      className="w-48 bg-popover border shadow-md z-50"
                      sideOffset={5}
                    >
                      {/* Continue Meeting - Only show for today's meetings */}
                      {isToday(new Date(meeting.created_at)) && (
                        <DropdownMenuItem 
                          onSelect={(e) => {
                            e.preventDefault();
                            setOpenDropdowns(prev => ({ ...prev, [meeting.id]: false }));
                            handleContinueMeeting(meeting);
                          }}
                          disabled={!isResourceOperationSafe()}
                          className="text-green-600 focus:text-green-700"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Continue Recording
                        </DropdownMenuItem>
                      )}

                       <DropdownMenuItem 
                          onSelect={(e) => {
                            e.preventDefault();
                            setOpenDropdowns(prev => ({ ...prev, [meeting.id]: false }));
                            handleEmailMinutesClick(meeting);
                          }}
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Email Meeting Notes
                        </DropdownMenuItem>

                      {isMobile ? (
                        <DropdownMenuItem 
                          onSelect={(e) => {
                            e.preventDefault();
                            // Close dropdown first
                            setOpenDropdowns(prev => ({ ...prev, [meeting.id]: false }));
                            // Small delay to allow dropdown to close
                            setTimeout(() => {
                              setSelectedMeetingForFolder(meeting);
                              setFolderSheetOpen(true);
                            }, 100);
                          }}
                        >
                          <Folder className="h-4 w-4 mr-2" />
                          Assign to Folder
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <Folder className="h-4 w-4 mr-2" />
                              Assign to Folder
                            </DropdownMenuItem>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right" align="start" className="bg-popover border shadow-md z-50">
                             <DropdownMenuItem onClick={async () => {
                                console.log('🗂 Child: Assigning meeting to no folder', meeting.id);
                                const success = await assignMeetingToFolder(meeting.id, null);
                                if (!success) return;
                                // Notify parent immediately
                                onFolderAssigned?.(meeting.id, null);
                                // Optimistic local update for immediate feedback
                                setLocalMeetings(prev => prev.map(m => 
                                  m.id === meeting.id ? { ...m, folder_id: null } : m
                                ));
                              }}>
                                None (Unfiled)
                              </DropdownMenuItem>
                              {folders.map((folder) => (
                                <DropdownMenuItem 
                                  key={folder.id}
                                  onClick={async () => {
                                    console.log('🗂 Child: Assigning meeting to folder', { meetingId: meeting.id, folderId: folder.id });
                                    const success = await assignMeetingToFolder(meeting.id, folder.id);
                                    if (!success) return;
                                    // Notify parent immediately
                                    onFolderAssigned?.(meeting.id, folder.id);
                                    // Optimistic local update for immediate feedback
                                    setLocalMeetings(prev => prev.map(m => 
                                      m.id === meeting.id ? { ...m, folder_id: folder.id } : m
                                    ));
                                  }}
                                >
                                  <Folder className="h-3 w-3 mr-2" style={{ color: folder.colour }} />
                                  {folder.name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                         </DropdownMenu>
                       )}

                      <DropdownMenuItem 
                        onSelect={(e) => {
                          e.preventDefault();
                          setOpenDropdowns(prev => ({ ...prev, [meeting.id]: false }));
                          handleDownloadWord(meeting);
                        }}
                      >
                        <FileDown className="h-4 w-4 mr-2" />
                        Download Meeting Notes (Word)
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onSelect={(e) => {
                          e.preventDefault();
                          setOpenDropdowns(prev => ({ ...prev, [meeting.id]: false }));
                          handleProcessClick(meeting);
                        }}
                        disabled={processingMeetings[meeting.id]?.isProcessing}
                        className={processingMeetings[meeting.id]?.isProcessing ? 'opacity-50' : ''}
                      >
                        {(() => {
                          const IconComponent = getProcessingButtonIcon(processingMeetings[meeting.id]);
                          const processing = processingMeetings[meeting.id];
                          const shouldSpin = processing?.isProcessing && processing.currentStage !== 'complete';
                          return <IconComponent className={`h-4 w-4 mr-2 ${shouldSpin ? 'animate-spin' : ''}`} />;
                      })()}
                        {getProcessingButtonText(processingMeetings[meeting.id])}
                      </DropdownMenuItem>

                      {/* Gemini 3 Flash — fast, lower-quality alternative for quick re-runs */}
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setOpenDropdowns(prev => ({ ...prev, [meeting.id]: false }));
                          const ok = window.confirm(
                            'Regenerate with Gemini 3 Flash?\n\n' +
                            'Faster generation (~25 seconds) but slightly lower extraction quality ' +
                            'than the default. Useful for quick re-runs.\n\n' +
                            'Use Flash?'
                          );
                          if (ok) {
                            handleProcessClick(meeting, 'gemini-3-flash');
                          }
                        }}
                        disabled={processingMeetings[meeting.id]?.isProcessing}
                        className={processingMeetings[meeting.id]?.isProcessing ? 'opacity-50' : ''}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        {processingMeetings[meeting.id]?.isProcessing ? 'Processing...' : 'Regenerate with Gemini 3 Flash (fast)'}
                      </DropdownMenuItem>

                      {/* Claude Sonnet 4.6 — alternative perspective for cross-checking */}
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setOpenDropdowns(prev => ({ ...prev, [meeting.id]: false }));
                          const ok = window.confirm(
                            'Regenerate with Claude Sonnet 4.6?\n\n' +
                            "Anthropic's model — provides a different perspective on the same " +
                            'transcript. Useful for cross-checking action item extraction.\n\n' +
                            'Use Sonnet?'
                          );
                          if (ok) {
                            handleProcessClick(meeting, 'sonnet-4.6');
                          }
                        }}
                        disabled={processingMeetings[meeting.id]?.isProcessing}
                        className={processingMeetings[meeting.id]?.isProcessing ? 'opacity-50' : ''}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        {processingMeetings[meeting.id]?.isProcessing ? 'Processing...' : 'Regenerate with Sonnet 4.6 (alternative)'}
                      </DropdownMenuItem>

                      {/* OpenAI GPT-5.2 — third-provider option for cross-checking */}
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setOpenDropdowns(prev => ({ ...prev, [meeting.id]: false }));
                          const ok = window.confirm(
                            'Regenerate with OpenAI GPT-5.2?\n\n' +
                            "OpenAI's current flagship model — provides a third-provider perspective " +
                            'alongside Gemini and Sonnet for side-by-side comparison.\n\n' +
                            'Use GPT-5.2?'
                          );
                          if (ok) {
                            handleProcessClick(meeting, 'gpt-5.2');
                          }
                        }}
                        disabled={processingMeetings[meeting.id]?.isProcessing}
                        className={processingMeetings[meeting.id]?.isProcessing ? 'opacity-50' : ''}
                      >
                        <Brain className="h-4 w-4 mr-2" />
                        {processingMeetings[meeting.id]?.isProcessing ? 'Processing...' : 'Regenerate with GPT-5.2 (OpenAI)'}
                      </DropdownMenuItem>


                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem 
                          onSelect={(e) => {
                            e.preventDefault();
                            setOpenDropdowns(prev => ({ ...prev, [meeting.id]: false }));
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Meeting
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <AlertDialogContent className="mx-4 max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
                       <AlertDialogDescription>
                         Are you sure you want to delete "{meeting.title}"? This action cannot be undone.
                         This will permanently delete the meeting, transcript, summary, and any uploaded documents.
                       </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                      <AlertDialogCancel className="touch-manipulation min-h-[44px]">Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => onDelete(meeting.id)}
                        className="bg-destructive hover:bg-destructive/90 touch-manipulation min-h-[44px]"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                </div> {/* Close action buttons container */}
              </div>
            </CardHeader>
          
          <CardContent className="pt-0">
            <div className="space-y-3">
              {/* Meeting Details Tabs */}
               <MeetingDetailsTabs
                meetingId={meeting.id}
                meetingTitle={meeting.title || "Meeting"}
                currentOverview={meeting.overview || ""}
                audioOverviewUrl={meeting.audio_overview_url || undefined}
                audioOverviewText={meeting.audio_overview_text || undefined}
                audioOverviewDuration={meeting.audio_overview_duration || undefined}
                meetingDurationMinutes={meeting.duration_minutes || undefined}
                meetingAttendees={meetingAttendees[meeting.id]?.map((a: any) => a.name) || []}
                chairName={meetingAttendees[meeting.id]?.find((a: any) => a.meeting_role === 'chair')?.name}
                wordCount={meeting.word_count || 0}
                notesGenerationStatus={meeting.notes_generation_status}
                onOverviewChange={(newOverview) => {
                  setLocalMeetings(prev => prev.map(m => 
                    m.id === meeting.id ? { ...m, overview: newOverview } : m
                  ));
                  onRefresh?.();
                }}
                onRegenerateAudio={async () => {
                  onRefresh?.();
                }}
                onDocumentRemoved={() => {
                  setDocListRefresh(prev => ({ ...prev, [meeting.id]: (prev[meeting.id] || 0) + 1 }));
                  onRefresh?.();
                }}
                className="mb-3"
              />

              {/* Audio Recording Playback - Show if any recording URLs exist and showRecordingPlayback is true */}
              {showRecordingPlayback && (meeting.mixed_audio_url || meeting.left_audio_url || meeting.right_audio_url) && (
                <Collapsible 
                  open={collapsedAudioSections[meeting.id] === true} 
                  onOpenChange={(open) => setCollapsedAudioSections(prev => ({ ...prev, [meeting.id]: open }))}
                >
                  <div className="bg-muted/30 rounded-lg border border-muted">
                    <CollapsibleTrigger asChild>
                      <button className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <Volume2 className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Recording Playback</span>
                          {meeting.recording_created_at && (
                            <span className="text-xs text-muted-foreground">
                              • {format(new Date(meeting.recording_created_at), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                        <ChevronDown className={`h-4 w-4 transition-transform ${collapsedAudioSections[meeting.id] === true ? 'rotate-180' : ''}`} />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-3 pb-3">
                      <div className="space-y-3">
                        {/* Mixed Recording (Left + Right Channels) */}
                        {meeting.mixed_audio_url && (
                          <div className="p-3 bg-accent/10 rounded-lg border border-accent/20">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="p-1.5 rounded-full bg-accent/20">
                                <Headphones className="h-4 w-4 text-accent" />
                              </div>
                              <span className="text-sm font-medium">Mixed Recording (Left + Right Channels)</span>
                              {!audioUrls[meeting.id]?.mixedAudioSignedUrl && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => generateSignedUrls(meeting.id, meeting)}
                                  className="ml-auto"
                                >
                                  Load Audio
                                </Button>
                              )}
                            </div>
                            <audio
                              src={audioUrls[meeting.id]?.mixedAudioSignedUrl || undefined}
                              controls
                              className="w-full h-8"
                              preload="metadata"
                              onLoadStart={() => generateSignedUrls(meeting.id, meeting)}
                            />
                          </div>
                        )}

                        {/* Left Channel (Microphone) */}
                        {meeting.left_audio_url && (
                          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/50">
                                <Mic className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <span className="text-sm font-medium">Left Channel Recording (Microphone)</span>
                              {!audioUrls[meeting.id]?.leftAudioSignedUrl && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => generateSignedUrls(meeting.id, meeting)}
                                  className="ml-auto"
                                >
                                  Load Audio
                                </Button>
                              )}
                            </div>
                            <audio
                              src={audioUrls[meeting.id]?.leftAudioSignedUrl || undefined}
                              controls
                              className="w-full h-8"
                              preload="metadata"
                              onLoadStart={() => generateSignedUrls(meeting.id, meeting)}
                            />
                          </div>
                        )}

                        {/* Right Channel (System Audio) */}
                        {meeting.right_audio_url && (
                          <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="p-1.5 rounded-full bg-green-100 dark:bg-green-900/50">
                                <Monitor className="h-4 w-4 text-green-600 dark:text-green-400" />
                              </div>
                              <span className="text-xs font-medium">"Right Channel Recording (System Audio)"</span>
                              {!audioUrls[meeting.id]?.rightAudioSignedUrl && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => generateSignedUrls(meeting.id, meeting)}
                                  className="ml-auto"
                                >
                                  Load Audio
                                </Button>
                              )}
                            </div>
                            <audio
                              src={audioUrls[meeting.id]?.rightAudioSignedUrl || undefined}
                              controls
                              className="w-full h-8"
                              preload="metadata"
                              onLoadStart={() => generateSignedUrls(meeting.id, meeting)}
                            />
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}
              
              {/* Meeting Stats - Mobile Responsive */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  {meeting.transcript_count ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageSquare className="h-3 w-3 flex-shrink-0" />
                      <span>Transcript available</span>
                    </div>
                  ) : null}
                  
                  {meeting.summary_exists && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="h-3 w-3 flex-shrink-0" />
                      <span>Summary available</span>
                      {onOpenCorrectionManager && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenCorrectionManager();
                              }}
                              className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors p-0.5 rounded"
                              aria-label="Open name and term corrections"
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Name & term corrections</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  )}
                  
                </div>
                
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  Created {format(new Date(meeting.created_at), 'd MMM yyyy')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        );
      })}
        </>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Documents</DialogTitle>
            <DialogDescription>
              Add supporting documents for "{selectedMeetingForUpload?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <SimpleFileUpload
                onFileUpload={handleFileUpload}
                accept=".pdf,.doc,.docx,.xlsx,.csv,.txt,.jpg,.jpeg,.png"
                maxSize={25}
                multiple={true}
              />
            </div>
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Selected Files:</label>
                {selectedFiles.map((file, index) => (
                  <div key={index} className="text-sm text-muted-foreground">
                    {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setUploadDialogOpen(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button 
                onClick={uploadDocuments}
                disabled={selectedFiles.length === 0 || uploading}
                className="flex items-center gap-2"
              >
                {uploading ? (
                  <Upload className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile Notes Sheet */}
      {mobileNotesOpen && (
        <MobileNotesSheet
          isOpen={mobileNotesOpen}
          onOpenChange={setMobileNotesOpen}
          meeting={selectedMeetingForNotes}
          notes={meetingNotes}
        />
      )}

      {/* Full-featured Notes Modal (all devices) */}
      {desktopNotesOpen && (
        <FullPageNotesModal
          isOpen={desktopNotesOpen}
          onClose={() => setDesktopNotesOpen(false)}
          meeting={selectedMeetingForNotes}
          notes={meetingNotes}
          onNotesChange={setMeetingNotes}
        />
      )}

      {/* Safe Mode Notes Modal - Lightweight alternative */}
      <SafeModeNotesModal
        isOpen={safeModeModalOpen}
        onClose={() => {
          safeModeModalOpenRef.current = false;
          setSafeModeModalOpen(false);
        }}
        meeting={safeModeSelectedMeeting}
        notes={safeModeNotes}
      />

      {/* Email Meeting Minutes Modal */}
      <EmailMeetingMinutesModal
        isOpen={emailModalOpen && selectedMeetingForEmail !== null}
        onOpenChange={setEmailModalOpen}
        meetingId={selectedMeetingForEmail?.id || ''}
        meetingTitle={selectedMeetingForEmail?.title || ''}
        meetingNotes={selectedMeetingForEmail?.meeting_summary || selectedMeetingForEmail?.transcript || ''}
      />
      
      {/* Process Confirmation Dialog */}
      <AlertDialog open={confirmProcessDialog.open} onOpenChange={(open) => {
        if (!open) {
          setConfirmProcessDialog({ 
            open: false, 
            meeting: null, 
            lastRun: null,
            selectedTypes: {
              standard: true,
              overview: true,
              executive: false,
              limerick: false
            }
          });
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Process Meeting Notes</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4">
                <p>Select which note types to generate (in sequential order):</p>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="standard"
                      checked={confirmProcessDialog.selectedTypes.standard}
                      onCheckedChange={(checked) => {
                        setConfirmProcessDialog(prev => ({
                          ...prev,
                          selectedTypes: {
                            ...prev.selectedTypes,
                            standard: checked === true
                          }
                        }));
                      }}
                    />
                    <label htmlFor="standard" className="text-sm font-medium cursor-pointer">
                      Standard Minutes
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="overview"
                      checked={confirmProcessDialog.selectedTypes.overview}
                      onCheckedChange={(checked) => {
                        setConfirmProcessDialog(prev => ({
                          ...prev,
                          selectedTypes: {
                            ...prev.selectedTypes,
                            overview: checked === true
                          }
                        }));
                      }}
                    />
                    <label htmlFor="overview" className="text-sm font-medium cursor-pointer">
                      Meeting Overview
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="executive"
                      checked={confirmProcessDialog.selectedTypes.executive}
                      onCheckedChange={(checked) => {
                        setConfirmProcessDialog(prev => ({
                          ...prev,
                          selectedTypes: {
                            ...prev.selectedTypes,
                            executive: checked === true
                          }
                        }));
                      }}
                    />
                    <label htmlFor="executive" className="text-sm font-medium cursor-pointer">
                      Executive Minutes
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="limerick"
                      checked={confirmProcessDialog.selectedTypes.limerick}
                      onCheckedChange={(checked) => {
                        setConfirmProcessDialog(prev => ({
                          ...prev,
                          selectedTypes: {
                            ...prev.selectedTypes,
                            limerick: checked === true
                          }
                        }));
                      }}
                    />
                    <label htmlFor="limerick" className="text-sm font-medium cursor-pointer">
                      Limerick Minutes
                    </label>
                  </div>
                </div>
                
                {confirmProcessDialog.lastRun && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded dark:bg-amber-950 dark:border-amber-800">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Last processed: {confirmProcessDialog.lastRun}
                    </p>
                  </div>
                )}
                
                <div className="p-3 bg-blue-50 border border-blue-200 rounded dark:bg-blue-950 dark:border-blue-800">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    ⚠️ Only run if you have updated the meeting transcript or context
                  </p>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Processing takes approximately 1-2 minutes per note type and will regenerate selected types.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (confirmProcessDialog.meeting) {
                  handleFullProcessing(confirmProcessDialog.meeting, confirmProcessDialog.selectedTypes);
                }
                setConfirmProcessDialog({ 
                  open: false, 
                  meeting: null, 
                  lastRun: null,
                  selectedTypes: {
                    standard: true,
                    overview: true,
                    executive: true,
                    limerick: true
                  }
                });
              }}
              disabled={!Object.values(confirmProcessDialog.selectedTypes).some(v => v)}
            >
              Proceed with Processing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Attendee Modal */}
      {selectedMeetingForAttendees && (
        <LiveImportModal
          open={attendeeModalOpen}
          onOpenChange={(open) => {
            setAttendeeModalOpen(open);
            if (!open) setSelectedMeetingForAttendees(null);
          }}
          defaultTab="attendees"
          meetingId={selectedMeetingForAttendees.id}
        />
      )}

      {/* Folder Assignment Sheet for Mobile */}
      <FolderAssignmentSheet
        open={folderSheetOpen}
        onOpenChange={setFolderSheetOpen}
        folders={folders}
        currentFolderId={selectedMeetingForFolder?.folder_id}
        onAssign={async (folderId) => {
          if (selectedMeetingForFolder) {
            console.log('🗂 Child: Mobile sheet assigning folder', { meetingId: selectedMeetingForFolder.id, folderId });
            const success = await assignMeetingToFolder(selectedMeetingForFolder.id, folderId);
            if (!success) return;
            // Notify parent immediately
            onFolderAssigned?.(selectedMeetingForFolder.id, folderId);
            // Optimistic local update for immediate feedback
            setLocalMeetings(prev => prev.map(m => 
              m.id === selectedMeetingForFolder.id ? { ...m, folder_id: folderId } : m
            ));
          }
        }}
      />

      {/* Ageing Well Demo Modal */}
      <AgeingWellDemoModal
        isOpen={!!ageingWellMeeting}
        onClose={() => setAgeingWellMeeting(null)}
        patientName="Dorothy Pearson"
        meetingTitle={ageingWellMeeting?.title}
      />

      {/* Edit meeting metadata (title, date, time, format) */}
      <EditMeetingMetadataDialog
        open={!!editMetadataMeeting}
        onOpenChange={(o) => { if (!o) setEditMetadataMeeting(null); }}
        meeting={editMetadataMeeting}
        onSaved={(updated) => {
          if (!editMetadataMeeting) return;
          const id = editMetadataMeeting.id;
          setLocalMeetings(prev => prev.map(m =>
            m.id === id ? { ...m, ...updated } as Meeting : m
          ));
          if (onRefresh) onRefresh();
        }}
      />
    </div>
    </TooltipProvider>
  );
};