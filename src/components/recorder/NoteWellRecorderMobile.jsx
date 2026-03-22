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

function ModePill({ mode, disabled, onTap }) {
  const live = mode === "live";
  return (
    <button
      onClick={disabled ? undefined : onTap}
      disabled={disabled}
      style={{
        display:"inline-flex", alignItems:"center", gap:6,
        padding:"6px 14px 6px 8px", borderRadius:20,
        border:`1.5px solid ${live?"rgba(21,101,192,0.25)":"rgba(245,158,11,0.35)"}`,
        background:live?"rgba(21,101,192,0.07)":"rgba(245,158,11,0.1)",
        cursor:disabled?"default":"pointer", transition:"all 0.25s",
        opacity:disabled?0.8:1,
      }}
    >
      <div style={{
        width:22, height:22, borderRadius:"50%",
        background:live?"linear-gradient(135deg,#1565c0,#0288d1)":"linear-gradient(135deg,#f59e0b,#f97316)",
        display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow:live?"0 2px 6px rgba(21,101,192,0.4)":"0 2px 6px rgba(245,158,11,0.4)",
      }}>
        {live
          ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M1.5 8.5a13 13 0 0 1 21 0M5 12a10 10 0 0 1 14 0M8.5 15.5a6 6 0 0 1 7 0"/><circle cx="12" cy="19" r="1.5" fill="white"/></svg>
          : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10 10 0 0 1 19 12.55M5 12.55a10 10 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0"/></svg>
        }
      </div>
      <span style={{fontSize:12,fontWeight:600,color:live?"#1565c0":"#d97706"}}>
        {live ? "Live · Online" : "Offline · Saving locally"}
      </span>
      {!disabled && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke={live?"#1565c0":"#d97706"} strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      )}
    </button>
  );
}

function ModeSheet({ mode, onClose, onSelect }) {
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
          Auto-detected from your connection. Tap to override.
        </div>

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

function TitleModal({ duration, chunkCount, totalSize, onSave, onDiscard }) {
  const [title, setTitle] = useState(
    `Meeting ${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short"})} ${new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}`
  );
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:60,padding:"24px 16px"}}>
      <div style={{background:"white",borderRadius:20,padding:"22px 18px 28px",width:"100%",maxWidth:400,animation:"slideUp 0.25s ease-out"}}>
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
        <div style={{display:"flex",gap:10}}>
          <button onClick={onDiscard} style={{flex:1,padding:"13px",borderRadius:12,border:"1.5px solid #e2e8f0",background:"white",cursor:"pointer",fontSize:14,fontWeight:600,color:"#64748b",fontFamily:"inherit"}}>
            Discard
          </button>
          <button onClick={()=>onSave(title)} style={{flex:2,padding:"13px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1565c0,#0288d1)",cursor:"pointer",fontSize:14,fontWeight:600,color:"white",fontFamily:"inherit",boxShadow:"0 4px 12px rgba(21,101,192,0.4)"}}>
            Save Recording
          </button>
        </div>
      </div>
    </div>
  );
}

