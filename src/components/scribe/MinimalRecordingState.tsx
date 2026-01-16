import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ConsultationType } from "@/types/scribe";
import { 
  Pause, 
  Play, 
  Square, 
  ChevronDown, 
  ChevronUp, 
  Mic, 
  Loader2, 
  LayoutList,
  Ear,
  FileText,
  ShieldCheck,
  Settings,
  Eye,
  EyeOff,
  Info,
  Clock
} from "lucide-react";
import { AudioWaveform } from "./AudioWaveform";

interface MicrophoneDevice {
  deviceId: string;
  label: string;
}

interface MinimalRecordingStateProps {
  duration: number;
  wordCount: number;
  isPaused: boolean;
  isFinishing?: boolean;
  formatDuration: (seconds: number) => string;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onExpandView: () => void;
  transcript?: string;
  selectedMicrophoneId?: string;
  onMicrophoneChange?: (deviceId: string) => void;
}

export const MinimalRecordingState = ({
  duration,
  wordCount,
  isPaused,
  isFinishing = false,
  formatDuration,
  onPause,
  onResume,
  onFinish,
  onExpandView,
  transcript,
  selectedMicrophoneId,
  onMicrophoneChange,
}: MinimalRecordingStateProps) => {
  const [showPatientInfo, setShowPatientInfo] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [microphones, setMicrophones] = useState<MicrophoneDevice[]>([]);

  // Load available microphones
  useEffect(() => {
    const loadMicrophones = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices
          .filter(device => device.kind === 'audioinput')
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Microphone ${index + 1}`,
          }));
        setMicrophones(mics);
      } catch (error) {
        console.error('Failed to enumerate devices:', error);
      }
    };

    loadMicrophones();
    
    navigator.mediaDevices.addEventListener('devicechange', loadMicrophones);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadMicrophones);
    };
  }, []);

  return (
    <>
      {/* Full-screen finishing overlay - shows immediately when finish is clicked */}
      {isFinishing && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-full max-w-md mx-4 border-primary/20">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="relative mx-auto w-16 h-16">
                <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                <div className="relative w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Finishing Consultation</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Processing final transcript...
                </p>
              </div>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(duration)}
                </span>
                <span>•</span>
                <span>{wordCount} words</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col items-center justify-center h-[calc(100vh-180px)] px-4 relative">
      {/* Clinician Controls - Discrete dropdown in corner */}
      <div className="absolute top-4 right-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground gap-2"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Controls</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 bg-background border shadow-lg z-50">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Clinician Controls
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* Full View Option */}
            <DropdownMenuItem onClick={onExpandView} className="gap-2 cursor-pointer">
              <LayoutList className="h-4 w-4" />
              Switch to Full View
            </DropdownMenuItem>
            
            {/* Transcript Toggle */}
            <DropdownMenuItem 
              onClick={() => setShowTranscript(!showTranscript)} 
              className="gap-2 cursor-pointer"
            >
              {showTranscript ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  Hide Transcript
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Show Transcript
                </>
              )}
            </DropdownMenuItem>
            
            {/* Microphone Selector */}
            {microphones.length > 0 && onMicrophoneChange && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-2">
                  <label className="text-xs text-muted-foreground mb-2 block">
                    <Mic className="h-3 w-3 inline mr-1" />
                    Microphone
                  </label>
                  <Select 
                    value={selectedMicrophoneId || microphones[0]?.deviceId} 
                    onValueChange={onMicrophoneChange}
                  >
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="Select microphone" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {microphones.map((mic) => (
                        <SelectItem key={mic.deviceId} value={mic.deviceId} className="text-xs">
                          {mic.label.length > 28 ? mic.label.substring(0, 28) + '...' : mic.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main content - centered */}
      <div className="flex flex-col items-center justify-center flex-1 -mt-8 w-full max-w-xl">
        {/* Recording indicator with audio waveform */}
        <div className="flex items-center gap-3 mb-6">
          <div className={`
            w-3 h-3 rounded-full 
            ${isPaused 
              ? 'bg-amber-500' 
              : 'bg-destructive animate-pulse'
            }
          `} />
          <span className="text-sm text-muted-foreground">
            {isPaused ? 'Paused' : 'Transcribing consultation'}
          </span>
          {!isPaused && (
            <AudioWaveform 
              deviceId={selectedMicrophoneId} 
              isActive={!isPaused}
              barCount={5}
            />
          )}
        </div>

        {/* Timer */}
        <div className="font-mono text-3xl sm:text-4xl font-semibold tracking-tight mb-3">
          {formatDuration(duration)}
        </div>

        {/* Word count */}
        <div className="text-xl text-muted-foreground mb-6">
          {wordCount.toLocaleString()} words
        </div>

        {/* Patient Information Card - Collapsible */}
        <Collapsible 
          open={showPatientInfo} 
          onOpenChange={setShowPatientInfo}
          className="w-full"
        >
          <CollapsibleContent>
            <Card className="bg-muted/30 border-muted mb-2">
              <CardContent className="p-4 sm:p-5">
                <h3 className="font-semibold text-base mb-3 text-foreground">
                  Supporting your consultation
                </h3>
                <ul className="space-y-2.5 text-sm text-foreground/80">
                  <li className="flex items-start gap-2.5">
                    <Ear className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span>Listening in real time to create written notes</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span>Notes are checked and confirmed by your clinician</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <ShieldCheck className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span>No audio recordings are saved or stored</span>
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground mt-4 italic">
                  (You may ask for this tool not to be used)
                </p>
              </CardContent>
            </Card>
          </CollapsibleContent>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-center text-muted-foreground hover:text-foreground gap-1.5 text-xs"
            >
              <Info className="h-3.5 w-3.5" />
              <span>{showPatientInfo ? 'Hide patient information' : 'Show patient information'}</span>
              {showPatientInfo ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>

        {/* Transcript Panel (hidden by default, clinician-controlled) */}
        {showTranscript && (
          <Card className="bg-muted/30 mt-4 w-full">
            <CardContent className="p-0">
              <ScrollArea className="h-32">
                <div className="p-4">
                  {transcript ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                      {transcript}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic text-center">
                      Transcript will appear here as you speak...
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bottom section with reassurance footer and controls */}
      <div className="w-full max-w-sm pb-6">
        {/* Reassurance footer */}
        <p className="text-xs text-muted-foreground text-center mb-4">
          Secure NHS system • No audio stored • Clinician checked
        </p>

        {/* Control buttons */}
        <div className="flex items-center justify-center gap-6">
          {/* Pause/Resume button */}
          <Button
            variant="outline"
            onClick={isPaused ? onResume : onPause}
            className="w-14 h-14 p-0 rounded-full"
            disabled={isFinishing}
          >
            {isPaused ? (
              <Play className="h-6 w-6" />
            ) : (
              <Pause className="h-6 w-6" />
            )}
          </Button>
          
          {/* Finish button */}
          <Button
            onClick={onFinish}
            disabled={isFinishing}
            className="h-14 px-8 gap-2 bg-primary hover:bg-primary/90 text-lg"
          >
            {isFinishing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Ending...
              </>
            ) : (
              <>
                <Square className="h-5 w-5" />
                Finish
              </>
            )}
          </Button>
        </div>
      </div>
      </div>
    </>
  );
};
