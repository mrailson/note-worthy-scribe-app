// NoteWellRecorderMobile.jsx
// Chunked audio recording with 15-minute segments for meetings up to 5 hours.

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { ChunkedRecorder } from "@/lib/audio/ChunkedRecorder";
import { ChunkedTranscriptionService } from "@/lib/audio/ChunkedTranscriptionService";
import { getSavedBitrate, saveBitrate } from "@/components/settings/RecordingQualitySettings";
import { BITRATE_OPTIONS } from "@/lib/audio/ChunkedRecorder";
import { attachDeviceInfoToMeeting } from "@/utils/meetingDeviceCapture";
import { AssemblyRealtimeClient } from "@/lib/assembly-realtime";
import { createTranscriber } from "@/utils/TranscriptionServiceFactory";
import { WhisperChunkTranscriber } from "@/utils/WhisperChunkTranscriber";
import { useWakeLock } from "@/hooks/useWakeLock";
import { iOSAudioKeepAlive } from "@/utils/iOSAudioKeepAlive";
import { androidAudioKeepAlive } from "@/utils/androidAudioKeepAlive";
import { cleanWhisperResponse } from "@/utils/whisper-chunk-cleaner";
import { ConnectionBanner } from "@/components/recorder/ConnectionBanner";
import { useRecordingMode } from "@/hooks/useRecordingMode";
import { useAuth } from "@/contexts/AuthContext";
import { modelOverrideField } from "@/utils/resolveMeetingModel";

// ─── IndexedDB helpers ────────────────────────────────────────────────────────
const DB_NAME = "notewell_recordings_v1";
const STORE   = "recordings";

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    r.onsuccess  = e => res(e.target.result);
    r.onerror    = ()  => rej(r.error);
  });
}
const dbOp = async (mode, fn) => {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx    = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req   = fn(store);
    if (req) req.onsuccess = () => {};
    tx.oncomplete = () => res(req?.result);
    tx.onerror    = () => rej(tx.error);
  });
};
const dbPut    = rec  => dbOp("readwrite", s => s.put(rec));
const dbDelete = id   => dbOp("readwrite", s => s.delete(id));
const dbAll    = ()   => new Promise(async (res, rej) => {
  const db  = await openDB();
  const tx  = db.transaction(STORE, "readonly");
  const req = tx.objectStore(STORE).getAll();
  req.onsuccess = () => res(req.result.sort((a, b) => b.createdAt - a.createdAt));
  req.onerror   = () => rej(req.error);
});
const dbPatch  = async (id, patch) => {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx    = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const get   = store.get(id);
    get.onsuccess = () => store.put({ ...get.result, ...patch });
    tx.oncomplete = res;
    tx.onerror    = () => rej(tx.error);
  });
};

// ─── Formatting helpers ───────────────────────────────────────────────────────
const fmtDuration = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
};
const fmtTime  = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
const fmtDate  = t => new Date(t).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const fmtSize  = b => b < 1048576 ? `${(b/1024).toFixed(0)} KB` : `${(b/1048576).toFixed(1)} MB`;

// ─── Sub-components ───────────────────────────────────────────────────────

function WaveformBars({ active, isPaused, stream }) {
  const BAR_COUNT = 15;
  const [levels, setLevels] = useState(() => new Array(BAR_COUNT).fill(0));
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!active || isPaused || !stream) {
      setLevels(new Array(BAR_COUNT).fill(0));
      return;
    }

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.7;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        // Sample BAR_COUNT bins from the frequency data
        const binCount = dataArray.length;
        const newLevels = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          const binIndex = Math.min(Math.floor((i / BAR_COUNT) * binCount), binCount - 1);
          newLevels.push(dataArray[binIndex] / 255);
        }
        setLevels(newLevels);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      console.warn("WaveformBars: AudioContext failed", e);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
      analyserRef.current = null;
      audioCtxRef.current = null;
    };
  }, [active, isPaused, stream]);

  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:3,height:40}}>
      {levels.map((level, i) => (
        <div key={i} style={{
          width:3, borderRadius:3,
          height: active && !isPaused ? `${Math.max(4, level * 32)}px` : "4px",
          background: active && level > 0.05 ? "linear-gradient(180deg,#0288d1,#1565c0)" : "#e2e8f0",
          transition: "height 0.08s ease-out, background 0.15s",
        }}/>
      ))}
    </div>
  );
}

function ModePill({ mode, isAutoFallback, disabled, onTap, authLoading, isAuthenticated }) {
  const live = mode === "live";

  // Three visual states:
  //   live                                 → 🟢 green  "Online"
  //   offline + isAutoFallback             → 🟡 amber  "Offline (no connection)"
  //   offline + user-chosen                → ⚪ slate  "Offline mode"
  const variant = live && authLoading
    ? "checking"
    : live && !isAuthenticated
    ? "signin"
    : live
    ? "online"
    : isAutoFallback
    ? "fallback"
    : "offline";

  const styles = {
    checking: {
      borderColor: "rgba(100,116,139,0.30)",
      bg: "rgba(100,116,139,0.08)",
      dot: "#64748b",
      dotBg: "linear-gradient(135deg,#64748b,#94a3b8)",
      dotShadow: "0 2px 6px rgba(100,116,139,0.35)",
      labelColor: "#475569",
      label: "Checking login…",
    },
    online: {
      borderColor: "rgba(22,163,74,0.30)",
      bg: "rgba(22,163,74,0.08)",
      dot: "#16a34a",
      dotBg: "linear-gradient(135deg,#16a34a,#22c55e)",
      dotShadow: "0 2px 6px rgba(22,163,74,0.4)",
      labelColor: "#15803d",
      label: "Online · Signed in",
    },
    signin: {
      borderColor: "rgba(245,158,11,0.40)",
      bg: "rgba(245,158,11,0.10)",
      dot: "#f59e0b",
      dotBg: "linear-gradient(135deg,#f59e0b,#f97316)",
      dotShadow: "0 2px 6px rgba(245,158,11,0.4)",
      labelColor: "#d97706",
      label: "Online · Sign in needed",
    },
    fallback: {
      borderColor: "rgba(245,158,11,0.40)",
      bg: "rgba(245,158,11,0.10)",
      dot: "#f59e0b",
      dotBg: "linear-gradient(135deg,#f59e0b,#f97316)",
      dotShadow: "0 2px 6px rgba(245,158,11,0.4)",
      labelColor: "#d97706",
      label: "Offline (no connection)",
    },
    offline: {
      borderColor: "rgba(100,116,139,0.30)",
      bg: "rgba(100,116,139,0.08)",
      dot: "#64748b",
      dotBg: "linear-gradient(135deg,#64748b,#94a3b8)",
      dotShadow: "0 2px 6px rgba(100,116,139,0.35)",
      labelColor: "#475569",
      label: "Offline mode",
    },
  }[variant];

  return (
    <button
      onClick={disabled ? undefined : onTap}
      disabled={disabled}
      style={{
        display:"inline-flex", alignItems:"center", gap:8,
        padding:"6px 14px 6px 8px", borderRadius:20,
        border:`1.5px solid ${styles.borderColor}`,
        background:styles.bg,
        cursor:disabled?"default":"pointer", transition:"all 0.25s",
        opacity:disabled?0.8:1,
      }}
      aria-label={`Recording mode: ${styles.label}. Tap to change.`}
    >
      <span style={{
        width:10, height:10, borderRadius:"50%",
        background:styles.dotBg,
        boxShadow:styles.dotShadow,
        display:"inline-block",
      }}/>
      <span style={{fontSize:12,fontWeight:600,color:styles.labelColor}}>
        {styles.label}
      </span>
      {!disabled && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke={styles.labelColor} strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      )}
    </button>
  );
}

function ModeSheet({ mode, onClose, onSelect, isAuthenticated, authLoading, onSignIn }) {
  return (
    <div
      onClick={onClose}
      style={{position:"absolute",inset:0,background:"rgba(15,23,42,0.55)",backdropFilter:"blur(4px)",
        display:"flex",alignItems:"center",justifyContent:"center",zIndex:50}}
    >
      <div onClick={e=>e.stopPropagation()} style={{
        background:"white",borderRadius:24,padding:"20px 18px 28px",width:"calc(100% - 32px)",maxWidth:400,
        animation:"slideUp 0.25s ease-out",
      }}>
        <div style={{width:40,height:4,background:"#e2e8f0",borderRadius:2,margin:"0 auto 18px"}}/>
        <div style={{fontSize:16,fontWeight:700,color:"#1a2332",marginBottom:3}}>Recording Mode</div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:18}}>
          Auto-detected from your connection and login status. Tap to override.
        </div>

        {mode === "live" && !authLoading && !isAuthenticated && (
          <div style={{background:"rgba(245,158,11,0.10)",borderRadius:12,padding:"12px",border:"1px solid rgba(245,158,11,0.30)",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:"#92400e",marginBottom:4}}>Sign in needed</div>
            <div style={{fontSize:12,color:"#92400e",lineHeight:1.45,marginBottom:10}}>You have internet, but your Notewell login is not active. Sign in to use live recording, sync, and old meetings.</div>
            <button onClick={onSignIn} style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#1565c0,#0288d1)",color:"white",fontSize:13,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>Sign in</button>
          </div>
        )}

        {[
          {
            id:"live",
            icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M1.5 8.5a13 13 0 0 1 21 0M5 12a10 10 0 0 1 14 0M8.5 15.5a6 6 0 0 1 7 0"/><circle cx="12" cy="19" r="2" fill="white"/></svg>,
            bg:"linear-gradient(135deg,#1565c0,#0288d1)",
            border:"rgba(21,101,192,0.35)",
            activeBg:"rgba(21,101,192,0.05)",
            badge:"#1565c0",
            title:"Live Transcription",
            desc:"Requires internet. Transcript streams in real-time. Notes generated on stop.",
            tip:"✓ Best for: boardrooms, clinics, on-site meetings",
            tipColor:"#16a34a",
          },
          {
            id:"offline",
            icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>,
            bg:"linear-gradient(135deg,#f59e0b,#f97316)",
            border:"rgba(245,158,11,0.4)",
            activeBg:"rgba(245,158,11,0.05)",
            badge:"#f59e0b",
            title:"Offline Recording",
            desc:"No internet needed. Saves locally, syncs & transcribes when back online.",
            tip:"✓ Best for: home visits, poor signal, basements",
            tipColor:"#d97706",
          },
        ].map(opt => (
          <button key={opt.id} onClick={()=>onSelect(opt.id)} style={{
            width:"100%",padding:"14px 16px",borderRadius:16,marginBottom:10,
            border:`2px solid ${mode===opt.id?opt.border:"#e2e8f0"}`,
            background:mode===opt.id?opt.activeBg:"white",
            cursor:"pointer",textAlign:"left",display:"flex",alignItems:"flex-start",gap:12,
          }}>
            <div style={{width:40,height:40,borderRadius:12,background:opt.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {opt.icon}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:"#1a2332",display:"flex",alignItems:"center",gap:6}}>
                {opt.title}
                {mode===opt.id && (
                  <span style={{fontSize:10,background:opt.badge,color:"white",padding:"1px 7px",borderRadius:10,fontWeight:700}}>ACTIVE</span>
                )}
              </div>
              <div style={{fontSize:12,color:"#64748b",marginTop:3,lineHeight:1.5}}>{opt.desc}</div>
              <div style={{fontSize:11,color:opt.tipColor,marginTop:5,fontWeight:500}}>{opt.tip}</div>
            </div>
          </button>
        ))}

        <div style={{background:"#f8fafc",borderRadius:12,padding:"10px 12px",display:"flex",alignItems:"flex-start",gap:8,marginTop:4}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{marginTop:1,flexShrink:0}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{fontSize:12,color:"#64748b",lineHeight:1.5}}>
            Auto-detect will switch modes if your connection changes during a session and retry any failed sync.
          </span>
        </div>
      </div>
    </div>
  );
}

function SettingsSheet({ onClose, bitrate, onBitrateChange }) {
  return (
    <div
      onClick={onClose}
      style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.55)",backdropFilter:"blur(4px)",
        display:"flex",alignItems:"center",justifyContent:"center",zIndex:9998}}
    >
      <div onClick={e=>e.stopPropagation()} style={{
        background:"white",borderRadius:24,padding:"20px 18px 28px",width:"calc(100% - 32px)",maxWidth:400,
        animation:"slideUp 0.25s ease-out",
      }}>
        <div style={{width:40,height:4,background:"#e2e8f0",borderRadius:2,margin:"0 auto 18px"}}/>
        <div style={{fontSize:16,fontWeight:700,color:"#1a2332",marginBottom:3}}>Recording Settings</div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:18}}>
          Changes apply to your next recording.
        </div>

        <div style={{fontSize:13,fontWeight:600,color:"#1a2332",marginBottom:10}}>Audio Quality</div>
        {BITRATE_OPTIONS.map(opt => (
          <button key={opt.value} onClick={()=>{ saveBitrate(opt.value); onBitrateChange(opt.value); }} style={{
            width:"100%",padding:"12px 14px",borderRadius:14,marginBottom:8,
            border:`2px solid ${bitrate===opt.value?"rgba(21,101,192,0.35)":"#e2e8f0"}`,
            background:bitrate===opt.value?"rgba(21,101,192,0.05)":"white",
            cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:12,
          }}>
            <div style={{
              width:18,height:18,borderRadius:"50%",
              border:`2px solid ${bitrate===opt.value?"#1565c0":"#cbd5e1"}`,
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>
              {bitrate===opt.value && <div style={{width:10,height:10,borderRadius:"50%",background:"#1565c0"}}/>}
            </div>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:13,fontWeight:600,color:"#1a2332"}}>{opt.label}</span>
                {opt.value === 32000 && (
                  <span style={{fontSize:9,background:"rgba(21,101,192,0.1)",color:"#1565c0",padding:"1px 6px",borderRadius:8,fontWeight:700}}>Recommended</span>
                )}
              </div>
              <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{opt.description}</div>
              <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>
                3hr meeting ≈ {Math.round((opt.value / 8) * 180 * 60 / (1024 * 1024))} MB
              </div>
            </div>
          </button>
        ))}

        <div style={{background:"#f8fafc",borderRadius:12,padding:"10px 12px",display:"flex",alignItems:"flex-start",gap:8,marginTop:8}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{marginTop:1,flexShrink:0}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{fontSize:12,color:"#64748b",lineHeight:1.5}}>
            Audio is split into 15-minute chunks automatically, supporting recordings up to 5 hours.
          </span>
        </div>

        <button onClick={onClose} style={{
          width:"100%",padding:"13px",borderRadius:14,border:"none",marginTop:14,
          background:"linear-gradient(135deg,#1565c0,#0288d1)",cursor:"pointer",
          fontSize:14,fontWeight:600,color:"white",fontFamily:"inherit",
          boxShadow:"0 4px 12px rgba(21,101,192,0.4)",
        }}>Done</button>
      </div>
    </div>
  );
}

function TitleModal({ duration, chunkCount, totalSize, autoTitle, onSave, onContinue }) {
  const [title, setTitle] = useState(autoTitle || `Meeting ${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short"})} ${new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}`);
  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(15,23,42,0.6)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:60,padding:"24px 16px"}}>
      <div style={{background:"white",borderRadius:20,padding:"22px 18px 28px",width:"100%",maxWidth:400,animation:"slideUp 0.25s ease-out",marginBottom:"env(safe-area-inset-bottom, 0px)"}}>
        <div style={{width:40,height:4,background:"#e2e8f0",borderRadius:2,margin:"0 auto 18px"}}/>
        <div style={{fontSize:17,fontWeight:700,color:"#1a2332",marginBottom:4}}>Name this recording</div>
        <div style={{fontSize:12,color:"#94a3b8",marginBottom:14}}>
          {fmtTime(duration)} · {fmtSize(totalSize)}{chunkCount > 1 ? ` · ${chunkCount} segments` : ""}
        </div>
        <input
          autoFocus
          value={title}
          onChange={e=>setTitle(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&onSave(title)}
          style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1.5px solid rgba(21,101,192,0.3)",
            fontSize:14,color:"#1a2332",outline:"none",marginBottom:14,background:"#f8fafc",fontFamily:"inherit"}}
        />
        {onContinue && (
          <button onClick={onContinue} style={{width:"100%",padding:"13px",borderRadius:12,border:"1.5px solid #16a34a",background:"#f0fdf4",cursor:"pointer",fontSize:14,fontWeight:600,color:"#16a34a",fontFamily:"inherit",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            ▶ Continue Recording
          </button>
        )}
        <div style={{display:"flex",gap:10}}>
          <button
            onClick={() => onSave(title)}
            style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1565c0,#0288d1)",cursor:"pointer",fontSize:14,fontWeight:600,color:"white",fontFamily:"inherit",boxShadow:"0 4px 12px rgba(21,101,192,0.4)"}}
          >
            Save Recording
          </button>
        </div>
      </div>
    </div>
  );
}

