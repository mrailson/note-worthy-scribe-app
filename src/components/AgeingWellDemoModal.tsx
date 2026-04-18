// src/components/AgeingWellDemoModal.tsx
// Full-screen split-view live demo modal: Notewell (Ageing Well) ↔ SystmOne inbox
// via simulated GP Connect / MESH sync using postMessage bridge.
// Supports three view modes (notewell / split / systmone) with animated transitions.

import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, RotateCcw } from "lucide-react";

export interface AgeingWellDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName?: string;
  meetingTitle?: string;
}

type DemoView = "notewell" | "split" | "systmone";

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
  const [view, setView] = useState<DemoView>("notewell");
  const leftIframeRef = useRef<HTMLIFrameElement | null>(null);
  const rightIframeRef = useRef<HTMLIFrameElement | null>(null);
  const autoSyncRef = useRef(autoSync);
  const viewRef = useRef(view);

  useEffect(() => { autoSyncRef.current = autoSync; }, [autoSync]);
  useEffect(() => { viewRef.current = view; }, [view]);

  // Reset view to 'notewell' whenever the modal opens
  useEffect(() => {
    if (isOpen) setView("notewell");
  }, [isOpen]);

  // Keyboard shortcuts: Esc closes, 1/←, 2, 3/→ switch views
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "1" || e.key === "ArrowLeft") setView("notewell");
      else if (e.key === "2") setView("split");
      else if (e.key === "3" || e.key === "ArrowRight") setView("systmone");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // PostMessage bridge: Notewell → SystmOne, with optional auto-reveal
  useEffect(() => {
    if (!isOpen) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "notewell:send-complete" || !autoSyncRef.current) return;

      const postRefresh = () => {
        rightIframeRef.current?.contentWindow?.postMessage(
          { type: "systmone:refresh", payload: data.payload ?? null },
          "*"
        );
      };

      if (viewRef.current === "notewell") {
        // Reveal sequence: 800ms → switch to split, then 1200ms → refresh
        window.setTimeout(() => {
          setView("split");
          window.setTimeout(postRefresh, 1200);
        }, 800);
      } else {
        window.setTimeout(postRefresh, 1800);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isOpen]);

  const handleReset = useCallback(() => {
    setCacheBust(Date.now());
    setView("notewell");
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  const subtitle = meetingTitle
    ? `${meetingTitle} — ${patientName}`
    : `Patient Support Plan sync to GP practice inbox via GP Connect / MESH${
        patientName ? ` — ${patientName}` : ""
      }`;

  // Flex values per view
  const leftFlex = view === "systmone" ? 0 : 1;
  const rightFlex = view === "notewell" ? 0 : 1;
  const showDivider = view === "split";

  const segBtn = (target: DemoView, label: string) => {
    const active = view === target;
    return (
      <button
        type="button"
        onClick={() => setView(target)}
        className="px-4 py-1.5 text-sm rounded-full transition-all duration-200"
        style={{
          background: active ? "#fff" : "transparent",
          color: active ? "#1B3A5C" : "rgba(255,255,255,0.7)",
          fontWeight: active ? 600 : 400,
          boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.color = "#fff";
            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.color = "rgba(255,255,255,0.7)";
            e.currentTarget.style.background = "transparent";
          }
        }}
      >
        {label}
      </button>
    );
  };

  const dot = (target: DemoView) => {
    const active = view === target;
    return (
      <button
        key={target}
        type="button"
        aria-label={`Switch to ${target} view`}
        onClick={() => setView(target)}
        className="w-2 h-2 rounded-full transition-colors"
        style={{ background: active ? "#2E75B6" : "#D1D5DB", border: "none", padding: 0, cursor: "pointer" }}
      />
    );
  };

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
          className="flex items-center justify-between px-6 gap-4 shrink-0"
          style={{ minHeight: 64, background: "#1B3A5C", color: "#fff" }}
        >
          {/* Left: title + subtitle */}
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

          {/* Centre: segmented control + helper hint */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            <div
              className="flex rounded-full"
              style={{ background: "rgba(255,255,255,0.1)", padding: 4, gap: 2 }}
            >
              {segBtn("notewell", "Notewell")}
              {segBtn("split", "Split")}
              {segBtn("systmone", "SystmOne")}
            </div>
            <span className="text-xs whitespace-nowrap" style={{ color: "rgba(255,255,255,0.5)" }}>
              ← → to switch · 1/2/3 direct
            </span>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
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

        {/* Mobile/narrow segmented control row (md:hidden) */}
        <div
          className="flex md:hidden items-center justify-center px-6 py-2 gap-3 shrink-0"
          style={{ background: "#1B3A5C", borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div
            className="flex rounded-full"
            style={{ background: "rgba(255,255,255,0.1)", padding: 4, gap: 2 }}
          >
            {segBtn("notewell", "Notewell")}
            {segBtn("split", "Split")}
            {segBtn("systmone", "SystmOne")}
          </div>
        </div>

        {/* Split view — flex-based, both iframes always mounted */}
        <div className="flex h-full overflow-hidden flex-1 min-h-0" style={{ background: "#fff" }}>
          <div
            className="overflow-hidden"
            style={{
              flex: leftFlex,
              transition: "flex 650ms cubic-bezier(0.4, 0, 0.2, 1)",
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
          </div>
          <div
            style={{
              width: showDivider ? 1 : 0,
              background: "#E2E8F0",
              transition: "width 650ms ease",
              flexShrink: 0,
            }}
          />
          <div
            className="overflow-hidden"
            style={{
              flex: rightFlex,
              transition: "flex 650ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <iframe
              key={`right-${cacheBust}`}
              ref={rightIframeRef}
              src={`${SYSTMONE_SRC}?v=${cacheBust}`}
              title="SystmOne — GP practice inbox"
              className="w-full h-full"
              style={{ border: "none", display: "block" }}
            />
          </div>
        </div>

        {/* View indicator dots */}
        <div
          className="absolute left-1/2 flex items-center gap-2 pointer-events-auto"
          style={{ bottom: 18, transform: "translateX(-50%)" }}
        >
          {dot("notewell")}
          {dot("split")}
          {dot("systmone")}
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
