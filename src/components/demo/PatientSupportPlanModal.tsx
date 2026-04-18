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
  Globe,
  Monitor,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { downloadFile } from "@/utils/downloadFile";
import type { DemoPatient } from "@/data/demoPatients";

const SENT_KEY = "demo.dot.support-plan.sent";
const SENT_AT_KEY = "demo.dot.support-plan.sent-at";

const SEND_TIMINGS_MS = [0, 900, 1800, 2700, 3600, 4500, 5400];
const SEND_FINISH_MS = 6000;

const NODE_STATUS_LINES = [
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
  "Extracting 18 narrative sections…",
  "Populating observations…",
  "Calculating screening scores…",
  "Generating 15-row action plan…",
  "Assembling document…",
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
          setVisibleConsoleLines((v) => Math.min(CONSOLE_LINES.length, i + 2));
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
          width: "min(880px, 96vw)",
          maxHeight: "92vh",
          animation: "pspSlideUp 300ms cubic-bezier(0.16,1,0.3,1)",
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
                ? "Generating Patient Support Plan"
                : phase === "sending"
                ? "Sending to GP Clinical System"
                : phase === "sent"
                ? "Delivered to GP Clinical System"
                : "Patient Support Plan"}
            </span>
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
                <div className="flex items-center gap-2 mb-6">
                  <Sparkles size={16} style={{ color: "#2C7A7B" }} />
                  <span
                    className="text-[11px] font-semibold tracking-wider uppercase"
                    style={{ color: "#1F5E5E" }}
                  >
                    Notewell · Generating from transcript
                  </span>
                </div>

                <ul className="space-y-3">
                  {STEPS.map((label, i) => {
                    if (i >= visibleSteps) return null;
                    const done = i < completedSteps;
                    return (
                      <li
                        key={label}
                        className="psp-line flex items-center gap-3 text-[14px]"
                        style={{ color: done ? "#1A2332" : "#3A4556" }}
                      >
                        <span
                          className="flex items-center justify-center rounded-full"
                          style={{
                            width: 22,
                            height: 22,
                            background: done ? "#E6F0F0" : "#F0EADD",
                            color: "#1F5E5E",
                            transition: "background 200ms ease",
                          }}
                        >
                          {done ? (
                            <Check size={14} className="psp-tick" strokeWidth={3} />
                          ) : (
                            <span
                              className="block rounded-full"
                              style={{
                                width: 8,
                                height: 8,
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
            <div className="px-6 py-10 sm:py-12">
              <div className="flex flex-col items-center text-center">
                <div
                  className="psp-tick flex items-center justify-center rounded-full mb-5"
                  style={{
                    width: 64,
                    height: 64,
                    background: "#E6F0F0",
                    color: "#1F5E5E",
                    boxShadow: "0 6px 20px -8px rgba(31,94,94,0.45)",
                  }}
                >
                  <Check size={32} strokeWidth={3} />
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
                  Patient Support Plan ready
                </h2>
                <p
                  className="mt-2 text-[14px]"
                  style={{ color: "#6B7688" }}
                >
                  {plan.pages} pages · {plan.size_kb} KB · generated from the
                  visit transcript in 2.4 seconds
                </p>

                {/* Stats */}
                <div
                  className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 w-full max-w-2xl"
                >
                  {[
                    { n: plan.sections_populated, l: "About the Patient sections" },
                    { n: plan.action_plan_rows, l: "Action plan items" },
                    { n: plan.pages, l: "Observations captured" },
                    { n: 6, l: "Screening scores" },
                  ].map((s) => (
                    <div
                      key={s.l}
                      className="rounded-lg border bg-white p-4 text-center"
                      style={{ borderColor: "#E8E2D4" }}
                    >
                      <div
                        className="text-[28px] font-medium leading-none"
                        style={{
                          fontFamily:
                            'Fraunces, ui-serif, Georgia, "Times New Roman", serif',
                          color: "#1F5E5E",
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
                    onClick={handleOpen}
                    className="inline-flex items-center gap-2 px-5 h-11 rounded-md text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                    style={{
                      background:
                        "linear-gradient(135deg, #2C7A7B 0%, #1F5E5E 100%)",
                      boxShadow: "0 4px 14px -4px rgba(31,94,94,0.5)",
                    }}
                  >
                    <ExternalLink size={16} />
                    Open Support Plan
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 px-5 h-11 rounded-md text-sm font-medium transition-colors"
                    style={{
                      background: "#fff",
                      color: "#1A2332",
                      border: "1px solid #E8E2D4",
                    }}
                  >
                    <Download size={16} />
                    Download
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPhase("payoff")}
                  className="mt-5 text-[12.5px] underline-offset-4 hover:underline"
                  style={{ color: "#6B7688" }}
                >
                  Show me what the team used to do…
                </button>

                <p
                  className="mt-6 text-[11px] tracking-wider uppercase font-semibold"
                  style={{ color: "#8B94A5" }}
                >
                  Generated {generatedAt} · by Notewell
                </p>
              </div>
            </div>
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
