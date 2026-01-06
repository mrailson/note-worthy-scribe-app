import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Mic, Monitor, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AudioCaptureStatusIndicatorProps {
  micCaptured: boolean;
  systemAudioCaptured: boolean;
  recordingMode: 'mic-only' | 'mic-and-system';
  isRecording: boolean;
  audioActivity: boolean;
}

export const AudioCaptureStatusIndicator = ({
  micCaptured,
  systemAudioCaptured,
  recordingMode,
  isRecording,
  audioActivity
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

  const handleMicStatusClick = () => {
    if (hasAutoHidden) {
      setShowVoiceIndicator(prev => !prev);
    }
  };

  const micStatus = getMicStatus();
  const systemStatus = getSystemStatus();

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

      {/* Voice Detection Indicator - always rendered to prevent layout shift, visibility controlled via CSS */}
      <Badge 
        variant="outline" 
        className={`flex items-center gap-1.5 bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700 transition-opacity duration-200 ${
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
    </div>
  );
};
