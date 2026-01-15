import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Mic, RotateCcw, FileText, ChevronDown, ChevronRight, Upload, Settings, Phone, Video, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { ConsultationType } from "@/types/gpscribe";
import { TranscriptImport } from "./TranscriptImport";
import { useIsMobile } from "@/hooks/use-mobile";

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
  consultationType?: ConsultationType;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onResetConsultation?: () => void;
  onImportTranscript?: (transcript: string) => void;
  onConsultationTypeChange?: (type: ConsultationType) => void;
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
  consultationType = "face-to-face",
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  onResetConsultation,
  onImportTranscript,
  onConsultationTypeChange
}: RecordingControlsProps) => {
  const isMobile = useIsMobile();
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);
  const [isImportExpanded, setIsImportExpanded] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [hideResetConfirmation, setHideResetConfirmation] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Load the "don't show again" preference from localStorage
  useEffect(() => {
    const hideConfirmation = localStorage.getItem('hideResetConfirmation') === 'true';
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
    // Call the reset function passed from parent to clear all state
    if (onResetConsultation) {
      onResetConsultation();
    }
    setShowResetDialog(false);
  };

  const handleConfirmReset = () => {
    if (dontShowAgain) {
      localStorage.setItem('hideResetConfirmation', 'true');
      setHideResetConfirmation(true);
    }
    handleReset();
    setDontShowAgain(false);
  };

  return (
    <Card className="w-full">
      <CardHeader className={`${isMobile ? 'flex flex-col space-y-3 pb-3' : 'flex flex-row items-center justify-between space-y-0 pb-2'}`}>
        <CardTitle className={`${isMobile ? 'text-base text-center' : 'text-lg'}`}>
          Clinical Consultation
        </CardTitle>
        <Button 
          variant="outline" 
          size={isMobile ? "sm" : "sm"} 
          onClick={handleResetClick}
          className={`${isMobile ? 'w-full' : ''}`}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          {isMobile ? "New Consultation" : "Start New Consultation"}
        </Button>
      </CardHeader>
      
      <CardContent className={`${isMobile ? 'space-y-4' : 'space-y-6'}`}>
        {/* Main Recording Controls */}
        <div className="space-y-4">
          {/* Start Transcribing Button */}
          <div className="flex justify-center">
            {!isRecording ? (
              <Button
                onClick={onStartRecording}
                size="lg"
                className={`bg-primary hover:bg-primary/90 text-white font-medium min-h-[48px] ${isMobile ? 'w-full py-4 text-lg' : 'px-8 py-3 text-base'}`}
              >
                <Mic className="h-5 w-5 mr-2" />
                Start Transcribing
              </Button>
            ) : (
              <Button
                onClick={onStopRecording}
                variant="destructive"
                size="lg"
                className={`font-medium min-h-[48px] ${isMobile ? 'w-full py-4 text-lg' : 'px-8 py-3 text-base'}`}
              >
                Stop Transcribing
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

        {/* Advanced Settings - Collapsible on Mobile */}
        {isMobile ? (
          <Collapsible open={showAdvancedSettings} onOpenChange={setShowAdvancedSettings}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2">
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Advanced Settings
                </span>
                {showAdvancedSettings ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4">
              {/* Consultation Type */}
              <div className="flex flex-col items-center gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-medium">Consultation Type</Label>
                </div>
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                  <Button
                    variant={consultationType === 'face-to-face' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onConsultationTypeChange?.('face-to-face')}
                    className="gap-1.5"
                  >
                    <Users className="h-3.5 w-3.5" />
                    F2F
                  </Button>
                  <Button
                    variant={consultationType === 'telephone' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onConsultationTypeChange?.('telephone')}
                    className="gap-1.5"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Phone
                  </Button>
                  <Button
                    variant={consultationType === 'video' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onConsultationTypeChange?.('video')}
                    className="gap-1.5"
                  >
                    <Video className="h-3.5 w-3.5" />
                    Video
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          /* Desktop: Show consultation type normally */
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium">Consultation Type</Label>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={consultationType === 'face-to-face' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onConsultationTypeChange?.('face-to-face')}
                className="gap-1.5"
              >
                <Users className="h-3.5 w-3.5" />
                Face to Face
              </Button>
              <Button
                variant={consultationType === 'telephone' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onConsultationTypeChange?.('telephone')}
                className="gap-1.5"
              >
                <Phone className="h-3.5 w-3.5" />
                Telephone
              </Button>
              <Button
                variant={consultationType === 'video' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onConsultationTypeChange?.('video')}
                className="gap-1.5"
              >
                <Video className="h-3.5 w-3.5" />
                Video
              </Button>
            </div>
          </div>
        )}


        {/* Transcript Service - Collapsible */}
        <Collapsible open={isTranscriptExpanded} onOpenChange={setIsTranscriptExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Transcript
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

        {/* Transcript Import - Collapsible */}
        {onImportTranscript && (
          <Collapsible open={isImportExpanded} onOpenChange={setIsImportExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-2">
                <span className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Import Test Transcript
                </span>
                {isImportExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="space-y-3">
              <TranscriptImport 
                onImportTranscript={onImportTranscript} 
                disabled={isRecording}
              />
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start New Consultation?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to start a new consultation? This will clear all current transcript data and reset the session.
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
              Start New Consultation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};