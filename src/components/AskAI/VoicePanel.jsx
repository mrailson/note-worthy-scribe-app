/**
 * VoicePanel — Floating bottom-right popover with ElevenLabs widget.
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

  if (!open) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 140,
      right: 16,
      width: 340,
      maxHeight: "70vh",
      background: "#fff",
      borderRadius: 14,
      boxShadow: "0 8px 40px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.08)",
      border: "1px solid #E8EDEE",
      display: "flex",
      flexDirection: "column",
      zIndex: 9000,
      overflow: "hidden",
      animation: "nwFadeIn .2s ease",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        borderBottom: "1px solid #E8EDEE",
        background: "linear-gradient(135deg, #003087 0%, #005EB8 100%)",
        flexShrink: 0,
        borderRadius: "14px 14px 0 0",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "0.85rem", color: "#fff" }}>
          🎙 AI Voice Assistant
        </div>
        <button
          onClick={onClose}
          style={{
            width: 28, height: 28, borderRadius: 6,
            border: "1px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.12)",
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "0.85rem", color: "#fff",
            transition: "all .13s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.25)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.12)"; }}
          aria-label="Close voice panel"
        >✕</button>
      </div>

      {/* Widget area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        <p style={{ fontSize: "0.76rem", color: "#425563", marginBottom: 10, lineHeight: 1.5 }}>
          Speak with the AI Practice Manager assistant. Click the microphone below to start.
        </p>
        <div ref={widgetRef} style={{ minHeight: 80 }} />
      </div>
    </div>
  );
}
