import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MeetingData } from "@/types/meetingTypes";
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
  FileType
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
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  meetingData,
  isTranscriptOpen,
  setIsTranscriptOpen,
  onCopy,
  onDownloadTranscript,
  onDownloadWord,
  onDownloadPDF,
  onDownloadText
}) => {
  if (!meetingData?.transcript) return null;

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
                      
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="cursor-pointer">
                          <Edit3 className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem disabled>
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit Meeting Notes
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled>
                            <Search className="h-4 w-4 mr-2" />
                            Find and Replace
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled>
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
                          <DropdownMenuItem disabled>
                            <FileText className="h-4 w-4 mr-2" />
                            Make More Detailed
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
    </Card>
  );
};