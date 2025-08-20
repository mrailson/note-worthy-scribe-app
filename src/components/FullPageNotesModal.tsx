import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SafeMessageRenderer } from "@/components/SafeMessageRenderer";
import { ClaudeEnhancementModal } from "@/components/ClaudeEnhancementModal";
import FindReplacePanel from "@/components/FindReplacePanel";
import { SpeechToText } from "@/components/SpeechToText";
import { useMeetingExport } from "@/hooks/useMeetingExport";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

  const { generateWordDocument, generatePDF, copyToClipboard } = useMeetingExport(mockMeetingData, mockMeetingSettings);

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
        });

      if (error) throw error;
      toast.success("Notes saved successfully!");
    } catch (error) {
      console.error('Error saving summary:', error);
      toast.error("Failed to save notes");
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
                      <DropdownMenuItem onClick={() => generateWordDocument(notes, `${meeting.title} - Meeting Notes`)}>
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