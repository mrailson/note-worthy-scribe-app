import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Waves, ChevronDown, ChevronRight } from "lucide-react";

interface DeepgramTranscriptCardProps {
  transcript: string;
  wordCount: number;
  isRecording: boolean;
}

export const DeepgramTranscriptCard: React.FC<DeepgramTranscriptCardProps> = ({
  transcript,
  wordCount,
  isRecording
}) => {
  const [isOpen, setIsOpen] = useState(true); // Open by default for testing
  
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Waves className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Deepgram Transcript (Backup)
              </CardTitle>
              <div className="flex items-center gap-2">
                {isRecording && (
                  <Badge variant="outline" className="bg-success/10 text-success animate-pulse">
                    🎙️ Recording
                  </Badge>
                )}
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CollapsibleTrigger>
          
          {/* Statistics - Always visible */}
          <div className="flex gap-2 mt-2">
            <Badge variant="outline" className="bg-primary/10 text-primary text-xs">
              📝 {wordCount} words
            </Badge>
            <Badge variant="outline" className="bg-accent/10 text-accent-foreground text-xs">
              🔄 Live Backup
            </Badge>
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent>
            <ScrollArea className="h-48 sm:h-64">
              {transcript ? (
                <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {transcript}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  {isRecording ? (
                    <>
                      <Waves className="h-12 w-12 mx-auto mb-2 text-primary/50 animate-pulse" />
                      <p>Waiting for Deepgram transcription...</p>
                    </>
                  ) : (
                    <p>No Deepgram transcript available</p>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};