function SyncProgressBar({ progress, setSyncProgress, setRecState, onRetryNow }) {
  if (!progress) return null;

  if (progress.phase === "safe_to_close") {
    return (
      <div style={{margin:"8px 16px 0",background:"white",borderRadius:14,padding:"20px 18px",
        boxShadow:"0 2px 8px rgba(22,163,74,0.10)",border:"1px solid rgba(22,163,74,0.18)",animation:"fadeIn 0.2s",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:8}}>✅</div>
        <div style={{fontSize:18,fontWeight:700,color:"#1a2332",marginBottom:6}}>Thanks — all done</div>
        <p style={{fontSize:13,color:"#64748b",lineHeight:1.5,margin:"0 0 16px"}}>
          It's safe to close the app now. Your meeting notes will arrive by email in about {progress.estimateMinutes} minutes and appear in your Notewell dashboard shortly after.
        </p>
        <div style={{display:"flex",gap:12,justifyContent:"center"}}>
          <button
            onClick={() => {
              setSyncProgress(null);
              document.getElementById("recordings-list")?.scrollIntoView({ behavior: "smooth" });
            }}
            style={{flex:1,padding:"10px 14px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#1565c0,#0288d1)",cursor:"pointer",fontSize:13,fontWeight:600,color:"white",fontFamily:"inherit",boxShadow:"0 4px 12px rgba(21,101,192,0.4)"}}
          >
            View my recordings
          </button>
          <button
            onClick={() => { setSyncProgress(null); setRecState("idle"); }}
            style={{flex:1,padding:"10px 14px",borderRadius:10,border:"1.5px solid rgba(21,101,192,0.25)",background:"white",cursor:"pointer",fontSize:13,fontWeight:600,color:"#1565c0",fontFamily:"inherit"}}
          >
            Record another
          </button>
        </div>
      </div>
    );
  }

  // Error / paused states — specific messaging per failure type
  if (progress.phase === "paused" || progress.phase === "error") {
    const errorMessages = {
      network_drop: { icon: "📡", title: "Upload paused", body: "Your connection dropped. We'll retry automatically when you're back online.", showKeepWaiting: true },
      timeout: { icon: "⏱️", title: "Upload is taking longer than expected", body: "The server didn't respond in time.", showKeepWaiting: true },
      server_error: { icon: "🔧", title: "Notewell servers are busy", body: "We'll retry automatically in a moment.", showKeepWaiting: true },
      auth_expired: { icon: "🔒", title: "Session expired", body: "Please sign in again to sync your recording.", showSignIn: true },
      zero_bytes: { icon: "⚠️", title: "Recording appears to be empty", body: "This recording contains no audio data.", showDelete: true },
      quota_exceeded: { icon: "📦", title: "Storage is full", body: "Your Notewell storage is full. Please contact support.", showContactSupport: true },
      edge_function_timeout: { icon: "✅", title: "Audio uploaded successfully", body: "Transcription is delayed. We'll email you when it's ready.", isPartialSuccess: true },
      max_retries: { icon: "⚠️", title: "Upload failed after 4 attempts", body: `Error: ${progress.errorDetail || "Network timeout"}. Your recording is safe locally.`, showRetry: true },
      unknown: { icon: "⚠️", title: "Sync failed", body: progress.errorDetail || "An unexpected error occurred.", showRetry: true },
    };
    const errType = progress.errorType || "unknown";
    const msg = errorMessages[errType] || errorMessages.unknown;

    return (
      <div style={{margin:"8px 16px 0",background:"white",borderRadius:14,padding:"20px 18px",
        boxShadow:"0 2px 8px rgba(220,38,38,0.10)",border:`1px solid ${msg.isPartialSuccess ? "rgba(22,163,74,0.18)" : "rgba(220,38,38,0.18)"}`,animation:"fadeIn 0.2s"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
          <span style={{fontSize:28}}>{msg.icon}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:700,color:"#1a2332",marginBottom:4}}>{msg.title}</div>
            <div style={{fontSize:13,color:"#64748b",lineHeight:1.5,marginBottom:8}}>{msg.body}</div>
            {progress.recordingTitle && (
              <div style={{fontSize:12,color:"#94a3b8",marginBottom:2}}>{progress.recordingTitle}</div>
            )}
            {(progress.totalSizeLabel || progress.durationLabel) && (
              <div style={{fontSize:11,color:"#94a3b8",marginBottom:8}}>
                {[progress.totalSizeLabel, progress.durationLabel].filter(Boolean).join(" · ")} · saved locally ✓
              </div>
            )}
            {progress.retryAttempt > 0 && progress.maxRetries && (
              <div style={{fontSize:11,color:"#f59e0b",fontWeight:600,marginBottom:8}}>
                Retrying… ({progress.retryAttempt} of {progress.maxRetries})
              </div>
            )}
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          {(msg.showRetry || msg.showKeepWaiting) && (
            <button onClick={onRetryNow} style={{flex:1,padding:"10px 14px",borderRadius:10,border:"none",
              background:"linear-gradient(135deg,#1565c0,#0288d1)",cursor:"pointer",fontSize:13,fontWeight:600,
              color:"white",fontFamily:"inherit",boxShadow:"0 3px 10px rgba(21,101,192,0.35)"}}>
              Retry now
            </button>
          )}
          {msg.showKeepWaiting && (
            <button onClick={() => {}} style={{flex:1,padding:"10px 14px",borderRadius:10,
              border:"1.5px solid rgba(21,101,192,0.25)",background:"white",cursor:"pointer",fontSize:13,
              fontWeight:600,color:"#1565c0",fontFamily:"inherit"}}>
              Keep waiting
            </button>
          )}
          {msg.showSignIn && (
            <button onClick={() => { setSyncProgress(null); window.location.href = "/auth"; }} style={{flex:1,padding:"10px 14px",borderRadius:10,border:"none",
              background:"linear-gradient(135deg,#1565c0,#0288d1)",cursor:"pointer",fontSize:13,fontWeight:600,
              color:"white",fontFamily:"inherit"}}>
              Sign in
            </button>
          )}
          {msg.isPartialSuccess && (
            <button onClick={() => setSyncProgress(null)} style={{flex:1,padding:"10px 14px",borderRadius:10,border:"none",
              background:"linear-gradient(135deg,#16a34a,#22c55e)",cursor:"pointer",fontSize:13,fontWeight:600,
              color:"white",fontFamily:"inherit"}}>
              OK, got it
            </button>
          )}
        </div>
      </div>
    );
  }

  // Dedicated upload progress screen
  if (progress.phase === "uploading") {
    return (
      <div style={{margin:"8px 16px 0",background:"white",borderRadius:14,padding:"20px 18px",
        boxShadow:"0 2px 8px rgba(21,101,192,0.10)",border:"1px solid rgba(21,101,192,0.15)",animation:"fadeIn 0.2s"}}>
        <div style={{fontSize:15,fontWeight:700,color:"#1a2332",marginBottom:4}}>Uploading your recording</div>
        {progress.recordingTitle && (
          <div style={{fontSize:12,color:"#64748b",marginBottom:2}}>{progress.recordingTitle}</div>
        )}
        {(progress.totalSizeLabel || progress.durationLabel) && (
          <div style={{fontSize:11,color:"#94a3b8",marginBottom:12}}>
            {[progress.totalSizeLabel, progress.durationLabel].filter(Boolean).join(" · ")}
          </div>
        )}
        <div style={{width:"100%",height:8,borderRadius:4,background:"#f1f5f9",overflow:"hidden",marginBottom:6}}>
          <div style={{
            width:`${progress.percentComplete}%`,height:"100%",borderRadius:4,
            background:"linear-gradient(90deg, #1565c0, #0288d1)",
            transition:"width 0.3s ease-out",
          }}/>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:12,fontWeight:600,color:"#1565c0"}}>{progress.percentComplete}%</span>
          <span style={{fontSize:11,color:"#94a3b8"}}>{progress.message}</span>
        </div>
        {progress.retryAttempt > 0 && (
          <div style={{marginTop:6,fontSize:11,color:"#f59e0b",fontWeight:600}}>
            Retrying… ({progress.retryAttempt} of {progress.maxRetries || 4})
          </div>
        )}
        <div style={{marginTop:12,display:"flex",alignItems:"center",gap:6,padding:"8px 10px",borderRadius:8,background:"#fef3c7",border:"1px solid rgba(245,158,11,0.25)"}}>
          <span style={{fontSize:14}}>📱</span>
          <span style={{fontSize:11,color:"#92400e",fontWeight:500}}>Keep this tab open and screen on for fastest sync</span>
        </div>
      </div>
    );
  }

  const phaseColors = {
    uploading: "#1565c0",
    transcribing: "#7c3aed",
    stitching: "#f59e0b",
    complete: "#16a34a",
    error: "#dc2626",
  };
  const color = phaseColors[progress.phase] || "#1565c0";
  return (
    <div style={{margin:"8px 16px 0",background:"white",borderRadius:14,padding:"12px 14px",
      boxShadow:"0 2px 8px rgba(21,101,192,0.07)",border:"1px solid rgba(21,101,192,0.09)",animation:"fadeIn 0.2s"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <span style={{fontSize:12,fontWeight:600,color:"#1a2332"}}>{progress.message}</span>
        <span style={{fontSize:11,fontWeight:700,color}}>{progress.percentComplete}%</span>
      </div>
      <div style={{width:"100%",height:6,borderRadius:3,background:"#f1f5f9",overflow:"hidden"}}>
        <div style={{
          width:`${progress.percentComplete}%`,height:"100%",borderRadius:3,
          background:`linear-gradient(90deg, ${color}, ${color}cc)`,
          transition:"width 0.5s ease-out",
        }}/>
      </div>
      {progress.phase === "transcribing" && progress.totalChunks > 1 && (
        <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>
          Segment {progress.currentChunk} of {progress.totalChunks}
        </div>
      )}
    </div>
  );
}

// ─── Needs Attention section ──────────────────────────────────────────────
function NeedsAttentionSection({ recordings, onSync, onDelete, onDownloadAudio, onEmailAudio, isEmailing }) {
  const failedRecs = recordings.filter(r =>
    r.status === "error" || (r.status === "paused" && r.syncRetryCount >= 4)
  );
  if (failedRecs.length === 0) return null;

  return (
    <div style={{margin:"8px 16px 0"}}>
      <div style={{
        background:"white",borderRadius:14,overflow:"hidden",
        border:"1.5px solid rgba(245,158,11,0.4)",
        boxShadow:"0 2px 8px rgba(245,158,11,0.10)",
      }}>
        <div style={{padding:"10px 14px",background:"linear-gradient(135deg, #fef3c7, #fff7ed)",borderBottom:"1px solid rgba(245,158,11,0.2)",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:14}}>⚠</span>
          <span style={{fontSize:12,fontWeight:700,color:"#92400e",textTransform:"uppercase",letterSpacing:0.5}}>
            Needs attention ({failedRecs.length})
          </span>
        </div>
        {failedRecs.map(rec => (
          <div key={rec.id} style={{padding:"12px 14px",borderBottom:"1px solid rgba(245,158,11,0.12)"}}>
            <div style={{fontSize:13,fontWeight:600,color:"#1a2332",marginBottom:2}}>{rec.title || "Untitled recording"}</div>
            <div style={{fontSize:11,color:"#64748b",marginBottom:2}}>
              {fmtDate(rec.createdAt)} · {fmtTime(rec.duration)} · {fmtSize(rec.size)}
            </div>
            {rec.syncRetryCount > 0 && (
              <div style={{fontSize:11,color:"#dc2626",marginBottom:2}}>
                Failed after {rec.syncRetryCount} attempt{rec.syncRetryCount !== 1 ? "s" : ""}
                {rec.lastSyncError ? ` · ${rec.lastSyncError}` : ""}
              </div>
            )}
            <div style={{display:"flex",gap:6,marginTop:8}}>
              <button onClick={() => onSync(rec)} style={{
                padding:"6px 14px",borderRadius:8,border:"none",
                background:"linear-gradient(135deg,#1565c0,#0288d1)",color:"white",
                fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              }}>Retry</button>
              <button onClick={() => onDelete(rec.id)} style={{
                padding:"6px 14px",borderRadius:8,border:"1px solid rgba(220,38,38,0.3)",
                background:"rgba(220,38,38,0.05)",color:"#dc2626",
                fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              }}>Delete</button>
              <button onClick={() => onDownloadAudio(rec)} style={{
                padding:"6px 14px",borderRadius:8,border:"1px solid rgba(21,101,192,0.2)",
                background:"rgba(21,101,192,0.05)",color:"#1565c0",
                fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
              }}>💾</button>
              <button onClick={() => onEmailAudio(rec)} disabled={isEmailing} style={{
                padding:"6px 14px",borderRadius:8,border:"1px solid rgba(21,101,192,0.2)",
                background:"rgba(21,101,192,0.05)",color:"#1565c0",
                fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                opacity:isEmailing?0.6:1,
              }}>📧</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sync diagnostic logger ──────────────────────────────────────────────
async function logSyncDiagnostic(recId, event) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(recId);
    getReq.onsuccess = () => {
      const rec = getReq.result;
      if (!rec) return;
      const diagnostics = rec.syncDiagnostics || [];
      diagnostics.push({
        timestamp: new Date().toISOString(),
        ...event,
        networkType: navigator.connection?.effectiveType || "unknown",
        online: navigator.onLine,
        userAgent: navigator.userAgent.substring(0, 120),
      });
      // Keep last 50 entries
      if (diagnostics.length > 50) diagnostics.splice(0, diagnostics.length - 50);
      store.put({ ...rec, syncDiagnostics: diagnostics });
    };
  } catch { /* diagnostics are best-effort */ }
}

function ProgressBadge({ tone, label }) {
  const tones = {
    green: { bg:"rgba(22,163,74,0.1)",  color:"#15803d", border:"rgba(22,163,74,0.25)" },
    amber: { bg:"rgba(245,158,11,0.1)", color:"#b45309", border:"rgba(245,158,11,0.25)" },
    red:   { bg:"rgba(220,38,38,0.08)", color:"#b91c1c", border:"rgba(220,38,38,0.25)" },
  };
  const t = tones[tone] || tones.amber;
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",
      padding:"2px 7px",borderRadius:20,fontSize:10,fontWeight:600,lineHeight:1.2,
      background:t.bg,color:t.color,border:`1px solid ${t.border}`,whiteSpace:"nowrap",
    }}>{label}</span>
  );
}

function RecordingItem({ rec, progress, onDelete, onSync, onPlay, isPlaying, onRetranscribe, isRetranscribing, onEmailAudio, isEmailing, onForceRetry, isForceRetrying, onDownloadAudio }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [syncClicked, setSyncClicked] = useState(false);
  const colors = {
    local:       { dot:"#f59e0b", bg:"rgba(245,158,11,0.1)",  border:"rgba(245,158,11,0.25)",  label:"Saved locally" },
    syncing:     { dot:"#1565c0", bg:"rgba(21,101,192,0.08)", border:"rgba(21,101,192,0.2)",   label:"Uploading…" },
    uploaded:    { dot:"#16a34a", bg:"rgba(22,163,74,0.08)",  border:"rgba(22,163,74,0.2)",    label:"Uploaded ✓" },
    synced:      { dot:"#16a34a", bg:"rgba(22,163,74,0.08)",  border:"rgba(22,163,74,0.2)",    label:"Synced" },
    transcribed: { dot:"#16a34a", bg:"rgba(22,163,74,0.06)",  border:"rgba(22,163,74,0.2)",    label:"Meeting Created ✓" },
    error:       { dot:"#dc2626", bg:"rgba(220,38,38,0.07)",  border:"rgba(220,38,38,0.2)",    label:"Sync failed" },
    too_short:   { dot:"#f59e0b", bg:"rgba(245,158,11,0.08)", border:"rgba(245,158,11,0.25)", label:"Too short — no meeting created" },
  };
  const c = colors[rec.status] ?? colors.local;

  const ageMs = Date.now() - new Date(rec.createdAt).getTime();
  const isOldAndDone = ageMs > 24 * 60 * 60 * 1000 && (rec.status === "transcribed" || rec.meetingId);
  const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  const showExpandableActions = rec.status === "transcribed" && rec.meetingId;
  const showTooShortActions = rec.status === "too_short";
  const needsSync = rec.status === "local" || rec.status === "error" || rec.status === "too_short" || (rec.status === "transcribed" && !rec.meetingId);
  const isSyncing = rec.status === "syncing" || syncClicked;

  const handleSync = () => {
    setSyncClicked(true);
    onSync(rec);
  };

  // Reset syncClicked when status changes away from syncing
  useEffect(() => {
    if (rec.status !== "syncing") setSyncClicked(false);
  }, [rec.status]);

  return (
    <div style={{background:"white",borderRadius:16,padding:"12px 14px",marginBottom:8,
      display:"flex",flexDirection:"column",gap:0,
      boxShadow:"0 2px 8px rgba(21,101,192,0.07)",border: isOldAndDone ? "1.5px solid rgba(245,158,11,0.4)" : "1px solid rgba(21,101,192,0.09)",
      animation:"fadeIn 0.2s ease-out",
    }}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <button onClick={()=>onPlay(rec)} style={{
          width:38,height:38,borderRadius:"50%",border:"none",cursor:"pointer",flexShrink:0,
          background:isPlaying?"linear-gradient(135deg,#1565c0,#0288d1)":"#f0f4fb",
          display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:isPlaying?"0 3px 10px rgba(21,101,192,0.4)":"none",transition:"all 0.2s",
        }}>
          {isPlaying
            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            : <svg width="12" height="12" viewBox="0 0 24 24" fill="#1565c0"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          }
        </button>

        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600,color:"#1a2332",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {rec.title}
          </div>
          <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>
            {fmtDate(rec.createdAt)} · {fmtTime(rec.duration)} · {fmtSize(rec.size)}
            {rec.chunkCount > 1 ? ` · ${rec.chunkCount} segments` : ""}
          </div>
          {/* Status badge — hide for local/error since sync button replaces it */}
          {!needsSync && (
            <span style={{
              display:"inline-flex",alignItems:"center",gap:4,marginTop:4,
              padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:600,
              background:c.bg,color:c.dot,border:`1px solid ${c.border}`,
            }}>
              <span style={{width:5,height:5,borderRadius:"50%",background:c.dot,
                animation:rec.status==="syncing"?"pulse 1s infinite":"none"}}/>
              {c.label}
              {rec.status === "transcribed" && rec.transcript && (() => {
                const wc = rec.transcript.split(/\s+/).filter(Boolean).length;
                const fmt = wc >= 1000 ? `${(wc / 1000).toFixed(1)}K` : String(wc);
                return <span style={{marginLeft:2,opacity:0.85}}>· {fmt} Words</span>;
              })()}
            </span>
          )}
          {/* Progress badges — show notes/email status once meeting exists */}
          {rec.meetingId && progress && (
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:5}}>
              {progress.word_count > 0 && (
                <ProgressBadge tone="green" label={`✓ ${progress.word_count >= 1000 ? `${(progress.word_count / 1000).toFixed(1)}K` : progress.word_count} words`} />
              )}
              {progress.summary_exists || progress.notes_generation_status === "completed" ? (
                <ProgressBadge tone="green" label="✓ Notes" />
              ) : progress.notes_generation_status === "failed" ? (
                <ProgressBadge tone="red" label="✕ Notes failed" />
              ) : progress.notes_generation_status === "processing" || progress.notes_generation_status === "pending" ? (
                <ProgressBadge tone="amber" label="⋯ Notes" />
              ) : null}
              {progress.notes_email_sent_at ? (
                <ProgressBadge tone="green" label="✓ Email sent" />
              ) : (progress.summary_exists || progress.notes_generation_status === "completed") ? (
                <ProgressBadge tone="amber" label="⋯ Email" />
              ) : null}
            </div>
          )}
          {rec.status === "transcribed" && rec.meetingId && (
            <div style={{fontSize:10,color:"#16a34a",marginTop:3,opacity:0.8,lineHeight:1.3}}>
              ✓ You may now safely delete this recording
            </div>
          )}
        </div>

        <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
          {/* Expandable actions toggle for transcribed recordings */}
          {(showExpandableActions || showTooShortActions) && (
            <button onClick={()=>setActionsOpen(o=>!o)} style={{
              width:28,height:28,borderRadius:8,border:"1px solid rgba(21,101,192,0.15)",
              background:actionsOpen?"rgba(21,101,192,0.1)":"rgba(21,101,192,0.04)",
              cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:14,color:"#1565c0",fontWeight:700,transition:"all 0.2s",
            }}>⋯</button>
          )}
          {confirmDelete ? (
            <div style={{display:"flex",gap:4,alignItems:"center"}}>
              <button onClick={()=>{onDelete(rec.id);setConfirmDelete(false);}} style={{
                padding:"4px 8px",borderRadius:6,border:"none",
                background:"#dc2626",color:"white",fontSize:10,fontWeight:700,
                cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",
              }}>Yes</button>
              <button onClick={()=>setConfirmDelete(false)} style={{
                padding:"4px 8px",borderRadius:6,border:"1px solid #cbd5e1",
                background:"white",color:"#64748b",fontSize:10,fontWeight:700,
                cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",
              }}>No</button>
            </div>
          ) : (
            <button onClick={()=>setConfirmDelete(true)} style={{
              width:28,height:28,borderRadius:8,border:"1px solid rgba(220,38,38,0.2)",
              background:"rgba(220,38,38,0.05)",cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Full-width sync button for recordings that need syncing */}
      {needsSync && (
        <button
          onClick={handleSync}
          disabled={isSyncing}
          style={{
            width:"100%",marginTop:8,padding:"10px 14px",borderRadius:10,border:"none",
            cursor:isSyncing?"not-allowed":"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            transition:"all 0.15s ease",
            ...(rec.status === "error" ? {
              background:"rgba(220,38,38,0.08)",color:"#dc2626",
              border:"1.5px solid rgba(220,38,38,0.3)",
            } : isSyncing ? {
              background:"rgba(21,101,192,0.08)",color:"#1565c0",
              border:"1.5px solid rgba(21,101,192,0.2)",opacity:0.8,
            } : {
              background:"linear-gradient(135deg,#1565c0,#0288d1)",color:"white",
              boxShadow:"0 3px 10px rgba(21,101,192,0.35)",
            }),
          }}
          onTouchStart={e => { if (!isSyncing) e.currentTarget.style.transform = "scale(0.97)"; }}
          onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          {rec.status === "error" ? (
            <>⚠ Sync failed — tap to retry</>
          ) : isSyncing ? (
            <>
              <span style={{width:14,height:14,border:"2px solid rgba(21,101,192,0.3)",borderTopColor:"#1565c0",borderRadius:"50%",animation:"spin 0.8s linear infinite",display:"inline-block"}}/>
              Syncing…
            </>
          ) : rec.status === "transcribed" ? (
            <>⟳ Create Meeting</>
          ) : rec.status === "too_short" ? (
            <>⟳ Re-sync</>
          ) : (
            <>⟳ Sync now</>
          )}
        </button>
      )}

      {/* Expandable actions panel */}
      {(showExpandableActions || showTooShortActions) && actionsOpen && (
        <div style={{
          marginTop:8,padding:"8px 6px",borderRadius:10,
          background:"#f8fafc",border:"1px solid rgba(21,101,192,0.08)",
          display:"flex",gap:8,flexWrap:"wrap",
          animation:"fadeIn 0.15s ease-out",
        }}>
          {showExpandableActions && <button onClick={()=>onRetranscribe?.(rec)} disabled={isRetranscribing} style={{
            padding:"6px 12px",borderRadius:8,border:"1.5px solid rgba(245,158,11,0.4)",
            background:isRetranscribing?"rgba(245,158,11,0.15)":"rgba(245,158,11,0.08)",
            cursor:isRetranscribing?"not-allowed":"pointer",fontSize:11,color:"#b45309",fontWeight:700,fontFamily:"inherit",
            opacity:isRetranscribing?0.7:1,transition:"all 0.2s",whiteSpace:"nowrap",
          }}>{isRetranscribing?"⏳ Processing…":"⟳ Reprocess"}</button>}

          {showTooShortActions && <button onClick={()=>onForceRetry?.(rec)} disabled={isForceRetrying} style={{
            padding:"6px 12px",borderRadius:8,border:"1.5px solid rgba(21,101,192,0.4)",
            background:isForceRetrying?"rgba(21,101,192,0.15)":"linear-gradient(135deg, #1565c0, #0288d1)",
            cursor:isForceRetrying?"not-allowed":"pointer",fontSize:11,color:"white",fontWeight:700,fontFamily:"inherit",
            opacity:isForceRetrying?0.7:1,transition:"all 0.2s",whiteSpace:"nowrap",
            boxShadow:"0 2px 6px rgba(21,101,192,0.3)",
          }}>{isForceRetrying?"⏳ Retrying…":"⟳ Force Retry"}</button>}

          <button onClick={()=>onDownloadAudio?.(rec)} style={{
            padding:"6px 12px",borderRadius:8,border:"1.5px solid rgba(22,163,74,0.4)",
            background:"rgba(22,163,74,0.08)",
            cursor:"pointer",fontSize:11,color:"#15803d",fontWeight:700,fontFamily:"inherit",
            transition:"all 0.2s",whiteSpace:"nowrap",
          }}>💾 Download</button>

          <button onClick={()=>onEmailAudio?.(rec)} disabled={isEmailing} style={{
            padding:"6px 12px",borderRadius:8,border:"1.5px solid rgba(21,101,192,0.3)",
            background:isEmailing?"rgba(21,101,192,0.12)":"rgba(21,101,192,0.06)",
            cursor:isEmailing?"not-allowed":"pointer",fontSize:11,color:"#1565c0",fontWeight:700,fontFamily:"inherit",
            opacity:isEmailing?0.7:1,transition:"all 0.2s",whiteSpace:"nowrap",
          }}>{isEmailing?"📧 Sending…":"📧 Email Audio"}</button>
        </div>
      )}

      {/* Cleanup reminder for old transcribed recordings */}

      {/* Too short — help text */}
      {showTooShortActions && !actionsOpen && (
        <div style={{
          marginTop:8,padding:"8px 10px",borderRadius:10,
          background:"linear-gradient(135deg, #fef3c7, #fff7ed)",
          border:"1px solid rgba(245,158,11,0.25)",
          animation:"fadeIn 0.15s ease-out",
        }}>
          <div style={{fontSize:11,color:"#92400e",lineHeight:1.4}}>
            ⚠️ Transcription returned too few words. Tap <strong>⋯</strong> for recovery options: Force Retry, Download, or Email the audio.
          </div>
        </div>
      )}

      {isOldAndDone && (
        <div style={{
          marginTop:8, padding:"8px 10px", borderRadius:10,
          background:"linear-gradient(135deg, #fef3c7, #fde68a)",
          display:"flex", alignItems:"center", gap:8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.5" style={{flexShrink:0}}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{fontSize:11,color:"#92400e",flex:1,lineHeight:1.4}}>
            Notes generated {ageDays} day{ageDays !== 1 ? "s" : ""} ago — delete to free up space
          </span>
          <button onClick={()=>setConfirmDelete(true)} style={{
            padding:"4px 10px",borderRadius:8,border:"none",
            background:"#b45309",color:"white",fontSize:10,fontWeight:700,
            cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",
          }}>Delete</button>
        </div>
      )}
    </div>
  );
}

function Toast({ msg, type }) {
  const bg = { success:"#16a34a", error:"#dc2626", info:"#1565c0" }[type] ?? "#1565c0";
  const icon = { success:"✓", error:"✕", info:"ℹ" }[type] ?? "";
  return (
    <div style={{
      position:"absolute",bottom:96,left:"50%",transform:"translateX(-50%)",
      background:bg,color:"white",padding:"10px 18px",borderRadius:20,
      fontSize:13,fontWeight:500,whiteSpace:"nowrap",
      boxShadow:"0 4px 16px rgba(0,0,0,0.2)",animation:"fadeIn 0.2s",zIndex:80,
    }}>
      {icon} {msg}
    </div>
  );
}

function StepsGuide({ mode = "live" }) {
  const [open, setOpen] = useState(true);
  const MicIcon = () => (
    <img src="/android-chrome-192x192.png" alt="" width="20" height="20" style={{display:"inline-block",objectFit:"contain"}}/>
  );
  const SaveIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1565c0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline-block"}}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  );
  const SparkIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1565c0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline-block"}}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  );
  const LiveIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1565c0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline-block"}}>
      <path d="M2 12a10 10 0 0 1 20 0M5 12a7 7 0 0 1 14 0M8 12a4 4 0 0 1 8 0"/>
      <circle cx="12" cy="12" r="1.5" fill="#1565c0"/>
    </svg>
  );
  const steps = mode === "live"
    ? [
        {n:"1",Icon:MicIcon, label:"Tap record to start"},
        {n:"2",Icon:LiveIcon,label:"Live transcription"},
        {n:"3",Icon:SparkIcon,label:"Notes generated on stop"},
      ]
    : [
        {n:"1",Icon:MicIcon, label:"Tap record to start"},
        {n:"2",Icon:SaveIcon,label:"Saved to device"},
        {n:"3",Icon:SparkIcon,label:"Notes generated on sync"},
      ];
  return (
    <div style={{margin:"8px 16px 0"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"8px 12px",background:"white",borderRadius:open?"12px 12px 0 0":"12px",
        border:"1px solid rgba(21,101,192,0.08)",borderBottom:open?"none":"1px solid rgba(21,101,192,0.08)",
        cursor:"pointer",boxShadow:"0 2px 8px rgba(21,101,192,0.05)",fontFamily:"inherit",
      }}>
        <span style={{fontSize:11,fontWeight:600,color:"#94a3b8",letterSpacing:0.5,textTransform:"uppercase"}}>How it works</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"
          style={{transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div style={{display:"flex",gap:6,background:"white",borderRadius:"0 0 12px 12px",padding:"8px 10px 10px",
          border:"1px solid rgba(21,101,192,0.08)",borderTop:"none",
          boxShadow:"0 2px 8px rgba(21,101,192,0.05)",animation:"fadeIn 0.15s"}}>
          {steps.map(s=>(
            <div key={s.n} style={{flex:1,textAlign:"center",padding:"6px 4px"}}>
              <div style={{marginBottom:2,height:18,display:"flex",alignItems:"center",justifyContent:"center"}}><s.Icon/></div>
              <div style={{width:16,height:16,borderRadius:"50%",background:"rgba(21,101,192,0.1)",color:"#1565c0",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 4px"}}>{s.n}</div>
              <div style={{fontSize:10,color:"#475569",lineHeight:1.3,fontWeight:500}}>{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
// ─── Pre-flight warning modal ─────────────────────────────────────────────
const SESSION_KEY = "mobile_recording_warning_shown";

function PreFlightWarningModal({ onStart, onCancel }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"flex-end",justifyContent:"center",background:"rgba(15,23,42,0.55)",backdropFilter:"blur(4px)"}}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"white",borderRadius:"24px 24px 0 0",padding:"20px 20px 28px",width:"100%",maxWidth:480,
        animation:"slideUp 0.3s ease-out",paddingBottom:"calc(28px + env(safe-area-inset-bottom, 0px))",
      }}>
        <div style={{width:40,height:4,background:"#e2e8f0",borderRadius:2,margin:"0 auto 18px"}}/>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <div style={{width:40,height:40,borderRadius:12,background:"rgba(245,158,11,0.12)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div style={{fontSize:17,fontWeight:700,color:"#1a2332",letterSpacing:-0.3}}>Before you start recording</div>
        </div>
        <div style={{fontSize:13,color:"#475569",lineHeight:1.7,marginBottom:18}}>
          For best results during your recording:
          <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:4}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:"#16a34a",fontWeight:700}}>✓</span> Keep your screen unlocked</div>
            <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:"#16a34a",fontWeight:700}}>✓</span> Don't switch to other apps</div>
            <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:"#16a34a",fontWeight:700}}>✓</span> Stay in this tab/window</div>
          </div>
          <div style={{marginTop:10,padding:"8px 10px",borderRadius:10,background:"#fef3c7",border:"1px solid rgba(245,158,11,0.3)",fontSize:12,color:"#92400e",lineHeight:1.5}}>
            Your phone will keep the screen awake automatically, but if you lock it manually, recording will pause until you unlock again. The timer will show what was actually captured.
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel} style={{flex:1,padding:"13px",borderRadius:14,border:"1.5px solid #e2e8f0",background:"white",cursor:"pointer",fontSize:14,fontWeight:600,color:"#64748b",fontFamily:"inherit"}}>Cancel</button>
          <button onClick={onStart} style={{flex:1,padding:"13px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#1565c0,#0288d1)",cursor:"pointer",fontSize:14,fontWeight:600,color:"white",fontFamily:"inherit",boxShadow:"0 4px 12px rgba(21,101,192,0.4)"}}>Start Recording</button>
        </div>
      </div>
    </div>
  );
}

// ─── Suspension warning banner ────────────────────────────────────────────
function SuspensionWarningBanner({ seconds, onDismiss }) {
  const formatGap = (s) => {
    if (s < 60) return `${s} second${s !== 1 ? "s" : ""}`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem > 0 ? `${m} min ${rem} sec` : `${m} min`;
  };
  return (
    <div style={{
      margin:"8px 16px 0",padding:"12px 14px",borderRadius:12,
      background:"#fef3c7",border:"2px solid #f59e0b",
      display:"flex",alignItems:"flex-start",gap:8,animation:"fadeIn 0.2s",
    }}>
      <span style={{fontSize:16,flexShrink:0,marginTop:1}}>⚠</span>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:600,color:"#92400e",lineHeight:1.5}}>
          Recording was paused for {formatGap(seconds)} while the screen was locked or you switched apps. Audio during that period was not captured.
        </div>
      </div>
      <button onClick={onDismiss} style={{background:"none",border:"none",cursor:"pointer",padding:4,color:"#92400e",fontSize:16,fontWeight:700,flexShrink:0}}>×</button>
    </div>
  );
}

