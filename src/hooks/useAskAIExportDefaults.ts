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

export function useAskAIExportDefaults() {
  const [defaults, setDefaults] = useState<AskAIExportDefaults>(loadDefaults);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    } catch {}
  }, [defaults]);

  const updateDefault = useCallback(<K extends keyof AskAIExportDefaults>(key: K, value: AskAIExportDefaults[K]) => {
    setDefaults(prev => ({ ...prev, [key]: value }));
  }, []);

  return { defaults, updateDefault, setDefaults };
}
