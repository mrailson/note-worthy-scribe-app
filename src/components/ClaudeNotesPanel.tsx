import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';
import { ClaudeEnhancementModal } from "@/components/ClaudeEnhancementModal";
import EnhancedFindReplacePanel from "@/components/EnhancedFindReplacePanel";
import { syncTranscriptCorrections } from "@/utils/transcriptCorrectionSync";
import { SpeechToText } from "@/components/SpeechToText";
import { CustomAIPromptModal } from "@/components/CustomAIPromptModal";
import { CustomFindReplaceModal } from "@/components/CustomFindReplaceModal";
import { MeetingData } from "@/types/meetingTypes";
import { stripMarkdown, copyPlainTextToClipboard } from '@/utils/stripMarkdown';
import { 
  Bot, 
  ChevronDown, 
  Sparkles, 
  Edit3, 
  Copy, 
  FileText, 
  Download,
  Maximize2,
  Search,
  Type,
  FileType,
  Mic,
  X,
  Wand2,
  ArrowUpDown,
  List,
  Hash,
  Palette,
  Zap,
  Languages,
  AlignLeft
} from "lucide-react";

interface ClaudeNotesPanelProps {
  meetingData: MeetingData | null;
  claudeDetailLevel: string;
  setClaudeDetailLevel: (level: string) => void;
  claudeNotes: string;
  setClaudeNotes: (notes: string) => void;
  isClaudeEditing: boolean;
  setIsClaudeEditing: (editing: boolean) => void;
  isClaudeGenerating: boolean;
  isClaudeMinutesOpen: boolean;
  setIsClaudeMinutesOpen: (open: boolean) => void;
  isClaudeFullScreen: boolean;
  setIsClaudeFullScreen: (fullScreen: boolean) => void;
  customInstruction: string;
  setCustomInstruction: (instruction: string) => void;
  showCustomInstruction: boolean;
  setShowCustomInstruction: (show: boolean) => void;
  showFindReplace: boolean;
  setShowFindReplace: (show: boolean) => void;
  generateClaudeMeetingNotes: (forceRegenerate?: boolean) => void;
  saveSummaryToDatabase: (content: string) => void;
  handleCustomInstructionSubmit: () => void;
  onCopy: (content: string) => void;
  onDownloadWord: (content: string) => void;
  onDownloadPDF: (content: string) => void;
  onDownloadText: (content: string) => void;
}

