import { useState, useRef, useEffect, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";

export const VOICE_SERVICES = [
  {
    id: "nres",
    name: "NRES Assistant",
    subtitle: "Neighbourhood Access Service",
    description: "Ask about the NRES programme, staffing, governance, contracts, and the Fuller Stocktake vision.",
    icon: "🏘️",
    agentId: import.meta.env.VITE_NRES_ELEVENLABS_AGENT_ID || "",
    accentColor: "#005EB8",
    glowColor: "rgba(0,94,184,0.35)",
    badgeColor: "#E6F1FB",
    badgeText: "NRES",
    category: "Programme",
  },
  {
    id: "translation",
    name: "Live Translation",
    subtitle: "Multilingual patient support",
    description: "Real-time voice translation for patient consultations across 30+ languages.",
    icon: "🌐",
    agentId: import.meta.env.VITE_TRANSLATION_ELEVENLABS_AGENT_ID || "",
    accentColor: "#009639",
    glowColor: "rgba(0,150,57,0.35)",
    badgeColor: "#E6F9EE",
    badgeText: "Translation",
    category: "Clinical",
  },
  {
    id: "triage",
    name: "GP Triage",
    subtitle: "Enhanced access reception",
    description: "AI-assisted triage and appointment booking for extended hours and enhanced access sessions.",
    icon: "🩺",
    agentId: import.meta.env.VITE_TRIAGE_ELEVENLABS_AGENT_ID || "",
    accentColor: "#AE2573",
    glowColor: "rgba(174,37,115,0.35)",
    badgeColor: "#FAEEF5",
    badgeText: "Triage",
    category: "Clinical",
  },
  {
    id: "agewell",
    name: "AgeWell Support",
    subtitle: "Elderly patient companion",
    description: "Warm, patient conversational support for elderly patients — medication reminders, care plan queries.",
    icon: "💙",
    agentId: import.meta.env.VITE_AGEWELL_ELEVENLABS_AGENT_ID || "",
    accentColor: "#41B6E6",
    glowColor: "rgba(65,182,230,0.35)",
    badgeColor: "#E6F7FB",
    badgeText: "AgeWell",
    category: "Care",
  },
];

const CATEGORIES = ["All", "Programme", "Clinical", "Care"];

function Waveform({ active, color = "#fff" }) {
  const bars = [3, 5, 8, 12, 9, 6, 10, 7, 4, 6, 11, 8, 5];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 32 }}>
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: h * 2,
            borderRadius: 2,
            background: color,
            opacity: active ? 1 : 0.3,
            animation: active ? `wave 0.6s ease-in-out ${i * 0.07}s infinite alternate` : "none",
            transition: "opacity 0.3s",
          }}
        />
      ))}
      <style>{`@keyframes wave{from{transform:scaleY(0.4)}to{transform:scaleY(1.2)}}`}</style>
    </div>
  );
}

function PulseRing({ color, size = 120, active }) {
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `2px solid ${color}`,
            opacity: active ? 0.4 : 0.1,
            animation: active ? `pulse-ring 2s ease-out ${i * 0.5}s infinite` : "none",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          inset: "20%",
          borderRadius: "50%",
          background: color,
          opacity: active ? 0.25 : 0.08,
        }}
      />
      <style>{`@keyframes pulse-ring{0%{transform:scale(1);opacity:0.4}100%{transform:scale(1.6);opacity:0}}`}</style>
    </div>
  );
}

export function StatusDot({ status, color }) {
  const colors = {
    idle: "#94a3b8",
    connecting: "#f59e0b",
    active: color,
    error: "#ef4444",
    ended: "#94a3b8",
  };
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: colors[status] || "#94a3b8",
        boxShadow: status === "active" ? `0 0 8px ${colors[status]}` : "none",
        animation: status === "connecting" ? "blink 1s ease-in-out infinite" : "none",
        marginRight: 6,
        flexShrink: 0,
      }}
    />
  );
}

const STATUS_LABELS = {
  idle: "Ready",
  connecting: "Connecting…",
  active: "Live",
  error: "Error — retry",
  ended: "Session ended",
};

const OVERLAY_STATUS_LABELS = {
  idle: "Ready",
  connecting: "Connecting…",
  active: "Live session",
  error: "Connection error",
  ended: "Session ended",
};

