import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  Wand2
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
        
        // Comprehensive HTML cleanup - remove ALL HTML tags and styling
        let cleanText = htmlContent
          // Remove HTML tags completely
          .replace(/<[^>]*>/g, '')
          // Decode HTML entities
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&apos;/g, "'")
          // Remove markdown-style formatting that shouldn't be in Word
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1')
          // Clean up excessive whitespace
          .replace(/\s+/g, ' ')
          .replace(/^\s+|\s+$/g, '')
          // Convert common patterns to proper spacing
          .replace(/\n\s*\n\s*\n+/g, '\n\n')
          .trim();

        const paragraphs = [];
        const lines = cleanText.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // Skip completely empty lines
          if (!line) {
            // Add spacing between sections
            paragraphs.push(new Paragraph({
              children: [new TextRun({ text: " ", size: 12 })],
              spacing: { after: 120 }
            }));
            continue;
          }
          
          // Detect section headers (numbers with periods, emoji headers, or all caps)
          const isNumberedSection = /^#?\s*\d+\.?\s/.test(line) || /^##?\s*\d+/.test(line);
          const isEmojiSection = /^[1-5]️⃣/.test(line);
          const isAllCapsHeader = /^[A-Z\s]{6,}$/.test(line) && line.length < 50;
          const isMainHeader = line.includes('MEETING') || line.includes('OVERVIEW') || line.includes('CONTENT');
          
          const isHeader = isNumberedSection || isEmojiSection || isAllCapsHeader || isMainHeader;
          
          // Clean section headers
          let displayText = line;
          if (isNumberedSection) {
            displayText = line.replace(/^#*\s*(\d+\.?\s*)/, '$1');
          }
          if (isEmojiSection) {
            displayText = line.replace(/^([1-5]️⃣)\s*/, '$1 ');
          }
          
          // Detect bullet points
          const isBulletPoint = /^[-•*]\s/.test(line);
          
          if (isBulletPoint) {
            // Format as bullet point
            const bulletText = line.replace(/^[-•*]\s*/, '');
            paragraphs.push(new Paragraph({
              children: [
                new TextRun({ text: "• ", size: 22, bold: true }),
                new TextRun({ text: bulletText, size: 22 })
              ],
              spacing: { after: 80 },
              indent: { left: 360 }
            }));
          } else if (isHeader) {
            // Format as header
            paragraphs.push(new Paragraph({
              children: [new TextRun({
                text: displayText,
                bold: true,
                size: isMainHeader ? 28 : (isEmojiSection ? 26 : 24),
                color: "1f2937"
              })],
              spacing: { 
                before: isMainHeader ? 400 : 240,
                after: 160
              }
            }));
          } else {
            // Regular paragraph text
            paragraphs.push(new Paragraph({
              children: [new TextRun({
                text: displayText,
                size: 22,
                color: "374151"
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
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - (2 * margin);
      
      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(title, pageWidth / 2, 30, { align: 'center' });
      
      // Date
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth / 2, 45, { align: 'center' });
      
      // Content
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(content, maxWidth);
      doc.text(lines, margin, 60);
      
      doc.save(`${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toLocaleDateString()}.pdf`);
      toast.success('PDF generated successfully!');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
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
    
    const element = document.createElement("a");
    const file = new Blob([notes], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `meeting-notes-${meeting.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Plain text downloaded successfully!");
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
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              {meeting.title} - Meeting Notes
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Quick Pick
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => copyToClipboard(notes)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy to Clipboard
                  </DropdownMenuItem>
                  
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => generateAdvancedWordDocument(notes, `${meeting.title} - Meeting Notes`)}>
                        <FileText className="h-4 w-4 mr-2" />
                        Download as Word
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => generatePDF(notes, `${meeting.title} - Meeting Notes`)}>
                        <FileType className="h-4 w-4 mr-2" />
                        Download as PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDownloadText}>
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
                        originalContent={notes}
                        onEnhancedContent={(enhancedContent) => {
                          onNotesChange(enhancedContent);
                          saveSummaryToDatabase(enhancedContent);
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
                getCurrentText={() => notes}
                onApply={(updatedText) => {
                  onNotesChange(updatedText);
                  saveSummaryToDatabase(updatedText);
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
                    placeholder="Enter your custom instructions for enhancing the meeting notes..."
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
                  onClick={handleCustomInstructionSubmit}
                  disabled={!customInstruction.trim() || isGenerating}
                  className="w-full"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isGenerating ? 'Applying...' : 'Apply Custom Instructions'}
                </Button>
              </div>
            </div>
          )}
          
          {/* Notes Content */}
          <div className="flex-1 p-6 bg-white overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Meeting Notes</h3>
              <Button
                onClick={() => setIsEditing(!isEditing)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Edit3 className="h-4 w-4" />
                {isEditing ? 'Preview' : 'Edit'}
              </Button>
            </div>

            {isEditing ? (
              <Textarea
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                onBlur={() => saveSummaryToDatabase(notes)}
                className="min-h-[400px] font-mono text-sm"
                placeholder="Meeting notes will appear here..."
              />
            ) : (
              <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground">
                <SafeMessageRenderer content={notes} />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};