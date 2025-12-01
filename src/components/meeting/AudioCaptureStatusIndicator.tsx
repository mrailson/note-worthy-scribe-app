import { Badge } from "@/components/ui/badge";
import { Mic, Monitor, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AudioCaptureStatusIndicatorProps {
  micCaptured: boolean;
  systemAudioCaptured: boolean;
  recordingMode: 'mic-only' | 'mic-and-system';
  isRecording: boolean;
}

export const AudioCaptureStatusIndicator = ({
  micCaptured,
  systemAudioCaptured,
  recordingMode,
  isRecording
}: AudioCaptureStatusIndicatorProps) => {
  if (!isRecording) return null;

  const getMicStatus = () => {
    // In mic+system mode the microphone might not be required (e.g. recording a remote Teams call)
    if (recordingMode === 'mic-and-system' && !micCaptured) {
      return { icon: Mic, color: "text-muted-foreground", label: "Mic not used (system audio only)" };
    }

    if (micCaptured) {
      return { icon: CheckCircle2, color: "text-green-500", label: "Mic Active" };
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

  const micStatus = getMicStatus();
  const systemStatus = getSystemStatus();

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg border">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="flex items-center gap-1.5 cursor-help">
            <Mic className={`h-3.5 w-3.5 ${micStatus.color}`} />
            <micStatus.icon className={`h-3.5 w-3.5 ${micStatus.color}`} />
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{micStatus.label}</p>
        </TooltipContent>
      </Tooltip>

      {recordingMode === 'mic-and-system' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="flex items-center gap-1.5 cursor-help">
              <Monitor className={`h-3.5 w-3.5 ${systemStatus.color}`} />
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
