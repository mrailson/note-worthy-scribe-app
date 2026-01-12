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
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  Circle,
  Timer,
  Users
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateProfessionalWordFromContent } from "@/utils/generateProfessionalMeetingDocx";
import { sanitiseMeetingNotes } from "@/utils/sanitiseMeetingNotes";
import EditableSection, { Section } from "@/components/scribe/EditableSection";

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
  const [activeTab, setActiveTab] = useState<'notes' | 'transcript'>('notes');
  const [notesContent, setNotesContent] = useState(notes);
  const [transcript, setTranscript] = useState('');
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'plain' | 'formatted'>('plain');
  const [fontSize, setFontSize] = useState(14);
  const [copied, setCopied] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  
  // Section-based editing state
  const [sections, setSections] = useState<Section[]>([]);
  const [isSavingSections, setIsSavingSections] = useState(false);

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
      setViewMode('plain');
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

  // Load transcript only when tab is clicked
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
      // Use the professional document generator with NHS-style formatting
      await generateProfessionalWordFromContent(content, title);
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
    setActiveTab(value as 'notes' | 'transcript');
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
    
    // Helper to extract all owners from a line (handles @CC/@MR or @CC/MR patterns)
    const extractOwners = (line: string): string => {
      // Match patterns like @CC/@MR, @CC/MR, @CC, — @MR, etc.
      const ownerMatches = line.match(/@([A-Za-z]+(?:\/(?:@)?[A-Za-z]+)*)/g);
      if (ownerMatches && ownerMatches.length > 0) {
        // Combine all owners, normalize format
        const allOwners = ownerMatches
          .map(m => m.replace(/@/g, ''))
          .join('/')
          .split('/')
          .filter(Boolean)
          .map(o => `@${o}`)
          .join('/');
        return allOwners || 'TBC';
      }
      return 'TBC';
    };
    
    // Helper to clean action text by removing owner references
    const cleanActionText = (text: string): string => {
      return text
        // Remove "— @Owner" or "- @Owner" patterns at end
        .replace(/\s*[—–-]\s*@[A-Za-z]+(?:\/(?:@)?[A-Za-z]+)*\s*$/g, '')
        // Remove standalone @Owner patterns
        .replace(/\s*@[A-Za-z]+(?:\/(?:@)?[A-Za-z]+)*\s*/g, ' ')
        // Remove status markers
        .replace(/\{[^}]+\}/g, '')
        // Remove strikethrough markers
        .replace(/~~/g, '')
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

  // Get status badge styling
  const getStatusBadge = (status: string) => {
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
          <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs gap-1">
            <Circle className="h-3 w-3" />
            Open
          </Badge>
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

  const currentContent = activeTab === 'notes' ? notesContent : transcript;
  const isLoading = activeTab === 'notes' ? isLoadingNotes : isLoadingTranscript;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0 bg-background">
        {/* Header */}
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
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b flex items-center justify-between gap-4 flex-shrink-0 bg-muted/30">
          <div className="flex items-center gap-2">
            {/* Font size controls */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFontSize(prev => Math.max(10, prev - 2))}
              disabled={fontSize <= 10}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground w-12 text-center">{fontSize}px</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFontSize(prev => Math.min(24, prev + 2))}
              disabled={fontSize >= 24}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>

            {/* Divider */}
            <div className="w-px h-6 bg-border mx-2" />

            {/* View mode toggle */}
            <Button
              variant={viewMode === 'plain' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode(viewMode === 'plain' ? 'formatted' : 'plain')}
              className="gap-2"
            >
              {viewMode === 'plain' ? (
                <>
                  <ToggleLeft className="h-4 w-4" />
                  Plain Text
                </>
              ) : (
                <>
                  <ToggleRight className="h-4 w-4" />
                  Formatted
                </>
              )}
            </Button>

            {/* Saving indicator */}
            {isSavingSections && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Copy button */}
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>

            {/* Download button */}
            <Button variant="outline" size="sm" onClick={handleDownloadWord} className="gap-2">
              <Download className="h-4 w-4" />
              Word
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 w-fit flex-shrink-0">
            <TabsTrigger value="notes" className="gap-2">
              <FileText className="h-4 w-4" />
              Notes
            </TabsTrigger>
            <TabsTrigger value="transcript" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Transcript
            </TabsTrigger>
          </TabsList>

          {/* Content Area */}
          <div className="flex-1 min-h-0 px-6 pb-6 pt-4">
            <TabsContent value="notes" className="h-full m-0">
              <ScrollArea className="h-full rounded-lg border bg-card">
                <div className="p-6 space-y-6">
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
                                      <Calendar className="h-4 w-4 text-muted-foreground" />
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
                                  <TableCell className="font-medium">@{item.owner}</TableCell>
                                  <TableCell>{item.deadline}</TableCell>
                                  <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                                  <TableCell>{getStatusBadge(item.status)}</TableCell>
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
                <div className="p-6">
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
                        className="prose prose-sm dark:prose-invert max-w-none"
                        style={{ fontSize: `${fontSize}px` }}
                        dangerouslySetInnerHTML={{ __html: basicFormat(transcript) }}
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
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
