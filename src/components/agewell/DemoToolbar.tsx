// src/components/agewell/DemoToolbar.tsx
// Floating demo control toolbar for AgeWell PSP presentations

import React from "react";
import type { DemoSpeed } from "@/hooks/useDemoMode";

interface DemoToolbarProps {
  isRunning: boolean;
  isPaused: boolean;
  speed: DemoSpeed;
  progress: number;
  completedCount: number;
  totalSections: number;
  onRun: () => void;
  onPause: () => void;
  onResume: () => void;
  onSkipToEnd: () => void;
  onReset: () => void;
  onSetSpeed: (speed: DemoSpeed) => void;
  onExit: () => void;
}

const C = {
  blue: "#005EB8",
  dark: "#003087",
  green: "#009639",
  amber: "#ED8B00",
  red: "#DA291C",
};

export const DemoToolbar: React.FC<DemoToolbarProps> = ({
  isRunning,
  isPaused,
  speed,
  progress,
  completedCount,
  totalSections,
  onRun,
  onPause,
  onResume,
  onSkipToEnd,
  onReset,
  onSetSpeed,
  onExit,
}) => {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "rgba(0, 48, 135, 0.95)",
        backdropFilter: "blur(12px)",
        borderRadius: 16,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        boxShadow: "0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)",
        color: "#fff",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        fontSize: 13,
      }}
    >
      {/* Demo badge */}
      <div
        style={{
          background: C.amber,
          color: "#000",
          padding: "3px 10px",
          borderRadius: 8,
          fontWeight: 800,
          fontSize: 11,
          letterSpacing: 1,
        }}
      >
        DEMO
      </div>

      {/* Progress */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 80 }}>
        <div
          style={{
            width: 60,
            height: 5,
            background: "rgba(255,255,255,0.2)",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${C.green}, #00b347)`,
              borderRadius: 3,
              transition: "width 0.3s",
            }}
          />
        </div>
        <span style={{ fontSize: 11, opacity: 0.8 }}>
          {completedCount}/{totalSections}
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.2)" }} />

      {/* Speed buttons */}
      <div style={{ display: "flex", gap: 3 }}>
        {(["slow", "medium", "fast"] as DemoSpeed[]).map((s) => (
          <button
            key={s}
            onClick={() => onSetSpeed(s)}
            style={{
              padding: "3px 8px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: speed === s ? 700 : 400,
              background: speed === s ? "rgba(255,255,255,0.2)" : "transparent",
              color: speed === s ? "#fff" : "rgba(255,255,255,0.5)",
              transition: "all 0.2s",
            }}
          >
            {s === "slow" ? "🐢" : s === "medium" ? "🏃" : "⚡"}{" "}
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.2)" }} />

      {/* Action buttons */}
      {!isRunning ? (
        <button
          onClick={onRun}
          style={{
            padding: "6px 16px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
            background: C.green,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          ▶ Run Demo
        </button>
      ) : isPaused ? (
        <button
          onClick={onResume}
          style={{
            padding: "6px 16px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
            background: C.green,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          ▶ Resume
        </button>
      ) : (
        <button
          onClick={onPause}
          style={{
            padding: "6px 16px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
            background: C.amber,
            color: "#000",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          ⏸ Pause
        </button>
      )}

      <button
        onClick={onSkipToEnd}
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.3)",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          background: "transparent",
          color: "#fff",
        }}
      >
        ⏭ Skip to Summary
      </button>

      <button
        onClick={onReset}
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.2)",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 500,
          background: "transparent",
          color: "rgba(255,255,255,0.7)",
        }}
      >
        ↺ Reset
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.2)" }} />

      <button
        onClick={onExit}
        style={{
          padding: "4px 8px",
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
          fontSize: 11,
          background: "rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.6)",
        }}
      >
        ✕ Exit
      </button>
    </div>
  );
};
