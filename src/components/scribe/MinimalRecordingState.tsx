import { useState, useEffect, useRef } from "react";
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
import { AudioSourceMode } from "@/components/meeting/QuickAudioSourceSwitcher";
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
  Clock,
  Radio,
  Monitor,
  AlertCircle
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
  // Audio source switching props
  audioSourceMode?: AudioSourceMode;
  onAudioSourceChange?: (mode: AudioSourceMode) => Promise<void>;
  isSwitchingAudioSource?: boolean;
  micCaptured?: boolean;
  systemAudioCaptured?: boolean;
  // Live preview props (AssemblyAI real-time)
  livePreviewFullTranscript?: string;
  livePreviewActive?: boolean;
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
  // Audio source props with defaults
  audioSourceMode = 'microphone',
  onAudioSourceChange,
  isSwitchingAudioSource = false,
  micCaptured = false,
  systemAudioCaptured = false,
  // Live preview props
  livePreviewFullTranscript = '',
  livePreviewActive = false,
}: MinimalRecordingStateProps) => {
  const [showPatientInfo, setShowPatientInfo] = useState(true);
  const [showAudioModeInfo, setShowAudioModeInfo] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showRealtimeTranscript, setShowRealtimeTranscript] = useState(false);
  const [transcriptSource, setTranscriptSource] = useState<'realtime' | 'batch'>('realtime');
  const [microphones, setMicrophones] = useState<MicrophoneDevice[]>([]);
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const liveTranscriptRef = useRef<HTMLDivElement>(null);
  const batchTranscriptRef = useRef<HTMLDivElement>(null);

  // Auto-scroll live transcript to bottom when new text arrives
  useEffect(() => {
    if (liveTranscriptRef.current && livePreviewFullTranscript) {
      liveTranscriptRef.current.scrollTop = liveTranscriptRef.current.scrollHeight;
    }
  }, [livePreviewFullTranscript]);

  // Auto-scroll batch transcript to bottom when new text arrives
  useEffect(() => {
    if (batchTranscriptRef.current && transcript) {
      batchTranscriptRef.current.scrollTop = batchTranscriptRef.current.scrollHeight;
    }
  }, [transcript]);

  // Handle finish with immediate feedback
  const handleFinish = () => {
    setIsButtonPressed(true);
    onFinish();
  };

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
          <DropdownMenuContent align="end" className="w-80 bg-background border shadow-lg z-50">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Clinician Controls
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {/* Full View Option */}
            <DropdownMenuItem onClick={onExpandView} className="gap-2 cursor-pointer">
              <LayoutList className="h-4 w-4" />
              Switch to Full View
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
                    <SelectContent className="bg-background border shadow-lg z-50 min-w-[280px]">
                      {microphones.map((mic) => (
                        <SelectItem key={mic.deviceId} value={mic.deviceId} className="text-xs">
                          {mic.label}
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
        {/* Recording indicator with audio waveform, timer, and word count - all inline */}
        <div className="flex items-center gap-3 mb-4 flex-wrap justify-center">
          <div className={`
            w-3 h-3 rounded-full 
            ${isPaused 
              ? 'bg-amber-500' 
              : 'bg-green-500 animate-pulse'
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
          <span className="text-sm text-muted-foreground">•</span>
          <span className="text-sm font-mono">{formatDuration(duration)}</span>
          <span className="text-sm text-muted-foreground">•</span>
          <span className="text-sm text-muted-foreground">{wordCount.toLocaleString()} words</span>
        </div>

        {/* Audio Mode Guidance - Collapsible */}
        {onAudioSourceChange && (
          <Collapsible 
            open={showAudioModeInfo} 
            onOpenChange={setShowAudioModeInfo}
            className="w-full mb-4"
          >
            <CollapsibleContent>
              <Card className="bg-muted/40 border-muted">
                <CardContent className="p-4">
                  {isSwitchingAudioSource ? (
                    <div className="flex items-center justify-center gap-3 py-2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Switching audio source...</span>
                    </div>
                  ) : audioSourceMode === 'microphone' ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Mic className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">You are using Microphone only</p>
                          <p className="text-xs text-muted-foreground">For face-to-face consultations</p>
                        </div>
                      </div>
                      
                      <div className="border-t border-muted pt-3">
                        <p className="text-xs text-muted-foreground mb-2">
                          If you are on Surgery Connect phonebar, switch to:
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAudioSourceChange('microphone_and_system')}
                          disabled={isFinishing}
                          className="w-full justify-center gap-2 h-9"
                        >
                          <Mic className="h-3.5 w-3.5" />
                          <span>+</span>
                          <Monitor className="h-3.5 w-3.5" />
                          <span>Mic + SoftPhone</span>
                        </Button>
                        <div className="flex items-start gap-1.5 mt-2 text-xs text-amber-600 dark:text-amber-500">
                          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>You will need to share your screen/tab audio when prompted</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <div className="flex items-center gap-0.5">
                            <Mic className="h-3 w-3 text-primary" />
                            <Monitor className="h-3 w-3 text-primary" />
                          </div>
                        </div>
                        <div>
                          <p className="font-medium text-sm">You are using Mic + SoftPhone</p>
                          <p className="text-xs text-muted-foreground">Captures your computer sound (Surgery Connect, Teams, Zoom)</p>
                        </div>
                      </div>
                      
                      <div className="border-t border-muted pt-3">
                        <p className="text-xs text-muted-foreground mb-2">
                          If you are face-to-face with the patient, switch to:
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAudioSourceChange('microphone')}
                          disabled={isFinishing}
                          className="w-full justify-center gap-2 h-9"
                        >
                          <Mic className="h-3.5 w-3.5" />
                          <span>Microphone only</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </CollapsibleContent>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-center text-muted-foreground hover:text-foreground gap-1.5 text-xs mt-1"
              >
                <Mic className="h-3.5 w-3.5" />
                <span>{showAudioModeInfo ? 'Hide audio settings' : 'Show audio settings'}</span>
                {showAudioModeInfo ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        )}

        {/* Patient Information Card - Collapsible - Large and patient-friendly */}
        <Collapsible 
          open={showPatientInfo} 
          onOpenChange={setShowPatientInfo}
          className="w-full"
        >
          <CollapsibleContent>
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/20 shadow-lg mb-3">
              <CardContent className="p-6 sm:p-8">
                <h3 className="font-semibold text-xl sm:text-2xl mb-5 text-foreground text-center">
                  Supporting your consultation
                </h3>
                <ul className="space-y-4 text-base sm:text-lg text-foreground/90">
                  <li className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Ear className="h-5 w-5 text-primary" />
                    </div>
                    <span className="pt-2">Listening in real time to create written notes</span>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <span className="pt-2">Notes are checked and confirmed by your clinician</span>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                    </div>
                    <span className="pt-2">No audio recordings are saved or stored</span>
                  </li>
                </ul>
                <p className="text-sm text-muted-foreground mt-6 italic text-center">
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

        {/* Real-time Transcript Toggle with source switcher */}
        <Collapsible open={showRealtimeTranscript} onOpenChange={setShowRealtimeTranscript}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-center text-muted-foreground hover:text-foreground gap-1.5 text-xs mt-2"
            >
              <Radio className="h-3.5 w-3.5" />
              <span>{showRealtimeTranscript ? 'Hide transcripts' : 'Show transcripts'}</span>
              {livePreviewActive && (
                <span className="flex h-2 w-2 ml-1">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              )}
              {showRealtimeTranscript ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="bg-muted/30 mt-2 w-full">
              <CardContent className="p-0">
                {/* Transcript source toggle */}
                <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border/50">
                  <div className="flex gap-1 bg-muted rounded-md p-0.5">
                    <Button
                      variant={transcriptSource === 'realtime' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setTranscriptSource('realtime')}
                    >
                      <Radio className="h-3 w-3 mr-1" />
                      Notewell
                    </Button>
                    <Button
                      variant={transcriptSource === 'batch' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setTranscriptSource('batch')}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Whisper
                    </Button>
                  </div>
                  {transcriptSource === 'realtime' && livePreviewActive && (
                    <span className="text-xs bg-green-500/20 text-green-600 px-2 py-0.5 rounded-full animate-pulse">
                      Live
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {transcriptSource === 'realtime' 
                      ? `${livePreviewFullTranscript?.split(/\s+/).filter(Boolean).length || 0} words`
                      : `${transcript?.split(/\s+/).filter(Boolean).length || 0} words`
                    }
                  </span>
                </div>

                {/* Realtime transcript */}
                {transcriptSource === 'realtime' && (
                  <div ref={liveTranscriptRef} className="h-32 overflow-y-auto">
                    <div className="px-4 pt-2 pb-4">
                      {livePreviewFullTranscript ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                          {livePreviewFullTranscript}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic text-center">
                          Real-time transcript will appear here as you speak...
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Batch (Whisper) transcript */}
                {transcriptSource === 'batch' && (
                  <div ref={batchTranscriptRef} className="h-32 overflow-y-auto">
                    <div className="px-4 pt-2 pb-4">
                      {transcript ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                          {transcript}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic text-center">
                          Whisper transcript appears after each chunk is processed...
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
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
            onClick={handleFinish}
            disabled={isFinishing || isButtonPressed}
            className={`h-14 px-8 gap-2 text-lg transition-all duration-150 ${
              isButtonPressed || isFinishing 
                ? 'bg-primary/70 scale-95' 
                : 'bg-primary hover:bg-primary/90 active:scale-95'
            }`}
          >
            {isFinishing || isButtonPressed ? (
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
