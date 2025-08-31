import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileText, Waves, ChevronDown, ChevronUp } from 'lucide-react';
import { TranscriptData } from '../../hooks/useRecordingManager';

interface LiveTranscriptDisplayProps {
  transcripts: TranscriptData[];
  isRecording: boolean;
  transcriptionService: string;
}

export const LiveTranscriptDisplay = ({ 
  transcripts, 
  isRecording, 
  transcriptionService 
}: LiveTranscriptDisplayProps) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const finalTranscripts = transcripts.filter(t => t.isFinal);
  const pendingTranscripts = transcripts.filter(t => !t.isFinal);

  return (
    <Collapsible open={!isCollapsed} onOpenChange={setIsCollapsed}>
      <Card className={isCollapsed ? "h-auto" : "h-[400px]"}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-accent/5 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Live Transcript
                <Badge variant="outline" className="text-xs">
                  {transcriptionService}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                {isRecording && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Waves className="h-3 w-3 animate-pulse" />
                    Live
                  </Badge>
                )}
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  {isCollapsed ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
        <ScrollArea className="h-[320px] px-6 pb-6">
          <div className="space-y-3">
            {finalTranscripts.length === 0 && pendingTranscripts.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                <div>
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">
                    {isRecording ? 'Listening for speech...' : 'Start recording to see live transcripts'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {finalTranscripts.map((transcript, index) => (
                  <div key={index} className="group p-3 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="text-xs shrink-0">
                        {transcript.speaker}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm leading-relaxed text-foreground">
                          {transcript.text}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(transcript.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Confidence: {Math.round(transcript.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {pendingTranscripts.map((transcript, index) => (
                  <div key={`pending-${index}`} className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-start gap-3">
                      <Badge variant="secondary" className="text-xs shrink-0 animate-pulse">
                        {transcript.speaker}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm leading-relaxed text-muted-foreground italic">
                          {transcript.text}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          Processing...
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </CollapsibleContent>
  </Card>
</Collapsible>
  );
};