export default function NotewellVoiceHub() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeService, setActiveService] = useState(null);
  const [sessionStatus, setSessionStatus] = useState({});
  const [transcript, setTranscript] = useState({});
  const [overlayOpen, setOverlayOpen] = useState(false);
  const audioCtxRef = useRef(null);
  const scrollRef = useRef(null);
  const keepAliveRef = useRef(null);

  const getStatus = (id) => sessionStatus[id] || "idle";
  const setStatus = (id, s) => setSessionStatus((p) => ({ ...p, [id]: s }));
  const addMessage = (id, role, text) =>
    setTranscript((p) => ({
      ...p,
      [id]: [
        ...(p[id] || []),
        {
          role,
          text,
          ts: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        },
      ],
    }));

  const activeServiceRef = useRef(null);
  useEffect(() => { activeServiceRef.current = activeService; }, [activeService]);

  const conversation = useConversation({
    onConnect: () => {
      const svcId = activeServiceRef.current;
      if (svcId) {
        setStatus(svcId, "active");
      }
      keepAliveRef.current = setInterval(() => {
        try { conversation.sendUserActivity(); } catch (_) {}
      }, 1500);
    },
    onDisconnect: () => {
      const svcId = activeServiceRef.current;
      if (svcId) {
        setStatus(svcId, "ended");
      }
      setOverlayOpen(false);
      setActiveService(null);
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
    },
    onMessage: (msg) => {
      const svcId = activeServiceRef.current;
      if (!svcId) return;
      if (msg.type === "agent_response") {
        addMessage(svcId, "agent", msg.agent_response_event?.agent_response || "");
      } else if (msg.type === "user_transcript") {
        addMessage(svcId, "user", msg.user_transcription_event?.user_transcript || "");
      }
    },
    onError: (err) => {
      console.error("ElevenLabs error:", err);
      const svcId = activeServiceRef.current;
      if (svcId) {
        setStatus(svcId, "error");
      }
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript]);

  const prewarmAudio = useCallback(async () => {
    if (!audioCtxRef.current)
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
    await new Promise((r) => setTimeout(r, 400));
  }, []);

  const startSession = useCallback(
    async (service) => {
      setStatus(service.id, "connecting");
      setActiveService(service.id);
      setOverlayOpen(true);
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        await prewarmAudio();
        const agentId = service.agentId;
        if (!agentId) {
          throw new Error(`No agent ID configured for ${service.name}`);
        }
        await conversation.startSession({
          agentId,
          connectionType: "websocket",
        });
      } catch (err) {
        console.error(err);
        setStatus(service.id, "error");
      }
    },
    [prewarmAudio, conversation]
  );

  const endSession = useCallback(
    async (id) => {
      try {
        await conversation.endSession();
      } catch (_) {}
      setStatus(id, "ended");
      setOverlayOpen(false);
      setActiveService(null);
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
    },
    [conversation]
  );

  useEffect(() => {
    return () => {
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      try { conversation.endSession(); } catch (_) {}
    };
  }, []);

  const filtered = VOICE_SERVICES.filter((s) => activeCategory === "All" || s.category === activeCategory);
  const currentService = VOICE_SERVICES.find((s) => s.id === activeService);
  const msgs = transcript[activeService] || [];

  return (
    <div style={{ minHeight: "100vh", background: "#F0F4F8", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes slide-up{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fade-in{from{opacity:0}to{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .svc-card{background:#fff;border-radius:20px;border:1.5px solid #e2e8f0;padding:24px;cursor:pointer;transition:all 0.2s;position:relative;overflow:hidden}
        .svc-card:hover{transform:translateY(-3px);box-shadow:0 12px 40px rgba(0,0,0,0.1)}
        .cat-pill{padding:6px 16px;border-radius:999px;border:1.5px solid #e2e8f0;background:#fff;font-size:13px;font-weight:500;color:#64748b;cursor:pointer;transition:all 0.15s;font-family:inherit}
        .cat-pill.active{background:#003087;border-color:#003087;color:#fff}
        .start-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:999px;border:none;cursor:pointer;font-size:14px;font-weight:600;font-family:inherit;transition:all 0.15s}
        @media(min-width:640px){.card-grid{grid-template-columns:repeat(2,1fr)!important}}
        @media(min-width:1024px){.card-grid{grid-template-columns:repeat(4,1fr)!important}}
      `}</style>

      <div style={{ background: "linear-gradient(135deg,#003087 0%,#005EB8 50%,#0072CE 100%)", padding: "32px 24px 28px", color: "#fff" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
              🎙
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Notewell Voice Hub</h1>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>NHS Primary Care · AI Voice Services</p>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.75, lineHeight: 1.5 }}>
            All ElevenLabs voice agents in one place — tap any service to start a live voice session.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 24px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`cat-pill${activeCategory === cat ? " active" : ""}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 24px 100px" }}>
        <div className="card-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          {filtered.map((service) => {
            const status = getStatus(service.id);
            const lastMsg = (transcript[service.id] || []).slice(-1)[0];
            return (
              <div
                key={service.id}
                className="svc-card"
                onClick={() =>
                  status === "idle" || status === "ended"
                    ? startSession(service)
                    : (setActiveService(service.id), setOverlayOpen(true))
                }
              >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: service.accentColor, borderRadius: "20px 20px 0 0" }} />
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 28 }}>{service.icon}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>{service.name}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{service.subtitle}</div>
                    </div>
                  </div>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "3px 10px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: service.badgeColor,
                      color: service.accentColor,
                    }}
                  >
                    {service.badgeText}
                  </span>
                </div>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "#475569", lineHeight: 1.5 }}>{service.description}</p>
                {lastMsg && (
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "#f8fafc",
                      fontSize: 12,
                      color: "#64748b",
                      marginBottom: 12,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {lastMsg.role === "agent" ? "Agent" : "You"}: {lastMsg.text}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", fontSize: 13, color: "#64748b" }}>
                    <StatusDot status={status} color={service.accentColor} />
                    {STATUS_LABELS[status]}
                  </div>
                  {status === "active" ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="start-btn"
                        style={{ background: service.accentColor, color: "#fff", fontSize: 12, padding: "6px 14px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveService(service.id);
                          setOverlayOpen(true);
                        }}
                      >
                        Open ↗
                      </button>
                      <button
                        className="start-btn"
                        style={{ background: "#ef4444", color: "#fff", fontSize: 12, padding: "6px 14px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          endSession(service.id);
                        }}
                      >
                        End
                      </button>
                    </div>
                  ) : (
                    <button
                      className="start-btn"
                      style={{ background: service.accentColor, color: "#fff" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (status !== "connecting") startSession(service);
                      }}
                    >
                      {status === "connecting" ? (
                        <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                      ) : (
                        "🎙"
                      )}
                      {status === "connecting" ? "Connecting…" : status === "error" ? "Retry" : "Start"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 24, display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {VOICE_SERVICES.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", fontSize: 12, color: "#64748b" }}>
              <StatusDot status={getStatus(s.id)} color={s.accentColor} />
              {s.name}
            </div>
          ))}
        </div>
      </div>

      {overlayOpen && currentService && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: `linear-gradient(180deg, ${currentService.accentColor} 0%, #001845 100%)`,
            display: "flex",
            flexDirection: "column",
            animation: "slide-up 0.35s ease-out",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 28 }}>{currentService.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, color: "#fff" }}>{currentService.name}</div>
                <div style={{ display: "flex", alignItems: "center", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  <StatusDot status={getStatus(currentService.id)} color="#fff" />
                  {OVERLAY_STATUS_LABELS[getStatus(currentService.id)]}
                </div>
              </div>
            </div>
            <button
              onClick={() => setOverlayOpen(false)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(255,255,255,0.15)",
                color: "#fff",
                fontSize: 18,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0 20px" }}>
            <PulseRing color={currentService.accentColor} size={120} active={getStatus(currentService.id) === "active"} />
            <div style={{ marginTop: 20 }}>
              <Waveform active={getStatus(currentService.id) === "active"} color="rgba(255,255,255,0.8)" />
            </div>
            {getStatus(currentService.id) === "error" && (
              <div style={{ marginTop: 16, fontSize: 13, color: "rgba(255,255,255,0.7)", textAlign: "center" }}>
                Unable to connect. Check your network and try again.
                <button
                  onClick={() => startSession(currentService)}
                  style={{
                    marginLeft: 10,
                    color: "#fff",
                    fontWeight: 600,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "underline",
                    fontSize: 13,
                  }}
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "0 20px 20px",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {msgs.length === 0 && getStatus(currentService.id) === "connecting" && (
              <p style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 20 }}>
                Connecting to {currentService.name}…
              </p>
            )}
            {msgs.map((m, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 10,
                  padding: "10px 14px",
                  borderRadius: 14,
                  background: m.role === "agent" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                  color: "#fff",
                  fontSize: 14,
                  lineHeight: 1.5,
                  maxWidth: "85%",
                  marginLeft: m.role === "user" ? "auto" : 0,
                  marginRight: m.role === "agent" ? "auto" : 0,
                  animation: "fade-in 0.3s ease",
                }}
              >
                {m.text}
                <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>{m.ts}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: "16px 20px", paddingBottom: `calc(16px + env(safe-area-inset-bottom, 0px))` }}>
            <button
              onClick={() => endSession(currentService.id)}
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 16,
                border: "none",
                background: "rgba(239,68,68,0.85)",
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 4px 20px rgba(239,68,68,0.4)",
              }}
            >
              ⏹ End Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
