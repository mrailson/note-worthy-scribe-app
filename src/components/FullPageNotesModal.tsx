import { NoteEnhancementDialog } from "@/components/meeting/NoteEnhancementDialog";
import { EmailMeetingMinutesModal } from "@/components/EmailMeetingMinutesModal";
import React, { useState, useEffect } from "react";
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
import { ClaudeEnhancementModal } from "@/components/ClaudeEnhancementModal";
import EnhancedFindReplacePanel from "@/components/EnhancedFindReplacePanel";
import { SpeechToText } from "@/components/SpeechToText";
import { MeetingTemplatesTab } from "@/components/MeetingTemplatesTab";
import { RecordingWarningBanner } from "@/components/RecordingWarningBanner";
import { MeetingModalQuickPick } from "@/components/MeetingModalQuickPick";
import { MeetingContextEnhancer } from "@/components/MeetingContextEnhancer";
import { CustomAIPromptModal } from "@/components/CustomAIPromptModal";
import { CustomFindReplaceModal } from "@/components/CustomFindReplaceModal";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TranscriptContextDialog } from "@/components/meeting/TranscriptContextDialog";
import { formatTranscriptContext, extractCleanContent, addMeetingMetadataToTranscript } from "@/utils/meeting/formatTranscriptContext";
import { UploadedFile } from "@/types/ai4gp";
import { useAuth } from "@/contexts/AuthContext";
import { useRecording } from "@/contexts/RecordingContext";
import { useIsMobile } from "@/hooks/use-mobile";
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
  MoreVertical
} from "lucide-react";

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
}

