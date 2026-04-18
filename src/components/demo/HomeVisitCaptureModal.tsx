// src/components/demo/HomeVisitCaptureModal.tsx
// Act 1 of the AgeWell demo: animated, dramatised recreation of Sarah
// Mitchell's home visit to Dot Pearson. Full-screen split-pane modal
// that plays the conversation in ~90 seconds and ends with a CTA to
// generate the Patient Support Plan.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, FastForward, Check, Play, WifiOff, ShieldCheck, Pause } from "lucide-react";
import {
  DOT_VISIT_SCRIPT,
  PROLOGUE_END_T,
  FAST_FORWARD_T,
  RECORDING_START_T,
  RECORDING_STOP_T,
  END_STATE_T,
  RECORDING_DURATION_LABEL,
  WORD_COUNT,
  type VisitTurn,
} from "@/data/dotVisitScript";

const FONT_SERIF = `'Fraunces', 'Playfair Display', Georgia, 'Times New Roman', serif`;

const C = {
  scene: "#FAF6EA",
  transcript: "#FEFCF7",
  navy: "#1E3A5F",
  navyDeep: "#0F2B46",
  cream: "#FEFCF7",
  border: "#E2E0D9",
  teal: "#2C7A7B",
  tealDark: "#1F5E5E",
  tealSoft: "#E6F0F0",
  mauveSoft: "#F3EEF5",
  plum: "#5D3A5F",
  amber: "#F59E0B",
  amberDark: "#D97706",
  red: "#DC2626",
  green: "#16A34A",
  slate400: "#94A3B8",
  slate500: "#64748B",
  slate600: "#475569",
  slate700: "#334155",
};

export interface HomeVisitCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onGeneratePlan?: () => void; // callback to launch Act 2
}

const TICK_MS = 100;

function formatRecTime(elapsedSec: number) {
  if (elapsedSec < 0) elapsedSec = 0;
  const m = Math.floor(elapsedSec / 60);
  const s = Math.floor(elapsedSec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const usePrefersReducedMotion = () =>
  useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );

/* ─── Typewriter hook for transcript bubbles ─── */
function useTypewriter(text: string, enabled: boolean) {
  const [out, setOut] = useState(enabled ? "" : text);
  useEffect(() => {
    if (!enabled) {
      setOut(text);
      return;
    }
    setOut("");
    const totalMs = Math.min(1500, text.length * 30);
    const perChar = Math.max(8, totalMs / text.length);
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setOut(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, perChar);
    return () => window.clearInterval(id);
  }, [text, enabled]);
  return out;
}

/* ─── Bubble component ─── */
const Bubble: React.FC<{ turn: VisitTurn; reduceMotion: boolean }> = ({ turn, reduceMotion }) => {
  const isSarah = turn.speaker === "sarah";
  const text = useTypewriter(turn.text, !reduceMotion);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isSarah ? "flex-start" : "flex-end",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          maxWidth: "78%",
          background: isSarah ? C.tealSoft : C.mauveSoft,
          color: isSarah ? C.tealDark : C.plum,
          borderRadius: isSarah ? "14px 14px 14px 4px" : "14px 14px 4px 14px",
          padding: "10px 14px",
          fontSize: 13.5,
          lineHeight: 1.55,
          boxShadow: "0 1px 2px rgba(15,43,70,0.06)",
          animation: reduceMotion ? undefined : "agewell-bubble-in 240ms ease-out",
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            letterSpacing: 1.2,
            fontWeight: 700,
            textTransform: "uppercase",
            opacity: 0.7,
            marginBottom: 3,
          }}
        >
          {isSarah ? "Sarah" : "Dot"}
        </div>
        {text}
        {!reduceMotion && text.length < turn.text.length && (
          <span style={{ opacity: 0.5 }}>▌</span>
        )}
      </div>
    </div>
  );
};

/* ─── Action line (italic muted) ─── */
const ActionLine: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      textAlign: "center",
      fontStyle: "italic",
      color: C.slate500,
      fontSize: 12.5,
      margin: "8px 0 14px",
    }}
  >
    ↻ {text}
  </div>
);

/* ─── Separator (fast-forward) ─── */
const Separator: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      margin: "20px 0",
      color: C.amberDark,
      fontWeight: 600,
      fontSize: 12,
      letterSpacing: 1.5,
      textTransform: "uppercase",
    }}
  >
    <div style={{ flex: 1, height: 1, background: C.amber, opacity: 0.4 }} />
    <FastForward size={14} />
    {text}
    <div style={{ flex: 1, height: 1, background: C.amber, opacity: 0.4 }} />
  </div>
);

