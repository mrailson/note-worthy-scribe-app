import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Mic, MicOff, Loader2, Wifi, WifiOff, Play, Square, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { WhisperTranscriber, TranscriptData } from '@/utils/WhisperTranscriber';
import { AssemblyAIRealtimeTranscriber } from '@/utils/AssemblyAIRealtimeTranscriber';

interface TranscriptEntry {
  id: string;
  text: string;
  isFinal: boolean;
  timestamp: Date;
  confidence?: number;
  service: 'assemblyai' | 'deepgram' | 'whisper';
}

interface ServiceState {
  isRecording: boolean;
  isConnected: boolean;
  transcripts: TranscriptEntry[];
  fullTranscript: string;
  error: string | null;
  avgConfidence: number | null;
  wordCount: number;
  sessionCount: number;
  sessionStartTime: Date | null;
  timeRemaining: number;
  isReconnecting: boolean;
}

const initialServiceState = (): ServiceState => ({
  isRecording: false,
  isConnected: false,
  transcripts: [],
  fullTranscript: '',
  error: null,
  avgConfidence: null,
  wordCount: 0,
  sessionCount: 0,
  sessionStartTime: null,
  timeRemaining: 0,
  isReconnecting: false,
});

export default function TranscriptionComparison() {
  const [assemblyState, setAssemblyState] = useState<ServiceState>(initialServiceState);
  const [deepgramState, setDeepgramState] = useState<ServiceState>(initialServiceState);
  const [whisperState, setWhisperState] = useState<ServiceState>(initialServiceState);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Refs for services
  const assemblyTranscriberRef = useRef<AssemblyAIRealtimeTranscriber | null>(null);
  const deepgramWsRef = useRef<WebSocket | null>(null);
  const whisperTranscriberRef = useRef<WhisperTranscriber | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // AssemblyAI handlers
  const handleAssemblyTranscript = useCallback((data: any) => {
    console.log('📝 ASSEMBLY: Received transcript data:', data);
    
    const transcriptEntry: TranscriptEntry = {
      id: `assembly-${Date.now()}-${Math.random()}`,
      text: data.text,
      isFinal: data.is_final,
      timestamp: new Date(),
      confidence: data.confidence,
      service: 'assemblyai'
    };

    setAssemblyState(prev => ({
      ...prev,
      transcripts: [...prev.transcripts, transcriptEntry],
      fullTranscript: data.is_final ? 
        (prev.fullTranscript + (prev.fullTranscript ? ' ' : '') + data.text) : 
        prev.fullTranscript,
      wordCount: data.is_final ? 
        (prev.fullTranscript + ' ' + data.text).split(' ').filter(w => w.trim()).length :
        prev.wordCount,
      avgConfidence: data.confidence ? 
        (prev.avgConfidence ? (prev.avgConfidence + data.confidence) / 2 : data.confidence) :
        prev.avgConfidence
    }));
  }, []);

  const handleAssemblyError = useCallback((error: string) => {
    console.error('❌ ASSEMBLY: Error:', error);
    setAssemblyState(prev => ({ ...prev, error }));
  }, []);

  const handleAssemblyStatus = useCallback((status: string) => {
    console.log('📊 ASSEMBLY: Status change:', status);
    setAssemblyState(prev => ({ 
      ...prev, 
      isConnected: status === 'connected' || status === 'recording',
      isRecording: status === 'recording'
    }));
  }, []);

  // Deepgram handlers
  const handleDeepgramTranscript = useCallback((data: any) => {
    if (data.channel?.alternatives?.[0]?.transcript) {
      const transcript = data.channel.alternatives[0].transcript;
      const confidence = data.channel.alternatives[0].confidence;
      
      const transcriptEntry: TranscriptEntry = {
        id: `deepgram-${Date.now()}-${Math.random()}`,
        text: transcript,
        isFinal: data.is_final,
        timestamp: new Date(),
        confidence: confidence,
        service: 'deepgram'
      };

      setDeepgramState(prev => ({
        ...prev,
        transcripts: [...prev.transcripts, transcriptEntry],
        fullTranscript: data.is_final ? 
          (prev.fullTranscript + (prev.fullTranscript ? ' ' : '') + transcript) : 
          prev.fullTranscript,
        wordCount: data.is_final ? 
          (prev.fullTranscript + ' ' + transcript).split(' ').filter(w => w.trim()).length :
          prev.wordCount,
        avgConfidence: confidence ? 
          (prev.avgConfidence ? (prev.avgConfidence + confidence) / 2 : confidence) :
          prev.avgConfidence
      }));
    }
  }, []);

  // Whisper handlers
  const handleWhisperTranscript = useCallback((data: TranscriptData) => {
    const transcriptEntry: TranscriptEntry = {
      id: `whisper-${Date.now()}-${Math.random()}`,
      text: data.text,
      isFinal: data.is_final,
      timestamp: new Date(),
      confidence: data.confidence,
      service: 'whisper'
    };

    setWhisperState(prev => ({
      ...prev,
      transcripts: [...prev.transcripts, transcriptEntry],
      fullTranscript: prev.fullTranscript + (prev.fullTranscript ? ' ' : '') + data.text,
      wordCount: (prev.fullTranscript + ' ' + data.text).split(' ').filter(w => w.trim()).length,
      avgConfidence: data.confidence ? 
        (prev.avgConfidence ? (prev.avgConfidence + data.confidence) / 2 : data.confidence) :
        prev.avgConfidence
    }));
  }, []);

  const handleWhisperError = useCallback((error: string) => {
    setWhisperState(prev => ({ ...prev, error }));
  }, []);

  const handleWhisperStatus = useCallback((status: string) => {
    setWhisperState(prev => ({ 
      ...prev, 
      isConnected: status === 'Recording',
      isRecording: status === 'Recording'
    }));
  }, []);

  // Initialize services
  const initializeServices = useCallback(() => {
    console.log('🔧 Initializing services...');
    
    // Initialize AssemblyAI
    if (!assemblyTranscriberRef.current) {
      console.log('🔧 Creating new AssemblyAI transcriber...');
      assemblyTranscriberRef.current = new AssemblyAIRealtimeTranscriber(
        handleAssemblyTranscript,
        handleAssemblyError,
        handleAssemblyStatus
      );
      console.log('✅ AssemblyAI transcriber created');
    } else {
      console.log('ℹ️ AssemblyAI transcriber already exists');
    }

    // Initialize Whisper
    if (!whisperTranscriberRef.current) {
      console.log('🔧 Creating new Whisper transcriber...');
      whisperTranscriberRef.current = new WhisperTranscriber(
        handleWhisperTranscript,
        handleWhisperError,
        handleWhisperStatus
      );
      console.log('✅ Whisper transcriber created');
    } else {
      console.log('ℹ️ Whisper transcriber already exists');
    }
    
    console.log('✅ All services initialized');
  }, [handleAssemblyTranscript, handleAssemblyError, handleAssemblyStatus, handleWhisperTranscript, handleWhisperError, handleWhisperStatus]);

  // Start individual services
  const startAssemblyAI = useCallback(async () => {
    try {
      console.log('🚀 ASSEMBLY: Starting AssemblyAI service...');
      initializeServices();
      setAssemblyState(prev => ({ 
        ...prev, 
        error: null, 
        sessionStartTime: new Date(), 
        sessionCount: 1,
        isConnected: false,
        isRecording: false
      }));
      
      if (assemblyTranscriberRef.current) {
        console.log('📡 ASSEMBLY: Calling startTranscription...');
        await assemblyTranscriberRef.current.startTranscription();
        console.log('✅ ASSEMBLY: StartTranscription completed');
      } else {
        throw new Error('AssemblyAI transcriber not initialized');
      }
    } catch (error) {
      console.error('❌ ASSEMBLY: Start error:', error);
      handleAssemblyError(error instanceof Error ? error.message : 'Failed to start AssemblyAI');
    }
  }, [initializeServices, handleAssemblyError]);

  const startDeepgram = useCallback(async () => {
    try {
      setDeepgramState(prev => ({ ...prev, error: null, sessionStartTime: new Date(), sessionCount: 1 }));
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      mediaStreamRef.current = stream;

      // Connect to Deepgram via new streaming edge function
      const ws = new WebSocket(`wss://dphcnbricafkbtizkoal.supabase.co/functions/v1/deepgram-streaming`);
      deepgramWsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ DEEPGRAM: WebSocket connected');
        setDeepgramState(prev => ({ ...prev, isConnected: true }));
        
        // Send initial configuration
        ws.send(JSON.stringify({
          type: 'session.start',
          sample_rate: 24000,
          channels: 1
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 DEEPGRAM: Received message:', data.type || data.type);
          
          // Handle session begins
          if (data.type === 'session_begins') {
            console.log('✅ DEEPGRAM: Session started successfully');
            setDeepgramState(prev => ({ ...prev, isRecording: true }));
            return;
          }
          
          // Handle errors
          if (data.type === 'error') {
            console.error('❌ DEEPGRAM: Error:', data.error);
            setDeepgramState(prev => ({ ...prev, error: `Deepgram error: ${data.error}` }));
            return;
          }
          
          // Handle session termination
          if (data.type === 'session_terminated') {
            console.log('🔌 DEEPGRAM: Session terminated:', data.code, data.reason);
            setDeepgramState(prev => ({ ...prev, error: `Session ended: ${data.reason || 'Connection closed'}`, isRecording: false, isConnected: false }));
            return;
          }
          
          // Handle transcription results
          if (data.channel?.alternatives?.[0]?.transcript) {
            handleDeepgramTranscript(data);
          }
        } catch (error) {
          console.error('Deepgram message parse error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ DEEPGRAM: WebSocket error:', error);
        setDeepgramState(prev => ({ ...prev, error: 'Deepgram connection error' }));
      };

      ws.onclose = (event) => {
        console.log('🔌 DEEPGRAM: WebSocket closed:', event.code, event.reason);
        setDeepgramState(prev => ({ ...prev, isConnected: false, isRecording: false }));
        if (event.code !== 1000) {
          setDeepgramState(prev => ({ ...prev, error: `Connection failed (Code: ${event.code}): ${event.reason || 'Unknown reason'}` }));
        }
      };

      // Setup audio processing for Deepgram
      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (event) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = event.inputBuffer.getChannelData(0);
          
          // Calculate audio level
          const sum = inputData.reduce((acc, val) => acc + Math.abs(val), 0);
          const level = Math.min(100, (sum / inputData.length) * 1000);
          setAudioLevel(level);
          
          // Convert to 16-bit PCM for Deepgram
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          ws.send(pcm16.buffer);
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);

    } catch (error) {
      setDeepgramState(prev => ({ ...prev, error: error instanceof Error ? error.message : 'Failed to start Deepgram' }));
    }
  }, [handleDeepgramTranscript]);

  const startWhisper = useCallback(async () => {
    try {
      initializeServices();
      setWhisperState(prev => ({ ...prev, error: null, sessionStartTime: new Date(), sessionCount: 1 }));
      await whisperTranscriberRef.current?.startTranscription();
    } catch (error) {
      handleWhisperError(error instanceof Error ? error.message : 'Failed to start Whisper');
    }
  }, [initializeServices]);

  // Stop individual services
  const stopAssemblyAI = useCallback(() => {
    console.log('🛑 ASSEMBLY: Stopping AssemblyAI service...');
    try {
      assemblyTranscriberRef.current?.stopTranscription();
      setAssemblyState(prev => ({ 
        ...prev, 
        isRecording: false, 
        isConnected: false, 
        timeRemaining: 0, 
        isReconnecting: false 
      }));
      console.log('✅ ASSEMBLY: Service stopped');
    } catch (error) {
      console.error('❌ ASSEMBLY: Stop error:', error);
    }
  }, []);

  const stopDeepgram = useCallback(() => {
    if (deepgramWsRef.current) {
      deepgramWsRef.current.close();
      deepgramWsRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setDeepgramState(prev => ({ ...prev, isRecording: false, isConnected: false }));
    setAudioLevel(0);
  }, []);

  const stopWhisper = useCallback(() => {
    whisperTranscriberRef.current?.stopTranscription();
    setWhisperState(prev => ({ ...prev, isRecording: false, isConnected: false }));
  }, []);

  // Run all services
  const runAllServices = useCallback(async () => {
    console.log('🚀 Starting all transcription services...');
    setIsRunningAll(true);
    try {
      // Start services with delays to avoid conflicts
      console.log('Starting AssemblyAI...');
      await startAssemblyAI();
      
      console.log('Starting Deepgram...');
      await startDeepgram();
      
      console.log('Starting Whisper...');
      await startWhisper();
      
      console.log('✅ All services started successfully');
    } catch (error) {
      console.error('❌ Error starting all services:', error);
      setIsRunningAll(false);
    }
  }, [startAssemblyAI, startDeepgram, startWhisper]);

  const stopAllServices = useCallback(() => {
    console.log('🛑 Stopping all transcription services...');
    setIsRunningAll(false);
    stopAssemblyAI();
    stopDeepgram();
    stopWhisper();
    console.log('✅ All services stopped');
  }, [stopAssemblyAI, stopDeepgram, stopWhisper]);

  // Clear functions
  const clearService = (service: 'assemblyai' | 'deepgram' | 'whisper') => {
    const clearState = {
      transcripts: [],
      fullTranscript: '',
      error: null,
      avgConfidence: null,
      wordCount: 0,
      sessionCount: 0,
      sessionStartTime: null,
    };

    switch (service) {
      case 'assemblyai':
        setAssemblyState(prev => ({ ...prev, ...clearState }));
        break;
      case 'deepgram':
        setDeepgramState(prev => ({ ...prev, ...clearState }));
        break;
      case 'whisper':
        setWhisperState(prev => ({ ...prev, ...clearState }));
        break;
    }
  };

  const clearAllServices = () => {
    clearService('assemblyai');
    clearService('deepgram');
    clearService('whisper');
  };

  // Utility functions
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTotalSessionTime = (startTime: Date | null): string => {
    if (!startTime) return '0:00';
    const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
    return formatTime(elapsed);
  };

  const getServiceStatus = (state: ServiceState) => {
    if (state.isReconnecting) return { text: 'Reconnecting...', color: 'bg-yellow-500' };
    if (state.isConnected) return { text: 'Connected', color: 'bg-green-500' };
    return { text: 'Disconnected', color: 'bg-red-500' };
  };

  const ServiceCard = ({ 
    title, 
    state, 
    onStart, 
    onStop, 
    onClear, 
    color 
  }: { 
    title: string;
    state: ServiceState;
    onStart: () => void;
    onStop: () => void;
    onClear: () => void;
    color: string;
  }) => {
    const status = getServiceStatus(state);
    
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className={`text-lg font-semibold ${color}`}>{title}</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${status.color}`}></div>
              <span className="text-sm text-muted-foreground">{status.text}</span>
            </div>
          </CardTitle>
          <CardDescription className="flex items-center gap-4 text-xs">
            {state.sessionStartTime && (
              <span>Time: {getTotalSessionTime(state.sessionStartTime)}</span>
            )}
            {state.wordCount > 0 && (
              <span>Words: {state.wordCount}</span>
            )}
            {state.avgConfidence !== null && (
              <span>Conf: {(state.avgConfidence * 100).toFixed(1)}%</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={state.isRecording ? onStop : onStart}
              disabled={state.isReconnecting}
              className="flex-1"
              variant={state.isRecording ? "destructive" : "default"}
            >
              {state.isReconnecting ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : state.isRecording ? (
                <Square className="w-4 h-4 mr-1" />
              ) : (
                <Play className="w-4 h-4 mr-1" />
              )}
              {state.isReconnecting ? 'Reconnecting' : state.isRecording ? 'Stop' : 'Start'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onClear}
              disabled={state.transcripts.length === 0}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>

          {state.error && (
            <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
              {state.error}
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-medium">Full Transcript:</div>
            <div className="text-xs bg-muted/30 p-2 rounded max-h-24 overflow-y-auto">
              {state.fullTranscript || 'No transcript yet...'}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium">Recent ({state.transcripts.length}):</div>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {state.transcripts.slice(-3).map((transcript) => (
                <div key={transcript.id} className="text-xs p-1 bg-muted/20 rounded">
                  <div className="flex items-center gap-1 mb-1">
                    <Badge variant={transcript.isFinal ? "default" : "secondary"} className="text-[10px] px-1 py-0">
                      {transcript.isFinal ? "Final" : "Partial"}
                    </Badge>
                    {transcript.confidence !== undefined && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {(transcript.confidence * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px]">{transcript.text}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Transcription Service Comparison
        </h1>
        <p className="text-muted-foreground mt-2">
          Compare AssemblyAI, Deepgram, and Whisper real-time transcription services
        </p>
      </div>

      {/* Master Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Master Controls
          </CardTitle>
          <CardDescription>
            Control all transcription services simultaneously or individually
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4">
            <div className="text-center text-sm text-muted-foreground mb-2">
              <p>🚀 <strong>Navigate to:</strong> <code>/transcription-comparison</code></p>
              <p>Or click the button below to access the comparison interface</p>
            </div>
            
            <Button
              onClick={() => window.location.href = '/transcription-comparison'}
              variant="default"
              size="lg"
              className="mb-4"
            >
              🔄 Go to Service Comparison
            </Button>
            {/* Audio Level Indicator */}
            {(assemblyState.isRecording || deepgramState.isRecording || whisperState.isRecording) && (
              <div className="w-full max-w-xs">
                <div className="text-xs text-muted-foreground mb-1">Audio Level</div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-100"
                    style={{ width: `${audioLevel}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="flex gap-4 flex-wrap justify-center">
              <Button
                size="lg"
                onClick={isRunningAll ? stopAllServices : runAllServices}
                disabled={assemblyState.isReconnecting || deepgramState.isReconnecting || whisperState.isReconnecting}
                className="min-w-[150px]"
                variant={isRunningAll ? "destructive" : "default"}
              >
                {isRunningAll ? (
                  <>
                    <MicOff className="w-4 h-4 mr-2" />
                    Stop All Services
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 mr-2" />
                    Run All Services
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={clearAllServices}
                disabled={
                  assemblyState.transcripts.length === 0 && 
                  deepgramState.transcripts.length === 0 && 
                  whisperState.transcripts.length === 0
                }
              >
                Clear All Transcripts
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ServiceCard
          title="AssemblyAI"
          state={assemblyState}
          onStart={startAssemblyAI}
          onStop={stopAssemblyAI}
          onClear={() => clearService('assemblyai')}
          color="text-blue-600"
        />
        
        <ServiceCard
          title="Deepgram"
          state={deepgramState}
          onStart={startDeepgram}
          onStop={stopDeepgram}
          onClear={() => clearService('deepgram')}
          color="text-green-600"
        />
        
        <ServiceCard
          title="Whisper"
          state={whisperState}
          onStart={startWhisper}
          onStop={stopWhisper}
          onClear={() => clearService('whisper')}
          color="text-purple-600"
        />
      </div>

      {/* Instructions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>How to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• <strong>Run All Services:</strong> Start all three transcription services simultaneously to compare their performance</p>
          <p>• <strong>Individual Controls:</strong> Use the Start/Stop buttons on each service card to test them individually</p>
          <p>• <strong>Full Transcript:</strong> See the complete consolidated transcript for each service</p>
          <p>• <strong>Recent Activity:</strong> View the most recent transcription results with confidence scores</p>
          <p>• <strong>Performance Metrics:</strong> Compare word count, confidence levels, and session duration across services</p>
        </CardContent>
      </Card>
    </div>
  );
}