import { useState, useEffect, useCallback } from "react";
import { ensureMeetingTitle } from "@/utils/manualTriggerNotes";
import { MobileMeetingList } from "@/components/mobile-meetings/MobileMeetingList";
import { MobileMeetingDetail } from "@/components/mobile-meetings/MobileMeetingDetail";
import { MobileExportSheet } from "@/components/mobile-meetings/MobileExportSheet";
import { SEO } from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';
import { Header } from "@/components/Header";
import { MeetingHistoryList } from "@/components/MeetingHistoryList";
import { MeetingDocuments } from "@/components/MeetingDocuments";
import { MeetingSearchBar, SearchFilters } from "@/components/MeetingSearchBar";
import { MeetingImporter } from "@/components/meeting-dashboard/MeetingImporter";
import { MeetingHistoryViewSelector, HistoryViewMode } from "@/components/meeting-history/MeetingHistoryViewSelector";
import { CompactMeetingList } from "@/components/meeting-history/CompactMeetingList";
import { MeetingGridView } from "@/components/meeting-history/MeetingGridView";
import { MeetingTableView } from "@/components/meeting-history/MeetingTableView";
import { MeetingTimelineView } from "@/components/meeting-history/MeetingTimelineView";

import { FullPageNotesModal } from "@/components/FullPageNotesModal";
import { useRecording } from "@/contexts/RecordingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Clock, FileText, Trash2, Edit, Edit2, Mail, RefreshCw, Square, CheckSquare, ChevronDown, Copy, Sparkles, Save, Download, Upload, Plus, FolderOpen, MoreVertical, BookOpen } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile, useIsIPhone } from "@/hooks/use-mobile";
import { useNavigate, useLocation } from "react-router-dom";
import { cleanLargeTranscript } from '@/utils/CleanTranscriptOrchestrator';
import { showToast } from "@/utils/toastWrapper";
import { useMeetingFolders } from "@/hooks/useMeetingFolders";
import { MeetingFoldersManager } from "@/components/meeting-folders/MeetingFoldersManager";
import { MeetingFolderView } from "@/components/meeting-folders/MeetingFolderView";
import { CorrectionManager } from "@/components/CorrectionManager";
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
  location?: string | null;
  format?: string | null;
  transcript_count?: number;
  summary_exists?: boolean;
  overview?: string | null;
  word_count?: number;
  document_count?: number;
  notes_generation_status?: string;
  live_transcript_text?: string | null; // Add live transcript field
  folder_id?: string | null;
  documents?: Array<{
    file_name: string;
    file_size: number | null;
    uploaded_at: string;
    file_type: string | null;
  }>;
}

// Helper function to deduplicate transcript segments with more aggressive deduplication
const deduplicateTranscript = (segments: string[]): string => {
  if (!segments || segments.length === 0) return '';
  
  // First, clean each segment
  const cleanedSegments = segments
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0);
  
  if (cleanedSegments.length === 0) return '';
  if (cleanedSegments.length === 1) return cleanedSegments[0];
  
  // Join all segments and then split by sentences to find duplicates
  const fullText = cleanedSegments.join(' ');
  
  // Split into sentences and remove duplicates
  const sentences = fullText.split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  const uniqueSentences: string[] = [];
  const seenSentences = new Set<string>();
  
  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Skip if we've seen this exact sentence or a very similar one
    if (!seenSentences.has(normalized) && !isAlreadyIncluded(normalized, uniqueSentences)) {
      uniqueSentences.push(sentence);
      seenSentences.add(normalized);
    }
  }
  
  return uniqueSentences.join('. ').trim() + (uniqueSentences.length > 0 ? '.' : '');
};

// More aggressive duplicate detection
const isAlreadyIncluded = (newSentence: string, existingSentences: string[]): boolean => {
  for (const existing of existingSentences) {
    const existingNormalized = existing.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Check if sentences are too similar (90% overlap)
    if (calculateTextSimilarity(newSentence, existingNormalized) > 0.9) {
      return true;
    }
    
    // Check if one sentence contains the other
    if (newSentence.includes(existingNormalized) || existingNormalized.includes(newSentence)) {
      return true;
    }
  }
  return false;
};

// Helper function to calculate text similarity
const calculateTextSimilarity = (text1: string, text2: string): number => {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  if (words1.length === 0 && words2.length === 0) return 1;
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const intersection = words1.filter(word => words2.includes(word));
  const union = [...new Set([...words1, ...words2])];
  
  return intersection.length / union.length;
};

