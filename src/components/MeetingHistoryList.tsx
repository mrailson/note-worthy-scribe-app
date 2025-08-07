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
  ChevronDown
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
  audio_backup_path?: string | null;
  audio_backup_created_at?: string | null;
  requires_audio_backup?: boolean;
  word_count?: number;
  document_count?: number;
  mixed_audio_url?: string | null;
  left_audio_url?: string | null;
  right_audio_url?: string | null;
  recording_created_at?: string | null;
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
  showRecordingPlayback = true
}: MeetingHistoryListProps) => {
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedMeetingForUpload, setSelectedMeetingForUpload] = useState<Meeting | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  
  // Add state for signed URLs
  const [audioUrls, setAudioUrls] = useState<Record<string, AudioUrls>>({});
  
  // Add state for collapsible audio sections
  const [collapsedAudioSections, setCollapsedAudioSections] = useState<Record<string, boolean>>({});

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
        .single();

      if (docError) throw docError;

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

  // Open document function (same as download but opens in new tab)
  const openDocument = async (meetingId: string, fileName: string) => {
    try {
      // Get the document path from the database
      const { data: docData, error: docError } = await supabase
        .from('meeting_documents')
        .select('file_path')
        .eq('meeting_id', meetingId)
        .eq('file_name', fileName)
        .single();

      if (docError) throw docError;

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
    setSelectedMeetingForUpload(meeting);
    setSelectedFiles([]);
    setUploadDialogOpen(true);
  };

  const uploadDocuments = async () => {
    if (!selectedFiles.length || !selectedMeetingForUpload) return;

    setUploading(true);
    try {
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

      for (const file of selectedFiles) {
        // Upload file to Supabase storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${selectedMeetingForUpload.id}/${Date.now()}-${file.name}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('meeting-documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

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
            uploaded_by: (await supabase.auth.getUser()).data.user?.id,
          });

        if (insertError) throw insertError;
      }

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
      
      setSelectedFiles([]);
      setUploadDialogOpen(false);
      setSelectedMeetingForUpload(null);
    } catch (error: any) {
      console.error('Error uploading documents:', error.message);
      toast.error('Failed to upload documents');
    } finally {
      setUploading(false);
    }
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

  const generateOverview = (meeting: Meeting) => {
    // Priority 1: Use stored overview if available
    if (meeting.overview && meeting.overview.trim()) {
      return meeting.overview;
    }
    
    // Priority 2: Generate content overview from meeting summary (max 200 words)
    if (meeting.meeting_summary && meeting.meeting_summary.trim()) {
      const summary = meeting.meeting_summary;
      
      // Extract key content from meeting minutes
      const sections = summary.split(/\d+️⃣|##/);
      let contentParts = [];
      
      // Look for discussion summary or key topics
      const discussionSection = sections.find(section => 
        section.toLowerCase().includes('discussion') || 
        section.toLowerCase().includes('summary') ||
        section.toLowerCase().includes('agenda')
      );
      
      if (discussionSection) {
        // Extract bullet points and key information
        const bullets = discussionSection
          .split(/[-•*]/)
          .map(item => item.replace(/\*\*/g, '').trim())
          .filter(item => item.length > 20 && !item.toLowerCase().includes('action item'))
          .slice(0, 3); // Take top 3 points
        
        contentParts = bullets;
      }
      
      // If no discussion section, extract from beginning
      if (contentParts.length === 0) {
        const cleanedSummary = summary
          .replace(/\*\*/g, '')
          .replace(/##/g, '')
          .replace(/\d+️⃣/g, '')
          .split('\n')
          .filter(line => line.trim() && !line.includes('Meeting Minutes') && !line.includes('Date:') && !line.includes('Time:'))
          .slice(0, 4)
          .join(' ');
        
        contentParts = [cleanedSummary];
      }
      
      // Combine and limit to 200 words
      const overview = contentParts.join('. ').trim();
      const words = overview.split(' ');
      
      if (words.length > 200) {
        return words.slice(0, 200).join(' ') + '...';
      }
      
      return overview || `Meeting covered key topics including discussions and decisions.`;
    }
    
    // Priority 3: Use description as agenda/purpose
    if (meeting.description && meeting.description.trim()) {
      const words = meeting.description.split(' ').slice(0, 20);
      return words.join(' ') + (words.length === 20 ? '...' : '');
    }
    
    // Priority 4: Basic meeting info fallback
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
          <Button onClick={() => window.location.href = '/'}>
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
            {/* Mobile-first layout */}
            <div className="space-y-3">
              {/* Title and Status Row */}
              <div className="flex items-start justify-between gap-2">
                {/* Checkbox and content */}
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
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge variant="secondary" className="text-xs">
                        {getMeetingTypeLabel(meeting.meeting_type)}
                      </Badge>
                      
                      {/* Add Shared Meeting Badge */}
                      <SharedMeetingBadge 
                        accessType={meeting.access_type || 'owner'}
                        accessLevel={meeting.access_level}
                        sharedBy={meeting.shared_by}
                        sharedAt={meeting.shared_at}
                        shareMessage={meeting.share_message}
                      />
                      
                      {/* Date, Time, Duration, Word Count, Files - All on same line */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{format(new Date(meeting.start_time), 'do MMMM yyyy')}</span>
                        <span className="mx-1">•</span>
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{format(new Date(meeting.start_time), 'HH:mm')}</span>
                      </div>
                      
                      {meeting.duration_minutes && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="mx-1">•</span>
                          <span>{formatDuration(meeting.duration_minutes)}</span>
                        </div>
                      )}

                      {formatWordCount(meeting.word_count) && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3 flex-shrink-0" />
                          <span>{formatWordCount(meeting.word_count)}</span>
                        </div>
                      )}

                      {meeting.document_count > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Paperclip className="h-3 w-3 flex-shrink-0" />
                          <span>{meeting.document_count} file{meeting.document_count !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons - Mobile Optimized */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onViewSummary(meeting.id);
                  }}
                  className="flex items-center justify-center gap-2 flex-1 sm:flex-none touch-manipulation min-h-[44px] text-primary hover:text-primary"
                >
                  <FileText className="h-4 w-4" />
                  <span>View Notes</span>
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
                
                {/* Share Meeting Button - Only show for owned meetings */}
                {(!meeting.access_type || meeting.access_type === 'owner') && (
                  <ShareMeetingDialog meetingId={meeting.id} meetingTitle={meeting.title}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center justify-center gap-2 flex-1 sm:flex-none touch-manipulation min-h-[44px] text-primary hover:text-primary"
                    >
                      <Share2 className="h-4 w-4" />
                      <span>Share</span>
                    </Button>
                  </ShareMeetingDialog>
                )}
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
                currentOverview={meeting.overview || generateOverview(meeting)}
                className="mb-3"
              />
              
              {/* File Upload Summary - Show if documents exist */}
              {meeting.document_count > 0 && (
                <div className="bg-muted/30 rounded-lg p-3 border border-muted">
                  <div className="flex items-center gap-2 mb-2">
                    <Paperclip className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Supporting Documents ({meeting.document_count})</span>
                  </div>
                   <div className="space-y-2">
                     {meeting.documents?.slice(0, 3).map((doc, index) => (
                       <div key={index} className="flex items-center justify-between text-xs">
                         <div className="flex items-center gap-2 min-w-0 flex-1">
                           <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                           <button
                             onClick={(e) => {
                               e.stopPropagation();
                               openDocument(meeting.id, doc.file_name);
                             }}
                             className="truncate text-foreground hover:text-primary hover:underline text-left"
                             title="Click to open document"
                           >
                             {doc.file_name}
                           </button>
                         </div>
                         <div className="flex items-center gap-2 text-muted-foreground ml-2">
                           <span>{doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(1)}MB` : ''}</span>
                           <span>{new Date(doc.uploaded_at).toLocaleDateString('en-GB', { 
                             day: '2-digit', 
                             month: 'short' 
                           })}</span>
                           <button
                             onClick={(e) => {
                               e.stopPropagation();
                               downloadDocument(meeting.id, doc.file_name);
                             }}
                             className="ml-1 p-1 hover:bg-muted rounded"
                             title="Download document"
                           >
                             <Download className="h-3 w-3" />
                           </button>
                         </div>
                       </div>
                     ))}
                    {meeting.document_count > 3 && (
                      <div className="text-xs text-muted-foreground italic">
                        + {meeting.document_count - 3} more file{meeting.document_count - 3 !== 1 ? 's' : ''}...
                      </div>
                    )}
                  </div>
                </div>
              )}
              
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
    </div>
  );
};