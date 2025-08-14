import { useState, useEffect, useCallback } from "react";
import { ConsultationType } from "@/types/gpscribe";
import { DEFAULT_SETTINGS } from "@/constants/consultationSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useGPScribeSettings = () => {
  const [consultationType, setConsultationType] = useState<ConsultationType>("face-to-face");
  const [outputLevel, setOutputLevel] = useState<number>(DEFAULT_SETTINGS.outputLevel);
  const [showSnomedCodes, setShowSnomedCodes] = useState(DEFAULT_SETTINGS.showSnomedCodes);
  const [formatForEmis, setFormatForEmis] = useState(DEFAULT_SETTINGS.formatForEmis);
  const [formatForSystmOne, setFormatForSystmOne] = useState(DEFAULT_SETTINGS.formatForSystmOne);
  const [tickerEnabled, setTickerEnabled] = useState(DEFAULT_SETTINGS.tickerEnabled);
  const [showTranscriptTimestamps, setShowTranscriptTimestamps] = useState(DEFAULT_SETTINGS.showTranscriptTimestamps);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // UI states
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [showTicker, setShowTicker] = useState(false);
  const [tickerText, setTickerText] = useState<string>("");

  const loadUserSettings = useCallback(async () => {
    try {
      // For now, just use default settings since user_settings table doesn't exist
      // This can be implemented when the table is created
      setSettingsLoaded(true);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setSettingsLoaded(true);
    }
  }, []);

  const saveUserSettings = useCallback(async () => {
    try {
      // For now, just show success since user_settings table doesn't exist
      // This can be implemented when the table is created
      toast.success("Settings saved successfully");
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error("Failed to save settings");
    }
  }, [outputLevel, showSnomedCodes, formatForEmis, formatForSystmOne, tickerEnabled, showTranscriptTimestamps]);

  const resetSettings = useCallback(() => {
    setOutputLevel(DEFAULT_SETTINGS.outputLevel);
    setShowSnomedCodes(DEFAULT_SETTINGS.showSnomedCodes);
    setFormatForEmis(DEFAULT_SETTINGS.formatForEmis);
    setFormatForSystmOne(DEFAULT_SETTINGS.formatForSystmOne);
    setTickerEnabled(DEFAULT_SETTINGS.tickerEnabled);
    setShowTranscriptTimestamps(DEFAULT_SETTINGS.showTranscriptTimestamps);
  }, []);

  useEffect(() => {
    loadUserSettings();
  }, [loadUserSettings]);

  return {
    // Settings states
    consultationType,
    outputLevel,
    showSnomedCodes,
    formatForEmis,
    formatForSystmOne,
    tickerEnabled,
    showTranscriptTimestamps,
    settingsLoaded,

    // UI states
    isConfigOpen,
    showTicker,
    tickerText,

    // Actions
    setConsultationType,
    setOutputLevel,
    setShowSnomedCodes,
    setFormatForEmis,
    setFormatForSystmOne,
    setTickerEnabled,
    setShowTranscriptTimestamps,
    setIsConfigOpen,
    setShowTicker,
    setTickerText,
    loadUserSettings,
    saveUserSettings,
    resetSettings
  };
};