import { useState, useCallback, useEffect } from "react";
import { ScribeSettings, DEFAULT_SCRIBE_SETTINGS } from "@/types/scribe";
import { toast } from "sonner";

export const useScribeSettings = () => {
  const [settings, setSettings] = useState<ScribeSettings>(DEFAULT_SCRIBE_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('scribeSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SCRIBE_SETTINGS, ...parsed });
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
    setSettings(DEFAULT_SCRIBE_SETTINGS);
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
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem('scribeSettings', JSON.stringify(updated));
      return updated;
    });
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
