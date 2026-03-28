// src/hooks/useDemoMode.ts
// Custom hook to manage AgeWell PSP demo mode state and auto-advance logic

import { useState, useRef, useCallback, useEffect } from "react";
import {
  DEMO_PATIENT,
  DEMO_TRANSCRIPT_LINES,
} from "@/constants/demoData";

export type DemoSpeed = "slow" | "medium" | "fast";

const SPEED_MS: Record<DemoSpeed, number> = {
  slow: 7000,
  medium: 1000,
  fast: 400,
};

// After this many sections, "slow" reverts to normal slow speed
const SLOW_INTRO_SECTIONS = 3;
const SLOW_NORMAL_MS = 3000;

interface UseDemoModeOptions {
  sectionIds: string[];
  onNavigateToSection: (sectionId: string, index: number) => void;
  onFillSection: (sectionId: string, data: Record<string, string>) => void;
  onTranscriptLine: (line: (typeof DEMO_TRANSCRIPT_LINES)[number]) => void;
  onComplete: () => void;
  onClearAll: () => void;
}

export function useDemoMode(options: UseDemoModeOptions) {
  const {
    sectionIds,
    onNavigateToSection,
    onFillSection,
    onTranscriptLine,
    onComplete,
    onClearAll,
  } = options;

  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState<DemoSpeed>("medium");
  const [currentDemoIndex, setCurrentDemoIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [transcriptIndex, setTranscriptIndex] = useState(0);

  const cancelRef = useRef(false);
  const pauseRef = useRef(false);

  const delay = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        const check = () => {
          if (cancelRef.current) {
            resolve();
            return;
          }
          if (pauseRef.current) {
            setTimeout(check, 100);
            return;
          }
          setTimeout(resolve, ms);
        };
        check();
      }),
    []
  );

  const runDemo = useCallback(async () => {
    cancelRef.current = false;
    pauseRef.current = false;
    setIsRunning(true);
    setIsPaused(false);

    let tIndex = transcriptIndex;

    for (let i = currentDemoIndex; i < sectionIds.length; i++) {
      if (cancelRef.current) break;

      const sectionId = sectionIds[i];
      const demoData = DEMO_PATIENT[sectionId];

      setCurrentDemoIndex(i);
      onNavigateToSection(sectionId, i);

      await delay(300);
      if (cancelRef.current) break;

      if (demoData) {
        const fields = Object.entries(demoData);
        for (const [fieldKey, fieldValue] of fields) {
          if (cancelRef.current) break;
          onFillSection(sectionId, { [fieldKey]: fieldValue });
          // For slow speed, use extra-slow for first 3 sections then normal slow
          const effectiveMs = speed === "slow" && i >= SLOW_INTRO_SECTIONS
            ? SLOW_NORMAL_MS
            : SPEED_MS[speed];
          await delay(Math.max(50, effectiveMs / fields.length));
        }
      }

      if (tIndex < DEMO_TRANSCRIPT_LINES.length && i % 2 === 0) {
        onTranscriptLine(DEMO_TRANSCRIPT_LINES[tIndex]);
        tIndex++;
        setTranscriptIndex(tIndex);
        if (tIndex < DEMO_TRANSCRIPT_LINES.length) {
          await delay(200);
          onTranscriptLine(DEMO_TRANSCRIPT_LINES[tIndex]);
          tIndex++;
          setTranscriptIndex(tIndex);
        }
      }

      setCompletedCount(i + 1);
      await delay(200);
    }

    if (!cancelRef.current) {
      setIsRunning(false);
      for (let t = tIndex; t < DEMO_TRANSCRIPT_LINES.length; t++) {
        onTranscriptLine(DEMO_TRANSCRIPT_LINES[t]);
      }
      setTranscriptIndex(DEMO_TRANSCRIPT_LINES.length);
      onComplete();
    }
  }, [
    currentDemoIndex,
    sectionIds,
    speed,
    transcriptIndex,
    delay,
    onNavigateToSection,
    onFillSection,
    onTranscriptLine,
    onComplete,
  ]);

  const skipToEnd = useCallback(() => {
    cancelRef.current = true;
    setIsRunning(false);
    setIsPaused(false);

    for (const sectionId of sectionIds) {
      const demoData = DEMO_PATIENT[sectionId];
      if (demoData) {
        onFillSection(sectionId, demoData);
      }
    }

    for (const line of DEMO_TRANSCRIPT_LINES) {
      onTranscriptLine(line);
    }

    setCompletedCount(sectionIds.length);
    setCurrentDemoIndex(sectionIds.length - 1);
    setTranscriptIndex(DEMO_TRANSCRIPT_LINES.length);
    onComplete();
  }, [sectionIds, onFillSection, onTranscriptLine, onComplete]);

  const pause = useCallback(() => {
    pauseRef.current = true;
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    pauseRef.current = false;
    setIsPaused(false);
  }, []);

  const reset = useCallback(() => {
    cancelRef.current = true;
    setIsRunning(false);
    setIsPaused(false);
    setCurrentDemoIndex(0);
    setCompletedCount(0);
    setTranscriptIndex(0);
    onClearAll();
    onNavigateToSection(sectionIds[0], 0);
  }, [sectionIds, onClearAll, onNavigateToSection]);

  const fillCurrentSection = useCallback(
    (sectionId: string) => {
      const demoData = DEMO_PATIENT[sectionId];
      if (demoData) {
        onFillSection(sectionId, demoData);
        setCompletedCount((c) => c + 1);
      }
    },
    [onFillSection]
  );

  const toggleDemoMode = useCallback(() => {
    if (isDemoMode) {
      cancelRef.current = true;
      setIsRunning(false);
      setIsPaused(false);
    }
    setIsDemoMode((v) => !v);
  }, [isDemoMode]);

  useEffect(() => {
    return () => {
      cancelRef.current = true;
    };
  }, []);

  return {
    isDemoMode,
    isRunning,
    isPaused,
    speed,
    currentDemoIndex,
    completedCount,
    totalSections: sectionIds.length,
    progress: Math.round((completedCount / sectionIds.length) * 100),
    toggleDemoMode,
    runDemo,
    skipToEnd,
    pause,
    resume,
    reset,
    setSpeed,
    fillCurrentSection,
  };
}
