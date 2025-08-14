import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Wifi, WifiOff, Play, Pause } from "lucide-react";

interface RecordingControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  connectionStatus: string;
  wordCount: number;
  currentConfidence?: number;
  formatDuration: (seconds: number) => string;
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
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording
}: RecordingControlsProps) => {
  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {connectionStatus === "Connected" ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-destructive" />
            )}
            <span className="text-sm font-medium">{connectionStatus}</span>
          </div>
          
          {isRecording && (
            <Badge variant="secondary" className="animate-pulse">
              ● REC {formatDuration(duration)}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{wordCount} words</span>
          {currentConfidence && (
            <Badge variant="outline" className="text-xs">
              {Math.round(currentConfidence * 100)}% confidence
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        {!isRecording ? (
          <Button
            onClick={onStartRecording}
            size="lg"
            className="bg-gradient-primary hover:bg-primary-hover touch-manipulation min-h-[44px] text-base font-medium px-8"
          >
            <Mic className="h-5 w-5 mr-2" />
            Start Recording
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            {!isPaused ? (
              <Button
                onClick={onPauseRecording}
                variant="outline"
                size="lg"
                className="touch-manipulation min-h-[44px]"
              >
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
            ) : (
              <Button
                onClick={onResumeRecording}
                size="lg"
                className="bg-gradient-primary hover:bg-primary-hover touch-manipulation min-h-[44px]"
              >
                <Play className="h-4 w-4 mr-2" />
                Resume
              </Button>
            )}
            
            <Button
              onClick={onStopRecording}
              variant="destructive"
              size="lg"
              className="touch-manipulation min-h-[44px]"
            >
              <MicOff className="h-4 w-4 mr-2" />
              Stop
            </Button>
          </div>
        )}
      </div>

      {isPaused && (
        <div className="text-center text-sm text-muted-foreground">
          Recording paused at {formatDuration(duration)}
        </div>
      )}
    </div>
  );
};