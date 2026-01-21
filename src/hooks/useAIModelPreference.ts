import { useState, useEffect } from 'react';

// Model options: Speed (Grok) | Balanced (Gemini 3 Flash) | Quality (GPT-5)
export type AIModel = 'grok-beta' | 'google/gemini-3-flash-preview' | 'openai/gpt-5-mini';

interface UseAIModelPreferenceReturn {
  selectedModel: AIModel;
  setSelectedModel: (model: AIModel) => void;
}

export const useAIModelPreference = (): UseAIModelPreferenceReturn => {
  // Default to Gemini 3 Flash for best balance of speed + quality
  const [selectedModel, setSelectedModelState] = useState<AIModel>('google/gemini-3-flash-preview');

  // Load preference from localStorage on mount with migration
  useEffect(() => {
    const saved = localStorage.getItem('ai4gp-model-preference');
    
    // Map valid new model names
    if (saved === 'grok-beta' || saved === 'google/gemini-3-flash-preview' || saved === 'openai/gpt-5-mini') {
      setSelectedModelState(saved);
    } else if (saved === 'chatgpt5' || saved === 'claude' || saved === 'gpt-5' || saved === 'gpt-5-2025-08-07') {
      // Migrate old GPT-5/Claude preferences to new GPT-5 gateway model
      setSelectedModelState('openai/gpt-5-mini');
      localStorage.setItem('ai4gp-model-preference', 'openai/gpt-5-mini');
    } else if (saved === 'grok') {
      // Migrate old grok to grok-beta
      setSelectedModelState('grok-beta');
      localStorage.setItem('ai4gp-model-preference', 'grok-beta');
    } else if (saved === 'deepseek-chat') {
      // Migrate deepseek to Gemini (balanced option)
      setSelectedModelState('google/gemini-3-flash-preview');
      localStorage.setItem('ai4gp-model-preference', 'google/gemini-3-flash-preview');
    }
    // If no saved preference, keep the default (Gemini 3 Flash)
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
