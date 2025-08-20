import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SafeMessageRenderer } from "@/components/SafeMessageRenderer";
import { ClaudeEnhancementModal } from "@/components/ClaudeEnhancementModal";
import FindReplacePanel from "@/components/FindReplacePanel";
import { SpeechToText } from "@/components/SpeechToText";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
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
  ChevronDown as ChevronDownIcon
} from "lucide-react";

interface Meeting {
  id: string;
  title: string;
  start_time: string;
  created_at: string;
}

interface FullPageNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: Meeting | null;
  notes: string;
  onNotesChange: (notes: string) => void;
}

export const FullPageNotesModal: React.FC<FullPageNotesModalProps> = ({
  isOpen,
  onClose,
  meeting,
  notes,
  onNotesChange
}) => {
  console.log('🔍 FullPageNotesModal render - isOpen:', isOpen, 'meeting:', meeting?.title);
  
  const [isEditing, setIsEditing] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showCustomInstruction, setShowCustomInstruction] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("notes");
  const [transcript, setTranscript] = useState("");
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [editingContent, setEditingContent] = useState(""); // Clean content for editing
  
  // Search functionality for transcript
  const [searchTerm, setSearchTerm] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [highlightedTranscript, setHighlightedTranscript] = useState("");

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
      // Clear search state
      setSearchTerm('');
      setCurrentMatchIndex(0);
      setTotalMatches(0);
      setHighlightedTranscript('');
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
      // Entering edit mode - clean the content
      const currentContent = activeTab === "notes" ? notes : transcript;
      const cleanContent = cleanHtmlForEditing(currentContent);
      setEditingContent(cleanContent);
    } else {
      // Exiting edit mode - save the content
      if (activeTab === "notes") {
        onNotesChange(editingContent);
        saveSummaryToDatabase(editingContent);
      } else {
        setTranscript(editingContent);
      }
    }
    setIsEditing(!isEditing);
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

  const handleRegenerateNotes = async () => {
    if (!meeting?.id || !transcript) {
      toast.error("No transcript available to generate notes from");
      return;
    }

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
        toast.success("Meeting notes regenerated successfully!");
      }
    } catch (error) {
      console.error('Error regenerating meeting notes:', error);
      toast.error("Failed to regenerate meeting notes");
    } finally {
      setIsGenerating(false);
    }
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              {meeting.title} - Meeting Notes
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 mr-2">
                  <Download className="h-4 w-4" />
                  Quick Pick
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
                        const element = document.createElement("a");
                        const file = new Blob([getCurrentContent()], { type: 'text/plain' });
                        element.href = URL.createObjectURL(file);
                        element.download = `${meeting.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${activeTab}.txt`;
                        document.body.appendChild(element);
                        element.click();
                        document.body.removeChild(element);
                        toast.success("Plain text downloaded successfully!");
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
                      <DropdownMenuItem onClick={() => setIsEditing(!isEditing)}>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit Meeting Notes
                      </DropdownMenuItem>
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
              <FindReplacePanel
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
            <Tabs defaultValue="notes" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="px-6 pt-4 flex-shrink-0">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="notes">Meeting Notes</TabsTrigger>
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="notes" className="flex-1 overflow-hidden mt-0 bg-white">
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
                    <h3 className="text-lg font-semibold">Meeting Notes</h3>
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

                  <div className="flex-1 overflow-auto px-6 pb-6">
                    {isEditing ? (
                      <Textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="min-h-[400px] font-mono text-sm resize-none"
                        placeholder="Meeting notes will appear here..."
                      />
                    ) : (
                      <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground">
                        <SafeMessageRenderer content={notes} />
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="transcript" className="flex-1 overflow-hidden mt-0 bg-white">
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
                    <h3 className="text-lg font-semibold">Meeting Transcript</h3>
                    <div className="flex items-center gap-2">
                      {!isEditing && transcript && (
                        <div className="flex items-center gap-2 mr-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search transcript..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-10 pr-4 h-8 w-48"
                            />
                          </div>
                          {totalMatches > 0 && (
                            <>
                              <span className="text-sm text-muted-foreground">
                                {currentMatchIndex + 1} of {totalMatches}
                              </span>
                              <div className="flex items-center">
                                <Button
                                  onClick={goToPreviousMatch}
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  disabled={totalMatches === 0}
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  onClick={goToNextMatch}
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 ml-1"
                                  disabled={totalMatches === 0}
                                >
                                  <ChevronDownIcon className="h-4 w-4" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
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

                  <div className="flex-1 overflow-auto px-6 pb-6">
                    {isLoadingTranscript ? (
                      <div className="flex items-center justify-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <span className="ml-2">Loading transcript...</span>
                      </div>
                    ) : isEditing ? (
                      <Textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="min-h-[400px] font-mono text-sm resize-none"
                        placeholder="Meeting transcript will appear here..."
                      />
                    ) : (
                      <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground">
                        {transcript ? (
                          <pre 
                            className="whitespace-pre-wrap font-sans"
                            dangerouslySetInnerHTML={{ 
                              __html: searchTerm ? highlightedTranscript : transcript 
                            }}
                          />
                        ) : (
                          <p className="text-muted-foreground">No transcript available for this meeting.</p>
                        )}
                      </div>
                    )}
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