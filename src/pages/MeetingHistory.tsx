import { useState, useEffect } from "react";
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';
import { Header } from "@/components/Header";
import { MeetingHistoryList } from "@/components/MeetingHistoryList";
import { MeetingDocuments } from "@/components/MeetingDocuments";
import { MeetingSearchBar, SearchFilters } from "@/components/MeetingSearchBar";
import { FullPageNotesModal } from "@/components/FullPageNotesModal";
import { detectDevice } from "@/utils/DeviceDetection";
import { useRecording } from "@/contexts/RecordingContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Clock, FileText, Trash2, Edit, Edit2, Mail, RefreshCw, Square, CheckSquare, ChevronDown, Copy, Sparkles, Save, Download } from "lucide-react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate, useLocation } from "react-router-dom";
import { cleanLargeTranscript } from '@/utils/CleanTranscriptOrchestrator';
import { toast } from "sonner";

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
  word_count?: number;
  document_count?: number;
  notes_generation_status?: string; // Add this field
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
  const { user } = useAuth();
  const { isResourceOperationSafe } = useRecording(); // Move hook to top level
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalMeetings, setTotalMeetings] = useState(0);
  const itemsPerPage = 10;
  
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
  const [cleanedTranscript, setCleanedTranscript] = useState("");
  const [isCleaningTranscript, setIsCleaningTranscript] = useState(false);
  const [currentMeetingForTranscript, setCurrentMeetingForTranscript] = useState<Meeting | null>(null);
  const [isSavingCleanedTranscript, setIsSavingCleanedTranscript] = useState(false);
  const [cleanProgress, setCleanProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  
  // Mic test service visibility state
  const [micTestServiceVisible, setMicTestServiceVisible] = useState<boolean>(true);

  const handleViewMeetingSummary = async (meetingId: string) => {
    console.log('🔍 handleViewMeetingSummary called with meetingId:', meetingId);
    console.log('🔍 Current user:', user?.id);
    console.log('🔍 Current fullPageModalOpen state:', fullPageModalOpen);
    
    // Block operation during recording to prevent interference
    if (!isResourceOperationSafe()) {
      toast.error("Cannot view notes while recording is active. This prevents audio interference.");
      return;
    }
    
    try {
      console.log('🔍 Fetching meeting details for:', meetingId);
      
      // Fetch meeting details with notes generation status - use maybeSingle to avoid errors
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('*, audio_backup_path, audio_backup_created_at, requires_audio_backup, notes_generation_status')
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
        toast.error("Meeting not found or you don't have access to it");
        return;
      }
      
      console.log('🔍 Meeting data fetched:', meeting);
      console.log('🔍 Notes generation status:', meeting.notes_generation_status);

      // Fetch existing summary if available
      const { data: summaryData, error: summaryError } = await supabase
        .from('meeting_summaries')
        .select('*')
        .eq('meeting_id', meetingId)
        .maybeSingle();
      
      if (summaryError) {
        console.error('❌ Summary query error:', summaryError);
      }
      
      console.log('🔍 Summary data fetched:', summaryData?.summary ? 'Summary exists' : 'No summary');
      
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
      
      // Set all modal states together using React's batching
      console.log('🔍 Setting modal states and opening modal...');
      
      // Use React 18's automatic batching by setting states in sequence
      setModalMeeting(meeting);
      setModalNotes(notesToShow);
      
      // Force state updates and open modal with better debugging
      console.log('📝 About to open modal with meeting:', meeting?.title);
      console.log('📝 Modal notes length:', notesToShow?.length);
      console.log('📝 Current fullPageModalOpen state before:', fullPageModalOpen);
      
      // Set states with force re-render
      setModalMeeting(meeting);
      setModalNotes(notesToShow);
      
      // Force modal open with immediate state change
      setFullPageModalOpen(true);
      
      console.log('📝 Modal state set to true');
      
      // Auto-trigger generation if needed
      if (shouldAutoGenerate) {
        triggerNotesGeneration(meetingId);
      }
      
    } catch (error: any) {
      console.error("❌ Error Loading Meeting:", error);
      console.error("❌ Error details:", error.message, error.code, error.details);
      toast.error(`Failed to load meeting notes: ${error.message}`);
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
        toast.error('Failed to generate notes automatically');
      } else {
        console.log('🎉 Notes generation started successfully');
        toast.success('Notes are being generated in the background');
      }
    } catch (error: any) {
      console.error('❌ Error triggering notes generation:', error);
      toast.error('Failed to start notes generation');
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
      const { data, error } = await supabase.functions.invoke('generate-meeting-notes-claude', {
        body: {
          transcript: meetingTranscript,
          meetingTitle: selectedMeeting.title,
          meetingDate: new Date(selectedMeeting.created_at).toISOString().split('T')[0],
          meetingTime: new Date(selectedMeeting.created_at).toLocaleTimeString(),
          detailLevel: 'standard'
        }
      });

      if (error) throw error;
      
      setMeetingSummary(data.meetingMinutes);
      
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
    if (!selectedMeeting || !meetingSummary) return;
    
    try {
      const { error } = await supabase.functions.invoke('send-meeting-summary', {
        body: {
          to: user?.email,
          meetingTitle: selectedMeeting.title,
          summary: meetingSummary,
          meetingDate: new Date(selectedMeeting.start_time).toLocaleDateString()
        }
      });

      if (error) throw error;
      console.log("Meeting notes emailed successfully");
    } catch (error: any) {
      console.error("Error emailing notes:", error.message);
    }
  };

  const handleViewTranscript = async (meetingId: string) => {
    // Prevent double-tap issues on mobile
    if (transcriptDialogOpen) {
      return;
    }

    // Block operation during recording to prevent interference
    if (!isResourceOperationSafe()) {
      toast.error("Cannot view transcript while recording is active. This prevents audio interference.");
      return;
    }

    try {
      console.log('🔍 Loading transcript for meeting:', meetingId);
      
      // Reset states first
      setViewingTranscript("");
      setCleanedTranscript("");
      setCurrentMeetingForTranscript(null);
      
      // Fetch meeting details - use maybeSingle to avoid errors
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('*, audio_backup_path, audio_backup_created_at, requires_audio_backup')
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
        toast.error("Meeting not found or you don't have access to it");
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
      toast.error(`Failed to load transcript: ${error.message}`);
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
                    text: cleanedTranscript ? "AI-Enhanced Transcript" : "Meeting Transcript",
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
  useEffect(() => {
    if (user) {
      fetchMeetings();
      fetchMicTestServiceSettings();
    }
  }, [user]);

  const handlePageChange = (page: number) => {
    fetchMeetings(page);
  };

  // Real-time updates for meeting changes with enhanced reliability
  useEffect(() => {
    if (!user) return;

    console.log('🔌 Setting up real-time meeting subscriptions...');
    
    const channel = supabase
      .channel('meeting-history-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meetings',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔄 New meeting inserted, refreshing meeting history...', payload);
          // Refresh meetings when a new meeting is added
          fetchMeetings(currentPage);
          toast.success('New meeting detected - refreshing list');
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
        // Real-time updates for meeting status changes
        (payload) => {
          console.log('🔄 Meeting updated, checking notes status...', payload);
          
          // Update the specific meeting in our list
          setMeetings(prev => prev.map(meeting => 
            meeting.id === payload.new.id 
              ? { ...meeting, ...payload.new }
              : meeting
          ));
          
          // Update modal if it's the same meeting and notes completed
          if (modalMeeting?.id === payload.new.id && 
              payload.new.notes_generation_status === 'completed') {
            loadNotesForModal(payload.new.id);
          }
          
          // Show toast for notes completion
          if (payload.new.notes_generation_status === 'completed' && 
              payload.old.notes_generation_status !== 'completed') {
            toast.success('Meeting notes have been generated!');
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'meetings',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('🔄 Meeting deleted, refreshing meeting history...', payload);
          // Refresh meetings when a meeting is deleted
          fetchMeetings(currentPage);
        }
      )
      .subscribe((status) => {
        console.log('📡 Real-time subscription status:', status);
        
        // If subscription fails, set up a fallback refresh
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time updates connected successfully');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('⚠️ Real-time subscription failed, enabling fallback refresh');
          // Enable more frequent polling as fallback
          const fallbackTimer = setInterval(() => {
            if (user?.id && !document.hidden) {
              console.log('🔄 Fallback refresh due to subscription failure');
              fetchMeetings(currentPage);
            }
          }, 15000); // Every 15 seconds
          
          // Clean up fallback after 5 minutes
          setTimeout(() => clearInterval(fallbackTimer), 300000);
        }
      });

    return () => {
      console.log('🔌 Cleaning up real-time subscriptions...');
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Additional effect to ensure meetings are fetched when component mounts
  // This handles cases where user state might be available but the effect didn't trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      if (user && meetings.length === 0 && !loading) {
        console.log('🔄 Backup fetchMeetings triggered - ensuring data is loaded');
        fetchMeetings(1);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, []);

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
  }, [location.state]);

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

  // Listen for navigation from MeetingRecorder and add mobile optimizations
  useEffect(() => {
    let refreshTimer: NodeJS.Timeout | null = null;
    let visibilityTimer: NodeJS.Timeout | null = null;
    
    // Enhanced storage listener for multiple refresh signals
    const handleStorageChange = (e: StorageEvent) => {
      if ((e.key === 'meeting_just_saved' || e.key === 'meetingHistoryRefresh') && user?.id) {
        console.log('🔄 Meeting saved signal received, refreshing list');
        localStorage.removeItem('meeting_just_saved');
        localStorage.removeItem('meetingHistoryRefresh');
        setTimeout(() => fetchMeetings(currentPage), 1000); // Small delay to ensure DB is updated
      }
    };

    // Enhanced focus handler with mobile optimizations
    const handleFocus = () => {
      if (user?.id) {
        console.log('🔄 Tab/window focused, refreshing meetings');
        fetchMeetings(currentPage);
      }
    };

    // Mobile-specific visibility change handler
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.id) {
        // Clear any pending timer
        if (visibilityTimer) clearTimeout(visibilityTimer);
        
        // Debounce the refresh to avoid excessive calls
        visibilityTimer = setTimeout(() => {
          console.log('🔄 App became visible, refreshing meetings');
          fetchMeetings(currentPage);
        }, 500);
      }
    };

    // Periodic polling as fallback for mobile Safari issues
    const startPeriodicRefresh = () => {
      if (refreshTimer) clearInterval(refreshTimer);
      
      // Only enable periodic refresh when recording is likely happening
      const lastActivity = localStorage.getItem('meetingHistoryRefresh');
      const recentActivity = lastActivity && (Date.now() - parseInt(lastActivity)) < 30000; // 30 seconds
      
      if (recentActivity) {
        console.log('🔄 Starting periodic refresh due to recent activity');
        refreshTimer = setInterval(() => {
          if (user?.id && !document.hidden) {
            console.log('🔄 Periodic refresh check');
            fetchMeetings(currentPage);
          }
        }, 10000); // Check every 10 seconds
      }
    };

    // Mobile detection
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // Set up listeners
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // For mobile, also listen to page show/hide events
    if (isMobile) {
      window.addEventListener('pageshow', handleFocus);
      window.addEventListener('pagehide', () => {
        if (refreshTimer) clearInterval(refreshTimer);
      });
    }
    
    // Start periodic refresh if needed
    startPeriodicRefresh();
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (isMobile) {
        window.removeEventListener('pageshow', handleFocus);
        window.removeEventListener('pagehide', () => {});
      }
      
      if (refreshTimer) clearInterval(refreshTimer);
      if (visibilityTimer) clearTimeout(visibilityTimer);
    };
  }, [user?.id, currentPage]);

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

  const fetchMeetings = async (pageToFetch = 1) => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      console.log('🚨 FETCHING MEETINGS - User ID:', user?.id, 'Page:', pageToFetch);
      
      // First get total count for pagination
      const { count, error: countError } = await supabase
        .from('meetings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .neq('meeting_type', 'gp_consultation');

      if (countError) throw countError;

      const totalCount = count || 0;
      setTotalMeetings(totalCount);
      setTotalPages(Math.ceil(totalCount / itemsPerPage));
      
      const offset = (pageToFetch - 1) * itemsPerPage;
       
       // Get everything in one optimized query using joins
      const { data: meetingsData, error: meetingsError } = await supabase
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
          audio_backup_path,
          audio_backup_created_at,
          requires_audio_backup,
          mixed_audio_url,
          left_audio_url,
          right_audio_url,
          recording_created_at,
          notes_generation_status,
          meeting_overviews(overview)
        `)
        .eq('user_id', user?.id)
        .neq('meeting_type', 'gp_consultation')
        .order('created_at', { ascending: false })
        .range(offset, offset + itemsPerPage - 1);

      console.log('🚨 MEETINGS QUERY RESULT:');
      console.log('🚨 Error:', meetingsError);
      console.log('🚨 Data count:', meetingsData?.length);
      console.log('🚨 Raw data:', meetingsData);

      if (meetingsError) throw meetingsError;

      if (!meetingsData || meetingsData.length === 0) {
        console.log('🚨 NO MEETINGS DATA - setting empty array');
        setMeetings([]);
        setFilteredMeetings([]);
        return;
      }

      console.log('🚨 MEETINGS DATA RECEIVED:', meetingsData.length, 'meetings');
      meetingsData.forEach((meeting, index) => {
        console.log(`🚨 Meeting ${index}:`, meeting.title, meeting.created_at);
      });

      // Batch the remaining queries efficiently
      const meetingIds = meetingsData.map(m => m.id);
      
      const [transcriptCounts, summaryExists, transcriptResult, documentsData] = await Promise.all([
        // Get transcript counts in one query
        supabase
          .from('meeting_transcripts')
          .select('meeting_id')
          .in('meeting_id', meetingIds)
          .then(({ data }) => {
            return data?.reduce((acc, t) => {
              acc[t.meeting_id] = (acc[t.meeting_id] || 0) + 1;
              return acc;
            }, {} as Record<string, number>) || {};
          }),
        
        // Get summary existence in one query
        supabase
          .from('meeting_summaries')
          .select('meeting_id')
          .in('meeting_id', meetingIds)
          .then(({ data }) => {
            return data?.reduce((acc, s) => {
              acc[s.meeting_id] = true;
              return acc;
            }, {} as Record<string, boolean>) || {};
          }),

        // Get word counts from transcripts using the database function that handles multiple sources
        Promise.all(
          meetingIds.map(async (meetingId) => {
            const { data, error } = await supabase.rpc('get_meeting_full_transcript', {
              p_meeting_id: meetingId
            });
            
            if (error) {
              console.error('Error fetching transcript for meeting', meetingId, error);
              return { meetingId, transcript: '', wordCount: 0 };
            }
            
            const transcript = data?.[0]?.transcript || '';
            const wordCount = transcript ? transcript.split(/\s+/).filter(word => word.length > 0).length : 0;
            
            console.log('🚨 TRANSCRIPT FOR MEETING', meetingId, '- Length:', transcript.length, 'Words:', wordCount, 'Source:', data?.[0]?.source);
            
            return { meetingId, transcript, wordCount };
          })
        ).then(results => {
          const wordCounts: Record<string, number> = {};
          const transcriptContents: Record<string, string> = {};
          
          results.forEach(({ meetingId, transcript, wordCount }) => {
            wordCounts[meetingId] = wordCount;
            transcriptContents[meetingId] = transcript;
          });
          
          console.log('🚨 FINAL TRANSCRIPT RESULTS:', results.map(r => ({ 
            meetingId: r.meetingId, 
            transcriptLength: r.transcript.length,
            wordCount: r.wordCount 
          })));
          
          return { wordCounts, transcriptContents };
        }),

        // Get document details
        supabase
          .from('meeting_documents')
          .select('meeting_id, file_name, file_size, uploaded_at, file_type')
          .in('meeting_id', meetingIds)
          .order('uploaded_at', { ascending: false })
          .then(({ data }) => {
            const documentsData: Record<string, any[]> = {};
            data?.forEach(doc => {
              if (!documentsData[doc.meeting_id]) {
                documentsData[doc.meeting_id] = [];
              }
              documentsData[doc.meeting_id].push({
                file_name: doc.file_name,
                file_size: doc.file_size,
                uploaded_at: doc.uploaded_at,
                file_type: doc.file_type
              });
            });
            return documentsData;
          })
      ]);

      // Extract transcript data from the result
      const { wordCounts, transcriptContents } = transcriptResult;

      const enrichedMeetings = meetingsData.map(meeting => ({
        ...meeting,
        transcript_count: transcriptCounts[meeting.id] || 0,
        summary_exists: !!summaryExists[meeting.id],
        word_count: wordCounts[meeting.id] || null,
        transcript: transcriptContents[meeting.id] || null, // Add transcript content
        document_count: documentsData[meeting.id]?.length || 0,
        documents: documentsData[meeting.id] || [],
        // Extract the overview from the nested meeting_overviews object
        overview: meeting.meeting_overviews?.overview || null
      }));

      console.log('🚨 ENRICHED MEETINGS:', enrichedMeetings.length);
      enrichedMeetings.forEach((meeting, index) => {
        console.log(`🚨 Enriched Meeting ${index}:`, {
          title: meeting.title, 
          id: meeting.id,
          hasTranscript: !!meeting.transcript,
          transcriptLength: meeting.transcript?.length || 0
        });
      });
      
      setMeetings(enrichedMeetings);
      setCurrentPage(pageToFetch);

      console.log('🚨 SETTING MEETINGS STATE...');
      setMeetings(enrichedMeetings);
      
      console.log('🚨 MEETINGS STATE SET - should trigger re-render');
    } catch (error: any) {
      console.error("Error Loading Meetings:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const filterMeetings = () => {
    console.log('🚨 FILTERING MEETINGS - input meetings:', meetings.length);
    console.log('🚨 Search query:', `"${searchQuery}"`);
    console.log('🚨 Filter type:', filterType);
    
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
      <Header />
      
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 max-w-6xl">
        {/* Header Section */}
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Meeting History</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              View, edit, and manage your saved meetings
            </p>
          </div>
        </div>

        {/* Stats Cards - Hidden on mobile, collapsible on larger screens */}
        <div className="hidden sm:grid sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{meetings.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {meetings.filter(m => 
                  new Date(m.created_at).getMonth() === new Date().getMonth()
                ).length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">With Summaries</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {meetings.filter(m => m.summary_exists).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search Bar with Manual Refresh */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <MeetingSearchBar 
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              resultsCount={filteredMeetings.length}
              filterType={filterType}
              onFilterChange={setFilterType}
              onAdvancedFiltersChange={setAdvancedFilters}
              advancedFilters={advancedFilters}
            />
          </div>
          
          {/* Manual Refresh Button - More prominent for mobile */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              console.log('🔄 Manual refresh requested');
              fetchMeetings(currentPage);
              toast.success('Refreshing meeting list...');
            }}
            className="touch-manipulation min-h-[44px] sm:min-h-[36px] flex items-center gap-2 bg-primary/5 hover:bg-primary/10 border-primary/20"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Check Latest</span>
            <span className="sm:hidden">Refresh</span>
          </Button>
        </div>

        {/* Multi-select and Delete Controls */}
        {meetings.length > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Multi-select controls */}
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

            {/* Delete actions */}
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

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="touch-manipulation min-h-[44px] text-xs sm:text-sm"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="mx-4 max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete All Meetings</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm">
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
                      onClick={handleDeleteAll}
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
              // Update the local meetings array
              setMeetings(prev => prev.map(meeting => 
                meeting.id === meetingId 
                  ? { ...meeting, title: updatedTitle }
                  : meeting
              ));
            }}
            onDocumentsUploaded={(meetingId, uploadedFiles) => {
              // Update the local meetings array with new documents
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

              {/* Simplified transcript display */}
              <div className="border rounded-lg p-3 sm:p-4 bg-background max-h-[50vh] sm:max-h-[55vh] overflow-y-auto">
                {cleanedTranscript ? (
                  <div className="prose max-w-none prose-sm sm:prose">
                    <div className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed">
                      {cleanedTranscript}
                    </div>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-xs sm:text-sm font-mono text-muted-foreground leading-relaxed">
                    {viewingTranscript || "No transcript available for this meeting."}
                  </pre>
                )}
              </div>

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

      </div>
    </div>
  );
};

export default MeetingHistory;