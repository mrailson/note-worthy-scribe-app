import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Mic, MicOff, Download, Activity } from 'lucide-react';
import { stitchNoDup } from '@/utils/transcribeStitcher';
import { toast } from 'sonner';

const SAMPLE_RATE = 16000; // Must match server & Transcribe

function floatTo16BitPCM(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return out;
}

function downsampleBuffer(buffer: Float32Array, inRate: number, outRate: number): Float32Array {
  if (outRate === inRate) return buffer;
  const ratio = inRate / outRate;
  const newLen = Math.floor(buffer.length / ratio);
  const result = new Float32Array(newLen);
  let offsetResult = 0;
  let offsetBuffer = 0;
  
  while (offsetResult < newLen) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0, count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = accum / (count || 1);
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

export const AWSTranscribeTest = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [lastMinuteText, setLastMinuteText] = useState("");
  const [chunkCount, setChunkCount] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const pcmQueueRef = useRef<Int16Array[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const eventsRef = useRef<Array<{ text: string; at: number }>>([]);
  const sseRef = useRef<EventSource | null>(null);

  function computeLastMinute() {
    const now = Date.now();
    const recent = eventsRef.current
      .filter(e => now - e.at <= 60_000)
      .map(e => e.text)
      .join(" ");
    setLastMinuteText(recent.trim());
  }

  async function start() {
    try {
      setStatus("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const ds = downsampleBuffer(input, ctx.sampleRate, SAMPLE_RATE);
        const pcm16 = floatTo16BitPCM(ds);
        pcmQueueRef.current.push(pcm16);
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      audioCtxRef.current = ctx;
      srcRef.current = source;
      procRef.current = processor;

      setStatus("Starting transcription session...");
      const startRes = await fetch(
        `https://dphcnbricafkbtizkoal.functions.supabase.co/aws-transcribe-proxy?action=start`, 
        { method: "POST" }
      );
      
      if (!startRes.ok) {
        throw new Error(`Failed to start session: ${startRes.statusText}`);
      }
      
      const { sessionId: sid } = await startRes.json();
      setSessionId(sid);
      console.log('Started transcription session:', sid);

      // Setup Server-Sent Events
      const es = new EventSource(
        `https://dphcnbricafkbtizkoal.functions.supabase.co/aws-transcribe-proxy?action=events&sessionId=${sid}`
      );
      sseRef.current = es;
      
      es.addEventListener("ready", () => {
        console.log('SSE connection ready');
        setStatus("Recording... Speak now!");
      });
      
      es.addEventListener("partial", (ev: any) => {
        const data = JSON.parse(ev.data);
        setTranscript(prev => stitchNoDup(prev, data.text));
      });
      
      es.addEventListener("final", (ev: any) => {
        const data = JSON.parse(ev.data);
        setTranscript(prev => {
          const next = stitchNoDup(prev, data.text);
          const addition = next.slice(prev.length);
          if (addition.trim()) {
            eventsRef.current.push({ text: addition.trim(), at: Date.now() });
            if (eventsRef.current.length > 200) {
              eventsRef.current = eventsRef.current.slice(-200);
            }
            computeLastMinute();
          }
          return next;
        });
      });
      
      es.addEventListener("error", (ev: any) => {
        console.error('SSE error:', ev);
        const data = JSON.parse(ev.data || '{}');
        toast.error(`Transcription error: ${data.message || 'Unknown error'}`);
      });
      
      es.addEventListener("end", () => {
        console.log('Transcription session ended');
        setStatus("Session ended");
      });

      // Flush PCM data to server periodically
      const flush = async () => {
        if (!sessionId && !sid) return;
        const q = pcmQueueRef.current;
        if (q.length === 0) return;
        
        // Concatenate all queued PCM data
        const totalLength = q.reduce((sum, arr) => sum + arr.length, 0);
        const combined = new Int16Array(totalLength);
        let offset = 0;
        
        for (const arr of q) {
          combined.set(arr, offset);
          offset += arr.length;
        }
        
        pcmQueueRef.current = [];
        setChunkCount(c => c + 1);
        
        try {
          await fetch(
            `https://dphcnbricafkbtizkoal.functions.supabase.co/aws-transcribe-proxy?action=push&sessionId=${sid}`,
            { 
              method: "POST", 
              headers: { "Content-Type": "application/octet-stream" }, 
              body: combined.buffer 
            }
          );
        } catch (e) {
          console.error('Failed to push audio data:', e);
        }
      };

      const timer = window.setInterval(flush, 200); // 200ms batches
      flushTimerRef.current = timer as any;

      setIsRecording(true);
      toast.success("Recording started!");
      
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      setStatus("Error: " + error.message);
      toast.error("Failed to start recording: " + error.message);
    }
  }

  async function stop() {
    try {
      if (flushTimerRef.current) { 
        clearInterval(flushTimerRef.current); 
        flushTimerRef.current = null; 
      }
      
      if (procRef.current) procRef.current.disconnect();
      if (srcRef.current) srcRef.current.disconnect();
      if (audioCtxRef.current) await audioCtxRef.current.close();
      
      procRef.current = null; 
      srcRef.current = null; 
      audioCtxRef.current = null;

      if (sessionId) {
        await fetch(
          `https://dphcnbricafkbtizkoal.functions.supabase.co/aws-transcribe-proxy?action=stop&sessionId=${sessionId}`, 
          { method: "POST" }
        );
      }
      
      if (sseRef.current) { 
        sseRef.current.close(); 
        sseRef.current = null; 
      }

      setIsRecording(false);
      setStatus("Stopped");
      toast.success("Recording stopped!");
    } catch (error: any) {
      console.error('Error stopping recording:', error);
      toast.error("Error stopping recording: " + error.message);
    }
  }

  function downloadTranscript() {
    if (!transcript) return;
    
    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; 
    a.download = `transcript-${sessionId || Date.now()}.txt`; 
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Transcript downloaded!");
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          AWS Transcribe Streaming Test
        </CardTitle>
        <CardDescription>
          Real-time speech transcription using AWS Transcribe via streaming proxy.
          Captures mic audio → PCM 16kHz → Server proxy → AWS Transcribe → Live results via SSE.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          {!isRecording ? (
            <Button onClick={start} className="flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Start Recording
            </Button>
          ) : (
            <Button onClick={stop} variant="destructive" className="flex items-center gap-2">
              <MicOff className="w-4 h-4" />
              Stop Recording
            </Button>
          )}
          
          <Button 
            onClick={downloadTranscript} 
            disabled={!transcript} 
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Save Transcript
          </Button>
          
          <div className="flex items-center gap-2 ml-auto">
            <Badge variant="outline">
              Status: {status}
            </Badge>
            <Badge variant="secondary">
              Chunks: {chunkCount}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Live Transcript</h3>
            <Textarea 
              value={transcript} 
              readOnly 
              rows={12} 
              className="font-mono text-sm resize-none"
              placeholder="Start recording to see live transcription..."
            />
          </div>
          
          <div>
            <h3 className="text-sm font-medium mb-2">Last 60 Seconds</h3>
            <div className="h-72 p-3 border rounded-md bg-muted/50 overflow-y-auto">
              {lastMinuteText ? (
                <p className="text-sm font-mono">{lastMinuteText}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Speak to see rolling 60-second window...
                </p>
              )}
            </div>
          </div>
        </div>
        
        {sessionId && (
          <div className="text-xs text-muted-foreground">
            Session ID: {sessionId}
          </div>
        )}
      </CardContent>
    </Card>
  );
};