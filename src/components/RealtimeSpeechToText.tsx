import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface RealtimeSpeechToTextProps {
  onTranscription: (text: string, isPartial?: boolean) => void;
  onFinalTranscription?: (text: string) => void;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  placeholder?: string;
}

class VoiceActivityDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private isRunning = false;
  
  constructor(
    private onSpeechStart: () => void,
    private onSpeechEnd: () => void,
    private threshold = 0.01
  ) {}

  async start(stream: MediaStream) {
    this.stream = stream;
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    
    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.analyser);
    
    this.isRunning = true;
    this.detectVoiceActivity();
  }

  stop() {
    this.isRunning = false;
    if (this.audioContext) {
      this.audioContext.close();
    }
  }

  private detectVoiceActivity() {
    if (!this.analyser || !this.isRunning) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let isSpeaking = false;
    let speechStartTime = 0;
    let silenceStartTime = 0;

    const check = () => {
      if (!this.analyser || !this.isRunning) return;

      this.analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const volume = average / 255;
      
      const currentlySpeaking = volume > this.threshold;
      
      if (currentlySpeaking && !isSpeaking) {
        isSpeaking = true;
        speechStartTime = Date.now();
        this.onSpeechStart();
      } else if (!currentlySpeaking && isSpeaking) {
        if (silenceStartTime === 0) {
          silenceStartTime = Date.now();
        } else if (Date.now() - silenceStartTime > 1000) { // 1 second of silence
          isSpeaking = false;
          silenceStartTime = 0;
          this.onSpeechEnd();
        }
      } else if (currentlySpeaking && isSpeaking) {
        silenceStartTime = 0; // Reset silence timer if speech resumes
      }
      
      requestAnimationFrame(check);
    };

    check();
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
  const [isProcessing, setIsProcessing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const processingTimeoutRef = useRef<number | null>(null);

  const processAudio = useCallback(async (audioBlob: Blob) => {
    if (isProcessing || audioBlob.size === 0) return;
    
    setIsProcessing(true);
    console.log('Processing audio chunk, size:', audioBlob.size);
    
    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Audio = btoa(binary);

      console.log('Sending to speech-to-text...');
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio }
      });

      if (error) {
        console.error('Transcription error:', error);
        throw error;
      }

      if (data?.text && data.text.trim()) {
        const text = data.text.trim();
        console.log('Transcription result:', text);
        
        setCurrentTranscript(text);
        onTranscription(text, false);
        
        setAccumulatedText(prev => {
          const newText = prev ? prev + ' ' + text : text;
          onFinalTranscription?.(newText);
          return newText;
        });
      } else {
        console.log('No speech detected in audio chunk');
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      toast.error('Failed to process audio');
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, onTranscription, onFinalTranscription]);

  const handleSpeechStart = useCallback(() => {
    console.log('Speech started - beginning recording');
    setCurrentTranscript('');
    
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
    
    // Start fresh recording
    audioChunksRef.current = [];
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
      mediaRecorderRef.current.start(100); // Collect data every 100ms
    }
  }, []);

  const handleSpeechEnd = useCallback(() => {
    console.log('Speech ended - will process in 1 second');
    
    // Stop recording and process after a short delay
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setIsConnecting(true);
      console.log('Starting voice activity detection...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;

      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
      };

      // Setup Voice Activity Detector
      vadRef.current = new VoiceActivityDetector(
        handleSpeechStart,
        handleSpeechEnd,
        0.01 // threshold
      );

      await vadRef.current.start(stream);
      
      setIsRecording(true);
      setIsConnecting(false);
      setCurrentTranscript('');
      setAccumulatedText('');
      
      console.log('Voice detection started');
      toast.success('Recording started - speak naturally');
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsConnecting(false);
      toast.error('Failed to start recording. Please check microphone permissions.');
    }
  }, [handleSpeechStart, handleSpeechEnd, processAudio]);

  const stopRecording = useCallback(() => {
    console.log('Stopping recording...');
    
    if (vadRef.current) {
      vadRef.current.stop();
      vadRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
    
    setIsRecording(false);
    setCurrentTranscript('');
    toast.info('Recording stopped');
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
      if (vadRef.current) {
        vadRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
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
      
      {accumulatedText && (
        <div className="text-xs text-foreground bg-muted p-2 rounded">
          Final: "{accumulatedText}"
        </div>
      )}
    </div>
  );
};