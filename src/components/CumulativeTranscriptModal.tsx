import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Download, X, Clock, Users, Hash, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface TranscriptSection {
  id: string;
  text: string;
  speaker: string;
  timestamp: string;
  confidence: number;
  isFinal: boolean;
}

interface CumulativeTranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  sections: TranscriptSection[];
  duration: number;
  speakerCount: number;
  wordCount: number;
}

export const CumulativeTranscriptModal = ({
  isOpen,
  onClose,
  title,
  sections,
  duration,
  speakerCount,
  wordCount
}: CumulativeTranscriptModalProps) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const [showSpeakers, setShowSpeakers] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new sections are added
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sections, autoScroll]);

  // Format timestamp from ISO string to readable format
  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      
      // Get ordinal suffix for day
      const day = date.getDate();
      const getOrdinal = (n: number) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
      };
      
      const formattedDate = format(date, 'MMMM yyyy');
      const time = format(date, 'HH:mm');
      const seconds = date.getSeconds();
      
      return `${getOrdinal(day)} ${formattedDate} at ${time} and ${seconds} seconds`;
    } catch (error) {
      // Fallback to original timestamp if parsing fails
      return isoString;
    }
  };

  const handleCopyAll = async () => {
    const fullTranscript = sections
      .filter(s => s.isFinal)
      .map(s => `${s.speaker}: ${s.text}`)
      .join('\n\n');
    
    try {
      await navigator.clipboard.writeText(fullTranscript);
      toast.success("Full transcript copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy transcript");
    }
  };

  const handleDownload = () => {
    const fullTranscript = sections
      .filter(s => s.isFinal)
      .map(s => `[${s.timestamp}] ${s.speaker}: ${s.text}`)
      .join('\n\n');
    
    const blob = new Blob([fullTranscript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}_transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Transcript downloaded");
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl h-[85vh] flex flex-col">
        <CardHeader className="flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold">{title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Live Cumulative Transcript</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Stats Bar */}
          <div className="flex items-center gap-4 mt-3">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(duration)}
            </Badge>
            <Badge 
              variant="secondary" 
              className="flex items-center gap-1 cursor-pointer hover:bg-accent transition-colors"
              onClick={() => setShowSpeakers(!showSpeakers)}
              title={showSpeakers ? "Hide speakers" : "Show speakers"}
            >
              {showSpeakers ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {speakerCount} speakers
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {wordCount} words
            </Badge>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyAll}
                className="h-8"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="h-8"
              >
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Auto-scroll:</label>
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="w-4 h-4"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea ref={scrollAreaRef} className="h-full p-6">
            <div className="space-y-4">
              {sections.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <p className="text-lg mb-2">No transcript available yet</p>
                  <p className="text-sm">Start recording to see the live transcript here</p>
                </div>
              ) : (
                sections.map((section) => (
                  <div
                    key={section.id}
                    className={`p-4 rounded-lg border transition-all duration-200 ${
                      section.isFinal 
                        ? 'bg-background border-border' 
                        : 'bg-muted/50 border-dashed border-muted-foreground/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {showSpeakers && (
                          <Badge 
                            variant={section.isFinal ? "default" : "secondary"} 
                            className="text-xs"
                          >
                            {section.speaker}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(section.timestamp)}
                        </span>
                        {!section.isFinal && (
                          <Badge variant="outline" className="text-xs">
                            Processing...
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${
                          section.confidence > 0.8 ? 'bg-green-500' :
                          section.confidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                        <span className="text-xs text-muted-foreground">
                          {Math.round(section.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                    <p className={`text-sm leading-relaxed ${
                      section.isFinal ? 'text-foreground' : 'text-muted-foreground italic'
                    }`}>
                      {showSpeakers ? section.text : `${section.speaker}: ${section.text}`}
                    </p>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};