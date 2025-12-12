import { useState, useEffect } from 'react';

export type LGAIModel = 'gpt-4o-mini' | 'gpt-5';

interface UseLGAIModelPreferenceReturn {
  selectedModel: LGAIModel;
  setSelectedModel: (model: LGAIModel) => void;
}

export const useLGAIModelPreference = (): UseLGAIModelPreferenceReturn => {
  const [selectedModel, setSelectedModelState] = useState<LGAIModel>('gpt-4o-mini');

  // Load preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('lg-ai-model-preference');
    if (saved === 'gpt-4o-mini' || saved === 'gpt-5') {
      setSelectedModelState(saved);
    }
  }, []);

  // Save preference to localStorage when changed
  const setSelectedModel = (model: LGAIModel) => {
    setSelectedModelState(model);
    localStorage.setItem('lg-ai-model-preference', model);
  };

  return {
    selectedModel,
    setSelectedModel,
  };
};
