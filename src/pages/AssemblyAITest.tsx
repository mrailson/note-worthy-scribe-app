import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Mic, MicOff, Loader2, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TranscriptEntry {
  id: string;
  text: string;
  isFinal: boolean;
  timestamp: Date;
}

export default function AssemblyAITest() {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const getAssemblyToken = async () => {
    try {
      console.log('Requesting AssemblyAI token...');
      const { data, error } = await supabase.functions.invoke('assemblyai-realtime-token', {
        method: 'GET'
      });
      console.log('Token response:', { data, error });
      
      if (error) {
        console.error('Token request error:', error);
        throw new Error(`Token request failed: ${error.message}`);
      }
      
      if (!data?.token) {
        console.error('No token in response:', data);
        throw new Error('No token received from server');
      }
      
      console.log('Token received successfully, length:', data.token.length);
      return data.token;
    } catch (err) {
      console.error('getAssemblyToken error:', err);
      throw new Error(`Token error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const startRecording = useCallback(async () => {
    console.log('=== START RECORDING FUNCTION CALLED ===');
    
    try {
      setError(null);
      console.log('State cleared, requesting token...');
      
      // Get token
      const token = await getAssemblyToken();
      console.log('Token received, length:', token ? token.length : 'null');
      
      // Get microphone access
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      console.log('Microphone access granted');
      
      mediaStreamRef.current = stream;
      
      // Setup WebSocket through Supabase proxy (CSP compliant)
      const wsUrl = `wss://dphcnbricafkbtizkoal.functions.supabase.co/assemblyai-realtime`;
      console.log('PROXY: Connecting via Supabase WebSocket proxy:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('PROXY: Connected to Supabase WebSocket proxy');
        
        // Send session configuration to start AssemblyAI connection
        const sessionConfig = {
          type: 'session.start',
          sample_rate: 16000,
          format_turns: true
        };
        console.log('PROXY: Sending session config:', sessionConfig);
        ws.send(JSON.stringify(sessionConfig));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('PROXY: Received message:', data.type || data.message_type);
          
          // Handle session begins
          if (data.type === 'session_begins') {
            console.log('PROXY: AssemblyAI session started successfully');
            setIsConnected(true);
            setIsRecording(true);
            return;
          }
          
          // Handle errors
          if (data.type === 'error') {
            console.error('PROXY: AssemblyAI error:', data.error);
            setError(`AssemblyAI error: ${data.error}`);
            return;
          }
          
          // Handle transcription results
          if (data.type === 'Turn' || data.message_type === 'PartialTranscript' || data.message_type === 'FinalTranscript') {
            const text = data.formatted?.text || data.text || '';
            if (text.trim()) {
              setTranscripts(prev => {
                const newEntry: TranscriptEntry = {
                  id: `${Date.now()}-${Math.random()}`,
                  text: text,
                  isFinal: data.is_final !== false,
                  timestamp: new Date()
                };
                
                // Replace last partial with final, or add new
                if (data.is_final !== false) {
                  // Final transcript - replace any partial with same text or add new
                  const withoutPartial = prev.filter(t => t.isFinal || t.text !== text);
                  return [...withoutPartial, newEntry];
                } else {
                  // Partial transcript - replace previous partial or add new
                  const withoutPreviousPartial = prev.filter(t => t.isFinal);
                  return [...withoutPreviousPartial, newEntry];
                }
              });
            }
          }
        } catch (err) {
          console.error('Message parse error:', err);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error details:', error);
        console.error('WebSocket readyState:', ws.readyState);
        setError(`WebSocket connection error - Ready State: ${ws.readyState}`);
      };
      
      ws.onclose = (event) => {
        console.log('WebSocket closed:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        setIsConnected(false);
        setIsRecording(false);
        if (event.code !== 1000) {
          const errorMsg = `Connection failed (Code: ${event.code}): ${event.reason || 'Unknown reason'}`;
          console.error(errorMsg);
          setError(errorMsg);
        }
      };
      
      // Setup audio processing
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      processor.onaudioprocess = (event) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = event.inputBuffer.getChannelData(0);
          
          // Calculate audio level for visualization
          const sum = inputData.reduce((acc, val) => acc + Math.abs(val), 0);
          const level = Math.min(100, (sum / inputData.length) * 1000);
          setAudioLevel(level);
          
          // Convert to 16-bit PCM
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
      
    } catch (err) {
      console.error('Start recording error:', err);
      console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    try {
      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close(1000, 'User stopped recording');
        wsRef.current = null;
      }
      
      // Stop audio
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      
      // Clean up audio context
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      setIsRecording(false);
      setIsConnected(false);
      setAudioLevel(0);
    } catch (err) {
      console.error('Stop recording error:', err);
    }
  }, []);

  const clearTranscripts = () => {
    setTranscripts([]);
    setError(null);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            AssemblyAI Real-time Test
          </h1>
          <p className="text-muted-foreground mt-2">
            Test AssemblyAI's real-time speech-to-text capabilities
          </p>
          <div className="mt-4">
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/assemblyai-test-simple'}
            >
              Go to Diagnostic Mode
            </Button>
          </div>
        </div>

      {/* Control Panel */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Recording Controls
          </CardTitle>
          <CardDescription>
            Start recording to see real-time transcription results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-4">
              <Badge variant={isConnected ? "default" : "secondary"} className="flex items-center gap-2">
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
              
              {isRecording && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-muted-foreground">Recording</span>
                </div>
              )}
            </div>

            {/* Audio Level Indicator */}
            {isRecording && (
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

            <div className="flex gap-4">
              <Button 
                size="lg"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isRecording && !isConnected}
                className="min-w-[120px]"
              >
                {isRecording ? (
                  <>
                    <MicOff className="w-4 h-4 mr-2" />
                    Stop
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 mr-2" />
                    Start
                  </>
                )}
              </Button>
              
              <Button variant="outline" onClick={clearTranscripts}>
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="mb-6 border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="text-destructive">
              <strong>Error:</strong> {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transcript Display */}
      <Card>
        <CardHeader>
          <CardTitle>Live Transcript</CardTitle>
          <CardDescription>
            Real-time and final transcription results from AssemblyAI
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transcripts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mic className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Start recording to see transcripts appear here...</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {transcripts.map((transcript) => (
                <div key={transcript.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <Badge variant={transcript.isFinal ? "default" : "secondary"}>
                    {transcript.isFinal ? "Final" : "Partial"}
                  </Badge>
                  <div className="flex-1">
                    <p className={`${transcript.isFinal ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                      {transcript.text}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {transcript.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="mt-6 bg-muted/30">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">Instructions:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Click "Start" to begin real-time transcription</li>
            <li>• Speak clearly into your microphone</li>
            <li>• Partial results will appear in real-time, final results are more accurate</li>
            <li>• Click "Stop" to end the session</li>
            <li>• Use "Clear" to remove all transcripts</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}