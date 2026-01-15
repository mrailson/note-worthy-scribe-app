import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ConsultationType } from "@/types/scribe";
import { Pause, Play, Square, Maximize2, ChevronDown, ChevronUp, Mic, Loader2, LayoutList } from "lucide-react";
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
    <div className="flex flex-col items-center justify-center h-[calc(100vh-180px)] px-4 relative">
      {/* Switch to Full View button in corner */}
      <div className="absolute top-4 right-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onExpandView}
          className="text-muted-foreground hover:text-foreground gap-2"
        >
          <LayoutList className="h-4 w-4" />
          <span className="hidden sm:inline">Full View</span>
        </Button>
      </div>

      {/* Mic selector in top left */}
      {microphones.length > 0 && onMicrophoneChange && (
        <div className="absolute top-4 left-4">
          <Select 
            value={selectedMicrophoneId || microphones[0]?.deviceId} 
            onValueChange={onMicrophoneChange}
          >
            <SelectTrigger className="w-[200px] h-9 text-xs bg-background">
              <Mic className="h-3 w-3 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select microphone" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              {microphones.map((mic) => (
                <SelectItem key={mic.deviceId} value={mic.deviceId} className="text-xs">
                  {mic.label.length > 30 ? mic.label.substring(0, 30) + '...' : mic.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Main content - centered */}
      <div className="flex flex-col items-center justify-center flex-1 -mt-16">
        {/* Recording indicator with audio waveform */}
        <div className="flex items-center gap-3 mb-8">
          <div className={`
            w-3 h-3 rounded-full 
            ${isPaused 
              ? 'bg-amber-500' 
              : 'bg-destructive animate-pulse'
            }
          `} />
          <span className="text-sm text-muted-foreground">
            {isPaused ? 'Paused' : 'Recording'}
          </span>
          {!isPaused && (
            <AudioWaveform 
              deviceId={selectedMicrophoneId} 
              isActive={!isPaused}
              barCount={5}
            />
          )}
        </div>

        {/* Large timer */}
        <div className="font-mono text-6xl sm:text-7xl font-bold tracking-tight mb-4">
          {formatDuration(duration)}
        </div>

        {/* Word count */}
        <div className="text-xl text-muted-foreground mb-6">
          {wordCount.toLocaleString()} words
        </div>

        {/* Collapsible Transcript */}
        <Collapsible 
          open={showTranscript} 
          onOpenChange={setShowTranscript}
          className="w-full max-w-2xl"
        >
          <CollapsibleTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-between text-muted-foreground"
            >
              <span>{showTranscript ? 'Hide Transcript' : 'Show Transcript'}</span>
              {showTranscript ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <Card className="bg-muted/30">
              <CardContent className="p-0">
                <ScrollArea className="h-48">
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
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Bottom controls */}
      <div className="w-full max-w-sm pb-8">
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
  );
};
