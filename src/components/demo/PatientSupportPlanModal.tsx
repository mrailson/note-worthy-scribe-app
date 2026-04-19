// src/components/demo/PatientSupportPlanModal.tsx
// Act 2 of the AgeWell demo flow: simulates Notewell generating the
// Patient Support Plan from the visit transcript, then offers open/download.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Check,
  FileText,
  Download,
  ExternalLink,
  Clock,
  Sparkles,
  ArrowRightCircle,
  RotateCcw,
} from "lucide-react";
import { downloadFile } from "@/utils/downloadFile";
import type { DemoPatient } from "@/data/demoPatients";

const SENT_KEY = "demo.dot.support-plan.sent";
const SENT_AT_KEY = "demo.dot.support-plan.sent-at";

const SEND_TIMINGS_MS = [0, 900, 1800, 2700, 3600, 4500, 5400];
const SEND_FINISH_MS = 6000;

const NODE_STATUS = [
  "Composing FHIR bundle…",
  "Signing with MESH JWT…",
  "Transmitting via NHS Spine…",
  "Spine accepted — MSG-REF 7A9F3C…",
  "Delivering to SystmOne task queue…",
  "Task received by GP inbox…",
  "Complete",
];

const CONSOLE_LINES = [
  { t: "08:40:02", text: "Initiating GP Connect transfer…" },
  { t: "08:40:02", text: "Composing FHIR Bundle (DocumentReference + Binary)" },
  { t: "08:40:03", text: "JWT signed, cty=application/fhir+json" },
  { t: "08:40:04", text: "POST to sandbox.api.service.nhs.uk/mesh/v1" },
  { t: "08:40:05", text: "202 Accepted, msgRef=7A9F3C12E8B4D9" },
  { t: "08:40:06", text: "Polling for delivery confirmation…" },
  { t: "08:40:07", text: "Ack received: delivered to K81039 (Towcester MC)" },
  { t: "08:40:08", text: "✓ Complete" },
];

export interface PatientSupportPlanModalProps {
  open: boolean;
  onClose: () => void;
  patient: DemoPatient;
}

type Phase = "generating" | "complete" | "sending" | "sent" | "payoff";

const STEPS = [
  "Reading visit transcript…",
  "Structuring what was discussed and agreed…",
  "Extracting screening scores from conversation…",
  "Drafting framework sections…",
  "Assembling Framework Support Plan…",
];

const STEP_INTERVAL_MS = 400;

