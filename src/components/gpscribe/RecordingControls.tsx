import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, RotateCcw, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface RecordingControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  connectionStatus: string;
  wordCount: number;
  currentConfidence?: number;
  formatDuration: (seconds: number) => string;
  transcript: string;
  realtimeTranscripts: Array<{
    text: string;
    timestamp: string;
    speaker?: string;
    confidence?: number;
    isFinal?: boolean;
  }>;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
}

export const RecordingControls = ({
  isRecording,
  isPaused,
  duration,
  connectionStatus,
  wordCount,
  currentConfidence,
  formatDuration,
  transcript,
  realtimeTranscripts,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording
}: RecordingControlsProps) => {
  const [isTelephone, setIsTelephone] = useState(false);
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);

  const handleReset = () => {
    if (isRecording) {
      onStopRecording();
    }
    // Additional reset logic can be added here
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">
          GP Consultation
        </CardTitle>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset
        </Button>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Consultation Type */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium">Consultation Type</Label>
          </div>
          <div className="flex items-center gap-4">
            <Label 
              htmlFor="consultation-type" 
              className={`text-sm font-medium transition-colors ${!isTelephone ? 'text-primary' : 'text-muted-foreground'}`}
            >
              Face to Face
            </Label>
            <Switch
              id="consultation-type"
              checked={isTelephone}
              onCheckedChange={setIsTelephone}
              className="data-[state=checked]:bg-primary"
            />
            <Label 
              htmlFor="consultation-type" 
              className={`text-sm font-medium transition-colors ${isTelephone ? 'text-primary' : 'text-muted-foreground'}`}
            >
              Telephone
            </Label>
          </div>
        </div>

        {/* Duration and Words Counter */}
        <div className="flex justify-center gap-12">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{formatDuration(duration)}</div>
            <div className="text-sm text-muted-foreground">Duration</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{wordCount}</div>
            <div className="text-sm text-muted-foreground">Words</div>
          </div>
        </div>

        {/* Start Transcribing Button */}
        <div className="flex justify-center">
          {!isRecording ? (
            <Button
              onClick={onStartRecording}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-white px-8 py-3 text-base font-medium min-h-[48px]"
            >
              <Mic className="h-5 w-5 mr-2" />
              Start Transcribing
            </Button>
          ) : (
            <Button
              onClick={onStopRecording}
              variant="destructive"
              size="lg"
              className="px-8 py-3 text-base font-medium min-h-[48px]"
            >
              Stop Transcribing
            </Button>
          )}
        </div>

        {/* Transcript Service - Collapsible */}
        <Collapsible open={isTranscriptExpanded} onOpenChange={setIsTranscriptExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Transcript Service
              </span>
              {isTranscriptExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-3">
            <div className="border rounded-lg p-3 bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Live Transcript
                </Label>
                {isRecording && (
                  <div className="flex items-center gap-1 text-xs text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Recording
                  </div>
                )}
              </div>
              
              <ScrollArea className="h-32 w-full">
                <div className="space-y-2 text-sm">
                  {/* Real-time transcripts */}
                  {realtimeTranscripts.length > 0 ? (
                    realtimeTranscripts.map((item, index) => (
                      <div key={index} className="text-foreground/80">
                        {item.text}
                        {item.confidence && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({Math.round(item.confidence * 100)}%)
                          </span>
                        )}
                      </div>
                    ))
                  ) : transcript ? (
                    <div className="text-foreground/80">{transcript}</div>
                  ) : (
                    <div className="text-muted-foreground italic">
                      {isRecording 
                        ? "Listening for speech..." 
                        : "No transcript available. Start recording to see real-time transcription."}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};