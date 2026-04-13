// ─────────────────────────────────────────────
// ConnectionToggle.tsx
// Drop-in replacement for the static ● Offline indicator
// Place wherever the current status indicator lives in your header/toolbar
// ─────────────────────────────────────────────

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client"; // adjust path if needed
import { LoginModal } from "./LoginModal";
import { syncPendingRecordings } from "@/utils/syncRecordings"; // adjust path if needed

type SyncState = "offline" | "online" | "syncing" | "logging-in";

interface ConnectionToggleProps {
  pendingCount?: number; // pass in how many unsynced recordings exist
  onSyncComplete?: () => void;
}

export function ConnectionToggle({ pendingCount = 0, onSyncComplete }: ConnectionToggleProps) {
  const [syncState, setSyncState] = useState<SyncState>("offline");
  const [showLogin, setShowLogin] = useState(false);

  // ── On mount: if already authed + online, go live silently ──
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && navigator.onLine) {
        setSyncState("online");
        if (pendingCount > 0) {
          await runSync();
        }
      }
    };
    init();
  }, []);

  const runSync = async () => {
    setSyncState("syncing");
    try {
      await syncPendingRecordings();
      onSyncComplete?.();
    } catch (e) {
      console.error("Sync failed", e);
    } finally {
      setSyncState("online");
    }
  };

  const handleTap = async () => {
    // Going offline
    if (syncState === "online") {
      setSyncState("offline");
      return;
    }

    // Already syncing — do nothing
    if (syncState === "syncing") return;

    // Going online — check auth first
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setShowLogin(true);
      return;
    }

    // Already authed — go online and sync immediately
    setSyncState("online");
    if (pendingCount > 0) await runSync();
  };

  const handleLoginSuccess = async () => {
    setShowLogin(false);
    setSyncState("online");
    if (pendingCount > 0) await runSync();
  };

  // ── Visual config per state ──
  const stateConfig = {
    offline: {
      dot: "bg-gray-400",
      label: pendingCount > 0 ? `Offline · ${pendingCount} pending` : "Offline",
      pulse: false,
      clickable: true,
    },
    online: {
      dot: "bg-green-500",
      label: "Online",
      pulse: false,
      clickable: true,
    },
    syncing: {
      dot: "bg-blue-500",
      label: "Syncing…",
      pulse: true,
      clickable: false,
    },
    "logging-in": {
      dot: "bg-yellow-400",
      label: "Signing in…",
      pulse: true,
      clickable: false,
    },
  };

  const config = stateConfig[syncState];

  return (
    <>
      <button
        onClick={handleTap}
        disabled={!config.clickable}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-full
          text-sm font-medium transition-all duration-200
          ${config.clickable
            ? "hover:bg-black/5 active:scale-95 cursor-pointer"
            : "cursor-default opacity-80"
          }
        `}
        aria-label={`Connection status: ${config.label}. ${config.clickable ? "Tap to toggle." : ""}`}
      >
        {/* Dot — pulses when active */}
        <span className="relative flex h-2.5 w-2.5">
          {config.pulse && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-75`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.dot}`} />
        </span>

        <span className="text-gray-600">{config.label}</span>

        {/* Chevron hint when offline and tappable */}
        {syncState === "offline" && (
          <svg
            className="w-3 h-3 text-gray-400 ml-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>

      {/* Inline login modal — no navigation away */}
      {showLogin && (
        <LoginModal
          onSuccess={handleLoginSuccess}
          onClose={() => setShowLogin(false)}
        />
      )}
    </>
  );
}
