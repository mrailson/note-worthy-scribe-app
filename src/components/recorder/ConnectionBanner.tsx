// ConnectionBanner.tsx
// Mid-recording connection-loss banner + reconnect toast for the mobile recorder.
//
// Visible only while a recording is in progress and the connection state is interesting:
//   - Amber, dismissible: connection dropped mid-record (still recording into local buffer)
//   - Green, auto-dismiss after 3s: connection returned mid-record
// Renders nothing otherwise. Inline styles to stay consistent with the surrounding recorder UI.

import { useEffect, useState } from "react";
import { Wifi, WifiOff, X } from "lucide-react";

interface ConnectionBannerProps {
  /** True when an online recording has dropped to local buffering due to a mid-record disconnect. */
  connectionLostMidRecord: boolean;
  /** Live navigator.onLine value. */
  isOnline: boolean;
}

export function ConnectionBanner({ connectionLostMidRecord, isOnline }: ConnectionBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  // Reset dismissal when a new drop event happens.
  useEffect(() => {
    if (connectionLostMidRecord) setDismissed(false);
  }, [connectionLostMidRecord]);

  // Brief "back online" confirmation toast.
  useEffect(() => {
    if (connectionLostMidRecord && isOnline) {
      setShowReconnected(true);
      const t = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isOnline, connectionLostMidRecord]);

  if (dismissed && !showReconnected) return null;

  // Reconnected — green confirmation
  if (showReconnected) {
    return (
      <div
        style={{
          margin: "10px 16px 0",
          background: "rgba(22,163,74,0.1)",
          border: "1px solid rgba(22,163,74,0.28)",
          borderRadius: 12,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          animation: "fadeIn 0.3s",
        }}
        role="status"
        aria-live="polite"
      >
        <Wifi size={16} color="#15803d" style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#15803d" }}>
          Back online — recording will sync on stop
        </span>
      </div>
    );
  }

  // Dropped mid-recording — amber, dismissible
  if (connectionLostMidRecord && !isOnline) {
    return (
      <div
        style={{
          margin: "10px 16px 0",
          background: "rgba(245,158,11,0.1)",
          border: "1px solid rgba(245,158,11,0.35)",
          borderRadius: 12,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          animation: "fadeIn 0.3s",
        }}
        role="status"
        aria-live="polite"
      >
        <WifiOff size={16} color="#d97706" style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#92400e" }}>
          Connection lost — continuing offline, will sync when back online
        </span>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss connection notice"
          style={{
            background: "transparent",
            border: "none",
            padding: 4,
            borderRadius: 6,
            cursor: "pointer",
            color: "#92400e",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return null;
}
