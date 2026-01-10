import { useState, useCallback, useEffect } from "react";
import { ScribeSettings } from "@/types/scribe";
import { toast } from "sonner";

const DEFAULT_SETTINGS: ScribeSettings = {
  outputFormat: 'summary',
  transcriptionService: 'whisper',
  autoSave: true,
  showTimestamps: false,
  tickerEnabled: true,
};

export const useScribeSettings = () => {
  const [settings, setSettings] = useState<ScribeSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('scribeSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
      setSettingsLoaded(true);
    } catch (error) {
      console.warn('Failed to load Scribe settings:', error);
      setSettingsLoaded(true);
    }
  }, []);

  const saveSettings = useCallback(() => {
    try {
      localStorage.setItem('scribeSettings', JSON.stringify(settings));
      toast.success("Settings saved successfully");
    } catch (error) {
      console.error('Failed to save Scribe settings:', error);
      toast.error("Failed to save settings");
    }
  }, [settings]);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem('scribeSettings');
      toast.success("Settings reset to defaults");
    } catch (error) {
      console.warn('Failed to clear Scribe settings:', error);
    }
  }, []);

  const updateSetting = useCallback(<K extends keyof ScribeSettings>(
    key: K,
    value: ScribeSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  return {
    settings,
    settingsLoaded,
    isConfigOpen,
    setIsConfigOpen,
    saveSettings,
    resetSettings,
    updateSetting,
    setSettings,
  };
};
