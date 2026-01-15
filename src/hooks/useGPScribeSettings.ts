import { useState, useEffect, useCallback } from "react";
import { ConsultationType, AudioCaptureMode } from "@/types/gpscribe";
import { DEFAULT_SETTINGS } from "@/constants/consultationSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Separate localStorage keys for each consultation type's microphone
const MIC_F2F_KEY = 'gpscribe_mic_f2f';
const MIC_TELEPHONE_KEY = 'gpscribe_mic_telephone';
const MIC_VIDEO_KEY = 'gpscribe_mic_video';
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
  const [audioCaptureMode, setAudioCaptureMode] = useState<AudioCaptureMode>("mic-only");

  // Microphone IDs for each consultation type
  const [f2fMicrophoneId, setF2fMicrophoneId] = useState<string | null>(null);
  const [telephoneMicrophoneId, setTelephoneMicrophoneId] = useState<string | null>(null);
  const [videoMicrophoneId, setVideoMicrophoneId] = useState<string | null>(null);
  
  // The currently active microphone (derived from consultation type)
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string | null>(null);

  // UI states
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [showTicker, setShowTicker] = useState(false);
  const [tickerText, setTickerText] = useState<string>("");

  const loadUserSettings = useCallback(async () => {
    try {
      // Load microphone settings for each consultation type from localStorage
      const savedF2fMic = localStorage.getItem(MIC_F2F_KEY);
      const savedTelephoneMic = localStorage.getItem(MIC_TELEPHONE_KEY);
      const savedVideoMic = localStorage.getItem(MIC_VIDEO_KEY);
      
      if (savedF2fMic) setF2fMicrophoneId(savedF2fMic);
      if (savedTelephoneMic) setTelephoneMicrophoneId(savedTelephoneMic);
      if (savedVideoMic) setVideoMicrophoneId(savedVideoMic);
      
      // Set initial selected microphone based on default consultation type (face-to-face)
      setSelectedMicrophoneId(savedF2fMic || null);
      
      // Load audio capture mode from localStorage
      const savedAudioMode = localStorage.getItem(AUDIO_CAPTURE_MODE_KEY) as AudioCaptureMode | null;
      if (savedAudioMode && (savedAudioMode === 'mic-only' || savedAudioMode === 'mic-browser')) {
        setAudioCaptureMode(savedAudioMode);
      }
      
      setSettingsLoaded(true);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setSettingsLoaded(true);
    }
  }, []);

  // Auto-switch microphone when consultation type changes
  useEffect(() => {
    let newMicId: string | null = null;
    
    switch (consultationType) {
      case 'face-to-face':
        newMicId = f2fMicrophoneId;
        break;
      case 'telephone':
        newMicId = telephoneMicrophoneId;
        break;
      case 'video':
        newMicId = videoMicrophoneId;
        break;
    }
    
    if (newMicId !== selectedMicrophoneId) {
      setSelectedMicrophoneId(newMicId);
      
      // Show toast notification if settings are loaded (not initial load)
      if (settingsLoaded && newMicId) {
        toast.info(`Switched to ${consultationType === 'face-to-face' ? 'Face-to-Face' : consultationType === 'telephone' ? 'Telephone' : 'Video'} microphone`);
      }
    }
  }, [consultationType, f2fMicrophoneId, telephoneMicrophoneId, videoMicrophoneId, settingsLoaded]);

  const saveUserSettings = useCallback(async () => {
    try {
      // Save microphone settings for each consultation type to localStorage
      if (f2fMicrophoneId) {
        localStorage.setItem(MIC_F2F_KEY, f2fMicrophoneId);
      } else {
        localStorage.removeItem(MIC_F2F_KEY);
      }
      
      if (telephoneMicrophoneId) {
        localStorage.setItem(MIC_TELEPHONE_KEY, telephoneMicrophoneId);
      } else {
        localStorage.removeItem(MIC_TELEPHONE_KEY);
      }
      
      if (videoMicrophoneId) {
        localStorage.setItem(MIC_VIDEO_KEY, videoMicrophoneId);
      } else {
        localStorage.removeItem(MIC_VIDEO_KEY);
      }
      
      // Save audio capture mode to localStorage
      localStorage.setItem(AUDIO_CAPTURE_MODE_KEY, audioCaptureMode);
      
      toast.success("Settings saved successfully");
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error("Failed to save settings");
    }
  }, [outputLevel, showSnomedCodes, formatForEmis, formatForSystmOne, tickerEnabled, showTranscriptTimestamps, f2fMicrophoneId, telephoneMicrophoneId, videoMicrophoneId, audioCaptureMode]);

  // Handler for F2F microphone change
  const handleF2fMicrophoneChange = useCallback((deviceId: string | null) => {
    setF2fMicrophoneId(deviceId);
    if (deviceId) {
      localStorage.setItem(MIC_F2F_KEY, deviceId);
    } else {
      localStorage.removeItem(MIC_F2F_KEY);
    }
    // If currently on F2F, update the active microphone
    if (consultationType === 'face-to-face') {
      setSelectedMicrophoneId(deviceId);
    }
  }, [consultationType]);

  // Handler for Telephone microphone change
  const handleTelephoneMicrophoneChange = useCallback((deviceId: string | null) => {
    setTelephoneMicrophoneId(deviceId);
    if (deviceId) {
      localStorage.setItem(MIC_TELEPHONE_KEY, deviceId);
    } else {
      localStorage.removeItem(MIC_TELEPHONE_KEY);
    }
    // If currently on Telephone, update the active microphone
    if (consultationType === 'telephone') {
      setSelectedMicrophoneId(deviceId);
    }
  }, [consultationType]);

  // Handler for Video microphone change
  const handleVideoMicrophoneChange = useCallback((deviceId: string | null) => {
    setVideoMicrophoneId(deviceId);
    if (deviceId) {
      localStorage.setItem(MIC_VIDEO_KEY, deviceId);
    } else {
      localStorage.removeItem(MIC_VIDEO_KEY);
    }
    // If currently on Video, update the active microphone
    if (consultationType === 'video') {
      setSelectedMicrophoneId(deviceId);
    }
  }, [consultationType]);

  // Legacy handler for backward compatibility
  const handleMicrophoneChange = useCallback((deviceId: string | null) => {
    // Update the microphone for the current consultation type
    switch (consultationType) {
      case 'face-to-face':
        handleF2fMicrophoneChange(deviceId);
        break;
      case 'telephone':
        handleTelephoneMicrophoneChange(deviceId);
        break;
      case 'video':
        handleVideoMicrophoneChange(deviceId);
        break;
    }
  }, [consultationType, handleF2fMicrophoneChange, handleTelephoneMicrophoneChange, handleVideoMicrophoneChange]);

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
    
    // Per-consultation-type microphone IDs
    f2fMicrophoneId,
    telephoneMicrophoneId,
    videoMicrophoneId,

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
    handleF2fMicrophoneChange,
    handleTelephoneMicrophoneChange,
    handleVideoMicrophoneChange,
    setSelectedMicrophoneId,
    setAudioCaptureMode,
    handleAudioCaptureModeChange
  };
};