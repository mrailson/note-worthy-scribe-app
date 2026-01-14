import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import wordIcon from '@/assets/word-icon.png';
import { useTextSelection } from '@/hooks/useTextSelection';
import { SelectionFindReplacePopup } from '@/components/SelectionFindReplacePopup';
import powerpointIcon from '@/assets/powerpoint-icon.png';
import infographicIcon from '@/assets/infographic-icon.png';
import { MeetingPowerPointModal } from '@/components/meeting-details/MeetingPowerPointModal';
import { MeetingInfographicModal } from '@/components/meeting-details/MeetingInfographicModal';
import { QuickAudioSummaryModal } from '@/components/meeting-details/QuickAudioSummaryModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  X, 
  Copy, 
  Check, 
  FileText, 
  MessageSquare, 
  ZoomIn, 
  ZoomOut,
  Download,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertCircle,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  CheckCircle2,
  Circle,
  Timer,
  Users,
  Search,
  Video,
  UserCheck,
  Headphones,
  FileDown,
  Pencil,
  Trash2,
  CalendarDays,
  ChevronRight,
  User,
  Settings2,
  Mail,
  Sparkles,
  Palette,
  Target,
  ListChecks,
  Lightbulb,
  BarChart3,
  Layout,
  Zap,
  Eye,
  Focus,
  ArrowRight,
  Presentation,
  Briefcase,
  GraduationCap,
  TrendingUp,
  ClipboardList,
  MessageCircle,
  Award,
  Layers,
  PieChart,
  Hash
} from "lucide-react";
import { MEETING_DETAIL_LEVELS } from "@/constants/meetingNotesSettings";

import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format, addDays, nextFriday, nextMonday } from "date-fns";
import { MeetingQAPanel } from "@/components/meeting-details/MeetingQAPanel";
import { MeetingActionItemsTab } from "@/components/meeting-details/MeetingActionItemsTab";
import { InlineActionItemsTable } from "@/components/meeting-details/InlineActionItemsTable";
import { MeetingAudioStudio } from "@/components/meeting-details/MeetingAudioStudio";
import { MeetingDocumentsList } from "@/components/MeetingDocumentsList";
import { useActionItemsCount } from "@/hooks/useActionItemsCount";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateProfessionalWordFromContent, ParsedMeetingDetailsInput, ParsedActionItemInput } from "@/utils/generateProfessionalMeetingDocx";
import { sanitiseMeetingNotes } from "@/utils/sanitiseMeetingNotes";
import EditableSection, { Section } from "@/components/scribe/EditableSection";
import InteractiveNotesContent from "@/components/meeting-notes/InteractiveNotesContent";
import EnhancedFindReplacePanel from "@/components/EnhancedFindReplacePanel";
import { MeetingAttendeeModal } from "@/components/MeetingAttendeeModal";
import { syncTranscriptCorrections } from "@/utils/transcriptCorrectionSync";
import { EmailMeetingMinutesModal } from "@/components/EmailMeetingMinutesModal";
import { useNotesViewSettings } from "@/hooks/useNotesViewSettings";
import { NotesViewSettingsPopover } from "@/components/meeting-details/NotesViewSettingsPopover";

interface Meeting {
  id: string;
  title: string;
  meeting_summary?: string;
  transcript?: string;
}

interface SafeModeNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: Meeting | null;
  notes: string;
}

