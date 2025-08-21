import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  Eye, 
  EyeOff, 
  Download,
  Users,
  Clock,
  BarChart3,
  Waves,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MeetingData {
  transcript: string;
  duration: number;
  wordCount: number;
  connectionStatus: string;
}

interface LiveMonitorTabProps {
  meetingData: MeetingData;
}

interface TranscriptChunk {
  id: string;
  text: string;
  confidence: number;
  timestamp: Date;
  speaker?: string;
  isProcessed: boolean;
}

export const LiveMonitorTab = ({ meetingData }: LiveMonitorTabProps) => {
  const [showRawTranscript, setShowRawTranscript] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [chunks, setChunks] = useState<TranscriptChunk[]>([]);
  const [liveStats, setLiveStats] = useState({
    averageConfidence: 0,
    wordsPerMinute: 0,
    speakerChanges: 0,
    qualityScore: 0
  });
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const isConnected = meetingData.connectionStatus === "Connected";

  // Simulate real-time chunks from the transcript
  useEffect(() => {
    if (!meetingData.transcript) return;

    // Split transcript into sentences and create mock chunks
    const sentences = meetingData.transcript.split(/[.!?]+/).filter(s => s.trim());
    const newChunks: TranscriptChunk[] = sentences.map((sentence, index) => ({
      id: `chunk-${index}`,
      text: sentence.trim(),
      confidence: 0.75 + Math.random() * 0.25, // Simulate confidence 75-100%
      timestamp: new Date(Date.now() - (sentences.length - index) * 2000),
      speaker: Math.random() > 0.7 ? `Speaker ${Math.floor(Math.random() * 3) + 1}` : undefined,
      isProcessed: Math.random() > 0.3
    }));

    setChunks(newChunks);

    // Calculate live stats
    if (newChunks.length > 0) {
      const avgConfidence = newChunks.reduce((sum, c) => sum + c.confidence, 0) / newChunks.length;
      const speakerChanges = newChunks.reduce((count, chunk, index) => {
        if (index > 0 && chunk.speaker !== newChunks[index - 1].speaker) {
          return count + 1;
        }
        return count;
      }, 0);

      setLiveStats({
        averageConfidence: Math.round(avgConfidence * 100),
        wordsPerMinute: Math.round((meetingData.wordCount / Math.max(meetingData.duration / 60, 1))),
        speakerChanges,
        qualityScore: Math.round((avgConfidence * 0.7 + (meetingData.wordCount / Math.max(meetingData.duration * 5, 1)) * 0.3) * 100)
      });
    }
  }, [meetingData]);

  // Auto scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chunks, autoScroll]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "text-success";
    if (confidence >= 0.7) return "text-warning";
    return "text-destructive";
  };

  const getConfidenceProgress = (confidence: number) => {
    return Math.round(confidence * 100);
  };

  const exportChunks = () => {
    const data = {
      meeting: {
        timestamp: new Date().toISOString(),
        duration: meetingData.duration,
        wordCount: meetingData.wordCount
      },
      statistics: liveStats,
      chunks: chunks.map(chunk => ({
        text: chunk.text,
        confidence: chunk.confidence,
        timestamp: chunk.timestamp.toISOString(),
        speaker: chunk.speaker,
        isProcessed: chunk.isProcessed
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-chunks-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Connection & Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <Wifi className="h-4 w-4 text-success" />
                ) : (
                  <WifiOff className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm font-medium">Connection</span>
              </div>
              <Badge variant={isConnected ? "default" : "destructive"}>
                {meetingData.connectionStatus}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Quality</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{liveStats.qualityScore}%</div>
                <Progress value={liveStats.qualityScore} className="w-16 h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">WPM</span>
              </div>
              <div className="text-lg font-bold">{liveStats.wordsPerMinute}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Speakers</span>
              </div>
              <div className="text-lg font-bold">{liveStats.speakerChanges + 1}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Waves className="h-5 w-5 text-primary" />
              Live Transcript Monitor
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={showRawTranscript}
                  onCheckedChange={setShowRawTranscript}
                />
                <Label className="text-sm">Raw View</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={autoScroll}
                  onCheckedChange={setAutoScroll}
                />
                <Label className="text-sm">Auto Scroll</Label>
              </div>
              <Button variant="outline" size="sm" onClick={exportChunks}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            ref={scrollRef}
            className="h-96 overflow-y-auto space-y-2 p-4 border rounded-lg bg-muted/20"
          >
            {chunks.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Waves className="h-8 w-8 mx-auto mb-2" />
                  <p>Waiting for transcript data...</p>
                </div>
              </div>
            ) : (
              chunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className={cn(
                    "p-3 rounded-lg border transition-all",
                    chunk.isProcessed 
                      ? "bg-card border-border" 
                      : "bg-warning/10 border-warning/20",
                    showRawTranscript && "font-mono text-sm"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      {chunk.speaker && (
                        <Badge variant="outline" className="mb-2 text-xs">
                          {chunk.speaker}
                        </Badge>
                      )}
                      <p className={cn(
                        "text-sm",
                        showRawTranscript && "text-xs"
                      )}>
                        {chunk.text}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{chunk.timestamp.toLocaleTimeString()}</span>
                        <div className="flex items-center gap-1">
                          <span className={getConfidenceColor(chunk.confidence)}>
                            {getConfidenceProgress(chunk.confidence)}%
                          </span>
                          {chunk.confidence < 0.7 && (
                            <AlertTriangle className="h-3 w-3 text-warning" />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <Progress 
                        value={getConfidenceProgress(chunk.confidence)} 
                        className="w-8 h-2" 
                      />
                      {!chunk.isProcessed && (
                        <Badge variant="secondary" className="text-xs">
                          Processing
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Session Statistics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Total Chunks</div>
              <div className="font-medium">{chunks.length}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Avg Confidence</div>
              <div className="font-medium">{liveStats.averageConfidence}%</div>
            </div>
            <div>
              <div className="text-muted-foreground">Processing Rate</div>
              <div className="font-medium">
                {Math.round((chunks.filter(c => c.isProcessed).length / chunks.length) * 100) || 0}%
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Duration</div>
              <div className="font-medium">
                {Math.floor(meetingData.duration / 60)}:{(meetingData.duration % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};