import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface RealtimeSpeechToTextProps {
  onTranscription: (text: string, isPartial?: boolean) => void;
  onFinalTranscription?: (text: string) => void;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  placeholder?: string;
}

// Audio encoding utility
const encodeAudioForAPI = (float32Array: Float32Array): string => {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  const uint8Array = new Uint8Array(int16Array.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
};

// Audio recorder class
class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private onAudioData: (audioData: Float32Array) => void) {}

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.audioContext = new AudioContext({
        sampleRate: 24000,
      });
      
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        this.onAudioData(new Float32Array(inputData));
      };
      
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  stop() {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

export const RealtimeSpeechToText: React.FC<RealtimeSpeechToTextProps> = ({ 
  onTranscription, 
  onFinalTranscription,
  className = '',
  size = 'default',
  placeholder = ''
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [accumulatedText, setAccumulatedText] = useState('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);

  const connectWebSocket = useCallback(() => {
    setIsConnecting(true);
    console.log('Connecting to realtime transcription...');
    
    const ws = new WebSocket('wss://dphcnbricafkbtizkoal.functions.supabase.co/realtime-transcription');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnecting(false);
      toast.success('Connected to real-time transcription');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received:', data.type, data);

        if (data.type === 'input_audio_buffer.speech_started') {
          console.log('Speech started detected');
          setCurrentTranscript('');
        }
        
        if (data.type === 'input_audio_buffer.speech_stopped') {
          console.log('Speech stopped detected');
          if (accumulatedText) {
            onFinalTranscription?.(accumulatedText);
            setAccumulatedText('');
          }
        }

        // Handle real-time transcription
        if (data.type === 'conversation.item.input_audio_transcription.completed') {
          const transcript = data.transcript || '';
          console.log('Transcription completed:', transcript);
          
          if (transcript) {
            setCurrentTranscript(transcript);
            setAccumulatedText(prev => prev + ' ' + transcript);
            onTranscription(transcript, false);
          }
        }

        // Handle partial transcriptions if available
        if (data.type === 'conversation.item.input_audio_transcription.delta') {
          const delta = data.delta || '';
          console.log('Transcription delta:', delta);
          
          if (delta) {
            setCurrentTranscript(prev => prev + delta);
            onTranscription(delta, true);
          }
        }

      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnecting(false);
      toast.error('Connection error');
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      setIsConnecting(false);
      wsRef.current = null;
    };
  }, [onTranscription, onFinalTranscription, accumulatedText]);

  const startRecording = useCallback(async () => {
    try {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connectWebSocket();
        // Wait a bit for connection
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const recorder = new AudioRecorder((audioData) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const encodedAudio = encodeAudioForAPI(audioData);
          wsRef.current.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: encodedAudio
          }));
        }
      });

      await recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
      setCurrentTranscript('');
      setAccumulatedText('');
      
      console.log('Recording started');
      toast.success('Recording started - speak now');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording. Please check microphone permissions.');
    }
  }, [connectWebSocket]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    
    setIsRecording(false);
    
    // Send final audio buffer commit
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'input_audio_buffer.commit'
      }));
    }
    
    console.log('Recording stopped');
    toast.info('Processing final transcription...');
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.stop();
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={toggleRecording}
        disabled={isConnecting}
        variant={isRecording ? "destructive" : "outline"}
        size={size}
        className={className}
      >
        {isConnecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        {size !== 'sm' && (
          <span className="ml-2">
            {isConnecting 
              ? 'Connecting...' 
              : isRecording 
                ? 'Stop Recording' 
                : 'Record'
            }
          </span>
        )}
      </Button>
      
      {currentTranscript && (
        <div className="text-xs text-muted-foreground italic">
          Speaking: "{currentTranscript}"
        </div>
      )}
    </div>
  );
};