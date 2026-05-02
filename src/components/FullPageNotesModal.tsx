// Polyfill requestIdleCallback for iOS Safari
const _ric = typeof requestIdleCallback === 'function'
  ? requestIdleCallback
  : (cb: IdleRequestCallback, opts?: IdleRequestOptions) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline), opts?.timeout ?? 1) as unknown as number;
const _cic = typeof cancelIdleCallback === 'function'
  ? cancelIdleCallback
  : (id: number) => clearTimeout(id);

import RichTextEditor from "@/components/RichTextEditor";
import { NoteEnhancementDialog } from "@/components/meeting/NoteEnhancementDialog";
import { sanitiseActionOwners } from "@/utils/sanitiseActionOwners";
import { MeetingMinutesEmailModal } from "@/components/MeetingMinutesEmailModal";
import { EmailMeetingMinutesModal } from "@/components/EmailMeetingMinutesModal";
import { useMinutesFormatter } from "@/hooks/useMinutesFormatter";


import { EnhancedSoapNotesDisplay } from "@/components/meeting/EnhancedSoapNotesDisplay";
import { LiveImportModal } from "@/components/meeting/import/LiveImportModal";
import { NotesGenerationBadges } from "@/components/meeting-notes/NotesGenerationBadges";
import { ProcessingTimeBadges } from "@/components/meeting-notes/ProcessingTimeBadges";
import { RecordingDeviceBadge } from "@/components/meeting-history/RecordingDeviceBadge";
import { LlmModelBadge } from "@/components/meeting-history/LlmModelBadge";
import { RegenerateWithSonnetButton } from "@/components/meeting-history/RegenerateWithSonnetButton";
import { QualityReportSection } from "@/components/meeting-notes/QualityReportSection";
import React, { useState, useEffect, useRef, Suspense, lazy, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';
import { renderPoeticContent } from '@/lib/poeticRenderer';
import { renderMinutesMarkdown } from '@/lib/minutesRenderer';
import { 
  renderMinutesNoActions, 
  renderMinutesBlackWhite, 
  renderMinutesConcise, 
  renderMinutesDetailed, 
  renderMinutesExecutiveBrief 
} from '@/lib/minutesRendererVariations';
import { ClaudeEnhancementModal } from "@/components/ClaudeEnhancementModal";
import EnhancedFindReplacePanel from "@/components/EnhancedFindReplacePanel";
import { SpeechToText } from "@/components/SpeechToText";
import { MeetingTemplatesTab } from "@/components/MeetingTemplatesTab";
import { RecordingWarningBanner } from "@/components/RecordingWarningBanner";
import { MeetingContextEnhancer } from "@/components/MeetingContextEnhancer";
import { CustomAIPromptModal } from "@/components/CustomAIPromptModal";
import { CustomFindReplaceModal } from "@/components/CustomFindReplaceModal";
import { supabase } from "@/integrations/supabase/client";
import { syncTranscriptCorrections } from "@/utils/transcriptCorrectionSync";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TranscriptContextDialog } from "@/components/meeting/TranscriptContextDialog";
import { formatTranscriptContext, extractCleanContent, addMeetingMetadataToTranscript } from "@/utils/meeting/formatTranscriptContext";

// Lazy load heavy components to improve initial load performance
const TranscriptTabContent = lazy(() => 
  import("@/components/meeting/notes-modal/TranscriptTabContent").then(module => ({ default: module.TranscriptTabContent }))
);


const LazySoapNotesDisplay = lazy(() =>
  import("@/components/meeting/EnhancedSoapNotesDisplay").then(module => ({ default: module.EnhancedSoapNotesDisplay }))
);
import { UploadedFile } from "@/types/ai4gp";
import { useAuth } from "@/contexts/AuthContext";
import { useRecording } from "@/contexts/RecordingContext";
import { useIsMobile, useIsIPhone } from "@/hooks/use-mobile";
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import stringSimilarity from "string-similarity";
import { stripMarkdown, copyPlainTextToClipboard } from '@/utils/stripMarkdown';
import { toast } from 'sonner';
import { 
  Bot, 
  ChevronDown, 
  Sparkles, 
  Edit3, 
  Copy, 
  FileText,
  Download,
  Search,
  Type,
  FileType,
  Mic,
  X,
  Wand2,
  RefreshCw,
  ChevronUp,
  ChevronDown as ChevronDownIcon,
  Undo2,
  Save,
  FolderOpen,
  FilePlus2,
  AlignJustify,
  Mail,
  MoreVertical,
  Eraser,
  Minus,
  Plus,
  AlertTriangle,
  Stethoscope,
  Users,
  Maximize2,
  Minimize2
} from "lucide-react";
import { cleanTranscript } from '@/lib/transcriptCleaner';
import { NHS_DEFAULT_RULES } from '@/lib/nhsDefaultRules';
import { medicalTermCorrector } from '@/utils/MedicalTermCorrector';
import { exportConsultationToWord } from '@/utils/consultationWordExport';
import { WordIcon } from '@/components/icons/WordIcon';
import { resolveMeetingModel, modelOverrideField } from '@/utils/resolveMeetingModel';

// Maximum length for Standard minutes rendering - skip expensive formatting for very long notes
const MAX_MINUTES_RENDER_LENGTH = 50000;

interface Meeting {
  id: string;
  title: string;
  start_time: string;
  created_at: string;
  end_time?: string | null;
  duration_minutes?: number | null;
  duration?: string;
  notes_style_2?: string;
  notes_style_3?: string;
  notes_style_4?: string;
  notes_style_5?: string;
  _isLoading?: boolean; // Flag to indicate meeting data is still loading
}

interface FullPageNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: Meeting | null;
  notes: string;
  onNotesChange: (notes: string) => void;
  initialTab?: 'notes' | 'transcript';
}

interface ContentVersion {
  content: string;
  timestamp: number;
  contentType: 'notes' | 'transcript';
  actionType: string;
}

