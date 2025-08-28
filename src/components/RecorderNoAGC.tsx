import React, { useEffect, useRef, useState } from "react";

type SourceMode = "mic" | "tab";

const WS_URL = "wss://dphcnbricafkbtizkoal.supabase.co/functions/v1/recorder-websocket-transcription";

export default function RecorderNoAGC() {
  const [mode, setMode] = useState<SourceMode>("mic");
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("idle");
  const [level, setLevel] = useState(0);
  const [transcriptions, setTranscriptions] = useState<string[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // queue chunks until WS is open
  const chunkQueueRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function log(msg: string, ...rest: any[]) {
    console.log(`[RecorderNoAGC] ${msg}`, ...rest);
  }

  async function setupStream(selectedMode: SourceMode): Promise<MediaStream> {
    if (selectedMode === "tab") {
      try {
        // Check if getDisplayMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          throw new Error("Screen sharing not supported in this browser");
        }
        
        // User must choose "Chrome Tab" and tick "Share tab audio"
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: false,
          audio: true,
        });
        
        // Check if we got audio tracks
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          throw new Error("No audio track found - make sure to select 'Share tab audio' when prompted");
        }
        
        setStatus("Tab audio shared successfully");
        return stream;
      } catch (error: any) {
        log("getDisplayMedia error:", error);
        if (error.name === 'NotAllowedError') {
          throw new Error("Permission denied - please allow screen sharing and select 'Share tab audio'");
        } else if (error.name === 'NotSupportedError') {
          throw new Error("Tab audio sharing not supported - try using microphone mode instead");
        } else {
          throw error;
        }
      }
    }

    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
        sampleRate: 16000,
      } as MediaTrackConstraints,
      video: false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    // Try to enforce constraints after the fact too
    const track = stream.getAudioTracks()[0];
    if (track && track.applyConstraints) {
      try {
        await track.applyConstraints({
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        });
      } catch (e) {
        log("applyConstraints failed (ok to ignore on some browsers):", e);
      }
      try {
        const settings = track.getSettings?.();
        log("Track settings:", settings);
      } catch {}
    }
    return stream;
  }

  async function start() {
    if (recording) return;
    setStatus("Requesting media…");
    try {
      const stream = await setupStream(mode);
      mediaStreamRef.current = stream;

      // AudioContext & meter (no processing)
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      source.connect(analyser);

      // Level meter loop
      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteTimeDomainData(data);
        // Rough RMS
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setLevel(rms); // 0..1 approx
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);

      // WebSocket
      await openWebSocket();

      // MediaRecorder
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) {
          sendChunk(evt.data);
        }
      };

      mr.onstart = () => {
        setStatus("Recording…");
        setRecording(true);
      };

      mr.onerror = (e) => {
        log("MediaRecorder error:", e);
        setStatus("MediaRecorder error (see console)");
      };

      // Chunk every 1000ms
      mr.start(1000);
    } catch (err: any) {
      log("Start failed:", err);
      setStatus(err?.message || "Failed to start (permissions?)");
      teardown();
    }
  }

  function stop() {
    if (!recording) return;
    setStatus("Stopping…");
    
    // Send stop signal to flush any remaining audio
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'stop' }));
    }
    
    teardown();
    setStatus("Stopped");
    setRecording(false);
  }

  function teardown() {
    try {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    } catch {}
    try {
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }
    } catch {}
    mediaRecorderRef.current = null;

    try {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    mediaStreamRef.current = null;

    try {
      wsRef.current?.close();
    } catch {}
    wsRef.current = null;

    try {
      audioCtxRef.current?.close();
    } catch {}
    audioCtxRef.current = null;
    analyserRef.current = null;

    chunkQueueRef.current = [];
  }

  async function openWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(WS_URL);
        ws.binaryType = "arraybuffer";
        
        ws.onopen = () => {
          log("WS open");
          wsRef.current = ws;
          // flush any queued chunks
          for (const blob of chunkQueueRef.current) {
            blob.arrayBuffer().then((buf) => ws.send(buf));
          }
          chunkQueueRef.current = [];
          setStatus("WebSocket connected, ready to transcribe");
          resolve();
        };
        
        ws.onclose = (event) => {
          log("WS closed", event.code, event.reason);
          setStatus(`WebSocket disconnected: ${event.code} ${event.reason}`);
        };
        
        ws.onerror = (event) => {
          log("WS error:", event);
          setStatus(`WebSocket error - check if edge function is deployed`);
          reject(new Error(`WebSocket connection failed`));
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            log("WS message:", data);
            
            if (data.type === 'transcription') {
              setTranscriptions(prev => [...prev, data.text]);
              setCurrentTranscript(data.text);
              setStatus(`Transcribed: ${data.text.substring(0, 30)}...`);
            } else if (data.type === 'connection') {
              setStatus(data.message);
            } else if (data.type === 'error') {
              setStatus(`Error: ${data.message}`);
              log("Transcription error:", data.message);
            }
          } catch (e) {
            log("Failed to parse WS message:", e);
          }
        };
        
        // Add timeout for connection
        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            reject(new Error("WebSocket connection timeout"));
          }
        }, 10000); // 10 second timeout
        
      } catch (e) {
        reject(e);
      }
    });
  }

  function sendChunk(blob: Blob) {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      blob.arrayBuffer().then((buf) => ws.send(buf));
    } else {
      // queue until WS open
      chunkQueueRef.current.push(blob);
    }
  }

  // Simple inline UI
  return (
    <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, maxWidth: 520 }}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>Recorder (No AGC / No Noise Suppression)</div>

      <label style={{ display: "block", marginBottom: 8 }}>
        Source:&nbsp;
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as SourceMode)}
          disabled={recording}
        >
          <option value="mic">Mic (no AGC/NS/EC)</option>
          <option value="tab">This Tab (Share Audio)</option>
        </select>
      </label>

      {mode === "tab" && (
        <div style={{ fontSize: 12, marginBottom: 8 }}>
          Tip: When prompted, choose <b>Chrome Tab</b> and tick <b>"Share tab audio"</b> to capture YouTube cleanly.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button onClick={start} disabled={recording}>Start</button>
        <button onClick={stop} disabled={!recording}>Stop</button>
      </div>

      <div style={{ height: 8, background: "#f0f0f0", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
        <div 
          style={{ 
            width: `${Math.min(100, Math.round(level * 160))}%`, 
            height: "100%",
            backgroundColor: recording ? "#22c55e" : "#e5e7eb",
            transition: "width 0.1s ease-out"
          }} 
        />
      </div>
      <div style={{ fontSize: 12, color: "#555" }}>{status}</div>

      {/* Current Transcript */}
      {currentTranscript && (
        <div style={{ marginTop: 8, padding: 8, background: "#f9fafb", borderRadius: 4, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Latest Transcription:</div>
          <div style={{ fontSize: 12, color: "#374151" }}>{currentTranscript}</div>
        </div>
      )}

      {/* All Transcriptions */}
      {transcriptions.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>
            All Transcriptions ({transcriptions.length}):
          </div>
          <div style={{ 
            maxHeight: 120, 
            overflowY: "auto", 
            padding: 8, 
            background: "#f9fafb", 
            borderRadius: 4, 
            border: "1px solid #e5e7eb",
            fontSize: 11,
            lineHeight: 1.4
          }}>
            {transcriptions.map((text, index) => (
              <div key={index} style={{ marginBottom: 4, paddingBottom: 4, borderBottom: index < transcriptions.length - 1 ? "1px solid #e5e7eb" : "none" }}>
                <span style={{ color: "#6b7280" }}>#{index + 1}:</span> {text}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 12, color: "#777" }}>
        This recorder disables browser audio processing (AGC/NS/EC) and transcribes speech using OpenAI Whisper.
        For system audio, use "This Tab" mode.
      </div>
    </div>
  );
}