interface FullPageNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: Meeting | null;
  notes: string;
  onNotesChange: (notes: string) => void;
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
  onNotesChange
}) => {
  const { user } = useAuth();
  const { isRecording, isResourceOperationSafe } = useRecording();
  const isMobile = useIsMobile();
  
  // Enhanced debugging
  console.log('🔍 FullPageNotesModal render - isOpen:', isOpen, 'meeting:', meeting?.title, 'isRecording:', isRecording);
  console.log('🔍 Modal props received:', { isOpen, meetingId: meeting?.id, notesLength: notes?.length });
  
  const [isEditing, setIsEditing] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showCustomInstruction, setShowCustomInstruction] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");
  const [showCustomAIModal, setShowCustomAIModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("notes");
  const [activeNotesStyleTab, setActiveNotesStyleTab] = useState("style1");
  const [notesStyle2, setNotesStyle2] = useState("");
  const [notesStyle3, setNotesStyle3] = useState("");
  const [notesStyle4, setNotesStyle4] = useState("");
  const [notesStyle5, setNotesStyle5] = useState("");
  const [isGeneratingStyle2, setIsGeneratingStyle2] = useState(false);
  const [isGeneratingStyle3, setIsGeneratingStyle3] = useState(false);
  const [isGeneratingStyle4, setIsGeneratingStyle4] = useState(false);
  const [isGeneratingStyle5, setIsGeneratingStyle5] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [backupTranscript, setBackupTranscript] = useState(""); // Assembly AI backup transcript
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [isLoadingBackupTranscript, setIsLoadingBackupTranscript] = useState(false);
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(true); // Transcript card expanded by default
  const [isFormattingParagraphs, setIsFormattingParagraphs] = useState(false);
  const [editingContent, setEditingContent] = useState(""); // Clean content for editing
  const [editingTab, setEditingTab] = useState<string>(""); // Track which tab is being edited
  const [enhancementDialogOpen, setEnhancementDialogOpen] = useState(false);
  const [showContextDialog, setShowContextDialog] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailModalContent, setEmailModalContent] = useState({ title: '', notes: '' });
  useEffect(() => { console.log('📧 Email modal open state:', emailModalOpen); }, [emailModalOpen]);
  
  // Version history for undo functionality
  const [notesVersions, setNotesVersions] = useState<ContentVersion[]>([]);
  const [transcriptVersions, setTranscriptVersions] = useState<ContentVersion[]>([]);
  
  // Search functionality for transcript
  const [searchTerm, setSearchTerm] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [highlightedTranscript, setHighlightedTranscript] = useState("");

   // Fetch transcript when modal opens with enhanced validation
   useEffect(() => {
     console.log('🔍 FullPageNotesModal useEffect - isOpen:', isOpen, 'meeting?.id:', meeting?.id, 'meeting?.title:', meeting?.title);
     
      // Enhanced validation before data fetching
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
        
        if (isResourceOperationSafe()) {
          console.log('🔍 FullPageNotesModal fetching data for meeting:', meeting.id);
          fetchTranscriptData();
        } else {
          console.log('⚠️ Deferring transcript fetch - recording in progress');
          
          // Set up a check for when recording stops
          const checkRecordingComplete = setInterval(() => {
            if (isResourceOperationSafe()) {
              console.log('✅ Recording stopped, fetching deferred data for meeting:', meeting.id);
              fetchTranscriptData();
              clearInterval(checkRecordingComplete);
            }
          }, 1000);
          
          return () => clearInterval(checkRecordingComplete);
        }
      }
   }, [isOpen, meeting?.id, meeting?.title, user?.id, isResourceOperationSafe]);

   const fetchTranscriptData = async () => {
     if (!meeting?.id) {
       console.error('❌ fetchTranscriptData called without meeting ID');
       return;
     }
     
     // Additional validation before database calls
     if (typeof meeting.id !== 'string' || meeting.id.length !== 36) {
       console.error('❌ Invalid meeting ID format in fetchTranscriptData:', meeting.id);
       return;
     }
     
     const currentMeetingId = meeting.id;
     console.log('🔍 Starting fetchTranscriptData for meeting:', currentMeetingId, 'title:', meeting.title);
     
     setIsLoadingTranscript(true);
       try {
         // First, prefer any manually saved transcript on the meeting record
         const { data: manualData, error: manualError } = await supabase
           .from('meetings')
           .select('live_transcript_text, assembly_ai_transcript')
           .eq('id', currentMeetingId)
           .eq('user_id', user!.id)
           .maybeSingle();
 
      if (manualError) {
        console.error('❌ Error checking manually saved transcript:', manualError);
      } else {
        // Always load backup transcript if available
        if (manualData?.assembly_ai_transcript) {
          setBackupTranscript(manualData.assembly_ai_transcript);
          console.log('✅ Loaded Assembly AI backup transcript:', manualData.assembly_ai_transcript.length, 'chars');
        }
        
        // Check if we have a manually saved primary transcript
        if (
          manualData?.live_transcript_text &&
          manualData.live_transcript_text.trim().length > 0
        ) {
          // Use the saved manual/edited transcript as source of truth
          console.log('✅ Using manually saved transcript from meetings.live_transcript_text');
          if (meeting?.id === currentMeetingId) {
            setTranscript(manualData.live_transcript_text);
            setIsLoadingTranscript(false);
          }
          return; // Skip RPC fallback
        }
      }
 
         // Fallback: Fetch processed transcript with explicit user validation
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
         } else if (transcriptData && Array.isArray(transcriptData) && transcriptData.length > 0) {
           console.log('✅ Transcript fetched for meeting', currentMeetingId, ':', transcriptData.length, 'segments');
           
           // Import normaliser
           const { normaliseTranscript } = await import('@/lib/transcriptNormaliser');
           
           // Combine and normalise each segment first to avoid concatenation issues
           const allSegments = transcriptData
             .map(segment => segment.transcript)
             .join(' '); // This will join multiple JSON arrays if present
           
           console.log('📝 Raw transcript preview:', allSegments.substring(0, 200));
           
           // Normalise the combined transcript
           const normalised = normaliseTranscript(allSegments);
           console.log(`📝 Transcript normalised using ${normalised.used} approach`);
           console.log('📝 Normalised preview:', normalised.plain.substring(0, 200));
           
           // Final validation before setting state
           if (meeting?.id === currentMeetingId) {
             // Use HTML for display
             setTranscript(normalised.html);
           } else {
             console.warn('⚠️ Meeting changed during transcript processing, discarding results');
           }
         } else {
           console.log('📝 No transcript data found for meeting:', currentMeetingId);
           setTranscript('');
         }
        
     } catch (error) {
       console.error('Error fetching transcript data for meeting', currentMeetingId, ':', error);
     } finally {
       // Only update loading state if we're still on the same meeting
       if (meeting?.id === currentMeetingId) {
         setIsLoadingTranscript(false);
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
     console.log('🔍 Loading existing note styles for meeting:', currentMeetingId, 'user:', user.id);

     try {
       // Use validate_meeting_access function for security
       const { data: accessCheck } = await supabase.rpc('validate_meeting_access', {
         p_meeting_id: currentMeetingId,
         p_user_id: user.id
       });

        if (!accessCheck) {
          console.error('❌ User does not have access to meeting:', currentMeetingId);
          onClose();
          return;
        }

       const { data: meetingData, error } = await supabase
         .from('meetings')
         .select('notes_style_2, notes_style_3, notes_style_4, notes_style_5')
         .eq('id', currentMeetingId)
         .eq('user_id', user.id)
         .maybeSingle();

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
         if (meetingData.notes_style_2) {
           setNotesStyle2(meetingData.notes_style_2);
         }
         if (meetingData.notes_style_3) {
           setNotesStyle3(meetingData.notes_style_3);
         }
         if (meetingData.notes_style_4) {
           setNotesStyle4(meetingData.notes_style_4);
         }
         if (meetingData.notes_style_5) {
           setNotesStyle5(meetingData.notes_style_5);
         }
         console.log('✅ Loaded existing note styles for meeting:', currentMeetingId);
       }
     } catch (error) {
       console.error('Error loading note styles:', error);
     }
   };

  // Call loadExistingNoteStyles when modal opens and meeting data is available
  useEffect(() => {
    if (isOpen && meeting?.id && user?.id) {
      loadExistingNoteStyles();
    }
  }, [isOpen, meeting?.id, user?.id]);

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
       const { error } = await supabase
         .from('meetings')
         .update({ [columnName]: content })
         .eq('id', currentMeetingId)
         .eq('user_id', user.id);

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

  // Advanced Word export with proper table and bold formatting
  const generateAdvancedWordDocument = async (content: string, title: string) => {
    try {
      console.log('🔍 Generating full-featured Word document with formatting!');
      
      const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType } = await import('docx');
      
      // Parse markdown tables and format text
      const parseMarkdownTables = (content: string) => {
        const lines = content.split('\n');
        const result = [];
        let i = 0;
        
        while (i < lines.length) {
          const line = lines[i];
          
          // Check if this line looks like a table header
          if (line.includes('|') && line.trim().startsWith('|') && line.trim().endsWith('|')) {
            // Look ahead for separator line
            const nextLine = lines[i + 1];
            if (nextLine && nextLine.includes('|') && nextLine.includes('-')) {
              // This is a table - collect all table rows
              const tableRows = [];
              
              // Add header row
              const headerCells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
              tableRows.push(headerCells);
              
              // Skip separator line
              i += 2;
              
              // Collect data rows
              while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
                const dataCells = lines[i].split('|').map(cell => cell.trim()).filter(cell => cell);
                tableRows.push(dataCells);
                i++;
              }
              
              result.push({ type: 'table', content: tableRows });
              continue;
            }
          }
          
          // Regular text line
          result.push({ type: 'text', content: line });
          i++;
        }
        
        return result;
      };

      // Strip HTML and process content to preserve formatting
      const stripHtmlAndFormat = (htmlContent: string) => {
        if (!htmlContent) return [];
        
        // Convert HTML to more readable format while preserving structure
        let processedText = htmlContent
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<p[^>]*>/gi, '')
          .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**') // Convert HTML bold to markdown
          .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
          .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
          .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&apos;/g, "'")
          .replace(/[ \t]+/g, ' ')
          .trim();

        // Parse for tables first
        const parsedContent = parseMarkdownTables(processedText);
        const paragraphs = [];
        
        for (const item of parsedContent) {
          if (item.type === 'table') {
            // Create table
            const tableRows = item.content.map((row, rowIndex) => 
              new TableRow({
                children: row.map(cellText => {
                  // Parse cell text for formatting
                  const cellRuns = [];
                  let currentText = cellText;
                  
                  // Handle bold text in cells
                  const boldRegex = /(\*\*|__)(.*?)\1/g;
                  let lastIndex = 0;
                  let match;
                  
                  while ((match = boldRegex.exec(currentText)) !== null) {
                    // Add text before bold
                    if (match.index > lastIndex) {
                      const beforeText = currentText.slice(lastIndex, match.index);
                      if (beforeText) cellRuns.push(new TextRun({ text: beforeText, size: rowIndex === 0 ? 22 : 20 }));
                    }
                    
                    // Add bold text
                    cellRuns.push(new TextRun({ text: match[2], bold: true, size: rowIndex === 0 ? 22 : 20 }));
                    lastIndex = match.index + match[0].length;
                  }
                  
                  // Add remaining text
                  if (lastIndex < currentText.length) {
                    const remainingText = currentText.slice(lastIndex);
                    if (remainingText) cellRuns.push(new TextRun({ text: remainingText, size: rowIndex === 0 ? 22 : 20 }));
                  }
                  
                  if (cellRuns.length === 0) {
                    cellRuns.push(new TextRun({ text: cellText, size: rowIndex === 0 ? 22 : 20, bold: rowIndex === 0 }));
                  }
                  
                  return new TableCell({
                    children: [new Paragraph({ children: cellRuns })],
                    width: {
                      size: 100 / row.length,
                      type: WidthType.PERCENTAGE,
                    },
                  });
                })
              })
            );
            
            paragraphs.push(new Table({
              rows: tableRows,
              width: {
                size: 100,
                type: WidthType.PERCENTAGE,
              },
            }));
            
            // Add space after table
            paragraphs.push(new Paragraph({
              children: [new TextRun({ text: "", size: 22 })],
              spacing: { after: 240 }
            }));
          } else {
            // Process regular text with proper formatting
            const trimmedLine = item.content.trim();
            if (!trimmedLine) {
              // Empty line - add spacing
              paragraphs.push(new Paragraph({
                children: [new TextRun({ text: "", size: 22 })],
                spacing: { after: 120 }
              }));
              continue;
            }
            
            // Check for standalone bold lines
            const boldMatch = trimmedLine.match(/^\*\*(.*?)\*\*$/);
            if (boldMatch) {
              paragraphs.push(new Paragraph({
                children: [new TextRun({
                  text: boldMatch[1],
                  bold: true,
                  size: 24,
                  color: "1f2937"
                })],
                spacing: { after: 80 }
              }));
              continue;
            }
            
            // Check for section headers
            const isHeader = /^[#*]{1,4}\s/.test(trimmedLine) || 
                            /^[A-Z\s]{8,}$/.test(trimmedLine) ||
                            trimmedLine.includes('ATTENDEES') ||
                            trimmedLine.includes('OVERVIEW') ||
                            trimmedLine.includes('CONTENT') ||
                            trimmedLine.includes('DECISIONS') ||
                            trimmedLine.includes('ACTION') ||
                            trimmedLine.includes('RISKS') ||
                            trimmedLine.includes('MEETING OVERVIEW') ||
                            trimmedLine.includes('DETAILED MEETING');
            
            // Clean hashtags from headers
            let cleanedLine = trimmedLine;
            if (isHeader && /^[#]{1,4}\s/.test(trimmedLine)) {
              cleanedLine = trimmedLine.replace(/^[#]{1,4}\s*/, '');
            }
            
            // Handle inline bold markers within text
            const parts = [];
            let lastIndex = 0;
            
            // Find all **text** patterns
            const boldRegex = /\*{1,2}([^*]+?)\*{1,2}/g;
            let match;
            
            while ((match = boldRegex.exec(cleanedLine)) !== null) {
              // Add normal text before the bold part
              if (match.index > lastIndex) {
                const normalText = cleanedLine.substring(lastIndex, match.index);
                if (normalText) {
                  parts.push(new TextRun({
                    text: normalText,
                    size: 22,
                    color: "374151"
                  }));
                }
              }
              
              // Add bold text
              parts.push(new TextRun({
                text: match[1],
                bold: true,
                size: 22,
                color: "1f2937"
              }));
              
              lastIndex = match.index + match[0].length;
            }
            
            // Add remaining normal text
            if (lastIndex < cleanedLine.length) {
              const remainingText = cleanedLine.substring(lastIndex);
              if (remainingText) {
                parts.push(new TextRun({
                  text: remainingText,
                  size: 22,
                  color: "374151"
                }));
              }
            }
            
            // If no bold parts found, use the whole cleaned line
            if (parts.length === 0) {
              parts.push(new TextRun({
                text: cleanedLine,
                size: isHeader ? 24 : 22,
                bold: isHeader,
                color: isHeader ? "1f2937" : "374151"
              }));
            }
            
            // Check for bullet points
            const isBullet = cleanedLine.startsWith('-') || cleanedLine.startsWith('•');
            
            paragraphs.push(new Paragraph({
              children: parts,
              spacing: { 
                after: isHeader ? 120 : (isBullet ? 40 : 60),
                before: isHeader ? 160 : 0
              },
              indent: isBullet ? { left: 360 } : undefined
            }));
          }
        }
        
        return paragraphs;
      };
      
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1440,    // 1 inch
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          children: [
            // Title
            new Paragraph({
              children: [
                new TextRun({
                  text: title,
                  bold: true,
                  size: 36,
                  color: "1f2937"
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 480 }
            }),
            
            // Meeting Details
            new Paragraph({
              children: [
                new TextRun({
                  text: "Date: ",
                  bold: true,
                  size: 24,
                  color: "1f2937"
                }),
                new TextRun({
                  text: new Date().toLocaleDateString(),
                  size: 24,
                  color: "374151"
                }),
              ],
              spacing: { after: 360 }
            }),
            
            // Content Section
            ...stripHtmlAndFormat(content),
            
            // Footer
            new Paragraph({
              children: [
                new TextRun({
                  text: `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
                  italics: true,
                  size: 18,
                  color: "6b7280"
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 480 }
            }),
          ],
        }],
      });
      
      console.log('🔍 Document created, converting to blob...');
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toLocaleDateString()}.docx`);
      
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
      setActiveTab('notes'); // Reset to notes tab
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
  }, [meeting?.id]);

  // Get current content based on active tab and sub-tab
  const getCurrentContent = () => {
    if (activeTab === "notes") {
      // Return content based on the active sub-tab
      switch (activeNotesStyleTab) {
        case 'style1': return notesStyle3 || "";
        case 'style2': return notes || "";
        case 'style3': return notesStyle2 || "";
        case 'style4': return notesStyle4 || "";
        case 'style5': return notesStyle5 || "";
        default: return notes || "";
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
        case 'style2':
          onNotesChange(content);
          saveSummaryToDatabase(content);
          break;
        case 'style3':
          setNotesStyle2(content);
          saveNoteStyleToDatabase(2, content);
          break;
        case 'style4':
          setNotesStyle4(content);
          saveNoteStyleToDatabase(4, content);
          break;
        case 'style5':
          setNotesStyle5(content);
          saveNoteStyleToDatabase(5, content);
          break;
        default:
          onNotesChange(content);
          saveSummaryToDatabase(content);
      }
    } else {
      setTranscript(content);
      saveTranscriptToDatabase(content);
    }
  };

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
        case 'style4':
          currentContent = notesStyle4;
          updateColumn = 'notes_style_4';
          setStateFunction = setNotesStyle4;
          break;
        case 'style5':
          currentContent = notesStyle5;
          updateColumn = 'notes_style_5';
          setStateFunction = setNotesStyle5;
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
        .update({ [updateColumn]: enhancedContent })
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
        notesStyle2: notesStyle2?.length || 0,
        notesStyle3: notesStyle3?.length || 0,
        notesStyle4: notesStyle4?.length || 0,
        notesStyle5: notesStyle5?.length || 0,
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
          case 'style3': 
            currentContent = notesStyle2 || "";
            currentTabIdentifier = "notes-style3";
            break;
          case 'style4': 
            currentContent = notesStyle4 || "";
            currentTabIdentifier = "notes-style4";
            break;
          case 'style5': 
            currentContent = notesStyle5 || "";
            currentTabIdentifier = "notes-style5";
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
          case 'style3':
            setNotesStyle2(editingContent);
            saveNoteStyleToDatabase(2, editingContent);
            break;
          case 'style4':
            setNotesStyle4(editingContent);
            saveNoteStyleToDatabase(4, editingContent);
            break;
          case 'style5':
            setNotesStyle5(editingContent);
            saveNoteStyleToDatabase(5, editingContent);
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
  const cleanTranscript = (text: string): string => {
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
      toast.success('Transcript formatted into paragraphs');
      
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
      const cleanedTranscript = cleanTranscript(transcript);
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
      const { error } = await supabase
        .from('meeting_summaries')
        .upsert({
          meeting_id: meeting.id,
          summary: content,
          key_points: [],
          action_items: [],
          decisions: [],
          next_steps: []
        }, {
          onConflict: 'meeting_id'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving summary:', error);
      if (error.code === '23505') {
        // Handle duplicate key error - try update instead
        try {
          const { error: updateError } = await supabase
            .from('meeting_summaries')
            .update({ summary: content })
            .eq('meeting_id', meeting.id);
          
          if (updateError) throw updateError;
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
    if (!meeting?.id || !transcript) {
      return;
    }

    // Save current version before regenerating
    saveCurrentVersion('ai-regenerate', 'notes');
    setIsGenerating(true);
    
    try {
      const meetingDate = meeting.start_time ? new Date(meeting.start_time).toLocaleDateString('en-GB') : '';
      const meetingTime = meeting.start_time ? new Date(meeting.start_time).toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }) : '';

      // Add meeting metadata to transcript
      const transcriptWithMetadata = addMeetingMetadataToTranscript(transcript, {
        startTime: meeting.start_time,
        endTime: meeting.end_time || undefined,
        duration: meeting.duration_minutes ? `${meeting.duration_minutes} minutes` : meeting.duration
      });

      const { data, error } = await supabase.functions.invoke('generate-meeting-notes-claude', {
        body: {
          transcript: transcriptWithMetadata,
          meetingTitle: meeting.title,
          meetingDate: meetingDate,
          meetingTime: meetingTime,
          detailLevel: 'standard'
        }
      });

      if (error) throw error;

      if (data?.meetingMinutes) {
        onNotesChange(data.meetingMinutes);
        saveSummaryToDatabase(data.meetingMinutes);
        
        // Generate and save meeting overview for the history view
        await generateAndSaveOverview(data.meetingMinutes);
      }
    } catch (error) {
      console.error('Error regenerating meeting notes:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateNotesStyle2 = async () => {
    console.log('📄 Starting Minutes - Brief regeneration...');
    
    if (!meeting?.id || !transcript) {
      console.error('❌ Missing required data for Very Detailed:', { meetingId: meeting?.id, hasTranscript: !!transcript });
      return;
    }

    setIsGeneratingStyle2(true);
    try {
      const style2Prompt = `Please analyze the provided meeting transcript and create brief, professional meeting minutes with the following structure. Focus on capturing every point discussed while keeping descriptions concise and actionable.

FORMATTING REQUIREMENTS

Use clear, concise bullet points
Keep each point to 1-2 lines maximum
Maintain professional tone
Prioritize actionable information
Use consistent formatting throughout

REQUIRED STRUCTURE
MEETING OVERVIEW

Date: [Extract date]
Time: [Meeting time and duration]
Attendees: [Names and roles if mentioned]
Meeting Purpose: [One sentence objective]

AGENDA ITEMS DISCUSSED
[TOPIC 1 NAME]

[Key point 1 - one line summary]
[Key point 2 - one line summary]
[Key point 3 - one line summary]
Decision: [Final outcome if any]

[TOPIC 2 NAME]

[Key point 1 - one line summary]
[Key point 2 - one line summary]
Decision: [Final outcome if any]

[Continue for all topics discussed]
DECISIONS MADE

[Decision 1] - [Brief rationale]
[Decision 2] - [Brief rationale]
[Decision 3] - [Brief rationale]

ACTION ITEMS

[Task] - Owner: [Name] | Due: [Date]
[Task] - Owner: [Name] | Due: [Date]
[Task] - Owner: [Name] | Due: [Date]

NEXT STEPS

[Immediate next step 1]
[Immediate next step 2]
[Future meeting scheduled/required]

PARKING LOT

[Unresolved item 1]
[Unresolved item 2]
[Items for future discussion]


SPECIFIC INSTRUCTIONS:

Capture Every Point: Don't skip topics - include all substantive discussion points
One Line Per Point: Keep individual bullets concise but comprehensive
Clear Ownership: Always identify who is responsible for actions
Specific Timelines: Include exact dates and deadlines mentioned
Precise Language: Use concrete terms, avoid vague descriptions
Consistent Format: Maintain the same structure throughout
Complete Coverage: Ensure no significant discussion is omitted

TONE: Professional, neutral, factual - suitable for formal distribution and record-keeping.
LENGTH TARGET: Aim for 1-2 pages maximum while ensuring completeness.

Paste your meeting transcript after this prompt for processing.

${transcript}`;

      console.log('📝 Very Detailed prompt created, length:', style2Prompt.length);
      console.log('🚀 Calling Very Detailed generation...');

      // Add meeting metadata to transcript
      const transcriptWithMetadata = addMeetingMetadataToTranscript(transcript, {
        startTime: meeting.start_time,
        endTime: meeting.end_time || undefined,
        duration: meeting.duration_minutes ? `${meeting.duration_minutes} minutes` : meeting.duration
      });

      const { data, error } = await supabase.functions.invoke('generate-meeting-notes-claude', {
        body: {
          transcript: transcriptWithMetadata,
          meetingTitle: meeting.title,
          meetingDate: new Date().toLocaleDateString('en-GB'),
          meetingTime: new Date().toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          detailLevel: 'standard',
          customPrompt: style2Prompt
        }
      });

      console.log('📋 Very Detailed response:', { data: !!data, error: !!error });

      if (error) throw error;

      if (data?.meetingMinutes || data?.generatedNotes) {
        const generatedContent = data.meetingMinutes || data.generatedNotes;
        console.log('✅ Brief notes generated, length:', generatedContent.length);
        setNotesStyle2(generatedContent);
        
        // Save to database
        await saveNoteStyleToDatabase(2, generatedContent);
      } else {
        console.error('❌ No content in Brief response:', data);
      }
    } catch (error) {
      console.error('❌ Error generating Brief notes:', error);
    } finally {
      console.log('🏁 Brief generation finished');
      setIsGeneratingStyle2(false);
    }
  };

  const generateNotesStyle3 = async () => {
    console.log('📋 Starting Minutes - Standard regeneration...');
    
    if (!meeting?.id || !transcript) {
      console.error('❌ Missing required data for Standard:', { meetingId: meeting?.id, hasTranscript: !!transcript });
      return;
    }

    setIsGeneratingStyle3(true);
    try {
      // Round time to nearest 15 minutes
      const roundToNearest15Minutes = (date: Date) => {
        const minutes = date.getMinutes();
        const rounded = Math.round(minutes / 15) * 15;
        const newDate = new Date(date);
        newDate.setMinutes(rounded, 0, 0);
        return newDate;
      };

      const startDate = new Date(meeting.start_time || meeting.created_at);
      const roundedTime = roundToNearest15Minutes(startDate);
      
      const meetingDate = roundedTime.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric', 
        month: 'long',
        day: 'numeric'
      });
      
      const meetingTime = roundedTime.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      const style3Prompt = `Please analyze the provided meeting transcript and create standard meeting minutes that balance detail with readability. Provide enough context for understanding while keeping content focused and actionable.

**FORMATTING REQUIREMENTS**
• Use clear headings with bullet points and sub-bullets
• Include 2-3 sentences per major point
• Maintain professional, accessible language
• Ensure logical flow between sections
• Use bold text for emphasis on key items

**REQUIRED STRUCTURE**

**MEETING DETAILS**
• Date: ${meetingDate}
• Time: ${meetingTime}
• Attendees: [Names with roles/departments where mentioned]
• Meeting Objective: [1-2 sentence summary of purpose]

**EXECUTIVE SUMMARY**
Brief 3-4 sentence overview covering:
• Meeting's main focus and why it was called
• Primary outcomes achieved
• Key decisions made and next steps

**DISCUSSION SUMMARY**

**[TOPIC 1 NAME]**
Background: [1-2 sentences on context/why this was discussed]
Key Points:
• [Main point with brief explanation - 2-3 sentences]
• [Secondary point with context - 2-3 sentences]
• [Additional considerations raised - 2-3 sentences]
Outcome: [What was concluded or decided for this topic]

**[TOPIC 2 NAME]**
Background: [Brief context]
Key Points:
• [Detailed point with reasoning]
• [Alternative viewpoints discussed]
• [Technical/practical considerations]
Outcome: [Resolution or next steps]

[Continue for all major topics]

**DECISIONS & RESOLUTIONS**

**[Decision Title]**
• What: [Clear statement of decision]
• Why: [Brief rationale - 1-2 sentences]
• Impact: [Who/what this affects]

**[Decision Title]**
• What: [Decision details]
• Why: [Reasoning behind decision]
• Impact: [Scope of impact]

**ACTION ITEMS**
| Task | Owner | Due Date | Details |
|------|-------|----------|---------|
| [Specific task description] | [Name] | [Date] | [Context/requirements] |
| [Task with deliverable] | [Name] | [Date] | [Specifications/criteria] |

**FOLLOW-UP REQUIREMENTS**

Immediate Actions (Next 48 hours):
• [Urgent task with brief description]
• [Critical follow-up required]

Short-term Deliverables (1-2 weeks):
• [Milestone with context and owner]
• [Preparation needed for next phase]

Long-term Objectives:
• [Strategic goals established]
• [Future planning requirements]

**OPEN ITEMS & RISKS**

Unresolved Issues:
• [Item requiring further discussion with brief context]
• [Decision pending additional information]

Identified Risks:
• [Potential challenge with brief impact description]
• [Resource/timeline concerns noted]

**NEXT MEETING**
• Date/Time: [If scheduled]
• Focus: [Primary agenda for next session]
• Preparation Required: [What attendees need to do beforehand]

**GENERATION INSTRUCTIONS:**
• Balanced Detail: Provide enough context for non-attendees to understand decisions without overwhelming detail
• Complete Coverage: Include all substantive topics discussed, even if brief
• Clear Attribution: Note who raised points or made commitments when important
• Actionable Language: Use specific, measurable terms for action items
• Logical Grouping: Organize related discussion points together
• Professional Tone: Suitable for sharing with senior stakeholders
• Scan-Friendly: Easy to quickly find specific information
• Context Preservation: Include enough background for future reference

**TARGET LENGTH:** 2-4 pages - comprehensive without being verbose.
**TONE:** Professional, objective, informative - appropriate for formal business records.

Here is the meeting transcript to process:

${transcript}`;

      console.log('📝 Detailed prompt created, length:', style3Prompt.length);
      console.log('🚀 Calling Detailed generation...');

      // Add meeting metadata to transcript
      const transcriptWithMetadata = addMeetingMetadataToTranscript(transcript, {
        startTime: meeting.start_time,
        endTime: meeting.end_time || undefined,
        duration: meeting.duration_minutes ? `${meeting.duration_minutes} minutes` : meeting.duration
      });

      const { data, error } = await supabase.functions.invoke('generate-meeting-notes-claude', {
        body: {
          transcript: transcriptWithMetadata,
          meetingTitle: meeting.title,
          meetingDate: meetingDate,
          meetingTime: meetingTime,
          detailLevel: 'standard',
          customPrompt: style3Prompt
        }
      });

      console.log('📋 Detailed response:', { data: !!data, error: !!error });

      if (error) throw error;

      if (data?.meetingMinutes || data?.generatedNotes) {
        let generatedContent = data.meetingMinutes || data.generatedNotes;
        console.log('✅ Detailed notes generated, length:', generatedContent.length);
        
        // POST-PROCESSING CLEANUP: Remove any unwanted header text
        // Remove "Meeting - Date Not Specified" and "MINUTES" from the beginning
        generatedContent = generatedContent
          .replace(/^.*Meeting\s*-\s*Date\s*Not\s*Specified.*$/gim, '')
          .replace(/^.*MINUTES.*$/gim, '')
          .replace(/^[^\*]*\*\*Meeting Details\*\*/, '**Meeting Details**')
          .trim();
        
        // Ensure it starts with **Meeting Details**
        if (!generatedContent.startsWith('**Meeting Details**')) {
          const meetingDetailsMatch = generatedContent.match(/\*\*Meeting Details\*\*/);
          if (meetingDetailsMatch) {
            generatedContent = generatedContent.substring(generatedContent.indexOf('**Meeting Details**'));
          }
        }
        
        setNotesStyle3(generatedContent);
        
        // Save to database
        await saveNoteStyleToDatabase(3, generatedContent);
      } else {
        console.error('❌ No content in Detailed response:', data);
      }
    } catch (error) {
      console.error('❌ Error generating Standard notes:', error);
    } finally {
      console.log('🏁 Standard generation finished');
      setIsGeneratingStyle3(false);
    }
  };

  const generateNotesStyle4 = async () => {
    console.log('💼 Starting Minutes - Executive regeneration...');
    
    if (!meeting?.id || !transcript) {
      console.error('❌ Missing required data for Executive:', { meetingId: meeting?.id, hasTranscript: !!transcript });
      return;
    }

    setIsGeneratingStyle4(true);
    try {
      const style4Prompt = `Please analyze the provided PCN meeting transcript and create a brief executive overview specifically for non-attending GP partners. Focus on financial impacts, operational changes affecting practices, and strategic decisions while avoiding administrative detail.

**TARGET AUDIENCE**
• GP partners from member practices who didn't attend
• Limited PCN operational knowledge
• Need key information affecting their practice/finances
• Want updates without lengthy detail

**REQUIRED STRUCTURE**

📋 **MEETING SNAPSHOT**
Date: [Meeting date] | Duration: [Length] | Attendees: [Key roles only]
Meeting Focus: [One sentence - what this meeting was primarily about]

💰 **FINANCIAL HIGHLIGHTS**
Money Matters That Affect You:
• [Financial decision/impact in plain terms with £ amounts]
• [Budget allocation affecting member practices]
• [Revenue/funding changes and practice implications]
• [Any financial commitments requiring practice input]

🏥 **OPERATIONAL UPDATES**
Changes to How We Work:
• [Service delivery changes affecting patient flow]
• [Staffing decisions impacting practice operations]
• [New processes or requirements for member practices]
• [Technology/system changes you need to know about]

⚡ **KEY DECISIONS MADE**
• [Decision 1] - [Impact on practices in 1 line]
• [Decision 2] - [What this means for GPs in 1 line]
• [Decision 3] - [Practice implications briefly stated]

📅 **WHAT YOU NEED TO DO**
Action Required from Member Practices:
• [Specific task] - Due: [Date] - Contact: [Who to ask]
• [Information needed] - Due: [Date] - Details: [Brief requirement]
• [Decision input required] - Due: [Date] - Context: [Why needed]

Nothing Required But FYI:
• [Updates that don't need action but good to know]

🔄 **NEXT STEPS**
• [Immediate next action affecting practices]
• [Upcoming decision that might impact you]
• [Next meeting date if input needed]

❓ **QUESTIONS OR CONCERNS?**
Contact: [Primary contact name and method]
For: [What types of queries they handle]

**GENERATION GUIDELINES:**
• Lead with Money: Always prioritize financial impacts first
• Practice Impact Focus: Only include what affects day-to-day practice operations
• Plain English: Avoid PCN jargon - explain acronyms briefly
• Bottom Line Up Front: Start each section with the most important point
• Quantify Everything: Include specific amounts, dates, and numbers
• Action Clarity: Make any required actions crystal clear
• Skip Process Detail: Don't explain how decisions were reached, just what was decided
• Time Respect: Maximum 1 page - these are busy clinicians

**CRITICAL FILTERS:**
• Include: Financial changes, operational impacts, required actions, strategic shifts
• Exclude: Administrative process, detailed discussions, background context, procedural updates
• Emphasize: Anything costing money, making money, or changing patient care delivery

**TONE:** Professional but conversational - like briefing a colleague over coffee.
**LENGTH TARGET:** Maximum 1 page that can be read in under 3 minutes.

Here is the PCN meeting transcript to process:

${transcript}`;

      console.log('📝 Executive prompt created, length:', style4Prompt.length);
      console.log('🚀 Calling Executive generation...');

      // Add meeting metadata to transcript
      const transcriptWithMetadata = addMeetingMetadataToTranscript(transcript, {
        startTime: meeting.start_time,
        endTime: meeting.end_time || undefined,
        duration: meeting.duration_minutes ? `${meeting.duration_minutes} minutes` : meeting.duration
      });

      const { data, error } = await supabase.functions.invoke('generate-meeting-notes-claude', {
        body: {
          transcript: transcriptWithMetadata,
          meetingTitle: meeting.title,
          meetingDate: new Date().toLocaleDateString('en-GB'),
          meetingTime: new Date().toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          detailLevel: 'standard',
          customPrompt: style4Prompt
        }
      });

      console.log('📋 Executive response:', { data: !!data, error: !!error });

      if (error) throw error;

      if (data?.meetingMinutes || data?.generatedNotes) {
        const generatedContent = data.meetingMinutes || data.generatedNotes;
        console.log('✅ Executive notes generated, length:', generatedContent.length);
        setNotesStyle4(generatedContent);
        
        // Save to database
        await saveNoteStyleToDatabase(4, generatedContent);
      } else {
        console.error('❌ No content in Executive response:', data);
      }
    } catch (error) {
      console.error('❌ Error generating Executive notes:', error);
    } finally {
      console.log('🏁 Executive generation finished');
      setIsGeneratingStyle4(false);
    }
  };

  const generateNotesStyle5 = async () => {
    console.log('🎭 Starting limerick generation...');
    
    if (!meeting?.id || !transcript) {
      console.error('❌ Missing required data:', { meetingId: meeting?.id, hasTranscript: !!transcript });
      return;
    }

    setIsGeneratingStyle5(true);
    try {
      const style5Prompt = `Please analyze the provided meeting transcript and create an amusing limerick that captures the essence of the meeting. The limerick should be lighthearted, professional, and suitable for sharing with colleagues.

**LIMERICK REQUIREMENTS**

**Structure**
• 5 lines total
• AABBA rhyme scheme (lines 1, 2, 5 rhyme; lines 3, 4 rhyme)
• Meter: Lines 1, 2, 5 are longer; lines 3, 4 are shorter
• Topic: Based on main meeting themes, decisions, or memorable moments

**Content Guidelines**
• Gentle Humor: Amusing but respectful
• Meeting-Relevant: Reference actual topics discussed
• Workplace Appropriate: Suitable for professional sharing
• Inclusive: Not targeting any individual negatively
• Clever: Use wordplay, puns, or meeting-specific terminology where possible

**Style Examples**
Topic-based:
• "There once was a meeting on [topic]..."
• "A discussion on [subject] was held..."
• "The team met to talk about [issue]..."

Outcome-based:
• "A decision was made with great care..."
• "The group reached consensus that day..."

**PCN/Healthcare Context**
When appropriate, incorporate:
• Healthcare terminology (but keep accessible)
• PCN-specific references
• GP practice dynamics
• Patient care themes
• Administrative challenges (gently mocked)

**GENERATION INSTRUCTIONS**
1. Read the Transcript: Identify 2-3 main themes or memorable moments
2. Choose Focus: Pick the most interesting/amusing aspect suitable for limerick treatment
3. Check Tone: Ensure humor is gentle and workplace-appropriate
4. Verify Meter: Read aloud to ensure proper limerick rhythm
5. Test Rhymes: Confirm AABBA pattern works naturally
6. Add Context: Include brief explanation of what meeting aspect inspired the limerick

**OUTPUT FORMAT**
**Meeting Limerick**
[The 5-line limerick]

**Inspiration:** [1-2 sentences explaining which part of the meeting inspired this limerick and why it was amusing/noteworthy]

**TONE:** Light, clever, good-natured - something that would get a chuckle in the coffee room without causing offense.
**QUALITY CHECK:** Each limerick should be clever and meeting-relevant. For longer meetings, aim for 3-5 limericks covering different aspects. For shorter meetings, 2-3 limericks may suffice.

Here is the meeting transcript to process:

${transcript}`;

      console.log('📝 Limerick prompt created, length:', style5Prompt.length);
      console.log('🚀 Calling Supabase function...');

      // Add meeting metadata to transcript
      const transcriptWithMetadata = addMeetingMetadataToTranscript(transcript, {
        startTime: meeting.start_time,
        endTime: meeting.end_time || undefined,
        duration: meeting.duration_minutes ? `${meeting.duration_minutes} minutes` : meeting.duration
      });

      const { data, error } = await supabase.functions.invoke('generate-meeting-notes-claude', {
        body: {
          transcript: transcriptWithMetadata,
          meetingTitle: meeting.title,
          meetingDate: new Date().toLocaleDateString('en-GB'),
          meetingTime: new Date().toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          detailLevel: 'standard',
          customPrompt: style5Prompt
        }
      });

      console.log('📋 Function response:', { data: !!data, error: !!error });

      if (error) {
        console.error('❌ Supabase function error:', error);
        throw error;
      }

      if (data?.meetingMinutes || data?.generatedNotes) {
        const generatedContent = data.meetingMinutes || data.generatedNotes;
        console.log('✅ Limerick generated, length:', generatedContent.length);
        console.log('🎭 Limerick preview:', generatedContent.substring(0, 200));
        
        setNotesStyle5(generatedContent);
        
        // Save to database
        await saveNoteStyleToDatabase(5, generatedContent);
      } else {
        console.error('❌ No content in response:', data);
      }
    } catch (error) {
      console.error('❌ Error generating limerick:', error);
    } finally {
      console.log('🏁 Limerick generation finished');
      setIsGeneratingStyle5(false);
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

    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('enhance-meeting-minutes', {
        body: {
          originalContent: notes,
          enhancementType: 'custom',
          customRequest: customInstruction,
          additionalContext: ''
        }
      });

      if (error) throw error;

      if (data?.enhancedContent) {
        onNotesChange(data.enhancedContent);
        saveSummaryToDatabase(data.enhancedContent);
        setCustomInstruction("");
        setShowCustomInstruction(false);
      }
    } catch (error) {
      console.error('Error applying custom instructions:', error);
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

  // Quick Pick Actions
  const handleQuickPickAction = (action: string) => {
    const currentContent = getCurrentContent();
    const actions: { [key: string]: () => string } = {
      'uppercase': () => currentContent.toUpperCase(),
      'lowercase': () => currentContent.toLowerCase(),
      'title-case': () => currentContent.replace(/\w\S*/g, (txt) => 
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      ),
      'sentence-case': () => currentContent.charAt(0).toUpperCase() + currentContent.slice(1).toLowerCase(),
      'remove-extra-spaces': () => currentContent.replace(/\s+/g, ' ').trim(),
      'add-bullet-points': () => currentContent.split('\n')
        .filter(line => line.trim())
        .map(line => `• ${line.trim()}`)
        .join('\n'),
      'add-numbers': () => currentContent.split('\n')
        .filter(line => line.trim())
        .map((line, index) => `${index + 1}. ${line.trim()}`)
        .join('\n'),
      'remove-bullets': () => currentContent.replace(/^[\s]*[•\-*]\s*/gm, ''),
      'remove-numbers': () => currentContent.replace(/^[\s]*\d+\.\s*/gm, ''),
      'clinical-summary': () => currentContent + '\n\n## Clinical Summary\n[AI-generated summary would appear here]',
      'action-items': () => currentContent + '\n\n## Action Items\n[Extracted action items would appear here]',
      'patient-care-focus': () => currentContent + '\n\n## Patient Care Focus\n[Patient care highlights would appear here]'
    };

    const result = actions[action]?.();
    if (result) {
      if (activeTab === "notes") {
        onNotesChange(result);
      }
    }
  };

  // AI Enhancement functionality
  const handleAIEnhancement = async (enhanceType: string) => {
    const currentContent = getCurrentContent();
    if (!currentContent.trim()) {
      return;
    }

    setIsGenerating(true);
    
    try {
      const prompts = {
        'clinical-focus': 'Focus on and enhance all clinical discussions, medical decisions, and patient care elements. Emphasize diagnostic considerations, treatment plans, and clinical reasoning.',
        'action-analysis': 'Extract and organize all action items, decisions, and follow-up tasks. Create a structured analysis of responsibilities, timelines, and outcomes.',
        'professional-tone': 'Enhance the language to meet professional healthcare standards. Use appropriate medical terminology and formal business language.',
        'risk-assessment': 'Identify and highlight all clinical and operational risks mentioned. Add risk assessment context and mitigation considerations.',
        'follow-up-plans': 'Generate comprehensive follow-up recommendations based on the discussions. Include timelines, responsible parties, and success metrics.',
        'patient-safety': 'Emphasize all patient safety elements, quality improvement discussions, and safeguarding considerations. Highlight safety protocols and outcomes.'
      };

      const { data, error } = await supabase.functions.invoke('enhance-meeting-minutes', {
        body: {
          originalContent: currentContent,
          enhancementType: 'custom',
          specificRequest: prompts[enhanceType as keyof typeof prompts] || enhanceType,
          context: `Meeting ID: ${meeting?.id}`
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      onNotesChange(data.enhancedContent);
    } catch (error) {
      console.error('Enhancement error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Custom AI Enhancement
  const handleCustomAISubmit = async (prompt: string) => {
    const currentContent = getCurrentContent();
    if (!currentContent.trim() || !prompt.trim()) {
      return;
    }

    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('enhance-meeting-minutes', {
        body: {
          originalContent: currentContent,
          enhancementType: 'custom',
          specificRequest: prompt,
          context: `Meeting ID: ${meeting?.id}`
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      onNotesChange(data.enhancedContent);
      setShowCustomAIModal(false);
    } catch (error) {
      console.error('Custom enhancement error:', error);
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

  return (
    <>
      <NoteEnhancementDialog
        open={enhancementDialogOpen}
        onOpenChange={setEnhancementDialogOpen}
        originalContent={
          activeNotesStyleTab === 'style1' ? notesStyle3 :
          activeNotesStyleTab === 'style4' ? notesStyle4 :
          activeNotesStyleTab === 'style5' ? notesStyle5 :
          notesStyle3
        }
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
        className={`${isMobile 
          ? "w-full h-full max-w-none max-h-none inset-0 m-0 rounded-none border-0" 
          : "max-w-6xl h-[90vh] max-h-screen"
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
              <Bot className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="truncate">{meeting.title} - Meeting Notes</span>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size={isMobile ? "sm" : "sm"} 
                  className={`gap-2 ${isMobile ? "mr-1 px-2" : "mr-2"} touch-manipulation min-h-[44px] sm:min-h-[36px]`}
                >
                  <Download className="h-4 w-4" />
                  {!isMobile && "Quick Pick"}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
               <DropdownMenuContent align="end" className="w-56">
                 <DropdownMenuGroup>
                   <DropdownMenuItem onClick={() => copyToClipboard(getCurrentContent())}>
                     <Copy className="h-4 w-4 mr-2" />
                     Copy to Clipboard
                   </DropdownMenuItem>
                   
                   {/* Regenerate option - show on notes tab when transcript is available */}
                   {activeTab === "notes" && transcript && (
                     <DropdownMenuItem onClick={handleRegenerateNotes} disabled={isGenerating}>
                       <RefreshCw className="h-4 w-4 mr-2" />
                       {isGenerating ? 'Regenerating...' : 'Regenerate Notes'}
                     </DropdownMenuItem>
                   )}
                   
                   <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => generateAdvancedWordDocument(getCurrentContent(), `${meeting.title} - ${activeTab === "notes" ? "Meeting Notes" : "Transcript"}`)}>
                        <FileText className="h-4 w-4 mr-2" />
                        Download as Word
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => generatePDF(getCurrentContent(), `${meeting.title} - ${activeTab === "notes" ? "Meeting Notes" : "Transcript"}`)}>
                        <FileType className="h-4 w-4 mr-2" />
                        Download as PDF
                      </DropdownMenuItem>
                       <DropdownMenuItem onClick={() => {
                         // Create clean plain text version
                         const cleanPlainText = (content: string) => {
                           if (!content) return '';
                           
                           return content
                             // First convert HTML breaks to newlines
                             .replace(/<br\s*\/?>/gi, '\n')
                             .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
                             .replace(/<\/p>/gi, '\n')
                             .replace(/<p[^>]*>/gi, '')
                             
                             // Handle headers with proper spacing
                             .replace(/<\/h[1-6]>/gi, '\n\n')
                             .replace(/<h[1-6][^>]*>/gi, '')
                             
                             // Remove all HTML tags
                             .replace(/<[^>]*>/g, '')
                             
                             // Remove markdown formatting
                             .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove **bold**
                             .replace(/\*([^*]+)\*/g, '$1') // Remove *italic*
                             .replace(/~~([^~]+)~~/g, '$1') // Remove ~~strikethrough~~
                             .replace(/`([^`]+)`/g, '$1') // Remove `code`
                             .replace(/^#+\s*/gm, '') // Remove markdown headers
                             
                             // Convert HTML entities
                             .replace(/&nbsp;/g, ' ')
                             .replace(/&amp;/g, '&')
                             .replace(/&lt;/g, '<')
                             .replace(/&gt;/g, '>')
                             .replace(/&quot;/g, '"')
                             .replace(/&#39;/g, "'")
                             .replace(/&apos;/g, "'")
                             
                             // Clean up spacing while maintaining structure
                             .replace(/[ \t]+/g, ' ') // Multiple spaces to single space
                             .replace(/\n[ \t]+/g, '\n') // Remove leading spaces on new lines
                             .replace(/[ \t]+\n/g, '\n') // Remove trailing spaces before new lines
                             .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
                             .replace(/^---+$/gm, '') // Remove horizontal rules
                             .replace(/^\s*[\*\-\+]\s*/gm, '• ') // Convert markdown bullets to simple bullets
                             .trim();
                         };
                         
                         const plainTextContent = cleanPlainText(getCurrentContent());
                         const element = document.createElement("a");
                         const file = new Blob([plainTextContent], { type: 'text/plain' });
                         element.href = URL.createObjectURL(file);
                         element.download = `${meeting.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${activeTab}.txt`;
                         document.body.appendChild(element);
                          element.click();
                          document.body.removeChild(element);
                        }}>
                        <Type className="h-4 w-4 mr-2" />
                        Download as Plain Text
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => setShowFindReplace(!showFindReplace)}>
                        <Search className="h-4 w-4 mr-2" />
                        Find and Replace
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowCustomInstruction(!showCustomInstruction)}>
                        <Mic className="h-4 w-4 mr-2" />
                        Update Names and Terms
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  
                  <DropdownMenuItem onClick={() => setEnhancementDialogOpen(true)}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI Enhance
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
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
                onApply={(updatedText) => {
                  setCurrentContent(updatedText);
                  if (activeTab === "notes") {
                    saveSummaryToDatabase(updatedText);
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
            <Tabs defaultValue="notes" value={activeTab} onValueChange={(value) => {
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
                    case 'style3':
                      setNotesStyle2(editingContent);
                      saveNoteStyleToDatabase(2, editingContent);
                      break;
                    case 'style4':
                      setNotesStyle4(editingContent);
                      saveNoteStyleToDatabase(4, editingContent);
                      break;
                    case 'style5':
                      setNotesStyle5(editingContent);
                      saveNoteStyleToDatabase(5, editingContent);
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
              setActiveTab(value);
            }} className="h-full flex flex-col">
              <div className="px-6 pt-4 flex-shrink-0">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="notes">Meeting Notes</TabsTrigger>
                  <TabsTrigger value="transcript">Meeting Transcript</TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="notes" className="flex-1 overflow-hidden mt-0 bg-white">
                <div className="h-full flex flex-col">
                  {/* Sub-tabs for different meeting notes styles - positioned directly under main tab header */}
                  <div className="flex-1 overflow-hidden px-6 pt-4">
                     <Tabs value={activeNotesStyleTab} onValueChange={setActiveNotesStyleTab} className="h-full flex flex-col">
                       <TabsList className="grid w-full grid-cols-3 md:grid-cols-3 mb-4">
                          <TabsTrigger value="style1" className="text-xs sm:text-sm">
                            Minutes - Standard
                          </TabsTrigger>
                          <TabsTrigger value="style4" className="text-xs sm:text-sm">
                            Minutes - Executive
                          </TabsTrigger>
                          <TabsTrigger value="style5" className="text-xs sm:text-sm">
                            Minutes - Limerick
                          </TabsTrigger>
                        </TabsList>

                      {/* Meeting Notes header and controls moved below sub-tabs */}
                      <div className="flex items-center justify-between pb-4 flex-shrink-0">
                        <h3 className="text-lg font-semibold">Meeting Notes</h3>
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
                          {/* Action buttons for each tab when content exists */}
                          {(() => {
                            const getTabContent = () => {
                              switch (activeNotesStyleTab) {
                                case 'style1': return notesStyle3;
                                case 'style2': return notes;
                                case 'style4': return notesStyle4;
                                case 'style5': return notesStyle5;
                                default: return null;
                              }
                            };
                            
                             const getTabName = () => {
                               switch (activeNotesStyleTab) {
                                 case 'style1': return 'Minutes - Standard';
                                 case 'style2': return 'Minutes - Brief';
                                case 'style4': return 'Minutes - Executive';
                                case 'style5': return 'Minutes - Limerick';
                                default: return 'Meeting Notes';
                              }
                            };
                            
                            const getGenerateFunction = () => {
                              switch (activeNotesStyleTab) {
                                case 'style1': return generateNotesStyle3;
                                case 'style2': return handleRegenerateNotes;
                                case 'style4': return generateNotesStyle4;
                                case 'style5': return generateNotesStyle5;
                                default: return () => {};
                              }
                            };
                            
                            const getGeneratingState = () => {
                              switch (activeNotesStyleTab) {
                                case 'style1': return isGeneratingStyle3;
                                case 'style2': return isGenerating;
                                case 'style4': return isGeneratingStyle4;
                                case 'style5': return isGeneratingStyle5;
                                default: return false;
                              }
                            };
                            
                            const content = getTabContent();
                            const tabName = getTabName();
                            const generateFunction = getGenerateFunction();
                            const isCurrentlyGenerating = getGeneratingState();
                            
                            return content ? (
                              <>
                                {(activeNotesStyleTab === 'style1' || activeNotesStyleTab === 'style4' || activeNotesStyleTab === 'style5') && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          onClick={() => setEnhancementDialogOpen(true)}
                                          variant="outline"
                                          size="icon"
                                        >
                                          <Wand2 className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Enhance notes</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent 
                                    align="end" 
                                    className="w-48 bg-popover border shadow-md" 
                                    style={{ zIndex: 180 }}
                                    sideOffset={5}
                                  >
                                    <DropdownMenuItem 
                                      onSelect={() => {
                                        if (content) {
                                          generateAdvancedWordDocument(content, tabName);
                                        }
                                      }}
                                    >
                                      <FileText className="h-4 w-4 mr-2" />
                                      Download Word
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onSelect={async () => {
                                        if (content) {
                                          const success = await copyPlainTextToClipboard(content, `${tabName} copied to clipboard`);
                                        }
                                      }}
                                    >
                                      <Copy className="h-4 w-4 mr-2" />
                                      Copy to Clipboard
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onSelect={(e) => {
                                        // Prevent immediate dropdown close to allow modal state to propagate
                                        e.preventDefault();
                                        console.log('📧 Send Email clicked from dropdown', { tabName, hasContent: !!content });
                                        setEmailModalContent({ title: tabName, notes: content || '' });
                                        // Use setTimeout to ensure dropdown closes gracefully before modal opens
                                        setTimeout(() => {
                                          setEmailModalOpen(true);
                                        }, 50);
                                      }}
                                    >
                                      <Mail className="h-4 w-4 mr-2" />
                                      Send Email
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>

                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        onClick={generateFunction}
                                        variant="outline"
                                        size="icon"
                                        disabled={isCurrentlyGenerating}
                                      >
                                        {isCurrentlyGenerating ? (
                                          <RefreshCw className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <RefreshCw className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{isCurrentlyGenerating ? 'Regenerating...' : 'Regenerate notes'}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </>
                            ) : null;
                          })()}
                        </div>
                      </div>
                      
                       <TabsContent value="style1" className="flex-1 overflow-auto pb-6">
                         {isEditing && editingTab === "notes-style1" ? (
                           <Textarea
                             value={editingContent}
                             onChange={(e) => setEditingContent(e.target.value)}
                             className="h-full w-full font-mono text-sm resize-none"
                             placeholder="Meeting notes will appear here..."
                           />
                         ) : (
                           <div className="space-y-4">
                             {!notesStyle3 ? (
                               <div className="flex flex-col items-center justify-center h-32 space-y-4">
                                  <p className="text-muted-foreground text-center">
                                    Generate comprehensive meeting notes with structured format (auto-generated as default)
                                  </p>
                                  <Button
                                    onClick={generateNotesStyle3}
                                    disabled={isGeneratingStyle3 || !transcript}
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
                                        Generate Minutes - Standard
                                      </>
                                    )}
                                 </Button>
                               </div>
                             ) : (
                               <div className="space-y-4">
                                 <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground">
                                   <div 
                                     dangerouslySetInnerHTML={{ 
                                       __html: renderNHSMarkdown(notesStyle3, { enableNHSStyling: true })
                                     }}
                                   />
                                 </div>
                               </div>
                             )}
                           </div>
                         )}
                       </TabsContent>
                      
                       <TabsContent value="style2" className="flex-1 overflow-auto pb-6">
                         {isEditing && editingTab === "notes-style2" ? (
                           <Textarea
                             value={editingContent}
                             onChange={(e) => setEditingContent(e.target.value)}
                             className="h-full w-full font-mono text-sm resize-none"
                             placeholder="Meeting notes will appear here..."
                           />
                         ) : (
                           <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground">
                             <div 
                               dangerouslySetInnerHTML={{ 
                                 __html: renderNHSMarkdown(notes, { enableNHSStyling: true })
                               }}
                             />
                           </div>
                         )}
                       </TabsContent>
                      
                      
                       <TabsContent value="style4" className="flex-1 overflow-auto pb-6">
                         {isEditing && editingTab === "notes-style4" ? (
                           <Textarea
                             value={editingContent}
                             onChange={(e) => setEditingContent(e.target.value)}
                             className="h-full w-full font-mono text-sm resize-none"
                             placeholder="Meeting notes will appear here..."
                           />
                         ) : (
                           <div className="space-y-4">
                             {!notesStyle4 ? (
                               <div className="flex flex-col items-center justify-center h-32 space-y-4">
                                 <p className="text-muted-foreground text-center">
                                   Generate a concise GP Partner update with key decisions and finance highlights
                                 </p>
                                 <Button
                                   onClick={generateNotesStyle4}
                                   disabled={isGeneratingStyle4 || !transcript}
                                   className="gap-2"
                                 >
                                   {isGeneratingStyle4 ? (
                                     <>
                                       <RefreshCw className="h-4 w-4 animate-spin" />
                                       Generating Style 4...
                                     </>
                                   ) : (
                                     <>
                                       <Sparkles className="h-4 w-4" />
                                       Generate Minutes - Executive
                                     </>
                                   )}
                                 </Button>
                               </div>
                             ) : (
                                <div className="space-y-4">
                                  <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground">
                                    <div 
                                      dangerouslySetInnerHTML={{ 
                                        __html: renderNHSMarkdown(notesStyle4, { enableNHSStyling: true })
                                      }}
                                    />
                                  </div>
                                </div>
                             )}
                           </div>
                         )}
                       </TabsContent>
                      
                       <TabsContent value="style5" className="flex-1 overflow-auto pb-6">
                         {isEditing && editingTab === "notes-style5" ? (
                           <Textarea
                             value={editingContent}
                             onChange={(e) => setEditingContent(e.target.value)}
                             className="h-full w-full font-mono text-sm resize-none"
                             placeholder="Meeting notes will appear here..."
                           />
                         ) : (
                           <div className="space-y-4">
                             {!notesStyle5 ? (
                               <div className="flex flex-col items-center justify-center h-32 space-y-4">
                                 <p className="text-muted-foreground text-center">
                                   Generate a light-hearted poetic summary with rhyming verses and professional humor
                                 </p>
                                 <Button
                                   onClick={generateNotesStyle5}
                                   disabled={isGeneratingStyle5 || !transcript}
                                   className="gap-2"
                                 >
                                   {isGeneratingStyle5 ? (
                                     <>
                                       <RefreshCw className="h-4 w-4 animate-spin" />
                                       Generating Style 5...
                                     </>
                                   ) : (
                                     <>
                                       <Sparkles className="h-4 w-4" />
                                       Generate Minutes - Limerick
                                     </>
                                   )}
                                 </Button>
                               </div>
                             ) : (
                                <div className="space-y-4">
                                  <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground">
                                    <div 
                                      dangerouslySetInnerHTML={{ 
                                        __html: renderPoeticContent(notesStyle5)
                                      }}
                                    />
                                  </div>
                                </div>
                             )}
                           </div>
                         )}
                       </TabsContent>
                    </Tabs>
                  </div>
                </div>
              </TabsContent>
               
               <TabsContent value="transcript" className="flex-1 overflow-hidden mt-0 bg-white">
                <div className="h-full flex flex-col">
                  {/* Primary transcript content */}
                  <div className="flex-1 overflow-hidden px-6 pt-4">
                    <div className="h-full flex flex-col">
                      <div className="flex items-center justify-between pb-4 flex-shrink-0">
                        <div className="flex items-center gap-4">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            Meeting Transcript
                            {transcript && (
                              <span className="text-sm font-normal text-muted-foreground">
                                ({transcript.trim().split(/\s+/).filter(w => w.length > 0).length.toLocaleString('en-GB')} words)
                              </span>
                            )}
                          </h3>
                        </div>
                      </div>
                          
                          <div className="flex items-center justify-between pb-4 flex-shrink-0">
                            <div className="flex items-center gap-4">
                              {transcript && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        onClick={handleFormatParagraphs}
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        disabled={!transcript || transcript.trim().length === 0 || isFormattingParagraphs}
                                        title="Format transcript into neat paragraphs"
                                      >
                                        <AlignJustify className={`h-4 w-4 ${isFormattingParagraphs ? 'animate-pulse' : ''}`} />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{isFormattingParagraphs ? 'Formatting...' : 'Format into paragraphs'}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      onClick={() => {
                                        console.log('🔵 Add Context button clicked, opening dialog');
                                        setShowContextDialog(true);
                                      }}
                                      variant="outline"
                                      size="icon"
                                      title="Add context like agendas, attendee lists, or presentations"
                                    >
                                      <FilePlus2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Add meeting agendas, attendee lists, or presentations</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      onClick={() => copyToClipboard(transcript || '')}
                                      variant="outline"
                                      size="icon"
                                      disabled={!transcript || transcript.trim().length === 0}
                                      title="Copy transcript to clipboard"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Copy transcript to clipboard</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              {/* Save transcript button */}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      onClick={async () => {
                                        if (!transcript || transcript.trim().length === 0) return;
                                        await saveTranscriptToDatabase(transcript);
                                        toast.success('Transcript saved');
                                      }}
                                      variant="outline"
                                      size="icon"
                                      disabled={!transcript || transcript.trim().length === 0}
                                      title="Save transcript to this meeting"
                                    >
                                      <Save className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Save transcript</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      onClick={handleGPTCleanTranscript}
                                      variant="outline"
                                      size="icon"
                                      disabled={!transcript || transcript.trim().length === 0 || isLoadingTranscript}
                                      title="Deep clean transcript using GPT to remove duplicates and improve formatting"
                                    >
                                      <Bot className={`h-4 w-4 ${isLoadingTranscript ? 'animate-pulse' : ''}`} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{isLoadingTranscript ? 'AI Processing...' : 'Deep clean transcript using GPT'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              {isEditing && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        onClick={handleUndo}
                                        variant="outline"
                                        size="icon"
                                        disabled={transcriptVersions.length === 0}
                                        title={`Undo (${transcriptVersions.length} versions available)`}
                                      >
                                        <Undo2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Undo ({transcriptVersions.length} versions available)</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}

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
                                    <p>{isEditing ? 'Save' : 'Edit'} transcript</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                          
                          <ScrollArea className="flex-1 h-full">
                            <div className="pr-4">
                              {isLoadingTranscript ? (
                                <div className="flex items-center justify-center h-32">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                  <span className="ml-2">Loading transcript...</span>
                                </div>
                              ) : isEditing && editingTab === "transcript" ? (
                                <Textarea
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  className="min-h-[500px] w-full font-mono text-sm resize-none"
                                  placeholder="Meeting transcript will appear here..."
                                />
                              ) : !transcript ? (
                                <div className="flex items-center justify-center h-32 text-muted-foreground">
                                  No transcript available for this meeting.
                                </div>
                              ) : (
                                <div 
                                  className="prose prose-sm max-w-none text-sm leading-relaxed transcript-content"
                                  dangerouslySetInnerHTML={{ __html: searchTerm ? highlightedTranscript : transcript }}
                                />
                              )}
                            </div>
                      </ScrollArea>
                    </div>
                  </div>
                </div>
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
            const formattedContext = formatTranscriptContext(contextTypes, files, customLabel);
            const currentTranscript = transcript || '';
            const updatedTranscript = formattedContext + currentTranscript;
            setTranscript(updatedTranscript);
            saveTranscriptToDatabase(updatedTranscript);
            toast.success('Context added and saved to transcript');
          }}
        />

      </Dialog>
      
      <EmailMeetingMinutesModal
        isOpen={emailModalOpen}
        onOpenChange={setEmailModalOpen}
        meetingId={meeting?.id || ''}
        meetingTitle={emailModalContent.title}
        meetingNotes={emailModalContent.notes}
      />
    </>
  );
};