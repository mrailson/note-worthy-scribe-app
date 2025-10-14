import { useState, useEffect } from 'react';

export type ToastSection = 
  | 'ai4gp'
  | 'meeting_manager'
  | 'translation'
  | 'complaints'
  | 'gpscribe'
  | 'system'
  | 'security';

export interface ToastPreferences {
  ai4gp: boolean;
  meeting_manager: boolean;
  translation: boolean;
  complaints: boolean;
  gpscribe: boolean;
  system: boolean;
  security: boolean;
}

const STORAGE_KEY = 'toast_preferences';

const DEFAULT_PREFERENCES: ToastPreferences = {
  ai4gp: true,
  meeting_manager: true,
  translation: true,
  complaints: true,
  gpscribe: true,
  system: true,
  security: true,
};

const loadPreferences = (): ToastPreferences => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle new sections
      return { ...DEFAULT_PREFERENCES, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load toast preferences:', error);
  }
  return DEFAULT_PREFERENCES;
};

const savePreferences = (preferences: ToastPreferences): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error('Failed to save toast preferences:', error);
  }
};

export const useToastPreferences = () => {
  const [preferences, setPreferences] = useState<ToastPreferences>(loadPreferences);

  const isEnabled = (section: ToastSection): boolean => {
    return preferences[section] ?? true; // Default to enabled
  };

  const toggleSection = (section: ToastSection): void => {
    const newPreferences = {
      ...preferences,
      [section]: !preferences[section],
    };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };

  const enableAll = (): void => {
    const newPreferences = Object.keys(preferences).reduce((acc, key) => ({
      ...acc,
      [key]: true,
    }), {} as ToastPreferences);
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };

  const disableAll = (): void => {
    const newPreferences = Object.keys(preferences).reduce((acc, key) => ({
      ...acc,
      [key]: false,
    }), {} as ToastPreferences);
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };

  const resetToDefaults = (): void => {
    setPreferences(DEFAULT_PREFERENCES);
    savePreferences(DEFAULT_PREFERENCES);
  };

  const allEnabled = Object.values(preferences).every(v => v);
  const allDisabled = Object.values(preferences).every(v => !v);

  return {
    preferences,
    isEnabled,
    toggleSection,
    enableAll,
    disableAll,
    resetToDefaults,
    allEnabled,
    allDisabled,
  };
};