function SyncProgressBar({ progress }) {
  if (!progress) return null;
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

function RecordingItem({ rec, onDelete, onSync, onPlay, isPlaying }) {
  const colors = {
    local:       { dot:"#f59e0b", bg:"rgba(245,158,11,0.1)",  border:"rgba(245,158,11,0.25)",  label:"Saved locally — tap Sync" },
    syncing:     { dot:"#1565c0", bg:"rgba(21,101,192,0.08)", border:"rgba(21,101,192,0.2)",   label:"Uploading…" },
    synced:      { dot:"#16a34a", bg:"rgba(22,163,74,0.08)",  border:"rgba(22,163,74,0.2)",    label:"Synced" },
    transcribed: { dot:"#7c3aed", bg:"rgba(124,58,237,0.07)", border:"rgba(124,58,237,0.2)",   label:"Transcribed ✨" },
    error:       { dot:"#dc2626", bg:"rgba(220,38,38,0.07)",  border:"rgba(220,38,38,0.2)",    label:"Sync failed — retry?" },
  };
  const c = colors[rec.status] ?? colors.local;

  // Check if recording is >24h old and already transcribed/synced
  const ageMs = Date.now() - new Date(rec.createdAt).getTime();
  const isOldAndDone = ageMs > 24 * 60 * 60 * 1000 && (rec.status === "transcribed" || rec.meetingId);
  const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));

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
          <span style={{
            display:"inline-flex",alignItems:"center",gap:4,marginTop:4,
            padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:600,
            background:c.bg,color:c.dot,border:`1px solid ${c.border}`,
          }}>
            <span style={{width:5,height:5,borderRadius:"50%",background:c.dot,
              animation:rec.status==="syncing"?"pulse 1s infinite":"none"}}/>
            {c.label}
          </span>
        </div>

        <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
          {(rec.status==="local"||rec.status==="error") && (
            <button onClick={()=>onSync(rec)} style={{
              padding:"5px 10px",borderRadius:8,border:"1.5px solid rgba(21,101,192,0.3)",
              background:"transparent",cursor:"pointer",fontSize:11,color:"#1565c0",fontWeight:700,fontFamily:"inherit",
            }}>↑ Sync</button>
          )}
          <button onClick={()=>onDelete(rec.id)} style={{
            width:28,height:28,borderRadius:8,border:"1px solid rgba(220,38,38,0.2)",
            background:"rgba(220,38,38,0.05)",cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Cleanup reminder for old transcribed recordings */}
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
          <button onClick={()=>onDelete(rec.id)} style={{
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function NoteWellRecorder() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOnline,      setIsOnline]      = useState(navigator.onLine);
  const [mode,          setMode]          = useState(navigator.onLine ? "live" : "offline");
  const [recState,      setRecState]      = useState("idle");   // idle|recording|paused
  const [elapsed,       setElapsed]       = useState(0);        // ms elapsed
  const [recordings,    setRecordings]    = useState([]);
  const [showSheet,     setShowSheet]     = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [titleModal,    setTitleModal]    = useState(null);     // { chunks, duration, totalSize, chunkCount }
  const [playingId,     setPlayingId]     = useState(null);
  const [toast,         setToast]         = useState(null);
  const [storageWarning, setStorageWarning] = useState(null);
  const [chunksCompleted, setChunksCompleted] = useState(0);
  const [syncProgress,  setSyncProgress]  = useState(null);
  const [bitrate,       setBitrate]       = useState(getSavedBitrate());
  const [activeStream,  setActiveStream]  = useState(null);  // MediaStream for waveform
  const recorderRef  = useRef(null);  // ChunkedRecorder instance
  const timerRef     = useRef(null);
  const audioRef     = useRef(new Audio());

  // ── Connectivity ──────────────────────────────────────────────────────────
  useEffect(() => {
    const goOnline  = () => { setIsOnline(true);  setMode("live");    };
    const goOffline = () => { setIsOnline(false); setMode("offline"); };
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // ── Load saved recordings ─────────────────────────────────────────────────
  const refresh = useCallback(() => dbAll().then(setRecordings).catch(console.error), []);
  useEffect(() => { refresh(); }, [refresh]);

  // ── Storage quota check ───────────────────────────────────────────────────
  useEffect(() => {
    const checkStorage = async () => {
      if (!navigator.storage?.estimate) return;
      try {
        const { usage, quota } = await navigator.storage.estimate();
        const usedMB = Math.round((usage || 0) / (1024 * 1024));
        const percentUsed = quota ? Math.round(((usage || 0) / quota) * 100) : 0;
        if (usedMB > 500 || percentUsed > 80) {
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

  // ── Recording controls (chunked) ─────────────────────────────────────────
  const startRecording = async () => {
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

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startTime);
      }, 500);
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
    // Resume timer from where we left off
    const resumeFrom = Date.now() - elapsed;
    timerRef.current = setInterval(() => setElapsed(Date.now() - resumeFrom), 500);
    setRecState("recording");
  };

  const stopRecording = async () => {
    clearInterval(timerRef.current);
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
    setTitleModal({ chunks, duration: durationSecs, totalSize, chunkCount: chunks.length });
    setElapsed(0);
  };

  const saveRecording = async (title) => {
    if (!titleModal?.chunks) return;
    const { chunks, duration, totalSize, chunkCount } = titleModal;

    // Store each chunk's ArrayBuffer in IndexedDB
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

    const rec = {
      id:         `rec_${Date.now()}`,
      title,
      createdAt:  Date.now(),
      duration,
      size:       totalSize,
      mimeType:   chunks[0]?.blob.type || "audio/webm",
      chunks:     chunkData,
      chunkCount,
      // Keep audioData as first chunk for playback compatibility
      audioData:  chunkData[0]?.arrayBuffer,
      status:     "local",
    };
    await dbPut(rec);
    await refresh();
    setTitleModal(null);
    showToast("Recording saved", "success");

    // If online, kick off sync immediately
    if (isOnline) syncRecording(rec);
  };

  // ── Sync (chunked) ───────────────────────────────────────────────────────
  const syncRecording = async (rec) => {
    // Check authentication first
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast("Redirecting to sign in…", "info");
      navigate("/auth", { state: { returnTo: location.pathname } });
      return;
    }

    await dbPatch(rec.id, { status: "syncing" });
    await refresh();

    try {
      const sessionId = crypto.randomUUID();
      const chunks = rec.chunks || [];
      const totalChunks = chunks.length;

      // If no chunk data, fall back to single-file upload
      if (totalChunks === 0 && rec.audioData) {
        await syncLegacySingleFile(rec, user);
        return;
      }

      // ── Phase 1: Upload all chunks to storage ──────────────────────────
      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks[i];
        const paddedIndex = String(chunk.index).padStart(3, "0");
        const storagePath = `${sessionId}/chunk_${paddedIndex}.webm`;
        const blob = new Blob([chunk.arrayBuffer], { type: chunk.mimeType || "audio/webm" });

        setSyncProgress({
          phase: "uploading", currentChunk: i + 1, totalChunks,
          percentComplete: Math.round(((i + 1) / totalChunks) * 30),
          message: `Uploading segment ${i + 1} of ${totalChunks}…`,
        });

        const { error } = await supabase.storage
          .from("recordings")
          .upload(storagePath, blob, { contentType: chunk.mimeType || "audio/webm", upsert: true });
        if (error) throw error;
      }

      await dbPatch(rec.id, { status: "synced" });
      await refresh();

      // ── Phase 2: Transcribe each chunk ────────────────────────────────
      const chunkTranscripts = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks[i];
        const paddedIndex = String(chunk.index).padStart(3, "0");
        const storagePath = `${sessionId}/chunk_${paddedIndex}.webm`;

        setSyncProgress({
          phase: "transcribing", currentChunk: i + 1, totalChunks,
          percentComplete: 30 + Math.round(((i + 1) / totalChunks) * 55),
          message: `Transcribing segment ${i + 1} of ${totalChunks}…`,
        });

        const { data: transcriptData, error: fnErr } = await supabase.functions
          .invoke("standalone-whisper", {
            body: { storagePath, bucket: "recordings", responseFormat: "verbose_json" },
          });
        if (fnErr) {
          console.warn(`Chunk ${i} transcription failed:`, fnErr);
          chunkTranscripts.push({ index: chunk.index, text: "", segments: [], success: false });
        } else {
          const offsetSec = (chunk.startTimeMs || 0) / 1000;
          const segments = (transcriptData?.segments || []).map(seg => ({
            start: seg.start + offsetSec,
            end: seg.end + offsetSec,
            text: seg.text?.trim() || "",
          }));
          chunkTranscripts.push({
            index: chunk.index,
            text: transcriptData?.text || "",
            segments,
            success: true,
          });
        }
      }

      // ── Phase 3: Stitch transcripts ───────────────────────────────────
      setSyncProgress({
        phase: "stitching", currentChunk: totalChunks, totalChunks,
        percentComplete: 90, message: "Assembling final transcript…",
      });

      let fullTranscript;
      const successfulChunks = chunkTranscripts.filter(c => c.success && c.text).sort((a, b) => a.index - b.index);
      if (successfulChunks.length <= 1) {
        fullTranscript = successfulChunks[0]?.text || "";
      } else {
        // Stitch with overlap deduplication
        const allSegments = [];
        let lastEndTime = 0;
        for (const ct of successfulChunks) {
          for (const seg of ct.segments) {
            if (seg.end <= lastEndTime + 0.5) continue;
            allSegments.push(seg);
            lastEndTime = Math.max(lastEndTime, seg.end);
          }
        }
        fullTranscript = allSegments.map(s => s.text).join(" ").replace(/\s+/g, " ").trim();
      }

      if (!fullTranscript) {
        fullTranscript = chunkTranscripts.map(c => c.text).filter(Boolean).join(" ").trim();
      }

      await dbPatch(rec.id, { status: "transcribed", transcript: fullTranscript });
      await refresh();

      const failedCount = chunkTranscripts.filter(c => !c.success).length;
      if (failedCount > 0) {
        showToast(`${failedCount} segment${failedCount > 1 ? "s" : ""} failed — partial transcript`, "error");
      } else {
        showToast("Transcription complete", "success");
      }

      // ── Step 4: Create meeting record ─────────────────────────────────
      setSyncProgress({
        phase: "stitching", currentChunk: totalChunks, totalChunks,
        percentComplete: 92, message: "Creating meeting record…",
      });

      // Re-verify auth before meeting creation (token may have expired during long transcription)
      const { data: { user: freshUser } } = await supabase.auth.getUser();
      const activeUser = freshUser || user;
      console.log("[ChunkedSync] Creating meeting. activeUser:", activeUser?.id, "transcript length:", fullTranscript.length);

      if (!activeUser?.id) {
        console.error("[ChunkedSync] No authenticated user for meeting creation");
        showToast("Session expired — please sign in and sync again", "error");
        setSyncProgress(null);
        return;
      }

      const wordCount = fullTranscript.split(/\s+/).filter(Boolean).length;
      const durationMins = Math.round((rec.duration || 0) / 60);

      const { data: meetingData, error: meetingErr } = await supabase
        .from("meetings")
        .insert({
          title: rec.title || `Mobile Recording ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
          user_id: activeUser.id,
          status: "completed",
          meeting_type: "general",
          start_time: new Date(rec.createdAt).toISOString(),
          end_time: new Date().toISOString(),
          duration_minutes: durationMins,
          word_count: wordCount,
          import_source: "mobile_recorder",
          whisper_transcript_text: fullTranscript,
          primary_transcript_source: "whisper",
        })
        .select("id")
        .single();

      if (meetingErr) {
        console.error("Meeting creation failed:", meetingErr);
        console.error("Meeting creation error details:", JSON.stringify(meetingErr));
        // Retry once after re-checking auth
        const { data: { user: retryUser } } = await supabase.auth.getUser();
        if (retryUser) {
          const { data: retryData, error: retryErr } = await supabase
            .from("meetings")
            .insert({
              title: rec.title || `Mobile Recording ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
              user_id: retryUser.id,
              status: "completed",
              meeting_type: "general",
              start_time: new Date(rec.createdAt).toISOString(),
              end_time: new Date().toISOString(),
              duration_minutes: durationMins,
              word_count: wordCount,
              import_source: "mobile_recorder",
              whisper_transcript_text: fullTranscript,
              primary_transcript_source: "whisper",
            })
            .select("id")
            .single();
          if (!retryErr && retryData) {
            console.log("Meeting creation succeeded on retry");
            // Continue with the retry data
            const meetingId = retryData.id;
            for (const ct of successfulChunks) {
              await supabase.from("meeting_transcription_chunks").insert({
                meeting_id: meetingId, user_id: retryUser.id, session_id: sessionId,
                chunk_number: ct.index, transcription_text: ct.text, is_final: true,
                source: "whisper", transcriber_type: "whisper",
                word_count: ct.text.split(/\s+/).filter(Boolean).length,
              });
            }
            await dbPatch(rec.id, { meetingId });
            await refresh();
            setSyncProgress({ phase: "complete", currentChunk: totalChunks, totalChunks, percentComplete: 100, message: `Complete — ${wordCount} words` });
            showToast("Meeting created — generating notes…", "success");
            // Use auto-generate-meeting-notes (same as desktop) for title + governance-grade notes
            const storedModel = localStorage.getItem('meeting-regenerate-llm');
            const modelOverride = !storedModel || storedModel === 'gemini-3-flash' ? 'claude-sonnet-4-6' : storedModel;
            supabase.functions.invoke("auto-generate-meeting-notes", {
              body: { meetingId, modelOverride, skipQc: true },
            }).then(({ error: genErr }) => {
              if (genErr) showToast("Meeting saved — note generation failed", "error");
              else {
                showToast("Meeting notes generated ✨", "success");
                // Trigger overview + auto-email after notes complete
                triggerPostNoteActions(meetingId, fullTranscript);
              }
              setSyncProgress(null); refresh();
            });
            return;
          }
          console.error("Meeting creation retry also failed:", retryErr);
        }
        const errMsg = meetingErr?.message || meetingErr?.details || JSON.stringify(meetingErr);
        showToast(`Transcribed but meeting creation failed: ${errMsg}`, "error");
        setSyncProgress(null);
        return;
      }

      const meetingId = meetingData.id;

      // ── Step 5: Store transcript chunks ───────────────────────────────
      for (const ct of successfulChunks) {
        await supabase.from("meeting_transcription_chunks").insert({
          meeting_id: meetingId,
          user_id: activeUser.id,
          session_id: sessionId,
          chunk_number: ct.index,
          transcription_text: ct.text,
          is_final: true,
          source: "whisper",
          transcriber_type: "whisper",
          word_count: ct.text.split(/\s+/).filter(Boolean).length,
        });
      }

      await dbPatch(rec.id, { meetingId });
      await refresh();

      setSyncProgress({
        phase: "complete", currentChunk: totalChunks, totalChunks,
        percentComplete: 100, message: `Complete — ${wordCount} words`,
      });
      showToast("Meeting created — generating notes…", "success");

      // ── Step 6: Trigger note generation (same pipeline as desktop) ────
      const storedModel = localStorage.getItem('meeting-regenerate-llm');
      const modelOverride = !storedModel || storedModel === 'gemini-3-flash' ? 'claude-sonnet-4-6' : storedModel;
      supabase.functions
        .invoke("auto-generate-meeting-notes", {
          body: {
            meetingId,
            modelOverride,
            skipQc: true,
          },
        })
        .then(({ error: genErr }) => {
          if (genErr) {
            console.error("Note generation failed:", genErr);
            showToast("Meeting saved — note generation failed", "error");
          } else {
            showToast("Meeting notes generated ✨", "success");
            // Trigger overview + auto-email after notes complete
            triggerPostNoteActions(meetingId, fullTranscript);
          }
          setSyncProgress(null);
          refresh();
        });
    } catch (err) {
      console.error("Sync error:", err);
      await dbPatch(rec.id, { status: "error" });
      await refresh();
      setSyncProgress(null);
      const msg = err?.message || err?.error_description || "Unknown error";
      showToast(`Sync failed: ${msg}`, "error");
    }
  };

  // Legacy single-file sync for recordings saved before chunked update
  const syncLegacySingleFile = async (rec, user) => {
    try {
      const audioBlob = new Blob([rec.audioData], { type: rec.mimeType });
      const ext = rec.mimeType?.includes("mp4") ? "m4a" : rec.mimeType?.includes("ogg") ? "ogg" : "webm";
      const filePath = `${user.id}/${rec.id}.${ext}`;

      setSyncProgress({
        phase: "uploading", currentChunk: 1, totalChunks: 1,
        percentComplete: 20, message: "Uploading audio…",
      });

      const { error } = await supabase.storage
        .from("recordings")
        .upload(filePath, audioBlob, { contentType: rec.mimeType, upsert: true });
      if (error) throw error;

      await dbPatch(rec.id, { status: "synced" });
      await refresh();

      setSyncProgress({
        phase: "transcribing", currentChunk: 1, totalChunks: 1,
        percentComplete: 50, message: "Transcribing…",
      });

      const { data: transcriptData, error: fnErr } = await supabase.functions
        .invoke("standalone-whisper", {
          body: { storagePath: filePath, bucket: "recordings" },
        });
      if (fnErr) throw fnErr;

      const transcriptText = transcriptData?.text || "";
      await dbPatch(rec.id, { status: "transcribed", transcript: transcriptText });
      await refresh();

      setSyncProgress({
        phase: "transcribing", currentChunk: 1, totalChunks: 1,
        percentComplete: 85, message: "Creating meeting record…",
      });

      showToast("Transcription complete", "success");

      // Re-verify auth before meeting creation (token may have expired during long transcription)
      const { data: { user: freshUser } } = await supabase.auth.getUser();
      const activeUser = freshUser || user;
      console.log("[LegacySync] Creating meeting. activeUser:", activeUser?.id, "transcript length:", transcriptText.length);

      if (!activeUser?.id) {
        console.error("[LegacySync] No authenticated user for meeting creation");
        showToast("Session expired — please sign in and sync again", "error");
        await dbPatch(rec.id, { status: "transcribed", transcript: transcriptText });
        await refresh();
        setSyncProgress(null);
        return;
      }

      // Create meeting
      const wordCount = transcriptText.split(/\s+/).filter(Boolean).length;
      const sessionId = crypto.randomUUID();
      console.log("[LegacySync] Inserting meeting. wordCount:", wordCount, "title:", rec.title);
      const { data: meetingData, error: meetingErr } = await supabase
        .from("meetings")
        .insert({
          title: rec.title || `Mobile Recording ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
          user_id: activeUser.id, status: "completed", meeting_type: "general",
          start_time: new Date(rec.createdAt).toISOString(), end_time: new Date().toISOString(),
          duration_minutes: Math.round((rec.duration || 0) / 60), word_count: wordCount,
          import_source: "mobile_recorder", whisper_transcript_text: transcriptText,
          primary_transcript_source: "whisper",
        }).select("id").single();

      if (meetingErr) {
        console.error("[LegacySync] Meeting creation failed:", meetingErr, JSON.stringify(meetingErr));
        const errMsg = meetingErr?.message || meetingErr?.details || JSON.stringify(meetingErr);
        showToast(`Transcribed but meeting creation failed: ${errMsg}`, "error");
        setSyncProgress(null);
        return;
      }

      console.log("[LegacySync] Meeting created:", meetingData?.id);

      await supabase.from("meeting_transcription_chunks").insert({
        meeting_id: meetingData.id, user_id: activeUser.id, session_id: sessionId,
        chunk_number: 0, transcription_text: transcriptText, is_final: true,
        source: "whisper", transcriber_type: "whisper", word_count: wordCount,
      });

      await dbPatch(rec.id, { meetingId: meetingData.id });
      await refresh();

      setSyncProgress({
        phase: "complete", currentChunk: 1, totalChunks: 1,
        percentComplete: 100, message: `Complete — ${wordCount} words`,
      });
      showToast("Meeting created — generating notes…", "success");

      // Use auto-generate-meeting-notes (same as desktop) for title + governance-grade notes
      const storedModel = localStorage.getItem('meeting-regenerate-llm');
      const modelOverride = !storedModel || storedModel === 'gemini-3-flash' ? 'claude-sonnet-4-6' : storedModel;
      supabase.functions.invoke("auto-generate-meeting-notes", {
        body: { meetingId: meetingData.id, modelOverride, skipQc: true },
      }).then(({ error: genErr }) => {
        if (genErr) {
          console.error("[LegacySync] Note generation failed:", genErr);
          showToast("Meeting saved — note generation failed", "error");
        } else {
          showToast("Meeting notes generated ✨", "success");
          // Trigger overview + auto-email after notes complete
          triggerPostNoteActions(meetingData.id, transcriptText);
        }
        setSyncProgress(null);
        refresh();
      });
    } catch (err) {
      console.error("[LegacySync] Error:", err);
      await dbPatch(rec.id, { status: "error" });
      await refresh();
      setSyncProgress(null);
      showToast(`Sync failed: ${err?.message || "Unknown error"}`, "error");
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState(null); // recording id pending delete

  const deleteRecording = async (id) => {
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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes barPulse  { from{transform:scaleY(0.5)} to{transform:scaleY(1)} }
        @keyframes ripple    { 0%{transform:scale(1);opacity:0.7} 100%{transform:scale(2.4);opacity:0} }
        @keyframes slideUp   { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
        @keyframes pulse     { 0%,100%{opacity:1} 50%{opacity:0.4} }
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

        {/* Sync badge (shown inline when needed) */}
        {localCount > 0 && isOnline && (
          <div style={{padding:"8px 16px 0",display:"flex",justifyContent:"center"}}>
            <button
              onClick={() => recordings.filter(r=>r.status==="local"||r.status==="error").forEach(syncRecording)}
              style={{background:"rgba(245,158,11,0.9)",borderRadius:20,padding:"5px 12px",fontSize:11,color:"white",fontWeight:700,border:"none",cursor:"pointer",fontFamily:"inherit"}}
            >
              ↑ Sync {localCount}
            </button>
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
        <SyncProgressBar progress={syncProgress} />

        {/* Scrollable body */}
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>

          {/* Mode pill row */}
          <div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <button onClick={()=>setShowSettings(true)} style={{width:36,height:36,borderRadius:10,border:"1px solid rgba(21,101,192,0.15)",background:"white",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}} title="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1565c0" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
            <ModePill mode={mode} disabled={active} onTap={()=>setShowSheet(true)} />
            <button onClick={()=>navigate("/meetings")} style={{width:36,height:36,borderRadius:10,border:"1px solid rgba(21,101,192,0.15)",background:"white",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}} title="My Meetings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1565c0" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </button>
          </div>

          {/* Offline banner */}
          {!isOnline && isIdle && (
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
                    {mode==="live" ? "Live transcript will appear as you speak" : "Recording saved locally · transcribed on sync"}
                  </div>
                </>
              )}
              {active && (
                <>
                  <div style={{fontSize:40,fontWeight:700,letterSpacing:-2,fontVariantNumeric:"tabular-nums",
                    color:isPaused?"#f59e0b":"#1565c0",transition:"color 0.3s"}}>
                    {fmtDuration(elapsed)}
                  </div>
                  <div style={{fontSize:12,fontWeight:500,marginTop:3,display:"flex",alignItems:"center",justifyContent:"center",gap:5,
                    color:isPaused?"#f59e0b":"#16a34a"}}>
                    {isRecording && <span style={{width:7,height:7,borderRadius:"50%",background:"#dc2626",display:"inline-block",animation:"pulse 1s infinite"}}/>}
                    {isRecording ? (mode==="live"?"Recording · Transcribing live":"Recording · Saving locally") : "⏸ Paused"}
                  </div>
                  {/* Chunk indicator */}
                  {chunksCompleted > 0 && (
                    <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>
                      {chunksCompleted} segment{chunksCompleted !== 1 ? "s" : ""} completed
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Waveform */}
            <div style={{background:"#f8fafc",borderRadius:14,padding:"10px 16px",marginBottom:18,border:"1px solid rgba(21,101,192,0.07)",minHeight:60,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <WaveformBars active={isRecording} isPaused={isPaused} stream={activeStream} />
            </div>

            {/* Controls */}
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
                  onClick={isIdle ? startRecording : isRecording ? pauseRecording : resumeRecording}
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
              <div style={{textAlign:"center",marginTop:12,fontSize:11,color:"#94a3b8"}}>
                {mode==="live" ? "📶 Connected · transcript streams in real-time" : "📴 Offline · recording queued for transcription"}
              </div>
            )}
          </div>

          {/* Steps — idle only */}
          {isIdle && (
            <div style={{margin:"12px 16px 0",display:"flex",gap:8}}>
              {[
                {n:"1",icon:mode==="live"?"🎙️":"🎙️",label:mode==="live"?"Tap record to start":"Record offline"},
                {n:"2",icon:mode==="live"?"📝":"💾",label:mode==="live"?"Live transcript appears":"Saved to device"},
                {n:"3",icon:"✨",label:"Notes generated on stop"},
              ].map(s=>(
                <div key={s.n} style={{flex:1,background:"white",borderRadius:14,padding:"12px 8px",textAlign:"center",boxShadow:"0 2px 8px rgba(21,101,192,0.07)",border:"1px solid rgba(21,101,192,0.08)"}}>
                  <div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>
                  <div style={{width:20,height:20,borderRadius:"50%",background:"rgba(21,101,192,0.1)",color:"#1565c0",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 6px"}}>{s.n}</div>
                  <div style={{fontSize:11,color:"#475569",lineHeight:1.4,fontWeight:500}}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Recordings list */}
          <div style={{padding:"14px 16px 28px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:600,color:"#94a3b8",letterSpacing:0.5,textTransform:"uppercase"}}>
                Recordings ({recordings.length})
              </div>
              {localCount > 0 && isOnline && (
                <button
                  onClick={()=>recordings.filter(r=>r.status==="local"||r.status==="error").forEach(syncRecording)}
                  style={{fontSize:11,color:"#1565c0",fontWeight:700,border:"1px solid rgba(21,101,192,0.2)",background:"rgba(21,101,192,0.05)",cursor:"pointer",padding:"3px 10px",borderRadius:8,fontFamily:"inherit"}}
                >
                  ↑ Sync all
                </button>
              )}
            </div>

            {recordings.length === 0 ? (
              <div style={{textAlign:"center",padding:"28px 20px",color:"#94a3b8"}}>
                <div style={{fontSize:36,marginBottom:8}}>🎙️</div>
                <div style={{fontSize:14,fontWeight:500}}>No recordings yet</div>
                <div style={{fontSize:12,marginTop:3}}>Tap the button above to start</div>
              </div>
            ) : recordings.map(r => (
              <RecordingItem key={r.id} rec={r}
                onDelete={deleteRecording} onSync={syncRecording}
                onPlay={playRecording} isPlaying={playingId===r.id} />
            ))}

            {/* My Meetings card */}
            <button
              onClick={()=>navigate("/meetings")}
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
          <ModeSheet mode={mode} onClose={()=>setShowSheet(false)} onSelect={m=>{setMode(m);setShowSheet(false);}} />
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
            onSave={saveRecording}
            onDiscard={()=>{ setTitleModal(null); setElapsed(0); }}
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

        {/* Toast */}
        {toast && <Toast msg={toast.msg} type={toast.type} />}
      </div>
    </>
  );
}
