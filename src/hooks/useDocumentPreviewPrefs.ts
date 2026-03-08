import { useState, useEffect, useCallback } from 'react';

export type LogoPosition = 'left' | 'centre' | 'right';

export interface DocumentPreviewPrefs {
  showLogo: boolean;
  logoPosition: LogoPosition;
  showFooter: boolean;
  showPageNumbers: boolean;
}

const STORAGE_KEY = 'notewell-doc-preview-prefs';

const DEFAULTS: DocumentPreviewPrefs = {
  showLogo: true,
  logoPosition: 'left',
  showFooter: true,
  showPageNumbers: true,
};

function loadPrefs(): DocumentPreviewPrefs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULTS, ...parsed };
    }
  } catch {}
  return DEFAULTS;
}

export function useDocumentPreviewPrefs() {
  const [prefs, setPrefs] = useState<DocumentPreviewPrefs>(loadPrefs);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);

  const updatePref = useCallback(<K extends keyof DocumentPreviewPrefs>(key: K, value: DocumentPreviewPrefs[K]) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  }, []);

  return { prefs, updatePref, setPrefs };
}
