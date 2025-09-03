import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';
import { ClaudeEnhancementModal } from "@/components/ClaudeEnhancementModal";
import EnhancedFindReplacePanel from "@/components/EnhancedFindReplacePanel";
import { SpeechToText } from "@/components/SpeechToText";
import { MeetingTemplatesTab } from "@/components/MeetingTemplatesTab";
import { RecordingWarningBanner } from "@/components/RecordingWarningBanner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRecording } from "@/contexts/RecordingContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import stringSimilarity from "string-similarity";
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
  FolderOpen
} from "lucide-react";

interface Meeting {
  id: string;
  title: string;
  start_time: string;
  created_at: string;
  notes_style_2?: string;
  notes_style_3?: string;
  notes_style_4?: string;
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("notes");
  const [activeNotesStyleTab, setActiveNotesStyleTab] = useState("style1");
  const [notesStyle2, setNotesStyle2] = useState("");
  const [notesStyle3, setNotesStyle3] = useState("");
  const [notesStyle4, setNotesStyle4] = useState("");
  const [isGeneratingStyle2, setIsGeneratingStyle2] = useState(false);
  const [isGeneratingStyle3, setIsGeneratingStyle3] = useState(false);
  const [isGeneratingStyle4, setIsGeneratingStyle4] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [editingContent, setEditingContent] = useState(""); // Clean content for editing
  const [editingTab, setEditingTab] = useState<string>(""); // Track which tab is being edited
  
  // Version history for undo functionality
  const [notesVersions, setNotesVersions] = useState<ContentVersion[]>([]);
  const [transcriptVersions, setTranscriptVersions] = useState<ContentVersion[]>([]);
  
  // Search functionality for transcript
  const [searchTerm, setSearchTerm] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [highlightedTranscript, setHighlightedTranscript] = useState("");

  // Fetch transcript when modal opens - defer during recording to prevent interference
  useEffect(() => {
    console.log('🔍 FullPageNotesModal useEffect - isOpen:', isOpen, 'meeting?.id:', meeting?.id, 'isRecording:', isRecording);
    if (isOpen && meeting?.id) {
      if (isResourceOperationSafe()) {
        console.log('🔍 FullPageNotesModal fetching data for meeting:', meeting.id);
        fetchTranscriptData();
      } else {
        console.log('⚠️ Deferring transcript fetch - recording in progress');
        toast.info('Database operations paused during recording to prevent interference');
        
        // Set up a check for when recording stops
        const checkRecordingComplete = setInterval(() => {
          if (isResourceOperationSafe()) {
            console.log('✅ Recording stopped, fetching deferred data');
            fetchTranscriptData();
            clearInterval(checkRecordingComplete);
          }
        }, 1000);
        
        return () => clearInterval(checkRecordingComplete);
      }
    }
  }, [isOpen, meeting?.id, isResourceOperationSafe]);