/* ─── Animated waveform ─── */
const Waveform: React.FC<{ active: boolean; reduceMotion: boolean }> = ({
  active,
  reduceMotion,
}) => {
  const BAR_COUNT = 24;
  const [heights, setHeights] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, () => 6)
  );
  useEffect(() => {
    if (!active || reduceMotion) {
      setHeights(Array.from({ length: BAR_COUNT }, () => 6));
      return;
    }
    const id = window.setInterval(() => {
      setHeights(
        Array.from({ length: BAR_COUNT }, () => 4 + Math.round(Math.random() * 24))
      );
    }, 80);
    return () => window.clearInterval(id);
  }, [active, reduceMotion]);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        height: 40,
        padding: "0 8px",
      }}
      aria-hidden
    >
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: h,
            borderRadius: 2,
            background: active ? "#22C55E" : "#CBD5E1",
            transition: "height 80ms linear, background 200ms",
          }}
        />
      ))}
    </div>
  );
};

/* ─── Avatar circle ─── */
const Avatar: React.FC<{
  initials: string;
  gradient: string;
  size?: number;
}> = ({ initials, gradient, size = 44 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: gradient,
      color: "white",
      fontFamily: FONT_SERIF,
      fontSize: size * 0.4,
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      flexShrink: 0,
    }}
  >
    {initials}
  </div>
);

