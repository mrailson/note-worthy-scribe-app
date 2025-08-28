import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mic, MicOff, Activity, Users, Award, Clock, Download } from "lucide-react";
import { toast } from "sonner";

interface TranscriptionResult {
  type: string;
  sessionId: string;
  timestamp?: string;
  error?: string;
  finalStats?: SessionStats;
  Transcript?: {
    Results?: Array<{
      Alternatives?: Array<{
        Transcript: string;
        Items?: Array<{
          Content: string;
          Confidence?: number;
          Type: string;
          StartTime?: number;
          EndTime?: number;
        }>;
      }>;
      IsPartial?: boolean;
      ChannelLabel?: string;
    }>;
  };
  clinicalMetadata?: {
    averageConfidence: number;
    meetsMedicalThreshold: boolean;
    speakerLabels: Record<string, string>;
    totalAudioProcessed: number;
    sessionDuration: number;
  };
}

interface SessionStats {
  totalAudioProcessed: number;
  averageConfidence: number;
  sessionDuration: number;
  speakerCount: number;
}

export const AmazonTranscribeMedicalTest: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [status, setStatus] = useState('Disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [speakerLabels, setSpeakerLabels] = useState<Record<string, string>>({});
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    totalAudioProcessed: 0,
    averageConfidence: 0,
    sessionDuration: 0,
    speakerCount: 0
  });
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Audio processing utilities
  const floatTo16BitPCM = (float32: Float32Array): Int16Array => {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
  };

  const downsampleBuffer = (buffer: Float32Array, inRate: number, outRate: number): Float32Array => {
    if (inRate === outRate) return buffer;
    const sampleRateRatio = inRate / outRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0, count = 0;
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

  const connectWebSocket = () => {
    const wsUrl = `wss://dphcnbricafkbtizkoal.functions.supabase.co/amazon-transcribe-medical-ws`;
    
    console.log('Connecting to Amazon Transcribe Medical WebSocket...');
    setStatus('Connecting...');
    setError(null);

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
      setStatus('Connected');
      toast.success('Connected to Amazon Transcribe Medical');
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data: TranscriptionResult = JSON.parse(event.data);
        console.log('Received:', data.type, data);

        switch (data.type) {
          case 'session_started':
            setSessionId(data.sessionId);
            setStatus('Session Active');
            toast.success('Medical transcription session started');
            break;

          case 'transcription_result':
            handleTranscriptionResult(data);
            break;

          case 'session_ended':
            setStatus('Session Ended');
            if (data.finalStats) {
              setSessionStats(data.finalStats as SessionStats);
            }
            toast.info('Transcription session ended');
            break;

          case 'error':
            setError(data.error || 'Unknown error occurred');
            setStatus('Error');
            toast.error(data.error || 'Transcription error');
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        setError('Failed to parse server response');
      }
    };

    wsRef.current.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setStatus('Disconnected');
      setSessionId(null);
      
      if (event.code !== 1000) {
        setError(`Connection closed unexpectedly: ${event.reason || 'Unknown reason'}`);
        toast.error('Connection lost');
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('WebSocket connection failed');
      setStatus('Error');
      toast.error('Connection failed');
    };
  };

  const handleTranscriptionResult = (data: TranscriptionResult) => {
    if (data.Transcript?.Results) {
      for (const result of data.Transcript.Results) {
        if (result.Alternatives && result.Alternatives[0]) {
          const transcriptText = result.Alternatives[0].Transcript;
          
          if (result.IsPartial) {
            setPartialTranscript(transcriptText);
          } else {
            setTranscript(prev => prev + (prev ? ' ' : '') + transcriptText);
            setPartialTranscript('');
          }
        }
      }
    }

    // Update clinical metadata
    if (data.clinicalMetadata) {
      setConfidenceScore(data.clinicalMetadata.averageConfidence);
      setSpeakerLabels(data.clinicalMetadata.speakerLabels);
      setSessionStats({
        totalAudioProcessed: data.clinicalMetadata.totalAudioProcessed,
        averageConfidence: data.clinicalMetadata.averageConfidence,
        sessionDuration: data.clinicalMetadata.sessionDuration,
        speakerCount: Object.keys(data.clinicalMetadata.speakerLabels).length
      });
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      
      // Connect WebSocket first
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connectWebSocket();
        
        // Wait for connection
        await new Promise((resolve, reject) => {
          const checkConnection = () => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              resolve(void 0);
            } else if (wsRef.current?.readyState === WebSocket.CLOSED) {
              reject(new Error('Failed to connect'));
            } else {
              setTimeout(checkConnection, 100);
            }
          };
          checkConnection();
        });
      }

      // Get microphone access
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processorRef.current.onaudioprocess = (e) => {
        if (!isRecording || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        const downsampledData = downsampleBuffer(inputData, audioContextRef.current!.sampleRate, 16000);
        const pcmData = floatTo16BitPCM(downsampledData);
        
        // Send audio data to WebSocket
        wsRef.current.send(JSON.stringify({
          type: 'audio_data',
          audioData: Array.from(pcmData)
        }));
      };

      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      setIsRecording(true);
      toast.success('Recording started - Medical transcription active');

    } catch (error) {
      console.error('Error starting recording:', error);
      setError(`Failed to start recording: ${error.message}`);
      toast.error('Failed to start recording');
    }
  };

  const stopRecording = () => {
    setIsRecording(false);

    // Clean up audio resources
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // End session
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'end_session' }));
    }

    toast.success('Recording stopped');
  };

  const downloadTranscript = () => {
    const clinicalData = {
      transcript: transcript,
      sessionStats: sessionStats,
      speakerLabels: speakerLabels,
      confidenceScore: confidenceScore,
      sessionId: sessionId,
      timestamp: new Date().toISOString(),
      service: 'Amazon Transcribe Medical'
    };

    const blob = new Blob([JSON.stringify(clinicalData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clinical-transcript-${sessionId || Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearTranscript = () => {
    setTranscript('');
    setPartialTranscript('');
    setSpeakerLabels({});
    setConfidenceScore(0);
    setSessionStats({
      totalAudioProcessed: 0,
      averageConfidence: 0,
      sessionDuration: 0,
      speakerCount: 0
    });
    toast.success('Transcript cleared');
  };

  const getStatusColor = () => {
    switch (status) {
      case 'Connected':
      case 'Session Active':
        return 'bg-green-500';
      case 'Connecting...':
        return 'bg-yellow-500';
      case 'Error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getConfidenceColor = () => {
    if (confidenceScore >= 0.9) return 'bg-green-500';
    if (confidenceScore >= 0.8) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Amazon Transcribe Medical
          </CardTitle>
          <CardDescription>
            Clinical-grade speech-to-text with medical vocabulary and speaker identification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status and Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
              <span className="text-sm font-medium">{status}</span>
            </div>
            {sessionId && (
              <Badge variant="outline" className="text-xs">
                {sessionId}
              </Badge>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              variant={isRecording ? "destructive" : "default"}
              className="flex-1"
              disabled={status === 'Connecting...'}
            >
              {isRecording ? (
                <>
                  <MicOff className="h-4 w-4 mr-2" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Start Recording
                </>
              )}
            </Button>
            
            <Button onClick={clearTranscript} variant="outline">
              Clear
            </Button>
            
            <Button onClick={downloadTranscript} variant="outline" disabled={!transcript}>
              <Download className="h-4 w-4" />
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Clinical Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4" />
                <span className="text-sm font-medium">Confidence</span>
              </div>
              <div className="space-y-1">
                <Progress value={confidenceScore * 100} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{(confidenceScore * 100).toFixed(1)}%</span>
                  <Badge 
                    variant={confidenceScore >= 0.85 ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {confidenceScore >= 0.85 ? "Clinical Grade" : "Below Threshold"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">Speakers</span>
              </div>
              <div className="text-2xl font-bold">{sessionStats.speakerCount}</div>
              <div className="text-xs text-muted-foreground">
                {sessionStats.sessionDuration > 0 
                  ? `${Math.round(sessionStats.sessionDuration / 1000)}s session`
                  : 'Not started'
                }
              </div>
            </div>
          </div>

          {/* Speaker Labels */}
          {Object.keys(speakerLabels).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">Identified Speakers</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(speakerLabels).map(([channel, role]) => (
                  <Badge key={channel} variant="secondary">
                    {channel}: {role}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcript Display */}
      <Card>
        <CardHeader>
          <CardTitle>Live Clinical Transcript</CardTitle>
          <CardDescription>
            Real-time medical transcription with confidence scoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] w-full border rounded-md p-4">
            <div className="space-y-2">
              {transcript && (
                <div className="text-sm leading-relaxed">
                  {transcript}
                </div>
              )}
              
              {partialTranscript && (
                <>
                  <Separator />
                  <div className="text-sm text-muted-foreground italic">
                    {partialTranscript}
                  </div>
                </>
              )}
              
              {!transcript && !partialTranscript && (
                <div className="text-center text-muted-foreground py-8">
                  Start recording to see live transcription
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Session Statistics */}
          {sessionStats.sessionDuration > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs text-muted-foreground">Audio Processed</div>
                  <div className="text-sm font-medium">
                    {Math.round(sessionStats.totalAudioProcessed / 1024)}KB
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Avg Confidence</div>
                  <div className="text-sm font-medium">
                    {(sessionStats.averageConfidence * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Duration</div>
                  <div className="text-sm font-medium">
                    {Math.round(sessionStats.sessionDuration / 1000)}s
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};