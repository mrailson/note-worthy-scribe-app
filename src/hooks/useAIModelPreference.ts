import { useState, useEffect } from 'react';

// Speed: Gemini 3 Flash (~1-2s) | Balanced: GPT-5 Mini (~3-5s)
export type AIModel = 'grok' | 'chatgpt5';

interface UseAIModelPreferenceReturn {
  selectedModel: AIModel;
  setSelectedModel: (model: AIModel) => void;
}

export const useAIModelPreference = (): UseAIModelPreferenceReturn => {
  // Default to speed (grok = Gemini 3 Flash)
  const [selectedModel, setSelectedModelState] = useState<AIModel>('grok');

  // Load preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('ai4gp-model-preference');
    if (saved === 'chatgpt5' || saved === 'grok') {
      setSelectedModelState(saved);
    } else if (saved === 'claude' || saved === 'deepseek-chat') {
      // Migrate old preferences to speed mode
      setSelectedModelState('grok');
      localStorage.setItem('ai4gp-model-preference', 'grok');
    }
  }, []);

  // Save preference to localStorage when changed
  const setSelectedModel = (model: AIModel) => {
    setSelectedModelState(model);
    localStorage.setItem('ai4gp-model-preference', model);
  };

  return {
    selectedModel,
    setSelectedModel,
  };
};
