import { useState, useEffect } from 'react';

export type AIModel = 'claude' | 'grok';

interface UseAIModelPreferenceReturn {
  selectedModel: AIModel;
  setSelectedModel: (model: AIModel) => void;
}

export const useAIModelPreference = (): UseAIModelPreferenceReturn => {
  const [selectedModel, setSelectedModelState] = useState<AIModel>('claude');

  // Load preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('ai4gp-model-preference');
    if (saved === 'claude' || saved === 'grok') {
      setSelectedModelState(saved);
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