const PatientSupportPlanModal: React.FC<PatientSupportPlanModalProps> = ({
  open,
  onClose,
  patient,
}) => {
  const [phase, setPhase] = useState<Phase>("generating");
  const [completedSteps, setCompletedSteps] = useState(0);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [sendStep, setSendStep] = useState(0); // 0..7
  const [visibleConsoleLines, setVisibleConsoleLines] = useState(1);
  const [alreadySent, setAlreadySent] = useState(false);

  const consoleRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const plan = patient.supportPlan;

  // Reset on open — respect persisted "sent" status
  useEffect(() => {
    if (!open) return;
    const persistedSent =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(SENT_KEY) === "true";
    setAlreadySent(persistedSent);
    if (persistedSent) {
      setPhase("sent");
      setSendStep(SEND_TIMINGS_MS.length);
      setVisibleConsoleLines(CONSOLE_LINES.length);
    } else {
      setPhase("generating");
      setCompletedSteps(0);
      setVisibleSteps(0);
      setSendStep(0);
      setVisibleConsoleLines(1);
    }
  }, [open]);

  // Persist 'sent' status
  useEffect(() => {
    if (phase === "sent" && typeof window !== "undefined") {
      window.sessionStorage.setItem(SENT_KEY, "true");
      if (!window.sessionStorage.getItem(SENT_AT_KEY)) {
        window.sessionStorage.setItem(SENT_AT_KEY, "08:40:08");
      }
      setAlreadySent(true);
    }
  }, [phase]);

  // Lock scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Drive the generating animation
  useEffect(() => {
    if (!open || phase !== "generating") return;

    let cancelled = false;
    const timers: number[] = [];

    STEPS.forEach((_, i) => {
      const showAt = i * STEP_INTERVAL_MS;
      const checkAt = showAt + 300;

      timers.push(
        window.setTimeout(() => {
          if (!cancelled) setVisibleSteps((v) => Math.max(v, i + 1));
        }, showAt)
      );
      timers.push(
        window.setTimeout(() => {
          if (!cancelled) setCompletedSteps((c) => Math.max(c, i + 1));
        }, checkAt)
      );
    });

    // After last check, hold ~400ms then advance
    const total = STEPS.length * STEP_INTERVAL_MS + 300 + 400;
    timers.push(
      window.setTimeout(() => {
        if (!cancelled) setPhase("complete");
      }, total)
    );

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [open, phase]);

  // Drive the SENDING sequence
  useEffect(() => {
    if (phase !== "sending") return;
    let cancelled = false;
    const timers: number[] = [];

    SEND_TIMINGS_MS.forEach((ms, i) => {
      timers.push(
        window.setTimeout(() => {
          if (cancelled) return;
          setSendStep(i + 1);
          // Reveal next console line in lockstep
          setVisibleConsoleLines(() => Math.min(CONSOLE_LINES.length, i + 2));
        }, ms)
      );
    });
    timers.push(
      window.setTimeout(() => {
        if (!cancelled) {
          setVisibleConsoleLines(CONSOLE_LINES.length);
          setPhase("sent");
        }
      }, SEND_FINISH_MS)
    );

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [phase]);

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [visibleConsoleLines]);

  const generatedAt = useMemo(() => {
    if (!plan) return "";
    try {
      return new Date(plan.generated_at).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return plan.generated_at;
    }
  }, [plan]);

  if (!open) return null;
  if (!plan) return null;

  const handleOpen = () => {
    window.open(plan.path, "_blank", "noopener,noreferrer");
  };
  const handleDownload = () => {
    downloadFile(plan.path, plan.filename);
  };
  const startSendSequence = () => {
    setSendStep(0);
    setVisibleConsoleLines(1);
    setPhase("sending");
  };
  const resetSendDemo = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(SENT_KEY);
      window.sessionStorage.removeItem(SENT_AT_KEY);
    }
    setAlreadySent(false);
    setSendStep(0);
    setVisibleConsoleLines(1);
    setPhase("complete");
  };
  const openSystmOne = () => {
    window.open("/demo/systmone-inbox.html", "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center backdrop-blur-md"
      style={{ background: "rgba(15, 30, 55, 0.55)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Patient Support Plan generation"
    >
      <style>{`
        @keyframes pspFadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pspPop {
          0%   { transform: scale(0.6); opacity: 0; }
          60%  { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pspSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .psp-line { animation: pspFadeUp 280ms ease both; }
        .psp-tick { animation: pspPop 320ms cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      <div
        className="relative bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          width: phase === "complete" ? "min(1100px, 96vw)" : "min(880px, 96vw)",
          maxHeight: "92vh",
          animation: "pspSlideUp 300ms cubic-bezier(0.16,1,0.3,1)",
          transition: "width 220ms ease",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 shrink-0"
          style={{ minHeight: 56, background: "#1B3A5C", color: "#fff" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <FileText size={18} />
            <span className="font-bold text-sm sm:text-base tracking-wider uppercase truncate">
              {phase === "generating"
                ? "Captured · Drafting Framework Support Plan"
                : phase === "sending"
                ? "Sending to GP Clinical System"
                : phase === "sent"
                ? "Delivered to GP Clinical System"
                : "Framework Master Support Plan"}
            </span>
            {phase === "complete" && (
              <span
                className="hidden sm:inline px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider"
                style={{
                  border: "1px dashed #C99A2E",
                  color: "#8A6A1F",
                  background: "rgba(255,255,255,0.06)",
                }}
              >
                FRAMEWORK
              </span>
            )}
            <span
              className="hidden sm:inline px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider"
              style={{ background: "#E67E22", color: "#1B1B1B" }}
            >
              DEMO
            </span>
          </div>
          <div className="flex items-center gap-2">
            {alreadySent && phase !== "generating" && (
              <button
                type="button"
                onClick={resetSendDemo}
                className="hidden sm:inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md transition-colors"
                style={{ color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.2)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                title="Reset demo send state"
              >
                <RotateCcw size={12} />
                Reset demo
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex items-center justify-center h-8 w-8 rounded-md transition-colors"
              style={{ color: "#fff" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          className="flex-1 min-h-0 overflow-y-auto"
          style={{ background: "#FEFCF7" }}
        >
          {phase === "generating" && (
            <div className="flex items-center justify-center px-6 py-12">
              <div
                className="w-full max-w-lg rounded-xl border bg-white p-8 shadow-sm"
                style={{ borderColor: "#E8E2D4" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="inline-block rounded-full"
                    style={{
                      width: 8,
                      height: 8,
                      background: "#2C7A7B",
                      animation: "pspFadeUp 700ms ease infinite alternate",
                    }}
                  />
                  <span
                    className="text-[11px] font-semibold tracking-wider uppercase"
                    style={{ color: "#1F5E5E" }}
                  >
                    Captured · Drafting Framework Support Plan
                  </span>
                </div>

                <h3
                  className="text-[20px] font-medium leading-snug mb-1"
                  style={{
                    fontFamily:
                      'Fraunces, ui-serif, Georgia, "Times New Roman", serif',
                    color: "#1A2332",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Structuring what was discussed and agreed
                </h3>
                <p
                  className="text-[12.5px] italic mb-5"
                  style={{ color: "#6B7688" }}
                >
                  Listening only. Notewell does not decide.
                </p>

                {/* Progress bar */}
                <div
                  className="rounded-full overflow-hidden mb-5"
                  style={{ height: 6, background: "#F0EADD" }}
                  aria-hidden
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, (visibleSteps / STEPS.length) * 100)}%`,
                      background:
                        "linear-gradient(90deg, #2C7A7B 0%, #1F5E5E 100%)",
                      transition: "width 380ms ease",
                    }}
                  />
                </div>

                <ul className="space-y-2.5">
                  {STEPS.map((label, i) => {
                    if (i >= visibleSteps) return null;
                    const done = i < completedSteps;
                    return (
                      <li
                        key={label}
                        className="psp-line flex items-center gap-3 text-[13.5px]"
                        style={{ color: done ? "#1A2332" : "#3A4556" }}
                      >
                        <span
                          className="flex items-center justify-center rounded-full"
                          style={{
                            width: 20,
                            height: 20,
                            background: done ? "#E6F0F0" : "#F0EADD",
                            color: "#1F5E5E",
                            transition: "background 200ms ease",
                          }}
                        >
                          {done ? (
                            <Check size={12} className="psp-tick" strokeWidth={3} />
                          ) : (
                            <span
                              className="block rounded-full"
                              style={{
                                width: 7,
                                height: 7,
                                background: "#8B94A5",
                                animation: "pspFadeUp 600ms ease infinite alternate",
                              }}
                            />
                          )}
                        </span>
                        <span>{label}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          {phase === "complete" && (
            <FrameworkPlanReview
              plan={plan}
              alreadySent={alreadySent}
              generatedAt={generatedAt}
              onOpen={handleOpen}
              onDownload={handleDownload}
              onSignOff={startSendSequence}
              onShowPayoff={() => setPhase("payoff")}
            />
          )}

          {phase === "sending" && (
            <SendingView
              sendStep={sendStep}
              visibleConsoleLines={visibleConsoleLines}
              consoleRef={consoleRef}
              prefersReducedMotion={prefersReducedMotion}
            />
          )}

          {phase === "sent" && (
            <SentView
              onViewSystmOne={openSystmOne}
              onClose={() => setPhase("complete")}
            />
          )}

          {phase === "payoff" && (
            <div className="px-6 py-10">
              <div className="text-center mb-8">
                <h2
                  className="text-[24px] leading-tight font-medium"
                  style={{
                    fontFamily:
                      'Fraunces, ui-serif, Georgia, "Times New Roman", serif',
                    color: "#1A2332",
                    letterSpacing: "-0.01em",
                  }}
                >
                  The payoff
                </h2>
                <p className="mt-2 text-[13.5px]" style={{ color: "#6B7688" }}>
                  What this used to take vs. what Notewell does in seconds.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
                {/* Before */}
                <div
                  className="rounded-xl border p-6"
                  style={{
                    borderColor: "#E8E2D4",
                    background: "#FAF6EA",
                  }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Clock size={16} style={{ color: "#C05621" }} />
                    <span
                      className="text-[11px] tracking-wider uppercase font-semibold"
                      style={{ color: "#C05621" }}
                    >
                      Before Notewell
                    </span>
                  </div>
                  <div
                    className="text-[22px] font-medium mb-2"
                    style={{
                      fontFamily:
                        'Fraunces, ui-serif, Georgia, "Times New Roman", serif',
                      color: "#1A2332",
                    }}
                  >
                    ~90 minutes per patient
                  </div>
                  <ul
                    className="text-[13.5px] space-y-2 leading-relaxed"
                    style={{ color: "#3A4556" }}
                  >
                    <li>Support worker types up notes after the visit</li>
                    <li>Manual transcription of observations</li>
                    <li>Re-keys screening scores into the plan template</li>
                    <li>Action plan written from memory</li>
                    <li>Often completed late at night, days later</li>
                  </ul>
                </div>

                {/* After */}
                <div
                  className="rounded-xl border p-6"
                  style={{
                    borderColor: "#2C7A7B",
                    background: "#fff",
                    boxShadow: "0 6px 24px -10px rgba(44,122,123,0.35)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles size={16} style={{ color: "#1F5E5E" }} />
                    <span
                      className="text-[11px] tracking-wider uppercase font-semibold"
                      style={{ color: "#1F5E5E" }}
                    >
                      With Notewell
                    </span>
                  </div>
                  <div
                    className="text-[22px] font-medium mb-2"
                    style={{
                      fontFamily:
                        'Fraunces, ui-serif, Georgia, "Times New Roman", serif',
                      color: "#1A2332",
                    }}
                  >
                    2.4 seconds
                  </div>
                  <ul
                    className="text-[13.5px] space-y-2 leading-relaxed"
                    style={{ color: "#3A4556" }}
                  >
                    <li>Plan generated from the visit transcript</li>
                    <li>18 narrative sections auto-populated</li>
                    <li>Screening scores calculated from conversation</li>
                    <li>15-row action plan ready to review</li>
                    <li>Worker leaves the visit with the plan done</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-center mt-8">
                <button
                  type="button"
                  onClick={() => setPhase("complete")}
                  className="text-[12.5px] underline-offset-4 hover:underline"
                  style={{ color: "#6B7688" }}
                >
                  ← Back to Support Plan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientSupportPlanModal;

/* ─── Phase 2.5 — SENDING ─── */

interface SendingViewProps {
  sendStep: number; // 0..7
  visibleConsoleLines: number;
  consoleRef: React.RefObject<HTMLDivElement>;
  prefersReducedMotion: boolean;
}

const SendingView: React.FC<SendingViewProps> = ({
  sendStep,
  visibleConsoleLines,
  consoleRef,
  prefersReducedMotion,
}) => {
  // Node states
  // Node 1 NOTEWELL: active from step 1, complete from step 3 (line drawn)
  // Node 2 SPINE:    active from step 3, complete from step 5
  // Node 3 SYSTMONE: active from step 5, complete from step 7
  const node1State =
    sendStep >= 3 ? "complete" : sendStep >= 1 ? "active" : "idle";
  const node2State =
    sendStep >= 5 ? "complete" : sendStep >= 3 ? "active" : "idle";
  const node3State =
    sendStep >= 7 ? "complete" : sendStep >= 5 ? "active" : "idle";
  const line1Done = sendStep >= 3;
  const line2Done = sendStep >= 5;

  const statusLineIdx = Math.max(0, Math.min(NODE_STATUS.length - 1, sendStep - 1));
  const statusLine = sendStep > 0 ? NODE_STATUS[statusLineIdx] : "Initiating…";

  return (
    <div className="px-6 py-8 sm:py-10">
      <div className="text-center mb-8">
        <div
          className="text-[11px] tracking-wider uppercase font-semibold"
          style={{ color: "#1E3A5F" }}
        >
          Sending to GP Clinical System
        </div>
        <h2
          className="mt-1 text-[18px] sm:text-[20px] font-medium"
          style={{
            fontFamily:
              'Fraunces, ui-serif, Georgia, "Times New Roman", serif',
            color: "#1A2332",
            letterSpacing: "-0.01em",
          }}
        >
          Towcester Medical Centre · SystmOne
        </h2>
      </div>

      {/* Flow diagram */}
      <div className="max-w-2xl mx-auto">
        <div className="grid grid-cols-3 items-stretch gap-0">
          <FlowNode
            state={node1State}
            icon={<FileText size={20} />}
            title="Notewell"
            sub="Dot's plan"
          />
          <FlowConnector active={line1Done} />
          <FlowNode
            state={node2State}
            icon={<GlobeIcon />}
            title="NHS Spine"
            sub="FHIR Bundle + JWT"
          />
        </div>
        <div className="grid grid-cols-3 items-stretch gap-0 mt-3">
          <div />
          <FlowConnector active={line2Done} />
          <FlowNode
            state={node3State}
            icon={<MonitorIcon />}
            title="SystmOne"
            sub="GP task inbox"
          />
        </div>

        {/* Status line */}
        <div
          className="mt-6 text-center text-[13px]"
          style={{ color: "#3A4556" }}
          aria-live="polite"
        >
          {statusLine}
        </div>

        {/* Console log */}
        <div
          className="mt-5 rounded-lg overflow-hidden"
          style={{ background: "#0B1F34", border: "1px solid #0B1F34" }}
        >
          <div
            className="flex items-center justify-between px-3 py-1.5 text-[10px] tracking-wider uppercase font-semibold"
            style={{ color: "#8FD3D4", background: "rgba(255,255,255,0.04)" }}
          >
            <span>GP Connect · MESH · live log</span>
            <span style={{ color: "#5BA3A4" }}>POST /mesh/v1</span>
          </div>
          <div
            ref={consoleRef}
            className="p-3 font-mono text-[11.5px] leading-relaxed overflow-y-auto"
            style={{ maxHeight: 160, color: "#8FD3D4" }}
            aria-live="polite"
          >
            {CONSOLE_LINES.slice(0, visibleConsoleLines).map((line, i) => (
              <div
                key={i}
                style={{
                  animation: prefersReducedMotion
                    ? undefined
                    : "pspFadeUp 220ms ease both",
                }}
              >
                <span style={{ color: "#5EE6E8" }}>[{line.t}]</span>{" "}
                <span>{line.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const FlowNode: React.FC<{
  state: "idle" | "active" | "complete";
  icon: React.ReactNode;
  title: string;
  sub: string;
}> = ({ state, icon, title, sub }) => {
  const bg =
    state === "complete"
      ? "#E8F3ED"
      : state === "active"
      ? "#E6F0F0"
      : "#F1F5F9";
  const border =
    state === "complete"
      ? "#C8E2D2"
      : state === "active"
      ? "#CDE0E0"
      : "#E2E8F0";
  const fg =
    state === "complete"
      ? "#2F855A"
      : state === "active"
      ? "#1F5E5E"
      : "#94A3B8";

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="rounded-lg flex items-center justify-center transition-colors"
        style={{
          width: 72,
          height: 72,
          background: bg,
          border: `1px solid ${border}`,
          color: fg,
          position: "relative",
        }}
      >
        {state === "active" && (
          <span
            className="absolute -top-1 -right-1 inline-flex w-3 h-3 rounded-full"
            style={{ background: "#F59E0B" }}
          >
            <span
              className="absolute inset-0 rounded-full opacity-70 animate-ping"
              style={{ background: "#F59E0B" }}
            />
          </span>
        )}
        {state === "complete" ? <Check size={22} strokeWidth={3} /> : icon}
      </div>
      <div
        className="mt-2 text-[11px] tracking-wider uppercase font-semibold"
        style={{ color: fg }}
      >
        {title}
      </div>
      <div className="text-[11px]" style={{ color: "#8B94A5" }}>
        {sub}
      </div>
    </div>
  );
};

const FlowConnector: React.FC<{ active: boolean }> = ({ active }) => (
  <div className="flex items-center justify-center">
    <div
      className="h-[2px] w-full transition-colors"
      style={{
        background: active ? "#2F855A" : "#E2E8F0",
        position: "relative",
      }}
    >
      <span
        className="absolute -right-1 top-1/2 -translate-y-1/2 w-0 h-0"
        style={{
          borderTop: "5px solid transparent",
          borderBottom: "5px solid transparent",
          borderLeft: `7px solid ${active ? "#2F855A" : "#CBD5E1"}`,
        }}
      />
    </div>
  </div>
);

const GlobeIcon: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const MonitorIcon: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

/* ─── Phase 2.6 — SENT ─── */

const SentView: React.FC<{
  onViewSystmOne: () => void;
  onClose: () => void;
}> = ({ onViewSystmOne, onClose }) => {
  return (
    <div className="px-6 py-10 sm:py-12">
      <div className="flex flex-col items-center text-center">
        <div
          className="psp-tick flex items-center justify-center rounded-full mb-5"
          style={{
            width: 80,
            height: 80,
            background: "#E8F3ED",
            color: "#2F855A",
            boxShadow: "0 8px 22px -8px rgba(47,133,90,0.45)",
          }}
        >
          <Check size={40} strokeWidth={3} />
        </div>

        <h2
          className="text-[28px] leading-tight font-medium"
          style={{
            fontFamily:
              'Fraunces, ui-serif, Georgia, "Times New Roman", serif',
            color: "#1A2332",
            letterSpacing: "-0.01em",
          }}
        >
          Delivered to Towcester Medical Centre
        </h2>
        <p className="mt-2 text-[14px]" style={{ color: "#6B7688" }}>
          Dr A Patel's task inbox · acknowledged 08:40:08
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-8 w-full max-w-xl">
          {[
            { n: "1.8s", l: "Delivery time" },
            { n: "FHIR", l: "Bundle format" },
            { n: "✓", l: "Receipt confirmed" },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded-lg border bg-white p-4 text-center"
              style={{ borderColor: "#E8E2D4" }}
            >
              <div
                className="text-[26px] font-medium leading-none"
                style={{
                  fontFamily:
                    'Fraunces, ui-serif, Georgia, "Times New Roman", serif',
                  color: "#2F855A",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {s.n}
              </div>
              <div
                className="mt-2 text-[11px] tracking-wider uppercase font-semibold"
                style={{ color: "#6B7688" }}
              >
                {s.l}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-8">
          <button
            type="button"
            onClick={onViewSystmOne}
            className="inline-flex items-center gap-2 px-5 h-11 rounded-md text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, #2C7A7B 0%, #1F5E5E 100%)",
              boxShadow: "0 4px 14px -4px rgba(31,94,94,0.5)",
            }}
          >
            <ExternalLink size={16} />
            View in SystmOne
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-5 h-11 rounded-md text-sm font-medium transition-colors"
            style={{
              background: "#fff",
              color: "#1A2332",
              border: "1px solid #E8E2D4",
            }}
          >
            Close
          </button>
        </div>

        <p
          className="mt-6 text-[11px] font-mono"
          style={{ color: "#8B94A5" }}
        >
          MSG-REF: 7A9F3C12E8B4D9 · OP-NAME: gpc.fhir.post.document
        </p>
      </div>
    </div>
  );
};
