import { useState, useCallback, useEffect } from 'react';
import { ChatViewSettings, DEFAULT_CHAT_VIEW_SETTINGS } from '@/types/chatViewSettings';

const STORAGE_KEY = 'ai4gp-chat-view-settings';

export function useChatViewSettings() {
  const [settings, setSettingsState] = useState<ChatViewSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new options gracefully
        return { ...DEFAULT_CHAT_VIEW_SETTINGS, ...parsed };
      }
    } catch (error) {
      console.error('Failed to load chat view settings:', error);
    }
    return DEFAULT_CHAT_VIEW_SETTINGS;
  });

  // Persist to localStorage whenever settings change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save chat view settings:', error);
    }
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof ChatViewSettings>(
    key: K,
    value: ChatViewSettings[K]
  ) => {
    setSettingsState(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setSettingsState(DEFAULT_CHAT_VIEW_SETTINGS);
  }, []);

  return {
    settings,
    updateSetting,
    resetToDefaults,
  };
}
