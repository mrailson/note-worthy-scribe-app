import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Settings2
} from "lucide-react";
import { MEETING_DETAIL_LEVELS } from "@/constants/meetingNotesSettings";

import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format, addDays, nextFriday, nextMonday } from "date-fns";
import { MeetingQAPanel } from "@/components/meeting-details/MeetingQAPanel";
import { MeetingActionItemsTab } from "@/components/meeting-details/MeetingActionItemsTab";
import { MeetingAudioStudio } from "@/components/meeting-details/MeetingAudioStudio";
import { MeetingDocumentsList } from "@/components/MeetingDocumentsList";
import { useActionItemsCount } from "@/hooks/useActionItemsCount";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateProfessionalWordFromContent, ParsedMeetingDetailsInput, ParsedActionItemInput } from "@/utils/generateProfessionalMeetingDocx";
import { sanitiseMeetingNotes } from "@/utils/sanitiseMeetingNotes";
import EditableSection, { Section } from "@/components/scribe/EditableSection";
import EnhancedFindReplacePanel from "@/components/EnhancedFindReplacePanel";
import { MeetingAttendeeModal } from "@/components/MeetingAttendeeModal";
import { syncTranscriptCorrections } from "@/utils/transcriptCorrectionSync";

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
  const [meetingType, setMeetingType] = useState<'teams' | 'f2f' | 'hybrid'>('teams');
  const [isSavingMeetingType, setIsSavingMeetingType] = useState(false);
  
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
            role
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
            role: item.meeting_role || (item.attendees as any).role
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
    }
  }, [meeting?.id]);

  // Parse notes content into sections
  const parseNotesIntoSections = useCallback((content: string): Section[] => {
    if (!content) return [];
    
    const sectionHeadings = [
      'EXECUTIVE SUMMARY',
      'DISCUSSION SUMMARY',
      'KEY DECISIONS',
      'KEY POINTS',
      'NEXT STEPS',
      'NOTES',
      'ADDITIONAL NOTES',
    ];
    
    // Sections to explicitly exclude from formatted view
    const excludedHeadings = [
      'NEXT MEETING',
      'ACTION ITEMS',
      'MEETING DETAILS',
      'ATTENDEES',
    ];
    
    const result: Section[] = [];
    const lines = content.split('\n');
    let currentSection: { heading: string; lines: string[] } | null = null;
    let skipCurrentSection = false;
    
    for (const line of lines) {
      // Check for ## heading
      const headingMatch = line.match(/^##\s+(.+)$/);
      if (headingMatch) {
        const heading = headingMatch[1].trim().toUpperCase();
        
        // Check if this heading should be excluded
        if (excludedHeadings.some(h => heading.includes(h))) {
          if (currentSection && !skipCurrentSection) {
            result.push({
              id: crypto.randomUUID(),
              heading: currentSection.heading,
              content: currentSection.lines.join('\n').trim(),
              originalIndex: result.length
            });
          }
          currentSection = null;
          skipCurrentSection = true;
          continue;
        }
        
        // Check if this is a known section heading
        if (sectionHeadings.some(h => heading.includes(h))) {
          if (currentSection && !skipCurrentSection) {
            result.push({
              id: crypto.randomUUID(),
              heading: currentSection.heading,
              content: currentSection.lines.join('\n').trim(),
              originalIndex: result.length
            });
          }
          currentSection = { heading: headingMatch[1].trim(), lines: [] };
          skipCurrentSection = false;
          continue;
        }
      }
      
      if (currentSection && !skipCurrentSection) {
        currentSection.lines.push(line);
      }
    }
    
    // Push last section if it wasn't excluded
    if (currentSection && !skipCurrentSection) {
      result.push({
        id: crypto.randomUUID(),
        heading: currentSection.heading,
        content: currentSection.lines.join('\n').trim(),
        originalIndex: result.length
      });
    }
    
    return result;
  }, []);

  // Rebuild notes content from sections
  const rebuildNotesFromSections = useCallback((updatedSections: Section[], originalContent: string): string => {
    // Keep everything before the first editable section and after the last one
    const sectionHeadings = [
      'EXECUTIVE SUMMARY',
      'DISCUSSION SUMMARY',
      'KEY DECISIONS',
      'KEY POINTS',
      'NEXT STEPS',
      'NOTES',
      'ADDITIONAL NOTES',
    ];
    
    const lines = originalContent.split('\n');
    const result: string[] = [];
    let inEditableSection = false;
    let skipUntilNextSection = false;
    
    for (const line of lines) {
      const headingMatch = line.match(/^##\s+(.+)$/);
      if (headingMatch) {
        const heading = headingMatch[1].trim().toUpperCase();
        const isEditable = sectionHeadings.some(h => heading.includes(h));
        
        if (isEditable) {
          inEditableSection = true;
          skipUntilNextSection = true;
          continue;
        } else {
          inEditableSection = false;
          skipUntilNextSection = false;
        }
      }
      
      if (!skipUntilNextSection) {
        result.push(line);
      }
    }
    
    // Find where to insert sections (after meeting details, before action items)
    const actionItemsIndex = result.findIndex(l => /##\s*Action\s+Items?/i.test(l));
    const insertIndex = actionItemsIndex > 0 ? actionItemsIndex : result.length;
    
    // Build section content
    const sectionContent = updatedSections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n');
    
    // Insert sections
    result.splice(insertIndex, 0, sectionContent);
    
    return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }, []);

  // Reset state when modal opens with new meeting
  useEffect(() => {
    if (isOpen && meeting) {
      // Seed notes immediately from props
      const initialNotes = notes || meeting.meeting_summary || '';
      setNotesContent(initialNotes);
      setActiveTab('notes');
      setTranscript('');
      setTranscriptError(null);
      setViewMode('formatted');
      setCopied(false);
      setAttendees([]);
      setMeetingFormat(null);
      setIsSavingSections(false);
    }
  }, [isOpen, meeting?.id, notes]);

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
  const [attendees, setAttendees] = useState<Array<{ name: string; role?: string | null }>>([]);

  // Fetch fresh notes and attendees in background (non-blocking)
  useEffect(() => {
    if (!isOpen || !meeting?.id) return;

    setIsLoadingNotes(true);
    
    // Fetch notes and meeting format
    const fetchNotes = async () => {
      try {
        // First try meetings table for notes_style_3 and meeting_format
        const { data: meetingData } = await supabase
          .from('meetings')
          .select('notes_style_3, meeting_format')
          .eq('id', meeting.id)
          .maybeSingle();

        if (meetingData?.meeting_format) {
          setMeetingFormat(meetingData.meeting_format);
          setMeetingType(mapFormatToType(meetingData.meeting_format));
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
              role
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
              role: item.meeting_role || (item.attendees as any).role
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
    
    // Check if notes already have an action items section
    const hasActionItemsSection = notesContent && 
      /##?\s*action\s+items?/i.test(notesContent);
    
    if (hasActionItemsSection) return; // Already has action items, no need to sync
    
    // Check if there are action items in the database
    const checkAndSyncActionItems = async () => {
      try {
        const { count, error } = await supabase
          .from('meeting_action_items')
          .select('id', { count: 'exact', head: true })
          .eq('meeting_id', meeting.id);
        
        if (error || !count || count === 0) return; // No action items to sync
        
        console.log(`[SafeMode] Found ${count} action items but notes missing ACTION ITEMS section - triggering sync`);
        
        // Call the sync edge function
        const { data, error: syncError } = await supabase.functions.invoke('sync-meeting-action-items', {
          body: { meetingId: meeting.id },
        });
        
        if (syncError) {
          console.error('[SafeMode] Auto-sync failed:', syncError);
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
  // Uses the cleaned content (without duplicates) that matches the formatted view
  const handleDownloadWord = async () => {
    // Use cleaned content for notes (matches formatted view), raw for transcript
    const content = activeTab === 'notes' ? contentWithoutActionItems : transcript;
    const title = meeting?.title || 'Meeting Notes';

    try {
      // Build parsed details to match modal view exactly
      const parsedDetails: ParsedMeetingDetailsInput = {
        title: meetingDetails?.title,
        date: meetingDetails?.date,
        time: meetingDetails?.time,
        location: meetingDetails?.location,
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
      await generateProfessionalWordFromContent(
        content, 
        title, 
        activeTab === 'notes' ? parsedDetails : undefined,
        activeTab === 'notes' ? parsedActionItemsForWord : undefined
      );
      toast.success('Downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download');
    }
  };

  // Section editing handlers
  const handleSectionContentChange = useCallback((sectionId: string, newContent: string) => {
    setSections(prev => prev.map(s => 
      s.id === sectionId ? { ...s, content: newContent } : s
    ));
  }, []);

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

  const persistSectionsToDb = useCallback(async (sectionsToSave?: Section[]) => {
    if (!meeting?.id) return;
    
    setIsSavingSections(true);
    try {
      const currentSections = sectionsToSave || sections;
      const updatedContent = rebuildNotesFromSections(currentSections, notesContent);
      
      const response = await supabase.functions.invoke('persist-standard-minutes', {
        body: { meetingId: meeting.id, content: updatedContent }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to save');
      }

      setNotesContent(updatedContent);
      toast.success('Notes saved');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save notes');
    } finally {
      setIsSavingSections(false);
    }
  }, [meeting?.id, sections, notesContent, rebuildNotesFromSections]);

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value as 'notes' | 'transcript' | 'actions' | 'ask-ai' | 'audio' | 'documents');
    if (value === 'transcript' && !transcript && !isLoadingTranscript) {
      loadTranscript();
    }
  };

  // Handle modal close
  const handleClose = () => {
    onClose();
  };
  const meetingDetails = useMemo(() => {
    if (!notesContent) return null;
    
    const titleMatch = notesContent.match(/Meeting Title[:\s]+(.+?)(?:\n|$)/i);
    const dateMatch = notesContent.match(/Date[:\s]+(.+?)(?:\n|$)/i);
    const timeMatch = notesContent.match(/Time[:\s]+(.+?)(?:\n|$)/i);
    const locationMatch = notesContent.match(/Location[:\s]+(.+?)(?:\n|$)/i);
    
    if (!titleMatch && !dateMatch && !timeMatch && !locationMatch) return null;
    
    // Strip markdown formatting (** bold markers) from title
    const cleanTitle = titleMatch?.[1]?.trim().replace(/\*\*/g, '');
    
    // Use meetingFormat from DB if available, otherwise fall back to content parsing
    const formatFromDb = meetingFormat ? 
      meetingFormat.charAt(0).toUpperCase() + meetingFormat.slice(1).replace(/-/g, ' ') : 
      null;
    
    // For location: prefer DB meeting format (Hybrid, F2F, Virtual), fallback to parsed content
    const locationValue = formatFromDb || locationMatch?.[1]?.trim();
    
    return {
      title: cleanTitle,
      date: dateMatch?.[1]?.trim(),
      time: timeMatch?.[1]?.trim(),
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
    
    // Extract Action Items section
    const actionSectionMatch = notesContent.match(/##?\s*Action\s+Items?\s*\n([\s\S]*?)(?=\n##[^#]|\n#[^#]|$)/i);
    
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
          <Popover>
            <PopoverTrigger asChild>
              <Badge 
                className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs gap-1 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Circle className="h-3 w-3" />
                Open
              </Badge>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <div className="p-3 space-y-3">
                {/* Edit & Delete */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-start gap-2"
                    onClick={() => actionItem && setEditingActionItem({ original: actionItem.action, text: actionItem.action })}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-start gap-2 text-destructive hover:text-destructive"
                    onClick={() => actionItem && handleDeleteActionItem(actionItem.action)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>

                <Separator />

                {/* Priority */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Priority</label>
                  <div className="flex gap-1">
                    {(['High', 'Medium', 'Low'] as const).map((p) => (
                      <Button
                        key={p}
                        variant={actionItem?.priority === p ? 'default' : 'outline'}
                        size="sm"
                        className={`flex-1 text-xs ${
                          p === 'High' ? 'hover:bg-red-100 hover:text-red-700' :
                          p === 'Medium' ? 'hover:bg-amber-100 hover:text-amber-700' :
                          'hover:bg-green-100 hover:text-green-700'
                        } ${actionItem?.priority === p ? (
                          p === 'High' ? 'bg-red-500 hover:bg-red-600' :
                          p === 'Medium' ? 'bg-amber-500 hover:bg-amber-600' :
                          'bg-green-500 hover:bg-green-600'
                        ) : ''}`}
                        onClick={() => actionItem && handleChangePriority(actionItem.action, p)}
                      >
                        {p}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Owner */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Owner</label>
                  {!showCustomOwnerInput ? (
                    <div className="space-y-1">
                      <div className="max-h-24 overflow-y-auto space-y-1">
                        {attendees.slice(0, 5).map((attendee, idx) => (
                          <Button
                            key={idx}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start gap-2 text-xs h-7"
                            onClick={() => actionItem && handleChangeOwner(actionItem.action, attendee.name)}
                          >
                            <User className="h-3 w-3" />
                            {attendee.name}
                            {attendee.role && <span className="text-muted-foreground">({attendee.role})</span>}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start gap-2 text-xs"
                        onClick={() => setShowCustomOwnerInput(true)}
                      >
                        <Pencil className="h-3 w-3" />
                        Custom...
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={customOwner}
                        onChange={(e) => setCustomOwner(e.target.value)}
                        placeholder="Enter name..."
                        className="h-8 text-xs"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => actionItem && customOwner && handleChangeOwner(actionItem.action, customOwner)}
                      >
                        Set
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Deadline */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Deadline</label>
                  <div className="space-y-1">
                    {getDeadlineOptions().map((option) => (
                      <Button
                        key={option.label}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between text-xs h-7"
                        onClick={() => actionItem && handleChangeDeadline(actionItem.action, option.value)}
                      >
                        <span>{option.label}</span>
                        <span className="text-muted-foreground">{option.value}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Mark as Completed */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                  onClick={() => actionItem && handleCloseActionItem(actionItem.action)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark as Completed
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        );
    }
  };

  // Remove action items section from formatted content (we'll show it as a table)
  const contentWithoutActionItems = useMemo(() => {
    if (!notesContent) return '';
    
    // Remove Action Items section and everything after it until next ## heading
    let cleaned = notesContent;
    
    // Remove the action items section (since we display as table)
    cleaned = cleaned.replace(/##?\s*Action\s+Items?\s*\n[\s\S]*?(?=\n##[^#]|\n#[^#]|$)/gi, '');
    
    // Remove Completed section too
    cleaned = cleaned.replace(/##?\s*Completed\s*(Items?)?\s*\n[\s\S]*?(?=\n##[^#]|\n#[^#]|$)/gi, '');
    
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
    cleaned = cleaned.replace(/##?\s*ATTENDEES\s*\n[\s\S]*?(?=\n##[^#]|\n#[^#]|$)/gi, '');
    cleaned = cleaned.replace(/##?\s*Attendees\s*\n[\s\S]*?(?=\n##[^#]|\n#[^#]|$)/gi, '');
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0 bg-background"
        // Prevent the parent dialog from dismissing when interacting with portalled children
        // (e.g. Select popovers, nested modals like attendee manager)
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          handleClose();
        }}
      >
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  {meeting?.title || 'Meeting Notes'} 
                  <span className="ml-2 text-sm font-normal text-amber-600 dark:text-amber-400">
                    (Safe Mode)
                  </span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Lightweight view for faster loading
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

            {/* Download button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownloadWord}>
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download as Word</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 w-fit flex-shrink-0 grid grid-cols-6">
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
            <TabsTrigger value="audio" className="gap-2">
              <Headphones className="h-4 w-4" />
              <span className="hidden sm:inline">Audio Summary</span>
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
                    />
                  )}

                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Loading notes...</span>
                    </div>
                  ) : notesContent ? (
                    <>
                      {/* Meeting Details Table */}
                      {viewMode === 'formatted' && meetingDetails && (
                        <div className="rounded-lg border overflow-hidden">
                          <div className="bg-primary px-4 py-2">
                            <h3 className="font-semibold text-primary-foreground flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Meeting Details
                            </h3>
                          </div>
                          <Table>
                            <TableBody>
                              {meetingDetails.title && (
                                <TableRow>
                                  <TableCell className="font-medium w-32 bg-muted/50">
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-muted-foreground" />
                                      Title
                                    </div>
                                  </TableCell>
                                  <TableCell>{meetingDetails.title}</TableCell>
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
                              {meetingDetails.location && (
                                <TableRow>
                                  <TableCell className="font-medium bg-muted/50">
                                    <div className="flex items-center gap-2">
                                      <MapPin className="h-4 w-4 text-muted-foreground" />
                                      Location
                                    </div>
                                  </TableCell>
                                  <TableCell>{meetingDetails.location}</TableCell>
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
                                          {attendee.role && (
                                            <span className="ml-1 text-muted-foreground">
                                              ({attendee.role})
                                            </span>
                                          )}
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
                      {viewMode === 'plain' ? (
                        <pre 
                          className="whitespace-pre-wrap font-sans text-foreground leading-relaxed"
                          style={{ fontSize: `${fontSize}px` }}
                        >
                          {notesContent}
                        </pre>
                      ) : sections.length > 0 ? (
                        <div className="space-y-4">
                          {sections.map((section, index) => (
                            <EditableSection
                              key={section.id}
                              section={section}
                              isFirst={index === 0}
                              isLast={index === sections.length - 1}
                              viewMode={viewMode}
                              fontSize={fontSize}
                              formatContent={basicFormat}
                              onContentChange={handleSectionContentChange}
                              onDelete={handleSectionDelete}
                              onMoveUp={handleSectionMoveUp}
                              onMoveDown={handleSectionMoveDown}
                              isSaving={isSavingSections}
                              onSave={persistSectionsToDb}
                            />
                          ))}
                        </div>
                      ) : (
                        <div 
                          className="prose prose-sm dark:prose-invert max-w-none"
                          style={{ fontSize: `${fontSize}px` }}
                          dangerouslySetInnerHTML={{ __html: basicFormat(contentWithoutActionItems) }}
                        />
                      )}

                      {/* Action Items Table */}
                      {viewMode === 'formatted' && actionItems.length > 0 && (
                        <div className="rounded-lg border overflow-hidden">
                          <div className="bg-primary px-4 py-2">
                            <h3 className="font-semibold text-primary-foreground flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4" />
                              Action Items ({actionItems.filter(i => !i.isCompleted).length} open, {actionItems.filter(i => i.isCompleted).length} completed)
                            </h3>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="w-[40%]">Action</TableHead>
                                <TableHead className="w-[15%]">Owner</TableHead>
                                <TableHead className="w-[15%]">Deadline</TableHead>
                                <TableHead className="w-[15%]">Priority</TableHead>
                                <TableHead className="w-[15%]">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {actionItems.map((item, index) => (
                                <TableRow 
                                  key={index} 
                                  className={item.isCompleted ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}
                                >
                                  <TableCell className={item.isCompleted ? 'line-through text-muted-foreground' : ''}>
                                    {item.action}
                                  </TableCell>
                                  <TableCell className="font-medium">{item.owner}</TableCell>
                                  <TableCell>{item.deadline}</TableCell>
                                  <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                                  <TableCell>{getStatusBadge(item.status, { action: item.action, owner: item.owner, deadline: item.deadline, priority: item.priority })}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
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
                    viewMode === 'plain' ? (
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
                    )
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

            {/* Audio Summary Tab */}
            <TabsContent value="audio" className="h-full m-0">
              <ScrollArea className="h-full rounded-lg border bg-card">
                <div className="p-6">
                  {meeting && (
                    <MeetingAudioStudio
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
    </Dialog>
  );
};