const MeetingHistory = () => {
  const { user, loading: authLoading, refreshSessionStatus } = useAuth();
  const { isResourceOperationSafe } = useRecording(); // Move hook to top level
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  
  // iPhone detection and view mode
  const isIPhone = useIsIPhone();
  const [iphoneViewMode, setIphoneViewMode] = useState<'list' | 'folders'>('list');
  
  // Layout view mode with localStorage persistence
  const [layoutViewMode, setLayoutViewMode] = useState<HistoryViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('meetingHistoryLayoutMode') as HistoryViewMode) || 'list';
    }
    return 'list';
  });
  
  const handleLayoutViewModeChange = (mode: HistoryViewMode) => {
    setLayoutViewMode(mode);
    localStorage.setItem('meetingHistoryLayoutMode', mode);
  };
  
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalMeetings, setTotalMeetings] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isSearching, setIsSearching] = useState(false);
  
  // Multi-select functionality
  const [selectedMeetings, setSelectedMeetings] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  
  // Advanced search filters
  const [advancedFilters, setAdvancedFilters] = useState<Partial<SearchFilters>>({
    dateFrom: "",
    dateTo: "",
    durationMin: "",
    durationMax: "",
    location: "",
    format: "all"
  });
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMeetingType, setEditMeetingType] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // Meeting detail view state
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [meetingTranscript, setMeetingTranscript] = useState("");
  const [meetingSummary, setMeetingSummary] = useState("");
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  
  // Full page modal state
  const [fullPageModalOpen, setFullPageModalOpen] = useState(false);
  const [modalMeeting, setModalMeeting] = useState<Meeting | null>(null);
  const [modalNotes, setModalNotes] = useState("");
  
  // Transcript view state
  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState(false);
  const [viewingTranscript, setViewingTranscript] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [cleanedTranscript, setCleanedTranscript] = useState("");
  const [isCleaningTranscript, setIsCleaningTranscript] = useState(false);
  const [currentMeetingForTranscript, setCurrentMeetingForTranscript] = useState<Meeting | null>(null);
  const [isSavingCleanedTranscript, setIsSavingCleanedTranscript] = useState(false);
  const [cleanProgress, setCleanProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  
  // Mic test service visibility state
  const [micTestServiceVisible, setMicTestServiceVisible] = useState<boolean>(true);
  
  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Auto-open SafeModeNotesModal state (triggered from PostMeetingActionsModal navigation)
  const [autoOpenSafeModeForMeetingId, setAutoOpenSafeModeForMeetingId] = useState<string | null>(null);

  // Folder management
  const { folders, assignMeetingToFolder } = useMeetingFolders();
  const [foldersDialogOpen, setFoldersDialogOpen] = useState(false);

  // Mobile detail view state
  const [mobileDetailMeetingId, setMobileDetailMeetingId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [mobileExportOpen, setMobileExportOpen] = useState(false);
  const [mobileExportWordCount, setMobileExportWordCount] = useState<number | undefined>();

  const openMobileDetail = useCallback((meetingId: string) => {
    setMobileDetailMeetingId(meetingId);
    requestAnimationFrame(() => setMobileDetailOpen(true));
  }, []);

  const closeMobileDetail = useCallback(() => {
    setMobileDetailOpen(false);
    setTimeout(() => setMobileDetailMeetingId(null), 300);
  }, []);

  const openMobileExport = useCallback((wordCount?: number) => {
    setMobileExportWordCount(wordCount);
    setMobileExportOpen(true);
  }, []);

  // Handle folder assignment - update parent state immediately
  const handleFolderAssigned = (meetingId: string, folderId: string | null) => {
    console.log('🗂 Parent: handleFolderAssigned called', { meetingId, folderId });
    // Immediately update the parent's meetings state (optimistic update)
    setMeetings(prev => prev.map(meeting => 
      meeting.id === meetingId 
        ? { ...meeting, folder_id: folderId }
        : meeting
    ));
  };

  // Component lifecycle logging
  useEffect(() => {
    console.log('🟢 MeetingHistory component MOUNTED');
    return () => console.log('🔴 MeetingHistory component UNMOUNTED');
  }, []);

  const handleViewMeetingSummary = async (meetingId: string) => {
    console.log('🔍 handleViewMeetingSummary called with meetingId:', meetingId);
    console.log('🔍 Current user:', user?.id);
    console.log('🔍 Current fullPageModalOpen state:', fullPageModalOpen);
    
    // Block operation during recording to prevent interference
    if (!isResourceOperationSafe()) {
      showToast.error("Cannot view notes while recording is active. This prevents audio interference.", { section: 'meeting_manager' });
      return;
    }
    
    try {
      console.log('🔍 Fetching meeting details for:', meetingId);
      
      // Fetch meeting details with notes generation status AND notes_style_3 - use maybeSingle to avoid errors
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('*, audio_backup_path, audio_backup_created_at, requires_audio_backup, notes_generation_status, notes_style_3')
        .eq('id', meetingId)
        .eq('user_id', user?.id)
        .maybeSingle();

      console.log('🔍 Meeting query result:', { meeting, meetingError });

      if (meetingError) {
        console.error('❌ Meeting query error:', meetingError);
        throw meetingError;
      }
      
      if (!meeting) {
        console.error('❌ No meeting found for id:', meetingId);
        showToast.error("Meeting not found or you don't have access to it", { section: 'meeting_manager' });
        return;
      }
      
      console.log('🔍 Meeting data fetched:', meeting);
      console.log('🔍 Notes generation status:', meeting.notes_generation_status);

      // Fetch existing summary if available (legacy table)
      const { data: summaryData, error: summaryError } = await supabase
        .from('meeting_summaries')
        .select('*')
        .eq('meeting_id', meetingId)
        .maybeSingle();
      
      if (summaryError) {
        console.error('❌ Summary query error:', summaryError);
      }
      
      console.log('🔍 Summary data fetched:', summaryData?.summary ? 'Summary exists' : 'No summary');

      // Self-heal: if summary exists but notes_generation_status is stuck
      if (summaryData?.summary && 
          (meeting.notes_generation_status === 'queued' || meeting.notes_generation_status === 'generating')) {
        supabase.from('meetings')
          .update({ notes_generation_status: 'completed' })
          .eq('id', meetingId)
          .then(() => console.log('🔧 Self-healed stuck notes_generation_status for', meetingId));
      }
      
      // Load notes_style_3 (Minutes - Standard) for email functionality
      const notesStyle3 = meeting.notes_style_3 || '';
      
      // Set meetingSummary for email button - prefer notes_style_3 over legacy summary
      setMeetingSummary(notesStyle3 || summaryData?.summary || '');
      
      // Handle different notes generation states
      let notesToShow = summaryData?.summary || '';
      let shouldAutoGenerate = false;

      if (!summaryData?.summary) {
        // No notes exist yet
        const status = meeting.notes_generation_status || 'not_started';
        
        switch (status) {
          case 'not_started':
            console.log('🚀 Auto-triggering notes generation');
            shouldAutoGenerate = true;
            notesToShow = '⏳ Generating notes automatically...\n\nYour meeting notes are being created in the background. This may take a moment.';
            break;
          case 'queued':
            notesToShow = '⏳ Notes generation queued...\n\nYour meeting notes will be generated shortly.';
            break;
          case 'generating':
            notesToShow = '⏳ Generating notes in progress...\n\nPlease wait while we create your meeting notes.';
            break;
          case 'failed':
            notesToShow = '❌ Notes generation failed\n\nWe encountered an issue generating your notes automatically. You can try regenerating them manually.';
            break;
          default:
            notesToShow = 'No meeting notes available yet. Click "Generate Notes" to create them.';
        }
      }
      
       // Set modal states once with proper validation
       console.log('🔍 Setting modal states and opening modal...');
       console.log('📝 Meeting to display:', meeting?.title, 'ID:', meeting?.id);
       console.log('📝 Modal notes preview:', notesToShow?.substring(0, 100) + '...');
       
       // Validate meeting ID format before setting state
       if (!meeting?.id || typeof meeting.id !== 'string' || meeting.id.length !== 36) {
         console.error('❌ Invalid meeting ID format:', meeting?.id);
         showToast.error('Invalid meeting data - please refresh and try again', { section: 'meeting_manager' });
         return;
       }
       
       // Clear existing state before setting new data
       setModalMeeting(null);
       setModalNotes('');
       setFullPageModalOpen(false);
       
       // Small delay to ensure state clearing, then set new data
       setTimeout(() => {
         setModalMeeting(meeting);
         setModalNotes(notesToShow);
         setFullPageModalOpen(true);
         console.log('✅ Modal opened with meeting:', meeting.title);
       }, 10);
      
      console.log('📝 Modal state set to true');
      
      // Auto-trigger generation if needed
      if (shouldAutoGenerate) {
        triggerNotesGeneration(meetingId);
      }
      
    } catch (error: any) {
      console.error("❌ Error Loading Meeting:", error);
      console.error("❌ Error details:", error.message, error.code, error.details);
      showToast.error(`Failed to load meeting notes: ${error.message}`, { section: 'meeting_manager' });
    }
  };

  const triggerNotesGeneration = async (meetingId: string) => {
    try {
      console.log('🤖 Triggering notes generation for meeting:', meetingId);
      
      // Update meeting status to queued
      await supabase
        .from('meetings')
        .update({ notes_generation_status: 'queued' })
        .eq('id', meetingId);

      // Add to notes generation queue
      await supabase
        .from('meeting_notes_queue')
        .insert({
          meeting_id: meetingId,
          status: 'pending',
          detail_level: 'standard',
          priority: 1
        });

      // Call the edge function
      console.log('🔍 Manually triggering notes generation for meeting:', meetingId);
      const { data, error } = await supabase.functions.invoke('auto-generate-meeting-notes', {
        body: { meetingId, forceRegenerate: false }
      });

      if (error) {
        console.error('❌ Notes generation failed:', error);
        showToast.error('Failed to generate notes automatically', { section: 'meeting_manager' });
      } else {
        console.log('🎉 Notes generation started successfully');
        showToast.success('Notes are being generated in the background', { section: 'meeting_manager' });
      }

      // Safety net: ensure meeting title is descriptive even if notes were skipped
      ensureMeetingTitle(meetingId).catch(err => console.warn('⚠️ Title safety net failed:', err));
    } catch (error: any) {
      console.error('❌ Error triggering notes generation:', error);
      showToast.error('Failed to start notes generation', { section: 'meeting_manager' });
    }
  };

  // Enhanced markdown-like rendering function (same as MeetingSummary.tsx)
  const renderFormattedText = (text: string) => {
    if (!text) return text;
    
    let formatted = text;
    
    // Fix attendees section - convert bullet points to comma-separated names and remove "Other" sections
    formatted = formatted.replace(
      /(1️⃣ Attendees[\s\S]*?)(?=2️⃣|$)/i,
      (match) => {
        let attendeesSection = match;
        
        // Remove any "Other" related sections completely
        attendeesSection = attendeesSection.replace(/Other[^:]*:[\s\S]*?(?=\n\n|2️⃣|$)/gi, '');
        attendeesSection = attendeesSection.replace(/Other[^:]*[\s\S]*?(?=\n\n|2️⃣|$)/gi, '');
        
        // Remove bullet points and convert to comma-separated list
        attendeesSection = attendeesSection.replace(/^[•\-\*]\s*(.+)$/gm, '$1');
        
        // Split into lines and clean up
        const lines = attendeesSection.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.includes('1️⃣') && !line.toLowerCase().includes('other'))
          .filter(line => line.length > 2); // Remove very short lines
        
        if (lines.length > 0) {
          // Join names with commas and ensure proper formatting
          const cleanedNames = lines.join(', ').replace(/,\s*,/g, ',').replace(/,+/g, ',');
          attendeesSection = `1️⃣ Attendees\n${cleanedNames}\n\n`;
        }
        
        return attendeesSection;
      }
    );
    
    // Ensure proper spacing between emoji sections
    formatted = formatted.replace(/(1️⃣|2️⃣|3️⃣|4️⃣|5️⃣)/g, '\n\n$1');
    
    // Convert #### headers (level 4)
    formatted = formatted.replace(/^#### (.*$)/gm, '<h4 class="text-base font-semibold mt-3 mb-2 text-gray-800">$1</h4>');
    
    // Convert ### headers (level 3)
    formatted = formatted.replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2 text-gray-800">$1</h3>');
    
    // Convert ## headers (level 2)
    formatted = formatted.replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-6 mb-3 text-gray-800">$1</h2>');
    
    // Convert # headers (level 1)
    formatted = formatted.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-8 mb-4 text-gray-800">$1</h1>');
    
    // Improve table formatting with minimal top spacing
    formatted = formatted.replace(/\|(.+)\|/g, (match, content) => {
      const cells = content.split('|').map(cell => cell.trim());
      const cellsHtml = cells.map(cell => 
        `<td class="border border-gray-300 px-3 py-2 text-sm">${cell}</td>`
      ).join('');
      return `<tr>${cellsHtml}</tr>`;
    });
    
    // Wrap table rows in proper table structure with minimal spacing before tables
    formatted = formatted.replace(/(<tr>.*<\/tr>\s*)+/g, (match) => {
      return `<table class="w-full border-collapse border border-gray-300 mt-1 mb-4">${match}</table>`;
    });
    
    // Remove excessive spacing before tables specifically in section 4
    formatted = formatted.replace(/(4️⃣[^<]*)<div class="mb-3"><\/div>\s*<table/g, '$1<table');
    
    // Convert **bold** to HTML bold
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
    
    // Convert *italic* to HTML italic
    formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em class="italic">$1</em>');
    
    // Convert bullet points with better styling
    formatted = formatted.replace(/^[•\-\*] (.*$)/gm, '<div class="ml-6 mb-1 flex"><span class="mr-2">•</span><span>$1</span></div>');
    
    // Convert numbered lists
    formatted = formatted.replace(/^(\d+)\. (.*$)/gm, '<div class="ml-6 mb-1 flex"><span class="mr-2 font-medium">$1.</span><span>$2</span></div>');
    
    // Convert line breaks to proper spacing with reduced spacing before sections
    formatted = formatted.replace(/\n\n\n+/g, '\n\n'); // Remove excessive line breaks
    formatted = formatted.replace(/\n\n/g, '<div class="mb-3"></div>');
    formatted = formatted.replace(/\n/g, '<br />');
    
    // Clean up excessive spacing around emoji sections
    formatted = formatted.replace(/<div class="mb-3"><\/div>\s*(<div class="mb-3"><\/div>\s*)*(1️⃣|2️⃣|3️⃣|4️⃣|5️⃣)/g, '<div class="mb-4"></div>$2');
    
    return formatted;
  };

  const handleGenerateNotes = async () => {
    console.log('🔄 Generate Notes clicked');
    console.log('📝 Selected meeting:', selectedMeeting?.id);
    console.log('📝 Meeting transcript available:', !!meetingTranscript);
    console.log('📝 Transcript length:', meetingTranscript?.length);
    
    if (!selectedMeeting || !meetingTranscript) {
      console.log('❌ Missing required data for generating notes');
      return;
    }
    
    setIsGeneratingNotes(true);
    try {
      const modelOverride = resolveMeetingModel();
      const { data, error } = await supabase.functions.invoke('generate-meeting-notes-claude', {
        body: {
          transcript: meetingTranscript,
          meetingTitle: selectedMeeting.title,
          meetingDate: new Date(selectedMeeting.created_at).toISOString().split('T')[0],
          meetingTime: new Date(selectedMeeting.created_at).toLocaleTimeString(),
          detailLevel: 'standard',
          ...modelOverrideField(),
          skipQc: localStorage.getItem('meeting-qc-enabled') !== 'true',
        }
      });

      if (error) throw error;
      
      setMeetingSummary(data.meetingMinutes);
      
      // Store which model was used for this meeting (shown in footer)
      localStorage.setItem(`meeting-llm-used-${selectedMeeting.id}`, modelOverride ?? 'default');
      
      // Show which model was used
      const modelLabel = modelOverride === 'claude-sonnet-4-6' ? 'Claude Sonnet 4.6' : modelOverride === 'gemini-3-flash' ? 'Gemini 3 Flash' : 'Gemini 3.1 Pro';
      showToast.success(`Notes regenerated using ${modelLabel}`);
      
      // Save to database
      await supabase
        .from('meeting_summaries')
        .upsert({
          meeting_id: selectedMeeting.id,
          summary: data.meetingMinutes,
          key_points: [],
          action_items: [],
          decisions: [],
          next_steps: []
        });
        
    } catch (error: any) {
      console.error("Error generating notes:", error.message);
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  const handleEmailNotes = async () => {
    if (!selectedMeeting || !meetingSummary) {
      showToast.error('No meeting notes available to email', { section: 'meeting_manager' });
      return;
    }
    
    try {
      const { error } = await supabase.functions.invoke('send-meeting-summary', {
        body: {
          to: user?.email,
          meetingTitle: selectedMeeting.title,
          summary: meetingSummary,
          meetingDate: new Date(selectedMeeting.start_time).toLocaleDateString('en-GB')
        }
      });

      if (error) throw error;
      showToast.success(`Meeting notes sent to ${user?.email}`, { section: 'meeting_manager' });
    } catch (error: any) {
      console.error("Error emailing notes:", error.message);
      showToast.error(`Failed to send email: ${error.message}`, { section: 'meeting_manager' });
    }
  };

  const handleViewTranscript = async (meetingId: string) => {
    // Prevent double-tap issues on mobile
    if (transcriptDialogOpen) {
      return;
    }

    // Block operation during recording to prevent interference
    if (!isResourceOperationSafe()) {
      showToast.error("Cannot view transcript while recording is active. This prevents audio interference.", { section: 'meeting_manager' });
      return;
    }

    try {
      console.log('🔍 Loading transcript for meeting:', meetingId);
      
      // Reset states first
      setViewingTranscript("");
      setCleanedTranscript("");
      setCurrentMeetingForTranscript(null);
      
      // Fetch meeting details with live_transcript_text - use maybeSingle to avoid errors
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('*, audio_backup_path, audio_backup_created_at, requires_audio_backup, live_transcript_text')
        .eq('id', meetingId)
        .eq('user_id', user?.id)
        .maybeSingle();

      console.log('🔍 Meeting query result for transcript:', { meeting, meetingError });

      if (meetingError) {
        console.error('❌ Meeting query error:', meetingError);
        throw meetingError;
      }
      
      if (!meeting) {
        console.error('❌ No meeting found for transcript view:', meetingId);
        showToast.error("Meeting not found or you don't have access to it", { section: 'meeting_manager' });
        return;
      }

      // Fetch transcript for the specific meeting
      const { data: transcripts, error: transcriptError } = await supabase
        .from('meeting_transcripts')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('timestamp_seconds', { ascending: true });

      console.log('🔍 Transcript query result:', { transcriptCount: transcripts?.length, transcriptError });

      if (transcriptError) {
        console.error('❌ Transcript query error:', transcriptError);
        throw transcriptError;
      }

      // Debug: Log the raw transcripts to see what we're getting from DB
      console.log('Raw transcripts from DB:', transcripts?.length, 'records');
      transcripts?.forEach((t, i) => {
        console.log(`Transcript ${i}:`, t.content.substring(0, 100) + '...');
      });

      // Handle case where no transcripts exist
      if (!transcripts || transcripts.length === 0) {
        console.log('⚠️ No transcript found for meeting');
        setViewingTranscript('No transcript available for this meeting.');
        setCurrentMeetingForTranscript(meeting);
        setTimeout(() => {
          setTranscriptDialogOpen(true);
        }, 50);
        return;
      }

      // Deduplicate and clean transcript content
      const fullTranscript = deduplicateTranscript(transcripts.map(t => t.content));
      
      console.log('After deduplication, transcript length:', fullTranscript.length, 'chars');
      
      // Set all data before opening dialog
      setViewingTranscript(fullTranscript);
      setCurrentMeetingForTranscript(meeting);
      
      // Use setTimeout to ensure state is updated before dialog opens
      setTimeout(() => {
        console.log('🔍 Opening transcript dialog');
        setTranscriptDialogOpen(true);
      }, 50);
      
    } catch (error: any) {
      console.error("❌ Error loading transcript:", error);
      showToast.error(`Failed to load transcript: ${error.message}`, { section: 'meeting_manager' });
    }
  };

  const copyTranscriptToClipboard = async () => {
    try {
      const textToCopy = cleanedTranscript || viewingTranscript;
      await navigator.clipboard.writeText(textToCopy);
      console.log("Transcript copied to clipboard");
    } catch (error) {
      console.error("Failed to copy transcript:", error);
    }
  };

  const cleanCurrentTranscript = async () => {
    if (!viewingTranscript || !currentMeetingForTranscript) return;
    
    setIsCleaningTranscript(true);
    try {
      // Remove speaker labels and join with spaces
      const rawTranscript = viewingTranscript
        .split('\n')
        .map(line => line.replace(/^Speaker \d+:\s*/, '').trim())
        .filter(line => line.length > 0)
        .join(' ');

      // Clean the transcript using chunked orchestrator
      setCleanProgress({ done: 0, total: 0 });
      const cleaned = await cleanLargeTranscript(rawTranscript, currentMeetingForTranscript.title, (done, total) => setCleanProgress({ done, total }));

      setCleanedTranscript(cleaned);
      
      // Auto-save the cleaned transcript
      await saveCleanedTranscriptAutomatically(cleaned);
      
      console.log(`Transcript cleaned and auto-saved for "${currentMeetingForTranscript.title}"`);
    } catch (error) {
      console.error('Error cleaning transcript:', error);
    } finally {
      setIsCleaningTranscript(false);
    }
  };

  const saveCleanedTranscriptAutomatically = async (cleanedContent: string) => {
    if (!cleanedContent || !currentMeetingForTranscript) return;
    
    try {
      // First, delete all existing transcript records for this meeting
      const { error: deleteError } = await supabase
        .from('meeting_transcripts')
        .delete()
        .eq('meeting_id', currentMeetingForTranscript.id);

      if (deleteError) throw deleteError;

      // Then, insert a single new record with the cleaned transcript
      const { error: insertError } = await supabase
        .from('meeting_transcripts')
        .insert({
          meeting_id: currentMeetingForTranscript.id,
          content: cleanedContent,
          speaker_name: 'AI Cleaned Transcript',
          timestamp_seconds: 0,
          confidence_score: 1.0,
          created_at: new Date().toISOString()
        });

      if (insertError) throw insertError;

      setViewingTranscript(cleanedContent); // Update the original to match cleaned
      
      // Also update the main meeting transcript if this meeting is currently selected
      if (selectedMeeting?.id === currentMeetingForTranscript.id) {
        setMeetingTranscript(cleanedContent);
      }
      
      console.log('✅ Cleaned transcript auto-saved successfully');
    } catch (error) {
      console.error('Error auto-saving cleaned transcript:', error);
    }
  };

  const saveCleanedTranscript = async () => {
    if (!cleanedTranscript || !currentMeetingForTranscript) return;
    
    setIsSavingCleanedTranscript(true);
    try {
      // First, delete all existing transcript records for this meeting
      const { error: deleteError } = await supabase
        .from('meeting_transcripts')
        .delete()
        .eq('meeting_id', currentMeetingForTranscript.id);

      if (deleteError) throw deleteError;

      // Then, insert a single new record with the cleaned transcript
      const { error: insertError } = await supabase
        .from('meeting_transcripts')
        .insert({
          meeting_id: currentMeetingForTranscript.id,
          content: cleanedTranscript,
          speaker_name: 'AI Cleaned Transcript',
          timestamp_seconds: 0,
          confidence_score: 1.0,
          created_at: new Date().toISOString()
        });

      if (insertError) throw insertError;

      console.log('Cleaned transcript saved successfully');
      setViewingTranscript(cleanedTranscript); // Update the original to match cleaned
      
      // Also update the main meeting transcript if this meeting is currently selected
      if (selectedMeeting?.id === currentMeetingForTranscript.id) {
        setMeetingTranscript(cleanedTranscript);
      }
      
      // Show success feedback
      console.log('✅ Transcript replaced with cleaned version');
    } catch (error) {
      console.error('Error saving cleaned transcript:', error);
    } finally {
      setIsSavingCleanedTranscript(false);
    }
  };

  const downloadTranscriptAsWord = async () => {
    if (!currentMeetingForTranscript) return;
    
    const transcriptToUse = cleanedTranscript || viewingTranscript;
    if (!transcriptToUse) return;

    try {
      // Create comprehensive meeting details
      const meetingDate = new Date(currentMeetingForTranscript.start_time);
      const formattedDate = meetingDate.toLocaleDateString('en-GB', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const formattedTime = meetingDate.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      // Create Word document
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              // Title
              new Paragraph({
                children: [
                  new TextRun({
                    text: currentMeetingForTranscript.title,
                    bold: true,
                    size: 32,
                  }),
                ],
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
              }),
              
              // Meeting Details Header
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Meeting Details",
                    bold: true,
                    size: 24,
                  }),
                ],
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 200, after: 200 },
              }),
              
              // Meeting Information
              new Paragraph({
                children: [
                  new TextRun({ text: "Date: ", bold: true }),
                  new TextRun({ text: formattedDate }),
                ],
                spacing: { after: 100 },
              }),
              
              new Paragraph({
                children: [
                  new TextRun({ text: "Time: ", bold: true }),
                  new TextRun({ text: formattedTime }),
                ],
                spacing: { after: 100 },
              }),
              
              new Paragraph({
                children: [
                  new TextRun({ text: "Type: ", bold: true }),
                  new TextRun({ text: currentMeetingForTranscript.meeting_type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }),
                ],
                spacing: { after: 100 },
              }),
              
              ...(currentMeetingForTranscript.duration_minutes ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Duration: ", bold: true }),
                    new TextRun({ text: `${currentMeetingForTranscript.duration_minutes} minutes` }),
                  ],
                  spacing: { after: 100 },
                })
              ] : []),
              
              ...(currentMeetingForTranscript.location ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Location: ", bold: true }),
                    new TextRun({ text: currentMeetingForTranscript.location }),
                  ],
                  spacing: { after: 100 },
                })
              ] : []),
              
              ...(currentMeetingForTranscript.format ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Format: ", bold: true }),
                    new TextRun({ text: currentMeetingForTranscript.format === 'face-to-face' ? 'Face to Face' : 'Teams/Online' }),
                  ],
                  spacing: { after: 100 },
                })
              ] : []),
              
              ...(currentMeetingForTranscript.description ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: "Description: ", bold: true }),
                    new TextRun({ text: currentMeetingForTranscript.description }),
                  ],
                  spacing: { after: 100 },
                })
              ] : []),
              
              // Transcript Header
              new Paragraph({
                children: [
                  new TextRun({
                    text: cleanedTranscript ? "Cleaned Transcript" : "Meeting Transcript",
                    bold: true,
                    size: 24,
                  }),
                ],
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
              }),
              
              ...(cleanedTranscript ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "This transcript has been processed with AI to remove filler words, improve grammar, and enhance readability while preserving the original meaning.",
                      italics: true,
                      size: 20,
                    }),
                  ],
                  spacing: { after: 200 },
                })
              ] : []),
              
              // Transcript Content - Split into paragraphs to preserve spacing
              ...(function() {
                // Split the transcript into paragraphs (the AI creates natural paragraph breaks)
                const paragraphs = transcriptToUse.split(/\n\s*\n/).filter(p => p.trim().length > 0);
                
                return paragraphs.map(paragraphText => 
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: paragraphText.trim(),
                        size: 22,
                      }),
                    ],
                    spacing: { 
                      before: 120,  // Space before paragraph
                      after: 120,   // Space after paragraph
                      lineRule: "atLeast", 
                      line: 360     // 1.5 line spacing within paragraph
                    },
                    alignment: AlignmentType.JUSTIFIED, // Makes text look more professional
                  })
                );
              })(),
              
              // Footer
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}`,
                    italics: true,
                    size: 18,
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 400 },
              }),
            ],
          },
        ],
      });

      // Generate and download the document
      const buffer = await Packer.toBlob(doc);
      const url = URL.createObjectURL(buffer);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentMeetingForTranscript.title} - ${formattedDate.replace(/,/g, '')} - ${cleanedTranscript ? 'AI Enhanced ' : ''}Transcript.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('Word document downloaded successfully');
    } catch (error) {
      console.error('Error creating Word document:', error);
    }
  };

  const formatMeetingTitle = (meeting: Meeting) => {
    const date = new Date(meeting.start_time);
    const formattedDate = date.toLocaleDateString('en-GB', { 
      weekday: 'short',
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
    const formattedTime = date.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    return `${meeting.title} - ${formattedDate} at ${formattedTime}${meeting.location ? ` (${meeting.location})` : ''}`;
  };

  // Fetch mic test service access from user_roles 
  const fetchMicTestServiceSettings = async () => {
    if (!user) return;

    try {
      // Check both user_roles access and profile visibility setting
      const [roleData, profileData] = await Promise.all([
        supabase
          .from('user_roles')
          .select('mic_test_service_access')
          .eq('user_id', user.id)
          .limit(1)
          .single(),
        supabase
          .from('profiles')
          .select('mic_test_service_visible')
          .eq('user_id', user.id)
          .single()
      ]);

      // Service is visible if both access is granted AND visibility is enabled
      const hasAccess = roleData.data?.mic_test_service_access ?? false;
      const isVisible = profileData.data?.mic_test_service_visible ?? true; // Default to true for backwards compatibility
      
      setMicTestServiceVisible(hasAccess && isVisible);
    } catch (error) {
      console.error('Error fetching mic test service settings:', error);
      // Default to false if there's an error
      setMicTestServiceVisible(false);
    }
  };
  // Primary data fetch - triggers when user ID changes
  useEffect(() => {
    console.log('📍 Primary useEffect triggered - User ID:', user?.id);
    if (user) {
      console.log('✅ Calling fetchMeetings from primary useEffect');
      fetchMeetings();
      fetchMicTestServiceSettings();
    } else if (!authLoading) {
      refreshSessionStatus().then((session) => {
        if (!session?.user) setLoading(false);
      });
    }
  }, [user?.id, authLoading]); // Use user.id instead of user object to prevent unnecessary re-renders

  const handlePageChange = (page: number) => {
    fetchMeetings(page);
  };

  // Real-time subscription for meetings table REMOVED — parent (MeetingRecorder) handles it
  // This component relies on prop changes, onRefresh callback, and tab-focus refresh

  // Fallback initial load - only runs once on mount as a safety net
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('🕐 Fallback timer triggered - User:', user?.id, 'Meetings:', meetings.length, 'Loading:', loading);
      if (user && meetings.length === 0 && !loading) {
        console.log('✅ Calling fetchMeetings from fallback');
        fetchMeetings(1);
      }
    }, 100); // Reduced from 300ms for faster initial load

    return () => clearTimeout(timer);
  }, []); // Empty dependency array - only runs once on mount

  // Handle auto-opening transcript dialog when navigated from MeetingRecorder
  useEffect(() => {
    const state = location.state as any;
    if (state?.viewTranscript && state?.openDialog) {
      // Wait for meetings to load, then open the transcript
      const timer = setTimeout(() => {
        handleViewTranscript(state.viewTranscript);
      }, 500);
      return () => clearTimeout(timer);
    }
    
    // Handle auto-opening notes modal when navigated from MeetingRecorder
    if (state?.viewNotes && state?.openModal) {
      // Wait for meetings to load, then open the notes modal
      const timer = setTimeout(() => {
        handleViewMeetingSummary(state.viewNotes);
      }, 500);
      return () => clearTimeout(timer);
    }
    
    // Handle auto-opening SafeModeNotesModal when navigated from PostMeetingActionsModal
    if (state?.openSafeModeModal && state?.safeModeModalMeetingId) {
      console.log('🛡️ Auto-opening SafeModeNotesModal for meeting:', state.safeModeModalMeetingId);
      // Wait for meetings to load, then set the auto-open meeting ID
      const timer = setTimeout(() => {
        setAutoOpenSafeModeForMeetingId(state.safeModeModalMeetingId);
        // Clear the navigation state to prevent re-opening on refresh
        navigate(location.pathname, { replace: true, state: {} });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [location.state, navigate, location.pathname]);

  useEffect(() => {
    filterMeetings();
  }, [meetings, searchQuery, filterType, advancedFilters]);

  // Debug effect to track filteredMeetings changes
  useEffect(() => {
    console.log('🚨 FILTERED MEETINGS STATE CHANGED:', filteredMeetings.length);
    if (filteredMeetings.length > 0) {
      console.log('🚨 First meeting in filteredMeetings:', filteredMeetings[0].title);
    }
  }, [filteredMeetings]);

  // Listen for refresh triggers - NO periodic polling
  useEffect(() => {
    let refreshTimer: NodeJS.Timeout;
    let lastRefreshTime = 0;
    const MIN_REFRESH_INTERVAL = 10000; // Minimum 10 seconds between refreshes

    // Debounced refresh function
    const debouncedRefresh = (reason: string) => {
      const now = Date.now();
      if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
        console.log(`🔄 Refresh throttled: ${reason}`);
        return;
      }
      
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        console.log(`🔄 Refreshing: ${reason}`);
        lastRefreshTime = Date.now();
        fetchMeetings(currentPage);
      }, 1000);
    };

    // Refresh when new meeting is saved via localStorage signal
    const handleStorageChange = (e: StorageEvent) => {
      if ((e.key === 'meeting_just_saved' || e.key === 'meetingHistoryRefresh') && user?.id) {
        localStorage.removeItem('meeting_just_saved');
        localStorage.removeItem('meetingHistoryRefresh');
        debouncedRefresh('meeting saved');
      }
    };

    // Refresh when window/tab gains focus (but throttled)
    const handleFocus = () => {
      if (user?.id && document.visibilityState === 'visible') {
        debouncedRefresh('tab focused');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearTimeout(refreshTimer);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, currentPage]);

  // Debounced server-side search
  useEffect(() => {
    const searchTimer = setTimeout(() => {
      if (user?.id) {
        setCurrentPage(1);
        fetchMeetings(1, searchQuery);
      }
    }, 400);
    
    return () => clearTimeout(searchTimer);
  }, [searchQuery, user?.id, itemsPerPage]);

  // Load notes for modal when generation completes
  const loadNotesForModal = async (meetingId: string) => {
    try {
      const { data: summaryData } = await supabase
        .from('meeting_summaries')
        .select('summary')
        .eq('meeting_id', meetingId)
        .single();
      
      if (summaryData?.summary) {
        setModalNotes(summaryData.summary);
      }
    } catch (error) {
      console.error('Error loading updated notes:', error);
    }
  };

  const fetchMeetings = async (pageToFetch = 1, searchTerm = '') => {
    console.log('🎯 fetchMeetings CALLED - Page:', pageToFetch, 'User ID:', user?.id, 'Search:', searchTerm);
    
    if (!user) {
      console.log('❌ fetchMeetings BLOCKED - No user');
      setMeetings([]);
      setFilteredMeetings([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      if (searchTerm) setIsSearching(true);
      console.log('📥 Fetching meetings - Page:', pageToFetch, 'User:', user.id, 'Search:', searchTerm);
      
      const offset = (pageToFetch - 1) * itemsPerPage;
       
      // Build query with optional search
      let query = supabase
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
          word_count,
          folder_id,
          audio_backup_path,
          audio_backup_created_at,
          requires_audio_backup,
          mixed_audio_url,
          left_audio_url,
          right_audio_url,
          recording_created_at,
          notes_generation_status,
          notes_email_sent_at,
          remote_chunk_paths,
          notes_style_3,
          meeting_overviews(overview, audio_overview_url, audio_overview_text, audio_overview_duration)
        `, { count: 'exact' })
        .eq('user_id', user.id)
        .neq('meeting_type', 'gp_consultation');
      
      // Add server-side search if provided
      if (searchTerm.trim()) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%,meeting_type.ilike.%${searchTerm}%`);
      }
      
      // Apply ordering and pagination
      const { data: meetingsData, error: meetingsError, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + itemsPerPage - 1);

      if (meetingsError) throw meetingsError;

      // Update pagination
      setTotalMeetings(count || 0);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));

      if (!meetingsData || meetingsData.length === 0) {
        setMeetings([]);
        setFilteredMeetings([]);
        return;
      }


      // Load additional data in parallel (counts only, not full content)
      const meetingIds = meetingsData.map(m => m.id);
      
      const [transcriptCounts, summaryExists, documentCounts] = await Promise.all([
        // Chunk counts skipped — not worth scanning 43k+ rows
        Promise.resolve({} as Record<string, number>),
        
        // Check summary existence
        supabase
          .from('meeting_summaries')
          .select('meeting_id')
          .in('meeting_id', meetingIds)
          .then(({ data }) => {
            const exists: Record<string, boolean> = {};
            data?.forEach(s => exists[s.meeting_id] = true);
            return exists;
          }),

        // Just count documents
        supabase
          .from('meeting_documents')
          .select('meeting_id', { count: 'exact' })
          .in('meeting_id', meetingIds)
          .then(({ data }) => {
            const counts: Record<string, number> = {};
            data?.forEach(doc => {
              counts[doc.meeting_id] = (counts[doc.meeting_id] || 0) + 1;
            });
            return counts;
          })
      ]);

      // Create meetings with lightweight data
      // CRITICAL FIX: folder_id must be assigned AFTER spread to avoid being overwritten
      const enrichedMeetings = meetingsData.map(meeting => {
        // Access raw data before any TypeScript transformation
        const rawData = meeting as unknown as Record<string, unknown>;
        const extractedFolderId = rawData.folder_id;
        // PostgREST returns embedded child rows as an array even for 1:1 joins
        const moRaw = (meeting as any).meeting_overviews;
        const mo = Array.isArray(moRaw) ? moRaw[0] : moRaw;
        
        // Build object with folder_id EXPLICITLY at the end (after spread)
        const enriched = {
          ...meeting,
          transcript_count: transcriptCounts[meeting.id] || 0,
          summary_exists: !!summaryExists[meeting.id],
          transcript: null,
          meeting_summary: meeting.notes_style_3 || null,
          document_count: documentCounts[meeting.id] || 0,
          documents: [],
          overview: mo?.overview || null,
          audio_overview_url: mo?.audio_overview_url || null,
          audio_overview_text: mo?.audio_overview_text || null,
          audio_overview_duration: mo?.audio_overview_duration || null,
          // CRITICAL: folder_id MUST be last to override any undefined from spread
          folder_id: (extractedFolderId as string | null) ?? null
        };
        
        return enriched;
      });

      // Trace folder_ids explicitly as string to avoid console collapsing
      const folderTrace = enrichedMeetings.slice(0, 10).map(m => 
        `${m.id.slice(0,8)}:${m.folder_id ?? 'NULL'}`
      ).join(', ');
      console.log('🔴🔴🔴 ENRICHED folder_ids:', folderTrace);

      setMeetings(enrichedMeetings);
      setCurrentPage(pageToFetch);
      console.log('✅ Meetings loaded successfully');

    } catch (error: any) {
      console.error("❌ Error loading meetings:", error.message, error);
      showToast.error("Failed to load meetings", { section: 'meeting_manager' });
    } finally {
      console.log('✅ fetchMeetings completed - Setting loading to false');
      setLoading(false);
      setIsSearching(false);
    }
  };

  const filterMeetings = () => {
    console.log('🚨 FILTERING MEETINGS - input meetings:', meetings.length);
    console.log('🚨 Search query:', `"${searchQuery}"`);
    console.log('🚨 Filter type:', filterType);
    
    // Log folder_ids from the meetings state
    console.log('📁📁📁 FILTER: meetings folder_ids:', meetings.slice(0, 10).map(m => ({
      id: m.id.slice(0, 8),
      folder_id: m.folder_id,
      folder_id_type: typeof m.folder_id
    })));
    
    let filtered = meetings;

    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(meeting =>
        meeting.title.toLowerCase().includes(query) ||
        meeting.description?.toLowerCase().includes(query) ||
        meeting.meeting_type.toLowerCase().includes(query) ||
        meeting.location?.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (filterType !== "all") {
      filtered = filtered.filter(meeting => meeting.meeting_type === filterType);
    }

    // Apply advanced filters
    if (advancedFilters.dateFrom) {
      const fromDate = new Date(advancedFilters.dateFrom);
      filtered = filtered.filter(meeting => new Date(meeting.start_time) >= fromDate);
    }

    if (advancedFilters.dateTo) {
      const toDate = new Date(advancedFilters.dateTo);
      toDate.setHours(23, 59, 59, 999); // Include the entire end date
      filtered = filtered.filter(meeting => new Date(meeting.start_time) <= toDate);
    }

    if (advancedFilters.durationMin) {
      const minDuration = parseInt(advancedFilters.durationMin);
      filtered = filtered.filter(meeting => 
        meeting.duration_minutes !== null && meeting.duration_minutes >= minDuration
      );
    }

    if (advancedFilters.durationMax) {
      const maxDuration = parseInt(advancedFilters.durationMax);
      filtered = filtered.filter(meeting => 
        meeting.duration_minutes !== null && meeting.duration_minutes <= maxDuration
      );
    }

    if (advancedFilters.location && advancedFilters.location.trim()) {
      const locationQuery = advancedFilters.location.toLowerCase();
      filtered = filtered.filter(meeting =>
        meeting.location?.toLowerCase().includes(locationQuery)
      );
    }

    if (advancedFilters.format && advancedFilters.format !== "all") {
      filtered = filtered.filter(meeting => meeting.format === advancedFilters.format);
    }

    // Apply folder filter
    if (advancedFilters.folderId && advancedFilters.folderId !== "all") {
      console.log('🗂 Applying folder filter:', {
        filterId: advancedFilters.folderId,
        totalMeetings: filtered.length,
        meetingsWithFolders: filtered.filter(m => m.folder_id).map(m => ({ 
          id: m.id, 
          title: m.title, 
          folder_id: m.folder_id 
        }))
      });
      
      if (advancedFilters.folderId === "unfiled") {
        filtered = filtered.filter(meeting => !meeting.folder_id);
      } else {
        filtered = filtered.filter(meeting => meeting.folder_id === advancedFilters.folderId);
      }
      
      console.log('🗂 After folder filter:', {
        remainingMeetings: filtered.length,
        meetings: filtered.map(m => ({ id: m.id, title: m.title, folder_id: m.folder_id }))
      });
    }
    
    console.log('🚨 FILTERED MEETINGS RESULT:', filtered.length);
    setFilteredMeetings(filtered);
  };

  const handleMeetingEdit = (meetingId: string) => {
    const meeting = meetings.find(m => m.id === meetingId);
    if (meeting) {
      setEditingMeeting(meeting);
      setEditTitle(meeting.title);
      setEditMeetingType(meeting.meeting_type);
      setEditDialogOpen(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMeeting || !editTitle.trim()) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('meetings')
        .update({
          title: editTitle.trim(),
          meeting_type: editMeetingType,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingMeeting.id)
        .eq('user_id', user?.id);

      if (error) throw error;

      console.log("Meeting Updated - Meeting has been successfully updated");

      setEditDialogOpen(false);
      setEditingMeeting(null);
      setEditTitle("");
      setEditMeetingType("");
      
      // Update the selected meeting if it's currently being viewed
      if (selectedMeeting?.id === editingMeeting.id) {
        setSelectedMeeting({
          ...selectedMeeting,
          title: editTitle.trim(),
          meeting_type: editMeetingType
        });
      }
      
      fetchMeetings(); // Refresh the list
    } catch (error: any) {
      console.error("Error Updating Meeting:", error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditDialogOpen(false);
    setEditingMeeting(null);
    setEditTitle("");
    setEditMeetingType("");
  };

  const handleMeetingDelete = async (meetingId: string) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId)
        .eq('user_id', user?.id);

      if (error) throw error;

      console.log("Meeting Deleted - Meeting has been successfully deleted");

      fetchMeetings();
    } catch (error: any) {
      console.error("Error Deleting Meeting:", error.message);
    }
  };

  const handleDeleteAll = async () => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('user_id', user?.id);

      if (error) throw error;

      console.log("All Meetings Deleted - All meetings have been successfully deleted");

      setDeleteConfirmation("");
      fetchMeetings();
    } catch (error: any) {
      console.error("Error Deleting Meetings:", error.message);
    }
  };

  const [isDeletingEmpty, setIsDeletingEmpty] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [showCorrections, setShowCorrections] = useState(false);
  const [showDeleteEmptyDialog, setShowDeleteEmptyDialog] = useState(false);

  const handleClearEmptyMeetings = async () => {
    if (!user?.id) return;
    
    setIsDeletingEmpty(true);
    try {
      // Use database function to find and delete truly empty meetings
      // This checks actual transcript content, not just the word_count field
      const { data, error } = await supabase.rpc('cleanup_truly_empty_meetings', {
        p_user_id: user.id,
        p_min_age_minutes: 30, // Only delete meetings older than 30 mins
        p_max_word_threshold: 0 // Zero actual words in transcript chunks
      });

      if (error) throw error;

      const count = data?.[0]?.deleted_count || 0;
      if (count > 0) {
        showToast.success(`Cleared ${count} truly empty meeting${count > 1 ? 's' : ''}`, { section: 'meeting_manager' });
      } else {
        showToast.info('No empty meetings to clear', { section: 'meeting_manager' });
      }

      fetchMeetings();
    } catch (error: any) {
      console.error("Error clearing empty meetings:", error.message);
      showToast.error('Failed to clear empty meetings', { section: 'meeting_manager' });
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
      // This checks actual transcript content, not just the word_count field
      const { data, error } = await supabase.rpc('cleanup_truly_empty_meetings', {
        p_user_id: user.id,
        p_min_age_minutes: 30, // Only delete meetings older than 30 mins  
        p_max_word_threshold: 100 // Less than 100 actual words
      });

      if (error) throw error;

      const count = data?.[0]?.deleted_count || 0;
      if (count > 0) {
        showToast.success(`Deleted ${count} meeting${count > 1 ? 's' : ''} with less than 100 words`, { section: 'meeting_manager' });
      } else {
        showToast.info('No meetings with less than 100 words found', { section: 'meeting_manager' });
      }

      fetchMeetings();
    } catch (error: any) {
      console.error("Error deleting empty meetings:", error.message);
      showToast.error('Failed to delete empty meetings', { section: 'meeting_manager' });
    } finally {
      setIsDeletingEmpty(false);
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

  // Merge meetings handler
  const handleMergeMeetings = async () => {
    if (selectedMeetings.length < 2) {
      showToast.error("Please select at least 2 meetings to merge", { section: 'meeting_manager' });
      return;
    }

    try {
      console.log('🔄 Starting merge for meetings:', selectedMeetings);
      
      const { data, error } = await supabase.functions.invoke('merge-meetings', {
        body: { meetingIds: selectedMeetings }
      });

      if (error) throw error;

      showToast.success(
        `Successfully merged ${data.deletedMeetings + 1} meetings. New notes are being generated.`,
        { section: 'meeting_manager' }
      );

      // Reset multi-select state
      setSelectedMeetings([]);
      setIsSelectMode(false);
      
      // Refresh meetings list
      fetchMeetings();

      // Navigate to the merged meeting after a short delay
      setTimeout(() => {
        navigate(`/meeting-history`);
      }, 1000);

    } catch (error: any) {
      console.error('❌ Error merging meetings:', error);
      showToast.error(`Failed to merge meetings: ${error.message}`, { section: 'meeting_manager' });
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

      console.log(`${selectedMeetings.length} meetings deleted successfully`);
      
      setSelectedMeetings([]);
      setIsSelectMode(false);
      fetchMeetings();
    } catch (error: any) {
      console.error("Error deleting selected meetings:", error.message);
    }
  };

  // ── Mobile layout ──
  if (isMobile) {
    return (
      <>
        <MobileMeetingList
          meetings={filteredMeetings}
          totalCount={totalMeetings}
          loading={loading}
          onSelectMeeting={openMobileDetail}
        />
        {mobileDetailMeetingId && (
          <MobileMeetingDetail
            meetingId={mobileDetailMeetingId}
            open={mobileDetailOpen}
            onBack={closeMobileDetail}
            onViewSummary={handleViewMeetingSummary}
            onShowExport={openMobileExport}
          />
        )}
        <MobileExportSheet
          open={mobileExportOpen}
          onClose={() => setMobileExportOpen(false)}
          meetingId={mobileDetailMeetingId}
          wordCount={mobileExportWordCount}
        />
        <FullPageNotesModal
          isOpen={fullPageModalOpen}
          onClose={() => { setFullPageModalOpen(false); setModalMeeting(null); setModalNotes(''); }}
          meeting={modalMeeting}
          notes={modalNotes}
          onNotesChange={setModalNotes}
        />
      </>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-background">
        <Header />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Checking login…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-background">
        <Header />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Sign in to view meetings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Your old meetings are protected by your Notewell login.</p>
              <Button className="w-full" onClick={() => navigate('/auth?returnTo=/meetings')}>
                Sign in
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background">
        <Header />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading meetings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background">
      <SEO 
        title="Consultation History | NoteWell AI"
        description="View, edit, and manage your saved consultations and meeting notes. Comprehensive history and document management for NHS GP practices."
        canonical="https://www.gpnotewell.co.uk/meeting-history"
        keywords="consultation history, meeting notes, medical records management, GP consultation log, NHS meeting history"
      />
      <Header />
      
       <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:py-8 space-y-6 max-w-6xl">
         {/* Header Section */}
         <div className="flex items-start justify-between gap-4">
           <div className="space-y-2">
             <h1 className="text-3xl sm:text-4xl lg:text-5xl font-playfair font-bold text-foreground">
               Meeting History
             </h1>
             <p className="text-base sm:text-lg font-inter text-muted-foreground">
               View, edit, and manage your saved consultations
             </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="default"
                onClick={() => setFoldersDialogOpen(true)}
                className="touch-manipulation min-h-[44px] flex items-center gap-2 font-inter shadow-sm hover:shadow-md transition-all whitespace-nowrap"
              >
                <FolderOpen className="h-4 w-4" />
                <span className="hidden lg:inline">Manage Folders</span>
                <span className="lg:hidden">Folders</span>
              </Button>
              
              <Button
                variant="default"
                size="default"
                onClick={() => setImportDialogOpen(true)}
                className="touch-manipulation min-h-[44px] flex items-center gap-2 font-inter shadow-sm hover:shadow-md transition-all whitespace-nowrap"
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden lg:inline">Demonstration Meeting</span>
                <span className="hidden sm:inline lg:hidden">Demo Import</span>
                <span className="sm:hidden">Import</span>
              </Button>
            </div>
          </div>

          {/* Stats - Compact badge for iPhone, full cards for desktop */}
          {isIPhone ? (
            <div className="mb-3">
              <Badge variant="secondary" className="text-sm px-3 py-1.5 font-inter">
                {meetings.length} {meetings.length === 1 ? 'meeting' : 'meetings'}
              </Badge>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-sm hover:shadow-md transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-inter font-medium text-muted-foreground">Total Meetings</p>
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-4xl font-playfair font-bold text-foreground">{meetings.length}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20 shadow-sm hover:shadow-md transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-inter font-medium text-muted-foreground">This Month</p>
                    <Clock className="h-5 w-5 text-accent" />
                  </div>
                  <p className="text-4xl font-playfair font-bold text-foreground">
                    {meetings.filter(m => 
                      new Date(m.created_at).getMonth() === new Date().getMonth()
                    ).length}
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-success/5 to-success/10 border-success/20 shadow-sm hover:shadow-md transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-inter font-medium text-muted-foreground">With Summaries</p>
                    <FileText className="h-5 w-5 text-success" />
                  </div>
                  <p className="text-4xl font-playfair font-bold text-foreground">
                    {meetings.filter(m => m.summary_exists).length}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* iPhone view mode toggle */}
          {isIPhone && (
            <div className="flex gap-2 p-1 bg-muted rounded-lg mb-4">
              <Button
                variant={iphoneViewMode === 'list' ? 'secondary' : 'ghost'}
                className="flex-1"
                onClick={() => setIphoneViewMode('list')}
              >
                All Meetings
              </Button>
              <Button
                variant={iphoneViewMode === 'folders' ? 'secondary' : 'ghost'}
                className="flex-1"
                onClick={() => setIphoneViewMode('folders')}
              >
                By Folder
              </Button>
            </div>
          )}

         {/* Search Bar and View Selector */}
         <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
           <div className="flex-1">
            <MeetingSearchBar 
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              resultsCount={totalMeetings}
              filterType={filterType}
              onFilterChange={setFilterType}
              onAdvancedFiltersChange={setAdvancedFilters}
              advancedFilters={advancedFilters}
              folders={folders}
            />
           </div>
           {/* View Mode Selector - Hidden on mobile */}
           {!isMobile && (
             <MeetingHistoryViewSelector
               viewMode={layoutViewMode}
               onViewModeChange={handleLayoutViewModeChange}
             />
           )}
         </div>

          {/* Selection Controls and Actions Row - Hidden on mobile */}
          {!isMobile && (
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center sm:justify-between p-4 bg-muted/30 rounded-xl border border-border/50">
              <div className="flex items-center gap-3 flex-wrap">
                {meetings.length > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => {
                        setIsSelectMode(!isSelectMode);
                        setSelectedMeetings([]);
                      }}
                      className="touch-manipulation min-h-[44px] font-inter"
                    >
                      {isSelectMode ? (
                        <>
                          <Square className="h-4 w-4 mr-2" />
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
                          size="default"
                          onClick={handleSelectAll}
                          className="touch-manipulation min-h-[44px] font-inter"
                        >
                          {selectedMeetings.length === filteredMeetings.length ? 'Deselect All' : 'Select All'}
                        </Button>
                        
                        {selectedMeetings.length > 0 && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-inter font-medium">
                            {selectedMeetings.length} selected
                          </span>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
             {/* Refresh Button */}
             <Button
               variant="outline"
               size="default"
               onClick={async () => {
                 console.log('🔄 Manual refresh requested');
                 fetchMeetings(currentPage);
                 showToast.success('Refreshing meeting list...', { section: 'meeting_manager' });
                 
                 // Generate missing overviews after refreshing
                 setTimeout(async () => {
                   try {
                     const meetingsNeedingOverviews = meetings.filter(meeting => 
                       meeting.status === 'completed' && 
                       (!meeting.overview || meeting.overview.trim() === '')
                     );
                     
                     if (meetingsNeedingOverviews.length > 0) {
                       console.log(`🎯 Found ${meetingsNeedingOverviews.length} meetings needing overviews`);
                       showToast.info(`Generating overviews for ${meetingsNeedingOverviews.length} meetings...`, { section: 'meeting_manager' });
                       
                       let successCount = 0;
                       for (const meeting of meetingsNeedingOverviews) {
                         try {
                           const { data: summaryData } = await supabase
                             .from('meeting_summaries')
                             .select('summary')
                             .eq('meeting_id', meeting.id)
                             .single();
                             
                           if (summaryData?.summary) {
                             const { data, error } = await supabase.functions.invoke('generate-meeting-overview', {
                               body: {
                                 meetingTitle: meeting.title,
                                 meetingNotes: summaryData.summary
                               }
                             });
                             
                             if (!error && data?.overview) {
                               await supabase
                                 .from('meetings')
                                 .update({ overview: data.overview })
                                 .eq('id', meeting.id);
                                 
                               await supabase
                                 .from('meeting_overviews')
                                 .upsert({
                                   meeting_id: meeting.id,
                                   overview: data.overview
                                 });
                                 
                               successCount++;
                             }
                           }
                         } catch (overviewError) {
                           console.warn(`Failed to generate overview for meeting ${meeting.id}:`, overviewError);
                         }
                       }
                       
                       if (successCount > 0) {
                         showToast.success(`Generated ${successCount} new overviews`, { section: 'meeting_manager' });
                         fetchMeetings(currentPage);
                       }
                     }
                   } catch (error) {
                     console.error('Error generating overviews:', error);
                   }
                 }, 1000);
               }}
               className="touch-manipulation min-h-[44px] flex items-center gap-2 font-inter shadow-sm hover:shadow-md transition-all"
             >
               <RefreshCw className="h-4 w-4" />
               <span className="hidden sm:inline">Refresh Page</span>
               <span className="sm:hidden">Refresh</span>
             </Button>

             {meetings.length > 0 && isSelectMode && selectedMeetings.length > 0 && (
               <AlertDialog>
                 <AlertDialogTrigger asChild>
                   <Button 
                     variant="destructive" 
                     size="default"
                     className="touch-manipulation min-h-[44px] font-inter shadow-sm hover:shadow-md transition-all"
                   >
                     <Trash2 className="h-4 w-4 mr-2" />
                     Delete ({selectedMeetings.length})
                   </Button>
                 </AlertDialogTrigger>
                 <AlertDialogContent className="mx-4 max-w-md font-inter">
                   <AlertDialogHeader>
                     <AlertDialogTitle className="font-playfair">Delete Selected Meetings</AlertDialogTitle>
                     <AlertDialogDescription>
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

               {meetings.length > 0 && !isMobile && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="default"
                      disabled={isDeletingEmpty}
                      className="touch-manipulation min-h-[44px] font-inter shadow-sm hover:shadow-md transition-all"
                    >
                      {isDeletingEmpty ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <MoreVertical className="h-4 w-4 mr-2" />
                      )}
                      Quick Actions
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={handleClearEmptyMeetings} disabled={isDeletingEmpty}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear Empty (0 words, 90min+)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowDeleteEmptyDialog(true)} disabled={isDeletingEmpty}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Empty (&lt;100 words)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowCorrections(true)}>
                      <BookOpen className="h-4 w-4 mr-2" />
                      Name & Term Corrections
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteAllDialog(true)} 
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete All
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Delete Empty Meetings Dialog */}
              <AlertDialog open={showDeleteEmptyDialog} onOpenChange={setShowDeleteEmptyDialog}>
                <AlertDialogContent className="mx-4 max-w-md font-inter">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-playfair">Delete Empty Meetings</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all meetings with less than 100 words. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel className="touch-manipulation min-h-[44px]">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteEmptyMeetings}
                      className="bg-destructive hover:bg-destructive/90 touch-manipulation min-h-[44px]"
                    >
                      Delete Empty Meetings
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Delete All Meetings Dialog */}
              <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
                <AlertDialogContent className="mx-4 max-w-md font-inter">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-playfair">Delete All Meetings</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action will permanently delete all {meetings.length} meetings, their transcripts, and summaries. This cannot be undone.
                      <br /><br />
                      To confirm, please type <strong>delete</strong> in the field below:
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Input
                    placeholder="Type 'delete' to confirm"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    className="touch-manipulation min-h-[44px]"
                  />
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel 
                      onClick={() => setDeleteConfirmation("")}
                      className="touch-manipulation min-h-[44px]"
                    >
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => {
                        handleDeleteAll();
                        setShowDeleteAllDialog(false);
                      }}
                      disabled={deleteConfirmation.toLowerCase() !== 'delete'}
                      className="bg-destructive hover:bg-destructive/90 touch-manipulation min-h-[44px]"
                    >
                      Delete All Meetings
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          )}


        {/* Meeting Detail View or Meetings List */}
        {selectedMeeting ? (
          <Card>
            <CardHeader className="space-y-4">
              {/* Always visible back button at the top */}
              <div className="flex items-center justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedMeeting(null)}
                  className="touch-manipulation min-h-[44px] flex items-center gap-2"
                >
                  <ChevronDown className="h-4 w-4 rotate-90" />
                  Back to List
                </Button>
                
                {/* Edit button - only show when not editing */}
                {!editingMeeting && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleMeetingEdit(selectedMeeting.id)}
                    className="touch-manipulation min-h-[44px] flex items-center gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                )}
              </div>
              
              {/* Meeting title and editing section */}
              <div className="space-y-3">
                {editingMeeting?.id === selectedMeeting.id ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="edit-title">Meeting Title</Label>
                      <Input
                        id="edit-title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="text-lg font-semibold touch-manipulation min-h-[44px]"
                        placeholder="Enter meeting title"
                        autoFocus
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-type">Meeting Type</Label>
                      <Select value={editMeetingType} onValueChange={setEditMeetingType}>
                        <SelectTrigger className="touch-manipulation min-h-[44px]">
                          <SelectValue placeholder="Select meeting type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General Meeting</SelectItem>
                          <SelectItem value="patient-consultation">Patient Meeting</SelectItem>
                          <SelectItem value="team-meeting">Team Meeting</SelectItem>
                          <SelectItem value="clinical-review">Clinical Review</SelectItem>
                          <SelectItem value="training">Training Session</SelectItem>
                          <SelectItem value="pcn-meeting">PCN Meeting</SelectItem>
                          <SelectItem value="icb-meeting">ICB Meeting</SelectItem>
                          <SelectItem value="neighbourhood-meeting">Neighbourhood Meeting</SelectItem>
                          <SelectItem value="federation">Federation</SelectItem>
                          <SelectItem value="locality">Locality</SelectItem>
                          <SelectItem value="lmc">LMC</SelectItem>
                          <SelectItem value="gp-partners">GP Partners Meeting</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={handleSaveEdit}
                        disabled={isSaving || !editTitle.trim()}
                        className="touch-manipulation min-h-[44px] flex-1 sm:flex-none"
                      >
                        {isSaving ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        className="touch-manipulation min-h-[44px] flex-1 sm:flex-none"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <CardTitle className="text-xl sm:text-2xl mb-2">{selectedMeeting.title}</CardTitle>
                    <p className="text-muted-foreground">
                      {new Date(selectedMeeting.start_time).toLocaleDateString('en-GB', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                 {/* Meeting Notes Section */}
                 <div className="space-y-4">
                   <h3 className="text-lg font-semibold">Meeting Notes</h3>
                    {meetingSummary ? (
                      <div className="prose max-w-none">
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: renderNHSMarkdown(renderFormattedText(meetingSummary), { enableNHSStyling: true })
                          }}
                        />
                      </div>
                    ) : (
                    <div className="text-center py-8 bg-muted/50 rounded-lg border">
                      <p className="text-muted-foreground mb-4">No AI-generated notes available for this meeting.</p>
                      <Button 
                        onClick={handleGenerateNotes}
                        disabled={isGeneratingNotes || !meetingTranscript}
                        className="touch-manipulation min-h-[44px]"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isGeneratingNotes ? 'animate-spin' : ''}`} />
                        {isGeneratingNotes ? 'Generating...' : 'Generate Notes'}
                      </Button>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  {meetingSummary && (
                    <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t">
                      <Button 
                        onClick={handleGenerateNotes}
                        disabled={isGeneratingNotes || !meetingTranscript}
                        variant="outline"
                        className="flex-1 touch-manipulation min-h-[44px]"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isGeneratingNotes ? 'animate-spin' : ''}`} />
                        {isGeneratingNotes ? 'Regenerating...' : 'Regenerate Notes'}
                      </Button>
                      
                      <Button 
                        onClick={handleEmailNotes}
                        disabled={!meetingSummary}
                        variant="outline"
                        className="flex-1 touch-manipulation min-h-[44px]"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Email Notes
                      </Button>
                    </div>
                  )}
                </div>

                {/* Transcript Section - Collapsible */}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="transcript" className="border rounded-lg px-4">
                    <AccordionTrigger className="text-lg font-semibold hover:no-underline py-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Transcript
                        {meetingTranscript && (
                          <span className="text-sm text-muted-foreground font-normal">
                            ({meetingTranscript.split(' ').length} words)
                          </span>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      {meetingTranscript ? (
                        <div className="prose max-w-none">
                          <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
                            {meetingTranscript}
                          </pre>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">No transcript available for this meeting.</p>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Meeting Details Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Meeting Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg border">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Title</Label>
                      <p className="text-sm">{selectedMeeting.title}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Type</Label>
                      <p className="text-sm">{selectedMeeting.meeting_type}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Date</Label>
                      <p className="text-sm">{new Date(selectedMeeting.start_time).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Time</Label>
                      <p className="text-sm">{new Date(selectedMeeting.start_time).toLocaleTimeString()}</p>
                    </div>
                    {selectedMeeting.duration_minutes && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Duration</Label>
                        <p className="text-sm">{selectedMeeting.duration_minutes} minutes</p>
                      </div>
                    )}
                    {selectedMeeting.location && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Location</Label>
                        <p className="text-sm">{selectedMeeting.location}</p>
                      </div>
                    )}
                    {selectedMeeting.format && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Format</Label>
                        <p className="text-sm">{selectedMeeting.format === 'face-to-face' ? 'Face to Face' : 'Teams/Online'}</p>
                      </div>
                    )}
                    {selectedMeeting.status && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                        <p className="text-sm capitalize">{selectedMeeting.status}</p>
                      </div>
                    )}
                    {selectedMeeting.description && (
                      <div className="sm:col-span-2">
                        <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                        <p className="text-sm mt-1">{selectedMeeting.description}</p>
                      </div>
                   )}
                 </div>

                 {/* Supporting Documents Section */}
                 <MeetingDocuments 
                   meetingId={selectedMeeting.id} 
                   meetingTitle={selectedMeeting.title}
                 />
               </div>
              </div>
            </CardContent>
          </Card>
        ) : isIPhone && iphoneViewMode === 'folders' ? (
          <MeetingFolderView
            folders={folders}
            meetings={filteredMeetings}
            onEdit={handleMeetingEdit}
            onViewSummary={handleViewMeetingSummary}
            onViewTranscript={handleViewTranscript}
            onDelete={handleMeetingDelete}
            onRefresh={fetchMeetings}
            loading={loading}
            isSelectMode={isSelectMode}
            selectedMeetings={selectedMeetings}
            onSelectMeeting={handleSelectMeeting}
            onMeetingUpdate={(meetingId, updatedTitle) => {
              setMeetings(prev => prev.map(meeting => 
                meeting.id === meetingId 
                  ? { ...meeting, title: updatedTitle }
                  : meeting
              ));
            }}
            onDocumentsUploaded={(meetingId, uploadedFiles) => {
              setMeetings(prev => prev.map(meeting => {
                if (meeting.id === meetingId) {
                  const existingDocuments = meeting.documents || [];
                  const newDocuments = [...existingDocuments, ...uploadedFiles];
                  return {
                    ...meeting,
                    document_count: newDocuments.length,
                    documents: newDocuments
                  };
                }
                return meeting;
              }));
            }}
            showRecordingPlayback={micTestServiceVisible}
            onFolderAssigned={handleFolderAssigned}
          />
        ) : layoutViewMode === 'compact' ? (
          <CompactMeetingList
            meetings={filteredMeetings}
            isSelectMode={isSelectMode}
            selectedMeetings={selectedMeetings}
            onSelectMeeting={handleSelectMeeting}
            onViewNotes={handleViewMeetingSummary}
            onDelete={handleMeetingDelete}
            loading={loading}
          />
        ) : layoutViewMode === 'grid' ? (
          <MeetingGridView
            meetings={filteredMeetings}
            isSelectMode={isSelectMode}
            selectedMeetings={selectedMeetings}
            onSelectMeeting={handleSelectMeeting}
            onViewNotes={handleViewMeetingSummary}
            onDelete={handleMeetingDelete}
            loading={loading}
          />
        ) : layoutViewMode === 'table' ? (
          <MeetingTableView
            meetings={filteredMeetings}
            isSelectMode={isSelectMode}
            selectedMeetings={selectedMeetings}
            onSelectMeeting={handleSelectMeeting}
            onSelectAll={handleSelectAll}
            onViewNotes={handleViewMeetingSummary}
            onDelete={handleMeetingDelete}
            loading={loading}
          />
        ) : layoutViewMode === 'timeline' ? (
          <MeetingTimelineView
            meetings={filteredMeetings}
            isSelectMode={isSelectMode}
            selectedMeetings={selectedMeetings}
            onSelectMeeting={handleSelectMeeting}
            onViewNotes={handleViewMeetingSummary}
            onDelete={handleMeetingDelete}
            loading={loading}
          />
        ) : (
          <MeetingHistoryList 
            meetings={filteredMeetings}
            onEdit={handleMeetingEdit}
            onViewSummary={handleViewMeetingSummary}
            onViewTranscript={handleViewTranscript}
            onDelete={handleMeetingDelete}
            onRefresh={fetchMeetings}
            loading={loading}
            isSelectMode={isSelectMode}
            selectedMeetings={selectedMeetings}
            onSelectMeeting={handleSelectMeeting}
            onMeetingUpdate={(meetingId, updatedTitle) => {
              setMeetings(prev => prev.map(meeting => 
                meeting.id === meetingId 
                  ? { ...meeting, title: updatedTitle }
                  : meeting
              ));
            }}
            onDocumentsUploaded={(meetingId, uploadedFiles) => {
              setMeetings(prev => prev.map(meeting => {
                if (meeting.id === meetingId) {
                  const existingDocuments = meeting.documents || [];
                  const newDocuments = [...existingDocuments, ...uploadedFiles];
                  return {
                    ...meeting,
                    document_count: newDocuments.length,
                    documents: newDocuments
                  };
                }
                return meeting;
              }));
            }}
            showRecordingPlayback={micTestServiceVisible}
            onFolderAssigned={handleFolderAssigned}
            autoOpenSafeModeForMeetingId={autoOpenSafeModeForMeetingId}
            onAutoOpenSafeModeProcessed={() => setAutoOpenSafeModeForMeetingId(null)}
            onOpenCorrectionManager={() => setShowCorrections(true)}
          />
        )}

        {/* Pagination Controls */}
        {!selectedMeeting && !loading && totalPages > 1 && (
          <div className="flex justify-center mt-6">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) handlePageChange(currentPage - 1);
                    }}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                
                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(page);
                      }}
                      isActive={page === currentPage}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                
                <PaginationItem>
                  <PaginationNext 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) handlePageChange(currentPage + 1);
                    }}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

        {/* Enhanced Transcript View Dialog with AI Cleaning - Mobile Optimized */}
        <Dialog open={transcriptDialogOpen} onOpenChange={setTranscriptDialogOpen}>
          <DialogContent className="mx-2 sm:mx-4 max-w-[98vw] sm:max-w-5xl max-h-[95vh] sm:max-h-[90vh] p-3 sm:p-6">
            <DialogHeader className="text-left space-y-2">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                Meeting Transcript
              </DialogTitle>
              {currentMeetingForTranscript && (
                <DialogDescription className="space-y-1 text-xs sm:text-sm">
                  <div className="font-medium text-foreground text-sm sm:text-base">
                    {formatMeetingTitle(currentMeetingForTranscript)}
                  </div>
                  <div className="text-xs sm:text-sm flex flex-wrap gap-1">
                    <span>{currentMeetingForTranscript.meeting_type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                    {currentMeetingForTranscript.duration_minutes && <span>• {currentMeetingForTranscript.duration_minutes} min</span>}
                    {currentMeetingForTranscript.format && <span>• {currentMeetingForTranscript.format === 'face-to-face' ? 'Face to Face' : 'Teams/Online'}</span>}
                  </div>
                  <div className="text-xs hidden sm:block">
                    View the original transcript or clean it with AI to remove filler words and improve formatting.
                  </div>
                </DialogDescription>
              )}
            </DialogHeader>
            
            <div className="space-y-3 sm:space-y-4 py-2 sm:py-4 overflow-hidden">
              {/* Transcript Info */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {(cleanedTranscript || viewingTranscript).split(' ').length} words
                  </span>
                  {cleanedTranscript && (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                      ✨ AI Cleaned
                    </span>
                  )}
                </div>
              </div>

              {/* Action Bar - Always visible */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2 p-3 sm:p-4 bg-muted/30 rounded-lg border">
                <Button
                  onClick={cleanCurrentTranscript}
                  disabled={isCleaningTranscript || !viewingTranscript}
                  variant="outline"
                  size="sm"
                  className="w-full lg:w-auto touch-manipulation min-h-[44px] text-xs sm:text-sm"
                >
                  {isCleaningTranscript ? (
                    <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                  )}
                  {isCleaningTranscript ? (cleanProgress.total > 0 ? `Cleaning ${cleanProgress.done}/${cleanProgress.total} & Auto-saving...` : 'Cleaning & Auto-saving...') : 'Clean with AI'}
                </Button>
                
                <Button
                  onClick={downloadTranscriptAsWord}
                  disabled={!viewingTranscript}
                  variant="outline"
                  size="sm"
                  className="w-full lg:w-auto touch-manipulation min-h-[44px] text-xs sm:text-sm"
                >
                  <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                  <span className="sm:hidden">Word</span>
                  <span className="hidden sm:inline">Download Word</span>
                </Button>
                
                <Button
                  onClick={copyTranscriptToClipboard}
                  variant="outline"
                  size="sm"
                  className="w-full lg:w-auto touch-manipulation min-h-[44px] text-xs sm:text-sm"
                >
                  <Copy className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                  <span className="sm:hidden">Copy</span>
                  <span className="hidden sm:inline">Copy {cleanedTranscript ? 'Cleaned' : 'Original'}</span>
                </Button>
              </div>

              {/* Tabbed transcript display */}
              <Tabs defaultValue="final" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="final" className="text-xs sm:text-sm">
                    Final Transcript
                  </TabsTrigger>
                  <TabsTrigger value="live" className="text-xs sm:text-sm">
                    Live Transcript shown in Meeting
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="final" className="mt-4">
                  <div className="border rounded-lg p-3 sm:p-4 bg-background max-h-[50vh] sm:max-h-[55vh] overflow-y-auto">
                    {cleanedTranscript ? (
                      <div className="prose max-w-none prose-sm sm:prose">
                        <div className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed">
                          {cleanedTranscript}
                        </div>
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap text-xs sm:text-sm font-mono text-muted-foreground leading-relaxed">
                        {viewingTranscript || "No final transcript available for this meeting."}
                      </pre>
                    )}
                    {viewingTranscript && (
                      <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                        Final transcript: {viewingTranscript.split(' ').length} words
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="live" className="mt-4">
                  <div className="border rounded-lg p-3 sm:p-4 bg-background max-h-[50vh] sm:max-h-[55vh] overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-xs sm:text-sm font-mono text-muted-foreground leading-relaxed">
                      {liveTranscript || "No live transcript available for this meeting."}
                    </pre>
                    {liveTranscript && (
                      <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                        Live transcript: {liveTranscript.split(' ').length} words
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

            </div>
            
            <DialogFooter className="pt-2 sm:pt-4">
              <Button 
                onClick={() => {
                  setTranscriptDialogOpen(false);
                  setCleanedTranscript("");
                  setCurrentMeetingForTranscript(null);
                }}
                className="w-full sm:w-auto touch-manipulation min-h-[44px] text-sm"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Meeting Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="mx-4 max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Meeting</DialogTitle>
              <DialogDescription>
                Update the meeting name and type. Changes will be saved immediately.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Meeting Name</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Enter meeting name"
                  className="w-full touch-manipulation min-h-[44px]"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-type">Meeting Type</Label>
                <Select value={editMeetingType} onValueChange={setEditMeetingType}>
                  <SelectTrigger className="w-full touch-manipulation min-h-[44px]">
                    <SelectValue placeholder="Select meeting type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Meeting</SelectItem>
                    <SelectItem value="patient-consultation">Patient Meeting</SelectItem>
                    <SelectItem value="team-meeting">Team Meeting</SelectItem>
                    <SelectItem value="clinical-review">Clinical Review</SelectItem>
                    <SelectItem value="training">Training Session</SelectItem>
                    <SelectItem value="pcn-meeting">PCN Meeting</SelectItem>
                    <SelectItem value="icb-meeting">ICB Meeting</SelectItem>
                    <SelectItem value="neighbourhood-meeting">Neighbourhood Meeting</SelectItem>
                    <SelectItem value="federation">Federation</SelectItem>
                    <SelectItem value="locality">Locality</SelectItem>
                    <SelectItem value="lmc">LMC</SelectItem>
                    <SelectItem value="gp-partners">GP Partners Meeting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="w-full sm:w-auto touch-manipulation min-h-[44px]"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveEdit}
                disabled={isSaving || !editTitle.trim()}
                className="w-full sm:w-auto touch-manipulation min-h-[44px]"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Full Page Notes Modal - now available on all devices */}
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
                  fetchMeetings(currentPage);
                  
                  // Optionally open the newly created meeting
                  setTimeout(() => {
                    handleViewMeetingSummary(meetingId);
                  }, 1000);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Meeting Folders Manager Dialog */}
        <MeetingFoldersManager
          open={foldersDialogOpen}
          onOpenChange={setFoldersDialogOpen}
        />

        {/* Name & Term Corrections Modal */}
        {showCorrections && (
          <CorrectionManager 
            onClose={() => setShowCorrections(false)}
            onCorrectionApplied={() => {}}
            onCorrectionsChanged={() => {
              // Force meeting list to re-render with updated corrections
              // by triggering a re-fetch of meetings
              fetchMeetings();
            }}
          />
        )}

      </div>
    </div>
  );
};

export default MeetingHistory;