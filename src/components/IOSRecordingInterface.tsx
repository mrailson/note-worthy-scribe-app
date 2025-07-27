import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, Square } from 'lucide-react';
import { SpeechToText } from '@/components/SpeechToText';
import { toast } from 'sonner';

interface IOSRecordingInterfaceProps {
  onTranscriptUpdate: (transcript: string) => void;
  onDurationUpdate: (duration: string) => void;
  onWordCountUpdate: (count: number) => void;
}

export const IOSRecordingInterface: React.FC<IOSRecordingInterfaceProps> = ({
  onTranscriptUpdate,
  onDurationUpdate,
  onWordCountUpdate
}) => {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);

  const handleSpeechTranscription = (text: string) => {
    const newTranscript = transcript + (transcript ? '\n' : '') + text;
    setTranscript(newTranscript);
    onTranscriptUpdate(newTranscript);
    
    // Update word count
    const words = newTranscript.split(' ').filter(word => word.length > 0);
    onWordCountUpdate(words.length);
    
    toast.success('Speech converted to text!');
  };

  const startRecording = () => {
    setIsRecording(true);
    setDuration(0);
    setTranscript('');
    toast.info('iOS Recording Mode: Use the microphone button below to record speech segments');
  };

  const stopRecording = () => {
    setIsRecording(false);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    onDurationUpdate(timeString);
    toast.success('Recording stopped');
  };

  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording) {
      interval = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          const minutes = Math.floor(newDuration / 60);
          const seconds = newDuration % 60;
          const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          onDurationUpdate(timeString);
          return newDuration;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, onDurationUpdate]);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-center">iOS Recording Mode</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recording Controls */}
        <div className="flex justify-center space-x-4">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-3"
            >
              <Mic className="h-5 w-5 mr-2" />
              Start Recording Session
            </Button>
          ) : (
            <Button
              onClick={stopRecording}
              variant="destructive"
              className="px-6 py-3"
            >
              <Square className="h-5 w-5 mr-2" />
              Stop Recording Session
            </Button>
          )}
        </div>

        {/* Duration Display */}
        <div className="text-center text-lg font-mono">
          {Math.floor(duration / 60).toString().padStart(2, '0')}:
          {(duration % 60).toString().padStart(2, '0')}
        </div>

        {/* Speech-to-Text Button (only when recording) */}
        {isRecording && (
          <div className="space-y-3">
            <div className="text-center text-sm text-muted-foreground">
              Tap the microphone button below to record individual speech segments
            </div>
            <div className="flex justify-center">
              <SpeechToText
                onTranscription={handleSpeechTranscription}
                size="lg"
                className="h-16 w-16 rounded-full"
              />
            </div>
          </div>
        )}

        {/* Transcript Display */}
        {transcript && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm">Live Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-48 overflow-y-auto text-sm">
                {transcript.split('\n').map((line, index) => (
                  <div key={index} className="mb-1">
                    {line}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg text-sm">
          <div className="font-medium mb-1">How to use iOS Recording:</div>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Start a recording session first</li>
            <li>Use the microphone button to record individual speech segments</li>
            <li>Each segment will be transcribed and added to your meeting notes</li>
            <li>Stop the session when your meeting is complete</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};