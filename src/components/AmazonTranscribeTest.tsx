import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Mic, MicOff, Loader2, Activity } from 'lucide-react';
import { AmazonTranscriber } from '@/utils/AmazonTranscriber';

export const AmazonTranscribeTest = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [transcriber, setTranscriber] = useState<AmazonTranscriber | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleStartTest = async () => {
    try {
      setIsConnecting(true);
      setConnectionStatus('connecting');
      
      const newTranscriber = new AmazonTranscriber({
        onTranscription: (text: string) => {
          setTranscription(prev => prev + text + ' ');
        },
        onError: (error: string) => {
          console.error('Transcription error:', error);
          toast.error(`Transcription error: ${error}`);
          setConnectionStatus('error');
          setIsRecording(false);
        },
        onConnectionChange: (connected: boolean) => {
          if (connected) {
            setConnectionStatus('connected');
            setIsConnecting(false);
            toast.success('Connected to Amazon Transcribe');
            startAudioRecording();
          } else {
            setConnectionStatus('disconnected');
            setIsRecording(false);
            stopAudioRecording();
          }
        }
      });

      await newTranscriber.connect();
      setTranscriber(newTranscriber);
      
    } catch (error) {
      console.error('Failed to start Amazon Transcribe:', error);
      toast.error('Failed to start Amazon Transcribe test');
      setConnectionStatus('error');
      setIsConnecting(false);
    }
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          // Convert blob to ArrayBuffer and send to transcriber
          event.data.arrayBuffer().then(buffer => {
            if (transcriber && transcriber.isConnectedToService()) {
              transcriber.sendAudioData(buffer);
            }
          });
        }
      };

      mediaRecorder.start(100); // Send data every 100ms
      setIsRecording(true);
      
    } catch (error) {
      console.error('Failed to start audio recording:', error);
      toast.error('Failed to access microphone');
      setConnectionStatus('error');
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleStopTest = () => {
    if (transcriber) {
      transcriber.disconnect();
      setTranscriber(null);
    }
    stopAudioRecording();
    setIsRecording(false);
    setConnectionStatus('disconnected');
    toast.success('Amazon Transcribe test stopped');
  };

  const handleClearTranscription = () => {
    setTranscription('');
  };

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge variant="default" className="bg-green-500">Connected</Badge>;
      case 'connecting':
        return <Badge variant="secondary">Connecting...</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Disconnected</Badge>;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Amazon Transcribe Test
          </CardTitle>
          <CardDescription>
            Test Amazon Transcribe real-time transcription service
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => setIsOpen(true)}
            className="w-full"
          >
            <Activity className="w-4 h-4 mr-2" />
            Open Amazon Transcribe Tester
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Amazon Transcribe Test
            </DialogTitle>
            <DialogDescription>
              Test the Amazon Transcribe integration with real-time speech-to-text
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Status and Controls */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium">Status:</div>
                {getStatusBadge()}
              </div>
              <div className="flex gap-2">
                {!isRecording ? (
                  <Button 
                    onClick={handleStartTest}
                    disabled={isConnecting}
                    className="flex items-center gap-2"
                  >
                    {isConnecting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                    {isConnecting ? 'Connecting...' : 'Start Test'}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleStopTest}
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    <MicOff className="w-4 h-4" />
                    Stop Test
                  </Button>
                )}
                <Button 
                  onClick={handleClearTranscription}
                  variant="outline"
                  disabled={!transcription}
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Transcription Output */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Real-time Transcription</h3>
                <Badge variant="secondary">
                  {transcription.split(' ').filter(word => word.length > 0).length} words
                </Badge>
              </div>
              <div className="min-h-[200px] p-4 border rounded-lg bg-muted/50">
                {transcription ? (
                  <p className="text-sm leading-relaxed">{transcription}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {isRecording 
                      ? 'Speak into your microphone to see transcription...' 
                      : 'Click "Start Test" and begin speaking to test Amazon Transcribe'
                    }
                  </p>
                )}
              </div>
            </div>

            {/* Test Information */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• This test uses AWS Transcribe Streaming for real-time transcription</p>
              <p>• Requires microphone permission and AWS credentials configuration</p>
              <p>• Transcription results are processed through Supabase edge functions</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};