export const SafeModeNotesModal: React.FC<SafeModeNotesModalProps> = ({
  isOpen,
  onClose,
  meeting,
  notes
}) => {
  // State
  const [activeTab, setActiveTab] = useState<'notes' | 'transcript' | 'actions' | 'ask-ai' | 'audio' | 'documents'>('notes');
  
  // Get action items count for badge
  const { openItemsCount } = useActionItemsCount(meeting?.id || '');
  
  // Notes view settings (section visibility)
  const notesViewSettings = useNotesViewSettings();
  
  // Document count for badge
  const [documentCount, setDocumentCount] = useState<number>(0);
  
  // Fetch document count
  useEffect(() => {
    const fetchDocumentCount = async () => {
      if (!meeting?.id) return;
      try {
        const { count, error } = await supabase
          .from('meeting_documents')
          .select('*', { count: 'exact', head: true })
          .eq('meeting_id', meeting.id);

        if (error) {
          console.error('Error fetching document count:', error);
          return;
        }

        setDocumentCount(count || 0);
      } catch (error) {
        console.error('Error fetching document count:', error);
      }
    };

    if (isOpen && meeting?.id) {
      fetchDocumentCount();
    }
  }, [isOpen, meeting?.id]);
  const [notesContent, setNotesContent] = useState(notes);
  const [transcript, setTranscript] = useState('');
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'plain' | 'formatted'>('formatted');
  const [fontSize, setFontSize] = useState(14);
  const [copied, setCopied] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  
  // Section-based editing state
  const [sections, setSections] = useState<Section[]>([]);
  const [isSavingSections, setIsSavingSections] = useState(false);
  const [showTranscriptFindReplace, setShowTranscriptFindReplace] = useState(false);
  const [showNotesFindReplace, setShowNotesFindReplace] = useState(false);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [showPptModal, setShowPptModal] = useState(false);
  const [pptOptions, setPptOptions] = useState<{
    style: string;
    content: string;
    slideCount: number;
  } | null>(null);
  const [showInfographicModal, setShowInfographicModal] = useState(false);
  const [infographicOptions, setInfographicOptions] = useState<{
    style: string;
    detailLevel: string;
    focusArea: string;
  } | null>(null);
  const [showQuickAudioModal, setShowQuickAudioModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [meetingType, setMeetingType] = useState<'teams' | 'f2f' | 'hybrid'>('teams');
  
  // Refs for selection-based find/replace
  const notesContentRef = useRef<HTMLDivElement>(null);
  const transcriptContentRef = useRef<HTMLDivElement>(null);
  
  // Track when a local edit is in progress to prevent auto-sync from overwriting
  const isLocalEditInProgressRef = useRef(false);
  
  // Text selection hooks for inline find/replace
  const { selection: notesSelection, clearSelection: clearNotesSelection } = useTextSelection(notesContentRef, { maxWords: 3 });
  const { selection: transcriptSelection, clearSelection: clearTranscriptSelection } = useTextSelection(transcriptContentRef, { maxWords: 3 });
  const [isSavingMeetingType, setIsSavingMeetingType] = useState(false);
  
  // Location/Venue editing state
  const [meetingLocation, setMeetingLocation] = useState<string | null>(null);
  const [userPractices, setUserPractices] = useState<Array<{id: string, practice_name: string}>>([]);
  const [customLocationInput, setCustomLocationInput] = useState('');
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  
  // Action item management state
  const [editingActionItem, setEditingActionItem] = useState<{ original: string; text: string } | null>(null);
  const [showCustomOwnerInput, setShowCustomOwnerInput] = useState(false);
  const [customOwner, setCustomOwner] = useState('');
  
  // Control mode toggle state (fontSize vs detailLevel)
  const [controlMode, setControlMode] = useState<'fontSize' | 'detailLevel'>('fontSize');
  const [detailLevel, setDetailLevel] = useState<number>(3); // Default: Standard
  const [isRegeneratingNotes, setIsRegeneratingNotes] = useState(false);

  // Regenerate notes at a new detail level
  const triggerRegeneration = useCallback(async (newLevel: number) => {
    if (!meeting?.id) {
      toast.error('No meeting available to regenerate notes');
      return;
    }
    
    setIsRegeneratingNotes(true);
    
    try {
      const levelConfig = MEETING_DETAIL_LEVELS.find(l => l.value === newLevel);
      const levelLabel = levelConfig?.label || 'Standard';
      toast.info(`Regenerating notes at ${levelLabel} detail level...`);
      
      const { data, error } = await supabase.functions.invoke('auto-generate-meeting-notes', {
        body: { 
          meetingId: meeting.id,
          forceRegenerate: true,
          detailLevel: levelLabel.toLowerCase()
        }
      });
      
      if (error) throw error;
      
      // Update local notes content with regenerated notes
      if (data?.content) {
        setNotesContent(data.content);
        toast.success(`Notes regenerated at ${levelLabel} detail level`);
      } else {
        // Fetch the updated notes from the database
        const { data: updatedMeeting } = await supabase
          .from('meetings')
          .select('notes_style_3')
          .eq('id', meeting.id)
          .single();
          
        if (updatedMeeting?.notes_style_3) {
          setNotesContent(sanitiseMeetingNotes(updatedMeeting.notes_style_3));
          toast.success(`Notes regenerated at ${levelLabel} detail level`);
        } else {
          toast.success('Notes regenerated - refresh to see updates');
        }
      }
    } catch (error) {
      console.error('Failed to regenerate notes:', error);
      toast.error('Failed to regenerate notes');
    } finally {
      setIsRegeneratingNotes(false);
    }
  }, [meeting?.id]);

  // Convert DB meeting_format to local meetingType
  const mapFormatToType = (format: string | null): 'teams' | 'f2f' | 'hybrid' => {
    if (!format) return 'teams';
    const lower = format.toLowerCase();
    if (lower === 'f2f' || lower === 'face-to-face' || lower === 'in-person') return 'f2f';
    if (lower === 'hybrid') return 'hybrid';
    return 'teams';
  };

  // Convert local meetingType to DB format
  const mapTypeToFormat = (type: 'teams' | 'f2f' | 'hybrid'): string => {
    switch (type) {
      case 'f2f': return 'face-to-face';
      case 'hybrid': return 'hybrid';
      default: return 'virtual';
    }
  };

  // Save meeting type to database
  const handleMeetingTypeChange = async (value: 'teams' | 'f2f' | 'hybrid') => {
    if (!meeting?.id) return;
    
    setMeetingType(value);
    setIsSavingMeetingType(true);
    
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ meeting_format: mapTypeToFormat(value) })
        .eq('id', meeting.id);

      if (error) throw error;
      
      setMeetingFormat(mapTypeToFormat(value));
      toast.success('Meeting type updated');
    } catch (error) {
      console.error('Error saving meeting type:', error);
      toast.error('Failed to save meeting type');
    } finally {
      setIsSavingMeetingType(false);
    }
  };

  // Save meeting location to database
  const handleLocationChange = async (location: string) => {
    if (!meeting?.id) return;
    
    setIsSavingLocation(true);
    setMeetingLocation(location);
    
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ meeting_location: location })
        .eq('id', meeting.id);

      if (error) throw error;
      toast.success('Venue updated');
    } catch (error) {
      console.error('Error saving location:', error);
      toast.error('Failed to save venue');
    } finally {
      setIsSavingLocation(false);
      setLocationDropdownOpen(false);
      setCustomLocationInput('');
    }
  };

  // Fetch user's practices for location dropdown
  useEffect(() => {
    const fetchUserPractices = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Get user's associated practice IDs using the RPC function
      const { data: practiceIds } = await supabase.rpc('get_user_practice_ids', {
        p_user_id: user.id
      });
      
      if (practiceIds && practiceIds.length > 0) {
        const { data: practices } = await supabase
          .from('gp_practices')
          .select('id, name')
          .in('id', practiceIds);
        
        if (practices) {
          setUserPractices(practices.map(p => ({ id: p.id, practice_name: p.name || '' })));
        }
      }
    };
    
    if (isOpen) {
      fetchUserPractices();
    }
  }, [isOpen]);

  // Refresh attendees from database
  const refreshAttendees = useCallback(async () => {
    if (!meeting?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('meeting_attendees')
        .select(`
          meeting_role,
          attendees:attendee_id (
            name,
            role,
            organization
          )
        `)
        .eq('meeting_id', meeting.id);

      if (error) {
        console.error('Error refreshing attendees:', error);
        return;
      }

      if (data && data.length > 0) {
        const parsedAttendees = data
          .filter(item => item.attendees)
          .map(item => ({
            name: (item.attendees as any).name,
            role: item.meeting_role || (item.attendees as any).role,
            organization: (item.attendees as any).organization
          }));
        setAttendees(parsedAttendees);
      } else {
        setAttendees([]);
      }
    } catch (error) {
      console.error('Error refreshing attendees:', error);
    }
  }, [meeting?.id]);

  // Handle attendee modal close - refresh attendees
  const handleAttendeeModalClose = () => {
    setShowAttendeeModal(false);
    refreshAttendees();
  };

  // Save notes content to database (for Find & Replace)
  const persistNotesContent = useCallback(async (updatedContent: string) => {
    if (!meeting?.id) return;
    
    // Mark that a local edit is in progress to prevent auto-sync from overwriting
    isLocalEditInProgressRef.current = true;
    
    try {
      const response = await supabase.functions.invoke('persist-standard-minutes', {
        body: { meetingId: meeting.id, content: updatedContent }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to save');
      }

      setNotesContent(updatedContent);
      toast.success('Notes updated');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save notes');
    } finally {
      // Clear the flag after a delay to allow any triggered effects to see it
      setTimeout(() => {
        isLocalEditInProgressRef.current = false;
      }, 2000);
    }
  }, [meeting?.id]);

  // Update meeting title in database (for Find & Replace)
  const updateMeetingTitle = useCallback(async (newTitle: string) => {
    if (!meeting?.id || !newTitle.trim()) return;
    
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ title: newTitle.trim() })
        .eq('id', meeting.id);
      
      if (error) throw error;
      
      // Update local meeting object if possible (parent component may handle this)
      console.log('[FindReplace] Meeting title updated to:', newTitle.trim());
    } catch (error) {
      console.error('Error updating meeting title:', error);
      toast.error('Failed to update meeting title');
    }
  }, [meeting?.id]);

  // Parse notes content into sections
  const parseNotesIntoSections = useCallback((content: string): Section[] => {
    if (!content) return [];
    
    const sectionHeadings = [
      'EXECUTIVE SUMMARY',
      'KEY DECISIONS',
      // Accept common variants produced by AI models
      'KEY POINTS',
      'KEY DISCUSSION',
      'KEY DISCUSSION POINTS',
      'KEY HIGHLIGHTS',
      'KEY TAKEAWAYS',
      'NEXT STEPS',
      'NOTES',
      'ADDITIONAL NOTES',
    ];
    
    // Sections to explicitly exclude from formatted view
    const excludedHeadings = [
      'DISCUSSION SUMMARY',
      'NEXT MEETING',
      'ACTION ITEMS',
      'MEETING DETAILS',
      'ATTENDEES',
    ];
    
    // Implicit heading patterns (plain text lines that should start a Key Points section)
    // Matches: "Key Points", "Key Points:", "**Key Points**", "**Key Points:**", etc.
    const implicitKeyPointsPattern = /^\s*(?:\*\*)?(?:Key\s+(?:Points|Discussion|Discussion\s+Points|Highlights|Takeaways))(?:\*\*)?:?\s*$/i;
    
    const result: Section[] = [];
    const lines = content.split('\n');
    let currentSection: { heading: string; lines: string[] } | null = null;
    let skipCurrentSection = false;
    
    const pushCurrentSection = () => {
      if (currentSection && !skipCurrentSection && currentSection.lines.join('').trim()) {
        result.push({
          id: crypto.randomUUID(),
          heading: currentSection.heading,
          content: currentSection.lines.join('\n').trim(),
          originalIndex: result.length
        });
      }
    };
    
    for (const line of lines) {
      // Check for markdown heading (# through ######)
      const headingMatch = line.match(/^\s*#{1,6}\s+(.+)$/);
      if (headingMatch) {
        const heading = headingMatch[1].trim().toUpperCase();
        
        // Check if this heading should be excluded
        if (excludedHeadings.some(h => heading.includes(h))) {
          pushCurrentSection();
          currentSection = null;
          skipCurrentSection = true;
          continue;
        }
        
        // Check if this is a known section heading
        if (sectionHeadings.some(h => heading.includes(h))) {
          pushCurrentSection();
          currentSection = { heading: headingMatch[1].trim(), lines: [] };
          skipCurrentSection = false;
          continue;
        }
      }
      
      // Check for implicit Key Points heading (plain text without #)
      if (implicitKeyPointsPattern.test(line)) {
        pushCurrentSection();
        // Normalise to "Key Points" for consistency
        currentSection = { heading: 'Key Points', lines: [] };
        skipCurrentSection = false;
        continue;
      }
      
      if (currentSection && !skipCurrentSection) {
        currentSection.lines.push(line);
      }
    }
    
    // Push last section if it wasn't excluded
    pushCurrentSection();
    
    // Sort sections by preferred display order (Executive Summary first, then Key Points, etc.)
    const displayOrder = [
      'EXECUTIVE SUMMARY',
      'KEY POINTS',
      'KEY DISCUSSION',
      'KEY DISCUSSION POINTS',
      'KEY HIGHLIGHTS',
      'KEY TAKEAWAYS',
      'KEY DECISIONS',
      'NEXT STEPS',
      'NOTES',
      'ADDITIONAL NOTES',
    ];
    
    result.sort((a, b) => {
      const aUpper = a.heading.toUpperCase();
      const bUpper = b.heading.toUpperCase();
      const aIndex = displayOrder.findIndex(h => aUpper.includes(h));
      const bIndex = displayOrder.findIndex(h => bUpper.includes(h));
      // If both found, sort by order; if one not found, push it to end
      const aOrder = aIndex >= 0 ? aIndex : displayOrder.length;
      const bOrder = bIndex >= 0 ? bIndex : displayOrder.length;
      return aOrder - bOrder;
    });
    
    return result;
  }, []);

  // Rebuild notes content from sections
  const rebuildNotesFromSections = useCallback((updatedSections: Section[], originalContent: string): string => {
    // Keep everything before the first editable section and after the last one
    const sectionHeadings = [
      'EXECUTIVE SUMMARY',
      'KEY DECISIONS',
      // Accept common variants produced by AI models
      'KEY POINTS',
      'KEY DISCUSSION',
      'KEY DISCUSSION POINTS',
      'KEY HIGHLIGHTS',
      'KEY TAKEAWAYS',
      'NEXT STEPS',
      'NOTES',
      'ADDITIONAL NOTES',
    ];
    
    // Implicit heading patterns (plain text lines that should be treated as section boundaries)
    const implicitKeyPointsPattern = /^\s*(?:\*\*)?(?:Key\s+(?:Points|Discussion|Discussion\s+Points|Highlights|Takeaways))(?:\*\*)?:?\s*$/i;
    
    const lines = originalContent.split('\n');
    const result: string[] = [];
    let skipUntilNextSection = false;
    
    for (const line of lines) {
      // Check for markdown heading (# through ######)
      const headingMatch = line.match(/^\s*#{1,6}\s+(.+)$/);
      if (headingMatch) {
        const heading = headingMatch[1].trim().toUpperCase();
        const isEditable = sectionHeadings.some(h => heading.includes(h));
        
        if (isEditable) {
          skipUntilNextSection = true;
          continue;
        } else {
          skipUntilNextSection = false;
        }
      }
      
      // Check for implicit Key Points heading (plain text without #)
      if (implicitKeyPointsPattern.test(line)) {
        skipUntilNextSection = true;
        continue;
      }
      
      if (!skipUntilNextSection) {
        result.push(line);
      }
    }
    
    // Find where to insert sections (after meeting details, before action items)
    const actionItemsIndex = result.findIndex(l => /##?\s*Action\s+Items?/i.test(l));
    const insertIndex = actionItemsIndex > 0 ? actionItemsIndex : result.length;
    
    // Build section content with canonical ## headings
    const sectionContent = updatedSections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n');
    
    // Insert sections
    result.splice(insertIndex, 0, sectionContent);
    
    return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }, []);

  // Reset state when modal opens with new meeting
  // Note: We intentionally exclude 'notes' prop from dependencies to prevent
  // resetting content when parent re-renders. The database fetch is the source of truth.
  useEffect(() => {
    if (isOpen && meeting) {
      // Seed notes immediately from props (temporary until database fetch completes)
      const initialNotes = notes || meeting.meeting_summary || '';
      setNotesContent(initialNotes);
      setActiveTab('notes');
      setTranscript('');
      setTranscriptError(null);
      setViewMode('formatted');
      setCopied(false);
      setAttendees([]);
      setMeetingFormat(null);
      setMeetingLocation(null);
      setIsSavingSections(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, meeting?.id]);

  // Parse sections whenever notesContent changes
  useEffect(() => {
    if (notesContent) {
      const parsed = parseNotesIntoSections(notesContent);
      setSections(parsed);
    } else {
      setSections([]);
    }
  }, [notesContent, parseNotesIntoSections]);

  // Store meeting format from database
  const [meetingFormat, setMeetingFormat] = useState<string | null>(null);
  
  // Store attendees from database
  const [attendees, setAttendees] = useState<Array<{ name: string; role?: string | null; organization?: string | null }>>([]);

  // Fetch fresh notes and attendees in background (non-blocking)
  useEffect(() => {
    if (!isOpen || !meeting?.id) return;

    setIsLoadingNotes(true);
    
    // Fetch notes and meeting format
    const fetchNotes = async () => {
      try {
        // First try meetings table for notes_style_3, meeting_format, and meeting_location
        const { data: meetingData } = await supabase
          .from('meetings')
          .select('notes_style_3, meeting_format, meeting_location')
          .eq('id', meeting.id)
          .maybeSingle();

        if (meetingData?.meeting_format) {
          setMeetingFormat(meetingData.meeting_format);
          setMeetingType(mapFormatToType(meetingData.meeting_format));
        }
        
        if (meetingData?.meeting_location) {
          setMeetingLocation(meetingData.meeting_location);
        }

        if (meetingData?.notes_style_3) {
          setNotesContent(sanitiseMeetingNotes(meetingData.notes_style_3));
          setIsLoadingNotes(false);
          return;
        }

        // Fallback to meeting_summaries
        const { data: summaryData } = await supabase
          .from('meeting_summaries')
          .select('summary')
          .eq('meeting_id', meeting.id)
          .maybeSingle();

        if (summaryData?.summary) {
          setNotesContent(sanitiseMeetingNotes(summaryData.summary));
        }
      } catch (error) {
        console.error('SafeMode: Error fetching notes:', error);
      } finally {
        setIsLoadingNotes(false);
      }
    };

    // Fetch attendees from database
    const fetchAttendees = async () => {
      try {
        const { data, error } = await supabase
          .from('meeting_attendees')
          .select(`
            meeting_role,
            attendees:attendee_id (
              name,
              role,
              organization
            )
          `)
          .eq('meeting_id', meeting.id);

        if (error) {
          console.error('SafeMode: Error fetching attendees:', error);
          return;
        }

        if (data && data.length > 0) {
          const parsedAttendees = data
            .filter(item => item.attendees)
            .map(item => ({
              name: (item.attendees as any).name,
              role: item.meeting_role || (item.attendees as any).role,
              organization: (item.attendees as any).organization
            }));
          setAttendees(parsedAttendees);
        }
      } catch (error) {
        console.error('SafeMode: Error fetching attendees:', error);
      }
    };

    // Fetch both in parallel
    fetchNotes();
    fetchAttendees();
  }, [isOpen, meeting?.id]);

  // Auto-sync action items to notes if action items exist but notes don't have an ACTION ITEMS section
  useEffect(() => {
    if (!isOpen || !meeting?.id || isLoadingNotes) return;
    
    // Skip if a local edit is in progress to prevent overwriting user changes
    if (isLocalEditInProgressRef.current) {
      console.log('[SafeMode] Skipping auto-sync - local edit in progress');
      return;
    }
    
    // Check if notes already have an action items section
    const hasActionItemsSection = notesContent && 
      /##?\s*action\s+items?/i.test(notesContent);
    
    if (hasActionItemsSection) return; // Already has action items, no need to sync
    
    // Check if there are action items in the database
    const checkAndSyncActionItems = async () => {
      // Double-check the flag before making the async call
      if (isLocalEditInProgressRef.current) {
        console.log('[SafeMode] Skipping auto-sync - local edit in progress (async check)');
        return;
      }
      
      try {
        const { count, error } = await supabase
          .from('meeting_action_items')
          .select('id', { count: 'exact', head: true })
          .eq('meeting_id', meeting.id);
        
        if (error || !count || count === 0) return; // No action items to sync
        
        // Check again before applying the result
        if (isLocalEditInProgressRef.current) {
          console.log('[SafeMode] Skipping auto-sync result - local edit in progress');
          return;
        }
        
        console.log(`[SafeMode] Found ${count} action items but notes missing ACTION ITEMS section - triggering sync`);
        
        // Call the sync edge function
        const { data, error: syncError } = await supabase.functions.invoke('sync-meeting-action-items', {
          body: { meetingId: meeting.id },
        });
        
        if (syncError) {
          console.error('[SafeMode] Auto-sync failed:', syncError);
          return;
        }
        
        // Final check before updating state
        if (isLocalEditInProgressRef.current) {
          console.log('[SafeMode] Skipping auto-sync state update - local edit in progress');
          return;
        }
        
        // Update notes content with synced action items
        if (data?.updatedSummary) {
          setNotesContent(sanitiseMeetingNotes(data.updatedSummary));
          console.log('[SafeMode] Action items synced to notes successfully');
        }
      } catch (error) {
        console.error('[SafeMode] Error checking/syncing action items:', error);
      }
    };
    
    checkAndSyncActionItems();
  }, [isOpen, meeting?.id, notesContent, isLoadingNotes]);
  const loadTranscript = useCallback(async () => {
    if (!meeting?.id || transcript || isLoadingTranscript) return;
    
    setIsLoadingTranscript(true);
    setTranscriptError(null);

    try {
      // First try live_transcript_text from meetings table
      const { data: meetingData } = await supabase
        .from('meetings')
        .select('live_transcript_text')
        .eq('id', meeting.id)
        .maybeSingle();

      if (meetingData?.live_transcript_text) {
        setTranscript(meetingData.live_transcript_text);
        setIsLoadingTranscript(false);
        return;
      }

      // Fallback to meeting_transcripts table
      const { data: transcriptData } = await supabase
        .from('meeting_transcripts')
        .select('content')
        .eq('meeting_id', meeting.id)
        .order('created_at', { ascending: true });

      if (transcriptData && transcriptData.length > 0) {
        const combinedTranscript = transcriptData
          .map(t => t.content)
          .filter(Boolean)
          .join('\n\n');
        setTranscript(combinedTranscript);
      } else {
        setTranscript('No transcript available for this meeting.');
      }
    } catch (error) {
      console.error('SafeMode: Error loading transcript:', error);
      setTranscriptError('Failed to load transcript. Please try again.');
    } finally {
      setIsLoadingTranscript(false);
    }
  }, [meeting?.id, transcript, isLoadingTranscript]);

  // Copy to clipboard
  const handleCopy = async () => {
    const content = activeTab === 'notes' ? notesContent : transcript;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  // Download as Word - use professional NHS-style formatting
  // Uses the raw notes content so the Word generator can handle section parsing
  const handleDownloadWord = async () => {
    // Use raw notesContent for Word export - the Word generator handles section parsing properly
    // This ensures Key Points and other sections are preserved correctly
    const content = activeTab === 'notes' ? notesContent : transcript;
    const title = meeting?.title || 'Meeting Notes';

    try {
      // Build parsed details to match modal view exactly
      const parsedDetails: ParsedMeetingDetailsInput = {
        title: meetingDetails?.title,
        date: meetingDetails?.date,
        time: meetingDetails?.time,
        location: meetingDetails?.location,
        venue: meetingType === 'teams' ? undefined : (meetingLocation || undefined),
        attendees: attendees.length > 0 
          ? attendees.map(a => a.name).join(', ')
          : undefined,
      };
      
      // Convert action items to the format expected by Word generator
      const parsedActionItemsForWord: ParsedActionItemInput[] = actionItems.map(item => ({
        action: item.action,
        owner: item.owner,
        deadline: item.deadline,
        priority: item.priority,
        status: item.status,
        isCompleted: item.isCompleted,
      }));
      
      // Use the professional document generator with pre-parsed data
      // Pass visibility settings so hidden sections are excluded from Word export
      await generateProfessionalWordFromContent(
        content, 
        title, 
        activeTab === 'notes' ? parsedDetails : undefined,
        activeTab === 'notes' ? parsedActionItemsForWord : undefined,
        activeTab === 'notes' ? notesViewSettings.settings.visibleSections : undefined
      );
      toast.success('Downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download');
    }
  };

  // Section editing handlers - combined change + persist to avoid stale state
  const handleSectionContentChangeAndSave = useCallback(async (sectionId: string, newContent: string): Promise<boolean> => {
    if (!meeting?.id) return false;
    
    // Compute updated sections synchronously
    const updatedSections = sections.map(s => 
      s.id === sectionId ? { ...s, content: newContent } : s
    );
    
    // Update local state immediately
    setSections(updatedSections);
    
    // Persist with the computed sections (not stale state)
    setIsSavingSections(true);
    try {
      const updatedContent = rebuildNotesFromSections(updatedSections, notesContent);
      
      const response = await supabase.functions.invoke('persist-standard-minutes', {
        body: { meetingId: meeting.id, content: updatedContent }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to save');
      }

      setNotesContent(updatedContent);
      return true;
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save notes');
      return false;
    } finally {
      setIsSavingSections(false);
    }
  }, [meeting?.id, sections, notesContent, rebuildNotesFromSections]);

  const handleSectionDelete = useCallback((sectionId: string) => {
    setSections(prev => {
      const updated = prev.filter(s => s.id !== sectionId);
      // Persist after delete
      persistSectionsToDb(updated);
      return updated;
    });
  }, []);

  const handleSectionMoveUp = useCallback((sectionId: string) => {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === sectionId);
      if (idx <= 0) return prev;
      const updated = [...prev];
      [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
      return updated;
    });
  }, []);

  const handleSectionMoveDown = useCallback((sectionId: string) => {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === sectionId);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const updated = [...prev];
      [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
      return updated;
    });
  }, []);

  // Persist sections - requires explicit sections array to avoid stale state
  const persistSectionsToDb = useCallback(async (sectionsToSave: Section[]): Promise<boolean> => {
    if (!meeting?.id) return false;
    
    setIsSavingSections(true);
    try {
      const updatedContent = rebuildNotesFromSections(sectionsToSave, notesContent);
      
      const response = await supabase.functions.invoke('persist-standard-minutes', {
        body: { meetingId: meeting.id, content: updatedContent }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to save');
      }

      setNotesContent(updatedContent);
      return true;
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save notes');
      return false;
    } finally {
      setIsSavingSections(false);
    }
  }, [meeting?.id, notesContent, rebuildNotesFromSections]);

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value as 'notes' | 'transcript' | 'actions' | 'ask-ai' | 'audio' | 'documents');
    if (value === 'transcript' && !transcript && !isLoadingTranscript) {
      loadTranscript();
    }
  };

  // Ref to gate spurious close events - only allow close when user explicitly requests it
  const closeRequestedRef = useRef(false);

  // Handle modal close - sets the flag and calls onClose
  const handleClose = useCallback(() => {
    closeRequestedRef.current = true;
    onClose();
  }, [onClose]);

  // Handle onOpenChange from Radix Dialog - only close if explicitly requested
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      // Only close if the user explicitly requested it (via handleClose or Escape)
      if (closeRequestedRef.current) {
        closeRequestedRef.current = false; // Reset for next time
        onClose();
      }
      // Otherwise ignore the close request (spurious Radix event)
    }
  }, [onClose]);
  const meetingDetails = useMemo(() => {
    if (!notesContent) return null;
    
    // Match patterns only at start of line (with optional leading whitespace, bullets, and markdown bold)
    // to avoid matching words like "date" in the middle of sentences.
    const titleMatch = notesContent.match(
      /^\s*[-•*]?\s*\*{0,2}(?:Meeting\s*)?(?:Title|Subject)\*{0,2}(?:\s*[:\-–—]\s*|\s+)(.+?)(?:\n|$)/im
    );
    const dateMatch = notesContent.match(
      /^\s*[-•*]?\s*\*{0,2}(?:Meeting\s*)?Date\*{0,2}(?:\s*[:\-–—]\s*|\s+)(.+?)(?:\n|$)/im
    );
    const timeMatch = notesContent.match(
      /^\s*[-•*]?\s*\*{0,2}(?:Meeting\s*)?(?:Time|Start\s*Time)\*{0,2}(?:\s*[:\-–—]\s*|\s+)(.+?)(?:\n|$)/im
    );
    const locationMatch = notesContent.match(
      /^\s*[-•*]?\s*\*{0,2}(?:Location|Meeting\s*Type|Format)\*{0,2}(?:\s*[:\-–—]\s*|\s+)(.+?)(?:\n|$)/im
    );
    
    // Strip markdown formatting (** bold markers) from extracted values
    const cleanValue = (val?: string) => val?.trim().replace(/\*\*/g, '');
    
    // Use meetingFormat from DB if available, otherwise fall back to content parsing
    const formatFromDb = meetingFormat ? 
      meetingFormat.charAt(0).toUpperCase() + meetingFormat.slice(1).replace(/-/g, ' ') : 
      null;
    
    // For location: prefer DB meeting format (Hybrid, F2F, Virtual), fallback to parsed content
    const locationValue = formatFromDb || cleanValue(locationMatch?.[1]);
    
    // Return object even if we only have location from DB (for the table to show)
    const hasAnyValue = titleMatch || dateMatch || timeMatch || locationValue;
    if (!hasAnyValue) return null;
    
    return {
      title: cleanValue(titleMatch?.[1]),
      date: cleanValue(dateMatch?.[1]),
      time: cleanValue(timeMatch?.[1]),
      location: locationValue,
    };
  }, [notesContent, meetingFormat]);

  // Parse action items from content
  const actionItems = useMemo(() => {
    if (!notesContent) return [];
    
    const items: Array<{
      action: string;
      owner: string;
      deadline: string;
      priority: 'High' | 'Medium' | 'Low';
      status: 'Open' | 'In Progress' | 'Completed';
      isCompleted: boolean;
    }> = [];
    
    const seenActions = new Set<string>();
    
    // Helper to extract the primary owner from a line (handles @name.surname, plain names, or @INITIALS patterns)
    const extractOwners = (line: string): string => {
      const formatOwner = (raw: string): string => {
        const cleaned = raw.replace(/^@+/, '').trim();
        if (!cleaned) return 'TBC';

        // Dot-separated usernames (e.g. malcolm.railson)
        if (cleaned.includes('.')) {
          const parts = cleaned.split('.').filter(Boolean);
          if (parts.length >= 2) {
            return parts
              .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
              .join(' ');
          }
        }

        // Initials (e.g. M, MG, MR)
        if (/^[A-Za-z]{1,4}$/.test(cleaned)) {
          return cleaned.toUpperCase();
        }

        // Plain name
        return cleaned
          .replace(/\s+/g, ' ')
          .split(' ')
          .filter(Boolean)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
      };

      // Prefer the owner at the end of the line after a dash (our canonical format)
      const endOwnerMatch = line.match(
        /[—–-]\s*@?([A-Za-z][A-Za-z.'-]*(?:\.[A-Za-z][A-Za-z.'-]*)?(?:\s+[A-Za-z][A-Za-z.'-]*){0,4})\s*(?:\([^)]*\))?(?:\s*\[[^\]]*\])?(?:\s*\{[^}]*\})?\s*$/
      );
      if (endOwnerMatch) return formatOwner(endOwnerMatch[1]);

      // Fallback: any @first.last in the line
      const fullNameMatch = line.match(/@([a-zA-Z]+\.[a-zA-Z]+)/);
      if (fullNameMatch) return formatOwner(fullNameMatch[1]);

      return 'TBC';
    };
    
    // Helper to clean action text by removing owner references
    const cleanActionText = (text: string): string => {
      return text
        // Remove "— @owner.name" or "— @Owner" patterns at end (with or without following metadata)
        .replace(/\s*[—–-]\s*@[A-Za-z]+(?:\.[A-Za-z]+)?(?:\s*\([^)]*\))?(?:\s*\[[^\]]*\])?(?:\s*\{[^}]*\})?\s*$/g, '')
        // Remove " — .railson" or similar patterns (owner without @ prefix)
        .replace(/\s*[—–-]\s*\.?[a-zA-Z]+\.[a-zA-Z]+\s*$/g, '')
        // Remove "— @MR/CC" or "— @MR" patterns (initials with optional slash)
        .replace(/\s*[—–-]\s*@?[A-Z]{1,4}(?:\/[A-Z]{1,4})?\s*$/gi, '')
        // Remove starting @INITIALS patterns like "@M " at beginning of action
        .replace(/^@[A-Z]+\s+/g, '')
        // Remove status markers {Done}, {Open}, etc.
        .replace(/\{[^}]+\}/g, '')
        // Remove strikethrough markers
        .replace(/~~/g, '')
        // Remove trailing dashes (em dash, en dash, or hyphen)
        .replace(/\s*[—–-]+\s*$/g, '')
        // Clean up whitespace
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    // Extract Action Items section - match from heading until next main heading or end
    const actionSectionMatch = notesContent.match(/##?\s*Action\s+Items?\s*\n([\s\S]*?)(?=\n#{1,2}\s+[A-Z]|$)/i);
    
    if (actionSectionMatch) {
      const sectionContent = actionSectionMatch[1];
      const lines = sectionContent.split('\n');
      
      for (const line of lines) {
        // Skip empty lines
        if (!line.trim()) continue;
        
        // Check if it's a bullet point
        if (!/^[-•*]\s+/.test(line.trim())) continue;
        
        // Check for strikethrough (~~text~~) which indicates completed
        const hasStrikethrough = /~~.+~~/.test(line);
        
        // Check for {Done} or {Completed} status marker
        const statusMatch = line.match(/\{(Done|Completed|Open|In Progress|Active)\}/i);
        const explicitStatus = statusMatch?.[1]?.toLowerCase();
        
        // Extract owners from the line
        const owner = extractOwners(line);
        
        // Extract deadline (text in parentheses)
        const deadlineMatch = line.match(/\(([^)]+)\)/);
        const deadline = deadlineMatch?.[1]?.trim() || 'TBC';
        
        // Extract priority [High], [Medium], [Low]
        const priorityMatch = line.match(/\[(High|Medium|Low)\]/i);
        const priority = (priorityMatch?.[1] as 'High' | 'Medium' | 'Low') || 'Medium';
        
        // Clean the action text
        const rawText = line.replace(/^[-•*]\s+/, '').replace(/\([^)]+\)/g, '').replace(/\[(High|Medium|Low)\]/gi, '');
        const actionText = cleanActionText(rawText);
        
        // Skip if action text is too short or just "TBC"
        if (!actionText || actionText.length < 3 || actionText.toLowerCase() === 'tbc') continue;
        
        // Determine status
        let status: 'Open' | 'In Progress' | 'Completed' = 'Open';
        if (explicitStatus === 'done' || explicitStatus === 'completed' || hasStrikethrough) {
          status = 'Completed';
        } else if (explicitStatus === 'in progress' || explicitStatus === 'active') {
          status = 'In Progress';
        }
        
        const key = actionText.toLowerCase().substring(0, 50);
        if (!seenActions.has(key)) {
          seenActions.add(key);
          items.push({
            action: actionText,
            owner,
            deadline,
            priority: ['High', 'Medium', 'Low'].includes(priority) ? priority : 'Medium',
            status,
            isCompleted: status === 'Completed',
          });
        }
      }
    }
    
    return items;
  }, [notesContent]);

  // Get priority badge styling
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'High':
        return <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs">High</Badge>;
      case 'Medium':
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs">Medium</Badge>;
      case 'Low':
        return <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs">Low</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{priority}</Badge>;
    }
  };

  // Mark action item as closed
  const handleCloseActionItem = useCallback((actionText: string) => {
    if (!notesContent) return;
    
    const lines = notesContent.split('\n');
    const updatedLines = lines.map(line => {
      if (line.includes(actionText.substring(0, 30))) {
        if (!line.includes('~~') && !line.includes('[Completed]') && !line.includes('[Done]')) {
          return line.replace(/(\s*[-•*]?\s*)(.+)/, '$1~~$2~~ [Completed]');
        }
      }
      return line;
    });
    
    const updatedContent = updatedLines.join('\n');
    setNotesContent(updatedContent);
    persistNotesContent(updatedContent);
    toast.success('Action item marked as completed');
  }, [notesContent, persistNotesContent]);

  // Delete action item from notes
  const handleDeleteActionItem = useCallback((actionText: string) => {
    if (!notesContent) return;
    
    const lines = notesContent.split('\n');
    const updatedLines = lines.filter(line => !line.includes(actionText.substring(0, 30)));
    
    const updatedContent = updatedLines.join('\n');
    setNotesContent(updatedContent);
    persistNotesContent(updatedContent);
    toast.success('Action item deleted');
  }, [notesContent, persistNotesContent]);

  // Edit action item text
  const handleSaveEditedAction = useCallback((originalText: string, newText: string) => {
    if (!notesContent || !newText.trim()) return;
    
    const lines = notesContent.split('\n');
    const updatedLines = lines.map(line => {
      if (line.includes(originalText.substring(0, 30))) {
        return line.replace(originalText, newText.trim());
      }
      return line;
    });
    
    const updatedContent = updatedLines.join('\n');
    setNotesContent(updatedContent);
    persistNotesContent(updatedContent);
    setEditingActionItem(null);
    toast.success('Action item updated');
  }, [notesContent, persistNotesContent]);

  // Change action item priority
  const handleChangePriority = useCallback((actionText: string, newPriority: 'High' | 'Medium' | 'Low') => {
    if (!notesContent) return;
    
    const lines = notesContent.split('\n');
    const updatedLines = lines.map(line => {
      if (line.includes(actionText.substring(0, 30))) {
        // Remove existing priority markers
        let updatedLine = line.replace(/\[(High|Medium|Low)\]/gi, '');
        // Add new priority marker before the closing part
        const insertPoint = updatedLine.lastIndexOf(')') > -1 ? updatedLine.lastIndexOf(')') + 1 : updatedLine.length;
        updatedLine = updatedLine.slice(0, insertPoint) + ` [${newPriority}]` + updatedLine.slice(insertPoint);
        return updatedLine.replace(/\s+/g, ' ').trim();
      }
      return line;
    });
    
    const updatedContent = updatedLines.join('\n');
    setNotesContent(updatedContent);
    persistNotesContent(updatedContent);
    toast.success(`Priority changed to ${newPriority}`);
  }, [notesContent, persistNotesContent]);

  // Change action item owner
  const handleChangeOwner = useCallback((actionText: string, newOwnerRaw: string) => {
    if (!notesContent) return;

    const cleaned = newOwnerRaw.replace(/^@+/, '').trim();
    if (!cleaned) return;

    // Normalise dot-separated usernames (e.g. "malcolm.railson" -> "Malcolm Railson")
    const newOwner = cleaned.includes('.')
      ? cleaned
          .split('.')
          .filter(Boolean)
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
          .join(' ')
      : cleaned.replace(/\s+/g, ' ').trim();

    const separators = [' — ', ' – ', ' - '];

    const updatedLines = notesContent.split('\n').map((line) => {
      if (!line.includes(actionText.substring(0, 30))) return line;
      if (!/^[-•*]\s+/.test(line.trim())) return line;

      // If the line already has an owner segment (" — Owner"), replace just that segment.
      let bestIndex = -1;
      let bestSep = ' — ';
      for (const sep of separators) {
        const idx = line.lastIndexOf(sep);
        if (idx > bestIndex) {
          bestIndex = idx;
          bestSep = sep;
        }
      }

      const ownerSeparator = ' — ';
      const insertOwner = (left: string, meta: string) =>
        `${left.trimEnd()}${ownerSeparator}${newOwner}${meta ? ` ${meta.trimStart()}` : ''}`;

      if (bestIndex >= 0) {
        const left = line.slice(0, bestIndex);
        const right = line.slice(bestIndex + bestSep.length);

        // Preserve everything after the owner (deadline/priority/status) by finding first metadata token.
        const metaIdx = right.search(/\s*(\(|\[|\{)/);
        const meta = metaIdx >= 0 ? right.slice(metaIdx) : '';
        return insertOwner(left, meta);
      }

      // If no explicit owner separator exists yet, insert owner before existing metadata (or append).
      const metaIdx = line.search(/\s*(\(|\[|\{)/);
      if (metaIdx >= 0) {
        const left = line.slice(0, metaIdx);
        const meta = line.slice(metaIdx);
        return insertOwner(left, meta);
      }

      return insertOwner(line, '');
    });

    const updatedContent = updatedLines.join('\n');
    setNotesContent(updatedContent);
    persistNotesContent(updatedContent);
    setShowCustomOwnerInput(false);
    setCustomOwner('');
    toast.success(`Owner changed to ${newOwner}`);
  }, [notesContent, persistNotesContent]);

  // Change action item deadline
  const handleChangeDeadline = useCallback((actionText: string, newDeadline: string) => {
    if (!notesContent) return;
    
    const lines = notesContent.split('\n');
    const updatedLines = lines.map(line => {
      if (line.includes(actionText.substring(0, 30))) {
        // Remove existing deadline in parentheses
        let updatedLine = line.replace(/\([^)]+\)/g, '');
        // Add new deadline at the end, before any priority marker
        const priorityMatch = updatedLine.match(/\[(High|Medium|Low)\]/i);
        if (priorityMatch) {
          updatedLine = updatedLine.replace(priorityMatch[0], `(${newDeadline}) ${priorityMatch[0]}`);
        } else {
          updatedLine = updatedLine.trim() + ` (${newDeadline})`;
        }
        return updatedLine.replace(/\s+/g, ' ').trim();
      }
      return line;
    });
    
    const updatedContent = updatedLines.join('\n');
    setNotesContent(updatedContent);
    persistNotesContent(updatedContent);
    toast.success(`Deadline changed to ${newDeadline}`);
  }, [notesContent, persistNotesContent]);

  // Get deadline quick options
  const getDeadlineOptions = () => {
    const today = new Date();
    return [
      { label: 'Today', value: format(today, 'd MMM yyyy') },
      { label: 'End of Week', value: format(nextFriday(today), 'd MMM yyyy') },
      { label: 'ASAP', value: 'ASAP' },
      { label: 'Next Week', value: format(nextMonday(addDays(today, 1)), 'd MMM yyyy') },
      { label: 'By Next Meeting', value: 'By next meeting' },
      { label: 'Ongoing', value: 'Ongoing' },
      { label: 'TBC', value: 'TBC' },
    ];
  };

  // Get status badge styling - with comprehensive popover for Open status
  const getStatusBadge = (status: string, actionItem?: { action: string; owner: string; deadline: string; priority: string }) => {
    switch (status) {
      case 'Completed':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Done
          </Badge>
        );
      case 'In Progress':
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs gap-1">
            <Timer className="h-3 w-3" />
            In Progress
          </Badge>
        );
      case 'Open':
      default:
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Badge 
                className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs gap-1 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Circle className="h-3 w-3" />
                Open
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {/* Edit */}
              <DropdownMenuItem
                onClick={() => actionItem && setEditingActionItem({ original: actionItem.action, text: actionItem.action })}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              
              {/* Delete */}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => actionItem && handleDeleteActionItem(actionItem.action)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Priority Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Priority
                  {actionItem?.priority && (
                    <Badge 
                      variant="outline" 
                      className={`ml-auto text-xs py-0 ${
                        actionItem.priority === 'High' ? 'border-red-500 text-red-600' :
                        actionItem.priority === 'Medium' ? 'border-amber-500 text-amber-600' :
                        'border-green-500 text-green-600'
                      }`}
                    >
                      {actionItem.priority}
                    </Badge>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={() => actionItem && handleChangePriority(actionItem.action, 'High')}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                  >
                    <span className="h-2 w-2 rounded-full bg-red-500 mr-2" />
                    High
                    {actionItem?.priority === 'High' && <Check className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => actionItem && handleChangePriority(actionItem.action, 'Medium')}
                    className="text-amber-600 focus:text-amber-600 focus:bg-amber-50 dark:focus:bg-amber-900/20"
                  >
                    <span className="h-2 w-2 rounded-full bg-amber-500 mr-2" />
                    Medium
                    {actionItem?.priority === 'Medium' && <Check className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => actionItem && handleChangePriority(actionItem.action, 'Low')}
                    className="text-green-600 focus:text-green-600 focus:bg-green-50 dark:focus:bg-green-900/20"
                  >
                    <span className="h-2 w-2 rounded-full bg-green-500 mr-2" />
                    Low
                    {actionItem?.priority === 'Low' && <Check className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              {/* Owner Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <User className="h-4 w-4 mr-2" />
                  Owner
                  {actionItem?.owner && actionItem.owner !== 'TBC' && (
                    <span className="ml-auto text-xs text-muted-foreground truncate max-w-20">
                      {actionItem.owner}
                    </span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                  {attendees.slice(0, 8).map((attendee, idx) => (
                    <DropdownMenuItem
                      key={idx}
                      onClick={() => actionItem && handleChangeOwner(actionItem.action, attendee.name)}
                    >
                      <User className="h-4 w-4 mr-2" />
                      <span className="truncate">{attendee.name}</span>
                      {attendee.role && (
                        <span className="ml-auto text-xs text-muted-foreground">({attendee.role})</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setShowCustomOwnerInput(true);
                      // Store the action item for later use
                      if (actionItem) {
                        setEditingActionItem({ original: actionItem.action, text: actionItem.action });
                      }
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Custom...
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              {/* Deadline Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Deadline
                  {actionItem?.deadline && actionItem.deadline !== 'TBC' && (
                    <span className="ml-auto text-xs text-muted-foreground truncate max-w-20">
                      {actionItem.deadline}
                    </span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {getDeadlineOptions().map((option) => (
                    <DropdownMenuItem
                      key={option.label}
                      onClick={() => actionItem && handleChangeDeadline(actionItem.action, option.value)}
                    >
                      <span>{option.label}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{option.value}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              {/* Mark as Completed */}
              <DropdownMenuItem
                className="text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50 dark:focus:bg-emerald-900/20"
                onClick={() => actionItem && handleCloseActionItem(actionItem.action)}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark as Completed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
    }
  };

  // Remove action items section from formatted content (we'll show it as a table)
  const contentWithoutActionItems = useMemo(() => {
    if (!notesContent) return '';
    
    // Remove Action Items section and everything after it until next ## heading
    let cleaned = notesContent;
    
    // Remove the action items section (since we display as table)
    cleaned = cleaned.replace(/##?\s*Action\s+Items?\s*\n[\s\S]*?(?=\n#{1,2}\s|$)/gi, '');
    
    // Remove Completed section too
    cleaned = cleaned.replace(/##?\s*Completed\s*(Items?)?\s*\n[\s\S]*?(?=\n#{1,2}\s|$)/gi, '');

    // Remove Discussion Summary section (covered by Executive Summary) - more precise regex
    cleaned = cleaned.replace(/##?\s*Discussion\s+Summary\s*\n[\s\S]*?(?=\n#{1,2}\s|$)/gi, '');
    
    // Remove meeting details section heading/label
    cleaned = cleaned.replace(/^#{1,6}\s*Meeting\s+Details\s*$/gim, '');
    cleaned = cleaned.replace(/^Meeting\s+Details\s*$/gim, '');
    cleaned = cleaned.replace(/^MEETING\s+DETAILS\s*$/gim, '');

    // Remove meeting details lines (we display as a table)
    cleaned = cleaned.replace(/^[-•*]?\s*\*{0,2}Meeting Title\*{0,2}[:\s]+.+$/gim, '');
    cleaned = cleaned.replace(/^[-•*]?\s*\*{0,2}Date\*{0,2}[:\s]+.+$/gim, '');
    cleaned = cleaned.replace(/^[-•*]?\s*\*{0,2}Time\*{0,2}[:\s]+.+$/gim, '');
    cleaned = cleaned.replace(/^[-•*]?\s*\*{0,2}Location\*{0,2}[:\s]+.+$/gim, '');

    // Remove Attendees section (now displayed in table)
    cleaned = cleaned.replace(/##?\s*ATTENDEES\s*\n[\s\S]*?(?=\n#{1,2}\s|$)/gi, '');
    cleaned = cleaned.replace(/##?\s*Attendees\s*\n[\s\S]*?(?=\n#{1,2}\s|$)/gi, '');
    // Remove standalone TBC bullet
    cleaned = cleaned.replace(/^[-•*]\s*TBC\s*$/gim, '');

    // Remove "Next Section" heading if present (no longer needed)
    cleaned = cleaned.replace(/##?\s*Next\s+Section\s*\n?/gi, '');
    
    // Clean up excessive newlines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
    
    return cleaned;
  }, [notesContent]);

  // Enhanced markdown to HTML converter with proper list handling
  const basicFormat = (text: string): string => {
    if (!text) return '';
    
    const lines = text.split('\n');
    const result: string[] = [];
    let inOrderedList = false;
    let inUnorderedList = false;
    let pendingListItem: { content: string; subItems: string[] } | null = null;
    
    const applyInlineFormatting = (content: string): string => {
      // Escape HTML first
      let escaped = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      // Apply bold
      escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
      // Apply italic (single asterisks not followed by another asterisk)
      escaped = escaped.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
      return escaped;
    };

    // Helper to flush pending numbered list item
    const flushPendingListItem = () => {
      if (pendingListItem) {
        let itemHtml = `<li class="pl-2 leading-relaxed text-muted-foreground">${pendingListItem.content}`;
        if (pendingListItem.subItems.length > 0) {
          itemHtml += `<ul class="list-disc pl-6 mt-2 space-y-1 marker:text-muted-foreground">`;
          for (const sub of pendingListItem.subItems) {
            itemHtml += `<li class="leading-relaxed text-muted-foreground">${sub}</li>`;
          }
          itemHtml += `</ul>`;
        }
        itemHtml += `</li>`;
        result.push(itemHtml);
        pendingListItem = null;
      }
    };

    // Helper to check if next non-empty line continues the ordered list
    const hasMoreNumberedItems = (fromIndex: number): boolean => {
      for (let j = fromIndex; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        if (nextLine === '') continue;
        if (/^\d+\.\s+/.test(nextLine)) return true;
        if (/^#{1,3}\s/.test(nextLine)) return false; // Header breaks list
        if (/^[-*•]\s+/.test(lines[j]) && !/^(\s{2,}|\t+)/.test(lines[j])) return false; // Top-level bullet breaks list
        // Sub-bullets or indented content don't break the list
        if (/^(\s{2,}|\t+)[-*•]\s+/.test(lines[j])) continue;
        return false;
      }
      return false;
    };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for headers first
      if (/^### (.*)$/.test(line)) {
        flushPendingListItem();
        if (inOrderedList) { result.push('</ol>'); inOrderedList = false; }
        if (inUnorderedList) { result.push('</ul>'); inUnorderedList = false; }
        const content = line.replace(/^### (.*)$/, '$1');
        result.push(`<h3 class="text-base font-semibold mt-5 mb-2 text-foreground">${applyInlineFormatting(content)}</h3>`);
        continue;
      }
      if (/^## (.*)$/.test(line)) {
        flushPendingListItem();
        if (inOrderedList) { result.push('</ol>'); inOrderedList = false; }
        if (inUnorderedList) { result.push('</ul>'); inUnorderedList = false; }
        const content = line.replace(/^## (.*)$/, '$1');
        result.push(`<h2 class="text-lg font-semibold mt-6 mb-3 text-primary">${applyInlineFormatting(content)}</h2>`);
        continue;
      }
      if (/^# (.*)$/.test(line)) {
        flushPendingListItem();
        if (inOrderedList) { result.push('</ol>'); inOrderedList = false; }
        if (inUnorderedList) { result.push('</ul>'); inUnorderedList = false; }
        const content = line.replace(/^# (.*)$/, '$1');
        result.push(`<h1 class="text-xl font-bold mt-6 mb-4 text-primary">${applyInlineFormatting(content)}</h1>`);
        continue;
      }
      
      // Check for numbered list items (1. Item, 2. Item, etc.)
      const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (numberedMatch) {
        // Flush previous numbered item first
        flushPendingListItem();
        if (inUnorderedList) { result.push('</ul>'); inUnorderedList = false; }
        if (!inOrderedList) {
          result.push('<ol class="list-decimal pl-6 space-y-3 my-4 marker:font-semibold marker:text-foreground">');
          inOrderedList = true;
        }
        // Start collecting this item and its potential sub-bullets
        pendingListItem = {
          content: applyInlineFormatting(numberedMatch[2]),
          subItems: []
        };
        continue;
      }
      
      // Check for indented sub-bullets (2+ spaces/tabs followed by -, *, •)
      const subBulletMatch = line.match(/^(\s{2,}|\t+)[-*•]\s+(.*)$/);
      if (subBulletMatch) {
        const content = applyInlineFormatting(subBulletMatch[2]);
        if (pendingListItem) {
          // Add to current numbered item's sub-bullets
          pendingListItem.subItems.push(content);
        } else if (inOrderedList) {
          // Orphan sub-bullet in ordered list context - render inline
          result.push(`<ul class="list-disc pl-6 mt-1 mb-1 space-y-1 marker:text-muted-foreground"><li class="leading-relaxed text-muted-foreground">${content}</li></ul>`);
        } else {
          // Not in any list context
          result.push(`<ul class="list-disc pl-6 mt-1 mb-1 space-y-1 marker:text-muted-foreground"><li class="leading-relaxed text-muted-foreground">${content}</li></ul>`);
        }
        continue;
      }
      
      // Check for bullet list items (-, *, •) - not indented (top-level bullets)
      const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
      if (bulletMatch) {
        flushPendingListItem();
        if (inOrderedList) { result.push('</ol>'); inOrderedList = false; }
        if (!inUnorderedList) {
          result.push('<ul class="list-disc pl-6 space-y-2 my-3 marker:text-muted-foreground">');
          inUnorderedList = true;
        }
        const content = applyInlineFormatting(bulletMatch[1]);
        result.push(`<li class="leading-relaxed text-muted-foreground">${content}</li>`);
        continue;
      }
      
      // Empty line handling - only close ordered list if no more numbered items follow
      if (line.trim() === '') {
        if (inOrderedList) {
          // Check if more numbered items follow
          if (!hasMoreNumberedItems(i + 1)) {
            flushPendingListItem();
            result.push('</ol>');
            inOrderedList = false;
          }
          // If more numbered items follow, keep the list open
        } else {
          if (inUnorderedList) { result.push('</ul>'); inUnorderedList = false; }
        }
        result.push('<div class="h-2"></div>');
        continue;
      }
      
      // Regular paragraph text
      flushPendingListItem();
      if (inOrderedList) { result.push('</ol>'); inOrderedList = false; }
      if (inUnorderedList) { result.push('</ul>'); inUnorderedList = false; }
      
      const formatted = applyInlineFormatting(line);
      result.push(`<p class="my-2 leading-relaxed text-muted-foreground">${formatted}</p>`);
    }
    
    // Close any open lists
    flushPendingListItem();
    if (inOrderedList) result.push('</ol>');
    if (inUnorderedList) result.push('</ul>');
    
    return result.join('\n');
  };

  // Format transcript into clean paragraphs with proper grammar
  const formatTranscript = (text: string): string => {
    if (!text) return '';
    
    // Clean up the raw transcript
    let cleaned = text
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
    
    // Split into sentences (handle common abbreviations)
    const sentenceEnders = /([.!?]+)\s+/g;
    const sentences = cleaned.split(sentenceEnders).filter(s => s.trim());
    
    // Rebuild with proper sentence structure
    const processedSentences: string[] = [];
    for (let i = 0; i < sentences.length; i++) {
      let sentence = sentences[i].trim();
      if (!sentence) continue;
      
      // Skip if it's just punctuation
      if (/^[.!?]+$/.test(sentence)) {
        if (processedSentences.length > 0) {
          processedSentences[processedSentences.length - 1] += sentence;
        }
        continue;
      }
      
      // Capitalize first letter
      sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
      
      // Ensure sentence ends with punctuation
      if (!/[.!?]$/.test(sentence)) {
        sentence += '.';
      }
      
      processedSentences.push(sentence);
    }
    
    // Group sentences into paragraphs (roughly 3-5 sentences each)
    const paragraphs: string[] = [];
    let currentParagraph: string[] = [];
    
    for (const sentence of processedSentences) {
      currentParagraph.push(sentence);
      
      // Create new paragraph after 4-5 sentences or at natural breaks
      if (currentParagraph.length >= 4 || 
          (currentParagraph.length >= 3 && /[.!?]$/.test(sentence) && Math.random() > 0.5)) {
        paragraphs.push(currentParagraph.join(' '));
        currentParagraph = [];
      }
    }
    
    // Add remaining sentences as final paragraph
    if (currentParagraph.length > 0) {
      paragraphs.push(currentParagraph.join(' '));
    }
    
    // Convert to HTML with proper styling
    return paragraphs
      .map(p => `<p class="mb-4 leading-relaxed text-foreground">${p}</p>`)
      .join('\n');
  };

  const currentContent = activeTab === 'notes' ? notesContent : transcript;
  const isLoading = activeTab === 'notes' ? isLoadingNotes : isLoadingTranscript;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0 bg-background [&>button:last-child]:hidden"
        // Prevent the parent dialog from dismissing when interacting with portalled children
        // (e.g. Select popovers, nested modals like attendee manager)
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          // Mark as intentional close, then trigger close
          closeRequestedRef.current = true;
          onClose();
        }}
      >
        {/* Custom close button that marks intent before closing */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 h-8 w-8 rounded-full flex items-center justify-center bg-muted/50 text-muted-foreground ring-offset-background transition-all hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-50"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  {meeting?.title || 'Meeting Notes'}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  View and manage meeting notes
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Toolbar */}
        <div className="px-6 py-2.5 border-b flex items-center justify-between gap-4 flex-shrink-0 bg-muted/30">
          <div className="flex items-center gap-1">
            {/* Minus Button - Font size or Detail level */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    if (controlMode === 'fontSize') {
                      setFontSize(prev => Math.max(10, prev - 2));
                    } else {
                      const newLevel = Math.max(1, detailLevel - 1);
                      setDetailLevel(newLevel);
                      triggerRegeneration(newLevel);
                    }
                  }}
                  disabled={controlMode === 'fontSize' ? fontSize <= 10 : detailLevel <= 1 || isRegeneratingNotes}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {controlMode === 'fontSize' ? 'Decrease font size' : 'Less detail'}
              </TooltipContent>
            </Tooltip>
            
            {/* Clickable Toggle Label */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="text-xs text-muted-foreground w-20 text-center font-medium cursor-pointer hover:text-primary transition-colors flex items-center justify-center gap-1"
                  onClick={() => setControlMode(prev => prev === 'fontSize' ? 'detailLevel' : 'fontSize')}
                >
                  {controlMode === 'fontSize' ? (
                    <span>{fontSize}px</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      {isRegeneratingNotes && <Loader2 className="h-3 w-3 animate-spin" />}
                      {MEETING_DETAIL_LEVELS.find(l => l.value === detailLevel)?.label || 'Standard'}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="flex items-center gap-1">
                  <Settings2 className="h-3 w-3" />
                  <span>Click to switch to {controlMode === 'fontSize' ? 'detail level' : 'font size'} mode</span>
                </div>
              </TooltipContent>
            </Tooltip>
            
            {/* Plus Button - Font size or Detail level */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    if (controlMode === 'fontSize') {
                      setFontSize(prev => Math.min(24, prev + 2));
                    } else {
                      const newLevel = Math.min(5, detailLevel + 1);
                      setDetailLevel(newLevel);
                      triggerRegeneration(newLevel);
                    }
                  }}
                  disabled={controlMode === 'fontSize' ? fontSize >= 24 : detailLevel >= 5 || isRegeneratingNotes}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {controlMode === 'fontSize' ? 'Increase font size' : 'More detail'}
              </TooltipContent>
            </Tooltip>

            {/* Divider */}
            <div className="w-px h-5 bg-border mx-1.5" />

            {/* View mode toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === 'formatted' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode(viewMode === 'plain' ? 'formatted' : 'plain')}
                >
                  {viewMode === 'plain' ? (
                    <ToggleLeft className="h-4 w-4" />
                  ) : (
                    <ToggleRight className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{viewMode === 'plain' ? 'Plain Text' : 'Formatted'}</TooltipContent>
            </Tooltip>

            {/* Saving indicator */}
            {isSavingSections && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground ml-1">
                <Loader2 className="h-3 w-3 animate-spin" />
              </div>
            )}

            {/* Divider */}
            <div className="w-px h-5 bg-border mx-1.5" />

            {/* Meeting Type Selector */}
            <Select 
              value={meetingType} 
              onValueChange={handleMeetingTypeChange}
              disabled={isSavingMeetingType}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <SelectTrigger className="w-auto h-8 gap-2 border-0 bg-transparent hover:bg-accent px-2">
                    {isSavingMeetingType ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : meetingType === 'teams' ? (
                      <Video className="h-4 w-4" />
                    ) : meetingType === 'f2f' ? (
                      <UserCheck className="h-4 w-4" />
                    ) : (
                      <div className="flex items-center">
                        <Video className="h-4 w-4" />
                        <UserCheck className="h-3.5 w-3.5 -ml-1" />
                      </div>
                    )}
                    <span className="text-sm hidden sm:inline">
                      {meetingType === 'teams' ? 'Teams' : meetingType === 'f2f' ? 'Face to Face' : 'Hybrid'}
                    </span>
                  </SelectTrigger>
                </TooltipTrigger>
                <TooltipContent>Meeting Type</TooltipContent>
              </Tooltip>
              <SelectContent>
                <SelectItem value="teams">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    MS Teams
                  </div>
                </SelectItem>
                <SelectItem value="f2f">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Face to Face
                  </div>
                </SelectItem>
                <SelectItem value="hybrid">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    <UserCheck className="h-4 w-4 -ml-1" />
                    Hybrid
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Divider */}
            <div className="w-px h-5 bg-border mx-1.5" />

            {/* Manage Attendees */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showAttendeeModal ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowAttendeeModal(true)}
                >
                  <Users className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Manage Attendees</TooltipContent>
            </Tooltip>

            {/* Find & Replace */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showNotesFindReplace ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowNotesFindReplace(!showNotesFindReplace)}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Find & Replace</TooltipContent>
            </Tooltip>

            {/* Email button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowEmailModal(true)}>
                  <Mail className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Email Meeting Notes</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-1">
            {/* Copy button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copied ? 'Copied!' : 'Copy to clipboard'}</TooltipContent>
            </Tooltip>

            {/* Download Word button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownloadWord}>
                  <img src={wordIcon} alt="Download as Word" className="h-7 w-7" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download as Word</TooltipContent>
            </Tooltip>

            {/* Generate PowerPoint with options dropdown */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <img src={powerpointIcon} alt="Generate PowerPoint" className="h-7 w-7" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Generate Executive PowerPoint</TooltipContent>
              </Tooltip>
              <DropdownMenuContent className="w-80 bg-background border shadow-lg z-50" align="end">
                {/* Style Category */}
                <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Presentation Style</DropdownMenuLabel>
                
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Briefcase className="h-4 w-4 mr-2 text-slate-600" />
                    <div className="flex flex-col">
                      <span>Executive Board</span>
                      <span className="text-xs text-muted-foreground">Formal, strategic focus</span>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-background border shadow-lg">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Number of Slides</DropdownMenuLabel>
                    {[5, 8, 10, 12, 15].map(count => (
                      <DropdownMenuItem key={count} onClick={() => { setPptOptions({ style: 'executive-board', content: 'standard', slideCount: count }); setShowPptModal(true); }}>
                        <Hash className="h-4 w-4 mr-2" /> {count} slides
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Presentation className="h-4 w-4 mr-2 text-blue-600" />
                    <div className="flex flex-col">
                      <span>Team Update</span>
                      <span className="text-xs text-muted-foreground">Collaborative, detailed</span>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-background border shadow-lg">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Number of Slides</DropdownMenuLabel>
                    {[5, 8, 10, 12, 15].map(count => (
                      <DropdownMenuItem key={count} onClick={() => { setPptOptions({ style: 'team-update', content: 'standard', slideCount: count }); setShowPptModal(true); }}>
                        <Hash className="h-4 w-4 mr-2" /> {count} slides
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Target className="h-4 w-4 mr-2 text-blue-700" />
                    <div className="flex flex-col">
                      <span>NHS Clinical</span>
                      <span className="text-xs text-muted-foreground">NHS branding, clinical focus</span>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-background border shadow-lg">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Number of Slides</DropdownMenuLabel>
                    {[5, 8, 10, 12, 15].map(count => (
                      <DropdownMenuItem key={count} onClick={() => { setPptOptions({ style: 'nhs-clinical', content: 'standard', slideCount: count }); setShowPptModal(true); }}>
                        <Hash className="h-4 w-4 mr-2" /> {count} slides
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Zap className="h-4 w-4 mr-2 text-purple-500" />
                    <div className="flex flex-col">
                      <span>Modern Minimal</span>
                      <span className="text-xs text-muted-foreground">Clean, contemporary design</span>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-background border shadow-lg">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Number of Slides</DropdownMenuLabel>
                    {[5, 8, 10, 12, 15].map(count => (
                      <DropdownMenuItem key={count} onClick={() => { setPptOptions({ style: 'modern-minimal', content: 'standard', slideCount: count }); setShowPptModal(true); }}>
                        <Hash className="h-4 w-4 mr-2" /> {count} slides
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <GraduationCap className="h-4 w-4 mr-2 text-amber-600" />
                    <div className="flex flex-col">
                      <span>Training Session</span>
                      <span className="text-xs text-muted-foreground">Educational, step-by-step</span>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-background border shadow-lg">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Number of Slides</DropdownMenuLabel>
                    {[5, 8, 10, 12, 15].map(count => (
                      <DropdownMenuItem key={count} onClick={() => { setPptOptions({ style: 'training', content: 'standard', slideCount: count }); setShowPptModal(true); }}>
                        <Hash className="h-4 w-4 mr-2" /> {count} slides
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                {/* Content Focus Category */}
                <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Content Focus</DropdownMenuLabel>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                    <div className="flex flex-col">
                      <span>Action Items Focus</span>
                      <span className="text-xs text-muted-foreground">Tasks, owners, deadlines</span>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-background border shadow-lg">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Number of Slides</DropdownMenuLabel>
                    {[5, 8, 10, 12, 15].map(count => (
                      <DropdownMenuItem key={count} onClick={() => { setPptOptions({ style: 'professional', content: 'actions', slideCount: count }); setShowPptModal(true); }}>
                        <Hash className="h-4 w-4 mr-2" /> {count} slides
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Lightbulb className="h-4 w-4 mr-2 text-yellow-500" />
                    <div className="flex flex-col">
                      <span>Decisions Focus</span>
                      <span className="text-xs text-muted-foreground">Key decisions and rationale</span>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-background border shadow-lg">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Number of Slides</DropdownMenuLabel>
                    {[5, 8, 10, 12, 15].map(count => (
                      <DropdownMenuItem key={count} onClick={() => { setPptOptions({ style: 'professional', content: 'decisions', slideCount: count }); setShowPptModal(true); }}>
                        <Hash className="h-4 w-4 mr-2" /> {count} slides
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <TrendingUp className="h-4 w-4 mr-2 text-indigo-500" />
                    <div className="flex flex-col">
                      <span>Progress & Metrics</span>
                      <span className="text-xs text-muted-foreground">KPIs, outcomes, trends</span>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-background border shadow-lg">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Number of Slides</DropdownMenuLabel>
                    {[5, 8, 10, 12, 15].map(count => (
                      <DropdownMenuItem key={count} onClick={() => { setPptOptions({ style: 'professional', content: 'metrics', slideCount: count }); setShowPptModal(true); }}>
                        <Hash className="h-4 w-4 mr-2" /> {count} slides
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <MessageCircle className="h-4 w-4 mr-2 text-teal-500" />
                    <div className="flex flex-col">
                      <span>Discussion Summary</span>
                      <span className="text-xs text-muted-foreground">Full discussion recap</span>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-background border shadow-lg">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Number of Slides</DropdownMenuLabel>
                    {[5, 8, 10, 12, 15].map(count => (
                      <DropdownMenuItem key={count} onClick={() => { setPptOptions({ style: 'professional', content: 'discussion', slideCount: count }); setShowPptModal(true); }}>
                        <Hash className="h-4 w-4 mr-2" /> {count} slides
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowRight className="h-4 w-4 mr-2 text-rose-600" />
                    <div className="flex flex-col">
                      <span>Next Steps Only</span>
                      <span className="text-xs text-muted-foreground">Forward-looking actions</span>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-background border shadow-lg">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Number of Slides</DropdownMenuLabel>
                    {[5, 8, 10, 12, 15].map(count => (
                      <DropdownMenuItem key={count} onClick={() => { setPptOptions({ style: 'professional', content: 'next-steps', slideCount: count }); setShowPptModal(true); }}>
                        <Hash className="h-4 w-4 mr-2" /> {count} slides
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                {/* Special Formats */}
                <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Special Formats</DropdownMenuLabel>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Award className="h-4 w-4 mr-2 text-orange-500" />
                    <div className="flex flex-col">
                      <span>Stakeholder Report</span>
                      <span className="text-xs text-muted-foreground">External-ready summary</span>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-background border shadow-lg">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Number of Slides</DropdownMenuLabel>
                    {[5, 8, 10, 12, 15].map(count => (
                      <DropdownMenuItem key={count} onClick={() => { setPptOptions({ style: 'stakeholder', content: 'comprehensive', slideCount: count }); setShowPptModal(true); }}>
                        <Hash className="h-4 w-4 mr-2" /> {count} slides
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Eye className="h-4 w-4 mr-2 text-green-500" />
                    <div className="flex flex-col">
                      <span>Quick Overview</span>
                      <span className="text-xs text-muted-foreground">3-minute presentation</span>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-background border shadow-lg">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Number of Slides</DropdownMenuLabel>
                    {[3, 5, 6].map(count => (
                      <DropdownMenuItem key={count} onClick={() => { setPptOptions({ style: 'quick', content: 'highlights', slideCount: count }); setShowPptModal(true); }}>
                        <Hash className="h-4 w-4 mr-2" /> {count} slides
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Layers className="h-4 w-4 mr-2 text-violet-500" />
                    <div className="flex flex-col">
                      <span>Comprehensive Pack</span>
                      <span className="text-xs text-muted-foreground">Full meeting details</span>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-background border shadow-lg">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Number of Slides</DropdownMenuLabel>
                    {[10, 12, 15].map(count => (
                      <DropdownMenuItem key={count} onClick={() => { setPptOptions({ style: 'comprehensive', content: 'all', slideCount: count }); setShowPptModal(true); }}>
                        <Hash className="h-4 w-4 mr-2" /> {count} slides
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <PieChart className="h-4 w-4 mr-2 text-cyan-500" />
                    <div className="flex flex-col">
                      <span>Data-Driven</span>
                      <span className="text-xs text-muted-foreground">Charts and visualisations</span>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-background border shadow-lg">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Number of Slides</DropdownMenuLabel>
                    {[5, 8, 10, 12, 15].map(count => (
                      <DropdownMenuItem key={count} onClick={() => { setPptOptions({ style: 'data-driven', content: 'visualisations', slideCount: count }); setShowPptModal(true); }}>
                        <Hash className="h-4 w-4 mr-2" /> {count} slides
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Generate Infographic with options dropdown */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <img src={infographicIcon} alt="Generate Infographic" className="h-7 w-7" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Generate Summary Infographic</TooltipContent>
              </Tooltip>
              <DropdownMenuContent className="w-72 bg-background border shadow-lg z-50" align="end">
                {/* Style Category */}
                <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Visual Style</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => { setInfographicOptions({ style: 'clean-minimal', detailLevel: 'standard', focusArea: 'balanced' }); setShowInfographicModal(true); }}>
                  <Sparkles className="h-4 w-4 mr-2 text-primary" />
                  <div className="flex flex-col">
                    <span>Clean & Minimal</span>
                    <span className="text-xs text-muted-foreground">Ample white space, simple icons</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setInfographicOptions({ style: 'bold-colourful', detailLevel: 'standard', focusArea: 'balanced' }); setShowInfographicModal(true); }}>
                  <Palette className="h-4 w-4 mr-2 text-orange-500" />
                  <div className="flex flex-col">
                    <span>Bold & Colourful</span>
                    <span className="text-xs text-muted-foreground">High contrast, striking visuals</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setInfographicOptions({ style: 'corporate', detailLevel: 'standard', focusArea: 'balanced' }); setShowInfographicModal(true); }}>
                  <Layout className="h-4 w-4 mr-2 text-slate-600" />
                  <div className="flex flex-col">
                    <span>Professional Corporate</span>
                    <span className="text-xs text-muted-foreground">Formal layout, muted colours</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setInfographicOptions({ style: 'nhs-clinical', detailLevel: 'standard', focusArea: 'balanced' }); setShowInfographicModal(true); }}>
                  <Target className="h-4 w-4 mr-2 text-blue-600" />
                  <div className="flex flex-col">
                    <span>NHS Clinical</span>
                    <span className="text-xs text-muted-foreground">NHS blue palette, healthcare icons</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setInfographicOptions({ style: 'modern-gradient', detailLevel: 'standard', focusArea: 'balanced' }); setShowInfographicModal(true); }}>
                  <Zap className="h-4 w-4 mr-2 text-purple-500" />
                  <div className="flex flex-col">
                    <span>Modern Gradient</span>
                    <span className="text-xs text-muted-foreground">Smooth gradients, contemporary feel</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Detail Level Category */}
                <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Detail Level</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => { setInfographicOptions({ style: 'professional', detailLevel: 'light', focusArea: 'balanced' }); setShowInfographicModal(true); }}>
                  <Eye className="h-4 w-4 mr-2 text-green-500" />
                  <div className="flex flex-col">
                    <span>Light Summary</span>
                    <span className="text-xs text-muted-foreground">Essential points only, quick reference</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setInfographicOptions({ style: 'professional', detailLevel: 'standard', focusArea: 'balanced' }); setShowInfographicModal(true); }}>
                  <FileText className="h-4 w-4 mr-2 text-blue-500" />
                  <div className="flex flex-col">
                    <span>Standard</span>
                    <span className="text-xs text-muted-foreground">Balanced coverage of main topics</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setInfographicOptions({ style: 'professional', detailLevel: 'comprehensive', focusArea: 'balanced' }); setShowInfographicModal(true); }}>
                  <BarChart3 className="h-4 w-4 mr-2 text-indigo-500" />
                  <div className="flex flex-col">
                    <span>Comprehensive</span>
                    <span className="text-xs text-muted-foreground">All discussion points and decisions</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setInfographicOptions({ style: 'professional', detailLevel: 'key-points', focusArea: 'balanced' }); setShowInfographicModal(true); }}>
                  <ListChecks className="h-4 w-4 mr-2 text-amber-500" />
                  <div className="flex flex-col">
                    <span>Key Points Only</span>
                    <span className="text-xs text-muted-foreground">Bullet points, decisions, actions</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setInfographicOptions({ style: 'professional', detailLevel: 'executive', focusArea: 'balanced' }); setShowInfographicModal(true); }}>
                  <Lightbulb className="h-4 w-4 mr-2 text-yellow-500" />
                  <div className="flex flex-col">
                    <span>Executive Brief</span>
                    <span className="text-xs text-muted-foreground">C-suite strategic highlights</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Focus Area Category */}
                <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">Focus Area</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => { setInfographicOptions({ style: 'professional', detailLevel: 'standard', focusArea: 'actions' }); setShowInfographicModal(true); }}>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                  <div className="flex flex-col">
                    <span>Action Items Focus</span>
                    <span className="text-xs text-muted-foreground">Owners, deadlines, priorities</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setInfographicOptions({ style: 'professional', detailLevel: 'standard', focusArea: 'decisions' }); setShowInfographicModal(true); }}>
                  <Target className="h-4 w-4 mr-2 text-blue-600" />
                  <div className="flex flex-col">
                    <span>Decisions Focus</span>
                    <span className="text-xs text-muted-foreground">Key decisions with context</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setInfographicOptions({ style: 'professional', detailLevel: 'standard', focusArea: 'timeline' }); setShowInfographicModal(true); }}>
                  <CalendarDays className="h-4 w-4 mr-2 text-purple-600" />
                  <div className="flex flex-col">
                    <span>Timeline Focus</span>
                    <span className="text-xs text-muted-foreground">Visual chronology and flow</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setInfographicOptions({ style: 'professional', detailLevel: 'standard', focusArea: 'attendees' }); setShowInfographicModal(true); }}>
                  <Users className="h-4 w-4 mr-2 text-teal-600" />
                  <div className="flex flex-col">
                    <span>Attendees & Owners</span>
                    <span className="text-xs text-muted-foreground">Participant contributions</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setInfographicOptions({ style: 'professional', detailLevel: 'standard', focusArea: 'next-steps' }); setShowInfographicModal(true); }}>
                  <ArrowRight className="h-4 w-4 mr-2 text-rose-600" />
                  <div className="flex flex-col">
                    <span>Next Steps Focus</span>
                    <span className="text-xs text-muted-foreground">Follow-ups and future actions</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Quick Audio Summary button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setShowQuickAudioModal(true)}
                >
                  <Headphones className="h-5 w-5 text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Generate Audio Summary</TooltipContent>
            </Tooltip>

          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
          <div className="mx-6 mt-4 flex items-center gap-2">
            <TabsList className="w-fit flex-shrink-0 grid grid-cols-5">
              <TabsTrigger value="notes" className="gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Notes</span>
              </TabsTrigger>
              <TabsTrigger value="transcript" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Transcript</span>
              </TabsTrigger>
              <TabsTrigger value="actions" className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span className="hidden sm:inline">Action Items</span>
                {openItemsCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-6 min-w-6 px-2 text-xs font-medium flex items-center justify-center rounded-full">
                    {openItemsCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="ask-ai" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Ask AI</span>
              </TabsTrigger>
              <TabsTrigger value="documents" className="gap-2">
                <FileDown className="h-4 w-4" />
                <span className="hidden sm:inline">Documents</span>
                {documentCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                    {documentCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            
            {/* Section Visibility Settings */}
            <NotesViewSettingsPopover
              settings={notesViewSettings.settings}
              onToggleSection={notesViewSettings.toggleSection}
            />
          </div>

          {/* Content Area */}
          <div className="flex-1 min-h-0 px-6 pb-6 pt-4">
            <TabsContent value="notes" className="h-full m-0">
              <ScrollArea className="h-full rounded-lg border bg-card">
                <div className="p-6 space-y-6">
                  {/* Find & Replace Panel */}
                  {showNotesFindReplace && notesContent && (
                    <EnhancedFindReplacePanel
                      getCurrentText={() => notesContent}
                      onApply={(updatedText) => {
                        setNotesContent(updatedText);
                        persistNotesContent(updatedText);
                      }}
                      meetingId={meeting?.id}
                      onTranscriptSync={async (finds, replaceWith) => {
                        if (meeting?.id) {
                          await syncTranscriptCorrections(meeting.id, finds, replaceWith);
                        }
                      }}
                      meetingTitle={meeting?.title}
                      onTitleUpdate={updateMeetingTitle}
                    />
                  )}

                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Loading notes...</span>
                    </div>
                  ) : notesContent ? (
                    <>
                      {/* Meeting Details Table - show if we have details or attendees */}
                      {viewMode === 'formatted' && (meetingDetails || attendees.length > 0) && (
                        <div className="rounded-lg border overflow-hidden">
                          <div className="bg-primary px-4 py-2">
                            <h3 className="font-semibold text-primary-foreground flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Meeting Details
                            </h3>
                          </div>
                          <Table>
                            <TableBody>
                              {(meetingDetails?.title || meeting?.title) && (
                                <TableRow>
                                  <TableCell className="font-medium w-32 bg-muted/50">
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-muted-foreground" />
                                      Title
                                    </div>
                                  </TableCell>
                                  <TableCell>{meetingDetails?.title || meeting?.title}</TableCell>
                                </TableRow>
                              )}
                              {meetingDetails.date && (
                                <TableRow>
                                  <TableCell className="font-medium bg-muted/50">
                                    <div className="flex items-center gap-2">
                                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                      Date
                                    </div>
                                  </TableCell>
                                  <TableCell>{meetingDetails.date}</TableCell>
                                </TableRow>
                              )}
                              {meetingDetails.time && (
                                <TableRow>
                                  <TableCell className="font-medium bg-muted/50">
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-4 w-4 text-muted-foreground" />
                                      Time
                                    </div>
                                  </TableCell>
                                  <TableCell>{meetingDetails.time}</TableCell>
                                </TableRow>
                              )}
                              {/* Location/Venue - Always show for F2F and Hybrid, or when location exists */}
                              {(meetingType === 'f2f' || meetingType === 'hybrid' || meetingLocation || meetingDetails.location) && (
                                <TableRow>
                                  <TableCell className="font-medium bg-muted/50">
                                    <div className="flex items-center gap-2">
                                      <MapPin className="h-4 w-4 text-muted-foreground" />
                                      {meetingType === 'f2f' || meetingType === 'hybrid' ? 'Venue' : 'Location'}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {meetingType === 'teams' ? (
                                      // Teams meetings - show Virtual as read-only
                                      <span className="text-muted-foreground">Virtual</span>
                                    ) : (
                                      // F2F or Hybrid - editable dropdown
                                      <DropdownMenu open={locationDropdownOpen} onOpenChange={setLocationDropdownOpen}>
                                        <DropdownMenuTrigger asChild>
                                          <button className="flex items-center gap-2 hover:bg-accent/50 rounded px-2 py-1 -mx-2 transition-colors text-sm group min-h-[28px]">
                                            {isSavingLocation ? (
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                              <span className={meetingLocation ? '' : 'text-muted-foreground'}>
                                                {meetingLocation || 'Set venue...'}
                                              </span>
                                            )}
                                            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50" />
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="bg-background z-50 w-64" align="start">
                                          <div className="p-2 space-y-2">
                                            {/* Custom location input */}
                                            <div className="space-y-1">
                                              <Input
                                                placeholder="Type custom venue..."
                                                value={customLocationInput}
                                                onChange={(e) => setCustomLocationInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter' && customLocationInput.trim()) {
                                                    handleLocationChange(customLocationInput.trim());
                                                  }
                                                }}
                                                className="h-8 text-xs"
                                              />
                                              {customLocationInput.trim() && (
                                                <Button 
                                                  size="sm" 
                                                  className="w-full h-7 text-xs"
                                                  onClick={() => handleLocationChange(customLocationInput.trim())}
                                                >
                                                  Save custom venue
                                                </Button>
                                              )}
                                            </div>
                                            
                                            {/* Practice locations */}
                                            {userPractices.length > 0 && (
                                              <>
                                                <DropdownMenuSeparator />
                                                <div className="text-xs text-muted-foreground px-2 py-1 font-medium">
                                                  Practice Locations
                                                </div>
                                                {userPractices.map((practice) => (
                                                  <DropdownMenuItem
                                                    key={practice.id}
                                                    onClick={() => handleLocationChange(practice.practice_name)}
                                                    className="text-xs cursor-pointer"
                                                  >
                                                    {practice.practice_name}
                                                  </DropdownMenuItem>
                                                ))}
                                              </>
                                            )}
                                          </div>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )}
                              {attendees.length > 0 && (
                                <TableRow>
                                  <TableCell className="font-medium bg-muted/50 align-top">
                                    <div className="flex items-center gap-2">
                                      <Users className="h-4 w-4 text-muted-foreground" />
                                      Attendees
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1.5">
                                      {attendees.map((attendee, idx) => (
                                        <Badge 
                                          key={idx} 
                                          variant="secondary" 
                                          className="text-xs font-normal"
                                        >
                                          {attendee.name}
                                          {attendee.organization ? (
                                            <span className="ml-1 text-muted-foreground">
                                              ({attendee.organization})
                                            </span>
                                          ) : attendee.role && attendee.role !== 'attendee' && attendee.role !== 'chair' && attendee.role !== 'key_participant' ? (
                                            <span className="ml-1 text-muted-foreground">
                                              ({attendee.role})
                                            </span>
                                          ) : null}
                                        </Badge>
                                      ))}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {/* Main Content - Plain or Editable Sections */}
                      <div ref={notesContentRef} className="relative">
                        {viewMode === 'plain' ? (
                          <pre 
                            className="whitespace-pre-wrap font-sans text-foreground leading-relaxed"
                            style={{ fontSize: `${fontSize}px` }}
                          >
                            {notesContent}
                          </pre>
                        ) : sections.length > 0 ? (
                          <div className="space-y-4">
                            {sections
                              .filter(section => notesViewSettings.isSectionVisible(section.heading))
                              .map((section, index, filteredSections) => (
                              <EditableSection
                                key={section.id}
                                section={section}
                                isFirst={index === 0}
                                isLast={index === filteredSections.length - 1}
                                viewMode={viewMode}
                                fontSize={fontSize}
                                formatContent={basicFormat}
                                onContentChangeAndSave={handleSectionContentChangeAndSave}
                                onDelete={handleSectionDelete}
                                onMoveUp={handleSectionMoveUp}
                                onMoveDown={handleSectionMoveDown}
                                isSaving={isSavingSections}
                                meetingId={meeting?.id}
                              />
                            ))}
                            {/* Show message when all sections are hidden */}
                            {sections.length > 0 && sections.filter(s => notesViewSettings.isSectionVisible(s.heading)).length === 0 && (
                              <div className="text-center py-8 text-muted-foreground">
                                <p className="text-sm">All sections are hidden. Use the settings icon to show sections.</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <InteractiveNotesContent
                            content={contentWithoutActionItems}
                            sectionId="main-content"
                            fontSize={fontSize}
                            meetingId={meeting?.id}
                            onContentChange={(newContent) => {
                              // Rebuild full content while preserving Meeting Details (we hide it in the UI, but must not delete it)
                              const actionItemsMatch = notesContent.match(/##?\s*Action\s+Items?\s*\n[\s\S]*$/i);

                              const meetingDetailsBlock = notesContent
                                .split('\n')
                                .filter((l) => {
                                  const t = l.trim();
                                  if (!t) return false;
                                  if (/^#{1,6}\s*Meeting\s+Details\s*$/i.test(t)) return true;
                                  if (/^[-•*]?\s*\*{0,2}(?:Meeting\s*)?(?:Title|Subject)\*{0,2}\s*[:\-–—]/i.test(t)) return true;
                                  if (/^[-•*]?\s*\*{0,2}(?:Meeting\s*)?Date\*{0,2}\s*[:\-–—]/i.test(t)) return true;
                                  if (/^[-•*]?\s*\*{0,2}(?:Meeting\s*)?(?:Time|Start\s*Time)\*{0,2}\s*[:\-–—]/i.test(t)) return true;
                                  if (/^[-•*]?\s*\*{0,2}(?:Location|Meeting\s*Type|Format)\*{0,2}\s*[:\-–—]/i.test(t)) return true;
                                  return false;
                                })
                                .join('\n')
                                .trim();

                              let updatedContent = newContent.trim();

                              if (meetingDetailsBlock) {
                                updatedContent = `${meetingDetailsBlock}\n\n${updatedContent}`.trim();
                              }

                              if (actionItemsMatch?.[0]) {
                                updatedContent = `${updatedContent}\n\n${actionItemsMatch[0].trim()}`.trim();
                              }

                              setNotesContent(updatedContent);
                              persistNotesContent(updatedContent);
                            }}
                          />
                        )}

                        {/* Selection-based Find & Replace Popup for Notes */}
                        {notesSelection.isValid && notesSelection.rect && (
                          <SelectionFindReplacePopup
                            selectedText={notesSelection.text}
                            position={notesSelection.rect}
                            getCurrentText={() => notesContent}
                            onApply={(updatedText) => {
                              setNotesContent(updatedText);
                              persistNotesContent(updatedText);
                              clearNotesSelection();
                            }}
                            onClose={clearNotesSelection}
                            meetingId={meeting?.id}
                            meetingTitle={meeting?.title}
                            onTitleUpdate={updateMeetingTitle}
                          />
                        )}
                      </div>

                      {/* Action Items Table - Database-backed with inline editing */}
                      {viewMode === 'formatted' && meeting?.id && notesViewSettings.settings.visibleSections.actionList && (
                        <InlineActionItemsTable meetingId={meeting.id} />
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No notes available for this meeting.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="transcript" className="h-full m-0">
              <ScrollArea className="h-full rounded-lg border bg-card">
                <div className="p-6 space-y-4">
                  {/* Find & Replace toggle for transcript */}
                  {transcript && !isLoadingTranscript && !transcriptError && (
                    <div className="flex justify-end">
                      <Button
                        variant={showTranscriptFindReplace ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setShowTranscriptFindReplace(!showTranscriptFindReplace)}
                        className="gap-2"
                      >
                        <Search className="h-4 w-4" />
                        Find & Replace
                      </Button>
                    </div>
                  )}

                  {/* Find & Replace Panel */}
                  {showTranscriptFindReplace && transcript && (
                    <EnhancedFindReplacePanel
                      getCurrentText={() => transcript}
                      onApply={(updatedText) => setTranscript(updatedText)}
                      meetingId={meeting?.id}
                      onTranscriptSync={async (finds, replaceWith) => {
                        if (meeting?.id) {
                          await syncTranscriptCorrections(meeting.id, finds, replaceWith);
                        }
                      }}
                    />
                  )}

                  {isLoadingTranscript ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Loading transcript...</span>
                    </div>
                  ) : transcriptError ? (
                    <div className="text-center py-12">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive opacity-70" />
                      <p className="text-destructive">{transcriptError}</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={loadTranscript}
                        className="mt-4"
                      >
                        Retry
                      </Button>
                    </div>
                  ) : transcript ? (
                    <div ref={transcriptContentRef} className="relative">
                      {viewMode === 'plain' ? (
                        <pre 
                          className="whitespace-pre-wrap font-sans text-foreground leading-relaxed"
                          style={{ fontSize: `${fontSize}px` }}
                        >
                          {transcript}
                        </pre>
                      ) : (
                        <div 
                          className="prose prose-sm dark:prose-invert max-w-none text-justify"
                          style={{ fontSize: `${fontSize}px` }}
                          dangerouslySetInnerHTML={{ __html: formatTranscript(transcript) }}
                        />
                      )}

                      {/* Selection-based Find & Replace Popup for Transcript */}
                      {transcriptSelection.isValid && transcriptSelection.rect && (
                        <SelectionFindReplacePopup
                          selectedText={transcriptSelection.text}
                          position={transcriptSelection.rect}
                          getCurrentText={() => transcript}
                          onApply={(updatedText) => {
                            setTranscript(updatedText);
                            clearTranscriptSelection();
                          }}
                          onClose={clearTranscriptSelection}
                          meetingId={meeting?.id}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No transcript available for this meeting.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Action Items Tab */}
            <TabsContent value="actions" className="h-full m-0">
              <ScrollArea className="h-full rounded-lg border bg-card">
                <div className="p-6">
                  {meeting && (
                    <MeetingActionItemsTab
                      meetingId={meeting.id}
                      meetingAttendees={attendees.map(a => a.name)}
                    />
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Ask AI Tab */}
            <TabsContent value="ask-ai" className="h-full m-0">
              <ScrollArea className="h-full rounded-lg border bg-card">
                <div className="p-6">
                  {meeting && (
                    <MeetingQAPanel
                      meetingId={meeting.id}
                      meetingTitle={meeting.title}
                    />
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="h-full m-0">
              <ScrollArea className="h-full rounded-lg border bg-card">
                <div className="p-6">
                  {meeting && (
                    <MeetingDocumentsList
                      meetingId={meeting.id}
                      onDocumentRemoved={() => {
                        // Refresh document count
                        supabase
                          .from('meeting_documents')
                          .select('*', { count: 'exact', head: true })
                          .eq('meeting_id', meeting.id)
                          .then(({ count }) => setDocumentCount(count || 0));
                      }}
                    />
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>

      {/* Edit Action Item Dialog */}
      {editingActionItem && (
        <Dialog open={!!editingActionItem} onOpenChange={() => setEditingActionItem(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                <Pencil className="h-5 w-5 text-primary" />
                Edit Action Item
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Action Description</label>
                <Textarea
                  value={editingActionItem.text}
                  onChange={(e) => setEditingActionItem({ ...editingActionItem, text: e.target.value })}
                  placeholder="Enter action item description..."
                  className="w-full min-h-[100px] text-base p-4 bg-white dark:bg-white dark:text-gray-900 resize-none"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setEditingActionItem(null)}
                  className="px-6"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => handleSaveEditedAction(editingActionItem.original, editingActionItem.text)}
                  className="px-6"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Attendee Modal */}
      {meeting && (
        <MeetingAttendeeModal
          isOpen={showAttendeeModal}
          onClose={handleAttendeeModalClose}
          meetingId={meeting.id}
          meetingTitle={meeting.title}
        />
      )}

      {/* PowerPoint Generation Modal */}
      <MeetingPowerPointModal
        isOpen={showPptModal}
        onClose={() => { setShowPptModal(false); setPptOptions(null); }}
        meetingData={{
          meetingTitle: meetingDetails?.title || meeting?.title || 'Meeting Notes',
          meetingDate: meetingDetails?.date,
          meetingTime: meetingDetails?.time,
          location: meetingDetails?.location,
          attendees: attendees.map(a => a.name),
          notesContent: notesContent || '',
          actionItems: actionItems.map(item => ({
            description: item.action,
            owner: item.owner,
            deadline: item.deadline,
            status: item.status,
            priority: item.priority,
          })),
        }}
        options={pptOptions || undefined}
      />

      {/* Infographic Generation Modal */}
      <MeetingInfographicModal
        isOpen={showInfographicModal}
        onClose={() => { setShowInfographicModal(false); setInfographicOptions(null); }}
        meetingData={{
          meetingTitle: meetingDetails?.title || meeting?.title || 'Meeting Notes',
          meetingDate: meetingDetails?.date,
          meetingTime: meetingDetails?.time,
          location: meetingDetails?.location,
          attendees: attendees.map(a => a.name),
          notesContent: notesContent || '',
          actionItems: actionItems.map(item => ({
            description: item.action,
            owner: item.owner,
            deadline: item.deadline,
            status: item.status,
            priority: item.priority,
          })),
        }}
        options={infographicOptions || undefined}
      />

      {/* Email Meeting Notes Modal */}
      <EmailMeetingMinutesModal
        isOpen={showEmailModal}
        onOpenChange={setShowEmailModal}
        meetingId={meeting?.id || ''}
        meetingTitle={meeting?.title || 'Meeting Notes'}
        meetingNotes={notesContent || ''}
        sectionVisibility={notesViewSettings.settings.visibleSections}
      />

      {/* Quick Audio Summary Modal */}
      {meeting && (
        <QuickAudioSummaryModal
          open={showQuickAudioModal}
          onOpenChange={setShowQuickAudioModal}
          meetingId={meeting.id}
          meetingTitle={meeting.title}
        />
      )}
    </Dialog>
  );
};
