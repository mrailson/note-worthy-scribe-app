import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConsultationType, CONSULTATION_TYPE_LABELS, ScribeTranscriptData } from "@/types/scribe";
import { Mic, MicOff, Square, Pause, Play, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface ConsultationRecordingStateProps {
  duration: number;
  wordCount: number;
  connectionStatus: string;
  consultationType: ConsultationType;
  isPaused: boolean;
  transcript: string;
  realtimeTranscripts: ScribeTranscriptData[];
  showLiveTranscript: boolean;
  formatDuration: (seconds: number) => string;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onCancel: () => void;
}

export const ConsultationRecordingState = ({
  duration,
  wordCount,
  connectionStatus,
  consultationType,
  isPaused,
  transcript,
  realtimeTranscripts,
  showLiveTranscript: initialShowTranscript,
  formatDuration,
  onPause,
  onResume,
  onFinish,
  onCancel
}: ConsultationRecordingStateProps) => {
  const isMobile = useIsMobile();
  const [showTranscript, setShowTranscript] = useState(initialShowTranscript);

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] px-2 sm:px-4">
      {/* Minimal Header - Recording Status */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          {/* Recording Indicator */}
          <div className="flex items-center gap-2">
            <div className={`
              w-3 h-3 rounded-full 
              ${isPaused 
                ? 'bg-amber-500' 
                : 'bg-red-500 animate-pulse'
              }
            `} />
            <span className="font-mono text-lg font-semibold">
              {formatDuration(duration)}
            </span>
          </div>
          
          {/* Connection Status */}
          <span className={`
            text-xs px-2 py-1 rounded-full
            ${connectionStatus === 'Connected' 
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            }
          `}>
            {connectionStatus}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {CONSULTATION_TYPE_LABELS[consultationType]}
          </span>
          <span className="text-sm text-muted-foreground">
            • {wordCount} words
          </span>
        </div>
      </div>

      {/* Live Transcript (Collapsible) */}
      <div className="flex-1 min-h-0">
        <div className="flex items-center justify-between mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTranscript(!showTranscript)}
            className="text-muted-foreground gap-2"
          >
            {showTranscript ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
          </Button>
        </div>

        {showTranscript && (
          <Card className="h-[calc(100%-40px)]">
            <CardContent className="p-4 h-full">
              <ScrollArea className="h-full">
                {transcript ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {transcript}
                  </p>
                ) : realtimeTranscripts.length > 0 ? (
                  <div className="space-y-2">
                    {realtimeTranscripts.slice(-10).map((item, idx) => (
                      <p 
                        key={idx} 
                        className={`text-sm ${item.isFinal ? 'text-foreground' : 'text-muted-foreground italic'}`}
                      >
                        {item.text}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    Listening... Start speaking and the transcript will appear here.
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {!showTranscript && (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className={`
                w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4
                ${isPaused 
                  ? 'bg-amber-100 dark:bg-amber-900/30' 
                  : 'bg-red-100 dark:bg-red-900/30'
                }
              `}>
                {isPaused ? (
                  <Pause className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Mic className="h-8 w-8 text-red-600 dark:text-red-400 animate-pulse" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {isPaused ? 'Recording paused' : 'Recording in progress...'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className={`
        py-4 border-t bg-background/95 backdrop-blur-sm
        ${isMobile ? 'fixed bottom-0 left-0 right-0 px-4 pb-safe' : ''}
      `}>
        <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
          
          <Button
            variant="outline"
            onClick={isPaused ? onResume : onPause}
            className="w-12 h-12 p-0 rounded-full"
          >
            {isPaused ? (
              <Play className="h-5 w-5" />
            ) : (
              <Pause className="h-5 w-5" />
            )}
          </Button>
          
          <Button
            onClick={onFinish}
            className="flex-1 gap-2 bg-primary hover:bg-primary/90"
          >
            <Square className="h-4 w-4" />
            Finish & Create Note
          </Button>
        </div>
      </div>
    </div>
  );
};
