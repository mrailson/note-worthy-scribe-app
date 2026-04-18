// src/components/AgeingWellDemoModal.tsx
// Full-screen split-view live demo modal: Notewell (Ageing Well) ↔ SystmOne inbox
// via simulated GP Connect / MESH sync using postMessage bridge.

import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, RotateCcw } from "lucide-react";

export interface AgeingWellDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName?: string;
  meetingTitle?: string;
}

const NOTEWELL_SRC = "/demo/notewell-gp-connect.html";
const SYSTMONE_SRC = "/demo/systmone-inbox.html";

const AgeingWellDemoModal: React.FC<AgeingWellDemoModalProps> = ({
  isOpen,
  onClose,
  patientName = "Dorothy Pearson",
  meetingTitle,
}) => {
  const [autoSync, setAutoSync] = useState(true);
  const [cacheBust, setCacheBust] = useState(() => Date.now());
  const leftIframeRef = useRef<HTMLIFrameElement | null>(null);
  const rightIframeRef = useRef<HTMLIFrameElement | null>(null);
  const autoSyncRef = useRef(autoSync);

  useEffect(() => {
    autoSyncRef.current = autoSync;
  }, [autoSync]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // PostMessage bridge: Notewell → SystmOne
  useEffect(() => {
    if (!isOpen) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "notewell:send-complete" && autoSyncRef.current) {
        window.setTimeout(() => {
          rightIframeRef.current?.contentWindow?.postMessage(
            { type: "systmone:refresh", payload: data.payload ?? null },
            "*"
          );
        }, 1800);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isOpen]);

  const handleReset = useCallback(() => {
    setCacheBust(Date.now());
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const subtitle = meetingTitle
    ? `${meetingTitle} — ${patientName}`
    : `Patient Support Plan sync to GP practice inbox via GP Connect / MESH${
        patientName ? ` — ${patientName}` : ""
      }`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-md animate-fade-in"
      style={{ background: "rgba(15, 30, 55, 0.55)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Ageing Well to GP Connect live demo"
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          width: "98vw",
          height: "96vh",
          animation: "demoSlideUp 300ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <style>{`
          @keyframes demoSlideUp {
            from { opacity: 0; transform: translateY(24px) scale(0.985); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 shrink-0"
          style={{ height: 64, background: "#1B3A5C", color: "#fff" }}
        >
          <div className="flex flex-col justify-center min-w-0">
            <div className="flex items-center gap-3">
              <span className="font-bold text-base sm:text-lg truncate">
                Ageing Well → GP Connect
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider"
                style={{ background: "#E67E22", color: "#1B1B1B" }}
              >
                LIVE DEMO
              </span>
            </div>
            <span
              className="text-xs mt-0.5 truncate"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              {subtitle}
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Auto-sync toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs sm:text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
                Auto-sync inbox
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={autoSync}
                onClick={() => setAutoSync((v) => !v)}
                className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                style={{ background: autoSync ? "#2E75B6" : "rgba(255,255,255,0.25)" }}
              >
                <span
                  className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                  style={{ transform: autoSync ? "translateX(18px)" : "translateX(2px)" }}
                />
              </button>
            </label>

            {/* Reset */}
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors"
              style={{
                background: "transparent",
                color: "rgba(255,255,255,0.85)",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <RotateCcw size={14} />
              Reset demo
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close demo"
              className="flex items-center justify-center h-8 w-8 rounded-md transition-colors"
              style={{ color: "#fff" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Split view */}
        <div
          className="flex-1 grid min-h-0"
          style={{
            gridTemplateColumns: "1fr 1px 1fr",
            background: "#fff",
          }}
        >
          <iframe
            key={`left-${cacheBust}`}
            ref={leftIframeRef}
            src={`${NOTEWELL_SRC}?v=${cacheBust}`}
            title="Notewell — Ageing Well Patient Support Plan"
            className="w-full h-full"
            style={{ border: "none", display: "block" }}
          />
          <div style={{ background: "#E2E8F0" }} />
          <iframe
            key={`right-${cacheBust}`}
            ref={rightIframeRef}
            src={`${SYSTMONE_SRC}?v=${cacheBust}`}
            title="SystmOne — GP practice inbox"
            className="w-full h-full"
            style={{ border: "none", display: "block" }}
          />
        </div>

        {/* Esc hint */}
        <div
          className="absolute bottom-2 right-4 text-[11px] pointer-events-none"
          style={{ color: "rgba(15, 30, 55, 0.45)" }}
        >
          Press Esc to close
        </div>
      </div>
    </div>
  );
};

export default AgeingWellDemoModal;
