import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Copy, Download, Users, Clock } from "lucide-react";
import { TranscriptData } from '@/services/TranscriptionService';
import { toast } from "sonner";
import { useState } from "react";

interface TranscriptDisplayProps {
  transcript: string;
  realtimeTranscripts: TranscriptData[];
  wordCount: number;
  isRecording: boolean;
  showTimestamps?: boolean;
}

export const TranscriptDisplay = ({
  transcript,
  realtimeTranscripts,
  wordCount,
  isRecording,
  showTimestamps = false
}: TranscriptDisplayProps) => {
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopyTranscript = async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      setCopySuccess(true);
      toast.success("Transcript copied to clipboard");
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      toast.error("Failed to copy transcript");
    }
  };

  const handleDownloadTranscript = () => {
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-transcript-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Transcript downloaded");
  };

  const formatTranscriptWithTimestamps = () => {
    if (!showTimestamps) return transcript;

    return realtimeTranscripts
      .filter(t => t.isFinal)
      .map(t => {
        const time = new Date(t.timestamp).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        return `[${time}] ${t.speaker}: ${t.text}`;
      })
      .join('\n');
  };

  const getDisplayTranscript = () => {
    if (showTimestamps) {
      return formatTranscriptWithTimestamps();
    }
    return transcript;
  };

  const getSpeakerCount = () => {
    const speakers = new Set(realtimeTranscripts.map(t => t.speaker));
    return speakers.size;
  };

  const getEstimatedReadingTime = () => {
    // Average reading speed: 200-250 words per minute
    const avgWordsPerMinute = 225;
    const minutes = Math.ceil(wordCount / avgWordsPerMinute);
    return minutes;
  };

  return (
    <Card className="shadow-medium">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Live Transcript
          </div>
          <div className="flex items-center gap-2">
            {isRecording && (
              <Badge variant="secondary" className="animate-pulse">
                Live
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Transcript Stats */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            <span>{wordCount} words</span>
          </div>
          
          {getSpeakerCount() > 0 && (
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{getSpeakerCount()} speakers</span>
            </div>
          )}
          
          {wordCount > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>~{getEstimatedReadingTime()} min read</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyTranscript}
            disabled={!transcript}
            className="flex items-center gap-2"
          >
            <Copy className="h-4 w-4" />
            {copySuccess ? "Copied!" : "Copy"}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTranscript}
            disabled={!transcript}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>

        {/* Transcript Content */}
        <div className="border rounded-lg">
          <ScrollArea className="h-[400px] p-4">
            {transcript ? (
              <div className="space-y-2">
                <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                  {getDisplayTranscript()}
                </pre>
                
                {/* Show interim results while recording */}
                {isRecording && realtimeTranscripts.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-xs text-muted-foreground mb-2">Interim results:</div>
                    {realtimeTranscripts
                      .filter(t => !t.isFinal)
                      .slice(-3) // Show last 3 interim results
                      .map((t, index) => (
                        <div key={index} className="text-sm text-muted-foreground italic">
                          {t.text}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                {isRecording ? (
                  <div className="space-y-2">
                    <div className="animate-pulse">Listening for speech...</div>
                    <div className="text-xs">Your transcript will appear here as you speak</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
                    <div>No transcript available</div>
                    <div className="text-xs">Start recording to see your live transcript</div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Transcript Quality Indicator */}
        {realtimeTranscripts.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Average confidence:</span>
              <span>
                {Math.round(
                  realtimeTranscripts
                    .filter(t => t.isFinal)
                    .reduce((sum, t) => sum + t.confidence, 0) / 
                  realtimeTranscripts.filter(t => t.isFinal).length * 100
                )}%
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};