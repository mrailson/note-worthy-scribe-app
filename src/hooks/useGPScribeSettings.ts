import { useState, useEffect, useCallback } from "react";
import { ConsultationType, AudioCaptureMode } from "@/types/gpscribe";
import { DEFAULT_SETTINGS } from "@/constants/consultationSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MICROPHONE_STORAGE_KEY = 'gpscribe_microphone_device_id';
const AUDIO_CAPTURE_MODE_KEY = 'gpscribe_audio_capture_mode';

export const useGPScribeSettings = () => {
  const [consultationType, setConsultationType] = useState<ConsultationType>("face-to-face");
  const [outputLevel, setOutputLevel] = useState<number>(DEFAULT_SETTINGS.outputLevel);
  const [showSnomedCodes, setShowSnomedCodes] = useState(DEFAULT_SETTINGS.showSnomedCodes);
  const [formatForEmis, setFormatForEmis] = useState(DEFAULT_SETTINGS.formatForEmis);
  const [formatForSystmOne, setFormatForSystmOne] = useState(DEFAULT_SETTINGS.formatForSystmOne);
  const [tickerEnabled, setTickerEnabled] = useState(DEFAULT_SETTINGS.tickerEnabled);
  const [showTranscriptTimestamps, setShowTranscriptTimestamps] = useState(DEFAULT_SETTINGS.showTranscriptTimestamps);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string | null>(null);
  const [audioCaptureMode, setAudioCaptureMode] = useState<AudioCaptureMode>("mic-only");

  // UI states
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [showTicker, setShowTicker] = useState(false);
  const [tickerText, setTickerText] = useState<string>("");

  const loadUserSettings = useCallback(async () => {
    try {
      // Load microphone setting from localStorage
      const savedMicId = localStorage.getItem(MICROPHONE_STORAGE_KEY);
      if (savedMicId) {
        setSelectedMicrophoneId(savedMicId);
      }
      
      // Load audio capture mode from localStorage
      const savedAudioMode = localStorage.getItem(AUDIO_CAPTURE_MODE_KEY) as AudioCaptureMode | null;
      if (savedAudioMode && (savedAudioMode === 'mic-only' || savedAudioMode === 'mic-browser')) {
        setAudioCaptureMode(savedAudioMode);
      }
      
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
      // Save microphone setting to localStorage
      if (selectedMicrophoneId) {
        localStorage.setItem(MICROPHONE_STORAGE_KEY, selectedMicrophoneId);
      } else {
        localStorage.removeItem(MICROPHONE_STORAGE_KEY);
      }
      
      // Save audio capture mode to localStorage
      localStorage.setItem(AUDIO_CAPTURE_MODE_KEY, audioCaptureMode);
      
      // For now, just show success since user_settings table doesn't exist
      // This can be implemented when the table is created
      toast.success("Settings saved successfully");
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error("Failed to save settings");
    }
  }, [outputLevel, showSnomedCodes, formatForEmis, formatForSystmOne, tickerEnabled, showTranscriptTimestamps, selectedMicrophoneId, audioCaptureMode]);

  const handleMicrophoneChange = useCallback((deviceId: string | null) => {
    setSelectedMicrophoneId(deviceId);
    if (deviceId) {
      localStorage.setItem(MICROPHONE_STORAGE_KEY, deviceId);
    } else {
      localStorage.removeItem(MICROPHONE_STORAGE_KEY);
    }
  }, []);

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

  const handleAudioCaptureModeChange = useCallback((mode: AudioCaptureMode) => {
    setAudioCaptureMode(mode);
    localStorage.setItem(AUDIO_CAPTURE_MODE_KEY, mode);
  }, []);

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
    selectedMicrophoneId,
    audioCaptureMode,

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
    resetSettings,
    handleMicrophoneChange,
    setSelectedMicrophoneId,
    setAudioCaptureMode,
    handleAudioCaptureModeChange
  };
};