  const fetchTranscriptData = async () => {
    if (!meeting?.id) return;
    
    setIsLoadingTranscript(true);
    try {
      console.log('🔍 Fetching transcript data for meeting:', meeting.id);
      
      // Fetch processed transcript
      const { data: transcriptData, error: transcriptError } = await supabase.rpc('get_meeting_full_transcript', {
        p_meeting_id: meeting.id
      });
      
      if (transcriptError) {
        console.error('❌ Error fetching transcript:', transcriptError);
      } else if (transcriptData && Array.isArray(transcriptData) && transcriptData.length > 0) {
        console.log('✅ Transcript fetched:', transcriptData.length, 'segments');
        // Combine all transcript segments
        const fullTranscript = transcriptData.map(segment => segment.transcript).join(' ');
        setTranscript(fullTranscript);
      } else {
        console.log('📝 No transcript data found');
      }
      
    } catch (error) {
      console.error('Error fetching transcript data:', error);
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  // Load existing note styles from database
  const loadExistingNoteStyles = async () => {
    if (!meeting?.id) return;

    try {
      console.log('🔍 Loading existing note styles for meeting:', meeting.id);
      
      const { data: meetingData, error } = await supabase
        .from('meetings')
        .select('notes_style_2, notes_style_3, notes_style_4')
        .eq('id', meeting.id)
        .eq('user_id', user?.id)
        .single();

      if (error) {
        console.error('❌ Error loading note styles:', error);
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
        console.log('✅ Loaded existing note styles');
      }
    } catch (error) {
      console.error('Error loading note styles:', error);
    }
  };

  // Save note style to database
  const saveNoteStyleToDatabase = async (styleNumber: number, content: string) => {
    if (!meeting?.id || !user?.id || !content.trim()) return;

    try {
      const columnName = `notes_style_${styleNumber}`;
      const { error } = await supabase
        .from('meetings')
        .update({ [columnName]: content })
        .eq('id', meeting.id)
        .eq('user_id', user.id);

      if (error) {
        console.error(`❌ Error saving notes style ${styleNumber}:`, error);
        toast.error(`Failed to save Meeting Notes Style ${styleNumber}`);
      } else {
        console.log(`✅ Meeting Notes Style ${styleNumber} saved to database`);
      }
    } catch (error) {
      console.error(`Error saving notes style ${styleNumber}:`, error);
      toast.error(`Failed to save Meeting Notes Style ${styleNumber}`);
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

  // Advanced Word export with full formatting (like MeetingNotesWordExport.tsx)
  const generateAdvancedWordDocument = async (content: string, title: string) => {
    try {
      console.log('🔍 Generating full-featured Word document with formatting!');
      toast.info('Generating Word document...');
      
      // Clean and format content for professional Word document
      const stripHtmlAndFormat = (htmlContent: string) => {
        if (!htmlContent) return [];
        
        // Clean HTML but preserve basic structure
        let cleanText = htmlContent
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

        const paragraphs = [];
        const lines = cleanText.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // Skip empty lines but add spacing
          if (!line) {
            paragraphs.push(new Paragraph({
              children: [new TextRun({ text: "", size: 12 })],
              spacing: { after: 120 }
            }));
            continue;
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
            paragraphs.push(new Paragraph({
              children: [
                new TextRun({ text: "• ", size: 22 }),
                new TextRun({ text: bulletText, size: 22 })
              ],
              spacing: { after: 100 },
              indent: { left: 360 }
            }));
          } else if (isHeader) {
            // Format headers
            paragraphs.push(new Paragraph({
              children: [new TextRun({
                text: displayText,
                bold: true,
                size: isMainHeader ? 24 : 22,
                color: "1f2937"
              })],
              spacing: { 
                before: 200,
                after: 120
              }
            }));
          } else {
            // Regular paragraph
            paragraphs.push(new Paragraph({
              children: [new TextRun({
                text: displayText,
                size: 22
              })],
              spacing: { after: 120 }
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
      toast.success('Word document downloaded successfully!');
      
    } catch (error) {
      console.error('Word generation error:', error);
      toast.error('Failed to generate Word document');
    }
  };

  const generatePDF = (content: string, title: string) => {
    try {
      console.log('🔍 Generating clean PDF document...');
      toast.info('Generating PDF document...');
      
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
      toast.success('Clean PDF generated successfully!');
      console.log('🔍 Clean PDF generation completed!');
      
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
    }
  };

  // Fetch transcript when modal opens - SECURE VERSION using RPC
  const fetchTranscript = async () => {
    if (!meeting?.id) return; // Only skip if no meeting ID
    
    setIsLoadingTranscript(true);
    try {
      console.log('🔍 Fetching transcript for meeting:', meeting.id);
      
      // Use secure RPC function that validates user access
      const { data: rpcRows, error: rpcError } = await supabase.rpc('get_meeting_full_transcript', { 
        p_meeting_id: meeting.id 
      });
      
      if (rpcError) {
        console.error('RPC error:', rpcError);
        throw rpcError;
      }
      
      if (Array.isArray(rpcRows) && rpcRows.length > 0) {
        const row = rpcRows[0] as { source: string; transcript: string; item_count: number };
        if (row?.transcript && row.transcript.trim().length > 0) {
          console.log('🔍 Transcript loaded from source:', row.source, 'Items:', row.item_count);
          setTranscript(row.transcript);
        } else {
          console.log('🔍 No transcript content found');
          setTranscript('');
        }
      } else {
        console.log('🔍 No transcript data returned');
        setTranscript('');
      }

      // Also fetch raw chunks from meeting_transcription_chunks
      const { data: chunksData, error: chunksError } = await supabase
        .from('meeting_transcription_chunks')
        .select('chunk_number, transcription_text, created_at')
        .eq('meeting_id', meeting.id)
        .order('chunk_number', { ascending: true });

      if (chunksError) {
        console.error('Error fetching raw chunks:', chunksError);
      } else if (chunksData && chunksData.length > 0) {
        console.log('🔍 Raw chunks found but not using them');
      } else {
        console.log('🔍 No raw chunks found');
      }

    } catch (error) {
      console.error('🚨 CRITICAL: Error fetching transcript:', error);
      toast.error('Failed to load transcript');
      setTranscript('');
    } finally {
      setIsLoadingTranscript(false);
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

  // Fetch transcript when modal opens
  React.useEffect(() => {
    if (isOpen && meeting) {
      fetchTranscript();
    }
  }, [isOpen, meeting?.id]);

  // Get current content based on active tab
  const getCurrentContent = () => {
    return activeTab === "notes" ? notes : transcript;
  };

  // Get current content setter based on active tab  
  const setCurrentContent = (content: string) => {
    if (activeTab === "notes") {
      onNotesChange(content);
    } else {
      setTranscript(content);
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
      toast.error('No previous versions available');
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
    
    toast.success(`Restored previous ${activeTab === 'notes' ? 'notes' : 'transcript'} version`);
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
    if (!htmlContent) return '';
    
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
    
    return cleanText;
  };

  // Handle edit mode toggle
  const handleEditToggle = () => {
    if (!isEditing) {
      // Save current version before editing
      saveCurrentVersion('manual-edit', activeTab as 'notes' | 'transcript');
      
      // Entering edit mode - clean the content for the current tab
      const currentContent = activeTab === "notes" ? notes : transcript;
      const cleanContent = cleanHtmlForEditing(currentContent);
      setEditingContent(cleanContent);
      setEditingTab(activeTab); // Track which tab we're editing
    } else {
      // Exiting edit mode - save the content to the correct tab
      if (editingTab === "notes") {
        onNotesChange(editingContent);
        saveSummaryToDatabase(editingContent);
      } else if (editingTab === "transcript") {
        setTranscript(editingContent);
        saveTranscriptToDatabase(editingContent);
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
      toast.error('No meeting selected');
      return;
    }

    // Save current version before reprocessing
    saveCurrentVersion('whisper-reprocess', 'transcript');
    setIsLoadingTranscript(true);
    
    try {
      toast.info('🎙️ Getting audio data from meeting...');
      
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX
      
      toast.info('🔄 Processing audio with Whisper AI...');

      const { data, error } = await supabase.functions.invoke('reprocess-meeting-audio', {
        body: { meetingId: meeting.id },
      });

      if (error) {
        console.error('Audio reprocessing error:', error);
        toast.error('Failed to reprocess audio: ' + error.message);
        return;
      }

      toast.info('📝 Storing new transcript...');
      
      setTranscript(data.transcript);
      toast.success(`✅ Audio reprocessed successfully! Generated ${data.length} characters of transcript.`);
      
    } catch (error) {
      console.error('Error reprocessing audio:', error);
      toast.error('Failed to reprocess audio');
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  // Handle GPT-based transcript cleaning
  const handleGPTCleanTranscript = async () => {
    if (!transcript || transcript.trim().length === 0) {
      toast.error('No transcript content to clean');
      return;
    }

    // Save current version before cleaning
    saveCurrentVersion('gpt-clean-transcript', 'transcript');
    setIsLoadingTranscript(true);
    
    try {
      toast.info('🤖 Analyzing transcript with AI...');
      
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
        toast.error('Failed to clean transcript with GPT: ' + error.message);
        return;
      }

      if (!data?.cleanedTranscript) {
        toast.error('Cleaner returned empty response - please check configuration');
        return;
      }

      setTranscript(data.cleanedTranscript);
      
      // Enhanced success message with custom corrections info
      const customCorrectionsText = data.appliedCustomCorrections > 0 
        ? ` Applied ${data.appliedCustomCorrections} custom corrections.` 
        : '';
      
      toast.success(`✅ Transcript cleaned! Reduced from ${data.originalLength} to ${data.cleanedLength} characters.${customCorrectionsText}`);
      
    } catch (error) {
      console.error('Error cleaning transcript:', error);
      toast.error('Failed to clean transcript');
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  // Handle transcript cleaning to remove duplicates
  const handleCleanTranscript = () => {
    if (!transcript || transcript.trim().length === 0) {
      toast.error('No transcript content to clean');
      return;
    }

    // Save current version before cleaning
    saveCurrentVersion('clean-transcript', 'transcript');
    
    try {
      const cleanedTranscript = cleanTranscript(transcript);
      setTranscript(cleanedTranscript);
      toast.success('Transcript cleaned successfully!');
      
    } catch (error) {
      console.error('Error cleaning transcript:', error);
      toast.error('Failed to clean transcript');
    }
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      toast.success('Content copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
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
    toast.success("Clean plain text downloaded successfully!");
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
      toast.success("Notes saved successfully!");
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
          toast.success("Notes updated successfully!");
        } catch (updateError) {
          console.error('Error updating summary:', updateError);
          toast.error("Failed to save notes");
        }
      } else {
        toast.error("Failed to save notes");
      }
    }
  };

  const saveTranscriptToDatabase = async (content: string) => {
    if (!meeting?.id) return;
    
    try {
      // Delete existing transcript entries for this meeting
      const { error: deleteError } = await supabase
        .from('meeting_transcripts')
        .delete()
        .eq('meeting_id', meeting.id);

      if (deleteError) {
        console.error('Error deleting old transcript:', deleteError);
      }

      // Insert the updated transcript
      const { error: insertError } = await supabase
        .from('meeting_transcripts')
        .insert({
          meeting_id: meeting.id,
          content: content,
          speaker_name: 'Updated Transcript',
          confidence_score: 1.0
        });
        
      if (insertError) {
        console.error('Error saving transcript:', insertError);
        toast.error('Failed to save transcript to database');
      } else {
        toast.success('Transcript saved successfully!');
      }
    } catch (error) {
      console.error('Error saving transcript:', error);
      toast.error('Failed to save transcript changes');
    }
  };

  const handleRegenerateNotes = async () => {
    if (!meeting?.id || !transcript) {
      toast.error("No transcript available to generate notes from");
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

      const { data, error } = await supabase.functions.invoke('generate-meeting-notes-claude', {
        body: {
          transcript: transcript,
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
        
        toast.success("Meeting notes and overview regenerated successfully!");
      }
    } catch (error) {
      console.error('Error regenerating meeting notes:', error);
      toast.error("Failed to regenerate meeting notes");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateNotesStyle2 = async () => {
    if (!meeting?.id || !transcript) {
      toast.error("No transcript available to generate notes");
      return;
    }

    setIsGeneratingStyle2(true);
    try {
      const style2Prompt = `You are creating professional meeting minutes from a transcript.

Format the output as follows:

- Present a clear **itemised summary** of each point discussed.  
- Under each item, capture **any decision made** (e.g., "Decision: Agreed to give staff a pay rise").  
- Do not label items as "actions" unless explicitly discussed; just record the decision clearly.  
- Avoid repetition – if a topic is repeated, summarise it once in the most concise way.  
- Highlight **important information shared** during the meeting, even if no decision was made.  
- Do not force a fixed agenda structure – adapt to the flow of the conversation, as all meetings are different.  
- An overview at the start is optional: include only if the transcript naturally lends itself to a short one-paragraph context.  
- Do not add a second action table or appendix unless explicitly requested.  

The final output should look like professional minutes:  
1. Itemised points (one per discussion topic).  
2. Clearly marked **Decisions** when they occurred.  
3. Concise, factual, non-repetitive writing.

Here is the transcript to process:

${transcript}`;

      const { data, error } = await supabase.functions.invoke('generate-meeting-notes-claude', {
        body: {
          transcript: transcript,
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

      if (error) throw error;

      if (data?.meetingMinutes || data?.generatedNotes) {
        const generatedContent = data.meetingMinutes || data.generatedNotes;
        setNotesStyle2(generatedContent);
        
        // Save to database
        await saveNoteStyleToDatabase(2, generatedContent);
        
        toast.success("Meeting Notes Style 2 generated and saved successfully!");
      } else {
        console.error('No content in response:', data);
        toast.error("No content generated - please try again");
      }
    } catch (error) {
      console.error('Error generating notes style 2:', error);
      toast.error("Failed to generate Meeting Notes Style 2");
    } finally {
      setIsGeneratingStyle2(false);
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
      toast.error("Please enter custom instructions");
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
        toast.success("Meeting notes enhanced with custom instructions!");
      }
    } catch (error) {
      console.error('Error applying custom instructions:', error);
      toast.error("Failed to apply custom instructions");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!meeting) return null;

  return (
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
        } flex flex-col overflow-hidden z-[100]`}
        style={{ zIndex: 100 }}
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
                         toast.success("Clean plain text downloaded successfully!");
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
                  
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      <Sparkles className="h-4 w-4 mr-2" />
                      AI Enhance
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <ClaudeEnhancementModal
                        originalContent={getCurrentContent()}
                        onEnhancedContent={(enhancedContent) => {
                          setCurrentContent(enhancedContent);
                          if (activeTab === "notes") {
                            saveSummaryToDatabase(enhancedContent);
                          }
                        }}
                      >
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                          <FileText className="h-4 w-4 mr-2" />
                          Make More Detailed
                        </DropdownMenuItem>
                      </ClaudeEnhancementModal>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
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
                  toast.success("Text replaced successfully!");
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
                      toast.error("Please enter custom instructions");
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
                        toast.success(`${activeTab === "notes" ? "Meeting notes" : "Transcript"} enhanced with custom instructions!`);
                      }
                    } catch (error) {
                      console.error('Error applying custom instructions:', error);
                      toast.error("Failed to apply custom instructions");
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
              if (isEditing && editingTab !== value) {
                // Save current version before switching tabs
                saveCurrentVersion('tab-switch', editingTab as 'notes' | 'transcript');
                
                if (editingTab === "notes") {
                  onNotesChange(editingContent);
                  saveSummaryToDatabase(editingContent);
                } else if (editingTab === "transcript") {
                  setTranscript(editingContent);
                }
                setIsEditing(false);
                setEditingContent("");
                setEditingTab("");
              }
              setActiveTab(value);
            }} className="h-full flex flex-col">
              <div className="px-6 pt-4 flex-shrink-0">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="notes">Meeting Notes</TabsTrigger>
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                  <TabsTrigger value="templates" className="gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Templates & Instructions
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="notes" className="flex-1 overflow-hidden mt-0 bg-white">
                <div className="h-full flex flex-col">
                  {/* Sub-tabs for different meeting notes styles - positioned directly under main tab header */}
                  <div className="flex-1 overflow-hidden px-6 pt-4">
                    <Tabs value={activeNotesStyleTab} onValueChange={setActiveNotesStyleTab} className="h-full flex flex-col">
                      <TabsList className="grid w-full grid-cols-4 mb-4">
                        <TabsTrigger value="style1" className="text-xs sm:text-sm">
                          Meeting Notes Style 1
                        </TabsTrigger>
                        <TabsTrigger value="style2" className="text-xs sm:text-sm">
                          Meeting Notes Style 2
                        </TabsTrigger>
                        <TabsTrigger value="style3" className="text-xs sm:text-sm">
                          Meeting Notes Style 3
                        </TabsTrigger>
                        <TabsTrigger value="style4" className="text-xs sm:text-sm">
                          Meeting Notes Style 4
                        </TabsTrigger>
                      </TabsList>

                      {/* Meeting Notes header and controls moved below sub-tabs */}
                      <div className="flex items-center justify-between pb-4 flex-shrink-0">
                        <h3 className="text-lg font-semibold">Meeting Notes</h3>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={handleUndo}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={notesVersions.length === 0}
                            title={`Undo (${notesVersions.length} versions available)`}
                          >
                            <Undo2 className="h-4 w-4" />
                            Undo
                          </Button>
                          <Button
                            onClick={handleEditToggle}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                          >
                            <Edit3 className="h-4 w-4" />
                            {isEditing ? 'Save' : 'Edit'}
                          </Button>
                        </div>
                      </div>
                      
                      <TabsContent value="style1" className="flex-1 overflow-auto pb-6">
                        {isEditing ? (
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
                      
                      <TabsContent value="style2" className="flex-1 overflow-auto pb-6">
                        <div className="space-y-4">
                          {!notesStyle2 ? (
                            <div className="flex flex-col items-center justify-center h-32 space-y-4">
                              <p className="text-muted-foreground text-center">
                                Generate professional meeting minutes with itemized summary and clear decisions
                              </p>
                              <Button
                                onClick={generateNotesStyle2}
                                disabled={isGeneratingStyle2 || !transcript}
                                className="gap-2"
                              >
                                {isGeneratingStyle2 ? (
                                  <>
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                    Generating Style 2...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="h-4 w-4" />
                                    Generate Meeting Notes Style 2
                                  </>
                                )}
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">Professional meeting minutes format</p>
                                <Button
                                  onClick={generateNotesStyle2}
                                  variant="outline"
                                  size="sm"
                                  disabled={isGeneratingStyle2}
                                  className="gap-2"
                                >
                                  {isGeneratingStyle2 ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4" />
                                  )}
                                  Regenerate
                                </Button>
                              </div>
                              <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground">
                                <div 
                                  dangerouslySetInnerHTML={{ 
                                    __html: renderNHSMarkdown(notesStyle2, { enableNHSStyling: true })
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="style3" className="flex-1 overflow-auto pb-6">
                        <div className="flex items-center justify-center h-32">
                          <p className="text-muted-foreground text-center">
                            Meeting Notes Style 3 will be available soon
                          </p>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="style4" className="flex-1 overflow-auto pb-6">
                        <div className="flex items-center justify-center h-32">
                          <p className="text-muted-foreground text-center">
                            Meeting Notes Style 4 will be available soon
                          </p>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              </TabsContent>
               
               <TabsContent value="transcript" className="flex-1 overflow-hidden mt-0 bg-white">
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
                    <div className="flex items-center gap-4">
                      <h3 className="text-lg font-semibold">Meeting Transcript</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleGPTCleanTranscript}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={!transcript || transcript.trim().length === 0 || isLoadingTranscript}
                        title="Deep clean transcript using GPT to remove duplicates and improve formatting"
                      >
                        <Bot className={`h-4 w-4 ${isLoadingTranscript ? 'animate-pulse' : ''}`} />
                        {isLoadingTranscript ? 'AI Processing...' : 'Deep Clean'}
                      </Button>
                      <Button
                        onClick={handleUndo}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={transcriptVersions.length === 0}
                        title={`Undo (${transcriptVersions.length} versions available)`}
                      >
                        <Undo2 className="h-4 w-4" />
                        Undo
                      </Button>
                      <Button
                        onClick={handleEditToggle}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Edit3 className="h-4 w-4" />
                        {isEditing ? 'Save' : 'Edit'}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-6 pt-0">
                    {isLoadingTranscript ? (
                      <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <span className="ml-2">Loading transcript...</span>
                      </div>
                    ) : isEditing ? (
                      <Textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="h-full w-full font-mono text-sm resize-none"
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
                  </div>
                </TabsContent>
                
                <TabsContent value="templates" className="flex-1 overflow-hidden mt-0 bg-white">
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <FolderOpen className="h-5 w-5" />
                        Templates & Instructions
                      </h3>
                    </div>
                    <div className="flex-1 overflow-auto px-6 pb-6">
                      <MeetingTemplatesTab />
                    </div>
                  </div>
                </TabsContent>
             </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};