export const FullPageNotesModal: React.FC<FullPageNotesModalProps> = ({
  isOpen,
  onClose,
  meeting,
  notes,
  onNotesChange,
  initialTab
}) => {
  const { user, canViewConsultationExamples } = useAuth();
  const { isRecording, isResourceOperationSafe } = useRecording();
  const isMobile = useIsMobile();
  const isIPhone = useIsIPhone();
  
  // Check if meeting data is still loading (from optimised handleViewMeetingSummary)
  const isMeetingLoading = meeting?._isLoading === true;
  
  // Debug logging removed (was slowing renders)

  
  // Check if this is a large meeting that might cause performance issues
  const isLargeMeeting = notes && notes.length > 15000;
  
  const minutesContainerRef = useRef<HTMLDivElement>(null);
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showCustomInstruction, setShowCustomInstruction] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");
  const [showCustomAIModal, setShowCustomAIModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Safety constants for large content handling
  const MAX_CONTENT_LENGTH = 20000; // characters
  const ENHANCEMENT_TIMEOUT = 60000; // 60 seconds
  const [activeTab, setActiveTab] = useState(initialTab || "notes");
  const [activeNotesStyleTab, setActiveNotesStyleTab] = useState("style1");
  
  // Update active tab when initialTab prop changes
  useEffect(() => {
    if (initialTab && isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);
  const [notesStyle3, setNotesStyle3] = useState("");
  const [generationMetadata, setGenerationMetadata] = useState<any>(null);
  const [consolidationTiming, setConsolidationTiming] = useState<any>(null);
  const [isGeneratingStyle3, setIsGeneratingStyle3] = useState(false);
  
  // Ref to prevent multiple simultaneous regeneration calls
  const isRegeneratingStyle3Ref = useRef(false);
  const [noteStylesLoaded, setNoteStylesLoaded] = useState(false);

  // IMPORTANT: Seed Standard Minutes immediately from the provided notes prop
  // so the modal never appears “stuck” while we fetch note styles in the background.
  useEffect(() => {
    if (!isOpen) return;
    if (!meeting?.id) return;

    const seeded = (notes || '').trim();
    if (seeded) {
      setNotesStyle3(seeded);
      setNoteStylesLoaded(true);
    }
  }, [isOpen, meeting?.id, notes]);
  
  // Standard Minutes format variations
  const [selectedFormatVariation, setSelectedFormatVariation] = useState<string>('standard');
  const [formatVariationContent, setFormatVariationContent] = useState<string>('');
  const [isLoadingVariation, setIsLoadingVariation] = useState(false);
  
  // Attendee modal state
  const [attendeeModalOpen, setAttendeeModalOpen] = useState(false);
  
  // Dropdown controlled states for debugging
  const [formatDropdownOpen, setFormatDropdownOpen] = useState(false);
  const [actionsDropdownOpen, setActionsDropdownOpen] = useState(false);
  
  // SOAP notes state
  const [soapNotes, setSoapNotes] = useState<{
    shorthand?: {S: string, O: string, A: string, P: string},
    standard?: {S: string, O: string, A: string, P: string},
    generated_at?: string,
    consultation_type?: string,
    summary_line?: string,
    patient_copy?: string,
    referral?: string,
    review?: string,
    clinical_actions?: any
  } | null>(null);
  const [isGeneratingSoap, setIsGeneratingSoap] = useState(false);
  const [soapNotesGenerated, setSoapNotesGenerated] = useState(false);
  // Lazy-render cache for Executive tab
  const [execHtml, setExecHtml] = useState<string>("");
  const [isRenderingExec, setIsRenderingExec] = useState(false);
  const [minutesHtml, setMinutesHtml] = useState<string>("");
  const [isRenderingMinutes, setIsRenderingMinutes] = useState(false);
  const [transcript, setTranscript] = useState("");

  // Cache helpers for Standard minutes HTML across navigations
  const minutesHash = (s: string) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return (h >>> 0).toString(16);
  };
  // Bump version to invalidate old cached HTML when renderer changes
  const getMinutesCacheKey = (id: string, content: string) => `minutes-html-v2-${id}-${minutesHash(content)}`;
  const [fontSizeStyle1, setFontSizeStyle1] = useState(13); // Font size for Minutes (default 13)
  const [backupTranscript, setBackupTranscript] = useState(""); // Assembly AI backup transcript
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [transcriptLoaded, setTranscriptLoaded] = useState(false); // Track if transcript has been loaded
  const [transcriptSize, setTranscriptSize] = useState(0); // Track transcript size in bytes
  const [isLargeTranscript, setIsLargeTranscript] = useState(false); // Track if transcript is large (>30KB)
  const [isLoadingBackupTranscript, setIsLoadingBackupTranscript] = useState(false);
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(true); // Transcript card expanded by default
  const [isFormattingParagraphs, setIsFormattingParagraphs] = useState(false);
  const [editingContent, setEditingContent] = useState(""); // Clean content for editing
  const [editingTab, setEditingTab] = useState<string>(""); // Track which tab is being edited
  const [enhancementDialogOpen, setEnhancementDialogOpen] = useState(false);
  const [showContextDialog, setShowContextDialog] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailModalContent, setEmailModalContent] = useState({ subject: '', body: '', toEmail: '' });
  const [standardEmailModalOpen, setStandardEmailModalOpen] = useState(false);
  const [standardEmailContent, setStandardEmailContent] = useState({ meetingId: '', meetingTitle: '', meetingNotes: '' });
  
  // Version history for undo functionality
  const [notesVersions, setNotesVersions] = useState<ContentVersion[]>([]);
  const [transcriptVersions, setTranscriptVersions] = useState<ContentVersion[]>([]);
  
  // Undo stack for inline corrections
  interface UndoState {
    style3: string;
    style4: string;
    timestamp: number;
  }
  const [undoStack, setUndoStack] = useState<UndoState[]>([]);
  
  // Search functionality for transcript
  const [searchTerm, setSearchTerm] = useState("");
  
  // Reset note styles when meeting changes to prevent showing stale data
  useEffect(() => {
    if (!isOpen || !meeting?.id) return;

    // Clear all note styles and rendered HTML when switching meetings
    console.log('🔄 Meeting changed - clearing note styles for:', meeting.id);
    setNoteStylesLoaded(false);
    setNotesStyle3("");
    setMinutesHtml("");
    setIsRenderingMinutes(false); // Reset rendering state
  }, [isOpen, meeting?.id]);

  // State to allow user override of long meeting plain text view
  const [forceFancyView, setForceFancyView] = useState(false);
  
  // Notes view mode: Default to 'formatted' for rich presentation
  // User can opt into 'plain' view by clicking the toggle if needed
  const [notesViewMode, setNotesViewMode] = useState<'plain' | 'formatted'>('formatted');

  // Reset overrides when meeting changes - start with formatted view by default
  useEffect(() => {
    setForceFancyView(false);
    setNotesViewMode('formatted'); // Start with formatted view by default
  }, [meeting?.id]);

  // Determine if this is a long meeting (75+ minutes) to skip expensive rendering
  const isLongMeetingRaw = React.useMemo(() => {
    if (!meeting) return false;

    // Prefer stored duration if available
    if (typeof meeting.duration_minutes === "number") {
      return meeting.duration_minutes >= 75;
    }

    // Fallback: compute from start_time / end_time if possible
    if (meeting.start_time && meeting.end_time) {
      const start = new Date(meeting.start_time).getTime();
      const end = new Date(meeting.end_time).getTime();
      if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
        const diffMinutes = (end - start) / (1000 * 60);
        return diffMinutes >= 75;
      }
    }

    return false;
  }, [meeting?.id, meeting?.duration_minutes, meeting?.start_time, meeting?.end_time]);

  // User can override the long meeting check to see fancy view
  const isLongMeeting = isLongMeetingRaw && !forceFancyView;

  // Web Worker-based formatting for long meetings
  const {
    formattedHtml: workerFormattedHtml,
    isFormatting: isWorkerFormatting,
    plainTextPreview,
    error: workerError,
    formatNow: triggerWorkerFormat
  } = useMinutesFormatter({
    meetingId: meeting?.id,
    content: notesStyle3 || '',
    baseFontSize: fontSizeStyle1,
    enabled: forceFancyView && isLongMeetingRaw, // Only format when user clicks "Switch to formatted view"
    previewEnabled: false
  });

  // Log for debugging
  useEffect(() => {
    if (meeting) {
      console.log("⏱ isLongMeeting:", isLongMeeting, "duration_minutes:", meeting.duration_minutes);
    }
  }, [isLongMeeting, meeting?.duration_minutes, meeting?.id]);

  const renderedMinutesHtml = useMemo(() => {
    if (activeNotesStyleTab !== 'style1') return '';
    if (selectedFormatVariation === 'standard') return minutesHtml || '';

    const variationSource = formatVariationContent || notesStyle3;

    switch (selectedFormatVariation) {
      case 'no_actions':
        return renderMinutesNoActions(variationSource, fontSizeStyle1);
      case 'black_white':
        return renderMinutesBlackWhite(variationSource, fontSizeStyle1);
      case 'concise':
        return renderMinutesConcise(variationSource, fontSizeStyle1);
      case 'detailed':
        return renderMinutesDetailed(variationSource, fontSizeStyle1);
      case 'executive_brief':
        return renderMinutesExecutiveBrief(variationSource, fontSizeStyle1);
      default:
        return minutesHtml || '';
    }
  }, [
    activeNotesStyleTab,
    selectedFormatVariation,
    formatVariationContent,
    notesStyle3,
    fontSizeStyle1,
    minutesHtml,
  ]);

  // Generate Minutes (Standard) HTML lazily - ONLY when user explicitly selects formatted view
  // This prevents expensive main-thread rendering from blocking the UI
  useEffect(() => {
    // CRITICAL: Only run expensive rendering when user explicitly chooses formatted view
    // Default plain view shows instantly without any processing
    if (notesViewMode !== 'formatted') {
      // Clear any pending renders when in plain mode
      setIsRenderingMinutes(false);
      return;
    }

    if (activeNotesStyleTab !== 'style1') {
      return;
    }

    // Skip expensive rendering while regeneration is in progress
    if (isGeneratingStyle3) {
      return;
    }

    // Don't render minutes until note styles are loaded to prevent using stale data
    if (!noteStylesLoaded) {
      setMinutesHtml("");
      setIsRenderingMinutes(false);
      return;
    }

    if (!notesStyle3?.trim()) {
      setMinutesHtml("");
      setIsRenderingMinutes(false);
      return;
    }

    // Primary rule: Skip expensive rendering for long meetings (75+ minutes)
    // Use isLongMeetingRaw (not isLongMeeting) so this always skips for 75+ min meetings,
    // even when forceFancyView is true - the Web Worker handles formatted view instead
    if (isLongMeetingRaw) {
      console.log("⏱ Long meeting detected – skipping synchronous formatter (Web Worker handles formatted view)");
      setMinutesHtml("");
      setIsRenderingMinutes(false);
      return;
    }

    // Secondary safeguard: Skip expensive rendering for very long notes
    if (notesStyle3.length > MAX_MINUTES_RENDER_LENGTH) {
      console.warn(`⚠️ Note length (${notesStyle3.length}) exceeds limit (${MAX_MINUTES_RENDER_LENGTH}), using basic rendering`);
      setMinutesHtml(notesStyle3);
      setIsRenderingMinutes(false);
      return;
    }

    // Try cached HTML to avoid re-formatting delays on navigation - include font size in cache key
    const key = meeting?.id ? `${getMinutesCacheKey(meeting.id, notesStyle3)}_fs${fontSizeStyle1}` : null;
    if (key) {
      const cached = localStorage.getItem(key);
      if (cached) {
        setMinutesHtml(cached);
        setIsRenderingMinutes(false);
        return; // skip rendering
      }
    }

    // User explicitly requested formatted view - proceed with rendering
    console.log('🎨 User requested formatted view, starting render...');
    setIsRenderingMinutes(true);
    
    // Add a safety timeout to prevent infinite hang
    const safetyTimeout = setTimeout(() => {
      console.warn('⚠️ Minutes rendering timed out after 5s, using plain markdown');
      setMinutesHtml(notesStyle3);
      setIsRenderingMinutes(false);
    }, 5000);

    const id = _ric(() => {
      clearTimeout(safetyTimeout);
      try {
        console.log('🎨 Rendering minutes for meeting:', meeting?.id, 'length:', notesStyle3.length);
        const html = renderMinutesMarkdown(notesStyle3, fontSizeStyle1);
        setMinutesHtml(html);
        if (key) localStorage.setItem(key, html);
        console.log('✅ Minutes rendered successfully');
      } catch (e) {
        console.error('❌ Critical error rendering Standard minutes:', e);
        // Fallback to plain markdown if rendering fails
        const fallbackHtml = `<div class="p-4 bg-yellow-50 border border-yellow-200 rounded mb-4">
          <p class="text-yellow-800 text-sm">⚠️ Unable to render formatted minutes. Displaying plain content.</p>
        </div>
        <div class="whitespace-pre-wrap">${notesStyle3}</div>`;
        setMinutesHtml(fallbackHtml);
        if (key) localStorage.setItem(key, fallbackHtml);
        toast.error('Formatting error - displaying plain notes');
      } finally {
        setIsRenderingMinutes(false);
      }
    }, { timeout: 500 }); // Longer timeout for heavy rendering
    
    return () => {
      clearTimeout(safetyTimeout);
      _cic(id);
    };
  }, [activeNotesStyleTab, notesStyle3, meeting?.id, fontSizeStyle1, noteStylesLoaded, isLongMeetingRaw, isGeneratingStyle3, notesViewMode]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [highlightedTranscript, setHighlightedTranscript] = useState("");

   // Load persisted font size for this meeting
   useEffect(() => {
     if (meeting?.id) {
       const savedFontSize = localStorage.getItem(`meeting-font-size-${meeting.id}`);
       if (savedFontSize) {
         const parsedSize = parseInt(savedFontSize, 10);
         if (!isNaN(parsedSize) && parsedSize >= 8 && parsedSize <= 32) {
           setFontSizeStyle1(parsedSize);
         }
       } else {
         setFontSizeStyle1(13); // Reset to default if no saved size
       }
     }
   }, [meeting?.id]);

   // Save font size when changed
   useEffect(() => {
     if (meeting?.id && fontSizeStyle1 !== 13) {
       localStorage.setItem(`meeting-font-size-${meeting.id}`, fontSizeStyle1.toString());
     }
   }, [fontSizeStyle1, meeting?.id]);

   // Fetch transcript when modal opens with enhanced validation
   useEffect(() => {
     console.log('🔍 FullPageNotesModal useEffect - isOpen:', isOpen, 'meeting?.id:', meeting?.id, 'meeting?.title:', meeting?.title);
     
      // Enhanced validation - only validate meeting, don't auto-fetch transcript
      if (isOpen && meeting?.id) {
        // Validate meeting ID format
        if (typeof meeting.id !== 'string' || meeting.id.length !== 36) {
          console.error('❌ Invalid meeting ID format:', meeting.id);
          onClose();
          return;
        }
        
        // Validate meeting belongs to current user
        if (!user?.id) {
          console.error('❌ No authenticated user');
          onClose();
          return;
        }
        
        console.log('✅ Meeting validation passed for:', meeting.title, 'ID:', meeting.id);
        console.log('📝 Transcript will be loaded on-demand when transcript tab is opened');
        
        // Reset transcript loaded state when modal opens with new meeting
        setTranscriptLoaded(false);
        setTranscript('');
        
        // Don't auto-fetch transcript - it will be loaded when user clicks transcript tab
        // This prevents UI freeze on modal open for large transcripts
      }
   }, [isOpen, meeting?.id, meeting?.title, user?.id]);


   const fetchTranscriptData = async (): Promise<string> => {
     if (!meeting?.id) {
       console.error('❌ fetchTranscriptData called without meeting ID');
       return '';
     }
     
     // Additional validation before database calls
     if (typeof meeting.id !== 'string' || meeting.id.length !== 36) {
       console.error('❌ Invalid meeting ID format in fetchTranscriptData:', meeting.id);
       return '';
     }
     
     const currentMeetingId = meeting.id;
     console.log('🔍 Starting fetchTranscriptData for meeting:', currentMeetingId, 'title:', meeting.title);
     
     setIsLoadingTranscript(true);
       try {
         // Fetch meeting metadata and check for manually edited transcript
         const { data: manualData, error: manualError } = await supabase
           .from('meetings')
           .select('live_transcript_text, assembly_ai_transcript, meeting_context')
           .eq('id', currentMeetingId)
           .eq('user_id', user!.id)
           .maybeSingle();
 
         // Always load backup transcript if available
         if (manualData?.assembly_ai_transcript) {
           setBackupTranscript(manualData.assembly_ai_transcript);
           console.log('✅ Loaded Assembly AI backup transcript:', manualData.assembly_ai_transcript.length, 'chars');
         }
         
         // Check if we have a manually saved/edited transcript (with context or edits)
         // Prefer this over the chunks since it represents the user's customized version
         if (
           manualData?.live_transcript_text &&
           manualData.live_transcript_text.trim().length > 0
         ) {
           console.log('✅ Using saved transcript with context/edits from meetings.live_transcript_text');
           if (meeting?.id === currentMeetingId) {
             setTranscript(manualData.live_transcript_text);
             setTranscriptSize(manualData.live_transcript_text.length);
             setIsLargeTranscript(manualData.live_transcript_text.length > 30000);
             setIsLoadingTranscript(false);
             setTranscriptLoaded(true);
           }
           return manualData.live_transcript_text;
         }
         
         // Otherwise, fetch the full processed transcript from chunks
         console.log('📋 No saved transcript found, fetching from chunks...');
         const { data: transcriptData, error: transcriptError } = await supabase.rpc('get_meeting_full_transcript', {
           p_meeting_id: currentMeetingId
         });
          
          // Validate we're still showing the same meeting (prevent race conditions)
          if (meeting?.id !== currentMeetingId) {
            console.warn('⚠️ Meeting ID changed during fetch, discarding results');
            return;
          }
          
           if (transcriptError) {
             console.error('❌ Error fetching transcript for meeting', currentMeetingId, ':', transcriptError);
             // Check for specific database errors
             if (transcriptError.message?.includes('structure of query does not match')) {
               console.error('⚠️ Database function schema mismatch detected');
               toast.error('Transcript fetch error - please try again');
             }
           } else if (transcriptData && Array.isArray(transcriptData) && transcriptData.length > 0) {
             // Check if RPC returned an error response
             const firstResult = transcriptData[0];
             if (firstResult?.source === 'error') {
               console.error('❌ RPC returned error:', firstResult);
               toast.error('Error loading transcript');
               return;
             }
             
             console.log('✅ Transcript fetched for meeting', currentMeetingId, ':', transcriptData.length, 'segments');
            
           // Calculate size using cheaper method (sum of segment lengths instead of JSON.stringify)
             const rawSize = transcriptData.reduce((acc: number, seg: any) => acc + (seg.transcript?.length || 0), 0);
             console.log('📊 Transcript size (estimated):', (rawSize / 1024).toFixed(2), 'KB');
             setTranscriptSize(rawSize);
             
             // If transcript is very large (>30KB), set flag for pagination
             if (rawSize > 30000) {
               console.warn('⚠️ Large transcript detected, will use pagination');
               setIsLargeTranscript(true);
             } else {
               setIsLargeTranscript(false);
             }
            
             // Combine segments immediately for fast display
             const allSegments = transcriptData
               .map((segment: any) => segment.transcript)
               .join(' ');
             
             // Set raw transcript immediately so UI is responsive
             if (meeting?.id === currentMeetingId) {
               setTranscript(allSegments);
               setTranscriptLoaded(true);
               setIsLoadingTranscript(false);
             }
             
             // Defer heavy processing to idle callback for better responsiveness
             _ric(async () => {
               try {
                 const { normaliseTranscript } = await import('@/lib/transcriptNormaliser');
                 
                 console.log('📝 Raw transcript preview:', allSegments.substring(0, 200));
                 
                 // Normalise the combined transcript
                 const normalised = normaliseTranscript(allSegments);
                 console.log(`📝 Transcript normalised using ${normalised.used} approach`);
                 
                 // Add natural paragraph breaks to plain text for better readability
                 const formatWithParagraphs = (text: string): string => {
                   const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
                   const paragraphs: string[] = [];
                   let currentParagraph: string[] = [];
                   
                   sentences.forEach((sentence, idx) => {
                     currentParagraph.push(sentence);
                     const shouldBreak = 
                       currentParagraph.length >= 4 || 
                       (currentParagraph.length >= 2 && (
                         sentence.includes('?') || 
                         sentence.length > 200 ||
                         idx === sentences.length - 1
                       ));
                     
                     if (shouldBreak) {
                       paragraphs.push(currentParagraph.join(' '));
                       currentParagraph = [];
                     }
                   });
                   
                   if (currentParagraph.length > 0) {
                     paragraphs.push(currentParagraph.join(' '));
                   }
                   
                   return paragraphs.join('\n\n');
                 };
                 
                 const formattedPlain = formatWithParagraphs(normalised.plain);
            
                 // Final validation before setting enhanced state
                 if (meeting?.id === currentMeetingId) {
                   const contextData = (manualData as any)?.meeting_context as any;
                   let contextPrefix = '';
                   try {
                     if (contextData && !/=== MEETING CONTEXT ===/i.test(normalised.plain)) {
                       const ctxParts: string[] = ['=== MEETING CONTEXT ==='];
                       if (contextData.attendees) ctxParts.push(`ATTENDEES:\n${contextData.attendees}`);
                       if (contextData.agenda) ctxParts.push(`AGENDA:\n${contextData.agenda}`);
                       if (contextData.additional_notes) ctxParts.push(`NOTES:\n${contextData.additional_notes}`);
                       if (Array.isArray(contextData.uploaded_files) && contextData.uploaded_files.length) {
                         ctxParts.push('UPLOADED DOCUMENTS:');
                         contextData.uploaded_files.forEach((f: any, i: number) => {
                           if (f?.content) ctxParts.push(`- Document ${i + 1}:\n${f.content}`);
                         });
                       }
                       ctxParts.push('=== TRANSCRIPT ===');
                       contextPrefix = ctxParts.join('\n\n') + '\n\n';
                       console.log('ℹ️ Prepending meeting context to transcript display');
                     }
                   } catch (e) {
                     console.warn('⚠️ Failed to build meeting context prefix:', e);
                   }

                   const preferPlain = isLargeTranscript || rawSize > 30000;
                   const preferred = preferPlain ? formattedPlain : normalised.html;
                   const finalTranscript = contextPrefix
                     ? (preferPlain ? contextPrefix + formattedPlain : contextPrefix + normalised.html)
                     : preferred;
                   
                   // Update with enhanced formatted version
                   setTranscript(finalTranscript);
                   console.log('✅ Transcript enhanced with formatting');
                 }
               } catch (e) {
                 console.warn('⚠️ Deferred transcript formatting failed:', e);
               }
             }, { timeout: 2000 });
             
             return allSegments;
          } else {
             console.log('📝 No transcript data found for meeting:', currentMeetingId);
             setTranscript('');
             setTranscriptSize(0);
             setIsLargeTranscript(false);
             setTranscriptLoaded(true);
             setIsLoadingTranscript(false);
             return '';
           }
         
      } catch (error) {
        console.error('Error fetching transcript data for meeting', currentMeetingId, ':', error);
        return '';
       } finally {
         // Only update loading state if we're still on the same meeting
         if (meeting?.id === currentMeetingId) {
           setIsLoadingTranscript(false);
           setTranscriptLoaded(true);
         }
       }
    };

   const loadExistingNoteStyles = async () => {
     if (!meeting?.id) {
       console.error('❌ loadExistingNoteStyles called without meeting ID');
       return;
     }

     // Validate meeting ID and user access before loading
     if (typeof meeting.id !== 'string' || meeting.id.length !== 36 || !user?.id) {
       console.error('❌ Invalid meeting ID or user in loadExistingNoteStyles');
       return;
     }

     const currentMeetingId = meeting.id;
     console.log('🔍 Loading existing note styles for meeting:', currentMeetingId);

     // OPTIMISATION: Use note styles already in meeting object if available (from handleViewMeetingSummary)
     // This avoids redundant DB calls for data we already have
     const hasPreloadedStyles = meeting.notes_style_3;

     try {
       const { data: metaRow, error: metaError } = await supabase
         .from('meeting_summaries')
         .select('generation_metadata')
         .eq('meeting_id', currentMeetingId)
         .order('updated_at', { ascending: false })
         .maybeSingle();

       if (metaError) {
         console.error('❌ Error loading generation metadata:', metaError);
       } else {
         console.log('🧾 FullPage generation metadata:', {
           meetingId: currentMeetingId,
           hasPreloadedStyles: !!hasPreloadedStyles,
           generation_metadata: metaRow?.generation_metadata ?? null,
         });

          if (metaRow?.generation_metadata) {
            setGenerationMetadata(metaRow.generation_metadata as any);
          }

          // Fetch consolidation timing from meetings.merge_decision_log
          const { data: mergeLogRow } = await supabase
            .from('meetings')
            .select('merge_decision_log')
            .eq('id', currentMeetingId)
            .maybeSingle();
          if (mergeLogRow?.merge_decision_log) {
            const log = mergeLogRow.merge_decision_log as any;
            if (log?.timing) {
              setConsolidationTiming(log.timing);
            }
          }
        }

       if (hasPreloadedStyles) {
         console.log('✅ Using preloaded note styles from meeting object');
         if (meeting.notes_style_3) setNotesStyle3(meeting.notes_style_3);
         setNoteStylesLoaded(true);
         return;
       }

       // Run queries in parallel for faster loading - skip access check for speed (RLS handles security)
       const [meetingDataResult, multiNotesResult] = await Promise.all([
         supabase
           .from('meetings')
           .select('notes_style_2, notes_style_3, notes_style_4, notes_style_5')
           .eq('id', currentMeetingId)
           .maybeSingle(),
         supabase
           .from('meeting_notes_multi')
           .select('note_type, content')
           .eq('meeting_id', currentMeetingId)
           .in('note_type', ['executive'])
           .order('generated_at', { ascending: false })
           .limit(1)
       ]);

       const { data: meetingData, error } = meetingDataResult;
       const { data: multiNotesData } = multiNotesResult;

       if (error) {
         console.error('❌ Error loading note styles:', error);
         return;
       }

       // Validate we're still on the same meeting before updating state
       if (meeting?.id !== currentMeetingId) {
         console.warn('⚠️ Meeting changed during note styles loading, discarding results');
         return;
       }

       if (meetingData) {
         if (meetingData.notes_style_3) {
           setNotesStyle3(meetingData.notes_style_3);
         }
         // Mark note styles as loaded after applying data
         setNoteStylesLoaded(true);
       }

          // Fallback: if Standard notes not stored on meetings table yet, pull latest from meeting_summaries
          if (!meetingData?.notes_style_3) {
            const { data: summaryRow, error: summaryErr } = await supabase
              .from('meeting_summaries')
              .select('summary')
              .eq('meeting_id', currentMeetingId)
              .order('updated_at', { ascending: false })
              .maybeSingle();

            if (!summaryErr && summaryRow?.summary) {
              setNotesStyle3(summaryRow.summary);
              void saveNoteStyleToDatabase(3, summaryRow.summary);
              console.log('✅ Loaded Standard notes from meeting_summaries fallback');
              setNoteStylesLoaded(true);
            }
          }

        console.log('✅ Loaded existing note styles for meeting:', currentMeetingId);
        setNoteStylesLoaded(true);
     } catch (error) {
       console.error('Error loading note styles:', error);
     }
   };

  // Call loadExistingNoteStyles when modal opens and meeting data is available
  // OPTIMISATION: Skip if meeting is still loading (from handleViewMeetingSummary)
  useEffect(() => {
    if (isOpen && meeting?.id && user?.id && !meeting._isLoading) {
      loadExistingNoteStyles();
      loadExistingSoapNotes();
    }
  }, [isOpen, meeting?.id, user?.id, meeting?._isLoading]);

  // Real-time subscription to refresh notes when action items are synced
  useEffect(() => {
    if (!isOpen || !meeting?.id) return;

    const currentMeetingId = meeting.id;
    console.log('🔔 Setting up real-time notes subscription for meeting:', currentMeetingId);

    const channel = supabase
      .channel(`notes-sync-${currentMeetingId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meetings',
          filter: `id=eq.${currentMeetingId}`,
        },
        (payload) => {
          console.log('🔔 Meeting notes updated via realtime:', payload);
          const newRecord = payload.new as any;
          // Update notesStyle3 if it changed (e.g., action items synced)
          if (newRecord?.notes_style_3 && newRecord.notes_style_3 !== notesStyle3) {
            console.log('📝 Refreshing Standard notes from realtime update');
            setNotesStyle3(newRecord.notes_style_3);
            // Clear cached HTML to force re-render
            setMinutesHtml('');
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 Cleaning up notes real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [isOpen, meeting?.id]);

  // Listen for custom 'meeting-notes-updated' event from Action Items sync
  // This provides deterministic UI refresh without relying on realtime
  useEffect(() => {
    if (!isOpen || !meeting?.id) return;

    const handleNotesUpdated = (event: CustomEvent<{ meetingId: string; notesStyle3?: string | null }>) => {
      if (event.detail.meetingId === meeting.id) {
        console.log('📝 Received meeting-notes-updated event, refreshing notes');
        if (event.detail.notesStyle3) {
          setNotesStyle3(event.detail.notesStyle3);
          setMinutesHtml(''); // Clear cached HTML to force re-render
        } else {
          // Refetch from DB if no content in event
          supabase
            .from('meetings')
            .select('notes_style_3')
            .eq('id', meeting.id)
            .single()
            .then(({ data }) => {
              if (data?.notes_style_3) {
                setNotesStyle3(data.notes_style_3);
                setMinutesHtml('');
              }
            });
        }
      }
    };

    window.addEventListener('meeting-notes-updated', handleNotesUpdated as EventListener);

    return () => {
      window.removeEventListener('meeting-notes-updated', handleNotesUpdated as EventListener);
    };
  }, [isOpen, meeting?.id]);

  // Load existing SOAP notes from database
  const loadExistingSoapNotes = async () => {
    if (!meeting?.id || !user?.id) return;
    
    const currentMeetingId = meeting.id;
    console.log('🩺 Loading existing SOAP notes for meeting:', currentMeetingId);

    try {
      const { data: meetingData, error } = await supabase
        .from('meetings')
        .select('soap_notes')
        .eq('id', currentMeetingId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('❌ Error loading SOAP notes:', error);
        return;
      }

      if (meeting?.id !== currentMeetingId) {
        console.warn('⚠️ Meeting changed during SOAP notes loading');
        return;
      }

      if (meetingData?.soap_notes) {
        setSoapNotes(meetingData.soap_notes as any);
        setSoapNotesGenerated(true);
        console.log('✅ Loaded existing SOAP notes');
      } else {
        setSoapNotes(null);
        setSoapNotesGenerated(false);
      }
    } catch (error) {
      console.error('Error loading SOAP notes:', error);
    }
  };

   // Save note style to database with enhanced validation
   const saveNoteStyleToDatabase = async (styleNumber: number, content: string) => {
     if (!meeting?.id || !user?.id || !content.trim()) {
       console.error('❌ Invalid parameters for saveNoteStyleToDatabase');
       return;
     }

      // Validate meeting ID format and user access
      if (typeof meeting.id !== 'string' || meeting.id.length !== 36) {
        console.error('❌ Invalid meeting ID format in saveNoteStyleToDatabase');
        return;
      }

     const currentMeetingId = meeting.id;
     console.log('💾 Saving note style', styleNumber, 'for meeting:', currentMeetingId);

     try {
       // Verify user still has access to this meeting
       const { data: accessCheck } = await supabase.rpc('validate_meeting_access', {
         p_meeting_id: currentMeetingId,
         p_user_id: user.id
       });

        if (!accessCheck) {
          console.error('❌ User lost access to meeting during save:', currentMeetingId);
          return;
        }

       const columnName = `notes_style_${styleNumber}`;
       let updateError: any = null;
       const { error } = await supabase
         .from('meetings')
          .update({ [columnName]: content } as any)
          .eq('id', currentMeetingId);

        updateError = error;

       if (updateError) {
         console.warn(`⚠️ Direct update failed for notes style ${styleNumber}, attempting server-side persist...`, updateError);
         try {
           const { data: persistData, error: persistError } = await supabase.functions.invoke('persist-standard-minutes', {
             body: { meetingId: currentMeetingId, content }
           });
           if (persistError || persistData?.success === false) {
             console.error(`❌ Persist via edge function failed for style ${styleNumber}:`, persistError || persistData);
           } else {
             console.log(`✅ Persisted notes style ${styleNumber} via edge function`);
             updateError = null;
           }
         } catch (fnErr) {
           console.error('❌ Error invoking persist-standard-minutes:', fnErr);
         }
       }

       if (updateError) {
         console.error(`❌ Error saving notes style ${styleNumber} for meeting ${currentMeetingId}:`, updateError);
       } else {
         console.log(`✅ Meeting Notes Style ${styleNumber} saved to database for meeting ${currentMeetingId}`);
       }

       // Validate we're still on the same meeting after save
       if (meeting?.id !== currentMeetingId) {
         console.warn('⚠️ Meeting changed during save operation');
         return;
       }

        if (error) {
          console.error(`❌ Error saving notes style ${styleNumber} for meeting ${currentMeetingId}:`, error);
        } else {
          console.log(`✅ Meeting Notes Style ${styleNumber} saved to database for meeting ${currentMeetingId}`);
        }
      } catch (error) {
        console.error(`Error saving notes style ${styleNumber} for meeting ${currentMeetingId}:`, error);
      }
   };

  // Create a mock meeting data object for the export hook
  const mockMeetingData = meeting ? {
    id: meeting.id,
    title: meeting.title,
    duration: '00:00',
    wordCount: notes.split(' ').length,
    transcript: '',
    speakerCount: 1,
    startTime: meeting.start_time || meeting.created_at,
    practiceName: '',
    practiceId: '',
    meetingFormat: '',
    generatedNotes: notes,
    startedBy: ''
  } : null;

  const mockMeetingSettings = {
    title: meeting?.title || '',
    description: '',
    meetingType: 'general',
    meetingStyle: 'standard',
    attendees: '',
    agenda: '',
    date: '',
    startTime: '',
    format: '' as const,
    location: ''
  };

  // Extract attendees from content (robust to multiple formats)
  const extractAttendees = (content: string): string => {
    const cleanupItems = (items: string[]) => {
      const cleaned = items
        .map((l) => l.trim())
        .filter((l) => l && !/^---.*---$/i.test(l) && !/^[-_]{2,}$/.test(l))
        .map((l) => l.replace(/^[-•*]\s*/, '')) // bullets
        .map((l) => l.replace(/^\d+[)\.]\s*/, '')) // numbered
        .map((l) => l.replace(/\b(Unverified|Unconfirmed)\b/gi, '').replace(/\(\s*Unverified\s*\)/gi, '').trim())
        .filter((l) => l.length > 0);

      // de-duplicate while preserving order
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const it of cleaned) {
        const key = it.toLowerCase();
        if (!seen.has(key)) { seen.add(key); unique.push(it); }
      }
      return unique;
    };

    // 1) Single-line label (e.g., "Attendees: A, B; C")
    const singleLine = content.match(/^\s*(Attendee(?:s|\(s\))?|Attendees|Participants|Present|In attendance|Attendance)\s*:\s*(.+)$/im);
    if (singleLine) {
      const raw = singleLine[2];
      const items = raw.split(/\s*(?:,|;|•| and )\s*/i).filter(Boolean);
      return cleanupItems(items).join(', ');
    }

    // 2) Section header then list
    const headerRegex = /^\s*(ATTENDEE LIST|Attendee(?:s|\(s\))?|Attendees?|Participants|Attendance|In attendance|Present)\s*(?:List)?\s*:??\s*$/im;
    const headerMatch = headerRegex.exec(content);
    if (headerMatch) {
      const start = headerMatch.index + headerMatch[0].length;
      const tail = content.slice(start);
      // Stop at next heading, markdown header, or divider/image marker
      const boundaryRegex = /^(?:\s*(?:#|##)\s+.+|[A-Z][A-Z\s&\/-]{2,}:?\s*$|---.*---\s*$)/m;
      const boundary = boundaryRegex.exec(tail);
      const section = boundary ? tail.slice(0, boundary.index) : tail;

      const lines = section.split('\n');
      const items = cleanupItems(lines);
      if (items.length) return items.join(', ');
    }

    return '';
  };
  // Advanced Word export aligned with NHS-styled exporter (card view)
  const generateAdvancedWordDocument = async (content: string, title: string) => {
    try {
      console.log('🔍 Generating NHS-styled Word document...');
      const { generateMeetingNotesDocx } = await import('@/utils/generateMeetingNotesDocx');

      // Prefer the explicit Meeting Title from the content if present
      const titleMatch = content.match(/^\s*[-•*]?\s*\**\s*Meeting Title\s*:\s*(.+)$/im);
      const extracted = titleMatch ? titleMatch[1] : title;
      const cleanTitle = extracted.replace(/\*\*/g, '').replace(/\*/g, '').trim() || 'Meeting Notes';

      // Extract attendees from content
      const extractedAttendees = extractAttendees(content);
      console.log('🧑‍🤝‍🧑 Extracted attendees for DOCX:', extractedAttendees);

      const dateStr = new Date().toLocaleDateString('en-GB');
      const filename = `${cleanTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${dateStr.replace(/\//g, '-')}.docx`;

      // Get logged-in user's name to replace Facilitator/Unidentified
      const loggedUserName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';

      // Fetch ALL action items from database (any status) to render as a structured Word table.
      let actionItemsForExport: Array<{
        action_text: string;
        assignee_name?: string | null;
        due_date?: string | null;
        status?: string | null;
      }> = [];
      if (meeting?.id) {
        const { data: actionItemsData } = await supabase
          .from('meeting_action_items')
          .select('action_text, assignee_name, due_date, status, sort_order')
          .eq('meeting_id', meeting.id)
          .order('sort_order', { ascending: true });

        if (actionItemsData) {
          actionItemsForExport = actionItemsData.map((item: any) => ({
            action_text: item.action_text,
            assignee_name: item.assignee_name,
            due_date: item.due_date,
            status: item.status,
          }));
        }
      }

      await generateMeetingNotesDocx({
        metadata: {
          title: cleanTitle,
          attendees: extractedAttendees,
          loggedUserName: loggedUserName,
        },
        content,
        filename,
        actionItems: actionItemsForExport,
      });
    } catch (error) {
      console.error('Word generation error:', error);
    }
  };

  const generatePDF = (content: string, title: string) => {
    try {
      console.log('🔍 Generating clean PDF document...');
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - (2 * margin);
      let currentY = 30;
      
      // Clean the content similar to Word processing
      let cleanText = content
        // Convert HTML breaks to newlines first
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<p[^>]*>/gi, '')
        // Remove all other HTML tags
        .replace(/<[^>]*>/g, '')
        // Decode HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        // Clean up excessive whitespace but preserve structure
        .replace(/[ \t]+/g, ' ')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
      
      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(title, pageWidth / 2, currentY, { align: 'center' });
      currentY += 15;
      
      // Date
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth / 2, currentY, { align: 'center' });
      currentY += 20;
      
      // Process content line by line
      const lines = cleanText.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines but add spacing
        if (!line) {
          currentY += 6;
          continue;
        }
        
        // Check if we need a new page
        if (currentY > pageHeight - 30) {
          doc.addPage();
          currentY = 30;
        }
        
        // Detect different types of content
        const isEmojiHeader = /^[1-9]️⃣/.test(line);
        const isNumberedSection = /^##?\s*\d+\.?\s/.test(line);
        const isMainHeader = /^#\s/.test(line) || (line.includes('MEETING') && line.length < 100);
        const isBulletPoint = /^[-•*]\s/.test(line);
        const isHeader = isEmojiHeader || isNumberedSection || isMainHeader;
        
        // Clean and format the text
        let displayText = line;
        
        // Remove ALL hash symbols and markdown formatting
        displayText = displayText.replace(/^#+\s*/, ''); // Remove any number of # at start
        displayText = displayText.replace(/\*\*([^*]+)\*\*/g, '$1'); // Remove **bold**
        displayText = displayText.replace(/\*([^*]+)\*/g, '$1'); // Remove *italic*
        
        if (isBulletPoint) {
          // Format bullet points
          const bulletText = displayText.replace(/^[-•*]\s*/, '');
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          
          // Add bullet
          doc.text('•', margin + 10, currentY);
          
          // Add bullet text with wrapping
          const wrappedText = doc.splitTextToSize(bulletText, maxWidth - 20);
          doc.text(wrappedText, margin + 20, currentY);
          currentY += wrappedText.length * 5 + 3;
          
        } else if (isHeader) {
          // Format headers
          currentY += 8; // Extra space before headers
          doc.setFontSize(isMainHeader ? 14 : 12);
          doc.setFont('helvetica', 'bold');
          
          const wrappedHeader = doc.splitTextToSize(displayText, maxWidth);
          doc.text(wrappedHeader, margin, currentY);
          currentY += wrappedHeader.length * 6 + 8;
          
        } else {
          // Regular paragraph
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          
          const wrappedText = doc.splitTextToSize(displayText, maxWidth);
          doc.text(wrappedText, margin, currentY);
          currentY += wrappedText.length * 5 + 6;
        }
      }
      
      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Generated on ${new Date().toLocaleDateString()} - Page ${i} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }
      
      doc.save(`${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toLocaleDateString()}.pdf`);
      console.log('🔍 Clean PDF generation completed!');
      
    } catch (error) {
      console.error('PDF generation error:', error);
    }
  };

  // Search functionality for transcript
  const performSearch = React.useCallback(() => {
    if (!searchTerm || !transcript) {
      setHighlightedTranscript(transcript);
      setTotalMatches(0);
      setCurrentMatchIndex(0);
      return;
    }

    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = [...transcript.matchAll(regex)];
    setTotalMatches(matches.length);
    
    if (matches.length === 0) {
      setHighlightedTranscript(transcript);
      setCurrentMatchIndex(0);
      return;
    }

    let highlighted = transcript;
    let offset = 0;
    
    matches.forEach((match, index) => {
      const start = match.index! + offset;
      const end = start + match[0].length;
      const isCurrentMatch = index === currentMatchIndex;
      
      const replacement = isCurrentMatch 
        ? `<mark style="background-color: #fbbf24; padding: 2px 4px; border-radius: 2px; color: #000; font-weight: bold;">${match[0]}</mark>`
        : `<mark style="background-color: #fef3c7; padding: 2px 4px; border-radius: 2px; color: #000;">${match[0]}</mark>`;
      
      highlighted = highlighted.slice(0, start) + replacement + highlighted.slice(end);
      offset += replacement.length - match[0].length;
    });
    
    setHighlightedTranscript(highlighted);
  }, [searchTerm, transcript, currentMatchIndex]);

  React.useEffect(() => {
    performSearch();
  }, [performSearch]);

  const goToNextMatch = () => {
    if (totalMatches > 0) {
      setCurrentMatchIndex((prev) => (prev + 1) % totalMatches);
    }
  };

  const goToPreviousMatch = () => {
    if (totalMatches > 0) {
      setCurrentMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches);
    }
  };

  // CRITICAL: Clear transcript when meeting changes to prevent data mixing
  React.useEffect(() => {
    if (meeting?.id) {
      console.log('🔍 Meeting changed to:', meeting.id, '- Clearing previous transcript');
      setTranscript(''); // Clear previous transcript immediately
      // Respect the desired initial tab when a meeting is opened
      if (initialTab) {
        setActiveTab(initialTab);
      } else {
        setActiveTab('notes'); // Default to notes tab
      }
      setIsEditing(false); // Exit edit mode
      setEditingContent(''); // Clear editing content
      setEditingTab(''); // Clear editing tab
      // Clear search state
      setSearchTerm('');
      setCurrentMatchIndex(0);
      setTotalMatches(0);
      setHighlightedTranscript('');
      // Clear version history when meeting changes
      clearVersionHistory();
    }
  }, [meeting?.id, initialTab]);

  // Get current content based on active tab and sub-tab
  const getCurrentContent = () => {
    if (activeTab === "notes") {
      // Return content based on the active sub-tab
      switch (activeNotesStyleTab) {
        case 'style1': return notesStyle3 || "";
        default: return notesStyle3 || "";
      }
    } else {
      return transcript || "";
    }
  };

  // Set current content based on active tab and sub-tab
  const setCurrentContent = (content: string) => {
    if (activeTab === "notes") {
      // Save to the correct sub-tab content
      switch (activeNotesStyleTab) {
        case 'style1':
          setNotesStyle3(content);
          saveNoteStyleToDatabase(3, content);
          break;
        default:
          setNotesStyle3(content);
          saveNoteStyleToDatabase(3, content);
      }
    } else {
      setTranscript(content);
      saveTranscriptToDatabase(content);
    }
  };

  // Apply Find & Replace with immediate visual update for Standard view
  const applyFindReplaceUpdate = useCallback((updatedText: string) => {
    if (activeTab === "notes" && activeNotesStyleTab === 'style1' && notesViewMode === 'formatted') {
      // For Standard view in formatted mode, update content and render HTML synchronously
      setNotesStyle3(updatedText);
      saveNoteStyleToDatabase(3, updatedText);
      
      // Synchronously render the new HTML to avoid flicker
      try {
        const html = renderMinutesMarkdown(updatedText, fontSizeStyle1);
        setMinutesHtml(html);
        
        // Update localStorage cache
        if (meeting?.id) {
          const key = `minutes_html_${meeting.id}_${minutesHash(updatedText)}_fs${fontSizeStyle1}`;
          localStorage.setItem(key, html);
        }
      } catch (e) {
        console.error('Error rendering updated minutes:', e);
        // Fallback: the useEffect will handle re-rendering
      }
    } else {
      // For other views, use the standard async update
      setCurrentContent(updatedText);
    }
    
    if (activeTab === "notes") {
      saveSummaryToDatabase(updatedText);
    }
  }, [activeTab, activeNotesStyleTab, notesViewMode, fontSizeStyle1, meeting?.id]);

  // Version history management functions
  const saveCurrentVersion = (actionType: string, contentType: 'notes' | 'transcript' = activeTab as 'notes' | 'transcript') => {
    const currentContent = contentType === 'notes' ? notes : transcript;
    if (!currentContent.trim()) return; // Don't save empty content
    
    const version: ContentVersion = {
      content: currentContent,
      timestamp: Date.now(),
      contentType,
      actionType
    };
    
    if (contentType === 'notes') {
      setNotesVersions(prev => [...prev.slice(-9), version]); // Keep last 10 versions
    } else {
      setTranscriptVersions(prev => [...prev.slice(-9), version]); // Keep last 10 versions
    }
  };

  const handleUndo = () => {
    const versions = activeTab === 'notes' ? notesVersions : transcriptVersions;
    const setVersions = activeTab === 'notes' ? setNotesVersions : setTranscriptVersions;
    
    if (versions.length === 0) {
      return;
    }
    
    // Get the last version
    const lastVersion = versions[versions.length - 1];
    
    // Restore the content
    if (activeTab === 'notes') {
      onNotesChange(lastVersion.content);
      saveSummaryToDatabase(lastVersion.content);
    } else {
      setTranscript(lastVersion.content);
    }
    
    // Remove the restored version from history
    setVersions(prev => prev.slice(0, -1));
  };

  const handleEnhanced = async (enhancedContent: string) => {
    if (!meeting?.id) return;

    try {
      // Determine which notes style to update based on active tab
      let currentContent = '';
      let updateColumn = '';
      let setStateFunction: (content: string) => void = () => {};
      
      switch (activeNotesStyleTab) {
        case 'style1':
          currentContent = notesStyle3;
          updateColumn = 'notes_style_3';
          setStateFunction = setNotesStyle3;
          break;
        default:
          return;
      }

      // Save version before updating
      const version: ContentVersion = {
        content: currentContent,
        timestamp: Date.now(),
        contentType: 'notes',
        actionType: 'AI Enhancement'
      };
      setNotesVersions(prev => [...prev.slice(-9), version]);
      
      // Update the content
      setStateFunction(enhancedContent);
      
      // Save to database
      const { error } = await supabase
        .from('meetings')
        .update({ [updateColumn]: enhancedContent } as any)
        .eq('id', meeting.id);

      if (error) throw error;

    } catch (error) {
      console.error('Error updating notes:', error);
    }
  };

  const clearVersionHistory = (contentType?: 'notes' | 'transcript') => {
    if (!contentType || contentType === 'notes') {
      setNotesVersions([]);
    }
    if (!contentType || contentType === 'transcript') {
      setTranscriptVersions([]);
    }
  };

  const getVersionHistory = () => {
    return activeTab === 'notes' ? notesVersions : transcriptVersions;
  };

  // Keyboard shortcut for undo (Ctrl+Z)
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        const versions = getVersionHistory();
        if (versions.length > 0) {
          handleUndo();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, activeTab, notesVersions, transcriptVersions]);

  // Clean HTML content for editing - match visual display exactly
  const cleanHtmlForEditing = (htmlContent: string) => {
    if (!htmlContent || typeof htmlContent !== 'string') {
      console.log('🔍 CLEAN DEBUG - empty or invalid content:', htmlContent);
      return '';
    }
    
    console.log('🔍 CLEAN DEBUG - input content length:', htmlContent.length);
    console.log('🔍 CLEAN DEBUG - input content preview:', htmlContent.substring(0, 200) + '...');
    
    let cleanText = htmlContent
      // First, convert div spacing patterns that create visual gaps
      .replace(/<div class="mb-3"><\/div>/gi, '\n') // Empty divs = single newline
      .replace(/<div class="mb-4"><\/div>/gi, '\n\n') // Larger spacing divs = double newline
      
      // Handle HTML breaks - preserve visual double spacing
      .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '\n\n') // Double breaks = double newlines
      .replace(/<br\s*\/?>/gi, '\n') // Single breaks = single newlines
      
      // Handle paragraph spacing
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n') // Between paragraphs = double newlines
      .replace(/<\/p>/gi, '\n') // End paragraph = single newline
      .replace(/<p[^>]*>/gi, '') // Remove paragraph starts
      
      // Handle header spacing more accurately
      .replace(/<\/h[1-6]>\s*<div[^>]*>\s*<\/div>\s*/gi, '\n\n') // Header followed by spacing div
      .replace(/<\/h[1-6]>\s*/gi, '\n\n') // Headers always followed by double spacing
      .replace(/<h[1-6][^>]*>/gi, '') // Remove header tags
      
      // Handle div spacing
      .replace(/<\/div>\s*<div[^>]*>/gi, (match) => {
        // Check if this creates visual spacing
        if (match.includes('mb-') || match.includes('mt-')) {
          return '\n\n';
        }
        return '\n';
      })
      .replace(/<\/div>/gi, '\n')
      .replace(/<div[^>]*>/gi, '')
      
      // Remove strong/bold tags but keep content
      .replace(/<\/?strong[^>]*>/gi, '')
      .replace(/<\/?b[^>]*>/gi, '')
      
      // Remove ALL other HTML tags
      .replace(/<[^>]*>/g, '')
      
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      
      // Clean up spacing while preserving structure
      .replace(/[ \t]+/g, ' ') // Multiple spaces/tabs to single space
      .replace(/\n[ \t]+/g, '\n') // Remove spaces at start of lines
      .replace(/[ \t]+\n/g, '\n') // Remove spaces at end of lines
      
      // Normalize multiple newlines but preserve intentional double spacing
      .replace(/\n{4,}/g, '\n\n\n') // Max 3 consecutive newlines
      .replace(/^\n+/, '') // Remove leading newlines
      .replace(/\n+$/, '') // Remove trailing newlines
      .trim();
    
    console.log('🔍 CLEAN DEBUG - output content length:', cleanText.length);
    console.log('🔍 CLEAN DEBUG - output content preview:', cleanText.substring(0, 200) + '...');
    
    return cleanText;
  };

  // Handle edit mode toggle with sub-tab support
  const handleEditToggle = () => {
    if (!isEditing) {
      // Save current version before editing
      saveCurrentVersion('manual-edit', activeTab as 'notes' | 'transcript');
      
      // Entering edit mode - get content for the current active sub-tab
      let currentContent = "";
      let currentTabIdentifier = "";
      
      console.log('🔍 EDIT DEBUG - activeTab:', activeTab, 'activeNotesStyleTab:', activeNotesStyleTab);
      console.log('🔍 EDIT DEBUG - available content:', {
        notes: notes?.length || 0,
        notesStyle3: notesStyle3?.length || 0,
        transcript: transcript?.length || 0
      });
      
      if (activeTab === "notes") {
        // Handle sub-tabs within notes
        switch (activeNotesStyleTab) {
          case 'style1': 
            currentContent = notesStyle3 || "";
            currentTabIdentifier = "notes-style1";
            break;
          case 'style2': 
            currentContent = notes || "";
            currentTabIdentifier = "notes-style2";
            break;
          default:
            currentContent = notes || "";
            currentTabIdentifier = "notes";
        }
      } else {
        currentContent = transcript || "";
        currentTabIdentifier = "transcript";
      }
      
      console.log('🔍 EDIT DEBUG - currentContent before cleaning:', currentContent?.substring(0, 100) + '...');
      
      const cleanContent = cleanHtmlForEditing(currentContent);
      
      console.log('🔍 EDIT DEBUG - cleanContent after cleaning:', cleanContent?.substring(0, 100) + '...');
      console.log('🔍 EDIT DEBUG - cleanContent length:', cleanContent?.length);
      
      setEditingContent(cleanContent);
      setEditingTab(currentTabIdentifier); // Track which specific tab/sub-tab we're editing
      
      console.log('🔍 EDIT DEBUG - entering edit mode with tab:', currentTabIdentifier);
    } else {
      // Exiting edit mode - save the content to the correct location
      console.log('🔍 EDIT DEBUG - saving content, editingTab:', editingTab, 'content length:', editingContent?.length);
      
      if (editingTab.startsWith("notes-")) {
        const subTab = editingTab.replace("notes-", "");
        switch (subTab) {
          case 'style1':
            setNotesStyle3(editingContent);
            saveNoteStyleToDatabase(3, editingContent);
            break;
          case 'style2':
            onNotesChange(editingContent);
            saveSummaryToDatabase(editingContent);
            break;
          default:
            onNotesChange(editingContent);
            saveSummaryToDatabase(editingContent);
        }
      } else if (editingTab === "transcript") {
        setTranscript(editingContent);
        saveTranscriptToDatabase(editingContent);
      } else if (editingTab === "backup-transcript") {
        setBackupTranscript(editingContent);
        // Save backup transcript to database
        if (meeting?.id) {
          supabase
            .from('meetings')
            .update({ assembly_ai_transcript: editingContent })
            .eq('id', meeting.id)
            .eq('user_id', user!.id)
            .then(({ error }) => {
              if (error) console.error('Error saving backup transcript:', error);
            });
        }
      }
      setEditingContent(""); // Clear editing content
      setEditingTab(""); // Clear editing tab
    }
    setIsEditing(!isEditing);
  };


  // Simple transcript cleaning function using string similarity
  const cleanTranscriptDuplicates = (text: string): string => {
    const sentences = text.split(/(?<=[.?!])\s+/);
    const output: string[] = [];

    for (const s of sentences) {
      const trimmed = s.trim();
      if (!trimmed) continue;

      // Compare against last 3 kept sentences for safety
      const recent = output.slice(-3);
      const isDup = recent.some(r =>
        stringSimilarity.compareTwoStrings(trimmed.toLowerCase(), r.toLowerCase()) > 0.92
      );

      if (!isDup) {
        output.push(trimmed);
      }
    }

    return output.join(" ");
  };

  // Handle full audio reprocessing with Whisper
  const handleReprocessAudio = async () => {
    if (!meeting?.id) {
      return;
    }

    // Save current version before reprocessing
    saveCurrentVersion('whisper-reprocess', 'transcript');
    setIsLoadingTranscript(true);
    
    try {
      
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX
      

      const { data, error } = await supabase.functions.invoke('reprocess-meeting-audio', {
        body: { meetingId: meeting.id },
      });

      if (error) {
        console.error('Audio reprocessing error:', error);
        return;
      }

      
      setTranscript(data.transcript);
      
    } catch (error) {
      console.error('Error reprocessing audio:', error);
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  // Handle GPT-based transcript cleaning
  const handleGPTCleanTranscript = async () => {
    if (!transcript || transcript.trim().length === 0) {
      return;
    }

    // Save current version before cleaning
    saveCurrentVersion('gpt-clean-transcript', 'transcript');
    setIsLoadingTranscript(true);
    
    try {
      
      const { data, error } = await supabase.functions.invoke('gpt-clean-transcript', {
        body: { 
          transcript,
          options: {
            finalThreshold: 0.97,
            finalWindow: 15,
            use_llm: false // Deterministic by default, can be enabled if needed
          },
          // practiceId: undefined, // TODO: Add practice_id to meeting data if needed
          userId: user?.id || undefined
        },
      });

      if (error) {
        console.error('GPT cleaning error:', error);
        return;
      }

      if (!data?.cleanedTranscript) {
        toast.error('No cleaned transcript returned');
        return;
      }

      setTranscript(data.cleanedTranscript);
      // Persist immediately so the deep-cleaned version is kept when navigating away
      await saveTranscriptToDatabase(data.cleanedTranscript);
      toast.success('Transcript deep cleaned and saved');
      
    } catch (error) {
      console.error('Error cleaning transcript:', error);
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  // Handle formatting transcript into paragraphs
  const handleFormatParagraphs = async () => {
    if (!transcript || transcript.trim().length === 0) {
      return;
    }

    // Save current version before formatting
    saveCurrentVersion('format-paragraphs', 'transcript');
    setIsFormattingParagraphs(true);
    
    try {
      // Strip HTML tags to get plain text for formatting
      const plainTranscript = transcript
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      
      console.log('📝 Sending plain text to formatter, length:', plainTranscript.length);
      
      const { data, error } = await supabase.functions.invoke('format-transcript-paragraphs', {
        body: { transcript: plainTranscript },
      });

      if (error) {
        console.error('Formatting error:', error);
        toast.error('Failed to format transcript');
        return;
      }

      if (!data?.formattedTranscript) {
        toast.error('No formatted transcript returned');
        return;
      }

      // Convert the formatted plain text back to HTML for display
      const { toHtmlParagraphs } = await import('@/lib/transcriptNormaliser');
      const htmlTranscript = toHtmlParagraphs(data.formattedTranscript);
      
      setTranscript(htmlTranscript);
      // Persist immediately
      await saveTranscriptToDatabase(htmlTranscript);
      // Toast removed - user finds it distracting
      // toast.success('Transcript formatted into paragraphs');
      
      
    } catch (error) {
      console.error('Error formatting transcript:', error);
      toast.error('Error formatting transcript');
    } finally {
      setIsFormattingParagraphs(false);
    }
  };

  // Handle transcript cleaning to remove duplicates
  const handleCleanTranscript = () => {
    if (!transcript || transcript.trim().length === 0) {
      return;
    }

    // Save current version before cleaning
    saveCurrentVersion('clean-transcript', 'transcript');
    
    try {
      const cleanedTranscript = cleanTranscriptDuplicates(transcript);
      setTranscript(cleanedTranscript);
      
    } catch (error) {
      console.error('Error cleaning transcript:', error);
    }
  };

  const copyToClipboard = async (content: string) => {
    const success = await copyPlainTextToClipboard(content, 'Content copied to clipboard');
  };

  const handleDownloadText = () => {
    if (!meeting || !notes) return;
    
    // Clean the content for plain text download
    let cleanText = notes
      // Convert HTML breaks to newlines first
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/div>/gi, '\n')
      .replace(/<div[^>]*>/gi, '')
      // Remove ALL HTML tags completely
      .replace(/<[^>]*>/g, '')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      // Remove ALL markdown formatting
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove **bold**
      .replace(/\*([^*]+)\*/g, '$1') // Remove *italic*
      .replace(/^#+\s*/gm, '') // Remove all # symbols at start of lines
      // Clean up excessive whitespace but preserve paragraph structure
      .replace(/[ \t]+/g, ' ') // Multiple spaces/tabs to single space
      .replace(/\n[ \t]+/g, '\n') // Remove spaces at start of lines
      .replace(/[ \t]+\n/g, '\n') // Remove spaces at end of lines
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .trim();

    // Process line by line to ensure proper spacing
    const lines = cleanText.split('\n');
    const processedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        // Keep empty lines for spacing
        processedLines.push('');
        continue;
      }
      
      // Detect different content types for proper spacing
      const isEmojiHeader = /^[1-9]️⃣/.test(line);
      const isNumberedSection = /^\d+\.?\s/.test(line);
      const isBulletPoint = /^[-•*]\s/.test(line);
      
      // Add extra spacing before major sections
      if (isEmojiHeader && processedLines.length > 0 && processedLines[processedLines.length - 1] !== '') {
        processedLines.push('');
      }
      
      processedLines.push(line);
    }
    
    const finalText = processedLines.join('\n');
    
    const element = document.createElement("a");
    const file = new Blob([finalText], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `meeting-notes-${meeting.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const saveSummaryToDatabase = async (content: string) => {
    if (!meeting?.id) return;
    
    try {
      // Enhance content with Meeting Coach assignments before saving
      const { enhanceMeetingNotesWithAssignments } = await import('@/utils/meetingCoachIntegration');
      const enhancedContent = enhanceMeetingNotesWithAssignments(content, meeting.id);

      const [summaryResult, meetingResult] = await Promise.all([
        supabase
          .from('meeting_summaries')
          .upsert({
            meeting_id: meeting.id,
            summary: enhancedContent,
            key_points: [],
            action_items: [],
            decisions: [],
            next_steps: []
          }, {
            onConflict: 'meeting_id'
          }),
        supabase
          .from('meetings')
          .update({ notes_style_3: enhancedContent })
          .eq('id', meeting.id)
      ]);

      if (summaryResult.error) throw summaryResult.error;
      if (meetingResult.error) throw meetingResult.error;
    } catch (error: any) {
      console.error('Error saving summary:', error);
      if (error?.code === '23505') {
        // Handle duplicate key error - try update instead
        try {
          const [summaryUpdateResult, meetingUpdateResult] = await Promise.all([
            supabase
              .from('meeting_summaries')
              .update({ summary: content })
              .eq('meeting_id', meeting.id),
            supabase
              .from('meetings')
              .update({ notes_style_3: content })
              .eq('id', meeting.id)
          ]);
          
          if (summaryUpdateResult.error) throw summaryUpdateResult.error;
          if (meetingUpdateResult.error) throw meetingUpdateResult.error;
        } catch (updateError) {
          console.error('Error updating summary:', updateError);
        }
      }
    }
  };

  const saveTranscriptToDatabase = async (content: string) => {
    if (!meeting?.id) return;
    
    try {
      console.log('💾 Saving formatted transcript to database...');
      
      const { error: updateError } = await supabase
        .from('meetings')
        .update({ 
          live_transcript_text: content,
          updated_at: new Date().toISOString()
        })
        .eq('id', meeting.id);
      
      if (updateError) {
        console.error('Error saving transcript:', updateError);
        throw updateError;
      }
      
      console.log('✅ Transcript saved successfully');
    } catch (error) {
      console.error('Failed to save transcript:', error);
      toast.error('Failed to save transcript changes');
    }
  };

  const handleRegenerateNotes = async () => {
    if (!meeting?.id) {
      toast.error('Missing meeting data');
      return;
    }

    // Save current version before regenerating
    saveCurrentVersion('ai-regenerate', 'notes');
    setIsGenerating(true);

    // Safety Net 2: Ensure all chunks are consolidated into transcript
    try {
      console.log('🔍 Safety Net 2: Checking chunk consolidation for meeting:', meeting.id);
      
      // Check chunk count
      const { count: chunkCount, error: countError } = await supabase
        .from('meeting_transcription_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('meeting_id', meeting.id);
      
      if (countError) {
        console.error('Error counting chunks:', countError);
      } else if (chunkCount && chunkCount > 0) {
        console.log(`📊 Found ${chunkCount} chunks in database`);
        
        // Check current transcript
        const { data: meetingData, error: meetingError } = await supabase
          .from('meetings')
          .select('live_transcript_text, whisper_transcript_text, word_count')
          .eq('id', meeting.id)
          .single();
        
        if (!meetingError && meetingData) {
          const currentTranscript = meetingData.live_transcript_text || meetingData.whisper_transcript_text || '';
          const currentWordCount = meetingData.word_count || 0;
          
          console.log(`📝 Current transcript: ${currentTranscript.length} chars, ${currentWordCount} words`);
          
          // If we have chunks but no/little transcript, consolidate
          if (currentTranscript.length < 100 || currentWordCount < 50) {
            console.log('⚠️ Chunks exist but transcript is missing/short - consolidating now');
            toast.info('Consolidating transcript chunks...', { duration: 3000 });
            
            const { data: consolidationData, error: consolidationError } = await supabase.functions.invoke('consolidate-meeting-chunks', {
              body: { meetingId: meeting.id }
            });
            
            if (consolidationError) {
              console.error('❌ Consolidation failed:', consolidationError);
              toast.error('Failed to consolidate chunks');
            } else {
              console.log('✅ Chunks consolidated before regeneration:', consolidationData);
              toast.success(`Consolidated ${consolidationData.chunksProcessed} transcript chunks`);
            }
          } else {
            console.log('✅ Transcript appears complete');
          }
        }
      } else {
        console.log('ℹ️ No chunks to consolidate');
      }
    } catch (error) {
      console.error('❌ Exception checking chunk consolidation:', error);
    }
    
    try {
      // Ensure transcript is loaded before regenerating
      let transcriptToUse = transcript;
      if (!transcriptToUse || transcriptToUse.trim().length === 0) {
        console.log('📋 Transcript not loaded yet, fetching before regeneration...');
        toast.info('Loading transcript...', { duration: 2000 });
        transcriptToUse = await fetchTranscriptData();
        
        // If still no transcript after fetching, abort
        if (!transcriptToUse || transcriptToUse.trim().length === 0) {
          toast.error('No transcript available to generate notes from');
          setIsGenerating(false);
          return;
        }
      }

      const meetingDate = meeting.start_time ? new Date(meeting.start_time).toLocaleDateString('en-GB') : '';
      const meetingTime = meeting.start_time ? new Date(meeting.start_time).toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }) : '';

      // Add meeting metadata to transcript
      const transcriptWithMetadata = addMeetingMetadataToTranscript(transcriptToUse, {
        startTime: meeting.start_time,
        endTime: meeting.end_time || undefined,
        duration: meeting.duration_minutes ? `${meeting.duration_minutes} minutes` : meeting.duration
      });

      const modelOverride = resolveMeetingModel();

      const skipQc = localStorage.getItem('meeting-qc-enabled') !== 'true';
      const { data, error } = await supabase.functions.invoke('generate-meeting-notes-claude', {
        body: {
          transcript: transcriptWithMetadata,
          meetingTitle: meeting.title,
          meetingDate: meetingDate,
          meetingTime: meetingTime,
          detailLevel: 'standard',
          ...modelOverrideField(),
          skipQc,
        }
      });

      if (error) throw error;

      if (data?.meetingMinutes) {
        onNotesChange(data.meetingMinutes);
        setNotesStyle3(data.meetingMinutes); // Sync Standard Minutes tab to prevent stale display
        saveSummaryToDatabase(data.meetingMinutes);
        
        // Generate and save meeting overview for the history view
        await generateAndSaveOverview(data.meetingMinutes);
        
        // Store which model was used for this meeting (shown in footer)
        if (meeting?.id) {
          localStorage.setItem(`meeting-llm-used-${meeting.id}`, modelOverride ?? 'default');
          
          // Store quality gate results
          if (data.qualityGate) {
            localStorage.setItem(`meeting-qg-status-${meeting.id}`, data.qualityGate.status);
            localStorage.setItem(`meeting-qg-issues-${meeting.id}`, String(
              (data.qualityGate.accuracyIssueCount || 0) + (data.qualityGate.missingTopicCount || 0) + (data.qualityGate.missingActionCount || 0)
            ));
            localStorage.setItem(`meeting-qg-corrected-${meeting.id}`, String(
              (data.qualityGate.accuracyIssueCount || 0) + (data.qualityGate.missingTopicCount || 0) + (data.qualityGate.missingActionCount || 0)
            ));
          }
        }
        
        // Show which model was used + quality gate status
        const modelLabel = modelOverride === 'claude-sonnet-4-6' ? 'Claude Sonnet 4.6' : modelOverride === 'claude-haiku-4-5-20251001' ? 'Claude Haiku 4.5' : modelOverride === 'gemini-3-flash' ? 'Gemini 3 Flash' : 'Gemini 3.1 Pro';
        const qgStatus = data.qualityGate?.status;
        const qgSuffix = qgStatus === 'CLEAN' ? ' ✅ Verified' 
          : qgStatus === 'AUTO_CORRECTED' ? ` ⚠️ ${data.qualityGate.accuracyIssueCount + data.qualityGate.missingTopicCount + data.qualityGate.missingActionCount} items auto-corrected`
          : qgStatus === 'REVIEW_RECOMMENDED' ? ' 🔍 Review recommended'
          : '';
        toast.success(`Notes regenerated using ${modelLabel}${qgSuffix}`);
      }
    } catch (error) {
      console.error('Error regenerating meeting notes:', error);
      toast.error('Failed to regenerate notes');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateNotesStyle3 = async () => {
    // Prevent multiple simultaneous calls using ref (faster than state)
    if (isRegeneratingStyle3Ref.current) {
      console.log('⚠️ Regeneration already in progress, ignoring click');
      return;
    }
    
    console.log('📋 Starting Minutes - Standard regeneration...');
    isRegeneratingStyle3Ref.current = true;
    setIsGeneratingStyle3(true);
    
    if (!meeting?.id) {
      console.error('❌ Missing meeting ID for Standard regeneration');
      isRegeneratingStyle3Ref.current = false;
      setIsGeneratingStyle3(false);
      toast.error('Missing meeting data');
      return;
    }
    try {
      console.log('NOTE GENERATION: Calling generate-meeting-notes-claude from FullPageNotesModal.generateNotesStyle3');

      // Ensure transcript is loaded before regenerating
      let transcriptToUse = transcript;
      if (!transcriptToUse || transcriptToUse.trim().length === 0) {
        console.log('📋 Transcript not loaded yet, fetching before regeneration...');
        toast.info('Loading transcript...', { duration: 2000 });
        transcriptToUse = await fetchTranscriptData();
        
        if (!transcriptToUse || transcriptToUse.trim().length === 0) {
          toast.error('No transcript available to generate notes from');
          isRegeneratingStyle3Ref.current = false;
          setIsGeneratingStyle3(false);
          return;
        }
      }

      const meetingDate = meeting.start_time ? new Date(meeting.start_time).toLocaleDateString('en-GB') : '';
      const meetingTime = meeting.start_time ? new Date(meeting.start_time).toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }) : '';

      const transcriptWithMetadata = addMeetingMetadataToTranscript(transcriptToUse, {
        startTime: meeting.start_time,
        endTime: meeting.end_time || undefined,
        duration: meeting.duration_minutes ? `${meeting.duration_minutes} minutes` : meeting.duration
      });

      const modelOverride = resolveMeetingModel();
      let data, error;
      try {
        console.log('🧠 Regenerating with model:', modelOverride);
        const result = await supabase.functions.invoke('generate-meeting-notes-claude', {
          body: {
            transcript: transcriptWithMetadata,
            meetingTitle: meeting.title,
            meetingDate: meetingDate,
            meetingTime: meetingTime,
            detailLevel: 'standard',
            ...modelOverrideField(),
            meetingId: meeting.id,
            skipQc: localStorage.getItem('meeting-qc-enabled') !== 'true',
          }
        });
        data = result.data;
        error = result.error;
      } catch (invokeError: any) {
        throw invokeError;
      }

      console.log('📋 Response:', { data: !!data, error: !!error });

      if (error) throw error;

      // Use meetingMinutes from generate-meeting-notes-claude response
      let generatedContent = data?.meetingMinutes || data?.generatedNotes || data?.content || null;

      if (!generatedContent) {
        // Fallback: if edge function didn't return content inline, fetch from DB once
        console.log('⚠️ No inline content in response, fetching from meeting_summaries...');
        const { data: summaryData } = await supabase
          .from('meeting_summaries')
          .select('summary')
          .eq('meeting_id', meeting.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();
        generatedContent = summaryData?.summary || null;
      }

      if (generatedContent) {
        console.log('✅ Notes regenerated successfully, length:', generatedContent.length);
        
        // Sanitise action owners before saving (client-side safety net)
        const transcriptText = typeof transcript === 'string' ? transcript : '';
        const sanitised = sanitiseActionOwners(generatedContent, transcriptText);
        
        if (sanitised !== generatedContent) {
          toast.info('Action item owners corrected to prevent hallucinations');
        }
        
        setNotesStyle3(sanitised);
        // Also update the parent's notes prop so the seeding useEffect doesn't overwrite
        onNotesChange(sanitised);
        
        // Save to meetings table so it persists when returning to the meeting
        await saveNoteStyleToDatabase(3, sanitised);
        
        // Fetch all updated content from auto-generate-meeting-notes (title, overview, styles)
        const { data: updatedMeeting, error: updateError } = await supabase
          .from('meetings')
          .select('title, notes_style_2, notes_style_4')
          .eq('id', meeting.id)
          .single();
        
        if (updateError) {
          console.error('❌ Error fetching updated meeting data:', updateError);
        } else if (updatedMeeting) {
          // Check if meeting title was updated
          if (updatedMeeting.title && updatedMeeting.title !== meeting.title) {
            console.log('📝 Meeting title updated:', updatedMeeting.title);
            toast.success('Meeting title updated with AI-generated name');
          }
          
        }
        
        // Update generation metadata badges from edge function response
        if (data?.qc || data?.modelUsed) {
          const freshMeta: any = {
            model: data.modelUsed || modelOverride || 'gemini-3.1-pro',
            transcript_source: 'auto',
            note_style: 'standard',
          };
          if (data.qc) freshMeta.qc = data.qc;
          setGenerationMetadata(freshMeta);
        } else {
          // Fallback: re-fetch from DB
          const { data: metaRow } = await supabase
            .from('meeting_summaries')
            .select('generation_metadata')
            .eq('meeting_id', meeting.id)
            .maybeSingle();
          if (metaRow?.generation_metadata) {
            setGenerationMetadata(metaRow.generation_metadata as any);
          }
        }

        // Update the LLM badge
        localStorage.setItem(`meeting-llm-used-${meeting.id}`, data?.modelUsed || modelOverride || 'default');
        const modelLabel = (modelOverride ?? '').startsWith('claude-') ? 'Claude Sonnet 4.6' : modelOverride === 'gemini-3-flash' ? 'Gemini 3 Flash' : 'Gemini 3.1 Pro';
        toast.success(`Notes regenerated using ${modelLabel}`);
      } else {
        console.error('❌ No content returned from edge function');
        toast.error('Note generation returned no content. Please try again.');
      }
    } catch (error: any) {
      console.error('❌ Error generating Standard notes:', error);
      
      // Parse and display user-friendly error messages
      let errorMessage = 'Failed to generate meeting notes. ';
      
      if (error?.message) {
        if (error.message.includes('Rate limit')) {
          errorMessage = 'AI service is busy. Please wait a moment and try again.';
        } else if (error.message.includes('credits') || error.message.includes('402')) {
          errorMessage = 'AI credits depleted. Please contact support to continue using this feature.';
        } else if (error.message.includes('context') || error.message.includes('too large')) {
          errorMessage = 'Transcript is too large. Please try cleaning the transcript first or contact support.';
        } else {
          errorMessage += error.message;
        }
      }
      
      toast.error(errorMessage);
    } finally {
      console.log('🏁 Standard generation finished');
      isRegeneratingStyle3Ref.current = false;
      setIsGeneratingStyle3(false);
    }
  };


  const generateSoapNotes = async () => {
    if (!meeting?.id || !user?.id) {
      toast.error('Meeting information not available');
      return;
    }

    console.log('🩺 Starting SOAP notes generation...');
    setIsGeneratingSoap(true);

    try {
      // Get the full meeting transcript
      const { data: transcriptData, error: transcriptError } = await supabase.rpc('get_meeting_full_transcript', {
        p_meeting_id: meeting.id
      });

      if (transcriptError) throw transcriptError;

      if (!transcriptData || transcriptData.length === 0 || !transcriptData[0]?.transcript) {
        toast.error('No transcript available to generate consultation notes');
        return;
      }

      // Parse the transcript
      const transcriptText = transcriptData[0].transcript;
      
      // Call the generate-consultation-notes edge function
      const { data, error } = await supabase.functions.invoke('generate-consultation-notes', {
        body: {
          consultationId: meeting.id,
          transcript: transcriptText,
          consultationType: "face_to_face",
          redactIdentifiers: true
        }
      });

      if (error) throw error;

      if (data) {
        const soapData = {
          shorthand: data.shorthand || { S: '', O: '', A: '', P: '' },
          standard: data.standard || { S: '', O: '', A: '', P: '' },
          generated_at: new Date().toISOString(),
          consultation_type: data.classifier?.label || 'General Consultation',
          summary_line: data.summaryLine || '',
          patient_copy: data.patientCopy || '',
          referral: data.referral || '',
          review: data.review || '',
          clinical_actions: data.clinicalActions || {}
        };

        setSoapNotes(soapData);
        setSoapNotesGenerated(true);

        // Save to database
        const { error: saveError } = await supabase
          .from('meetings')
          .update({ soap_notes: soapData })
          .eq('id', meeting.id)
          .eq('user_id', user.id);

        if (saveError) {
          console.error('❌ Error saving SOAP notes:', saveError);
          toast.error('SOAP notes generated but could not be saved');
        } else {
          console.log('✅ SOAP notes saved to database');
          toast.success('Consultation notes generated successfully');
        }
      } else {
        console.error('❌ No SOAP notes in response:', data);
        toast.error('Could not generate consultation notes');
      }
    } catch (error: any) {
      console.error('Error generating SOAP notes:', error);
      toast.error(error.message || 'Failed to generate consultation notes');
    } finally {
      console.log('🏁 SOAP generation finished');
      setIsGeneratingSoap(false);
    }
  };

  const generateAndSaveOverview = async (meetingNotes: string) => {
    if (!meeting?.id) return;
    
    try {
      // Generate AI overview using the new Edge function
      const { data, error } = await supabase.functions.invoke('generate-meeting-overview', {
        body: {
          meetingTitle: meeting.title,
          meetingNotes: meetingNotes
        }
      });
      
      if (error) throw error;
      
      const overview = data?.overview || extractOverviewFromNotes(meetingNotes);
      
      // Check if overview already exists
      const { data: existingOverview } = await supabase
        .from('meeting_overviews')
        .select('id')
        .eq('meeting_id', meeting.id)
        .maybeSingle();

      if (existingOverview) {
        // Update existing overview
        const { error: updateError } = await supabase
          .from('meeting_overviews')
          .update({ overview: overview })
          .eq('meeting_id', meeting.id);

        if (updateError) throw updateError;
      } else {
        // Create new overview
        const { error: insertError } = await supabase
          .from('meeting_overviews')
          .insert({
            meeting_id: meeting.id,
            overview: overview,
            created_by: (await supabase.auth.getUser()).data.user?.id
          });

        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Error saving meeting overview:', error);
      // Don't show error to user since the main notes were generated successfully
    }
  };

  // Function to load format variation
  const loadFormatVariation = async (variationType: string) => {
    if (!meeting?.id || !notesStyle3) {
      toast.error('Standard minutes must be generated first');
      return;
    }

    setIsLoadingVariation(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-standard-minutes-variations', {
        body: {
          meeting_id: meeting.id,
          variation_type: variationType
        }
      });

      if (error) throw error;

      if (data?.variation) {
        setFormatVariationContent(data.variation);
        if (data.cached) {
          toast.success('Format loaded from cache');
        } else {
          toast.success('Format variation generated successfully');
        }
      }
    } catch (error) {
      console.error('Error loading format variation:', error);
      toast.error('Failed to load format variation');
      // Fallback to client-side rendering
      let fallbackContent = notesStyle3;
      switch (variationType) {
        case 'no_actions':
          fallbackContent = fallbackContent
            .replace(/#{1,6}\s*ACTION ITEMS[\s\S]*?(?=\n#{1,6}\s|\n\n|$)/gi, '')
            .replace(/\n{3,}/g, '\n\n');
          break;
        case 'concise':
          fallbackContent = fallbackContent
            .replace(/\s*\([^)]{20,}\)/g, '')
            .replace(/\n{3,}/g, '\n\n');
          break;
      }
      setFormatVariationContent(fallbackContent);
    } finally {
      setIsLoadingVariation(false);
    }
  };

  const extractOverviewFromNotes = (meetingNotes: string): string => {
    // Extract a concise overview from the detailed meeting notes (fallback method)
    const lines = meetingNotes.split('\n').filter(line => line.trim());
    
    // Look for executive summary or key points
    const executiveSummaryIndex = lines.findIndex(line => 
      line.toLowerCase().includes('executive summary') || 
      line.toLowerCase().includes('meeting overview') ||
      line.toLowerCase().includes('summary')
    );
    
    if (executiveSummaryIndex !== -1) {
      // Extract the executive summary section (next 3-5 lines)
      const summaryLines = lines.slice(executiveSummaryIndex + 1, executiveSummaryIndex + 4)
        .filter(line => line.trim() && !line.match(/^[A-Z\s]+$/)) // Filter out headers
        .slice(0, 2); // Take first 2 meaningful lines
      
      if (summaryLines.length > 0) {
        const overview = summaryLines.join(' ').replace(/^[•\-\*]\s*/, '').trim();
        const words = overview.split(' ');
        return words.length > 50 ? words.slice(0, 50).join(' ') + '...' : overview;
      }
    }
    
    // Fallback: extract first meaningful sentence or key topic
    const meaningfulLines = lines.filter(line => 
      line.length > 30 && line.length < 200 &&
      !line.match(/^(MEETING|Date:|Time:|Present:|Attendees:|Chair:)/i) &&
      !line.match(/^[#\*\-•]/))
      .slice(0, 1);
    
    if (meaningfulLines.length > 0) {
      const overview = meaningfulLines[0].substring(0, 200);
      const words = overview.split(' ');
      return words.length > 50 ? words.slice(0, 50).join(' ') + '...' : overview;
    }
    
    // Final fallback: create a simple overview
    return `${meeting.title} meeting notes generated.`;
  };

  const handleCustomInstructionSubmit = async () => {
    if (!customInstruction.trim() || !meeting?.id) {
      return;
    }

    // Size guard
    if (notes.length > MAX_CONTENT_LENGTH) {
      toast.error(`Content too large to enhance (${notes.length} characters). Please try with shorter content.`);
      return;
    }

    console.log('🔧 Applying custom instructions, content length:', notes.length);
    setIsGenerating(true);
    
    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), ENHANCEMENT_TIMEOUT)
      );

      const enhancePromise = supabase.functions.invoke('enhance-meeting-minutes', {
        body: {
          originalContent: notes,
          enhancementType: 'custom',
          customRequest: customInstruction,
          additionalContext: ''
        }
      });

      const { data, error } = await Promise.race([enhancePromise, timeoutPromise]) as any;

      if (error) {
        console.error('❌ Custom instruction error:', error);
        throw error;
      }

      if (data?.enhancedContent) {
        console.log('✅ Custom instructions applied successfully');
        onNotesChange(data.enhancedContent);
        saveSummaryToDatabase(data.enhancedContent);
        setCustomInstruction("");
        setShowCustomInstruction(false);
        toast.success('Custom instructions applied');
      }
    } catch (error: any) {
      console.error('❌ Error applying custom instructions:', error);
      
      if (error.message === 'TIMEOUT') {
        toast.error('Enhancement timed out. This meeting may be too long. Your original notes have been preserved.');
      } else {
        toast.error('Failed to apply custom instructions. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadTextFile = (content: string, filename: string) => {
    try {
      const cleanContent = stripMarkdown(content);
      const blob = new Blob([cleanContent], { type: 'text/plain;charset=utf-8' });
      saveAs(blob, `${filename}.txt`);
    } catch (error) {
      console.error('Text export failed:', error);
    }
  };


  // AI Enhancement functionality with timeout and size guards
  const handleAIEnhancement = async (enhanceType: string) => {
    const currentContent = getCurrentContent();
    if (!currentContent.trim()) {
      return;
    }

    // Size guard
    if (currentContent.length > MAX_CONTENT_LENGTH) {
      toast.error(`Content too large to enhance (${currentContent.length} characters). Please try with shorter content.`);
      return;
    }

    console.log(`🔧 Enhancing with type: ${enhanceType}, content length:`, currentContent.length);
    setIsGenerating(true);
    
    try {
      const prompts = {
        'clinical-focus': 'Focus on and enhance all clinical discussions, medical decisions, and patient care elements. Emphasise diagnostic considerations, treatment plans, and clinical reasoning.',
        'action-analysis': 'Extract and organise all action items, decisions, and follow-up tasks. Create a structured analysis of responsibilities, timelines, and outcomes.',
        'professional-tone': 'Enhance the language to meet professional healthcare standards. Use appropriate medical terminology and formal business language.',
        'risk-assessment': 'Identify and highlight all clinical and operational risks mentioned. Add risk assessment context and mitigation considerations.',
        'follow-up-plans': 'Generate comprehensive follow-up recommendations based on the discussions. Include timelines, responsible parties, and success metrics.',
        'patient-safety': 'Emphasise all patient safety elements, quality improvement discussions, and safeguarding considerations. Highlight safety protocols and outcomes.'
      };

      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), ENHANCEMENT_TIMEOUT)
      );

      const enhancePromise = supabase.functions.invoke('enhance-meeting-minutes', {
        body: {
          originalContent: currentContent,
          enhancementType: 'custom',
          specificRequest: prompts[enhanceType as keyof typeof prompts] || enhanceType,
          context: `Meeting ID: ${meeting?.id}`
        }
      });

      const { data, error } = await Promise.race([enhancePromise, timeoutPromise]) as any;

      if (error) {
        console.error('❌ Enhancement error:', error);
        throw error;
      }
      if (data?.error) {
        console.error('❌ Enhancement data error:', data.error);
        throw new Error(data.error);
      }

      if (data?.enhancedContent) {
        console.log('✅ Enhancement successful');
        onNotesChange(data.enhancedContent);
        toast.success('Notes enhanced successfully');
      }
    } catch (error: any) {
      console.error('❌ Enhancement error:', error);
      
      if (error.message === 'TIMEOUT') {
        toast.error('Enhancement timed out. This meeting may be too long. Your original notes have been preserved.');
      } else {
        toast.error('Failed to enhance notes. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Custom AI Enhancement with timeout and size guards
  const handleCustomAISubmit = async (prompt: string) => {
    const currentContent = getCurrentContent();
    if (!currentContent.trim() || !prompt.trim()) {
      return;
    }

    // Size guard
    if (currentContent.length > MAX_CONTENT_LENGTH) {
      toast.error(`Content too large to enhance (${currentContent.length} characters). Please try with shorter content.`);
      return;
    }

    console.log('🔧 Custom AI enhancement, content length:', currentContent.length);
    setIsGenerating(true);
    
    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), ENHANCEMENT_TIMEOUT)
      );

      const enhancePromise = supabase.functions.invoke('enhance-meeting-minutes', {
        body: {
          originalContent: currentContent,
          enhancementType: 'custom',
          specificRequest: prompt,
          context: `Meeting ID: ${meeting?.id}`
        }
      });

      const { data, error } = await Promise.race([enhancePromise, timeoutPromise]) as any;

      if (error) {
        console.error('❌ Custom AI error:', error);
        throw error;
      }
      if (data?.error) {
        console.error('❌ Custom AI data error:', data.error);
        throw new Error(data.error);
      }

      if (data?.enhancedContent) {
        console.log('✅ Custom AI enhancement successful');
        onNotesChange(data.enhancedContent);
        setShowCustomAIModal(false);
        toast.success('Enhancement applied successfully');
      }
    } catch (error: any) {
      console.error('❌ Custom enhancement error:', error);
      
      if (error.message === 'TIMEOUT') {
        toast.error('Enhancement timed out. This meeting may be too long. Your original notes have been preserved.');
      } else {
        toast.error('Failed to apply enhancement. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Find and Replace functionality
  const handleFindReplaceSubmit = (findText: string, replaceText: string, options: { caseSensitive: boolean; wholeWords: boolean; }) => {
    const currentContent = getCurrentContent();
    if (!findText) {
      return;
    }

    try {
      let flags = 'g';
      if (!options.caseSensitive) flags += 'i';
      
      let pattern = findText;
      if (options.wholeWords) {
        pattern = `\\b${findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`;
      } else {
        pattern = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      
      const regex = new RegExp(pattern, flags);
      const newContent = currentContent.replace(regex, replaceText);
      
      const matchCount = (currentContent.match(regex) || []).length;
      
      if (matchCount > 0) {
        onNotesChange(newContent);
        setShowFindReplace(false);
      }
    } catch (error) {
      console.error('Find and replace failed:', error);
    }
  };

  if (!meeting) return null;

  // Show loading state when meeting data is still being fetched
  if (isMeetingLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent 
          className={`${isMobile
            ? "w-full h-full max-w-none max-h-none inset-0 m-0 rounded-none border-0" 
            : "w-[86.4rem] max-w-[95vw] h-[90vh] max-h-screen"
          } flex flex-col items-center justify-center overflow-hidden z-[100]`}
          style={{ zIndex: 100 }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-muted-foreground text-lg">Loading meeting notes...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <NoteEnhancementDialog
        open={enhancementDialogOpen}
        onOpenChange={setEnhancementDialogOpen}
        originalContent={notesStyle3}
        onEnhanced={handleEnhanced}
        meetingId={meeting.id}
      />
      
      <Dialog
        open={isOpen} 
        onOpenChange={(open) => {
          console.log('📱 Dialog onOpenChange called with:', open);
          if (!open) {
            onClose();
          }
        }}
      >
      <DialogContent 
        ref={dialogContentRef}
        className={`${isMobile
          ? "w-full h-full max-w-none max-h-none inset-0 m-0 rounded-none border-0" 
          : "w-[86.4rem] max-w-[95vw] h-[90vh] max-h-screen"
        } flex flex-col overflow-hidden z-[100] ${showContextDialog ? "pointer-events-none" : ""}`}
        style={{ zIndex: 100 }}
        aria-hidden={showContextDialog}
      >
        <RecordingWarningBanner 
          operation="Database operations" 
          className="mx-6 mt-6"
        />
        <DialogHeader>
          <DialogTitle className={`flex items-center justify-between ${isMobile ? "pr-4" : "pr-8"}`}>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Bot className="h-5 w-5 flex-shrink-0" style={{ color: '#005EB8' }} />
              <span className="truncate" style={{ color: '#005EB8' }}>{meeting.title} - Meeting Notes</span>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            View and edit meeting notes and transcript for {meeting.title}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Find & Replace Panel */}
          {showFindReplace && (
            <div className="p-4 border-b bg-muted/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Find & Replace</h3>
                <Button
                  onClick={() => setShowFindReplace(false)}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <EnhancedFindReplacePanel
                getCurrentText={() => getCurrentContent()}
                onApply={applyFindReplaceUpdate}
                meetingId={meeting?.id}
                onTranscriptSync={async (finds, replaceWith) => {
                  if (meeting?.id) {
                    await syncTranscriptCorrections(meeting.id, finds, replaceWith);
                  }
                }}
              />
            </div>
          )}

          {/* Custom Instructions Panel */}
          {showCustomInstruction && (
            <div className="p-4 border-b bg-muted/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Custom Instructions</h3>
                <Button
                  onClick={() => setShowCustomInstruction(false)}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Textarea
                    value={customInstruction}
                    onChange={(e) => setCustomInstruction(e.target.value)}
                    placeholder="Enter your custom instructions for enhancing the content..."
                    className="flex-1 min-h-[80px]"
                  />
                  <SpeechToText 
                    onTranscription={(text) => {
                      const currentValue = customInstruction || '';
                      setCustomInstruction(currentValue + ' ' + text);
                    }}
                    size="sm"
                    className="h-10"
                  />
                </div>
                <Button
                  onClick={async () => {
                    if (!customInstruction.trim() || !meeting?.id) {
                      return;
                    }

                     // Save current version before enhancement
                     saveCurrentVersion('custom-enhancement', activeTab as 'notes' | 'transcript');
                     
                     setIsGenerating(true);
                     
                     try {
                       const { data, error } = await supabase.functions.invoke('enhance-meeting-minutes', {
                         body: {
                           originalContent: getCurrentContent(),
                           enhancementType: 'custom',
                           customRequest: customInstruction,
                           additionalContext: ''
                         }
                       });

                      if (error) throw error;

                      if (data?.enhancedContent) {
                        setCurrentContent(data.enhancedContent);
                        if (activeTab === "notes") {
                          saveSummaryToDatabase(data.enhancedContent);
                        }
                        setCustomInstruction("");
                        setShowCustomInstruction(false);
                      }
                    } catch (error) {
                      console.error('Error applying custom instructions:', error);
                    } finally {
                      setIsGenerating(false);
                    }
                  }}
                  disabled={!customInstruction.trim() || isGenerating}
                  className="w-full"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isGenerating ? 'Applying...' : 'Apply Custom Instructions'}
                </Button>
              </div>
            </div>
          )}
          
          {/* Tabs Content */}
          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="transcript" value={activeTab} onValueChange={(value) => {
              // Lazy load transcript when user switches to transcript tab
              if (value === 'transcript' && !transcriptLoaded && !isLoadingTranscript) {
                console.log('🔄 Lazy loading transcript on tab switch...');
                if (isResourceOperationSafe()) {
                  fetchTranscriptData();
                } else {
                  toast.error("Cannot load transcript while recording is active.");
                }
              }
              
              // If we're editing, save current changes before switching tabs
              if (isEditing && editingTab !== value && !editingTab.startsWith(`${value}-`)) {
                // Save current version before switching tabs
                const baseTab = editingTab.startsWith('notes-') ? 'notes' : 'transcript';
                saveCurrentVersion('tab-switch', baseTab as 'notes' | 'transcript');
                
                // Save based on the current editing tab
                if (editingTab.startsWith("notes-")) {
                  const subTab = editingTab.replace("notes-", "");
                  switch (subTab) {
                    case 'style1':
                      setNotesStyle3(editingContent);
                      saveNoteStyleToDatabase(3, editingContent);
                      break;
                    case 'style2':
                      onNotesChange(editingContent);
                      saveSummaryToDatabase(editingContent);
                      break;
                  }
                } else if (editingTab === "transcript") {
                  setTranscript(editingContent);
                  saveTranscriptToDatabase(editingContent);
                } else if (editingTab === "backup-transcript") {
                  setBackupTranscript(editingContent);
                  // Save backup transcript to database
                  if (meeting?.id) {
                    supabase
                      .from('meetings')
                      .update({ assembly_ai_transcript: editingContent })
                      .eq('id', meeting.id)
                      .eq('user_id', user!.id)
                      .then(({ error }) => {
                        if (error) console.error('Error saving backup transcript:', error);
                      });
                  }
                }
                setIsEditing(false);
                setEditingContent("");
                setEditingTab("");
              }
              // Type guard to ensure value is valid before setting
              if (value === 'notes' || value === 'transcript') {
                setActiveTab(value);
              }
            }} className="h-full flex flex-col">
              <div className="px-3 pt-4 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <TabsList className="grid grid-cols-2 flex-1">
                    <TabsTrigger value="notes">Meeting Notes</TabsTrigger>
                    <TabsTrigger value="transcript">Meeting Transcript</TabsTrigger>
                  </TabsList>
                </div>
              </div>
              
              <TabsContent value="notes" className="flex-1 overflow-hidden mt-0 bg-white">
                <div className="h-full flex flex-col">
                  
                  {/* Sub-tabs for different meeting notes styles - positioned directly under main tab header */}
                  <div className="flex-1 overflow-auto px-3 pt-4">
                       <Tabs value={activeNotesStyleTab} onValueChange={(value) => {
                        setActiveNotesStyleTab(value);
                        // Load transcript when switching to Patient Consultation (style6)
                        if (value === 'style6' && !transcriptLoaded && !isLoadingTranscript) {
                          console.log('🔄 Loading transcript for Patient Consultation...');
                          if (isResourceOperationSafe()) {
                            fetchTranscriptData().then(() => {
                              // Auto-trigger consultation notes for demo meetings
                              if (meeting?.title.includes('🎭') && !soapNotesGenerated) {
                                console.log('🎭 Auto-triggering consultation notes for demo meeting');
                                setTimeout(() => generateSoapNotes(), 500);
                              }
                            });
                          } else {
                            toast.error("Cannot load transcript while recording is active.");
                          }
                        }
                      }} className="h-full flex flex-col">
                        <div className="flex items-center gap-2 mb-4">
                          <TabsList>
                            <TabsTrigger value="style1" className="text-xs sm:text-sm">
                              Meeting Minutes - Standard View
                            </TabsTrigger>
                            {canViewConsultationExamples && (
                              <TabsTrigger value="style6" className="text-xs sm:text-sm">
                                Patient Consultation
                              </TabsTrigger>
                            )}
                          </TabsList>
                          
                          {/* Font Size Controls - only show for Minutes */}
                          {activeNotesStyleTab === 'style1' && (
                            <div className="flex items-center gap-1 border rounded-md p-1">
                              <Type className="h-4 w-4 text-muted-foreground mr-1" />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => setFontSizeStyle1(prev => Math.max(12, prev - 1))}
                                disabled={fontSizeStyle1 <= 12}
                                title="Decrease font size"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="text-xs text-muted-foreground px-1 min-w-[2.5rem] text-center">
                                {fontSizeStyle1}px
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => setFontSizeStyle1(prev => Math.min(24, prev + 1))}
                                disabled={fontSizeStyle1 >= 24}
                                title="Increase font size"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          )}

                          {/* Action buttons grouped with 20px spacing */}
                          {(() => {
                            const getTabContent = () => {
                              switch (activeNotesStyleTab) {
                                case 'style1': return notesStyle3;
                                case 'style2': return notes;
                                case 'style6': return null;
                                default: return null;
                              }
                            };
                            
                            const getTabName = () => {
                              switch (activeNotesStyleTab) {
                                case 'style1': return 'Minutes';
                                case 'style2': return 'Minutes - Brief';
                                case 'style6': return 'Patient Consultation';
                                default: return 'Meeting Notes';
                              }
                            };
                            
                            const content = getTabContent();
                            const tabName = getTabName();
                            
                            return content ? (
                              <>
                                {/* Group 1: Word and Email icons */}
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    title="Download Word"
                                    aria-label="Download Word"
                                    onClick={() => {
                                      if (content) {
                                        generateAdvancedWordDocument(content, tabName);
                                      }
                                    }}
                                  >
                                    <WordIcon className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    title="Email notes"
                                    aria-label="Email notes"
                                    onClick={() => {
                                      // Use the professional email modal with attendees for standard view
                                      setStandardEmailContent({
                                        meetingId: meeting?.id || '',
                                        meetingTitle: meeting?.title || 'Meeting',
                                        meetingNotes: content || ''
                                      });
                                      setStandardEmailModalOpen(true);
                                    }}
                                  >
                                    <Mail className="h-4 w-4" />
                                  </Button>
                                </div>

                                {/* 20px spacer */}
                                <div className="w-5" />

                                {/* Group 2: Find/Replace, Edit and Copy icons */}
                                <div className="flex items-center gap-2">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          onClick={() => setShowFindReplace(!showFindReplace)}
                                          variant={showFindReplace ? "default" : "outline"}
                                          size="icon"
                                        >
                                          <Search className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Find & Replace</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          onClick={handleEditToggle}
                                          variant="outline"
                                          size="icon"
                                        >
                                          <Edit3 className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{isEditing ? 'Save' : 'Edit'} notes</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  <Button
                                    variant="outline"
                                    size="icon"
                                    title="Copy to clipboard"
                                    aria-label="Copy to clipboard"
                                    onClick={async () => {
                                      if (content) {
                                        await copyPlainTextToClipboard(content, `${tabName} copied to clipboard`);
                                      }
                                    }}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>

                                {/* 20px spacer */}
                                <div className="w-5" />

                                {/* Group 3: Manage Attendees and Regenerate icons - only for style1 */}
                                {activeNotesStyleTab === 'style1' && (
                                  <div className="flex items-center gap-2">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setAttendeeModalOpen(true)}
                                            aria-label="Manage attendees"
                                          >
                                            <Users className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Manage Attendees</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={generateNotesStyle3}
                                            disabled={isGeneratingStyle3}
                                            aria-label="Regenerate meeting notes"
                                          >
                                            <RefreshCw className={`h-4 w-4 ${isGeneratingStyle3 ? 'animate-spin' : ''}`} />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Regenerate notes and overview</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                )}
                              </>
                            ) : null;
                          })()}
                          
                        </div>

                      {/* Meeting Notes header and undo button - hide for Patient Consultation */}
                      {activeNotesStyleTab !== 'style6' && (
                        <div className="flex items-center justify-between pb-4 flex-shrink-0">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold">Meeting Notes</h3>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {isEditing && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      onClick={handleUndo}
                                      variant="outline"
                                      size="icon"
                                      disabled={notesVersions.length === 0}
                                      title={`Undo (${notesVersions.length} versions available)`}
                                    >
                                      <Undo2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Undo ({notesVersions.length} versions available)</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </div>
                      )}
                      
                       <TabsContent value="style1" className="flex-1 overflow-auto pb-6">
                          {(!noteStylesLoaded && !notesStyle3?.trim()) ? (
                            <div className="flex items-center justify-center h-full">
                              <div className="text-center space-y-3">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-primary rounded-full animate-[bounce_1s_ease-in-out_0s_infinite]"></span>
                                    <span className="w-2 h-2 bg-primary rounded-full animate-[bounce_1s_ease-in-out_0.2s_infinite]"></span>
                                    <span className="w-2 h-2 bg-primary rounded-full animate-[bounce_1s_ease-in-out_0.4s_infinite]"></span>
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground">Loading meeting notes...</p>
                              </div>
                            </div>
                          ) : isEditing && editingTab === "notes-style1" ? (
                           <RichTextEditor
                             content={editingContent}
                             onChange={setEditingContent}
                             placeholder="Meeting notes will appear here..."
                             className="h-full"
                           />
                          ) : (
                            <>
                             <div className="space-y-4">
                               {!notesStyle3 ? (
                                 <div className="flex flex-col items-center justify-center h-32 space-y-4">
                                    <p className="text-muted-foreground text-center">
                                      Generate comprehensive meeting notes with structured format (auto-generated as default)
                                    </p>
                                    <Button
                                      onClick={generateNotesStyle3}
                                      disabled={isGeneratingStyle3}
                                      className="gap-2"
                                    >
                                      {isGeneratingStyle3 ? (
                                        <>
                                          <RefreshCw className="h-4 w-4 animate-spin" />
                                          Generating Standard Minutes...
                                        </>
                                      ) : (
                                         <>
                                           <Sparkles className="h-4 w-4" />
                                           Generate Minutes
                                         </>
                                       )}
                                   </Button>
                                 </div>
                                 ) : (
                                    <div className="space-y-4 relative min-h-[500px]">
                                        {/* Non-blocking inline banner for regeneration (replaces fixed full-screen overlay) */}
                                        {isGeneratingStyle3 && (
                                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center gap-3 animate-fade-in">
                                            <RefreshCw className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
                                            <div className="flex-1">
                                              <p className="text-sm font-medium text-blue-900">Regenerating Notes</p>
                                              <p className="text-xs text-blue-700">Creating your updated meeting minutes...</p>
                                            </div>
                                          </div>
                                         )}
                                        
                                       {/* Plain text mode OR long meetings - always responsive */}
                                       {(notesViewMode === 'plain' || isLongMeeting) && !forceFancyView ? (
                                          <div className="flex flex-col h-full space-y-2">
                                            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-3 py-2 flex items-center justify-between">
                                              <span>
                                                {isLongMeeting 
                                                  ? 'Long meeting detected. Showing plain text for responsiveness.' 
                                                  : 'Showing plain text view for faster loading.'}
                                              </span>
                                              <button 
                                                onClick={() => {
                                                  if (isLongMeeting) {
                                                    setForceFancyView(true);
                                                  } else {
                                                    setNotesViewMode('formatted');
                                                  }
                                                }}
                                                className="underline hover:text-slate-900 font-medium ml-2"
                                              >
                                                Switch to formatted view
                                              </button>
                                            </div>

                                            <ScrollArea className="flex-1 rounded border bg-white p-4">
                                              <pre 
                                                className="whitespace-pre-wrap font-nhs text-slate-900 leading-relaxed"
                                                style={{ fontSize: `${fontSizeStyle1}px`, lineHeight: `${fontSizeStyle1 * 1.6}px` }}
                                              >
                                                {plainTextPreview || notesStyle3 || "No standard notes are available for this meeting."}
                                              </pre>
                                            </ScrollArea>
                                          </div>
                                        ) : forceFancyView && isLongMeetingRaw ? (
                                         /* Long meeting with user override: Use worker-based formatting */
                                         <div className="flex flex-col h-full space-y-2">
                                           {isWorkerFormatting ? (
                                             /* Show loading state while worker processes */
                                             <>
                                               <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2 flex items-center gap-2">
                                                 <RefreshCw className="h-3 w-3 animate-spin" />
                                                 <span>Formatting in progress... This may take a few seconds for long meetings.</span>
                                                 <button 
                                                   onClick={() => setForceFancyView(false)}
                                                   className="ml-auto underline hover:text-blue-900 font-medium"
                                                 >
                                                   Cancel
                                                 </button>
                                               </div>
                                               <ScrollArea className="flex-1 rounded border bg-white p-4">
                                                 <pre className="whitespace-pre-wrap text-sm font-nhs text-slate-900 leading-relaxed">
                                                   {plainTextPreview || notesStyle3 || "No standard notes are available for this meeting."}
                                                 </pre>
                                               </ScrollArea>
                                             </>
                                           ) : workerError ? (
                                             /* Show error state */
                                             <>
                                               <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                                                 {workerError}{' '}
                                                 <button 
                                                   onClick={triggerWorkerFormat}
                                                   className="underline hover:text-red-900 font-medium"
                                                 >
                                                   Try again
                                                 </button>
                                                 {' '}or{' '}
                                                 <button 
                                                   onClick={() => setForceFancyView(false)}
                                                   className="underline hover:text-red-900 font-medium"
                                                 >
                                                   use plain text
                                                 </button>
                                               </div>
                                               <ScrollArea className="flex-1 rounded border bg-white p-4">
                                                 <pre className="whitespace-pre-wrap text-sm font-nhs text-slate-900 leading-relaxed">
                                                   {plainTextPreview || notesStyle3 || "No standard notes are available for this meeting."}
                                                 </pre>
                                               </ScrollArea>
                                             </>
                                           ) : workerFormattedHtml ? (
                                             /* Show formatted content */
                                             <>
                                               <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                                                 ✓ Formatted view loaded.{' '}
                                                 <button 
                                                   onClick={() => setForceFancyView(false)}
                                                   className="underline hover:text-green-900 font-medium"
                                                 >
                                                   Switch back to plain text
                                                 </button>
                                               </div>
                                               <div 
                                                 className="max-w-none transition-opacity duration-300"
                                                 style={{ 
                                                   fontSize: `${fontSizeStyle1}px`, 
                                                   lineHeight: `${fontSizeStyle1 * 1.6}px`,
                                                   ['--base-font-size' as string]: `${fontSizeStyle1}px`
                                                 }}
                                               >
                                                 <style>
                                                   {`
                                                     .max-w-none .minutes-content, .max-w-none .minutes-content * { font-size: ${fontSizeStyle1}px !important; line-height: ${fontSizeStyle1 * 1.6}px !important; }
                                                     .max-w-none h1 { font-size: ${fontSizeStyle1 * 1.8}px !important; }
                                                     .max-w-none h2 { font-size: ${fontSizeStyle1 * 1.5}px !important; }
                                                     .max-w-none h3 { font-size: ${fontSizeStyle1 * 1.3}px !important; }
                                                     .max-w-none h4 { font-size: ${fontSizeStyle1 * 1.1}px !important; }
                                                     .max-w-none p, .max-w-none li, .max-w-none td, .max-w-none th { font-size: ${fontSizeStyle1}px !important; line-height: ${fontSizeStyle1 * 1.6}px !important; }
                                                   `}
                                                 </style>
                                                 <div dangerouslySetInnerHTML={{ __html: workerFormattedHtml }} />
                                               </div>
                                             </>
                                           ) : (
                                             /* Fallback while waiting for worker */
                                             <ScrollArea className="flex-1 rounded border bg-white p-4">
                                               <pre className="whitespace-pre-wrap text-sm font-nhs text-slate-900 leading-relaxed">
                                                 {plainTextPreview || notesStyle3 || "No standard notes are available for this meeting."}
                                               </pre>
                                             </ScrollArea>
                                           )}
                                         </div>
                                       ) : notesViewMode === 'formatted' ? (
                                          /* Formatted view for shorter meetings */
                                          <div className="flex flex-col h-full space-y-2">
                                            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-3 py-2 flex items-center justify-between">
                                              <span>Formatted view</span>
                                              <button 
                                                onClick={() => setNotesViewMode('plain')}
                                                className="underline hover:text-slate-900 font-medium ml-2"
                                              >
                                                Switch to plain text
                                              </button>
                                            </div>
                                            {isLoadingVariation ? (
                                             <div className="flex items-center justify-center h-32">
                                               <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                                             </div>
                                           ) : (isRenderingMinutes && !minutesHtml && notesStyle3?.trim()) ? (
                                             /* Show plain text while formatting - keeps UI responsive */
                                             <div className="space-y-2">
                                               <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2 flex items-center gap-2">
                                                 <RefreshCw className="h-3 w-3 animate-spin" />
                                                 <span>Formatting notes... Showing plain text preview below.</span>
                                               </div>
                                               <ScrollArea className="flex-1 rounded border bg-white p-4">
                                                 <pre 
                                                   className="whitespace-pre-wrap font-nhs text-slate-900 leading-relaxed"
                                                   style={{ fontSize: `${fontSizeStyle1}px`, lineHeight: `${fontSizeStyle1 * 1.6}px` }}
                                                 >
                                                   {plainTextPreview || notesStyle3 || "No standard notes are available for this meeting."}
                                                 </pre>
                                               </ScrollArea>
                                             </div>
                                           ) : (
                                             <>
                                              <div 
                                                className={`max-w-none transition-opacity duration-300 ${isGeneratingStyle3 ? 'opacity-50' : 'opacity-100'}`}
                                                style={{ 
                                                  fontSize: `${fontSizeStyle1}px`, 
                                                  lineHeight: `${fontSizeStyle1 * 1.6}px`,
                                                  ['--base-font-size' as string]: `${fontSizeStyle1}px`
                                                }}
                                              >
                                                <style>
                                                  {`
                                                    .max-w-none .minutes-content, .max-w-none .minutes-content * { font-size: ${fontSizeStyle1}px !important; line-height: ${fontSizeStyle1 * 1.6}px !important; }
                                                    .max-w-none h1 { font-size: ${fontSizeStyle1 * 1.8}px !important; }
                                                    .max-w-none h2 { font-size: ${fontSizeStyle1 * 1.5}px !important; }
                                                    .max-w-none h3 { font-size: ${fontSizeStyle1 * 1.3}px !important; }
                                                    .max-w-none h4 { font-size: ${fontSizeStyle1 * 1.1}px !important; }
                                                    .max-w-none p, .max-w-none li, .max-w-none td, .max-w-none th { font-size: ${fontSizeStyle1}px !important; line-height: ${fontSizeStyle1 * 1.6}px !important; }
                                                  `}
                                                </style>
                                                 <div 
                                                   ref={minutesContainerRef}
                                                    dangerouslySetInnerHTML={{ 
                                                      __html: renderedMinutesHtml
                                                    }}
                                                 />
                                              </div>
                                             </>
                                           )}
                                          </div>
                                        ) : (
                                          /* Fallback: plain text */
                                          <ScrollArea className="flex-1 rounded border bg-white p-4">
                                            <pre 
                                              className="whitespace-pre-wrap font-nhs text-slate-900 leading-relaxed"
                                              style={{ fontSize: `${fontSizeStyle1}px`, lineHeight: `${fontSizeStyle1 * 1.6}px` }}
                                            >
                                              {plainTextPreview || notesStyle3 || "No standard notes are available for this meeting."}
                                            </pre>
                                          </ScrollArea>
                                        )}
                                    </div>
                                 )}
                             </div>

                             {/* Quality Report Section */}
                             <QualityReportSection
                               qc={generationMetadata?.qc}
                               meetingId={meeting?.id}
                               onQcUpdated={(newMeta) => setGenerationMetadata(newMeta)}
                               meetingTitle={meeting?.title}
                             />
                            </>
                           )}
                        </TabsContent>
                      
                       <TabsContent value="style2" className="flex-1 overflow-auto pb-6">
                         {isEditing && editingTab === "notes-style2" ? (
                           <RichTextEditor
                             content={editingContent}
                             onChange={setEditingContent}
                             placeholder="Meeting notes will appear here..."
                             className="h-full"
                           />
                           ) : (
                             <div className="relative min-h-[500px]">
                               {/* Animated loading overlay */}
                               {isGenerating && (
                                 <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
                                   <div className="flex flex-col items-center gap-4 animate-scale-in">
                                     <div className="relative">
                                       <RefreshCw className="h-12 w-12 text-primary animate-spin" />
                                       <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                                     </div>
                                     <div className="text-center space-y-2">
                                       <p className="text-lg font-semibold">Regenerating Notes</p>
                                       <p className="text-sm text-muted-foreground">Creating your updated meeting minutes...</p>
                                     </div>
                                   </div>
                                 </div>
                               )}
                                <div className={`prose max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground transition-opacity duration-300 ${isGenerating ? 'opacity-50' : 'opacity-100'}`}>
                                  <div 
                                    dangerouslySetInnerHTML={{ 
                                      __html: renderNHSMarkdown(notes, { enableNHSStyling: true, baseFontSize: fontSizeStyle1 })
                                    }}
                                  />
                              </div>
                            </div>
                          )}
                       </TabsContent>
                      
                      
                      
                         {/* Patient Consultation Content (style6) */}
                       <TabsContent value="style6" className="flex-1 overflow-hidden mt-0">
                         <div className="h-full flex flex-col">
                           {!soapNotesGenerated ? (
                             <div className="flex-1 flex items-center justify-center">
                               <div className="max-w-2xl w-full text-center space-y-6">
                                 <div className="flex justify-center">
                                   <div className="rounded-full bg-blue-100 dark:bg-blue-900/20 p-6">
                                     <Stethoscope className="h-16 w-16 text-blue-600 dark:text-blue-400" />
                                   </div>
                                 </div>
                                 <div className="space-y-2">
                                   <h3 className="text-2xl font-semibold">Generate Patient Consultation Notes</h3>
                                   <p className="text-muted-foreground">
                                     Convert this meeting transcript into structured SOAP format consultation notes
                                   </p>
                                 </div>
                                 <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                   <div className="flex items-start gap-3">
                                     <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                     <div className="text-left text-sm">
                                       <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">SOAP Format</p>
                                       <p className="text-blue-800 dark:text-blue-200">
                                         <strong>S</strong> - Subjective (patient's perspective)<br/>
                                         <strong>O</strong> - Objective (clinical findings)<br/>
                                         <strong>A</strong> - Assessment (diagnosis/impression)<br/>
                                         <strong>P</strong> - Plan (treatment/follow-up)
                                       </p>
                                     </div>
                                   </div>
                                 </div>
                                  <Button
                                    size="lg"
                                    onClick={generateSoapNotes}
                                    disabled={isGeneratingSoap || (!transcript && !isLoadingTranscript)}
                                    className="gap-2"
                                  >
                                   {isGeneratingSoap ? (
                                     <>
                                       <RefreshCw className="h-5 w-5 animate-spin" />
                                       Generating Consultation Notes...
                                     </>
                                   ) : (
                                     <>
                                       <Stethoscope className="h-5 w-5" />
                                       Generate Consultation Notes
                                     </>
                                   )}
                                 </Button>
                                  {isLoadingTranscript && (
                                    <p className="text-sm text-muted-foreground flex items-center gap-2 justify-center">
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                      Loading transcript...
                                    </p>
                                  )}
                                  {!transcript && !isLoadingTranscript && (
                                    <p className="text-sm text-muted-foreground">
                                      No transcript available. Record or import a meeting first.
                                    </p>
                                  )}
                               </div>
                             </div>
                            ) : (
                              <div className="flex-1 overflow-auto">
                                <EnhancedSoapNotesDisplay
                                    shorthand={soapNotes?.shorthand}
                                    standard={soapNotes?.standard}
                                    summaryLine={soapNotes?.summary_line}
                                    patientCopy={soapNotes?.patient_copy}
                                    referral={soapNotes?.referral}
                                    review={soapNotes?.review}
                                    clinicalActions={soapNotes?.clinical_actions}
                                    consultationType={soapNotes?.consultation_type}
                                    onExport={async () => {
                                      try {
                                        toast.info('Generating consultation document...');
                                        await exportConsultationToWord({
                                          shorthand: soapNotes?.shorthand,
                                          standard: soapNotes?.standard,
                                          summaryLine: soapNotes?.summary_line,
                                          patientCopy: soapNotes?.patient_copy,
                                          referral: soapNotes?.referral,
                                          review: soapNotes?.review,
                                          clinicalActions: soapNotes?.clinical_actions,
                                          consultationType: soapNotes?.consultation_type,
                                          consultationDate: meeting?.start_time ? new Date(meeting.start_time) : new Date()
                                        });
                                        toast.success('Consultation document downloaded');
                                      } catch (error) {
                                        console.error('Export failed:', error);
                                        toast.error('Failed to export consultation document');
                                      }
                                    }}
                                    onEmailPatientCopy={() => {
                                      if (!soapNotes?.patient_copy) {
                                        toast.error('No patient letter available to email');
                                        return;
                                      }
                                      
                                      const consultDate = meeting?.start_time ? new Date(meeting.start_time) : new Date();
                                      const formattedDate = consultDate.toLocaleDateString('en-GB', { 
                                        weekday: 'long', 
                                        year: 'numeric', 
                                        month: 'long', 
                                        day: 'numeric' 
                                      });
                                      
                                      // Placeholder for the rest of the email logic
                                      setEmailModalOpen(true);
                                    }}
                                  />
                                </div>
                              )}
                         </div>
                       </TabsContent>
                    </Tabs>
                  </div>
                </div>
              </TabsContent>
               
               <TabsContent value="transcript" className="flex-1 overflow-hidden mt-0 bg-white">
                <Suspense fallback={
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                      <p className="text-sm text-muted-foreground">Loading transcript...</p>
                    </div>
                  </div>
                }>
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-1 px-3 pt-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                      <ChevronDown className="h-3 w-3" />
                      Pipeline Details
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pt-1 flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Meeting QC:</span>
                        <NotesGenerationBadges metadata={generationMetadata} meetingTitle={meeting?.title} />
                        {meeting?.id && (
                          <>
                            <span className="text-xs font-medium text-muted-foreground ml-1">Recorded on:</span>
                            <RecordingDeviceBadge meetingId={meeting.id} />
                          </>
                        )}
                      </div>
                      <div className="px-3 pt-1 pb-1 flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Render Times:</span>
                        <ProcessingTimeBadges noteTiming={generationMetadata?.timing} consolidationTiming={consolidationTiming} />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  <TranscriptTabContent
                    meetingId={meeting?.id || ''}
                    transcript={transcript}
                    isLargeTranscript={isLargeTranscript}
                    meeting={meeting}
                    onTranscriptChange={(newTranscript) => {
                      setTranscript(newTranscript);
                      saveTranscriptToDatabase(newTranscript);
                    }}
                    onShowContextDialog={() => setShowContextDialog(true)}
                  />
                </Suspense>
                </TabsContent>
              </Tabs>
           </div>
         </div>
       </DialogContent>

        {/* Custom AI Prompt Modal */}
        <CustomAIPromptModal
          open={showCustomAIModal}
          onOpenChange={setShowCustomAIModal}
          onSubmit={handleCustomAISubmit}
          currentText={getCurrentContent()}
        />

        {/* Transcript Context Dialog */}
        <TranscriptContextDialog
          open={showContextDialog}
          onOpenChange={(open) => {
            console.log('🟢 Dialog open state changed to:', open);
            setShowContextDialog(open);
          }}
          onAddContext={(contextTypes, files, customLabel) => {
            console.log('🟡 Adding context:', { contextTypes, filesCount: files.length, customLabel });
            
            // Check if this is an "additional-transcript" type
            if (contextTypes.includes('additional-transcript')) {
              // Extract just the content and append it directly
              const additionalContent = files.map(file => file.content || '').join('\n\n');
              const currentTranscript = transcript || '';
              const updatedTranscript = currentTranscript + '\n\n' + additionalContent;
              setTranscript(updatedTranscript);
              saveTranscriptToDatabase(updatedTranscript);
              toast.success('Additional transcript appended and saved');
            } else {
              // Regular context formatting
              const formattedContext = formatTranscriptContext(contextTypes.filter(t => t !== 'additional-transcript') as Array<'agenda' | 'attendees' | 'presentation' | 'other'>, files, customLabel);
              const currentTranscript = transcript || '';
              const updatedTranscript = formattedContext + currentTranscript;
              setTranscript(updatedTranscript);
              saveTranscriptToDatabase(updatedTranscript);
              toast.success('Context added and saved to transcript');
            }
          }}
        />

      </Dialog>
      
      <MeetingMinutesEmailModal
        isOpen={emailModalOpen}
        onOpenChange={setEmailModalOpen}
        defaultToEmail={emailModalContent.toEmail}
        defaultSubject={emailModalContent.subject}
        defaultBody={emailModalContent.body}
        meetingTitle={meeting?.title || 'Meeting'}
        meetingDate={meeting?.start_time ? new Date(meeting.start_time).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}
        meetingId={meeting?.id}
      />

      {/* Professional Email Modal for Standard View */}
      <EmailMeetingMinutesModal
        isOpen={standardEmailModalOpen}
        onOpenChange={setStandardEmailModalOpen}
        meetingId={standardEmailContent.meetingId}
        meetingTitle={standardEmailContent.meetingTitle}
        meetingNotes={standardEmailContent.meetingNotes}
      />

      {/* Attendee Modal */}
      {meeting && (
        <LiveImportModal
          open={attendeeModalOpen}
          onOpenChange={setAttendeeModalOpen}
          defaultTab="attendees"
          meetingId={meeting.id}
        />
      )}
    </>
  );
};