// ─── Silent audio keep-alive (HTML Audio element) ─────────────────────────
const SILENT_WAV = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
let silentAudioEl = null;
function startSilentAudio() {
  try {
    silentAudioEl = new Audio(SILENT_WAV);
    silentAudioEl.loop = true;
    silentAudioEl.volume = 0.001;
    silentAudioEl.play().catch(err => console.warn("Silent audio session failed:", err));
  } catch (e) { console.warn("Silent audio creation failed:", e); }
}
function stopSilentAudio() {
  if (silentAudioEl) { silentAudioEl.pause(); silentAudioEl.src = ""; silentAudioEl = null; }
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NoteWellRecorder() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, session: authSession, loading: authLoading, refreshSessionStatus } = useAuth();
  // Recording mode + connectivity (persisted preference, three-state pill).
  // Hook owns: localStorage preference, navigator.onLine, auto-fallback flag.
  // We map the hook's "online"/"offline" vocabulary to the recorder's existing
  // "live"/"offline" vocabulary so all downstream call sites
  // (mode === "live" checks, import_source: "mobile_live", audit logging) keep working.
  const recordingMode = useRecordingMode();
  const isOnline = recordingMode.isOnline;
  const setIsOnline = () => {}; // shim — hook owns this; legacy setters become no-ops
  const mode = recordingMode.mode === "online" ? "live" : "offline";
  const setMode = (next) => {
    // Translate legacy setter calls back into the hook's vocabulary.
    // "live"  → user explicitly wants Online
    // "offline" → user explicitly wants Offline (this is what the in-card sheet calls)
    if (next === "live") recordingMode.setMode("online");
    else if (next === "offline") recordingMode.setMode("offline");
  };
  // Tracks "we lost network DURING a live recording, so we're now buffering locally"
  // — drives <ConnectionBanner /> and clears on stop.
  const [connectionLostMidRecord, setConnectionLostMidRecord] = useState(false);
  const [recState,      setRecState]      = useState("idle");   // idle|recording|paused
  const [elapsed,       setElapsed]       = useState(0);        // ms elapsed
  const [recordings,    setRecordings]    = useState([]);
  const [meetingProgress, setMeetingProgress] = useState({}); // { [meetingId]: { word_count, notes_generation_status, summary_exists, notes_email_sent_at } }
  const [showSheet,     setShowSheet]     = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [titleModal,    setTitleModal]    = useState(null);     // { chunks, duration, totalSize, chunkCount }
  const [playingId,     setPlayingId]     = useState(null);
  const [toast,         setToast]         = useState(null);
  const [storageWarning, setStorageWarning] = useState(null);
  const [retranscribingIds, setRetranscribingIds] = useState({});
  const [emailingIds, setEmailingIds] = useState({});
  const [forceRetryingIds, setForceRetryingIds] = useState({});
  const [chunksCompleted, setChunksCompleted] = useState(0);
  const [syncProgress,  setSyncProgress]  = useState(null);
  const [bitrate,       setBitrate]       = useState(getSavedBitrate());
  const [activeStream,  setActiveStream]  = useState(null);  // MediaStream for waveform
  // Mobile default: Deepgram live (more resilient on cellular/lock-screen than AssemblyAI).
  // Whisper chunked always runs in parallel via the recorder, giving 2-engine BoA.
  // AssemblyAI is selectable but kept off-by-default on mobile due to socket drop-outs.
  const [liveEngine,    setLiveEngine]    = useState("deepgram"); // assemblyai|deepgram|browser-speech
  const [liveTranscript, setLiveTranscript] = useState("");
  const [liveWordCount, setLiveWordCount] = useState(0);
  const [liveExpanded,  setLiveExpanded]  = useState(false);
  const peakWordCountRef = useRef(0);
  const [livePartial,   setLivePartial]   = useState("");
  const [liveStatus,    setLiveStatus]    = useState("idle"); // idle|connecting|connected|error
  const liveClientRef   = useRef(null);  // AssemblyRealtimeClient or UnifiedTranscriber
  const capturedLiveTranscriptRef = useRef(""); // Captured on stop for rescue fallback
  const recorderRef  = useRef(null);  // ChunkedRecorder instance
  const timerRef     = useRef(null);
  const audioRef     = useRef(new Audio());
  const healthCheckRef = useRef(null); // Stream health monitor interval
  const [wakeLockStatus, setWakeLockStatus] = useState("unsupported"); // unsupported|active|inactive
  const { requestLock, releaseLock, isLocked, isSupported: wakeLockSupported } = useWakeLock();

  // ── Pre-flight modal state ──
  const [showPreFlight, setShowPreFlight] = useState(false);

  const navigateToSignIn = useCallback((returnTo = location.pathname || "/new-recorder") => {
    navigate(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
  }, [location.pathname, navigate]);

  const ensureSignedIn = useCallback(async (returnTo = location.pathname || "/new-recorder") => {
    if (authUser && authSession) return authSession;
    const currentSession = await refreshSessionStatus();
    if (currentSession?.user) return currentSession;
    showToast("Please sign in to use online recording and meetings", "error");
    navigateToSignIn(returnTo);
    return null;
  }, [authSession, authUser, location.pathname, navigateToSignIn, refreshSessionStatus]);

  // ── Honest timer state (visibility-aware) ──
  const lastTickRef = useRef(Date.now());
  const [isPageHidden, setIsPageHidden] = useState(false);

  // ── Suspension detection state ──
  const hiddenSinceRef = useRef(null);
  const [suspensionWarning, setSuspensionWarning] = useState(null);
  const suspensionGapsRef = useRef([]); // [{from, to, seconds}]

  // ── Sync wake lock status with hook state ──────────────────────────────────
  useEffect(() => {
    if (recState !== "idle") {
      setWakeLockStatus(isLocked ? "active" : (wakeLockSupported ? "inactive" : "unsupported"));
    }
  }, [isLocked, recState, wakeLockSupported]);

  // ── Connectivity (track online status + auto-resume queued syncs) ──────
  // Network state is now owned by useRecordingMode(); this effect handles
  // side-effects only (sync resume + mid-record drop banner).
  // Use a ref to read current recState/mode inside the listeners without
  // re-binding on every render.
  const recStateRef = useRef(recState);
  useEffect(() => { recStateRef.current = recState; }, [recState]);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    const goOnline = async () => {
      // Auto-resume any failed/paused recordings
      const allRecs = await dbAll();
      const resumable = allRecs.filter(r => r.status === "error" || r.status === "paused");
      if (resumable.length > 0) {
        showToast(`Back online — resuming sync of ${resumable.length} recording${resumable.length > 1 ? "s" : ""}`, "info");
        // Only auto-retry the first one to avoid overwhelming
        setTimeout(() => {
          if (resumable[0]) syncRecording(resumable[0]);
        }, 1500);
      }
    };
    const goOffline = () => {
      // If we drop while recording in live mode, raise the mid-record banner.
      // Recording continues into the local buffer (existing chunked recorder
      // behaviour); the buffer will sync on stop. We do NOT mutate the user's
      // mode preference — the hook's auto-fallback handles the pill display.
      if (
        recStateRef.current !== "idle" &&
        modeRef.current === "live"
      ) {
        setConnectionLostMidRecord(true);
      }
      // If sync is in progress, show paused state
      if (syncProgress && syncProgress.phase === "uploading") {
        setSyncProgress(prev => ({
          ...prev,
          phase: "paused",
          errorType: "network_drop",
          message: "Connection lost — will resume when back online",
        }));
      }
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [syncProgress]);

  // ── Page Visibility API (iOS Safari tab suspension + honest timer + suspension detection) ──
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPageHidden(true);
        // Track when we went hidden for suspension detection
        if (recState === "recording" || recState === "paused") {
          hiddenSinceRef.current = Date.now();
        }
        // Tab backgrounded — update title as warning
        if (syncProgress && syncProgress.phase === "uploading") {
          document.title = "(⏸ Sync paused) Notewell";
        }
      } else {
        setIsPageHidden(false);
        // Reset the tick reference so the honest timer doesn't count the gap
        lastTickRef.current = Date.now();
        // Suspension detection: calculate gap
        if (hiddenSinceRef.current && (recState === "recording" || recState === "paused")) {
          const gapSeconds = Math.round((Date.now() - hiddenSinceRef.current) / 1000);
          if (gapSeconds > 10) {
            const gap = { from: hiddenSinceRef.current, to: Date.now(), seconds: gapSeconds };
            suspensionGapsRef.current = [...suspensionGapsRef.current, gap];
            setSuspensionWarning({ seconds: gapSeconds });
            console.warn(`⚠️ Recording suspended for ${gapSeconds}s while page was hidden`);
          }
          hiddenSinceRef.current = null;
        }
        // Tab restored — reset title and check upload state
        document.title = "Notewell AI";
        if (syncProgress && (syncProgress.phase === "paused" || syncProgress.phase === "uploading")) {
          // Check if we're still online and should resume
          if (navigator.onLine) {
            console.log("[sync] tab restored — checking upload state");
          }
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [syncProgress]);

  // ── Load saved recordings ─────────────────────────────────────────────────
  const refresh = useCallback(() => dbAll().then(setRecordings).catch(console.error), []);
  useEffect(() => { refresh(); }, [refresh]);

  // ── Recover orphaned "syncing" recordings on mount ────────────────────────
  // If the page was refreshed/closed mid-sync, recordings can be left stuck in
  // "syncing" status with no active upload running. Mark them as "error" so the
  // user gets a visible retry button.
  useEffect(() => {
    (async () => {
      try {
        const all = await dbAll();
        const orphans = all.filter(r => r.status === "syncing");
        if (orphans.length === 0) return;
        for (const rec of orphans) {
          await dbPatch(rec.id, {
            status: "error",
            lastSyncError: "Upload interrupted — tap retry",
          });
        }
        await refresh();
        showToast(
          `${orphans.length} recording${orphans.length > 1 ? "s" : ""} interrupted — tap retry to resume`,
          "info"
        );
      } catch (e) {
        console.warn("[recover-syncing] failed", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Poll meeting progress for recordings linked to a meeting (notes / email status) ──
  useEffect(() => {
    const meetingIds = recordings.map(r => r.meetingId).filter(Boolean);
    if (meetingIds.length === 0) return;

    let cancelled = false;
    const fetchProgress = async () => {
      try {
        const { data, error } = await supabase
          .from("meetings")
          .select("id, word_count, notes_generation_status, notes_email_sent_at")
          .in("id", meetingIds);
        if (error || cancelled || !data) return;

        const summaryRes = await supabase
          .from("meeting_summaries")
          .select("meeting_id")
          .in("meeting_id", meetingIds);
        const summarySet = new Set((summaryRes.data || []).map(s => s.meeting_id));

        const map = {};
        data.forEach(m => {
          map[m.id] = {
            word_count: m.word_count,
            notes_generation_status: m.notes_generation_status,
            notes_email_sent_at: m.notes_email_sent_at,
            summary_exists: summarySet.has(m.id),
          };
        });
        if (!cancelled) setMeetingProgress(map);
      } catch (e) {
        console.warn("[progress] fetch failed", e);
      }
    };

    fetchProgress();
    // Poll every 20s while there are pending notes/email
    const iv = setInterval(fetchProgress, 20000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [recordings]);

  // Auto-delete completed recordings (Meeting Created ✓) after 1 hour
  useEffect(() => {
    const ONE_HOUR = 60 * 60 * 1000;
    const cleanup = async () => {
      const all = await dbAll();
      let deleted = false;
      for (const rec of all) {
        if (rec.status === "transcribed" && rec.meetingId) {
          const age = Date.now() - new Date(rec.createdAt).getTime();
          if (age > ONE_HOUR) {
            await dbDelete(rec.id);
            deleted = true;
          }
        }
      }
      if (deleted) refresh();
    };
    cleanup();
    const iv = setInterval(cleanup, 5 * 60 * 1000); // check every 5 minutes
    return () => clearInterval(iv);
  }, [refresh]);

  // ── Storage quota check ───────────────────────────────────────────────────
  useEffect(() => {
    const checkStorage = async () => {
      if (!navigator.storage?.estimate) return;
      try {
        const { usage, quota } = await navigator.storage.estimate();
        const usedMB = Math.round((usage || 0) / (1024 * 1024));
        const percentUsed = quota ? Math.round(((usage || 0) / quota) * 100) : 0;
        const hasLocalRecordings = recordings.some(r => r.status === "local" || r.status === "error" || r.status === "transcribed");
        if ((usedMB > 500 || percentUsed > 80) && hasLocalRecordings) {
          setStorageWarning({ usedMB, percentUsed });
        } else {
          setStorageWarning(null);
        }
      } catch { /* ignore */ }
    };
    checkStorage();
  }, [recordings]);

  const showToast = (msg, type="info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Live transcription engine ──────────────────────────────────────────────
  const startLiveTranscription = useCallback(async (stream, engineOverride) => {
    const engine = engineOverride || liveEngine;
    if (mode !== "live" || !isOnline) return;
    stopLiveTranscription();
    setLiveStatus("connecting");
    setLiveTranscript("");
    setLivePartial("");

    try {
      if (engine === "assemblyai") {
        const client = new AssemblyRealtimeClient({
          onOpen: () => setLiveStatus("connected"),
          onPartial: (text) => setLivePartial(text),
          onFinal: (text) => {
            setLiveTranscript(prev => {
              const p = typeof prev === "string" ? prev : "";
              const t = typeof text === "string" ? text : String(text || "");
              const updated = p ? p + " " + t : t;
              const newCount = updated.split(/\s+/).filter(Boolean).length;
              if (newCount > peakWordCountRef.current) { peakWordCountRef.current = newCount; setLiveWordCount(newCount); }
              return updated;
            });
            setLivePartial("");
          },
          onError: (err) => {
            console.error("[LiveTranscript] AssemblyAI error:", err);
            setLiveStatus("error");
          },
          onClose: () => setLiveStatus("idle"),
        });
        await client.start(stream);
        liveClientRef.current = client;
        setLiveStatus("connected");
      } else if (engine === "whisper") {
        // Whisper chunk transcriber — sends audio chunks to edge function
        const transcriber = new WhisperChunkTranscriber(
          (data) => {
            const t = typeof data === "object" ? (data?.text ?? "") : String(data || "");
            if (!t.trim()) return;
            setLiveTranscript(prev => {
              const p = typeof prev === "string" ? prev : "";
              const updated = p ? p + " " + t : t;
              const newCount2 = updated.split(/\s+/).filter(Boolean).length;
              if (newCount2 > peakWordCountRef.current) { peakWordCountRef.current = newCount2; setLiveWordCount(newCount2); }
              return updated;
            });
          },
          (err) => {
            console.error("[LiveTranscript] Whisper error:", err);
            setLiveStatus("error");
          },
          (status) => {
            const s = status.toLowerCase();
            if (s.includes("recording") || s.includes("processing")) setLiveStatus("connected");
          },
          { firstChunkDurationMs: 5000, subsequentChunkDurationMs: 90000 }
        );
        await transcriber.startTranscription();
        liveClientRef.current = transcriber;
        setLiveStatus("connected");
      } else {
        // Deepgram or browser-speech via factory
        const transcriber = createTranscriber(engine, {
          onTranscription: (data) => {
            const isFinal = typeof data === "object" && (data?.is_final || data?.isFinal);
            const t = typeof data === "string" ? data : (data?.text ?? String(data || ""));
            if (!t.trim()) return;

            if (typeof data === "string" || isFinal) {
              // Final result — append to committed transcript
              setLiveTranscript(prev => {
                const p = typeof prev === "string" ? prev : "";
                const updated = p ? p + " " + t : t;
                const newCount3 = updated.split(/\s+/).filter(Boolean).length;
                if (newCount3 > peakWordCountRef.current) { peakWordCountRef.current = newCount3; setLiveWordCount(newCount3); }
                return updated;
              });
              setLivePartial("");
            } else {
              // Partial/interim result — show as preview only, don't commit
              setLivePartial(t);
            }
          },
          onError: (err) => {
            console.error(`[LiveTranscript] ${engine} error:`, err);
            setLiveStatus("error");
          },
          onStatusChange: (status) => {
            const s = (status || "").toLowerCase();
            if (s === "recording" || s === "connected" || s === "listening for speech...") setLiveStatus("connected");
          },
        });
        await transcriber.startTranscription();
        liveClientRef.current = transcriber;
        setLiveStatus("connected");
      }
    } catch (err) {
      console.error("[LiveTranscript] Start failed:", err);
      setLiveStatus("error");
    }
  }, [liveEngine, mode, isOnline]);

  const stopLiveTranscription = useCallback(() => {
    if (liveClientRef.current) {
      try {
        if (typeof liveClientRef.current.stop === "function") {
          liveClientRef.current.stop();
        } else if (typeof liveClientRef.current.stopTranscription === "function") {
          liveClientRef.current.stopTranscription();
        }
      } catch { /* ignore */ }
      liveClientRef.current = null;
    }
    setLiveStatus("idle");
  }, []);

  // ── Detect platform for keep-alive ────────────────────────────────────────
  const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // ── Start stream health monitor ──────────────────────────────────────────
  const startHealthMonitor = useCallback((recorder) => {
    if (healthCheckRef.current) clearInterval(healthCheckRef.current);
    healthCheckRef.current = setInterval(() => {
      if (!recorder) return;
      const stream = recorder.mediaStream;
      const track = stream?.getTracks()?.[0];
      if (!track || track.readyState === "ended") {
        console.error("🚨 Stream health check failed: track ended or missing");
        showToast("⚠️ Recording may have been interrupted — stop and save now", "error");
        clearInterval(healthCheckRef.current);
        healthCheckRef.current = null;
      }
    }, 3000);
  }, []);

  const stopHealthMonitor = useCallback(() => {
    if (healthCheckRef.current) {
      clearInterval(healthCheckRef.current);
      healthCheckRef.current = null;
    }
  }, []);

  // ── Recording controls (chunked) ─────────────────────────────────────────
  const startRecording = async () => {
    peakWordCountRef.current = 0;
    setLiveWordCount(0);
    try {
      const recorder = new ChunkedRecorder({
        chunkDurationMs: 15 * 60 * 1000, // 15 minutes
        audioBitrate: bitrate,
        onChunkReady: (chunk) => {
          setChunksCompleted(prev => prev + 1);
          console.log(`[ChunkedRecording] Chunk ${chunk.index} ready: ${(chunk.sizeBytes / 1024 / 1024).toFixed(1)}MB, ${(chunk.durationMs / 1000).toFixed(0)}s`);
        },
        onStatusChange: (status) => console.log(`[ChunkedRecording] Status: ${status}`),
      });
      recorderRef.current = recorder;
      await recorder.start();
      setActiveStream(recorder.mediaStream);
      // Start live transcription with the same stream
      startLiveTranscription(recorder.mediaStream);

      // ── Protection layer 1: Wake Lock ──
      if (wakeLockSupported) {
        const locked = await requestLock();
        setWakeLockStatus(locked ? "active" : "inactive");
        console.log("🔒 Wake Lock:", locked ? "acquired" : "failed");
      } else {
        setWakeLockStatus("unsupported");
      }

      // ── Protection layer 2: Audio Keep-Alive ──
      const keepAlive = isIOSDevice ? iOSAudioKeepAlive : androidAudioKeepAlive;
      await keepAlive.start();

      // ── Protection layer 3: Stream Health Monitor ──
      startHealthMonitor(recorder);

      // ── Protection layer 4: Silent HTML audio keep-alive ──
      startSilentAudio();

      // ── Honest timer: visibility-aware ──
      lastTickRef.current = Date.now();
      suspensionGapsRef.current = [];
      setSuspensionWarning(null);
      setIsPageHidden(false);
      timerRef.current = setInterval(() => {
        if (document.visibilityState === "visible") {
          const now = Date.now();
          const delta = now - lastTickRef.current;
          // Only add delta if reasonable (< 2s to avoid jumps after wake)
          if (delta > 0 && delta < 2000) {
            setElapsed(prev => prev + delta);
          }
          lastTickRef.current = now;
        } else {
          // Page hidden — just reset reference, don't increment
          lastTickRef.current = Date.now();
        }
      }, 250);
      setRecState("recording");
      setChunksCompleted(0);
    } catch {
      showToast("Microphone access denied", "error");
    }
  };

  const pauseRecording = () => {
    // ChunkedRecorder doesn't have native pause — we stop the timer display
    clearInterval(timerRef.current);
    setRecState("paused");
  };

  const resumeRecording = () => {
    // Resume honest timer from where we left off
    lastTickRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        const delta = now - lastTickRef.current;
        if (delta > 0 && delta < 2000) {
          setElapsed(prev => prev + delta);
        }
        lastTickRef.current = now;
      } else {
        lastTickRef.current = Date.now();
      }
    }, 250);
    setRecState("recording");
  };

  const stopRecording = async () => {
    clearInterval(timerRef.current);
    // ── Release protections ──
    stopHealthMonitor();
    await releaseLock();
    setWakeLockStatus("unsupported");
    const keepAlive = isIOSDevice ? iOSAudioKeepAlive : androidAudioKeepAlive;
    keepAlive.stop();
    stopSilentAudio();
    // Capture live transcript BEFORE stopping (it gets cleared on stop)
    // TODO: flush pending partials if/when live pipeline exposes a sync hook.
    // (AssemblyRealtimeClient / AssemblyAIRealtimeTranscriber currently flush
    //  uncommitted words inside .stop() but don't surface them via a sync API,
    //  so we rely on the React-state snapshot below + server-side consolidation.)
    capturedLiveTranscriptRef.current = typeof liveTranscript === "string" ? liveTranscript : "";
    const capturedLiveWC = capturedLiveTranscriptRef.current.split(/\s+/).filter(Boolean).length;
    if (capturedLiveWC > 0) {
      console.log(`[StopRecording] Captured live transcript: ${capturedLiveWC} words`);
    }
    stopLiveTranscription();
    if (!recorderRef.current) { setRecState("idle"); return; }

    const chunks = await recorderRef.current.stop();
    recorderRef.current = null;
    setActiveStream(null);
    setRecState("idle");

    if (chunks.length === 0) {
      showToast("No audio recorded", "error");
      setElapsed(0);
      return;
    }

    const totalSize = chunks.reduce((s, c) => s + c.sizeBytes, 0);
    const durationSecs = Math.floor(elapsed / 1000);

    // Auto-save to IndexedDB immediately so the recording is safe before modal appears
    const autoTitle = `Meeting ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short'})} ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`;
    const autoId = `rec_${Date.now()}`;
    const chunkData = await Promise.all(
      chunks.map(async (chunk) => ({
        index: chunk.index,
        arrayBuffer: await chunk.blob.arrayBuffer(),
        mimeType: chunk.blob.type,
        startTimeMs: chunk.startTimeMs,
        endTimeMs: chunk.endTimeMs,
        durationMs: chunk.durationMs,
        sizeBytes: chunk.sizeBytes,
      }))
    );
    const autoRec = {
      id: autoId,
      title: autoTitle,
      createdAt: Date.now(),
      duration: durationSecs,
      size: totalSize,
      mimeType: chunks[0]?.blob.type || 'audio/webm',
      chunks: chunkData,
      chunkCount: chunks.length,
      audioData: chunkData[0]?.arrayBuffer,
      status: 'local',
      capturedLiveTranscript: capturedLiveTranscriptRef.current || '',
    };
    capturedLiveTranscriptRef.current = '';
    setConnectionLostMidRecord(false); // clear mid-record drop banner on stop
    await dbPut(autoRec);
    await refresh();

    // Show the rename modal — recording is already safe in IndexedDB
    setTitleModal({ chunks, duration: durationSecs, totalSize, chunkCount: chunks.length, stoppedElapsed: elapsed, autoSavedId: autoId, autoTitle });
    setElapsed(0);
  };

  const continueRecording = async () => {
    if (!titleModal) return;
    const prevElapsed = titleModal.stoppedElapsed || 0;
    setTitleModal(null);
    try {
      const recorder = new ChunkedRecorder({
        chunkDurationMs: 15 * 60 * 1000,
        audioBitrate: bitrate,
        onChunkReady: (chunk) => {
          setChunksCompleted(prev => prev + 1);
          console.log(`[ChunkedRecording] Chunk ${chunk.index} ready`);
        },
        onStatusChange: (status) => console.log(`[ChunkedRecording] Status: ${status}`),
      });
      recorderRef.current = recorder;
      await recorder.start();
      setActiveStream(recorder.mediaStream);
      startLiveTranscription(recorder.mediaStream);
      // Re-acquire protections
      if (wakeLockSupported) {
        const locked = await requestLock();
        setWakeLockStatus(locked ? "active" : "inactive");
      }
      const keepAlive = isIOSDevice ? iOSAudioKeepAlive : androidAudioKeepAlive;
      await keepAlive.start();
      startSilentAudio();
      startHealthMonitor(recorder);
      lastTickRef.current = Date.now();
      timerRef.current = setInterval(() => {
        if (document.visibilityState === "visible") {
          const now = Date.now();
          const delta = now - lastTickRef.current;
          if (delta > 0 && delta < 2000) {
            setElapsed(prev => prev + delta);
          }
          lastTickRef.current = now;
        } else {
          lastTickRef.current = Date.now();
        }
      }, 250);
      setRecState("recording");
      showToast("Recording resumed", "success");
    } catch (err) {
      console.error("Failed to continue recording:", err);
      showToast("Failed to resume", "error");
    }
  };

  const saveRecording = async (title) => {
    if (!titleModal) return;
    const { duration, totalSize, chunkCount, autoSavedId } = titleModal;

    if (autoSavedId) {
      // Recording already saved — just rename it
      await dbPatch(autoSavedId, { title });
      await refresh();
    }
    // (Fallback: if somehow no autoSavedId, do nothing — data already safe)

    setTitleModal(null);
    showToast('Recording saved', 'success');

    // If online, kick off sync on the renamed record
    if (isOnline) {
      const allRecs = await dbAll();
      const rec = allRecs.find(r => r.id === autoSavedId);
      if (rec) syncRecording({ ...rec, title });
    }
  };

  // ── Generate notes via unified orchestrator pipeline ──────────────────────
  const generateNotesForMeeting = async (meetingId) => {
    const { data, error } = await supabase.functions.invoke('auto-generate-meeting-notes', {
      body: { meetingId, forceRegenerate: false, ...modelOverrideField(), skipQc: true },
    });

    if (error) throw new Error(error.message || 'Note generation failed');
    return data;
  };

  // ── Poll for notes completion after client timeout — still send email ──
  const pollAndEmailIfReady = async (meetingId, toastMsg) => {
    showToast(toastMsg, "info");
    const MAX_POLLS = 36; // 36 × 10s = 6 min max wait (up from 2 min)
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(r => setTimeout(r, 10000));

      // Check notes_generation_status — wait for 'completed' (not just summary existence)
      // because the AI-generated title is saved at the same time as status=completed
      const { data: meetingStatus } = await supabase
        .from("meetings")
        .select("notes_generation_status, title")
        .eq("id", meetingId)
        .maybeSingle();

      if (meetingStatus?.notes_generation_status === "failed") {
        showToast("Note generation failed — meeting saved without notes", "warning");
        return;
      }

      // Only trigger email when status is 'completed' — this guarantees
      // the AI-generated title has been saved to the meetings row
      if (meetingStatus?.notes_generation_status === "completed") {
        const { data: summary } = await supabase
          .from("meeting_summaries")
          .select("id")
          .eq("meeting_id", meetingId)
          .maybeSingle();
        if (summary) {
          showToast("Meeting notes generated ✨", "success");
          triggerPostNoteActions(meetingId);
          return;
        }
      }
    }
    showToast("Meeting saved — note generation may still be processing", "warning");
  };

  // ── Post-note-generation actions (auto-email via shared helper) ──
  const triggerPostNoteActions = async (meetingId) => {
    try {
      // Refresh session first — critical for iPhone offline syncs where
      // the session may have gone stale during a long upload/transcription
      let userEmail = null;
      try {
        const { data: { session } } = await supabase.auth.refreshSession();
        userEmail = session?.user?.email;
      } catch (refreshErr) {
        console.warn("Session refresh before email failed:", refreshErr);
      }
      if (!userEmail) {
        const { data: { user } } = await supabase.auth.getUser();
        userEmail = user?.email;
      }
      if (!userEmail) {
        console.warn("No authenticated user email — skipping auto-email");
        return;
      }

      const { sendMeetingNotesEmail } = await import("@/utils/sendMeetingNotesEmail");
      console.log(`📧 [triggerPostNoteActions] About to send email for meeting ${meetingId} via mobile path`);
      await sendMeetingNotesEmail({
        meetingId,
        recipientEmail: userEmail,
      });
      console.log("✅ Mobile auto-email sent via shared helper");
    } catch (e) {
      console.error("Mobile auto-email failed:", e);
      showToast("Meeting saved but email could not be sent — try 'Email notes to me' manually", "warning");
    }
  };

  // ── Offline sync helpers ────────────────────────────────────────────────
  const getChunkFileExtension = (mimeType = "") => {
    const normalized = String(mimeType).toLowerCase();
    if (normalized.includes("mp4") || normalized.includes("m4a") || normalized.includes("aac")) return "m4a";
    if (normalized.includes("ogg")) return "ogg";
    return "webm";
  };

  const removeChunkTextOverlap = (currentTranscript, previousTranscript, chunkNumber) => {
    if (!currentTranscript || !previousTranscript) return currentTranscript;

    const currentWords = currentTranscript.split(/\s+/).filter(Boolean);
    const previousWords = previousTranscript.split(/\s+/).filter(Boolean);
    const previousTail = previousWords.slice(-80).map(word => word.toLowerCase());
    const previousTailStr = previousTail.join(" ");
    const searchWindow = Math.min(50, currentWords.length);

    let overlapEndIndex = 0;

    for (let phraseLength = Math.min(30, searchWindow); phraseLength >= 8; phraseLength--) {
      for (let startIndex = 0; startIndex <= searchWindow - phraseLength; startIndex++) {
        const phrase = currentWords
          .slice(startIndex, startIndex + phraseLength)
          .map(word => word.toLowerCase())
          .join(" ");

        if (previousTailStr.includes(phrase)) {
          overlapEndIndex = startIndex + phraseLength;
          console.log(`[Sync] Chunk ${chunkNumber}: removed ${phraseLength}-word overlap at position ${startIndex}`);
          break;
        }
      }

      if (overlapEndIndex > 0) break;
    }

    return overlapEndIndex > 0
      ? currentWords.slice(overlapEndIndex).join(" ")
      : currentTranscript;
  };

  const stitchChunkTranscripts = (chunks) => {
    const orderedChunks = (chunks || [])
      .filter(chunk => chunk?.text)
      .sort((a, b) => a.index - b.index);

    if (orderedChunks.length === 0) return "";

    const stitched = [orderedChunks[0].text.trim()];

    for (let i = 1; i < orderedChunks.length; i++) {
      const deduplicated = removeChunkTextOverlap(
        orderedChunks[i].text,
        stitched[stitched.length - 1],
        orderedChunks[i].index
      ).trim();

      if (deduplicated) stitched.push(deduplicated);
    }

    return stitched.join(" ").replace(/\s+/g, " ").trim();
  };

  const persistUploadedChunkMetadata = async (meetingId, uploadedChunks, recordingCreatedAt) => {
    if (!meetingId || !uploadedChunks?.length) return;

    try {
      const recordingStartMs = new Date(recordingCreatedAt).getTime();
      if (Number.isNaN(recordingStartMs)) {
        console.warn("[Sync] Could not persist audio chunk metadata — invalid recording start time");
        return;
      }

      const rows = uploadedChunks.map(chunk => ({
        meeting_id: meetingId,
        chunk_number: chunk.index,
        audio_blob_path: chunk.storagePath,
        file_size: chunk.sizeBytes,
        original_file_size: chunk.sizeBytes,
        chunk_duration_ms: chunk.durationMs,
        processing_status: "uploaded",
        start_time: new Date(recordingStartMs + (chunk.startTimeMs || 0)).toISOString(),
        end_time: new Date(recordingStartMs + (chunk.endTimeMs || chunk.startTimeMs || 0)).toISOString(),
      }));

      const { error } = await supabase.from("audio_chunks").insert(rows);
      if (error) {
        console.warn("[Sync] Failed to persist audio chunk metadata:", error);
      }
    } catch (error) {
      console.warn("[Sync] Audio chunk metadata persistence failed:", error);
    }
  };

  // ── Active sync ref for pause/resume ────────────────────────────────────
  const activeSyncRef = useRef(null); // { rec, abortController, paused }

  // ── Pre-flight validation ──────────────────────────────────────────────
  const preflightCheck = async (rec) => {
    // Check device is online
    if (!navigator.onLine) {
      showToast("You're offline — connect to WiFi or mobile data to sync", "error");
      return { ok: false, errorType: "network_drop" };
    }

    // Check file size > 0
    const totalSize = (rec.chunks || []).reduce((s, c) => s + (c.sizeBytes || c.arrayBuffer?.byteLength || 0), 0);
    const singleSize = rec.audioData?.byteLength || 0;
    if (totalSize === 0 && singleSize === 0) {
      setSyncProgress({
        phase: "error", errorType: "zero_bytes", percentComplete: 0,
        recordingTitle: rec.title, message: "Recording is empty",
      });
      await logSyncDiagnostic(rec.id, { event: "preflight_fail", reason: "zero_bytes" });
      return { ok: false, errorType: "zero_bytes" };
    }

    // Check file size < 100MB
    const effectiveSize = totalSize || singleSize;
    if (effectiveSize > 100 * 1024 * 1024) {
      showToast("Recording is very large (>100 MB) — sync may take a while on mobile data", "info");
    }

    // Resolve the authenticated user without forcing a token refresh round-trip.
    // The AuthContext is the source of truth — if it has a user, we are signed
    // in (the SDK will auto-refresh tokens on the next request as needed).
    // Falling back to getSession() handles the rare case where the recorder
    // mounts before AuthContext has hydrated.
    let user = authUser || null;
    if (!user) {
      try {
        const session = await refreshSessionStatus();
        user = session?.user || null;
      } catch (e) {
        console.warn("[sync] session check failed:", e);
      }
    }
    if (!user) {
      setSyncProgress({
        phase: "error", errorType: "auth_expired", percentComplete: 0,
        recordingTitle: rec.title, message: "Session expired",
      });
      await logSyncDiagnostic(rec.id, { event: "preflight_fail", reason: "auth_expired" });
      navigateToSignIn(location.pathname || "/new-recorder");
      return { ok: false, errorType: "auth_expired" };
    }

    return { ok: true, user };
  };

  // ── Sync (chunked) ───────────────────────────────────────────────────────
  const syncRecording = async (rec) => {
    const preflight = await preflightCheck(rec);
    if (!preflight.ok) return;
    const user = preflight.user;

    if (rec.status === "transcribed" && rec.transcript && !rec.meetingId) {
      console.log("[Sync] Resuming meeting creation for already-transcribed recording");
      try {
        const wordCount = rec.transcript.split(/\s+/).filter(Boolean).length;

        if (wordCount < 100) {
          console.log(`[Sync] Recording too short (${wordCount} words) — skipping meeting creation`);
          if (!rec.forceCreate) {
            showToast(`Recording too short (${wordCount} words) — at least 100 words needed for meeting notes`, "warning");
            await dbPatch(rec.id, { status: "too_short" });
            await refresh();
            setSyncProgress(null);
            return;
          }
          console.log("[Sync] Force create enabled — bypassing word count guard");
          showToast(`Force creating meeting with ${wordCount} words…`, "info");
        }

        let durationMins = Math.round((rec.duration || 0) / 60);
        if (durationMins === 0 && rec.createdAt) {
          durationMins = Math.round((Date.now() - new Date(rec.createdAt).getTime()) / 60000);
        }
        setSyncProgress({ phase: "stitching", currentChunk: 1, totalChunks: 1, percentComplete: 92, message: "Creating meeting record…" });

        const { data: meetingData, error: meetingErr } = await supabase
          .from("meetings")
          .insert({
            title: rec.title || `Mobile Recording ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
            user_id: user.id,
            status: "completed",
            meeting_type: "general",
            start_time: new Date(rec.createdAt).toISOString(),
            end_time: new Date().toISOString(),
            duration_minutes: durationMins,
            word_count: wordCount,
            import_source: mode === "live" ? "mobile_live" : "mobile_offline",
            whisper_transcript_text: rec.transcript,
            primary_transcript_source: "whisper",
          })
          .select("id")
          .single();

        if (meetingErr) {
          console.error("[Sync] Resume meeting creation failed:", meetingErr);
          showToast(`Meeting creation failed: ${meetingErr.message || "Unknown error"}`, "error");
          setSyncProgress(null);
          return;
        }

        const meetingId = meetingData.id;
        attachDeviceInfoToMeeting(meetingId);
        await dbPatch(rec.id, { meetingId });
        await refresh();
        setSyncProgress({ phase: "complete", currentChunk: 1, totalChunks: 1, percentComplete: 100, message: `Complete — ${wordCount} words` });
        showToast("Meeting created — generating notes…", "success");

        generateNotesForMeeting(meetingId)
          .then(() => {
            showToast("Meeting notes generated ✨", "success");
            triggerPostNoteActions(meetingId);
          })
          .catch(async (err) => {
            console.error("[Sync] Note generation client error (may be timeout):", err);
            await pollAndEmailIfReady(meetingId, "Meeting saved — checking for notes…");
          })
          .finally(() => { setSyncProgress(null); refresh(); });
        return;
      } catch (err) {
        console.error("[Sync] Resume error:", err);
        showToast(`Resume failed: ${err?.message || "Unknown error"}`, "error");
        setSyncProgress(null);
        return;
      }
    }

    await dbPatch(rec.id, { status: "syncing" });
    await refresh();

    try {
      const sessionId = crypto.randomUUID();
      const chunks = rec.chunks || [];
      const totalChunks = chunks.length;
      const uploadedChunks = [];

      if (totalChunks === 0 && rec.audioData) {
        await syncLegacySingleFile(rec, user);
        return;
      }

      // Compute total size for progress
      const totalBytes = chunks.reduce((sum, ch) => sum + (ch.sizeBytes || ch.arrayBuffer?.byteLength || 0), 0);
      let uploadedBytes = 0;

      console.log(`[sync] upload started · ${totalChunks} chunks · ${fmtSize(totalBytes)}`);

      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks[i];
        const paddedIndex = String(chunk.index).padStart(3, "0");
        const mimeType = chunk.mimeType || rec.mimeType || "audio/webm";
        const ext = getChunkFileExtension(mimeType);
        const storagePath = `${sessionId}/chunk_${paddedIndex}.${ext}`;
        const blob = new Blob([chunk.arrayBuffer], { type: mimeType });
        const chunkSize = blob.size;

        setSyncProgress({
          phase: "uploading",
          currentChunk: i + 1,
          totalChunks,
          percentComplete: Math.round((uploadedBytes / totalBytes) * 100),
          message: `Segment ${i + 1} of ${totalChunks}…`,
          recordingTitle: rec.title || `Meeting ${fmtDate(rec.createdAt)}`,
          totalSizeLabel: fmtSize(totalBytes),
          durationLabel: fmtTime(rec.duration),
        });

        let uploadSuccess = false;
        const BACKOFF_DELAYS = [0, 2000, 8000, 30000]; // Exponential backoff: immediate, 2s, 8s, 30s
        const MAX_ATTEMPTS = 4;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          try {
            // Use XHR for real byte-level progress
            // NOTE: Supabase Storage's TUS resumable upload protocol is not yet
            // supported via the JS client in a mobile PWA context. XHR with full
            // retry is the reliable fallback. Chunked recording already splits
            // files into 15-min segments (typically <5MB each), reducing the impact
            // of restarting a single chunk upload.
            await new Promise((resolve, reject) => {
              supabase.auth.getSession().then(({ data: { session: sess } }) => {
                if (!sess) { reject(new Error("Session expired")); return; }
                const xhr = new XMLHttpRequest();
                const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/recordings/${storagePath}`;
                xhr.open("POST", url, true);
                xhr.setRequestHeader("Authorization", `Bearer ${sess.access_token}`);
                xhr.setRequestHeader("x-upsert", "true");
                xhr.setRequestHeader("Content-Type", mimeType);
                xhr.upload.onprogress = (e) => {
                  if (e.lengthComputable) {
                    const currentChunkProgress = e.loaded;
                    const totalProgress = uploadedBytes + currentChunkProgress;
                    const pct = Math.min(99, Math.round((totalProgress / totalBytes) * 100));
                    setSyncProgress(prev => ({
                      ...prev,
                      percentComplete: pct,
                      message: `Segment ${i + 1} of ${totalChunks}…`,
                      retryAttempt: attempt > 1 ? attempt : 0,
                      maxRetries: MAX_ATTEMPTS,
                    }));
                  }
                };
                xhr.onload = () => {
                  if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                  } else if (xhr.status === 401 || xhr.status === 403) {
                    reject(Object.assign(new Error(`Auth error: ${xhr.status}`), { errorType: "auth_expired" }));
                  } else if (xhr.status >= 500) {
                    reject(Object.assign(new Error(`Server error: ${xhr.status}`), { errorType: "server_error" }));
                  } else if (xhr.status === 413) {
                    reject(Object.assign(new Error("Storage quota exceeded"), { errorType: "quota_exceeded" }));
                  } else {
                    reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
                  }
                };
                xhr.onerror = () => reject(Object.assign(new Error("Network error during upload"), { errorType: "network_drop" }));
                xhr.ontimeout = () => reject(Object.assign(new Error("Upload timed out"), { errorType: "timeout" }));
                xhr.timeout = 120000; // 2 minutes per chunk
                xhr.send(blob);
              }).catch(reject);
            });
            uploadSuccess = true;
            console.log(`[sync] chunk ${i + 1} attempt ${attempt} succeeded`);
            await logSyncDiagnostic(rec.id, { event: "chunk_uploaded", chunk: i + 1, attempt });
            break;
          } catch (uploadErr) {
            const errType = uploadErr.errorType || (
              !navigator.onLine ? "network_drop" :
              uploadErr.message?.includes("timed out") ? "timeout" :
              uploadErr.message?.includes("Session expired") ? "auth_expired" : "unknown"
            );
            console.warn(`[sync] chunk ${i + 1} attempt ${attempt}/${MAX_ATTEMPTS} failed:`, uploadErr.message, `(${errType})`);
            await logSyncDiagnostic(rec.id, { event: "chunk_upload_fail", chunk: i + 1, attempt, error: uploadErr.message, errorType: errType });

            // Non-retryable errors
            if (errType === "auth_expired" || errType === "quota_exceeded") {
              throw uploadErr;
            }

            if (attempt < MAX_ATTEMPTS) {
              const delay = BACKOFF_DELAYS[attempt] || 30000;
              setSyncProgress(prev => ({
                ...prev,
                phase: "uploading",
                message: `Retrying segment ${i + 1}…`,
                retryAttempt: attempt + 1,
                maxRetries: MAX_ATTEMPTS,
              }));

              // If offline, wait for reconnection before retrying
              if (!navigator.onLine) {
                setSyncProgress(prev => ({
                  ...prev,
                  phase: "paused",
                  errorType: "network_drop",
                  message: "Waiting for connection…",
                  recordingTitle: rec.title,
                  totalSizeLabel: fmtSize(totalBytes),
                  durationLabel: fmtTime(rec.duration),
                }));
                await new Promise(resolve => {
                  const onOnline = () => { window.removeEventListener("online", onOnline); resolve(); };
                  window.addEventListener("online", onOnline);
                  // Also timeout after 5 minutes
                  setTimeout(() => { window.removeEventListener("online", onOnline); resolve(); }, 300000);
                });
              } else {
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          }
        }

        if (!uploadSuccess) {
          // Track retry count in IndexedDB
          const currentRetries = (rec.syncRetryCount || 0) + 1;
          await dbPatch(rec.id, { status: "error", syncRetryCount: currentRetries, lastSyncError: "Max retries exceeded" });
          await refresh();
          setSyncProgress({
            phase: "error",
            errorType: "max_retries",
            errorDetail: `Segment ${i + 1} failed after ${MAX_ATTEMPTS} attempts`,
            percentComplete: Math.round((uploadedBytes / totalBytes) * 100),
            recordingTitle: rec.title,
            totalSizeLabel: fmtSize(totalBytes),
            durationLabel: fmtTime(rec.duration),
          });
          await logSyncDiagnostic(rec.id, { event: "sync_failed_max_retries", chunk: i + 1, totalAttempts: MAX_ATTEMPTS });
          return;
        }

        uploadedBytes += chunkSize;
        console.log(`[sync] chunk ${i + 1}/${totalChunks} uploaded · ${fmtSize(uploadedBytes)}/${fmtSize(totalBytes)}`);

        uploadedChunks.push({
          index: chunk.index,
          storagePath,
          startTimeMs: chunk.startTimeMs || 0,
          endTimeMs: chunk.endTimeMs || ((chunk.startTimeMs || 0) + (chunk.durationMs || 0)),
          durationMs: chunk.durationMs || 0,
          sizeBytes: chunk.sizeBytes || blob.size,
        });
      }

      console.log("[sync] upload complete · all chunks uploaded");
      await logSyncDiagnostic(rec.id, { event: "upload_complete", totalChunks, totalBytes: uploadedBytes });
      setSyncProgress({
        phase: "uploading",
        currentChunk: totalChunks,
        totalChunks,
        percentComplete: 99,
        message: "Registering meeting…",
        recordingTitle: rec.title,
        totalSizeLabel: fmtSize(totalBytes),
        durationLabel: fmtTime(rec.duration),
      });

      await dbPatch(rec.id, {
        status: "uploaded",
        uploadSessionId: sessionId,
        remoteChunkPaths: uploadedChunks.map(c => c.storagePath),
        syncRetryCount: 0, // Reset on success
        lastSyncError: null,
      });
      await refresh();

      // Create the meeting row in pending_transcription state
      const durationMins = Math.max(1, Math.round((rec.duration || 0) / 60));
      const { data: meeting, error: meetingErr } = await supabase
        .from("meetings")
        .insert({
          title: rec.title || `Mobile Recording ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
          user_id: user.id,
          status: "pending_transcription",
          meeting_type: "general",
          start_time: new Date(rec.createdAt).toISOString(),
          end_time: new Date().toISOString(),
          duration_minutes: durationMins,
          import_source: mode === "live" ? "mobile_live" : "mobile_offline",
          upload_session_id: sessionId,
          remote_chunk_paths: uploadedChunks.map(c => c.storagePath),
          chunk_count: totalChunks,
          notes_generation_status: "queued",
        })
        .select("id")
        .single();

      if (meetingErr || !meeting) {
        console.error("[sync] db row insertion failed:", meetingErr);
        showToast(`Upload succeeded but could not register meeting: ${meetingErr?.message || "unknown"}. Tap Sync again.`, "error");
        await dbPatch(rec.id, { status: "error", lastSyncError: meetingErr?.message || "DB insert failed" });
        await refresh();
        setSyncProgress(null);
        return;
      }

      console.log("[sync] db row inserted · meetingId:", meeting.id);

      // Persist chunk metadata server-side so transcribe-offline-meeting can find the chunks
      await persistUploadedChunkMetadata(meeting.id, uploadedChunks, rec.createdAt);

      // Link IndexedDB record to the meeting immediately
      await dbPatch(rec.id, { meetingId: meeting.id });
      await refresh();

      console.log("[sync] queued for transcription · meetingId:", meeting.id);

      // Fire-and-forget: kick off server-side transcription. We intentionally do NOT await completion.
      supabase.functions.invoke("transcribe-offline-meeting", {
        body: { meetingId: meeting.id, chunkIndex: 0 },
      }).catch((err) => {
        console.warn("[sync] Transcription dispatch failed (server queue will retry):", err);
      });

      // Surface the "Safe to close" success state — now gated on actual upload + DB row + queued status
      const hours = (rec.duration || 0) / 3600;
      const estimateMinutes = hours <= 1 ? 10 : hours <= 2 ? 15 : hours <= 3 ? 20 : 25;
      setSyncProgress({
        phase: "safe_to_close",
        currentChunk: totalChunks,
        totalChunks,
        percentComplete: 100,
        message: "Upload complete — safe to close",
        estimateMinutes,
        meetingId: meeting.id,
      });
      showToast("Upload complete — notes will arrive by email", "success");
      await logSyncDiagnostic(rec.id, { event: "sync_complete", meetingId: meeting.id });
    } catch (err) {
      console.error("[sync] error:", err);
      const errType = err.errorType || (
        !navigator.onLine ? "network_drop" :
        err.message?.includes("Session expired") ? "auth_expired" :
        err.message?.includes("quota") ? "quota_exceeded" :
        err.message?.includes("5") && err.message?.includes("00") ? "server_error" : "unknown"
      );
      const retryCount = (rec.syncRetryCount || 0) + 1;
      await dbPatch(rec.id, { status: "error", syncRetryCount: retryCount, lastSyncError: err?.message || "Unknown" });
      await refresh();
      await logSyncDiagnostic(rec.id, { event: "sync_error", error: err?.message, errorType: errType, retryCount });
      setSyncProgress({
        phase: "error",
        errorType: errType,
        errorDetail: err?.message || "Unknown error",
        percentComplete: 0,
        recordingTitle: rec.title,
        totalSizeLabel: fmtSize(rec.size || 0),
        durationLabel: fmtTime(rec.duration),
      });
    }
  };

  // Legacy single-file sync for recordings saved before chunked update
  const syncLegacySingleFile = async (rec, user) => {
    try {
      const audioBlob = new Blob([rec.audioData], { type: rec.mimeType });
      const ext = rec.mimeType?.includes("mp4") ? "m4a" : rec.mimeType?.includes("ogg") ? "ogg" : "webm";
      const filePath = `${user.id}/${rec.id}.${ext}`;
      const uploadedChunks = [{
        index: 0,
        storagePath: filePath,
        startTimeMs: 0,
        endTimeMs: Math.max((rec.duration || 0) * 1000, 1000),
        durationMs: Math.max((rec.duration || 0) * 1000, 1000),
        sizeBytes: audioBlob.size,
      }];

      setSyncProgress({
        phase: "uploading",
        currentChunk: 1,
        totalChunks: 1,
        percentComplete: 20,
        message: "Uploading audio…",
      });

      const { error } = await supabase.storage
        .from("recordings")
        .upload(filePath, audioBlob, { contentType: rec.mimeType, upsert: true });
      if (error) throw error;

      await dbPatch(rec.id, {
        status: "synced",
        uploadSessionId: rec.id,
        remoteChunkPaths: [filePath],
      });
      await refresh();

      setSyncProgress({
        phase: "transcribing",
        currentChunk: 1,
        totalChunks: 1,
        percentComplete: 50,
        message: "Transcribing…",
      });

      const prompt = `NHS primary care meeting transcript.${rec.title ? ` Meeting: ${rec.title}.` : ""}`;
      const { data: transcriptData, error: fnErr } = await supabase.functions.invoke("standalone-whisper", {
        body: { storagePath: filePath, bucket: "recordings", prompt },
      });
      if (fnErr) throw fnErr;

      const cleanedLegacy = cleanWhisperResponse(transcriptData || {});
      if (cleanedLegacy.cleaningSummary?.totalWordsRemoved > 0) {
        console.log(`🧹 Mobile legacy sync: cleaner removed ${cleanedLegacy.cleaningSummary.totalWordsRemoved} words`);
      }
      const transcriptText = (cleanedLegacy.text || transcriptData?.text || "").replace(/\s+/g, " ").trim();
      await dbPatch(rec.id, { status: "transcribed", transcript: transcriptText });
      await refresh();

      setSyncProgress({
        phase: "transcribing",
        currentChunk: 1,
        totalChunks: 1,
        percentComplete: 85,
        message: "Creating meeting record…",
      });

      showToast("Transcription complete", "success");

      let activeUser = null;
      try {
        const { data: { session } } = await supabase.auth.refreshSession();
        if (session?.user) {
          activeUser = session.user;
          console.log("[LegacySync] Session refreshed successfully:", activeUser.id);
        }
      } catch (refreshErr) {
        console.warn("[LegacySync] Session refresh failed:", refreshErr);
      }
      if (!activeUser) {
        const { data: { user: freshUser } } = await supabase.auth.getUser();
        activeUser = freshUser || user;
      }
      console.log("[LegacySync] Creating meeting. activeUser:", activeUser?.id, "transcript length:", transcriptText.length);

      if (!activeUser?.id) {
        console.error("[LegacySync] No authenticated user for meeting creation");
        showToast("Session expired — tap Sync again after signing in", "error");
        await dbPatch(rec.id, { status: "transcribed", transcript: transcriptText });
        await refresh();
        setSyncProgress(null);
        return;
      }

      const wordCount = transcriptText.split(/\s+/).filter(Boolean).length;

      if (wordCount < 100) {
        console.log(`[LegacySync] Recording too short (${wordCount} words) — skipping meeting creation`);
        if (!rec.forceCreate) {
          showToast(`Recording too short (${wordCount} words) — at least 100 words needed for meeting notes`, "warning");
          await dbPatch(rec.id, { status: "too_short", transcript: transcriptText });
          await refresh();
          setSyncProgress(null);
          return;
        }
        console.log("[LegacySync] Force create enabled — bypassing word count guard");
        showToast(`Force creating meeting with ${wordCount} words…`, "info");
      }

      const sessionId = crypto.randomUUID();
      console.log("[LegacySync] Inserting meeting. wordCount:", wordCount, "title:", rec.title);
      const { data: meetingData, error: meetingErr } = await supabase
        .from("meetings")
        .insert({
          title: rec.title || `Mobile Recording ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
          user_id: activeUser.id,
          status: "completed",
          meeting_type: "general",
          start_time: new Date(rec.createdAt).toISOString(),
          end_time: new Date().toISOString(),
          duration_minutes: Math.round((rec.duration || 0) / 60),
          word_count: wordCount,
          import_source: mode === "live" ? "mobile_live" : "mobile_offline",
          whisper_transcript_text: transcriptText,
          primary_transcript_source: "whisper",
        })
        .select("id")
        .single();

      if (meetingErr) {
        console.error("[LegacySync] Meeting creation failed:", meetingErr, JSON.stringify(meetingErr));
        const errMsg = meetingErr?.message || meetingErr?.details || JSON.stringify(meetingErr);
        showToast(`Transcribed but meeting creation failed: ${errMsg}`, "error");
        setSyncProgress(null);
        return;
      }

      console.log("[LegacySync] Meeting created:", meetingData?.id);
      attachDeviceInfoToMeeting(meetingData.id);
      await persistUploadedChunkMetadata(meetingData.id, uploadedChunks, rec.createdAt);

      await supabase.from("meeting_transcription_chunks").insert({
        meeting_id: meetingData.id,
        user_id: activeUser.id,
        session_id: sessionId,
        chunk_number: 0,
        transcription_text: transcriptText,
        is_final: true,
        source: "whisper",
        transcriber_type: "whisper",
        word_count: wordCount,
      });

      await dbPatch(rec.id, {
        meetingId: meetingData.id,
        uploadSessionId: rec.id,
        remoteChunkPaths: [filePath],
      });
      await refresh();

      setSyncProgress({
        phase: "complete",
        currentChunk: 1,
        totalChunks: 1,
        percentComplete: 100,
        message: `Complete — ${wordCount} words`,
      });
      showToast("Meeting created — generating notes…", "success");

      generateNotesForMeeting(meetingData.id)
        .then(() => {
          showToast("Meeting notes generated ✨", "success");
          triggerPostNoteActions(meetingData.id);
        })
        .catch(async (err) => {
          console.error("[LegacySync] Note generation client error (may be timeout):", err);
          await pollAndEmailIfReady(meetingData.id, "Meeting saved — checking for notes…");
        })
        .finally(() => { setSyncProgress(null); refresh(); });
    } catch (err) {
      console.error("[LegacySync] Error:", err);
      await dbPatch(rec.id, { status: "error" });
      await refresh();
      setSyncProgress(null);
      showToast(`Sync failed: ${err?.message || "Unknown error"}`, "error");
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState(null); // recording id pending delete

  const forceRetryRecording = async (rec) => {
    try {
      setForceRetryingIds(prev => ({ ...prev, [rec.id]: true }));
      showToast("Force retry — resetting and re-syncing…", "info");
      // Reset status to 'local' so syncRecording re-uploads and re-transcribes
      await dbPatch(rec.id, { status: "local", transcript: null, meetingId: null, forceCreate: true });
      await refresh();
      // Small delay then trigger sync
      setTimeout(async () => {
        const freshRecs = await dbGetAll();
        const freshRec = freshRecs.find(r => r.id === rec.id);
        if (freshRec) {
          await syncRecording(freshRec);
        }
        setForceRetryingIds(prev => { const n = { ...prev }; delete n[rec.id]; return n; });
      }, 500);
    } catch (err) {
      console.error("Force retry failed:", err);
      showToast("Force retry failed: " + (err.message || "Unknown error"), "error");
      setForceRetryingIds(prev => { const n = { ...prev }; delete n[rec.id]; return n; });
    }
  };

  const downloadAudioRecording = (rec) => {
    try {
      const chunks = rec.chunks || [];
      const audioData = rec.audioData;
      if (chunks.length === 0 && !audioData) { showToast("No audio data found", "error"); return; }
      const parts = chunks.length > 0
        ? chunks.map(ch => new Blob([ch.arrayBuffer], { type: ch.mimeType || rec.mimeType }))
        : [new Blob([audioData], { type: rec.mimeType })];
      const merged = new Blob(parts, { type: rec.mimeType || "audio/webm" });
      const ext = (rec.mimeType || "").includes("mp4") ? "m4a" : (rec.mimeType || "").includes("ogg") ? "ogg" : "webm";
      const safeName = (rec.title || "recording").replace(/[^a-zA-Z0-9_-]/g, "_");
      const url = URL.createObjectURL(merged);
      const a = document.createElement("a");
      a.href = url; a.download = `${safeName}.${ext}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Audio downloaded ✓", "success");
    } catch (err) {
      console.error("Download failed:", err);
      showToast("Download failed: " + (err.message || "Unknown error"), "error");
    }
  };

  const retranscribeRecording = async (rec) => {
    if (!rec.meetingId) return;
    try {
      setRetranscribingIds(prev => ({ ...prev, [rec.id]: true }));
      showToast("Re-processing started…", "info");
      const session = await ensureSignedIn(location.pathname || "/new-recorder");
      if (!session) return;

      // Mobile recordings store audio under a random sessionId, not the meetingId.
      // So we call auto-generate-meeting-notes to regenerate notes from the existing transcript.
      const { data, error } = await supabase.functions.invoke("auto-generate-meeting-notes", {
        body: { meetingId: rec.meetingId, forceRegenerate: true, ...modelOverrideField() },
      });
      if (error) {
        // Edge functions may time out on the client side but still complete in the background
        console.warn("Reprocess invoke returned error (may still complete):", error);
        showToast("Reprocessing started — notes may take a moment to appear", "info");
        return;
      }
      showToast("Notes regenerated successfully ✓", "success");
    } catch (err) {
      console.error("Re-process failed:", err);
      showToast("Re-processing failed: " + (err.message || "Unknown error"), "error");
    } finally {
      setRetranscribingIds(prev => { const n = { ...prev }; delete n[rec.id]; return n; });
    }
  };

  const emailAudioRecording = async (rec) => {
    if (!rec.id) return;
    try {
      setEmailingIds(prev => ({ ...prev, [rec.id]: true }));
      const session = await ensureSignedIn(location.pathname || "/new-recorder");
      if (!session) return;

      // Get user email from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", session.user.id)
        .single();
      if (!profile?.email) { showToast("No email address found in your profile", "error"); return; }

      // Read audio chunks from the recording object (same source as play button)
      const chunks = rec.chunks || [];
      const audioData = rec.audioData;
      if (chunks.length === 0 && !audioData) { showToast("No audio data found for this recording", "error"); return; }

      // Convert each chunk's arrayBuffer to base64
      const chunkData = [];
      const sources = chunks.length > 0
        ? chunks.map((ch, idx) => ({ buf: ch.arrayBuffer, index: idx }))
        : [{ buf: audioData, index: 0 }];
      for (const src of sources) {
        const bytes = new Uint8Array(src.buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        chunkData.push({ base64, rawSize: src.buf.byteLength, index: src.index });
      }

      // Batch chunks so each email stays under 15MB (base64 adds ~37% overhead)
      const MAX_RAW_PER_EMAIL = 10.9 * 1024 * 1024; // ~15MB after base64
      const batches = [];
      let currentBatch = [];
      let currentSize = 0;
      for (const chunk of chunkData) {
        if (currentSize + chunk.rawSize > MAX_RAW_PER_EMAIL && currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [];
          currentSize = 0;
        }
        currentBatch.push(chunk);
        currentSize += chunk.rawSize;
      }
      if (currentBatch.length > 0) batches.push(currentBatch);

      const totalEmails = batches.length;
      const title = rec.title || "Recording";
      const mimeType = rec.mimeType || "audio/webm";
      const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const partLabel = totalEmails > 1 ? ` — Part ${i + 1} of ${totalEmails}` : "";
        showToast(`Sending email${totalEmails > 1 ? ` ${i + 1} of ${totalEmails}` : ""}…`, "info");

        const extraAttachments = batch.map((ch, idx) => ({
          content: ch.base64,
          filename: `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}_chunk${ch.index + 1}.${ext}`,
          type: mimeType,
        }));

        const totalSizeMB = (batch.reduce((s, ch) => s + ch.rawSize, 0) / (1024 * 1024)).toFixed(1);
        const htmlContent = `
          <div style="font-family:sans-serif;padding:20px;max-width:600px;margin:0 auto">
            <h2 style="color:#1565c0;margin-bottom:12px">🎙️ ${title}${partLabel}</h2>
            <p style="color:#334155;font-size:14px;line-height:1.6">
              Attached ${batch.length === 1 ? "is 1 audio file" : `are ${batch.length} audio files`}
              from your recording <strong>"${title}"</strong> (${fmtTime(rec.duration)}).
            </p>
            ${totalEmails > 1 ? `<p style="color:#64748b;font-size:13px">This is part ${i + 1} of ${totalEmails} (${totalSizeMB} MB in this email).</p>` : ""}
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0"/>
            <p style="color:#94a3b8;font-size:11px">Sent from Notewell AI Mobile Recorder</p>
          </div>
        `;

        const { data, error } = await supabase.functions.invoke("send-meeting-email-resend", {
          body: {
            to_email: profile.email,
            subject: `${title}${partLabel}`,
            html_content: htmlContent,
            from_name: "Notewell AI",
            extra_attachments: extraAttachments,
          },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Email send failed");
      }

      showToast(totalEmails > 1 ? `Audio sent across ${totalEmails} emails ✓` : "Audio emailed successfully ✓", "success");
    } catch (err) {
      console.error("Email audio failed:", err);
      showToast("Email failed: " + (err.message || "Unknown error"), "error");
    } finally {
      setEmailingIds(prev => { const n = { ...prev }; delete n[rec.id]; return n; });
    }
  };

  const deleteRecording = async (id) => {
    // Skip confirmation for completed recordings (Meeting Created ✓)
    const rec = recordings.find(r => r.id === id);
    if (rec && rec.status === "transcribed" && rec.meetingId) {
      if (playingId === id) { audioRef.current.pause(); setPlayingId(null); }
      await dbDelete(id);
      await refresh();
      showToast("Recording deleted", "info");
      return;
    }
    setDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    const id = deleteConfirm;
    setDeleteConfirm(null);
    if (!id) return;
    if (playingId === id) { audioRef.current.pause(); setPlayingId(null); }
    await dbDelete(id);
    await refresh();
    showToast("Recording deleted", "info");
  };

  const playRecording = async (rec) => {
    if (playingId === rec.id) { audioRef.current.pause(); setPlayingId(null); return; }
    // Play first chunk for preview
    const audioData = rec.audioData || rec.chunks?.[0]?.arrayBuffer;
    if (!audioData) { showToast("No audio data", "error"); return; }
    const blob = new Blob([audioData], { type: rec.mimeType });
    audioRef.current.src = URL.createObjectURL(blob);
    audioRef.current.play();
    setPlayingId(rec.id);
    audioRef.current.onended = () => setPlayingId(null);
  };

  const isIdle      = recState === "idle";
  const isRecording = recState === "recording";
  const isPaused    = recState === "paused";
  const active      = isRecording || isPaused;
  const localCount  = recordings.filter(r => r.status==="local"||r.status==="error").length;

  // ── Pre-flight intercept for mobile devices ──
  const handleRecordTap = async () => {
    if (!isIdle) {
      // Already recording — handle pause/resume
      if (isRecording) pauseRecording();
      else resumeRecording();
      return;
    }
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (mode === "live") {
      const session = await ensureSignedIn(location.pathname || "/new-recorder");
      if (!session) return;
    }
    const alreadyShown = sessionStorage.getItem(SESSION_KEY);
    if (isMobile && !alreadyShown) {
      setShowPreFlight(true);
      return;
    }
    startRecording();
  };

  const handlePreFlightStart = async () => {
    sessionStorage.setItem(SESSION_KEY, "true");
    setShowPreFlight(false);
    if (mode === "live") {
      const session = await ensureSignedIn(location.pathname || "/new-recorder");
      if (!session) return;
    }
    startRecording();
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes barPulse  { from{transform:scaleY(0.5)} to{transform:scaleY(1)} }
        @keyframes ripple    { 0%{transform:scale(1);opacity:0.7} 100%{transform:scale(2.4);opacity:0} }
        @keyframes slideUp   { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
        @keyframes pulse     { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:rgba(21,101,192,0.15);border-radius:4px}
      `}</style>

      <div style={{
        width:"100%", maxWidth:480, margin:"0 auto",
        minHeight:"100dvh", background:"#f0f4f9",
        overflow:"hidden", display:"flex", flexDirection:"column",
        position:"relative",
        fontFamily:"'DM Sans',sans-serif",
      }}>

        {/* App header with hamburger menu */}
        <Header />

        {/* Persistent sync status indicator */}
        {syncProgress && syncProgress.phase === "uploading" && (
          <div style={{
            margin:"0 16px",padding:"6px 12px",borderRadius:10,
            background:"rgba(21,101,192,0.06)",border:"1px solid rgba(21,101,192,0.12)",
            display:"flex",alignItems:"center",gap:8,
          }}>
            <span style={{fontSize:13}}>📤</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,fontWeight:600,color:"#1565c0"}}>
                1 recording syncing · {syncProgress.percentComplete}%
              </div>
              <div style={{width:"100%",height:3,borderRadius:2,background:"#e2e8f0",marginTop:3,overflow:"hidden"}}>
                <div style={{width:`${syncProgress.percentComplete}%`,height:"100%",borderRadius:2,background:"#1565c0",transition:"width 0.3s ease-out"}}/>
              </div>
            </div>
          </div>
        )}

        {/* Storage warning banner */}
        {storageWarning && (
          <div style={{
            margin:"8px 16px 0", padding:"10px 14px", borderRadius:12,
            background:"linear-gradient(135deg, #fef3c7, #fde68a)",
            border:"1px solid #f59e0b", display:"flex", alignItems:"center", gap:10,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div style={{flex:1}}>
              <p style={{fontSize:12,fontWeight:600,color:"#92400e",margin:0}}>
                Storage {storageWarning.percentUsed}% full ({storageWarning.usedMB} MB used)
              </p>
              <p style={{fontSize:11,color:"#a16207",margin:"2px 0 0"}}>
                Sync or delete old recordings to free space
              </p>
            </div>
            <button onClick={() => setStorageWarning(null)} style={{
              background:"none", border:"none", cursor:"pointer", padding:4, color:"#92400e", fontSize:16, fontWeight:700
            }}>×</button>
          </div>
        )}

        {/* Sync progress bar */}
        <SyncProgressBar progress={syncProgress} setSyncProgress={setSyncProgress} setRecState={setRecState} onRetryNow={() => {
          setSyncProgress(null);
          const failedRec = recordings.find(r => r.status === "error" || r.status === "paused");
          if (failedRec) syncRecording(failedRec);
        }} />

        {/* Suspension warning banner */}
        {suspensionWarning && active && (
          <SuspensionWarningBanner seconds={suspensionWarning.seconds} onDismiss={() => setSuspensionWarning(null)} />
        )}

        {/* Needs Attention section for failed syncs */}
        <NeedsAttentionSection
          recordings={recordings}
          onSync={syncRecording}
          onDelete={deleteRecording}
          onDownloadAudio={downloadAudioRecording}
          onEmailAudio={emailAudioRecording}
          isEmailing={false}
        />

        {/* Scrollable body */}
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>

          {/* Top action row — settings (left), mode pill (centre), meetings (right). */}
          <div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
            <button onClick={()=>setShowSettings(true)} style={{width:36,height:36,borderRadius:10,border:"1px solid rgba(21,101,192,0.15)",background:"white",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",flexShrink:0}} title="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1565c0" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
            <ModePill
              mode={mode}
              isAutoFallback={recordingMode.isAutoFallback}
              disabled={!isIdle}
              authLoading={authLoading}
              isAuthenticated={!!authUser}
              onTap={()=>setShowSheet(true)}
            />
            <button onClick={async ()=>{ const session = await ensureSignedIn("/meetings"); if (session) navigate("/meetings"); }} style={{width:36,height:36,borderRadius:10,border:"1px solid rgba(21,101,192,0.15)",background:"white",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)",flexShrink:0}} title="My Meetings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1565c0" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </button>
          </div>

          {/* Mid-recording connection drop / reconnect banner */}
          <ConnectionBanner
            connectionLostMidRecord={connectionLostMidRecord}
            isOnline={isOnline}
          />

          {/* Idle offline banner — only shown when user is in offline mode at idle */}
          {!isOnline && isIdle && !connectionLostMidRecord && (
            <div style={{margin:"10px 16px 0",background:"rgba(245,158,11,0.1)",borderRadius:12,padding:"10px 14px",border:"1px solid rgba(245,158,11,0.28)",display:"flex",gap:8,animation:"fadeIn 0.3s"}}>
              <span style={{fontSize:15,flexShrink:0}}>⚡</span>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:"#d97706"}}>Offline mode active</div>
                <div style={{fontSize:12,color:"#92400e",lineHeight:1.4}}>Recording saves to this device and transcribes automatically when you're back online.</div>
              </div>
            </div>
          )}

          {/* Recorder card */}
          <div style={{margin:"12px 16px 0",background:"white",borderRadius:22,padding:"22px 20px",boxShadow:"0 4px 16px rgba(21,101,192,0.1)",border:"1px solid rgba(21,101,192,0.1)"}}>

            {/* State heading */}
            <div style={{textAlign:"center",marginBottom:14}}>
              {isIdle && (
                <>
                  <div style={{fontSize:20,fontWeight:700,color:"#1a2332",letterSpacing:-0.5}}>Ready to record</div>
                  <div style={{fontSize:13,color:"#64748b",marginTop:4,lineHeight:1.5}}>
                    {mode==="live" ? "Live transcription · notes generated on stop" : "Recording saved locally · transcribed on sync"}
                  </div>
                </>
              )}
              {active && (
                <>
                  <div style={{fontSize:40,fontWeight:700,letterSpacing:-2,fontVariantNumeric:"tabular-nums",
                    color:isPaused?"#f59e0b":isPageHidden?"#94a3b8":"#1565c0",transition:"color 0.3s"}}>
                    {fmtDuration(elapsed)}
                  </div>
                  {/* Paused pill when page is hidden */}
                  {isPageHidden && isRecording && (
                    <div style={{
                      display:"inline-flex",alignItems:"center",gap:4,marginTop:4,marginBottom:4,
                      padding:"3px 10px",borderRadius:10,fontSize:11,fontWeight:700,
                      background:"rgba(245,158,11,0.15)",color:"#d97706",
                      border:"1px solid rgba(245,158,11,0.3)",animation:"pulse 1.5s infinite",
                    }}>
                      ⏸ PAUSED
                    </div>
                  )}
                  <div style={{fontSize:12,fontWeight:500,marginTop:3,display:"flex",alignItems:"center",justifyContent:"center",gap:5,
                    color:isPaused?"#f59e0b":"#16a34a"}}>
                    {isRecording && !isPageHidden && <span style={{width:7,height:7,borderRadius:"50%",background:"#dc2626",display:"inline-block",animation:"pulse 1s infinite"}}/>}
                    {isRecording ? (isPageHidden ? "" : mode==="live"?"Recording · Transcribing live":"Recording · Saving locally") : "⏸ Paused"}
                  </div>
                  {/* Chunk indicator */}
                  {chunksCompleted > 0 && (
                    <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>
                      {chunksCompleted} segment{chunksCompleted !== 1 ? "s" : ""} completed
                    </div>
                  )}
                  {/* Wake lock / keep-screen-on indicator */}
                  {active && (
                    <div style={{
                      display:"inline-flex",alignItems:"center",gap:4,marginTop:5,
                      padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:600,
                      background: wakeLockStatus === "active" ? "rgba(22,163,74,0.08)" : "rgba(245,158,11,0.1)",
                      color: wakeLockStatus === "active" ? "#16a34a" : "#d97706",
                      border: `1px solid ${wakeLockStatus === "active" ? "rgba(22,163,74,0.2)" : "rgba(245,158,11,0.3)"}`,
                    }}>
                      {wakeLockStatus === "active" ? "🔒 Screen lock prevented" : "⚠️ Keep screen on"}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Waveform */}
            <div style={{background:"#f8fafc",borderRadius:14,padding:"10px 16px",marginBottom:18,border:"1px solid rgba(21,101,192,0.07)",minHeight:60,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <WaveformBars active={isRecording} isPaused={isPaused} stream={activeStream} />
            </div>

            {/* Live Word Count + Expandable Panel */}
            {active && mode === "live" && (
              <div style={{marginBottom:14}}>
                {/* Always-visible word count tap target */}
                <button
                  onClick={() => setLiveExpanded(e => !e)}
                  style={{
                    display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                    width:"100%",padding:"8px 12px",borderRadius:12,border:"1px solid rgba(21,101,192,0.12)",
                    background:"#f0f4fb",cursor:"pointer",fontFamily:"inherit",
                  }}
                >
                  <span style={{
                    width:6,height:6,borderRadius:"50%",
                    background: liveStatus==="connected"?"#16a34a":liveStatus==="connecting"?"#f59e0b":liveStatus==="error"?"#dc2626":"#94a3b8",
                    animation: liveStatus==="connecting"?"pulse 1s infinite":"none",
                  }}/>
                  <span style={{fontSize:18,color:"#1565c0",fontWeight:800}}>
                    {liveWordCount} words
                  </span>
                  <span style={{fontSize:10,color:"#94a3b8",marginLeft:2}}>
                    {liveExpanded ? "▲" : "▼"}
                  </span>
                </button>

                {/* Expanded panel */}
                {liveExpanded && (
                  <div style={{background:"#f0f4fb",borderRadius:"0 0 12px 12px",padding:"10px 12px",borderLeft:"1px solid rgba(21,101,192,0.12)",borderRight:"1px solid rgba(21,101,192,0.12)",borderBottom:"1px solid rgba(21,101,192,0.12)",marginTop:-1}}>
                    {/* Engine selector */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                      <div style={{display:"flex",gap:4}}>
                        {["deepgram","assemblyai"].map(eng => (
                          <button key={eng} onClick={() => {
                            if (liveEngine !== eng) {
                              stopLiveTranscription();
                              setLiveEngine(eng);
                              setLiveTranscript("");
                              setLivePartial("");
                              if (activeStream) {
                                setTimeout(() => startLiveTranscription(activeStream, eng), 300);
                              }
                            }
                          }} style={{
                            padding:"3px 8px",borderRadius:8,border:"none",cursor:"pointer",
                            fontSize:10,fontWeight:600,fontFamily:"inherit",
                            background: liveEngine===eng ? "#1565c0" : "white",
                            color: liveEngine===eng ? "white" : "#64748b",
                            boxShadow: liveEngine===eng ? "0 2px 6px rgba(21,101,192,0.3)" : "0 1px 3px rgba(0,0,0,0.08)",
                            transition:"all 0.2s",
                          }}>
                            {eng==="assemblyai"?"Assembly":"Deepgram"}
                          </button>
                        ))}
                      </div>
                      <span style={{fontSize:10,color:"#64748b",fontWeight:500}}>
                        {liveStatus==="connected"?"Live":liveStatus==="connecting"?"Connecting…":liveStatus==="error"?"Error":"Off"}
                      </span>
                    </div>
                    {/* Transcript preview */}
                    <div style={{
                      fontSize:11,color:"#334155",lineHeight:1.5,
                      maxHeight:60,overflowY:"auto",
                      fontFamily:"'SF Mono','Menlo',monospace",
                      wordBreak:"break-word",
                    }}>
                      {liveTranscript ? (
                        <>
                          <span style={{opacity:0.6}}>
                            {liveTranscript.length > 200 ? "…" + liveTranscript.slice(-200) : liveTranscript}
                          </span>
                          {livePartial && <span style={{color:"#1565c0",fontStyle:"italic"}}> {livePartial}</span>}
                        </>
                      ) : livePartial ? (
                        <span style={{color:"#1565c0",fontStyle:"italic"}}>{livePartial}</span>
                      ) : (
                        <span style={{color:"#94a3b8",fontStyle:"italic"}}>Waiting for speech…</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:20}}>
              {active && (
                <button onClick={stopRecording} style={{width:52,height:52,borderRadius:"50%",border:"2px solid rgba(220,38,38,0.25)",background:"rgba(220,38,38,0.07)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#dc2626"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                </button>
              )}

              <div style={{position:"relative"}}>
                {isRecording && <>
                  <div style={{position:"absolute",inset:-8,borderRadius:"50%",border:"2px solid rgba(21,101,192,0.25)",animation:"ripple 3.2s infinite"}}/>
                  <div style={{position:"absolute",inset:-16,borderRadius:"50%",border:"2px solid rgba(21,101,192,0.12)",animation:"ripple 3.2s 1s infinite"}}/>
                </>}
                <button
                  onClick={handleRecordTap}
                  onTouchStart={e => { e.currentTarget.style.transform = "scale(0.93)"; }}
                  onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; }}
                  onMouseDown={e => { e.currentTarget.style.transform = "scale(0.93)"; }}
                  onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                  style={{
                    width:isIdle?90:76, height:isIdle?90:76, borderRadius:"50%", border:"none", cursor:"pointer",
                    background:isPaused?"linear-gradient(135deg,#f59e0b,#f97316)":"linear-gradient(135deg,#1565c0,#0288d1)",
                    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4,
                    boxShadow:isRecording?"0 6px 28px rgba(21,101,192,0.55)":isPaused?"0 6px 24px rgba(245,158,11,0.5)":"0 6px 20px rgba(21,101,192,0.4)",
                    transition:"transform 0.15s cubic-bezier(0.4,0,0.2,1), box-shadow 0.25s", position:"relative", zIndex:1,
                  }}
                >
                  {isIdle && <>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
                    <span style={{color:"white",fontSize:9,fontWeight:800,letterSpacing:1.5}}>RECORD</span>
                  </>}
                  {isRecording && <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>}
                  {isPaused && <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
                </button>
              </div>

              {active && (
                <div style={{width:52,fontSize:10,color:"#94a3b8",textAlign:"center",lineHeight:1.5}}>
                  {isRecording ? "Tap ⏸\nto pause" : "Tap ▶\nresume"}
                </div>
              )}
            </div>

            {isIdle && (
              <div style={{textAlign:"center",marginTop:12,fontSize:11,color:"#94a3b8",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
                Record · audio transcribed when you stop
              </div>
            )}
          </div>

          {/* Steps — idle only, collapsible */}
          {isIdle && (
            <StepsGuide mode={mode} />
          )}

          {/* Recordings list */}
          <div style={{padding:"10px 16px 28px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:600,color:"#94a3b8",letterSpacing:0.5,textTransform:"uppercase"}}>
                Recordings ({recordings.length})
              </div>
              {localCount > 0 && isOnline && (
                <button
                  onClick={async ()=>{ const session = await ensureSignedIn(location.pathname || "/new-recorder"); if (session) recordings.filter(r=>r.status==="local"||r.status==="error").forEach(syncRecording); }}
                  style={{fontSize:11,color:"#1565c0",fontWeight:700,border:"1px solid rgba(21,101,192,0.2)",background:"rgba(21,101,192,0.05)",cursor:"pointer",padding:"3px 10px",borderRadius:8,fontFamily:"inherit"}}
                >
                  ↑ Sync all
                </button>
              )}
            </div>

            {recordings.length === 0 ? (
              <div style={{textAlign:"center",padding:"16px 20px",color:"#94a3b8"}}>
                <div style={{fontSize:13,fontWeight:500}}>No recordings yet</div>
                <div style={{fontSize:12,marginTop:2}}>Tap the button above to start</div>
              </div>
            ) : recordings.map(r => (
              <RecordingItem key={r.id} rec={r}
                progress={r.meetingId ? meetingProgress[r.meetingId] : null}
                onDelete={deleteRecording} onSync={syncRecording}
                onPlay={playRecording} isPlaying={playingId===r.id}
                onRetranscribe={retranscribeRecording} isRetranscribing={!!retranscribingIds[r.id]}
                onEmailAudio={emailAudioRecording} isEmailing={!!emailingIds[r.id]}
                onForceRetry={forceRetryRecording} isForceRetrying={!!forceRetryingIds[r.id]}
                onDownloadAudio={downloadAudioRecording} />
            ))}

            {/* My Meetings card */}
            <button
              onClick={async ()=>{ const session = await ensureSignedIn("/meetings"); if (session) navigate("/meetings"); }}
              style={{width:"100%",background:"white",borderRadius:16,padding:"14px 16px",border:"none",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 12px rgba(0,0,0,0.06)",display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8}}
            >
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:40,height:40,borderRadius:12,background:"#e8f0fe",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📋</div>
                <div style={{textAlign:"left"}}>
                  <div style={{fontWeight:700,fontSize:15,color:"#1a2332",letterSpacing:-0.2}}>My Meetings</div>
                  <div style={{fontSize:12,color:"#64748b",marginTop:1}}>View all transcripts and notes</div>
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>


        {showSheet && (
          <ModeSheet mode={mode} onClose={()=>setShowSheet(false)} onSelect={m=>{setMode(m);setShowSheet(false);}} isAuthenticated={!!authUser} authLoading={authLoading} onSignIn={()=>navigateToSignIn(location.pathname || "/new-recorder")} />
        )}

        {showSettings && (
          <SettingsSheet
            onClose={()=>setShowSettings(false)}
            bitrate={bitrate}
            onBitrateChange={setBitrate}
          />
        )}

        {/* Title modal */}
        {titleModal && (
          <TitleModal
            duration={titleModal.duration}
            chunkCount={titleModal.chunkCount}
            totalSize={titleModal.totalSize}
            autoTitle={titleModal?.autoTitle}
            onSave={saveRecording}
            onContinue={async () => {
              // Delete the auto-saved draft before continuing — user will save properly after
              if (titleModal?.autoSavedId) {
                await dbDelete(titleModal.autoSavedId);
                await refresh();
              }
              continueRecording();
            }}
          />
        )}

        {/* Delete confirmation */}
        {deleteConfirm && (
          <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.5)",backdropFilter:"blur(4px)",padding:24}}>
            <div style={{background:"white",borderRadius:20,padding:24,maxWidth:340,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <div style={{width:40,height:40,borderRadius:12,background:"rgba(220,38,38,0.1)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </div>
                <h3 style={{margin:0,fontSize:17,fontWeight:700,color:"#1a2332",letterSpacing:-0.3}}>Delete recording?</h3>
              </div>
              <p style={{margin:"0 0 20px",fontSize:14,color:"#64748b",lineHeight:1.5}}>
                This recording will be <strong style={{color:"#dc2626"}}>permanently deleted</strong> and cannot be recovered. Any unsynced audio and transcript data will be lost.
              </p>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setDeleteConfirm(null)} style={{flex:1,padding:"12px 0",borderRadius:12,border:"1px solid #e2e8f0",background:"white",color:"#475569",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
                <button onClick={confirmDelete} style={{flex:1,padding:"12px 0",borderRadius:12,border:"none",background:"#dc2626",color:"white",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Pre-flight warning modal */}
        {showPreFlight && (
          <PreFlightWarningModal onStart={handlePreFlightStart} onCancel={() => setShowPreFlight(false)} />
        )}

        {/* Toast */}
        {toast && <Toast msg={toast.msg} type={toast.type} />}
      </div>
    </>
  );
}