export const ClaudeNotesPanel: React.FC<ClaudeNotesPanelProps> = ({
  meetingData,
  claudeDetailLevel,
  setClaudeDetailLevel,
  claudeNotes,
  setClaudeNotes,
  isClaudeEditing,
  setIsClaudeEditing,
  isClaudeGenerating,
  isClaudeMinutesOpen,
  setIsClaudeMinutesOpen,
  isClaudeFullScreen,
  setIsClaudeFullScreen,
  customInstruction,
  setCustomInstruction,
  showCustomInstruction,
  setShowCustomInstruction,
  showFindReplace,
  setShowFindReplace,
  generateClaudeMeetingNotes,
  saveSummaryToDatabase,
  handleCustomInstructionSubmit,
  onCopy,
  onDownloadWord,
  onDownloadPDF,
  onDownloadText
}) => {
  const [showCustomAIModal, setShowCustomAIModal] = useState(false);
  const [showFindReplaceModal, setShowFindReplaceModal] = useState(false);

  const handleQuickPickAction = (action: string, payload?: any) => {
    let updatedContent = claudeNotes;

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
      case 'add-numbers':
        const lines = updatedContent.split('\n');
        updatedContent = lines.map((line, index) => 
          line.trim() ? `${index + 1}. ${line}` : line
        ).join('\n');
        break;
      case 'remove-numbers':
        updatedContent = updatedContent.replace(/^\s*\d+\.\s*/gm, '');
        break;
    }

    if (updatedContent !== claudeNotes) {
      setClaudeNotes(updatedContent);
      saveSummaryToDatabase(updatedContent);
    }
  };
  return (
    <>
      <Card className="mb-6">
        <Collapsible open={isClaudeMinutesOpen} onOpenChange={setIsClaudeMinutesOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  Claude AI Meeting Notes
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${isClaudeMinutesOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Detail Level:</label>
                  <Select value={claudeDetailLevel} onValueChange={setClaudeDetailLevel}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brief">Brief</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  onClick={() => generateClaudeMeetingNotes(false)}
                  disabled={isClaudeGenerating || !meetingData?.transcript}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  {isClaudeGenerating ? 'Generating...' : 'Generate Notes'}
                </Button>
                
                {claudeNotes && (
                  <Button 
                    onClick={() => generateClaudeMeetingNotes(true)}
                    disabled={isClaudeGenerating}
                    variant="outline"
                    className="gap-2"
                  >
                    <Wand2 className="h-4 w-4" />
                    Regenerate
                  </Button>
                )}
              </div>

              {claudeNotes && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Edit button clicked, current state:', isClaudeEditing);
                          setIsClaudeEditing(!isClaudeEditing);
                        }}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        type="button"
                      >
                        <Edit3 className="h-4 w-4" />
                        {isClaudeEditing ? 'Preview' : 'Edit'}
                      </Button>
                      
                      <Dialog open={isClaudeFullScreen} onOpenChange={setIsClaudeFullScreen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Maximize2 className="h-4 w-4" />
                            Full Screen
                          </Button>
                        </DialogTrigger>
                      </Dialog>
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
                          <DropdownMenuItem onClick={() => onCopy(claudeNotes)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy to Clipboard
                          </DropdownMenuItem>
                          
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="cursor-pointer">
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem onClick={() => onDownloadWord(claudeNotes)}>
                                <FileText className="h-4 w-4 mr-2" />
                                Download as Word
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onDownloadPDF(claudeNotes)}>
                                <FileType className="h-4 w-4 mr-2" />
                                Download as PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onDownloadText(claudeNotes)}>
                                <Type className="h-4 w-4 mr-2" />
                                Download as Plain Text
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="cursor-pointer">
                              <Edit3 className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem onClick={() => setIsClaudeEditing(!isClaudeEditing)}>
                                <Edit3 className="h-4 w-4 mr-2" />
                                Edit Meeting Notes
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setShowFindReplace(!showFindReplace)}>
                                <Search className="h-4 w-4 mr-2" />
                                Find and Replace (Legacy)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setShowFindReplaceModal(true)}>
                                <Search className="h-4 w-4 mr-2" />
                                Find and Replace (Enhanced)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setShowCustomInstruction(!showCustomInstruction)}>
                                <Mic className="h-4 w-4 mr-2" />
                                Update Names and Terms
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
                              <DropdownMenuItem onClick={() => handleQuickPickAction('add-numbers')}>
                                <Hash className="h-4 w-4 mr-2" />
                                Add Numbers
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleQuickPickAction('remove-numbers')}>
                                <Hash className="h-4 w-4 mr-2" />
                                Remove Numbers
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
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
                              <ClaudeEnhancementModal
                                originalContent={claudeNotes}
                                onEnhancedContent={(enhancedContent) => {
                                  setClaudeNotes(enhancedContent);
                                  saveSummaryToDatabase(enhancedContent);
                                }}
                              >
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  Make More Detailed (Legacy)
                                </DropdownMenuItem>
                              </ClaudeEnhancementModal>
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
                              <DropdownMenuItem onClick={() => handleQuickPickAction('clinical-detail')}>
                                <Zap className="h-4 w-4 mr-2" />
                                Add Clinical Detail
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Find & Replace Panel */}
                  {showFindReplace && (
                    <div className="p-4 border rounded-lg bg-muted/50">
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
                        getCurrentText={() => claudeNotes}
                        onApply={(updatedText) => {
                          setClaudeNotes(updatedText);
                          saveSummaryToDatabase(updatedText);
                        }}
                        meetingId={meetingData?.id}
                        onTranscriptSync={async (finds, replaceWith) => {
                          if (meetingData?.id) {
                            await syncTranscriptCorrections(meetingData.id, finds, replaceWith);
                          }
                        }}
                      />
                    </div>
                  )}

                  {/* Custom Instructions Panel */}
                  {showCustomInstruction && (
                    <div className="p-4 border rounded-lg bg-muted/50">
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
                          disabled={!customInstruction.trim()}
                          className="w-full"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Apply Custom Instructions
                        </Button>
                      </div>
                    </div>
                  )}

                  {isClaudeEditing ? (
                    <Textarea
                      value={claudeNotes}
                      onChange={(e) => setClaudeNotes(e.target.value)}
                      onBlur={() => saveSummaryToDatabase(claudeNotes)}
                      className="min-h-[400px] font-mono text-sm"
                      placeholder="AI-generated meeting notes will appear here..."
                    />
                  ) : (
                    <div className="p-4 border rounded-lg bg-muted/20 min-h-[200px]">
                      <div className="prose prose-sm max-w-none">
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: renderNHSMarkdown(claudeNotes, { enableNHSStyling: true })
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Full Screen Modal */}
      <Dialog open={isClaudeFullScreen} onOpenChange={setIsClaudeFullScreen}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Claude AI Meeting Notes - Full Screen
              </div>
              {/* Quick Pick menu would go here if needed */}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 p-6 bg-white overflow-auto">
              <div className="prose prose-sm max-w-none">
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: renderNHSMarkdown(claudeNotes, { enableNHSStyling: true })
                  }}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom AI Enhancement Modal */}
      <CustomAIPromptModal
        open={showCustomAIModal}
        onOpenChange={setShowCustomAIModal}
        onSubmit={(prompt) => {
          // Handle custom AI enhancement for Claude notes
          console.log('Custom AI enhancement for Claude notes:', prompt);
          // This would integrate with an AI service to enhance the notes
        }}
        currentText={claudeNotes}
      />

      {/* Enhanced Find and Replace Modal */}
      <CustomFindReplaceModal
        open={showFindReplaceModal}
        onOpenChange={setShowFindReplaceModal}
        onSubmit={(findText, replaceText, options) => {
          let updatedContent = claudeNotes;
          const flags = (options.caseSensitive ? '' : 'i') + 'g';
          const regex = options.wholeWords 
            ? new RegExp(`\\b${findText}\\b`, flags)
            : new RegExp(findText, flags);
          updatedContent = updatedContent.replace(regex, replaceText);
          setClaudeNotes(updatedContent);
          saveSummaryToDatabase(updatedContent);
        }}
        currentText={claudeNotes}
      />
    </>
  );
};