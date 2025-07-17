import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Play, Square, Clock, Users, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RealtimeTranscriber, TranscriptData } from "@/utils/RealtimeTranscriber";

interface MeetingRecorderProps {
  onTranscriptUpdate: (transcript: string) => void;
  onDurationUpdate: (duration: string) => void;
  onWordCountUpdate: (count: number) => void;
  initialSettings?: {
    title: string;
    description: string;
    meetingType: string;
  };
}

export const MeetingRecorder = ({ 
  onTranscriptUpdate, 
  onDurationUpdate, 
  onWordCountUpdate,
  initialSettings
}: MeetingRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [realtimeTranscripts, setRealtimeTranscripts] = useState<TranscriptData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const [speakerCount, setSpeakerCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [startTime, setStartTime] = useState<string>("");
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const transciberRef = useRef<RealtimeTranscriber | null>(null);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTranscript = (transcriptData: TranscriptData) => {
    // Update transcripts array
    setRealtimeTranscripts(prev => {
      const filtered = prev.filter(t => 
        !(t.speaker === transcriptData.speaker && !t.isFinal)
      );
      const newTranscripts = [...filtered, transcriptData];
      
      // Calculate speaker count from the new array
      const speakers = new Set(newTranscripts.map(t => t.speaker));
      setSpeakerCount(speakers.size);
      
      // Update main transcript if this is final
      if (transcriptData.isFinal) {
        const finalTranscripts = newTranscripts.filter(t => t.isFinal);
        const fullTranscript = finalTranscripts
          .map(t => `${t.speaker}: ${t.text}`)
          .join('\n');
        
        setTranscript(fullTranscript);
        onTranscriptUpdate(fullTranscript);
        
        // Update word count
        const words = fullTranscript.split(' ').filter(word => word.length > 0);
        setWordCount(words.length);
        onWordCountUpdate(words.length);
      }
      
      return newTranscripts;
    });
  };

  const handleTranscriptionError = (error: string) => {
    toast({
      title: "Transcription Error",
      description: error,
      variant: "destructive",
    });
    setConnectionStatus("Error");
  };

  const handleStatusChange = (status: string) => {
    // Use a more robust approach to avoid state updates during render
    queueMicrotask(() => setConnectionStatus(status));
  };

  const startRecording = async () => {
    try {
      // Initialize real-time transcriber
      transciberRef.current = new RealtimeTranscriber(
        handleTranscript,
        handleTranscriptionError,
        handleStatusChange
      );
      
      await transciberRef.current.startTranscription();
      
      setIsRecording(true);
      setRealtimeTranscripts([]);
      setSpeakerCount(0);
      setStartTime(new Date().toISOString());
      
      // Start duration timer
      intervalRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          const minutes = Math.floor(newDuration / 60);
          const seconds = newDuration % 60;
          const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          onDurationUpdate(timeString);
          return newDuration;
        });
      }, 1000);

      toast({
        title: "Recording Started",
        description: "Real-time transcription is now active",
      });
    } catch (error) {
      toast({
        title: "Recording Failed",
        description: "Could not start recording",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (transciberRef.current) {
      transciberRef.current.stopTranscription();
      transciberRef.current = null;
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsRecording(false);
    
    // Navigate to meeting summary with data
    const meetingData = {
      title: initialSettings?.title || 'General Meeting',
      duration: formatDuration(duration),
      wordCount: wordCount,
      transcript: transcript,
      speakerCount: speakerCount,
      startTime: startTime
    };

    navigate('/meeting-summary', { state: meetingData });
    
    toast({
      title: "Recording Stopped",
      description: "Meeting recording and transcription completed",
    });
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'Connected':
      case 'Transcription active':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'Connecting...':
        return <Wifi className="h-4 w-4 text-yellow-500 animate-pulse" />;
      case 'Error':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'Connected':
      case 'Transcription active':
        return 'default';
      case 'Connecting...':
        return 'secondary';
      case 'Error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Card className="shadow-medium border-accent/20">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            Meeting Recorder
          </span>
          <div className="flex items-center gap-2">
            <Badge variant={getConnectionStatusColor() as any} className="flex items-center gap-1">
              {getConnectionStatusIcon()}
              {connectionStatus}
            </Badge>
            {speakerCount > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {speakerCount} speakers
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-primary">{formatDuration(duration)}</div>
            <div className="text-sm text-muted-foreground">Duration</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{wordCount}</div>
            <div className="text-sm text-muted-foreground">Words Transcribed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{speakerCount}</div>
            <div className="text-sm text-muted-foreground">Speakers Detected</div>
          </div>
        </div>

        <div className="flex gap-2 justify-center">
          {!isRecording ? (
            <Button 
              onClick={startRecording}
              className="bg-gradient-primary hover:bg-primary-hover shadow-subtle"
            >
              <Mic className="h-4 w-4 mr-2" />
              Start Recording
            </Button>
          ) : (
            <Button 
              onClick={stopRecording}
              variant="destructive"
              className="shadow-subtle"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop Recording
            </Button>
          )}
        </div>

        {isRecording && (
          <div className="flex items-center justify-center gap-2 text-primary animate-pulse">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span className="text-sm font-medium">Recording with real-time transcription...</span>
          </div>
        )}

        {/* Real-time transcript preview */}
        {realtimeTranscripts.length > 0 && (
          <div className="mt-4 p-3 bg-accent/30 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Live Transcript:</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {realtimeTranscripts.slice(-3).map((t, index) => (
                <div key={index} className={`text-xs ${t.isFinal ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                  <span className="font-medium text-primary">{t.speaker}:</span> {t.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};