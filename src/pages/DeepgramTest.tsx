import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { DeepgramRealtimeTranscriber, TranscriptData } from '@/utils/DeepgramRealtimeTranscriber';
import { toast } from 'sonner';

const DeepgramTest = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptData, setTranscriptData] = useState<TranscriptData[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [status, setStatus] = useState('Disconnected');
  const [isLoading, setIsLoading] = useState(false);
  
  const transcriberRef = useRef<DeepgramRealtimeTranscriber | null>(null);

  const onTranscription = (data: TranscriptData) => {
    console.log('Transcription received:', data);
    
    if (data.is_final) {
      setTranscriptData(prev => [...prev, data]);
      setCurrentTranscript('');
    } else {
      setCurrentTranscript(data.text);
    }
  };

  const onError = (error: string) => {
    console.error('Transcription error:', error);
    toast.error(`Error: ${error}`);
    setStatus(`Error: ${error}`);
    setIsRecording(false);
    setIsLoading(false);
  };

  const onStatusChange = (status: string) => {
    console.log('Status changed:', status);
    setStatus(status);
  };

  const onSummary = (summary: string) => {
    console.log('Summary received:', summary);
    toast.success('Summary generated');
  };

  useEffect(() => {
    return () => {
      if (transcriberRef.current) {
        transcriberRef.current.stopTranscription();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setIsLoading(true);
      setStatus('Connecting...');
      
      transcriberRef.current = new DeepgramRealtimeTranscriber(
        onTranscription,
        onError,
        onStatusChange,
        onSummary
      );

      await transcriberRef.current.startTranscription();
      setIsRecording(true);
      setIsLoading(false);
      toast.success('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording');
      setIsLoading(false);
      setStatus('Failed to connect');
    }
  };

  const stopRecording = () => {
    if (transcriberRef.current) {
      transcriberRef.current.stopTranscription();
      setIsRecording(false);
      setStatus('Disconnected');
      toast.success('Recording stopped');
    }
  };

  const clearTranscripts = () => {
    setTranscriptData([]);
    setCurrentTranscript('');
    toast.success('Transcripts cleared');
  };

  return (
    <div className="min-h-screen bg-gradient-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Deepgram Service Test</span>
              <Badge variant={isRecording ? 'default' : 'secondary'}>
                {status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {!isRecording ? (
                <Button
                  onClick={startRecording}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                  {isLoading ? 'Connecting...' : 'Start Recording'}
                </Button>
              ) : (
                <Button
                  onClick={stopRecording}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <MicOff className="w-4 h-4" />
                  Stop Recording
                </Button>
              )}
              
              <Button
                onClick={clearTranscripts}
                variant="outline"
                disabled={transcriptData.length === 0}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Live Transcript */}
        {(isRecording || currentTranscript) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Live Transcript
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted/50 rounded-lg min-h-[60px]">
                <p className="text-muted-foreground italic">
                  {currentTranscript || 'Listening...'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Final Transcripts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Transcription Results</span>
              <Badge variant="outline">
                {transcriptData.length} segments
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {transcriptData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No transcriptions yet. Start recording to see results.
                </p>
              ) : (
                transcriptData.map((data, index) => (
                  <div
                    key={index}
                    className="p-3 bg-card border rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        Segment {index + 1}
                      </Badge>
                      {data.confidence && (
                        <Badge variant="secondary" className="text-xs">
                          {(data.confidence * 100).toFixed(0)}% confidence
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm">{data.text}</p>
                    {data.speaker && (
                      <p className="text-xs text-muted-foreground">
                        Speaker: {data.speaker}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Debug Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Status:</span> {status}
              </div>
              <div>
                <span className="font-medium">Recording:</span> {isRecording ? 'Yes' : 'No'}
              </div>
              <div>
                <span className="font-medium">Total Segments:</span> {transcriptData.length}
              </div>
              <div>
                <span className="font-medium">Total Words:</span>{' '}
                {transcriptData.reduce((acc, data) => acc + data.text.split(' ').length, 0)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DeepgramTest;