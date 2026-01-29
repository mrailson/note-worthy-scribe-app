import { useState, useEffect } from 'react';

export type TextSize = 'smallest' | 'smaller' | 'compact' | 'small' | 'default' | 'medium' | 'large' | 'larger' | 'largest';
export type InterfaceDensity = 'compact' | 'comfortable' | 'spacious';
export type ContainerWidth = 'narrow' | 'standard' | 'wide' | 'full';

interface DisplayPreferences {
  textSize: TextSize;
  interfaceDensity: InterfaceDensity;
  containerWidth: ContainerWidth;
  highContrast: boolean;
  readingFont: boolean;
  autoCollapseUserPrompts: boolean;
}

interface UseDisplayPreferencesReturn {
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
  interfaceDensity: InterfaceDensity;
  setInterfaceDensity: (density: InterfaceDensity) => void;
  containerWidth: ContainerWidth;
  setContainerWidth: (width: ContainerWidth) => void;
  highContrast: boolean;
  setHighContrast: (enabled: boolean) => void;
  readingFont: boolean;
  setReadingFont: (enabled: boolean) => void;
  autoCollapseUserPrompts: boolean;
  setAutoCollapseUserPrompts: (enabled: boolean) => void;
}

const DEFAULT_PREFERENCES: DisplayPreferences = {
  textSize: 'default',
  interfaceDensity: 'comfortable',
  containerWidth: 'full',
  highContrast: false,
  readingFont: false,
  autoCollapseUserPrompts: false,
};

const STORAGE_KEY = 'ai4gp-display-preferences';

export const useDisplayPreferences = (): UseDisplayPreferencesReturn => {
  const [preferences, setPreferences] = useState<DisplayPreferences>(DEFAULT_PREFERENCES);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
      } catch (error) {
        console.error('Failed to parse display preferences from localStorage:', error);
      }
    }
  }, []);

  // Save preferences to localStorage when changed
  const updatePreferences = (updates: Partial<DisplayPreferences>) => {
    const newPreferences = { ...preferences, ...updates };
    setPreferences(newPreferences);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));
  };

  return {
    textSize: preferences.textSize,
    setTextSize: (textSize: TextSize) => updatePreferences({ textSize }),
    interfaceDensity: preferences.interfaceDensity,
    setInterfaceDensity: (interfaceDensity: InterfaceDensity) => updatePreferences({ interfaceDensity }),
    containerWidth: preferences.containerWidth,
    setContainerWidth: (containerWidth: ContainerWidth) => updatePreferences({ containerWidth }),
    highContrast: preferences.highContrast,
    setHighContrast: (highContrast: boolean) => updatePreferences({ highContrast }),
    readingFont: preferences.readingFont,
    setReadingFont: (readingFont: boolean) => updatePreferences({ readingFont }),
    autoCollapseUserPrompts: preferences.autoCollapseUserPrompts,
    setAutoCollapseUserPrompts: (autoCollapseUserPrompts: boolean) => updatePreferences({ autoCollapseUserPrompts }),
  };
};