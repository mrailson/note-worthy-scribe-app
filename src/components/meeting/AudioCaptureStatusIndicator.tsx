import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Mic, Monitor, CheckCircle2, XCircle, AlertCircle, CheckCircle, Radio } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AudioCaptureStatusIndicatorProps {
  micCaptured: boolean;
  systemAudioCaptured: boolean;
  recordingMode: 'mic-only' | 'mic-and-system';
  isRecording: boolean;
  audioActivity: boolean;
  // Transcription health props
  healthStatus?: 'healthy' | 'warning' | 'critical' | 'inactive';
  timeSinceLastChunk?: number;
  totalChunks?: number;
  actualChunksPerMinute?: number;
  // AssemblyAI input mode
  assemblyInputMode?: 'mic-only' | 'mic-and-system' | 'inactive';
}

export const AudioCaptureStatusIndicator = ({
  micCaptured,
  systemAudioCaptured,
  recordingMode,
  isRecording,
  audioActivity,
  healthStatus = 'inactive',
  timeSinceLastChunk = 0,
  totalChunks = 0,
  actualChunksPerMinute = 0,
  assemblyInputMode = 'inactive'
}: AudioCaptureStatusIndicatorProps) => {
  const [showVoiceIndicator, setShowVoiceIndicator] = useState(true);
  const [hasAutoHidden, setHasAutoHidden] = useState(false);

  // Auto-hide after 20 seconds of recording
  useEffect(() => {
    if (!isRecording) {
      // Reset states when recording stops
      setShowVoiceIndicator(true);
      setHasAutoHidden(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowVoiceIndicator(false);
      setHasAutoHidden(true);
    }, 20000);

    return () => clearTimeout(timer);
  }, [isRecording]);

  if (!isRecording) return null;

  const getMicStatus = () => {
    // In mic+system mode the microphone might not be required (e.g. recording a remote Teams call)
    if (recordingMode === 'mic-and-system' && !micCaptured) {
      return { icon: Mic, color: "text-muted-foreground", label: "Mic not used (system audio only)" };
    }

    if (micCaptured) {
      return { icon: CheckCircle2, color: "text-green-500", label: hasAutoHidden ? "Click to show/hide voice activity" : "Mic Active" };
    }

    // Only treat as an error in mic-only mode
    return { icon: XCircle, color: "text-red-500", label: "Mic Inactive" };
  };

  const getSystemStatus = () => {
    if (recordingMode === 'mic-only') {
      return { icon: Monitor, color: "text-muted-foreground", label: "System Audio: Not Required" };
    }
    if (systemAudioCaptured) {
      return { icon: CheckCircle2, color: "text-green-500", label: "System Audio Active" };
    }
    return { icon: AlertCircle, color: "text-amber-500", label: "System Audio Not Detected" };
  };

  const getAssemblyInputStatus = () => {
    if (assemblyInputMode === 'inactive') {
      return null;
    }
    if (assemblyInputMode === 'mic-and-system') {
      return { 
        color: "text-green-500", 
        label: "Live Transcript: Mic + System",
        description: "Live transcript is capturing both microphone and system audio"
      };
    }
    // mic-only
    if (recordingMode === 'mic-and-system') {
      // User wanted system audio but got mic-only fallback
      return { 
        color: "text-amber-500", 
        label: "Live Transcript: Mic Only (fallback)",
        description: "System audio unavailable for live transcript. Check your screen share settings."
      };
    }
    return { 
      color: "text-blue-500", 
      label: "Live Transcript: Mic Only",
      description: "Live transcript is using microphone input"
    };
  };

  const handleMicStatusClick = () => {
    if (hasAutoHidden) {
      setShowVoiceIndicator(prev => !prev);
    }
  };

  const formatTimeSince = (ms: number): string => {
    if (ms < 1000) return 'just now';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s ago`;
  };

  const getHealthConfig = () => {
    switch (healthStatus) {
      case 'healthy':
        return {
          color: 'text-green-500',
          pulseColor: 'bg-green-500',
          label: 'Transcription Active',
          description: 'Audio is being processed normally'
        };
      case 'warning':
        return {
          color: 'text-yellow-500',
          pulseColor: 'bg-yellow-500',
          label: 'Checking Status',
          description: 'No new transcription for a while'
        };
      case 'critical':
        return {
          color: 'text-red-500',
          pulseColor: 'bg-red-500',
          label: 'Transcription Stalled',
          description: 'Check your recording - transcription may have stopped'
        };
      default:
        return {
          color: 'text-muted-foreground',
          pulseColor: 'bg-muted',
          label: 'Inactive',
          description: 'Transcription not active'
        };
    }
  };

  const micStatus = getMicStatus();
  const systemStatus = getSystemStatus();
  const healthConfig = getHealthConfig();
  const assemblyStatus = getAssemblyInputStatus();

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg border">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`flex items-center gap-1.5 ${hasAutoHidden ? 'cursor-pointer hover:bg-secondary/80' : 'cursor-help'}`}
            onClick={handleMicStatusClick}
          >
            <micStatus.icon className={`h-3.5 w-3.5 ${micStatus.color}`} />
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{micStatus.label}</p>
        </TooltipContent>
      </Tooltip>

      {/* Voice Detection Indicator - mobile only (desktop has wave icon), always rendered to prevent layout shift */}
      <Badge 
        variant="outline" 
        className={`md:hidden flex items-center gap-1.5 bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700 transition-opacity duration-200 ${
          audioActivity && showVoiceIndicator ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-xs text-green-600 dark:text-green-400 font-medium">Voice Detected and Transcribing...</span>
      </Badge>

      {recordingMode === 'mic-and-system' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="flex items-center gap-1.5 cursor-help">
              <systemStatus.icon className={`h-3.5 w-3.5 ${systemStatus.color}`} />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{systemStatus.label}</p>
            {!systemAudioCaptured && (
              <p className="text-xs text-muted-foreground mt-1">
                You may have selected a Window instead of a Browser Tab
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      )}

      {/* AssemblyAI Input Mode Indicator */}
      {assemblyStatus && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="flex items-center gap-1.5 cursor-help">
              <Radio className={`h-3.5 w-3.5 ${assemblyStatus.color}`} />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{assemblyStatus.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{assemblyStatus.description}</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Transcription Health Indicator - integrated into this container */}
      {healthStatus !== 'inactive' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                "flex items-center gap-1.5 cursor-help",
                healthStatus === 'critical' && "animate-pulse"
              )}
            >
              {/* Pulsing dot indicator */}
              <span className="relative flex h-2.5 w-2.5">
                {healthStatus === 'healthy' && (
                  <span 
                    className={cn(
                      "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                      healthConfig.pulseColor
                    )} 
                  />
                )}
                <span 
                  className={cn(
                    "relative inline-flex rounded-full h-2.5 w-2.5",
                    healthConfig.pulseColor
                  )} 
                />
              </span>
              
              <CheckCircle className={cn("h-3.5 w-3.5", healthConfig.color)} />
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1.5">
              <div className="font-semibold flex items-center gap-2">
                <CheckCircle className={cn("h-4 w-4", healthConfig.color)} />
                {healthConfig.label}
              </div>
              <p className="text-xs text-muted-foreground">{healthConfig.description}</p>
              <div className="text-xs space-y-1 pt-1 border-t border-border/50">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Chunks processed:</span>
                  <span className="font-medium">{totalChunks}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Last chunk:</span>
                  <span>{formatTimeSince(timeSinceLastChunk)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Chunks/min:</span>
                  <span>{actualChunksPerMinute.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
