import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Mic, MicOff, Square, Play, Pause } from 'lucide-react';

interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
  speaker?: string;
}

export const DeepgramLiveTest = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState('Stopped');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const connectWebSocket = async () => {
    try {
      setStatus('Connecting...');
      
      // Get Deepgram token from edge function
      const tokenResponse = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/deepgram-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get Deepgram token');
      }

      const { token } = await tokenResponse.json();

      // Connect to Deepgram
      const websocket = new WebSocket(
        'wss://api.deepgram.com/v1/listen?' +
        new URLSearchParams({
          model: 'nova-2-medical',
          language: 'en-GB',
          smart_format: 'true',
          interim_results: 'true',
          endpointing: '300',
          vad_events: 'true'
        })
      );

      websocket.onopen = () => {
        console.log('✅ Deepgram WebSocket connected');
        setStatus('Connected');
        setWs(websocket);
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.channel?.alternatives?.[0]?.transcript) {
            const transcriptText = data.channel.alternatives[0].transcript;
            const confidence = data.channel.alternatives[0].confidence || 0;
            const isFinal = data.is_final;
            
            console.log('📝 Deepgram transcript:', { transcriptText, confidence, isFinal });
            
            if (transcriptText.trim()) {
              setTranscript(prev => {
                if (isFinal) {
                  return prev + ' ' + transcriptText;
                } else {
                  // For interim results, replace the last interim part
                  const parts = prev.split(' ');
                  return parts.slice(0, -1).join(' ') + ' ' + transcriptText;
                }
              });
            }
          }
        } catch (error) {
          console.error('❌ Error parsing Deepgram message:', error);
        }
      };

      websocket.onerror = (error) => {
        console.error('❌ Deepgram WebSocket error:', error);
        setStatus('Error');
        toast.error('Deepgram connection error');
      };

      websocket.onclose = () => {
        console.log('🔌 Deepgram WebSocket closed');
        setStatus('Disconnected');
        setWs(null);
      };

      // Send auth message
      websocket.send(JSON.stringify({
        type: 'auth',
        token: token
      }));

    } catch (error) {
      console.error('❌ Failed to connect to Deepgram:', error);
      setStatus('Error');
      toast.error('Failed to connect to Deepgram: ' + (error as Error).message);
    }
  };

  const startRecording = async () => {
    try {
      console.log('🎙️ Starting Deepgram live recording...');
      
      if (!ws) {
        await connectWebSocket();
        return;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      setStream(mediaStream);

      const recorder = new MediaRecorder(mediaStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(event.data);
        }
      };

      setMediaRecorder(recorder);
      recorder.start(100); // Send data every 100ms
      setIsRecording(true);
      setStatus('Recording');
      toast.success('Recording started');

    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      setStatus('Error');
      toast.error('Failed to start recording: ' + (error as Error).message);
    }
  };

  const stopRecording = () => {
    console.log('🛑 Stopping Deepgram recording...');
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    if (ws) {
      ws.close();
      setWs(null);
    }

    setIsRecording(false);
    setMediaRecorder(null);
    setStatus('Stopped');
    toast.success('Recording stopped');
  };

  const clearTranscript = () => {
    setTranscript('');
    toast.success('Transcript cleared');
  };

  useEffect(() => {
    return () => {
      if (ws) {
        ws.close();
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'Recording': return 'bg-green-500';
      case 'Connected': return 'bg-blue-500';
      case 'Connecting...': return 'bg-yellow-500';
      case 'Error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Deepgram Live Transcription Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Badge className={`${getStatusColor()} text-white`}>
            {status}
          </Badge>
          
          <div className="flex gap-2">
            {isRecording ? (
              <Button onClick={stopRecording} variant="destructive" size="sm">
                <Square className="h-4 w-4 mr-2" />
                Stop Recording
              </Button>
            ) : (
              <Button onClick={startRecording} variant="default" size="sm">
                <Mic className="h-4 w-4 mr-2" />
                Start Recording
              </Button>
            )}
            
            <Button onClick={clearTranscript} variant="outline" size="sm">
              Clear
            </Button>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="font-medium mb-2">Live Transcript:</h4>
          <div className="min-h-[200px] p-4 border rounded-lg bg-muted/50">
            {transcript ? (
              <p className="text-sm whitespace-pre-wrap">{transcript}</p>
            ) : (
              <p className="text-muted-foreground text-sm">
                {isRecording ? 'Listening for speech...' : 'Click "Start Recording" to begin'}
              </p>
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          <p>• Uses Deepgram Nova-2 Medical model for healthcare terminology</p>
          <p>• Real-time streaming with interim results</p>
          <p>• Optimized for medical conversations and consultations</p>
        </div>
      </CardContent>
    </Card>
  );
};