const HomeVisitCaptureModal: React.FC<HomeVisitCaptureModalProps> = ({
  open,
  onClose,
  onGeneratePlan,
}) => {
  const reduceMotion = usePrefersReducedMotion();
  const [t, setT] = useState(0);
  const [paused, setPaused] = useState(false);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setT(0);
      setPaused(false);
    }
  }, [open]);

  // Tick loop
  useEffect(() => {
    if (!open || paused) return;
    if (t >= END_STATE_T) return;
    const id = window.setInterval(() => {
      setT((prev) => Math.min(END_STATE_T, prev + TICK_MS / 1000));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [open, paused, t]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Auto-scroll transcript
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [t, reduceMotion]);

  if (!open) return null;

  const phase: "prologue" | "recording" | "stopped" | "ended" =
    t < RECORDING_START_T
      ? "prologue"
      : t < RECORDING_STOP_T
      ? "recording"
      : t < END_STATE_T
      ? "stopped"
      : "ended";

  const recElapsed = Math.max(0, t - RECORDING_START_T);

  // Visible turns up to current t
  const visible = DOT_VISIT_SCRIPT.filter((turn) => t >= turn.t);
  const currentSpeakingTurn = [...visible].reverse().find((x) => x.kind === "transcript");
  const statusLine =
    phase === "prologue"
      ? "Listening for consent…"
      : phase === "stopped" || phase === "ended"
      ? "Recording complete"
      : currentSpeakingTurn?.speaker === "dot"
      ? "Dot is speaking…"
      : currentSpeakingTurn?.speaker === "sarah"
      ? "Sarah is speaking…"
      : "Ambient…";

  // Last prologue card to display (centered overlay)
  const prologueCard =
    phase === "prologue"
      ? [...visible].reverse().find((x) => x.kind === "card")
      : null;

  // Transcript-only entries (transcript / separator / action / late cards)
  const streamItems = visible.filter(
    (x) =>
      x.kind === "transcript" ||
      x.kind === "separator" ||
      x.kind === "action" ||
      (x.kind === "card" && x.t >= RECORDING_STOP_T)
  );

  const handleFastForward = () => {
    if (t < FAST_FORWARD_T) setT(FAST_FORWARD_T);
    else if (t < RECORDING_STOP_T) setT(RECORDING_STOP_T);
    else setT(END_STATE_T);
  };

  const handleReplay = () => {
    setT(0);
    setPaused(false);
  };

  const handleGenerate = () => {
    onClose();
    onGeneratePlan?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Home visit recreation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(15,43,70,0.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes agewell-bubble-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes agewell-rec-pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50%     { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes agewell-card-in {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes agewell-tick-in {
          0%   { opacity: 0; transform: scale(0.4); }
          60%  { opacity: 1; transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.cream,
          borderRadius: 16,
          width: "min(1280px, 96vw)",
          height: "min(820px, 92vh)",
          display: "flex",
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.45)",
          position: "relative",
        }}
      >
        {/* Close X */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            zIndex: 10,
            background: "rgba(255,255,255,0.92)",
            border: `1px solid ${C.border}`,
            borderRadius: 999,
            width: 34,
            height: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: C.slate600,
          }}
        >
          <X size={16} />
        </button>

        {/* ───── LEFT PANE: THE SCENE (40%) ───── */}
        <div
          style={{
            flex: "0 0 40%",
            background: C.scene,
            borderRight: `1px solid ${C.border}`,
            display: "flex",
            flexDirection: "column",
            padding: "28px 28px 20px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Faint home illustration backdrop */}
          <svg
            aria-hidden
            viewBox="0 0 400 400"
            style={{
              position: "absolute",
              right: -40,
              bottom: -40,
              width: 360,
              height: 360,
              opacity: 0.07,
              pointerEvents: "none",
            }}
          >
            <g stroke={C.navyDeep} strokeWidth="2" fill="none">
              {/* sofa */}
              <rect x="40" y="240" width="180" height="80" rx="12" />
              <rect x="40" y="220" width="180" height="30" rx="10" />
              <rect x="32" y="250" width="20" height="60" rx="6" />
              <rect x="208" y="250" width="20" height="60" rx="6" />
              {/* lamp */}
              <line x1="300" y1="320" x2="300" y2="180" />
              <path d="M270 180 L330 180 L320 140 L280 140 Z" />
              {/* tea cup */}
              <ellipse cx="140" cy="200" rx="22" ry="6" />
              <path d="M118 200 Q120 220 140 222 Q160 220 162 200" />
              <path d="M162 205 Q176 208 176 215 Q176 222 162 218" />
              {/* steam */}
              <path d="M132 188 Q128 178 134 170 Q140 162 134 154" />
              <path d="M146 188 Q142 178 148 170 Q154 162 148 154" />
            </g>
          </svg>

          {/* Top label */}
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: 2,
              color: C.slate600,
              fontWeight: 700,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            15 April 2026 · 14:12
          </div>
          <div
            style={{
              display: "inline-flex",
              alignSelf: "flex-start",
              alignItems: "center",
              gap: 6,
              background: "rgba(30,58,95,0.08)",
              border: `1px solid ${C.border}`,
              color: C.navy,
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 600,
              marginBottom: 24,
            }}
          >
            14 Primrose Lane, Towcester
          </div>

          {/* Avatars */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar
                initials="SM"
                gradient={`linear-gradient(135deg, ${C.teal} 0%, ${C.tealDark} 100%)`}
              />
              <div>
                <div style={{ fontWeight: 600, color: C.navyDeep, fontSize: 14 }}>
                  Sarah Mitchell
                </div>
                <div style={{ fontSize: 11.5, color: C.slate600 }}>
                  AgeWell Support Worker
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar
                initials="DP"
                gradient={`linear-gradient(135deg, #B68DBE 0%, ${C.plum} 100%)`}
              />
              <div>
                <div style={{ fontWeight: 600, color: C.navyDeep, fontSize: 14 }}>
                  Mrs Dorothy Pearson
                </div>
                <div style={{ fontSize: 11.5, color: C.slate600 }}>
                  84 · Widowed · Rockwood 5
                </div>
              </div>
            </div>
          </div>

          {/* Connectivity indicator */}
          <div
            style={{
              background: "rgba(255,255,255,0.7)",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 18,
              position: "relative",
              zIndex: 1,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <WifiOff size={14} color={C.red} />
              <span style={{ color: C.red, fontWeight: 700, letterSpacing: 0.5 }}>
                NO INTERNET
              </span>
              <span style={{ color: C.slate500, fontSize: 11 }}>· at this property</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: C.green,
                  boxShadow: `0 0 0 3px ${C.green}33`,
                }}
              />
              <span style={{ color: C.green, fontWeight: 700, letterSpacing: 0.5 }}>
                NOTEWELL RUNNING LOCALLY
              </span>
            </div>
          </div>

          {/* Prologue card overlay */}
          {prologueCard && (
            <div
              key={prologueCard.t}
              style={{
                background: C.navyDeep,
                color: "white",
                borderRadius: 12,
                padding: prologueCard.big ? "20px 20px" : "14px 16px",
                border: `1px solid ${C.cream}`,
                marginBottom: 14,
                animation: reduceMotion ? undefined : "agewell-card-in 320ms ease-out",
                position: "relative",
                zIndex: 1,
              }}
            >
              {prologueCard.icon === "consent" && (
                <ShieldCheck
                  size={18}
                  color={C.amber}
                  style={{ marginBottom: 8 }}
                />
              )}
              {prologueCard.icon === "wifi-off" && (
                <WifiOff size={18} color={C.amber} style={{ marginBottom: 8 }} />
              )}
              {prologueCard.speaker && (
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: 1.5,
                    color: C.amber,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  {prologueCard.speaker === "sarah" ? "Sarah" : "Dot"}
                </div>
              )}
              <div
                style={{
                  fontSize: prologueCard.big ? 14.5 : 13,
                  lineHeight: 1.55,
                  fontStyle: prologueCard.speaker ? "italic" : "normal",
                }}
              >
                {prologueCard.text}
              </div>
              {prologueCard.subtitle && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: C.amber,
                    letterSpacing: 1,
                    fontWeight: 600,
                  }}
                >
                  {prologueCard.subtitle}
                </div>
              )}
            </div>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Waveform */}
          <div
            style={{
              background: "rgba(255,255,255,0.7)",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: "8px 4px",
              position: "relative",
              zIndex: 1,
            }}
          >
            <Waveform active={phase === "recording"} reduceMotion={reduceMotion} />
            <div
              style={{
                textAlign: "center",
                fontSize: 10,
                letterSpacing: 1.5,
                color: C.slate500,
                fontWeight: 600,
                marginTop: 2,
              }}
            >
              ON-DEVICE AUDIO
            </div>
          </div>
        </div>

        {/* ───── RIGHT PANE: TRANSCRIPT (60%) ───── */}
        <div
          style={{
            flex: "1 1 60%",
            background: C.transcript,
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          {/* Top bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 22px",
              borderBottom: `1px solid ${C.border}`,
              background: phase === "recording" ? "#FEF2F2" : "#F8FAFC",
              transition: "background 300ms",
            }}
          >
            {/* Left: REC + timer */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {phase === "stopped" || phase === "ended" ? (
                <>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      background: C.slate500,
                      borderRadius: 2,
                    }}
                  />
                  <span
                    style={{
                      fontWeight: 700,
                      letterSpacing: 1.5,
                      color: C.slate600,
                      fontSize: 12,
                    }}
                  >
                    RECORDING STOPPED
                  </span>
                  <span
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 600,
                      color: C.slate700,
                      fontSize: 13,
                    }}
                  >
                    {RECORDING_DURATION_LABEL}
                  </span>
                </>
              ) : phase === "recording" ? (
                <>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: C.red,
                      animation: reduceMotion
                        ? undefined
                        : "agewell-rec-pulse 1.2s ease-in-out infinite",
                    }}
                  />
                  <span
                    style={{
                      color: C.red,
                      fontWeight: 700,
                      letterSpacing: 1.5,
                      fontSize: 12,
                    }}
                  >
                    REC
                  </span>
                  <span
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 600,
                      color: C.navyDeep,
                      fontSize: 13,
                    }}
                  >
                    {formatRecTime(recElapsed)}
                  </span>
                  <button
                    onClick={() => setPaused((p) => !p)}
                    aria-label={paused ? "Resume" : "Pause"}
                    style={{
                      marginLeft: 4,
                      background: "transparent",
                      border: "none",
                      color: C.slate500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      padding: 4,
                    }}
                  >
                    {paused ? <Play size={14} /> : <Pause size={14} />}
                  </button>
                </>
              ) : (
                <>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: C.amber,
                    }}
                  />
                  <span
                    style={{
                      color: C.amberDark,
                      fontWeight: 700,
                      letterSpacing: 1.5,
                      fontSize: 12,
                    }}
                  >
                    PRE-RECORDING
                  </span>
                </>
              )}
            </div>

            {/* Center: engine */}
            <div
              style={{
                fontSize: 11.5,
                color: C.slate500,
                fontWeight: 500,
              }}
            >
              Whisper · on-device transcription
            </div>

            {/* Right: fast-forward */}
            <button
              onClick={handleFastForward}
              disabled={phase === "ended"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                border: `1px solid ${C.amber}`,
                color: C.amberDark,
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: phase === "ended" ? "default" : "pointer",
                opacity: phase === "ended" ? 0.4 : 1,
                transition: "all 150ms",
              }}
              onMouseEnter={(e) => {
                if (phase !== "ended") {
                  e.currentTarget.style.background = C.amber;
                  e.currentTarget.style.color = "white";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = C.amberDark;
              }}
            >
              <FastForward size={13} /> Fast-forward
            </button>
          </div>

          {/* Transcript stream */}
          <div
            ref={transcriptScrollRef}
            aria-live="polite"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px 24px",
              opacity: phase === "ended" ? 0.4 : 1,
              transition: "opacity 600ms",
            }}
          >
            {streamItems.length === 0 && phase === "prologue" && (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: C.slate400,
                  fontSize: 13,
                  fontStyle: "italic",
                }}
              >
                Waiting to begin recording…
              </div>
            )}
            {streamItems.map((turn, idx) => {
              if (turn.kind === "transcript") {
                return (
                  <Bubble
                    key={`${turn.t}-${idx}`}
                    turn={turn}
                    reduceMotion={reduceMotion}
                  />
                );
              }
              if (turn.kind === "separator") {
                return <Separator key={`${turn.t}-${idx}`} text={turn.text} />;
              }
              if (turn.kind === "action") {
                return <ActionLine key={`${turn.t}-${idx}`} text={turn.text} />;
              }
              // late card (post-recording)
              return (
                <div
                  key={`${turn.t}-${idx}`}
                  style={{
                    background: C.navyDeep,
                    color: "white",
                    borderRadius: 10,
                    padding: "12px 16px",
                    margin: "12px auto",
                    maxWidth: 480,
                    fontSize: 12.5,
                    fontStyle: "italic",
                    textAlign: "center",
                    animation: reduceMotion
                      ? undefined
                      : "agewell-card-in 280ms ease-out",
                  }}
                >
                  {turn.text}
                </div>
              );
            })}
          </div>

          {/* Status line */}
          <div
            style={{
              padding: "8px 22px",
              borderTop: `1px solid ${C.border}`,
              background: "#F8FAFC",
              fontSize: 11.5,
              color: C.slate500,
              fontStyle: "italic",
              fontWeight: 500,
            }}
          >
            {statusLine}
          </div>

          {/* End-state overlay */}
          {phase === "ended" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(254,252,247,0.92)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 32,
                animation: reduceMotion
                  ? undefined
                  : "agewell-card-in 400ms ease-out",
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: C.tealSoft,
                  border: `3px solid ${C.teal}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 18,
                  animation: reduceMotion
                    ? undefined
                    : "agewell-tick-in 480ms cubic-bezier(0.22, 1.4, 0.36, 1)",
                }}
              >
                <Check size={40} color={C.tealDark} strokeWidth={3} />
              </div>
              <div
                style={{
                  fontFamily: FONT_SERIF,
                  fontStyle: "italic",
                  fontSize: 32,
                  color: C.navyDeep,
                  fontWeight: 600,
                  marginBottom: 6,
                  textAlign: "center",
                }}
              >
                Visit captured
              </div>
              <div
                style={{
                  color: C.slate600,
                  fontSize: 13,
                  marginBottom: 22,
                  textAlign: "center",
                }}
              >
                45 minutes, 18 seconds · {WORD_COUNT.toLocaleString()} words ·
                offline on Sarah's phone
              </div>

              {/* Stats strip */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 12,
                  width: "min(560px, 100%)",
                  marginBottom: 28,
                }}
              >
                {[
                  { v: WORD_COUNT.toLocaleString(), l: "WORDS" },
                  { v: RECORDING_DURATION_LABEL, l: "DURATION" },
                  { v: "100%", l: "ON-DEVICE" },
                  { v: "0 bytes", l: "SENT TO CLOUD" },
                ].map((s) => (
                  <div
                    key={s.l}
                    style={{
                      background: C.cream,
                      border: `1px solid ${C.border}`,
                      borderRadius: 10,
                      padding: "12px 8px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: FONT_SERIF,
                        fontWeight: 600,
                        fontSize: 18,
                        color: C.navyDeep,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {s.v}
                    </div>
                    <div
                      style={{
                        fontSize: 9.5,
                        letterSpacing: 1.2,
                        fontWeight: 700,
                        color: C.slate500,
                        marginTop: 4,
                      }}
                    >
                      {s.l}
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={handleGenerate}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: `linear-gradient(135deg, ${C.teal} 0%, ${C.tealDark} 100%)`,
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "13px 22px",
                  fontSize: 14.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 6px 20px rgba(44,122,123,0.35)",
                  transition: "transform 150ms",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = "translateY(-1px)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = "translateY(0)")
                }
              >
                <Play size={16} fill="white" />
                Generate Patient Support Plan
              </button>

              <button
                onClick={handleReplay}
                style={{
                  marginTop: 14,
                  background: "transparent",
                  border: "none",
                  color: C.slate500,
                  fontSize: 12.5,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Replay visit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomeVisitCaptureModal;
