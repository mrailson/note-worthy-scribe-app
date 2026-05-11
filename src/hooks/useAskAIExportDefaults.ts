import { useState, useEffect, useCallback } from 'react';

export type ImageMode = 'noImages' | 'pictographic' | 'webFreeToUseCommercially' | 'aiGenerated';
export type TextDensity = 'brief' | 'medium' | 'detailed';

export interface AskAIExportDefaults {
  // Infographic
  defaultInfographicStyle: string;
  defaultInfographicOrientation: 'landscape' | 'portrait';
  includeLogoInInfographic: boolean;
  // Slides
  defaultImageMode: ImageMode;
  defaultTextDensity: TextDensity;
}

const STORAGE_KEY = 'notewell-askai-export-defaults';
// Custom event name used to keep multiple hook instances in sync within the same tab.
// Without this, the Document Settings modal updates its own state + localStorage,
// but the DocumentPreviewModal (which also mounts the hook) keeps a stale copy
// and sends the old image mode to Gamma when generating PowerPoints.
const SYNC_EVENT = 'notewell-askai-export-defaults:changed';

const DEFAULTS: AskAIExportDefaults = {
  defaultInfographicStyle: 'practice-professional',
  defaultInfographicOrientation: 'landscape',
  includeLogoInInfographic: false,
  defaultImageMode: 'noImages',
  defaultTextDensity: 'medium',
};

function loadDefaults(): AskAIExportDefaults {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULTS, ...JSON.parse(stored) };
    }
  } catch {}
  return DEFAULTS;
}

function broadcast(next: AskAIExportDefaults) {
  try {
    window.dispatchEvent(new CustomEvent<AskAIExportDefaults>(SYNC_EVENT, { detail: next }));
  } catch {}
}

export function useAskAIExportDefaults() {
  const [defaults, setDefaultsState] = useState<AskAIExportDefaults>(loadDefaults);

  // Listen for changes from other hook instances (same tab) and other tabs.
  useEffect(() => {
    const onSameTab = (e: Event) => {
      const detail = (e as CustomEvent<AskAIExportDefaults>).detail;
      if (detail) setDefaultsState(detail);
    };
    const onCrossTab = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        const next = e.newValue ? { ...DEFAULTS, ...JSON.parse(e.newValue) } : DEFAULTS;
        setDefaultsState(next);
      } catch {}
    };
    window.addEventListener(SYNC_EVENT, onSameTab as EventListener);
    window.addEventListener('storage', onCrossTab);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSameTab as EventListener);
      window.removeEventListener('storage', onCrossTab);
    };
  }, []);

  const persist = useCallback((next: AskAIExportDefaults) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    broadcast(next);
  }, []);

  const updateDefault = useCallback(<K extends keyof AskAIExportDefaults>(key: K, value: AskAIExportDefaults[K]) => {
    setDefaultsState(prev => {
      const next = { ...prev, [key]: value };
      persist(next);
      return next;
    });
  }, [persist]);

  const setDefaults = useCallback((updater: AskAIExportDefaults | ((prev: AskAIExportDefaults) => AskAIExportDefaults)) => {
    setDefaultsState(prev => {
      const next = typeof updater === 'function'
        ? (updater as (p: AskAIExportDefaults) => AskAIExportDefaults)(prev)
        : updater;
      persist(next);
      return next;
    });
  }, [persist]);

  return { defaults, updateDefault, setDefaults };
}
