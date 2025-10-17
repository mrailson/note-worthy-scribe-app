import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  MessageSquare, 
  Maximize2, 
  Minimize2, 
  Copy, 
  RotateCcw,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { detectDevice } from "@/utils/DeviceDetection";

interface RealtimeTranscriptCardProps {
  transcriptText: string;
  isRecording?: boolean;
  wordCount?: number;
  confidence?: number;
  duration?: string;
  className?: string;
}

export const RealtimeTranscriptCard = ({
  transcriptText,
  isRecording = false,
  wordCount = 0,
  confidence,
  duration = "00:00",
  className
}: RealtimeTranscriptCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showConfidence, setShowConfidence] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isIOS = detectDevice().isIOS;

  // Auto-scroll to bottom when new transcript content arrives
  useEffect(() => {
    if (autoScroll && !isUserScrolling && transcriptText) {
      const scrollToBottom = () => {
        if (scrollAreaRef.current) {
          const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
          }
        }
      };
      
      // Small delay to ensure content has rendered
      setTimeout(scrollToBottom, 50);
    }
  }, [transcriptText, autoScroll, isUserScrolling]);

  // Handle user scrolling detection
  const handleScroll = () => {
    if (!autoScroll) return;
    
    setIsUserScrolling(true);
    
    // Clear existing timeout
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    
    // Resume auto-scroll after user stops scrolling for 3 seconds
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 3000);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyTranscript = async () => {
    if (!transcriptText) {
      toast.error("No transcript to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(transcriptText);
      toast.success("Transcript copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy transcript");
    }
  };

  const handleToggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const getConfidenceColor = (conf: number): string => {
    if (conf >= 0.8) return "text-green-600";
    if (conf >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  const formatTimestamp = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTranscriptForDisplay = (text: string) => {
    if (!text) return "";
    
    // Split into sentences for better readability
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .filter(sentence => sentence.trim().length > 0);

    return sentences.map((sentence, index) => {
      const shouldShowTimestamp = showTimestamps && index % 5 === 0; // Show timestamp every 5 sentences
      const estimatedTime = Math.floor(index * 3); // Rough estimate: 3 seconds per sentence
      
      return (
        <div key={index} className="mb-1 leading-relaxed">
          {shouldShowTimestamp && (
            <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="font-mono">{formatTimestamp(estimatedTime)}</span>
              <div className="flex-1 h-px bg-border"></div>
            </div>
          )}
          <div>{sentence.trim()}</div>
        </div>
      );
    });
  };

  return (
    <Card className={cn("relative transition-all duration-300", className, {
      "h-[131rem]": isExpanded,
      "h-[32rem]": !isExpanded
    })}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span>Meeting Transcript</span>
            {/* Word Count - always visible inline with title */}
            <Badge variant="outline" className="text-xs">
              {wordCount} words
            </Badge>
            {isRecording && (
              <Badge variant="secondary" className="bg-red-100 text-red-800 animate-pulse">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-1" />
                Recording
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            
            {/* Confidence Score */}
            {showConfidence && confidence !== undefined && (
              <Badge 
                variant="outline" 
                className={cn("text-xs", getConfidenceColor(confidence))}
              >
                {(confidence * 100).toFixed(0)}%
              </Badge>
            )}
            
            {/* Controls */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTimestamps(!showTimestamps)}
              className="h-6 w-6 p-0"
              title="Toggle timestamps"
            >
              <Clock className="h-3 w-3" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfidence(!showConfidence)}
              className="h-6 w-6 p-0"
            >
              {showConfidence ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyTranscript}
              disabled={!transcriptText}
              className="h-6 w-6 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleExpanded}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0 pb-2 h-full">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
            <Switch
              id="auto-scroll"
              checked={autoScroll}
              onCheckedChange={setAutoScroll}
            />
              <Label htmlFor="auto-scroll" className="text-xs">
                Auto-scroll
              </Label>
            </div>
            
            {isUserScrolling && autoScroll && (
              <Badge variant="secondary" className="text-xs">
                <RotateCcw className="h-3 w-3 mr-1" />
                Auto-scroll paused
              </Badge>
            )}
          </div>
          
          <div className="text-xs text-muted-foreground">
            {transcriptText ? `${transcriptText.length} characters` : "Waiting for speech..."}
          </div>
        </div>
        
        <ScrollArea 
          ref={scrollAreaRef}
          className={cn("rounded-md border bg-background/50 p-3", {
            "h-[calc(100vh-20rem)]": isExpanded,
            "h-[18rem]": !isExpanded
          })}
          onScrollCapture={handleScroll}
        >
          <div 
            ref={contentRef}
            className="text-sm leading-relaxed min-h-full"
            style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
          >
            {transcriptText ? (
              <div className="space-y-1">
                {formatTranscriptForDisplay(transcriptText)}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground italic">
                  <div className="text-center">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <div>Listening for speech...</div>
                    <div className="text-xs mt-1">
                      Latest Transcript will appear here each minute
                    </div>
                  </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};