import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MicOff, Play, Square, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const [wordCount, setWordCount] = useState(0);
  const { toast } = useToast();

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Update duration every second when recording
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          onDurationUpdate(formatDuration(newDuration));
          return newDuration;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, onDurationUpdate]);

  // Simulate transcript updates
  useEffect(() => {
    if (isRecording) {
      const mockTranscripts = [
        "Welcome everyone to today's meeting.",
        "Let's start with the agenda items for today.",
        "First item is the review of previous actions.",
        "Dr. Smith, could you provide an update on the patient care initiatives?",
        "Thank you for that comprehensive overview.",
        "Moving on to the financial update section.",
        "The budget allocation for this quarter shows positive trends.",
        "Are there any questions regarding the staffing matters?",
        "We need to address the IT systems upgrade timeline.",
        "Next meeting is scheduled for next month."
      ];

      const interval = setInterval(() => {
        if (transcript.split('. ').length < mockTranscripts.length) {
          const nextSentence = mockTranscripts[transcript.split('. ').length];
          const newTranscript = transcript ? `${transcript} ${nextSentence}` : nextSentence;
          setTranscript(newTranscript);
          onTranscriptUpdate(newTranscript);
          
          const words = newTranscript.split(' ').length;
          setWordCount(words);
          onWordCountUpdate(words);
        }
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [isRecording, transcript, onTranscriptUpdate, onWordCountUpdate]);

  const startRecording = () => {
    setIsRecording(true);
    toast({
      title: "Recording Started",
      description: "Meeting recording has begun",
    });
  };

  const stopRecording = () => {
    setIsRecording(false);
    toast({
      title: "Recording Stopped",
      description: `Meeting recorded for ${formatDuration(duration)}`,
    });
  };

  return (
    <Card className="shadow-medium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Meeting Recording
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
            <div className="text-sm text-muted-foreground">Words between 00:00 and 00:30</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{wordCount}</div>
            <div className="text-sm text-muted-foreground">Total Meeting Words</div>
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
            <span className="text-sm font-medium">Recording in progress...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};