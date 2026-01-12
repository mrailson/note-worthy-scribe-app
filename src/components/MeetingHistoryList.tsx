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
  FilePlus2
} from "lucide-react";
import { TranscriptContextDialog } from "@/components/meeting/TranscriptContextDialog";
import { UploadedFile } from '@/types/ai4gp';
import { formatTranscriptContext, extractCleanContent } from '@/utils/meeting/formatTranscriptContext';
import { parseAttendeesFromText } from '@/utils/meeting/parseAttendeesFromText';
import { ShareMeetingDialog } from "@/components/ShareMeetingDialog";
import { SharedMeetingBadge } from "@/components/SharedMeetingBadge";
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
import { useState, useEffect, useRef } from "react";
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
import { MeetingAttendeeModal } from './MeetingAttendeeModal';
import { useAuth } from '@/contexts/AuthContext';
import { AttendeeRoleBadge } from './meeting-history/AttendeeRoleBadge';
import { useMeetingExport } from '@/hooks/useMeetingExport';
import { toast } from 'sonner';
import { TranscriptRepairButton } from '@/components/admin/TranscriptRepairButton';
import { useVoicePreference } from '@/hooks/useVoicePreference';
import { useMeetingFolders } from '@/hooks/useMeetingFolders';
import { FolderBadge } from '@/components/meeting-folders/FolderBadge';
import { FolderAssignmentSheet } from '@/components/meeting-folders/FolderAssignmentSheet';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";


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
}

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
  onFolderAssigned
}: MeetingHistoryListProps) => {
  const navigate = useNavigate();
  const { isRecording, isResourceOperationSafe, setRecordingState } = useRecording();
  const { user, isSystemAdmin } = useAuth();
  const { voiceConfig } = useVoicePreference();
  const { folders, assignMeetingToFolder } = useMeetingFolders();
  const userFullNameLower = (user?.user_metadata?.full_name || user?.user_metadata?.name || '').toLowerCase();
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
  const [folderSheetOpen, setFolderSheetOpen] = useState(false);
  const [selectedMeetingForFolder, setSelectedMeetingForFolder] = useState<Meeting | null>(null);
  const [showContextDialog, setShowContextDialog] = useState(false);
  const [selectedMeetingForContext, setSelectedMeetingForContext] = useState<Meeting | null>(null);
  
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

  // Fetch transcript-based word counts for meetings
  useEffect(() => {
    const fetchWordCounts = async () => {
      const meetingIds = meetings.map(m => m.id);
      if (meetingIds.length === 0) return;

      try {
        const { data, error } = await supabase
          .from('meeting_transcripts')
          .select('meeting_id, content')
          .in('meeting_id', meetingIds);

        if (error) {
          console.error('❌ Error fetching word counts:', error);
          return;
        }

        const map: Record<string, number> = {};
        (data || []).forEach((row: any) => {
          const count = (row.content || '').trim().split(/\s+/).filter((w: string) => w.length > 0).length;
          map[row.meeting_id] = Math.max(map[row.meeting_id] || 0, count);
        });

        setWordCounts(map);
      } catch (e) {
        console.error('❌ Error computing word counts:', e);
      }
    };

    fetchWordCounts();
  }, [meetings]);

  // Real-time subscription for automatic refresh when meetings are updated
  useEffect(() => {
    if (!onRefresh || !user?.id) return;

    console.log('🔄 Setting up real-time subscription for meeting updates');

    // Create a channel for real-time updates
    const channel = supabase
      .channel('meeting-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'meetings',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔔 Meeting updated via realtime:', payload);
          // Trigger refresh after a short delay to allow database to settle
          setTimeout(() => {
            onRefresh();
          }, 500);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_notes_multi'
        },
        (payload) => {
          console.log('🔔 Meeting notes updated via realtime:', payload);
          setTimeout(() => {
            onRefresh();
          }, 500);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_overviews'
        },
        (payload) => {
          console.log('🔔 Meeting overview updated via realtime:', payload);
          setTimeout(() => {
            onRefresh();
          }, 500);
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      console.log('🔌 Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [onRefresh, user?.id]);
  
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
  
  // Add state for signed URLs
  const [audioUrls, setAudioUrls] = useState<Record<string, AudioUrls>>({});
  const [docListRefresh, setDocListRefresh] = useState<Record<string, number>>({});
  
  // Add state for collapsible audio sections
  const [collapsedAudioSections, setCollapsedAudioSections] = useState<Record<string, boolean>>({});
  
  // Word counts computed from transcripts
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({});
  
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
  }>>({});

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

  // Auto-recover stuck meetings after 2 minutes
  useEffect(() => {
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
  }, [localMeetings]);

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
    
    // Open modal immediately - don't wait for DB fetch
    if (isMobile) {
      console.log('📱 Opening mobile notes sheet');
      setMobileNotesOpen(true);
    } else {
      console.log('🖥️ Opening desktop notes modal');
      setDesktopNotesOpen(true);
    }
    
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

  // Handle email minutes click
  const handleEmailMinutesClick = async (meeting: Meeting) => {
    console.log('📧 Email button clicked for meeting:', meeting.id, meeting.title);
    console.log('📧 Meeting data:', meeting);
    
    // Fetch the latest meeting notes/summary from multiple sources
    try {
      console.log('📧 Fetching meeting notes from all sources...');
      
      // 1. Check meeting_summaries table
      const { data: summaryData, error } = await supabase
        .from('meeting_summaries')
        .select('summary')
        .eq('meeting_id', meeting.id)
        .maybeSingle();

      // 2. Check meeting_notes_multi table for generated notes
      const { data: multiNotesData } = await supabase
        .from('meeting_notes_multi')
        .select('content, note_type')
        .eq('meeting_id', meeting.id)
        .order('generated_at', { ascending: false });

      // 3. Fetch meeting note fields (prefer Minutes - Standard)
      const { data: notesFields, error: notesFieldsError } = await supabase
        .from('meetings')
        .select('notes_style_3, notes_style_2, notes_style_4, notes_style_5')
        .eq('id', meeting.id)
        .maybeSingle();

      console.log('📧 Summary query result:', { summaryData, error });
      console.log('📧 Multi notes query result:', { multiNotesData });
      console.log('📧 Meeting note fields:', notesFields, notesFieldsError);
      
      if (error) {
        console.error('Error fetching meeting summary:', error);
      }
      
      // Priority order: Minutes - Standard (notes_style_3) > multi-type notes > summary > transcript
      let notes = '';
      
      const standardFromMeeting = (notesFields as any)?.notes_style_3 || (meeting as any).notes_style_3 || '';
      if (standardFromMeeting) {
        notes = standardFromMeeting;
        console.log('📧 Using Minutes - Standard from meeting:', notes.substring(0, 100) + '...');
      } else if (multiNotesData && multiNotesData.length > 0) {
        // Prefer detailed, then brief, then most recent
        const detailedNote = multiNotesData.find(n => n.note_type === 'detailed');
        const briefNote = multiNotesData.find(n => n.note_type === 'brief');
        const anyNote = multiNotesData[0]; // First available (most recent)
        
        notes = detailedNote?.content || briefNote?.content || anyNote?.content || '';
        console.log('📧 Using multi-type notes:', notes.substring(0, 100) + '...');
      } else {
        // Fallbacks
        const meetingData = meeting as any;
        notes = (notesFields as any)?.notes_style_2 || meetingData.notes_style_2 || (notesFields as any)?.notes_style_1 || meetingData.notes_style_1 ||
                summaryData?.summary || meeting.meeting_summary || meeting.transcript || '';
        console.log('📧 Using fallback notes:', notes.substring(0, 100) + '...');
      }
      
      if (!notes.trim()) {
        console.log('📧 No notes available');
        return;
      }
      
      console.log('📧 Opening email modal...');
      // Update the meeting object with latest notes
      setSelectedMeetingForEmail({
        ...meeting,
        meeting_summary: notes
      });
      setEmailModalOpen(true);
      console.log('📧 Email modal should be open now');
    } catch (error) {
      console.error('📧 Error preparing email:', error);
    }
  };

  // Handle attendees click
  const handleAttendeesClick = (meeting: Meeting) => {
    setSelectedMeetingForAttendees(meeting);
    setAttendeeModalOpen(true);
  };

  // Handle add context click
  const handleAddContextClick = (meeting: Meeting) => {
    setSelectedMeetingForContext(meeting);
    setShowContextDialog(true);
  };

  // Handle adding context to meeting
  const handleAddContext = async (
    contextTypes: Array<'agenda' | 'attendees' | 'presentation' | 'other' | 'additional-transcript'>,
    files: UploadedFile[],
    customLabel?: string
  ) => {
    if (!selectedMeetingForContext) return;
    
    const meetingId = selectedMeetingForContext.id;
    
    try {
      // Clean file content
      const cleanedFiles = files.map(file => ({
        ...file,
        content: extractCleanContent(file.content || '')
      }));
      
      // Check if any files have empty content after cleaning (e.g., failed OCR)
      const emptyFiles = cleanedFiles.filter(f => !f.content || f.content.trim() === '');
      if (emptyFiles.length > 0 && emptyFiles.length === cleanedFiles.length) {
        toast.error('Could not extract text from the uploaded image(s). Please try a clearer image or paste the text directly.');
        return;
      } else if (emptyFiles.length > 0) {
        toast.warning(`${emptyFiles.length} file(s) had no extractable text and were skipped.`);
      }
      
      // Filter out empty files
      const validFiles = cleanedFiles.filter(f => f.content && f.content.trim() !== '');
      
      if (validFiles.length === 0) {
        toast.error('No text content could be extracted from the uploaded files.');
        return;
      }
      
      // If "attendees" is selected, parse and add attendees to the meeting's attendee list
      if (contextTypes.includes('attendees')) {
        const allContent = validFiles.map(f => f.content).join('\n');
        const parsedAttendees = parseAttendeesFromText(allContent);
        
        if (parsedAttendees.length > 0) {
          console.log('📋 Parsed attendees from context:', parsedAttendees);
          
          // Get user's practice ID
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            const { data: userRoles } = await supabase
              .rpc('get_user_roles', { _user_id: userData.user.id });
            
            const practiceId = userRoles?.[0]?.practice_id;
            
            // For each parsed attendee, create if not exists and link to meeting
            for (const attendee of parsedAttendees) {
              try {
                // Check if attendee already exists for this user (by name)
                const { data: existingAttendee } = await supabase
                  .from('attendees')
                  .select('id')
                  .eq('user_id', userData.user.id)
                  .ilike('name', attendee.name)
                  .maybeSingle();
                
                let attendeeId: string;
                
                if (existingAttendee) {
                  attendeeId = existingAttendee.id;
                } else {
                  // Create new attendee
                  const { data: newAttendee, error: createError } = await supabase
                    .from('attendees')
                    .insert({
                      user_id: userData.user.id,
                      practice_id: practiceId,
                      name: attendee.name,
                      organization: attendee.organization || null,
                      role: attendee.role || null,
                    })
                    .select('id')
                    .single();
                  
                  if (createError) {
                    console.warn('Failed to create attendee:', attendee.name, createError);
                    continue;
                  }
                  attendeeId = newAttendee.id;
                }
                
                // Check if already linked to this meeting
                const { data: existingLink } = await supabase
                  .from('meeting_attendees')
                  .select('id')
                  .eq('meeting_id', meetingId)
                  .eq('attendee_id', attendeeId)
                  .maybeSingle();
                
                if (!existingLink) {
                  // Link attendee to meeting
                  await supabase
                    .from('meeting_attendees')
                    .insert({
                      meeting_id: meetingId,
                      attendee_id: attendeeId
                    });
                }
              } catch (attendeeError) {
                console.warn('Error processing attendee:', attendee.name, attendeeError);
              }
            }
            
            toast.success(`Added ${parsedAttendees.length} attendee(s) to the meeting`);
          }
        } else {
          toast.warning('No attendee names could be extracted from the content');
        }
      }
      
      // Format the context content
      const formattedContext = contextTypes.includes('additional-transcript')
        ? validFiles.map(f => f.content).join('\n\n')
        : formatTranscriptContext(
            contextTypes.filter(t => t !== 'additional-transcript') as Array<'agenda' | 'attendees' | 'presentation' | 'other'>,
            validFiles,
            customLabel
          );
      
      // Fetch current meeting context and live transcript
      const { data: meetingData, error: fetchError } = await supabase
        .from('meetings')
        .select('meeting_context, live_transcript_text')
        .eq('id', meetingId)
        .single();
        
      if (fetchError) throw fetchError;
      
      // Build update data
      const updateData: Record<string, any> = {
        notes_generation_status: 'queued',
        updated_at: new Date().toISOString()
      };
      
      if (contextTypes.includes('additional-transcript')) {
        // Append to live transcript
        const currentTranscript = meetingData?.live_transcript_text || '';
        updateData.live_transcript_text = currentTranscript + '\n\n--- Additional Transcript ---\n\n' + formattedContext;
      } else {
        // Store context in meeting_context JSON field and prepend to transcript
        const existingContext = (meetingData?.meeting_context as any) || {};
        const newContext = {
          ...existingContext,
          addedAt: new Date().toISOString(),
          contextTypes,
          content: formattedContext
        };
        updateData.meeting_context = newContext;
        
        // Also prepend to live transcript for AI processing
        const currentTranscript = meetingData?.live_transcript_text || '';
        updateData.live_transcript_text = formattedContext + '\n\n' + currentTranscript;
      }
      
      // Update meeting
      const { error: updateError } = await supabase
        .from('meetings')
        .update(updateData)
        .eq('id', meetingId);
        
      if (updateError) throw updateError;
      
      toast.success('Meeting context added - notes will regenerate');
      onRefresh?.();
      setShowContextDialog(false);
      setSelectedMeetingForContext(null);
    } catch (error) {
      console.error('Error adding context:', error);
      toast.error('Failed to add meeting context');
    }
  };

  const handleDownloadWord = async (meeting: Meeting) => {
    try {
      console.log('📄 Downloading Word document for meeting:', meeting.id, meeting.title);
      
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

      // Strip out transcript section before generating Word doc
      notes = notes.replace(/\n*MEETING TRANSCRIPT FOR REFERENCE:[\s\S]*$/i, '');
      notes = notes.replace(/\n*Transcript:[\s\S]*$/i, '');
      notes = notes.replace(/\n*Full Transcript:[\s\S]*$/i, '');
      notes = notes.replace(/\n*##?\s*TRANSCRIPT[\s\S]*$/i, '');
      notes = notes.replace(/\n*##?\s*Meeting Transcript[\s\S]*$/i, '');

      await generateWordDocument(notes, meeting.title);
    } catch (error) {
      console.error('Error downloading Word document:', error);
      toast.error('Failed to download Word document');
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
  const handleProcessClick = async (meeting: Meeting) => {
    const meetingId = meeting.id;
    
    // Show toast notification
    toast.info('Regenerating Meeting Overview, Standard Minutes, Style Gallery, and Audio...', {
      duration: 3000
    });
    
    // Automatically regenerate Overview first, then Standard Minutes
    await handleFullProcessing(meeting, {
      standard: true,
      overview: true,
      executive: false,
      limerick: false
    });
    
    // Now regenerate Style Gallery and wait for completion
    try {
      const { data: transcriptData } = await supabase.rpc('get_meeting_full_transcript', { 
        p_meeting_id: meetingId 
      });
      const transcript = transcriptData?.[0]?.transcript;
      
      if (transcript && transcript.length >= 50) {
        console.log('🎨 Regenerating Style Gallery...');
        
        // Trigger style gallery regeneration and await it
        const { error } = await supabase.functions.invoke('generate-style-previews', {
          body: {
            meetingId,
            transcript,
            meetingContext: {
              title: meeting.title,
              date: meeting.start_time
            }
          }
        });
        
        if (error) {
          console.error('Style gallery regeneration error:', error);
          toast.error('Failed to regenerate Style Gallery');
        } else {
          console.log('✅ Style gallery regenerated successfully');
        }
        
        // Generate audio overview at the end
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
  const handleFullProcessing = async (meeting: Meeting, selectedTypes: { standard: boolean; overview: boolean; executive: boolean; limerick: boolean }) => {
    const meetingId = meeting.id;
    
    if (processingMeetings[meetingId]?.isProcessing) {
      return; // Already processing
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
        totalCount: typesToProcess.length
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
            console.log('🚀 Invoking auto-generate-meeting-notes for meeting:', meetingId);
            const { data, error: standardError } = await supabase.functions.invoke(
              'auto-generate-meeting-notes',
              { body: { meetingId, forceRegenerate: true } }
            );
            
            console.log('📥 Response from auto-generate-meeting-notes:', { data, error: standardError });
            
            if (standardError) {
              console.error('❌ Edge function error:', standardError);
              throw new Error(`Standard notes failed: ${standardError.message || JSON.stringify(standardError)}`);
            }
            
            console.log('⏳ Polling for note completion...');
            // Poll for completion in meeting_summaries table (not meetings.notes_style_3)
            await pollForNoteCompletion(meetingId, 'summary', 'meeting_summaries');
            completedCount++;
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
      
      // Regenerate Style Gallery automatically after all note types
      try {
        const { data: transcriptData } = await supabase.rpc('get_meeting_full_transcript', { 
          p_meeting_id: meetingId 
        });
        const transcript = transcriptData?.[0]?.transcript;
        
        if (transcript && transcript.length >= 50) {
          console.log('🎨 Auto-regenerating Style Gallery after note processing...');
          
          const { error } = await supabase.functions.invoke('generate-style-previews', {
            body: {
              meetingId,
              transcript,
              meetingContext: {
                title: meeting.title,
                date: meeting.start_time
              }
            }
          });
          
          if (error) {
            console.error('Style gallery regeneration error:', error);
            // Don't fail the whole process, just log the error
          } else {
            console.log('✅ Style gallery regenerated successfully');
          }
        }
      } catch (err) {
        console.error('Error triggering style gallery regeneration:', err);
        // Don't fail the whole process, just log the error
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

  if (loading) {
    return (
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
  }

  if (localMeetings.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No meetings found</h3>
          <p className="text-muted-foreground mb-4">
            Start by creating your first meeting or adjust your search criteria.
          </p>
          <Button onClick={() => navigate('/')}>
            Create First Meeting
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
      {localMeetings.map((meeting) => (
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
                          <h3 className="font-semibold text-base sm:text-lg truncate pr-2">{meeting.title}</h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(meeting.id, meeting.title);
                            }}
                            className="text-muted-foreground hover:text-primary transition-colors p-1 rounded"
                            title="Edit meeting name"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{format(new Date(meeting.start_time), 'do MMMM yyyy')}</span>
                      <span>•</span>
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{format(new Date(meeting.start_time), 'HH:mm')}</span>
                      
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
                              : (wordCounts[meeting.id] ?? computeWordCount(meeting));
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
                      
                      {meeting.meeting_config && Object.keys(meeting.meeting_config).length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <MapPin className="h-3 w-3 mr-1" />
                          Configured
                        </Badge>
                      )}
                      
                      {(() => {
                        console.log('🗂 Folder badge check', {
                          meetingId: meeting.id,
                          folderId: meeting.folder_id,
                          foldersCount: folders.length,
                          folders
                        });

                        if (!meeting.folder_id) return null;
                        const folder = folders.find(f => f.id === meeting.folder_id);
                        
                        // If we can't resolve the folder from the cached list,
                        // still show a generic "In folder" badge so the assignment
                        // persists visually after refresh.
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
                      })()}
                    </div>

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
                    
                    console.log('📱 Click event - calling handleViewNotes for meeting:', meeting.id);
                    try {
                      setInitialTabForModal('notes');
                      handleViewNotesWithDeduplication(meeting, 'click');
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

                      {/* Safe Mode Notes - Lightweight modal for debugging */}
                      <DropdownMenuItem 
                        onSelect={(e) => {
                          e.preventDefault();
                          setOpenDropdowns(prev => ({ ...prev, [meeting.id]: false }));
                          handleSafeModeNotesClick(meeting);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View Notes (Safe Mode)
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
                          handleAddContextClick(meeting);
                        }}
                      >
                        <FilePlus2 className="h-4 w-4 mr-2" />
                        Add Meeting Context
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
                onOverviewChange={(newOverview) => {
                  setLocalMeetings(prev => prev.map(m => 
                    m.id === meeting.id ? { ...m, overview: newOverview } : m
                  ));
                  onRefresh?.();
                }}
                onRegenerateAudio={async () => {
                  // Audio regeneration is now handled by MeetingAudioStudio component
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
      ))}

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

      {/* Desktop Notes Modal (fallback) */}
      {!isMobile && desktopNotesOpen && (
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
        onClose={() => setSafeModeModalOpen(false)}
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
        <MeetingAttendeeModal
          isOpen={attendeeModalOpen}
          onClose={() => {
            setAttendeeModalOpen(false);
            setSelectedMeetingForAttendees(null);
          }}
          meetingId={selectedMeetingForAttendees.id}
          meetingTitle={selectedMeetingForAttendees.title}
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

      {/* Add Meeting Context Dialog */}
      {showContextDialog && selectedMeetingForContext && (
        <TranscriptContextDialog
          open={showContextDialog}
          onOpenChange={(open) => {
            setShowContextDialog(open);
            if (!open) setSelectedMeetingForContext(null);
          }}
          onAddContext={handleAddContext}
        />
      )}
    </div>
    </TooltipProvider>
  );
};