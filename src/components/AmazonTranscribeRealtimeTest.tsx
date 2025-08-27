import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Mic, MicOff, Activity, Loader2 } from 'lucide-react';

export const AmazonTranscribeRealtimeTest = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState('');
  
  const websocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const connect = async () => {
    if (isConnected || isConnecting) return;
    
    setIsConnecting(true);
    setConnectionStatus('Connecting to transcription service...');
    
    try {
      // Connect to our WebSocket proxy
      const wsUrl = `wss://dphcnbricafkbtizkoal.functions.supabase.co/amazon-transcribe-websocket`;
      websocketRef.current = new WebSocket(wsUrl);
      
      websocketRef.current.onopen = () => {
        console.log('Connected to WebSocket proxy');
        setConnectionStatus('Connected to proxy, waiting for Amazon Transcribe...');
      };
      
      websocketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connection_status') {
            if (data.status === 'connected') {
              setIsConnected(true);
              setIsConnecting(false);
              setConnectionStatus('Connected to Amazon Transcribe');
              toast.success('Connected to Amazon Transcribe');
            } else if (data.status === 'disconnected') {
              setIsConnected(false);
              setConnectionStatus('Disconnected from Amazon Transcribe');
            }
          } else if (data.type === 'error') {
            toast.error(`Connection error: ${data.message}`);
            setIsConnecting(false);
            setConnectionStatus(`Error: ${data.message}`);
          } else {
            // Handle transcription messages
            handleTranscriptionMessage(data);
          }
        } catch (error) {
          // Might be raw Amazon Transcribe message
          handleTranscriptionMessage(event.data);
        }
      };
      
      websocketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast.error('WebSocket connection failed');
        setIsConnecting(false);
        setConnectionStatus('Connection failed');
      };
      
      websocketRef.current.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        setConnectionStatus('Disconnected');
        if (isRecording) {
          stopRecording();
        }
      };
      
    } catch (error) {
      console.error('Connection error:', error);
      toast.error('Failed to connect');
      setIsConnecting(false);
      setConnectionStatus('Connection failed');
    }
  };

  const disconnect = () => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    
    if (isRecording) {
      stopRecording();
    }
    
    setIsConnected(false);
    setIsConnecting(false);
    setConnectionStatus('Disconnected');
  };

  const handleTranscriptionMessage = (data: any) => {
    try {
      let message = data;
      if (typeof data === 'string') {
        message = JSON.parse(data);
      }
      
      // Handle Amazon Transcribe message format
      if (message.MessageType === 'TranscriptEvent') {
        const transcript = message.Transcript;
        if (transcript && transcript.Results) {
          for (const result of transcript.Results) {
            if (!result.IsPartial && result.Alternatives && result.Alternatives.length > 0) {
              const transcription = result.Alternatives[0].Transcript;
              if (transcription && transcription.trim()) {
                setTranscripts(prev => [...prev, transcription.trim()]);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling transcription:', error);
    }
  };

  const startRecording = async () => {
    if (!isConnected) {
      toast.error('Not connected to transcription service');
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000, // Let browser capture at native rate
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      streamRef.current = stream;
      
      // Create AudioContext for proper audio processing
      audioContextRef.current = new AudioContext({ sampleRate: 48000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Create script processor for audio data
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (event) => {
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
          const inputData = event.inputBuffer.getChannelData(0);
          
          // Downsample from 48kHz to 16kHz
          const downsampled = downsampleTo16kHz(inputData, 48000);
          
          // Convert to PCM 16-bit
          const pcmData = float32ToPCM16(downsampled);
          
          // Create Amazon Transcribe audio event
          const audioEvent = {
            MessageType: 'AudioEvent',
            AudioChunk: Array.from(pcmData)
          };
          
          websocketRef.current.send(JSON.stringify(audioEvent));
        }
      };
      
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
      
      setIsRecording(true);
      toast.success('Recording started');
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording');
    }
  };

  // Helper function to downsample audio from source rate to 16kHz
  const downsampleTo16kHz = (buffer: Float32Array, fromSampleRate: number): Float32Array => {
    if (fromSampleRate === 16000) {
      return buffer;
    }
    
    const sampleRateRatio = fromSampleRate / 16000;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    
    let offsetResult = 0;
    let offsetBuffer = 0;
    
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      
      result[offsetResult] = accum / count;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    
    return result;
  };

  // Helper function to convert Float32Array to PCM 16-bit
  const float32ToPCM16 = (float32Array: Float32Array): Uint8Array => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    
    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(i * 2, intSample, true); // true for little-endian
    }
    
    return new Uint8Array(buffer);
  };

  const stopRecording = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsRecording(false);
    toast.success('Recording stopped');
  };

  const clearTranscripts = () => {
    setTranscripts([]);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Amazon Transcribe Real-time Test
        </CardTitle>
        <CardDescription>
          Test real-time speech-to-text with Amazon Transcribe streaming
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium">Status:</div>
            {isConnecting ? (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Connecting...
              </Badge>
            ) : isConnected ? (
              <Badge variant="default" className="bg-green-500">Connected</Badge>
            ) : (
              <Badge variant="outline">Disconnected</Badge>
            )}
          </div>
          <div className="flex gap-2">
            {!isConnected ? (
              <Button 
                onClick={connect}
                disabled={isConnecting}
                size="sm"
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </Button>
            ) : (
              <Button 
                onClick={disconnect}
                variant="outline"
                size="sm"
              >
                Disconnect
              </Button>
            )}
          </div>
        </div>

        {connectionStatus && (
          <div className="text-sm text-muted-foreground p-2 bg-muted/50 rounded">
            {connectionStatus}
          </div>
        )}

        {/* Recording Controls */}
        <div className="flex items-center gap-3">
          <Button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!isConnected}
            variant={isRecording ? "destructive" : "default"}
            className="flex items-center gap-2"
          >
            {isRecording ? (
              <>
                <MicOff className="w-4 h-4" />
                Stop Recording
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Start Recording
              </>
            )}
          </Button>
          
          {transcripts.length > 0 && (
            <Button onClick={clearTranscripts} variant="outline" size="sm">
              Clear
            </Button>
          )}
        </div>

        {/* Transcripts */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Transcripts</h3>
          <div className="min-h-[200px] p-4 border rounded-lg bg-muted/50">
            {transcripts.length > 0 ? (
              <div className="space-y-2">
                {transcripts.map((transcript, index) => (
                  <div key={index} className="p-2 bg-background rounded border-l-2 border-primary">
                    <div className="text-sm">{transcript}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date().toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {isRecording ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    Listening for speech...
                  </div>
                ) : (
                  'Connect and start recording to see transcripts'
                )}
              </div>
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Connect to the transcription service, then start recording</p>
          <p>• Speak clearly into your microphone for best results</p>
          <p>• Transcripts will appear in real-time as you speak</p>
        </div>
      </CardContent>
    </Card>
  );
};