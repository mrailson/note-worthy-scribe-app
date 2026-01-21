import { useState, useEffect } from 'react';

export type AIModel = 'chatgpt5' | 'grok' | 'deepseek-chat';

interface UseAIModelPreferenceReturn {
  selectedModel: AIModel;
  setSelectedModel: (model: AIModel) => void;
}

export const useAIModelPreference = (): UseAIModelPreferenceReturn => {
  const [selectedModel, setSelectedModelState] = useState<AIModel>('chatgpt5');

  // Load preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('ai4gp-model-preference');
    if (saved === 'chatgpt5' || saved === 'grok' || saved === 'deepseek-chat') {
      setSelectedModelState(saved);
    } else if (saved === 'claude') {
      // Migrate old claude preference to chatgpt5
      setSelectedModelState('chatgpt5');
      localStorage.setItem('ai4gp-model-preference', 'chatgpt5');
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
