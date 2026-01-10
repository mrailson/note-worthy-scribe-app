import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConsultationType, CONSULTATION_TYPE_LABELS, ScribeTranscriptData } from "@/types/scribe";
import { Mic, Pause, Play, Square, Eye, EyeOff, Clock } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";

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

interface TimestampedSegment {
  text: string;
  timestamp: Date;
  elapsedSeconds: number;
  isFinal: boolean;
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
  const [startTime] = useState(() => new Date());
  const [timestampedSegments, setTimestampedSegments] = useState<TimestampedSegment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTranscriptCount = useRef(0);

  // Track new transcripts and add timestamps
  useEffect(() => {
    if (realtimeTranscripts.length > lastTranscriptCount.current) {
      const newTranscripts = realtimeTranscripts.slice(lastTranscriptCount.current);
      const newSegments: TimestampedSegment[] = newTranscripts.map((t) => ({
        text: t.text,
        timestamp: new Date(),
        elapsedSeconds: duration,
        isFinal: t.isFinal
      }));
      
      setTimestampedSegments(prev => [...prev, ...newSegments]);
      lastTranscriptCount.current = realtimeTranscripts.length;
    }
  }, [realtimeTranscripts, duration]);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [timestampedSegments]);

  // Format elapsed time as MM:SS
  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Group consecutive segments within 5 seconds
  const groupedSegments = timestampedSegments.reduce<TimestampedSegment[][]>((acc, segment) => {
    const lastGroup = acc[acc.length - 1];
    if (lastGroup && Math.abs(segment.elapsedSeconds - lastGroup[0].elapsedSeconds) < 5) {
      lastGroup.push(segment);
    } else {
      acc.push([segment]);
    }
    return acc;
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] px-2 sm:px-4">
      {/* Header with Recording Status */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          {/* Recording Indicator */}
          <div className="flex items-center gap-2">
            <div className={`
              w-3 h-3 rounded-full 
              ${isPaused 
                ? 'bg-amber-500' 
                : 'bg-destructive animate-pulse'
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

      {/* Session Info Bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b mb-3">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Started: {format(startTime, 'HH:mm')}
          </span>
          <span>
            {format(startTime, 'EEEE, d MMMM yyyy')}
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
            <CardContent className="p-0 h-full">
              <ScrollArea className="h-full">
                <div ref={scrollRef} className="p-4 space-y-4">
                  {groupedSegments.length > 0 ? (
                    groupedSegments.map((group, groupIdx) => (
                      <div key={groupIdx} className="flex gap-3">
                        {/* Timestamp Column */}
                        <div className="flex-shrink-0 w-16 pt-0.5">
                          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {formatElapsed(group[0].elapsedSeconds)}
                          </span>
                        </div>
                        
                        {/* Text Column */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-relaxed">
                            {group.map((segment, segIdx) => (
                              <span
                                key={segIdx}
                                className={segment.isFinal ? 'text-foreground' : 'text-muted-foreground italic'}
                              >
                                {segment.text}{' '}
                              </span>
                            ))}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : transcript ? (
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-16 pt-0.5">
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          00:00
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {transcript}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <Mic className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3 animate-pulse" />
                        <p className="text-muted-foreground text-sm">
                          Listening... Start speaking and the transcript will appear here.
                        </p>
                        <p className="text-muted-foreground/70 text-xs mt-1">
                          Timestamps will be added automatically
                        </p>
                      </div>
                    </div>
                  )}
                </div>
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
                  : 'bg-destructive/10'
                }
              `}>
                {isPaused ? (
                  <Pause className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Mic className="h-8 w-8 text-destructive animate-pulse" />
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