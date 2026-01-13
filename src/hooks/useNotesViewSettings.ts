import { useState, useEffect, useCallback } from 'react';
import { NotesViewSettings, DEFAULT_NOTES_VIEW_SETTINGS } from '@/types/notesSettings';

const STORAGE_KEY = 'notesViewSettings';

export const useNotesViewSettings = () => {
  const [settings, setSettings] = useState<NotesViewSettings>(DEFAULT_NOTES_VIEW_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as NotesViewSettings;
        // Merge with defaults to handle any new keys added in future
        setSettings({
          ...DEFAULT_NOTES_VIEW_SETTINGS,
          ...parsed,
          visibleSections: {
            ...DEFAULT_NOTES_VIEW_SETTINGS.visibleSections,
            ...parsed.visibleSections,
          },
        });
      }
    } catch (error) {
      console.error('Failed to load notes view settings:', error);
    }
    setIsLoaded(true);
  }, []);

  // Persist settings to localStorage whenever they change
  const persistSettings = useCallback((newSettings: NotesViewSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save notes view settings:', error);
    }
  }, []);

  // Toggle a specific section's visibility
  const toggleSection = useCallback((sectionKey: keyof NotesViewSettings['visibleSections']) => {
    setSettings((prev) => {
      const newSettings: NotesViewSettings = {
        ...prev,
        visibleSections: {
          ...prev.visibleSections,
          [sectionKey]: !prev.visibleSections[sectionKey],
        },
      };
      persistSettings(newSettings);
      return newSettings;
    });
  }, [persistSettings]);

  // Set a specific section's visibility
  const setSectionVisible = useCallback((
    sectionKey: keyof NotesViewSettings['visibleSections'],
    visible: boolean
  ) => {
    setSettings((prev) => {
      const newSettings: NotesViewSettings = {
        ...prev,
        visibleSections: {
          ...prev.visibleSections,
          [sectionKey]: visible,
        },
      };
      persistSettings(newSettings);
      return newSettings;
    });
  }, [persistSettings]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_NOTES_VIEW_SETTINGS);
    persistSettings(DEFAULT_NOTES_VIEW_SETTINGS);
  }, [persistSettings]);

  // Check if a section heading matches any of our tracked sections
  const isSectionVisible = useCallback((sectionHeading: string): boolean => {
    const heading = sectionHeading.toLowerCase();
    
    // Check each section pattern
    if (/executive\s*summary/i.test(heading)) {
      return settings.visibleSections.executiveSummary;
    }
    if (/key\s*points/i.test(heading)) {
      return settings.visibleSections.keyPoints;
    }
    if (/action\s*(list|items?)/i.test(heading)) {
      return settings.visibleSections.actionList;
    }
    if (/open\s*(items?|issues?)/i.test(heading)) {
      return settings.visibleSections.openItems;
    }
    
    // Default: show sections that don't match any known pattern
    return true;
  }, [settings.visibleSections]);

  return {
    settings,
    isLoaded,
    toggleSection,
    setSectionVisible,
    resetToDefaults,
    isSectionVisible,
  };
};
