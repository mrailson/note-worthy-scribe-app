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
  Bot
} from "lucide-react";
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
import { format } from "date-fns";
import { MeetingOverviewEditor } from "@/components/MeetingOverviewEditor";
import { MeetingDocumentsList } from "@/components/MeetingDocumentsList";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useMultiTypeNotes } from "@/hooks/useMultiTypeNotes";


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
  onRefresh
}: MeetingHistoryListProps) => {
  const navigate = useNavigate();
  const { isRecording, isResourceOperationSafe, setRecordingState } = useRecording();
  const isIOS = detectDevice().isIOS;
  console.log('🚨 MeetingHistoryList render - meetings:', meetings.length);
  console.log('🚨 MeetingHistoryList meetings data:', meetings.slice(0, 3).map(m => ({ id: m.id, title: m.title })));
  console.log('🚨 Loading state:', loading);
  console.log('🚨 About to render:', meetings.length === 0 ? 'NO MEETINGS MESSAGE' : 'MEETINGS LIST');
  
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
  const isMobile = useIsMobile();
  
  // Add state for signed URLs
  const [audioUrls, setAudioUrls] = useState<Record<string, AudioUrls>>({});
  const [docListRefresh, setDocListRefresh] = useState<Record<string, number>>({});
  
  // Add state for collapsible audio sections
  const [collapsedAudioSections, setCollapsedAudioSections] = useState<Record<string, boolean>>({});
  
  // Add state for processing - Multi-type notes processing
  const [processingMeetings, setProcessingMeetings] = useState<Record<string, {
    isProcessing: boolean;
    currentStage: 'deep-clean' | 'standard' | 'brief' | 'limerick' | 'executive' | 'complete';
    stages: {
      'deep-clean': 'pending' | 'processing' | 'success' | 'failed';
      'standard': 'pending' | 'processing' | 'success' | 'failed';
      'brief': 'pending' | 'processing' | 'success' | 'failed';
      'limerick': 'pending' | 'processing' | 'success' | 'failed';
      'executive': 'pending' | 'processing' | 'success' | 'failed';
    };
    error?: string;
    completedCount?: number;
    totalCount?: number;
  }>>({});

  // Multi-type notes hooks for each meeting
  const [multiTypeHooks, setMultiTypeHooks] = useState<Record<string, any>>({});

  // Add deduplication state for preventing duplicate modal opens
  const [lastActionTime, setLastActionTime] = useState<Record<string, number>>({});

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
  const handleViewNotes = async (meeting: Meeting) => {
    console.log('🔍 HandleViewNotes called for:', meeting.title, 'isMobile:', isMobile);
    
    // Use the meeting_summary that's already loaded in the meeting object
    const notes = meeting.meeting_summary || '';
    setMeetingNotes(notes);
    setSelectedMeetingForNotes(meeting);
    
    if (isMobile) {
      setMobileNotesOpen(true);
    } else {
      setDesktopNotesOpen(true);
      // Use only the local modal to avoid duplicate modals
    }
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

  // Handle inline title editing
  const handleStartEdit = (meetingId: string, currentTitle: string) => {
    setEditingMeetingId(meetingId);
    setEditingTitle(currentTitle);
  };

  const handleSaveTitle = async (meetingId: string) => {
    if (!editingTitle.trim()) {
      toast.error("Meeting name cannot be empty");
      return;
    }

    try {
      const { error } = await supabase
        .from('meetings')
        .update({ title: editingTitle.trim() })
        .eq('id', meetingId);

      if (error) throw error;

      toast.success("Meeting name updated successfully");
      setEditingMeetingId(null);
      setEditingTitle("");
      
      // Notify parent component to update the meeting title locally
      if (onMeetingUpdate) {
        onMeetingUpdate(meetingId, editingTitle.trim());
      }
    } catch (error) {
      console.error('Error updating meeting title:', error);
      toast.error("Failed to update meeting name");
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
        toast.error('Document not found');
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
      
      toast.success('Download started');
    } catch (error: any) {
      console.error('Error downloading document:', error.message);
      toast.error('Failed to download document');
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
        toast.error('Document not found');
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
      
      toast.success(`Deleted ${fileName}`);
      
      // Trigger a refresh of the meeting data
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      console.error('Error deleting document:', error.message);
      toast.error('Failed to delete document');
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
        toast.error('Document not found');
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
      toast.error('Failed to open document');
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
      toast.error('No audio backup available for this meeting');
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
      
      toast.success('Audio backup downloaded successfully');
    } catch (error) {
      console.error('Error downloading audio backup:', error);
      toast.error('Failed to download audio backup');
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
        toast.error(`The following file(s) already exist in this meeting: ${duplicateNames}`);
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
      toast.success(`${selectedFiles.length} document(s) uploaded successfully`);
      
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
      toast.error(`Failed to upload documents: ${error.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  // Handle full processing pipeline - Multi-type notes with deep clean
  const handleFullProcessing = async (meeting: Meeting) => {
    const meetingId = meeting.id;
    
    if (processingMeetings[meetingId]?.isProcessing) {
      return; // Already processing
    }

    // Initialize processing state
    setProcessingMeetings(prev => ({
      ...prev,
      [meetingId]: {
        isProcessing: true,
        currentStage: 'deep-clean',
        stages: {
          'deep-clean': 'processing',
          'standard': 'pending',
          'brief': 'pending',
          'limerick': 'pending',
          'executive': 'pending'
        },
        completedCount: 0,
        totalCount: 5
      }
    }));

    try {
      // Stage 1: Deep Clean Transcript (with time-based limits)
      toast.info("Starting deep clean of transcript...");
      
      // Check if transcript needs cleaning (only if not already cleaned or new text added)
      const { data: currentMeeting } = await supabase
        .from('meetings')
        .select('word_count, duration_minutes, updated_at, transcript_cleaned_at, transcript_cleaned_word_count')
        .eq('id', meetingId)
        .single();

      // Get transcript from proper source using the existing function
      const { data: transcriptData } = await supabase.rpc('get_meeting_full_transcript', { 
        p_meeting_id: meetingId 
      });
      
      const transcript = transcriptData?.[0]?.transcript;

      let shouldClean = true;
      
      // Check server-side clean status to skip re-cleaning if nothing new
      if (currentMeeting?.transcript_cleaned_at) {
        const cleanTime = new Date(currentMeeting.transcript_cleaned_at);
        const meetingUpdatedTime = new Date(currentMeeting?.updated_at || 0);
        const currentWordCount = currentMeeting?.word_count || 0;
        const lastCleanedWordCount = currentMeeting?.transcript_cleaned_word_count || 0;
        const deltaThreshold = 50; // allow small drift

        // Skip cleaning if cleaned recently and word count hasn't grown significantly
        if (cleanTime > meetingUpdatedTime && Math.abs(currentWordCount - lastCleanedWordCount) <= deltaThreshold) {
          shouldClean = false;
          toast.info("Transcript already cleaned recently, skipping...");
        }
      }

      // No transcript available, skip cleaning
      if (!transcript) {
        shouldClean = false;
      }

      if (shouldClean && transcript) {
        // Apply time-based limit: 1 minute per hour of meeting duration
        const durationHours = (currentMeeting?.duration_minutes || 60) / 60;
        const maxProcessingTimeMs = Math.max(60000, durationHours * 60000); // Min 1 minute, 1 minute per hour
        
        const { data: cleanResult, error: cleanError } = await supabase.functions.invoke('gpt-clean-transcript', {
          body: { 
            meetingId,
            transcript: transcript,
            maxProcessingTime: maxProcessingTimeMs
          }
        });

        if (cleanError) {
          throw new Error(`Deep clean failed: ${cleanError.message}`);
        }

        // Update server-side clean status to avoid re-cleaning on subsequent runs
        if (cleanResult?.cleanedTranscript) {
          await supabase
            .from('meetings')
            .update({
              transcript_cleaned_at: new Date().toISOString(),
              transcript_cleaned_word_count: cleanResult.cleanedTranscript.split(' ').length,
              updated_at: new Date().toISOString()
            })
            .eq('id', meetingId);
        }
      }

      // Mark deep clean as success and move to multi-type notes generation
      setProcessingMeetings(prev => ({
        ...prev,
        [meetingId]: {
          ...prev[meetingId],
          currentStage: 'standard',
          stages: {
            ...prev[meetingId].stages,
            'deep-clean': 'success',
            'standard': 'processing'
          },
          completedCount: 1
        }
      }));

      toast.success("Deep clean completed! Starting parallel note generation...");

      // Stage 2: Generate all note types in one call (parallel processing)
      setProcessingMeetings(prev => ({
        ...prev,
        [meetingId]: {
          ...prev[meetingId],
          currentStage: 'standard',
          stages: {
            ...prev[meetingId].stages,
            'standard': 'processing',
            'brief': 'processing', 
            'limerick': 'processing',
            'executive': 'processing'
          }
        }
      }));

      toast.info("Generating all note types in parallel... (estimated 1-2 mins)");

      // Get the latest transcript (might have been cleaned)
      const { data: latestTranscriptData } = await supabase.rpc('get_meeting_full_transcript', { 
        p_meeting_id: meetingId 
      });
      
      const latestTranscript = latestTranscriptData?.[0]?.transcript || transcript;

      if (!latestTranscript) {
        throw new Error(`No transcript available for notes generation`);
      }

      // Single call to generate ALL note types in parallel
      const { data: noteResult, error: noteError } = await supabase.functions.invoke('generate-multi-type-notes', {
        body: {
          meetingId,
          transcript: latestTranscript,
          forceRegenerate: true
        }
      });

      if (noteError) {
        throw new Error(`Note generation failed: ${noteError.message}`);
      }

      // Poll for completion of all note types
      const checkCompletion = async () => {
        const { data: existingNotes } = await supabase
          .from('meeting_notes_multi')
          .select('note_type')
          .eq('meeting_id', meetingId);

        const completedTypes = new Set(existingNotes?.map(n => n.note_type) || []);
        const targetTypes = ['detailed', 'brief', 'limerick', 'executive'];
        
        // Update UI for each completed type
        const stageMapping = {
          'detailed': 'standard',
          'brief': 'brief',
          'limerick': 'limerick', 
          'executive': 'executive'
        };

        const stages: any = {};
        targetTypes.forEach(type => {
          const stage = stageMapping[type as keyof typeof stageMapping];
          stages[stage] = completedTypes.has(type) ? 'success' : 'processing';
        });

        const completedCount = targetTypes.filter(type => completedTypes.has(type)).length;
        
        setProcessingMeetings(prev => ({
          ...prev,
          [meetingId]: {
            ...prev[meetingId],
            stages: {
              ...prev[meetingId].stages,
              ...stages
            },
            completedCount: completedCount + 1 // +1 for deep clean
          }
        }));

        return completedCount === targetTypes.length;
      };

      // Poll every 3 seconds for completion
      const maxPolls = 40; // 2 minutes max
      let polls = 0;
      
      while (polls < maxPolls) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        polls++;
        
        const allComplete = await checkCompletion();
        if (allComplete) break;
      }

      // Mark all stages as complete
      setProcessingMeetings(prev => ({
        ...prev,
        [meetingId]: {
          ...prev[meetingId],
          currentStage: 'complete',
          stages: {
            'deep-clean': 'success',
            'standard': 'success',
            'brief': 'success',
            'limerick': 'success',
            'executive': 'success'
          },
          completedCount: 5,
          isProcessing: false
        }
      }));

      toast.success("All processing complete! Generated deep cleaned transcript and all note types (Standard, Brief, Limerick, Executive).");

      // Refresh the meeting data
      if (onRefresh) {
        onRefresh();
      }

      // Keep the completed state visible (don't auto-clear it)
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
        'deep-clean': 'Deep Clean',
        'standard': 'Standard Notes',
        'brief': 'Brief Notes',
        'limerick': 'Limerick Notes',
        'executive': 'Executive Notes'
      };
      
      const currentStage = processingMeetings[meetingId]?.currentStage;
      const stageName = currentStage ? stageNames[currentStage] || currentStage : 'unknown stage';
      
      toast.error(`Processing failed at ${stageName}: ${error.message}`);
      
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
  
  // Helper functions for processing button display - Multi-type notes
  const getProcessingButtonText = (processing: any) => {
    if (!processing) return 'Process';
    
    if (processing.currentStage === 'complete' && processing.completedCount === 5) {
      return 'Complete!';
    }
    
    if (!processing.isProcessing && processing.completedCount === 5) {
      return 'Complete!';
    }
    
    if (processing.error || Object.values(processing.stages || {}).includes('failed')) {
      return 'Failed';
    }
    
    if (processing.isProcessing) {
      const stageNames = {
        'deep-clean': 'Deep Cleaning...',
        'standard': 'Standard Notes...',
        'brief': 'Brief Notes...',
        'limerick': 'Limerick Notes...',
        'executive': 'Executive Notes...'
      };
      return stageNames[processing.currentStage] || 'Processing...';
    }
    
    return 'Process';
  };

  const getProcessingButtonIcon = (processing: any) => {
    if (!processing) return RefreshCw;
    
    if (processing.error || Object.values(processing.stages || {}).includes('failed')) {
      return AlertCircle;
    }
    
    // Show green tick when all 5 stages are complete
    if (processing.completedCount === 5 || (processing.currentStage === 'complete' && processing.completedCount === 5)) {
      return CheckCircle2;
    }
    
    if (processing.isProcessing) {
      return RefreshCw;
    }
    
    return RefreshCw;
  };

  const getProcessingButtonColor = (processing: any) => {
    if (!processing) return 'text-muted-foreground hover:text-primary';
    
    if (processing.error || Object.values(processing.stages || {}).includes('failed')) {
      return 'text-destructive hover:text-destructive/80';
    }
    
    // Green color when all notes are complete
    if (processing.completedCount === 5 || (processing.currentStage === 'complete' && processing.completedCount === 5)) {
      return 'text-green-600 hover:text-green-700';
    }
    
    if (processing.isProcessing) {
      return 'text-blue-600 hover:text-blue-700';
    }
    
    return 'text-muted-foreground hover:text-primary';
  };

  const getProcessingTooltip = (processing: any) => {
    if (!processing) return "Deep clean transcript, then generate Standard → Brief → Limerick → Executive notes";
    
    if (processing.error) {
      const stageNames = {
        'deep-clean': 'Deep Clean',
        'standard': 'Standard Notes',
        'brief': 'Brief Notes', 
        'limerick': 'Limerick Notes',
        'executive': 'Executive Notes'
      };
      const stageName = stageNames[processing.currentStage] || processing.currentStage;
      return `Failed at ${stageName}: ${processing.error}`;
    }
    
    if (processing.completedCount === 5) {
      return "All processing complete: Deep clean + Standard, Brief, Limerick & Executive notes generated";
    }
    
    if (processing.isProcessing) {
      const stageLabels = {
        'deep-clean': 'Deep cleaning transcript (removing duplicates, 1 min per hour limit)',
        'standard': 'Generating standard meeting notes',
        'brief': 'Generating brief summary notes',
        'limerick': 'Generating limerick-style notes',
        'executive': 'Generating executive summary notes'
      };
      const progress = `(${processing.completedCount || 0}/5 complete)`;
      return `${stageLabels[processing.currentStage] || 'Processing...'} ${progress}`;
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
        return <Clock className="h-4 w-4 text-yellow-500" />;
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

  if (meetings.length === 0) {
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
    <div className="space-y-4">
      {meetings.map((meeting) => (
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
                          {meeting.word_count && meeting.word_count > 0 ? (
                            <>
                              {meeting.word_count >= 1000 
                                ? `${(meeting.word_count / 1000).toFixed(1)}K words`
                                : `${meeting.word_count} words`}
                              {meeting.status === 'recording' && (
                                <span className="text-green-600 font-medium"> (Recording Now)</span>
                              )}
                            </>
                          ) : (
                            <>
                              N/A words
                              {meeting.status === 'recording' && (
                                <span className="text-green-600 font-medium"> (Recording Now)</span>
                              )}
                            </>
                          )}
                        </span>
                      </>
                      
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
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons - Mobile Optimized */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                
                {/* Show recording warning if operation blocked */}
                {!isResourceOperationSafe() && (
                  <RecordingWarningBanner 
                    operation="Viewing meeting notes"
                    className="mb-2"
                  />
                )}
                
                {/* View Notes button - now available on all devices when not recording */}
                <div 
                  style={{ 
                    display: 'inline-block',
                    minHeight: '44px',
                    minWidth: '120px',
                    touchAction: 'manipulation',
                    cursor: 'pointer',
                    border: '1px solid #ccc',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    backgroundColor: '#fff',
                    textAlign: 'center',
                    fontSize: '14px',
                    position: 'relative',
                    zIndex: 10
                  }}
                  onTouchStart={(e) => {
                    e.currentTarget.style.backgroundColor = '#f0f0f0';
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.style.backgroundColor = '#fff';
                    
                    console.log('📱 iPhone: Touch registered!');
                    
                    // Show immediate feedback
                    setTimeout(() => {
                      try {
                        if (!isResourceOperationSafe()) {
                          alert("Cannot view notes while recording is active.");
                          return;
                        }
                        
                        console.log('📱 iPhone: Touch end - calling handleViewNotes for meeting:', meeting.id);
                        try {
                          handleViewNotesWithDeduplication(meeting, 'touch');
                        } catch (error) {
                          console.error('❌ Error in handleViewNotes:', error);
                          alert('Error: ' + error.message);
                        }
                      } catch (error) {
                        console.error('❌ Error:', error);
                        alert('Error opening notes: ' + error.message);
                      }
                    }, 50);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    console.log('📱 Click registered!');
                    
                    if (!isResourceOperationSafe()) {
                      alert("Cannot view notes while recording is active.");
                      return;
                    }
                    
                    console.log('📱 Click event - calling handleViewNotes for meeting:', meeting.id);
                    try {
                      handleViewNotesWithDeduplication(meeting, 'click');
                    } catch (error) {
                      console.error('❌ Error:', error);
                      alert('Error opening notes: ' + error.message);
                    }
                  }}
                >
                  <FileText style={{ display: 'inline', width: '16px', height: '16px', marginRight: '8px' }} />
                  View Notes
                </div>

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
                
                
                {/* Upload Documents Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUploadClick(meeting)}
                  className="flex items-center justify-center gap-2 flex-1 sm:flex-none touch-manipulation min-h-[44px] text-primary hover:text-primary"
                >
                  <Paperclip className="h-4 w-4" />
                  <span>Upload</span>
                </Button>
                
                {/* Process Meeting Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFullProcessing(meeting)}
                  disabled={processingMeetings[meeting.id]?.isProcessing}
                  className={`flex items-center justify-center gap-2 flex-1 sm:flex-none touch-manipulation min-h-[44px] ${getProcessingButtonColor(processingMeetings[meeting.id])}`}
                  title={getProcessingTooltip(processingMeetings[meeting.id])}
                >
                  {(() => {
                    const IconComponent = getProcessingButtonIcon(processingMeetings[meeting.id]);
                    const processing = processingMeetings[meeting.id];
                    const shouldSpin = processing?.isProcessing && processing.currentStage !== 'complete';
                    return <IconComponent className={`h-4 w-4 ${shouldSpin ? 'animate-spin' : ''}`} />;
                  })()}
                  <span className="hidden sm:inline">
                    {getProcessingButtonText(processingMeetings[meeting.id])}
                  </span>
                  <span className="sm:hidden">
                    {processingMeetings[meeting.id]?.isProcessing ? '...' : 'Process'}
                  </span>
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center justify-center gap-2 flex-1 sm:flex-none text-destructive hover:text-destructive touch-manipulation min-h-[44px]"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </Button>
                  </AlertDialogTrigger>
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
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            <div className="space-y-3">
              {/* Meeting Overview Editor */}
              <MeetingOverviewEditor 
                meetingId={meeting.id}
                currentOverview={meeting.overview || ""}
                onOverviewChange={() => onRefresh?.()}
                className="mb-3"
                meetingNotes={meeting.meeting_summary || meeting.transcript || ""}
                meetingTitle={meeting.title}
              />
              
              {/* Meeting Documents - Always show, allow uploads even when empty */}
              <MeetingDocumentsList
                key={`docs-${meeting.id}-${docListRefresh[meeting.id] || 0}`}
                meetingId={meeting.id}
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
      <MobileNotesSheet
        isOpen={mobileNotesOpen}
        onOpenChange={setMobileNotesOpen}
        meeting={selectedMeetingForNotes}
        notes={meetingNotes}
      />

      {/* Desktop Notes Modal (fallback) */}
      {!isMobile && (
        <FullPageNotesModal
          isOpen={desktopNotesOpen}
          onClose={() => setDesktopNotesOpen(false)}
          meeting={selectedMeetingForNotes}
          notes={meetingNotes}
          onNotesChange={setMeetingNotes}
        />
      )}
    </div>
  );
};