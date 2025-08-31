import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileText, Waves } from 'lucide-react';
import { TranscriptData } from '../../hooks/useRecordingManager';

interface LiveTranscriptDisplayProps {
  transcripts: TranscriptData[];
  isRecording: boolean;
}

export const LiveTranscriptDisplay = ({ transcripts, isRecording }: LiveTranscriptDisplayProps) => {
  const finalTranscripts = transcripts.filter(t => t.isFinal);
  const pendingTranscripts = transcripts.filter(t => !t.isFinal);

  return (
    <Card className="h-[400px]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Live Transcript
          </CardTitle>
          {isRecording && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Waves className="h-3 w-3 animate-pulse" />
              Live
            </Badge>
          )}
        </div>
      </CardHeader>
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
    </Card>
  );
};