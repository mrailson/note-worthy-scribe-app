import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// Cache for user settings to avoid repeated database calls
const settingsCache = new Map<string, any>();

export const usePerformanceOptimizedSettings = () => {
  const { user } = useAuth();
  const [sessionMemory, setSessionMemory] = useState(true);
  const [includeLatestUpdates, setIncludeLatestUpdates] = useState(true);
  const [showResponseMetrics, setShowResponseMetrics] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-5');
  const [isLoaded, setIsLoaded] = useState(false);

  // Memoized cache key for current user
  const cacheKey = useMemo(() => user?.id ? `settings_${user.id}` : null, [user?.id]);

  // Load settings with caching
  const loadUserSettings = useCallback(async () => {
    if (!user || !cacheKey) return;

    // Check cache first
    if (settingsCache.has(cacheKey)) {
      const cachedSettings = settingsCache.get(cacheKey);
      setSessionMemory(cachedSettings.sessionMemory ?? true);
      setIncludeLatestUpdates(cachedSettings.includeLatestUpdates ?? true);
      setShowResponseMetrics(cachedSettings.showResponseMetrics ?? false);
      setSelectedModel(cachedSettings.selectedModel ?? 'gpt-5');
      setIsLoaded(true);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('setting_key, setting_value')
        .eq('user_id', user.id)
        .eq('setting_key', 'ai4gp_preferences')
        .single();

      if (data && !error) {
        const preferences = data.setting_value as any;
        
        // Update state
        setSessionMemory(preferences.sessionMemory ?? true);
        setIncludeLatestUpdates(preferences.includeLatestUpdates ?? true);
        setShowResponseMetrics(preferences.showResponseMetrics ?? false);
        setSelectedModel(preferences.selectedModel ?? 'gpt-5');
        
        // Cache the settings
        settingsCache.set(cacheKey, preferences);
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
    } finally {
      setIsLoaded(true);
    }
  }, [user, cacheKey]);

  // Debounced save to avoid excessive database calls
  const saveUserSettings = useCallback(async (settings: any) => {
    if (!user || !cacheKey) return;

    try {
      // Update cache immediately
      settingsCache.set(cacheKey, settings);

      // Save to database in background
      await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          setting_key: 'ai4gp_preferences',
          setting_value: settings
        }, {
          onConflict: 'user_id,setting_key'
        });
    } catch (error) {
      console.error('Error saving user settings:', error);
    }
  }, [user, cacheKey]);

  // Optimized setters that batch updates
  const updateSettings = useCallback((updates: Partial<{
    sessionMemory: boolean;
    includeLatestUpdates: boolean;
    showResponseMetrics: boolean;
    selectedModel: string;
  }>) => {
    const newSettings = {
      sessionMemory: updates.sessionMemory ?? sessionMemory,
      includeLatestUpdates: updates.includeLatestUpdates ?? includeLatestUpdates,
      showResponseMetrics: updates.showResponseMetrics ?? showResponseMetrics,
      selectedModel: updates.selectedModel ?? selectedModel
    };

    // Update state
    if (updates.sessionMemory !== undefined) setSessionMemory(updates.sessionMemory);
    if (updates.includeLatestUpdates !== undefined) setIncludeLatestUpdates(updates.includeLatestUpdates);
    if (updates.showResponseMetrics !== undefined) setShowResponseMetrics(updates.showResponseMetrics);
    if (updates.selectedModel !== undefined) setSelectedModel(updates.selectedModel);

    // Save to database/cache asynchronously
    Promise.resolve().then(() => saveUserSettings(newSettings));
  }, [sessionMemory, includeLatestUpdates, showResponseMetrics, selectedModel, saveUserSettings]);

  return {
    // Settings values
    sessionMemory,
    includeLatestUpdates,
    showResponseMetrics,
    selectedModel,
    isLoaded,
    
    // Optimized setters
    setSessionMemory: (value: boolean) => updateSettings({ sessionMemory: value }),
    setIncludeLatestUpdates: (value: boolean) => updateSettings({ includeLatestUpdates: value }),
    setShowResponseMetrics: (value: boolean) => updateSettings({ showResponseMetrics: value }),
    setSelectedModel: (value: string) => updateSettings({ selectedModel: value }),
    
    // Batch update function
    updateSettings,
    
    // Load function
    loadUserSettings
  };
};