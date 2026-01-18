import { useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { PreviewStatus } from "@/hooks/useAssemblyRealtimePreview";
import { cn } from "@/lib/utils";

interface LiveTranscriptPreviewProps {
  transcript: string;
  status: PreviewStatus;
  isActive: boolean;
  error: string | null;
  className?: string;
}

export const LiveTranscriptPreview = ({
  transcript,
  status,
  isActive,
  error,
  className
}: LiveTranscriptPreviewProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new text arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const getStatusBadge = () => {
    switch (status) {
      case 'connecting':
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Connecting...
          </Badge>
        );
      case 'recording':
        return (
          <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            Live
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Error
          </Badge>
        );
      case 'stopped':
        return (
          <Badge variant="outline" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Stopped
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            Idle
          </Badge>
        );
    }
  };

  return (
    <Card className={cn(
      "border-dashed border-2 border-muted-foreground/30 bg-muted/20",
      className
    )}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Live Preview
            </span>
            <Badge variant="outline" className="text-xs">
              Mic Check
            </Badge>
          </div>
          {getStatusBadge()}
        </div>

        {/* Transcript Area */}
        <div 
          ref={scrollRef}
          className="min-h-[60px] max-h-[100px] overflow-y-auto bg-background/50 rounded-md p-3 text-sm"
        >
          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : transcript ? (
            <p className="leading-relaxed">
              {transcript}
              {isActive && (
                <span className="inline-block w-1.5 h-4 bg-primary ml-1 animate-pulse" />
              )}
            </p>
          ) : isActive ? (
            <p className="text-muted-foreground italic">
              Listening... speak to verify microphone is working
            </p>
          ) : status === 'connecting' ? (
            <p className="text-muted-foreground italic">
              Connecting to transcription service...
            </p>
          ) : (
            <p className="text-muted-foreground italic">
              Live preview will appear here when recording starts
            </p>
          )}
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
          Preview only — your full transcript is being recorded separately
        </p>
      </CardContent>
    </Card>
  );
};
