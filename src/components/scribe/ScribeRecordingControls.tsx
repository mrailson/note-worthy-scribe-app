import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Mic, RotateCcw, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScribeTranscriptData } from "@/types/scribe";

interface ScribeRecordingControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  connectionStatus: string;
  wordCount: number;
  currentConfidence?: number;
  formatDuration: (seconds: number) => string;
  transcript: string;
  realtimeTranscripts: ScribeTranscriptData[];
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onResetSession?: () => void;
  onImportTranscript?: (transcript: string) => void;
}

export const ScribeRecordingControls = ({
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
  onResumeRecording,
  onResetSession,
  onImportTranscript
}: ScribeRecordingControlsProps) => {
  const isMobile = useIsMobile();
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [hideResetConfirmation, setHideResetConfirmation] = useState(false);

  useEffect(() => {
    const hideConfirmation = localStorage.getItem('hideScribeResetConfirmation') === 'true';
    setHideResetConfirmation(hideConfirmation);
  }, []);

  const handleResetClick = () => {
    if (hideResetConfirmation) {
      handleReset();
    } else {
      setShowResetDialog(true);
    }
  };

  const handleReset = () => {
    if (isRecording) {
      onStopRecording();
    }
    if (onResetSession) {
      onResetSession();
    }
    setShowResetDialog(false);
  };

  const handleConfirmReset = () => {
    if (dontShowAgain) {
      localStorage.setItem('hideScribeResetConfirmation', 'true');
      setHideResetConfirmation(true);
    }
    handleReset();
    setDontShowAgain(false);
  };

  return (
    <Card className="w-full">
      <CardHeader className={`${isMobile ? 'flex flex-col space-y-3 pb-3' : 'flex flex-row items-center justify-between space-y-0 pb-2'}`}>
        <CardTitle className={`${isMobile ? 'text-base text-center' : 'text-lg'}`}>
          Scribe Recording
        </CardTitle>
        <Button 
          variant="outline" 
          size={isMobile ? "sm" : "sm"} 
          onClick={handleResetClick}
          className={`${isMobile ? 'w-full' : ''}`}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          {isMobile ? "New Session" : "Start New Session"}
        </Button>
      </CardHeader>
      
      <CardContent className={`${isMobile ? 'space-y-4' : 'space-y-6'}`}>
        {/* Main Recording Controls */}
        <div className="space-y-4">
          <div className="flex justify-center">
            {!isRecording ? (
              <Button
                onClick={onStartRecording}
                size="lg"
                className={`bg-primary hover:bg-primary/90 text-primary-foreground font-medium min-h-[48px] ${isMobile ? 'w-full py-4 text-lg' : 'px-8 py-3 text-base'}`}
              >
                <Mic className="h-5 w-5 mr-2" />
                Start Recording
              </Button>
            ) : (
              <Button
                onClick={onStopRecording}
                variant="destructive"
                size="lg"
                className={`font-medium min-h-[48px] ${isMobile ? 'w-full py-4 text-lg' : 'px-8 py-3 text-base'}`}
              >
                Stop Recording
              </Button>
            )}
          </div>

          {/* Duration and Words Counter */}
          <div className={`flex justify-center ${isMobile ? 'gap-8' : 'gap-12'}`}>
            <div className="text-center">
              <div className={`font-bold text-primary ${isMobile ? 'text-xl' : 'text-2xl'}`}>{formatDuration(duration)}</div>
              <div className="text-sm text-muted-foreground">Duration</div>
            </div>
            <div className="text-center">
              <div className={`font-bold text-primary ${isMobile ? 'text-xl' : 'text-2xl'}`}>{wordCount}</div>
              <div className="text-sm text-muted-foreground">Words</div>
            </div>
          </div>
        </div>

        {/* Transcript Service - Collapsible */}
        <Collapsible open={isTranscriptExpanded} onOpenChange={setIsTranscriptExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Live Transcript
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
              
              <ScrollArea className={`w-full ${isMobile ? 'h-24' : 'h-32'}`}>
                <div className="space-y-2 text-sm">
                  {realtimeTranscripts.length > 0 ? (
                    realtimeTranscripts.slice(-10).map((item, index) => (
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

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start New Session?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to start a new session? This will clear all current transcript data and reset the recording.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center space-x-2 my-4">
            <Checkbox
              id="dont-show-again"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <Label htmlFor="dont-show-again" className="text-sm">
              Don't show this message again
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowResetDialog(false);
              setDontShowAgain(false);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReset}>
              Start New Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
