/**
 * VoicePanel — Single-agent ElevenLabs widget panel for Ask AI.
 * Props: open, onClose
 */
import { useEffect, useRef } from "react";

const AGENT_ID = "agent_4901kp1a5we7eacrq7c3g4kme1m8";

function useElevenLabsScript() {
  useEffect(() => {
    if (document.querySelector('script[src*="convai-widget-embed"]')) return;
    const s = document.createElement("script");
    s.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
    s.async = true;
    document.body.appendChild(s);
  }, []);
}

export default function VoicePanel({ open, onClose }) {
  useElevenLabsScript();
  const widgetRef = useRef(null);

  useEffect(() => {
    if (!open || !widgetRef.current) return;
    widgetRef.current.innerHTML = "";
    const el = document.createElement("elevenlabs-convai");
    el.setAttribute("agent-id", AGENT_ID);
    widgetRef.current.appendChild(el);
    return () => {
      if (widgetRef.current) widgetRef.current.innerHTML = "";
    };
  }, [open]);

  return (
    <div style={{
      width: 340,
      flexShrink: 0,
      background: "#fff",
      borderLeft: "1px solid #E8EDEE",
      display: "flex",
      flexDirection: "column",
      transform: open ? "translateX(0)" : "translateX(340px)",
      transition: "transform 0.28s ease",
      position: open ? "relative" : "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      zIndex: 30,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px",
        borderBottom: "1px solid #E8EDEE",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "0.92rem", color: "#231F20" }}>
          🎙 AI Voice Assistant
        </div>
        <button
          onClick={onClose}
          style={{
            width: 32, height: 32, borderRadius: 8,
            border: "1px solid #E8EDEE", background: "#fff",
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "1rem", color: "#425563",
            transition: "all .13s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#F8FAFC"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
          aria-label="Close voice panel"
        >✕</button>
      </div>

      {/* Widget area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px" }}>
        <p style={{ fontSize: "0.78rem", color: "#425563", marginBottom: 12, lineHeight: 1.5 }}>
          Speak with the AI Practice Manager assistant. Click the microphone below to start.
        </p>
        <div ref={widgetRef} style={{ minHeight: 80 }} />
      </div>
    </div>
  );
}
