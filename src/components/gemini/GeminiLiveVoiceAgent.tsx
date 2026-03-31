import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, MicOff, Volume2, Loader2, Phone, PhoneOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { VoiceWaveform } from '@/components/translation/VoiceWaveform';
import { cn } from '@/lib/utils';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface TranscriptEntry {
  role: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

export const GeminiLiveVoiceAgent: React.FC = () => {
  const { toast } = useToast();
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(80);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  // Update volume
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume / 100;
    }
  }, [volume]);

  const playNextChunk = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    
    isPlayingRef.current = true;
    setIsSpeaking(true);

    while (audioQueueRef.current.length > 0) {
      const chunk = audioQueueRef.current.shift()!;
      
      if (!playbackContextRef.current || playbackContextRef.current.state === 'closed') break;
      
      // Convert Int16 PCM to Float32 for Web Audio
      const int16 = new Int16Array(chunk);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      const buffer = playbackContextRef.current.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);

      const source = playbackContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNodeRef.current!);

      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start();
      });
    }

    isPlayingRef.current = false;
    setIsSpeaking(false);
  }, []);

  const clearAudioQueue = useCallback(() => {
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsSpeaking(false);
  }, []);

  const connect = useCallback(async () => {
    setStatus('connecting');
    setTranscript([]);

    try {
      // Get API key from edge function
      const { data, error } = await supabase.functions.invoke('gemini-live-token');
      if (error || !data?.apiKey) {
        throw new Error(error?.message || 'Failed to get Gemini token');
      }

      // Request mic permission
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      micStreamRef.current = micStream;

      // Set up playback context at 24kHz
      const playbackCtx = new AudioContext({ sampleRate: 24000 });
      playbackContextRef.current = playbackCtx;
      const gain = playbackCtx.createGain();
      gain.gain.value = volume / 100;
      gain.connect(playbackCtx.destination);
      gainNodeRef.current = gain;

      // Set up mic capture with AudioWorklet for 16kHz PCM
      const nativeSampleRate = micStream.getAudioTracks()[0]?.getSettings?.()?.sampleRate || 48000;
      const audioCtx = new AudioContext({ sampleRate: nativeSampleRate });
      audioContextRef.current = audioCtx;

      await audioCtx.audioWorklet.addModule('/worklets/pcm16-writer.js');
      const sourceNode = audioCtx.createMediaStreamSource(micStream);
      sourceNodeRef.current = sourceNode;
      const workletNode = new AudioWorkletNode(audioCtx, 'pcm16-writer');
      workletNodeRef.current = workletNode;
      sourceNode.connect(workletNode);
      workletNode.connect(audioCtx.destination);

      // Connect to Gemini Live API
      console.log('🔗 Connecting to Gemini Live with model:', data.model);
      const ai = new GoogleGenAI({ apiKey: data.apiKey });
      
      let session: any;
      try {
        session = await ai.live.connect({
          model: data.model,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Zephyr' },
              },
            },
          },
          callbacks: {
            onopen: () => {
              console.log('🎙️ Gemini Live session opened');
              setStatus('connected');
            },
            onmessage: (message: any) => {
              // Handle audio data
              const serverContent = message?.serverContent;
              if (serverContent?.modelTurn?.parts) {
                for (const part of serverContent.modelTurn.parts) {
                  if (part.inlineData?.data) {
                    // Decode base64 PCM audio
                    const binaryStr = atob(part.inlineData.data);
                    const bytes = new Uint8Array(binaryStr.length);
                    for (let i = 0; i < binaryStr.length; i++) {
                      bytes[i] = binaryStr.charCodeAt(i);
                    }
                    audioQueueRef.current.push(bytes.buffer);
                    playNextChunk();
                  }
                  if (part.text) {
                    setTranscript(prev => [
                      ...prev,
                      { role: 'agent', text: part.text, timestamp: new Date() },
                    ]);
                  }
                }
              }

              // When turn completes, clear queue (handles interruptions)
              if (serverContent?.turnComplete) {
                clearAudioQueue();
              }

              // Handle input transcription
              if (message?.serverContent?.inputTranscription?.text) {
                const text = message.serverContent.inputTranscription.text;
                if (text.trim()) {
                  setTranscript(prev => [
                    ...prev,
                    { role: 'user', text, timestamp: new Date() },
                  ]);
                }
              }

              // Handle output transcription
              if (message?.serverContent?.outputTranscription?.text) {
                const text = message.serverContent.outputTranscription.text;
                if (text.trim()) {
                  setTranscript(prev => {
                    // Update last agent entry or add new
                    const last = prev[prev.length - 1];
                    if (last?.role === 'agent') {
                      return [
                        ...prev.slice(0, -1),
                        { ...last, text: last.text + text },
                      ];
                    }
                    return [...prev, { role: 'agent', text, timestamp: new Date() }];
                  });
                }
              }
            },
            onerror: (error: any) => {
              console.error('❌ Gemini Live WebSocket error event:', error);
              // Don't show toast here - onclose will fire next with more detail
            },
            onclose: (event: any) => {
              console.log('🔌 Gemini Live session closed:', event?.code, event?.reason, event);
              setStatus('disconnected');
              if (event?.code && event.code !== 1000) {
                toast({
                  variant: 'destructive',
                  title: 'Connection Error',
                  description: `Voice agent disconnected: ${event?.reason || `code ${event?.code}`}`,
                });
              }
            },
          },
        });
      } catch (connectError: any) {
        console.error('❌ Gemini Live connect() threw:', connectError?.message, connectError);
        throw new Error(connectError?.message || 'Failed to establish Gemini Live session');
      }

      sessionRef.current = session;

      // Start sending mic audio to Gemini
      workletNode.port.onmessage = (event: MessageEvent) => {
        if (sessionRef.current && event.data instanceof ArrayBuffer) {
          try {
            // Convert Int16 ArrayBuffer to base64
            const uint8 = new Uint8Array(event.data);
            let binary = '';
            for (let i = 0; i < uint8.length; i++) {
              binary += String.fromCharCode(uint8[i]);
            }
            const base64Audio = btoa(binary);

            sessionRef.current.sendRealtimeInput({
              audio: {
                data: base64Audio,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } catch (e) {
            // Session may have closed
          }
        }
      };

      toast({
        title: 'Connected',
        description: 'Voice agent is ready. Start speaking!',
      });
    } catch (err: any) {
      console.error('Failed to connect:', err);
      setStatus('disconnected');
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: err.message || 'Could not start voice agent.',
      });
      disconnect();
    }
  }, [volume, toast, playNextChunk, clearAudioQueue]);

  const disconnect = useCallback(() => {
    try {
      sessionRef.current?.close?.();
    } catch {}
    sessionRef.current = null;

    workletNodeRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();
    playbackContextRef.current?.close();

    workletNodeRef.current = null;
    sourceNodeRef.current = null;
    micStreamRef.current = null;
    audioContextRef.current = null;
    playbackContextRef.current = null;
    gainNodeRef.current = null;
    audioQueueRef.current = [];
    isPlayingRef.current = false;

    setStatus('disconnected');
    setIsSpeaking(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mic className="w-5 h-5" />
            Gemini Live Voice Agent
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status orb + connect button */}
          <div className="flex flex-col items-center gap-4 py-4">
            <div
              className={cn(
                'w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500',
                status === 'disconnected' && 'bg-muted',
                status === 'connecting' && 'bg-primary/20 animate-pulse',
                status === 'connected' && !isSpeaking && 'bg-primary/30 shadow-lg shadow-primary/20',
                status === 'connected' && isSpeaking && 'bg-primary/50 shadow-xl shadow-primary/40 scale-110'
              )}
            >
              {status === 'connecting' ? (
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              ) : status === 'connected' ? (
                <VoiceWaveform isActive={isSpeaking} className="text-primary scale-150" />
              ) : (
                <Mic className="w-10 h-10 text-muted-foreground" />
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              {status === 'disconnected' && 'Press connect to start a voice conversation'}
              {status === 'connecting' && 'Connecting to Gemini...'}
              {status === 'connected' && !isSpeaking && 'Listening — speak to the agent'}
              {status === 'connected' && isSpeaking && 'Agent is speaking...'}
            </p>

            {status === 'disconnected' ? (
              <Button onClick={connect} size="lg" className="gap-2">
                <Phone className="w-4 h-4" />
                Connect
              </Button>
            ) : status === 'connecting' ? (
              <Button disabled size="lg" className="gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </Button>
            ) : (
              <Button onClick={disconnect} variant="destructive" size="lg" className="gap-2">
                <PhoneOff className="w-4 h-4" />
                Disconnect
              </Button>
            )}
          </div>

          {/* Volume slider */}
          <div className="flex items-center gap-3 px-2">
            <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <Slider
              value={[volume]}
              onValueChange={(v) => setVolume(v[0])}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8 text-right">{volume}%</span>
          </div>

          {/* Transcript */}
          {transcript.length > 0 && (
            <div className="border rounded-lg">
              <div className="px-3 py-2 border-b bg-muted/30">
                <span className="text-xs font-medium text-muted-foreground">Transcript</span>
              </div>
              <ScrollArea className="h-48">
                <div ref={scrollRef} className="p-3 space-y-2">
                  {transcript.map((entry, i) => (
                    <div
                      key={i}
                      className={cn(
                        'text-sm px-3 py-1.5 rounded-lg max-w-[85%]',
                        entry.role === 'user'
                          ? 'bg-primary/10 text-foreground ml-auto'
                          : 'bg-muted text-foreground'
                      )}
                    >
                      <span className="text-[10px] font-medium text-muted-foreground uppercase">
                        {entry.role === 'user' ? 'You' : 'Agent'}
                      </span>
                      <p className="mt-0.5">{entry.text}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Info */}
          <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg space-y-1">
            <p><strong>Model:</strong> Gemini 3.1 Flash Live Preview</p>
            <p><strong>Voice:</strong> Zephyr</p>
            <p><strong>Audio:</strong> 16kHz PCM input → 24kHz PCM output</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
