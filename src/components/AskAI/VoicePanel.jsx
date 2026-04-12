/**
 * VoicePanel — Compact slide-in panel for Ask AI desktop layout.
 * Imports shared VOICE_SERVICES and StatusDot from NotewellVoiceHub.
 * Props: open, onClose, sessionStatus, onStartSession, onEndSession
 */
import { VOICE_SERVICES, StatusDot } from "@/components/voice/NotewellVoiceHub";

const STATUS_LABELS = {
  idle: "Ready",
  connecting: "Connecting…",
  active: "Live",
  error: "Error — retry",
  ended: "Session ended",
};

export default function VoicePanel({ open, onClose, sessionStatus, onStartSession, onEndSession }) {
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
          🎙 Voice Services
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

      {/* Service cards */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px" }}>
        {VOICE_SERVICES.map(service => {
          const status = sessionStatus[service.id] || "idle";
          return (
            <div
              key={service.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid #E8EDEE",
                marginBottom: 8,
                background: status === "active" ? `${service.accentColor}08` : "#fff",
                transition: "background .15s",
                cursor: "default",
              }}
              onMouseEnter={e => { if (status !== "active") e.currentTarget.style.background = "#F8FAFC"; }}
              onMouseLeave={e => { e.currentTarget.style.background = status === "active" ? `${service.accentColor}08` : "#fff"; }}
            >
              {/* Icon */}
              <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>{service.icon}</span>

              {/* Name + subtitle */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#231F20", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {service.name}
                </div>
                <div style={{ fontSize: "0.7rem", color: "#425563", display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                  <StatusDot status={status} color={service.accentColor} />
                  {STATUS_LABELS[status] || "Ready"}
                </div>
              </div>

              {/* Action button */}
              {status === "active" ? (
                <button
                  onClick={() => onEndSession(service.id)}
                  style={{
                    background: "#DA291C", border: "none", borderRadius: 999,
                    padding: "6px 14px", cursor: "pointer", color: "#fff",
                    fontWeight: 700, fontSize: "0.74rem", height: 38,
                    flexShrink: 0, transition: "all .13s",
                  }}
                >End</button>
              ) : (
                <button
                  onClick={() => onStartSession(service)}
                  disabled={status === "connecting"}
                  style={{
                    background: status === "connecting" ? "#f59e0b" : service.accentColor,
                    border: "none", borderRadius: 999,
                    padding: "6px 14px", cursor: status === "connecting" ? "wait" : "pointer",
                    color: "#fff", fontWeight: 700, fontSize: "0.74rem",
                    height: 38, flexShrink: 0, transition: "all .13s",
                    opacity: status === "connecting" ? 0.8 : 1,
                  }}
                >
                  {status === "connecting" ? (
                    <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
                  ) : "Start"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
