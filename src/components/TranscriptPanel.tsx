import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MeetingData } from "@/types/meetingTypes";
import { CustomAIPromptModal } from "@/components/CustomAIPromptModal";
import { CustomFindReplaceModal } from "@/components/CustomFindReplaceModal";
import { TranscriptContextDialog } from "@/components/meeting/TranscriptContextDialog";
import { formatTranscriptContext, extractCleanContent } from "@/utils/meeting/formatTranscriptContext";
import { UploadedFile } from "@/types/ai4gp";
import { 
  FileText, 
  ChevronDown, 
  Download, 
  Copy, 
  Edit3, 
  Search, 
  Mic, 
  Sparkles,
  Type,
  FileType,
  Wand2,
  ArrowUpDown,
  List,
  Hash,
  Indent,
  AlignLeft,
  Languages,
  Palette,
  Zap,
  FilePlus2
} from "lucide-react";

interface TranscriptPanelProps {
  meetingData: MeetingData | null;
  isTranscriptOpen: boolean;
  setIsTranscriptOpen: (open: boolean) => void;
  onCopy: (content: string) => void;
  onDownloadTranscript: () => void;
  onDownloadWord: (content: string) => void;
  onDownloadPDF: (content: string) => void;
  onDownloadText: (content: string) => void;
  onUpdateTranscript?: (updatedContent: string) => void;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  meetingData,
  isTranscriptOpen,
  setIsTranscriptOpen,
  onCopy,
  onDownloadTranscript,
  onDownloadWord,
  onDownloadPDF,
  onDownloadText,
  onUpdateTranscript
}) => {
  const [showCustomAIModal, setShowCustomAIModal] = useState(false);
  const [showFindReplaceModal, setShowFindReplaceModal] = useState(false);
  const [showContextDialog, setShowContextDialog] = useState(false);

  if (!meetingData?.transcript) return null;

  const handleQuickPickAction = (action: string, payload?: any) => {
    let updatedContent = meetingData.transcript;

    switch (action) {
      case 'bullet-to-dash':
        updatedContent = updatedContent.replace(/^\s*•\s*/gm, '- ');
        break;
      case 'dash-to-bullet':
        updatedContent = updatedContent.replace(/^\s*-\s*/gm, '• ');
        break;
      case 'uppercase':
        updatedContent = updatedContent.toUpperCase();
        break;
      case 'lowercase':
        updatedContent = updatedContent.toLowerCase();
        break;
      case 'title-case':
        updatedContent = updatedContent.replace(/\w\S*/g, (txt) => 
          txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
        break;
    }

    if (onUpdateTranscript && updatedContent !== meetingData.transcript) {
      onUpdateTranscript(updatedContent);
    }
  };

  const handleAddContext = (
    contextType: 'agenda' | 'attendees' | 'presentation' | 'other',
    files: UploadedFile[],
    customLabel?: string
  ) => {
    // Clean the content from file processors
    const cleanedFiles = files.map(file => ({
      ...file,
      content: extractCleanContent(file.content || '')
    }));

    const formattedContext = formatTranscriptContext(contextType, cleanedFiles, customLabel);
    const updatedTranscript = meetingData.transcript + formattedContext;
    
    if (onUpdateTranscript) {
      onUpdateTranscript(updatedTranscript);
    }
  };

  return (
    <Card className="mb-6">
      <Collapsible open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Meeting Transcript
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="h-4 w-4" />
                      Quick Pick
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={() => onCopy(meetingData.transcript)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy to Clipboard
                      </DropdownMenuItem>
                      
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="cursor-pointer">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={onDownloadTranscript}>
                            <FileText className="h-4 w-4 mr-2" />
                            Download as Transcript
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDownloadWord(meetingData.transcript)}>
                            <FileText className="h-4 w-4 mr-2" />
                            Download as Word
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDownloadPDF(meetingData.transcript)}>
                            <FileType className="h-4 w-4 mr-2" />
                            Download as PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDownloadText(meetingData.transcript)}>
                            <Type className="h-4 w-4 mr-2" />
                            Download as Plain Text
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      
                      <DropdownMenuSeparator />
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuItem onClick={() => setShowContextDialog(true)}>
                              <FilePlus2 className="h-4 w-4 mr-2" />
                              Add Context
                            </DropdownMenuItem>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p>Add meeting agendas, attendee lists, or presentations</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <DropdownMenuSeparator />
                      
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="cursor-pointer">
                          <Edit3 className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => setShowFindReplaceModal(true)}>
                            <Search className="h-4 w-4 mr-2" />
                            Find and Replace
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="cursor-pointer">
                          <Palette className="h-4 w-4 mr-2" />
                          Format & Style
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => handleQuickPickAction('bullet-to-dash')}>
                            <List className="h-4 w-4 mr-2" />
                            Bullet to Dash
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickPickAction('dash-to-bullet')}>
                            <List className="h-4 w-4 mr-2" />
                            Dash to Bullet
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickPickAction('uppercase')}>
                            <ArrowUpDown className="h-4 w-4 mr-2" />
                            UPPERCASE
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickPickAction('lowercase')}>
                            <ArrowUpDown className="h-4 w-4 mr-2" />
                            lowercase
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickPickAction('title-case')}>
                            <ArrowUpDown className="h-4 w-4 mr-2" />
                            Title Case
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="cursor-pointer">
                          <Sparkles className="h-4 w-4 mr-2" />
                          AI Enhance
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => setShowCustomAIModal(true)}>
                            <Wand2 className="h-4 w-4 mr-2" />
                            Custom AI Enhancement
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleQuickPickAction('make-longer')}>
                            <Zap className="h-4 w-4 mr-2" />
                            Make Longer
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickPickAction('make-shorter')}>
                            <Zap className="h-4 w-4 mr-2" />
                            Make Shorter
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickPickAction('simplify')}>
                            <Zap className="h-4 w-4 mr-2" />
                            Simplify Language
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickPickAction('professional')}>
                            <Zap className="h-4 w-4 mr-2" />
                            Make Professional
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ChevronDown className={`h-4 w-4 transition-transform ${isTranscriptOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent>
            <div className="p-4 border rounded-lg bg-muted/20 max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm font-mono text-foreground">
                {meetingData.transcript}
              </pre>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* Custom AI Enhancement Modal */}
      <CustomAIPromptModal
        open={showCustomAIModal}
        onOpenChange={setShowCustomAIModal}
        onSubmit={(prompt) => {
          // Handle custom AI enhancement
          console.log('Custom AI enhancement:', prompt);
          // This would integrate with an AI service to enhance the transcript
        }}
        currentText={meetingData?.transcript || ''}
      />

      {/* Find and Replace Modal */}
      <CustomFindReplaceModal
        open={showFindReplaceModal}
        onOpenChange={setShowFindReplaceModal}
        onSubmit={(findText, replaceText, options) => {
          if (meetingData?.transcript && onUpdateTranscript) {
            let updatedContent = meetingData.transcript;
            const flags = (options.caseSensitive ? '' : 'i') + 'g';
            const regex = options.wholeWords 
              ? new RegExp(`\\b${findText}\\b`, flags)
              : new RegExp(findText, flags);
            updatedContent = updatedContent.replace(regex, replaceText);
            onUpdateTranscript(updatedContent);
          }
        }}
        currentText={meetingData?.transcript || ''}
      />

      {/* Add Context Dialog */}
      <TranscriptContextDialog
        open={showContextDialog}
        onOpenChange={setShowContextDialog}
        onAddContext={handleAddContext}
      />
    </Card>
  );
};